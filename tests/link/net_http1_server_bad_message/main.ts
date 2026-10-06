// A `maxMessage` one past the largest the connection accepts panics when the
// connection is made (exit 1, "Http1Config.maxMessage: 1073741811 is outside 0
// to 1073741810" on stderr): `WsDecoder` buffers a whole frame, header
// included, and its input stops growing at 2^30, so a peer could otherwise
// send a frame that this cap allows and that buffer cannot hold. Stdout stops
// at the line before.
import { Http1Config, Http1Connection } from "nish/net/http1-server";

export const main = (): i32 => {
  const config = new Http1Config();
  config.maxMessage = 1073741811;
  console.log("making a connection with a maxMessage of 2^30 - 13");
  const conn = new Http1Connection(config);
  console.log(`unreachable: the cap was accepted (${conn.inputLimit()})`);
  return 0;
};
