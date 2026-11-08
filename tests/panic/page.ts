// The page half of tests/panic: each line drives one way the module ends and
// records what the page saw. Run by tests/run.js's `panic` section, which
// passes the loader, the bytes and the build's `.sites.json`; tsc checks it
// against main.d.ts alone.
import type * as Loader from "./main"
import type { Module, Panic } from "./main"

type Sites = readonly { kind: string; at: string }[]

/** A module with its panics recorded, and its storage count read through the views. */
const open = (l: typeof Loader, bytes: BufferSource, sites: Sites, seen: Panic[], back: { m: Module | null }, throws: boolean): Module =>
  l.loadSync(bytes, {
    sites,
    onPanic: (p: Panic) => {
      seen.push(p)
      // A reporter that calls back in is refused: the module is already dead.
      if (back.m !== null && p.kind === "panic") {
        try {
          back.m.bump()
        } catch (e) {
          seen.push({ message: `onPanic re-entry: ${e instanceof l.NishPanic}`, kind: "note", site: -1 })
        }
      }
    },
    host: {
      reenter: () => (back.m === null ? 0 : back.m.bump()),
      boom: () => {
        if (throws) throw new Error("the page threw")
      },
    },
  })

/** The name and message a call ended with. */
const ended = (l: typeof Loader, call: () => unknown): string => {
  try {
    return `ok ${String(call())}`
  } catch (e) {
    if (e instanceof l.NishPanic) return `NishPanic(${e.kind}) ${e.message}`
    if (e instanceof l.NishReentry) return `NishReentry ${e.message}`
    return `${(e as Error).name} ${(e as Error).message}`
  }
}

/**
 * `markOf` reads the arena's mark (`nish_arena_mark`) straight from the
 * instance, which a page never needs; the driver hands it in for `mark`.
 */
export const run = (l: typeof Loader, bytes: BufferSource, sites: Sites, what: string, markOf: () => bigint): string[] => {
  const seen: Panic[] = []
  const back: { m: Module | null } = { m: null }
  const m = open(l, bytes, sites, seen, back, what === "thrown")
  back.m = m
  const out: string[] = []
  const count = (): number => m.views().storage.count[0]
  if (what === "index") {
    out.push(ended(l, () => m.cell(1)))
    out.push(ended(l, () => m.cell(9)))
    out.push(ended(l, () => m.bump()))
  } else if (what === "overflow") {
    out.push(ended(l, () => m.sum(2147483647, 1)))
  } else if (what === "fail") {
    out.push(ended(l, () => m.fail()))
  } else if (what === "exit") {
    out.push(ended(l, () => m.leave(3)))
  } else if (what === "nested") {
    out.push(ended(l, () => m.bump()))
    out.push(ended(l, () => m.nested()))
    out.push(`count ${count()}`)
  } else if (what === "thrown") {
    out.push(ended(l, () => m.thrown()))
    out.push(ended(l, () => m.bump()))
  } else if (what === "flat") {
    const before = m.memory.buffer.byteLength
    let last = 0
    for (let i = 0; i < 2000; i++) last = m.fill(4096)
    out.push(`last ${last} grew ${m.memory.buffer.byteLength - before > 65536}`)
  } else if (what === "mark") {
    // Every export runs between a mark and its release, an array result
    // decoded inside them, so the mark after each call is the one before it.
    // (A panic skips the release: the module is dead, its arena never read.)
    // The first allocation places the arena; the mark is read from there on.
    m.fill(4)
    const base = markOf()
    const calls: [string, () => unknown][] = [
      ["bump", () => m.bump()],
      ["cell", () => m.cell(2)],
      ["sum", () => m.sum(40, 2)],
      ["fill", () => m.fill(4096)],
      ["row", () => m.row(5).join(",")],
      ["row", () => m.row(3000).length],
    ]
    for (const [name, call] of calls) {
      const result = ended(l, call)
      const after = markOf()
      out.push(`${name} ${result} ${after === base ? "held" : `moved ${after - base}`}`)
    }
  } else if (what === "badarg") {
    // A bad argument is refused before the module is entered: it stays alive.
    const loose = m as unknown as { wide: (x: unknown) => bigint; narrow: (b: unknown) => number }
    out.push(ended(l, () => loose.wide(5)))
    out.push(ended(l, () => loose.narrow(5n)))
    out.push(ended(l, () => m.wide(7n)))
    out.push(ended(l, () => m.narrow(300)))
    out.push(ended(l, () => m.bump()))
  } else if (what === "oom") {
    out.push(ended(l, () => m.fill(1 << 20)))
  }
  for (const p of seen) out.push(`seen ${p.kind} ${p.site} ${p.message}`)
  return out
}
