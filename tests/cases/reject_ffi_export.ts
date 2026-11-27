// WP27 S1, narrowed by WP89 S3b: a `declare function` may be exported now, so
// one module holds a library's binding and the others import it. What stays
// refused is a C struct layout in its signature: a layout with fields is built
// and read only in the module that declares it.
declare class Point {
  x: i32
  y: i32
}

export declare function point_sum(p: Point): i32

export const main = (): i32 => {
  return 0
}
