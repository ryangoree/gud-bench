import { spawn } from 'node:child_process';
import { help, run } from 'clide-js';
import { commandMenu } from 'clide-plugin-command-menu';
import { Logger } from './utils/Logger.js';

// Check if we should restart with --expose-gc
function needsExposeGC(): boolean {
  // Already has GC available
  if (typeof globalThis.gc === 'function') {
    return false;
  }

  // Already has --expose-gc in execArgv
  if (process.execArgv.includes('--expose-gc')) {
    return false;
  }

  // Check if user explicitly disabled it via environment variable
  if (process.env.BENCH_NO_EXPOSE_GC === 'true') {
    return false;
  }

  return true;
}

async function restartWithExposeGC(): Promise<void> {
  return new Promise((resolve) => {
    // Simple restart with --expose-gc flag
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
      // If restart fails, continue without --expose-gc
      Logger.warn(`Could not restart with --expose-gc: ${error.message}`).warn(
        'Continuing without garbage collection optimization...',
      );
      resolve();
    });
  });
}

// Main execution logic
async function main() {
  // Only attempt restart if we haven't already restarted
  if (needsExposeGC() && !process.env.BENCH_RESTARTED) {
    await restartWithExposeGC();
    return; // If we reach here, restart failed but we continue
  }

  // Run the CLI normally
  run({
    plugins: [
      help(),
      commandMenu({
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
