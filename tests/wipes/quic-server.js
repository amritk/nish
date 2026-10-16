// The QUIC server's long-lived keys' wipes after `opt -O2` (`index.js` says what a
// group is): filled by the stage that releases `QuicListener` and
// `Http3Server` (#430).
export const wipeChecks = []
