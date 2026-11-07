// An object literal's field forges no handle either.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
interface Slot {
  c: Canvas
}
export function f(): Canvas {
  const s: Slot = { c: 7 }
  return s.c
}
