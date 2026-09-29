// `import { Conn as Handle }`: an alias has no symbol, so unlike a class it may
// be renamed, and `Handle` is `Socket | null` exactly as `Conn` is.
import { Conn as Handle, dial } from "./conn";

const fdOf = (h: Handle): i32 => (h === null ? -1 : h.fd);

export const main = (): number => {
  const handles: Handle[] = [dial(4), dial(0), null];
  let sum = 0;
  for (const h of handles) {
    sum = sum + fdOf(h);
  }
  console.log(`${sum}`);
  return sum === 2 ? 0 : 1;
};
