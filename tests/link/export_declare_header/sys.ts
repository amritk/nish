// WP89 S3b: the binding module, as in `export_declare_handle`. An exported
// `declare function` is a C function this program calls, not one it offers a
// host, so no sidecar describes it.
export declare class CMeter {}
export declare function meter_new(start: i32): CMeter | null
export declare function Meter_read(m: CMeter): i32
export declare function meter_free(m: CMeter): void
