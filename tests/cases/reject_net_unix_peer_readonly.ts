// `peerCredentials` writes pid, uid and gid into `out`, so a readonly i32[] is
// refused.
const peer = (out: readonly i32[]): i32 => peerCredentials(3, out);

export const main = (): number => peer([0, 0, 0]);
