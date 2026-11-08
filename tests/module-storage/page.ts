// The page half of tests/module-storage: it writes the world through the
// views `layout` places, steps the module, and reads the world back. Run by
// tests/run.js's module-storage section, which loads the module and passes it in
// tsc checks it against main.d.ts alone.
import type { Layout, Module } from "./main"

export const run = (m: Module, grow: boolean): string => {
  const b: Layout["bodies"] = m.layout.bodies
  const v = m.views()
  // The byte address of body `i`'s field `off`.
  const field = (i: number, off: number): number => b.at + i * b.stride + off

  // The page writes: input[0], a live body 2 moving at 1.5, and scale[0].
  v.storage.input[0] = 3
  v.u8[field(2, b.fields.alive)] = 1
  v.f32[field(2, b.fields.vx) >> 2] = 1.5
  v.storage.scale[0] = 0.25
  // The module writes: body 5 wakes at -2.
  m.spawn(5, -2)
  const moved = [m.step(), m.step()]
  let grown = "-"
  if (grow) {
    // Growing replaces the buffer: the old views detach, the next ones see the same world.
    try {
      m.memory.grow(1)
      grown = `${v.buffer.byteLength === 0} ${m.views() !== v} ${m.views().storage.scale[1]}`
    } catch {
      grown = `fixed ${v.buffer.byteLength > 0} ${m.views() === v}`
    }
  }
  const now = m.views()
  return [
    moved.join(","),
    m.xOf(2),
    m.xOf(5),
    now.u32[field(2, b.fields.hits) >> 2],
    now.f32[field(5, b.fields.x) >> 2],
    now.storage.scale[1],
    grown,
  ].join(" ")
}
