// WP89 S3b: an exported binding is imported by name. A namespace import is
// refused as it is for a module of functions this program defines, so no
// `sys.counter_new` spelling reaches the binding around its own checks.
import * as sys from "./sys"

export const main = (): i32 => {
  return 0
}
