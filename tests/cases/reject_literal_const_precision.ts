// An i64 module constant past 2^53 is already a rounded double, whether it is
// spelled with an exponent or with digits (#267). It used to fold `1e19` as a
// refusal in the wrong words and `99999999999999999999` as wrapped bits.
export const E: i64 = 1e19
export const D: i64 = 99999999999999999999
