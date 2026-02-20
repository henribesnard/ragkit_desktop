import { useTranslation } from "react-i18next";

interface Props {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ message, actionLabel, onAction }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
      <p className="mb-4">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
