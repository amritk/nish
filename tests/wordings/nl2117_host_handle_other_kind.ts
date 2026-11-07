// A handle of one kind is not a handle of another, as an argument.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
function draw(c: Canvas): i32 {
  return 1
}
export function f(s: Socket): i32 {
  return draw(s)
}
