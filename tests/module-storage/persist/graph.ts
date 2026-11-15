// WP55 root storage: the shapes a compaction must keep exactly — cycles, an
// object two slots and two root storages share, arrays of arrays, and empty
// arrays and strings — under a call that leaves enough garbage to compact
// every time. `check` answers 0 when every identity and back pointer holds
// after the moves, a negative code naming the first that does not; `draw` is
// a checksum the page works out on its own (tests/persist/drive.mjs, graph).

class Node {
  id: i32
  tag: string
  parent: Node | null = null
  kids: Node[]

  constructor(id: i32, tag: string) {
    this.id = id
    this.tag = tag
    this.kids = []
  }
}

class Hub {
  top: Node
  pin: Node | null = null
  grid: string[][]
  nums: i32[][]
  empty: i32[]
  blank: string
  reset: i32[]
  trash: i32[]
  step: i32 = 0
  noise: i32 = 0

  constructor() {
    this.top = new Node(0, "top")
    // A cycle of one: the root reaches itself.
    this.top.parent = this.top
    this.grid = []
    this.nums = []
    this.empty = []
    // Zero bytes, made at run time: an empty block the compactor must keep.
    this.blank = this.top.tag.slice(3)
    this.reset = []
    this.trash = []
  }
}

// One hub, held by both slots of `hubs` and by `other`.
const hubs = new Array<Hub | null>(2)
const other = new Array<Hub | null>(1)

/** Start a fresh hub in all three slots. */
export const init = (): void => {
  const h = new Hub()
  hubs[0] = h
  hubs[1] = h
  other[0] = h
}

/** One step: a kid and its grandkid, a row of each grid, the reset list, garbage. */
export const step = (): void => {
  const h = hubs[0]
  if (h === null) {
    return
  }
  h.step = h.step + 1
  const t = h.step
  const kid = new Node(t, `k${t}`)
  // A cycle of two: top lists the kid, the kid points back at top.
  kid.parent = h.top
  const grand = new Node(-t, "g")
  grand.parent = kid
  kid.kids.push(grand)
  h.top.kids.push(kid)
  if (h.top.kids.length > 32) {
    h.top.kids = h.top.kids.slice(1)
  }
  // Shared: the hub and top's last kid are one object.
  h.pin = kid
  const n = t % 4
  const row: string[] = []
  const nums: i32[] = []
  for (let j = 0; j < n; j++) {
    row.push(`r${t}.${j}`)
    nums.push(t * j)
  }
  h.grid.push(row)
  h.nums.push(nums)
  if (h.grid.length > 8) {
    h.grid = h.grid.slice(1)
    h.nums = h.nums.slice(1)
  }
  if (t % 10 === 0) {
    h.reset = []
  } else {
    h.reset.push(t)
  }
  // Garbage: some 80 KB the hub holds until the next step replaces it. A
  // block only the call used would be reclaimed before the keep sees it; this
  // one is kept for a call and then dropped, so every other keep or so
  // compacts.
  h.trash = []
  for (let i = 0; i < 9999; i++) {
    h.trash.push(i + t)
  }
  let s = 0
  for (const v of h.trash) {
    s = s + v
  }
  h.noise = s % 1000
}

/** Whether `a` is the object `b`. */
const same = (a: Node | null, b: Node): boolean => {
  if (a === null) {
    return false
  }
  return a === b
}

/** 0 when every identity and back pointer survived the moves, else which did not. */
export const check = (): i32 => {
  const h = hubs[0]
  const h1 = hubs[1]
  const h2 = other[0]
  if (h === null || h1 === null || h2 === null) {
    return -1
  }
  if (h1 !== h || h2 !== h) {
    return -2
  }
  if (!same(h.top.parent, h.top)) {
    return -3
  }
  const kids = h.top.kids
  for (const kid of kids) {
    if (!same(kid.parent, h.top) || kid.kids.length !== 1) {
      return -4
    }
    const grand = kid.kids[0]
    if (!same(grand.parent, kid) || grand.id !== -kid.id || grand.tag !== "g") {
      return -5
    }
    if (kid.tag !== `k${kid.id}`) {
      return -6
    }
  }
  if (kids.length > 0 && !same(h.pin, kids[kids.length - 1])) {
    return -7
  }
  if (h.empty.length !== 0 || h.blank.length !== 0 || h.blank !== "") {
    return -8
  }
  if (h.grid.length !== h.nums.length) {
    return -9
  }
  let k = 0
  while (k < h.grid.length) {
    const t = h.step - h.grid.length + 1 + k
    const row = h.grid[k]
    const nums = h.nums[k]
    if (row.length !== t % 4 || nums.length !== t % 4) {
      return -10
    }
    for (let j = 0; j < row.length && j < nums.length; j++) {
      if (row[j] !== `r${t}.${j}` || nums[j] !== t * j) {
        return -11
      }
    }
    k = k + 1
  }
  return 0
}

/** A checksum of the hub the page compares with its own count. */
export const draw = (): i32 => {
  const h = hubs[0]
  if (h === null) {
    return -1
  }
  let sum = 0
  for (const kid of h.top.kids) {
    sum = sum + kid.id + kid.tag.length
  }
  let k = 0
  while (k < h.grid.length) {
    const row = h.grid[k]
    sum = sum + row.length
    for (const cell of row) {
      sum = sum + cell.length
    }
    for (const v of h.nums[k]) {
      sum = sum + v
    }
    k = k + 1
  }
  for (const v of h.reset) {
    sum = sum + v + 1
  }
  return sum + h.empty.length + h.blank.length + h.step * 7 + h.noise
}
