// #386: who owns a path, and whether it runs. Each is one call into
// runtime-host.c, ordered with the file system as `statMtimeSync` is. A root is
// trusted when this user owns it and no one else may write to it: the owner in
// the high 32 bits of one `lstat`, and the group and other write bits, 0o022,
// clear in the low ones.
export const trusted = (root: string): boolean => {
  const om = lstatOwnerModeSync(root)
  return om !== -1 && om >> 32 === geteuid() && (om & 18) === 0
}

export const runs = (program: string): boolean => isExecutableSync(program)
