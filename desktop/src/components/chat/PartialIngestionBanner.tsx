import { useTranslation } from "react-i18next";

interface Props {
  docsIndexed: number;
  docsTotal: number;
  onViewProgress?: () => void;
}

export function PartialIngestionBanner({ docsIndexed, docsTotal, onViewProgress }: Props) {
  const { t } = useTranslation();

  if (docsTotal <= 0 || docsIndexed >= docsTotal) return null;

  return (
    <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
      <div className="text-sm text-amber-800 dark:text-amber-200">
        <span className="font-medium">
          {t("chat.ingestionInProgress", "Ingestion en cours")} : {docsIndexed}/{docsTotal}{" "}
          {t("chat.documentsIndexed", "documents indexes")}.
        </span>{" "}
        {t("chat.resultsIncomplete", "Les resultats peuvent etre incomplets.")}
      </div>
      {onViewProgress && (
        <button
          onClick={onViewProgress}
          className="ml-3 text-sm text-amber-700 dark:text-amber-300 underline hover:no-underline whitespace-nowrap"
        >
          {t("chat.viewProgress", "Voir la progression")}
        </button>
      )}
    </div>
  );
}
