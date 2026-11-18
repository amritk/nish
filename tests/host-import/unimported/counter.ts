// The shape of create-vite's template-vanilla-ts/src/counter.ts: the page
// alone calls `setupCounter`, whose element no wasm import carries, so the
// build, which imports `first` alone, never reads it.
export function setupCounter(element: HTMLElement): void {
  let counter = 0
  const setCounter = (count: number) => {
    counter = count
    element.innerHTML = `count is ${counter}`
  }
  element.addEventListener("click", () => setCounter(counter + 1))
  setCounter(0)
}

export function first(x: i32): i32 {
  return x + 1
}
