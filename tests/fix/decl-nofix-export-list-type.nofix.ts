// `export type { ... }` is a type-only list: no fix.
interface P {
  x: i32
}
export type { P }
