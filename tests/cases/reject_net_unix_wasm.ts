// A Unix-domain socket is a descriptor and a path on the operating system, so
// a wasm32 build refuses it as it refuses every `nish:net` call.
export const listen = (): i32 => unixListen("@nish", 4, 0);
