// WP50 §5.2: `layout` and `views` are the loader's only in a program with
// module storage (`reject_storage_loader_name`); this one has none, so its
// exports keep both names.
export const layout = (n: i32): i32 => n + 1

export const views = (n: i32): i32 => n * 2

export const main = (): i32 => layout(views(20)) + 1
