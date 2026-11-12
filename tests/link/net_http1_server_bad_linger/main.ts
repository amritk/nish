// A lingering close of zero milliseconds would close a refused slot on the
// next `expire` before its client could read the refusal, so
// `Http1Config.lingerTimeout` below 1 panics when the connection is made
// (exit 1, "Http1Config.lingerTimeout: 0 is outside 1 to 1073741824" on
// stderr). Stdout stops at the line before.
import { Http1Config, Http1Connection } from "nish/net/http1-server";

export const main = (): i32 => {
  const config = new Http1Config();
  config.lingerTimeout = 0;
  console.log("making a connection with a linger timeout of 0");
  const conn = new Http1Connection(config);
  console.log(`unreachable: the cap was accepted (${conn.inputLimit()})`);
  return 0;
};
