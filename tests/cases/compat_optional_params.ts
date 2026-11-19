// WP28 C1, `optional-params`: an `x?: T` parameter read through `??`, on a
// function, an arrow and a method, and defaults that are not constants. Each
// default runs in the callee, once per call that leaves its argument out,
// after the arguments and left to right, so the side-effecting `tick` logs
// exactly the calls Node logs, and `scale` reads the `height` the call got.
class Counter {
  n: number = 0
}

const tick = (counter: Counter, label: string): number => {
  counter.n = counter.n + 1
  console.log(`default ${label} evaluated, call ${counter.n}`)
  return counter.n * 10
}

function area(counter: Counter, width: number, height: number = tick(counter, "height"), scale: number = width + height): number {
  return width * height * scale
}

function greet(name: string, greeting?: string): string {
  const word = greeting ?? "hello"
  return `${word}, ${name}`
}

function shout(name: string, suffix?: string): void {
  console.log(`${name}${(suffix) ?? "!"}`)
}

const label = (name: string, prefix?: string): string => `${prefix ?? "item"}:${name}`

class Box {
  tag(name: string, prefix?: string): string {
    return `${prefix ?? "box"}:${name}`
  }
}

function count(first: number, rest: number[] = [first, first + 1]): number {
  return rest.length + first
}

export const main = (): void => {
  const counter = new Counter()
  console.log(area(counter, 2))
  console.log(area(counter, 2, 3))
  console.log(area(counter, 2, 3, 4))
  console.log(area(counter, 1))
  console.log(greet("ada"))
  console.log(greet("ada", "hi"))
  shout("x")
  shout("y", "?")
  console.log(label("x"))
  console.log(label("x", "p"))
  const box = new Box()
  console.log(box.tag("y"))
  console.log(box.tag("y", "q"))
  console.log(count(5))
  console.log(count(5, [1]))
  console.log(`calls ${counter.n}`)
}
