import "./ArticlePrediction.scss"
import React, { useState, useEffect } from 'react'
import Article from "/src/components/articles/base/Article.jsx"
import StandardButton from "/src/components/buttons/StandardButton.jsx"
import Input from "/src/components/forms/fields/Input.jsx"
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
        'rf-v2-aplags': 'Random Forest',
        'lstm': 'LSTM',
    };
    
    if (modelTypeMap[modelId]) {
        return modelTypeMap[modelId];
    }
    
    // Extract from model_id (e.g., "lgb_" -> "LightGBM")
    if (modelId.startsWith('lgb_')) return 'LightGBM';
    if (modelId.startsWith('rf_') || modelId.startsWith('rf-')) return 'Random Forest';
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
                        setSelectedModel(modelList[0].model_id);
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

    // Find the selected model object to get its description
    const selectedModelObj = models.find(m => m.model_id === selectedModel);

    const handlePredict = async () => {
        if (!selectedModel || !horizonDays) {
            setError("Please select a model and enter horizon days");
            return;
        }

        const horizonDaysNum = parseInt(horizonDays, 10);
        if (isNaN(horizonDaysNum) || horizonDaysNum < 1) {
            setError("Please enter a valid number of horizon days (1 or more)");
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
                                onChange={(e) => setSelectedModel(e.target.value)}
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
                            <label htmlFor="horizon-days-input" className="article-prediction-label">
                                Horizon Days:
                            </label>
                            <Input
                                id="horizon-days-input"
                                name="horizonDays"
                                type="number"
                                model={horizonDays}
                                setModel={setHorizonDays}
                                placeholder="Enter number of days"
                                className="article-prediction-input"
                                required={true}
                            />
                        </div>

                        <div className="article-prediction-button-wrapper">
                            <StandardButton
                                label={loading ? "Predicting..." : "Get Prediction"}
                                onClick={handlePredict}
                                faIcon="fa-solid fa-sun"
                                variant="primary"
                                status={
                                    loading || !selectedModel || !horizonDays
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
