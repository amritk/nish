// WP34 N5: `pollAdd` takes its events and its token every time; there are no
// optional arguments.
export const main = (): number => pollAdd(pollCreate(), 0, 1);
