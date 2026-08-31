# Graph Advanced Settings

Dashboard Builder → Widget Builder → **GRAPH** widgets support an **Advanced** tab (alongside Data / Style) for chart formatting, comparison, labels, spacing, and legend position.

Shared logic lives in:

- `frontend/src/common/dashboard-builder/utils/graphAdvancedConfig.js` — defaults, normalize/merge/save helpers, value formatting, margins, legend props
- `frontend/src/common/dashboard-builder/components/WidgetRenderer.js` — one shared legend/margin/format path used by bar, line, area, and pie
- `frontend/src/common/dashboard-builder/components/PropertyPanel.js` — Advanced tab UI (graph only)
- `frontend/src/common/dashboard-builder/components/DashboardBuilder.js` — defaults + `chart_config` save/load

KPI, TABLE, HEADING, and BOX widgets are unaffected.

---

## Settings overview

| Setting | Style key | Options / behavior |
|--------|-----------|--------------------|
| Comparison mode | `graphComparisonMode` | `single` (default) / `comparison` — maps Series A (`graphYKey`) and Series B (`graphYKey2`) |
| Value formatting | `graphValueFormat` | `number`, `currency`, `percent`, `abbreviated`, `custom` |
| Decimals | `graphDecimalPlaces` | `auto`, `0`, `1`, `2` |
| Currency symbol | `graphCurrencySymbol` | Default `₹` (when format = currency) |
| Prefix / suffix | `graphPrefix`, `graphSuffix` | Optional text around formatted values |
| Display value | `graphDisplayValue` | `raw`, `percent_total`, `difference` (A − B when comparing) |
| Data labels | `graphShowDataLabels` | `null` = auto; `true` / `false` explicit |
| Legend on/off | `graphShowLegend` | Style tab toggle (default on) |
| Legend position | `graphLegendPosition` | `top`, `bottom` (default), `left`, `right` |
| Manual margins | `graphUseManualMargins` + `graphMargin*` | Off = auto padding by legend position |

Formatting applies consistently to **axis ticks**, **tooltips**, and **data labels**.

Settings persist via the existing **Save Draft / Republish** flow (`chart_config` snake_case keys such as `graph_legend_position`). Preview and published dashboards both use `WidgetRenderer`, so output matches.

---

## Chart-type support matrix

| Setting | Bar | Line | Area | Pie |
|--------|:---:|:----:|:----:|:---:|
| Comparison (2 series) | Yes | Yes | Yes | No* |
| Value formatting | Yes | Yes | Yes | Yes |
| Display: raw | Yes | Yes | Yes | Yes |
| Display: % of total | Yes | Yes | Yes | Yes |
| Display: difference | Yes† | Yes† | Yes† | N/A |
| Data labels on/off | Yes | Yes | Yes | Yes‡ |
| Chart spacing / margins | Yes | Yes | Yes | Yes |
| Legend show/hide | Yes | Yes | Yes | Yes |
| Legend position T/B/L/R | Yes | Yes | Yes | Yes |

\* Pie stays single-series; Advanced UI shows a note when Compare is on with chart type Pie.  
† Difference is meaningful when Compare is enabled and Series B is mapped.  
‡ Untouched pies keep historical **name** labels; turning data labels **on** explicitly shows formatted **values**.

---

## Legend position

- Control: Advanced → **Legend position** (Top / Bottom / Left / Right).
- Hidden/disabled messaging when Style → **Show legend** is off.
- Default **Bottom** matches the previous Recharts default so older widgets look the same until changed.
- Shared helper `resolveGraphLegendProps()` sets Recharts `verticalAlign` / `align` / `layout` for every chart type.
- Auto margins (`resolveGraphChartMargins`) reserve extra space on the legend side so legends and labels are not clipped.

---

## Backward compatibility

| Behavior | Default |
|----------|---------|
| Comparison | Single series |
| Format | Number, auto decimals |
| Display | Raw |
| Data labels | Pie: on (names); bar/line/area: off |
| Legend | Shown, **bottom** |
| Margins | Auto (safe padding; left no longer clipped at `-20`) |

Existing graphs continue to load; new keys get sensible defaults on merge. No change to KPI / table / heading / box.

---

## How to test / verify

1. **Bar** — Advanced: cycle legend Top/Bottom/Left/Right with legend on. Combine with Compare on/off, currency/%/abbrev formats, data labels on/off. Resize the widget small/medium/large. Switch Laptop ↔ Phone preview. Save Draft → Preview → Publish → confirm published matches builder.
2. **Line** — Same combinations as bar.
3. **Pie** — Same legend positions; Compare note when enabled; data labels off / auto names / explicit values; formats + % total.
4. **Regression** — Open an older graph (no advanced edits): legend bottom, previous series/colors, no console errors. Confirm KPI/table/heading/box unchanged.
5. **Quality** — No cut-off legends/labels, no overlap at small sizes, no console errors for any combination above.

---

## Known limitations

- **Pie + comparison**: dual series is not drawn on pie (cartesian only). Formatting, labels, spacing, and legend position still apply.
- **Difference display** without Compare: falls back to the primary series value.
- **Very small widgets** + left/right legend: legend uses scrollable overflow (`maxHeight`) so text stays usable; prefer bottom/top on tiny cards if space is tight.
- **Manual margins** override auto legend padding — set all four sides carefully when legend is on the side.
- **Pie data labels**: auto mode preserves legacy name labels; explicit “on” switches to formatted values (intentional).

---