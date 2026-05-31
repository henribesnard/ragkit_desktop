/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Web shim for @tauri-apps/plugin-process
 */

export async function relaunch(): Promise<void> {
  window.location.reload();
}

export async function exit(_code?: number): Promise<void> {
  // Cannot exit a browser tab programmatically
  window.close();
}
