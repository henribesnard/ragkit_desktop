import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type { ChatPayload, ChatResponse } from "@/hooks/useChat";
import { stripSourceTags } from "@/lib/sanitize";

export function useChatStream() {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [finalResponse, setFinalResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unlistenChunkRef = useRef<null | (() => void)>(null);
  const unlistenDoneRef = useRef<null | (() => void)>(null);

  const cleanupListeners = useCallback(() => {
    if (unlistenChunkRef.current) {
      unlistenChunkRef.current();
      unlistenChunkRef.current = null;
    }
    if (unlistenDoneRef.current) {
      unlistenDoneRef.current();
      unlistenDoneRef.current = null;
    }
  }, []);

  const startStream = useCallback(
    async (payload: ChatPayload) => {
      cleanupListeners();
      setError(null);
      setContent("");
      setFinalResponse(null);
      setIsStreaming(true);

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
        throw err;
      }
    },
    [cleanupListeners],
  );

  const stopStream = useCallback(async () => {
    await invoke("chat_stream_stop");
  }, []);

  const clear = useCallback(() => {
    cleanupListeners();
    setContent("");
    setIsStreaming(false);
    setFinalResponse(null);
    setError(null);
  }, [cleanupListeners]);

  return {
    content,
    isStreaming,
    finalResponse,
    error,
    startStream,
    stopStream,
    clear,
  };
}
