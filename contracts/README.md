# Contracts

`contracts/<name>.json` is the contract vector extracts from the spec
`specs/<name>.xml`, which `scripts/build-spec.sh` builds from `specs/<name>.md`.
`test/spec/<name>.ts` is the Nish test vector emits from the contract. All
three are generated: change `specs/<name>.md` and regenerate, never edit them.
Which gates CI runs and which stay by hand: the spec-first paragraph of
[`.claude/orientation.md`](../.claude/orientation.md).

## Which modules need one

A `std/` module that implements an RFC lands spec-first, and
`node scripts/rfc-specs.mjs` (in `npm run lint`) holds the tree to it. It reads
a `std/**/*.ts` file as text, comments and identifiers included, and takes
`RFC` or `RFCs` and a number in either case as a citation: `RFC 7748`,
`RFC-7748`, `rfc822Name`, `rfc-editor.org/rfc/rfc9000`, a citation wrapped
onto the next comment line, each number of a list (`RFCs 8446 and 9001`,
`RFCs 7230, 7231, and 7232`, `RFC 5208/5958`) and of a range up to 64 wide
(`RFCs 7230-7235`). Each pair of file and RFC needs one of:

- a contract here whose `target.module` is that file's module and whose
  `sources` include the RFC, with its spec `specs/<name>.md` and a
  `test/spec/<name>.ts` whose one `// vector-contract-sha256:` line is the
  contract's SHA-256. A contract with no such test covers nothing and fails
  the check. The check reads only that pin: `node tests/run.js spec` builds
  and runs the test, and vector's `check` ties the contract to its spec.
  `contracts/rfc7748-x25519.json` covers `std/crypto/x25519.ts`'s citations
  of RFC 7748 and nothing else.
- a line `std/<file>.ts RFC<n>` in
  [`scripts/rfc-unspecified.txt`](../scripts/rfc-unspecified.txt), for a pair
  that predates the rule. These lines only shrink: `PRE_RULE_SHA256` in the
  script pins their set, so a line added, swapped or deleted by hand fails. A
  spec that covers one, or an edit that drops the citation, fails the check
  until `node scripts/rfc-specs.mjs --update-baseline` deletes the line and
  re-pins the set. That command runs only on the pinned set, refuses to add a
  line, and rewrites the file, dropping any comment but its header.
- a line `std/<file>.ts RFC<n> cites: <reason>` there, for an RFC the file
  names without implementing it (out of scope, a field named after it, or a
  pointer to another module's RFC). These may be added. The reason is what a
  reviewer weighs, and the check asks only that there is one.

The check covers whole RFCs, not sections. A spec that profiles one section
of RFC 8446 covers the module's every citation of RFC 8446. How much of the
RFC a spec profiles is the spec's to say and its review's to weigh: vector
holds every BCP 14 sentence in the spec to a test or a stated exclusion.

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
code span is a `command` source: `spec check --run-sources` runs it, with the
table's section for the args, and compares its stdout with the expected value,
which may be bytes, a string, an integer, a bool or `null`; otherwise it is
reported as not run, never as passed. A `u8[]` parameter followed by a
`/* window */` comment stands for a `(buf, off, len)` triple, and one followed
by `/* out CAP */` for an `(out, at)` buffer whose `end` is the result, declared
as bytes, where `CAP` is a capacity expression that may read `<param>.length`
of a `u8[]` parameter; only the Nish emitter expands either, and the others
refuse the function. In a property, `le16`, `le32`, `le64`, `be16`, `be32` and
`be64` write an integer as 2, 4 or 8 bytes; `leU16`, `leU32`, `leU64`, `beU16`,
`beU32`, `beU64`, `leI32`, `leI64`, `beI32` and `beI64` read exactly that many
bytes back (there is no 16-bit signed read). `Secret<u8[]>` is not a `forall`
type: a property passes `u8[]` to a `Secret<u8[]>` parameter, and the test wraps
it in `secret()` and exposes a `Secret` result. A section that prints several
cases under headings such as RFC 6979's `With SHA-256, message = "sample":`
places each value by its heading, and a label that wraps across lines is read
as one line. The
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
