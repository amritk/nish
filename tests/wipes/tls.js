// The TLS holders' wipes after `opt -O2` (`index.js` says what a group is):
// filled by the stage that wipes `TlsRecordProtection`, `TlsRecordServer` and
// `TlsServer` (#430).
export const wipeChecks = []
