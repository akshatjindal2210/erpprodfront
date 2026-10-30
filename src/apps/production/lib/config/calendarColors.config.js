/** Job Card Calendar — minimal palette (bg + text) */

export const CARD = {
  run: { bg: "#E5E7EB", text: "#111827" },
  setup: { bg: "#2563EB", text: "#FFFFFF" },
  multi: { bg: "#6366F1", text: "#FFFFFF" },
};

export const slotCardColors = ({ hasSetup = false, multi = false } = {}) => multi ? CARD.multi : hasSetup ? CARD.setup : CARD.run;

/** Dark body + light chrome — reuse these everywhere */
export const C = {
  bg: "#0A0A0A",
  bg2: "#171717",
  bg3: "#1F1F1F",
  line: "#333333",
  /** Machine row separator — stronger than cell grid */
  rowLine: "#525252",
  fg: "#E5E5E5",
  muted: "#A3A3A3",

  soft: "#FFFFFF",
  soft2: "#F8FAFC",
  softLine: "#CBD5E1",
  softFg: "#0F172A",
  softMuted: "#64748B",

  today: "#D1FAE5",
  todayFg: "#064E3B",
  todayBody: "#052E16",
  week: "#FFF1F2",
  weekFg: "#E11D48",
  ring: "#818CF8",
};

export const CALENDAR_LEGEND = [
  { key: "empty", label: "Empty", swatch: C.muted, kind: "plus" },
  { key: "run", label: "Run", swatch: CARD.run.bg, kind: "bar" },
  { key: "setup", label: "Setup", swatch: CARD.setup.bg, kind: "bar" },
  { key: "multi", label: "Multi JC", swatch: CARD.multi.bg, kind: "bar" },
  { key: "free", label: "Free", swatch: C.bg3, kind: "bar" },
  { key: "past", label: "Past", swatch: C.bg2, kind: "block" },
];
