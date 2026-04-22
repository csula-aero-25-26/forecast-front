import "./ArticleHistorical.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Article from "/src/components/articles/base/Article.jsx";
import StandardButton from "/src/components/buttons/StandardButton.jsx";
import { useApi } from "/src/hooks/api.js";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

/** @typedef {{ left?: string, right?: string, refAreaLeft?: string, refAreaRight?: string, animation: boolean }} HistoricalZoomState */

const HISTORICAL_ZOOM_INITIAL = /** @type {HistoricalZoomState} */ ({
    left: undefined,
    right: undefined,
    refAreaLeft: undefined,
    refAreaRight: undefined,
    animation: true,
});

/** Rough SFU fallback when no numeric points exist in the visible slice. */
const Y_AXIS_FALLBACK = Object.freeze([60, 300]);

/**
 * Numeric Y-axis domain from visible rows (observed + predicted). Recharts categorical zoom works by
 * slicing `data`; domain must be numbers — string forms like `dataMax+10` break scaling.
 * @param {Array<{ observed: * , predicted: * }>} rows
 * @return {[number, number]}
 */
function getYDomainFromRows(rows) {
    let min = Infinity;
    let max = -Infinity;
    for (const d of rows) {
        if (typeof d.observed === "number" && !Number.isNaN(d.observed)) {
            min = Math.min(min, d.observed);
            max = Math.max(max, d.observed);
        }
        if (typeof d.predicted === "number" && !Number.isNaN(d.predicted)) {
            min = Math.min(min, d.predicted);
            max = Math.max(max, d.predicted);
        }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return [...Y_AXIS_FALLBACK];
    }
    if (min === max) {
        const p = Math.max(Math.abs(min) * 0.05, 5);
        return [min - p, max + p];
    }
    const pad = Math.max((max - min) * 0.08, 5);
    return [min - pad, max + pad];
}

/**
 * @param {Array<{ dateKey: string }>} fullSeries
 * @param {string|undefined} left
 * @param {string|undefined} right
 * @return {typeof fullSeries}
 */
function sliceChartByDateRange(fullSeries, left, right) {
    if (!fullSeries.length || left == null || right == null) return fullSeries;
    const lo = left <= right ? left : right;
    const hi = left <= right ? right : left;
    const next = fullSeries.filter((d) => d.dateKey >= lo && d.dateKey <= hi);
    return next.length ? next : fullSeries;
}

/**
 * Star marker for predicted SFU points (matches ArticlePrediction / ArticleOverride).
 * @param {*} props
 * @param {{ active?: boolean }} [opts]
 * @return {JSX.Element|null}
 */
function renderHistoricalPredictedDot(props, { active = false } = {}) {
    const { cx, cy, payload } = props || {};
    if (typeof cx !== "number" || typeof cy !== "number") return null;
    if (payload?.hasSavedPrediction !== true) return null;
    if (typeof payload?.predicted !== "number" || Number.isNaN(payload.predicted)) return null;

    const starPoints = (centerX, centerY, outerR = 7, innerR = 3.5, spikes = 5) => {
        const step = Math.PI / spikes;
        let rot = -Math.PI / 2;
        const pts = [];
        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            pts.push(`${centerX + Math.cos(rot) * r},${centerY + Math.sin(rot) * r}`);
            rot += step;
        }
        return pts.join(" ");
    };

    const outerR = active ? 9 : 7;
    const innerR = active ? 4.5 : 3.5;

    return (
        <polygon
            points={starPoints(cx, cy, outerR, innerR)}
            fill="#FF5C00"
            stroke="var(--theme-boards-background)"
            strokeWidth={2}
        />
    );
}

/**
 * Normalize API date payloads to YYYY-MM-DD for merging series.
 * @param {*} raw
 * @return {String|null}
 */
function toDateKey(raw) {
    if (raw == null) return null;
    if (typeof raw === "string") {
        return raw.length >= 10 ? raw.slice(0, 10) : raw;
    }
    if (Array.isArray(raw) && raw.length >= 3) {
        const [y, m, day] = raw;
        return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    if (typeof raw === "object") {
        if (raw.year != null && raw.monthValue != null && raw.dayOfMonth != null) {
            return `${raw.year}-${String(raw.monthValue).padStart(2, "0")}-${String(raw.dayOfMonth).padStart(2, "0")}`;
        }
        if (raw.year != null && raw.month != null && raw.day != null) {
            return `${raw.year}-${String(raw.month).padStart(2, "0")}-${String(raw.day).padStart(2, "0")}`;
        }
    }
    return null;
}

/**
 * @param {Object} row — ground truth from API
 * @return {String|null}
 */
function groundTruthDateKey(row) {
    if (!row || typeof row !== "object") return null;
    return toDateKey(row.observationDate ?? row.observation_date);
}

/**
 * @param {Object} row — prediction history row from API
 * @return {String|null}
 */
function predictionDateKey(row) {
    if (!row || typeof row !== "object") return null;
    return toDateKey(row.targetDate ?? row.target_date);
}

/**
 * @param {Array<Object>} groundTruths
 * @param {Array<Object>|null} predictionHistory
 * @return {Array<{ dateKey: string, label: string, observed: number|null, predicted: number|null, hasSavedPrediction?: boolean }>}
 */
function buildChartRows(groundTruths, predictionHistory) {
    const byDate = new Map();

    for (const gt of groundTruths) {
        const dk = groundTruthDateKey(gt);
        if (!dk) continue;
        const v =
            gt.actualValue ??
            gt.actual_value ??
            gt.actual_flux ??
            (typeof gt.actualFlux === "number" ? gt.actualFlux : null);
        if (typeof v !== "number" || Number.isNaN(v)) continue;
        byDate.set(dk, {
            dateKey: dk,
            label: dk,
            observed: v,
            predicted: null,
            hasSavedPrediction: false,
        });
    }

    if (predictionHistory?.length) {
        for (const pr of predictionHistory) {
            const dk = predictionDateKey(pr);
            if (!dk) continue;
            const val = pr.value;
            if (typeof val !== "number" || Number.isNaN(val)) continue;
            const existing = byDate.get(dk);
            if (existing) {
                existing.predicted = val;
                existing.hasSavedPrediction = true;
            } else {
                byDate.set(dk, {
                    dateKey: dk,
                    label: dk,
                    observed: null,
                    predicted: val,
                    hasSavedPrediction: true,
                });
            }
        }
    }

    return [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/**
 * When the last ground-truth day has no saved prediction but later dates do, Recharts has no prior
 * non-null `predicted` to draw from — only an isolated future point. Anchor the orange line at the last
 * observed flux (predicted = observed on that day only; not a saved prediction, so no star).
 * @param {Array<Object>} sortedRows
 * @return {Array<Object>}
 */
function bridgePredictedLineFromLastGroundTruth(sortedRows) {
    if (!sortedRows.length) return sortedRows;
    const out = sortedRows.map((r) => ({ ...r }));
    let lastObsIdx = -1;
    for (let i = 0; i < out.length; i++) {
        if (typeof out[i].observed === "number" && !Number.isNaN(out[i].observed)) {
            lastObsIdx = i;
        }
    }
    if (lastObsIdx < 0) return out;

    const hasSavedPredAfter = out
        .slice(lastObsIdx + 1)
        .some(
            (r) =>
                r.hasSavedPrediction === true &&
                typeof r.predicted === "number" &&
                !Number.isNaN(r.predicted)
        );
    if (!hasSavedPredAfter) return out;

    const row = out[lastObsIdx];
    if (typeof row.predicted === "number" && !Number.isNaN(row.predicted)) return out;

    row.predicted = row.observed;
    return out;
}

/**
 * @param {String} modelId
 * @param {String} description
 * @return {String}
 */
function getModelShortName(modelId, description) {
    if (description) {
        const match = description.match(/^(LightGBM|Random Forest|LSTM|XGBoost|Neural Network|SVM|Linear Regression)/i);
        if (match) return match[1];
        return description.split(" ")[0];
    }
    if (modelId?.startsWith("lgb_")) return "LightGBM";
    if (modelId?.startsWith("rf_") || modelId?.startsWith("rf-")) return "Random Forest";
    if (modelId?.startsWith("linreg_") || modelId?.startsWith("lingreg-")) return "Linear Regression";
    if (modelId?.startsWith("persistence_") || modelId?.startsWith("persistence-")) return "Persistence";
    if (modelId?.startsWith("lstm_") || modelId?.startsWith("lstm-")) return "LSTM";
    return (modelId || "").split("_")[0].split("-")[0].toUpperCase() || "Model";
}

/**
 * @param {ArticleDataWrapper} dataWrapper
 * @param {Number} id
 * @return {JSX.Element}
 * @constructor
 */
function ArticleHistorical({ dataWrapper, id }) {
    const [selectedItemCategoryId, setSelectedItemCategoryId] = useState(null);

    return (
        <Article
            id={dataWrapper.uniqueId}
            type={Article.Types.SPACING_DEFAULT}
            dataWrapper={dataWrapper}
            className="article-historical"
            selectedItemCategoryId={selectedItemCategoryId}
            setSelectedItemCategoryId={setSelectedItemCategoryId}
        >
            <ArticleHistoricalContent />
        </Article>
    );
}

/**
 * @return {JSX.Element}
 * @constructor
 */
function ArticleHistoricalContent() {
    const { handlers } = useApi();
    const [groundTruths, setGroundTruths] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [horizonDays, setHorizonDays] = useState("");
    const [predictionHistory, setPredictionHistory] = useState(null);
    const [loadingInit, setLoadingInit] = useState(true);
    const [loadingPredictions, setLoadingPredictions] = useState(false);
    const [error, setError] = useState(null);

    const loadInitial = useCallback(async () => {
        setLoadingInit(true);
        setError(null);
        try {
            const [gtRes, modelsRes] = await Promise.all([handlers.getGroundTruths(), handlers.getModels()]);

            if (!gtRes.success) {
                throw new Error(gtRes.error || "Failed to load ground-truth data");
            }
            setGroundTruths(gtRes.data || []);

            if (!modelsRes.success) {
                throw new Error(modelsRes.error || "Failed to load models");
            }
            const modelList = modelsRes.data?.models || [];
            setModels(modelList);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingInit(false);
        }
    }, [handlers]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    const selectedModelObj = useMemo(
        () => models.find((m) => m.model_key === selectedModel),
        [models, selectedModel]
    );

    const availableHorizonDays = selectedModelObj?.available_horizon_days?.length
        ? selectedModelObj.available_horizon_days
        : [1];

    const resolvedModelId =
        selectedModel && horizonDays
            ? selectedModelObj?.model_id_for_horizon?.[parseInt(horizonDays, 10)]
            : null;

    useEffect(() => {
        if (!resolvedModelId) {
            setPredictionHistory(null);
            return;
        }

        let cancelled = false;
        const run = async () => {
            setLoadingPredictions(true);
            setError(null);
            try {
                const res = await handlers.getPredictionHistory(resolvedModelId);
                if (cancelled) return;
                if (!res.success) {
                    throw new Error(res.error || "Failed to load prediction history");
                }
                setPredictionHistory(res.data || []);
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                    setPredictionHistory(null);
                }
            } finally {
                if (!cancelled) setLoadingPredictions(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [handlers, resolvedModelId]);

    const chartData = useMemo(() => {
        const rows = buildChartRows(groundTruths, predictionHistory);
        return bridgePredictedLineFromLastGroundTruth(rows);
    }, [groundTruths, predictionHistory]);

    const [zoomGraph, setZoomGraph] = useState(() => ({ ...HISTORICAL_ZOOM_INITIAL }));

    useEffect(() => {
        setZoomGraph({ ...HISTORICAL_ZOOM_INITIAL });
    }, [chartData]);

    const zoom = useCallback(() => {
        setZoomGraph((prev) => {
            let { refAreaLeft, refAreaRight } = prev;

            if (refAreaLeft === refAreaRight || refAreaRight == null) {
                return {
                    ...prev,
                    refAreaLeft: undefined,
                    refAreaRight: undefined,
                };
            }

            if (refAreaLeft != null && refAreaRight != null && refAreaLeft > refAreaRight) {
                [refAreaLeft, refAreaRight] = [refAreaRight, refAreaLeft];
            }

            return {
                ...prev,
                refAreaLeft: undefined,
                refAreaRight: undefined,
                left: String(refAreaLeft),
                right: String(refAreaRight),
            };
        });
    }, [chartData]);

    const zoomOut = useCallback(() => {
        setZoomGraph({ ...HISTORICAL_ZOOM_INITIAL });
    }, []);

    const onChartMouseDown = useCallback((e) => {
        const label = e?.activeLabel;
        if (label == null) return;
        setZoomGraph((prev) => ({ ...prev, refAreaLeft: String(label) }));
    }, []);

    const onChartMouseMove = useCallback((e) => {
        const label = e?.activeLabel;
        if (label == null) return;
        setZoomGraph((prev) => {
            if (prev.refAreaLeft == null) return prev;
            return { ...prev, refAreaRight: String(label) };
        });
    }, []);

    const chartZoomed = zoomGraph.left != null && zoomGraph.right != null;

    const displayChartData = useMemo(
        () => sliceChartByDateRange(chartData, zoomGraph.left, zoomGraph.right),
        [chartData, zoomGraph.left, zoomGraph.right]
    );

    const yDomain = useMemo(() => getYDomainFromRows(displayChartData), [displayChartData]);

    const { refAreaLeft, refAreaRight, animation } = zoomGraph;

    const handleModelChange = (e) => {
        const modelKey = e.target.value;
        setSelectedModel(modelKey);
        if (!modelKey) {
            setHorizonDays("");
            return;
        }
        const model = models.find((m) => m.model_key === modelKey);
        const horizons = model?.available_horizon_days?.length ? model.available_horizon_days : [1];
        setHorizonDays(horizons.length ? String(horizons[0]) : "");
    };

    const predictionsReady =
        Boolean(resolvedModelId) && predictionHistory !== null && !loadingPredictions;
    const hasPredictedPoints = chartData.some(
        (row) => row.predicted != null && typeof row.predicted === "number"
    );

    return (
        <div className="article-historical-content">
            {loadingInit ? (
                <div className="article-historical-loading">
                    <p>Loading historical flux data...</p>
                </div>
            ) : (
                <>
                    <div className="article-historical-controls">
                        <div className="article-historical-control-group">
                            <label htmlFor="historical-model-select" className="article-historical-label">
                                View Observed (Ground Truths):
                            </label>
                            <select
                                id="historical-model-select"
                                className="article-historical-select"
                                value={selectedModel}
                                onChange={handleModelChange}
                                disabled={loadingPredictions || models.length === 0}
                            >
                                <option value="">Observed - Ground Truths</option>
                                {models.map((model) => (
                                    <option key={model.model_key} value={model.model_key}>
                                        {getModelShortName(model.model_key, model.description)}
                                    </option>
                                ))}
                            </select>
                            {selectedModel && selectedModelObj?.description && (
                                <div className="article-historical-description">
                                    <p className="article-historical-description-text">{selectedModelObj.description}</p>
                                </div>
                            )}
                        </div>

                        {selectedModel ? (
                            <div className="article-historical-control-group">
                                <label htmlFor="historical-horizon-select" className="article-historical-label">
                                    Horizon (days):
                                </label>
                                <select
                                    id="historical-horizon-select"
                                    className="article-historical-select"
                                    value={horizonDays}
                                    onChange={(e) => setHorizonDays(e.target.value)}
                                    disabled={loadingPredictions || availableHorizonDays.length === 0}
                                >
                                    {availableHorizonDays.map((days) => (
                                        <option key={days} value={String(days)}>
                                            {days} day{days !== 1 ? "s" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : null}
                    </div>

                    {error && (
                        <div className="article-historical-error">
                            <p className="article-historical-error-text">{error}</p>
                        </div>
                    )}

                    {chartData.length === 0 ? (
                        <p className="article-historical-empty">No ground-truth data available yet.</p>
                    ) : (
                        <div
                            className="article-historical-chart-wrap"
                            style={{ userSelect: refAreaLeft ? "none" : undefined }}
                        >
                            {loadingPredictions && (
                                <p className="article-historical-chart-status">Loading predictions…</p>
                            )}
                            {predictionsReady && !hasPredictedPoints && selectedModel ? (
                                <p className="article-historical-chart-status">
                                    No saved predictions for this model yet. Only observed flux is shown.
                                </p>
                            ) : null}
                            <div className="article-historical-chart-toolbar">
                                <p className="article-historical-chart-zoom-hint">
                                    Drag across the chart to zoom a date range.
                                </p>
                                {chartZoomed ? (
                                    <StandardButton
                                        label="Zoom out"
                                        className="article-historical-zoom-out"
                                        onClick={zoomOut}
                                        faIcon="fa-solid fa-magnifying-glass"
                                        variant="primary"
                                        status={StandardButton.Status.ENABLED}
                                    />
                                ) : null}
                            </div>
                            <ResponsiveContainer width="100%" height={360}>
                                <LineChart
                                    data={displayChartData}
                                    margin={{ top: 12, right: 28, left: 56, bottom: 8 }}
                                    onMouseDown={onChartMouseDown}
                                    onMouseMove={onChartMouseMove}
                                    onMouseUp={zoom}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--theme-standard-borders)" />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fill: "var(--theme-texts)", fontSize: 11 }}
                                        tickMargin={8}
                                        minTickGap={24}
                                        angle={-35}
                                        textAnchor="end"
                                        height={72}
                                    />
                                    <YAxis
                                        width={72}
                                        tickMargin={12}
                                        domain={yDomain}
                                        tick={{ fill: "var(--theme-texts)" }}
                                        label={{
                                            value: "Solar Flux",
                                            angle: -90,
                                            position: "left",
                                            offset: 30,
                                            style: { fill: "var(--theme-texts)" },
                                        }}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: "var(--theme-standard-borders)" }}
                                        formatter={(value, name) =>
                                            value != null && typeof value === "number"
                                                ? [value.toFixed(3), name]
                                                : ["—", name]
                                        }
                                        contentStyle={{
                                            backgroundColor: "var(--theme-boards-background)",
                                            borderColor: "var(--theme-standard-borders)",
                                            color: "var(--theme-texts)",
                                        }}
                                        itemStyle={{ color: "var(--theme-texts)" }}
                                        labelStyle={{ color: "var(--theme-texts)" }}
                                        labelFormatter={(label) => `Date: ${label}`}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="observed"
                                        name="Observed (ground truth)"
                                        stroke="#ffce00"
                                        dot={false}
                                        strokeWidth={2}
                                        connectNulls
                                        isAnimationActive={animation}
                                        animationDuration={300}
                                    />
                                    {predictionsReady && hasPredictedPoints ? (
                                        <Line
                                            type="monotone"
                                            dataKey="predicted"
                                            name={`Predicted (${getModelShortName(
                                                resolvedModelId || "",
                                                selectedModelObj?.description
                                            )})`}
                                            stroke="#FF5C00"
                                            strokeWidth={2}
                                            strokeOpacity={1}
                                            dot={(dotProps) =>
                                                renderHistoricalPredictedDot(dotProps, { active: false })
                                            }
                                            activeDot={(dotProps) =>
                                                renderHistoricalPredictedDot(dotProps, { active: true })
                                            }
                                            connectNulls
                                            isAnimationActive={animation}
                                            animationDuration={300}
                                        />
                                    ) : null}
                                    {refAreaLeft != null && refAreaRight != null ? (
                                        <ReferenceArea
                                            x1={refAreaLeft}
                                            x2={refAreaRight}
                                            strokeOpacity={0.35}
                                            stroke="var(--theme-standard-borders)"
                                            fill="var(--theme-primary)"
                                            fillOpacity={0.12}
                                        />
                                    ) : null}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    <p className="article-historical-footnote">
                        Observed values are loaded from the forecast backend (GFZ F10.7 ground-truth history). When a
                        model is selected, predictions are loaded from saved inference history for the chosen horizon. 
                        No live prediction is run. 
                    </p>
                </>
            )}
        </div>
    );
}

export default ArticleHistorical;
