class Options {
  loud: boolean = true
}

const greet = (name: string, opts: Options | null = null): string => {
  if (opts !== null && opts.loud) {
    return `${name}!`
  }
  return name
}

export const main = (): i32 => {
  console.log(greet("a"))
  console.log(greet("b", new Options()))
  return 0
}
