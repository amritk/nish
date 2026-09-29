// WP34 N3: the four host facts. Each is one call into runtime-host.c; the array
// `getRandomValues` fills is written, so `key` is `nocapture` but not
// `readonly`, and `readSignal` is the one call that is not `willreturn`.
export const stamp = (): f64 => Date.now()

export const rekey = (key: u8[]): void => {
  crypto.getRandomValues(key)
}

export const renewed = (path: string, since: f64): boolean => statMtimeSync(path) > since

export const nextSignal = (): i32 => readSignal(signalFd())
