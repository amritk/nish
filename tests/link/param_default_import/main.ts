// Defaults on an imported class's constructor and method, and on an imported
// function, are filled in at the call in this module.
import { Greeter, scale } from "./lib"

export function main(): void {
  const g = new Greeter()
  console.log(g.greet())
  console.log(g.greet("nish"))
  console.log(g.greet("nish", "?"))
  const h = new Greeter("hi", 2)
  console.log(h.greet())
  const k = new Greeter("hey")
  console.log(k.greet("you"))
  console.log(scale(4))
  console.log(scale(4, 5))
}
