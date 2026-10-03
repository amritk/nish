// --deny-panics refuses `readFileSync`, which exits when the file cannot be
// read, and names `readFileSyncOrNull`.
export const load = (path: string): string => readFileSync(path);
