// WP89 S3b: a `declare class` with fields is a C struct layout, built and read
// only in the module that declares it, so exporting it stays refused (NL2567).
// An opaque one, with no members and no heritage clause, may be exported.
export declare class Point {
  x: i32
  y: i32
}
