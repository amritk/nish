# Third-party notices

This repository's [`LICENSE`](LICENSE) covers the code written for it. It does
not cover the ports of the [Are We Fast Yet](https://github.com/smarr/are-we-fast-yet)
benchmarks, or the test programs and cookbook snippets that reproduce parts of
them.

- The ports live in [`bench/awfy/`](bench/awfy/). The SOM-derived programs are
  under the MIT licence of the SOM benchmarks (Copyright (c) 2015-2016 Stefan
  Marr), and `mandelbrot.ts` under the Revised BSD licence of the Computer
  Language Benchmarks Game.
- [`bench/awfy/LICENSE.md`](bench/awfy/LICENSE.md) reproduces both notices
  verbatim, and its section "Copies outside this directory" lists every file
  elsewhere in the repository that is derived from a port, with the program it
  comes from. Each of those files starts with a header naming its licence.
  [`bench/awfy/AUTHORS.md`](bench/awfy/AUTHORS.md) lists the people behind SOM.

The npm package ships none of these files: `package.json`'s `files` names
neither `bench/`, `tests/`, `examples/` nor `docs/cookbook/`, and
`node tests/run.js awfy-licence` checks that it stays that way.
