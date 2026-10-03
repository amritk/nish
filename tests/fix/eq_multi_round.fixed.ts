// Phase 0 reports one diagnostic per module, so each loose equality here is
// reported, and fixed, only once the one before it is: three rounds of
// `nish --fix` (`eq_multi_round.rounds`), each rewriting the file once.
export const anyTie = (a: i32, b: i32, c: i32): boolean => a === b || b !== c || c === a
