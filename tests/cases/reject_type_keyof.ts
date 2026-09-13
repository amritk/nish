// `keyof` names a set of strings at compile time, and there is no such type here.
export interface Point {
  x: number;
}

export const run = (k: keyof Point): number => 0;
