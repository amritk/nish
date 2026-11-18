export enum Color {
  Red,
  Green,
}
export const paint = (name: string, c: Color = Color.Green, loud: boolean = false): string => {
  const tag = c === Color.Green ? "green" : "red"
  return loud ? `${name}:${tag}!` : `${name}:${tag}`
};
export const join = (sep: string, ...parts: string[]): string => {
  return parts.join(sep)
};
export const first = <T>(fallback: T, ...xs: T[]): T => {
  return xs.length > 0 ? xs[0] : fallback
};
export class Style {
  loud: boolean = true
}
export const shout = (s: string, style: Style | null = null, end: string | null = null): string => {
  const body = style !== null && style.loud ? `${s}!` : s
  return end !== null ? `${body}${end}` : body
};
