export enum Kind {
  Low = 1,
  High = 7,
}

export const isHigh = (k: Kind): boolean => k === Kind.High;
