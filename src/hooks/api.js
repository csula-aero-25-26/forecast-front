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
   * Get list of available prediction models
   * Returns hardcoded list since backend doesn't expose /models endpoint
   * @return {Promise<{success: boolean, data?: Object, error?: String}>}
   */
  getModels: async () => {
    // Return default model list - matches the available model in the backend
    return {
      success: true,
      data: {
        count: 1,
        models: [
          {
            model_id: "lgb_f107_lag27_ap_lag3",
            family: "LightGBM",
            description: "LightGBM model using 27-day F10.7 lag and 3-day AP lag features",
            created_at: null,
          },
        ],
      },
    };
  },

  /**
   * Make a prediction with a specific model and horizon days using latest data
   * @param {String} modelId - The model ID to use for prediction
   * @param {Number} horizonDays - Number of days ahead to predict
   * @return {Promise<{success: boolean, data?: Object, error?: String}>}
   */
  makePrediction: async (modelId, horizonDays) => {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        modelId: modelId,
        horizonDays: horizonDays.toString(),
      });

      const response = await fetch(`/api/input/predict-latest-v2?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Add horizonDays to the response data for component display
      return {
        success: true,
        data: {
          ...data,
          horizon_days: horizonDays,
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
