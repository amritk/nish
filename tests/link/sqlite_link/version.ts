// The other module of `main.ts`: the C functions of the vendored SQLite, which
// only this module declares. scripts/build.sh reads `declare ... @sqlite3_` in
// any module of the link, not only the one with `main`.
declare function sqlite3_libversion_number(): i32;
declare function sqlite3_libversion(): string;
declare function sqlite3_threadsafe(): i32;

export const version = (): string =>
  `${sqlite3_libversion()} ${sqlite3_libversion_number()} ${sqlite3_threadsafe()}`;
