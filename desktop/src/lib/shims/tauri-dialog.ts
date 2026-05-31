/**
 * Web shim for @tauri-apps/plugin-dialog
 *
 * Replaces Tauri's native file dialogs with browser-native equivalents.
 */

interface SaveDialogOptions {
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

interface OpenDialogOptions {
  directory?: boolean;
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}

/**
 * In web mode, save() triggers a browser download.
 * Returns a pseudo-path (the filename) for compatibility.
 */
export async function save(options?: SaveDialogOptions): Promise<string | null> {
  const filename = options?.defaultPath?.split(/[/\\]/).pop() || "download";
  // Return the filename — actual download is handled by the caller
  return filename;
}

/**
 * In web mode, open() triggers a browser file picker.
 * Returns the selected file path (File object name) or null.
 */
export async function open(options?: OpenDialogOptions): Promise<string | string[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";

    if (options?.directory) {
      input.setAttribute("webkitdirectory", "");
    }
    if (options?.multiple) {
      input.multiple = true;
    }
    if (options?.filters) {
      const extensions = options.filters
        .flatMap((f) => f.extensions)
        .map((e) => `.${e}`)
        .join(",");
      input.accept = extensions;
    }

    input.onchange = () => {
      if (!input.files || input.files.length === 0) {
        resolve(null);
        return;
      }
      if (options?.multiple) {
        resolve(Array.from(input.files).map((f) => f.name));
      } else {
        resolve(input.files[0].name);
      }
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}
