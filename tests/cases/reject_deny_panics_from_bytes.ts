// --deny-panics refuses `String.fromBytes`, whose range check no proof removes
// yet, with advice of its own rather than the bare member name.
export const head = (bytes: u8[]): string => String.fromBytes(bytes, 0, 2);
