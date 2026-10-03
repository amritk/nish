// #386: `lstatOwnerModeSync` calls runtime-host.c, which is empty on a wasm32 build.
export const ownerMode = (p: string): i64 => lstatOwnerModeSync(p);
