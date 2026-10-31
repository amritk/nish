// A class whose constructor and method take string and number defaults, used
// from `main.ts`, another module.
export class Greeter {
  greeting: string
  times: number

  constructor(greeting: string = "hello", times: number = 1) {
    this.greeting = greeting
    this.times = times
  }

  greet(name: string = "world", punct: string = "!"): string {
    let out = ""
    for (let i = 0; i < this.times; i = i + 1) {
      out = out + this.greeting + " " + name + punct
    }
    return out
  }
}

export function scale(x: number, by: number = 3): number {
  return x * by
}
