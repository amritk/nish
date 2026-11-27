// WP89 S3b: a module may not re-export a binding it imported. The language has
// no export lists, so `export { … } from` is refused here as it is for a
// function this program defines: an importer imports the binding from the
// module that declares it.
export { counter_new } from "./sys"
