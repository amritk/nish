// NL2785: a destructuring head walks an array only.
export const main = (): void => {
  const s = new Set<string>()
  for (const [c] of s) {
    console.log(c)
  }
}
