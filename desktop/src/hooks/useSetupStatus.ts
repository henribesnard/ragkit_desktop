import { useState, useEffect } from "react";
import { useIngestionConfig } from "./useIngestionConfig";

export function useSetupStatus() {
    const { config, loading } = useIngestionConfig();
    const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        if (!loading) {
            // Logic: if source path is set, setup is considered complete for Step 1
            if (config && config.source && config.source.path && config.source.path.length > 0) {
                setHasCompletedSetup(true);
            } else {
                setHasCompletedSetup(false);
            }
            setIsChecking(false);
        }
    }, [config, loading]);

    return { hasCompletedSetup, isLoading: loading || isChecking };
}
