const CLASS: readonly u8[] = [0, 1, 2, 1, 0, 3, 3, 2]

export const classOf = (c: u8): u8 => CLASS[c & 7]
