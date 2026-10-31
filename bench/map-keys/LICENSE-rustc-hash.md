# Licence of the Fx hasher

`fx.rs` is not covered by this repository's own licence where it reproduces
rustc-hash 1.1.0 (`src/lib.rs`): its `FxHasher`, the rotate by 5, the XOR, the
multiply by `0x517cc1b727220a95` and the `write`, `write_u32`, `write_u64`,
`write_isize` and `finish` methods built on them. The tables, keys, probe order
and timing around it are written here.

rustc-hash is offered under Apache-2.0 or MIT; this repository takes MIT.
Its `LICENSE-MIT` carries no copyright line; the copyright is the one in
`src/lib.rs`'s header, "Copyright 2015 The Rust Project Developers". The
licence, verbatim:

```
Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```
