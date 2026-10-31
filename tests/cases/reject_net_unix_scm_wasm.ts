// A descriptor passed over a socket, and the credentials of the process at its
// other end, are the operating system's, so a wasm32 build refuses them.
export const send = (): i32 => sendFd(3, 4, [1], 0, 1);
