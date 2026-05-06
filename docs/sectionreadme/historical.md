# Component 3 - Historical
* As will be noted in all components as well as the root readme, all sections are created in articles composed of a .jsx and .scss file.

An article component that plots GFZ F10.7 ground-truth flux history alongside saved model predictions, with drag-to-zoom for navigating the full date range. No live predictions are run.
<p align="center">
  <img src="/docs/assets/readme_flux_history.png" alt="Loading demo" />
</p>


## Overview

`ArticleHistorical` wraps the base `Article` component and renders a dual-series line chart. Ground-truth observed flux is always shown; a model and horizon can optionally be selected to overlay the saved prediction history for that model on the same chart.

The component is split into two layers:

| Component | Responsibility |
|---|---|
| `ArticleHistorical` | Thin wrapper; owns `selectedItemCategoryId` state and passes it into `Article` |
| `ArticleHistoricalContent` | All data loading, series merging, zoom state, and rendering |

## Features

- **Always-on observed series** - ground-truth flux loads on mount and renders immediately, with no model selection required.
- **Optional prediction overlay** - selecting a model and horizon triggers a second fetch for that model's saved inference history, which is merged onto the same date axis as the observed series.
- **Drag-to-zoom** - click-drag across the chart to focus a date range; a Zoom Out button appears in the toolbar while zoomed. Zoom state resets automatically when the underlying data changes.
- **Dynamic Y-axis domain** - the Y axis is recalculated from the currently visible slice of data rather than using Recharts string expressions, preventing scaling issues during zoom.
- **Bridge line** - if saved predictions exist for future dates but the last ground-truth day has no corresponding prediction, the orange predicted line is anchored to the last observed value to prevent a floating disconnected segment.
- **Star dot marker** - predicted series points render as orange star polygons, consistent with the dot style used across `ArticlePrediction` and `ArticleOverride`. Only points flagged `hasSavedPrediction: true` receive the star; the bridge anchor point does not.
- **Stale fetch cancellation** - the prediction history effect uses a `cancelled` flag to drop responses from superseded requests when the model or horizon changes quickly.
- **Inline status messaging** - separate status lines distinguish between "loading predictions," "no saved predictions for this model," and the chart being empty due to missing ground-truth data.

## Data Flow

```
mount
  └─► Promise.all([handlers.getGroundTruths(), handlers.getModels()])
        └─► setGroundTruths(), setModels()
              └─► buildChartRows() + bridgePredictedLineFromLastGroundTruth() → chartData

user selects model + horizon
  └─► resolvedModelId = model_id_for_horizon[horizonDays]
        └─► handlers.getPredictionHistory(resolvedModelId)
              └─► setPredictionHistory()
                    └─► buildChartRows() + bridge() → chartData (re-memoized)

user drags chart
  └─► onMouseDown → refAreaLeft
  └─► onMouseMove → refAreaRight
  └─► onMouseUp (zoom()) → left + right set → sliceChartByDateRange() → displayChartData
                                                                       → getYDomainFromRows() → yDomain
user clicks "Zoom Out"
  └─► zoomOut() → HISTORICAL_ZOOM_INITIAL → full series restored
```



## Key Helper Functions

### `buildChartRows(groundTruths, predictionHistory)`
Merges two independent API series into a single date-keyed array suitable for Recharts. Ground-truth rows are inserted first; prediction rows are joined by matching `dateKey`. Dates present in predictions but absent in ground-truth are added as observed-null rows. The final array is sorted chronologically by `dateKey`.

Each row shape: `{ dateKey, label, observed, predicted, hasSavedPrediction }`.

### `bridgePredictedLineFromLastGroundTruth(sortedRows)`
Detects the case where the last ground-truth date has no saved prediction but future prediction-only rows exist. In this case it sets `predicted = observed` on that last row so Recharts has a non-null starting point to draw the line from. The row is **not** flagged `hasSavedPrediction`, so no star is rendered at the bridge point.

### `toDateKey(raw)`
Normalizes whatever date format the backend returns - ISO string, `[year, month, day]` array, Java `LocalDate`-style object (`{ year, monthValue, dayOfMonth }`), or plain `{ year, month, day }` - into a consistent `YYYY-MM-DD` string used as the merge key throughout the component.

### `sliceChartByDateRange(fullSeries, left, right)`
Filters the full chart rows to the zoomed date range. Handles reversed drag direction (right-to-left) by normalizing `lo`/`hi` before filtering. Falls back to the full series if the slice would be empty.

### `getYDomainFromRows(rows)`
Computes a numeric `[min, max]` Y domain from whichever of `observed` and `predicted` are present in the visible rows, with an 8% padding on each side. Falls back to `[60, 300]` SFU if no numeric points exist. This is required because Recharts' string-expression domains (e.g. `dataMax+10`) break when the data array is sliced for zoom.

### `getModelShortName(modelId, description)`
Shared short label resolver - same resolution logic as `ArticlePrediction` and `ArticleOverride`. Used for the prediction `<Line>` legend name.

### `renderHistoricalPredictedDot(props, { active })`
Star polygon dot renderer - matches the style used in the other article components but only fires when `payload.hasSavedPrediction === true`, so the bridge anchor point stays visually clean.



## State Reference

| State | Description |
|---|---|
| `groundTruths` | Raw ground-truth rows from `handlers.getGroundTruths()` |
| `models` | Available model list from `handlers.getModels()` |
| `selectedModel` | Currently selected `model_key`; empty string = ground-truth only |
| `horizonDays` | Currently selected horizon as a string |
| `predictionHistory` | Raw saved prediction rows for the resolved model ID; `null` = not yet loaded |
| `loadingInit` | True while the initial parallel fetch (ground truths + models) is in flight |
| `loadingPredictions` | True while the prediction history fetch is in flight |
| `error` | Active error message, cleared at the start of each fetch |
| `zoomGraph` | Object holding `{ left, right, refAreaLeft, refAreaRight, animation }` |



## Zoom State Shape

```js
{
    left: string | undefined,       // Start date of committed zoom range
    right: string | undefined,      // End date of committed zoom range
    refAreaLeft: string | undefined, // Drag start (in progress)
    refAreaRight: string | undefined,// Drag end (in progress)
    animation: boolean              // Disabled while drag is active
}
```

`left`/`right` drive `sliceChartByDateRange`. `refAreaLeft`/`refAreaRight` drive the `<ReferenceArea>` highlight shown during an active drag. The entire object resets to `HISTORICAL_ZOOM_INITIAL` whenever `chartData` changes.



## API Dependencies

Consumed via the `useApi` hook (`/src/hooks/api.js`):

| Handler | Expected response shape |
|---|---|
| `handlers.getGroundTruths()` | `{ success, data: GroundTruth[] }` |
| `handlers.getModels()` | `{ success, data: { models: Model[] } }` |
| `handlers.getPredictionHistory(modelId)` | `{ success, data: PredictionRow[] }` |

**`GroundTruth` fields read:**
- `observationDate` / `observation_date` - date of the reading (any format supported by `toDateKey`)
- `actualValue` / `actual_value` / `actual_flux` / `actualFlux` - the observed SFU value

**`PredictionRow` fields read:**
- `targetDate` / `target_date` - the date the prediction was made for
- `value` - the predicted SFU value

**`Model` object fields used:**
- `model_key`, `description`, `available_horizon_days`, `model_id_for_horizon` - same as the other article components



## Styling

Styles live in `ArticleHistorical.scss` following the `article-historical-*` flat naming convention. All colors are CSS custom properties:

| Variable | Usage |
|---|---|
| `--theme-texts` | All labels, axis ticks, tooltip text, status lines, footnote |
| `--theme-primary` | Label accent borders, focus ring, zoom `<ReferenceArea>` fill |
| `--theme-standard-borders` | Select border, chart grid, tooltip border, drag cursor |
| `--theme-boards-background` | Tooltip background, model description callout |
| `--theme-empty` | Select background |

The model select has a `max-width: 28rem` cap not present on the other article selects, keeping it from stretching too wide on large viewports. `userSelect: none` is applied inline to the chart wrapper during an active drag to prevent text selection interfering with the gesture.



## Development Notes

- **No live prediction is run** - this component only reads stored inference history. The backend must have saved predictions for a given model/horizon before the overlay will have anything to show. The footnote at the bottom of the section communicates this to the user.
- **`toDateKey` handles 4 date formats** - the backend may return dates as ISO strings, Java `LocalDate` arrays, Java `LocalDate`-style objects, or plain `{ year, month, day }` objects. If a new format is introduced, `toDateKey` is the only place that needs updating.
- **Both field name spellings are supported on ground-truth rows** - snake_case (`observation_date`, `actual_value`) and camelCase (`observationDate`, `actualValue`) are both handled. Prediction rows only use `targetDate`/`target_date` and `value`.
- **Zoom resets on data change** - the `useEffect` that calls `setZoomGraph(HISTORICAL_ZOOM_INITIAL)` fires whenever `chartData` changes, so switching models or horizons always returns the user to the full view.
- **Stale fetch cancellation is one-way** - the `cancelled` flag prevents a stale response from setting state, but the in-flight request itself is not aborted. If the backend is slow, switching models rapidly will still fire multiple requests; only the last one's result will be applied.
- **`hasPredictedPoints` checks `chartData`, not `displayChartData`** - the "no saved predictions" status message is based on the full unzoomed series. If the user is zoomed into a window with no predictions, the message will not incorrectly appear.
- **The bridge point does not get a star** - `bridgePredictedLineFromLastGroundTruth` sets `predicted = observed` but leaves `hasSavedPrediction: false`. `renderHistoricalPredictedDot` gates on `hasSavedPrediction === true`, so the anchor is visually seamless.
