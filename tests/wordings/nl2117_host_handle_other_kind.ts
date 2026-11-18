// A handle of one kind is not a handle of another, as an argument.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
const draw = (c: Canvas): i32 => {
  return 1
};
export const f = (s: Socket): i32 => {
  return draw(s)
};
