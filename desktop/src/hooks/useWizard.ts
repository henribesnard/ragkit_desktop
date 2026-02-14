import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface WizardState {
    step: number;
    profile: string | null;
    calibration: Record<string, boolean>;
    folderPath: string | null;
    folderStats: any | null;
    folderTree: any | null;
    recursive: boolean;
    includedFileTypes: string[];
    excludedFileTypes: string[];
    excludedFolders: string[];
}

export function useWizard() {
    const [state, setState] = useState<WizardState>({
        step: 1,
        profile: null,
        calibration: {
            q1: false,
            q2: false,
            q3: false,
            q4: false,
            q5: false,
            q6: false,
        },
        folderPath: null,
        folderStats: null,
        folderTree: null,
        recursive: true,
        includedFileTypes: ["pdf", "docx", "doc", "md", "txt"],
        excludedFileTypes: [],
        excludedFolders: [],
    });

    const nextStep = () => setState((s) => ({ ...s, step: Math.min(s.step + 1, 4) }));
    const prevStep = () => setState((s) => ({ ...s, step: Math.max(s.step - 1, 1) }));

    const setProfile = (profile: string) => setState((s) => ({ ...s, profile }));
    const toggleCalibration = (key: string) =>
        setState((s) => ({
            ...s,
            calibration: { ...s.calibration, [key]: !s.calibration[key] },
        }));

    const setFolderPath = (path: string) => setState((s) => ({ ...s, folderPath: path }));

    const setRecursive = (recursive: boolean) => setState((s) => ({ ...s, recursive }));

    const setFolderStats = (stats: any, tree: any) => setState((s) => ({ ...s, folderStats: stats, folderTree: tree }));

    const toggleFolderExclusion = (path: string) =>
        setState((s) => {
            const isExcluded = s.excludedFolders.includes(path);
            return {
                ...s,
                excludedFolders: isExcluded
                    ? s.excludedFolders.filter(p => p !== path)
                    : [...s.excludedFolders, path]
            };
        });

    const setIncludedFileTypes = (types: string[]) => setState((s) => ({ ...s, includedFileTypes: types }));

    const completeWizard = async () => {
        // Logic to call backend
        try {
            // First analyze profile to get config
            const profileResponse: any = await invoke("analyze_wizard_profile", {
                params: {
                    profile: state.profile,
                    calibration: state.calibration
                }
            });

            const config = profileResponse.full_config;
            config.ingestion.source.path = state.folderPath;
            config.ingestion.source.recursive = state.recursive;
            config.ingestion.source.excluded_dirs = state.excludedFolders;
            config.ingestion.source.file_types = state.includedFileTypes;

            await invoke("complete_wizard", { params: { config } });
            return true;
        } catch (e) {
            console.error("Wizard completion failed", e);
            return false;
        }
    };

    return {
        state,
        nextStep,
        prevStep,
        setProfile,
        toggleCalibration,
        setFolderPath,
        setFolderStats,
        setRecursive,
        toggleFolderExclusion,
        setIncludedFileTypes,
        completeWizard,
    };
}
