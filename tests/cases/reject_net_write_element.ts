// WP34 N5: `netWrite` sends bytes from a u8[]; a string is not one, whatever
// TypeScript's `socket.write` would take.
export const main = (): number => netWrite(1, "hello", 0, 5);
