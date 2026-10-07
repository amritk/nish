# `std/json` against the JSON readers people use

`std/json` has one function, `jsonField(object, name)`: the value of one field
of one flat JSON object, found by scanning the text, with nothing built. This
benchmark puts it beside the libraries a program in another language would
reach for to do the same job, and checks that every one of them gets the same
answer.

```bash
npm run build
YYJSON_DIR=<dir with yyjson.c and yyjson.h> node bench/json/run.mjs
node bench/json/run.mjs --only nish,simdjson,gjson --runs 15 --warmup 2
node bench/json/run.mjs --validate          # checksums only
node bench/json/run.mjs --lines 200000      # a bigger input (written once, then reused)
node bench/json/run.mjs --out docs/BENCHMARKS-json.md
```

## The task

`gen.mjs` writes a JSON Lines file with a fixed seed: one object per line,
shaped like the compiler's own `--json` diagnostics (the surface `std/json`
was written to read), about 440 bytes each. Every reader takes three fields from
every line:

- `code`, a short string near the front;
- `line`, a number;
- `message`, the **last** field, after a nested `range` object and a `related`
  array whose strings hold `{`, `}`, `[` and `]`, so a reader has to step over
  them properly. About one token in ten in a message is an escape (`\"`, `\n`,
  `\t`, `\\`, `\/`, `é`, `→`), and each reader must decode it.

The checksum adds the UTF-8 byte length of each string and the value of each
number, masked to 30 bits after every line. Every program prints it, followed by
the nanoseconds its extraction loop took. The driver refuses a column whose
checksum differs from the others.

**Only the loop is timed.** Reading the file and cutting it into lines happen
before the clock starts, in every program, so start-up, I/O and line splitting
are left out. That is generous to Node, whose JIT warms up in the loop's first
lines and whose process start is the slowest here. Peak RSS is the exception:
it is the whole process, input buffer included.

## The columns

| Column | File | What it does per line |
| --- | --- | --- |
| `nish` | `json.ts` | `jsonField` three times: three scans from the start; every key it passes is cut out as a new arena string to compare, and so is the value (unescaped) |
| `simdjson` | `json-simdjson.cpp` | On-Demand: a SIMD structural index of the line, then `object["name"]` walks to each field. The closest to `std/json` in kind, and the bar |
| `yyjson` | `json-yyjson.c` | `yyjson_read` into an immutable tree, then `yyjson_obj_get` ×3 |
| `serde-typed` | `rust/` | `#[derive(Deserialize)]` into a three-field struct with `Cow<str>` fields: unknown fields skipped, strings without an escape borrowed |
| `serde-value` | `rust/` | `serde_json::Value`, a full tree, then three index lookups |
| `gjson` | `go/` | `gjson.Get` ×3: Go's field reader, the same design as `std/json` |
| `cjson` | `json-cjson.c` | `cJSON_ParseWithLength` into a malloc'd tree, three lookups, `cJSON_Delete` |
| `node` | `json-node.mjs` | `JSON.parse` (V8), three property reads, `Buffer.byteLength` for the byte counts |
| `go-std` | `go/` | `encoding/json` `Unmarshal` into a three-field struct |
| `nlohmann` | `json-nlohmann.cpp` | `nlohmann::json::parse`, three `operator[]` lookups |

Flags: C and C++ at `clang -O3` (`-std=c++17`), with no `-march=native`
because `nish --profile speed` does not use it either (simdjson picks its SIMD
kernel at run time anyway). Rust at `opt-level=3`, `codegen-units=1` and
`panic=abort`, the same as the main suite. Go through `go build -trimpath`.
Nish at `--profile speed`.

## Getting the libraries

Nothing is vendored. A column whose library is missing is skipped with a note,
and never fails the run.

- **cJSON, simdjson, nlohmann/json**: system packages. On Debian or Ubuntu that
  is `apt-get install libcjson-dev libsimdjson-dev nlohmann-json3-dev`.
- **yyjson**: two files, `yyjson.c` and `yyjson.h`, from a release
  (`github.com/ibireme/yyjson`; the PyPI `yyjson` sdist carries the same pair
  under `yyjson/`). Point `YYJSON_DIR` at the directory that holds them.
- **serde_json**: `cargo` fetches it on the first build. `rust/Cargo.lock`
  pins the version.
- **gjson**: `go` fetches it on the first build. `go/go.sum` pins the version.
