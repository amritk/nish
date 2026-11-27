// WP89 S3b: `| null` does not hide a layout with fields from the export
// check: an exported binding of `Point | null` is refused as `Point` is
// (`export_declare_layout_param`).
declare class Point {
  x: i32
  y: i32
}
export declare function point_norm(p: Point | null): i32
