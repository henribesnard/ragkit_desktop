/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ConversationsState = {
  conversations: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    archived: boolean;
  }>;
  loading: boolean;
  createConversation: () => Promise<string>;
  refreshList: () => Promise<boolean>;
};

const { mockState } = vi.hoisted(() => ({
  mockState: { current: null as ConversationsState | null },
}));

vi.mock("./hooks/useConversations", () => ({
  useConversations: () => {
    if (!mockState.current) {
      throw new Error("mockState.current must be set in test setup");
    }
    return mockState.current;
  },
  ConversationsProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./pages/Chat", () => ({
  Chat: () => <div data-testid="chat-view">chat</div>,
}));

import { ChatPage } from "./App";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderChatPage(initialPath = "/chat") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/chat"
          element={
            <>
              <ChatPage />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/chat/:id"
          element={
            <>
              <ChatPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatPage routing recovery", () => {
  beforeEach(() => {
    mockState.current = null;
  });

  it("resumes the most recent conversation with messages", async () => {
    const refreshList = vi.fn().mockResolvedValue(true);
    const createConversation = vi.fn().mockResolvedValue("new-conv");

    mockState.current = {
      loading: false,
      createConversation,
      refreshList,
      conversations: [
        {
          id: "empty-conv",
          title: "Vide",
          createdAt: "2026-03-07T10:00:00.000Z",
          updatedAt: "2026-03-07T10:00:00.000Z",
          messageCount: 0,
          archived: false,
        },
        {
          id: "recent-conv",
          title: "Persisted",
          createdAt: "2026-03-08T09:00:00.000Z",
          updatedAt: "2026-03-08T10:00:00.000Z",
          messageCount: 4,
          archived: false,
        },
      ],
    };

    renderChatPage("/chat");

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/chat/recent-conv"));
    expect(createConversation).not.toHaveBeenCalled();
    expect(refreshList).toHaveBeenCalled();
    expect(screen.getByTestId("chat-view")).toBeInTheDocument();
  });

  it("reuses an existing empty conversation when no conversation has messages", async () => {
    const refreshList = vi.fn().mockResolvedValue(true);
    const createConversation = vi.fn().mockResolvedValue("new-conv");

    mockState.current = {
      loading: false,
      createConversation,
      refreshList,
      conversations: [
        {
          id: "empty-conv",
          title: "Nouvelle conversation",
          createdAt: "2026-03-08T09:00:00.000Z",
          updatedAt: "2026-03-08T09:00:00.000Z",
          messageCount: 0,
          archived: false,
        },
      ],
    };

    renderChatPage("/chat");

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/chat/empty-conv"));
    expect(createConversation).not.toHaveBeenCalled();
    expect(refreshList).toHaveBeenCalled();
  });

  it("creates a new conversation when no reusable conversation exists", async () => {
    const refreshList = vi.fn().mockResolvedValue(true);
    const createConversation = vi.fn().mockResolvedValue("fresh-conv");

    mockState.current = {
      loading: false,
      createConversation,
      refreshList,
      conversations: [],
    };

    renderChatPage("/chat");

    await waitFor(() => expect(createConversation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/chat/fresh-conv"));
    expect(refreshList).toHaveBeenCalled();
  });
});
