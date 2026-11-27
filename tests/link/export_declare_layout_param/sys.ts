// WP89 S3b: an exported `declare function` may take an opaque class, which is
// a C pointer, but not a layout with fields, which stays in its module.
declare class Point {
  x: i32
  y: i32
}
export declare function point_sum(p: Point): i32
