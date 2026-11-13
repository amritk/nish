// WP55 root storage: the layouts a compaction must read exactly, where a
// wrong offset or stride would corrupt silently — an array of records kept in
// place (each element's fields traced inside the array's data), a field typed
// as a union and one as a nullable union (traced by the variant the tag
// names), an array of nullable objects, and arrays of 1-, 8- and 8-byte
// elements beside the usual 4. Each call leaves garbage enough to compact
// most keeps. `check` answers 0 when everything the steps built is still
// there, a negative code naming the first that is not; `draw` is a checksum
// tests/persist/drive.mjs (shapes) compares with an instance that never
// compacts.

enum Kind {
  Dot,
  Box,
}

interface Dot {
  readonly kind: Kind.Dot
  x: i32
}

interface Box {
  readonly kind: Kind.Box
  side: i32
  label: string
}

/** A record no class implements: an array of them keeps each in place. */
interface Cell {
  at: i32
  half: f64
  name: string
}

class Item {
  id: i32
  tag: string

  constructor(id: i32, tag: string) {
    this.id = id
    this.tag = tag
  }
}

class World {
  cells: Cell[]
  shape: Dot | Box
  maybe: Dot | Box | null = null
  items: (Item | null)[]
  bytes: u8[]
  reals: f64[]
  bigs: i64[]
  trash: i32[]
  step: i32 = 0
  noise: i32 = 0

  constructor(shape: Dot | Box) {
    this.cells = []
    this.shape = shape
    this.items = []
    for (let i = 0; i < 8; i++) {
      const none: Item | null = null
      this.items.push(none)
    }
    this.bytes = []
    this.reals = []
    this.bigs = []
    this.trash = []
  }
}

const world = new Array<World | null>(1)

/** A step's i64 is past what 32 bits hold. */
const BIG: i64 = 10000000000

/** The shape step `t` stores: a box with a label on even steps, a dot on odd. */
const shapeAt = (t: i32): Dot | Box => {
  if (t % 2 === 0) {
    const b: Box = { kind: Kind.Box, side: t, label: `b${t}` }
    return b
  }
  const d: Dot = { kind: Kind.Dot, x: -t }
  return d
}

/** What `maybe` holds after step `t`: nothing on every third step. */
const maybeAt = (t: i32): Dot | Box | null => {
  if (t % 3 === 0) {
    return null
  }
  return shapeAt(t + 1)
}

export const init = (): void => {
  world[0] = new World(shapeAt(0))
}

/** One step: a cell, both shapes, an item slot, a value of each number array, garbage. */
export const step = (): void => {
  const w = world[0]
  if (w === null) {
    return
  }
  w.step = w.step + 1
  const t = w.step
  const cell: Cell = { at: t, half: toF64(t) * 0.5, name: `c${t}` }
  w.cells.push(cell)
  if (w.cells.length > 16) {
    w.cells = w.cells.slice(1)
  }
  w.shape = shapeAt(t)
  w.maybe = maybeAt(t)
  w.items[t % 8] = t % 5 === 0 ? null : new Item(t, `i${t}`)
  if (t % 37 === 0) {
    w.bytes = []
    w.reals = []
    w.bigs = []
  }
  w.bytes.push(toU8(t % 256))
  w.reals.push(toF64(t) * 0.25)
  w.bigs.push(BIG + toI64(t))
  // Garbage the world holds for one call: some 40 KB, so most keeps compact.
  w.trash = []
  for (let i = 0; i < 9999; i++) {
    w.trash.push(i ^ t)
  }
  let s = 0
  for (const v of w.trash) {
    s = s + v
  }
  w.noise = s % 1000
}

/** 0 when the shape after step `t` is `s`, else -1. */
const shapeIs = (s: Dot | Box, t: i32): i32 => {
  if (t % 2 === 0) {
    if (s.kind !== Kind.Box || s.side !== t || s.label !== `b${t}`) {
      return -1
    }
    return 0
  }
  if (s.kind !== Kind.Dot || s.x !== -t) {
    return -1
  }
  return 0
}

/** The step that last wrote item slot `i` by step `t`, or 0 if none has. */
const lastWrite = (i: i32, t: i32): i32 => {
  if (t < i || (i === 0 && t < 8)) {
    return 0
  }
  return t - ((t - i) % 8)
}

/** 0 when every value the steps stored is still in place, else which is not. */
export const check = (): i32 => {
  const w = world[0]
  if (w === null) {
    return -1
  }
  const t = w.step
  const n = w.cells.length
  if (n !== (t < 16 ? t : 16)) {
    return -2
  }
  for (let k = 0; k < n; k++) {
    const c = w.cells[k]
    const at = t - n + 1 + k
    if (c.at !== at || c.half !== toF64(at) * 0.5 || c.name !== `c${at}`) {
      return -3
    }
  }
  if (shapeIs(w.shape, t) !== 0) {
    return -4
  }
  const m = w.maybe
  if (t % 3 === 0) {
    if (m !== null) {
      return -5
    }
  } else if (m === null || shapeIs(m, t + 1) !== 0) {
    return -5
  }
  if (w.items.length !== 8) {
    return -6
  }
  for (let i = 0; i < 8; i++) {
    const it = w.items[i]
    const at = lastWrite(i, t)
    if (at === 0 || at % 5 === 0) {
      if (it !== null) {
        return -7
      }
    } else if (it === null || it.id !== at || it.tag !== `i${at}`) {
      return -8
    }
  }
  // The number arrays start over at every 37th step.
  const from = t - (t % 37) > 1 ? t - (t % 37) : 1
  const len = t > 0 ? t - from + 1 : 0
  if (w.bytes.length !== len || w.reals.length !== len || w.bigs.length !== len) {
    return -9
  }
  for (let k = 0; k < w.bytes.length && k < w.reals.length && k < w.bigs.length; k++) {
    const v = from + k
    if (w.bytes[k] !== toU8(v % 256) || w.reals[k] !== toF64(v) * 0.25 || w.bigs[k] !== BIG + toI64(v)) {
      return -10
    }
  }
  return 0
}

/** A checksum of the world, compared with an instance that never compacts. */
export const draw = (): i32 => {
  const w = world[0]
  if (w === null) {
    return -1
  }
  let sum = w.step * 7 + w.noise
  for (const c of w.cells) {
    sum = sum + c.at + c.name.length
  }
  const s = w.shape
  sum = sum + (s.kind === Kind.Box ? s.side + s.label.length : s.x)
  const m = w.maybe
  if (m !== null) {
    sum = sum + (m.kind === Kind.Box ? m.label.length : 1)
  }
  for (const it of w.items) {
    if (it !== null) {
      sum = sum + it.id + it.tag.length
    }
  }
  for (const b of w.bytes) {
    sum = sum + toI32(b)
  }
  return sum + w.reals.length + w.bigs.length
}
