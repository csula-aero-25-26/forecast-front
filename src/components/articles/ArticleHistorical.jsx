import "./ArticleHistorical.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Article from "/src/components/articles/base/Article.jsx";
import { useApi } from "/src/hooks/api.js";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

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
 * @return {Array<{ dateKey: string, label: string, observed: number|null, predicted: number|null }>}
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
            } else {
                byDate.set(dk, {
                    dateKey: dk,
                    label: dk,
                    observed: null,
                    predicted: val,
                });
            }
        }
    }

    return [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
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

    const chartData = useMemo(
        () => buildChartRows(groundTruths, predictionHistory),
        [groundTruths, predictionHistory]
    );

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
                                View Obsereved (Ground Truths):
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
                        <div className="article-historical-chart-wrap">
                            {loadingPredictions && (
                                <p className="article-historical-chart-status">Loading predictions…</p>
                            )}
                            {predictionsReady && !hasPredictedPoints && selectedModel ? (
                                <p className="article-historical-chart-status">
                                    No saved predictions for this model yet. Only observed flux is shown.
                                </p>
                            ) : null}
                            <ResponsiveContainer width="100%" height={360}>
                                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 4, bottom: 8 }}>
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
                                        tick={{ fill: "var(--theme-texts)" }}
                                        label={{
                                            value: "Solar flux (SFU)",
                                            angle: -90,
                                            position: "insideLeft",
                                            style: { fill: "var(--theme-texts)" },
                                        }}
                                    />
                                    <Tooltip
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
                                            dot={false}
                                            strokeWidth={2}
                                            connectNulls
                                        />
                                    ) : null}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    <p className="article-historical-footnote">
                        Observed values are loaded from the forecast backend (GFZ F10.7 ground-truth history). When a
                        model is selected, predictions are loaded from saved inference history for the chosen horizon. No
                        live prediction is run.
                    </p>
                </>
            )}
        </div>
    );
}

export default ArticleHistorical;
