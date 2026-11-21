# WP72 S5: `nish proto`, message classes from a `.proto` file

**Status: done.** Stage S5 of [WP72](wp72-grpc.md): a generator that
reads a proto3 file and writes one Nish module of message classes, each
encoding onto S1's `ProtoWriter` and decoding from its `ProtoReader`
(`nish/net/protobuf`, [the security record](security/protobuf.md)).

```sh
nish proto bench.proto -o bench.ts           # write the module
nish proto bench.proto -o bench.ts --check   # exit 1 if bench.ts is stale
```

## 1. Why a generator, and why this one

A gRPC handler written by hand against `ProtoReader` is a loop of `next()`,
a `switch` on the field number and a typed read per field: correct, but the
same lines for every message, and a field number typed twice is a silent bug.
`protoc` plugins for TypeScript write classes Nish cannot compile (getters,
`Uint8Array`, `bigint`, `Long`, generics, runtime reflection), so the classes
come from the compiler itself, the way `nish c-import` writes a module from a
C header (`src/c-import.ts`).

The generator is in `src/` because the CLI is: `src/proto-lex.ts` (tokens),
`src/proto-parse.ts` (the model, and every refusal), `src/proto-emit.ts` (the
module's text) and `src/proto-cli.ts` (arguments, `-o`, `--check`, exit codes),
all in Nish-0, dispatched from `src/compile.ts` beside `c-import`.

## 2. The subset and its Nish types

| proto3 | Nish |
| --- | --- |
| `int32`, `sint32`, `sfixed32` | `i32` |
| `uint32`, `fixed32` | `u32` |
| `int64`, `sint64`, `sfixed64` | `i64` |
| `uint64`, `fixed64` | `u64` |
| `float` / `double` | `f32` / `f64` |
| `bool` / `string` / `bytes` | `boolean` / `string` / `u8[]` |
| `enum` | an `i32` constant per value, `<Enum>_<VALUE>`; the field is `i32`, so an unknown value read is kept as its number |
| a message field | `C \| null` |
| `repeated T` | `T[]`; scalars written packed, read packed or unpacked |
| `optional` scalar | the field plus a `has_<field>: boolean` presence flag (an `optional` message has none: it is present when not `null`) |
| `map<K, V>`, `K` an integer type, `bool` or `string` | `Map<K, V>`, the key in its own Nish type |
| `oneof` | each member an ordinary field, plus `<oneof>_case: i32`, the set member's number or 0 |
| `service` | each method's path as a string constant, `/<package>.<Service>/<Method>` |

An enum field is held as `i32`, not as the enum type, because proto3 enums are
open: a reader must keep a value no member names (`17` stays `17`). Its
values are emitted as `i32` constants named after the enum, so code compares
the field with `Color_RED`; a Nish `enum` would close the set of values.

A field's default is proto3's: 0, `false`, `""`, an empty array or map, and
`null` for a message. A singular scalar equal to its default is not written,
as proto3 requires for implicit presence; an `optional` one is written when
its `has` flag is set, whatever its value; a message field is written when it
is not `null`, even when empty.

Decoding follows the proto3 merge rules the reference implementation uses:
the last value of a repeated singular scalar wins, a repeated message field
merges into the one already read, a `repeated` field appends, a map entry
replaces the entry with the same key, and a oneof member clears the oneof's
other members. An unknown field is skipped and not kept. A field read with a
wire type its declaration does not have is skipped too, as the reference
implementation treats it as unknown.

## 3. What is refused

Every construct outside the subset is refused by its name and its line, and
nothing is written: the output file, if there is one, is left as it was.

```text
proto: bench.proto:3: refused: proto2 syntax (only proto3 is supported)
```

| Construct | Why |
| --- | --- |
| `syntax = "proto2"`, `edition`, a missing `syntax` | proto2 and editions have field presence and defaults proto3 does not |
| `import`, `import public`, `import weak` | one file in, one module out; a second file is a second run |
| `group` | proto2 only, and a wire type S1 skips |
| `extend`, `extensions` | proto2 only |
| `reserved` a field also declares (number or name) | the file contradicts itself |
| a field number outside 1 to 2²⁹−1, or in 19000–19999 | the encoding forbids it |
| two fields, or two oneof members, with one number | the wire cannot tell them apart |
| two declarations with one name in one scope | the module would not compile |
| nesting deeper than 32 messages | bounds the parser's recursion; S1's reader allows 100 levels of data, not of declarations |
| an option other than `package`, `java_*`, `go_*`, `csharp_namespace`, `objc_class_prefix`, `php_*`, `ruby_package`, `swift_prefix`, `optimize_for` file options | an option changes what the code means; the file options listed are ignored and named in the header |
| a field option (`[packed = false]`, `[deprecated = true]`, `[json_name = ...]`) | `packed = false` changes the encoding; the rest are refused rather than silently dropped |
| `google.protobuf.*` types | well-known types need an import |
| a type name the file does not declare | the same |
| `stream` methods | only unary methods are supported |
| a map key of `float`, `double`, `bytes`, an enum or a message, or a map value that is a map | the language forbids them |
| `repeated` or `map` inside a `oneof`, an `optional` inside a `oneof` | the language forbids them |
| a message, enum, service or field whose Nish name would clash with a keyword or another emitted name | the module would not compile |

Ignored and listed in the header: the file options above, and `package`,
which only sets the method paths.

## 4. The module

```ts
// Generated by nish proto from bench.proto (sha256 4f2c...). Do not edit; regenerate it.
// Regenerate: nish proto bench.proto -o bench.ts
// Ignored options: go_package

import { PROTO_OK, PROTO_WIRE_VARINT, ProtoReader, ProtoWriter } from "nish/net/protobuf"

export const BENCHMARK_SERVICE_GET_SUM: string = "/benchmark.BenchmarkService/GetSum"

export class SumRequest {
  a: i32 = 0
  b: i32 = 0

  encode(w: ProtoWriter): void { ... }

  decode(r: ProtoReader): boolean { ... }
}
```

- One class per message, in declaration order, a nested one after its parent
  and named `Outer_Inner`; one `i32` constant per enum value, named
  `<Enum>_<VALUE>` with the enum named the same way. Fields keep the file's
  order, which can leave padding the compiler's layout warning names; the
  warning is about speed only.
- Each class has a no-argument constructor (field initialisers only),
  `encode(w: ProtoWriter): void` and `decode(r: ProtoReader): boolean`.
  `decode` reads the fields of the reader's current span until `next()` is
  false, and returns false on a reader fault, the fault left in `r.failed`. A
  nested message is decoded between `r.enter()` and `r.leave()`, so S1's
  depth bound is the generated code's: 100 levels below the top are read, the
  101st is refused.
- The import names only the constants the module uses: `PROTO_OK` and the
  wire types its fields read.
- A `string` or `bytes` field is copied out of the reader's span byte by byte,
  each index tested against the buffer, so a generated module builds under the
  default panic rule.
- `encode` does not test `w.failed`: once S1's writer has failed, every
  later call on it is a no-op, so a failed write is seen in `w.failed` after
  `encode` returns.
- A service method's constant is named `<SERVICE>_<METHOD>` in upper snake
  case.
- The header names the generator, the source file's base name and the SHA-256
  of its bytes, and the command that regenerates it, and a third line lists
  any file options it ignored. Output is
  byte-deterministic: no time, no path but the two the command line gave (an
  absolute one only when it gave one), no map iteration order that is not
  declaration order.

## 5. The command

`nish proto <file.proto> -o <out.ts> [--check]`

| Exit | When |
| --- | --- |
| 0 | the module was written, or `--check` found it current |
| 1 | the file was refused, or `--check` found the output missing or different |
| 2 | usage: no input, no `-o`, an unknown flag, `-o` naming the input, an unreadable input, a path holding a quote, a backslash, a comment delimiter or a byte that is not printable ASCII |

`--check` writes nothing; it compares the module it would write with the file
byte for byte and prints `proto: <out> is stale; regenerate it` on a
difference. A test or a CI job runs it on a checked-in module, the way
`node examples/break-web/build.mjs --check` pins break-web.

## 6. Bounds

The parser is recursive in message nesting only, and refuses a 33rd level
before it recurses. Its other loops each consume a token. The generated
decoders inherit S1's bounds and add these:

| Growth | Bound |
| --- | --- |
| a repeated field | one element per element read, and each read consumes at least one byte of the span, so at most the input's length |
| a map | one entry per entry read, by the same argument; a repeated key replaces |
| nesting | S1's `PROTO_MAX_DEPTH` (100), checked by `enter()` |

Each bound is pinned by a test in `tests/link/net_proto_classes` and recorded
in [the security record](security/protobuf.md#generated-decoders).

## 7. Tests

- `tests/proto/`: one `.proto` per feature with its `.ts` golden, and one
  negative per refusal with its expected message, run by
  `tests/proto/goldens.js`.
- `tests/link/net_proto_classes/`: compiles a generated module, encodes and
  decodes every message against vectors the reference implementation
  (Python `google.protobuf`) made, byte for byte, with the command in the
  vectors file's header.
- `node tests/run.js proto` runs both, checks the checked-in module with
  `--check`, and the usage refusals.
