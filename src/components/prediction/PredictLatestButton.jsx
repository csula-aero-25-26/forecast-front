import React, { useState } from "react";
import StandardButton from "/src/components/buttons/StandardButton.jsx";
import { useApi } from "/src/hooks/api.js";

const PredictLatestButton = () => {
  const { handlers } = useApi();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await handlers.getLatestPrediction();
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
    <div className="prediction-widget">
      <StandardButton
        label={loading ? "Predicting..." : "Predict F10.7 (Latest Data)"}
        onClick={handlePredict}
        faIcon="fa-solid fa-sun"
        variant="primary"
        status={
          loading
            ? StandardButton.Status.DISABLED
            : StandardButton.Status.ENABLED
        }
      />

      {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: "1rem" }}>
          <p>
            <strong>Predicted Value:</strong> {result.predictedValue.toFixed(3)}
          </p>
          <p>
            <strong>Model Version:</strong> {result.modelVersion}
          </p>
        </div>
      )}
    </div>
  );
};

export default PredictLatestButton;
