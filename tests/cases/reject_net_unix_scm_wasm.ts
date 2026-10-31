// A descriptor passed over a socket, and the credentials of the process at its
// other end, are the operating system's, so a wasm32 build refuses all three.
export const send = (): i32 => sendFd(3, 4, [1], 0, 1);
export const recv = (): i32 => recvFd(3, new Array<u8>(1), 0, 1, [0]);
export const peer = (): i32 => peerCredentials(3, [0, 0, 0]);
