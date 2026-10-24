// `readStdin` takes the buffer, the offset and the length.
export const test = (): number => { const b: u8[] = new Array<u8>(4); return readStdin(b, 0); };
