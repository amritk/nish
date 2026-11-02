// What the region rules let leave a region is copied, not pointed at: a
// number, a boolean, an enum and another region's handle. Each is read after
// its region is freed and after `churn` has reused the freed memory
// (.claude/selfhost.md, "A rule that lets a value outlive its scope").
import { Region, enter, enterWith, free, region, regionWith } from "nish:region"

enum Mood {
  Calm,
  Busy,
}

class Room {
  n: i32
  w: f64
  open: boolean
  mood: Mood
  constructor(n: i32) {
    this.n = n
    this.w = toF64(n) / 4
    this.open = n % 2 === 0
    this.mood = n > 2 ? Mood.Busy : Mood.Calm
  }
}

class Out {
  ns: i32[]
  ws: f64[]
  opens: boolean[]
  moods: Mood[]
  constructor() {
    this.ns = [0]
    this.ws = [0]
    this.opens = [false]
    this.moods = [Mood.Calm]
  }
}

const make = (n: i32): Room => new Room(n)

const copyOut = (room: Room, out: Out): i32 => {
  out.ns[0] = room.n
  out.ws[0] = room.w
  out.opens[0] = room.open
  out.moods[0] = room.mood
  return room.n
}

const nOf = (room: Room): i32 => room.n
const wOf = (room: Room): f64 => room.w
const openOf = (room: Room): boolean => room.open
const moodOf = (room: Room): Mood => room.mood

function churn(): i32 {
  const t: string[] = []
  for (let i = 0; i < 4000; i++) {
    t.push(`${i}`)
  }
  return t.join("").length
}

export const main = (): i32 => {
  const out = new Out()
  const held: Region<Room>[] = []
  const r = regionWith(4, make)
  const n = enter(r, nOf)
  const w = enter(r, wOf)
  const open = enter(r, openOf)
  const mood = enter(r, moodOf)
  enterWith(r, out, copyOut)
  held.push(regionWith(3, make))
  free(r)
  console.log(`${churn() > 0}`)
  console.log(`${n} ${w} ${open} ${mood === Mood.Busy}`)
  console.log(`${out.ns[0]} ${out.ws[0]} ${out.opens[0]} ${out.moods[0] === Mood.Busy}`)
  console.log(`${enter(held[0], nOf)}`)
  free(held[0])
  return 0
}
