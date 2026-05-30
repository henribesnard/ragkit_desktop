import { useTranslation } from "react-i18next";

export function ChunkingStep({ wizard }: { wizard: any }) {
    const { t } = useTranslation();
    const { state, updateConfig } = wizard;
    const chunkCfg = state.config?.chunking || {};

    const updateChunking = (patch: any) => {
        updateConfig((cfg: any) => {
            if (!cfg.chunking) cfg.chunking = {};
            cfg.chunking = { ...cfg.chunking, ...patch };
            return cfg;
        });
    };

    const size = chunkCfg.chunk_size || 512;
    const overlap = chunkCfg.chunk_overlap || 50;

    return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.025em", marginBottom: 6 }}>
                {t('wizard.chunking.title')}
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginBottom: 22 }}>
                {t('wizard.chunking.subtitle')}
            </p>

            <div className="loko-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.chunking.chunkSize')}</label>
                    <input
                        type="range"
                        min="128"
                        max="2048"
                        step="128"
                        value={size}
                        onChange={(e) => updateChunking({ chunk_size: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                        <span>128 ({t('wizard.chunking.sizePrecise')})</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{size} {t('wizard.chunking.tokens')}</span>
                        <span>2048 ({t('wizard.chunking.sizeLarge')})</span>
                    </div>
                </div>

                <div>
                    <label style={{ display: "block", fontWeight: 500, marginBottom: 8 }}>{t('wizard.chunking.overlap')}</label>
                    <input
                        type="range"
                        min="0"
                        max="500"
                        step="10"
                        value={overlap}
                        onChange={(e) => updateChunking({ chunk_overlap: parseInt(e.target.value) })}
                        className="w-full cursor-pointer"
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                        <span>0</span>
                        <span style={{ fontWeight: 700, color: "var(--text)" }}>{overlap} {t('wizard.chunking.tokens')}</span>
                        <span>500</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{t('wizard.chunking.overlapDesc')}</p>
                </div>

                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <div>
                        <span style={{ display: "block", fontWeight: 500 }}>{t('wizard.chunking.chunkIndex')}</span>
                        <span style={{ fontSize: 13, color: "var(--text-3)" }}>{t('wizard.chunking.chunkIndexDesc')}</span>
                    </div>
                    <input
                        type="checkbox"
                        className="w-4 h-4 text-brand-600 rounded"
                        checked={!!chunkCfg.add_chunk_index}
                        onChange={(e) => updateChunking({ add_chunk_index: e.target.checked })}
                    />
                </label>
            </div>


        </div>
    );
}
