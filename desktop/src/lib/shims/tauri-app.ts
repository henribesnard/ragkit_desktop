/**
 * Web shim for @tauri-apps/api/app
 */

export async function getVersion(): Promise<string> {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    return data.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function getName(): Promise<string> {
  return "LOKO";
}

export async function getTauriVersion(): Promise<string> {
  return "web";
}
