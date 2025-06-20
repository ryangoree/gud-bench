---
"@gud/bench": patch
---

Switched to **sample variance** ([Bessel’s correction](https://en.wikipedia.org/wiki/Bessel%27s_correction?utm_source=chatgpt.com)) by dividing by *n – 1* instead of *n* when computing standard deviation.
