// WP34 N3: no file system on a wasm32 build.
export const mtime = (p: string): f64 => statMtimeSync(p);
