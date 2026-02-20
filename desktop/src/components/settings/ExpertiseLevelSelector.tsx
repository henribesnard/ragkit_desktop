import { useTranslation } from "react-i18next";
import { useExpertiseLevel, ExpertiseLevel } from "@/hooks/useExpertiseLevel";

const LEVELS: { value: ExpertiseLevel; labelKey: string; descKey: string }[] = [
  { value: "simple", labelKey: "expertise.simple", descKey: "expertise.simpleDesc" },
  { value: "intermediate", labelKey: "expertise.intermediate", descKey: "expertise.intermediateDesc" },
  { value: "expert", labelKey: "expertise.expert", descKey: "expertise.expertDesc" },
];

export function ExpertiseLevelSelector() {
  const { t } = useTranslation();
  const { level, loading, setExpertise } = useExpertiseLevel();

  if (loading) return null;

  return (
    <section className="p-4 border rounded-lg bg-white dark:bg-gray-900 space-y-3">
      <h3 className="font-semibold text-lg">{t("expertise.title", "Niveau d'expertise")}</h3>
      <div className="space-y-2">
        {LEVELS.map((item) => (
          <label key={item.value} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
            <input
              type="radio"
              name="expertise_level"
              checked={level === item.value}
              onChange={() => setExpertise(item.value)}
              className="mt-0.5"
            />
            <div>
              <span className="font-medium">{t(item.labelKey, item.value)}</span>
              <p className="text-sm text-gray-500">
                {t(item.descKey, "")}
              </p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
