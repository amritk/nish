export interface Count {
  n: number
}

export const bump = (c: Count): number => c.n + 1
