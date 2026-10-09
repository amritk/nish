const leadingZeros = (x: i32): i32 => Math.clz32(x)

const lowestBit = (word: u32): i32 => 31 - Math.clz32(word & (0 - word))
