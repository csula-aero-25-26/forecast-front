import "./ArticleForecastParams.scss"
import React, {useEffect, useState} from 'react'
import Article from "/src/components/articles/base/Article.jsx"


/**
 * @param {object} item - The raw object from the "articles" array in f10-params.json
 * @param {any} value - The current value for this field (from parent state)
 * @param {Function} onChange - The function to call when this value changes
 */
function FormItemRenderer({ item, value, onChange }) {
    const { 
        type, 
        name, 
        label, 
        options, 
        defaultValue, 
        defaultValues,
        min, 
        max, 
        step, 
        unit, 
        helpText 
    } = item;

    const handleChange = (e) => {
        const { value, type, checked } = e.target;
        if (type === "checkbox") {
            onChange(name, value, checked);
        } else {
            onChange(name, value);
        }
    };

    const renderField = () => {
         switch (type) {
            case "slider":
                return (
                    <div className="form-group form-group-slider">
                        <label htmlFor={name}>{label} {unit ? `(${unit})` : ''}</label>
                        
                        {/* ⬇️ ⬇️ ⬇️ MODIFIED: Added a wrapper div ⬇️ ⬇️ ⬇️ */}
                        <div className="slider-wrapper">
                            <input 
                                type="range" 
                                id={name}
                                name={name}
                                min={min}
                                max={max}
                                step={step}
                                value={value || defaultValue} 
                                onChange={handleChange}     
                            />
                            {/* ⬇️ ⬇️ ⬇️ ADDED: Span to display the value ⬇️ ⬇️ ⬇️ */}
                            <span className="slider-value">{value || defaultValue}</span>
                        </div>
                        
                        {helpText && <small className="help-text">{helpText}</small>}
                    </div>
                );

            case "select":
                return (
                    <div className="form-group form-group-select">
                        <label htmlFor={name}>{label}</label>
                        <select 
                            id={name} 
                            name={name} 
                            value={value || defaultValue} 
                            onChange={handleChange}     
                        >
                            {options && options.map((opt, index) => (
                                <option key={index} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        {helpText && <small className="help-text">{helpText}</small>}
                    </div>
                );
            
            case "checkbox-group":
                return (
                    <div className="form-group form-group-checkbox">
                        <fieldset>
                            <legend>{label}</legend>
                            {options && options.map((opt, index) => (
                                <label key={index} className="checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        name={name} 
                                        value={opt.value}
                                        onChange={handleChange}
                                    />
                                    {opt.label}
                                </label>
                            ))}
                            {helpText && <small className="help-text">{helpText}</small>}
                        </fieldset>
                    </div>
                );

            case "radio-group":
                 return (
                    <div className="form-group form-group-radio">
                        <fieldset>
                            <legend>{label}</legend>
                            {options && options.map((opt, index) => (
                                <label key={index} className="radio-label">
                                    <input 
                                        type="radio" 
                                        name={name} 
                                        value={opt.value} 
                                        checked={value ? value === opt.value : defaultValue === opt.value} 
                                        onChange={handleChange}
                                    />
                                    {opt.label}
                                </label>
                            ))}
                            {helpText && <small className="help-text">{helpText}</small>}
                        </fieldset>
                    </div>
                );

            default:
                return (
                    <div className="form-group">
                        <p><strong>Error:</strong> Unknown field type: {String(type)}</p>
                    </div>
                );
        }
    }
    
    return (
         <div className={`article-forecast-params-item`}>
            {renderField()}
        </div>
    )
}



/**
 * @param {ArticleDataWrapper} dataWrapper
 * @param {Number} id
 * @return {JSX.Element}
 * @constructor
 */
function ArticleForecastParams({ dataWrapper, id }) {
    const [formFields, setFormFields] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({});
    const [forecastResult, setForecastResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const path = `${import.meta.env.BASE_URL}data/sections/f10-params.json`;
        
        fetch(path)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} (Failed to load ${path})`);
                }
                return response.json();
            })
            .then(data => {
                const initialData = {};
                (data.articles || []).forEach(field => {
                    if (field.defaultValue) {
                        initialData[field.name] = field.defaultValue;
                    }
                    if (field.defaultValues) {
                        initialData[field.name] = field.defaultValues;
                    }
                });
                setFormData(initialData);
                setFormFields(data.articles || []);
                setIsLoading(false);
            })
            .catch(e => {
                setError(`Failed to fetch form data: ${e.message}`);
                setIsLoading(false);
            });

    }, []);

    const handleFormChange = (name, value, checked) => {
        setFormData(prevData => {
            return {
                ...prevData,
                [name]: value
            };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setForecastResult(null);

        const API_ENDPOINT = "/api/run-forecast"; // ⚠️ ⚠️ ⚠️ Change this

        fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            return response.json();
        })
        .then(resultData => {
            setForecastResult(resultData);
            setIsSubmitting(false);
        })
        .catch(err => {
            setError(err.message);
            setIsSubmitting(false);
        });
    };

    return (
        <Article id={dataWrapper.uniqueId}
                 type={Article.Types.SPACING_DEFAULT}
                 dataWrapper={dataWrapper}
                 className={`article-forecast-params`}>
            
            <form className={`article-forecast-params-items`} onSubmit={handleSubmit}>
                {isLoading && <p>Loading parameters...</p>}
                {error && <p style={{color: 'red'}}>{error}</p>}
                
                {!isLoading && !error && formFields.map((field, key) => (
                    <FormItemRenderer 
                        item={field} 
                        key={key} 
                        value={formData[field.name]}
                        onChange={handleFormChange}
                    />
                ))}

                {!isLoading && !error && (
                    <div className="form-group form-submit">
                        <button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Generating..." : "Generate Forecast"}
                        </button>
                    </div>
                )}
            </form>

            {forecastResult && (
                <div className="forecast-result">
                    <h3>Forecast Generated!</h3>
                    <pre>{JSON.stringify(forecastResult, null, 2)}</pre>
                </div>
            )}

        </Article>
    )
}

export default ArticleForecastParams