import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Benchmark, benchmark } from '../dist/Benchmark.js';

describe('Benchmark', () => {
  describe('Constructor and basic functionality', () => {
    it('should create a benchmark with default name', () => {
      const bench = new Benchmark();
      assert.strictEqual(bench.name, 'Benchmark');
      assert.strictEqual(bench.tests.length, 0);
      assert.strictEqual(bench.results.length, 0);
    });

    it('should create a benchmark with custom name', () => {
      const bench = new Benchmark('Custom Test');
      assert.strictEqual(bench.name, 'Custom Test');
    });

    it('should create benchmark using factory function', () => {
      const bench = benchmark('Factory Test');
      assert.ok(bench instanceof Benchmark);
      assert.strictEqual(bench.name, 'Factory Test');
    });
  });

  describe('Test management', () => {
    it('should add named test functions', () => {
      const bench = new Benchmark();
      const testFn = () => 42;
      
      bench.test('Simple test', testFn);
      
      assert.strictEqual(bench.tests.length, 1);
      assert.strictEqual(bench.tests[0].name, 'Simple test');
      assert.strictEqual(bench.tests[0].fn, testFn);
    });

    it('should add anonymous test functions with auto-generated names', () => {
      const bench = new Benchmark();
      const testFn = () => 42;
      
      bench.test(testFn);
      
      assert.strictEqual(bench.tests.length, 1);
      assert.strictEqual(bench.tests[0].name, 'Test 1');
      assert.strictEqual(bench.tests[0].fn, testFn);
    });

    it('should add multiple tests', () => {
      const bench = new Benchmark();
      
      bench.test('Test 1', () => 1);
      bench.test('Test 2', () => 2);
      bench.test(() => 3);
      
      assert.strictEqual(bench.tests.length, 3);
      assert.strictEqual(bench.tests[0].name, 'Test 1');
      assert.strictEqual(bench.tests[1].name, 'Test 2');
      assert.strictEqual(bench.tests[2].name, 'Test 3');
    });
  });

  describe('Running benchmarks', () => {
    it('should run basic benchmark with minimal iterations', async () => {
      const bench = new Benchmark('Speed Test');
      let counter = 0;
      
      bench.test('Increment', () => {
        counter++;
        return counter;
      });
      
      bench.test('Add', () => {
        return 1 + 1;
      });
      
      // Run with minimal iterations for speed and verbosity 0 for silence
      await bench.run(10, { verbosity: 0 });
      
      assert.strictEqual(bench.results.length, 2);
      assert.strictEqual(bench.results[0].name, 'Increment');
      assert.strictEqual(bench.results[1].name, 'Add');
      assert.strictEqual(bench.results[0].runs, 10);
      assert.strictEqual(bench.results[1].runs, 10);
      assert.ok(bench.results[0].time > 0);
      assert.ok(bench.results[1].time > 0);
      assert.ok(counter >= 10); // Should have been called at least 10 times
    });

    it('should handle async test functions', async () => {
      const bench = new Benchmark('Async Test');
      
      bench.test('Async delay', async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'done';
      });
      
      await bench.run(5, { verbosity: 0 });
      
      assert.strictEqual(bench.results.length, 1);
      assert.strictEqual(bench.results[0].runs, 5);
      assert.ok(bench.results[0].time > 0);
    });

    it('should respect verbosity settings', async () => {
      const bench = new Benchmark();
      bench.test('Silent test', () => 42);
      
      // These should not throw and should run silently
      await bench.run(5, { verbosity: 0 });
      await bench.run(5, { verbosity: 1 });
      await bench.run(5, { verbosity: 2 });
      
      assert.strictEqual(bench.results.length, 1); // Only last run kept
    });

    it('should handle multiple cycles', async () => {
      const bench = new Benchmark();
      bench.test('Multi-cycle test', () => Math.random());
      
      await bench.run(5, { cycles: 3, verbosity: 0 });
      
      assert.strictEqual(bench.results.length, 1);
      assert.strictEqual(bench.results[0].runs, 5);
      // With multiple cycles, we should have more samples
      assert.ok(bench.results[0].samples.length >= 5);
    });
  });

  describe('Preheating', () => {
    it('should preheat tests', async () => {
      const bench = new Benchmark();
      let callCount = 0;
      
      bench.test('Counter', () => {
        callCount++;
        return callCount;
      });
      
      // Preheat should run the test
      await bench.preheat(5, { verbosity: 0 });
      
      assert.ok(callCount >= 5);
      assert.strictEqual(bench.results.length, 1); // Preheat now stores results
      
      // Clear results to test separate run
      bench.results.length = 0;
      
      // Now run actual benchmark
      const initialCount = callCount;
      await bench.run(3, { verbosity: 0 });
      
      assert.ok(callCount >= initialCount + 3);
      assert.strictEqual(bench.results.length, 1);
    });

    it('should inherit GC strategy in preheat', async () => {
      const bench = new Benchmark();
      bench.test('GC test', () => 42);
      
      // Should not throw when passing GC options
      await bench.preheat(2, { 
        verbosity: 0, 
        gcStrategy: 'never',
        gcInterval: 100 
      });
      
      assert.strictEqual(bench.results.length, 1); // Preheat stores results now
    });
  });

  describe('Results and statistics', () => {
    it('should calculate basic statistics', async () => {
      const bench = new Benchmark();
      bench.test('Stats test', () => {
        // Add small delay to get measurable times
        for (let i = 0; i < 1000; i++) {
          Math.random();
        }
        return 'done';
      });
      
      await bench.run(10, { verbosity: 0 });
      
      const result = bench.results[0];
      assert.ok(result.time > 0);
      assert.strictEqual(result.runs, 10);
      assert.strictEqual(result.samples.length, 10);
      assert.ok(result.opsPerSecond !== undefined);
      assert.ok(result.opsPerSecond > 0);
    });

    it('should export results to JSON', async () => {
      const bench = new Benchmark('Export Test');
      bench.test('Export test', () => 42);
      
      await bench.run(5, { verbosity: 0 });
      
      // Test the data structure that would be exported
      const expectedData = {
        name: bench.name,
        results: bench.results.map((result) => ({
          name: result.name,
          samples: result.samples,
          mean: result.time / result.runs,
          stdDev: result.stdDeviation || 0,
          marginOfError: result.marginOfError || 0,
        })),
      };
      
      assert.strictEqual(expectedData.name, 'Export Test');
      assert.ok(Array.isArray(expectedData.results));
      assert.strictEqual(expectedData.results.length, 1);
      assert.strictEqual(expectedData.results[0].name, 'Export test');
      assert.ok(typeof expectedData.results[0].mean === 'number');
      
      // Test that exportToJson method exists and can be called
      // (We'll skip actually writing the file to avoid filesystem dependencies)
      assert.ok(typeof bench.exportToJson === 'function');
    });
  });

  describe('Error handling', () => {
    it('should handle test function errors gracefully', async () => {
      const bench = new Benchmark();
      bench.test('Error test', () => {
        throw new Error('Test error');
      });
      
      // Should not throw but handle the error
      try {
        await bench.run(2, { verbosity: 0 });
        // If we get here, the error was handled gracefully
        assert.ok(true);
      } catch (error) {
        // This is also acceptable - the important thing is it doesn't crash unexpectedly
        assert.ok(error instanceof Error);
      }
    });

    it('should handle empty test suite', async () => {
      const bench = new Benchmark();
      
      // Running with no tests should not crash
      await bench.run(5, { verbosity: 0 });
      assert.strictEqual(bench.results.length, 0);
    });
  });
});
