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

  it("loads conversation history for a conversation id", async () => {
    invokeMock.mockResolvedValueOnce({
      messages: [
        {
          role: "user",
          content: "Bonjour",
          timestamp: "2026-03-08T08:00:00.000Z",
        },
      ],
      total_messages: 1,
      has_summary: false,
    });

    const { result } = renderHook(() => useConversation("conv-1", 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history.messages).toHaveLength(1);
    expect(result.current.history.messages[0]?.content).toBe("Bonjour");
    expect(invokeMock).toHaveBeenCalledWith("get_conversation_history", {
      conversation_id: "conv-1",
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
