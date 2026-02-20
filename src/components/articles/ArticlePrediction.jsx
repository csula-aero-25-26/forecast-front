import "./ArticlePrediction.scss"
import React, { useState, useEffect } from 'react'
import Article from "/src/components/articles/base/Article.jsx"
import StandardButton from "/src/components/buttons/StandardButton.jsx"
import { useApi } from "/src/hooks/api.js"

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
                        setSelectedModel(first.model_id);
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
    const selectedModelObj = models.find(m => m.model_id === selectedModel);
    const availableHorizonDays = selectedModelObj?.available_horizon_days?.length
        ? selectedModelObj.available_horizon_days
        : [1];

    // When model changes, set horizon to first available for that model
    const handleModelChange = (e) => {
        const modelId = e.target.value;
        setSelectedModel(modelId);
        const model = models.find(m => m.model_id === modelId);
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

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await handlers.makePrediction(selectedModel, horizonDaysNum);
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
                                        <option key={model.model_id} value={model.model_id}>
                                            {getModelShortName(model.model_id, model.description)}
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
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default ArticlePrediction
