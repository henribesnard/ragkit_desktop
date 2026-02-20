interface Props {
  message: string;
  suggestion?: string;
}

export function ErrorMessage({ message, suggestion }: Props) {
  return (
    <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
      <p className="text-sm text-red-800 dark:text-red-200 font-medium">{message}</p>
      {suggestion && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{suggestion}</p>
      )}
    </div>
  );
}
