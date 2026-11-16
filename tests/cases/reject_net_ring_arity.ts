// WP63 S2: `netRingState` reads what the first ring listen decided and takes
// nothing; there is no listener to ask about.
export const main = (): i32 => netRingState(1);
