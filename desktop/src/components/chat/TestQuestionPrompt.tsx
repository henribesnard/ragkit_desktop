import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";

interface Props {
  onAsk: (question: string) => void;
  onDismiss: () => void;
}

export function TestQuestionPrompt({ onAsk, onDismiss }: Props) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await ipc.generateTestQuestion() as any;
        if (!cancelled && result?.question) {
          setQuestion(result.question);
        }
      } catch {
        if (!cancelled) {
          setQuestion(t("chat.defaultTestQuestion", "Quels sont les principaux themes abordes dans les documents ?"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  if (loading || !question) return null;

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
      <p className="text-sm text-blue-800 dark:text-blue-200">
        {t("chat.testQuestionIntro", "Votre RAG est pret ! Voici une question-test pour verifier que tout fonctionne :")}
      </p>
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 italic">
        &ldquo;{question}&rdquo;
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => onAsk(question)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          {t("chat.askThisQuestion", "Poser cette question")}
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
        >
          {t("chat.noThanks", "Non merci, je pose la mienne")}
        </button>
      </div>
    </div>
  );
}
