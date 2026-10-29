// `nish/crypto/pki` in a program compiled with `--number-mode f64`, where
// every bare `number` and every unannotated literal is an `f64`. The module
// spells its widths, so its answers must not move: `crypto_pki`'s suites,
// whole.
import { accepts, bounds, constraints, hostnames, reasons, refusals } from "../crypto_pki/suites"

export const main = (): i32 =>
  accepts(" (f64 mode)") +
  refusals(" (f64 mode)") +
  constraints(" (f64 mode)") +
  bounds(" (f64 mode)") +
  hostnames(" (f64 mode)") +
  reasons(" (f64 mode)")
