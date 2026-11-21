# Contracts

`contracts/<name>.json` is the contract vector extracts from the spec
`specs/<name>.xml`, which `scripts/build-spec.sh` builds from `specs/<name>.md`.
`test/spec/<name>.ts` is the Nish test vector emits from the contract. All
three are generated: change `specs/<name>.md` and regenerate, never edit them.
Which gates CI runs and which stay by hand: the spec-first paragraph of
[`.claude/orientation.md`](../.claude/orientation.md).

## The tools

```bash
bash scripts/fetch-vector.sh            # the vector .vector-version pins, in build/vector/
build/vector/dist/vector --version      # the version .vector-version pins
```

`scripts/build-spec.sh` also needs kramdown-rfc and xml2rfc, at the versions
pinned in its `KRAMDOWN_RFC_VERSION` and `XML2RFC_VERSION`; it prints the install
commands when either is missing or at another version.

## Regenerate

```bash
bash scripts/build-spec.sh specs/hex.md                              # specs/hex.xml
build/vector/dist/vector spec extract specs/hex.xml -o contracts/hex.json
build/vector/dist/vector spec check contracts/hex.json --run-sources
build/vector/dist/vector spec emit contracts/hex.json -o test/spec/hex.ts
node tests/run.js spec
```

`--run-sources` runs each test vector's `Source` command and compares its
output with the vector's expected value; add `--nish-root .` once the module is
in `std/`, so the contract's signatures are checked against it.

Each contract's `$schema` is `../build/vector/schemas/rfc-contract.json`, which
exists only once `scripts/fetch-vector.sh` has run, so `spec extract --check`
and `spec check` need vector in `build/vector/`. CI's `node tests/run.js spec`
does not read the schema.

**What a spec declares.** With the vector `.vector-version` pins, a
`ts-property` block sets its sample count with `// samples: N` on its second
line (hex's ten properties set 96, as its hand-written contract did); an export
no clause tests is declared with an `Out of scope: <export>, <reason>`
paragraph, which extracts to `outOfScope`; and a vector run many times over is
declared with an `Iterate:` paragraph after its table. A row whose section
prints several numbered test cases under the same labels, as RFC 8439's A.3
does, cites one of them with the Source cell `{{Section A.3 of RFC8439}}, Test
Vector #N`: its values must all be printed in that one case (A.1, A.2 and A.4
are cited the same way). A label is written as the section prints it,
apostrophe, alias and parentheses included (`Alice's public key, X25519(a, 9)
= 8520…`, RFC 7748 §6.1). A row whose section prints only the start of a
result carries a `Truncate: <id> to <N> bits` paragraph after the table (RFC
4231's test case 5). A `u32[]` argument or result is a word array
(`[0x11111111 0x01020304]`, RFC 8439's quarter round). A row whose result the
section does not print cites it apart, `{{Section 7.1 of RFC8032}}; result
{{Section 5.1.7 of RFC8032}}`, and is accepted when a property derives it
(Ed25519's `ed25519Verify` rows, from P-ROUNDTRIP). An iterated vector
marked `slow` is emitted skipped unless `spec emit` is given `--slow`, and the
committed tests are emitted without it: run one by hand with `spec run --slow`;
`node tests/run.js spec` prints a SKIP line for each clause a test skipped, and
fails a test that passed no clause. A vector whose `Source` cell is a single
code span runs that command, and its expected value may be bytes, a string, an
integer, a bool or `null`. A `u8[]` parameter followed by a `/* window */`
comment stands for a `(buf, off, len)` triple, and one followed by `/* out CAP */`
for an `(out, at)` buffer whose `end` is the result, declared as bytes;
the Nish test guards both with extra bytes. Integers are written and read as
bytes of every width and both byte orders (`le16` to `be64`, `leU16` to `beI64`),
which is what replaced `le64` with `intBytes` in `test/spec/hex.ts` and
`test/spec/rfc8439-chacha20-poly1305.ts`. A section that prints several cases under
headings such as RFC 6979's `With SHA-256, message = "sample":` pairs each value
by its heading, and a statement that wraps across lines is read as one. The
syntax: vector's `docs/guide/guides/writing-a-spec.md`, in `build/vector/`.

A spec that cites a reference not yet in `.refcache/` fails to build: run
`bash scripts/build-spec.sh --fetch specs/<name>.md` once and commit the new
cache entries. An RFC a contract pins as a source is kept byte-identical in
`rfcs/` (notice: `THIRD_PARTY_NOTICES.md`, "IETF RFCs").

## Check without regenerating

```bash
bash scripts/build-spec.sh --check specs/hex.md
build/vector/dist/vector spec extract --check specs/hex.xml -o contracts/hex.json
build/vector/dist/vector spec stale test/spec/hex.ts contracts/hex.json
```
