// serde_json, two ways, chosen by the second argument:
//
//   typed  — `#[derive(Deserialize)]` into a struct of the three fields, the
//            way a Rust program would read a known shape: every other field is
//            skipped without being built, and a string with no escape is
//            borrowed from the line rather than copied.
//   value  — `serde_json::Value`, a full tree per line, then three lookups.
//
// Same fields and checksum as bench/json/json.ts.
use serde::Deserialize;
use std::borrow::Cow;
use std::time::Instant;

const MASK: i32 = 1073741823;

#[derive(Deserialize)]
struct Diagnostic<'a> {
    #[serde(borrow)]
    code: Cow<'a, str>,
    line: i64,
    #[serde(borrow)]
    message: Cow<'a, str>,
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let text = std::fs::read_to_string(&args[1]).expect("read the input");
    let typed = args.get(2).map(|m| m == "typed").unwrap_or(true);
    let lines: Vec<&str> = text.split('\n').filter(|l| !l.is_empty()).collect();
    let start = Instant::now();
    let mut sum: i32 = 0;
    for line in &lines {
        let (code, at, message) = if typed {
            let d: Diagnostic = serde_json::from_str(line).expect("parse");
            (d.code.len(), d.line, d.message.len())
        } else {
            let v: serde_json::Value = serde_json::from_str(line).expect("parse");
            (
                v["code"].as_str().expect("code").len(),
                v["line"].as_i64().expect("line"),
                v["message"].as_str().expect("message").len(),
            )
        };
        sum = (sum
            .wrapping_add(code as i32)
            .wrapping_add(at as i32)
            .wrapping_add(message as i32))
            & MASK;
    }
    let elapsed = start.elapsed().as_nanos();
    println!("{}\n{}", sum, elapsed);
}
