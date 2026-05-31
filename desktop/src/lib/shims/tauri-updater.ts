/**
 * Web shim for @tauri-apps/plugin-updater
 *
 * Auto-update is not applicable in web/server mode.
 */

export interface Update {
  version: string;
  body: string | null;
  downloadAndInstall: (onProgress?: (progress: any) => void) => Promise<void>;
}

export async function check(): Promise<Update | null> {
  // No auto-update in web mode
  return null;
}
