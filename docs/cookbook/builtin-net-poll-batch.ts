// WP63: `pollWaitBatch` waits as `pollWait` does for the first event and then,
// on a ring loop, up to `maxWaitMs` more for `minEvents` pairs. It can wait
// forever, so it is `nounwind` alone, and its `ready` travels as its header,
// `nocapture` but not `readonly`; the three counts are plain `i32`s.
import { pollWaitBatch } from "nish:net"

export const batch = (loop: i32, ready: i32[]): i32 => pollWaitBatch(loop, ready, -1, 16, 2)
