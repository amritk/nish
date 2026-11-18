// A host module whose bodies are the page's own TypeScript: the DOM, closures,
// a class and an async function, none of which the build reads.
class Tally {
  count: number = 0

  add(n: number): number {
    this.count += n
    return this.count
  }
}

const tally = new Tally()

async function settle(ms: number): Promise<number> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
  return tally.count
}

export function bump(by: i32): i32 {
  const step = (n: number): number => tally.add(n)
  if (typeof document !== "undefined") {
    const label = document.querySelector<HTMLElement>("#tally")
    if (label !== null) {
      label.textContent = `${step(0)}`
    }
  }
  void settle(0).then((n) => n)
  return step(by)
}
