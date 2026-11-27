// WP89 S3b: a layout with fields does not reach an importer behind an array
// either. A `declare function` takes a layout one at a time, by pointer, so an
// exported binding of `Point[]` is refused where the element is named.
declare class Point {
  x: i32
  y: i32
}
export declare function point_sum(ps: Point[]): i32
