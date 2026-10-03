// A SETTINGS_HEADER_TABLE_SIZE is unsigned on the wire, so a negative limit
// can only be the program's mistake, and it panics.
//
// It panics, on stderr, with
//
//     HpackDecoder.setSettingsLimit: a limit of -1
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { HpackDecoder } from "nish/net/hpack";

export const main = (): i32 => {
  const dec = new HpackDecoder(4096, 65536);
  dec.setSettingsLimit(0);
  console.log(`a SETTINGS limit of ${dec.settingsLimit}`);
  dec.setSettingsLimit(-1);
  console.log(`unreachable: a limit of ${dec.settingsLimit}`);
  return 0;
};
