import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

describe('CLI Integration', () => {
  const testDir = './test-cli-files';
  const cliPath = './src/cli/index.js';

  before(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  after(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function runCli(
    args: string[],
    options = {},
  ): Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve, reject) => {
      const child = spawn('tsx', [cliPath, ...args], {
        stdio: 'pipe',
        cwd: process.cwd(),
        ...options,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child
        .on('close', (code) => {
          resolve({ code, stdout, stderr });
        })
        .on('error', (error) => {
          reject(error);
        });

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('CLI command timed out'));
      }, 10000);
    });
  }

  describe('CLI Help and Usage', () => {
    it('should show help when requested', async () => {
      const result = await runCli(['--help']);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /Usage:/);
      assert.match(result.stdout, /OPTIONS:/);
      assert.match(result.stdout, /--files/);
      assert.match(result.stdout, /--runs/);
    });

    it('should show help for run command', async () => {
      const result = await runCli(['run', '--help']);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /files/);
      assert.match(result.stdout, /runs/);
      assert.match(result.stdout, /verbosity/);
    });
  });

  describe('JavaScript File Benchmarking', () => {
    it('should benchmark JavaScript files with multiple exports', async () => {
      const testFile = join(testDir, 'multiple-exports.js');
      const testContent = `
        export function fastFunction() {
          return 42;
        }

        export function slowFunction() {
          let sum = 0;
          for (let i = 0; i < 100; i++) {
            sum += i;
          }
          return sum;
        }

        export function asyncFunction() {
          return Promise.resolve('async result');
        }
      `;

      writeFileSync(testFile, testContent);

      const result = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '50',
        '--verbosity',
        '1',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /fastFunction/);
      assert.match(result.stdout, /slowFunction/);
      assert.match(result.stdout, /asyncFunction/);
      assert.match(result.stdout, /Loading 1 files/);
      assert.match(result.stdout, /Ops\/Sec/);
    });

    it('should benchmark JavaScript file with default export', async () => {
      const testFile = join(testDir, 'default-export.js');
      const testContent = `
        export default function() {
          return Math.random() * 100;
        }
      `;

      writeFileSync(testFile, testContent);

      const result = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '30',
        '--verbosity',
        '1',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /default-export/);
      assert.match(result.stdout, /Total time:/);
    });
  });

  describe('TypeScript File Benchmarking', () => {
    it('should benchmark TypeScript files', async () => {
      const testFile = join(testDir, 'typescript-test.ts');
      const testContent = `
        interface TestData {
          value: number;
        }

        export function typedSort(arr: number[] = [3, 1, 4, 1, 5]): number[] {
          return arr.sort((a, b) => a - b);
        }

        export function arraySum(): number {
          const arr = [1, 2, 3, 4, 5];
          return arr.reduce((sum, num) => sum + num, 0);
        }

        export const constValue: number = 123;
      `;

      writeFileSync(testFile, testContent);

      const result = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '40',
        '--verbosity',
        '1',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /typedSort/);
      assert.match(result.stdout, /arraySum/);
      assert.match(result.stdout, /Loading 1 files/);
    });
  });

  describe('CLI Options', () => {
    it('should respect verbosity levels', async () => {
      const testFile = join(testDir, 'verbosity-test.js');
      const testContent = `export function simple() { return 1; }`;
      writeFileSync(testFile, testContent);

      // Test silent mode
      const silentResult = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '10',
        '--verbosity',
        '0',
      ]);

      assert.strictEqual(silentResult.code, 0);
      // Silent mode should produce minimal output
      assert.ok(silentResult.stdout.length < 100);

      // Test verbose mode
      const verboseResult = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '10',
        '--verbosity',
        '2',
      ]);

      assert.strictEqual(verboseResult.code, 0);
      assert.ok(verboseResult.stdout.length > silentResult.stdout.length);
    });

    it('should handle multiple cycles', async () => {
      const testFile = join(testDir, 'cycles-test.js');
      const testContent = `export function test() { return Math.random(); }`;
      writeFileSync(testFile, testContent);

      const result = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '20',
        '--cycles',
        '3',
        '--verbosity',
        '1',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /cycles/);
      assert.match(result.stdout, /Cycle/);
    });

    it('should handle preheat option', async () => {
      const testFile = join(testDir, 'preheat-test.js');
      const testContent = `export function preheatTest() { return 'preheated'; }`;
      writeFileSync(testFile, testContent);

      const result = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '20',
        '--preheat',
        '10',
        '--verbosity',
        '2',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /Preheating/);
    });

    it('should handle custom benchmark name', async () => {
      const testFile = join(testDir, 'named-test.js');
      const testContent = `export function namedFunction() { return 'named'; }`;
      writeFileSync(testFile, testContent);

      const result = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '15',
        '--name',
        'Custom',
        '--verbosity',
        '1',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /Custom/);
    });
  });

  describe('Garbage Collection Options', () => {
    it('should handle different GC strategies', async () => {
      const testFile = join(testDir, 'gc-test.js');
      const testContent = `
        export function memoryTest() {
          const arr = [];
          for (let i = 0; i < 100; i++) {
            arr.push({ value: i });
          }
          return arr.length;
        }
      `;
      writeFileSync(testFile, testContent);

      // Test with 'never' strategy
      const neverResult = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '20',
        '--gcStrategy',
        'never',
        '--verbosity',
        '2',
      ]);

      assert.strictEqual(neverResult.code, 0);
      assert.match(neverResult.stdout, /never/);

      // Test with 'periodic' strategy
      const periodicResult = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '20',
        '--gcStrategy',
        'periodic',
        '--gcInterval',
        '10',
        '--verbosity',
        '2',
      ]);

      assert.strictEqual(periodicResult.code, 0);
      assert.match(periodicResult.stdout, /periodic/);
    });
  });

  describe('Multiple Files', () => {
    it('should benchmark multiple files', async () => {
      const file1 = join(testDir, 'multi-file-1.js');
      const file2 = join(testDir, 'multi-file-2.js');

      writeFileSync(file1, `export function file1Test() { return 'file1'; }`);
      writeFileSync(file2, `export function file2Test() { return 'file2'; }`);

      const result = await runCli([
        'run',
        '--files',
        `${file1},${file2}`,
        '--runs',
        '15',
        '--verbosity',
        '1',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /Loading 2 files/);
      assert.match(result.stdout, /file1Test/);
      assert.match(result.stdout, /file2Test/);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const result = await runCli([
        'run',
        '--files',
        './non-existent-file.js',
        '--runs',
        '10',
      ]);

      assert.notStrictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /not found/);
      // assert.ok(
      //   result.stderr.includes('not found') ||
      //     result.stdout.includes('not found'),
      // );
    });

    it('should handle files with no functions', async () => {
      const testFile = join(testDir, 'no-functions.js');
      const testContent = `const value = 42; export { value };`;
      writeFileSync(testFile, testContent);

      const result = await runCli(['run', '--files', testFile, '--runs', '10']);

      assert.notStrictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
      assert.match(result.stdout, /function/);
      // assert.ok(
      //   result.stderr.includes('function') ||
      //     result.stdout.includes('function'),
      // );
    });

    it('should handle syntax errors in files', async () => {
      const testFile = join(testDir, 'syntax-error.js');
      const testContent = `export function broken( { return "broken"; }`;
      writeFileSync(testFile, testContent);

      const result = await runCli(['run', '--files', testFile, '--runs', '10']);

      assert.notStrictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');
    });
  });

  describe('Output Validation', () => {
    it('should produce valid benchmark table output', async () => {
      const testFile = join(testDir, 'table-output.js');
      const testContent = `
        export function fast() { return 1; }
        export function medium() {
          let sum = 0;
          for (let i = 0; i < 10; i++) sum += i;
          return sum;
        }
        export function slow() {
          let sum = 0;
          for (let i = 0; i < 100; i++) sum += i;
          return sum;
        }
      `;
      writeFileSync(testFile, testContent);

      const result = await runCli([
        'run',
        '--files',
        testFile,
        '--runs',
        '100',
        '--verbosity',
        '1',
      ]);

      assert.strictEqual(result.code, 0);
      assert.strictEqual(result.stderr, '');

      // Check for table structure
      assert.match(result.stdout, /│/); // Table borders
      assert.match(result.stdout, /┌/); // Table top
      assert.match(result.stdout, /└/); // Table bottom
      assert.match(result.stdout, /Runs/);
      assert.match(result.stdout, /Total Time/);
      assert.match(result.stdout, /AVG Time/);
      assert.match(result.stdout, /Ops\/Sec/);

      // Check for winner indicator
      assert.match(result.stdout, /🏆/);

      // Check for total time
      assert.match(result.stdout, /Total time:/);
      assert.match(result.stdout, /ms/);
    });
  });
});
