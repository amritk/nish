// The range has both ends, always: there is no default end, so a two-argument
// call cannot be read as "to the end of the array".
const f = (bytes: u8[]): string => String.fromBytes(bytes, 0);
