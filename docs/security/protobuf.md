# Security record: `nish/net/protobuf` — protobuf's wire format

The record of `nish/net/protobuf` (#2009), the schema-less reader and writer
of protobuf's wire format that gRPC's messages are carried in. The reader
walks the fields of a message held in a `u8[]` span. The writer appends fields
to a caller's buffer. What a field number means is the caller's schema; this
module knows only tags, wire types and the value encodings on top of them.

It says what the reader refuses and with which code, what it caps and where,
and the test that pins each property. It is written with the code, against
`main` at `56ce425`, and cites functions rather than lines.

**Result.** No byte sequence a peer sends makes the reader panic, loop, read
outside its span or allocate. A varint whose tenth byte still continues, a
value or tag that runs off the span, a length past the span, field number 0
or a field number past 2^29 − 1, the group wire types, the undefined wire
types 6 and 7, nesting past `PROTO_MAX_DEPTH` (100) and a typed read of the
wrong wire type are each a negative `PROTO_ERR_*` code. The code is sticky
until `reset`. Each byte of the span is passed once, so the work is linear in
the message's length. Nothing in the module panics, not even the program's
own mistakes: a reader window or a `bytes` source window outside its array,
and a message past `PROTO_MAX_SIZE` bytes, are `PROTO_ERR_WINDOW`. No finding
is counted; five properties are recorded as accepted (PB-1 to PB-5).

## Scope

| File | Functions |
| --- | --- |
| `std/net/protobuf.ts` | `ProtoReader` (`reset`, `next`, `uint64`, `int64`, `uint32`, `int32`, `bool`, `sint64`, `sint32`, `fixed32`, `sfixed32`, `float`, `fixed64`, `sfixed64`, `double`, `len`, `enter`, `enterPacked`, `more`, `leave`, and the internal `fail`, `varint`, `length`, `fixed`, `pass`, `skip`, `take`); `ProtoWriter` (`reset`, `uint64`, `int64`, `uint32`, `int32`, `bool`, `sint64`, `sint32`, `fixed32`, `sfixed32`, `float`, `fixed64`, `sfixed64`, `double`, `bytes`, `string`, `beginMessage`, `endMessage`, `packedVarint`, `packedFixed32`, `packedFixed64`, and the internal `put`, `poke`, `putVarint`, `putFixed`, `tag`, `packed`); the helpers `varintSize`, `f32OfBits` |

Out of scope: the transport that delivers a message's bytes (HTTP/2 and
gRPC's length-prefixed framing have their own records). Also out of scope are
a schema's meaning, which is the caller's, and the UTF-8 validity of a
`string` field, which the reader hands over as a span of bytes (PB-4).

## Threat model

The reader's input is a message a peer wrote: every byte, every tag, length
and nesting level is chosen by the attacker. The caller trusts its own buffer
and the window `[from, to)` it gives `reset`. The attacker wins if those bytes
make the reader:

- read or write outside its window;
- panic, loop, or recurse without bound;
- allocate in proportion to the input;
- hand the caller a value of the wrong wire type, or a span that does not lie
  inside the window, without setting `failed`.

The writer's input is the program's own values, so its misuse is a bug, not
an attack. It is checked only so that a bug cannot write a message the reader
would refuse or corrupt the buffer. The one value a peer can steer into the
writer is a `bytes` or `string` payload the program copies from a message it
read, and its size is bounded by that message.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| PB-1 | None (a property) | `ProtoReader.varint` | A varint's bits past the 64th, the tenth byte's top six bits, are dropped. An over-long varint, such as `0x80 0x00` for 0, is read as its value. So two byte strings can decode to one value. | **Accepted, not counted.** The span bound holds either way: a varint is at most ten bytes, and the tenth byte must end it (`PROTO_ERR_VARINT` otherwise). A caller that compares messages compares decoded values, never bytes. Pinned by "an over-long varint for 0 reads as 0", "a tenth byte of 0x7e reads as 0" and "a tenth byte of 0x7f reads as 2^63"; the eleven-byte refusal by "a varint of eleven bytes" and `net_protobuf_bad_varint`. |
| PB-2 | None (a property) | `ProtoReader.next`, `ProtoReader.length` | A length is checked against the span when its field is read or skipped, not when its tag is read. `next` answers `true` for the field whose length is past the span, and the read or the following `next` refuses it. | **Accepted, not counted.** The caller sees a field number only, never a byte outside the span. `len`, `enter` and the skip all check the length before they move. Pinned by "the bad one after it is refused when passed over" and `net_protobuf_bad_length`. |
| PB-3 | Low | `ProtoWriter` | `end` and the field lengths are `i32`, so the writer refuses to grow a message past `PROTO_MAX_SIZE` (2^31 − 2) bytes with `PROTO_ERR_WINDOW`. `endMessage` moves an embedded message's contents right once per enclosing `endMessage` when its length needs more than one byte. Writing a message nested d deep therefore copies up to d times its size. | **Accepted, not counted.** gRPC's framing caps a message at 2^32 − 1 bytes, and a program that writes one of 2^31 − 1 bytes or more needs another writer. The copy cost is bounded by `PROTO_MAX_DEPTH` and is the program's own nesting, not a peer's. No test reaches `PROTO_MAX_SIZE`. "a nested message of 20000 bytes" pins the move. |
| PB-4 | None (a property) | `ProtoReader.len` | A `string` field is a length-delimited span like `bytes`: the reader does not check that it is UTF-8. | **Accepted, not counted; documented.** proto3 requires valid UTF-8 in a `string`, but the check belongs to the code that turns the span into a string with a schema in hand. `len`'s doc comment says the bytes are not checked to be UTF-8. |
| PB-5 | None (a property) | `ProtoReader.float`, `f32OfBits` | `float` builds its `f32` through an `f64`, and the narrowing sets a signaling NaN's quiet bit: the bits 0x7f800001 come back as 0x7fc00001, without a fault. | **Accepted, not counted; documented.** The language has no conversion from bits to an `f32` that keeps a signaling NaN. `float`'s doc comment says so and that `fixed32` reads the exact bits. Pinned by "a float of bits 0x7f800001 reads as 0x7fc00001". |

Two bugs were found while the module was written, before it reached `main`,
and are not counted. `bytes` bounded its copy loop with `q - from < count`, a
subtraction the compiler could not prove fits, so a program held to no panic
could not call it; the bound is now a widened sum, and the guide's relay
example calls `bytes` under the no-panic check. And `skip` advanced with
`this.pos += this.length()`, which reads `pos` before the call that moves it past the length's varint, so a skipped
length-delimited field landed the varint's size short. It could misparse
only inside the span, because the length had already been checked against it.
The skip check "a field of each wire type is skipped by it" fails on it.

## Properties verified

Each property below is pinned by a line of `tests/link/net_protobuf`'s
`expected.out`, so the check that fails when one stops holding is
`link/net_protobuf: exits with 0 and stdout matches expected.out`; the line
names are quoted after each property. `tests/link/net_protobuf_f64` runs the
same checks again compiled with `--number-mode f64`, against the same
`expected.out`, so each line is pinned in both number modes. Six refusal codes also have a fixture
of their own, `tests/link/net_protobuf_bad_*`, whose `main.ts` header says
what it sends and what it answers: `PROTO_ERR_VARINT`, `PROTO_ERR_LENGTH`,
`PROTO_ERR_FIELD`, `PROTO_ERR_GROUP`, `PROTO_ERR_DEPTH` and
`PROTO_ERR_WINDOW` (one for the reader, one for the writer).
`PROTO_ERR_TRUNCATED`, `PROTO_ERR_WIRE_TYPE`, `PROTO_ERR_MISMATCH` and
`PROTO_ERR_UNBALANCED` are pinned by `net_protobuf`'s lines alone.

**The reader agrees with the reference implementation.** `vectors.ts` holds
26 messages encoded by Google's `protobuf` Python package (7.36.1), each with
the fields it holds, written by `vectors.py` with the command in its header.
Each decodes to its fields, re-encodes byte for byte through the writer, and
is skipped field by field without a fault (`<vector>: decodes to its fields`,
`re-encodes byte for byte`, `skips every field`). The vectors cover ten-byte
negative int32 and int64; the minimum and maximum of int32, int64, sint32,
sint64, sfixed32 and sfixed64; the maximum of uint32, uint64, fixed32 and
fixed64, and their zero, which proto3 does not send for a singular field, as
an unpacked uint32, uint64 and fixed64 element and a packed fixed32 one;
float subnormals and infinity, a two-byte length, an embedded message, packed
and unpacked repeated fields and field number 2^29 − 1. One vector ends with
four fields the schema does not know, one of each wire type, encoded by the
reference implementation, which the reader skips; its writer check compares
the known fields' bytes.

**Every wire type is skipped by its size** (`a field of each wire type is
skipped by it`, `the field after them reads`, `and nothing faults`). An
unknown field is checked and passed, never interpreted.

**A varint is at most ten bytes.** A tenth byte with its continuation bit set
is `PROTO_ERR_VARINT` (`a varint of eleven bytes`, `a tag that never ends in
ten bytes`, `net_protobuf_bad_varint`). A varint that runs off the span is
`PROTO_ERR_TRUNCATED` (`a varint cut short`, `a tag cut short`).

**A fixed value inside the span or a code.** A fixed64 or fixed32 that runs
off the span is `PROTO_ERR_TRUNCATED` (`a fixed64 cut short`, `a fixed32 cut
short`), and so is a packed fixed32 field whose length is not a multiple of
four (`a ragged packed fixed32`).

**A length inside the span or a code.** A length past what is left of the
span is `PROTO_ERR_LENGTH`, compared as a `u64` so that a length of 2^31
or more cannot wrap (`a length past the span`, `a length of 2^31 bytes`, `a length of 2^32 - 1 bytes`, `a length of 2^64 - 1 bytes`, `a length cut short`, `net_protobuf_bad_length`). An inner length
is checked against the enclosing span, not the buffer (`an inner length past
the outer span`, `an inner length past the outer span, entered`).

**A tag names a field 1 to 2^29 − 1 of wire type 0, 1, 2 or 5.** Field 0 and
a tag varint above 2^32 − 1 are `PROTO_ERR_FIELD` (`field number 0`, `a field
number past 2^29 - 1`, `a tag of 2^32 + 8`, and `net_protobuf_bad_field`,
which sends the tag 2^32 + 8, field 1 in its low 32 bits, and also reads
2^29 − 1).
Wire types 3 and 4 are `PROTO_ERR_GROUP` (`a start group`, `an end group`,
`net_protobuf_bad_group`), so the reader has no group skip to recurse in.
Wire types 6 and 7 are `PROTO_ERR_WIRE_TYPE` (`wire type 6`, `wire type 7`).

**Nesting is capped at `PROTO_MAX_DEPTH`.** `enter` keeps the enclosing
span's end in a fixed array of 100, filled by the constructor, and refuses a
101st level with `PROTO_ERR_DEPTH` (`the reader enters to the cap`, `the
reader refuses one more`, `net_protobuf_bad_depth`). The reader never
recurses: nesting is the caller's loop, and `leave` skips the rest of a span
with the same `next` or `more` loop (`leave passes over the unread rest`,
`a malformed rest is refused by leave`, `leave skips the packed rest`).

**A typed read takes only its own wire type, once.** A read of the wrong
wire type, a second read of one value, a read before `next`, `enter` on a
varint, `next` inside a packed field, `more` outside one and `enterPacked`
of a length-delimited element type are `PROTO_ERR_MISMATCH` (`a varint read
as fixed32`, `a value read twice`, `a value read before next`, `a varint
entered`, `next inside a packed field`, `more outside a packed field`, `a
packed field of length-delimited elements`). `leave` with no span entered is
`PROTO_ERR_UNBALANCED` (`leave with no span entered`).

**A fault is sticky until `reset`** (`and the fault is sticky`, `reset
clears the fault`), and a reader over a window reads only the window's bytes
(`a window reads only its bytes`). A window outside the buffer, below 0 or
ending before it starts is `PROTO_ERR_WINDOW` and an empty span, never a
panic (`net_protobuf_bad_reader_window`).

**The writer writes only what the reader accepts.** It refuses a field
number outside 1 to 2^29 − 1 with `PROTO_ERR_FIELD` (`field number 0 is
refused`, `a field number past 2^29 - 1 is refused`, `2^29 - 1 is written`),
a 101st `beginMessage` with `PROTO_ERR_DEPTH` (`the writer nests to the
cap`, `the writer refuses one more`) and an `endMessage` with none open with
`PROTO_ERR_UNBALANCED` (`endMessage with none open`), as is a packed element
written with no message open (`a packed element with none open`, `a packed
fixed32 with none open`, `a packed fixed64 with none open`). `endMessage`'s
backpatch moves the contents one byte at a time from the top, each store
checked against the message, so contents of one, two and three length bytes survive
(`a nested message of 2 bytes`, `of 200 bytes`, `of 20000 bytes`, `a nested
message of 303 bytes keeps its contents`). A `bytes` window outside its
source, a negative offset or count among them, writes nothing and is
`PROTO_ERR_WINDOW` (`net_protobuf_bad_writer_window`).

**A warm writer allocates nothing** (`a warm writer allocates nothing per
field`): once the buffer has grown to a message's size, `reset` and a
rewrite of the message leave `Arena.used()` where it was.

**The module keeps no panic site.** Every index is guarded and every sum
widened, so the compiler's no-panic check, the default for a program's own
package, passes on a program that calls it. The guide's two examples in
`docs/guide/using-nish/standard-library.md`, under `nish/net/protobuf`, are
marked `nish:ok` without `--allow-panics`, so the `guide` section's
`standard-library.md:<line> compiles` checks fail if a method they call gains
one. Between them they call `next`, `len`, `enter`, `enterPacked`, `more`,
`leave`, the reader's `uint64`, `int32`, `fixed32`, `fixed64`, `float` and
`double`, and every writer method but `reset`, `int64`, `uint32`, `bool`,
`sint64`, `sfixed32` and `sfixed64`.

## Not pinned

- The no-panic property of the methods neither guide example calls (the
  reader's `int64`, `uint32`,
  `bool`, `sint64`, `sint32`, `sfixed32` and `sfixed64`, and the writer's
  above), was checked by a one-off strict build of a program calling every
  public method, not by a test.
- No fuzz target drives the reader yet. The properties above are pinned by
  the fixtures alone.
- PB-3's `PROTO_MAX_SIZE` refusal is not reached by a test.
