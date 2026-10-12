// bench/json-compare's serde_json comparator, for all three workloads:
//
//   tokenize   every value visited in document order through a Visitor that
//              deserializes into nothing, numbers as f64
//   typed      citm_catalog's `performances` deserialized with serde derive
//              into the structs below, a fresh value per iteration
//   serialize  the structs written back with serde_json::to_writer into one
//              reused Vec<u8>; only the writing is timed, and every byte of
//              every output is folded in outside the clock
//
// The folds and the mutation of the input are bench/json-compare/run.mjs's.
//
//   serde-bench <workload> <file> <iterations> <at>
use serde::de::{DeserializeSeed, Deserializer, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::Instant;

fn fold(h: u64, v: u64) -> u64 {
    h.wrapping_mul(31).wrapping_add(v)
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Price {
    amount: i64,
    audience_sub_category_id: i64,
    seat_category_id: i64,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Area {
    area_id: i64,
    block_ids: Vec<i64>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SeatCategory {
    areas: Vec<Area>,
    seat_category_id: i64,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Performance {
    event_id: i64,
    id: i64,
    logo: Option<String>,
    name: Option<String>,
    prices: Vec<Price>,
    seat_categories: Vec<SeatCategory>,
    seat_map_image: Option<String>,
    start: i64,
    venue_code: String,
}

#[derive(Deserialize, Serialize)]
struct Catalog {
    performances: Vec<Performance>,
}

#[derive(Default)]
struct Sums {
    h: u64,
    tokens: u64,
    numbers: f64,
    /// Fold every byte of a key or string after its length, not only the
    /// last: the untimed pass after the loop.
    full: bool,
}

fn fold_bytes(h: u64, b: &[u8]) -> u64 {
    b.iter().fold(h, |acc, &x| fold(acc, x as u64))
}

impl Sums {
    fn kind(&mut self, k: u64) {
        self.h = fold(self.h, k);
        self.tokens += 1;
    }
    fn text(&mut self, k: u64, s: &str) {
        self.kind(k);
        self.h = fold(self.h, s.len() as u64);
        if self.full {
            self.h = fold_bytes(self.h, s.as_bytes());
        } else {
            self.h = fold(self.h, s.as_bytes().last().copied().unwrap_or(0) as u64);
        }
    }
    fn number(&mut self, d: f64) {
        self.kind(7);
        self.numbers += d;
    }
}

/// A value, visited and folded into the sums.
struct Walk<'a>(&'a mut Sums);

/// An object's key, folded into the sums as a key.
struct Key<'a>(&'a mut Sums);

impl<'de> DeserializeSeed<'de> for Walk<'_> {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        d.deserialize_any(self)
    }
}

impl<'de> Visitor<'de> for Walk<'_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("any JSON value")
    }
    fn visit_bool<E>(self, v: bool) -> Result<(), E> {
        self.0.kind(if v { 8 } else { 9 });
        Ok(())
    }
    fn visit_i64<E>(self, v: i64) -> Result<(), E> {
        self.0.number(v as f64);
        Ok(())
    }
    fn visit_u64<E>(self, v: u64) -> Result<(), E> {
        self.0.number(v as f64);
        Ok(())
    }
    fn visit_f64<E>(self, v: f64) -> Result<(), E> {
        self.0.number(v);
        Ok(())
    }
    fn visit_str<E>(self, v: &str) -> Result<(), E> {
        self.0.text(6, v);
        Ok(())
    }
    fn visit_unit<E>(self) -> Result<(), E> {
        self.0.kind(10);
        Ok(())
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<(), A::Error> {
        self.0.kind(3);
        while seq.next_element_seed(Walk(&mut *self.0))?.is_some() {}
        self.0.kind(4);
        Ok(())
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<(), A::Error> {
        self.0.kind(1);
        while map.next_key_seed(Key(&mut *self.0))?.is_some() {
            map.next_value_seed(Walk(&mut *self.0))?;
        }
        self.0.kind(2);
        Ok(())
    }
}

impl<'de> DeserializeSeed<'de> for Key<'_> {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        d.deserialize_str(self)
    }
}

impl<'de> Visitor<'de> for Key<'_> {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("an object key")
    }
    fn visit_str<E>(self, v: &str) -> Result<(), E> {
        self.0.text(5, v);
        Ok(())
    }
}

fn tokenize_once(doc: &[u8], s: &mut Sums) {
    let mut de = serde_json::Deserializer::from_slice(doc);
    if Walk(s).deserialize(&mut de).and_then(|_| de.end()).is_err() {
        eprintln!("tokenize: the document is not JSON");
        std::process::exit(1);
    }
}

/// A string field: 0 for null, else its length plus one, then every byte.
fn fold_string(h: u64, s: Option<&String>) -> u64 {
    s.map_or(fold(h, 0), |s| fold_bytes(fold(h, s.len() as u64 + 1), s.as_bytes()))
}

fn fold_catalog(c: &Catalog) -> u64 {
    let mut h = 0u64;
    for p in &c.performances {
        h = fold(fold(h, p.event_id as u64), p.id as u64);
        h = fold_string(fold_string(h, p.logo.as_ref()), p.name.as_ref());
        h = fold(h, p.prices.len() as u64);
        for price in &p.prices {
            h = fold(fold(fold(h, price.amount as u64), price.audience_sub_category_id as u64), price.seat_category_id as u64);
        }
        h = fold(h, p.seat_categories.len() as u64);
        for sc in &p.seat_categories {
            h = fold(h, sc.areas.len() as u64);
            for area in &sc.areas {
                h = fold(fold(h, area.area_id as u64), area.block_ids.len() as u64);
                for &b in &area.block_ids {
                    h = fold(h, b as u64);
                }
            }
            h = fold(h, sc.seat_category_id as u64);
        }
        h = fold_string(h, p.seat_map_image.as_ref());
        h = fold_string(fold(h, p.start as u64), Some(&p.venue_code));
    }
    h
}

fn decode(doc: &[u8]) -> Catalog {
    serde_json::from_slice(doc).unwrap_or_else(|e| {
        eprintln!("typed: decoding failed: {e}");
        std::process::exit(1)
    })
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 5 {
        eprintln!("usage: serde-bench <tokenize|typed|serialize> <file> <iterations> <at>");
        std::process::exit(2);
    }
    let mut doc = std::fs::read(&args[2]).unwrap_or_else(|_| {
        eprintln!("cannot read {}", args[2]);
        std::process::exit(1)
    });
    let iterations: usize = args[3].parse().unwrap();
    let at: i64 = args[4].parse().unwrap();
    let mutate = |doc: &mut [u8], r: usize| {
        if at >= 0 && (at as usize) < doc.len() {
            doc[at as usize] = b'0' + (r % 10) as u8;
        }
    };
    let elapsed;
    match args[1].as_str() {
        "tokenize" => {
            let mut h = 0u64;
            let mut numbers = 0f64;
            let mut tokens = 0u64;
            let t0 = Instant::now();
            for r in 0..iterations {
                mutate(&mut doc, r);
                let mut s = Sums::default();
                tokenize_once(&doc, &mut s);
                h = fold(h, s.h);
                numbers += s.numbers;
                tokens = s.tokens;
            }
            elapsed = t0.elapsed();
            let mut verify = Sums { full: true, ..Sums::default() };
            tokenize_once(&doc, &mut verify);
            // {:e} is the shortest representation that round-trips, as Display is.
            println!("tokenize {h} {tokens} {numbers:e} {}", verify.h);
        }
        "typed" => {
            let mut h = 0u64;
            let mut count = 0;
            let t0 = Instant::now();
            for r in 0..iterations {
                mutate(&mut doc, r);
                let c = decode(&doc);
                h = fold(h, fold_catalog(&c));
                count = c.performances.len();
            }
            elapsed = t0.elapsed();
            println!("typed {h} {count}");
        }
        "serialize" => {
            let mut c = decode(&doc);
            let n = c.performances.len();
            if n == 0 {
                eprintln!("serialize: the document has no performances");
                std::process::exit(1);
            }
            let mut out: Vec<u8> = Vec::with_capacity(doc.len() * 2 + 64);
            let mut h = 0u64;
            let mut total = std::time::Duration::ZERO;
            for r in 0..iterations {
                c.performances[r % n].start += 1;
                let t0 = Instant::now();
                out.clear();
                serde_json::to_writer(&mut out, &c).unwrap();
                total += t0.elapsed();
                h = fold(h, fold_bytes(0, &out));
            }
            elapsed = total;
            println!("serialize {h} {}", out.len());
        }
        other => {
            eprintln!("unknown workload {other}");
            std::process::exit(2);
        }
    }
    println!("ns {}", elapsed.as_nanos());
}
