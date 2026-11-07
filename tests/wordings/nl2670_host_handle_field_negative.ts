// Nor may a negative one: `0` is the one number a handle field starts as.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
class Slot {
  c: Canvas = -5
}
export function f(): Canvas {
  return new Slot().c
}
