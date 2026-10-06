// A `maxTarget` and `maxHeaderBytes` whose head would outgrow the parser's
// buffers panic when the connection is made (exit 1, "Http1Config.maxTarget +
// maxHeaderBytes: 1073741781 is outside 1 to 1073741780" on stderr): the head
// holds the request line beside the header section, and stops growing at
// 2^30, so a peer could otherwise send a head these caps allow and that buffer
// cannot hold. Stdout stops at the line before.
import { Http1Config, Http1Connection } from "nish/net/http1-server";

export const main = (): i32 => {
  const config = new Http1Config();
  config.maxTarget = 1073741717;
  config.maxHeaderBytes = 64;
  console.log("making a connection whose head could need 2^30 - 43 bytes");
  const conn = new Http1Connection(config);
  console.log(`unreachable: the caps were accepted (${conn.inputLimit()})`);
  return 0;
};
