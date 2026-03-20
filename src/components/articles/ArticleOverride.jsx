import "./ArticleOverride.scss";
import React, { useEffect, useMemo, useState } from "react";
import Article from "/src/components/articles/base/Article.jsx";
import StandardButton from "/src/components/buttons/StandardButton.jsx";
import { useApi } from "/src/hooks/api.js";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

/**
 * @param {ArticleDataWrapper} dataWrapper
 * @param {Number} id
 * @return {JSX.Element}
 * @constructor
 */
function ArticleOverride({ dataWrapper, id }) {
    const [selectedItemCategoryId, setSelectedItemCategoryId] = useState(null);

    return (
        <Article
            id={dataWrapper.uniqueId}
            type={Article.Types.SPACING_DEFAULT}
            dataWrapper={dataWrapper}
            className="article-override"
            selectedItemCategoryId={selectedItemCategoryId}
            setSelectedItemCategoryId={setSelectedItemCategoryId}
        >
            <ArticleOverrideContent />
        </Article>
    );
}

/**
 * Convert model ID to a short model name for select labels.
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
 * Build chart data from override features and predicted value.
 * @param {Object} features
 * @param {Number|null} predictedValue
 * @return {Array<Object>|null}
 */
function buildOverrideChartData(features, predictedValue) {
    if (!features || typeof features !== "object") {
        return null;
    }

    const parseLagKey = (key) => {
        const match = key.match(/^(.*?)(?:_?lag[_-]?)(\d+)$/i);
        if (!match) return null;
        const lag = parseInt(match[2], 10);
        if (Number.isNaN(lag)) return null;
        return { base: match[1] || "", lag };
    };

    const entries = Object.entries(features)
        .filter(([key, value]) => key?.toLowerCase().startsWith("f107") && typeof value === "number")
        .sort(([aKey], [bKey]) => {
            const aLag = parseLagKey(aKey);
            const bLag = parseLagKey(bKey);
            if (aLag && bLag) {
                if (aLag.base !== bLag.base) {
                    return aLag.base.localeCompare(bLag.base);
                }
                return bLag.lag - aLag.lag;
            }
            return aKey.localeCompare(bKey);
        });

    const data = entries.map(([key, value], idx) => ({
        idx,
        value: Number(value),
        label: key,
        isPrediction: false,
    }));

    if (typeof predictedValue === "number" && !Number.isNaN(predictedValue)) {
        data.push({
            idx: data.length,
            value: Number(predictedValue),
            label: "Predicted flux",
            isPrediction: true,
        });
    }

    return data.length ? data : null;
}

/**
 * @return {JSX.Element}
 * @constructor
 */
function ArticleOverrideContent() {
    const { handlers } = useApi();
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [horizonDays, setHorizonDays] = useState("");
    const [loadingModels, setLoadingModels] = useState(true);

    const [baseFeatures, setBaseFeatures] = useState({});
    const [lagInputs, setLagInputs] = useState({});
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [overrideFeatures, setOverrideFeatures] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const initialize = async () => {
            setLoadingModels(true);
            setError(null);
            try {
                const [modelsResponse, featuresResponse] = await Promise.all([
                    handlers.getModels(),
                    handlers.getFeatures(),
                ]);

                if (!modelsResponse.success) {
                    throw new Error(modelsResponse.error || "Failed to fetch models");
                }

                const modelList = modelsResponse.data?.models || [];
                setModels(modelList);
                if (modelList.length > 0) {
                    const first = modelList[0];
                    setSelectedModel(first.model_key);
                    const horizons = first.available_horizon_days?.length
                        ? first.available_horizon_days
                        : [1];
                    setHorizonDays(String(horizons[0]));
                }

                if (!featuresResponse.success) {
                    throw new Error(featuresResponse.error || "Failed to fetch features");
                }

                const latestFeatures = featuresResponse.data?.features || {};
                setBaseFeatures(latestFeatures);

                const initialLagInputs = {};
                Object.entries(latestFeatures).forEach(([key, value]) => {
                    if (key.toLowerCase().startsWith("f107_lag")) {
                        initialLagInputs[key] = typeof value === "number" ? String(value) : "";
                    }
                });
                setLagInputs(initialLagInputs);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoadingModels(false);
            }
        };

        initialize();
    }, [handlers]);

    const selectedModelObj = useMemo(
        () => models.find((m) => m.model_key === selectedModel),
        [models, selectedModel]
    );

    const availableHorizonDays = selectedModelObj?.available_horizon_days?.length
        ? selectedModelObj.available_horizon_days
        : [1];

    const orderedLagKeys = useMemo(() => {
        return Object.keys(lagInputs).sort((a, b) => {
            const aLag = parseInt((a.match(/(\d+)$/) || [])[1], 10);
            const bLag = parseInt((b.match(/(\d+)$/) || [])[1], 10);
            if (Number.isNaN(aLag) || Number.isNaN(bLag)) {
                return a.localeCompare(b);
            }
            return aLag - bLag;
        });
    }, [lagInputs]);

    const handleModelChange = (e) => {
        const modelKey = e.target.value;
        setSelectedModel(modelKey);
        const model = models.find((m) => m.model_key === modelKey);
        const horizons = model?.available_horizon_days?.length ? model.available_horizon_days : [1];
        setHorizonDays(horizons.length ? String(horizons[0]) : "");
    };

    const handleLagInputChange = (key, value) => {
        setLagInputs((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleGenerateOverride = async () => {
        if (!selectedModel || !horizonDays) {
            setError("Please select a model and a horizon");
            return;
        }

        const horizonDaysNum = parseInt(horizonDays, 10);
        if (Number.isNaN(horizonDaysNum) || horizonDaysNum < 1) {
            setError("Please select a valid horizon");
            return;
        }

        const modelIdToUse = selectedModelObj?.model_id_for_horizon?.[horizonDaysNum];
        if (!modelIdToUse) {
            setError("No model available for the selected horizon");
            return;
        }

        const featuresToSend = { ...baseFeatures };
        for (const key of orderedLagKeys) {
            const parsed = parseFloat(lagInputs[key]);
            if (Number.isNaN(parsed)) {
                setError(`Please enter a valid number for ${key}`);
                return;
            }
            featuresToSend[key] = parsed;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setOverrideFeatures(null);

        try {
            const response = await handlers.manualOverride(modelIdToUse, featuresToSend);
            if (!response.success) {
                throw new Error(response.error || "Failed to generate override prediction");
            }

            setResult({
                ...response.data,
                predictedValue: response.data?.predictedValue,
                modelId: response.data?.modelId ?? modelIdToUse,
                horizonDays: horizonDaysNum,
            });
            setOverrideFeatures(featuresToSend);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const chartData = useMemo(
        () => buildOverrideChartData(overrideFeatures, result?.predictedValue),
        [overrideFeatures, result]
    );

    const renderPredictionDot = (props, { active = false } = {}) => {
        const { cx, cy, payload, stroke } = props || {};
        if (typeof cx !== "number" || typeof cy !== "number") {
            return null;
        }

        if (payload?.isPrediction) {
            const starPoints = (centerX, centerY, outerR = 9, innerR = 4.5, spikes = 5) => {
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

            const outerR = active ? 11 : 9;
            const innerR = active ? 5.5 : 4.5;

            return (
                <polygon
                    points={starPoints(cx, cy, outerR, innerR)}
                    fill="#FF5C00"
                    stroke="var(--theme-boards-background)"
                    strokeWidth={2}
                />
            );
        }

        const r = active ? 4 : 5;
        return (
            <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={stroke || "#ffce00"}
                stroke="var(--theme-boards-background)"
                strokeWidth={1.5}
            />
        );
    };

    return (
        <div className="article-override-content">
            {loadingModels ? (
                <div className="article-override-loading">
                    <p>Loading model and feature data...</p>
                </div>
            ) : (
                <>
                    <div className="article-override-controls">
                        <div className="article-override-control-group">
                            <label htmlFor="override-model-select" className="article-override-label">
                                Prediction Model:
                            </label>
                            <select
                                id="override-model-select"
                                className="article-override-select"
                                value={selectedModel}
                                onChange={handleModelChange}
                                disabled={loading || models.length === 0}
                            >
                                {models.length === 0 ? (
                                    <option value="">No models available</option>
                                ) : (
                                    models.map((model) => (
                                        <option key={model.model_key} value={model.model_key}>
                                            {getModelShortName(model.model_key, model.description)}
                                        </option>
                                    ))
                                )}
                            </select>
                            {selectedModel && selectedModelObj?.description && (
                                <div className="article-override-description">
                                    <p className="article-override-description-text">{selectedModelObj.description}</p>
                                </div>
                            )}
                        </div>

                        <div className="article-override-control-group">
                            <label htmlFor="override-horizon-days-select" className="article-override-label">
                                Horizon Days:
                            </label>
                            <select
                                id="override-horizon-days-select"
                                className="article-override-select"
                                value={horizonDays}
                                onChange={(e) => setHorizonDays(e.target.value)}
                                disabled={loading || availableHorizonDays.length === 0}
                            >
                                {availableHorizonDays.length === 0 ? (
                                    <option value="">No horizon available</option>
                                ) : (
                                    availableHorizonDays.map((days) => (
                                        <option key={days} value={String(days)}>
                                            {days} day{days !== 1 ? "s" : ""}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div className="article-override-control-group">
                            <label className="article-override-label">Manual F10.7 Lag Values:</label>
                            {orderedLagKeys.length === 0 ? (
                                <p className="article-override-empty-inputs">No f107 lag features available.</p>
                            ) : (
                                <div className="article-override-input-grid">
                                    {orderedLagKeys.map((key) => (
                                        <div key={key} className="article-override-input-item">
                                            <label htmlFor={`lag-${key}`} className="article-override-input-label">
                                                {key}
                                            </label>
                                            <input
                                                id={`lag-${key}`}
                                                type="number"
                                                step="any"
                                                className="article-override-input"
                                                value={lagInputs[key]}
                                                onChange={(e) => handleLagInputChange(key, e.target.value)}
                                                disabled={loading}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="article-override-button-wrapper">
                            <StandardButton
                                label={loading ? "Generating..." : "Generate Override Prediction"}
                                onClick={handleGenerateOverride}
                                faIcon="fa-solid fa-sliders"
                                variant="primary"
                                status={
                                    loading || !selectedModel || !horizonDays || orderedLagKeys.length === 0
                                        ? StandardButton.Status.DISABLED
                                        : StandardButton.Status.ENABLED
                                }
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="article-override-error">
                            <p className="article-override-error-text">{error}</p>
                        </div>
                    )}

                    {result && (
                        <div className="article-override-result">
                            <h5 className="article-override-result-title">Override Prediction Result:</h5>
                            <div className="article-override-result-content">
                                <p>
                                    <strong>Predicted Flux:</strong>{" "}
                                    {typeof result.predictedValue === "number"
                                        ? result.predictedValue.toFixed(3)
                                        : "N/A"}
                                </p>
                                <p>
                                    <strong>Model ID:</strong> {result.modelId || "N/A"}
                                </p>
                                <p>
                                    <strong>Horizon Days:</strong> {result.horizonDays || "N/A"}
                                </p>
                            </div>

                            {chartData && (
                                <div className="article-override-chart">
                                    <h5 className="article-override-chart-title">
                                        Manual Feature Vector and Predicted Flux:
                                    </h5>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart
                                            data={chartData}
                                            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="idx"
                                                label={{
                                                    value: "Feature index (ordered)",
                                                    position: "insideBottomRight",
                                                    offset: -5,
                                                }}
                                            />
                                            <YAxis />
                                            <Tooltip
                                                formatter={(value, _name, props) => {
                                                    const label = props?.payload?.label || "Value";
                                                    return [value, label];
                                                }}
                                                contentStyle={{
                                                    backgroundColor: "var(--theme-boards-background)",
                                                    borderColor: "var(--theme-standard-borders)",
                                                    color: "var(--theme-texts)",
                                                }}
                                                itemStyle={{ color: "var(--theme-texts)" }}
                                                labelStyle={{ color: "var(--theme-texts)" }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#ffce00"
                                                dot={(props) => renderPredictionDot(props, { active: false })}
                                                activeDot={(props) => renderPredictionDot(props, { active: true })}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default ArticleOverride;
