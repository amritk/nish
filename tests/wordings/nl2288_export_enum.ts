// NL2288: an enum names a type inside one module, so `export` on one has
// nothing to mean. This case pinned NL2226 until WP23 gave the enum a rule of
// its own; the catch-all it used to demonstrate is nl2226_export_import_equals.
export enum Colour {
  Red,
}
