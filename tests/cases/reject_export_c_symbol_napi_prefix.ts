// #618: Node-API reserves every name that begins with `napi_` or `node_api_`.
// The shim `--emit-napi` writes calls the first, and its `NAPI_MODULE_INIT`
// defines `node_api_module_get_api_version_v1`, so an exported function of
// either kind would be the one the shim's calls reach, or a duplicate symbol.
export const napi_create_int32 = (n: i32): i32 => n;

export const node_api_module_get_api_version_v1 = (): i32 => 9;

export const main = (): i32 => napi_create_int32(0) + node_api_module_get_api_version_v1();
