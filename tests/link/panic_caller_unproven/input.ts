// The argument `main` passes to `checked`, read from the command line, so
// no bound the prover knows covers it.
export const argument = (): i32 => toI32(process.argv.length) - 1
