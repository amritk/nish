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
build/vector/dist/vector --version      # vector 0.3.1
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

**What a spec declares.** With vector 0.3.1, the pin in `.vector-version`, a
`ts-property` block sets its sample count with `// samples: N` on its second
line (hex's ten properties set 96, as its hand-written contract did); an export
no clause tests is declared with an `Out of scope: <export>, <reason>`
paragraph, which extracts to `outOfScope`; and a vector run many times over is
declared with an `Iterate:` paragraph after its table. An iterated vector
marked `slow` is emitted skipped unless `spec emit` is given `--slow`, and the
committed tests are emitted without it: run one by hand with `spec run --slow`;
`node tests/run.js spec` prints a SKIP line for each clause a test skipped.
The syntax: vector's `docs/guide/guides/writing-a-spec.md`, in `build/vector/`.

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
