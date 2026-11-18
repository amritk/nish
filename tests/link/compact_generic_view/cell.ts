// WP48 stage 2a: the compact class the other modules link to.
import { Compact } from "nish:compact"
export class Cell implements Compact {
  n: i32 = 0
  next: Cell | null = null
  constructor(n: i32) { this.n = n }
}
