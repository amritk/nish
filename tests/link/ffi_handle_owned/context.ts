// WP89 S5a: the library module, as `std/gpu/context.ts` is. Each class owns
// what it opens and is exported, and its factories are top-level functions,
// since a class has no static methods: a caller in another module opens one
// with `using` and lends it, and the close stays here.
import {
  Device,
  Buffer,
  device_open,
  device_id,
  device_close,
  fence_open,
  fence_close,
  buffer_open,
  buffer_size,
  buffer_close,
} from "./sys"

/** A device and its fence: the fence, declared last, closes first. */
export class Gpu {
  readonly device: Device | null
  readonly fence: CPtr
  constructor(id: i32) {
    this.device = device_open(id)
    this.fence = fence_open(id)
  }
  id(): i32 {
    const d = this.device
    if (d === null) {
      return -1
    }
    return device_id(d)
  }
  [Symbol.dispose](): void {
    fence_close(this.fence)
    const d = this.device
    if (d !== null) {
      device_close(d)
    }
  }
}

/** A buffer on a `Gpu` it owns: the buffer closes, then the `Gpu` its own way. */
export class Pool {
  readonly gpu: Gpu
  readonly buffer: Buffer | null
  constructor(gpu: Gpu, size: i32) {
    this.gpu = gpu
    this.buffer = buffer_open(size)
  }
  size(): i32 {
    const b = this.buffer
    if (b === null) {
      return 0
    }
    return buffer_size(b)
  }
  [Symbol.dispose](): void {
    const b = this.buffer
    if (b !== null) {
      buffer_close(b)
    }
  }
}

/** Opens a `Gpu`, or says why not. */
export const openGpu = (id: i32): Result<Gpu, string> => {
  if (id < 0) {
    return Err("no such device")
  }
  return Ok(new Gpu(id))
};

/** Opens a `Pool` on a new `Gpu`, or `null` for an empty one. */
export const openPool = (id: i32, size: i32): Pool | null => {
  if (size <= 0) {
    return null
  }
  return new Pool(new Gpu(id), size)
};

/** What a borrowed `Pool` holds, read through the `Gpu` it owns. */
export const describe = (p: Pool): i32 => p.gpu.id() * 1000 + p.size()
