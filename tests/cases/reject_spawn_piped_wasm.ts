// No processes on a wasm32 build.
export const start = (): i32 => {
  const none: u8[] = [];
  const out: u8[] = [];
  return spawnPiped(["true"], none, out, out);
};
