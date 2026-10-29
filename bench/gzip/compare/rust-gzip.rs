// bench/gzip/compare's Rust comparator: flate2 over the backend its features
// pick (miniz_oxide, or zlib-rs), with a reused `Compress` and `Decompress`
// over raw DEFLATE and crc32fast for the trailer, which is what a gzip member
// is: a 10-byte header, the stream, the CRC-32 and the length. Same arguments
// and row format as bench/gzip/main.ts: compare.mjs reads the lines.
use flate2::{Compress, Compression, Decompress, FlushCompress, FlushDecompress, Status};
use std::time::Instant;

#[cfg(feature = "zlib-rs")]
const NAME: &str = "rust-zlib-rs";
#[cfg(not(feature = "zlib-rs"))]
const NAME: &str = "rust-miniz_oxide";

fn gzip(c: &mut Compress, body: &[u8], out: &mut Vec<u8>) {
    out.clear();
    out.extend_from_slice(&[0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 255]);
    c.reset();
    let status = c.compress_vec(body, out, FlushCompress::Finish).unwrap();
    assert!(status == Status::StreamEnd);
    out.extend_from_slice(&crc32fast::hash(body).to_le_bytes());
    out.extend_from_slice(&(body.len() as u32).to_le_bytes());
}

/// The body of a gzip member with a 10-byte header (no optional fields),
/// its CRC-32 and length checked.
fn gunzip(d: &mut Decompress, member: &[u8], back: &mut [u8]) -> usize {
    assert!(member[0] == 0x1f && member[1] == 0x8b && member[3] == 0);
    d.reset(false);
    let status = d.decompress(&member[10..member.len() - 8], back, FlushDecompress::Finish).unwrap();
    assert!(status == Status::StreamEnd);
    let n = d.total_out() as usize;
    let t = &member[member.len() - 8..];
    assert!(crc32fast::hash(&back[..n]) == u32::from_le_bytes([t[0], t[1], t[2], t[3]]));
    assert!(n as u32 == u32::from_le_bytes([t[4], t[5], t[6], t[7]]));
    n
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let body = std::fs::read(&args[1]).unwrap();
    let calls: usize = args[2].parse().unwrap();
    let streams = [std::fs::read(&args[3]).unwrap(), std::fs::read(&args[4]).unwrap()];
    let mut out = Vec::with_capacity(2 * body.len() + 64);
    let mut back = vec![0u8; body.len()];
    for (k, level) in [1u32, 6].into_iter().enumerate() {
        let mut c = Compress::new(Compression::new(level), false);
        for _ in 0..200 {
            gzip(&mut c, &body, &mut out);
        }
        let t = Instant::now();
        for _ in 0..calls {
            gzip(&mut c, &body, &mut out);
        }
        println!("{} gzip -{} {} {} {} {}", NAME, level, body.len(), out.len(), t.elapsed().as_nanos(), calls);
        let mut d = Decompress::new(false);
        for _ in 0..200 {
            gunzip(&mut d, &streams[k], &mut back);
        }
        let t = Instant::now();
        for _ in 0..calls {
            assert!(gunzip(&mut d, &streams[k], &mut back) == body.len());
        }
        println!("{} gunzip -{} {} {} {} {}", NAME, level, body.len(), streams[k].len(), t.elapsed().as_nanos(), calls);
    }
}
