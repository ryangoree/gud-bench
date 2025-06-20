# Gud Bench

[![GitHub](https://img.shields.io/badge/ryangoree%2Fgud--bench-151b23?logo=github)](https://github.com/ryangoree/gud-bench)
[![NPM Version](https://img.shields.io/badge/%40gud%2Fbench-cb3837?logo=npm)](https://npmjs.com/package/@gud/bench)
[![License: Apache-2.0](https://img.shields.io/badge/Apache%202.0-23454d?logo=apache)](./LICENSE)

**A powerful and elegant benchmarking tool for JavaScript and TypeScript with statistical accuracy and seamless TypeScript support.**

## ✨ Features

- 🚀 **Zero-config benchmarking** - Just point it at your functions
- 📊 **Statistical accuracy** with multiple cycles and margin of error calculation
- 🔧 **TypeScript support** - Transpiles `.ts` files on-the-fly
- ⚡ **Multiple export patterns** - Detects default, named, and benchmark exports
- 🗑️ **Memory management** - Advanced garbage collection strategies
- 📈 **Export results** - JSON output for further analysis
- 📦 **Library + CLI** - Use programmatically or via command line

## Installing

```sh
npm install @gud/bench
```

## Quick Start

### Running Arbitrary Files with the CLI

The easiest way to benchmark any JavaScript files is using the CLI:

```bash
# Benchmark a single file
bench --files my-functions.js

# Benchmark multiple files  
bench --files file1.js file2.js file3.js

# Customize the benchmark parameters
bench --files my-functions.js --runs 50000 --cycles 3

# Export results to JSON
bench --files my-functions.js --export true
```

The CLI will automatically detect and benchmark:
- Default exports (`export default function`)
- Named function exports (`export function myFunction()`)
- Specific benchmark functions (`export { benchmark }` or `export { test }`)

**Example function file:**
```js
// sort-algorithms.js
export function quickSort(arr = generateData()) {
  if (arr.length <= 1) return arr;
  const pivot = arr[arr.length - 1];
  const left = [], right = [];
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] < pivot) left.push(arr[i]);
    else right.push(arr[i]);
  }
  return [...quickSort(left), pivot, ...quickSort(right)];
}

export function bubbleSort(arr = generateData()) {
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

function generateData() {
  return Array.from({ length: 100 }, () => Math.floor(Math.random() * 1000));
}
```

**Output:**
```log
… 📁 Loading 1 files for benchmarking...
… Preheating 2 tests in Benchmark 1000 times each...
▾ Benchmark
  … Running 2 tests 50000 times each...
  ┌──────────────────────────────────┬──────────┬─────────────────┬───────────────┬──────────┬─────────┐
  │ (index)                          │ Runs     │ Total Time (ms) │ AVG Time (ms) │ Ops/Sec  │ ± (%)   │
  ├──────────────────────────────────┼──────────┼─────────────────┼───────────────┼──────────┼─────────┤
  │ 1 - sort-algorithms#quickSort 🏆 │ '50,000' │ '557.2415'      │ '0.011145'    │ '89,728' │ '0.45%' │
  │ 2 - sort-algorithms#bubbleSort   │ '50,000' │ '1,044.7883'    │ '0.020896'    │ '47,857' │ '0.13%' │
  └──────────────────────────────────┴──────────┴─────────────────┴───────────────┴──────────┴─────────┘
  ℹ Total time: 1,602.029779 ms
```

## Programmatic API

Create sophisticated benchmarks with the programmatic API:

```js
import { benchmark } from '@gud/bench';

// Create a new benchmark suite
const bench = benchmark('String Concatenation Benchmark');

// Add test functions
bench
  .test('Template literals', () => {
    const name = 'World';
    return `Hello ${name}!`;
  })
  .test('String concatenation', () => {
    const name = 'World';
    return 'Hello ' + name + '!';
  })
  .test('Array join', () => {
    const name = 'World';
    return ['Hello', name, '!'].join(' ');
  });

// Run the benchmark
await bench.run(100000, {
  cycles: 5,
  verbosity: 2,
  gcStrategy: 'per-cycle',
});

// Export results
bench.exportToJson('./results/string-concat.json');
```

### Advanced Features

**Memory Management:**
```js
// Fine-tune garbage collection for accurate results
await bench.run(100000, {
  gcStrategy: 'periodic',  // Force GC periodically
  gcInterval: 1000,        // Every 1000 iterations
  cycles: 3                // Multiple cycles for accuracy
});
```

**Statistical Analysis:**
```js
// Get detailed statistics
await bench.run(50000, {
  cycles: 10,              // More cycles = better accuracy
  verbosity: 2             // Show detailed timing info
});
```

**TypeScript Support:**
```ts
// Works seamlessly with TypeScript files
bench --files "src/**/*.ts" --runs 10000
```

## API Reference

### `benchmark(name?: string)`

Creates a new benchmark suite.

**Parameters:**
- `name` (optional) - Name for the benchmark suite

**Returns:** `Benchmark` instance

### `Benchmark` Class

#### Methods

- `test(name: string, fn: Function)` - Add a test function
- `run(iterations: number, options?: RunOptions)` - Execute benchmark
- `preheat(iterations: number, options?)` - Warm up before benchmarking  
- `exportToJson(filePath: string)` - Export results to JSON
- `printResults()` - Display formatted results table

#### `RunOptions`

```ts
interface RunOptions {
  cycles?: number;           // Test cycles (default: 1)
  coolDown?: number;         // MS between runs
  verbosity?: 0 | 1 | 2;     // Output level (default: 1) 
  gcStrategy?: 'never' | 'per-cycle' | 'per-test' | 'periodic';
  gcInterval?: number;       // For periodic GC (default: 1000)
}
```

### Garbage Collection Strategies

- `'never'` - No forced GC (fastest, but memory pressure may affect results)
- `'per-cycle'` - GC once per cycle (good balance, default)
- `'per-test'` - GC after each test completes all iterations
- `'periodic'` - GC every N iterations (configurable via `gcInterval`)

**Note:** The CLI automatically restarts with the `--expose-gc` flag when needed for garbage collection. To disable this behavior, set the environment variable `BENCH_NO_EXPOSE_GC=true`.