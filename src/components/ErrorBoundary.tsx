"use client";

import React, { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Section name shown in the error UI (e.g. "Editor", "Dashboard"). */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            minHeight: "200px",
            gap: "1rem",
            background: "var(--background-secondary)",
            borderRadius: "12px",
            border: "1px solid var(--border-default)",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "rgba(248, 113, 113, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            !
          </div>
          <h3
            style={{
              color: "var(--text-primary)",
              fontSize: "1rem",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {this.props.section
              ? `Something went wrong in ${this.props.section}`
              : "Something went wrong"}
          </h3>
          <p
            style={{
              color: "var(--text-tertiary)",
              fontSize: "0.875rem",
              margin: 0,
              textAlign: "center",
              maxWidth: "400px",
            }}
          >
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
