// nish/net/protobuf against the reference implementation's bytes
// (vectors.ts, made by vectors.py with the command in its header), and the
// reader's and writer's edges.
import {
  PROTO_ERR_DEPTH,
  PROTO_ERR_FIELD,
  PROTO_ERR_GROUP,
  PROTO_ERR_LENGTH,
  PROTO_ERR_MISMATCH,
  PROTO_ERR_TRUNCATED,
  PROTO_ERR_UNBALANCED,
  PROTO_ERR_VARINT,
  PROTO_ERR_WIRE_TYPE,
  PROTO_MAX_DEPTH,
  PROTO_MAX_FIELD,
  PROTO_OK,
  PROTO_WIRE_I32,
  PROTO_WIRE_I64,
  PROTO_WIRE_LEN,
  PROTO_WIRE_VARINT,
  ProtoReader,
  ProtoWriter,
} from "nish/net/protobuf"
import { Suite } from "nish/testing"
import { protoVectors } from "./vectors"

/** `buf[from, from + n)` as vectors.py prints bytes: `[1.2.3]`. */
const bytesText = (buf: readonly u8[], from: i32, n: i32): string => {
  let s = ""
  for (let i: i32 = 0; i < n; i += 1) {
    s = i === 0 ? `${buf[from + i]}` : `${s}.${buf[from + i]}`
  }
  return `[${s}]`
}

/** `acc` and `item`, space-separated. */
const join = (acc: string, item: string): string => (acc === "" ? item : `${acc} ${item}`)

/** Whether `got[0, n)` is `want`. */
const sameBytes = (got: readonly u8[], n: i32, want: readonly u8[]): boolean => {
  if (n !== toI32(want.length) || n > toI32(got.length)) {
    return false
  }
  for (let i: i32 = 0; i < n; i += 1) {
    if (got[i] !== want[i]) {
      return false
    }
  }
  return true
}

/** The zigzag form of `v`, as an sint64 element is written. */
const zigzag = (v: i64): u64 => toU64(v << toI64(1)) ^ toU64(v >> toI64(63))

/** A length-delimited field: copies its bytes to `w` and answers their text. */
const copySpan = (r: ProtoReader, w: ProtoWriter, f: i32): string => {
  const n = r.len()
  w.bytes(f, r.buf, r.spanStart, n)
  return `${f}=${bytesText(r.buf, r.spanStart, n)}`
}

/**
 * Reads `Inner` (1 int32, 2 string, 3 Inner) from the span `r` is in,
 * writing each field to `w`, and answers the fields as vectors.py prints them.
 */
const copyInner = (r: ProtoReader, w: ProtoWriter): string => {
  let out = ""
  while (r.next()) {
    const f = r.field
    if (f === 1) {
      const v = r.int32()
      w.int32(f, v)
      out = join(out, `${f}=${v}`)
    } else if (f === 2) {
      out = join(out, copySpan(r, w, f))
    } else if (f === 3) {
      r.enter()
      w.beginMessage(f)
      const inner = copyInner(r, w)
      r.leave()
      w.endMessage()
      out = join(out, `${f}{${inner}}`)
    }
  }
  return out
}

/** Reads the packed field `f` element by element, writing each to `w`. */
const copyPacked = (r: ProtoReader, w: ProtoWriter, f: i32): string => {
  let out = ""
  const wireType = f === 18 ? PROTO_WIRE_I32 : f === 19 ? PROTO_WIRE_I64 : PROTO_WIRE_VARINT
  r.enterPacked(wireType)
  w.beginMessage(f)
  while (r.more()) {
    if (f === 17) {
      const v = r.int32()
      w.packedVarint(toU64(toI64(v)))
      out = join(out, `${f}=${v}`)
    } else if (f === 18) {
      const v = r.fixed32()
      w.packedFixed32(v)
      out = join(out, `${f}=${v}`)
    } else if (f === 19) {
      const v = r.double()
      w.packedFixed64(toU64(f64ToBits(v)))
      out = join(out, `${f}=d${toU64(f64ToBits(v))}`)
    } else {
      const v = r.sint64()
      w.packedVarint(zigzag(v))
      out = join(out, `${f}=${v}`)
    }
  }
  r.leave()
  w.endMessage()
  return out
}

/** Reads `All` (vectors.py's schema) from `r`, writing each field to `w`. */
const copyAll = (r: ProtoReader, w: ProtoWriter): string => {
  let out = ""
  while (r.next()) {
    const f = r.field
    let item = ""
    if (f === 1) {
      const v = r.int32()
      w.int32(f, v)
      item = `${f}=${v}`
    } else if (f === 2) {
      const v = r.int64()
      w.int64(f, v)
      item = `${f}=${v}`
    } else if (f === 3) {
      const v = r.uint32()
      w.uint32(f, v)
      item = `${f}=${v}`
    } else if (f === 4) {
      const v = r.uint64()
      w.uint64(f, v)
      item = `${f}=${v}`
    } else if (f === 5) {
      const v = r.sint32()
      w.sint32(f, v)
      item = `${f}=${v}`
    } else if (f === 6) {
      const v = r.sint64()
      w.sint64(f, v)
      item = `${f}=${v}`
    } else if (f === 7) {
      const v = r.bool()
      w.bool(f, v)
      item = `${f}=${v}`
    } else if (f === 8) {
      const v = r.fixed32()
      w.fixed32(f, v)
      item = `${f}=${v}`
    } else if (f === 9) {
      const v = r.fixed64()
      w.fixed64(f, v)
      item = `${f}=${v}`
    } else if (f === 10) {
      const v = r.sfixed32()
      w.sfixed32(f, v)
      item = `${f}=${v}`
    } else if (f === 11) {
      const v = r.sfixed64()
      w.sfixed64(f, v)
      item = `${f}=${v}`
    } else if (f === 12) {
      const v = r.float()
      w.float(f, v)
      item = `${f}=f${toU32(f32ToBits(v))}`
    } else if (f === 13) {
      const v = r.double()
      w.double(f, v)
      item = `${f}=d${toU64(f64ToBits(v))}`
    } else if (f === 14 || f === 15) {
      item = copySpan(r, w, f)
    } else if (f === 16) {
      r.enter()
      w.beginMessage(f)
      const inner = copyInner(r, w)
      r.leave()
      w.endMessage()
      item = `${f}{${inner}}`
    } else if (f >= 17 && f <= 20) {
      item = copyPacked(r, w, f)
    } else if (f === PROTO_MAX_FIELD) {
      const v = r.uint32()
      w.uint32(f, v)
      item = `${f}=${v}`
    }
    out = join(out, item)
  }
  return out
}

/** A reader over all of `buf`. */
const over = (buf: readonly u8[]): ProtoReader => new ProtoReader(buf, 0, toI32(buf.length))

/** Reads every field of `buf` without reading a value, and answers the fault. */
const skipAll = (buf: readonly u8[]): i32 => {
  const r = over(buf)
  while (r.next()) {}
  return r.failed
}

const vectorChecks = (s: Suite): void => {
  const w = new ProtoWriter([])
  const all = protoVectors()
  for (let i: i32 = 0; i < toI32(all.length); i += 1) {
    const v = all[i]
    const r = over(v.bytes)
    w.reset()
    s.eqStr(`${v.name}: decodes to its fields`, copyAll(r, w), v.fields)
    s.eqI32(`${v.name}: reads with no fault`, r.failed, PROTO_OK)
    s.eqI32(`${v.name}: writes with no fault`, w.failed, PROTO_OK)
    s.ok(`${v.name}: re-encodes byte for byte`, sameBytes(w.buf, w.end, v.bytes))
    // Every field passed over unread, by its wire type.
    const k = over(v.bytes)
    let fields: i32 = 0
    while (k.next()) {
      fields += 1
    }
    s.ok(`${v.name}: skips every field`, k.failed === PROTO_OK && k.pos === k.end && (fields > 0 || v.fields === ""))
  }
}

const skipChecks = (s: Suite): void => {
  // One field of each wire type, then a field read after them.
  const w = new ProtoWriter([])
  w.uint64(toI32(1), toU64(300))
  w.fixed64(toI32(2), toU64(7))
  w.string(toI32(3), "abc")
  w.fixed32(toI32(4), toU32(9))
  w.beginMessage(toI32(5))
  w.uint64(toI32(1), toU64(1))
  w.endMessage()
  w.sint32(toI32(6), toI32(-3))
  const r = new ProtoReader(w.buf, 0, w.end)
  let types = ""
  let last: i32 = 0
  while (r.next()) {
    types = join(types, `${r.wireType}`)
    if (r.field === 6) {
      last = r.sint32()
    }
  }
  s.eqStr("a field of each wire type is skipped by it", types, "0 1 2 5 2 0")
  s.eqI32("the field after them reads", last, toI32(-3))
  s.eqI32("and nothing faults", r.failed, PROTO_OK)
  // A span read whole, and a nested message left half read.
  const m = new ProtoReader(w.buf, 0, w.end)
  m.next()
  m.next()
  m.next()
  s.eqI32("len answers the span", m.len(), toI32(3))
  s.eqI32("whose start is spanStart", toI32(w.buf[m.spanStart]), toI32(97))
  m.next()
  m.next()
  m.enter()
  s.eqI32("depth counts the span entered", m.depth, toI32(1))
  s.ok("leave passes over the unread rest", m.leave())
  s.ok("and next goes on after it", m.next() && m.field === 6)
}

const refusalChecks = (s: Suite): void => {
  s.eqI32("a varint of eleven bytes", skipAll([8, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 1]), PROTO_ERR_VARINT)
  s.eqI32("a varint cut short", skipAll([8, 128]), PROTO_ERR_TRUNCATED)
  s.eqI32("a tag cut short", skipAll([128]), PROTO_ERR_TRUNCATED)
  s.eqI32("a tag that never ends in ten bytes", skipAll([128, 128, 128, 128, 128, 128, 128, 128, 128, 128]), PROTO_ERR_VARINT)
  s.eqI32("a fixed64 cut short", skipAll([9, 1, 2, 3]), PROTO_ERR_TRUNCATED)
  s.eqI32("a fixed32 cut short", skipAll([13, 1, 2, 3]), PROTO_ERR_TRUNCATED)
  s.eqI32("a length past the span", skipAll([10, 5, 1, 2]), PROTO_ERR_LENGTH)
  s.eqI32("a length of 2^64 - 1 bytes", skipAll([10, 255, 255, 255, 255, 255, 255, 255, 255, 255, 1]), PROTO_ERR_LENGTH)
  s.eqI32("a length cut short", skipAll([10]), PROTO_ERR_TRUNCATED)
  s.eqI32("field number 0", skipAll([0, 1]), PROTO_ERR_FIELD)
  s.eqI32("a field number past 2^29 - 1", skipAll([128, 128, 128, 128, 16, 1]), PROTO_ERR_FIELD)
  s.eqI32("a start group", skipAll([11]), PROTO_ERR_GROUP)
  s.eqI32("an end group", skipAll([12]), PROTO_ERR_GROUP)
  s.eqI32("wire type 6", skipAll([14]), PROTO_ERR_WIRE_TYPE)
  s.eqI32("wire type 7", skipAll([15]), PROTO_ERR_WIRE_TYPE)
  // A malformed field after the ones read is still refused.
  const tail = over([8, 1, 10, 9])
  s.ok("the good field reads", tail.next() && tail.uint64() === toU64(1))
  // A length is checked when its field is read or passed over, not at its tag.
  s.ok("the bad one after it is refused when passed over", tail.next() && !tail.next() && tail.failed === PROTO_ERR_LENGTH)
  s.ok("and the fault is sticky", !tail.next() && tail.failed === PROTO_ERR_LENGTH)
  // An embedded message whose length overruns its parent's.
  s.eqI32("an inner length past the outer span", skipAll([10, 2, 10, 5]), PROTO_OK)
  const nested = over([10, 2, 10, 5])
  nested.next()
  nested.enter()
  s.ok("an inner length past the outer span, entered", nested.next() && nested.len() === 0 && nested.failed === PROTO_ERR_LENGTH)
  // A malformed rest of an entered message is refused by leave.
  const rest = over([10, 2, 8, 128, 8, 1])
  rest.next()
  rest.enter()
  s.ok("a malformed rest is refused by leave", !rest.leave() && rest.failed === PROTO_ERR_TRUNCATED)
  // PB-1: an over-long varint is read as its value, and the tenth byte's
  // bits past the 64th are dropped.
  const long = over([8, 128, 0])
  s.ok("an over-long varint for 0 reads as 0", long.next() && long.uint64() === toU64(0) && !long.next() && long.failed === PROTO_OK)
  const tenthEven = over([8, 128, 128, 128, 128, 128, 128, 128, 128, 128, 126])
  s.ok("a tenth byte of 0x7e reads as 0", tenthEven.next() && tenthEven.uint64() === toU64(0) && tenthEven.failed === PROTO_OK)
  const tenthOdd = over([8, 128, 128, 128, 128, 128, 128, 128, 128, 128, 127])
  s.ok("a tenth byte of 0x7f reads as 2^63", tenthOdd.next() && tenthOdd.uint64() === toU64(1) << toU64(63) && tenthOdd.failed === PROTO_OK)
  // A tag whose low 32 bits name field 1 but whose high bits are set.
  s.eqI32("a tag of 2^32 + 8", skipAll([136, 128, 128, 128, 16, 1]), PROTO_ERR_FIELD)
  s.eqI32("field 0 with wire type 3 is refused as a group", skipAll([3]), PROTO_ERR_GROUP)
}

const misuseChecks = (s: Suite): void => {
  const varint = over([8, 1, 13, 1, 0, 0, 0])
  varint.next()
  s.ok("a varint read as fixed32", varint.fixed32() === toU32(0) && varint.failed === PROTO_ERR_MISMATCH)
  const twice = over([8, 1])
  twice.next()
  twice.uint64()
  s.ok("a value read twice", twice.uint64() === toU64(0) && twice.failed === PROTO_ERR_MISMATCH)
  const before = over([8, 1])
  s.ok("a value read before next", !before.bool() && before.failed === PROTO_ERR_MISMATCH)
  const enterVarint = over([8, 1])
  enterVarint.next()
  s.ok("a varint entered", !enterVarint.enter() && enterVarint.failed === PROTO_ERR_MISMATCH)
  const leaveTop = over([8, 1])
  s.ok("leave with no span entered", !leaveTop.leave() && leaveTop.failed === PROTO_ERR_UNBALANCED)
  const packedLen = over([10, 1, 1])
  packedLen.next()
  s.ok("a packed field of length-delimited elements", !packedLen.enterPacked(PROTO_WIRE_LEN) && packedLen.failed === PROTO_ERR_MISMATCH)
  const packedNext = over([10, 1, 1])
  packedNext.next()
  packedNext.enterPacked(PROTO_WIRE_VARINT)
  s.ok("next inside a packed field", !packedNext.next() && packedNext.failed === PROTO_ERR_MISMATCH)
  const moreTop = over([8, 1])
  s.ok("more outside a packed field", !moreTop.more() && moreTop.failed === PROTO_ERR_MISMATCH)
  // A packed field of fixed32 elements whose length is not a multiple of 4.
  const ragged = over([10, 3, 1, 2, 3])
  ragged.next()
  ragged.enterPacked(PROTO_WIRE_I32)
  s.ok("a ragged packed fixed32", ragged.more() && ragged.fixed32() === toU32(0) && ragged.failed === PROTO_ERR_TRUNCATED)
  // A packed field skipped element by element by leave, and by next unread.
  const packed = over([10, 3, 1, 2, 3, 16, 4])
  packed.next()
  packed.enterPacked(PROTO_WIRE_VARINT)
  packed.more()
  s.ok("leave skips the packed rest", packed.leave() && packed.next() && packed.uint64() === toU64(4))
  // reset starts over and clears the fault.
  const again = over([0])
  again.next()
  const two: u8[] = [8, 2]
  again.reset(two, toI32(0), toI32(2))
  s.ok("reset clears the fault", again.failed === PROTO_OK && again.next() && again.uint64() === toU64(2))
  // A window inside a larger array.
  const window = new ProtoReader([99, 8, 5, 99], 1, 3)
  s.ok("a window reads only its bytes", window.next() && window.uint64() === toU64(5) && !window.next() && window.failed === PROTO_OK)
}

const depthChecks = (s: Suite): void => {
  // PROTO_MAX_DEPTH messages nested in each other, then one more.
  const w = new ProtoWriter([])
  for (let i: i32 = 0; i < PROTO_MAX_DEPTH; i += 1) {
    w.beginMessage(toI32(1))
  }
  w.uint64(toI32(2), toU64(42))
  for (let i: i32 = 0; i < PROTO_MAX_DEPTH; i += 1) {
    w.endMessage()
  }
  s.eqI32("the writer nests to the cap", w.failed, PROTO_OK)
  const r = new ProtoReader(w.buf, 0, w.end)
  let entered: i32 = 0
  while (r.next() && r.field === 1 && r.enter()) {
    entered += 1
  }
  s.ok("the reader enters to the cap", entered === PROTO_MAX_DEPTH && r.field === 2 && r.uint64() === toU64(42))
  const over1 = new ProtoWriter([])
  for (let i: i32 = 0; i <= PROTO_MAX_DEPTH; i += 1) {
    over1.beginMessage(toI32(1))
  }
  s.eqI32("the writer refuses one more", over1.failed, PROTO_ERR_DEPTH)
  // Each level a length-delimited field 1 holding the level inside it.
  let deep: u8[] = []
  for (let i: i32 = 0; i <= PROTO_MAX_DEPTH; i += 1) {
    const level = new ProtoWriter([])
    level.bytes(toI32(1), deep, toI32(0), toI32(deep.length))
    deep = level.buf
  }
  const d = over(deep)
  while (d.next() && d.enter()) {}
  s.eqI32("the reader refuses one more", d.failed, PROTO_ERR_DEPTH)
}

/** A message of every kind of field, written into `warm` from its start. */
const writeSample = (warm: ProtoWriter): void => {
  warm.reset()
  warm.uint64(toI32(1), toU64(150))
  warm.string(toI32(2), "a string of some length")
  warm.beginMessage(toI32(3))
  warm.double(toI32(1), toF64(5) / toF64(2))
  warm.sint64(toI32(2), toI64(-9))
  warm.endMessage()
  warm.beginMessage(toI32(4))
  warm.packedFixed32(toU32(1))
  warm.packedFixed64(toU64(2))
  warm.packedVarint(toU64(3))
  warm.endMessage()
}

const writerChecks = (s: Suite): void => {
  const w = new ProtoWriter([])
  w.uint64(toI32(0), toU64(1))
  s.ok("field number 0 is refused", w.failed === PROTO_ERR_FIELD && w.end === 0)
  w.reset()
  w.uint64(PROTO_MAX_FIELD + 1, toU64(1))
  s.eqI32("a field number past 2^29 - 1 is refused", w.failed, PROTO_ERR_FIELD)
  w.reset()
  w.uint64(PROTO_MAX_FIELD, toU64(1))
  s.ok("2^29 - 1 is written", w.failed === PROTO_OK && w.end === 6)
  w.reset()
  w.endMessage()
  s.eqI32("endMessage with none open", w.failed, PROTO_ERR_UNBALANCED)
  w.reset()
  w.packedVarint(toU64(0))
  s.ok("a packed element with none open", w.failed === PROTO_ERR_UNBALANCED && w.end === 0)
  w.reset()
  w.packedFixed32(toU32(0))
  s.eqI32("a packed fixed32 with none open", w.failed, PROTO_ERR_UNBALANCED)
  w.reset()
  w.packedFixed64(toU64(0))
  s.eqI32("a packed fixed64 with none open", w.failed, PROTO_ERR_UNBALANCED)
  // A nested message of 200 bytes takes a two-byte length, and of 20000 three.
  for (let size: i32 = 1; size <= 20000; size *= 100) {
    w.reset()
    w.beginMessage(toI32(1))
    for (let i: i32 = 0; i < size; i += 1) {
      w.bool(toI32(2), true)
    }
    w.endMessage()
    w.bool(toI32(3), true)
    const r = new ProtoReader(w.buf, 0, w.end)
    let count: i32 = 0
    r.next()
    r.enter()
    while (r.next()) {
      count += r.bool() ? 1 : 0
    }
    r.leave()
    s.ok(`a nested message of ${size * 2} bytes`, count === size && r.next() && r.field === 3 && r.bool())
  }
  // Contents that do not repeat, so a length moved in wrong would show.
  const ramp: u8[] = []
  for (let i: i32 = 0; i < 300; i += 1) {
    ramp.push(toU8(i % 251))
  }
  w.reset()
  w.beginMessage(toI32(1))
  w.bytes(toI32(2), ramp, toI32(0), toI32(300))
  w.endMessage()
  const rr = new ProtoReader(w.buf, 0, w.end)
  rr.next()
  rr.enter()
  rr.next()
  const n = rr.len()
  s.ok("a nested message of 303 bytes keeps its contents", n === 300 && bytesText(rr.buf, rr.spanStart, n) === bytesText(ramp, 0, 300))
  // A window of bytes, and a writer that reuses its buffer.
  const src: u8[] = [1, 2, 3, 4]
  w.reset()
  w.bytes(toI32(1), src, toI32(1), toI32(2))
  s.ok("bytes writes its window", sameBytes(w.buf, w.end, [10, 2, 2, 3]))
  w.reset()
  w.string(toI32(1), "")
  s.ok("an empty string", sameBytes(w.buf, w.end, [10, 0]))
  w.reset()
  w.int64(toI32(1), toI64(-1))
  w.int32(toI32(2), toI32(-1))
  s.eqI32("int32 and int64 negatives take ten bytes", w.end, toI32(22))
  // Once the buffer has grown, writing the same message again allocates nothing.
  const warm = new ProtoWriter([])
  writeSample(warm)
  const before = Arena.used()
  for (let i: i32 = 0; i < 100; i += 1) {
    writeSample(warm)
  }
  s.ok("a warm writer allocates nothing per field", Arena.used() === before && warm.failed === PROTO_OK)
}

export const protobufChecks = (): i32 => {
  const s = new Suite("protobuf")
  vectorChecks(s)
  skipChecks(s)
  refusalChecks(s)
  misuseChecks(s)
  depthChecks(s)
  writerChecks(s)
  return s.done()
}
