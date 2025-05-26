import { help, run } from 'clide-js';
import { commandMenu } from 'clide-plugin-command-menu';
import { Logger } from './utils/Logger.js';

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
