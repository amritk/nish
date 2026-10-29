// bench/gzip/compare's Java comparator: java.util.zip's Deflater and Inflater
// over raw DEFLATE, each reused with reset(), and CRC32 for the trailer, which
// is what a gzip member is: a 10-byte header, the stream, the CRC-32 and the
// length. The class is not public, so the file may have a kebab-case name.
// Same arguments and row format as bench/gzip/main.ts: compare.mjs reads the
// lines.
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.CRC32;
import java.util.zip.Deflater;
import java.util.zip.Inflater;

class JavaGzip {
  static byte[] body;
  static byte[] out;
  static byte[] back;

  static int gzip(Deflater d) {
    d.reset();
    d.setInput(body);
    d.finish();
    out[0] = 0x1f;
    out[1] = (byte) 0x8b;
    out[2] = 8;
    out[9] = (byte) 255;
    int p = 10;
    while (!d.finished()) {
      p += d.deflate(out, p, out.length - p);
    }
    CRC32 c = new CRC32();
    c.update(body);
    int crc = (int) c.getValue();
    for (int i = 0; i < 4; i++) {
      out[p + i] = (byte) (crc >>> (8 * i));
      out[p + 4 + i] = (byte) (body.length >>> (8 * i));
    }
    return p + 8;
  }

  static int gunzip(Inflater f, byte[] member) throws Exception {
    if (member[0] != 0x1f || member[1] != (byte) 0x8b || member[3] != 0) {
      throw new Exception("not a plain gzip member");
    }
    f.reset();
    f.setInput(member, 10, member.length - 18);
    int got = f.inflate(back);
    CRC32 c = new CRC32();
    c.update(back, 0, got);
    int n = member.length;
    int crc = (member[n - 8] & 255) | (member[n - 7] & 255) << 8 | (member[n - 6] & 255) << 16 | (member[n - 5] & 255) << 24;
    if ((int) c.getValue() != crc) {
      throw new Exception("crc");
    }
    return got;
  }

  public static void main(String[] args) throws Exception {
    body = Files.readAllBytes(Path.of(args[0]));
    int calls = Integer.parseInt(args[1]);
    byte[][] streams = { Files.readAllBytes(Path.of(args[2])), Files.readAllBytes(Path.of(args[3])) };
    out = new byte[2 * body.length + 64];
    back = new byte[body.length];
    int[] levels = { 1, 6 };
    for (int k = 0; k < 2; k++) {
      int level = levels[k];
      // The JIT compiles the loops during the warm-up, which is longer than
      // the other comparators' for that reason.
      Deflater d = new Deflater(level, true);
      int n = 0;
      for (int i = 0; i < 20000; i++) {
        n = gzip(d);
      }
      long t = System.nanoTime();
      for (int i = 0; i < calls; i++) {
        n = gzip(d);
      }
      System.out.println("java gzip -" + level + " " + body.length + " " + n + " " + (System.nanoTime() - t) + " " + calls);
      Inflater f = new Inflater(true);
      for (int i = 0; i < 20000; i++) {
        gunzip(f, streams[k]);
      }
      t = System.nanoTime();
      for (int i = 0; i < calls; i++) {
        if (gunzip(f, streams[k]) != body.length) {
          throw new Exception("length");
        }
      }
      System.out.println("java gunzip -" + level + " " + body.length + " " + streams[k].length + " " + (System.nanoTime() - t) + " " + calls);
    }
  }
}
