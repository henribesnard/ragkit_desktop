import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConfigExport } from "@/hooks/useConfigExport";
import { save } from "@tauri-apps/plugin-dialog";

export function ConversationExportMenu() {
  const { t } = useTranslation();
  const { exporting, exportConversation } = useConfigExport();
  const [showMenu, setShowMenu] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleExport = async (format: "md" | "pdf") => {
    setShowMenu(false);
    const ext = format === "pdf" ? "md" : "md"; // PDF falls back to MD for now
    try {
      const path = await save({
        defaultPath: `conversation.${ext}`,
        filters: [{ name: format === "pdf" ? "PDF" : "Markdown", extensions: [ext] }],
      });
      if (!path) return;
      await exportConversation(format, path);
      setMsg(t("chat.exportSuccess", "Conversation exportee"));
      setTimeout(() => setMsg(null), 3000);
    } catch { /* error set by hook */ }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="px-3 py-1.5 border rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
        title={t("chat.exportConversation", "Exporter la conversation")}
      >
        {t("chat.export", "Exporter")}
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border rounded shadow-lg z-10 min-w-[180px]">
          <button
            onClick={() => handleExport("md")}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Markdown (.md)
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            PDF (.pdf)
          </button>
        </div>
      )}

      {msg && <span className="ml-2 text-green-600 text-sm">{msg}</span>}
    </div>
  );
}
