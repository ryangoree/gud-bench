#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { CliError, help, run } from '@gud/cli';
import { menu } from '@gud/cli-menu';
import { Logger } from './utils/Logger.js';

function needsExposeGC(): boolean {
  if (typeof globalThis.gc === 'function') return false;
  if (process.execArgv.includes('--expose-gc')) return false;
  if (process.env.BENCH_NO_EXPOSE_GC === 'true') return false;
  return true;
}

async function restartWithExposeGC(): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--expose-gc',
      ...process.execArgv.filter((arg) => arg !== '--expose-gc'),
      process.argv[1], // The script path
      ...process.argv.slice(2), // CLI arguments
    ];

    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        BENCH_RESTARTED: 'true',
      },
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code || 0);
      }
    });

    child.on('error', (error) => {
      if (error instanceof CliError) reject(error);
      Logger.warn(`Could not restart with --expose-gc: ${error.message}`);
      resolve();
    });
  });
}

async function main() {
  if (needsExposeGC() && !process.env.BENCH_RESTARTED) {
    await restartWithExposeGC();
  }

  run({
    plugins: [
      help(),
      menu({
        enabled: (options) => !options.help,
      }),
    ],
    defaultCommand: 'run',
  })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      Logger.error(error);
      process.exit(1);
    });
}

main().catch((error) => {
  Logger.error(error);
  process.exit(1);
});
