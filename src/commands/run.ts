import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { command } from 'clide-js';
import { benchmark, type RunOptions, type TestFunction } from '../Benchmark.js';
import { Formatter, Logger } from '../utils/Logger.js';
import { loadModule } from '../utils/loadModule.js';

// Extend clide-js types for our custom GC strategy option
declare module 'clide-js' {
  interface OptionCustomTypeMap {
    'gc-strategy': Required<RunOptions>['gcStrategy'];
    verbosity: 0 | 1 | 2;
  }
}

export default command({
  description: 'Run arbitrary JavaScript/TypeScript files as benchmarks',

  options: {
    files: {
      alias: ['f'],
      description: 'List of file paths to benchmark',
      type: 'array',
      required: true,
    },
    runs: {
      alias: ['r'],
      description: 'Number of runs for the benchmark',
      type: 'number',
      default: 1e5,
    },
    coolDown: {
      alias: ['c'],
      description: 'Cool down time between runs in MS',
      type: 'number',
    },
    cycles: {
      alias: ['cy'],
      description:
        'Number of test cycles to run for better statistical accuracy',
      type: 'number',
      default: 1,
    },
    preheat: {
      alias: ['p'],
      description: 'Number of preheat iterations',
      type: 'number',
      default: 1e3,
    },
    name: {
      alias: ['n'],
      description: 'Custom name for the benchmark suite',
      type: 'string',
    },
    verbosity: {
      alias: ['v'],
      description: 'Verbosity level (0=silent, 1=basic, 2=detailed)',
      type: 'number',
      customType: 'verbosity',
      choices: [0, 1, 2],
      default: 1,
    },
    export: {
      alias: ['e'],
      description: 'Export benchmark results to JSON',
      type: 'boolean',
      default: false,
    },
    gcStrategy: {
      alias: ['gc'],
      description: 'Garbage collection strategy',
      type: 'string',
      customType: 'gc-strategy',
      choices: ['never', 'per-cycle', 'per-test', 'periodic'],
      default: 'periodic',
    },
    gcInterval: {
      alias: ['gci'],
      description:
        'For periodic GC strategy, number of iterations between GC calls',
      type: 'number',
      default: 1000,
    },
  },

  handler: async ({ options }) => {
    const filePaths = await options.files();
    const runs = await options.runs();
    const coolDown = await options.coolDown();
    const cycles = await options.cycles();
    const preheat = await options.preheat();
    const customName = await options.name();
    const verbosity = await options.verbosity();
    const shouldExport = await options.export();
    const gcStrategy = await options.gcStrategy();
    const gcInterval = await options.gcInterval();

    const resolvedFiles: string[] = [];

    // Validate all files exist
    for (const filePath of filePaths) {
      const resolvedPath = resolve(filePath);
      if (!existsSync(resolvedPath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      resolvedFiles.push(resolvedPath);
    }

    // Create benchmark suite
    const bench = benchmark(customName);

    Logger.pending(
      `📁 Loading ${resolvedFiles.length} files for benchmarking...`,
    );

    // Load and prepare test functions
    for (const filePath of resolvedFiles) {
      try {
        const fileName = basename(filePath, extname(filePath));

        // Load the module (with automatic TypeScript support)
        const moduleExports = await loadModule(filePath);

        // Handle different export patterns
        if (typeof moduleExports.default === 'function') {
          bench.test(fileName, moduleExports.default);
          continue;
        }
        if (typeof moduleExports.benchmark === 'function') {
          bench.test(fileName, moduleExports.benchmark);
          continue;
        }
        if (typeof moduleExports.test === 'function') {
          bench.test(fileName, moduleExports.test);
          continue;
        }
        if (typeof moduleExports === 'function') {
          bench.test(fileName, moduleExports);
          continue;
        }

        // Look for any exported function
        let didFindFunction = false;
        for (const [key, value] of Object.entries(moduleExports)) {
          if (typeof value === 'function') {
            didFindFunction = true;
            bench.test(
              `${fileName}${Formatter.dim('#')}${key}`,
              value as TestFunction,
            );
          }
        }

        if (!didFindFunction) {
          throw new Error(`No functions found to benchmark
  Expected: export default function, export { benchmark }, export { test }, or any named function export`);
        }
      } catch (error) {
        throw new Error(`Error loading ${filePath}: ${error}`);
      }
    }

    if (!bench.tests.length) {
      throw new Error('No test functions found to benchmark');
    }

    // Preheat
    if (preheat) {
      await bench.preheat(preheat, {
        verbosity,
        gcStrategy,
        gcInterval,
      });
    }

    // Run benchmark
    await bench.run(runs, {
      coolDown,
      verbosity,
      cycles,
      gcStrategy,
      gcInterval,
    });

    // Export results if requested
    if (shouldExport) {
      const timestamp = Date.now();

      let jsonFileName: string;
      if (resolvedFiles.length > 1) {
        // If multiple files, use a generic name
        jsonFileName = `benchmark-suite-${timestamp}.json`;
      } else {
        // If single file, use the file name with timestamp
        const fileName = basename(resolvedFiles[0], extname(resolvedFiles[0]));
        jsonFileName = `${fileName}-${timestamp}.json`;
      }

      bench.exportToJson(jsonFileName);
    }
  },
});
