// WP34 N3: `signalFd()` takes nothing: the two signals are fixed.
export const test = (): number => signalFd(15);
