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
    // Initialize only when the article's unique id changes. Article objects may be recreated
    // on parent re-renders, but `uniqueId` is stable for the same article, so this
    // prevents overwriting the user's selection when the section re-renders.
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

    // initialize shared range for other components in the same section
    if (setDateRange) setDateRange({ startDate: initial.startDate, endDate: initial.endDate })
    
    // Initialize input values
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
    <div style={{ padding: "20px" }}>
      <h2>{title}</h2>

      {/* Date Range Picker with Preset Buttons */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        {/* Preset Range Buttons and Input Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px", minWidth: "180px" }}>
          {/* Static Preset Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {getDefaultStaticRanges().map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const presetRange = preset.range()
                  updateRangeAndContext(presetRange.startDate, presetRange.endDate)
                }}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  backgroundColor: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: "14px",
                  textAlign: "left",
                  color: "#333",
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = "#e0e0e0")}
                onMouseLeave={(e) => (e.target.style.backgroundColor = "#f5f5f5")}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Input Range Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "10px", borderTop: "1px solid #ddd" }}>
            {getDefaultInputRanges().map((inputRange, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="number"
                  min="1"
                  value={inputValues[idx] || "1"}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setInputValues({ ...inputValues, [idx]: newValue })
                    const newRange = inputRange.range(newValue)
                    updateRangeAndContext(newRange.startDate, newRange.endDate)
                  }}
                  style={{
                    padding: "6px 8px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "13px",
                    width: "64px",
                    backgroundColor: "#f5f5f5",
                    color: "#333",
                    textAlign: "center",
                  }}
                />
                <button
                  onClick={() => {
                    // apply current input value
                    const val = inputValues[idx] || "1"
                    const newRange = inputRange.range(val)
                    updateRangeAndContext(newRange.startDate, newRange.endDate)
                  }}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    backgroundColor: "#f5f5f5",
                    cursor: "pointer",
                    color: "#333",
                    fontSize: "13px",
                  }}
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
      <div style={{ marginTop: "20px" }}>
        <strong>{start_label}:</strong> {range[0]?.startDate ? format(range[0].startDate, "yyyy-MM-dd") : "-"} <br />
        <strong>{end_label}:</strong> {range[0]?.endDate ? format(range[0].endDate, "yyyy-MM-dd") : "-"}
      </div>
    </div>
  )
}