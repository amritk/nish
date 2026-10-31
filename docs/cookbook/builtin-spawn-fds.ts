// `spawnWithFds` is one call into runtime-os.c, the argument vector and the
// descriptors passed as their headers. `argv` is a plain `string[]` with no
// mark on its parameter, as `spawn`'s is; the descriptors are only read, so
// they may be `readonly` and the parameter says `nocapture readonly`. The child
// holds `fds[i]` as descriptor `3 + i`; the answer is its pid or a negative
// errno, which `waitPid` takes as `spawn`'s.
import { spawnWithFds } from "nish:process"

export const start = (argv: string[], fds: readonly i32[]): i32 => spawnWithFds(argv, fds)
