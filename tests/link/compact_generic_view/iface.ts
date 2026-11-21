// WP48 stage 2a: an interface whose field is a link, in a module of its own.
import { Cell } from "./cell"
export interface Slot { item: Cell | null; tag: i32 }
export const slot = (s: Slot): i32 => { const i = s.item; return i === null ? -1 : i.n + s.tag }
export class S implements Slot {
  item: Cell | null = null
  tag: i32 = 9
}
