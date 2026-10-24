// The other module of `main.ts`, which declares the C functions it calls.
declare function sqlite3_libversion_number(): i32;
declare function sqlite3_threadsafe(): i32;

export const version = (): string => `${sqlite3_libversion_number()} ${sqlite3_threadsafe()}`;
