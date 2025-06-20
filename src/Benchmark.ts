import { writeFileSync } from 'node:fs';
import { parseFixed } from '@gud/math';
import { Logger } from './utils/Logger.js';

type ValueOption<V> = {
  /**
   * The value to pass to the test function.
   */
  value?: V;
};

export type RunOptions<V = any, R = any> = {
  /**
   * A name for the run.
   */
  name?: string;

  /**
   * Number of test cycles to run. Each cycle will run the specified
   * number of iterations. Higher cycle counts provide more statistical accuracy.
   *
   *  @default 1
   */
  cycles?: number;

  /**
   * The number of milliseconds to wait between runs.
   */
  coolDown?: number;

  /**
   * The level of logging verbosity.
   * - `0` - No output
   * - `1` - Basic output (default)
   * - `2` - Detailed output
   *
   *  @default 1
   */
  verbosity?: 0 | 1 | 2;

  /**
   * Garbage collection strategy.
   * - `'never'` - Never force GC (fastest, but may have memory pressure effects)
   * - `'per-cycle'` - Force GC once per cycle (default, good balance)
   * - `'per-test'` - Force GC when each test completes all iterations
   * - `'periodic'` - Force GC every N iterations (use with gcInterval)
   *
   * @default 'periodic'
   */
  gcStrategy?: 'never' | 'per-cycle' | 'per-test' | 'periodic';

  /**
   * For 'periodic' GC strategy, how many iterations between GC calls.
   *
   * @default 1000
   */
  gcInterval?: number;

  /**
   * A function to validate the result. Return false or an error message to fail the test.
   */
  validate?: (result: R, value: V) => boolean | string;
} & (undefined extends V ? ValueOption<V> : Required<ValueOption<V>>);

type PreheatOptions<V = any> = Pick<
  RunOptions<V>,
  'value' | 'verbosity' | 'gcStrategy' | 'gcInterval'
>;

export type PreheatArgs<V = any> = undefined extends V
  ? [number, PreheatOptions<V>?]
  : [number, PreheatOptions<V>];

export type RunArgs<V = any, R = any> = undefined extends V
  ? [number, RunOptions<V, R>?]
  : [number, RunOptions<V, R>];

export type TestResult = {
  name: string;
  time: number;
  runs: number;
  samples: number[];
  opsPerSecond?: number;
  stdDeviation?: number;
  marginOfError?: number;
  // TODO: Add support for GC tracking
  // gcCount?: number;
  // gcTime?: number;
};

export type TestResults = TestResult[];

export type TestQueue<TValue = any, TReturn = any> = {
  runs: number;
  time: number;
  name: string;
  fn: TestFunction<TValue, TReturn>;
  samples: number[];
  // gcCount: number;
  // gcTime: number;
}[];

export type TestFunction<V = any, R = any> = (value: V) => R | Promise<R>;

export type TestFunctions<V = any, R = any> = {
  name: string;
  fn: TestFunction<V, R>;
}[];

export class Benchmark<TValue = any, TReturn = any> {
  name: string;

  /**
   * The results of the tests.
   */
  results: TestResults = [];

  #tests: TestFunctions = [];

  constructor(name = 'Benchmark') {
    this.name = name;
  }

  /**
   * The tests to be run.
   */
  get tests() {
    return this.#tests as TestFunctions<TValue, TReturn>;
  }

  /**
   * Add a test to be run
   */
  test<V extends TValue, R extends TReturn>(
    name: string,
    fn: TestFunction<V, R>,
  ): Benchmark<V, R>;
  test<V extends TValue, R extends TReturn>(
    fn: TestFunction<V, R>,
  ): Benchmark<V, R>;
  test<V extends TValue, R extends TReturn>(
    name: string | TestFunction<V, R>,
    fn = name as TestFunction<V, R>,
  ): Benchmark<V, R> {
    if (typeof name === 'function') {
      name = `Test ${this.tests.length + 1}`;
    }
    this.#tests.push({ name, fn });
    return this as unknown as Benchmark<V, R>;
  }

  /**
   * Preheat the runner by running the tests a number of times.
   * @param iterations - The number of times to run each test
   * @param value - The value to pass to the test function
   */
  preheat(
    ...[
      iterations,
      { value, verbosity = 1, gcStrategy, gcInterval } = {},
    ]: PreheatArgs<TValue>
  ) {
    if (verbosity > 0) {
      Logger.pending(
        `Preheating ${this.tests.length} tests in ${this.name} ${iterations} times each...`,
      );
    }
    return this.run(iterations, {
      value,
      verbosity: 0,
      gcStrategy,
      gcInterval,
    } as RunOptions<TValue, TReturn>);
  }

  /**
   * Run the tests.
   * @param iterations - The number of times to run each test.
   * @param value - The value to pass to the test function
   * @param options - Options for the run.
   */
  async run(
    ...[iterations = 1e5, options]: RunArgs<TValue, TReturn>
  ): Promise<this> {
    const {
      coolDown,
      cycles = 1,
      gcInterval = 1000,
      gcStrategy = 'periodic',
      name,
      value,
      verbosity = 1,
    } = options || {};

    // Check GC availability
    const hasGC = !!globalThis.gc;
    if (!hasGC && gcStrategy !== 'never' && verbosity > 0) {
      Logger.warn('No GC hook! Consider running with --expose-gc');
    }

    // Show overall benchmark info once
    if (verbosity > 0) {
      Logger.group(
        `${this.name}${name ? `${Logger.text.dim(' - ')}${name}` : ''}${
          cycles > 1 ? Logger.text.dim(` (${cycles} cycles)`) : ''
        }`,
      );
      Logger.pending(
        `Running ${this.tests.length} tests ${iterations} times each...`,
      );
      if (verbosity > 1) {
        Logger.log(
          `GC Strategy: ${gcStrategy}${
            gcStrategy === 'periodic' ? ` (every ${gcInterval} iterations)` : ''
          }`,
        );
      }
      if (value !== undefined && verbosity > 1) {
        Logger.log('Value:', value);
      }
    }

    // Run multiple cycles
    for (let cycle = 0; cycle < cycles; cycle++) {
      if (verbosity > 0 && cycles > 1) {
        Logger.log(`Cycle ${cycle + 1}/${cycles}`);
      }

      // Force GC before each cycle if strategy allows
      if (hasGC && gcStrategy === 'per-cycle') {
        globalThis.gc!();
      }

      const queue = this.#prepareQueue();
      let iterationCount = 0;

      try {
        while (queue.length) {
          const { i, test, clonedValue } = this.#prepareIteration(queue, value);
          const runStart = performance.now();
          const result = await test.fn(clonedValue);
          const runTime = performance.now() - runStart;

          const testCompleted = this.#handleIteration({
            queue,
            i,
            runTime,
            result,
            iterations,
            options,
          });

          iterationCount++;

          // Handle GC based on strategy
          if (hasGC) {
            this.#handleGarbageCollection(gcStrategy, {
              testCompleted,
              iterationCount,
              gcInterval,
            });
          }

          if (coolDown) {
            await new Promise((resolve) => setTimeout(resolve, coolDown));
          }
        }
      } catch (error) {
        this.#handleRunError(error);
        break; // Stop cycles on error
      }
    }

    // Calculate statistics
    this.#calculateStatistics();

    if (verbosity > 0) {
      this.printResults();
      Logger.groupEnd(); // Close the main benchmark group
    }

    return this;
  }

  printResults() {
    let totalTime = 0;

    // Helper function to safely format numbers, avoiding the parseFixed error for very small values
    const safeFormat = (value: number, decimals = 6) => {
      try {
        return parseFixed(value).format({
          decimals,
          trailingZeros: true,
        });
      } catch (e) {
        return value.toFixed(decimals);
      }
    };

    const resultData = Object.fromEntries(
      this.results
        .sort((a, b) => a.time - b.time)
        .map((test, i) => {
          totalTime += test.time;

          const result: Record<string, string | number> = {
            Runs: safeFormat(test.runs, 0),
            'Total Time (ms)': safeFormat(test.time, 4),
            'AVG Time (ms)': safeFormat(test.time / test.runs),
          };

          // Add enhanced statistics if available
          if (test.opsPerSecond) {
            result['Ops/Sec'] = safeFormat(test.opsPerSecond, 0);
          }

          if (test.marginOfError) {
            // Also show as percentage of mean
            const meanTime = test.time / test.runs;
            result['± (%)'] = `${safeFormat(
              (test.marginOfError / meanTime) * 100,
              2,
            )}%`;
          }

          return [
            `${i + 1} ${Logger.text.dim('-')} ${Logger.text.bold(test.name)}${
              i === 0 ? ' 🏆' : ''
            }`,
            result,
          ];
        }),
    );

    Logger.table(resultData);
    Logger.info(
      Logger.text.italic(`Total time: ${safeFormat(totalTime)} ms\n`),
    );
  }

  /**
   * Calculate statistical measures for test results
   */
  #calculateStatistics() {
    for (const result of this.results) {
      if (!result.samples || !result.samples.length) continue;

      // Calculate ops per second
      const mean = result.time / result.runs;
      result.opsPerSecond = 1000 / mean;

      // Calculate standard deviation
      const variance =
        result.samples.reduce((acc: number, time: number) => {
          const diff = time - mean;
          return acc + diff * diff;
        }, 0) / result.samples.length;
      result.stdDeviation = Math.sqrt(variance);

      // Calculate margin of error (95% confidence interval)
      // Using t-distribution for small sample sizes would be more accurate
      // but for simplicity we'll use normal distribution approximation
      result.marginOfError =
        1.96 * (result.stdDeviation / Math.sqrt(result.samples.length));
    }
  }

  #prepareQueue(): TestQueue<TValue, TReturn> {
    const queue = this.tests.map((test) => ({
      ...test,
      runs: 0,
      time: 0,
      samples: [],
      gcCount: 0,
      gcTime: 0,
    }));
    this.results = queue.slice();
    return queue;
  }

  #prepareIteration(queue: TestQueue, value: unknown) {
    const i = Math.floor(Math.random() * queue.length);
    return {
      i,
      test: queue[i]!,
      clonedValue: structuredClone(value) as TValue,
    };
  }

  #handleIteration({
    queue,
    i,
    runTime,
    result,
    iterations = 1e5,
    options: { validate, value } = {},
  }: {
    queue: TestQueue;
    i: number;
    runTime: number;
    result: unknown;
    iterations: number;
    options?: RunOptions;
  }): boolean {
    const test = queue[i]!;
    test.time += runTime;
    test.samples.push(runTime);
    const testCompleted = ++test.runs === iterations;
    if (testCompleted) queue.splice(i, 1);
    if (validate) {
      const validationResult = validate(result, value) || 'Validation failed';
      if (validationResult !== true) throw validationResult;
    }
    return testCompleted;
  }

  #handleGarbageCollection(
    strategy: 'never' | 'per-cycle' | 'per-test' | 'periodic',
    {
      testCompleted,
      iterationCount,
      gcInterval,
    }: {
      testCompleted: boolean;
      iterationCount: number;
      gcInterval: number;
    },
  ) {
    switch (strategy) {
      case 'never':
        // No GC
        break;
      case 'per-cycle':
        // GC is handled before cycle starts
        break;
      case 'per-test':
        if (testCompleted) {
          globalThis.gc!();
        }
        break;
      case 'periodic':
        if (iterationCount % gcInterval === 0) {
          globalThis.gc!();
        }
        break;
    }
  }

  #handleRunError(error: unknown) {
    Logger.group();
    Logger.error(`${this.name} failed:`, error);
    Logger.groupEnd();
    this.results = [];
    return this;
  }

  /**
   * Export the benchmark results to a JSON file.
   * @param filePath - The path to save the JSON file to.
   */
  exportToJson(filePath: string): this {
    const data = {
      name: this.name,
      results: this.results.map((result) => ({
        name: result.name,
        samples: result.samples,
        mean: result.time / result.runs,
        stdDev: result.stdDeviation || 0,
        marginOfError: result.marginOfError || 0,
      })),
    };

    // Write the JSON file
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    Logger.success(`Benchmark data exported to ${filePath}`);

    return this;
  }
}

/**
 * Create a new benchmark suite.
 */
export function benchmark<V, R>(name = 'Benchmark') {
  return new Benchmark<V, R>(name);
}
