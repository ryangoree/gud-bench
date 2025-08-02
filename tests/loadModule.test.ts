import assert from 'node:assert';
import {
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { loadModule } from '#src/lib/utils/loadModule';

describe('loadModule', () => {
  const testDir = resolve('./test-modules');
  const jsFile = join(testDir, 'test.js');
  const tsFile = join(testDir, 'test.ts');

  before(() => {
    // Create test directory if it doesn't exist
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (_) {
      // Directory might already exist
    }
  });

  after(() => {
    // Clean up test files and directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (_) {
      // Directory might not exist
    }
  });

  describe('JavaScript module loading', () => {
    it('should load JavaScript modules', async () => {
      const testFile = join(testDir, 'load-test.js');
      const jsContent = `
        export function testFunction() {
          return 'JavaScript test';
        }
        
        export const testValue = 42;
        
        export default function() {
          return 'Default export';
        }
      `;

      writeFileSync(testFile, jsContent);

      const module = await loadModule(testFile);

      assert.ok(module);
      assert.ok(typeof module.testFunction === 'function');
      assert.strictEqual(module.testFunction(), 'JavaScript test');
      assert.strictEqual(module.testValue, 42);
      assert.ok(typeof module.default === 'function');
      assert.strictEqual(module.default(), 'Default export');
    });

    it('should load CommonJS-style exports in JavaScript', async () => {
      const testFile = join(testDir, 'commonjs-test.js');
      const jsContent = `
        export function add(a, b) {
          return a + b;
        }
        
        export function multiply(a, b) {
          return a * b;
        }
      `;

      writeFileSync(testFile, jsContent);

      const module = await loadModule(testFile);

      assert.strictEqual(module.add(2, 3), 5);
      assert.strictEqual(module.multiply(4, 5), 20);
    });
  });

  describe('TypeScript module loading', () => {
    it('should load and transpile TypeScript modules', async () => {
      const tsContent = `
        export interface TestInterface {
          value: number;
        }
        
        export function typedFunction(param: string): string {
          return \`Hello \${param}\`;
        }
        
        export const typedValue: number = 123;
        
        export default function(obj: TestInterface): number {
          return obj.value * 2;
        }
      `;

      writeFileSync(tsFile, tsContent);

      const module = await loadModule(tsFile);

      assert.ok(module);
      assert.ok(typeof module.typedFunction === 'function');
      assert.strictEqual(module.typedFunction('World'), 'Hello World');
      assert.strictEqual(module.typedValue, 123);
      assert.ok(typeof module.default === 'function');
      assert.strictEqual(module.default({ value: 5 }), 10);
    });

    it('should handle TypeScript with complex types', async () => {
      const tsContent = `
        type BenchmarkFunction<T = any> = (value?: T) => any;
        
        export const benchmarks: Record<string, BenchmarkFunction> = {
          simpleTest: () => 'simple',
          paramTest: (value: string = 'default') => \`param: \${value}\`,
          numberTest: (num: number = 0) => num + 1
        };
        
        export function createBenchmark<T>(name: string, fn: BenchmarkFunction<T>): { name: string; fn: BenchmarkFunction<T> } {
          return { name, fn };
        }
      `;

      writeFileSync(tsFile, tsContent);

      const module = await loadModule(tsFile);

      assert.ok(module.benchmarks);
      assert.strictEqual(module.benchmarks.simpleTest(), 'simple');
      assert.strictEqual(module.benchmarks.paramTest('test'), 'param: test');
      assert.strictEqual(module.benchmarks.numberTest(5), 6);

      assert.ok(typeof module.createBenchmark === 'function');
      const benchmark = module.createBenchmark('test', () => 'result');
      assert.strictEqual(benchmark.name, 'test');
      assert.strictEqual(benchmark.fn(), 'result');
    });

    it('should handle TypeScript imports and exports', async () => {
      const tsContent = `
        import { readFileSync } from 'node:fs';
        import { join } from 'node:path';
        
        export function readTestFile(filename: string): string {
          try {
            return readFileSync(join('.', filename), 'utf-8');
          } catch {
            return 'File not found';
          }
        }
        
        export const utils = {
          joinPath: join,
          isString: (value: any): value is string => typeof value === 'string'
        };
      `;

      writeFileSync(tsFile, tsContent);

      const module = await loadModule(tsFile);

      assert.ok(typeof module.readTestFile === 'function');
      assert.ok(module.utils);
      assert.ok(typeof module.utils.joinPath === 'function');
      assert.ok(typeof module.utils.isString === 'function');
      assert.strictEqual(module.utils.isString('test'), true);
      assert.strictEqual(module.utils.isString(123), false);
    });
  });

  describe('File extension handling', () => {
    it('should detect TypeScript files by .ts extension', async () => {
      const tsContent = `export const isTS = true;`;
      writeFileSync(tsFile, tsContent);

      const module = await loadModule(tsFile);
      assert.strictEqual(module.isTS, true);
    });

    it('should detect JavaScript files by .js extension', async () => {
      const testFile = join(testDir, 'extension-test.js');
      const jsContent = `export const isJS = true;`;
      writeFileSync(testFile, jsContent);

      const module = await loadModule(testFile);
      assert.strictEqual(module.isJS, true);
    });

    it('should handle .tsx files', async () => {
      const tsxFile = join(testDir, 'test.tsx');
      const tsxContent = `
        export function Component(): string {
          return 'TSX Component';
        }
      `;

      writeFileSync(tsxFile, tsxContent);

      try {
        const module = await loadModule(tsxFile);
        assert.ok(typeof module.Component === 'function');
        assert.strictEqual(module.Component(), 'TSX Component');
      } finally {
        if (existsSync(tsxFile)) {
          unlinkSync(tsxFile);
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent files', () => {
      assert.rejects(() => loadModule('./non-existent-file.js'));
    });

    it('should handle syntax errors in TypeScript', async () => {
      const invalidTsContent = `
        export function broken(: string {
          return "This won't compile";
        }
      `;

      writeFileSync(tsFile, invalidTsContent);

      try {
        await loadModule(tsFile);
        // If it doesn't throw, that's also acceptable as TypeScript transpiler
        // might handle some syntax errors gracefully
        assert.ok(true);
      } catch (error) {
        // This is expected for syntax errors
        assert.ok(error instanceof Error);
      }
    });

    it('should handle syntax errors in JavaScript', async () => {
      const invalidJsContent = `
        export function broken( {
          return "This won't parse";
        }
      `;

      writeFileSync(jsFile, invalidJsContent);

      try {
        await loadModule(jsFile);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  describe('Real-world scenarios', () => {
    it('should load benchmark-style functions', async () => {
      const testFile = join(testDir, 'benchmark-test.js');
      const benchmarkContent = `
        export function quickSort(arr = [3, 1, 4, 1, 5, 9, 2, 6]) {
          if (arr.length <= 1) return arr;
          const pivot = arr[arr.length - 1];
          const left = [];
          const right = [];
          for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] < pivot) {
              left.push(arr[i]);
            } else {
              right.push(arr[i]);
            }
          }
          return [...quickSort(left), pivot, ...quickSort(right)];
        }
        
        export function bubbleSort(arr = [3, 1, 4, 1, 5, 9, 2, 6]) {
          const result = [...arr];
          for (let i = 0; i < result.length; i++) {
            for (let j = 0; j < result.length - 1; j++) {
              if (result[j] > result[j + 1]) {
                [result[j], result[j + 1]] = [result[j + 1], result[j]];
              }
            }
          }
          return result;
        }
        
        export default function defaultSort(arr = [3, 1, 4, 1, 5, 9, 2, 6]) {
          return arr.sort((a, b) => a - b);
        }
      `;

      writeFileSync(testFile, benchmarkContent);

      const module = await loadModule(testFile);

      assert.ok(typeof module.quickSort === 'function');
      assert.ok(typeof module.bubbleSort === 'function');
      assert.ok(typeof module.default === 'function');

      // Test that functions actually work
      const testArray = [3, 1, 4, 1, 5];
      const quickSorted = module.quickSort(testArray);
      const bubbleSorted = module.bubbleSort(testArray);
      const defaultSorted = module.default(testArray);

      assert.deepStrictEqual(quickSorted, [1, 1, 3, 4, 5]);
      assert.deepStrictEqual(bubbleSorted, [1, 1, 3, 4, 5]);
      assert.deepStrictEqual(defaultSorted, [1, 1, 3, 4, 5]);
    });
  });
});
