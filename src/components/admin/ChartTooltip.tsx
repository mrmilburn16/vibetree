"use client";

import type { ReactNode } from "react";

/** Tooltip styles so label + value are readable on dark background (Twilight Violet theme) */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--background-secondary)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    color: "var(--text-primary)",
  } as const,
  labelStyle: { color: "var(--text-primary)" } as const,
  itemStyle: {
    color: "var(--text-primary)",
    display: "block",
    paddingTop: 4,
    paddingBottom: 4,
  } as const,
};

/** Custom tooltip content so label + value use theme colors (fixes dark "Cost : $1820" text) */
export function ThemedTooltipContent(props: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; dataKey?: string; color?: string }>;
  label?: string | number;
  formatter?: (value: unknown, name: unknown, ...args: unknown[]) => [ReactNode, string] | ReactNode;
}) {
  const { active, payload, label, formatter } = props;
  if (!active || !payload?.length) return null;
  const items = payload.map((item, index) => {
    let name: string;
    let formattedValue: ReactNode;
    if (formatter) {
      const result = formatter(item.value, item.name ?? item.dataKey, item, index, payload);
      if (Array.isArray(result)) {
        formattedValue = result[0];
        const formatterName = typeof result[1] === "string" ? result[1] : String(result[1] ?? "");
        name = formatterName || (item.name != null ? String(item.name) : item.dataKey != null ? String(item.dataKey) : "Value");
      } else {
        formattedValue = result;
        name = item.name != null ? String(item.name) : item.dataKey != null ? String(item.dataKey) : "Value";
      }
    } else {
      formattedValue = item.value != null ? String(item.value) : "";
      name = item.name != null ? String(item.name) : item.dataKey != null ? String(item.dataKey) : "Value";
    }
    return { name, formattedValue };
  });
  return (
    <div style={{ ...CHART_TOOLTIP_STYLE.contentStyle, margin: 0 }}>
      {label != null && (
        <div style={{ ...CHART_TOOLTIP_STYLE.labelStyle, marginBottom: 4 }}>{label}</div>
      )}
      {items.map(({ name, formattedValue }, i) => (
        <div key={i} style={CHART_TOOLTIP_STYLE.itemStyle}>
          {name} : {formattedValue}
        </div>
      ))}
    </div>
  );
}
