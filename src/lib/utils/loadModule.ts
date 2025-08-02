import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import {
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
  transpile,
} from 'typescript';

/**
 * Load a module from a file path, with automatic TypeScript transpilation.
 * JavaScript files are loaded directly, while TypeScript files (.ts, .tsx)
 * are transpiled to JavaScript before loading.
 */
export async function loadModule(filePath: string) {
  const isTypeScript =
    extname(filePath) === '.ts' || extname(filePath) === '.tsx';

  if (isTypeScript) {
    // Read and transpile TypeScript
    const tsContent = readFileSync(filePath, 'utf-8');
    const jsContent = transpile(tsContent, {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ESNext,
      moduleResolution: ModuleResolutionKind.NodeNext,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    });

    // Create a data URL with the transpiled JavaScript
    const dataUrl = `data:text/javascript;base64,${Buffer.from(
      jsContent,
    ).toString('base64')}`;
    return await import(dataUrl);
  } else {
    // Load JavaScript file directly
    const fileUrl = `file://${filePath}`;
    return await import(fileUrl);
  }
}
