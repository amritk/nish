// WP89 S5a: the binding module, as `std/gpu/sys.ts` is: opaque classes, a raw
// `CPtr` and the C functions that open, use and release them, each exported once.
export declare class Device {}
export declare class Buffer {}
export declare function device_open(id: i32): Device | null
export declare function device_id(d: Device): i32
export declare function device_close(d: Device): void
export declare function fence_open(id: i32): CPtr
export declare function fence_close(f: CPtr): void
export declare function buffer_open(size: i32): Buffer | null
export declare function buffer_size(b: Buffer): i32
export declare function buffer_close(b: Buffer): void
export declare function closed_count(): i32
export declare function closed_at(i: i32): i32
export declare function live_count(): i32
