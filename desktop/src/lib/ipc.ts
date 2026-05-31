/**
 * IPC abstraction layer — automatically selects the right transport.
 *
 * - In Tauri desktop mode: uses invoke() via ipc-tauri.ts
 * - In web/server mode:    uses fetch() via ipc-http.ts
 */
import type { IpcInterface } from "./ipc-types";

const IS_TAURI = typeof window !== "undefined" && "__TAURI__" in window;

// Lazy-loaded implementation to avoid bundling both transports
let _impl: IpcInterface | null = null;

async function getImpl(): Promise<IpcInterface> {
  if (_impl) return _impl;
  if (IS_TAURI) {
    const mod = await import("./ipc-tauri");
    _impl = mod.tauriIpc;
  } else {
    const mod = await import("./ipc-http");
    _impl = mod.httpIpc;
  }
  return _impl;
}

// Build a proxy that lazily resolves each call to the correct implementation
function createProxy(): IpcInterface {
  return new Proxy({} as IpcInterface, {
    get(_target, prop: string) {
      return (...args: any[]) =>
        getImpl().then((impl) => (impl as any)[prop](...args));
    },
  });
}

export const ipc: IpcInterface = createProxy();

// Re-export for consumers that need to check the mode
export { IS_TAURI };
