/**
 * @author Ryan Balieiro
 * @date 2025-05-10
 * @description This hook provides methods to interact with external APIs.
 */

import emailjs from "@emailjs/browser";
import { useConstants } from "/src/hooks/constants.js";
import { useUtils } from "/src/hooks/utils.js";

const constants = useConstants();
const utils = useUtils();

export const useApi = () => {
  return {
    validators,
    handlers,
    analytics,
  };
};

/**
 * Parse available horizon days from a model_id string (e.g. "lgb_..._horizon_1" -> [1], "linreg_..._horizon_7" -> [7]).
 * @param {String} modelId
 * @return {Number[]} Sorted unique horizon day values
 */
function parseHorizonDaysFromModelId(modelId) {
  if (!modelId || typeof modelId !== "string") return [];
  const matches = modelId.matchAll(/horizon_(\d+)/gi);
  const days = [...matches].map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n) && n >= 1);
  return [...new Set(days)].sort((a, b) => a - b);
}

const validators = {
  /**
   * @param {String} name
   * @param {String} email
   * @param {String} subject
   * @param {String} message
   */
  validateEmailRequest: (name, email, subject, message) => {
    const minWordCountForMessage = 3;

    const validations = [
      {
        errorCode: constants.ErrorCodes.VALIDATION_EMPTY_FIELDS,
        errorCondition: !name || !email || !subject || !message,
      },
      {
        errorCode: constants.ErrorCodes.VALIDATION_EMAIL,
        errorCondition: !utils.validation.validateEmail(email),
      },
      {
        errorCode: constants.ErrorCodes.VALIDATION_MESSAGE_LENGTH,
        errorCondition: !utils.validation.isLongerThan(
          message,
          minWordCountForMessage
        ),
        messageParameter: minWordCountForMessage + 1,
      },
      {
        errorCode: constants.ErrorCodes.VALIDATION_MESSAGE_SPAM,
        errorCondition: utils.validation.isSpam(message),
      },
    ];

    const error = validations.find((validation) => validation.errorCondition);
    return {
      success: !error,
      errorCode: error?.errorCode,
      errorParameter: error?.messageParameter,
      bundle: {
        name: name,
        from_name: name,
        email: email,
        from_email: email,
        custom_subject: subject,
        message: message,
        custom_source: utils.url.getAbsoluteLocation(),
        custom_source_name: "React Portfolio",
      },
    };
  },
};

const handlers = {
  /**
   * @return {Promise<{success: (*|boolean)}>}
   */
  dummyRequest: async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    window._dummyRequestSuccess = !window._dummyRequestSuccess;

    return {
      success: window._dummyRequestSuccess,
    };
  },

  /**
   * @param {Object} validationBundle
   * @param {String} publicKey
   * @param {String} serviceId
   * @param {String} templateId
   * @return {Promise<{success: boolean}>}
   */
  sendEmailRequest: async (
    validationBundle,
    publicKey,
    serviceId,
    templateId
  ) => {
    emailjs.init(publicKey);

    const response = { success: false };

    try {
      const result = await emailjs.send(
        serviceId,
        templateId,
        validationBundle
      );
      response.success = result.status === 200;
    } catch (error) {
      response.success = false;
    }

    return response;
  },

  /**
   * Test connection to Spring Boot backend
   * @return {Promise<{success: boolean, data?: Object, error?: String}>}
   */
  testBackendConnection: async () => {
    try {
      const response = await fetch("/api/test", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // UPDATE TO TEMPLATE
  /**
   * Fetch the latest solar flux prediction from backend
   * @return {Promise<{success: boolean, data?: Object, error?: String}>}
   */
  getLatestPrediction: async () => {
    try {
      const response = await fetch("/api/input/predict-latest", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get list of available prediction models from backend.
   * Supports both model-service shape { models: [...] } and Spring list response.
   * Each model is normalized to { model_id, family, description, available_horizon_days }.
   * available_horizon_days is derived from model_id (e.g. horizon_1 -> [1], horizon_7 -> [7]).
   * @return {Promise<{success: boolean, data?: { models: Array }, error?: String}>}
   */
  getModels: async () => {
    try {
      const response = await fetch("/api/models", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rawList = Array.isArray(data) ? data : (data.models || []);
      const models = rawList.map((m) => {
        const modelId = m.model_id ?? m.modelId ?? "";
        return {
          model_id: modelId,
          family: m.family ?? "",
          description: m.description ?? "",
          available_horizon_days: parseHorizonDaysFromModelId(modelId),
        };
      });

      return {
        success: true,
        data: { models },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Make a prediction with a specific model
   * @param {String} modelId - The model ID to use for prediction
   * @param {Number} horizonDays - Number of days ahead to predict 
   * @return {Promise<{success: boolean, data?: Object, error?: String}>}
   */
  makePrediction: async (modelId, horizonDays) => {
    try {
      const params = new URLSearchParams({
        modelId: modelId,
      });

      const response = await fetch(
        `/api/inference/predict-latest-v2-phase2?${params.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Backend returns: { predictionId, predictedValue, modelId, horizonDays }
      // Normalize to what the components already expect.
      const resolvedHorizon = data.horizonDays ?? horizonDays;
      return {
        success: true,
        data: {
          ...data,
          predicted_flux: data.predicted_flux ?? data.predictedValue,
          model_id: data.model_id ?? data.modelId,
          horizon_days: resolvedHorizon,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

const analytics = {
  /**
   * @description This method can be used to report a visit to an external analytics service.
   * Here, you can integrate Google Analytics, Mixpanel, or your own custom analytics implementation.
   * @returns {Promise<void>}
   */
  reportVisit: async () => {
    await fetch("https://ryanbalieiro.com/api/analytics/mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        params: {
          url: utils.url.getRootLocation(),
          template_id: "react-portfolio",
        },
      }),
    });
  },
};
