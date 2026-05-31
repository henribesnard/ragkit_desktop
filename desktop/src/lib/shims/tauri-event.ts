/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Web shim for @tauri-apps/api/event
 *
 * In web mode, Tauri events are not available.
 * Streaming is handled directly via SSE in useChatStream.
 * This shim provides no-op implementations.
 */

type UnlistenFn = () => void;

export async function listen<T = any>(
  _event: string,
  _handler: (event: { payload: T }) => void,
): Promise<UnlistenFn> {
  // No-op in web mode — streaming is handled via SSE
  return () => {};
}

export async function emit(_event: string, _payload?: any): Promise<void> {
  // No-op in web mode
}
