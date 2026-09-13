// A nullable is checked against null first; comparing it to a value is two questions at once.
export const run = (a: string | null, b: string): boolean => a === b;
