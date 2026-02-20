"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, className = "", ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`
          rounded-[var(--radius-md)] border-2 border-[var(--input-border)] bg-[var(--input-bg)]
          px-3 py-1.5 pr-8 text-sm text-[var(--input-text)]
          focus:outline-none focus:border-[var(--button-primary-bg)] focus:ring-2 focus:ring-[var(--button-primary-bg)]/30
          transition-colors duration-[var(--transition-fast)]
          appearance-none bg-no-repeat
          [background-position:right_0.5rem_center] [background-size:1rem]
          ${className}
        `}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = "Select";
