// A template at the start of a line is not a new statement: TypeScript reads
// `tag` and the template as one tagged template, so a missing semicolon before
// it is the same error it is on one line.
const tag = (s: string): string => s

export const main = (): number => {
  const s = tag
    `x`
  console.log(s)
  return 0
}
