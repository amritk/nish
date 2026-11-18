// A field's default may not forge a handle: only `0`, the one that names nothing.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
class Slot {
  c: Canvas = 7
}
export const f = (): Canvas => {
  return new Slot().c
};
