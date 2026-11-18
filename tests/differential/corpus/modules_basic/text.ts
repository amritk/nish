import { square } from "./math";

export const shout = (s: string): string => {
  return s + "!";
};

export const join = (a: string, b: string): string => {
  return `${a} ${b} (${square(a.length + b.length)})`;
};
