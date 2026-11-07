// No cast makes a handle out of a number: the page gives handles out.
type Canvas = HostHandle<"canvas">
type Socket = HostHandle<"socket">
export function f(): Canvas {
  return 0 as Canvas
}
