"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { featureFlags } from "@/lib/featureFlags";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  editedFiles?: string[];
}

const MOCK_RESPONSES = [
  {
    content: "Created a fitness tracking app with activity rings.",
    editedFiles: ["Models/Workout.swift", "Models/Exercise.swift", "Views/ActivityRingsView.swift", "ContentView.swift"],
  },
  {
    content: "I've added a todo list with categories and due dates.",
    editedFiles: ["Models/TodoItem.swift", "Views/TodoListView.swift", "ContentView.swift"],
  },
  {
    content: "Built a simple habit tracker with daily check-ins.",
    editedFiles: ["Models/Habit.swift", "Views/HabitListView.swift", "ContentView.swift"],
  },
];

const API_TIMEOUT_MS = 130_000;

export function useChat(
  projectId: string,
  options?: { onError?: (message: string) => void; projectName?: string }
) {
  const { onError, projectName } = options ?? {};
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "live" | "failed">("idle");
  const [input, setInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  const MAX_MESSAGE_LENGTH = 4000;
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      abortControllerRef.current?.abort();
      setCanSend(true);
      setIsTyping(false);
    };
  }, []);

  const runClientMock = useCallback(
    (trimmed: string) => {
      const mock = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

      const t1 = setTimeout(() => setBuildStatus("building"), 400);
      timeoutIdsRef.current.push(t1);

      const stepMessages = [
        "Reading files.",
        "Explored.",
        "Grepped.",
        "Analyzed.",
        "Planning next moves…",
        "Writing code…",
      ];
      stepMessages.forEach((stepText, i) => {
        const t = setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            { id: `assistant-${Date.now()}-${i}`, role: "assistant" as const, content: stepText },
          ]);
        }, 1000 + i * 1000);
        timeoutIdsRef.current.push(t);
      });

      const tSummary = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}-summary`, role: "assistant" as const, content: mock.content },
        ]);
      }, 7000);
      timeoutIdsRef.current.push(tSummary);

      const tFiles = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}-files`,
            role: "assistant" as const,
            content: "",
            editedFiles: mock.editedFiles,
          },
        ]);
        setIsTyping(false);
        setCanSend(true);
      }, 7500);
      timeoutIdsRef.current.push(tFiles);

      const tLive = setTimeout(() => setBuildStatus("live"), 8000);
      timeoutIdsRef.current.push(tLive);
    },
    []
  );

  const sendMessage = useCallback(
    (text: string, model?: string) => {
      const trimmed = text.trim();
      if (!trimmed || !canSend) return;
      if (trimmed.length > MAX_MESSAGE_LENGTH) return;

      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      abortControllerRef.current?.abort();

      setCanSend(false);
      setIsTyping(true);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed.slice(0, MAX_MESSAGE_LENGTH),
      };
      setMessages((prev) => [...prev, userMsg]);

      if (featureFlags.useRealLLM) {
        const ac = new AbortController();
        abortControllerRef.current = ac;
        const timeoutId = setTimeout(() => ac.abort(), API_TIMEOUT_MS);

        setBuildStatus("building");

        fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: projectId, name: projectName ?? "Untitled app" }),
        })
          .then(() =>
            fetch(`/api/projects/${projectId}/message`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: trimmed,
                model: model ?? undefined,
                useRealLLM: true,
              }),
              signal: ac.signal,
            })
          )
          .then(async (res) => {
            clearTimeout(timeoutId);
            const data = await res.json().catch(() => ({}));
            const errorBody = typeof data?.error === "string" ? data.error : null;

            if (!res.ok) {
              const message =
                errorBody ||
                res.statusText ||
                `Request failed (${res.status})`;
              setBuildStatus("failed");
              onError?.(message);
              return;
            }

            const am = data?.assistantMessage;
            const content = am?.content ?? "";
            const editedFiles = Array.isArray(am?.editedFiles) ? am.editedFiles : [];

            setMessages((prev) => [
              ...prev,
              {
                id: am?.id ?? `assistant-${Date.now()}`,
                role: "assistant",
                content,
                editedFiles,
              },
            ]);
            setBuildStatus(data?.buildStatus === "failed" ? "failed" : "live");
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            setBuildStatus("failed");
            if (err?.name === "AbortError") {
              onError?.("Request timed out. Try again or shorten your message.");
            } else {
              onError?.(err?.message ?? "Something went wrong. Please try again.");
            }
          })
          .finally(() => {
            setIsTyping(false);
            setCanSend(true);
            abortControllerRef.current = null;
          });
      } else {
        runClientMock(trimmed);
      }
    },
    [canSend, projectId, projectName, onError, runClientMock]
  );

  return {
    messages,
    isTyping,
    sendMessage,
    buildStatus,
    input,
    setInput,
    canSend,
    maxMessageLength: MAX_MESSAGE_LENGTH,
  };
}
