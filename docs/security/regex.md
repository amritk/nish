# Security record: `nish/regex` — parsing, compiling and matching regular expressions

The record of `nish/regex` (#858): the parser of JavaScript's `u`-flag syntax,
the compiler to a Pike VM program and its reverse, the lazy DFA, the
prefilters, and the byte-window scan `nish_regex_scan` that starts a search.
It says what the module refuses and with what, what it caps and where the cap
is set, what it allocates, and the test that pins each property. It is written
with the code, against `main` at `804120e`, and cites functions rather than
lines.

**Result.** One search (`test`, `exec`, `find`) is linear in the subject
whatever the pattern, the DFA's memory is bounded, and the C kernel reads
nothing outside its buffers. No pattern or subject panicked under fuzzing.
Iterating every match (`findAll`, `count`, `replaceAll`, `split`) is
quadratic in the subject when a preferred alternative reads far ahead before
a short one wins (REGEX-4, accepted, and now documented where linear time was
promised). For a pattern the attacker writes, the audit found compile time
unbounded for nested exact repeats of an empty body (REGEX-1), parse time
quadratic in a class's ranges (REGEX-2) and in named groups (REGEX-3), and
compile memory of about 424 MiB for a 10 KB pattern (REGEX-5); each is fixed
with a cap or a cut, and a row of `tests/link/std_regex` pins it. Five
findings are fixed (one Medium, four Low) and one is accepted (Medium).

## Scope

| File | Functions |
| --- | --- |
| `std/regex.ts` | `RegexParser` (`parseAlt`, `parseGroup`, `parseBraces`, `parseClass`, `parseClassAtom`, `addRange`, `finishClass`, `fail`); the compiler (`emit`, `compileNode`, `compileIteration`, `compileEmptyCheckedRepeat`, `compileMarked`); `regexSortPoints`, `regexScanFrom`; `Regex` (`build`, `findPrefilters`, `findInner`, `findScan`, `scanTo`, `dSkipTo`, `ctxBefore`, `ctxAt`, `dfaForward`, `dfaReverse`, `dfaInner`, `run`, `vm`, `test`, `exec`, `find`, `findAll`, `count`, `replace`, `replaceAll`, `replaceMatches`, `slotText`, `expand`, `split`); `regexCompile`, `regexEscape` |
| `runtime/runtime-simd.c` | `nish_regex_scan`, `nish_scan_pick` (scalar, AVX2, NEON and WASM SIMD paths) |
| `runtime/nish.h` | the `nish_regex_scan` contract |
| `src/kernels.ts` | the lowering of `regexScanFrom` to `nish_regex_scan` |

Out of scope: lookaround and backreferences, which are refused at compile
time; Unicode case folding, since the `i` flag folds ASCII only; and the
callers' use of matches.

## Threat model

The attacker writes the subject: every byte, in any length, including invalid
UTF-8. In a separate case the attacker also writes the pattern, for a program
that compiles user-supplied patterns, and the flags.

A win is any of:

- time superlinear in the subject;
- a compile whose time or memory the pattern's length does not bound;
- memory without a bound the program set;
- a panic;
- a read outside the subject or the mask array in `nish_regex_scan`.

The program calling the module is trusted. Its choice of pattern, in the
first case, is its own.

## Findings

| Id | Severity | Where | Finding | Disposition |
| --- | --- | --- | --- | --- |
| REGEX-1 | Medium | `compileNode` (repeat case), `compileEmptyCheckedRepeat`, `emit` | An exact repeat of a body that emits no instruction (`(?:)`, `a{0}`) still compiles the body `min` times. The instruction cap is only checked in `emit`, so nesting them is 1000^L work for a 10·L-byte pattern: 7.4 s at L = 3, beyond 30 s at L = 4. | Fixed: both `min` loops stop once an iteration emitted nothing, since every later copy emits nothing too. Tests: the rows "an empty body repeated 1000^4 times compiles" and "a{0} repeated 1000^3 times compiles" (the first did not finish in 30 s before) |
| REGEX-2 | Low | `parseClass`, `finishClass` | A class's non-ASCII ranges are insertion-sorted, Θ(r²) for a descending list, and nothing caps r: 2.5 s for an 80,000-range, 720 KB class. | Fixed: a class of more than `REGEX_MAX_CLASS_RANGES` (10,000) ranges is refused, "a class has more than 10000 ranges". Tests: the rows "a class of 10001 ranges" and "a class of 10000 ranges compiles" |
| REGEX-3 | Low | `parseGroup`, `build` | The duplicate-name check scans every earlier name, and the group count is only refused in `build`, after parsing: 1.25 s for 40,000 named groups. | Fixed: `parseGroup` refuses a capturing group past `REGEX_MAX_GROUPS` (1,024), "too many groups", so the name scan is at most 1,024² comparisons. Tests: the rows "1025 groups" and "500 groups compile" |
| REGEX-4 | Medium | `findAll`, `count`, `replaceMatches`, `split` | Leftmost-first iteration runs one search per match. When a preferred branch reads to the end before a short branch wins (`.*X\|a`, `<[^>]*>\|<`), the iteration is O(n²) in the subject: 1.5 s at 40,000 bytes, 9.2 s at 100,000. One search stays linear. The module header, the guide and `std/README.md` promised linear time "whatever the pattern". | Accepted: inherent to leftmost-first iteration, the same bound RE2 and Rust's `regex` document. The module header, `std/README.md` and the guide's regular-expressions section now say one search is linear and iterating can be quadratic, and how to bound the long branch. |
| REGEX-5 | Low | `build`, `compileIteration` | Groups under `{0}` emit nothing, yet every enclosing iteration's CLEAR clears their slots. `build` sizes the VM stack at one frame per cleared slot times 2^levels: 424 MiB for a 10 KB pattern, held for the `Regex`'s life. It is bounded (about 8 × 4194304 frames) but far above the documented 1 MiB. | Fixed: `build` refuses a pattern whose stack frames would pass `REGEX_MAX_SLOT_TABLE`, "too many groups for the pattern's size", before it allocates them. Never-set groups still go into CLEAR; the cap is what bounds the memory. Test: the row "a backtrack stack past the slot table" |
| REGEX-6 | Low | `src/kernels.ts` (the `regexScanFrom` comment) | The comment states a mask array of 32 bytes per position. The contract in `runtime/nish.h`, and the kernel, need 288 bytes per position. No caller is affected. | Fixed: the comment states 288 bytes a position |

## Properties verified

**One search is linear in the subject, whatever the pattern.**

- The DFA and the Pike VM follow every alternative at once.
- `(a+)+$`, `(a|a)*c` and `(\b\w+\b\s*)+$` on 4 MB run in about 15 ms.
- When the DFA gives up (`[ab]*a[ab]{20}` on random text), the VM fallback is linear: 634 ms at 1.6 MB, with memory flat.
- `dfaInner` abandons an inner literal whose waste passes twice its gain plus `DFA_INNER_SLACK`, so the inner-literal search stays linear.
- Pinned by: the suite's linear-time rows in `tests/link/std_regex`. They are bounded only by the test's timeout, and none covers the VM fallback.

**The DFA's memory is bounded.** It holds at most 2,048 states and 262,144 transitions, and its pool is at most max(2 × total, 16,384). On a flush or a give-up it falls back to the VM. Pinned by: none. What would: a row counting matches of a state-explosive pattern over 1 MB.

**Pattern errors are refused, not panicked on.**

- A repeat count over 1000 is refused, as are nesting deeper than 250 and more than 100,000 instructions.
- Malformed syntax gets a refusal naming its byte: an unclosed class or group, a lone quantifier, a bad escape, a bad range, a bad or duplicate name.
- More than 1,024 groups and a class of more than 10,000 ranges are refused, and so is a backtrack stack past the slot table ("too many groups for the pattern's size", in `build`).
- A repeat whose body compiles to nothing ends its loop rather than repeating it (REGEX-2).
- Fuzzing found no panic and no disagreement between `test`, `exec`, `count` and `findAll`:
  - 2,000 + 8 × 40,000 token patterns with every flag combination;
  - 4 × 100,000 raw-byte patterns including 0x80, 0xE2 and 0xFF;
  - subjects with invalid UTF-8, U+2028 and truncated sequences;
  - `exec` from every offset;
  - malformed replacement templates.
- Pinned by: the error rows in `tests/link/std_regex` (for example `regex: a repeat count is over 1000 at byte 1`), and the compile-bound rows: "a class of 10001 ranges", "1025 groups", "a backtrack stack past the slot table" and "an empty body repeated 1000^4 times compiles". The 250-depth and instruction caps have no row. No fuzz target is in tree.

**Iteration terminates.** After an empty match, `findAll`, `count`, `replaceAll` and `split` step one character (`regexWidthAt`), which is at least one byte. Pinned by: the suite's empty-match rows.

**Templates are bounded.** `expand` reads `$<` without `>` and `$NN` past the group count literally, and `slotText` bounds its index. Pinned by: the suite's replacement rows.

**`nish_regex_scan` reads only inside the subject and the masks.**

- Each path loads only behind a guard:
  - the scalar loop, behind `i + d ≤ n`;
  - the AVX2 loop, behind `i + 31 + o + w ≤ n`, with width 4 run by the width-3 copy;
  - the NEON and WASM loops, behind `i + 15 + o + w ≤ n`.
- `nish_scan_pick` refuses `c + d > n`.
- Table reads stay under 288 × depth bytes.
- An empty subject loads nothing.
- `findScan` and `scanTo` keep the contract: depth 1..8, width at most 3, offset + width ≤ depth, `from` ≤ length.
- Pinned by: the `simd` regex-scan checks, which compare each vector path with the scalar one. None places a match against an unmapped page.

## Tests

- `link/${name}: exits with ${wantCode} and stdout matches expected.out` — `tests/link/std_regex` (JavaScript-generated rows, error rows, the compile-bound rows, prefilter rows, the linear-time rows) and `tests/link/std_regex_f64` (the same suite under `--number-mode f64`)
- `simd: ${label}: ${said}`, where `said` is the agreement driver's report line (its `regex-scan: ` prefix removed), with `label` one of:
  - `regex-scan native ${process.arch}`
  - `regex-scan wasm32-wasi, the scalar base path`
  - `regex-scan wasm32-wasi -msimd128`
  - `regex-scan aarch64 through binfmt, the NEON path`

  The driver is `tests/simd/regex-scan.c`.
- `simd: ${label} names ${paths} as the paths it ran` — the cross-compiled labels
