// An `Http1Config` cap no connection could work with panics when the
// connection is made (exit 1, "Http1Config.chunkSize: 0 is outside 1 to
// 1073741824" on stderr): a chunk size of zero would never read a byte, and
// the program would wait on it forever. Stdout stops at the line before.
import { Http1Config, Http1Connection } from "nish/net/http1-server";

export const main = (): i32 => {
  const config = new Http1Config();
  config.chunkSize = 0;
  console.log("making a connection with a chunk size of 0");
  const conn = new Http1Connection(config);
  console.log(`unreachable: the cap was accepted (${conn.inputLimit()})`);
  return 0;
};
