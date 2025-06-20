import readlinePromises from 'node:readline/promises';

// Select Graphic Rendition (SGR) Formatting Syntax:
//
//   ESC + CSI + Ps + [; Ps]* + m
//
// - ESC character = `\x1b` (hex) / `\033` (octal) / `\u001b` (unicode)
// - Control Sequence Introducer (CSI) = `[`
// - Ps Values (Attribute numbers) = `31`, `32`, etc.
//
// Example: '\x1b[31;4mHello\x1b[0m' formats "Hello" in underlined red.

const ESC = '\x1b';
const CSI = '[';

const SGR = {
  RESET: '0',

  BOLD: '1',
  DIM: '2',
  RESET_WEIGHT: '22', // Resets bold + dim

  ITALIC: '3',
  RESET_ITALIC: '23',

  UNDERLINE: '4',
  RESET_UNDERLINE: '24',

  STRIKETHROUGH: '9',
  RESET_STRIKETHROUGH: '29',

  RED: '31',
  GREEN: '32',
  YELLOW: '33',
  BLUE: '34',
  MAGENTA: '35',
  CYAN: '36',
  WHITE: '37',
  DEFAULT: '39',
} as const;
type SgrStyle = (typeof SGR)[keyof typeof SGR];

const ANSI = {
  ESC,
  CSI,
  RED: `${ESC}${CSI}${SGR.RED}m`,
  GREEN: `${ESC}${CSI}${SGR.GREEN}m`,
  YELLOW: `${ESC}${CSI}${SGR.YELLOW}m`,
  BLUE: `${ESC}${CSI}${SGR.BLUE}m`,
  MAGENTA: `${ESC}${CSI}${SGR.MAGENTA}m`,
  CYAN: `${ESC}${CSI}${SGR.CYAN}m`,
  WHITE: `${ESC}${CSI}${SGR.WHITE}m`,
  DEFAULT: `${ESC}${CSI}${SGR.DEFAULT}m`,
  BOLD: `${ESC}${CSI}${SGR.BOLD}m`,
  DIM: `${ESC}${CSI}${SGR.DIM}m`,
  ITALIC: `${ESC}${CSI}${SGR.ITALIC}m`,
  UNDERLINE: `${ESC}${CSI}${SGR.UNDERLINE}m`,
  STRIKETHROUGH: `${ESC}${CSI}${SGR.STRIKETHROUGH}m`,
  RESET: `${ESC}${CSI}${SGR.RESET}m`,
  RESET_WEIGHT: `${ESC}${CSI}${SGR.RESET_WEIGHT}m`,
  RESET_ITALIC: `${ESC}${CSI}${SGR.RESET_ITALIC}m`,
  RESET_UNDERLINE: `${ESC}${CSI}${SGR.RESET_UNDERLINE}m`,
  RESET_STRIKETHROUGH: `${ESC}${CSI}${SGR.RESET_STRIKETHROUGH}m`,
} as const;

function format(styles: SgrStyle[], ...text: unknown[]): string {
  return `${ESC}${CSI}${styles.join(';')}m${text.join(' ')}${ANSI.RESET}`;
}

// Text Formatter //

export interface TextFormatter {
  /**
   * Formats text and returns the formatted string.
   */
  (...text: unknown[]): string;

  // Colors //

  /**
   * Formats text as red.
   */
  red: TextFormatter;

  /**
   * Formats text as green.
   */
  green: TextFormatter;

  /**
   * Formats text as yellow.
   */
  yellow: TextFormatter;

  /**
   * Formats text as blue.
   */
  blue: TextFormatter;

  /**
   * Formats text as magenta.
   */
  magenta: TextFormatter;

  /**
   * Formats text as cyan.
   */
  cyan: TextFormatter;

  /**
   * Formats text as white.
   */
  white: TextFormatter;

  // Styles //

  /**
   * Formats text as bold.
   */
  bold: TextFormatter;

  /**
   * Formats text as dim.
   */
  dim: TextFormatter;

  /**
   * Formats text as italic.
   */
  italic: TextFormatter;

  /**
   * Formats text as underlined.
   */
  underline: TextFormatter;

  /**
   * Formats text as strikethrough.
   */
  strikethrough: TextFormatter;
}

function createTextFormatter(styles: SgrStyle[] = []): TextFormatter {
  function textBuilder(...text: unknown[]): string {
    return format(styles, ...text);
  }

  Object.defineProperties(textBuilder, {
    red: {
      get() {
        return createTextFormatter([...styles, SGR.RED]);
      },
      enumerable: true,
      configurable: false,
    },
    green: {
      get() {
        return createTextFormatter([...styles, SGR.GREEN]);
      },
      enumerable: true,
      configurable: false,
    },
    yellow: {
      get() {
        return createTextFormatter([...styles, SGR.YELLOW]);
      },
      enumerable: true,
      configurable: false,
    },
    blue: {
      get() {
        return createTextFormatter([...styles, SGR.BLUE]);
      },
      enumerable: true,
      configurable: false,
    },
    magenta: {
      get() {
        return createTextFormatter([...styles, SGR.MAGENTA]);
      },
      enumerable: true,
      configurable: false,
    },
    cyan: {
      get() {
        return createTextFormatter([...styles, SGR.CYAN]);
      },
      enumerable: true,
      configurable: false,
    },
    white: {
      get() {
        return createTextFormatter([...styles, SGR.WHITE]);
      },
      enumerable: true,
      configurable: false,
    },
    bold: {
      get() {
        return createTextFormatter([...styles, SGR.BOLD]);
      },
      enumerable: true,
      configurable: false,
    },
    dim: {
      get() {
        return createTextFormatter([...styles, SGR.DIM]);
      },
      enumerable: true,
      configurable: false,
    },
    italic: {
      get() {
        return createTextFormatter([...styles, SGR.ITALIC]);
      },
      enumerable: true,
      configurable: false,
    },
    underline: {
      get() {
        return createTextFormatter([...styles, SGR.UNDERLINE]);
      },
      enumerable: true,
      configurable: false,
    },
    strikethrough: {
      get() {
        return createTextFormatter([...styles, SGR.STRIKETHROUGH]);
      },
      enumerable: true,
      configurable: false,
    },
  });

  return textBuilder as any;
}

export const Formatter: TextFormatter = createTextFormatter();

// Logger //

export interface LoggerConfirmOptions {
  /**
   * Message to show when cancelled (optional).
   *
   * @default 'Operation canceled.'
   */
  cancelMessage?: string;
  /**
   * Default value if user just presses enter.
   *
   * @default true
   */
  defaultValue?: boolean;
}

export interface Logger {
  /**
   * Logs formatted text.
   */
  (...text: unknown[]): Logger;

  readonly ANSI: typeof ANSI;

  /**
   * Creates a text formatter that returns formatted strings instead of logging.
   */
  text: TextFormatter;

  // Colors //

  /**
   * Prints text as red.
   */
  red: Logger;

  /**
   * Prints text as green.
   */
  green: Logger;

  /**
   * Prints text as yellow.
   */
  yellow: Logger;

  /**
   * Prints text as blue.
   */
  blue: Logger;

  /**
   * Prints text as magenta.
   */
  magenta: Logger;

  /**
   * Prints text as cyan.
   */
  cyan: Logger;

  /**
   * Prints text as white.
   */
  white: Logger;

  // Styles //

  /**
   * Prints text as bold.
   */
  bold: Logger;

  /**
   * Prints text as dim.
   */
  dim: Logger;

  /**
   * Prints text as italic.
   */
  italic: Logger;

  /**
   * Prints text as underlined.
   */
  underline: Logger;

  /**
   * Prints text as strikethrough.
   */
  strikethrough: Logger;

  // Semantic Logging //

  /**
   * Prints a log message.
   */
  log(...msg: unknown[]): Logger;

  /**
   * Prints an informational message.
   */
  info(...msg: unknown[]): Logger;

  /**
   * Prints a success message.
   */
  success(...msg: unknown[]): Logger;

  /**
   * Prints a warning message.
   */
  warn(...msg: unknown[]): Logger;

  /**
   * Prints an error message to stderr.
   */
  error(...msg: unknown[]): Logger;

  /**
   * Prints a debug message.
   */
  debug(...msg: unknown[]): Logger;

  /**
   * Prints a pending message.
   */
  pending(...msg: unknown[]): Logger;

  /**
   * Starts a new console group with an optional label.
   */
  group(...label: unknown[]): Logger;

  /**
   * Ends the current console group.
   */
  groupEnd(): Logger;

  /**
   * Prints a table of data.
   */
  table(data: unknown, properties?: string[]): Logger;

  /**
   * Prompts the user for confirmation.
   * @param message - The confirmation message.
   * @param options - Optional configuration for the confirmation prompt.
   * @returns Promise that resolves to true if confirmed, false otherwise.
   */
  confirm(message: string, options: LoggerConfirmOptions): Promise<boolean>;
}

function createLogger(styles: SgrStyle[] = []): Logger {
  function builder(...text: unknown[]) {
    console.log(format(styles, ...text));
    return createLogger();
  }

  Object.defineProperties(builder.prototype, {
    constructor: {
      value: builder,
      enumerable: false,
      writable: true,
      configurable: true,
    },
    [Symbol.toStringTag]: {
      value: builder.name,
      enumerable: false,
      writable: true,
      configurable: true,
    },
  });

  Object.defineProperties(builder, {
    name: {
      value: 'Logger',
      enumerable: false,
      writable: false,
      configurable: true,
    },
    ANSI: {
      value: ANSI,
      writable: false,
      enumerable: true,
      configurable: false,
    },
    text: {
      get() {
        return createTextFormatter(styles);
      },
      enumerable: true,
      configurable: false,
    },
    red: {
      get() {
        return createLogger([...styles, SGR.RED]);
      },
      enumerable: true,
      configurable: false,
    },
    green: {
      get() {
        return createLogger([...styles, SGR.GREEN]);
      },
      enumerable: true,
      configurable: false,
    },
    yellow: {
      get() {
        return createLogger([...styles, SGR.YELLOW]);
      },
      enumerable: true,
      configurable: false,
    },
    blue: {
      get() {
        return createLogger([...styles, SGR.BLUE]);
      },
      enumerable: true,
      configurable: false,
    },
    magenta: {
      get() {
        return createLogger([...styles, SGR.MAGENTA]);
      },
      enumerable: true,
      configurable: false,
    },
    cyan: {
      get() {
        return createLogger([...styles, SGR.CYAN]);
      },
      enumerable: true,
      configurable: false,
    },
    white: {
      get() {
        return createLogger([...styles, SGR.WHITE]);
      },
      enumerable: true,
      configurable: false,
    },
    bold: {
      get() {
        return createLogger([...styles, SGR.BOLD]);
      },
      enumerable: true,
      configurable: false,
    },
    dim: {
      get() {
        return createLogger([...styles, SGR.DIM]);
      },
      enumerable: true,
      configurable: false,
    },
    italic: {
      get() {
        return createLogger([...styles, SGR.ITALIC]);
      },
      enumerable: true,
      configurable: false,
    },
    underline: {
      get() {
        return createLogger([...styles, SGR.UNDERLINE]);
      },
      enumerable: true,
      configurable: false,
    },
    strikethrough: {
      get() {
        return createLogger([...styles, SGR.STRIKETHROUGH]);
      },
      enumerable: true,
      configurable: false,
    },
    log: {
      value(...msg: unknown[]) {
        const prefix = format([SGR.BLUE], '✦');
        console.log(prefix, format(styles, ...msg));
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    info: {
      value(...msg: unknown[]) {
        const prefix = format([SGR.CYAN], 'ℹ');
        console.log(prefix, format(styles, ...msg));
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    success: {
      value(...msg: unknown[]) {
        const prefix = format([SGR.GREEN], '✔︎');
        console.log(prefix, format(styles, ...msg));
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    warn: {
      value(...msg: unknown[]) {
        const prefix = format([SGR.YELLOW], '⚠︎');
        console.log(prefix, format(styles, ...msg));
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    error: {
      value(...msg: unknown[]) {
        const prefix = format([SGR.RED], '✖︎ error:');
        console.log(prefix, format(styles, ...msg));
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    debug: {
      value(...msg: unknown[]) {
        const prefix = format([SGR.YELLOW], '⚙︎ debug:');
        console.log(prefix, format(styles, ...msg));
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    pending: {
      value(...msg: unknown[]) {
        const prefix = format([SGR.BLUE], '…');
        console.log(prefix, format(styles, ...msg));
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    group: {
      value(...label: unknown[]) {
        if (label.length) {
          const prefix = format([SGR.CYAN], '▾');
          console.group(prefix, format(styles, ...label));
        } else {
          console.group();
        }
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    groupEnd: {
      value() {
        console.groupEnd();
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    table: {
      value(data: unknown, properties?: string[]) {
        console.table(data, properties);
        return createLogger();
      },
      writable: false,
      enumerable: true,
      configurable: false,
    },
    confirm: {
      value(
        msg: string,
        {
          cancelMessage = 'Operation canceled.',
          defaultValue = true,
        }: LoggerConfirmOptions = {},
      ): Promise<boolean> {
        const prefix = format([SGR.CYAN], '? ');
        const suffix = defaultValue
          ? ` [${format([SGR.GREEN], 'Y')}/n]`
          : ` [y/${format([SGR.RED], 'N')}]`;

        const formattedMsg = format(styles, msg);

        const question = `${prefix}${formattedMsg}${suffix}? `;
        const cancelPrefix = format([SGR.RED], '✖︎ ');

        const rl = readlinePromises.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.on('SIGINT', () => {
          console.log(); // Move to a new line
          if (cancelMessage) {
            console.log(`${cancelPrefix}${cancelMessage}`);
          }
          rl.close();
        });

        async function ask(): Promise<boolean> {
          const answer = await rl.question(question);

          if (!answer.match(/^(|y|yes|n|no)$/i)) {
            // Create fresh logger for error message to avoid contamination
            createLogger().error(
              'Invalid answer. Please enter y, yes, n, or no',
            );
            return ask();
          }

          rl.close();

          if (!answer) {
            if (!defaultValue && cancelMessage) {
              console.log(cancelPrefix, cancelMessage);
            }
            return defaultValue;
          }

          return /^y/i.test(answer);
        }

        return ask();
      },
    },
    [Symbol.toPrimitive]: {
      value: () => {
        return format(styles, 'Logger');
      },
      writable: false,
      enumerable: false,
      configurable: false,
    },
  });

  return builder as any;
}

export const Logger: Logger = createLogger();
