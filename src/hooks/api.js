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

/**
 * Get base model key (model_id without _horizon_N suffix) for grouping.
 * e.g. "lgb_f107_lag27_ap_lag3_horizon_1" -> "lgb_f107_lag27_ap_lag3"
 * @param {String} modelId
 * @return {String}
 */
function getModelBaseKey(modelId) {
  if (!modelId || typeof modelId !== "string") return modelId || "";
  return modelId.replace(/_horizon_\d+$/i, "").trim() || modelId;
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
   * Groups by base key (model_id without _horizon_N) so one entry per unique model.
   * Each entry has model_key, model_id, family, description, available_horizon_days (all horizons), model_id_for_horizon.
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
      const rawModels = rawList.map((m) => {
        const modelId = m.model_id ?? m.modelId ?? "";
        return {
          model_id: modelId,
          family: m.family ?? "",
          description: m.description ?? "",
          available_horizon_days: parseHorizonDaysFromModelId(modelId),
        };
      });

      const byBase = new Map();
      for (const m of rawModels) {
        const base = getModelBaseKey(m.model_id);
        if (!byBase.has(base)) {
          byBase.set(base, {
            model_key: base,
            model_id: m.model_id,
            family: m.family,
            description: m.description,
            available_horizon_days: [],
            model_id_for_horizon: {},
          });
        }
        const group = byBase.get(base);
        for (const d of m.available_horizon_days) {
          if (!group.available_horizon_days.includes(d)) group.available_horizon_days.push(d);
          group.model_id_for_horizon[d] = m.model_id;
        }
      }
      const models = Array.from(byBase.values()).map((g) => ({
        ...g,
        available_horizon_days: g.available_horizon_days.sort((a, b) => a - b),
      }));

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

  /**
   * Get the latest feature vector that can be used for overrides.
   * Backend response shape: { features: { ... } }
   * @return {Promise<{success: boolean, data?: Object, error?: String}>}
   */
  getFeatures: async () => {
    try {
      const response = await fetch("/api/inference/get-features", {
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
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Generate a prediction using manually supplied feature values.
   * Backend request shape: { modelId, features }
   * Backend response shape: { modelId, predictedValue, manualOverride: true }
   * @param {String} modelId
   * @param {Object} features
   * @return {Promise<{success: boolean, data?: Object, error?: String}>}
   */
  manualOverride: async (modelId, features) => {
    try {
      const response = await fetch("/api/inference/manual-override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelId,
          features,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
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
