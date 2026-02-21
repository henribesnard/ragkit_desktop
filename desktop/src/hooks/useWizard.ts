import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface WizardState {
    step: number;
    config: any; // Mapped to SettingsPayload
    isLoading: boolean;
}

export function useWizard() {
    const [state, setState] = useState<WizardState>({
        step: 0,
        config: null,
        isLoading: true,
    });

    useEffect(() => {
        let isMounted = true;
        const loadProgress = async () => {
            try {
                const res: any = await invoke("get_wizard_progress");
                if (isMounted) {
                    setState({
                        step: res.wizard_step || 0,
                        config: res.config,
                        isLoading: false,
                    });
                }
            } catch (e) {
                console.error("Failed to load wizard progress", e);
                if (isMounted) setState(s => ({ ...s, isLoading: false }));
            }
        };
        loadProgress();
        return () => { isMounted = false; };
    }, []);

    const saveProgress = useCallback(async (newStep: number, newConfig: any) => {
        try {
            await invoke("save_wizard_progress", {
                data: {
                    wizard_step: newStep,
                    config: newConfig,
                }
            });
            setState({ step: newStep, config: newConfig, isLoading: false });
        } catch (e) {
            console.error("Failed to save progress", e);
        }
    }, []);

    const updateConfig = (updater: (cfg: any) => any) => {
        if (!state.config) return;
        const updated = updater({ ...state.config });
        setState(s => ({ ...s, config: updated }));
    };

    const nextStep = async (updatedConfig?: any) => {
        if (!state.config) return;
        const cfg = updatedConfig || state.config;

        let next = state.step + 1;
        const searchType = cfg.retrieval?.search_type || "hybrid";

        if (searchType === "semantic") {
            if (state.step === 9) next = 10;
            else if (state.step === 10) next = 14;
            else if (state.step >= 11 && state.step <= 13) next = 14;
        } else if (searchType === "lexical") {
            if (state.step === 9) next = 11;
            else if (state.step === 11) next = 14;
            else if (state.step === 10 || state.step === 12 || state.step === 13) next = 14;
        }

        // Capping at 15 max (0 to 15)
        next = Math.min(next, 15);
        await saveProgress(next, cfg);
    };

    const prevStep = async () => {
        if (!state.config) return;
        const cfg = state.config;
        const searchType = cfg.retrieval?.search_type || "hybrid";
        let prev = state.step - 1;

        if (searchType === "semantic") {
            if (state.step === 14) prev = 10;
            else if (state.step === 10) prev = 9;
        } else if (searchType === "lexical") {
            if (state.step === 14) prev = 11;
            else if (state.step === 11) prev = 9;
        }

        prev = Math.max(prev, 0);
        await saveProgress(prev, cfg);
    };

    const completeWizard = async () => {
        try {
            if (!state.config) return false;
            await invoke("complete_wizard", { params: { config: state.config } });
            window.location.href = "/settings";
            return true;
        } catch (e) {
            console.error("Wizard completion failed", e);
            alert("Erreur lors de la sauvegarde: " + e);
            return false;
        }
    };

    return {
        state,
        nextStep,
        prevStep,
        updateConfig,
        completeWizard,
    };
}
