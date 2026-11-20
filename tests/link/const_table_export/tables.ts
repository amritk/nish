// Two exported constant tables and one private one. An exported table's
// header is not `internal`, so an importing module can name it.
const LIMIT: i32 = 1000

export const HEX: readonly u8[] = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102]
export const STEPS: readonly i32[] = [-LIMIT, -1, 0, 7, LIMIT * 2]
const HIDDEN: readonly u8[] = [3, 1, 4, 1, 5]

export const hidden = (i: u8): u8 => HIDDEN[i % 5]
