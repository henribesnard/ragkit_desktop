/* @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import { useConversation } from "./useConversation";

describe("useConversation", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads history immediately if conversationId is provided", async () => {
    invokeMock.mockResolvedValueOnce({
      messages: [{ role: "user", content: "hello" }],
      total_messages: 1,
      has_summary: false,
    });

    const { result } = renderHook(() => useConversation("conv-123"));

    expect(result.current.loading).toBe(true); // Should be loading initially

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(invokeMock).toHaveBeenCalledWith("get_conversation_history", {
      conversationId: "conv-123",
    });
  });

  it("retries when history is unexpectedly empty while messages are expected", async () => {
    invokeMock
      .mockResolvedValueOnce({
        messages: [],
        total_messages: 0,
        has_summary: false,
      })
      .mockResolvedValueOnce({
        messages: [
          {
            role: "assistant",
            content: "Reponse persistee",
            timestamp: "2026-03-08T08:00:01.000Z",
          },
        ],
        total_messages: 1,
        has_summary: false,
      });

    const { result } = renderHook(() => useConversation("conv-2", 1));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2), { timeout: 3000 });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.history.messages).toHaveLength(1);
    expect(result.current.history.messages[0]?.content).toBe("Reponse persistee");
  });

  it("does not call backend when no conversation id is provided", () => {
    const { result } = renderHook(() => useConversation(null, 0));

    expect(result.current.loading).toBe(false);
    expect(result.current.history.messages).toHaveLength(0);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
