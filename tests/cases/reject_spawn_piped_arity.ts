// Four arguments: the vector, the bytes for stdin, and one array per captured
// stream. There are no optional parameters, so a caller with nothing to send
// passes an empty array.
export const main = (): i32 => {
  const out: u8[] = [];
  return spawnPiped(["true"], [], out);
};
