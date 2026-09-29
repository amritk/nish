// WP34 N3: no signals on a wasm32 build.
export const fd = (): i32 => signalFd();
