// `spawnWithFds` takes the descriptors to hand the child: without them it is
// `spawn`.
export const main = (): number => spawnWithFds(["true"]);
