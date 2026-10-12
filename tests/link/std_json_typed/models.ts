// The classes the suite decodes and encodes: every field kind the route
// writes code for, nested three deep, with arrays of objects and `| null`
// fields at each level.

export class Player {
  name: string = "";
  score: i32 = 0;
  rating: f64 = 0;
  tags: string[];

  constructor() {
    this.tags = [];
  }
}

export class Team {
  id: u32 = 0;
  players: Player[];
  captain: Player | null = null;

  constructor() {
    this.players = [];
  }
}

export class Match {
  id: i64 = 0;
  live: boolean = false;
  title: string | null = null;
  home: Team;
  away: Team | null = null;
  scores: i32[];
  odds: f64[] | null = null;
  flags: boolean[];
  ids: u32[];
  big: i64[];
  notes: string[] | null = null;

  constructor() {
    this.home = new Team();
    this.scores = [];
    this.flags = [];
    this.ids = [];
    this.big = [];
  }
}

/** An array of scalars, and an array of objects that may be `null`. */
export class Lists {
  xs: i32[];
  members: Player[] | null = null;

  constructor() {
    this.xs = [];
  }
}

/** One of each scalar, for the range and type checks. */
export class Scalars {
  a: i32 = 0;
  b: u32 = 0;
  c: i64 = 0;
  d: f64 = 0;
  e: boolean = false;
  f: string = "";
}

/** A list that can hold itself, for the encoding that has no end. */
export class Chain {
  id: i32 = 0;
  next: Chain | null = null;
  links: Chain[];

  constructor() {
    this.links = [];
  }
}

/** A numeric enum with gaps, so `1` is a number that names no member. */
export enum Level {
  Low = 0,
  Mid = 5,
  High = 9,
}

/** A numeric enum with a negative member, and two members of one value. */
export enum Sign {
  Minus = -1,
  Zero = 0,
  Plus = 1,
  Positive = 1,
}

/**
 * The kinds after the first: `u64` alone and in arrays, numeric enums alone
 * and in arrays, and `Map<string, V>` with a scalar, a class, a `| null`
 * string, an array, another map and a `| null` map of values.
 */
export class Kinds {
  id: u64 = 0;
  ids: u64[];
  more: u64[] | null = null;
  levels: Level[];
  ranks: Level[] | null = null;
  counts: Map<string, i32>;
  players: Map<string, Player>;
  notes: Map<string, string | null>;
  lists: Map<string, u64[]>;
  groups: Map<string, Map<string, Level>>;
  odds: Map<string, f64> | null = null;
  level: Level;
  sign: Sign;

  constructor() {
    this.ids = [];
    this.levels = [];
    this.counts = new Map<string, i32>();
    this.players = new Map<string, Player>();
    this.notes = new Map<string, string | null>();
    this.lists = new Map<string, u64[]>();
    this.groups = new Map<string, Map<string, Level>>();
    this.level = Level.Low;
    this.sign = Sign.Zero;
  }
}

/**
 * Field names of 2-, 3- and 4-byte UTF-8, and an ASCII name of the same
 * length as the first that differs from it in its third byte, so the key's
 * length and then that byte decide between them.
 */
export class Names {
  prénom: i32 = 0;
  prenoms: i32 = 0;
  名前: i32 = 0;
  𝑥: i32 = 0;
}

/**
 * Twenty-four fields, many of one length and some of one first byte, the
 * class the dispatch by length is for and `--bench-wide` decodes.
 */
export class Wide {
  name: string = "";
  city: string = "";
  color: string = "";
  state: string = "";
  title: string = "";
  street: string = "";
  country: string = "";
  created: i64 = 0;
  updated: i64 = 0;
  latitude: f64 = 0;
  longitude: f64 = 0;
  age: i32 = 0;
  zip: i32 = 0;
  code: i32 = 0;
  kind: i32 = 0;
  rank: i32 = 0;
  size: i32 = 0;
  count: i32 = 0;
  score: i32 = 0;
  width: i32 = 0;
  height: i32 = 0;
  weight: i32 = 0;
  id: i32 = 0;
  active: boolean = false;
}

/**
 * The map values `Kinds` leaves out: an array of enums, a `| null` object and
 * a `| null` array, and a `| null` map of objects; and a map through an alias.
 */
/** Two fields whose names have one length, the shape `--bench-xy` decodes. */
export class Xy {
  x: i32 = 0;
  y: i32 = 0;
}

/** A map in each element of an array, for the per-decoding limit. */
export class Bag {
  counts: Map<string, i32>;

  constructor() {
    this.counts = new Map<string, i32>();
  }
}

export class Bags {
  bags: Bag[];

  constructor() {
    this.bags = [];
  }
}

/** A `Map` named through an alias, which is the `Map` it names. */
export type Counts = Map<string, i32>;

export class MapShapes {
  aliased: Counts;
  levels: Map<string, Level[]>;
  players: Map<string, Player | null>;
  lists: Map<string, u64[] | null>;
  signs: Map<string, Sign>;
  maybe: Map<string, Player> | null = null;

  constructor() {
    this.aliased = new Map<string, i32>();
    this.levels = new Map<string, Level[]>();
    this.players = new Map<string, Player | null>();
    this.lists = new Map<string, u64[] | null>();
    this.signs = new Map<string, Sign>();
  }
}
