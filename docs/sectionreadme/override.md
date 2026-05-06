# Component 2 - Override
* As will be noted in all components as well as the root readme, all sections are created in articles composed of a .jsx and .scss file.

An article component that allows users to manually override F10.7 lag feature values before running a solar flux prediction, enabling what-if analysis against any configured backend ML model.
<p align="center">
  <img src="/docs/assets/readme_override_corrected.png" alt="Loading demo" />
</p>

## Overview

`ArticleOverride` extends the standard prediction workflow by letting users edit the raw input features the model receives, rather than always predicting from the latest real-world data. It wraps the base `Article` component and delegates all logic to an inner content component.

The component is split into two layers:

| Component | Responsibility |
|---|---|
| `ArticleOverride` | Thin wrapper; owns `selectedItemCategoryId` state and passes it into `Article` |
| `ArticleOverrideContent` | All initialization, override logic, API calls, state, and rendering |



## Features

- **Parallel initialization** — fetches models and the current feature vector simultaneously via `Promise.all` on mount, reducing load time compared to sequential calls.
- **Editable lag inputs** — renders a responsive input grid populated with the live `f107_lag*` values from the backend, which the user can freely modify before submitting.
- **Feature merge on submission** — user-edited lag values are validated and merged over the full `baseFeatures` object before being sent to the API, so non-editable features are always included.
- **Per-model horizon selection** — the Horizon Days dropdown updates automatically when the model changes, driven by `available_horizon_days` on the selected model object.
- **Override-specific chart** — after a successful prediction, renders a Recharts `LineChart` of the user-submitted feature vector (not the backend's latest) alongside the predicted flux, so the chart always reflects exactly what was sent.
- **Custom chart dots** — feature points render as yellow circles; the predicted flux point renders as an orange star polygon.



## Data Flow

```
mount
  └─► Promise.all([handlers.getModels(), handlers.getFeatures()])
        └─► setModels(), auto-select first model + horizon
        └─► setBaseFeatures(), populate lagInputs with live f107_lag* values

user edits lag inputs
  └─► handleLagInputChange() → setLagInputs()

user clicks "Generate Override Prediction"
  └─► validate all lagInputs are numeric
  └─► merge lagInputs into baseFeatures → featuresToSend
  └─► resolve model_id_for_horizon[horizonDaysNum]
        └─► handlers.manualOverride(modelId, featuresToSend)
              └─► setResult(), setOverrideFeatures(featuresToSend)
                    └─► buildOverrideChartData(overrideFeatures, predictedValue) → render chart
```



## Key Differences from `ArticlePrediction`

| Concern | `ArticlePrediction` | `ArticleOverride` |
|---|---|---|
| Mount fetch | Models only | Models **and** features in parallel |
| User input | Model + horizon selects | Model + horizon selects + editable lag grid |
| API handler | `handlers.makePrediction()` | `handlers.manualOverride()` |
| Chart source | `result.features` from backend | `overrideFeatures` (what was actually sent) |
| Result field names | Snake_case with camelCase fallbacks | camelCase only (`predictedValue`, `modelId`, `horizonDays`) |
| Memoization | None | `selectedModelObj`, `orderedLagKeys`, `chartData` all memoized |
| Lag input display order | N/A | Ascending by lag number (lag 1 → lag 27) |



## Key Helper Functions

### `getModelShortName(modelId, description)`
Returns a short label for the model `<select>`. Resolution priority:
1. Regex match against the description for known model type names (`LightGBM`, `Random Forest`, etc.).
2. Prefix pattern matching on the model ID (`lgb_`, `rf-`, `linreg_`, etc.).
3. Capitalize the first segment of the model ID as a last resort.

### `buildOverrideChartData(features, predictedValue)`
Transforms the submitted feature object and predicted value into a Recharts-compatible data array. Unlike the equivalent in `ArticlePrediction`, this function receives `features` and `predictedValue` as separate arguments rather than a combined result object, because the chart is built from `overrideFeatures` (user input) rather than the API response body. The filter, sort, and star-point logic are otherwise identical.



## State Reference

| State | Description |
|---|---|
| `models` | List of available model objects from the backend |
| `selectedModel` | Currently selected `model_key` |
| `horizonDays` | Currently selected horizon as a string |
| `baseFeatures` | Full feature map fetched from `handlers.getFeatures()` — not edited by the user |
| `lagInputs` | Controlled input state for each `f107_lag*` key, initialized from `baseFeatures` |
| `overrideFeatures` | The merged feature object actually sent on the last submission — used as chart source |
| `result` | The prediction response, normalized to camelCase fields |
| `loading` / `loadingModels` | Separate loading flags for initialization vs. prediction submission |
| `error` | Active error message, cleared on each new submission attempt |



## API Dependencies

Consumed via the `useApi` hook (`/src/hooks/api.js`):

| Handler | Expected response shape |
|---|---|
| `handlers.getModels()` | `{ success, data: { models: Model[] } }` |
| `handlers.getFeatures()` | `{ success, data: { features: Object } }` |
| `handlers.manualOverride(modelId, features)` | `{ success, data: { predictedValue, modelId, horizonDays } }` |

**`Model` object fields used:**
- `model_key` — unique key, used as the `<select>` value
- `description` — human-readable label shown in the description callout (optional)
- `available_horizon_days` — array of valid horizon integers for this model
- `model_id_for_horizon` — map of `{ [horizonDays]: modelId }` used to resolve the submission ID



## Styling

Styles live in `ArticleOverride.scss` and use the same BEM-style flat class naming convention (`article-override-*`) as the rest of the article family. All colors are CSS custom properties:

| Variable | Usage |
|---|---|
| `--theme-texts` | All body, label, and input text |
| `--theme-primary` | Accent borders on labels, result titles, description callout; focus ring color |
| `--theme-standard-borders` | Select, input, and result card borders |
| `--theme-boards-background` | Result card and chart tooltip background |
| `--theme-danger` | Error banner border and text |
| `--theme-empty` | Select and input backgrounds |

The lag input grid uses `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`, making it fully responsive without any breakpoint logic.



## Development Notes

- **`overrideFeatures` is the chart source, not `result`** — the chart intentionally renders what was sent rather than what the backend echoes back. If the backend ever modifies or filters the feature set in its response, the chart would need to switch to `result.features` to stay accurate.
- **`lagInputs` only covers `f107_lag*` keys** — initialization filters `baseFeatures` to keys starting with `f107_lag`. Other feature keys (e.g. `ap_lag*`) are merged from `baseFeatures` unmodified. If additional feature groups need to be user-editable, the filter in the `initialize` effect and the input grid render must both be updated.
- **Submission validates all lag inputs are numeric** — any non-parseable field blocks the request and sets an inline error naming the offending key. Inputs accept `step="any"` so decimals are valid.
- **`model_id_for_horizon` is required for submission** — if the map is absent or the selected horizon has no entry, the request is blocked with an inline error. This mirrors the same guard in `ArticlePrediction`.
- **Result is normalized on set** — `setResult` explicitly constructs `{ predictedValue, modelId, horizonDays }` from the response, falling back to `modelIdToUse` if `modelId` is absent. There are no snake_case fallbacks; the backend response is expected to be camelCase.
- **`handlers` is included in the `useEffect` dependency array** — unlike `ArticlePrediction`, the initialize effect properly declares `handlers` as a dependency, which prevents stale-closure issues if the hook reference ever changes.
