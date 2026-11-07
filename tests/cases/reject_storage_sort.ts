// Moving data in place (`sort`) is refused like any other method.
const xs = new Array<i32>(4)

export const main = (): void => {
  xs.sort((a, b) => a - b)
}
