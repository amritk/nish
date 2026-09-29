// A builtin reached through a `nish:` import is the same allocation under
// another name, so a function returning `bytesOf(path)` must keep the arena
// exactly as one returning `readFileBytesSync(path)` does (WP6). Escape
// analysis once read the identifier's own text, which under a rename is the
// local name, and gave both functions a scope whose `nish_arena_release`
// rewound past the bytes the caller was about to read.
import { readFileBytesSync as bytesOf, readFileSyncOrNull as textOf } from "nish:fs";

export const load = (path: string): u8[] | null => {
  const label = `read ${path}`;
  console.log(label);
  return bytesOf(path);
};

export const text = (path: string): string | null => {
  const label = `read ${path}`;
  console.log(label);
  return textOf(path);
};
