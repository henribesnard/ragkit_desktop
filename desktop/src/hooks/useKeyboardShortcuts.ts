import { useEffect } from "react";

interface ShortcutHandlers {
  onNewConversation?: () => void;
  onNavigateChat?: () => void;
  onNavigateSettings?: () => void;
  onNavigateDashboard?: () => void;
  onStopStream?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N — New conversation
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        handlers.onNewConversation?.();
        return;
      }

      // Ctrl+1 — Chat
      if (e.ctrlKey && e.key === "1") {
        e.preventDefault();
        handlers.onNavigateChat?.();
        return;
      }

      // Ctrl+2 — Settings
      if (e.ctrlKey && e.key === "2") {
        e.preventDefault();
        handlers.onNavigateSettings?.();
        return;
      }

      // Ctrl+3 — Dashboard
      if (e.ctrlKey && e.key === "3") {
        e.preventDefault();
        handlers.onNavigateDashboard?.();
        return;
      }

      // Escape — Stop streaming
      if (e.key === "Escape") {
        handlers.onStopStream?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
