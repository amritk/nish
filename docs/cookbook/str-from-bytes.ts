const text = (bytes: u8[], start: number, end: number): string => String.fromBytes(bytes, start, end)

const head = (bytes: readonly u8[]): string => String.fromBytes(bytes, 0, 2)
