// The QUIC connection's wipes after `opt -O2` (`index.js` says what a group is):
// filled by the stage that wipes `QuicKeysSlot` and `QuicConnection` (#430).
export const wipeChecks = []
