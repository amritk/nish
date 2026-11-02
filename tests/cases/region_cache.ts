// The design's cache (docs/wp46-long-running-memory.md, section 2.1): a
// session per region, the oldest freed when the table is full, and only
// numbers leave a region through `enterWith`.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region"

class Session {
  id: i64
  hits: i32 = 0
  payload: u8[]
  constructor(id: i64, size: i32) {
    this.id = id
    this.payload = new Array<u8>(size)
    for (let k: i32 = 0; k < size; k++) {
      this.payload[k] = toU8(k + 1)
    }
  }
}

const payloadSize = (id: i64): i32 => toI32(id % 7) + 1

const open = (id: i64): Session => new Session(id, payloadSize(id))

/** Copies the payload into the connection's buffer: only numbers leave. */
const serve = (s: Session, out: u8[]): i32 => {
  s.hits = s.hits + 1
  for (let k: i32 = 0; k < s.payload.length && k < out.length; k++) {
    out[k] = s.payload[k]
  }
  return s.payload.length
}

const hitsOf = (s: Session): i32 => s.hits

class Cache {
  regions: Map<i64, Region<Session>>
  order: i64[]
  head: i32 = 0
  held: i32 = 0
  reused: i32 = 0
  constructor(live: i32) {
    this.regions = new Map<i64, Region<Session>>()
    this.order = new Array<i64>(live)
  }
  get(id: i64, out: u8[]): i32 {
    const hit = this.regions.get(id)
    if (hit !== undefined) {
      this.reused = this.reused + 1
      return enterWith(hit, out, serve)
    }
    if (this.held === this.order.length) {
      const old: i64 = this.order[this.head]
      const gone = this.regions.get(old)
      if (gone !== undefined) {
        free(gone)
        this.regions.delete(old)
      }
    } else {
      this.held = this.held + 1
    }
    const r = regionWith(id, open)
    this.regions.set(id, r)
    this.order[this.head] = id
    this.head = (this.head + 1) % this.order.length
    return enterWith(r, out, serve)
  }
  hits(id: i64): i32 {
    const r = this.regions.get(id)
    return r === undefined ? -1 : enter(r, hitsOf)
  }
}

/** A list built inside a region of its own; its sum is all that leaves. */
const build = (): i32[] => {
  const xs: i32[] = []
  for (let i: i32 = 1; i <= 10; i++) {
    xs.push(i * i)
  }
  return xs
}

const sum = (xs: i32[]): i32 => {
  let total: i32 = 0
  for (const x of xs) {
    total = total + x
  }
  return total
}

export const main = (): i32 => {
  const cache = new Cache(3)
  const out = new Array<u8>(8)
  let served: i32 = 0
  for (let round: i32 = 0; round < 50; round++) {
    // Each id twice in a row: the second `get` re-enters a live region.
    const id: i64 = toI64((round >> 1) % 5)
    served = served + cache.get(id, out)
  }
  console.log(`served ${served}`)
  console.log(`reused ${cache.reused}`)
  console.log(`last byte ${out[0]}`)
  console.log(`hits of 4: ${cache.hits(toI64(4))}`)
  console.log(`hits of 0: ${cache.hits(toI64(0))}`)
  const squares = region(build)
  console.log(`sum ${enter(squares, sum)}`)
  free(squares)
  return 0
}
