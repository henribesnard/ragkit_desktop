import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";

export interface SecurityConfig {
  encrypt_logs: boolean;
  pii_detection: boolean;
  pii_types: string[];
  pii_action: "warn" | "anonymize" | "exclude";
  log_retention_days: number;
  auto_purge: boolean;
}

export interface APIKeyStatus {
  provider: string;
  configured: boolean;
  last_modified: string | null;
  age_days: number | null;
}

const defaultSecurityConfig: SecurityConfig = {
  encrypt_logs: false,
  pii_detection: false,
  pii_types: ["email", "phone", "ssn", "address", "credit_card", "iban"],
  pii_action: "warn",
  log_retention_days: 30,
  auto_purge: true,
};

export function useSecurityConfig() {
  const [config, setConfig] = useState<SecurityConfig>(defaultSecurityConfig);
  const [apiKeys, setApiKeys] = useState<APIKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [payload, keys] = await Promise.all([
        ipc.getSecurityConfig(),
        ipc.getApiKeysStatus(),
      ]);
      setConfig({ ...defaultSecurityConfig, ...(payload as any) });
      setApiKeys(keys as any as APIKeyStatus[]);
      setError(null);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const update = async (patch: Partial<SecurityConfig>) => {
    setSaving(true);
    try {
      const saved = await ipc.updateSecurityConfig({ ...config, ...patch });
      setConfig({ ...defaultSecurityConfig, ...(saved as any) });
      setError(null);
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const payload = await ipc.resetSecurityConfig();
      setConfig({ ...defaultSecurityConfig, ...(payload as any) });
      setError(null);
    } catch (err: any) {
      setError(String(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const purgeAll = async () => {
    try {
      await ipc.purgeAllData();
    } catch (err: any) {
      setError(String(err));
      throw err;
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return {
    config,
    apiKeys,
    loading,
    saving,
    error,
    refresh,
    update,
    reset,
    purgeAll,
  };
}
