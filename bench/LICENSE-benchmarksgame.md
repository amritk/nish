# Licence of the Computer Language Benchmarks Game programs

The n-body and spectral-norm programs in this directory, and `examples/nbody.ts`,
are adapted from programs of the
[Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/benchmarksgame/).
They are not covered by this repository's own licence. Each file starts with a
header naming the program it comes from and its contributors, and
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) lists them:

- `bench/nbody.{ts,c,go,rs}` and `examples/nbody.ts`: n-body, Node.js #6,
  contributed by Isaac Gouy, modified by Andrey Filatkin.
- `bench/spectral.{ts,c,go,rs}`: spectral-norm, Node.js #1, contributed by Ian
  Osgood, modified by Isaac Gouy.

The C, Go and Rust files are twins of the Nish programs, with the same
constants and the same expression order, so they carry the same notice.

The licence below is reproduced verbatim from
<https://benchmarksgame-team.pages.debian.net/benchmarksgame/license.html>.
The Are We Fast Yet port of the Mandelbrot program carries an earlier version
of it, reproduced in [`awfy/LICENSE.md`](awfy/LICENSE.md).

```
Revised BSD license

This is a specific instance of the Open Source Initiative (OSI) BSD license template.

Copyright © 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

    Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

    Neither the name "The Computer Language Benchmarks Game" nor the name "The Benchmarks Game" nor the name "The Computer Language Shootout Benchmarks" nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
