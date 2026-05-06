# Component 1 - Prediction

<p align="center">
  <img src="/docs/assets/readme_prediction_corrected.png" alt="Loading demo" />
</p>

As will be noted in all components as well as the root readme, all sections are created in articles composed of a .jsx and .scss file.

## Overview

`ArticlePrediction` wraps the base `Article` component and renders an interactive control panel where users can select a prediction model and a forecast horizon, trigger a prediction via the API, and view the result alongside a feature-vector line chart.

The component is split into two layers:

| Component | Responsibility |
|---|---|
| `ArticlePrediction` | Thin wrapper; owns `selectedItemCategoryId` state and passes it into `Article` |
| `ArticlePredictionContent` | All prediction logic, API calls, state, and rendering |



## Features

- **Dynamic model loading** — fetches the available model list from the backend on mount via `handlers.getModels()`. The first model and its first available horizon day are selected automatically.
- **Per-model horizon selection** — the Horizon Days dropdown is driven by `available_horizon_days` on the selected model object, so options update automatically when the model changes.
- **Model-to-horizon ID resolution** — uses `model_id_for_horizon` (a map on the model object) to resolve the exact model ID to submit for a given horizon before calling `handlers.makePrediction()`.
- **Feature vector chart** — after a successful prediction, renders a Recharts `LineChart` of the F10.7 lag features ordered from greatest lag to least, with the predicted flux appended as the final point.
- **Custom chart dots** — historical feature points render as yellow circles; the predicted flux point renders as a distinct orange star polygon to make it immediately identifiable.
- **Inline error display** — API and validation errors surface in a styled banner inside the component without disrupting the parent layout.



## Data Flow

```
mount
  └─► handlers.getModels()
        └─► setModels(), auto-select first model + horizon

user clicks "Get Prediction"
  └─► resolve model_id_for_horizon[horizonDaysNum]
        └─► handlers.makePrediction(modelId, horizonDays)
              └─► setResult() → buildPredictionChartData() → render chart
```



## Key Helper Functions

### `getModelShortName(modelId, description)`
Returns a short display label (e.g. `"LightGBM"`) for use in the model `<select>`. Resolution priority:
1. Regex match against the description string for known model type names.
2. Hardcoded `modelTypeMap` lookup by full model ID.
3. Prefix pattern matching on the model ID (`lgb_`, `rf-`, `linreg_`, etc.).
4. Capitalize the first segment of the model ID as a last resort.

### `getModelDisplayName(modelId, description)`
Returns a full plain-English label. Uses the description string directly if present; otherwise falls back to a `modelNameMap` or humanizes the model ID by replacing underscores with spaces.

### `buildPredictionChartData(result)`
Transforms the prediction result into a Recharts-compatible data array:
- Filters `result.features` to **only** keys prefixed with `f107`.
- Sorts entries by numeric lag value descending (lag 27 → lag 1) using the `parseLagKey` helper, which handles both `f107_lag27` and `f107_lag_27` formats.
- Appends the predicted flux as a final point flagged with `isPrediction: true`, which the custom dot renderer uses to draw the star shape.
- Returns `null` if no usable features are present, suppressing the chart entirely.



## API Dependencies

Consumed via the `useApi` hook (`/src/hooks/api.js`):

| Handler | Expected response shape |
|---|---|
| `handlers.getModels()` | `{ success, data: { models: Model[] } }` |
| `handlers.makePrediction(modelId, horizonDays)` | `{ success, data: PredictionResult }` |

**`Model` object fields used:**

- `model_key` — unique key, used as the `<select>` value
- `description` — human-readable description (optional)
- `available_horizon_days` — array of valid horizon integers for this model
- `model_id_for_horizon` — map of `{ [horizonDays]: modelId }` used to resolve the exact model ID before submission

**`PredictionResult` fields used:**

- `predicted_flux` / `predictedValue` — the output value (both spellings handled)
- `model_id` / `modelVersion` — echoed back for display
- `horizon_days` — echoed back for display
- `features` — key/value map of input features used to build the chart



## Styling

Styles live in `ArticlePrediction.scss` and follow the project's BEM-style flat class naming (`article-prediction-*`). All colors are sourced from CSS custom properties for full theme compatibility:

| Variable | Usage |
|---|---|
| `--theme-texts` | All body and label text |
| `--theme-primary` | Accent borders on labels, result titles, description callout |
| `--theme-standard-borders` | Select and result card borders |
| `--theme-boards-background` | Result card and chart tooltip background |
| `--theme-danger` | Error banner border and text |
| `--theme-empty` | Select background |

The `StandardButton` inside `.article-prediction-button-wrapper` is forced to `width: 100%` to fill its control group.



## Development Notes

- **Dual field name support** — the result parser handles both snake_case (`predicted_flux`, `model_id`) and camelCase (`predictedValue`, `modelVersion`) to stay compatible with any backend serialization format in use. 
- **Horizon defaults to `[1]`** — if a model returns an empty or missing `available_horizon_days`, the UI falls back to `[1]` rather than breaking. Ensure the backend always populates this field to avoid silent UX degradation.
- **`model_id_for_horizon` is required for submission** — if this map is absent or the selected horizon is not a key in it, prediction is blocked with an inline error. This is intentional as a guard against sending an ambiguous model ID to the API.
