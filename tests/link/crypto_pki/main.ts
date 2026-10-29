// `nish/crypto/pki` against OpenSSL's certificates (fixtures.ts says how they
// were made): the chains it accepts, a refusal for each check it makes, its
// bounds at their limits and one past, its name constraints, and RFC 6125
// hostname matching. `crypto_pki_f64` runs the same suites in f64 mode.
import { accepts, bounds, constraints, hostnames, reasons, refusals } from "./suites"

export const main = (): i32 =>
  accepts("") + refusals("") + constraints("") + bounds("") + hostnames("") + reasons("")
