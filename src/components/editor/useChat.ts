"use client";

import { useState, useCallback } from "react";

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

export function useChat(projectId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [buildStatus, setBuildStatus] = useState<"idle" | "building" | "live" | "failed">("idle");
  const [input, setInput] = useState("");
  const [canSend, setCanSend] = useState(true);

  const MAX_MESSAGE_LENGTH = 4000;

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !canSend) return;
      if (trimmed.length > MAX_MESSAGE_LENGTH) return;

      setCanSend(false);
      setIsTyping(true);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed.slice(0, MAX_MESSAGE_LENGTH),
      };
      setMessages((prev) => [...prev, userMsg]);

      const mock = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

      setTimeout(() => {
        setBuildStatus("building");
      }, 400);

      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: mock.content,
          editedFiles: mock.editedFiles,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
        setCanSend(true);
      }, 1500 + Math.random() * 1500);

      setTimeout(() => {
        setBuildStatus("live");
      }, 2500 + Math.random() * 1000);
    },
    [canSend]
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
