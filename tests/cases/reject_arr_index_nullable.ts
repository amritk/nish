// A nullable array is checked against null before it is indexed.
export const first = (a: number[] | null): number => a[0];
