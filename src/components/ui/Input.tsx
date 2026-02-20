"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

const inputBase =
  "w-full rounded-[var(--radius-md)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] " +
  "placeholder:text-[var(--input-placeholder)] ring-0 " +
  "focus:outline-none focus:border-[var(--button-primary-bg)] focus:ring-2 focus:ring-[var(--button-primary-bg)]/30 " +
  "transition-colors duration-[var(--transition-fast)]";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`${inputBase} px-3 py-2 min-h-[40px] ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`${inputBase} px-3 py-2 min-h-[80px] resize-y ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
