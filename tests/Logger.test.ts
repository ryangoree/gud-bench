import assert from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Formatter, Logger } from '../src/utils/Logger.js';

describe('Logger', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[] = [];
  let errorOutput: string[] = [];

  before(() => {
    // Capture console output for testing
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };

    console.error = (...args) => {
      errorOutput.push(args.join(' '));
    };
  });

  after(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    // Clear captured output before each test
    logOutput = [];
    errorOutput = [];
  });

  describe('Text formatter', () => {
    it('should export standalone Formatter', () => {
      assert.ok(Formatter);
      assert.ok(typeof Formatter === 'function');
    });

    it('should format text without logging', () => {
      const text = 'Red text';
      const formatted = Formatter.red(text);
      assert.strictEqual(typeof formatted, 'string');
      assert.ok(formatted.includes(text));
      assert.strictEqual(logOutput.length, 0); // Should not log
    });

    it('should support chained text formatting', () => {
      const text = 'Bold red text';
      const formatted = Formatter.bold.red(text);
      assert.strictEqual(typeof formatted, 'string');
      assert.ok(formatted.includes(text));
      assert.strictEqual(logOutput.length, 0); // Should not log
    });

    it('should work in template literals', () => {
      const fileName = 'test-file';
      const key = 'testFunction';
      const separator = '#';
      const result = `${fileName}${Formatter.dim(separator)}${key}`;

      assert.ok(result.includes(fileName));
      assert.ok(result.includes(separator));
      assert.ok(result.includes(key));
      assert.strictEqual(logOutput.length, 0); // Should not log
    });
  });

  describe('Basic logging', () => {
    it('should log basic messages', () => {
      Logger('Hello World');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Hello World'));
    });

    it('should support chaining', () => {
      const result = Logger('Test message');
      // Logger function returns a new Logger instance when called
      assert.ok(typeof result === 'function');
      assert.ok(
        result.name === 'Logger' || result.constructor.name === 'Logger',
      );
    });
  });

  describe('Semantic logging methods', () => {
    it('should log info messages', () => {
      Logger.info('Information message');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Information message'));
      assert.ok(logOutput[0].includes('ℹ')); // Info icon
    });

    it('should log success messages', () => {
      Logger.success('Success message');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Success message'));
      assert.ok(logOutput[0].includes('✔︎')); // Success icon
    });

    it('should log error messages', () => {
      Logger.error('Error message');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Error message'));
      assert.ok(logOutput[0].includes('✖︎')); // Error icon
    });

    it('should log warning messages', () => {
      Logger.warn('Warning message');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Warning message'));
      assert.ok(logOutput[0].includes('⚠︎')); // Warning icon
    });

    it('should log debug messages', () => {
      Logger.debug('Debug message');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Debug message'));
      assert.ok(logOutput[0].includes('⚙︎')); // Debug icon
    });

    it('should log pending messages', () => {
      Logger.pending('Pending message');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Pending message'));
      assert.ok(logOutput[0].includes('…')); // Pending icon
    });
  });

  describe('Color formatting', () => {
    it('should return chainable logger for color methods', () => {
      const redLogger = Logger.red;
      assert.ok(
        typeof redLogger === 'function' || typeof redLogger === 'object',
      );

      const blueLogger = Logger.blue;
      assert.ok(
        typeof blueLogger === 'function' || typeof blueLogger === 'object',
      );
    });

    it('should support chained color formatting', () => {
      Logger.red.bold('Red and bold text');
      assert.ok(logOutput.length > 0);
      assert.ok(logOutput[0].includes('Red and bold text'));
    });
  });

  describe('Group functionality', () => {
    let originalConsoleGroup: typeof console.group;
    let originalConsoleGroupEnd: typeof console.groupEnd;
    let groupCalls: [string, ...unknown[]][] = [];

    before(() => {
      originalConsoleGroup = console.group;
      originalConsoleGroupEnd = console.groupEnd;

      console.group = (...args) => {
        groupCalls.push(['group', ...args]);
      };

      console.groupEnd = () => {
        groupCalls.push(['groupEnd']);
      };
    });

    after(() => {
      console.group = originalConsoleGroup;
      console.groupEnd = originalConsoleGroupEnd;
    });

    beforeEach(() => {
      groupCalls = [];
    });

    it('should support grouping', () => {
      Logger.group('Test Group');
      Logger.groupEnd();

      assert.strictEqual(groupCalls.length, 2);
      assert.strictEqual(groupCalls[0][0], 'group');
      assert.strictEqual(groupCalls[1][0], 'groupEnd');
    });
  });

  describe('Table functionality', () => {
    let originalConsoleTable: typeof console.table;
    let tableCalls: unknown[][] = [];

    before(() => {
      originalConsoleTable = console.table;
      console.table = (...args) => {
        tableCalls.push(args);
      };
    });

    after(() => {
      console.table = originalConsoleTable;
    });

    beforeEach(() => {
      tableCalls = [];
    });

    it('should support table output', () => {
      const data = [
        { name: 'Test 1', value: 100 },
        { name: 'Test 2', value: 200 },
      ];

      Logger.table(data);

      assert.strictEqual(tableCalls.length, 1);
      assert.strictEqual(tableCalls[0][0], data);
    });
  });
});
