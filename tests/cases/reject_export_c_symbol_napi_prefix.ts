// #618: Node-API reserves every name that begins with `napi_`, and the N-API
// shim `--emit-napi` writes calls them, so an exported `napi_create_int32`
// would be the function the shim's own calls reach.
export const napi_create_int32 = (n: i32): i32 => n;

export const main = (): i32 => napi_create_int32(0);
