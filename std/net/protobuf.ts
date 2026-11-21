/**
 * `nish/net/protobuf` — protobuf's wire format, without a schema: a reader
 * that walks the fields of a message held in a `u8[]` span, and a writer that
 * appends fields to a caller's buffer. It knows tags, the four wire types
 * proto3 uses and the value encodings on top of them (varint, zigzag, the
 * little-endian fixed widths, length-delimited spans); what a field number
 * means is the caller's schema, not this module's.
 *
 *     import { ProtoReader, ProtoWriter, PROTO_OK } from "nish/net/protobuf";
 *
 *     const w = new ProtoWriter([]);
 *     w.uint64(1, toU64(150));
 *     w.string(2, "hi");
 *
 *     const r = new ProtoReader(w.buf, 0, w.end);
 *     while (r.next()) {
 *       if (r.field === 1) {
 *         const id: u64 = r.uint64();
 *       } else if (r.field === 2) {
 *         const n: i32 = r.len(); // the bytes are w.buf[r.spanStart, r.spanStart + n)
 *       }                         // any other field is skipped by the next call to next()
 *     }
 *     if (r.failed !== PROTO_OK) {
 *       // a negative PROTO_ERR_* code: the message is malformed
 *     }
 *
 * **The reader refuses with a code, never a panic.** Peer bytes cannot make
 * it read outside its span: every value is checked against the span's end
 * before a byte of it is read. The first fault sets `failed` to a negative
 * `PROTO_ERR_*` code, which is sticky: every later call answers `false` or
 * zero until `reset`. It refuses a varint whose tenth byte still has its
 * continuation bit, a varint or fixed value that runs off the span, a length
 * past the span, a tag whose field number is 0 or whose varint is above
 * 2^32 - 1 (so a field number past 2^29 - 1), the group wire types 3 and 4,
 * the undefined wire types 6 and 7, an `enter` past `PROTO_MAX_DEPTH`
 * nested spans, and a typed read whose wire type is not the field's.
 *
 * **A field the caller does not read is skipped by its wire type** when
 * `next` is called again, so an unknown field is checked and passed, never
 * interpreted. A varint's bits past the 64th (the tenth byte's top six) are
 * dropped, and an over-long varint (`0x80 0x00` for 0) is read as
 * its value; neither can move the reader outside its span.
 *
 * **The writer appends to the caller's buffer** from `end`, storing over the
 * bytes already there and pushing past its length, so a buffer that has grown
 * to a message's size is reused without allocating once the writer is `reset`.
 * Misuse (a field number outside 1 to 2^29 - 1, nesting past
 * `PROTO_MAX_DEPTH`, an `endMessage` or a packed element with no open
 * message, a `bytes` window outside its source array, a message past
 * `PROTO_MAX_SIZE` bytes) sets the same sticky `failed` code and writes nothing more. Neither side panics: a
 * reader window outside its array is `PROTO_ERR_WINDOW` too, so a program
 * held to no panic may call both.
 *
 * The record of what this module refuses and why is
 * `docs/security/protobuf.md`.
 */
/** The varint wire type: int32, int64, uint32, uint64, sint32, sint64, bool and enum. */
export const PROTO_WIRE_VARINT: i32 = 0
/** The 64-bit wire type: fixed64, sfixed64 and double. */
export const PROTO_WIRE_I64: i32 = 1
/** The length-delimited wire type: string, bytes, an embedded message and a packed repeated field. */
export const PROTO_WIRE_LEN: i32 = 2
/** The start-group wire type, deprecated and refused. */
export const PROTO_WIRE_SGROUP: i32 = 3
/** The end-group wire type, deprecated and refused. */
export const PROTO_WIRE_EGROUP: i32 = 4
/** The 32-bit wire type: fixed32, sfixed32 and float. */
export const PROTO_WIRE_I32: i32 = 5

/** The largest field number, 2^29 - 1. */
export const PROTO_MAX_FIELD: i32 = 536870911
/** How many spans `ProtoReader.enter` and `ProtoWriter.beginMessage` may nest, protobuf's own default recursion limit. */
export const PROTO_MAX_DEPTH: i32 = 100
/** The largest message the writer writes, 2^31 - 2 bytes, so that its `end` fits an `i32`. */
export const PROTO_MAX_SIZE: i32 = 2147483646

/** No fault. */
export const PROTO_OK: i32 = 0
/** A varint's tenth byte has its continuation bit set: no varint is longer than ten bytes. */
export const PROTO_ERR_VARINT: i32 = -1
/** A varint or a fixed-width value runs past the end of the span. */
export const PROTO_ERR_TRUNCATED: i32 = -2
/** A length-delimited value's length is past the end of the span. */
export const PROTO_ERR_LENGTH: i32 = -3
/** A field number of 0 or past 2^29 - 1: read in a tag, or given to a writer. */
export const PROTO_ERR_FIELD: i32 = -4
/** A tag with the group wire types 3 or 4, which proto3 does not have. */
export const PROTO_ERR_GROUP: i32 = -5
/** A tag with the wire types 6 or 7, which protobuf does not define. */
export const PROTO_ERR_WIRE_TYPE: i32 = -6
/** More than `PROTO_MAX_DEPTH` nested spans. */
export const PROTO_ERR_DEPTH: i32 = -7
/** A read whose wire type is not the current field's, or of a value already read. */
export const PROTO_ERR_MISMATCH: i32 = -8
/** A `leave` or `endMessage` with no span open, or a packed element written outside one. */
export const PROTO_ERR_UNBALANCED: i32 = -9
/** A reader window or a `bytes` source window outside its array, or a message that would grow past `PROTO_MAX_SIZE` bytes. */
export const PROTO_ERR_WINDOW: i32 = -10

/** The bytes a varint of `v` takes, 1 to 10. */
const varintSize = (v: u64): i32 => {
  let n: i32 = 1
  let rest: u64 = v >> toU64(7)
  while (rest !== toU64(0) && n < 10) {
    n += 1
    rest = rest >> toU64(7)
  }
  return n
}

/** The `f32` whose IEEE 754 bits are `bits`, built through the `f64` that holds it exactly. */
const f32OfBits = (bits: u32): f32 => {
  const sign: u64 = toU64(bits >> toU32(31)) << toU64(63)
  const exp: u32 = (bits >> toU32(23)) & toU32(255)
  const man: u64 = toU64(bits & toU32(8388607))
  if (exp === toU32(255)) {
    return toF32(bitsToF64(toI64(sign | (toU64(2047) << toU64(52)) | (man << toU64(29)))))
  }
  if (exp === toU32(0)) {
    // A subnormal is man * 2^-149, exact in an f64; 874 is 2^-149's f64 exponent field.
    const mag: f64 = toF64(man) * bitsToF64(toI64(toU64(874) << toU64(52)))
    return toF32(sign === toU64(0) ? mag : -mag)
  }
  return toF32(bitsToF64(toI64(sign | (toU64(exp + toU32(896)) << toU64(52)) | (man << toU64(29)))))
}

/**
 * Reads the fields of one protobuf message from `buf[from, to)`. `next`
 * moves to the next field and answers its number and wire type in `field`
 * and `wireType`; one typed read then takes its value, or the next call to
 * `next` skips it. `enter` and `leave` walk an embedded message, and
 * `enterPacked` and `more` the elements of a packed repeated field.
 */
export class ProtoReader {
  /** The array the message is in; the reader never writes to it. */
  buf: readonly u8[]
  /** The offset of the next byte to read. */
  pos: i32
  /** The end of the span being read: the message's, or the entered field's. */
  end: i32
  /** `PROTO_OK`, or the first `PROTO_ERR_*` code; sticky until `reset`. */
  failed: i32
  /** The current field's number, 1 to 2^29 - 1, after `next` answers `true`. */
  field: i32
  /** The current field's wire type, one of the `PROTO_WIRE_*` values. */
  wireType: i32
  /** Where the bytes of the last value `len` read begin in `buf`. */
  spanStart: i32
  /** How many spans are entered. */
  depth: i32
  /** `true` while the current field's value is not read yet. @internal */
  pending: boolean
  /** The wire type of a packed field's elements while one is entered, else -1. @internal */
  packedType: i32
  /** The span end to return to at each depth. @internal */
  ends: i32[]

  /**
   * A reader over `buf[from, to)`.
   *
   * @param buf - The array the message is in.
   * @param from - The offset of the message's first byte.
   * @param to - The offset one past its last byte.
   */
  constructor(buf: readonly u8[], from: i32, to: i32) {
    this.buf = buf
    this.pos = 0
    this.end = 0
    this.failed = PROTO_OK
    this.field = 0
    this.wireType = 0
    this.spanStart = 0
    this.depth = 0
    this.pending = false
    this.packedType = -1
    this.ends = []
    for (let i: i32 = 0; i < PROTO_MAX_DEPTH; i += 1) {
      this.ends.push(0)
    }
    this.reset(buf, from, to)
  }

  /**
   * Starts over on `buf[from, to)`, clearing `failed`. A window outside
   * `buf` is a caller bug: the reader holds an empty span and `failed` is
   * `PROTO_ERR_WINDOW`.
   *
   * @param buf - The array the message is in.
   * @param from - The offset of the message's first byte.
   * @param to - The offset one past its last byte.
   */
  reset(buf: readonly u8[], from: i32, to: i32): void {
    const bad: boolean = from < 0 || to < from || to > toI32(buf.length)
    this.buf = buf
    this.pos = bad ? 0 : from
    this.end = bad ? 0 : to
    this.failed = bad ? PROTO_ERR_WINDOW : PROTO_OK
    this.field = 0
    this.wireType = 0
    this.spanStart = this.pos
    this.depth = 0
    this.pending = false
    this.packedType = -1
  }

  /** Sets `failed` to `code` unless a fault is already recorded. @internal */
  fail(code: i32): void {
    if (this.failed === PROTO_OK) {
      this.failed = code
    }
  }

  /** Reads a varint of at most ten bytes; 0 and a fault when it is malformed. @internal */
  varint(): u64 {
    const buf: readonly u8[] = this.buf
    const end: i32 = this.end
    let p: i32 = this.pos
    let result: u64 = 0
    let shift: u64 = 0
    for (let i: i32 = 0; i < 9; i += 1) {
      if (p < 0 || p >= end || p >= toI32(buf.length)) {
        this.fail(PROTO_ERR_TRUNCATED)
        return 0
      }
      const b: u8 = buf[p]
      p = p + 1
      result = result | (toU64(b & toU8(127)) << shift)
      if ((b & toU8(128)) === toU8(0)) {
        this.pos = p
        return result
      }
      shift += toU64(7)
    }
    if (p < 0 || p >= end || p >= toI32(buf.length)) {
      this.fail(PROTO_ERR_TRUNCATED)
      return 0
    }
    const last: u8 = buf[p]
    this.pos = p + 1
    if ((last & toU8(128)) !== toU8(0)) {
      this.fail(PROTO_ERR_VARINT)
      return 0
    }
    // The tenth byte carries bit 63; its other bits are past 64 and dropped.
    return result | (toU64(last) << toU64(63))
  }

  /** Reads a length varint and checks it against the span; 0 and a fault when it does not fit. @internal */
  length(): i32 {
    const n: u64 = this.varint()
    if (this.failed !== PROTO_OK) {
      return 0
    }
    const room: i64 = toI64(this.end) - toI64(this.pos)
    if (room < toI64(0) || n > toU64(room)) {
      this.fail(PROTO_ERR_LENGTH)
      return 0
    }
    return toI32(n)
  }

  /** Reads `count` little-endian bytes as one value; 0 and a fault when they run off the span. @internal */
  fixed(count: i32): u64 {
    const buf: readonly u8[] = this.buf
    const end: i32 = this.end
    let p: i32 = this.pos
    let v: u64 = 0
    for (let i: i32 = 0; i < count && i < 8; i += 1) {
      if (p < 0 || p >= end || p >= toI32(buf.length)) {
        this.fail(PROTO_ERR_TRUNCATED)
        return 0
      }
      v = v | (toU64(buf[p]) << toU64(8 * i))
      p = p + 1
    }
    this.pos = p
    return v
  }

  /** Moves past `n` bytes that `length` checked against the span. @internal */
  pass(n: i32): void {
    this.pos = toI32(toI64(this.pos) + toI64(n))
  }

  /** Passes over the current field's value by its wire type. @internal */
  skip(): void {
    this.pending = false
    if (this.wireType === PROTO_WIRE_VARINT) {
      this.varint()
    } else if (this.wireType === PROTO_WIRE_I64) {
      this.fixed(8)
    } else if (this.wireType === PROTO_WIRE_I32) {
      this.fixed(4)
    } else {
      this.pass(this.length())
    }
  }

  /** Answers whether the current value may be read as `wireType`, and marks it read. @internal */
  take(wireType: i32): boolean {
    if (this.failed !== PROTO_OK) {
      return false
    }
    if (!this.pending || this.wireType !== wireType) {
      this.fail(PROTO_ERR_MISMATCH)
      return false
    }
    this.pending = false
    return true
  }

  /**
   * Moves to the next field of the span, skipping the current field's value
   * if it was not read.
   *
   * @returns `true` with `field` and `wireType` set; `false` at the span's
   *   end or on a fault, which `failed` tells apart.
   */
  next(): boolean {
    if (this.failed !== PROTO_OK) {
      return false
    }
    if (this.packedType >= 0) {
      this.fail(PROTO_ERR_MISMATCH)
      return false
    }
    if (this.pending) {
      this.skip()
      if (this.failed !== PROTO_OK) {
        return false
      }
    }
    if (this.pos >= this.end) {
      return false
    }
    const tag: u64 = this.varint()
    if (this.failed !== PROTO_OK) {
      return false
    }
    if (tag >> toU64(32) !== toU64(0)) {
      this.fail(PROTO_ERR_FIELD)
      return false
    }
    const wireType: i32 = toI32(tag & toU64(7))
    const field: i32 = toI32(tag >> toU64(3))
    if (wireType === PROTO_WIRE_SGROUP || wireType === PROTO_WIRE_EGROUP) {
      this.fail(PROTO_ERR_GROUP)
      return false
    }
    if (wireType > PROTO_WIRE_I32) {
      this.fail(PROTO_ERR_WIRE_TYPE)
      return false
    }
    if (field === 0) {
      this.fail(PROTO_ERR_FIELD)
      return false
    }
    this.field = field
    this.wireType = wireType
    this.pending = true
    return true
  }

  /**
   * Reads the current varint field as a uint64.
   *
   * @returns The value, or 0 on a fault.
   */
  uint64(): u64 {
    return this.take(PROTO_WIRE_VARINT) ? this.varint() : toU64(0)
  }

  /**
   * Reads the current varint field as an int64.
   *
   * @returns The value, or 0 on a fault.
   */
  int64(): i64 {
    return toI64(this.uint64())
  }

  /**
   * Reads the current varint field as a uint32, keeping its low 32 bits as
   * protobuf does.
   *
   * @returns The value, or 0 on a fault.
   */
  uint32(): u32 {
    return toU32(this.uint64())
  }

  /**
   * Reads the current varint field as an int32, keeping its low 32 bits: a
   * negative int32 arrives sign-extended to ten bytes.
   *
   * @returns The value, or 0 on a fault.
   */
  int32(): i32 {
    return toI32(this.uint64())
  }

  /**
   * Reads the current varint field as a bool: any value but 0 is `true`.
   *
   * @returns The value, or `false` on a fault.
   */
  bool(): boolean {
    return this.uint64() !== toU64(0)
  }

  /**
   * Reads the current varint field as a zigzag-coded sint64.
   *
   * @returns The value, or 0 on a fault.
   */
  sint64(): i64 {
    const v: u64 = this.uint64()
    return toI64((v >> toU64(1)) ^ (toU64(0) - (v & toU64(1))))
  }

  /**
   * Reads the current varint field as a zigzag-coded sint32, from its low 32
   * bits.
   *
   * @returns The value, or 0 on a fault.
   */
  sint32(): i32 {
    const v: u32 = toU32(this.uint64())
    return toI32((v >> toU32(1)) ^ (toU32(0) - (v & toU32(1))))
  }

  /**
   * Reads the current 32-bit field as a fixed32.
   *
   * @returns The value, or 0 on a fault.
   */
  fixed32(): u32 {
    return this.take(PROTO_WIRE_I32) ? toU32(this.fixed(4)) : toU32(0)
  }

  /**
   * Reads the current 32-bit field as an sfixed32.
   *
   * @returns The value, or 0 on a fault.
   */
  sfixed32(): i32 {
    return toI32(this.fixed32())
  }

  /**
   * Reads the current 32-bit field as a float. A signaling NaN comes back
   * quiet, its top mantissa bit set; `fixed32` reads the exact bits.
   *
   * @returns The value, or 0 on a fault.
   */
  float(): f32 {
    return f32OfBits(this.fixed32())
  }

  /**
   * Reads the current 64-bit field as a fixed64.
   *
   * @returns The value, or 0 on a fault.
   */
  fixed64(): u64 {
    return this.take(PROTO_WIRE_I64) ? this.fixed(8) : toU64(0)
  }

  /**
   * Reads the current 64-bit field as an sfixed64.
   *
   * @returns The value, or 0 on a fault.
   */
  sfixed64(): i64 {
    return toI64(this.fixed64())
  }

  /**
   * Reads the current 64-bit field as a double.
   *
   * @returns The value, or 0 on a fault.
   */
  double(): f64 {
    return bitsToF64(toI64(this.fixed64()))
  }

  /**
   * Reads the current length-delimited field as a span of bytes: a string,
   * bytes, or a message to read later with a reader of its own. The span
   * begins at `spanStart` in `buf`; a string's bytes are not checked to be
   * UTF-8, which is the caller's to decode.
   *
   * @returns The span's length, or 0 on a fault.
   */
  len(): i32 {
    if (!this.take(PROTO_WIRE_LEN)) {
      return 0
    }
    const n: i32 = this.length()
    this.spanStart = this.pos
    this.pass(n)
    return n
  }

  /**
   * Enters the current length-delimited field as an embedded message:
   * `next` then reads its fields, until `leave`.
   *
   * @returns `true` once entered; `false` on a fault, which is
   *   `PROTO_ERR_DEPTH` past `PROTO_MAX_DEPTH` spans.
   */
  enter(): boolean {
    if (!this.take(PROTO_WIRE_LEN)) {
      return false
    }
    const n: i32 = this.length()
    if (this.failed !== PROTO_OK) {
      return false
    }
    const ends: i32[] = this.ends
    const d: i32 = this.depth
    if (d < 0 || d >= PROTO_MAX_DEPTH || d >= toI32(ends.length)) {
      this.fail(PROTO_ERR_DEPTH)
      return false
    }
    ends[d] = this.end
    this.depth = d + 1
    this.spanStart = this.pos
    this.pass(n)
    this.end = this.pos
    this.pos = this.spanStart
    return true
  }

  /**
   * Enters the current length-delimited field as a packed repeated field
   * whose elements have `wireType`: `more` then moves from element to
   * element, until `leave`.
   *
   * @param wireType - The elements' wire type: `PROTO_WIRE_VARINT`,
   *   `PROTO_WIRE_I64` or `PROTO_WIRE_I32`; any other is `PROTO_ERR_MISMATCH`.
   * @returns `true` once entered; `false` on a fault.
   */
  enterPacked(wireType: i32): boolean {
    if (wireType !== PROTO_WIRE_VARINT && wireType !== PROTO_WIRE_I64 && wireType !== PROTO_WIRE_I32) {
      this.fail(PROTO_ERR_MISMATCH)
      return false
    }
    if (!this.enter()) {
      return false
    }
    this.packedType = wireType
    return true
  }

  /**
   * Moves to the next element of the entered packed field, skipping the
   * current one if it was not read. A typed read then takes it.
   *
   * @returns `true` while an element remains; `false` at the field's end or
   *   on a fault, which `failed` tells apart.
   */
  more(): boolean {
    if (this.failed !== PROTO_OK) {
      return false
    }
    if (this.packedType < 0) {
      this.fail(PROTO_ERR_MISMATCH)
      return false
    }
    if (this.pending) {
      this.skip()
      if (this.failed !== PROTO_OK) {
        return false
      }
    }
    if (this.pos >= this.end) {
      return false
    }
    this.wireType = this.packedType
    this.pending = true
    return true
  }

  /**
   * Leaves the span `enter` or `enterPacked` opened, skipping what is left of
   * it the way `next` or `more` would, so a malformed rest is refused, and
   * returns to the enclosing span.
   *
   * @returns `true` once left; `false` on a fault, which is
   *   `PROTO_ERR_UNBALANCED` with no span entered.
   */
  leave(): boolean {
    if (this.failed !== PROTO_OK) {
      return false
    }
    const ends: i32[] = this.ends
    const d: i32 = this.depth
    if (d <= 0 || d > toI32(ends.length)) {
      this.fail(PROTO_ERR_UNBALANCED)
      return false
    }
    if (this.packedType >= 0) {
      while (this.more()) {
        this.skip()
      }
    } else {
      while (this.next()) {
        this.skip()
      }
    }
    if (this.failed !== PROTO_OK) {
      return false
    }
    const top: i32 = d - 1
    if (top >= 0 && top < toI32(ends.length)) {
      this.end = ends[top]
    }
    this.depth = top
    this.packedType = -1
    this.pending = false
    return true
  }
}

/**
 * Writes protobuf fields into `buf` from offset 0, up to `end`. An embedded
 * message or packed field is written between `beginMessage` and
 * `endMessage`, which fills in its length.
 */
export class ProtoWriter {
  /** The caller's buffer: the message is `buf[0, end)`; bytes past `end` are stale. */
  buf: u8[]
  /** The offset one past the last byte written. */
  end: i32
  /** `PROTO_OK`, or the first `PROTO_ERR_*` code; sticky until `reset`. */
  failed: i32
  /** How many messages are open. */
  depth: i32
  /** Where each open message's length byte is. @internal */
  starts: i32[]

  /**
   * A writer into `buf`, which it grows as the message needs and reuses
   * after `reset`.
   *
   * @param buf - The buffer to write into; its contents are overwritten.
   */
  constructor(buf: u8[]) {
    this.buf = buf
    this.end = 0
    this.failed = PROTO_OK
    this.depth = 0
    this.starts = []
    for (let i: i32 = 0; i < PROTO_MAX_DEPTH; i += 1) {
      this.starts.push(0)
    }
  }

  /** Starts a new message at offset 0 of the same buffer, clearing `failed`. */
  reset(): void {
    this.end = 0
    this.failed = PROTO_OK
    this.depth = 0
  }

  /** Stores one byte at `end`, growing the buffer when it is full. @internal */
  put(b: u8): void {
    const buf: u8[] = this.buf
    const e: i32 = this.end
    if (e < 0 || e >= PROTO_MAX_SIZE) {
      if (this.failed === PROTO_OK) {
        this.failed = PROTO_ERR_WINDOW
      }
      return
    }
    if (e < toI32(buf.length)) {
      buf[e] = b
    } else {
      buf.push(b)
    }
    this.end = e + 1
  }

  /** Stores `b` at `at` of the bytes already written; an offset outside them stores nothing. @internal */
  poke(at: i32, b: u8): void {
    const buf: u8[] = this.buf
    if (at >= 0 && at < this.end && at < toI32(buf.length)) {
      buf[at] = b
    }
  }

  /** Appends `v` as a varint. @internal */
  putVarint(v: u64): void {
    let rest: u64 = v
    while (rest >= toU64(128)) {
      this.put(toU8(rest & toU64(127)) | toU8(128))
      rest = rest >> toU64(7)
    }
    this.put(toU8(rest))
  }

  /** Appends the low `count` bytes of `v`, little-endian. @internal */
  putFixed(v: u64, count: i32): void {
    for (let i: i32 = 0; i < count && i < 8; i += 1) {
      this.put(toU8((v >> toU64(8 * i)) & toU64(255)))
    }
  }

  /** Appends a tag, or sets `PROTO_ERR_FIELD`; answers whether the value may follow. @internal */
  tag(field: i32, wireType: i32): boolean {
    if (this.failed !== PROTO_OK) {
      return false
    }
    if (field < 1 || field > PROTO_MAX_FIELD) {
      this.failed = PROTO_ERR_FIELD
      return false
    }
    this.putVarint((toU64(field) << toU64(3)) | toU64(wireType))
    return true
  }

  /**
   * Writes a uint64 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  uint64(field: i32, v: u64): void {
    if (this.tag(field, PROTO_WIRE_VARINT)) {
      this.putVarint(v)
    }
  }

  /**
   * Writes an int64 field; a negative value takes ten bytes.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  int64(field: i32, v: i64): void {
    this.uint64(field, toU64(v))
  }

  /**
   * Writes a uint32 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  uint32(field: i32, v: u32): void {
    this.uint64(field, toU64(v))
  }

  /**
   * Writes an int32 field, a negative value sign-extended to ten bytes as
   * protobuf requires.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  int32(field: i32, v: i32): void {
    this.uint64(field, toU64(toI64(v)))
  }

  /**
   * Writes a bool field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  bool(field: i32, v: boolean): void {
    this.uint64(field, v ? toU64(1) : toU64(0))
  }

  /**
   * Writes a zigzag-coded sint64 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  sint64(field: i32, v: i64): void {
    this.uint64(field, toU64((v << toI64(1)) ^ (v >> toI64(63))))
  }

  /**
   * Writes a zigzag-coded sint32 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  sint32(field: i32, v: i32): void {
    this.uint64(field, toU64(toU32((v << 1) ^ (v >> 31))))
  }

  /**
   * Writes a fixed32 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  fixed32(field: i32, v: u32): void {
    if (this.tag(field, PROTO_WIRE_I32)) {
      this.putFixed(toU64(v), 4)
    }
  }

  /**
   * Writes an sfixed32 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  sfixed32(field: i32, v: i32): void {
    this.fixed32(field, toU32(v))
  }

  /**
   * Writes a float field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  float(field: i32, v: f32): void {
    this.fixed32(field, toU32(f32ToBits(v)))
  }

  /**
   * Writes a fixed64 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  fixed64(field: i32, v: u64): void {
    if (this.tag(field, PROTO_WIRE_I64)) {
      this.putFixed(v, 8)
    }
  }

  /**
   * Writes an sfixed64 field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  sfixed64(field: i32, v: i64): void {
    this.fixed64(field, toU64(v))
  }

  /**
   * Writes a double field.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param v - The value.
   */
  double(field: i32, v: f64): void {
    this.fixed64(field, toU64(f64ToBits(v)))
  }

  /**
   * Writes a bytes field from `src[from, from + count)`. A window outside
   * `src` is a caller bug: nothing is written and `failed` is
   * `PROTO_ERR_WINDOW`.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param src - The array the bytes are in.
   * @param from - The offset of the first byte.
   * @param count - How many bytes.
   */
  bytes(field: i32, src: readonly u8[], from: i32, count: i32): void {
    const bad: boolean = from < 0 || count < 0 || toI64(from) + toI64(count) > toI64(src.length)
    if (bad && this.failed === PROTO_OK) {
      this.failed = PROTO_ERR_WINDOW
    }
    if (this.tag(field, PROTO_WIRE_LEN)) {
      this.putVarint(toU64(count))
      const stop: i64 = toI64(from) + toI64(count)
      for (let q: i32 = from; q >= 0 && q < toI32(src.length) && toI64(q) < stop; q += 1) {
        this.put(src[q])
      }
    }
  }

  /**
   * Writes a string field: the string's UTF-8 bytes.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   * @param s - The string.
   */
  string(field: i32, s: string): void {
    if (this.tag(field, PROTO_WIRE_LEN)) {
      const n: i32 = toI32(s.length)
      this.putVarint(toU64(n))
      for (let i: i32 = 0; i < n; i += 1) {
        this.put(toU8(s.charCodeAt(i)))
      }
    }
  }

  /**
   * Opens a length-delimited field, an embedded message or a packed repeated
   * field, whose contents are the fields or elements written until
   * `endMessage`.
   *
   * @param field - The field number, 1 to 2^29 - 1.
   */
  beginMessage(field: i32): void {
    if (this.failed === PROTO_OK && this.depth >= PROTO_MAX_DEPTH) {
      this.failed = PROTO_ERR_DEPTH
    }
    const starts: i32[] = this.starts
    const d: i32 = this.depth
    if (this.tag(field, PROTO_WIRE_LEN)) {
      if (d >= 0 && d < toI32(starts.length)) {
        starts[d] = this.end
        this.depth = d + 1
      }
      this.put(toU8(0))
    }
  }

  /**
   * Closes the field `beginMessage` opened, writing its length; contents of
   * 128 bytes or more are moved right to make room for a longer length.
   */
  endMessage(): void {
    if (this.failed !== PROTO_OK) {
      return
    }
    const starts: i32[] = this.starts
    const d: i32 = this.depth
    if (d <= 0 || d > toI32(starts.length)) {
      this.failed = PROTO_ERR_UNBALANCED
      return
    }
    const top: i32 = d - 1
    this.depth = top
    const at: i32 = top >= 0 && top < toI32(starts.length) ? starts[top] : 0
    // `at` is where beginMessage put the one length byte, so `n` is 0 or more.
    const n: i32 = toI32(toI64(this.end) - toI64(at) - toI64(1))
    const size: i32 = varintSize(toU64(n))
    for (let i: i32 = 1; i < size; i += 1) {
      this.put(toU8(0))
    }
    if (this.failed !== PROTO_OK) {
      return
    }
    // Move the contents right by size - 1 from the top, so no byte is read after it is overwritten.
    const buf: u8[] = this.buf
    for (let k: i32 = n; k > 0 && size > 1; k -= 1) {
      const from: i32 = toI32(toI64(at) + toI64(k))
      if (from >= 0 && from < toI32(buf.length)) {
        this.poke(toI32(toI64(from) + toI64(size) - toI64(1)), buf[from])
      }
    }
    let rest: u64 = toU64(n)
    for (let i: i32 = 0; i < size; i += 1) {
      const more: u8 = i + 1 < size ? toU8(128) : toU8(0)
      this.poke(toI32(toI64(at) + toI64(i)), toU8(rest & toU64(127)) | more)
      rest = rest >> toU64(7)
    }
  }

  /**
   * Whether an element may be written: no fault and a span open; with none
   * open it sets `PROTO_ERR_UNBALANCED`. The writer does not tell a packed
   * field's span from an embedded message's: that the open span is a packed
   * field is the caller's guarantee. @internal
   */
  packed(): boolean {
    if (this.failed === PROTO_OK && this.depth <= 0) {
      this.failed = PROTO_ERR_UNBALANCED
    }
    return this.failed === PROTO_OK
  }

  /**
   * Writes one element of the packed field the last `beginMessage` opened,
   * as a varint: a uint64, or an int64, int32 or bool converted to `u64` as
   * `int64`, `int32` and `bool` do. With no span open it sets
   * `PROTO_ERR_UNBALANCED`; that the open span is a packed field, not an
   * embedded message, is the caller's to guarantee.
   *
   * @param v - The element.
   */
  packedVarint(v: u64): void {
    if (this.packed()) {
      this.putVarint(v)
    }
  }

  /**
   * Writes one element of the packed field the last `beginMessage` opened,
   * as four little-endian bytes: a fixed32, an sfixed32 or a float's bits.
   * Open spans are checked as `packedVarint` checks them.
   *
   * @param v - The element.
   */
  packedFixed32(v: u32): void {
    if (this.packed()) {
      this.putFixed(toU64(v), 4)
    }
  }

  /**
   * Writes one element of the packed field the last `beginMessage` opened,
   * as eight little-endian bytes: a fixed64, an sfixed64 or a double's bits.
   * Open spans are checked as `packedVarint` checks them.
   *
   * @param v - The element.
   */
  packedFixed64(v: u64): void {
    if (this.packed()) {
      this.putFixed(v, 8)
    }
  }
}
