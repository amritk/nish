export const storeSecret = (path: string, secret: string): number => {
  const tmp = `${path}.tmp`
  const written = writeFileSyncMode(tmp, secret, 0o600)
  if (written < 0) {
    unlinkSync(tmp)
    return written
  }
  return renameSync(tmp, path)
}

export const lock = (path: string): boolean => createFileExclusiveSync(path, "", 0o600) >= 0

export const privateDir = (path: string): number => mkdirSyncMode(path, 0o700)
