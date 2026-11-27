// WP89 S3b: a `Result` arm does not carry a layout with fields to an
// importer: a `declare function` takes no `Result`, exported or not.
declare class Point {
  x: i32
  y: i32
}
export declare function point_check(r: Result<Point, string>): i32
