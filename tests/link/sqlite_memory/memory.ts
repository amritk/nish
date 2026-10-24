// The other module of `main.ts`, which alone declares SQLite's functions.
// `sqlite3_open` writes the connection into `slot`, which `sqlite3_malloc`
// gives (its size is an `int`, so one declaration fits wasm32 and a 64-bit
// target alike); nothing here reads the connection back out of it, so it stays
// open until the program exits.
declare function sqlite3_libversion(): string;
declare function sqlite3_initialize(): i32;
declare function sqlite3_malloc(n: i32): CPtr | null;
declare function sqlite3_open(filename: string, ppDb: CPtr): i32;
declare function sqlite3_complete(sql: string): i32;

export const openMemory = (): string => {
  const init = sqlite3_initialize();
  const slot = sqlite3_malloc(8);
  if (slot === null) {
    return "sqlite3_malloc failed";
  }
  const open = sqlite3_open(":memory:", slot);
  const complete = `${sqlite3_complete("select 1;")} ${sqlite3_complete("select")}`;
  return `${sqlite3_libversion()}\ninitialize ${init}\nopen :memory: ${open}\ncomplete ${complete}`;
};
