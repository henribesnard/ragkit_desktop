/**
 * Web shim for @tauri-apps/api/webviewWindow
 *
 * Replaces Tauri's WebviewWindow with standard window.open().
 */

interface WebviewWindowOptions {
  url?: string;
  title?: string;
  width?: number;
  height?: number;
}

export class WebviewWindow {
  constructor(_label: string, options?: WebviewWindowOptions) {
    if (options?.url) {
      const features = [];
      if (options.width) features.push(`width=${options.width}`);
      if (options.height) features.push(`height=${options.height}`);
      window.open(options.url, "_blank", features.join(","));
    }
  }
}
