// Both ends are byte offsets, so a start that is a string or a boolean is a
// type error, as a bad end is (`reject_str_from_bytes_index`).
const fromText = (bytes: u8[]): string => String.fromBytes(bytes, "0", 2);

const fromFlag = (bytes: u8[]): string => String.fromBytes(bytes, true, 2);
