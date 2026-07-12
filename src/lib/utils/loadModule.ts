import { extname } from "node:path";
import { tsImport } from "tsx/esm/api";

/**
 * Load a module from a file path, with automatic TypeScript transpilation.
 * JavaScript files are loaded directly, while TypeScript files (.ts, .tsx)
 * are transpiled to JavaScript before loading.
 */
export async function loadModule(filePath: string) {
  const isTypeScript = extname(filePath) === ".ts" || extname(filePath) === ".tsx";

  if (isTypeScript) {
    return await tsImport(filePath, import.meta.url);
  } else {
    // Load JavaScript file directly
    const fileUrl = `file://${filePath}`;
    return await import(fileUrl);
  }
}
