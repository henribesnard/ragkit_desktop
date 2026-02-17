export type ChatSearchMode = "semantic" | "lexical" | "hybrid";

interface SearchModeSelectorProps {
  mode: ChatSearchMode;
  onModeChange: (mode: ChatSearchMode) => void;
  lexicalEnabled: boolean;
  semanticEnabled: boolean;
}

interface SearchModeOption {
  id: ChatSearchMode;
  icon: string;
  label: string;
  description: string;
}

const SEARCH_MODES: SearchModeOption[] = [
  {
    id: "semantic",
    icon: "S",
    label: "Semantique",
    description: "Recherche par sens et concepts",
  },
  {
    id: "lexical",
    icon: "L",
    label: "Lexicale",
    description: "Recherche par mots-cles exacts (BM25)",
  },
  {
    id: "hybrid",
    icon: "H",
    label: "Hybride",
    description: "Fusion semantique + lexicale",
  },
];

export function SearchModeSelector({
  mode,
  onModeChange,
  lexicalEnabled,
  semanticEnabled,
}: SearchModeSelectorProps) {
  const availableModes = SEARCH_MODES.filter((item) => {
    if (item.id === "lexical") return lexicalEnabled;
    if (item.id === "semantic") return semanticEnabled;
    if (item.id === "hybrid") return lexicalEnabled && semanticEnabled;
    return true;
  });

  const currentMode = availableModes.some((item) => item.id === mode)
    ? mode
    : availableModes[0]?.id;

  if (!availableModes.length) {
    return (
      <select disabled className="rounded-md border border-gray-300 px-2 py-2 text-sm bg-gray-100 text-gray-500">
        <option>Aucun mode actif</option>
      </select>
    );
  }

  return (
    <select
      value={currentMode}
      onChange={(event) => onModeChange(event.target.value as ChatSearchMode)}
      className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 text-sm"
    >
      {availableModes.map((item) => (
        <option key={item.id} value={item.id} title={item.description}>
          {item.icon} {item.label}
        </option>
      ))}
    </select>
  );
}
