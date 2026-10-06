// What every carrier's checks share: how many rounds on a warm connection
// the arena is measured over, after how many unmeasured ones.

/** Rounds after the warm-up, every server wake measured. */
export const ROUNDS: i32 = 50;

/** Rounds first, unmeasured, so that every buffer a connection grows once has grown. */
export const WARM: i32 = 5;

/** Round `k`'s payload: 72 printable bytes, different every round. */
export const roundText = (k: i32): string => `round ${k} of the warm connection: abcdefghijklmnopqrstuvwxyz0123456789`;
