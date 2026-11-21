// nish proto: the classes it wrote from classes.proto decode every message the
// reference implementation encoded (vectors.ts), hold what it holds, and write
// back its bytes byte for byte; each malformed message makes decode false.
import { All, All_Inner, Leaf } from "./classes"
import { PROTO_OK, ProtoReader, ProtoWriter } from "nish/net/protobuf"
import { classVectors } from "./vectors"

/** How many Leafs hang from `leaf`, one inside the next. */
const leafDepth = (leaf: Leaf | null): i32 => {
  let n: i32 = 0
  let at = leaf
  while (at !== null) {
    n = n + 1
    at = at.child
  }
  return n
}

/** How many Inners hang from `inner`, one inside the next. */
const innerDepth = (inner: All_Inner | null): i32 => {
  let n: i32 = 0
  let at = inner
  while (at !== null) {
    n = n + 1
    at = at.again
  }
  return n
}

/** What `m` holds, in the words vectors.py's `summary` writes. */
const summary = (m: All): string => {
  const repeated =
    m.ri.length + m.rs.length + m.rd.length + m.rstr.length + m.rby.length + m.rleaf.length + m.rb.length + m.rf.length + m.rc.length
  const maps = m.ms.size + m.ml.size + m.mu.size + m.mb.size
  const oi = m.has_oi ? 1 : 0
  const os = m.has_os ? 1 : 0
  const ol = m.ol !== null ? 1 : 0
  return `i32=${m.i32} s64=${m.s64} u32=${m.u32} oi=${oi}:${m.oi} os=${os} ol=${ol} case=${m.choice_case} color=${m.color} leaf=${leafDepth(m.leaf)} inner=${innerDepth(m.inner)} repeated=${repeated} maps=${maps}`
}

/** Whether `a` and `b` hold the same bytes. */
const sameBytes = (a: u8[], b: u8[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export const main = (): i32 => {
  let failed: i32 = 0
  for (const v of classVectors()) {
    const m = new All()
    const ok = m.decode(new ProtoReader(v.input, 0, toI32(v.input.length)))
    if (!v.ok) {
      if (ok) {
        console.log(`FAIL  ${v.name}: decoded a message the reference refuses`)
        failed = failed + 1
      } else {
        console.log(`PASS  ${v.name}: refused`)
      }
      continue
    }
    if (!ok) {
      console.log(`FAIL  ${v.name}: decode refused it`)
      failed = failed + 1
      continue
    }
    const held = summary(m)
    const w = new ProtoWriter([])
    m.encode(w)
    const out = w.buf.slice(0, w.end)
    if (held !== v.summary) {
      console.log(`FAIL  ${v.name}: holds ${held}, the reference ${v.summary}`)
      failed = failed + 1
    } else if (w.failed !== PROTO_OK || !sameBytes(out, v.output)) {
      console.log(`FAIL  ${v.name}: wrote ${out.length} bytes, not the reference's ${v.output.length}`)
      failed = failed + 1
    } else {
      console.log(`PASS  ${v.name}: ${out.length} bytes, ${held}`)
    }
  }
  console.log(failed === 0 ? "all vectors pass" : `${failed} vectors fail`)
  return failed === 0 ? 0 : 1
}
