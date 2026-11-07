// No cast takes a handle out to a number.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
export function f(c: Canvas): number {
  return c as number
}
