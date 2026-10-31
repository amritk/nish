// The child's argv is a string[], as `spawn`'s is.
export const main = (): number => spawnWithFds([1, 2], [3]);
