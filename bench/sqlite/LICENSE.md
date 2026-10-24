# Licence of the challenge schema

The files here that come from the
[twelve-dollar server challenge](https://github.com/arjaythedev/twelve-dollar-server-challenge)
are not covered by this repository's own licence, and each carries the
challenge's copyright notice:

- `schema.sql` is the challenge's `schema.sql`, copied unchanged below a
  header naming where it comes from.
- `twin.c`'s seed is a port of the challenge's `seed/generate.mjs`: its
  mulberry32 generator and seed 42; its table sizes (50,000 users, 500,000
  posts, 2,000,000 likes); its users (`adjective_noun_id` names, created over
  the year before 2025) and posts (spread evenly over 2025 in id order,
  authors skewed towards the first users by `rnd() * rnd()`); its bodies of
  one to three sentences of four to fourteen words, at most 500 bytes; and its
  `ADJECTIVES` and `NOUNS` lists verbatim. Its `WORDS` list is part of the
  challenge's, with `sqlite` added; it draws no openers, and its likes are
  uniformly random rather than the challenge's per-post counts. The draws
  differ, so its rows are not the challenge's rows. The workloads are written
  here.
- `main.ts` uses the same table sizes.

`run.mjs` and `README.md` copy nothing; they only name the sizes.

The licence below is reproduced verbatim from the challenge's `LICENSE`.

```text
MIT License

Copyright (c) 2026 arjaythedev and the challenge contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
