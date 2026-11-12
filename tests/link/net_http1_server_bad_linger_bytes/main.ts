// `Http1Config.lingerBytes` of 0 closes a refused slot at once, as before the
// lingering close; below 0 it is the program's mistake and panics when the
// connection is made (exit 1, "Http1Config.lingerBytes: -1 is outside 0 to
// 1073741824" on stderr). Stdout stops at the line before.
import { Http1Config, Http1Connection } from "nish/net/http1-server";

export const main = (): i32 => {
  const config = new Http1Config();
  config.lingerBytes = 0;
  console.log(`a linger of 0 bytes is accepted: ${new Http1Connection(config).inputLimit() > 0}`);
  config.lingerBytes = -1;
  console.log("making a connection with a linger of -1 bytes");
  const conn = new Http1Connection(config);
  console.log(`unreachable: the cap was accepted (${conn.inputLimit()})`);
  return 0;
};
