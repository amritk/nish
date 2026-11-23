// Malformed input to `nish/net/websocket`'s frame writer is answered, not
// panicked on, and the program builds under the no-panic default (`strict`):
// a window outside the payload answers null or WS_REFUSED, as do a negative
// length and a mask that is not 4 bytes, and a buffer too small for the frame
// answers WS_NO_ROOM. Before WP82 S8 each of these calls reached an unproven
// index or overflow site in the module, so the build was refused without
// `--allow-panics`. (The key check still reaches a kept site in
// `std/crypto/base64url.ts`, so it is not called here.)
import {
  WS_NO_ROOM,
  WS_OP_BINARY,
  WS_REFUSED,
  websocketFrame,
  websocketFrameSize,
  websocketWriteFrame,
} from "nish/net/websocket";

export const main = (): i32 => {
  const payload: u8[] = [1, 2, 3, 4];
  const off: i32 = 3;
  const len: i32 = 2;
  const past: u8[] | null = websocketFrame(true, WS_OP_BINARY, payload, off, len, null);
  console.log(`bytes 3 to 5 of 4: ${past === null ? "null" : "a frame"}`);
  const negative: i32 = -7;
  console.log(`size of -7: ${websocketFrameSize(negative, false) === WS_REFUSED ? "WS_REFUSED" : "a size"}`);
  const small: u8[] = [0, 0, 0];
  const room: i32 = websocketWriteFrame(small, 0, true, WS_OP_BINARY, payload, 0, 4, null);
  console.log(`4 bytes into a buffer of 3: ${room === WS_NO_ROOM ? "WS_NO_ROOM" : `${room}`}`);
  const shortMask: u8[] = [9, 9, 9];
  const masked: i32 = websocketWriteFrame(small, 0, true, WS_OP_BINARY, payload, 0, 1, shortMask);
  console.log(`a 3-byte mask: ${masked === WS_REFUSED ? "WS_REFUSED" : `${masked}`}`);
  const fits: u8[] = [0, 0, 0, 0, 0, 0];
  console.log(`4 bytes into a buffer of 6: ${websocketWriteFrame(fits, 0, true, WS_OP_BINARY, payload, 0, 4, null)}`);
  return 0;
};
