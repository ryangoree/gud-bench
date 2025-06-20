import { writeFileSync } from 'node:fs';
import { parseFixed } from '@gud/math';
import { getTCritical95 } from './utils/getTCritical95.js';
import { Formatter, Logger } from './utils/Logger.js';

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

export type TestFunction<V = any, R = any> = (value: V) => R | Promise<R>;

export type TestFunctions<V = any, R = any> = {
  name: string;
  fn: TestFunction<V, R>;
}[];

export interface TestResult {
  name: string;
  samples: number[];
  totalTime: number;
  meanTime?: number;
  opsPerSecond?: number;
  stdDeviation?: number;
  marginOfError?: number;
}

export type TestResults = TestResult[];

export type TestQueue<V = any, R = any> = {
  runs: number;
  fn: TestFunction<V, R>;
  result: TestResult;
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
        `${this.name}: Preheating ${this.tests.length} tests ${iterations} times each...`,
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
    const hasGC = !!globalThis.gc;
    let iterationCount = 0;

    // Show overall benchmark info once
    if (verbosity > 0) {
      if (!hasGC && gcStrategy !== 'never') {
        Logger.warn('No GC hook! Consider running with --expose-gc');
      }
      Logger.group(
        `${this.name}${name ? `${Formatter.dim(' - ')}${name}` : ''}${
          cycles > 1 ? Formatter.dim(` (${cycles} cycles)`) : ''
        }`,
      ).pending(
        `Running ${cycles} ${cycles > 1 ? 'cycles' : 'cycle'} of ${this.tests.length} ${
          this.tests.length > 1 ? 'tests' : 'test'
        } ${iterations} times each...`,
      );
      if (verbosity > 1) {
        Logger.log(
          `GC Strategy: ${gcStrategy}${
            gcStrategy === 'periodic' ? ` (every ${gcInterval} iterations)` : ''
          }`,
        );
        if (value !== undefined) {
          Logger.log('Value:', value);
        }
      }
    }

    this.results = this.tests.map(({ name }) => ({
      name,
      samples: [],
      totalTime: 0,
    }));

    // Run multiple cycles
    for (let cycle = 1; cycle <= cycles; cycle++) {
      if (verbosity > 0 && cycles > 1) {
        Logger.log(`Cycle ${cycle}/${cycles}`);
      }

      // Force GC before each cycle if strategy allows
      if (hasGC && gcStrategy === 'per-cycle') {
        globalThis.gc?.();
      }

      const queue: TestQueue = this.results.map((result, i) => ({
        result,
        runs: 0,
        fn: this.tests[i].fn,
      }));

      try {
        while (queue.length) {
          const { i, test, clonedValue } = this.#prepareIteration(queue, value);

          const runStart = performance.now();
          const result = await test.fn(clonedValue);
          const runTime = performance.now() - runStart;

          iterationCount++;
          const testCompleted = this.#handleIteration({
            queue,
            i,
            runTime,
            result,
            iterations,
            options,
          });

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
        Logger.group().error(`${this.name} failed:`, error).groupEnd();
        return this;
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
      } catch (_) {
        return value.toFixed(decimals);
      }
    };

    const resultData = Object.fromEntries(
      this.results
        .sort((a, b) => a.totalTime - b.totalTime)
        .map((test, i) => {
          totalTime += test.totalTime;

          const result: Record<string, string | number> = {
            Runs: safeFormat(test.samples.length, 0),
            'Total Time (ms)': safeFormat(test.totalTime, 4),
            'AVG Time (ms)': safeFormat(test.totalTime / test.samples.length),
          };

          // Add enhanced statistics if available
          if (test.opsPerSecond) {
            result['Ops/Sec'] = safeFormat(test.opsPerSecond, 0);
          }

          if (test.meanTime && test.marginOfError) {
            // Also show as percentage of mean
            result['± (%)'] = `${safeFormat(
              (test.marginOfError / test.meanTime) * 100,
              2,
            )}%`;
          }

          return [
            this.results.length > 1
              ? `${i + 1} ${Formatter.dim('-')} ${Formatter.bold(test.name)}${
                  i === 0 ? ' 🏆' : ''
                }`
              : Formatter.bold(test.name),
            result,
          ];
        }),
    );

    Logger.table(resultData);
    Logger.italic.info(`Total time: ${safeFormat(totalTime)} ms\n`);
  }

  /**
   * Export the benchmark results to a JSON file.
   * @param filePath - The path to save the JSON file to.
   */
  exportToJson(filePath: string): this {
    const data = {
      name: this.name,
      results: this.results,
    };

    // Write the JSON file
    writeFileSync(filePath, JSON.stringify(data));
    Logger.success(`Benchmark data exported to ${filePath}`);

    return this;
  }

  #prepareIteration(queue: TestQueue, value: unknown) {
    // Random execution order to avoid bias from JIT optimizations
    const i = Math.floor(Math.random() * queue.length);
    return {
      i,
      test: queue[i]!,
      clonedValue:
        value && typeof value === 'object' ? structuredClone(value) : value,
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
    test.result.totalTime += runTime;
    test.result.samples.push(runTime);
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
          globalThis.gc?.();
        }
        break;
      case 'periodic':
        if (iterationCount % gcInterval === 0) {
          globalThis.gc?.();
        }
        break;
    }
  }

  /**
   * Calculate statistical measures for test results
   */
  #calculateStatistics() {
    for (const result of this.results) {
      const sampleSize = result.samples.length;

      if (!sampleSize) return;

      // Calculate ops per second
      const meanTime = result.totalTime / sampleSize;
      result.meanTime = meanTime;
      result.opsPerSecond = 1000 / meanTime;

      if (sampleSize <= 1) continue;

      // Adjusted sample size (n − 1) for Bessel’s correction
      // see:
      // - https://en.wikipedia.org/wiki/Bessel%27s_correction
      // - https://en.wikipedia.org/wiki/Standard_deviation#Sample_standard_deviation
      const degreesOfFreedom = sampleSize - 1;

      // Calculate standard deviation
      const variance =
        result.samples.reduce((acc: number, time: number) => {
          const diff = time - meanTime;
          return acc + diff * diff;
        }, 0) / degreesOfFreedom;
      result.stdDeviation = Math.sqrt(variance);

      // Calculate margin of error (95% confidence interval)
      const criticalTValue = getTCritical95(degreesOfFreedom);
      result.marginOfError =
        criticalTValue * (result.stdDeviation / Math.sqrt(sampleSize));
    }
  }
}

/**
 * Create a new benchmark suite.
 */
export function benchmark<V, R>(name = 'Benchmark') {
  return new Benchmark<V, R>(name);
}
