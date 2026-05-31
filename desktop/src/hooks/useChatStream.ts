import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatPayload, ChatResponse } from "@/hooks/useChat";
import { stripSourceTags } from "@/lib/sanitize";
import { IS_TAURI } from "@/lib/ipc";

export interface StreamStatus {
  step: "analyzing" | "rewriting" | "retrieving" | "retrieved" | "generating";
  detail?: { count?: number; search_type?: string } | null;
}

// ---------------------------------------------------------------------------
// Tauri streaming (desktop mode)
// ---------------------------------------------------------------------------

function useTauriChatStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [finalResponse, setFinalResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StreamStatus | null>(null);

  const unlistenChunkRef = useRef<null | (() => void)>(null);
  const unlistenDoneRef = useRef<null | (() => void)>(null);
  const unlistenStatusRef = useRef<null | (() => void)>(null);

  const cleanupListeners = useCallback(() => {
    if (unlistenChunkRef.current) {
      unlistenChunkRef.current();
      unlistenChunkRef.current = null;
    }
    if (unlistenDoneRef.current) {
      unlistenDoneRef.current();
      unlistenDoneRef.current = null;
    }
    if (unlistenStatusRef.current) {
      unlistenStatusRef.current();
      unlistenStatusRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupListeners();
    };
  }, [cleanupListeners]);

  const startStream = useCallback(
    async (payload: ChatPayload) => {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      cleanupListeners();
      setError(null);
      setContent("");
      setFinalResponse(null);
      setIsStreaming(true);
      setStatus(null);

      const statusUnlisten = await listen<StreamStatus>("chat-stream-status", (event) => {
        setStatus(event.payload);
      });
      unlistenStatusRef.current = statusUnlisten;

      const chunkUnlisten = await listen<string>("chat-stream-chunk", (event) => {
        setContent((prev) => stripSourceTags(prev + event.payload));
      });
      unlistenChunkRef.current = chunkUnlisten;

      const doneUnlisten = await listen<any>("chat-stream-done", (event) => {
        setIsStreaming(false);
        const donePayload = event.payload;
        if (donePayload && typeof donePayload === "object" && "error" in donePayload) {
          setError(String(donePayload.error || "Streaming error"));
        } else if (donePayload && typeof donePayload === "object" && "answer" in donePayload) {
          const response = donePayload as ChatResponse;
          setFinalResponse(response);
          setContent(stripSourceTags(response.answer || ""));
        }
        cleanupListeners();
      });
      unlistenDoneRef.current = doneUnlisten;

      try {
        await invoke("chat_orchestrated", { query: payload });
      } catch (err: any) {
        setIsStreaming(false);
        cleanupListeners();
        setError(String(err));
      }
    },
    [cleanupListeners],
  );

  const stopStream = useCallback(async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("chat_stream_stop");
  }, []);

  const clear = useCallback(() => {
    cleanupListeners();
    setContent("");
    setIsStreaming(false);
    setFinalResponse(null);
    setError(null);
    setStatus(null);
  }, [cleanupListeners]);

  return { content, isStreaming, finalResponse, error, status, startStream, stopStream, clear };
}

// ---------------------------------------------------------------------------
// Web SSE streaming (server mode)
// ---------------------------------------------------------------------------

function useWebChatStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [finalResponse, setFinalResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StreamStatus | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startStream = useCallback(
    async (payload: ChatPayload) => {
      cleanup();
      setError(null);
      setContent("");
      setFinalResponse(null);
      setIsStreaming(true);
      setStatus(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Get API key from localStorage
        const apiKey = localStorage.getItem("ragkit_api_key") || "";
        const hdrs: Record<string, string> = { "Content-Type": "application/json" };
        if (apiKey) hdrs["X-API-Key"] = apiKey;

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: hdrs,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);

                if (eventType === "status") {
                  setStatus(parsed as StreamStatus);
                } else if (eventType === "token") {
                  setContent((prev) => stripSourceTags(prev + (parsed.content || "")));
                } else if (eventType === "done") {
                  setIsStreaming(false);
                  const chatResponse = parsed as ChatResponse;
                  setFinalResponse(chatResponse);
                  setContent(stripSourceTags(chatResponse.answer || ""));
                  cleanup();
                } else if (eventType === "error") {
                  setIsStreaming(false);
                  setError(parsed.error || "Streaming error");
                  cleanup();
                }
              } catch {
                // ignore malformed JSON lines
              }
              eventType = "";
            }
          }
        }

        // Stream ended without a done event
        setIsStreaming(false);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setIsStreaming(false);
        setError(String(err));
        cleanup();
      }
    },
    [cleanup],
  );

  const stopStream = useCallback(async () => {
    cleanup();
    setIsStreaming(false);
  }, [cleanup]);

  const clear = useCallback(() => {
    cleanup();
    setContent("");
    setIsStreaming(false);
    setFinalResponse(null);
    setError(null);
    setStatus(null);
  }, [cleanup]);

  return { content, isStreaming, finalResponse, error, status, startStream, stopStream, clear };
}

// ---------------------------------------------------------------------------
// Exported hook — auto-selects based on environment
// ---------------------------------------------------------------------------

export const useChatStream = IS_TAURI ? useTauriChatStream : useWebChatStream;
