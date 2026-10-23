// A root module one directory down, imported by a relative specifier.

export const tally = (what: string, n: number): string => `${what} ${"||||||||||".substring(0, n)}`
