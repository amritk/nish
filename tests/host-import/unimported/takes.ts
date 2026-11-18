// The same host file imported for `setupCounter`: the build reads it now, and
// refuses its element (NL2661).
import { setupCounter } from "./counter"

export const start = (): void => {
  setupCounter()
}
