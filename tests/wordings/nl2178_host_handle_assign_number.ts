// A handle variable holds a handle, and a number is not one.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
export function f(): Canvas {
  let c: Canvas = 0
  c = 3
  return c
}
