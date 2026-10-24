// The vendored SQLite runs, not only links: `sqlite3_initialize` sets up its
// operating-system layer (the VFS), `sqlite3_open` opens an in-memory database
// through it, and `sqlite3_complete` runs the SQL tokenizer. tests/run.js also
// builds this program for `--profile wasi` and runs it under Node's WASI, so a
// wasi build of the amalgamation that links but cannot open a database fails.
// `sqlite3_open` writes the connection into `slot`, which `sqlite3_malloc`
// gives (its size is an `int`, so one declaration fits wasm32 and a 64-bit
// target alike); nothing here reads the connection back out of it, so it stays
// open until the program exits.
declare function sqlite3_libversion(): string;
declare function sqlite3_initialize(): i32;
declare function sqlite3_malloc(n: i32): CPtr | null;
declare function sqlite3_open(filename: string, ppDb: CPtr): i32;
declare function sqlite3_complete(sql: string): i32;

export const main = (): i32 => {
  console.log(sqlite3_libversion());
  console.log(`initialize ${sqlite3_initialize()}`);
  const slot = sqlite3_malloc(8);
  if (slot === null) {
    return 1;
  }
  console.log(`open :memory: ${sqlite3_open(":memory:", slot)}`);
  console.log(`complete ${sqlite3_complete("select 1;")} ${sqlite3_complete("select")}`);
  return 0;
};
