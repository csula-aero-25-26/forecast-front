import React, { useEffect, useState, useContext } from "react";
import { DateRange } from "react-date-range";
import { format } from "date-fns";
import "react-date-range/dist/styles.css"; // Main styles
import "react-date-range/dist/theme/default.css"; // Theme styles
import SectionBody from "/src/components/sections/SectionBody.jsx"
import { getDefaultStaticRanges, getDefaultInputRanges } from "/src/hooks/utils/dateRangePresets.js"

export default function ArticleDateRange({ dataWrapper }) {
  const article = dataWrapper
  const { dateRange: sharedRange, setDateRange } = useContext(SectionBody.Context)

  const [range, setRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ])

  const [inputValues, setInputValues] = useState({})

  const updateRangeAndContext = (newStartDate, newEndDate) => {
    setRange([{ startDate: newStartDate, endDate: newEndDate, key: "selection" }])
    if (setDateRange) setDateRange({ startDate: newStartDate, endDate: newEndDate })
  }

  useEffect(() => {
    if (!article) return

    const uniqueId = article.uniqueId || article.id
    if (!uniqueId) return

    const start = article.settings?.default_start || new Date().getFullYear()
    const end = article.settings?.default_end || new Date().getFullYear()

    const initial = {
      startDate: new Date(`${start}-01-01`),
      endDate: new Date(`${end}-12-31`),
      key: "selection",
    }

    setRange([initial])

    if (setDateRange) setDateRange({ startDate: initial.startDate, endDate: initial.endDate })
    
    const inputRanges = getDefaultInputRanges()
    const newInputValues = {}
    inputRanges.forEach((inputRange, idx) => {
      newInputValues[idx] = inputRange.getCurrentValue(initial) || "1"
    })
    setInputValues(newInputValues)
  }, [article?.uniqueId, setDateRange])

  if (!article) return <p>Article configuration not provided</p>

  const { title, start_label, end_label } = article.locales?.en || {}

  return (
    <div className="article-date-range" style={{ padding: "20px" }}>
      <style>{`
        /* Calendar wrapper and top bar use card background in light, section accent in dark */
        .article-date-range .rdrCalendarWrapper,
        .article-date-range .rdrMonth,
        .article-date-range .rdrMonthsHorizontal,
        .article-date-range .rdrMonthsVertical,
        .article-date-range .rdrMonths .rdrMonthAndYearWrapper {
          background: var(--theme-card-background);
        }
        [data-theme="dark"] .article-date-range .rdrCalendarWrapper,
        [data-theme="dark"] .article-date-range .rdrMonth,
        [data-theme="dark"] .article-date-range .rdrMonthsHorizontal,
        [data-theme="dark"] .article-date-range .rdrMonthsVertical,
        [data-theme="dark"] .article-date-range .rdrMonths .rdrMonthAndYearWrapper {
          background: var(--theme-section-background-accent);
        }
        .article-date-range .rdrCalendarWrapper {
          color: var(--theme-texts);
          border: 1px solid var(--theme-standard-borders);
          border-radius: 6px;
          padding: 8px;
        }
        [data-theme="dark"] .article-date-range .rdrCalendarWrapper {
          border-color: var(--theme-standard-borders);
        }
        .article-date-range .rdrMonth {
          border-radius: 6px 6px 0 0;
          padding: 6px 8px;
          margin-bottom: 6px;
        }
        .article-date-range .rdrMonth > .rdrMonthName {
          color: var(--theme-texts);
          font-weight: 600;
        }
        [data-theme="dark"] .article-date-range .rdrMonth > .rdrMonthName {
          color: var(--theme-texts-inv);
        }
        .article-date-range .rdrMonthName, .article-date-range .rdrWeekDays, .article-date-range .rdrDayNumber {
          color: var(--theme-texts);
        }
        .article-date-range .rdrDayToday {
          box-shadow: 0 0 0 1px var(--theme-primary) inset;
        }
        .article-date-range .rdrDaySelected, .article-date-range .rdrDayActive, .article-date-range .rdrSelected {
          background: var(--theme-primary) !important;
          color: var(--theme-texts-inv) !important;
        }
        /* Preview days (from other months): lighter in both themes */
        .article-date-range .rdrDayPassive {
          color: var(--theme-texts-4, #b0b0b0);
          opacity: 0.7;
        }
        [data-theme="dark"] .article-date-range .rdrDayPassive {
          color: var(--theme-texts-light-3, #cccccc);
          opacity: 0.7;
        }
        /* Preset and apply buttons */
        .article-date-range .adr-preset-btn, .article-date-range .adr-apply-btn {
          border: 1px solid var(--theme-standard-borders);
          border-radius: 4px;
          cursor: pointer;
          color: var(--theme-texts);
          font-size: 14px;
          background-color: var(--theme-background-contrast);
        }
        [data-theme="dark"] .article-date-range .adr-preset-btn, [data-theme="dark"] .article-date-range .adr-apply-btn {
          background-color: var(--theme-primary);
          color: var(--theme-texts-inv);
        }
        .article-date-range .adr-preset-btn:hover, .article-date-range .adr-apply-btn:hover {
          background-color: var(--theme-primary-5, var(--theme-primary)) !important;
          color: var(--theme-texts-inv) !important;
        }
        .article-date-range .adr-input {
          padding: 6px 8px;
          border: 1px solid var(--theme-standard-borders);
          border-radius: 4px;
          font-size: 13px;
          width: 64px;
          background-color: var(--theme-card-background);
          color: var(--theme-texts);
          text-align: center;
        }
        /* Date input fields at top of calendar */
        .article-date-range .rdrDateInput,
        .article-date-range .rdrDateInputWrapper,
        .article-date-range .rdrInputDateFieldWrapper {
          background: var(--theme-card-background);
          color: var(--theme-texts);
          border-color: var(--theme-standard-borders);
        }
        [data-theme="dark"] .article-date-range .rdrDateInput,
        [data-theme="dark"] .article-date-range .rdrDateInputWrapper,
        [data-theme="dark"] .article-date-range .rdrInputDateFieldWrapper {
          background: var(--theme-section-background-accent);
          color: var(--theme-texts-inv);
          border-color: var(--theme-standard-borders);
        }
        .article-date-range .rdrDateInput input,
        .article-date-range .rdrDateInputWrapper input,
        .article-date-range .rdrInputDateFieldWrapper input {
          background: var(--theme-card-background);
          color: var(--theme-texts);
          border-color: var(--theme-standard-borders);
        }
        [data-theme="dark"] .article-date-range .rdrDateInput input,
        [data-theme="dark"] .article-date-range .rdrDateInputWrapper input,
        [data-theme="dark"] .article-date-range .rdrInputDateFieldWrapper input {
          background: var(--theme-section-background-accent);
          color: var(--theme-texts-inv);
          border-color: var(--theme-standard-borders);
        }
        /* Container holding both start and end date inputs */
        .article-date-range .rdrInputs {
          background: var(--theme-card-background);
          border-color: var(--theme-standard-borders);
        }
        [data-theme="dark"] .article-date-range .rdrInputs {
          background: var(--theme-section-background-accent);
          border-color: var(--theme-standard-borders);
        }
        /* Padding area around the input boxes */
        .article-date-range .rdrInput {
          background: var(--theme-card-background);
        }
        [data-theme="dark"] .article-date-range .rdrInput {
          background: var(--theme-section-background-accent);
        }
        /* Title bar at top */
        .article-date-range .adr-title-bar {
          background: var(--theme-card-background);
          color: var(--theme-texts);
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 16px;
          margin: 0 0 16px 0;
        }
        [data-theme="dark"] .article-date-range .adr-title-bar {
          background: var(--theme-section-background-accent);
          color: var(--theme-texts-inv);
        }
        /* Selected range bar below calendar */
        .article-date-range .adr-selected-bar {
          background: var(--theme-card-background);
          color: var(--theme-texts);
          padding: 10px 16px;
          border-radius: 6px;
          margin-top: 20px;
        }
        [data-theme="dark"] .article-date-range .adr-selected-bar {
          background: var(--theme-section-background-accent);
          color: var(--theme-texts-inv);
        }
      `}</style>

      <h2 className="adr-title-bar">{title}</h2>

      {/* Date Range Picker with Preset Buttons */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* Preset Range Buttons and Input Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", minWidth: "180px" }}>
          {/* Static Preset Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {getDefaultStaticRanges().map((preset, idx) => (
              <button
                key={idx}
                className="adr-preset-btn"
                onClick={() => {
                  const presetRange = preset.range()
                  updateRangeAndContext(presetRange.startDate, presetRange.endDate)
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Input Range Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "10px", borderTop: "1px solid var(--theme-standard-borders)" }}>
            {getDefaultInputRanges().map((inputRange, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="number"
                  min="1"
                  value={inputValues[idx] || ""}
                  onChange={(e) => {
                    const newValue = e.target.value
                    // Only update the input value while typing; do not apply the range
                    // until the user explicitly clicks the button. This avoids passing
                    // transient non-numeric values (like "-" or "∞") into the
                    // range functions which can produce invalid dates and crash.
                    setInputValues({ ...inputValues, [idx]: newValue })
                  }}
                  className="adr-input"
                />
                <button
                  onClick={() => {
                    // apply current input value (validate and coerce to a positive integer)
                    const raw = inputValues[idx]
                    let num = Number(raw)
                    if (!Number.isFinite(num) || num < 1) {
                      num = 1
                    } else {
                      num = Math.floor(num)
                    }
                    const newRange = inputRange.range(num)
                    updateRangeAndContext(newRange.startDate, newRange.endDate)
                    // normalize the displayed input to the applied numeric value
                    setInputValues({ ...inputValues, [idx]: String(num) })
                  }}
                  className="adr-apply-btn"
                >
                  {inputRange.label}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <DateRange
          editableDateInputs={true}
          onChange={(item) => {
            const sel = item.selection
            setRange([sel])
            if (setDateRange) setDateRange({ startDate: sel.startDate, endDate: sel.endDate })
          }}
          moveRangeOnFirstSelection={false}
          ranges={range}
        />
      </div>

        {/* Display Selected Range */}
      <div className="adr-selected-bar">
        <strong>{start_label}:</strong> {range[0]?.startDate ? format(range[0].startDate, "yyyy-MM-dd") : "-"} <br />
        <strong>{end_label}:</strong> {range[0]?.endDate ? format(range[0].endDate, "yyyy-MM-dd") : "-"}
      </div>
    </div>
  )
}