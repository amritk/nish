// A `Level` field initialised with a `Kind` member: the enums are distinct
// types, as they are everywhere else.
enum Kind {
  Scalar,
  Array,
}

enum Level {
  Low,
  High,
}

class Gauge {
  level: Level = Kind.Array;
}

export const test = (): number => (new Gauge().level === Level.High ? 1 : 0);
