export const exists = (path: string): boolean => readFileSyncOrNull(path) !== null;
