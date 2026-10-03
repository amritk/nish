// NL1001: `throw` has no mechanical rewrite — a `Result` or a `panic` is the
// author's choice, not the compiler's — so the diagnostic carries no fix and
// `nish --fix` leaves the file as it is.
export const fail = (): i32 => {
  throw new Error("no")
}
