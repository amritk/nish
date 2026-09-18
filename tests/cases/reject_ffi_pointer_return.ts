// The other half of the rule the parameter case pins: a `CPtr` does not come
// back out of a function this program defines either.
declare function handle(): CPtr;

const open = (): CPtr => handle();

export const main = (): i32 => 0;
