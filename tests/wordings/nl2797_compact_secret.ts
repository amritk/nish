// WP48 rule 3: a compact class holds no `Secret`.
import { Compact } from "nish:compact"
import { Secret, secret, wipe } from "nish:secret"

class Holder implements Compact {
  readonly k: Secret<u8[]>
  next: Holder | null = null
  constructor(seed: u8) {
    this.k = secret([seed, toU8(2)])
  }
  wipe(): void {
    wipe(this.k)
  }
}

export const main = (): i32 => {
  const h = new Holder(toU8(1))
  h.wipe()
  return 0
}
