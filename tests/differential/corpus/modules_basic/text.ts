import { square } from "./math";

export function shout(s: string): string {
  return s + "!";
}

export function join(a: string, b: string): string {
  return `${a} ${b} (${square(a.length + b.length)})`;
}
