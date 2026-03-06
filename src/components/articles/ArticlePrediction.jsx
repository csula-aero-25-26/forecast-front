import "./ArticlePrediction.scss"
import React, { useState, useEffect } from 'react'
import Article from "/src/components/articles/base/Article.jsx"
import StandardButton from "/src/components/buttons/StandardButton.jsx"
import { useApi } from "/src/hooks/api.js"
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

/**
 * @param {ArticleDataWrapper} dataWrapper
 * @param {Number} id
 * @return {JSX.Element}
 * @constructor
 */
function ArticlePrediction({ dataWrapper, id }) {
    const [selectedItemCategoryId, setSelectedItemCategoryId] = useState(null)

    return (
        <Article id={dataWrapper.uniqueId}
                 type={Article.Types.SPACING_DEFAULT}
                 dataWrapper={dataWrapper}
                 className={`article-prediction`}
                 selectedItemCategoryId={selectedItemCategoryId}
                 setSelectedItemCategoryId={setSelectedItemCategoryId}>
            <ArticlePredictionContent />
        </Article>
    )
}

/**
 * Extract simplified model name (e.g., "LightGBM" from "LightGBM model using...")
 * @param {String} modelId - The technical model ID
 * @param {String} description - Optional description from the model
 * @return {String} Simplified name like "LightGBM"
 */
function getModelShortName(modelId, description) {
    // If description exists, try to extract the model type from the beginning
    if (description) {
        // Extract first word or common model types
        const match = description.match(/^(LightGBM|Random Forest|LSTM|XGBoost|Neural Network|SVM|Linear Regression)/i);
        if (match) {
            return match[1];
        }
        // Fallback: get first word
        return description.split(' ')[0];
    }
    
    // Fallback to extracting from model_id
    const modelTypeMap = {
        'lgb_f107_lag27_ap_lag3': 'LightGBM',
        'lgb_f107_lag27_ap_lag3_horizon_1': 'LightGBM',
        'linereg_flux_27_lags_ssn_horizon_7': 'Linear Regression',
        'presistence_horizon_7': 'Persistence',
        'rf-v2-aplags': 'Random Forest',
        'lstm': 'LSTM',
    };
    
    if (modelTypeMap[modelId]) {
        return modelTypeMap[modelId];
    }
    
    // Extract from model_id (e.g., "lgb_" -> "LightGBM")
    if (modelId.startsWith('lgb_')) return 'LightGBM';
    if (modelId.startsWith('rf_') || modelId.startsWith('rf-')) return 'Random Forest';
    if (modelId.startsWith('linreg_') || modelId.startsWith('lingreg-')) return 'Linear Regression';
    if (modelId.startsWith('persistence_') || modelId.startsWith('persistence-')) return 'Persistence';
    if (modelId.startsWith('lstm_') || modelId.startsWith('lstm-')) return 'LSTM';
    
    // Last resort: capitalize first part
    return modelId.split('_')[0].split('-')[0].toUpperCase();
}

/**
 * Convert model ID to plain English name
 * @param {String} modelId - The technical model ID
 * @param {String} description - Optional description from the model
 * @return {String} Plain English name
 */
function getModelDisplayName(modelId, description) {
    // If there's a description, use it (it's usually in plain English)
    if (description) {
        return description;
    }
    
    // Otherwise, convert common model ID patterns to plain English
    const modelNameMap = {
        'lgb_f107_lag27_ap_lag3': 'LightGBM Model (27-day F10.7 lag, 3-day AP lag)',
        'rf-v2-aplags': 'Random Forest Model v2',
        'lstm': 'LSTM Neural Network Model',
    };
    
    // Check if we have a mapping
    if (modelNameMap[modelId]) {
        return modelNameMap[modelId];
    }
    
    // Fallback: convert underscores to spaces and capitalize words
    return modelId
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Build chart data from the latest feature vector and predicted value.
 * Uses feature index on the X axis and feature value on the Y axis.
 * The final point represents the predicted flux.
 * @param {Object|null} result - prediction result from backend
 * @return {Array<Object>|null}
 */
function buildPredictionChartData(result) {
    if (!result || !result.features) {
        return null;
    }

    // Helper to extract a numeric lag and base name from keys like:
    // "f107_lag27", "f107_lag_27", "ap_lag3", "ap_lag_3"
    const parseLagKey = (key) => {
        const match = key.match(/^(.*?)(?:_?lag[_-]?)(\d+)$/i);
        if (!match) {
            return null;
        }
        const base = match[1] || "";
        const lag = parseInt(match[2], 10);
        if (Number.isNaN(lag)) {
            return null;
        }
        return { base, lag };
    };

    // Convert numeric-valued features into a sequence and sort from greatest to least. 
    // Now only displays features that start with "f107"

    const entries = Object.entries(result.features)
        .filter(([key, value]) => key?.toLowerCase().startsWith("f107") && typeof value === "number")
        .sort(([aKey], [bKey]) => {
            const aLag = parseLagKey(aKey);
            const bLag = parseLagKey(bKey);

            // If both look like lag keys, sort by base then numeric lag (descending)
            if (aLag && bLag) {
                if (aLag.base !== bLag.base) {
                    return aLag.base.localeCompare(bLag.base);
                }
                // Higher lag number (further in the past) first: 27, 26, ..., 1
                return bLag.lag - aLag.lag;
            }

            // Fallback to simple alphabetical order
            return aKey.localeCompare(bKey);
        });

    const data = entries.map(([key, value], idx) => ({
        idx,
        value: Number(value),
        label: key,
        isPrediction: false,
    }));

    const predictedFlux = result.predicted_flux ?? result.predictedValue;
    if (typeof predictedFlux === "number" && !Number.isNaN(predictedFlux)) {
        data.push({
            idx: data.length,
            value: Number(predictedFlux),
            label: "Predicted flux",
            isPrediction: true,
        });
    }

    return data.length ? data : null;
}

/**
 * Main prediction content component
 * @return {JSX.Element}
 * @constructor
 */
function ArticlePredictionContent() {
    const { handlers } = useApi();
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState("");
    const [horizonDays, setHorizonDays] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [loadingModels, setLoadingModels] = useState(true);

    // Fetch available models on component mount
    useEffect(() => {
        const fetchModels = async () => {
            setLoadingModels(true);
            try {
                const response = await handlers.getModels();
                if (response.success && response.data) {
                    const modelList = response.data.models || [];
                    setModels(modelList);
                    if (modelList.length > 0) {
                        const first = modelList[0];
                        setSelectedModel(first.model_key);
                        const horizons = first.available_horizon_days?.length ? first.available_horizon_days : [1];
                        setHorizonDays(String(horizons[0]));
                    }
                } else {
                    setError(response.error || "Failed to fetch models");
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoadingModels(false);
            }
        };

        fetchModels();
    }, []);

    // Find the selected model object and its available horizon days
    const selectedModelObj = models.find(m => m.model_key === selectedModel);
    const availableHorizonDays = selectedModelObj?.available_horizon_days?.length
        ? selectedModelObj.available_horizon_days
        : [1];

    // When model changes, set horizon to first available for that model
    const handleModelChange = (e) => {
        const modelKey = e.target.value;
        setSelectedModel(modelKey);
        const model = models.find(m => m.model_key === modelKey);
        const horizons = model?.available_horizon_days?.length ? model.available_horizon_days : [1];
        setHorizonDays(horizons.length ? String(horizons[0]) : "");
    };

    const handlePredict = async () => {
        if (!selectedModel || !horizonDays) {
            setError("Please select a model and a horizon");
            return;
        }

        const horizonDaysNum = parseInt(horizonDays, 10);
        if (isNaN(horizonDaysNum) || horizonDaysNum < 1) {
            setError("Please select a valid horizon");
            return;
        }

        const modelIdToUse = selectedModelObj?.model_id_for_horizon?.[horizonDaysNum];
        if (!modelIdToUse) {
            setError("No model available for the selected horizon");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await handlers.makePrediction(modelIdToUse, horizonDaysNum);
            if (response.success) {
                setResult(response.data);
            } else {
                setError(response.error || "Failed to fetch prediction");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const chartData = buildPredictionChartData(result);

    // Give the flux point a unique look
    const renderPredictionDot = (props, { active = false } = {}) => {
            const { cx, cy, payload, stroke } = props || {};
            if (typeof cx !== "number" || typeof cy !== "number") {
                return null;
            }

            // Highlight the final predicted point
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
                        fill="#FFFF"
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
        <div className="article-prediction-content">
            {loadingModels ? (
                <div className="article-prediction-loading">
                    <p>Loading available models...</p>
                </div>
            ) : (
                <>
                    <div className="article-prediction-controls">
                        <div className="article-prediction-control-group">
                            <label htmlFor="model-select" className="article-prediction-label">
                                Prediction Model:
                            </label>
                            <select
                                id="model-select"
                                className="article-prediction-select"
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
                                <div className="article-prediction-description">
                                    <p className="article-prediction-description-text">
                                        {selectedModelObj.description}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="article-prediction-control-group">
                            <label htmlFor="horizon-days-select" className="article-prediction-label">
                                Horizon Days:
                            </label>
                            <select
                                id="horizon-days-select"
                                className="article-prediction-select"
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

                        <div className="article-prediction-button-wrapper">
                            <StandardButton
                                label={loading ? "Predicting..." : "Get Prediction"}
                                onClick={handlePredict}
                                faIcon="fa-solid fa-sun"
                                variant="primary"
                                status={
                                    loading || !selectedModel || !horizonDays || availableHorizonDays.length === 0
                                        ? StandardButton.Status.DISABLED
                                        : StandardButton.Status.ENABLED
                                }
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="article-prediction-error">
                            <p className="article-prediction-error-text">{error}</p>
                        </div>
                    )}

                    {result && (
                        <div className="article-prediction-result">
                            <h5 className="article-prediction-result-title">Prediction Result:</h5>
                            <div className="article-prediction-result-content">
                                <p>
                                    <strong>Predicted Flux:</strong> {result.predicted_flux?.toFixed(3) || result.predictedValue?.toFixed(3) || "N/A"}
                                </p>
                                <p>
                                    <strong>Model ID:</strong> {result.model_id || result.modelVersion || "N/A"}
                                </p>
                                <p>
                                    <strong>Horizon Days:</strong> {result.horizon_days || "N/A"}
                                </p>
                                <p></p>
                            </div>

                            {chartData && (
                                <div className="article-prediction-chart">
                                    <p className="article-prediction-chart-title">
                                        <h5>Latest Feature Vector and Predicted Flux:</h5>
                                    </p>
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
                                                itemStyle={{
                                                    color: "var(--theme-texts)",
                                                }}
                                                labelStyle={{
                                                    color: "var(--theme-texts)",
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="#ffce00"
                                                dot={(props) => renderPredictionDot(props, {active: false})}
                                                activeDot={(props) => renderPredictionDot(props, {active: true})}
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

export default ArticlePrediction
