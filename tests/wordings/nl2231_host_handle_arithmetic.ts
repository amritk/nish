// A handle names something on the page; it is not a number to count with.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
export function f(c: Canvas): Canvas {
  return c + 1
}
