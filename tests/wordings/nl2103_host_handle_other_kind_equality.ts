// A handle of one kind does not compare with a handle of another.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
export function f(c: Canvas, s: Socket): boolean {
  return c === s
}
