/**
 * Shared types used across the Vibetree codebase.
 * Centralizes duplicated type definitions for consistency and maintainability.
 */

/** Project mode: Standard (Expo/RN) or Pro (native Swift/SwiftUI). */
export type ProjectType = "standard" | "pro";

/** A source file with path and content (used for both Swift and JS/Expo files). */
export interface CodeFile {
  path: string;
  content: string;
}

/** LLM API token usage counts. */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Role of a chat message participant. */
export type MessageRole = "user" | "assistant" | "system";

/** A single chat message in the editor conversation. */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  editedFiles?: string[];
  usage?: TokenUsage;
  estimatedCostUsd?: number;
  projectFiles?: CodeFile[];
  model?: string;
  projectType?: ProjectType;
  skillIds?: string[];
}

/** Core project fields shared between client (localStorage) and server (in-memory) stores. */
export interface ProjectBase {
  id: string;
  name: string;
  bundleId: string;
  createdAt: number;
  updatedAt: number;
}

/** Next.js App Router dynamic route params for [id] segments. */
export type IdRouteParams = { params: Promise<{ id: string }> };

/** Structured LLM response shape (summary + files). */
export interface StructuredLLMResponse {
  summary: string;
  files: CodeFile[];
}

/** LLM adapter response (returned by both mock and real adapters). */
export interface LLMAdapterResponse {
  content: string;
  editedFiles: string[];
  parsedFiles?: CodeFile[];
  usage?: TokenUsage;
}

/** Build status as displayed in the editor UI. */
export type BuildStatus = "idle" | "building" | "live" | "error";

/** Build result tier for test categorization. */
export type BuildTier = "easy" | "medium" | "hard" | "custom";
