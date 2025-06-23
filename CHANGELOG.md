# @gud/bench

## 1.1.0

### Minor Changes

- b454cb4:
  - Added a `formatNumber` util for formatting number values as strings.
  - Polished up some internals.

## 1.0.4

### Patch Changes

- 95633a3: Fixed release to actually include build 🤦‍♂️

## 1.0.3

### Patch Changes

- 7151b6e: Improved stats calc + general polish
- 2698624: Switched to **sample variance** ([Bessel’s correction](https://en.wikipedia.org/wiki/Bessel%27s_correction?utm_source=chatgpt.com)) by dividing by _n – 1_ instead of _n_ when computing standard deviation.
- e69a2c1: Switched margin-of-error calculation to use Student’s t-distribution critical values for improved accuracy on small sample sizes

## 1.0.2

### Patch Changes

- 67ec84c: Removed unused dependency

## 1.0.1

### Patch Changes

- 9ff2172: Updated README

## 1.0.0

### Major Changes

- b198bdc: Initial release 🚀
