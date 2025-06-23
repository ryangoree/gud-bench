import { type IFormatOptions, parseFixed } from '@gud/math';

/**
 * Formats a number to a string with a specified number of decimal places *(max
 * 18)*.
 *
 * @param value - The number to format.
 * @param options - Optional formatting options. If decimals is greater than
 * 18, it will be capped to 18.
 * @returns A string representation of the number formatted to the specified.
 */
export function formatNumber(value: number, options?: IFormatOptions): string {
  let { decimals = 6, trailingZeros = true, ...rest } = options || {};
  if (decimals > 18) decimals = 18;
  return parseFixed(value.toFixed(decimals)).format({
    decimals,
    trailingZeros,
    ...rest,
  });
}
