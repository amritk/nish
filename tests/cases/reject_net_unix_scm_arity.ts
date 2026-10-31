// `sendFd` takes the bytes its descriptor rides on, with their offset and
// length: there is no form without them.
export const main = (): number => sendFd(3, 4);
