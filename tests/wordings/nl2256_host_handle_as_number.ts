// No cast takes a handle out to a number.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
export const f = (c: Canvas): number => {
  return c as number
};
