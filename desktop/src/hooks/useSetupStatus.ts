import { useIngestionConfig } from "./useIngestionConfig";

export function useSetupStatus() {
    const { config, loading } = useIngestionConfig();

    // Derived state directly from props/context
    const hasCompletedSetup = !!(
        !loading &&
        config &&
        config.source &&
        config.source.path &&
        config.source.path.length > 0
    );

    return { hasCompletedSetup, isLoading: loading };
}
