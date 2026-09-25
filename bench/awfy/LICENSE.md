# Licence of the Are We Fast Yet ports

The programs in this directory are Nish ports of the JavaScript versions of
the [Are We Fast Yet](https://github.com/smarr/are-we-fast-yet) benchmarks,
taken from the Nish port in `benchmarks/Nish/` of
[amritk/are-we-fast-yet](https://github.com/amritk/are-we-fast-yet) (commit
`b4d09d4`). They are not covered by this repository's own licence. That
repository's `LICENSE.md` notes that its benchmarks come from different
sources under different licences; the two that cover the programs here are
reproduced below, verbatim from the upstream sources.

- `bounce.ts`, `list.ts`, `permute.ts`, `queens.ts`, `som.ts`, `storage.ts`,
  `towers.ts` and `main.ts` (upstream `harness.ts`, from `harness.js`) are
  derived from the SOM benchmarks through the JavaScript versions, which carry
  the MIT licence below. The people behind SOM are listed in
  [AUTHORS.md](AUTHORS.md), copied verbatim from the upstream file, which is
  spelled `AUTORS.md` there.
- `mandelbrot.ts` is derived from the Computer Language Benchmarks Game
  program, adapted to match the SOM version, which carries the Revised BSD
  licence below.

## SOM benchmarks (JavaScript versions)

From the header of each of `benchmarks/JavaScript/{bounce,harness,list,permute,queens,som,storage,towers}.js`:

```
This code is derived from the SOM benchmarks, see AUTHORS.md file.

Copyright (c) 2015-2016 Stefan Marr <git@stefan-marr.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the 'Software'), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Mandelbrot (Computer Language Benchmarks Game)

From the header of `benchmarks/JavaScript/mandelbrot.js`:

```
This benchmark is adapted to match the SOM version.

Copyright © 2004-2013 Brent Fulgham

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice,
    this list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation
    and/or other materials provided with the distribution.

  * Neither the name of "The Computer Language Benchmarks Game" nor the name
    of "The Computer Language Shootout Benchmarks" nor the names of its
    contributors may be used to endorse or promote products derived from this
    software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The Computer Language Benchmarks Game
http://benchmarksgame.alioth.debian.org

 contributed by Karl von Laudermann
 modified by Jeremy Echols
 modified by Detlef Reichl
 modified by Joseph LaFata
 modified by Peter Zotov

http://benchmarksgame.alioth.debian.org/u64q/program.php?test=mandelbrot&lang=yarv&id=3
```

And the section of the upstream `LICENSE.md` that covers it:

```
$Id: LICENSE,v 1.1 2012-12-29 19:28:50 igouy-guest Exp $

Revised BSD license

This is a specific instance of the Open Source Initiative (OSI) BSD license template
http://www.opensource.org/licenses/bsd-license.php


Copyright 2008-2012 Isaac Gouy
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

   Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

   Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

   Neither the name of "The Computer Language Benchmarks Game" nor the name of "The Computer Language Shootout Benchmarks" nor the name "bencher" nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
