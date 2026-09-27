const getByte = (buf: u8[], i: integer<0, 255>): u8 => buf[i]

const brighten = (level: integer<-128, 127>): integer<-128, 127> => level + 1

const firstByte = (buf: u8[], n: i32): u8 => getByte(buf, n)
