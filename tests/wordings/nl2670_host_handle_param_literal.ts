// A parameter's default may not forge a handle either: only `0`, the one that names nothing.
type Canvas = HostHandle<"canvas">
export function f(c: Canvas = 7): Canvas {
  return c
}
