%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"0123456789abcdef\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"00000004fffffffdfffffffffffffffefffffffbffffffff0000000000000003\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"0000000000000000000000000000000000000000000000000000000000000001\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"ffffffff00000001000000000000000000000000fffffffffffffffffffffffd\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"00000000fffffffeffffffffffffffffffffffff000000000000000000000001\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"ok    \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"FAIL  \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"ffffffff00000001000000000000000000000000fffffffffffffffffffffffe\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"fffffffe00000003fffffffd0000000200000001fffffffe0000000300000000\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"0000000000000000000000000000000000000000000000000000000000000000\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"p256FiatMul: a b / R mod p\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"f7b77f634d49e7b16931916fe806ae02c4dc1b3efbc56b5da7aeefc0c3f6f39e\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"p256FiatMul: (p - 1)^2 / R mod p\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"p256FiatMul: one times a is a\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"p256FiatMul: zero times a is zero\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"p256FiatMul: out may be arg1\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"p256FiatSquare: a^2 / R mod p\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"33a5f07927935fea028224afa6d52c6009966566f231cc001f60a3910a739a85\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"p256FiatSquare: (p - 1)^2 / R mod p\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"p256FiatScalarMul: a b / R mod n\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"4cf6829aa93728e8f3c97df913fb1bfa95fe5810e2933a05943f8312a98d9cf2\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"b831b33e0c05b45e15bbdd9b3bfa43825fee0aa0b6e5a54e31e2bd8b073b76b7\00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"398644212c9efd1fda959b7a3c3ccdc275942d68c27a8c80b6b19bfc9937d033\00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [39 x i8] } { i64 38, [39 x i8] c"p256FiatScalarMul: (n - 1)^2 / R mod n\00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"60d066334905c1e907f8b6041e607725badef3e243566fafce1bc8f79c197c79\00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"p256FiatCmovznzU32: 0 keeps arg2\00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"7\00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"p256FiatCmovznzU32: 1 takes arg3\00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"9\00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"p256FiatCmovznzU32: any non-zero takes arg3\00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [42 x i8] } { i64 41, [42 x i8] c"p256TableMove: hit 0 leaves out as it was\00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [51 x i8] } { i64 50, [51 x i8] c"p256TableMove: hit 1 takes the entry at the offset\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"0000006b0000006a000000690000006800000067000000660000006500000064\00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"RFC 6979 A.2.5 public key\00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [130 x i8] } { i64 129, [130 x i8] c"60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6 7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299\00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"a6e3c57dd01abe90086538398355dd4c3b17aa873382b0f24d6129493d8aad60\00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [47 x i8] } { i64 46, [47 x i8] c"RFC 6979 A.2.5 SHA-256 \22sample\22: k G has x = r\00" }, align 8
@.str.46 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716\00" }, align 8
@.str.47 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"d16b6ae827f17175e040871a1c7ec3500192c4c92677336ec2537acaee0008e0\00" }, align 8
@.str.48 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"RFC 6979 A.2.5 SHA-256 \22test\22: k G has x = r\00" }, align 8
@.str.49 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"f1abb023518351cd71d881567b1ea663ed3efcf6c5132b354f28d3b0b7d38367\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i64 @p256FiatAddcarryxU32(i32 noundef %arg1, i32 noundef %arg2, i32 noundef %arg3) #0 {
entry:
  %0 = zext i32 %arg1 to i64
  %1 = zext i32 %arg2 to i64
  %2 = add i64 %0, %1
  %3 = zext i32 %arg3 to i64
  %4 = add i64 %2, %3
  ret i64 %4
}

define internal noundef i64 @p256FiatSubborrowxU32(i32 noundef %arg1, i32 noundef %arg2, i32 noundef %arg3) #0 {
entry:
  %0 = zext i32 %arg2 to i64
  %1 = zext i32 %arg1 to i64
  %2 = sub i64 %0, %1
  %3 = zext i32 %arg3 to i64
  %4 = sub i64 %2, %3
  %5 = and i64 %4, 8589934591
  ret i64 %5
}

define internal noundef i64 @p256FiatMulxU32(i32 noundef %arg1, i32 noundef %arg2) #0 {
entry:
  %0 = zext i32 %arg1 to i64
  %1 = zext i32 %arg2 to i64
  %2 = mul i64 %0, %1
  ret i64 %2
}

define noundef i32 @p256FiatCmovznzU32(i32 noundef %arg1, i32 noundef %arg2, i32 noundef %arg3) #0 {
entry:
  %0 = xor i32 %arg1, 0
  %1 = sub i32 0, %0
  %2 = or i32 %0, %1
  %3 = lshr i32 %2, 31
  %4 = sub i32 %3, 1
  %5 = call i32 asm "", "=r,0"(i32 %4) readnone nounwind
  %6 = call i32 asm "", "=r,0"(i32 %5) readnone nounwind
  %7 = and i32 %arg2, %6
  %8 = xor i32 %6, -1
  %9 = and i32 %arg3, %8
  %10 = or i32 %7, %9
  ret i32 %10
}

define void @p256FiatMul(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg2) #1 {
entry:
  %x1.addr = alloca i32, align 4
  %x2.addr = alloca i32, align 4
  %x3.addr = alloca i32, align 4
  %x4.addr = alloca i32, align 4
  %x5.addr = alloca i32, align 4
  %x6.addr = alloca i32, align 4
  %x7.addr = alloca i32, align 4
  %x8.addr = alloca i32, align 4
  %w9.addr = alloca i64, align 8
  %x9.addr = alloca i32, align 4
  %x10.addr = alloca i32, align 4
  %w11.addr = alloca i64, align 8
  %x11.addr = alloca i32, align 4
  %x12.addr = alloca i32, align 4
  %w13.addr = alloca i64, align 8
  %x13.addr = alloca i32, align 4
  %x14.addr = alloca i32, align 4
  %w15.addr = alloca i64, align 8
  %x15.addr = alloca i32, align 4
  %x16.addr = alloca i32, align 4
  %w17.addr = alloca i64, align 8
  %x17.addr = alloca i32, align 4
  %x18.addr = alloca i32, align 4
  %w19.addr = alloca i64, align 8
  %x19.addr = alloca i32, align 4
  %x20.addr = alloca i32, align 4
  %w21.addr = alloca i64, align 8
  %x21.addr = alloca i32, align 4
  %x22.addr = alloca i32, align 4
  %w23.addr = alloca i64, align 8
  %x23.addr = alloca i32, align 4
  %x24.addr = alloca i32, align 4
  %w25.addr = alloca i64, align 8
  %x25.addr = alloca i32, align 4
  %x26.addr = alloca i32, align 4
  %w27.addr = alloca i64, align 8
  %x27.addr = alloca i32, align 4
  %x28.addr = alloca i32, align 4
  %w29.addr = alloca i64, align 8
  %x29.addr = alloca i32, align 4
  %x30.addr = alloca i32, align 4
  %w31.addr = alloca i64, align 8
  %x31.addr = alloca i32, align 4
  %x32.addr = alloca i32, align 4
  %w33.addr = alloca i64, align 8
  %x33.addr = alloca i32, align 4
  %x34.addr = alloca i32, align 4
  %w35.addr = alloca i64, align 8
  %x35.addr = alloca i32, align 4
  %x36.addr = alloca i32, align 4
  %w37.addr = alloca i64, align 8
  %x37.addr = alloca i32, align 4
  %x38.addr = alloca i32, align 4
  %x39.addr = alloca i32, align 4
  %w40.addr = alloca i64, align 8
  %x40.addr = alloca i32, align 4
  %x41.addr = alloca i32, align 4
  %w42.addr = alloca i64, align 8
  %x42.addr = alloca i32, align 4
  %x43.addr = alloca i32, align 4
  %w44.addr = alloca i64, align 8
  %x44.addr = alloca i32, align 4
  %x45.addr = alloca i32, align 4
  %w46.addr = alloca i64, align 8
  %x46.addr = alloca i32, align 4
  %x47.addr = alloca i32, align 4
  %w48.addr = alloca i64, align 8
  %x48.addr = alloca i32, align 4
  %x49.addr = alloca i32, align 4
  %w50.addr = alloca i64, align 8
  %x50.addr = alloca i32, align 4
  %x51.addr = alloca i32, align 4
  %x52.addr = alloca i32, align 4
  %w53.addr = alloca i64, align 8
  %x54.addr = alloca i32, align 4
  %w55.addr = alloca i64, align 8
  %x55.addr = alloca i32, align 4
  %x56.addr = alloca i32, align 4
  %w57.addr = alloca i64, align 8
  %x57.addr = alloca i32, align 4
  %x58.addr = alloca i32, align 4
  %w59.addr = alloca i64, align 8
  %x59.addr = alloca i32, align 4
  %x60.addr = alloca i32, align 4
  %w61.addr = alloca i64, align 8
  %x61.addr = alloca i32, align 4
  %x62.addr = alloca i32, align 4
  %w63.addr = alloca i64, align 8
  %x63.addr = alloca i32, align 4
  %x64.addr = alloca i32, align 4
  %w65.addr = alloca i64, align 8
  %x65.addr = alloca i32, align 4
  %x66.addr = alloca i32, align 4
  %w67.addr = alloca i64, align 8
  %x67.addr = alloca i32, align 4
  %x68.addr = alloca i32, align 4
  %w69.addr = alloca i64, align 8
  %x69.addr = alloca i32, align 4
  %x70.addr = alloca i32, align 4
  %w71.addr = alloca i64, align 8
  %x71.addr = alloca i32, align 4
  %x72.addr = alloca i32, align 4
  %w73.addr = alloca i64, align 8
  %x73.addr = alloca i32, align 4
  %x74.addr = alloca i32, align 4
  %w75.addr = alloca i64, align 8
  %x75.addr = alloca i32, align 4
  %x76.addr = alloca i32, align 4
  %w77.addr = alloca i64, align 8
  %x77.addr = alloca i32, align 4
  %x78.addr = alloca i32, align 4
  %w79.addr = alloca i64, align 8
  %x79.addr = alloca i32, align 4
  %x80.addr = alloca i32, align 4
  %w81.addr = alloca i64, align 8
  %x81.addr = alloca i32, align 4
  %x82.addr = alloca i32, align 4
  %w83.addr = alloca i64, align 8
  %x83.addr = alloca i32, align 4
  %x84.addr = alloca i32, align 4
  %w85.addr = alloca i64, align 8
  %x85.addr = alloca i32, align 4
  %x86.addr = alloca i32, align 4
  %w87.addr = alloca i64, align 8
  %x87.addr = alloca i32, align 4
  %x88.addr = alloca i32, align 4
  %w89.addr = alloca i64, align 8
  %x89.addr = alloca i32, align 4
  %x90.addr = alloca i32, align 4
  %w91.addr = alloca i64, align 8
  %x91.addr = alloca i32, align 4
  %x92.addr = alloca i32, align 4
  %w93.addr = alloca i64, align 8
  %x93.addr = alloca i32, align 4
  %x94.addr = alloca i32, align 4
  %w95.addr = alloca i64, align 8
  %x95.addr = alloca i32, align 4
  %x96.addr = alloca i32, align 4
  %w97.addr = alloca i64, align 8
  %x97.addr = alloca i32, align 4
  %x98.addr = alloca i32, align 4
  %w99.addr = alloca i64, align 8
  %x99.addr = alloca i32, align 4
  %x100.addr = alloca i32, align 4
  %x101.addr = alloca i32, align 4
  %w102.addr = alloca i64, align 8
  %x102.addr = alloca i32, align 4
  %x103.addr = alloca i32, align 4
  %w104.addr = alloca i64, align 8
  %x104.addr = alloca i32, align 4
  %x105.addr = alloca i32, align 4
  %w106.addr = alloca i64, align 8
  %x106.addr = alloca i32, align 4
  %x107.addr = alloca i32, align 4
  %w108.addr = alloca i64, align 8
  %x108.addr = alloca i32, align 4
  %x109.addr = alloca i32, align 4
  %w110.addr = alloca i64, align 8
  %x110.addr = alloca i32, align 4
  %x111.addr = alloca i32, align 4
  %w112.addr = alloca i64, align 8
  %x112.addr = alloca i32, align 4
  %x113.addr = alloca i32, align 4
  %w114.addr = alloca i64, align 8
  %x114.addr = alloca i32, align 4
  %x115.addr = alloca i32, align 4
  %w116.addr = alloca i64, align 8
  %x116.addr = alloca i32, align 4
  %x117.addr = alloca i32, align 4
  %w118.addr = alloca i64, align 8
  %x118.addr = alloca i32, align 4
  %x119.addr = alloca i32, align 4
  %w120.addr = alloca i64, align 8
  %x120.addr = alloca i32, align 4
  %x121.addr = alloca i32, align 4
  %w122.addr = alloca i64, align 8
  %x122.addr = alloca i32, align 4
  %x123.addr = alloca i32, align 4
  %w124.addr = alloca i64, align 8
  %x124.addr = alloca i32, align 4
  %x125.addr = alloca i32, align 4
  %w126.addr = alloca i64, align 8
  %x126.addr = alloca i32, align 4
  %x127.addr = alloca i32, align 4
  %w128.addr = alloca i64, align 8
  %x128.addr = alloca i32, align 4
  %x129.addr = alloca i32, align 4
  %w130.addr = alloca i64, align 8
  %x130.addr = alloca i32, align 4
  %x131.addr = alloca i32, align 4
  %x132.addr = alloca i32, align 4
  %w133.addr = alloca i64, align 8
  %x134.addr = alloca i32, align 4
  %w135.addr = alloca i64, align 8
  %x135.addr = alloca i32, align 4
  %x136.addr = alloca i32, align 4
  %w137.addr = alloca i64, align 8
  %x137.addr = alloca i32, align 4
  %x138.addr = alloca i32, align 4
  %w139.addr = alloca i64, align 8
  %x139.addr = alloca i32, align 4
  %x140.addr = alloca i32, align 4
  %w141.addr = alloca i64, align 8
  %x141.addr = alloca i32, align 4
  %x142.addr = alloca i32, align 4
  %w143.addr = alloca i64, align 8
  %x143.addr = alloca i32, align 4
  %x144.addr = alloca i32, align 4
  %w145.addr = alloca i64, align 8
  %x145.addr = alloca i32, align 4
  %x146.addr = alloca i32, align 4
  %w147.addr = alloca i64, align 8
  %x147.addr = alloca i32, align 4
  %x148.addr = alloca i32, align 4
  %w149.addr = alloca i64, align 8
  %x149.addr = alloca i32, align 4
  %x150.addr = alloca i32, align 4
  %x151.addr = alloca i32, align 4
  %w152.addr = alloca i64, align 8
  %x152.addr = alloca i32, align 4
  %x153.addr = alloca i32, align 4
  %w154.addr = alloca i64, align 8
  %x154.addr = alloca i32, align 4
  %x155.addr = alloca i32, align 4
  %w156.addr = alloca i64, align 8
  %x156.addr = alloca i32, align 4
  %x157.addr = alloca i32, align 4
  %w158.addr = alloca i64, align 8
  %x158.addr = alloca i32, align 4
  %x159.addr = alloca i32, align 4
  %w160.addr = alloca i64, align 8
  %x160.addr = alloca i32, align 4
  %x161.addr = alloca i32, align 4
  %w162.addr = alloca i64, align 8
  %x162.addr = alloca i32, align 4
  %x163.addr = alloca i32, align 4
  %w164.addr = alloca i64, align 8
  %x164.addr = alloca i32, align 4
  %x165.addr = alloca i32, align 4
  %w166.addr = alloca i64, align 8
  %x166.addr = alloca i32, align 4
  %x167.addr = alloca i32, align 4
  %w168.addr = alloca i64, align 8
  %x168.addr = alloca i32, align 4
  %x169.addr = alloca i32, align 4
  %w170.addr = alloca i64, align 8
  %x170.addr = alloca i32, align 4
  %x171.addr = alloca i32, align 4
  %w172.addr = alloca i64, align 8
  %x172.addr = alloca i32, align 4
  %x173.addr = alloca i32, align 4
  %w174.addr = alloca i64, align 8
  %x174.addr = alloca i32, align 4
  %x175.addr = alloca i32, align 4
  %w176.addr = alloca i64, align 8
  %x176.addr = alloca i32, align 4
  %x177.addr = alloca i32, align 4
  %w178.addr = alloca i64, align 8
  %x178.addr = alloca i32, align 4
  %x179.addr = alloca i32, align 4
  %w180.addr = alloca i64, align 8
  %x180.addr = alloca i32, align 4
  %x181.addr = alloca i32, align 4
  %x182.addr = alloca i32, align 4
  %w183.addr = alloca i64, align 8
  %x183.addr = alloca i32, align 4
  %x184.addr = alloca i32, align 4
  %w185.addr = alloca i64, align 8
  %x185.addr = alloca i32, align 4
  %x186.addr = alloca i32, align 4
  %w187.addr = alloca i64, align 8
  %x187.addr = alloca i32, align 4
  %x188.addr = alloca i32, align 4
  %w189.addr = alloca i64, align 8
  %x189.addr = alloca i32, align 4
  %x190.addr = alloca i32, align 4
  %w191.addr = alloca i64, align 8
  %x191.addr = alloca i32, align 4
  %x192.addr = alloca i32, align 4
  %w193.addr = alloca i64, align 8
  %x193.addr = alloca i32, align 4
  %x194.addr = alloca i32, align 4
  %w195.addr = alloca i64, align 8
  %x195.addr = alloca i32, align 4
  %x196.addr = alloca i32, align 4
  %w197.addr = alloca i64, align 8
  %x197.addr = alloca i32, align 4
  %x198.addr = alloca i32, align 4
  %w199.addr = alloca i64, align 8
  %x199.addr = alloca i32, align 4
  %x200.addr = alloca i32, align 4
  %w201.addr = alloca i64, align 8
  %x201.addr = alloca i32, align 4
  %x202.addr = alloca i32, align 4
  %w203.addr = alloca i64, align 8
  %x203.addr = alloca i32, align 4
  %x204.addr = alloca i32, align 4
  %w205.addr = alloca i64, align 8
  %x205.addr = alloca i32, align 4
  %x206.addr = alloca i32, align 4
  %w207.addr = alloca i64, align 8
  %x207.addr = alloca i32, align 4
  %x208.addr = alloca i32, align 4
  %w209.addr = alloca i64, align 8
  %x209.addr = alloca i32, align 4
  %x210.addr = alloca i32, align 4
  %w211.addr = alloca i64, align 8
  %x211.addr = alloca i32, align 4
  %x212.addr = alloca i32, align 4
  %x213.addr = alloca i32, align 4
  %w214.addr = alloca i64, align 8
  %x215.addr = alloca i32, align 4
  %w216.addr = alloca i64, align 8
  %x216.addr = alloca i32, align 4
  %x217.addr = alloca i32, align 4
  %w218.addr = alloca i64, align 8
  %x218.addr = alloca i32, align 4
  %x219.addr = alloca i32, align 4
  %w220.addr = alloca i64, align 8
  %x220.addr = alloca i32, align 4
  %x221.addr = alloca i32, align 4
  %w222.addr = alloca i64, align 8
  %x222.addr = alloca i32, align 4
  %x223.addr = alloca i32, align 4
  %w224.addr = alloca i64, align 8
  %x224.addr = alloca i32, align 4
  %x225.addr = alloca i32, align 4
  %w226.addr = alloca i64, align 8
  %x226.addr = alloca i32, align 4
  %x227.addr = alloca i32, align 4
  %w228.addr = alloca i64, align 8
  %x228.addr = alloca i32, align 4
  %x229.addr = alloca i32, align 4
  %w230.addr = alloca i64, align 8
  %x230.addr = alloca i32, align 4
  %x231.addr = alloca i32, align 4
  %x232.addr = alloca i32, align 4
  %w233.addr = alloca i64, align 8
  %x233.addr = alloca i32, align 4
  %x234.addr = alloca i32, align 4
  %w235.addr = alloca i64, align 8
  %x235.addr = alloca i32, align 4
  %x236.addr = alloca i32, align 4
  %w237.addr = alloca i64, align 8
  %x237.addr = alloca i32, align 4
  %x238.addr = alloca i32, align 4
  %w239.addr = alloca i64, align 8
  %x239.addr = alloca i32, align 4
  %x240.addr = alloca i32, align 4
  %w241.addr = alloca i64, align 8
  %x241.addr = alloca i32, align 4
  %x242.addr = alloca i32, align 4
  %w243.addr = alloca i64, align 8
  %x243.addr = alloca i32, align 4
  %x244.addr = alloca i32, align 4
  %w245.addr = alloca i64, align 8
  %x245.addr = alloca i32, align 4
  %x246.addr = alloca i32, align 4
  %w247.addr = alloca i64, align 8
  %x247.addr = alloca i32, align 4
  %x248.addr = alloca i32, align 4
  %w249.addr = alloca i64, align 8
  %x249.addr = alloca i32, align 4
  %x250.addr = alloca i32, align 4
  %w251.addr = alloca i64, align 8
  %x251.addr = alloca i32, align 4
  %x252.addr = alloca i32, align 4
  %w253.addr = alloca i64, align 8
  %x253.addr = alloca i32, align 4
  %x254.addr = alloca i32, align 4
  %w255.addr = alloca i64, align 8
  %x255.addr = alloca i32, align 4
  %x256.addr = alloca i32, align 4
  %w257.addr = alloca i64, align 8
  %x257.addr = alloca i32, align 4
  %x258.addr = alloca i32, align 4
  %w259.addr = alloca i64, align 8
  %x259.addr = alloca i32, align 4
  %x260.addr = alloca i32, align 4
  %w261.addr = alloca i64, align 8
  %x261.addr = alloca i32, align 4
  %x262.addr = alloca i32, align 4
  %x263.addr = alloca i32, align 4
  %w264.addr = alloca i64, align 8
  %x264.addr = alloca i32, align 4
  %x265.addr = alloca i32, align 4
  %w266.addr = alloca i64, align 8
  %x266.addr = alloca i32, align 4
  %x267.addr = alloca i32, align 4
  %w268.addr = alloca i64, align 8
  %x268.addr = alloca i32, align 4
  %x269.addr = alloca i32, align 4
  %w270.addr = alloca i64, align 8
  %x270.addr = alloca i32, align 4
  %x271.addr = alloca i32, align 4
  %w272.addr = alloca i64, align 8
  %x272.addr = alloca i32, align 4
  %x273.addr = alloca i32, align 4
  %w274.addr = alloca i64, align 8
  %x274.addr = alloca i32, align 4
  %x275.addr = alloca i32, align 4
  %w276.addr = alloca i64, align 8
  %x276.addr = alloca i32, align 4
  %x277.addr = alloca i32, align 4
  %w278.addr = alloca i64, align 8
  %x278.addr = alloca i32, align 4
  %x279.addr = alloca i32, align 4
  %w280.addr = alloca i64, align 8
  %x280.addr = alloca i32, align 4
  %x281.addr = alloca i32, align 4
  %w282.addr = alloca i64, align 8
  %x282.addr = alloca i32, align 4
  %x283.addr = alloca i32, align 4
  %w284.addr = alloca i64, align 8
  %x284.addr = alloca i32, align 4
  %x285.addr = alloca i32, align 4
  %w286.addr = alloca i64, align 8
  %x286.addr = alloca i32, align 4
  %x287.addr = alloca i32, align 4
  %w288.addr = alloca i64, align 8
  %x288.addr = alloca i32, align 4
  %x289.addr = alloca i32, align 4
  %w290.addr = alloca i64, align 8
  %x290.addr = alloca i32, align 4
  %x291.addr = alloca i32, align 4
  %w292.addr = alloca i64, align 8
  %x292.addr = alloca i32, align 4
  %x293.addr = alloca i32, align 4
  %x294.addr = alloca i32, align 4
  %w295.addr = alloca i64, align 8
  %x296.addr = alloca i32, align 4
  %w297.addr = alloca i64, align 8
  %x297.addr = alloca i32, align 4
  %x298.addr = alloca i32, align 4
  %w299.addr = alloca i64, align 8
  %x299.addr = alloca i32, align 4
  %x300.addr = alloca i32, align 4
  %w301.addr = alloca i64, align 8
  %x301.addr = alloca i32, align 4
  %x302.addr = alloca i32, align 4
  %w303.addr = alloca i64, align 8
  %x303.addr = alloca i32, align 4
  %x304.addr = alloca i32, align 4
  %w305.addr = alloca i64, align 8
  %x305.addr = alloca i32, align 4
  %x306.addr = alloca i32, align 4
  %w307.addr = alloca i64, align 8
  %x307.addr = alloca i32, align 4
  %x308.addr = alloca i32, align 4
  %w309.addr = alloca i64, align 8
  %x309.addr = alloca i32, align 4
  %x310.addr = alloca i32, align 4
  %w311.addr = alloca i64, align 8
  %x311.addr = alloca i32, align 4
  %x312.addr = alloca i32, align 4
  %x313.addr = alloca i32, align 4
  %w314.addr = alloca i64, align 8
  %x314.addr = alloca i32, align 4
  %x315.addr = alloca i32, align 4
  %w316.addr = alloca i64, align 8
  %x316.addr = alloca i32, align 4
  %x317.addr = alloca i32, align 4
  %w318.addr = alloca i64, align 8
  %x318.addr = alloca i32, align 4
  %x319.addr = alloca i32, align 4
  %w320.addr = alloca i64, align 8
  %x320.addr = alloca i32, align 4
  %x321.addr = alloca i32, align 4
  %w322.addr = alloca i64, align 8
  %x322.addr = alloca i32, align 4
  %x323.addr = alloca i32, align 4
  %w324.addr = alloca i64, align 8
  %x324.addr = alloca i32, align 4
  %x325.addr = alloca i32, align 4
  %w326.addr = alloca i64, align 8
  %x326.addr = alloca i32, align 4
  %x327.addr = alloca i32, align 4
  %w328.addr = alloca i64, align 8
  %x328.addr = alloca i32, align 4
  %x329.addr = alloca i32, align 4
  %w330.addr = alloca i64, align 8
  %x330.addr = alloca i32, align 4
  %x331.addr = alloca i32, align 4
  %w332.addr = alloca i64, align 8
  %x332.addr = alloca i32, align 4
  %x333.addr = alloca i32, align 4
  %w334.addr = alloca i64, align 8
  %x334.addr = alloca i32, align 4
  %x335.addr = alloca i32, align 4
  %w336.addr = alloca i64, align 8
  %x336.addr = alloca i32, align 4
  %x337.addr = alloca i32, align 4
  %w338.addr = alloca i64, align 8
  %x338.addr = alloca i32, align 4
  %x339.addr = alloca i32, align 4
  %w340.addr = alloca i64, align 8
  %x340.addr = alloca i32, align 4
  %x341.addr = alloca i32, align 4
  %w342.addr = alloca i64, align 8
  %x342.addr = alloca i32, align 4
  %x343.addr = alloca i32, align 4
  %x344.addr = alloca i32, align 4
  %w345.addr = alloca i64, align 8
  %x345.addr = alloca i32, align 4
  %x346.addr = alloca i32, align 4
  %w347.addr = alloca i64, align 8
  %x347.addr = alloca i32, align 4
  %x348.addr = alloca i32, align 4
  %w349.addr = alloca i64, align 8
  %x349.addr = alloca i32, align 4
  %x350.addr = alloca i32, align 4
  %w351.addr = alloca i64, align 8
  %x351.addr = alloca i32, align 4
  %x352.addr = alloca i32, align 4
  %w353.addr = alloca i64, align 8
  %x353.addr = alloca i32, align 4
  %x354.addr = alloca i32, align 4
  %w355.addr = alloca i64, align 8
  %x355.addr = alloca i32, align 4
  %x356.addr = alloca i32, align 4
  %w357.addr = alloca i64, align 8
  %x357.addr = alloca i32, align 4
  %x358.addr = alloca i32, align 4
  %w359.addr = alloca i64, align 8
  %x359.addr = alloca i32, align 4
  %x360.addr = alloca i32, align 4
  %w361.addr = alloca i64, align 8
  %x361.addr = alloca i32, align 4
  %x362.addr = alloca i32, align 4
  %w363.addr = alloca i64, align 8
  %x363.addr = alloca i32, align 4
  %x364.addr = alloca i32, align 4
  %w365.addr = alloca i64, align 8
  %x365.addr = alloca i32, align 4
  %x366.addr = alloca i32, align 4
  %w367.addr = alloca i64, align 8
  %x367.addr = alloca i32, align 4
  %x368.addr = alloca i32, align 4
  %w369.addr = alloca i64, align 8
  %x369.addr = alloca i32, align 4
  %x370.addr = alloca i32, align 4
  %w371.addr = alloca i64, align 8
  %x371.addr = alloca i32, align 4
  %x372.addr = alloca i32, align 4
  %w373.addr = alloca i64, align 8
  %x373.addr = alloca i32, align 4
  %x374.addr = alloca i32, align 4
  %x375.addr = alloca i32, align 4
  %w376.addr = alloca i64, align 8
  %x377.addr = alloca i32, align 4
  %w378.addr = alloca i64, align 8
  %x378.addr = alloca i32, align 4
  %x379.addr = alloca i32, align 4
  %w380.addr = alloca i64, align 8
  %x380.addr = alloca i32, align 4
  %x381.addr = alloca i32, align 4
  %w382.addr = alloca i64, align 8
  %x382.addr = alloca i32, align 4
  %x383.addr = alloca i32, align 4
  %w384.addr = alloca i64, align 8
  %x384.addr = alloca i32, align 4
  %x385.addr = alloca i32, align 4
  %w386.addr = alloca i64, align 8
  %x386.addr = alloca i32, align 4
  %x387.addr = alloca i32, align 4
  %w388.addr = alloca i64, align 8
  %x388.addr = alloca i32, align 4
  %x389.addr = alloca i32, align 4
  %w390.addr = alloca i64, align 8
  %x390.addr = alloca i32, align 4
  %x391.addr = alloca i32, align 4
  %w392.addr = alloca i64, align 8
  %x392.addr = alloca i32, align 4
  %x393.addr = alloca i32, align 4
  %x394.addr = alloca i32, align 4
  %w395.addr = alloca i64, align 8
  %x395.addr = alloca i32, align 4
  %x396.addr = alloca i32, align 4
  %w397.addr = alloca i64, align 8
  %x397.addr = alloca i32, align 4
  %x398.addr = alloca i32, align 4
  %w399.addr = alloca i64, align 8
  %x399.addr = alloca i32, align 4
  %x400.addr = alloca i32, align 4
  %w401.addr = alloca i64, align 8
  %x401.addr = alloca i32, align 4
  %x402.addr = alloca i32, align 4
  %w403.addr = alloca i64, align 8
  %x403.addr = alloca i32, align 4
  %x404.addr = alloca i32, align 4
  %w405.addr = alloca i64, align 8
  %x405.addr = alloca i32, align 4
  %x406.addr = alloca i32, align 4
  %w407.addr = alloca i64, align 8
  %x407.addr = alloca i32, align 4
  %x408.addr = alloca i32, align 4
  %w409.addr = alloca i64, align 8
  %x409.addr = alloca i32, align 4
  %x410.addr = alloca i32, align 4
  %w411.addr = alloca i64, align 8
  %x411.addr = alloca i32, align 4
  %x412.addr = alloca i32, align 4
  %w413.addr = alloca i64, align 8
  %x413.addr = alloca i32, align 4
  %x414.addr = alloca i32, align 4
  %w415.addr = alloca i64, align 8
  %x415.addr = alloca i32, align 4
  %x416.addr = alloca i32, align 4
  %w417.addr = alloca i64, align 8
  %x417.addr = alloca i32, align 4
  %x418.addr = alloca i32, align 4
  %w419.addr = alloca i64, align 8
  %x419.addr = alloca i32, align 4
  %x420.addr = alloca i32, align 4
  %w421.addr = alloca i64, align 8
  %x421.addr = alloca i32, align 4
  %x422.addr = alloca i32, align 4
  %w423.addr = alloca i64, align 8
  %x423.addr = alloca i32, align 4
  %x424.addr = alloca i32, align 4
  %x425.addr = alloca i32, align 4
  %w426.addr = alloca i64, align 8
  %x426.addr = alloca i32, align 4
  %x427.addr = alloca i32, align 4
  %w428.addr = alloca i64, align 8
  %x428.addr = alloca i32, align 4
  %x429.addr = alloca i32, align 4
  %w430.addr = alloca i64, align 8
  %x430.addr = alloca i32, align 4
  %x431.addr = alloca i32, align 4
  %w432.addr = alloca i64, align 8
  %x432.addr = alloca i32, align 4
  %x433.addr = alloca i32, align 4
  %w434.addr = alloca i64, align 8
  %x434.addr = alloca i32, align 4
  %x435.addr = alloca i32, align 4
  %w436.addr = alloca i64, align 8
  %x436.addr = alloca i32, align 4
  %x437.addr = alloca i32, align 4
  %w438.addr = alloca i64, align 8
  %x438.addr = alloca i32, align 4
  %x439.addr = alloca i32, align 4
  %w440.addr = alloca i64, align 8
  %x440.addr = alloca i32, align 4
  %x441.addr = alloca i32, align 4
  %w442.addr = alloca i64, align 8
  %x442.addr = alloca i32, align 4
  %x443.addr = alloca i32, align 4
  %w444.addr = alloca i64, align 8
  %x444.addr = alloca i32, align 4
  %x445.addr = alloca i32, align 4
  %w446.addr = alloca i64, align 8
  %x446.addr = alloca i32, align 4
  %x447.addr = alloca i32, align 4
  %w448.addr = alloca i64, align 8
  %x448.addr = alloca i32, align 4
  %x449.addr = alloca i32, align 4
  %w450.addr = alloca i64, align 8
  %x450.addr = alloca i32, align 4
  %x451.addr = alloca i32, align 4
  %w452.addr = alloca i64, align 8
  %x452.addr = alloca i32, align 4
  %x453.addr = alloca i32, align 4
  %w454.addr = alloca i64, align 8
  %x454.addr = alloca i32, align 4
  %x455.addr = alloca i32, align 4
  %x456.addr = alloca i32, align 4
  %w457.addr = alloca i64, align 8
  %x458.addr = alloca i32, align 4
  %w459.addr = alloca i64, align 8
  %x459.addr = alloca i32, align 4
  %x460.addr = alloca i32, align 4
  %w461.addr = alloca i64, align 8
  %x461.addr = alloca i32, align 4
  %x462.addr = alloca i32, align 4
  %w463.addr = alloca i64, align 8
  %x463.addr = alloca i32, align 4
  %x464.addr = alloca i32, align 4
  %w465.addr = alloca i64, align 8
  %x465.addr = alloca i32, align 4
  %x466.addr = alloca i32, align 4
  %w467.addr = alloca i64, align 8
  %x467.addr = alloca i32, align 4
  %x468.addr = alloca i32, align 4
  %w469.addr = alloca i64, align 8
  %x469.addr = alloca i32, align 4
  %x470.addr = alloca i32, align 4
  %w471.addr = alloca i64, align 8
  %x471.addr = alloca i32, align 4
  %x472.addr = alloca i32, align 4
  %w473.addr = alloca i64, align 8
  %x473.addr = alloca i32, align 4
  %x474.addr = alloca i32, align 4
  %x475.addr = alloca i32, align 4
  %w476.addr = alloca i64, align 8
  %x476.addr = alloca i32, align 4
  %x477.addr = alloca i32, align 4
  %w478.addr = alloca i64, align 8
  %x478.addr = alloca i32, align 4
  %x479.addr = alloca i32, align 4
  %w480.addr = alloca i64, align 8
  %x480.addr = alloca i32, align 4
  %x481.addr = alloca i32, align 4
  %w482.addr = alloca i64, align 8
  %x482.addr = alloca i32, align 4
  %x483.addr = alloca i32, align 4
  %w484.addr = alloca i64, align 8
  %x484.addr = alloca i32, align 4
  %x485.addr = alloca i32, align 4
  %w486.addr = alloca i64, align 8
  %x486.addr = alloca i32, align 4
  %x487.addr = alloca i32, align 4
  %w488.addr = alloca i64, align 8
  %x488.addr = alloca i32, align 4
  %x489.addr = alloca i32, align 4
  %w490.addr = alloca i64, align 8
  %x490.addr = alloca i32, align 4
  %x491.addr = alloca i32, align 4
  %w492.addr = alloca i64, align 8
  %x492.addr = alloca i32, align 4
  %x493.addr = alloca i32, align 4
  %w494.addr = alloca i64, align 8
  %x494.addr = alloca i32, align 4
  %x495.addr = alloca i32, align 4
  %w496.addr = alloca i64, align 8
  %x496.addr = alloca i32, align 4
  %x497.addr = alloca i32, align 4
  %w498.addr = alloca i64, align 8
  %x498.addr = alloca i32, align 4
  %x499.addr = alloca i32, align 4
  %w500.addr = alloca i64, align 8
  %x500.addr = alloca i32, align 4
  %x501.addr = alloca i32, align 4
  %w502.addr = alloca i64, align 8
  %x502.addr = alloca i32, align 4
  %x503.addr = alloca i32, align 4
  %w504.addr = alloca i64, align 8
  %x504.addr = alloca i32, align 4
  %x505.addr = alloca i32, align 4
  %x506.addr = alloca i32, align 4
  %w507.addr = alloca i64, align 8
  %x507.addr = alloca i32, align 4
  %x508.addr = alloca i32, align 4
  %w509.addr = alloca i64, align 8
  %x509.addr = alloca i32, align 4
  %x510.addr = alloca i32, align 4
  %w511.addr = alloca i64, align 8
  %x511.addr = alloca i32, align 4
  %x512.addr = alloca i32, align 4
  %w513.addr = alloca i64, align 8
  %x513.addr = alloca i32, align 4
  %x514.addr = alloca i32, align 4
  %w515.addr = alloca i64, align 8
  %x515.addr = alloca i32, align 4
  %x516.addr = alloca i32, align 4
  %w517.addr = alloca i64, align 8
  %x517.addr = alloca i32, align 4
  %x518.addr = alloca i32, align 4
  %w519.addr = alloca i64, align 8
  %x519.addr = alloca i32, align 4
  %x520.addr = alloca i32, align 4
  %w521.addr = alloca i64, align 8
  %x521.addr = alloca i32, align 4
  %x522.addr = alloca i32, align 4
  %w523.addr = alloca i64, align 8
  %x523.addr = alloca i32, align 4
  %x524.addr = alloca i32, align 4
  %w525.addr = alloca i64, align 8
  %x525.addr = alloca i32, align 4
  %x526.addr = alloca i32, align 4
  %w527.addr = alloca i64, align 8
  %x527.addr = alloca i32, align 4
  %x528.addr = alloca i32, align 4
  %w529.addr = alloca i64, align 8
  %x529.addr = alloca i32, align 4
  %x530.addr = alloca i32, align 4
  %w531.addr = alloca i64, align 8
  %x531.addr = alloca i32, align 4
  %x532.addr = alloca i32, align 4
  %w533.addr = alloca i64, align 8
  %x533.addr = alloca i32, align 4
  %x534.addr = alloca i32, align 4
  %w535.addr = alloca i64, align 8
  %x535.addr = alloca i32, align 4
  %x536.addr = alloca i32, align 4
  %x537.addr = alloca i32, align 4
  %w538.addr = alloca i64, align 8
  %x539.addr = alloca i32, align 4
  %w540.addr = alloca i64, align 8
  %x540.addr = alloca i32, align 4
  %x541.addr = alloca i32, align 4
  %w542.addr = alloca i64, align 8
  %x542.addr = alloca i32, align 4
  %x543.addr = alloca i32, align 4
  %w544.addr = alloca i64, align 8
  %x544.addr = alloca i32, align 4
  %x545.addr = alloca i32, align 4
  %w546.addr = alloca i64, align 8
  %x546.addr = alloca i32, align 4
  %x547.addr = alloca i32, align 4
  %w548.addr = alloca i64, align 8
  %x548.addr = alloca i32, align 4
  %x549.addr = alloca i32, align 4
  %w550.addr = alloca i64, align 8
  %x550.addr = alloca i32, align 4
  %x551.addr = alloca i32, align 4
  %w552.addr = alloca i64, align 8
  %x552.addr = alloca i32, align 4
  %x553.addr = alloca i32, align 4
  %w554.addr = alloca i64, align 8
  %x554.addr = alloca i32, align 4
  %x555.addr = alloca i32, align 4
  %x556.addr = alloca i32, align 4
  %w557.addr = alloca i64, align 8
  %x557.addr = alloca i32, align 4
  %x558.addr = alloca i32, align 4
  %w559.addr = alloca i64, align 8
  %x559.addr = alloca i32, align 4
  %x560.addr = alloca i32, align 4
  %w561.addr = alloca i64, align 8
  %x561.addr = alloca i32, align 4
  %x562.addr = alloca i32, align 4
  %w563.addr = alloca i64, align 8
  %x563.addr = alloca i32, align 4
  %x564.addr = alloca i32, align 4
  %w565.addr = alloca i64, align 8
  %x565.addr = alloca i32, align 4
  %x566.addr = alloca i32, align 4
  %w567.addr = alloca i64, align 8
  %x567.addr = alloca i32, align 4
  %x568.addr = alloca i32, align 4
  %w569.addr = alloca i64, align 8
  %x569.addr = alloca i32, align 4
  %x570.addr = alloca i32, align 4
  %w571.addr = alloca i64, align 8
  %x571.addr = alloca i32, align 4
  %x572.addr = alloca i32, align 4
  %w573.addr = alloca i64, align 8
  %x573.addr = alloca i32, align 4
  %x574.addr = alloca i32, align 4
  %w575.addr = alloca i64, align 8
  %x575.addr = alloca i32, align 4
  %x576.addr = alloca i32, align 4
  %w577.addr = alloca i64, align 8
  %x577.addr = alloca i32, align 4
  %x578.addr = alloca i32, align 4
  %w579.addr = alloca i64, align 8
  %x579.addr = alloca i32, align 4
  %x580.addr = alloca i32, align 4
  %w581.addr = alloca i64, align 8
  %x581.addr = alloca i32, align 4
  %x582.addr = alloca i32, align 4
  %w583.addr = alloca i64, align 8
  %x583.addr = alloca i32, align 4
  %x584.addr = alloca i32, align 4
  %w585.addr = alloca i64, align 8
  %x585.addr = alloca i32, align 4
  %x586.addr = alloca i32, align 4
  %x587.addr = alloca i32, align 4
  %w588.addr = alloca i64, align 8
  %x588.addr = alloca i32, align 4
  %x589.addr = alloca i32, align 4
  %w590.addr = alloca i64, align 8
  %x590.addr = alloca i32, align 4
  %x591.addr = alloca i32, align 4
  %w592.addr = alloca i64, align 8
  %x592.addr = alloca i32, align 4
  %x593.addr = alloca i32, align 4
  %w594.addr = alloca i64, align 8
  %x594.addr = alloca i32, align 4
  %x595.addr = alloca i32, align 4
  %w596.addr = alloca i64, align 8
  %x596.addr = alloca i32, align 4
  %x597.addr = alloca i32, align 4
  %w598.addr = alloca i64, align 8
  %x598.addr = alloca i32, align 4
  %x599.addr = alloca i32, align 4
  %w600.addr = alloca i64, align 8
  %x600.addr = alloca i32, align 4
  %x601.addr = alloca i32, align 4
  %w602.addr = alloca i64, align 8
  %x602.addr = alloca i32, align 4
  %x603.addr = alloca i32, align 4
  %w604.addr = alloca i64, align 8
  %x604.addr = alloca i32, align 4
  %x605.addr = alloca i32, align 4
  %w606.addr = alloca i64, align 8
  %x606.addr = alloca i32, align 4
  %x607.addr = alloca i32, align 4
  %w608.addr = alloca i64, align 8
  %x608.addr = alloca i32, align 4
  %x609.addr = alloca i32, align 4
  %w610.addr = alloca i64, align 8
  %x610.addr = alloca i32, align 4
  %x611.addr = alloca i32, align 4
  %w612.addr = alloca i64, align 8
  %x612.addr = alloca i32, align 4
  %x613.addr = alloca i32, align 4
  %w614.addr = alloca i64, align 8
  %x614.addr = alloca i32, align 4
  %x615.addr = alloca i32, align 4
  %w616.addr = alloca i64, align 8
  %x616.addr = alloca i32, align 4
  %x617.addr = alloca i32, align 4
  %x618.addr = alloca i32, align 4
  %w619.addr = alloca i64, align 8
  %x620.addr = alloca i32, align 4
  %w621.addr = alloca i64, align 8
  %x621.addr = alloca i32, align 4
  %x622.addr = alloca i32, align 4
  %w623.addr = alloca i64, align 8
  %x623.addr = alloca i32, align 4
  %x624.addr = alloca i32, align 4
  %w625.addr = alloca i64, align 8
  %x625.addr = alloca i32, align 4
  %x626.addr = alloca i32, align 4
  %w627.addr = alloca i64, align 8
  %x627.addr = alloca i32, align 4
  %x628.addr = alloca i32, align 4
  %w629.addr = alloca i64, align 8
  %x629.addr = alloca i32, align 4
  %x630.addr = alloca i32, align 4
  %w631.addr = alloca i64, align 8
  %x631.addr = alloca i32, align 4
  %x632.addr = alloca i32, align 4
  %w633.addr = alloca i64, align 8
  %x633.addr = alloca i32, align 4
  %x634.addr = alloca i32, align 4
  %w635.addr = alloca i64, align 8
  %x635.addr = alloca i32, align 4
  %x636.addr = alloca i32, align 4
  %x637.addr = alloca i32, align 4
  %w638.addr = alloca i64, align 8
  %x638.addr = alloca i32, align 4
  %x639.addr = alloca i32, align 4
  %w640.addr = alloca i64, align 8
  %x640.addr = alloca i32, align 4
  %x641.addr = alloca i32, align 4
  %w642.addr = alloca i64, align 8
  %x642.addr = alloca i32, align 4
  %x643.addr = alloca i32, align 4
  %w644.addr = alloca i64, align 8
  %x644.addr = alloca i32, align 4
  %x645.addr = alloca i32, align 4
  %w646.addr = alloca i64, align 8
  %x646.addr = alloca i32, align 4
  %x647.addr = alloca i32, align 4
  %w648.addr = alloca i64, align 8
  %x648.addr = alloca i32, align 4
  %x649.addr = alloca i32, align 4
  %w650.addr = alloca i64, align 8
  %x650.addr = alloca i32, align 4
  %x651.addr = alloca i32, align 4
  %w652.addr = alloca i64, align 8
  %x652.addr = alloca i32, align 4
  %x653.addr = alloca i32, align 4
  %w654.addr = alloca i64, align 8
  %x655.addr = alloca i32, align 4
  %x656.addr = alloca i32, align 4
  %x657.addr = alloca i32, align 4
  %x658.addr = alloca i32, align 4
  %x659.addr = alloca i32, align 4
  %x660.addr = alloca i32, align 4
  %x661.addr = alloca i32, align 4
  %x662.addr = alloca i32, align 4
  %x663.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 1
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %4, i32* %x1.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 2
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %9, i32* %x2.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 3
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %14, i32* %x3.addr, align 4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 4
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %19, i32* %x4.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 5
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %24, i32* %x5.addr, align 4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 6
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %29, i32* %x6.addr, align 4
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 7
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %34, i32* %x7.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 0
  %39 = load i32, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %39, i32* %x8.addr, align 4
  %40 = load i32, i32* %x8.addr, align 4
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 7
  %45 = load i32, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %46 = call i64 @p256FiatMulxU32(i32 %40, i32 %45)
  store i64 %46, i64* %w9.addr, align 8
  %47 = load i64, i64* %w9.addr, align 8
  %48 = trunc i64 %47 to i32
  store i32 %48, i32* %x9.addr, align 4
  %49 = load i64, i64* %w9.addr, align 8
  %50 = lshr i64 %49, 32
  %51 = trunc i64 %50 to i32
  store i32 %51, i32* %x10.addr, align 4
  %52 = load i32, i32* %x8.addr, align 4
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 6
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %58 = call i64 @p256FiatMulxU32(i32 %52, i32 %57)
  store i64 %58, i64* %w11.addr, align 8
  %59 = load i64, i64* %w11.addr, align 8
  %60 = trunc i64 %59 to i32
  store i32 %60, i32* %x11.addr, align 4
  %61 = load i64, i64* %w11.addr, align 8
  %62 = lshr i64 %61, 32
  %63 = trunc i64 %62 to i32
  store i32 %63, i32* %x12.addr, align 4
  %64 = load i32, i32* %x8.addr, align 4
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = bitcast i8* %66 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 5
  %69 = load i32, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %70 = call i64 @p256FiatMulxU32(i32 %64, i32 %69)
  store i64 %70, i64* %w13.addr, align 8
  %71 = load i64, i64* %w13.addr, align 8
  %72 = trunc i64 %71 to i32
  store i32 %72, i32* %x13.addr, align 4
  %73 = load i64, i64* %w13.addr, align 8
  %74 = lshr i64 %73, 32
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %x14.addr, align 4
  %76 = load i32, i32* %x8.addr, align 4
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 4
  %81 = load i32, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %82 = call i64 @p256FiatMulxU32(i32 %76, i32 %81)
  store i64 %82, i64* %w15.addr, align 8
  %83 = load i64, i64* %w15.addr, align 8
  %84 = trunc i64 %83 to i32
  store i32 %84, i32* %x15.addr, align 4
  %85 = load i64, i64* %w15.addr, align 8
  %86 = lshr i64 %85, 32
  %87 = trunc i64 %86 to i32
  store i32 %87, i32* %x16.addr, align 4
  %88 = load i32, i32* %x8.addr, align 4
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 3
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %94 = call i64 @p256FiatMulxU32(i32 %88, i32 %93)
  store i64 %94, i64* %w17.addr, align 8
  %95 = load i64, i64* %w17.addr, align 8
  %96 = trunc i64 %95 to i32
  store i32 %96, i32* %x17.addr, align 4
  %97 = load i64, i64* %w17.addr, align 8
  %98 = lshr i64 %97, 32
  %99 = trunc i64 %98 to i32
  store i32 %99, i32* %x18.addr, align 4
  %100 = load i32, i32* %x8.addr, align 4
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = bitcast i8* %102 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 2
  %105 = load i32, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %106 = call i64 @p256FiatMulxU32(i32 %100, i32 %105)
  store i64 %106, i64* %w19.addr, align 8
  %107 = load i64, i64* %w19.addr, align 8
  %108 = trunc i64 %107 to i32
  store i32 %108, i32* %x19.addr, align 4
  %109 = load i64, i64* %w19.addr, align 8
  %110 = lshr i64 %109, 32
  %111 = trunc i64 %110 to i32
  store i32 %111, i32* %x20.addr, align 4
  %112 = load i32, i32* %x8.addr, align 4
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = bitcast i8* %114 to i32*
  %116 = getelementptr inbounds i32, i32* %115, i64 1
  %117 = load i32, i32* %116, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %118 = call i64 @p256FiatMulxU32(i32 %112, i32 %117)
  store i64 %118, i64* %w21.addr, align 8
  %119 = load i64, i64* %w21.addr, align 8
  %120 = trunc i64 %119 to i32
  store i32 %120, i32* %x21.addr, align 4
  %121 = load i64, i64* %w21.addr, align 8
  %122 = lshr i64 %121, 32
  %123 = trunc i64 %122 to i32
  store i32 %123, i32* %x22.addr, align 4
  %124 = load i32, i32* %x8.addr, align 4
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = bitcast i8* %126 to i32*
  %128 = getelementptr inbounds i32, i32* %127, i64 0
  %129 = load i32, i32* %128, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %130 = call i64 @p256FiatMulxU32(i32 %124, i32 %129)
  store i64 %130, i64* %w23.addr, align 8
  %131 = load i64, i64* %w23.addr, align 8
  %132 = trunc i64 %131 to i32
  store i32 %132, i32* %x23.addr, align 4
  %133 = load i64, i64* %w23.addr, align 8
  %134 = lshr i64 %133, 32
  %135 = trunc i64 %134 to i32
  store i32 %135, i32* %x24.addr, align 4
  %136 = load i32, i32* %x24.addr, align 4
  %137 = load i32, i32* %x21.addr, align 4
  %138 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %136, i32 %137)
  store i64 %138, i64* %w25.addr, align 8
  %139 = load i64, i64* %w25.addr, align 8
  %140 = trunc i64 %139 to i32
  store i32 %140, i32* %x25.addr, align 4
  %141 = load i64, i64* %w25.addr, align 8
  %142 = lshr i64 %141, 32
  %143 = trunc i64 %142 to i32
  store i32 %143, i32* %x26.addr, align 4
  %144 = load i32, i32* %x26.addr, align 4
  %145 = load i32, i32* %x22.addr, align 4
  %146 = load i32, i32* %x19.addr, align 4
  %147 = call i64 @p256FiatAddcarryxU32(i32 %144, i32 %145, i32 %146)
  store i64 %147, i64* %w27.addr, align 8
  %148 = load i64, i64* %w27.addr, align 8
  %149 = trunc i64 %148 to i32
  store i32 %149, i32* %x27.addr, align 4
  %150 = load i64, i64* %w27.addr, align 8
  %151 = lshr i64 %150, 32
  %152 = trunc i64 %151 to i32
  store i32 %152, i32* %x28.addr, align 4
  %153 = load i32, i32* %x28.addr, align 4
  %154 = load i32, i32* %x20.addr, align 4
  %155 = load i32, i32* %x17.addr, align 4
  %156 = call i64 @p256FiatAddcarryxU32(i32 %153, i32 %154, i32 %155)
  store i64 %156, i64* %w29.addr, align 8
  %157 = load i64, i64* %w29.addr, align 8
  %158 = trunc i64 %157 to i32
  store i32 %158, i32* %x29.addr, align 4
  %159 = load i64, i64* %w29.addr, align 8
  %160 = lshr i64 %159, 32
  %161 = trunc i64 %160 to i32
  store i32 %161, i32* %x30.addr, align 4
  %162 = load i32, i32* %x30.addr, align 4
  %163 = load i32, i32* %x18.addr, align 4
  %164 = load i32, i32* %x15.addr, align 4
  %165 = call i64 @p256FiatAddcarryxU32(i32 %162, i32 %163, i32 %164)
  store i64 %165, i64* %w31.addr, align 8
  %166 = load i64, i64* %w31.addr, align 8
  %167 = trunc i64 %166 to i32
  store i32 %167, i32* %x31.addr, align 4
  %168 = load i64, i64* %w31.addr, align 8
  %169 = lshr i64 %168, 32
  %170 = trunc i64 %169 to i32
  store i32 %170, i32* %x32.addr, align 4
  %171 = load i32, i32* %x32.addr, align 4
  %172 = load i32, i32* %x16.addr, align 4
  %173 = load i32, i32* %x13.addr, align 4
  %174 = call i64 @p256FiatAddcarryxU32(i32 %171, i32 %172, i32 %173)
  store i64 %174, i64* %w33.addr, align 8
  %175 = load i64, i64* %w33.addr, align 8
  %176 = trunc i64 %175 to i32
  store i32 %176, i32* %x33.addr, align 4
  %177 = load i64, i64* %w33.addr, align 8
  %178 = lshr i64 %177, 32
  %179 = trunc i64 %178 to i32
  store i32 %179, i32* %x34.addr, align 4
  %180 = load i32, i32* %x34.addr, align 4
  %181 = load i32, i32* %x14.addr, align 4
  %182 = load i32, i32* %x11.addr, align 4
  %183 = call i64 @p256FiatAddcarryxU32(i32 %180, i32 %181, i32 %182)
  store i64 %183, i64* %w35.addr, align 8
  %184 = load i64, i64* %w35.addr, align 8
  %185 = trunc i64 %184 to i32
  store i32 %185, i32* %x35.addr, align 4
  %186 = load i64, i64* %w35.addr, align 8
  %187 = lshr i64 %186, 32
  %188 = trunc i64 %187 to i32
  store i32 %188, i32* %x36.addr, align 4
  %189 = load i32, i32* %x36.addr, align 4
  %190 = load i32, i32* %x12.addr, align 4
  %191 = load i32, i32* %x9.addr, align 4
  %192 = call i64 @p256FiatAddcarryxU32(i32 %189, i32 %190, i32 %191)
  store i64 %192, i64* %w37.addr, align 8
  %193 = load i64, i64* %w37.addr, align 8
  %194 = trunc i64 %193 to i32
  store i32 %194, i32* %x37.addr, align 4
  %195 = load i64, i64* %w37.addr, align 8
  %196 = lshr i64 %195, 32
  %197 = trunc i64 %196 to i32
  store i32 %197, i32* %x38.addr, align 4
  %198 = load i32, i32* %x38.addr, align 4
  %199 = load i32, i32* %x10.addr, align 4
  %200 = add i32 %198, %199
  store i32 %200, i32* %x39.addr, align 4
  %201 = load i32, i32* %x23.addr, align 4
  %202 = call i64 @p256FiatMulxU32(i32 %201, i32 4294967295)
  store i64 %202, i64* %w40.addr, align 8
  %203 = load i64, i64* %w40.addr, align 8
  %204 = trunc i64 %203 to i32
  store i32 %204, i32* %x40.addr, align 4
  %205 = load i64, i64* %w40.addr, align 8
  %206 = lshr i64 %205, 32
  %207 = trunc i64 %206 to i32
  store i32 %207, i32* %x41.addr, align 4
  %208 = load i32, i32* %x23.addr, align 4
  %209 = call i64 @p256FiatMulxU32(i32 %208, i32 4294967295)
  store i64 %209, i64* %w42.addr, align 8
  %210 = load i64, i64* %w42.addr, align 8
  %211 = trunc i64 %210 to i32
  store i32 %211, i32* %x42.addr, align 4
  %212 = load i64, i64* %w42.addr, align 8
  %213 = lshr i64 %212, 32
  %214 = trunc i64 %213 to i32
  store i32 %214, i32* %x43.addr, align 4
  %215 = load i32, i32* %x23.addr, align 4
  %216 = call i64 @p256FiatMulxU32(i32 %215, i32 4294967295)
  store i64 %216, i64* %w44.addr, align 8
  %217 = load i64, i64* %w44.addr, align 8
  %218 = trunc i64 %217 to i32
  store i32 %218, i32* %x44.addr, align 4
  %219 = load i64, i64* %w44.addr, align 8
  %220 = lshr i64 %219, 32
  %221 = trunc i64 %220 to i32
  store i32 %221, i32* %x45.addr, align 4
  %222 = load i32, i32* %x23.addr, align 4
  %223 = call i64 @p256FiatMulxU32(i32 %222, i32 4294967295)
  store i64 %223, i64* %w46.addr, align 8
  %224 = load i64, i64* %w46.addr, align 8
  %225 = trunc i64 %224 to i32
  store i32 %225, i32* %x46.addr, align 4
  %226 = load i64, i64* %w46.addr, align 8
  %227 = lshr i64 %226, 32
  %228 = trunc i64 %227 to i32
  store i32 %228, i32* %x47.addr, align 4
  %229 = load i32, i32* %x47.addr, align 4
  %230 = load i32, i32* %x44.addr, align 4
  %231 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %229, i32 %230)
  store i64 %231, i64* %w48.addr, align 8
  %232 = load i64, i64* %w48.addr, align 8
  %233 = trunc i64 %232 to i32
  store i32 %233, i32* %x48.addr, align 4
  %234 = load i64, i64* %w48.addr, align 8
  %235 = lshr i64 %234, 32
  %236 = trunc i64 %235 to i32
  store i32 %236, i32* %x49.addr, align 4
  %237 = load i32, i32* %x49.addr, align 4
  %238 = load i32, i32* %x45.addr, align 4
  %239 = load i32, i32* %x42.addr, align 4
  %240 = call i64 @p256FiatAddcarryxU32(i32 %237, i32 %238, i32 %239)
  store i64 %240, i64* %w50.addr, align 8
  %241 = load i64, i64* %w50.addr, align 8
  %242 = trunc i64 %241 to i32
  store i32 %242, i32* %x50.addr, align 4
  %243 = load i64, i64* %w50.addr, align 8
  %244 = lshr i64 %243, 32
  %245 = trunc i64 %244 to i32
  store i32 %245, i32* %x51.addr, align 4
  %246 = load i32, i32* %x51.addr, align 4
  %247 = load i32, i32* %x43.addr, align 4
  %248 = add i32 %246, %247
  store i32 %248, i32* %x52.addr, align 4
  %249 = load i32, i32* %x23.addr, align 4
  %250 = load i32, i32* %x46.addr, align 4
  %251 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %249, i32 %250)
  store i64 %251, i64* %w53.addr, align 8
  %252 = load i64, i64* %w53.addr, align 8
  %253 = lshr i64 %252, 32
  %254 = trunc i64 %253 to i32
  store i32 %254, i32* %x54.addr, align 4
  %255 = load i32, i32* %x54.addr, align 4
  %256 = load i32, i32* %x25.addr, align 4
  %257 = load i32, i32* %x48.addr, align 4
  %258 = call i64 @p256FiatAddcarryxU32(i32 %255, i32 %256, i32 %257)
  store i64 %258, i64* %w55.addr, align 8
  %259 = load i64, i64* %w55.addr, align 8
  %260 = trunc i64 %259 to i32
  store i32 %260, i32* %x55.addr, align 4
  %261 = load i64, i64* %w55.addr, align 8
  %262 = lshr i64 %261, 32
  %263 = trunc i64 %262 to i32
  store i32 %263, i32* %x56.addr, align 4
  %264 = load i32, i32* %x56.addr, align 4
  %265 = load i32, i32* %x27.addr, align 4
  %266 = load i32, i32* %x50.addr, align 4
  %267 = call i64 @p256FiatAddcarryxU32(i32 %264, i32 %265, i32 %266)
  store i64 %267, i64* %w57.addr, align 8
  %268 = load i64, i64* %w57.addr, align 8
  %269 = trunc i64 %268 to i32
  store i32 %269, i32* %x57.addr, align 4
  %270 = load i64, i64* %w57.addr, align 8
  %271 = lshr i64 %270, 32
  %272 = trunc i64 %271 to i32
  store i32 %272, i32* %x58.addr, align 4
  %273 = load i32, i32* %x58.addr, align 4
  %274 = load i32, i32* %x29.addr, align 4
  %275 = load i32, i32* %x52.addr, align 4
  %276 = call i64 @p256FiatAddcarryxU32(i32 %273, i32 %274, i32 %275)
  store i64 %276, i64* %w59.addr, align 8
  %277 = load i64, i64* %w59.addr, align 8
  %278 = trunc i64 %277 to i32
  store i32 %278, i32* %x59.addr, align 4
  %279 = load i64, i64* %w59.addr, align 8
  %280 = lshr i64 %279, 32
  %281 = trunc i64 %280 to i32
  store i32 %281, i32* %x60.addr, align 4
  %282 = load i32, i32* %x60.addr, align 4
  %283 = load i32, i32* %x31.addr, align 4
  %284 = call i64 @p256FiatAddcarryxU32(i32 %282, i32 %283, i32 0)
  store i64 %284, i64* %w61.addr, align 8
  %285 = load i64, i64* %w61.addr, align 8
  %286 = trunc i64 %285 to i32
  store i32 %286, i32* %x61.addr, align 4
  %287 = load i64, i64* %w61.addr, align 8
  %288 = lshr i64 %287, 32
  %289 = trunc i64 %288 to i32
  store i32 %289, i32* %x62.addr, align 4
  %290 = load i32, i32* %x62.addr, align 4
  %291 = load i32, i32* %x33.addr, align 4
  %292 = call i64 @p256FiatAddcarryxU32(i32 %290, i32 %291, i32 0)
  store i64 %292, i64* %w63.addr, align 8
  %293 = load i64, i64* %w63.addr, align 8
  %294 = trunc i64 %293 to i32
  store i32 %294, i32* %x63.addr, align 4
  %295 = load i64, i64* %w63.addr, align 8
  %296 = lshr i64 %295, 32
  %297 = trunc i64 %296 to i32
  store i32 %297, i32* %x64.addr, align 4
  %298 = load i32, i32* %x64.addr, align 4
  %299 = load i32, i32* %x35.addr, align 4
  %300 = load i32, i32* %x23.addr, align 4
  %301 = call i64 @p256FiatAddcarryxU32(i32 %298, i32 %299, i32 %300)
  store i64 %301, i64* %w65.addr, align 8
  %302 = load i64, i64* %w65.addr, align 8
  %303 = trunc i64 %302 to i32
  store i32 %303, i32* %x65.addr, align 4
  %304 = load i64, i64* %w65.addr, align 8
  %305 = lshr i64 %304, 32
  %306 = trunc i64 %305 to i32
  store i32 %306, i32* %x66.addr, align 4
  %307 = load i32, i32* %x66.addr, align 4
  %308 = load i32, i32* %x37.addr, align 4
  %309 = load i32, i32* %x40.addr, align 4
  %310 = call i64 @p256FiatAddcarryxU32(i32 %307, i32 %308, i32 %309)
  store i64 %310, i64* %w67.addr, align 8
  %311 = load i64, i64* %w67.addr, align 8
  %312 = trunc i64 %311 to i32
  store i32 %312, i32* %x67.addr, align 4
  %313 = load i64, i64* %w67.addr, align 8
  %314 = lshr i64 %313, 32
  %315 = trunc i64 %314 to i32
  store i32 %315, i32* %x68.addr, align 4
  %316 = load i32, i32* %x68.addr, align 4
  %317 = load i32, i32* %x39.addr, align 4
  %318 = load i32, i32* %x41.addr, align 4
  %319 = call i64 @p256FiatAddcarryxU32(i32 %316, i32 %317, i32 %318)
  store i64 %319, i64* %w69.addr, align 8
  %320 = load i64, i64* %w69.addr, align 8
  %321 = trunc i64 %320 to i32
  store i32 %321, i32* %x69.addr, align 4
  %322 = load i64, i64* %w69.addr, align 8
  %323 = lshr i64 %322, 32
  %324 = trunc i64 %323 to i32
  store i32 %324, i32* %x70.addr, align 4
  %325 = load i32, i32* %x1.addr, align 4
  %326 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %327 = load i8*, i8** %326, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %328 = bitcast i8* %327 to i32*
  %329 = getelementptr inbounds i32, i32* %328, i64 7
  %330 = load i32, i32* %329, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %331 = call i64 @p256FiatMulxU32(i32 %325, i32 %330)
  store i64 %331, i64* %w71.addr, align 8
  %332 = load i64, i64* %w71.addr, align 8
  %333 = trunc i64 %332 to i32
  store i32 %333, i32* %x71.addr, align 4
  %334 = load i64, i64* %w71.addr, align 8
  %335 = lshr i64 %334, 32
  %336 = trunc i64 %335 to i32
  store i32 %336, i32* %x72.addr, align 4
  %337 = load i32, i32* %x1.addr, align 4
  %338 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %339 = load i8*, i8** %338, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %340 = bitcast i8* %339 to i32*
  %341 = getelementptr inbounds i32, i32* %340, i64 6
  %342 = load i32, i32* %341, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %343 = call i64 @p256FiatMulxU32(i32 %337, i32 %342)
  store i64 %343, i64* %w73.addr, align 8
  %344 = load i64, i64* %w73.addr, align 8
  %345 = trunc i64 %344 to i32
  store i32 %345, i32* %x73.addr, align 4
  %346 = load i64, i64* %w73.addr, align 8
  %347 = lshr i64 %346, 32
  %348 = trunc i64 %347 to i32
  store i32 %348, i32* %x74.addr, align 4
  %349 = load i32, i32* %x1.addr, align 4
  %350 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %351 = load i8*, i8** %350, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %352 = bitcast i8* %351 to i32*
  %353 = getelementptr inbounds i32, i32* %352, i64 5
  %354 = load i32, i32* %353, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %355 = call i64 @p256FiatMulxU32(i32 %349, i32 %354)
  store i64 %355, i64* %w75.addr, align 8
  %356 = load i64, i64* %w75.addr, align 8
  %357 = trunc i64 %356 to i32
  store i32 %357, i32* %x75.addr, align 4
  %358 = load i64, i64* %w75.addr, align 8
  %359 = lshr i64 %358, 32
  %360 = trunc i64 %359 to i32
  store i32 %360, i32* %x76.addr, align 4
  %361 = load i32, i32* %x1.addr, align 4
  %362 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %363 = load i8*, i8** %362, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %364 = bitcast i8* %363 to i32*
  %365 = getelementptr inbounds i32, i32* %364, i64 4
  %366 = load i32, i32* %365, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %367 = call i64 @p256FiatMulxU32(i32 %361, i32 %366)
  store i64 %367, i64* %w77.addr, align 8
  %368 = load i64, i64* %w77.addr, align 8
  %369 = trunc i64 %368 to i32
  store i32 %369, i32* %x77.addr, align 4
  %370 = load i64, i64* %w77.addr, align 8
  %371 = lshr i64 %370, 32
  %372 = trunc i64 %371 to i32
  store i32 %372, i32* %x78.addr, align 4
  %373 = load i32, i32* %x1.addr, align 4
  %374 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %375 = load i8*, i8** %374, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %376 = bitcast i8* %375 to i32*
  %377 = getelementptr inbounds i32, i32* %376, i64 3
  %378 = load i32, i32* %377, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %379 = call i64 @p256FiatMulxU32(i32 %373, i32 %378)
  store i64 %379, i64* %w79.addr, align 8
  %380 = load i64, i64* %w79.addr, align 8
  %381 = trunc i64 %380 to i32
  store i32 %381, i32* %x79.addr, align 4
  %382 = load i64, i64* %w79.addr, align 8
  %383 = lshr i64 %382, 32
  %384 = trunc i64 %383 to i32
  store i32 %384, i32* %x80.addr, align 4
  %385 = load i32, i32* %x1.addr, align 4
  %386 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %387 = load i8*, i8** %386, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %388 = bitcast i8* %387 to i32*
  %389 = getelementptr inbounds i32, i32* %388, i64 2
  %390 = load i32, i32* %389, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %391 = call i64 @p256FiatMulxU32(i32 %385, i32 %390)
  store i64 %391, i64* %w81.addr, align 8
  %392 = load i64, i64* %w81.addr, align 8
  %393 = trunc i64 %392 to i32
  store i32 %393, i32* %x81.addr, align 4
  %394 = load i64, i64* %w81.addr, align 8
  %395 = lshr i64 %394, 32
  %396 = trunc i64 %395 to i32
  store i32 %396, i32* %x82.addr, align 4
  %397 = load i32, i32* %x1.addr, align 4
  %398 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %399 = load i8*, i8** %398, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %400 = bitcast i8* %399 to i32*
  %401 = getelementptr inbounds i32, i32* %400, i64 1
  %402 = load i32, i32* %401, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %403 = call i64 @p256FiatMulxU32(i32 %397, i32 %402)
  store i64 %403, i64* %w83.addr, align 8
  %404 = load i64, i64* %w83.addr, align 8
  %405 = trunc i64 %404 to i32
  store i32 %405, i32* %x83.addr, align 4
  %406 = load i64, i64* %w83.addr, align 8
  %407 = lshr i64 %406, 32
  %408 = trunc i64 %407 to i32
  store i32 %408, i32* %x84.addr, align 4
  %409 = load i32, i32* %x1.addr, align 4
  %410 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %411 = load i8*, i8** %410, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %412 = bitcast i8* %411 to i32*
  %413 = getelementptr inbounds i32, i32* %412, i64 0
  %414 = load i32, i32* %413, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %415 = call i64 @p256FiatMulxU32(i32 %409, i32 %414)
  store i64 %415, i64* %w85.addr, align 8
  %416 = load i64, i64* %w85.addr, align 8
  %417 = trunc i64 %416 to i32
  store i32 %417, i32* %x85.addr, align 4
  %418 = load i64, i64* %w85.addr, align 8
  %419 = lshr i64 %418, 32
  %420 = trunc i64 %419 to i32
  store i32 %420, i32* %x86.addr, align 4
  %421 = load i32, i32* %x86.addr, align 4
  %422 = load i32, i32* %x83.addr, align 4
  %423 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %421, i32 %422)
  store i64 %423, i64* %w87.addr, align 8
  %424 = load i64, i64* %w87.addr, align 8
  %425 = trunc i64 %424 to i32
  store i32 %425, i32* %x87.addr, align 4
  %426 = load i64, i64* %w87.addr, align 8
  %427 = lshr i64 %426, 32
  %428 = trunc i64 %427 to i32
  store i32 %428, i32* %x88.addr, align 4
  %429 = load i32, i32* %x88.addr, align 4
  %430 = load i32, i32* %x84.addr, align 4
  %431 = load i32, i32* %x81.addr, align 4
  %432 = call i64 @p256FiatAddcarryxU32(i32 %429, i32 %430, i32 %431)
  store i64 %432, i64* %w89.addr, align 8
  %433 = load i64, i64* %w89.addr, align 8
  %434 = trunc i64 %433 to i32
  store i32 %434, i32* %x89.addr, align 4
  %435 = load i64, i64* %w89.addr, align 8
  %436 = lshr i64 %435, 32
  %437 = trunc i64 %436 to i32
  store i32 %437, i32* %x90.addr, align 4
  %438 = load i32, i32* %x90.addr, align 4
  %439 = load i32, i32* %x82.addr, align 4
  %440 = load i32, i32* %x79.addr, align 4
  %441 = call i64 @p256FiatAddcarryxU32(i32 %438, i32 %439, i32 %440)
  store i64 %441, i64* %w91.addr, align 8
  %442 = load i64, i64* %w91.addr, align 8
  %443 = trunc i64 %442 to i32
  store i32 %443, i32* %x91.addr, align 4
  %444 = load i64, i64* %w91.addr, align 8
  %445 = lshr i64 %444, 32
  %446 = trunc i64 %445 to i32
  store i32 %446, i32* %x92.addr, align 4
  %447 = load i32, i32* %x92.addr, align 4
  %448 = load i32, i32* %x80.addr, align 4
  %449 = load i32, i32* %x77.addr, align 4
  %450 = call i64 @p256FiatAddcarryxU32(i32 %447, i32 %448, i32 %449)
  store i64 %450, i64* %w93.addr, align 8
  %451 = load i64, i64* %w93.addr, align 8
  %452 = trunc i64 %451 to i32
  store i32 %452, i32* %x93.addr, align 4
  %453 = load i64, i64* %w93.addr, align 8
  %454 = lshr i64 %453, 32
  %455 = trunc i64 %454 to i32
  store i32 %455, i32* %x94.addr, align 4
  %456 = load i32, i32* %x94.addr, align 4
  %457 = load i32, i32* %x78.addr, align 4
  %458 = load i32, i32* %x75.addr, align 4
  %459 = call i64 @p256FiatAddcarryxU32(i32 %456, i32 %457, i32 %458)
  store i64 %459, i64* %w95.addr, align 8
  %460 = load i64, i64* %w95.addr, align 8
  %461 = trunc i64 %460 to i32
  store i32 %461, i32* %x95.addr, align 4
  %462 = load i64, i64* %w95.addr, align 8
  %463 = lshr i64 %462, 32
  %464 = trunc i64 %463 to i32
  store i32 %464, i32* %x96.addr, align 4
  %465 = load i32, i32* %x96.addr, align 4
  %466 = load i32, i32* %x76.addr, align 4
  %467 = load i32, i32* %x73.addr, align 4
  %468 = call i64 @p256FiatAddcarryxU32(i32 %465, i32 %466, i32 %467)
  store i64 %468, i64* %w97.addr, align 8
  %469 = load i64, i64* %w97.addr, align 8
  %470 = trunc i64 %469 to i32
  store i32 %470, i32* %x97.addr, align 4
  %471 = load i64, i64* %w97.addr, align 8
  %472 = lshr i64 %471, 32
  %473 = trunc i64 %472 to i32
  store i32 %473, i32* %x98.addr, align 4
  %474 = load i32, i32* %x98.addr, align 4
  %475 = load i32, i32* %x74.addr, align 4
  %476 = load i32, i32* %x71.addr, align 4
  %477 = call i64 @p256FiatAddcarryxU32(i32 %474, i32 %475, i32 %476)
  store i64 %477, i64* %w99.addr, align 8
  %478 = load i64, i64* %w99.addr, align 8
  %479 = trunc i64 %478 to i32
  store i32 %479, i32* %x99.addr, align 4
  %480 = load i64, i64* %w99.addr, align 8
  %481 = lshr i64 %480, 32
  %482 = trunc i64 %481 to i32
  store i32 %482, i32* %x100.addr, align 4
  %483 = load i32, i32* %x100.addr, align 4
  %484 = load i32, i32* %x72.addr, align 4
  %485 = add i32 %483, %484
  store i32 %485, i32* %x101.addr, align 4
  %486 = load i32, i32* %x55.addr, align 4
  %487 = load i32, i32* %x85.addr, align 4
  %488 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %486, i32 %487)
  store i64 %488, i64* %w102.addr, align 8
  %489 = load i64, i64* %w102.addr, align 8
  %490 = trunc i64 %489 to i32
  store i32 %490, i32* %x102.addr, align 4
  %491 = load i64, i64* %w102.addr, align 8
  %492 = lshr i64 %491, 32
  %493 = trunc i64 %492 to i32
  store i32 %493, i32* %x103.addr, align 4
  %494 = load i32, i32* %x103.addr, align 4
  %495 = load i32, i32* %x57.addr, align 4
  %496 = load i32, i32* %x87.addr, align 4
  %497 = call i64 @p256FiatAddcarryxU32(i32 %494, i32 %495, i32 %496)
  store i64 %497, i64* %w104.addr, align 8
  %498 = load i64, i64* %w104.addr, align 8
  %499 = trunc i64 %498 to i32
  store i32 %499, i32* %x104.addr, align 4
  %500 = load i64, i64* %w104.addr, align 8
  %501 = lshr i64 %500, 32
  %502 = trunc i64 %501 to i32
  store i32 %502, i32* %x105.addr, align 4
  %503 = load i32, i32* %x105.addr, align 4
  %504 = load i32, i32* %x59.addr, align 4
  %505 = load i32, i32* %x89.addr, align 4
  %506 = call i64 @p256FiatAddcarryxU32(i32 %503, i32 %504, i32 %505)
  store i64 %506, i64* %w106.addr, align 8
  %507 = load i64, i64* %w106.addr, align 8
  %508 = trunc i64 %507 to i32
  store i32 %508, i32* %x106.addr, align 4
  %509 = load i64, i64* %w106.addr, align 8
  %510 = lshr i64 %509, 32
  %511 = trunc i64 %510 to i32
  store i32 %511, i32* %x107.addr, align 4
  %512 = load i32, i32* %x107.addr, align 4
  %513 = load i32, i32* %x61.addr, align 4
  %514 = load i32, i32* %x91.addr, align 4
  %515 = call i64 @p256FiatAddcarryxU32(i32 %512, i32 %513, i32 %514)
  store i64 %515, i64* %w108.addr, align 8
  %516 = load i64, i64* %w108.addr, align 8
  %517 = trunc i64 %516 to i32
  store i32 %517, i32* %x108.addr, align 4
  %518 = load i64, i64* %w108.addr, align 8
  %519 = lshr i64 %518, 32
  %520 = trunc i64 %519 to i32
  store i32 %520, i32* %x109.addr, align 4
  %521 = load i32, i32* %x109.addr, align 4
  %522 = load i32, i32* %x63.addr, align 4
  %523 = load i32, i32* %x93.addr, align 4
  %524 = call i64 @p256FiatAddcarryxU32(i32 %521, i32 %522, i32 %523)
  store i64 %524, i64* %w110.addr, align 8
  %525 = load i64, i64* %w110.addr, align 8
  %526 = trunc i64 %525 to i32
  store i32 %526, i32* %x110.addr, align 4
  %527 = load i64, i64* %w110.addr, align 8
  %528 = lshr i64 %527, 32
  %529 = trunc i64 %528 to i32
  store i32 %529, i32* %x111.addr, align 4
  %530 = load i32, i32* %x111.addr, align 4
  %531 = load i32, i32* %x65.addr, align 4
  %532 = load i32, i32* %x95.addr, align 4
  %533 = call i64 @p256FiatAddcarryxU32(i32 %530, i32 %531, i32 %532)
  store i64 %533, i64* %w112.addr, align 8
  %534 = load i64, i64* %w112.addr, align 8
  %535 = trunc i64 %534 to i32
  store i32 %535, i32* %x112.addr, align 4
  %536 = load i64, i64* %w112.addr, align 8
  %537 = lshr i64 %536, 32
  %538 = trunc i64 %537 to i32
  store i32 %538, i32* %x113.addr, align 4
  %539 = load i32, i32* %x113.addr, align 4
  %540 = load i32, i32* %x67.addr, align 4
  %541 = load i32, i32* %x97.addr, align 4
  %542 = call i64 @p256FiatAddcarryxU32(i32 %539, i32 %540, i32 %541)
  store i64 %542, i64* %w114.addr, align 8
  %543 = load i64, i64* %w114.addr, align 8
  %544 = trunc i64 %543 to i32
  store i32 %544, i32* %x114.addr, align 4
  %545 = load i64, i64* %w114.addr, align 8
  %546 = lshr i64 %545, 32
  %547 = trunc i64 %546 to i32
  store i32 %547, i32* %x115.addr, align 4
  %548 = load i32, i32* %x115.addr, align 4
  %549 = load i32, i32* %x69.addr, align 4
  %550 = load i32, i32* %x99.addr, align 4
  %551 = call i64 @p256FiatAddcarryxU32(i32 %548, i32 %549, i32 %550)
  store i64 %551, i64* %w116.addr, align 8
  %552 = load i64, i64* %w116.addr, align 8
  %553 = trunc i64 %552 to i32
  store i32 %553, i32* %x116.addr, align 4
  %554 = load i64, i64* %w116.addr, align 8
  %555 = lshr i64 %554, 32
  %556 = trunc i64 %555 to i32
  store i32 %556, i32* %x117.addr, align 4
  %557 = load i32, i32* %x117.addr, align 4
  %558 = load i32, i32* %x70.addr, align 4
  %559 = load i32, i32* %x101.addr, align 4
  %560 = call i64 @p256FiatAddcarryxU32(i32 %557, i32 %558, i32 %559)
  store i64 %560, i64* %w118.addr, align 8
  %561 = load i64, i64* %w118.addr, align 8
  %562 = trunc i64 %561 to i32
  store i32 %562, i32* %x118.addr, align 4
  %563 = load i64, i64* %w118.addr, align 8
  %564 = lshr i64 %563, 32
  %565 = trunc i64 %564 to i32
  store i32 %565, i32* %x119.addr, align 4
  %566 = load i32, i32* %x102.addr, align 4
  %567 = call i64 @p256FiatMulxU32(i32 %566, i32 4294967295)
  store i64 %567, i64* %w120.addr, align 8
  %568 = load i64, i64* %w120.addr, align 8
  %569 = trunc i64 %568 to i32
  store i32 %569, i32* %x120.addr, align 4
  %570 = load i64, i64* %w120.addr, align 8
  %571 = lshr i64 %570, 32
  %572 = trunc i64 %571 to i32
  store i32 %572, i32* %x121.addr, align 4
  %573 = load i32, i32* %x102.addr, align 4
  %574 = call i64 @p256FiatMulxU32(i32 %573, i32 4294967295)
  store i64 %574, i64* %w122.addr, align 8
  %575 = load i64, i64* %w122.addr, align 8
  %576 = trunc i64 %575 to i32
  store i32 %576, i32* %x122.addr, align 4
  %577 = load i64, i64* %w122.addr, align 8
  %578 = lshr i64 %577, 32
  %579 = trunc i64 %578 to i32
  store i32 %579, i32* %x123.addr, align 4
  %580 = load i32, i32* %x102.addr, align 4
  %581 = call i64 @p256FiatMulxU32(i32 %580, i32 4294967295)
  store i64 %581, i64* %w124.addr, align 8
  %582 = load i64, i64* %w124.addr, align 8
  %583 = trunc i64 %582 to i32
  store i32 %583, i32* %x124.addr, align 4
  %584 = load i64, i64* %w124.addr, align 8
  %585 = lshr i64 %584, 32
  %586 = trunc i64 %585 to i32
  store i32 %586, i32* %x125.addr, align 4
  %587 = load i32, i32* %x102.addr, align 4
  %588 = call i64 @p256FiatMulxU32(i32 %587, i32 4294967295)
  store i64 %588, i64* %w126.addr, align 8
  %589 = load i64, i64* %w126.addr, align 8
  %590 = trunc i64 %589 to i32
  store i32 %590, i32* %x126.addr, align 4
  %591 = load i64, i64* %w126.addr, align 8
  %592 = lshr i64 %591, 32
  %593 = trunc i64 %592 to i32
  store i32 %593, i32* %x127.addr, align 4
  %594 = load i32, i32* %x127.addr, align 4
  %595 = load i32, i32* %x124.addr, align 4
  %596 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %594, i32 %595)
  store i64 %596, i64* %w128.addr, align 8
  %597 = load i64, i64* %w128.addr, align 8
  %598 = trunc i64 %597 to i32
  store i32 %598, i32* %x128.addr, align 4
  %599 = load i64, i64* %w128.addr, align 8
  %600 = lshr i64 %599, 32
  %601 = trunc i64 %600 to i32
  store i32 %601, i32* %x129.addr, align 4
  %602 = load i32, i32* %x129.addr, align 4
  %603 = load i32, i32* %x125.addr, align 4
  %604 = load i32, i32* %x122.addr, align 4
  %605 = call i64 @p256FiatAddcarryxU32(i32 %602, i32 %603, i32 %604)
  store i64 %605, i64* %w130.addr, align 8
  %606 = load i64, i64* %w130.addr, align 8
  %607 = trunc i64 %606 to i32
  store i32 %607, i32* %x130.addr, align 4
  %608 = load i64, i64* %w130.addr, align 8
  %609 = lshr i64 %608, 32
  %610 = trunc i64 %609 to i32
  store i32 %610, i32* %x131.addr, align 4
  %611 = load i32, i32* %x131.addr, align 4
  %612 = load i32, i32* %x123.addr, align 4
  %613 = add i32 %611, %612
  store i32 %613, i32* %x132.addr, align 4
  %614 = load i32, i32* %x102.addr, align 4
  %615 = load i32, i32* %x126.addr, align 4
  %616 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %614, i32 %615)
  store i64 %616, i64* %w133.addr, align 8
  %617 = load i64, i64* %w133.addr, align 8
  %618 = lshr i64 %617, 32
  %619 = trunc i64 %618 to i32
  store i32 %619, i32* %x134.addr, align 4
  %620 = load i32, i32* %x134.addr, align 4
  %621 = load i32, i32* %x104.addr, align 4
  %622 = load i32, i32* %x128.addr, align 4
  %623 = call i64 @p256FiatAddcarryxU32(i32 %620, i32 %621, i32 %622)
  store i64 %623, i64* %w135.addr, align 8
  %624 = load i64, i64* %w135.addr, align 8
  %625 = trunc i64 %624 to i32
  store i32 %625, i32* %x135.addr, align 4
  %626 = load i64, i64* %w135.addr, align 8
  %627 = lshr i64 %626, 32
  %628 = trunc i64 %627 to i32
  store i32 %628, i32* %x136.addr, align 4
  %629 = load i32, i32* %x136.addr, align 4
  %630 = load i32, i32* %x106.addr, align 4
  %631 = load i32, i32* %x130.addr, align 4
  %632 = call i64 @p256FiatAddcarryxU32(i32 %629, i32 %630, i32 %631)
  store i64 %632, i64* %w137.addr, align 8
  %633 = load i64, i64* %w137.addr, align 8
  %634 = trunc i64 %633 to i32
  store i32 %634, i32* %x137.addr, align 4
  %635 = load i64, i64* %w137.addr, align 8
  %636 = lshr i64 %635, 32
  %637 = trunc i64 %636 to i32
  store i32 %637, i32* %x138.addr, align 4
  %638 = load i32, i32* %x138.addr, align 4
  %639 = load i32, i32* %x108.addr, align 4
  %640 = load i32, i32* %x132.addr, align 4
  %641 = call i64 @p256FiatAddcarryxU32(i32 %638, i32 %639, i32 %640)
  store i64 %641, i64* %w139.addr, align 8
  %642 = load i64, i64* %w139.addr, align 8
  %643 = trunc i64 %642 to i32
  store i32 %643, i32* %x139.addr, align 4
  %644 = load i64, i64* %w139.addr, align 8
  %645 = lshr i64 %644, 32
  %646 = trunc i64 %645 to i32
  store i32 %646, i32* %x140.addr, align 4
  %647 = load i32, i32* %x140.addr, align 4
  %648 = load i32, i32* %x110.addr, align 4
  %649 = call i64 @p256FiatAddcarryxU32(i32 %647, i32 %648, i32 0)
  store i64 %649, i64* %w141.addr, align 8
  %650 = load i64, i64* %w141.addr, align 8
  %651 = trunc i64 %650 to i32
  store i32 %651, i32* %x141.addr, align 4
  %652 = load i64, i64* %w141.addr, align 8
  %653 = lshr i64 %652, 32
  %654 = trunc i64 %653 to i32
  store i32 %654, i32* %x142.addr, align 4
  %655 = load i32, i32* %x142.addr, align 4
  %656 = load i32, i32* %x112.addr, align 4
  %657 = call i64 @p256FiatAddcarryxU32(i32 %655, i32 %656, i32 0)
  store i64 %657, i64* %w143.addr, align 8
  %658 = load i64, i64* %w143.addr, align 8
  %659 = trunc i64 %658 to i32
  store i32 %659, i32* %x143.addr, align 4
  %660 = load i64, i64* %w143.addr, align 8
  %661 = lshr i64 %660, 32
  %662 = trunc i64 %661 to i32
  store i32 %662, i32* %x144.addr, align 4
  %663 = load i32, i32* %x144.addr, align 4
  %664 = load i32, i32* %x114.addr, align 4
  %665 = load i32, i32* %x102.addr, align 4
  %666 = call i64 @p256FiatAddcarryxU32(i32 %663, i32 %664, i32 %665)
  store i64 %666, i64* %w145.addr, align 8
  %667 = load i64, i64* %w145.addr, align 8
  %668 = trunc i64 %667 to i32
  store i32 %668, i32* %x145.addr, align 4
  %669 = load i64, i64* %w145.addr, align 8
  %670 = lshr i64 %669, 32
  %671 = trunc i64 %670 to i32
  store i32 %671, i32* %x146.addr, align 4
  %672 = load i32, i32* %x146.addr, align 4
  %673 = load i32, i32* %x116.addr, align 4
  %674 = load i32, i32* %x120.addr, align 4
  %675 = call i64 @p256FiatAddcarryxU32(i32 %672, i32 %673, i32 %674)
  store i64 %675, i64* %w147.addr, align 8
  %676 = load i64, i64* %w147.addr, align 8
  %677 = trunc i64 %676 to i32
  store i32 %677, i32* %x147.addr, align 4
  %678 = load i64, i64* %w147.addr, align 8
  %679 = lshr i64 %678, 32
  %680 = trunc i64 %679 to i32
  store i32 %680, i32* %x148.addr, align 4
  %681 = load i32, i32* %x148.addr, align 4
  %682 = load i32, i32* %x118.addr, align 4
  %683 = load i32, i32* %x121.addr, align 4
  %684 = call i64 @p256FiatAddcarryxU32(i32 %681, i32 %682, i32 %683)
  store i64 %684, i64* %w149.addr, align 8
  %685 = load i64, i64* %w149.addr, align 8
  %686 = trunc i64 %685 to i32
  store i32 %686, i32* %x149.addr, align 4
  %687 = load i64, i64* %w149.addr, align 8
  %688 = lshr i64 %687, 32
  %689 = trunc i64 %688 to i32
  store i32 %689, i32* %x150.addr, align 4
  %690 = load i32, i32* %x150.addr, align 4
  %691 = load i32, i32* %x119.addr, align 4
  %692 = add i32 %690, %691
  store i32 %692, i32* %x151.addr, align 4
  %693 = load i32, i32* %x2.addr, align 4
  %694 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %695 = load i8*, i8** %694, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %696 = bitcast i8* %695 to i32*
  %697 = getelementptr inbounds i32, i32* %696, i64 7
  %698 = load i32, i32* %697, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %699 = call i64 @p256FiatMulxU32(i32 %693, i32 %698)
  store i64 %699, i64* %w152.addr, align 8
  %700 = load i64, i64* %w152.addr, align 8
  %701 = trunc i64 %700 to i32
  store i32 %701, i32* %x152.addr, align 4
  %702 = load i64, i64* %w152.addr, align 8
  %703 = lshr i64 %702, 32
  %704 = trunc i64 %703 to i32
  store i32 %704, i32* %x153.addr, align 4
  %705 = load i32, i32* %x2.addr, align 4
  %706 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %707 = load i8*, i8** %706, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %708 = bitcast i8* %707 to i32*
  %709 = getelementptr inbounds i32, i32* %708, i64 6
  %710 = load i32, i32* %709, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %711 = call i64 @p256FiatMulxU32(i32 %705, i32 %710)
  store i64 %711, i64* %w154.addr, align 8
  %712 = load i64, i64* %w154.addr, align 8
  %713 = trunc i64 %712 to i32
  store i32 %713, i32* %x154.addr, align 4
  %714 = load i64, i64* %w154.addr, align 8
  %715 = lshr i64 %714, 32
  %716 = trunc i64 %715 to i32
  store i32 %716, i32* %x155.addr, align 4
  %717 = load i32, i32* %x2.addr, align 4
  %718 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %719 = load i8*, i8** %718, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %720 = bitcast i8* %719 to i32*
  %721 = getelementptr inbounds i32, i32* %720, i64 5
  %722 = load i32, i32* %721, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %723 = call i64 @p256FiatMulxU32(i32 %717, i32 %722)
  store i64 %723, i64* %w156.addr, align 8
  %724 = load i64, i64* %w156.addr, align 8
  %725 = trunc i64 %724 to i32
  store i32 %725, i32* %x156.addr, align 4
  %726 = load i64, i64* %w156.addr, align 8
  %727 = lshr i64 %726, 32
  %728 = trunc i64 %727 to i32
  store i32 %728, i32* %x157.addr, align 4
  %729 = load i32, i32* %x2.addr, align 4
  %730 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %731 = load i8*, i8** %730, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %732 = bitcast i8* %731 to i32*
  %733 = getelementptr inbounds i32, i32* %732, i64 4
  %734 = load i32, i32* %733, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %735 = call i64 @p256FiatMulxU32(i32 %729, i32 %734)
  store i64 %735, i64* %w158.addr, align 8
  %736 = load i64, i64* %w158.addr, align 8
  %737 = trunc i64 %736 to i32
  store i32 %737, i32* %x158.addr, align 4
  %738 = load i64, i64* %w158.addr, align 8
  %739 = lshr i64 %738, 32
  %740 = trunc i64 %739 to i32
  store i32 %740, i32* %x159.addr, align 4
  %741 = load i32, i32* %x2.addr, align 4
  %742 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %743 = load i8*, i8** %742, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %744 = bitcast i8* %743 to i32*
  %745 = getelementptr inbounds i32, i32* %744, i64 3
  %746 = load i32, i32* %745, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %747 = call i64 @p256FiatMulxU32(i32 %741, i32 %746)
  store i64 %747, i64* %w160.addr, align 8
  %748 = load i64, i64* %w160.addr, align 8
  %749 = trunc i64 %748 to i32
  store i32 %749, i32* %x160.addr, align 4
  %750 = load i64, i64* %w160.addr, align 8
  %751 = lshr i64 %750, 32
  %752 = trunc i64 %751 to i32
  store i32 %752, i32* %x161.addr, align 4
  %753 = load i32, i32* %x2.addr, align 4
  %754 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %755 = load i8*, i8** %754, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %756 = bitcast i8* %755 to i32*
  %757 = getelementptr inbounds i32, i32* %756, i64 2
  %758 = load i32, i32* %757, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %759 = call i64 @p256FiatMulxU32(i32 %753, i32 %758)
  store i64 %759, i64* %w162.addr, align 8
  %760 = load i64, i64* %w162.addr, align 8
  %761 = trunc i64 %760 to i32
  store i32 %761, i32* %x162.addr, align 4
  %762 = load i64, i64* %w162.addr, align 8
  %763 = lshr i64 %762, 32
  %764 = trunc i64 %763 to i32
  store i32 %764, i32* %x163.addr, align 4
  %765 = load i32, i32* %x2.addr, align 4
  %766 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %767 = load i8*, i8** %766, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %768 = bitcast i8* %767 to i32*
  %769 = getelementptr inbounds i32, i32* %768, i64 1
  %770 = load i32, i32* %769, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %771 = call i64 @p256FiatMulxU32(i32 %765, i32 %770)
  store i64 %771, i64* %w164.addr, align 8
  %772 = load i64, i64* %w164.addr, align 8
  %773 = trunc i64 %772 to i32
  store i32 %773, i32* %x164.addr, align 4
  %774 = load i64, i64* %w164.addr, align 8
  %775 = lshr i64 %774, 32
  %776 = trunc i64 %775 to i32
  store i32 %776, i32* %x165.addr, align 4
  %777 = load i32, i32* %x2.addr, align 4
  %778 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %779 = load i8*, i8** %778, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %780 = bitcast i8* %779 to i32*
  %781 = getelementptr inbounds i32, i32* %780, i64 0
  %782 = load i32, i32* %781, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %783 = call i64 @p256FiatMulxU32(i32 %777, i32 %782)
  store i64 %783, i64* %w166.addr, align 8
  %784 = load i64, i64* %w166.addr, align 8
  %785 = trunc i64 %784 to i32
  store i32 %785, i32* %x166.addr, align 4
  %786 = load i64, i64* %w166.addr, align 8
  %787 = lshr i64 %786, 32
  %788 = trunc i64 %787 to i32
  store i32 %788, i32* %x167.addr, align 4
  %789 = load i32, i32* %x167.addr, align 4
  %790 = load i32, i32* %x164.addr, align 4
  %791 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %789, i32 %790)
  store i64 %791, i64* %w168.addr, align 8
  %792 = load i64, i64* %w168.addr, align 8
  %793 = trunc i64 %792 to i32
  store i32 %793, i32* %x168.addr, align 4
  %794 = load i64, i64* %w168.addr, align 8
  %795 = lshr i64 %794, 32
  %796 = trunc i64 %795 to i32
  store i32 %796, i32* %x169.addr, align 4
  %797 = load i32, i32* %x169.addr, align 4
  %798 = load i32, i32* %x165.addr, align 4
  %799 = load i32, i32* %x162.addr, align 4
  %800 = call i64 @p256FiatAddcarryxU32(i32 %797, i32 %798, i32 %799)
  store i64 %800, i64* %w170.addr, align 8
  %801 = load i64, i64* %w170.addr, align 8
  %802 = trunc i64 %801 to i32
  store i32 %802, i32* %x170.addr, align 4
  %803 = load i64, i64* %w170.addr, align 8
  %804 = lshr i64 %803, 32
  %805 = trunc i64 %804 to i32
  store i32 %805, i32* %x171.addr, align 4
  %806 = load i32, i32* %x171.addr, align 4
  %807 = load i32, i32* %x163.addr, align 4
  %808 = load i32, i32* %x160.addr, align 4
  %809 = call i64 @p256FiatAddcarryxU32(i32 %806, i32 %807, i32 %808)
  store i64 %809, i64* %w172.addr, align 8
  %810 = load i64, i64* %w172.addr, align 8
  %811 = trunc i64 %810 to i32
  store i32 %811, i32* %x172.addr, align 4
  %812 = load i64, i64* %w172.addr, align 8
  %813 = lshr i64 %812, 32
  %814 = trunc i64 %813 to i32
  store i32 %814, i32* %x173.addr, align 4
  %815 = load i32, i32* %x173.addr, align 4
  %816 = load i32, i32* %x161.addr, align 4
  %817 = load i32, i32* %x158.addr, align 4
  %818 = call i64 @p256FiatAddcarryxU32(i32 %815, i32 %816, i32 %817)
  store i64 %818, i64* %w174.addr, align 8
  %819 = load i64, i64* %w174.addr, align 8
  %820 = trunc i64 %819 to i32
  store i32 %820, i32* %x174.addr, align 4
  %821 = load i64, i64* %w174.addr, align 8
  %822 = lshr i64 %821, 32
  %823 = trunc i64 %822 to i32
  store i32 %823, i32* %x175.addr, align 4
  %824 = load i32, i32* %x175.addr, align 4
  %825 = load i32, i32* %x159.addr, align 4
  %826 = load i32, i32* %x156.addr, align 4
  %827 = call i64 @p256FiatAddcarryxU32(i32 %824, i32 %825, i32 %826)
  store i64 %827, i64* %w176.addr, align 8
  %828 = load i64, i64* %w176.addr, align 8
  %829 = trunc i64 %828 to i32
  store i32 %829, i32* %x176.addr, align 4
  %830 = load i64, i64* %w176.addr, align 8
  %831 = lshr i64 %830, 32
  %832 = trunc i64 %831 to i32
  store i32 %832, i32* %x177.addr, align 4
  %833 = load i32, i32* %x177.addr, align 4
  %834 = load i32, i32* %x157.addr, align 4
  %835 = load i32, i32* %x154.addr, align 4
  %836 = call i64 @p256FiatAddcarryxU32(i32 %833, i32 %834, i32 %835)
  store i64 %836, i64* %w178.addr, align 8
  %837 = load i64, i64* %w178.addr, align 8
  %838 = trunc i64 %837 to i32
  store i32 %838, i32* %x178.addr, align 4
  %839 = load i64, i64* %w178.addr, align 8
  %840 = lshr i64 %839, 32
  %841 = trunc i64 %840 to i32
  store i32 %841, i32* %x179.addr, align 4
  %842 = load i32, i32* %x179.addr, align 4
  %843 = load i32, i32* %x155.addr, align 4
  %844 = load i32, i32* %x152.addr, align 4
  %845 = call i64 @p256FiatAddcarryxU32(i32 %842, i32 %843, i32 %844)
  store i64 %845, i64* %w180.addr, align 8
  %846 = load i64, i64* %w180.addr, align 8
  %847 = trunc i64 %846 to i32
  store i32 %847, i32* %x180.addr, align 4
  %848 = load i64, i64* %w180.addr, align 8
  %849 = lshr i64 %848, 32
  %850 = trunc i64 %849 to i32
  store i32 %850, i32* %x181.addr, align 4
  %851 = load i32, i32* %x181.addr, align 4
  %852 = load i32, i32* %x153.addr, align 4
  %853 = add i32 %851, %852
  store i32 %853, i32* %x182.addr, align 4
  %854 = load i32, i32* %x135.addr, align 4
  %855 = load i32, i32* %x166.addr, align 4
  %856 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %854, i32 %855)
  store i64 %856, i64* %w183.addr, align 8
  %857 = load i64, i64* %w183.addr, align 8
  %858 = trunc i64 %857 to i32
  store i32 %858, i32* %x183.addr, align 4
  %859 = load i64, i64* %w183.addr, align 8
  %860 = lshr i64 %859, 32
  %861 = trunc i64 %860 to i32
  store i32 %861, i32* %x184.addr, align 4
  %862 = load i32, i32* %x184.addr, align 4
  %863 = load i32, i32* %x137.addr, align 4
  %864 = load i32, i32* %x168.addr, align 4
  %865 = call i64 @p256FiatAddcarryxU32(i32 %862, i32 %863, i32 %864)
  store i64 %865, i64* %w185.addr, align 8
  %866 = load i64, i64* %w185.addr, align 8
  %867 = trunc i64 %866 to i32
  store i32 %867, i32* %x185.addr, align 4
  %868 = load i64, i64* %w185.addr, align 8
  %869 = lshr i64 %868, 32
  %870 = trunc i64 %869 to i32
  store i32 %870, i32* %x186.addr, align 4
  %871 = load i32, i32* %x186.addr, align 4
  %872 = load i32, i32* %x139.addr, align 4
  %873 = load i32, i32* %x170.addr, align 4
  %874 = call i64 @p256FiatAddcarryxU32(i32 %871, i32 %872, i32 %873)
  store i64 %874, i64* %w187.addr, align 8
  %875 = load i64, i64* %w187.addr, align 8
  %876 = trunc i64 %875 to i32
  store i32 %876, i32* %x187.addr, align 4
  %877 = load i64, i64* %w187.addr, align 8
  %878 = lshr i64 %877, 32
  %879 = trunc i64 %878 to i32
  store i32 %879, i32* %x188.addr, align 4
  %880 = load i32, i32* %x188.addr, align 4
  %881 = load i32, i32* %x141.addr, align 4
  %882 = load i32, i32* %x172.addr, align 4
  %883 = call i64 @p256FiatAddcarryxU32(i32 %880, i32 %881, i32 %882)
  store i64 %883, i64* %w189.addr, align 8
  %884 = load i64, i64* %w189.addr, align 8
  %885 = trunc i64 %884 to i32
  store i32 %885, i32* %x189.addr, align 4
  %886 = load i64, i64* %w189.addr, align 8
  %887 = lshr i64 %886, 32
  %888 = trunc i64 %887 to i32
  store i32 %888, i32* %x190.addr, align 4
  %889 = load i32, i32* %x190.addr, align 4
  %890 = load i32, i32* %x143.addr, align 4
  %891 = load i32, i32* %x174.addr, align 4
  %892 = call i64 @p256FiatAddcarryxU32(i32 %889, i32 %890, i32 %891)
  store i64 %892, i64* %w191.addr, align 8
  %893 = load i64, i64* %w191.addr, align 8
  %894 = trunc i64 %893 to i32
  store i32 %894, i32* %x191.addr, align 4
  %895 = load i64, i64* %w191.addr, align 8
  %896 = lshr i64 %895, 32
  %897 = trunc i64 %896 to i32
  store i32 %897, i32* %x192.addr, align 4
  %898 = load i32, i32* %x192.addr, align 4
  %899 = load i32, i32* %x145.addr, align 4
  %900 = load i32, i32* %x176.addr, align 4
  %901 = call i64 @p256FiatAddcarryxU32(i32 %898, i32 %899, i32 %900)
  store i64 %901, i64* %w193.addr, align 8
  %902 = load i64, i64* %w193.addr, align 8
  %903 = trunc i64 %902 to i32
  store i32 %903, i32* %x193.addr, align 4
  %904 = load i64, i64* %w193.addr, align 8
  %905 = lshr i64 %904, 32
  %906 = trunc i64 %905 to i32
  store i32 %906, i32* %x194.addr, align 4
  %907 = load i32, i32* %x194.addr, align 4
  %908 = load i32, i32* %x147.addr, align 4
  %909 = load i32, i32* %x178.addr, align 4
  %910 = call i64 @p256FiatAddcarryxU32(i32 %907, i32 %908, i32 %909)
  store i64 %910, i64* %w195.addr, align 8
  %911 = load i64, i64* %w195.addr, align 8
  %912 = trunc i64 %911 to i32
  store i32 %912, i32* %x195.addr, align 4
  %913 = load i64, i64* %w195.addr, align 8
  %914 = lshr i64 %913, 32
  %915 = trunc i64 %914 to i32
  store i32 %915, i32* %x196.addr, align 4
  %916 = load i32, i32* %x196.addr, align 4
  %917 = load i32, i32* %x149.addr, align 4
  %918 = load i32, i32* %x180.addr, align 4
  %919 = call i64 @p256FiatAddcarryxU32(i32 %916, i32 %917, i32 %918)
  store i64 %919, i64* %w197.addr, align 8
  %920 = load i64, i64* %w197.addr, align 8
  %921 = trunc i64 %920 to i32
  store i32 %921, i32* %x197.addr, align 4
  %922 = load i64, i64* %w197.addr, align 8
  %923 = lshr i64 %922, 32
  %924 = trunc i64 %923 to i32
  store i32 %924, i32* %x198.addr, align 4
  %925 = load i32, i32* %x198.addr, align 4
  %926 = load i32, i32* %x151.addr, align 4
  %927 = load i32, i32* %x182.addr, align 4
  %928 = call i64 @p256FiatAddcarryxU32(i32 %925, i32 %926, i32 %927)
  store i64 %928, i64* %w199.addr, align 8
  %929 = load i64, i64* %w199.addr, align 8
  %930 = trunc i64 %929 to i32
  store i32 %930, i32* %x199.addr, align 4
  %931 = load i64, i64* %w199.addr, align 8
  %932 = lshr i64 %931, 32
  %933 = trunc i64 %932 to i32
  store i32 %933, i32* %x200.addr, align 4
  %934 = load i32, i32* %x183.addr, align 4
  %935 = call i64 @p256FiatMulxU32(i32 %934, i32 4294967295)
  store i64 %935, i64* %w201.addr, align 8
  %936 = load i64, i64* %w201.addr, align 8
  %937 = trunc i64 %936 to i32
  store i32 %937, i32* %x201.addr, align 4
  %938 = load i64, i64* %w201.addr, align 8
  %939 = lshr i64 %938, 32
  %940 = trunc i64 %939 to i32
  store i32 %940, i32* %x202.addr, align 4
  %941 = load i32, i32* %x183.addr, align 4
  %942 = call i64 @p256FiatMulxU32(i32 %941, i32 4294967295)
  store i64 %942, i64* %w203.addr, align 8
  %943 = load i64, i64* %w203.addr, align 8
  %944 = trunc i64 %943 to i32
  store i32 %944, i32* %x203.addr, align 4
  %945 = load i64, i64* %w203.addr, align 8
  %946 = lshr i64 %945, 32
  %947 = trunc i64 %946 to i32
  store i32 %947, i32* %x204.addr, align 4
  %948 = load i32, i32* %x183.addr, align 4
  %949 = call i64 @p256FiatMulxU32(i32 %948, i32 4294967295)
  store i64 %949, i64* %w205.addr, align 8
  %950 = load i64, i64* %w205.addr, align 8
  %951 = trunc i64 %950 to i32
  store i32 %951, i32* %x205.addr, align 4
  %952 = load i64, i64* %w205.addr, align 8
  %953 = lshr i64 %952, 32
  %954 = trunc i64 %953 to i32
  store i32 %954, i32* %x206.addr, align 4
  %955 = load i32, i32* %x183.addr, align 4
  %956 = call i64 @p256FiatMulxU32(i32 %955, i32 4294967295)
  store i64 %956, i64* %w207.addr, align 8
  %957 = load i64, i64* %w207.addr, align 8
  %958 = trunc i64 %957 to i32
  store i32 %958, i32* %x207.addr, align 4
  %959 = load i64, i64* %w207.addr, align 8
  %960 = lshr i64 %959, 32
  %961 = trunc i64 %960 to i32
  store i32 %961, i32* %x208.addr, align 4
  %962 = load i32, i32* %x208.addr, align 4
  %963 = load i32, i32* %x205.addr, align 4
  %964 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %962, i32 %963)
  store i64 %964, i64* %w209.addr, align 8
  %965 = load i64, i64* %w209.addr, align 8
  %966 = trunc i64 %965 to i32
  store i32 %966, i32* %x209.addr, align 4
  %967 = load i64, i64* %w209.addr, align 8
  %968 = lshr i64 %967, 32
  %969 = trunc i64 %968 to i32
  store i32 %969, i32* %x210.addr, align 4
  %970 = load i32, i32* %x210.addr, align 4
  %971 = load i32, i32* %x206.addr, align 4
  %972 = load i32, i32* %x203.addr, align 4
  %973 = call i64 @p256FiatAddcarryxU32(i32 %970, i32 %971, i32 %972)
  store i64 %973, i64* %w211.addr, align 8
  %974 = load i64, i64* %w211.addr, align 8
  %975 = trunc i64 %974 to i32
  store i32 %975, i32* %x211.addr, align 4
  %976 = load i64, i64* %w211.addr, align 8
  %977 = lshr i64 %976, 32
  %978 = trunc i64 %977 to i32
  store i32 %978, i32* %x212.addr, align 4
  %979 = load i32, i32* %x212.addr, align 4
  %980 = load i32, i32* %x204.addr, align 4
  %981 = add i32 %979, %980
  store i32 %981, i32* %x213.addr, align 4
  %982 = load i32, i32* %x183.addr, align 4
  %983 = load i32, i32* %x207.addr, align 4
  %984 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %982, i32 %983)
  store i64 %984, i64* %w214.addr, align 8
  %985 = load i64, i64* %w214.addr, align 8
  %986 = lshr i64 %985, 32
  %987 = trunc i64 %986 to i32
  store i32 %987, i32* %x215.addr, align 4
  %988 = load i32, i32* %x215.addr, align 4
  %989 = load i32, i32* %x185.addr, align 4
  %990 = load i32, i32* %x209.addr, align 4
  %991 = call i64 @p256FiatAddcarryxU32(i32 %988, i32 %989, i32 %990)
  store i64 %991, i64* %w216.addr, align 8
  %992 = load i64, i64* %w216.addr, align 8
  %993 = trunc i64 %992 to i32
  store i32 %993, i32* %x216.addr, align 4
  %994 = load i64, i64* %w216.addr, align 8
  %995 = lshr i64 %994, 32
  %996 = trunc i64 %995 to i32
  store i32 %996, i32* %x217.addr, align 4
  %997 = load i32, i32* %x217.addr, align 4
  %998 = load i32, i32* %x187.addr, align 4
  %999 = load i32, i32* %x211.addr, align 4
  %1000 = call i64 @p256FiatAddcarryxU32(i32 %997, i32 %998, i32 %999)
  store i64 %1000, i64* %w218.addr, align 8
  %1001 = load i64, i64* %w218.addr, align 8
  %1002 = trunc i64 %1001 to i32
  store i32 %1002, i32* %x218.addr, align 4
  %1003 = load i64, i64* %w218.addr, align 8
  %1004 = lshr i64 %1003, 32
  %1005 = trunc i64 %1004 to i32
  store i32 %1005, i32* %x219.addr, align 4
  %1006 = load i32, i32* %x219.addr, align 4
  %1007 = load i32, i32* %x189.addr, align 4
  %1008 = load i32, i32* %x213.addr, align 4
  %1009 = call i64 @p256FiatAddcarryxU32(i32 %1006, i32 %1007, i32 %1008)
  store i64 %1009, i64* %w220.addr, align 8
  %1010 = load i64, i64* %w220.addr, align 8
  %1011 = trunc i64 %1010 to i32
  store i32 %1011, i32* %x220.addr, align 4
  %1012 = load i64, i64* %w220.addr, align 8
  %1013 = lshr i64 %1012, 32
  %1014 = trunc i64 %1013 to i32
  store i32 %1014, i32* %x221.addr, align 4
  %1015 = load i32, i32* %x221.addr, align 4
  %1016 = load i32, i32* %x191.addr, align 4
  %1017 = call i64 @p256FiatAddcarryxU32(i32 %1015, i32 %1016, i32 0)
  store i64 %1017, i64* %w222.addr, align 8
  %1018 = load i64, i64* %w222.addr, align 8
  %1019 = trunc i64 %1018 to i32
  store i32 %1019, i32* %x222.addr, align 4
  %1020 = load i64, i64* %w222.addr, align 8
  %1021 = lshr i64 %1020, 32
  %1022 = trunc i64 %1021 to i32
  store i32 %1022, i32* %x223.addr, align 4
  %1023 = load i32, i32* %x223.addr, align 4
  %1024 = load i32, i32* %x193.addr, align 4
  %1025 = call i64 @p256FiatAddcarryxU32(i32 %1023, i32 %1024, i32 0)
  store i64 %1025, i64* %w224.addr, align 8
  %1026 = load i64, i64* %w224.addr, align 8
  %1027 = trunc i64 %1026 to i32
  store i32 %1027, i32* %x224.addr, align 4
  %1028 = load i64, i64* %w224.addr, align 8
  %1029 = lshr i64 %1028, 32
  %1030 = trunc i64 %1029 to i32
  store i32 %1030, i32* %x225.addr, align 4
  %1031 = load i32, i32* %x225.addr, align 4
  %1032 = load i32, i32* %x195.addr, align 4
  %1033 = load i32, i32* %x183.addr, align 4
  %1034 = call i64 @p256FiatAddcarryxU32(i32 %1031, i32 %1032, i32 %1033)
  store i64 %1034, i64* %w226.addr, align 8
  %1035 = load i64, i64* %w226.addr, align 8
  %1036 = trunc i64 %1035 to i32
  store i32 %1036, i32* %x226.addr, align 4
  %1037 = load i64, i64* %w226.addr, align 8
  %1038 = lshr i64 %1037, 32
  %1039 = trunc i64 %1038 to i32
  store i32 %1039, i32* %x227.addr, align 4
  %1040 = load i32, i32* %x227.addr, align 4
  %1041 = load i32, i32* %x197.addr, align 4
  %1042 = load i32, i32* %x201.addr, align 4
  %1043 = call i64 @p256FiatAddcarryxU32(i32 %1040, i32 %1041, i32 %1042)
  store i64 %1043, i64* %w228.addr, align 8
  %1044 = load i64, i64* %w228.addr, align 8
  %1045 = trunc i64 %1044 to i32
  store i32 %1045, i32* %x228.addr, align 4
  %1046 = load i64, i64* %w228.addr, align 8
  %1047 = lshr i64 %1046, 32
  %1048 = trunc i64 %1047 to i32
  store i32 %1048, i32* %x229.addr, align 4
  %1049 = load i32, i32* %x229.addr, align 4
  %1050 = load i32, i32* %x199.addr, align 4
  %1051 = load i32, i32* %x202.addr, align 4
  %1052 = call i64 @p256FiatAddcarryxU32(i32 %1049, i32 %1050, i32 %1051)
  store i64 %1052, i64* %w230.addr, align 8
  %1053 = load i64, i64* %w230.addr, align 8
  %1054 = trunc i64 %1053 to i32
  store i32 %1054, i32* %x230.addr, align 4
  %1055 = load i64, i64* %w230.addr, align 8
  %1056 = lshr i64 %1055, 32
  %1057 = trunc i64 %1056 to i32
  store i32 %1057, i32* %x231.addr, align 4
  %1058 = load i32, i32* %x231.addr, align 4
  %1059 = load i32, i32* %x200.addr, align 4
  %1060 = add i32 %1058, %1059
  store i32 %1060, i32* %x232.addr, align 4
  %1061 = load i32, i32* %x3.addr, align 4
  %1062 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1063 = load i8*, i8** %1062, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1064 = bitcast i8* %1063 to i32*
  %1065 = getelementptr inbounds i32, i32* %1064, i64 7
  %1066 = load i32, i32* %1065, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1067 = call i64 @p256FiatMulxU32(i32 %1061, i32 %1066)
  store i64 %1067, i64* %w233.addr, align 8
  %1068 = load i64, i64* %w233.addr, align 8
  %1069 = trunc i64 %1068 to i32
  store i32 %1069, i32* %x233.addr, align 4
  %1070 = load i64, i64* %w233.addr, align 8
  %1071 = lshr i64 %1070, 32
  %1072 = trunc i64 %1071 to i32
  store i32 %1072, i32* %x234.addr, align 4
  %1073 = load i32, i32* %x3.addr, align 4
  %1074 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1075 = load i8*, i8** %1074, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1076 = bitcast i8* %1075 to i32*
  %1077 = getelementptr inbounds i32, i32* %1076, i64 6
  %1078 = load i32, i32* %1077, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1079 = call i64 @p256FiatMulxU32(i32 %1073, i32 %1078)
  store i64 %1079, i64* %w235.addr, align 8
  %1080 = load i64, i64* %w235.addr, align 8
  %1081 = trunc i64 %1080 to i32
  store i32 %1081, i32* %x235.addr, align 4
  %1082 = load i64, i64* %w235.addr, align 8
  %1083 = lshr i64 %1082, 32
  %1084 = trunc i64 %1083 to i32
  store i32 %1084, i32* %x236.addr, align 4
  %1085 = load i32, i32* %x3.addr, align 4
  %1086 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1087 = load i8*, i8** %1086, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1088 = bitcast i8* %1087 to i32*
  %1089 = getelementptr inbounds i32, i32* %1088, i64 5
  %1090 = load i32, i32* %1089, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1091 = call i64 @p256FiatMulxU32(i32 %1085, i32 %1090)
  store i64 %1091, i64* %w237.addr, align 8
  %1092 = load i64, i64* %w237.addr, align 8
  %1093 = trunc i64 %1092 to i32
  store i32 %1093, i32* %x237.addr, align 4
  %1094 = load i64, i64* %w237.addr, align 8
  %1095 = lshr i64 %1094, 32
  %1096 = trunc i64 %1095 to i32
  store i32 %1096, i32* %x238.addr, align 4
  %1097 = load i32, i32* %x3.addr, align 4
  %1098 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1099 = load i8*, i8** %1098, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1100 = bitcast i8* %1099 to i32*
  %1101 = getelementptr inbounds i32, i32* %1100, i64 4
  %1102 = load i32, i32* %1101, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1103 = call i64 @p256FiatMulxU32(i32 %1097, i32 %1102)
  store i64 %1103, i64* %w239.addr, align 8
  %1104 = load i64, i64* %w239.addr, align 8
  %1105 = trunc i64 %1104 to i32
  store i32 %1105, i32* %x239.addr, align 4
  %1106 = load i64, i64* %w239.addr, align 8
  %1107 = lshr i64 %1106, 32
  %1108 = trunc i64 %1107 to i32
  store i32 %1108, i32* %x240.addr, align 4
  %1109 = load i32, i32* %x3.addr, align 4
  %1110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1111 = load i8*, i8** %1110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1112 = bitcast i8* %1111 to i32*
  %1113 = getelementptr inbounds i32, i32* %1112, i64 3
  %1114 = load i32, i32* %1113, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1115 = call i64 @p256FiatMulxU32(i32 %1109, i32 %1114)
  store i64 %1115, i64* %w241.addr, align 8
  %1116 = load i64, i64* %w241.addr, align 8
  %1117 = trunc i64 %1116 to i32
  store i32 %1117, i32* %x241.addr, align 4
  %1118 = load i64, i64* %w241.addr, align 8
  %1119 = lshr i64 %1118, 32
  %1120 = trunc i64 %1119 to i32
  store i32 %1120, i32* %x242.addr, align 4
  %1121 = load i32, i32* %x3.addr, align 4
  %1122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1123 = load i8*, i8** %1122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1124 = bitcast i8* %1123 to i32*
  %1125 = getelementptr inbounds i32, i32* %1124, i64 2
  %1126 = load i32, i32* %1125, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1127 = call i64 @p256FiatMulxU32(i32 %1121, i32 %1126)
  store i64 %1127, i64* %w243.addr, align 8
  %1128 = load i64, i64* %w243.addr, align 8
  %1129 = trunc i64 %1128 to i32
  store i32 %1129, i32* %x243.addr, align 4
  %1130 = load i64, i64* %w243.addr, align 8
  %1131 = lshr i64 %1130, 32
  %1132 = trunc i64 %1131 to i32
  store i32 %1132, i32* %x244.addr, align 4
  %1133 = load i32, i32* %x3.addr, align 4
  %1134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1135 = load i8*, i8** %1134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1136 = bitcast i8* %1135 to i32*
  %1137 = getelementptr inbounds i32, i32* %1136, i64 1
  %1138 = load i32, i32* %1137, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1139 = call i64 @p256FiatMulxU32(i32 %1133, i32 %1138)
  store i64 %1139, i64* %w245.addr, align 8
  %1140 = load i64, i64* %w245.addr, align 8
  %1141 = trunc i64 %1140 to i32
  store i32 %1141, i32* %x245.addr, align 4
  %1142 = load i64, i64* %w245.addr, align 8
  %1143 = lshr i64 %1142, 32
  %1144 = trunc i64 %1143 to i32
  store i32 %1144, i32* %x246.addr, align 4
  %1145 = load i32, i32* %x3.addr, align 4
  %1146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1147 = load i8*, i8** %1146, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1148 = bitcast i8* %1147 to i32*
  %1149 = getelementptr inbounds i32, i32* %1148, i64 0
  %1150 = load i32, i32* %1149, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1151 = call i64 @p256FiatMulxU32(i32 %1145, i32 %1150)
  store i64 %1151, i64* %w247.addr, align 8
  %1152 = load i64, i64* %w247.addr, align 8
  %1153 = trunc i64 %1152 to i32
  store i32 %1153, i32* %x247.addr, align 4
  %1154 = load i64, i64* %w247.addr, align 8
  %1155 = lshr i64 %1154, 32
  %1156 = trunc i64 %1155 to i32
  store i32 %1156, i32* %x248.addr, align 4
  %1157 = load i32, i32* %x248.addr, align 4
  %1158 = load i32, i32* %x245.addr, align 4
  %1159 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1157, i32 %1158)
  store i64 %1159, i64* %w249.addr, align 8
  %1160 = load i64, i64* %w249.addr, align 8
  %1161 = trunc i64 %1160 to i32
  store i32 %1161, i32* %x249.addr, align 4
  %1162 = load i64, i64* %w249.addr, align 8
  %1163 = lshr i64 %1162, 32
  %1164 = trunc i64 %1163 to i32
  store i32 %1164, i32* %x250.addr, align 4
  %1165 = load i32, i32* %x250.addr, align 4
  %1166 = load i32, i32* %x246.addr, align 4
  %1167 = load i32, i32* %x243.addr, align 4
  %1168 = call i64 @p256FiatAddcarryxU32(i32 %1165, i32 %1166, i32 %1167)
  store i64 %1168, i64* %w251.addr, align 8
  %1169 = load i64, i64* %w251.addr, align 8
  %1170 = trunc i64 %1169 to i32
  store i32 %1170, i32* %x251.addr, align 4
  %1171 = load i64, i64* %w251.addr, align 8
  %1172 = lshr i64 %1171, 32
  %1173 = trunc i64 %1172 to i32
  store i32 %1173, i32* %x252.addr, align 4
  %1174 = load i32, i32* %x252.addr, align 4
  %1175 = load i32, i32* %x244.addr, align 4
  %1176 = load i32, i32* %x241.addr, align 4
  %1177 = call i64 @p256FiatAddcarryxU32(i32 %1174, i32 %1175, i32 %1176)
  store i64 %1177, i64* %w253.addr, align 8
  %1178 = load i64, i64* %w253.addr, align 8
  %1179 = trunc i64 %1178 to i32
  store i32 %1179, i32* %x253.addr, align 4
  %1180 = load i64, i64* %w253.addr, align 8
  %1181 = lshr i64 %1180, 32
  %1182 = trunc i64 %1181 to i32
  store i32 %1182, i32* %x254.addr, align 4
  %1183 = load i32, i32* %x254.addr, align 4
  %1184 = load i32, i32* %x242.addr, align 4
  %1185 = load i32, i32* %x239.addr, align 4
  %1186 = call i64 @p256FiatAddcarryxU32(i32 %1183, i32 %1184, i32 %1185)
  store i64 %1186, i64* %w255.addr, align 8
  %1187 = load i64, i64* %w255.addr, align 8
  %1188 = trunc i64 %1187 to i32
  store i32 %1188, i32* %x255.addr, align 4
  %1189 = load i64, i64* %w255.addr, align 8
  %1190 = lshr i64 %1189, 32
  %1191 = trunc i64 %1190 to i32
  store i32 %1191, i32* %x256.addr, align 4
  %1192 = load i32, i32* %x256.addr, align 4
  %1193 = load i32, i32* %x240.addr, align 4
  %1194 = load i32, i32* %x237.addr, align 4
  %1195 = call i64 @p256FiatAddcarryxU32(i32 %1192, i32 %1193, i32 %1194)
  store i64 %1195, i64* %w257.addr, align 8
  %1196 = load i64, i64* %w257.addr, align 8
  %1197 = trunc i64 %1196 to i32
  store i32 %1197, i32* %x257.addr, align 4
  %1198 = load i64, i64* %w257.addr, align 8
  %1199 = lshr i64 %1198, 32
  %1200 = trunc i64 %1199 to i32
  store i32 %1200, i32* %x258.addr, align 4
  %1201 = load i32, i32* %x258.addr, align 4
  %1202 = load i32, i32* %x238.addr, align 4
  %1203 = load i32, i32* %x235.addr, align 4
  %1204 = call i64 @p256FiatAddcarryxU32(i32 %1201, i32 %1202, i32 %1203)
  store i64 %1204, i64* %w259.addr, align 8
  %1205 = load i64, i64* %w259.addr, align 8
  %1206 = trunc i64 %1205 to i32
  store i32 %1206, i32* %x259.addr, align 4
  %1207 = load i64, i64* %w259.addr, align 8
  %1208 = lshr i64 %1207, 32
  %1209 = trunc i64 %1208 to i32
  store i32 %1209, i32* %x260.addr, align 4
  %1210 = load i32, i32* %x260.addr, align 4
  %1211 = load i32, i32* %x236.addr, align 4
  %1212 = load i32, i32* %x233.addr, align 4
  %1213 = call i64 @p256FiatAddcarryxU32(i32 %1210, i32 %1211, i32 %1212)
  store i64 %1213, i64* %w261.addr, align 8
  %1214 = load i64, i64* %w261.addr, align 8
  %1215 = trunc i64 %1214 to i32
  store i32 %1215, i32* %x261.addr, align 4
  %1216 = load i64, i64* %w261.addr, align 8
  %1217 = lshr i64 %1216, 32
  %1218 = trunc i64 %1217 to i32
  store i32 %1218, i32* %x262.addr, align 4
  %1219 = load i32, i32* %x262.addr, align 4
  %1220 = load i32, i32* %x234.addr, align 4
  %1221 = add i32 %1219, %1220
  store i32 %1221, i32* %x263.addr, align 4
  %1222 = load i32, i32* %x216.addr, align 4
  %1223 = load i32, i32* %x247.addr, align 4
  %1224 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1222, i32 %1223)
  store i64 %1224, i64* %w264.addr, align 8
  %1225 = load i64, i64* %w264.addr, align 8
  %1226 = trunc i64 %1225 to i32
  store i32 %1226, i32* %x264.addr, align 4
  %1227 = load i64, i64* %w264.addr, align 8
  %1228 = lshr i64 %1227, 32
  %1229 = trunc i64 %1228 to i32
  store i32 %1229, i32* %x265.addr, align 4
  %1230 = load i32, i32* %x265.addr, align 4
  %1231 = load i32, i32* %x218.addr, align 4
  %1232 = load i32, i32* %x249.addr, align 4
  %1233 = call i64 @p256FiatAddcarryxU32(i32 %1230, i32 %1231, i32 %1232)
  store i64 %1233, i64* %w266.addr, align 8
  %1234 = load i64, i64* %w266.addr, align 8
  %1235 = trunc i64 %1234 to i32
  store i32 %1235, i32* %x266.addr, align 4
  %1236 = load i64, i64* %w266.addr, align 8
  %1237 = lshr i64 %1236, 32
  %1238 = trunc i64 %1237 to i32
  store i32 %1238, i32* %x267.addr, align 4
  %1239 = load i32, i32* %x267.addr, align 4
  %1240 = load i32, i32* %x220.addr, align 4
  %1241 = load i32, i32* %x251.addr, align 4
  %1242 = call i64 @p256FiatAddcarryxU32(i32 %1239, i32 %1240, i32 %1241)
  store i64 %1242, i64* %w268.addr, align 8
  %1243 = load i64, i64* %w268.addr, align 8
  %1244 = trunc i64 %1243 to i32
  store i32 %1244, i32* %x268.addr, align 4
  %1245 = load i64, i64* %w268.addr, align 8
  %1246 = lshr i64 %1245, 32
  %1247 = trunc i64 %1246 to i32
  store i32 %1247, i32* %x269.addr, align 4
  %1248 = load i32, i32* %x269.addr, align 4
  %1249 = load i32, i32* %x222.addr, align 4
  %1250 = load i32, i32* %x253.addr, align 4
  %1251 = call i64 @p256FiatAddcarryxU32(i32 %1248, i32 %1249, i32 %1250)
  store i64 %1251, i64* %w270.addr, align 8
  %1252 = load i64, i64* %w270.addr, align 8
  %1253 = trunc i64 %1252 to i32
  store i32 %1253, i32* %x270.addr, align 4
  %1254 = load i64, i64* %w270.addr, align 8
  %1255 = lshr i64 %1254, 32
  %1256 = trunc i64 %1255 to i32
  store i32 %1256, i32* %x271.addr, align 4
  %1257 = load i32, i32* %x271.addr, align 4
  %1258 = load i32, i32* %x224.addr, align 4
  %1259 = load i32, i32* %x255.addr, align 4
  %1260 = call i64 @p256FiatAddcarryxU32(i32 %1257, i32 %1258, i32 %1259)
  store i64 %1260, i64* %w272.addr, align 8
  %1261 = load i64, i64* %w272.addr, align 8
  %1262 = trunc i64 %1261 to i32
  store i32 %1262, i32* %x272.addr, align 4
  %1263 = load i64, i64* %w272.addr, align 8
  %1264 = lshr i64 %1263, 32
  %1265 = trunc i64 %1264 to i32
  store i32 %1265, i32* %x273.addr, align 4
  %1266 = load i32, i32* %x273.addr, align 4
  %1267 = load i32, i32* %x226.addr, align 4
  %1268 = load i32, i32* %x257.addr, align 4
  %1269 = call i64 @p256FiatAddcarryxU32(i32 %1266, i32 %1267, i32 %1268)
  store i64 %1269, i64* %w274.addr, align 8
  %1270 = load i64, i64* %w274.addr, align 8
  %1271 = trunc i64 %1270 to i32
  store i32 %1271, i32* %x274.addr, align 4
  %1272 = load i64, i64* %w274.addr, align 8
  %1273 = lshr i64 %1272, 32
  %1274 = trunc i64 %1273 to i32
  store i32 %1274, i32* %x275.addr, align 4
  %1275 = load i32, i32* %x275.addr, align 4
  %1276 = load i32, i32* %x228.addr, align 4
  %1277 = load i32, i32* %x259.addr, align 4
  %1278 = call i64 @p256FiatAddcarryxU32(i32 %1275, i32 %1276, i32 %1277)
  store i64 %1278, i64* %w276.addr, align 8
  %1279 = load i64, i64* %w276.addr, align 8
  %1280 = trunc i64 %1279 to i32
  store i32 %1280, i32* %x276.addr, align 4
  %1281 = load i64, i64* %w276.addr, align 8
  %1282 = lshr i64 %1281, 32
  %1283 = trunc i64 %1282 to i32
  store i32 %1283, i32* %x277.addr, align 4
  %1284 = load i32, i32* %x277.addr, align 4
  %1285 = load i32, i32* %x230.addr, align 4
  %1286 = load i32, i32* %x261.addr, align 4
  %1287 = call i64 @p256FiatAddcarryxU32(i32 %1284, i32 %1285, i32 %1286)
  store i64 %1287, i64* %w278.addr, align 8
  %1288 = load i64, i64* %w278.addr, align 8
  %1289 = trunc i64 %1288 to i32
  store i32 %1289, i32* %x278.addr, align 4
  %1290 = load i64, i64* %w278.addr, align 8
  %1291 = lshr i64 %1290, 32
  %1292 = trunc i64 %1291 to i32
  store i32 %1292, i32* %x279.addr, align 4
  %1293 = load i32, i32* %x279.addr, align 4
  %1294 = load i32, i32* %x232.addr, align 4
  %1295 = load i32, i32* %x263.addr, align 4
  %1296 = call i64 @p256FiatAddcarryxU32(i32 %1293, i32 %1294, i32 %1295)
  store i64 %1296, i64* %w280.addr, align 8
  %1297 = load i64, i64* %w280.addr, align 8
  %1298 = trunc i64 %1297 to i32
  store i32 %1298, i32* %x280.addr, align 4
  %1299 = load i64, i64* %w280.addr, align 8
  %1300 = lshr i64 %1299, 32
  %1301 = trunc i64 %1300 to i32
  store i32 %1301, i32* %x281.addr, align 4
  %1302 = load i32, i32* %x264.addr, align 4
  %1303 = call i64 @p256FiatMulxU32(i32 %1302, i32 4294967295)
  store i64 %1303, i64* %w282.addr, align 8
  %1304 = load i64, i64* %w282.addr, align 8
  %1305 = trunc i64 %1304 to i32
  store i32 %1305, i32* %x282.addr, align 4
  %1306 = load i64, i64* %w282.addr, align 8
  %1307 = lshr i64 %1306, 32
  %1308 = trunc i64 %1307 to i32
  store i32 %1308, i32* %x283.addr, align 4
  %1309 = load i32, i32* %x264.addr, align 4
  %1310 = call i64 @p256FiatMulxU32(i32 %1309, i32 4294967295)
  store i64 %1310, i64* %w284.addr, align 8
  %1311 = load i64, i64* %w284.addr, align 8
  %1312 = trunc i64 %1311 to i32
  store i32 %1312, i32* %x284.addr, align 4
  %1313 = load i64, i64* %w284.addr, align 8
  %1314 = lshr i64 %1313, 32
  %1315 = trunc i64 %1314 to i32
  store i32 %1315, i32* %x285.addr, align 4
  %1316 = load i32, i32* %x264.addr, align 4
  %1317 = call i64 @p256FiatMulxU32(i32 %1316, i32 4294967295)
  store i64 %1317, i64* %w286.addr, align 8
  %1318 = load i64, i64* %w286.addr, align 8
  %1319 = trunc i64 %1318 to i32
  store i32 %1319, i32* %x286.addr, align 4
  %1320 = load i64, i64* %w286.addr, align 8
  %1321 = lshr i64 %1320, 32
  %1322 = trunc i64 %1321 to i32
  store i32 %1322, i32* %x287.addr, align 4
  %1323 = load i32, i32* %x264.addr, align 4
  %1324 = call i64 @p256FiatMulxU32(i32 %1323, i32 4294967295)
  store i64 %1324, i64* %w288.addr, align 8
  %1325 = load i64, i64* %w288.addr, align 8
  %1326 = trunc i64 %1325 to i32
  store i32 %1326, i32* %x288.addr, align 4
  %1327 = load i64, i64* %w288.addr, align 8
  %1328 = lshr i64 %1327, 32
  %1329 = trunc i64 %1328 to i32
  store i32 %1329, i32* %x289.addr, align 4
  %1330 = load i32, i32* %x289.addr, align 4
  %1331 = load i32, i32* %x286.addr, align 4
  %1332 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1330, i32 %1331)
  store i64 %1332, i64* %w290.addr, align 8
  %1333 = load i64, i64* %w290.addr, align 8
  %1334 = trunc i64 %1333 to i32
  store i32 %1334, i32* %x290.addr, align 4
  %1335 = load i64, i64* %w290.addr, align 8
  %1336 = lshr i64 %1335, 32
  %1337 = trunc i64 %1336 to i32
  store i32 %1337, i32* %x291.addr, align 4
  %1338 = load i32, i32* %x291.addr, align 4
  %1339 = load i32, i32* %x287.addr, align 4
  %1340 = load i32, i32* %x284.addr, align 4
  %1341 = call i64 @p256FiatAddcarryxU32(i32 %1338, i32 %1339, i32 %1340)
  store i64 %1341, i64* %w292.addr, align 8
  %1342 = load i64, i64* %w292.addr, align 8
  %1343 = trunc i64 %1342 to i32
  store i32 %1343, i32* %x292.addr, align 4
  %1344 = load i64, i64* %w292.addr, align 8
  %1345 = lshr i64 %1344, 32
  %1346 = trunc i64 %1345 to i32
  store i32 %1346, i32* %x293.addr, align 4
  %1347 = load i32, i32* %x293.addr, align 4
  %1348 = load i32, i32* %x285.addr, align 4
  %1349 = add i32 %1347, %1348
  store i32 %1349, i32* %x294.addr, align 4
  %1350 = load i32, i32* %x264.addr, align 4
  %1351 = load i32, i32* %x288.addr, align 4
  %1352 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1350, i32 %1351)
  store i64 %1352, i64* %w295.addr, align 8
  %1353 = load i64, i64* %w295.addr, align 8
  %1354 = lshr i64 %1353, 32
  %1355 = trunc i64 %1354 to i32
  store i32 %1355, i32* %x296.addr, align 4
  %1356 = load i32, i32* %x296.addr, align 4
  %1357 = load i32, i32* %x266.addr, align 4
  %1358 = load i32, i32* %x290.addr, align 4
  %1359 = call i64 @p256FiatAddcarryxU32(i32 %1356, i32 %1357, i32 %1358)
  store i64 %1359, i64* %w297.addr, align 8
  %1360 = load i64, i64* %w297.addr, align 8
  %1361 = trunc i64 %1360 to i32
  store i32 %1361, i32* %x297.addr, align 4
  %1362 = load i64, i64* %w297.addr, align 8
  %1363 = lshr i64 %1362, 32
  %1364 = trunc i64 %1363 to i32
  store i32 %1364, i32* %x298.addr, align 4
  %1365 = load i32, i32* %x298.addr, align 4
  %1366 = load i32, i32* %x268.addr, align 4
  %1367 = load i32, i32* %x292.addr, align 4
  %1368 = call i64 @p256FiatAddcarryxU32(i32 %1365, i32 %1366, i32 %1367)
  store i64 %1368, i64* %w299.addr, align 8
  %1369 = load i64, i64* %w299.addr, align 8
  %1370 = trunc i64 %1369 to i32
  store i32 %1370, i32* %x299.addr, align 4
  %1371 = load i64, i64* %w299.addr, align 8
  %1372 = lshr i64 %1371, 32
  %1373 = trunc i64 %1372 to i32
  store i32 %1373, i32* %x300.addr, align 4
  %1374 = load i32, i32* %x300.addr, align 4
  %1375 = load i32, i32* %x270.addr, align 4
  %1376 = load i32, i32* %x294.addr, align 4
  %1377 = call i64 @p256FiatAddcarryxU32(i32 %1374, i32 %1375, i32 %1376)
  store i64 %1377, i64* %w301.addr, align 8
  %1378 = load i64, i64* %w301.addr, align 8
  %1379 = trunc i64 %1378 to i32
  store i32 %1379, i32* %x301.addr, align 4
  %1380 = load i64, i64* %w301.addr, align 8
  %1381 = lshr i64 %1380, 32
  %1382 = trunc i64 %1381 to i32
  store i32 %1382, i32* %x302.addr, align 4
  %1383 = load i32, i32* %x302.addr, align 4
  %1384 = load i32, i32* %x272.addr, align 4
  %1385 = call i64 @p256FiatAddcarryxU32(i32 %1383, i32 %1384, i32 0)
  store i64 %1385, i64* %w303.addr, align 8
  %1386 = load i64, i64* %w303.addr, align 8
  %1387 = trunc i64 %1386 to i32
  store i32 %1387, i32* %x303.addr, align 4
  %1388 = load i64, i64* %w303.addr, align 8
  %1389 = lshr i64 %1388, 32
  %1390 = trunc i64 %1389 to i32
  store i32 %1390, i32* %x304.addr, align 4
  %1391 = load i32, i32* %x304.addr, align 4
  %1392 = load i32, i32* %x274.addr, align 4
  %1393 = call i64 @p256FiatAddcarryxU32(i32 %1391, i32 %1392, i32 0)
  store i64 %1393, i64* %w305.addr, align 8
  %1394 = load i64, i64* %w305.addr, align 8
  %1395 = trunc i64 %1394 to i32
  store i32 %1395, i32* %x305.addr, align 4
  %1396 = load i64, i64* %w305.addr, align 8
  %1397 = lshr i64 %1396, 32
  %1398 = trunc i64 %1397 to i32
  store i32 %1398, i32* %x306.addr, align 4
  %1399 = load i32, i32* %x306.addr, align 4
  %1400 = load i32, i32* %x276.addr, align 4
  %1401 = load i32, i32* %x264.addr, align 4
  %1402 = call i64 @p256FiatAddcarryxU32(i32 %1399, i32 %1400, i32 %1401)
  store i64 %1402, i64* %w307.addr, align 8
  %1403 = load i64, i64* %w307.addr, align 8
  %1404 = trunc i64 %1403 to i32
  store i32 %1404, i32* %x307.addr, align 4
  %1405 = load i64, i64* %w307.addr, align 8
  %1406 = lshr i64 %1405, 32
  %1407 = trunc i64 %1406 to i32
  store i32 %1407, i32* %x308.addr, align 4
  %1408 = load i32, i32* %x308.addr, align 4
  %1409 = load i32, i32* %x278.addr, align 4
  %1410 = load i32, i32* %x282.addr, align 4
  %1411 = call i64 @p256FiatAddcarryxU32(i32 %1408, i32 %1409, i32 %1410)
  store i64 %1411, i64* %w309.addr, align 8
  %1412 = load i64, i64* %w309.addr, align 8
  %1413 = trunc i64 %1412 to i32
  store i32 %1413, i32* %x309.addr, align 4
  %1414 = load i64, i64* %w309.addr, align 8
  %1415 = lshr i64 %1414, 32
  %1416 = trunc i64 %1415 to i32
  store i32 %1416, i32* %x310.addr, align 4
  %1417 = load i32, i32* %x310.addr, align 4
  %1418 = load i32, i32* %x280.addr, align 4
  %1419 = load i32, i32* %x283.addr, align 4
  %1420 = call i64 @p256FiatAddcarryxU32(i32 %1417, i32 %1418, i32 %1419)
  store i64 %1420, i64* %w311.addr, align 8
  %1421 = load i64, i64* %w311.addr, align 8
  %1422 = trunc i64 %1421 to i32
  store i32 %1422, i32* %x311.addr, align 4
  %1423 = load i64, i64* %w311.addr, align 8
  %1424 = lshr i64 %1423, 32
  %1425 = trunc i64 %1424 to i32
  store i32 %1425, i32* %x312.addr, align 4
  %1426 = load i32, i32* %x312.addr, align 4
  %1427 = load i32, i32* %x281.addr, align 4
  %1428 = add i32 %1426, %1427
  store i32 %1428, i32* %x313.addr, align 4
  %1429 = load i32, i32* %x4.addr, align 4
  %1430 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1431 = load i8*, i8** %1430, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1432 = bitcast i8* %1431 to i32*
  %1433 = getelementptr inbounds i32, i32* %1432, i64 7
  %1434 = load i32, i32* %1433, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1435 = call i64 @p256FiatMulxU32(i32 %1429, i32 %1434)
  store i64 %1435, i64* %w314.addr, align 8
  %1436 = load i64, i64* %w314.addr, align 8
  %1437 = trunc i64 %1436 to i32
  store i32 %1437, i32* %x314.addr, align 4
  %1438 = load i64, i64* %w314.addr, align 8
  %1439 = lshr i64 %1438, 32
  %1440 = trunc i64 %1439 to i32
  store i32 %1440, i32* %x315.addr, align 4
  %1441 = load i32, i32* %x4.addr, align 4
  %1442 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1443 = load i8*, i8** %1442, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1444 = bitcast i8* %1443 to i32*
  %1445 = getelementptr inbounds i32, i32* %1444, i64 6
  %1446 = load i32, i32* %1445, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1447 = call i64 @p256FiatMulxU32(i32 %1441, i32 %1446)
  store i64 %1447, i64* %w316.addr, align 8
  %1448 = load i64, i64* %w316.addr, align 8
  %1449 = trunc i64 %1448 to i32
  store i32 %1449, i32* %x316.addr, align 4
  %1450 = load i64, i64* %w316.addr, align 8
  %1451 = lshr i64 %1450, 32
  %1452 = trunc i64 %1451 to i32
  store i32 %1452, i32* %x317.addr, align 4
  %1453 = load i32, i32* %x4.addr, align 4
  %1454 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1455 = load i8*, i8** %1454, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1456 = bitcast i8* %1455 to i32*
  %1457 = getelementptr inbounds i32, i32* %1456, i64 5
  %1458 = load i32, i32* %1457, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1459 = call i64 @p256FiatMulxU32(i32 %1453, i32 %1458)
  store i64 %1459, i64* %w318.addr, align 8
  %1460 = load i64, i64* %w318.addr, align 8
  %1461 = trunc i64 %1460 to i32
  store i32 %1461, i32* %x318.addr, align 4
  %1462 = load i64, i64* %w318.addr, align 8
  %1463 = lshr i64 %1462, 32
  %1464 = trunc i64 %1463 to i32
  store i32 %1464, i32* %x319.addr, align 4
  %1465 = load i32, i32* %x4.addr, align 4
  %1466 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1467 = load i8*, i8** %1466, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1468 = bitcast i8* %1467 to i32*
  %1469 = getelementptr inbounds i32, i32* %1468, i64 4
  %1470 = load i32, i32* %1469, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1471 = call i64 @p256FiatMulxU32(i32 %1465, i32 %1470)
  store i64 %1471, i64* %w320.addr, align 8
  %1472 = load i64, i64* %w320.addr, align 8
  %1473 = trunc i64 %1472 to i32
  store i32 %1473, i32* %x320.addr, align 4
  %1474 = load i64, i64* %w320.addr, align 8
  %1475 = lshr i64 %1474, 32
  %1476 = trunc i64 %1475 to i32
  store i32 %1476, i32* %x321.addr, align 4
  %1477 = load i32, i32* %x4.addr, align 4
  %1478 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1479 = load i8*, i8** %1478, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1480 = bitcast i8* %1479 to i32*
  %1481 = getelementptr inbounds i32, i32* %1480, i64 3
  %1482 = load i32, i32* %1481, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1483 = call i64 @p256FiatMulxU32(i32 %1477, i32 %1482)
  store i64 %1483, i64* %w322.addr, align 8
  %1484 = load i64, i64* %w322.addr, align 8
  %1485 = trunc i64 %1484 to i32
  store i32 %1485, i32* %x322.addr, align 4
  %1486 = load i64, i64* %w322.addr, align 8
  %1487 = lshr i64 %1486, 32
  %1488 = trunc i64 %1487 to i32
  store i32 %1488, i32* %x323.addr, align 4
  %1489 = load i32, i32* %x4.addr, align 4
  %1490 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1491 = load i8*, i8** %1490, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1492 = bitcast i8* %1491 to i32*
  %1493 = getelementptr inbounds i32, i32* %1492, i64 2
  %1494 = load i32, i32* %1493, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1495 = call i64 @p256FiatMulxU32(i32 %1489, i32 %1494)
  store i64 %1495, i64* %w324.addr, align 8
  %1496 = load i64, i64* %w324.addr, align 8
  %1497 = trunc i64 %1496 to i32
  store i32 %1497, i32* %x324.addr, align 4
  %1498 = load i64, i64* %w324.addr, align 8
  %1499 = lshr i64 %1498, 32
  %1500 = trunc i64 %1499 to i32
  store i32 %1500, i32* %x325.addr, align 4
  %1501 = load i32, i32* %x4.addr, align 4
  %1502 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1503 = load i8*, i8** %1502, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1504 = bitcast i8* %1503 to i32*
  %1505 = getelementptr inbounds i32, i32* %1504, i64 1
  %1506 = load i32, i32* %1505, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1507 = call i64 @p256FiatMulxU32(i32 %1501, i32 %1506)
  store i64 %1507, i64* %w326.addr, align 8
  %1508 = load i64, i64* %w326.addr, align 8
  %1509 = trunc i64 %1508 to i32
  store i32 %1509, i32* %x326.addr, align 4
  %1510 = load i64, i64* %w326.addr, align 8
  %1511 = lshr i64 %1510, 32
  %1512 = trunc i64 %1511 to i32
  store i32 %1512, i32* %x327.addr, align 4
  %1513 = load i32, i32* %x4.addr, align 4
  %1514 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1515 = load i8*, i8** %1514, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1516 = bitcast i8* %1515 to i32*
  %1517 = getelementptr inbounds i32, i32* %1516, i64 0
  %1518 = load i32, i32* %1517, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1519 = call i64 @p256FiatMulxU32(i32 %1513, i32 %1518)
  store i64 %1519, i64* %w328.addr, align 8
  %1520 = load i64, i64* %w328.addr, align 8
  %1521 = trunc i64 %1520 to i32
  store i32 %1521, i32* %x328.addr, align 4
  %1522 = load i64, i64* %w328.addr, align 8
  %1523 = lshr i64 %1522, 32
  %1524 = trunc i64 %1523 to i32
  store i32 %1524, i32* %x329.addr, align 4
  %1525 = load i32, i32* %x329.addr, align 4
  %1526 = load i32, i32* %x326.addr, align 4
  %1527 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1525, i32 %1526)
  store i64 %1527, i64* %w330.addr, align 8
  %1528 = load i64, i64* %w330.addr, align 8
  %1529 = trunc i64 %1528 to i32
  store i32 %1529, i32* %x330.addr, align 4
  %1530 = load i64, i64* %w330.addr, align 8
  %1531 = lshr i64 %1530, 32
  %1532 = trunc i64 %1531 to i32
  store i32 %1532, i32* %x331.addr, align 4
  %1533 = load i32, i32* %x331.addr, align 4
  %1534 = load i32, i32* %x327.addr, align 4
  %1535 = load i32, i32* %x324.addr, align 4
  %1536 = call i64 @p256FiatAddcarryxU32(i32 %1533, i32 %1534, i32 %1535)
  store i64 %1536, i64* %w332.addr, align 8
  %1537 = load i64, i64* %w332.addr, align 8
  %1538 = trunc i64 %1537 to i32
  store i32 %1538, i32* %x332.addr, align 4
  %1539 = load i64, i64* %w332.addr, align 8
  %1540 = lshr i64 %1539, 32
  %1541 = trunc i64 %1540 to i32
  store i32 %1541, i32* %x333.addr, align 4
  %1542 = load i32, i32* %x333.addr, align 4
  %1543 = load i32, i32* %x325.addr, align 4
  %1544 = load i32, i32* %x322.addr, align 4
  %1545 = call i64 @p256FiatAddcarryxU32(i32 %1542, i32 %1543, i32 %1544)
  store i64 %1545, i64* %w334.addr, align 8
  %1546 = load i64, i64* %w334.addr, align 8
  %1547 = trunc i64 %1546 to i32
  store i32 %1547, i32* %x334.addr, align 4
  %1548 = load i64, i64* %w334.addr, align 8
  %1549 = lshr i64 %1548, 32
  %1550 = trunc i64 %1549 to i32
  store i32 %1550, i32* %x335.addr, align 4
  %1551 = load i32, i32* %x335.addr, align 4
  %1552 = load i32, i32* %x323.addr, align 4
  %1553 = load i32, i32* %x320.addr, align 4
  %1554 = call i64 @p256FiatAddcarryxU32(i32 %1551, i32 %1552, i32 %1553)
  store i64 %1554, i64* %w336.addr, align 8
  %1555 = load i64, i64* %w336.addr, align 8
  %1556 = trunc i64 %1555 to i32
  store i32 %1556, i32* %x336.addr, align 4
  %1557 = load i64, i64* %w336.addr, align 8
  %1558 = lshr i64 %1557, 32
  %1559 = trunc i64 %1558 to i32
  store i32 %1559, i32* %x337.addr, align 4
  %1560 = load i32, i32* %x337.addr, align 4
  %1561 = load i32, i32* %x321.addr, align 4
  %1562 = load i32, i32* %x318.addr, align 4
  %1563 = call i64 @p256FiatAddcarryxU32(i32 %1560, i32 %1561, i32 %1562)
  store i64 %1563, i64* %w338.addr, align 8
  %1564 = load i64, i64* %w338.addr, align 8
  %1565 = trunc i64 %1564 to i32
  store i32 %1565, i32* %x338.addr, align 4
  %1566 = load i64, i64* %w338.addr, align 8
  %1567 = lshr i64 %1566, 32
  %1568 = trunc i64 %1567 to i32
  store i32 %1568, i32* %x339.addr, align 4
  %1569 = load i32, i32* %x339.addr, align 4
  %1570 = load i32, i32* %x319.addr, align 4
  %1571 = load i32, i32* %x316.addr, align 4
  %1572 = call i64 @p256FiatAddcarryxU32(i32 %1569, i32 %1570, i32 %1571)
  store i64 %1572, i64* %w340.addr, align 8
  %1573 = load i64, i64* %w340.addr, align 8
  %1574 = trunc i64 %1573 to i32
  store i32 %1574, i32* %x340.addr, align 4
  %1575 = load i64, i64* %w340.addr, align 8
  %1576 = lshr i64 %1575, 32
  %1577 = trunc i64 %1576 to i32
  store i32 %1577, i32* %x341.addr, align 4
  %1578 = load i32, i32* %x341.addr, align 4
  %1579 = load i32, i32* %x317.addr, align 4
  %1580 = load i32, i32* %x314.addr, align 4
  %1581 = call i64 @p256FiatAddcarryxU32(i32 %1578, i32 %1579, i32 %1580)
  store i64 %1581, i64* %w342.addr, align 8
  %1582 = load i64, i64* %w342.addr, align 8
  %1583 = trunc i64 %1582 to i32
  store i32 %1583, i32* %x342.addr, align 4
  %1584 = load i64, i64* %w342.addr, align 8
  %1585 = lshr i64 %1584, 32
  %1586 = trunc i64 %1585 to i32
  store i32 %1586, i32* %x343.addr, align 4
  %1587 = load i32, i32* %x343.addr, align 4
  %1588 = load i32, i32* %x315.addr, align 4
  %1589 = add i32 %1587, %1588
  store i32 %1589, i32* %x344.addr, align 4
  %1590 = load i32, i32* %x297.addr, align 4
  %1591 = load i32, i32* %x328.addr, align 4
  %1592 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1590, i32 %1591)
  store i64 %1592, i64* %w345.addr, align 8
  %1593 = load i64, i64* %w345.addr, align 8
  %1594 = trunc i64 %1593 to i32
  store i32 %1594, i32* %x345.addr, align 4
  %1595 = load i64, i64* %w345.addr, align 8
  %1596 = lshr i64 %1595, 32
  %1597 = trunc i64 %1596 to i32
  store i32 %1597, i32* %x346.addr, align 4
  %1598 = load i32, i32* %x346.addr, align 4
  %1599 = load i32, i32* %x299.addr, align 4
  %1600 = load i32, i32* %x330.addr, align 4
  %1601 = call i64 @p256FiatAddcarryxU32(i32 %1598, i32 %1599, i32 %1600)
  store i64 %1601, i64* %w347.addr, align 8
  %1602 = load i64, i64* %w347.addr, align 8
  %1603 = trunc i64 %1602 to i32
  store i32 %1603, i32* %x347.addr, align 4
  %1604 = load i64, i64* %w347.addr, align 8
  %1605 = lshr i64 %1604, 32
  %1606 = trunc i64 %1605 to i32
  store i32 %1606, i32* %x348.addr, align 4
  %1607 = load i32, i32* %x348.addr, align 4
  %1608 = load i32, i32* %x301.addr, align 4
  %1609 = load i32, i32* %x332.addr, align 4
  %1610 = call i64 @p256FiatAddcarryxU32(i32 %1607, i32 %1608, i32 %1609)
  store i64 %1610, i64* %w349.addr, align 8
  %1611 = load i64, i64* %w349.addr, align 8
  %1612 = trunc i64 %1611 to i32
  store i32 %1612, i32* %x349.addr, align 4
  %1613 = load i64, i64* %w349.addr, align 8
  %1614 = lshr i64 %1613, 32
  %1615 = trunc i64 %1614 to i32
  store i32 %1615, i32* %x350.addr, align 4
  %1616 = load i32, i32* %x350.addr, align 4
  %1617 = load i32, i32* %x303.addr, align 4
  %1618 = load i32, i32* %x334.addr, align 4
  %1619 = call i64 @p256FiatAddcarryxU32(i32 %1616, i32 %1617, i32 %1618)
  store i64 %1619, i64* %w351.addr, align 8
  %1620 = load i64, i64* %w351.addr, align 8
  %1621 = trunc i64 %1620 to i32
  store i32 %1621, i32* %x351.addr, align 4
  %1622 = load i64, i64* %w351.addr, align 8
  %1623 = lshr i64 %1622, 32
  %1624 = trunc i64 %1623 to i32
  store i32 %1624, i32* %x352.addr, align 4
  %1625 = load i32, i32* %x352.addr, align 4
  %1626 = load i32, i32* %x305.addr, align 4
  %1627 = load i32, i32* %x336.addr, align 4
  %1628 = call i64 @p256FiatAddcarryxU32(i32 %1625, i32 %1626, i32 %1627)
  store i64 %1628, i64* %w353.addr, align 8
  %1629 = load i64, i64* %w353.addr, align 8
  %1630 = trunc i64 %1629 to i32
  store i32 %1630, i32* %x353.addr, align 4
  %1631 = load i64, i64* %w353.addr, align 8
  %1632 = lshr i64 %1631, 32
  %1633 = trunc i64 %1632 to i32
  store i32 %1633, i32* %x354.addr, align 4
  %1634 = load i32, i32* %x354.addr, align 4
  %1635 = load i32, i32* %x307.addr, align 4
  %1636 = load i32, i32* %x338.addr, align 4
  %1637 = call i64 @p256FiatAddcarryxU32(i32 %1634, i32 %1635, i32 %1636)
  store i64 %1637, i64* %w355.addr, align 8
  %1638 = load i64, i64* %w355.addr, align 8
  %1639 = trunc i64 %1638 to i32
  store i32 %1639, i32* %x355.addr, align 4
  %1640 = load i64, i64* %w355.addr, align 8
  %1641 = lshr i64 %1640, 32
  %1642 = trunc i64 %1641 to i32
  store i32 %1642, i32* %x356.addr, align 4
  %1643 = load i32, i32* %x356.addr, align 4
  %1644 = load i32, i32* %x309.addr, align 4
  %1645 = load i32, i32* %x340.addr, align 4
  %1646 = call i64 @p256FiatAddcarryxU32(i32 %1643, i32 %1644, i32 %1645)
  store i64 %1646, i64* %w357.addr, align 8
  %1647 = load i64, i64* %w357.addr, align 8
  %1648 = trunc i64 %1647 to i32
  store i32 %1648, i32* %x357.addr, align 4
  %1649 = load i64, i64* %w357.addr, align 8
  %1650 = lshr i64 %1649, 32
  %1651 = trunc i64 %1650 to i32
  store i32 %1651, i32* %x358.addr, align 4
  %1652 = load i32, i32* %x358.addr, align 4
  %1653 = load i32, i32* %x311.addr, align 4
  %1654 = load i32, i32* %x342.addr, align 4
  %1655 = call i64 @p256FiatAddcarryxU32(i32 %1652, i32 %1653, i32 %1654)
  store i64 %1655, i64* %w359.addr, align 8
  %1656 = load i64, i64* %w359.addr, align 8
  %1657 = trunc i64 %1656 to i32
  store i32 %1657, i32* %x359.addr, align 4
  %1658 = load i64, i64* %w359.addr, align 8
  %1659 = lshr i64 %1658, 32
  %1660 = trunc i64 %1659 to i32
  store i32 %1660, i32* %x360.addr, align 4
  %1661 = load i32, i32* %x360.addr, align 4
  %1662 = load i32, i32* %x313.addr, align 4
  %1663 = load i32, i32* %x344.addr, align 4
  %1664 = call i64 @p256FiatAddcarryxU32(i32 %1661, i32 %1662, i32 %1663)
  store i64 %1664, i64* %w361.addr, align 8
  %1665 = load i64, i64* %w361.addr, align 8
  %1666 = trunc i64 %1665 to i32
  store i32 %1666, i32* %x361.addr, align 4
  %1667 = load i64, i64* %w361.addr, align 8
  %1668 = lshr i64 %1667, 32
  %1669 = trunc i64 %1668 to i32
  store i32 %1669, i32* %x362.addr, align 4
  %1670 = load i32, i32* %x345.addr, align 4
  %1671 = call i64 @p256FiatMulxU32(i32 %1670, i32 4294967295)
  store i64 %1671, i64* %w363.addr, align 8
  %1672 = load i64, i64* %w363.addr, align 8
  %1673 = trunc i64 %1672 to i32
  store i32 %1673, i32* %x363.addr, align 4
  %1674 = load i64, i64* %w363.addr, align 8
  %1675 = lshr i64 %1674, 32
  %1676 = trunc i64 %1675 to i32
  store i32 %1676, i32* %x364.addr, align 4
  %1677 = load i32, i32* %x345.addr, align 4
  %1678 = call i64 @p256FiatMulxU32(i32 %1677, i32 4294967295)
  store i64 %1678, i64* %w365.addr, align 8
  %1679 = load i64, i64* %w365.addr, align 8
  %1680 = trunc i64 %1679 to i32
  store i32 %1680, i32* %x365.addr, align 4
  %1681 = load i64, i64* %w365.addr, align 8
  %1682 = lshr i64 %1681, 32
  %1683 = trunc i64 %1682 to i32
  store i32 %1683, i32* %x366.addr, align 4
  %1684 = load i32, i32* %x345.addr, align 4
  %1685 = call i64 @p256FiatMulxU32(i32 %1684, i32 4294967295)
  store i64 %1685, i64* %w367.addr, align 8
  %1686 = load i64, i64* %w367.addr, align 8
  %1687 = trunc i64 %1686 to i32
  store i32 %1687, i32* %x367.addr, align 4
  %1688 = load i64, i64* %w367.addr, align 8
  %1689 = lshr i64 %1688, 32
  %1690 = trunc i64 %1689 to i32
  store i32 %1690, i32* %x368.addr, align 4
  %1691 = load i32, i32* %x345.addr, align 4
  %1692 = call i64 @p256FiatMulxU32(i32 %1691, i32 4294967295)
  store i64 %1692, i64* %w369.addr, align 8
  %1693 = load i64, i64* %w369.addr, align 8
  %1694 = trunc i64 %1693 to i32
  store i32 %1694, i32* %x369.addr, align 4
  %1695 = load i64, i64* %w369.addr, align 8
  %1696 = lshr i64 %1695, 32
  %1697 = trunc i64 %1696 to i32
  store i32 %1697, i32* %x370.addr, align 4
  %1698 = load i32, i32* %x370.addr, align 4
  %1699 = load i32, i32* %x367.addr, align 4
  %1700 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1698, i32 %1699)
  store i64 %1700, i64* %w371.addr, align 8
  %1701 = load i64, i64* %w371.addr, align 8
  %1702 = trunc i64 %1701 to i32
  store i32 %1702, i32* %x371.addr, align 4
  %1703 = load i64, i64* %w371.addr, align 8
  %1704 = lshr i64 %1703, 32
  %1705 = trunc i64 %1704 to i32
  store i32 %1705, i32* %x372.addr, align 4
  %1706 = load i32, i32* %x372.addr, align 4
  %1707 = load i32, i32* %x368.addr, align 4
  %1708 = load i32, i32* %x365.addr, align 4
  %1709 = call i64 @p256FiatAddcarryxU32(i32 %1706, i32 %1707, i32 %1708)
  store i64 %1709, i64* %w373.addr, align 8
  %1710 = load i64, i64* %w373.addr, align 8
  %1711 = trunc i64 %1710 to i32
  store i32 %1711, i32* %x373.addr, align 4
  %1712 = load i64, i64* %w373.addr, align 8
  %1713 = lshr i64 %1712, 32
  %1714 = trunc i64 %1713 to i32
  store i32 %1714, i32* %x374.addr, align 4
  %1715 = load i32, i32* %x374.addr, align 4
  %1716 = load i32, i32* %x366.addr, align 4
  %1717 = add i32 %1715, %1716
  store i32 %1717, i32* %x375.addr, align 4
  %1718 = load i32, i32* %x345.addr, align 4
  %1719 = load i32, i32* %x369.addr, align 4
  %1720 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1718, i32 %1719)
  store i64 %1720, i64* %w376.addr, align 8
  %1721 = load i64, i64* %w376.addr, align 8
  %1722 = lshr i64 %1721, 32
  %1723 = trunc i64 %1722 to i32
  store i32 %1723, i32* %x377.addr, align 4
  %1724 = load i32, i32* %x377.addr, align 4
  %1725 = load i32, i32* %x347.addr, align 4
  %1726 = load i32, i32* %x371.addr, align 4
  %1727 = call i64 @p256FiatAddcarryxU32(i32 %1724, i32 %1725, i32 %1726)
  store i64 %1727, i64* %w378.addr, align 8
  %1728 = load i64, i64* %w378.addr, align 8
  %1729 = trunc i64 %1728 to i32
  store i32 %1729, i32* %x378.addr, align 4
  %1730 = load i64, i64* %w378.addr, align 8
  %1731 = lshr i64 %1730, 32
  %1732 = trunc i64 %1731 to i32
  store i32 %1732, i32* %x379.addr, align 4
  %1733 = load i32, i32* %x379.addr, align 4
  %1734 = load i32, i32* %x349.addr, align 4
  %1735 = load i32, i32* %x373.addr, align 4
  %1736 = call i64 @p256FiatAddcarryxU32(i32 %1733, i32 %1734, i32 %1735)
  store i64 %1736, i64* %w380.addr, align 8
  %1737 = load i64, i64* %w380.addr, align 8
  %1738 = trunc i64 %1737 to i32
  store i32 %1738, i32* %x380.addr, align 4
  %1739 = load i64, i64* %w380.addr, align 8
  %1740 = lshr i64 %1739, 32
  %1741 = trunc i64 %1740 to i32
  store i32 %1741, i32* %x381.addr, align 4
  %1742 = load i32, i32* %x381.addr, align 4
  %1743 = load i32, i32* %x351.addr, align 4
  %1744 = load i32, i32* %x375.addr, align 4
  %1745 = call i64 @p256FiatAddcarryxU32(i32 %1742, i32 %1743, i32 %1744)
  store i64 %1745, i64* %w382.addr, align 8
  %1746 = load i64, i64* %w382.addr, align 8
  %1747 = trunc i64 %1746 to i32
  store i32 %1747, i32* %x382.addr, align 4
  %1748 = load i64, i64* %w382.addr, align 8
  %1749 = lshr i64 %1748, 32
  %1750 = trunc i64 %1749 to i32
  store i32 %1750, i32* %x383.addr, align 4
  %1751 = load i32, i32* %x383.addr, align 4
  %1752 = load i32, i32* %x353.addr, align 4
  %1753 = call i64 @p256FiatAddcarryxU32(i32 %1751, i32 %1752, i32 0)
  store i64 %1753, i64* %w384.addr, align 8
  %1754 = load i64, i64* %w384.addr, align 8
  %1755 = trunc i64 %1754 to i32
  store i32 %1755, i32* %x384.addr, align 4
  %1756 = load i64, i64* %w384.addr, align 8
  %1757 = lshr i64 %1756, 32
  %1758 = trunc i64 %1757 to i32
  store i32 %1758, i32* %x385.addr, align 4
  %1759 = load i32, i32* %x385.addr, align 4
  %1760 = load i32, i32* %x355.addr, align 4
  %1761 = call i64 @p256FiatAddcarryxU32(i32 %1759, i32 %1760, i32 0)
  store i64 %1761, i64* %w386.addr, align 8
  %1762 = load i64, i64* %w386.addr, align 8
  %1763 = trunc i64 %1762 to i32
  store i32 %1763, i32* %x386.addr, align 4
  %1764 = load i64, i64* %w386.addr, align 8
  %1765 = lshr i64 %1764, 32
  %1766 = trunc i64 %1765 to i32
  store i32 %1766, i32* %x387.addr, align 4
  %1767 = load i32, i32* %x387.addr, align 4
  %1768 = load i32, i32* %x357.addr, align 4
  %1769 = load i32, i32* %x345.addr, align 4
  %1770 = call i64 @p256FiatAddcarryxU32(i32 %1767, i32 %1768, i32 %1769)
  store i64 %1770, i64* %w388.addr, align 8
  %1771 = load i64, i64* %w388.addr, align 8
  %1772 = trunc i64 %1771 to i32
  store i32 %1772, i32* %x388.addr, align 4
  %1773 = load i64, i64* %w388.addr, align 8
  %1774 = lshr i64 %1773, 32
  %1775 = trunc i64 %1774 to i32
  store i32 %1775, i32* %x389.addr, align 4
  %1776 = load i32, i32* %x389.addr, align 4
  %1777 = load i32, i32* %x359.addr, align 4
  %1778 = load i32, i32* %x363.addr, align 4
  %1779 = call i64 @p256FiatAddcarryxU32(i32 %1776, i32 %1777, i32 %1778)
  store i64 %1779, i64* %w390.addr, align 8
  %1780 = load i64, i64* %w390.addr, align 8
  %1781 = trunc i64 %1780 to i32
  store i32 %1781, i32* %x390.addr, align 4
  %1782 = load i64, i64* %w390.addr, align 8
  %1783 = lshr i64 %1782, 32
  %1784 = trunc i64 %1783 to i32
  store i32 %1784, i32* %x391.addr, align 4
  %1785 = load i32, i32* %x391.addr, align 4
  %1786 = load i32, i32* %x361.addr, align 4
  %1787 = load i32, i32* %x364.addr, align 4
  %1788 = call i64 @p256FiatAddcarryxU32(i32 %1785, i32 %1786, i32 %1787)
  store i64 %1788, i64* %w392.addr, align 8
  %1789 = load i64, i64* %w392.addr, align 8
  %1790 = trunc i64 %1789 to i32
  store i32 %1790, i32* %x392.addr, align 4
  %1791 = load i64, i64* %w392.addr, align 8
  %1792 = lshr i64 %1791, 32
  %1793 = trunc i64 %1792 to i32
  store i32 %1793, i32* %x393.addr, align 4
  %1794 = load i32, i32* %x393.addr, align 4
  %1795 = load i32, i32* %x362.addr, align 4
  %1796 = add i32 %1794, %1795
  store i32 %1796, i32* %x394.addr, align 4
  %1797 = load i32, i32* %x5.addr, align 4
  %1798 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1799 = load i8*, i8** %1798, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1800 = bitcast i8* %1799 to i32*
  %1801 = getelementptr inbounds i32, i32* %1800, i64 7
  %1802 = load i32, i32* %1801, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1803 = call i64 @p256FiatMulxU32(i32 %1797, i32 %1802)
  store i64 %1803, i64* %w395.addr, align 8
  %1804 = load i64, i64* %w395.addr, align 8
  %1805 = trunc i64 %1804 to i32
  store i32 %1805, i32* %x395.addr, align 4
  %1806 = load i64, i64* %w395.addr, align 8
  %1807 = lshr i64 %1806, 32
  %1808 = trunc i64 %1807 to i32
  store i32 %1808, i32* %x396.addr, align 4
  %1809 = load i32, i32* %x5.addr, align 4
  %1810 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1811 = load i8*, i8** %1810, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1812 = bitcast i8* %1811 to i32*
  %1813 = getelementptr inbounds i32, i32* %1812, i64 6
  %1814 = load i32, i32* %1813, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1815 = call i64 @p256FiatMulxU32(i32 %1809, i32 %1814)
  store i64 %1815, i64* %w397.addr, align 8
  %1816 = load i64, i64* %w397.addr, align 8
  %1817 = trunc i64 %1816 to i32
  store i32 %1817, i32* %x397.addr, align 4
  %1818 = load i64, i64* %w397.addr, align 8
  %1819 = lshr i64 %1818, 32
  %1820 = trunc i64 %1819 to i32
  store i32 %1820, i32* %x398.addr, align 4
  %1821 = load i32, i32* %x5.addr, align 4
  %1822 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1823 = load i8*, i8** %1822, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1824 = bitcast i8* %1823 to i32*
  %1825 = getelementptr inbounds i32, i32* %1824, i64 5
  %1826 = load i32, i32* %1825, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1827 = call i64 @p256FiatMulxU32(i32 %1821, i32 %1826)
  store i64 %1827, i64* %w399.addr, align 8
  %1828 = load i64, i64* %w399.addr, align 8
  %1829 = trunc i64 %1828 to i32
  store i32 %1829, i32* %x399.addr, align 4
  %1830 = load i64, i64* %w399.addr, align 8
  %1831 = lshr i64 %1830, 32
  %1832 = trunc i64 %1831 to i32
  store i32 %1832, i32* %x400.addr, align 4
  %1833 = load i32, i32* %x5.addr, align 4
  %1834 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1835 = load i8*, i8** %1834, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1836 = bitcast i8* %1835 to i32*
  %1837 = getelementptr inbounds i32, i32* %1836, i64 4
  %1838 = load i32, i32* %1837, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1839 = call i64 @p256FiatMulxU32(i32 %1833, i32 %1838)
  store i64 %1839, i64* %w401.addr, align 8
  %1840 = load i64, i64* %w401.addr, align 8
  %1841 = trunc i64 %1840 to i32
  store i32 %1841, i32* %x401.addr, align 4
  %1842 = load i64, i64* %w401.addr, align 8
  %1843 = lshr i64 %1842, 32
  %1844 = trunc i64 %1843 to i32
  store i32 %1844, i32* %x402.addr, align 4
  %1845 = load i32, i32* %x5.addr, align 4
  %1846 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1847 = load i8*, i8** %1846, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1848 = bitcast i8* %1847 to i32*
  %1849 = getelementptr inbounds i32, i32* %1848, i64 3
  %1850 = load i32, i32* %1849, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1851 = call i64 @p256FiatMulxU32(i32 %1845, i32 %1850)
  store i64 %1851, i64* %w403.addr, align 8
  %1852 = load i64, i64* %w403.addr, align 8
  %1853 = trunc i64 %1852 to i32
  store i32 %1853, i32* %x403.addr, align 4
  %1854 = load i64, i64* %w403.addr, align 8
  %1855 = lshr i64 %1854, 32
  %1856 = trunc i64 %1855 to i32
  store i32 %1856, i32* %x404.addr, align 4
  %1857 = load i32, i32* %x5.addr, align 4
  %1858 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1859 = load i8*, i8** %1858, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1860 = bitcast i8* %1859 to i32*
  %1861 = getelementptr inbounds i32, i32* %1860, i64 2
  %1862 = load i32, i32* %1861, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1863 = call i64 @p256FiatMulxU32(i32 %1857, i32 %1862)
  store i64 %1863, i64* %w405.addr, align 8
  %1864 = load i64, i64* %w405.addr, align 8
  %1865 = trunc i64 %1864 to i32
  store i32 %1865, i32* %x405.addr, align 4
  %1866 = load i64, i64* %w405.addr, align 8
  %1867 = lshr i64 %1866, 32
  %1868 = trunc i64 %1867 to i32
  store i32 %1868, i32* %x406.addr, align 4
  %1869 = load i32, i32* %x5.addr, align 4
  %1870 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1871 = load i8*, i8** %1870, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1872 = bitcast i8* %1871 to i32*
  %1873 = getelementptr inbounds i32, i32* %1872, i64 1
  %1874 = load i32, i32* %1873, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1875 = call i64 @p256FiatMulxU32(i32 %1869, i32 %1874)
  store i64 %1875, i64* %w407.addr, align 8
  %1876 = load i64, i64* %w407.addr, align 8
  %1877 = trunc i64 %1876 to i32
  store i32 %1877, i32* %x407.addr, align 4
  %1878 = load i64, i64* %w407.addr, align 8
  %1879 = lshr i64 %1878, 32
  %1880 = trunc i64 %1879 to i32
  store i32 %1880, i32* %x408.addr, align 4
  %1881 = load i32, i32* %x5.addr, align 4
  %1882 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1883 = load i8*, i8** %1882, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1884 = bitcast i8* %1883 to i32*
  %1885 = getelementptr inbounds i32, i32* %1884, i64 0
  %1886 = load i32, i32* %1885, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1887 = call i64 @p256FiatMulxU32(i32 %1881, i32 %1886)
  store i64 %1887, i64* %w409.addr, align 8
  %1888 = load i64, i64* %w409.addr, align 8
  %1889 = trunc i64 %1888 to i32
  store i32 %1889, i32* %x409.addr, align 4
  %1890 = load i64, i64* %w409.addr, align 8
  %1891 = lshr i64 %1890, 32
  %1892 = trunc i64 %1891 to i32
  store i32 %1892, i32* %x410.addr, align 4
  %1893 = load i32, i32* %x410.addr, align 4
  %1894 = load i32, i32* %x407.addr, align 4
  %1895 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1893, i32 %1894)
  store i64 %1895, i64* %w411.addr, align 8
  %1896 = load i64, i64* %w411.addr, align 8
  %1897 = trunc i64 %1896 to i32
  store i32 %1897, i32* %x411.addr, align 4
  %1898 = load i64, i64* %w411.addr, align 8
  %1899 = lshr i64 %1898, 32
  %1900 = trunc i64 %1899 to i32
  store i32 %1900, i32* %x412.addr, align 4
  %1901 = load i32, i32* %x412.addr, align 4
  %1902 = load i32, i32* %x408.addr, align 4
  %1903 = load i32, i32* %x405.addr, align 4
  %1904 = call i64 @p256FiatAddcarryxU32(i32 %1901, i32 %1902, i32 %1903)
  store i64 %1904, i64* %w413.addr, align 8
  %1905 = load i64, i64* %w413.addr, align 8
  %1906 = trunc i64 %1905 to i32
  store i32 %1906, i32* %x413.addr, align 4
  %1907 = load i64, i64* %w413.addr, align 8
  %1908 = lshr i64 %1907, 32
  %1909 = trunc i64 %1908 to i32
  store i32 %1909, i32* %x414.addr, align 4
  %1910 = load i32, i32* %x414.addr, align 4
  %1911 = load i32, i32* %x406.addr, align 4
  %1912 = load i32, i32* %x403.addr, align 4
  %1913 = call i64 @p256FiatAddcarryxU32(i32 %1910, i32 %1911, i32 %1912)
  store i64 %1913, i64* %w415.addr, align 8
  %1914 = load i64, i64* %w415.addr, align 8
  %1915 = trunc i64 %1914 to i32
  store i32 %1915, i32* %x415.addr, align 4
  %1916 = load i64, i64* %w415.addr, align 8
  %1917 = lshr i64 %1916, 32
  %1918 = trunc i64 %1917 to i32
  store i32 %1918, i32* %x416.addr, align 4
  %1919 = load i32, i32* %x416.addr, align 4
  %1920 = load i32, i32* %x404.addr, align 4
  %1921 = load i32, i32* %x401.addr, align 4
  %1922 = call i64 @p256FiatAddcarryxU32(i32 %1919, i32 %1920, i32 %1921)
  store i64 %1922, i64* %w417.addr, align 8
  %1923 = load i64, i64* %w417.addr, align 8
  %1924 = trunc i64 %1923 to i32
  store i32 %1924, i32* %x417.addr, align 4
  %1925 = load i64, i64* %w417.addr, align 8
  %1926 = lshr i64 %1925, 32
  %1927 = trunc i64 %1926 to i32
  store i32 %1927, i32* %x418.addr, align 4
  %1928 = load i32, i32* %x418.addr, align 4
  %1929 = load i32, i32* %x402.addr, align 4
  %1930 = load i32, i32* %x399.addr, align 4
  %1931 = call i64 @p256FiatAddcarryxU32(i32 %1928, i32 %1929, i32 %1930)
  store i64 %1931, i64* %w419.addr, align 8
  %1932 = load i64, i64* %w419.addr, align 8
  %1933 = trunc i64 %1932 to i32
  store i32 %1933, i32* %x419.addr, align 4
  %1934 = load i64, i64* %w419.addr, align 8
  %1935 = lshr i64 %1934, 32
  %1936 = trunc i64 %1935 to i32
  store i32 %1936, i32* %x420.addr, align 4
  %1937 = load i32, i32* %x420.addr, align 4
  %1938 = load i32, i32* %x400.addr, align 4
  %1939 = load i32, i32* %x397.addr, align 4
  %1940 = call i64 @p256FiatAddcarryxU32(i32 %1937, i32 %1938, i32 %1939)
  store i64 %1940, i64* %w421.addr, align 8
  %1941 = load i64, i64* %w421.addr, align 8
  %1942 = trunc i64 %1941 to i32
  store i32 %1942, i32* %x421.addr, align 4
  %1943 = load i64, i64* %w421.addr, align 8
  %1944 = lshr i64 %1943, 32
  %1945 = trunc i64 %1944 to i32
  store i32 %1945, i32* %x422.addr, align 4
  %1946 = load i32, i32* %x422.addr, align 4
  %1947 = load i32, i32* %x398.addr, align 4
  %1948 = load i32, i32* %x395.addr, align 4
  %1949 = call i64 @p256FiatAddcarryxU32(i32 %1946, i32 %1947, i32 %1948)
  store i64 %1949, i64* %w423.addr, align 8
  %1950 = load i64, i64* %w423.addr, align 8
  %1951 = trunc i64 %1950 to i32
  store i32 %1951, i32* %x423.addr, align 4
  %1952 = load i64, i64* %w423.addr, align 8
  %1953 = lshr i64 %1952, 32
  %1954 = trunc i64 %1953 to i32
  store i32 %1954, i32* %x424.addr, align 4
  %1955 = load i32, i32* %x424.addr, align 4
  %1956 = load i32, i32* %x396.addr, align 4
  %1957 = add i32 %1955, %1956
  store i32 %1957, i32* %x425.addr, align 4
  %1958 = load i32, i32* %x378.addr, align 4
  %1959 = load i32, i32* %x409.addr, align 4
  %1960 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1958, i32 %1959)
  store i64 %1960, i64* %w426.addr, align 8
  %1961 = load i64, i64* %w426.addr, align 8
  %1962 = trunc i64 %1961 to i32
  store i32 %1962, i32* %x426.addr, align 4
  %1963 = load i64, i64* %w426.addr, align 8
  %1964 = lshr i64 %1963, 32
  %1965 = trunc i64 %1964 to i32
  store i32 %1965, i32* %x427.addr, align 4
  %1966 = load i32, i32* %x427.addr, align 4
  %1967 = load i32, i32* %x380.addr, align 4
  %1968 = load i32, i32* %x411.addr, align 4
  %1969 = call i64 @p256FiatAddcarryxU32(i32 %1966, i32 %1967, i32 %1968)
  store i64 %1969, i64* %w428.addr, align 8
  %1970 = load i64, i64* %w428.addr, align 8
  %1971 = trunc i64 %1970 to i32
  store i32 %1971, i32* %x428.addr, align 4
  %1972 = load i64, i64* %w428.addr, align 8
  %1973 = lshr i64 %1972, 32
  %1974 = trunc i64 %1973 to i32
  store i32 %1974, i32* %x429.addr, align 4
  %1975 = load i32, i32* %x429.addr, align 4
  %1976 = load i32, i32* %x382.addr, align 4
  %1977 = load i32, i32* %x413.addr, align 4
  %1978 = call i64 @p256FiatAddcarryxU32(i32 %1975, i32 %1976, i32 %1977)
  store i64 %1978, i64* %w430.addr, align 8
  %1979 = load i64, i64* %w430.addr, align 8
  %1980 = trunc i64 %1979 to i32
  store i32 %1980, i32* %x430.addr, align 4
  %1981 = load i64, i64* %w430.addr, align 8
  %1982 = lshr i64 %1981, 32
  %1983 = trunc i64 %1982 to i32
  store i32 %1983, i32* %x431.addr, align 4
  %1984 = load i32, i32* %x431.addr, align 4
  %1985 = load i32, i32* %x384.addr, align 4
  %1986 = load i32, i32* %x415.addr, align 4
  %1987 = call i64 @p256FiatAddcarryxU32(i32 %1984, i32 %1985, i32 %1986)
  store i64 %1987, i64* %w432.addr, align 8
  %1988 = load i64, i64* %w432.addr, align 8
  %1989 = trunc i64 %1988 to i32
  store i32 %1989, i32* %x432.addr, align 4
  %1990 = load i64, i64* %w432.addr, align 8
  %1991 = lshr i64 %1990, 32
  %1992 = trunc i64 %1991 to i32
  store i32 %1992, i32* %x433.addr, align 4
  %1993 = load i32, i32* %x433.addr, align 4
  %1994 = load i32, i32* %x386.addr, align 4
  %1995 = load i32, i32* %x417.addr, align 4
  %1996 = call i64 @p256FiatAddcarryxU32(i32 %1993, i32 %1994, i32 %1995)
  store i64 %1996, i64* %w434.addr, align 8
  %1997 = load i64, i64* %w434.addr, align 8
  %1998 = trunc i64 %1997 to i32
  store i32 %1998, i32* %x434.addr, align 4
  %1999 = load i64, i64* %w434.addr, align 8
  %2000 = lshr i64 %1999, 32
  %2001 = trunc i64 %2000 to i32
  store i32 %2001, i32* %x435.addr, align 4
  %2002 = load i32, i32* %x435.addr, align 4
  %2003 = load i32, i32* %x388.addr, align 4
  %2004 = load i32, i32* %x419.addr, align 4
  %2005 = call i64 @p256FiatAddcarryxU32(i32 %2002, i32 %2003, i32 %2004)
  store i64 %2005, i64* %w436.addr, align 8
  %2006 = load i64, i64* %w436.addr, align 8
  %2007 = trunc i64 %2006 to i32
  store i32 %2007, i32* %x436.addr, align 4
  %2008 = load i64, i64* %w436.addr, align 8
  %2009 = lshr i64 %2008, 32
  %2010 = trunc i64 %2009 to i32
  store i32 %2010, i32* %x437.addr, align 4
  %2011 = load i32, i32* %x437.addr, align 4
  %2012 = load i32, i32* %x390.addr, align 4
  %2013 = load i32, i32* %x421.addr, align 4
  %2014 = call i64 @p256FiatAddcarryxU32(i32 %2011, i32 %2012, i32 %2013)
  store i64 %2014, i64* %w438.addr, align 8
  %2015 = load i64, i64* %w438.addr, align 8
  %2016 = trunc i64 %2015 to i32
  store i32 %2016, i32* %x438.addr, align 4
  %2017 = load i64, i64* %w438.addr, align 8
  %2018 = lshr i64 %2017, 32
  %2019 = trunc i64 %2018 to i32
  store i32 %2019, i32* %x439.addr, align 4
  %2020 = load i32, i32* %x439.addr, align 4
  %2021 = load i32, i32* %x392.addr, align 4
  %2022 = load i32, i32* %x423.addr, align 4
  %2023 = call i64 @p256FiatAddcarryxU32(i32 %2020, i32 %2021, i32 %2022)
  store i64 %2023, i64* %w440.addr, align 8
  %2024 = load i64, i64* %w440.addr, align 8
  %2025 = trunc i64 %2024 to i32
  store i32 %2025, i32* %x440.addr, align 4
  %2026 = load i64, i64* %w440.addr, align 8
  %2027 = lshr i64 %2026, 32
  %2028 = trunc i64 %2027 to i32
  store i32 %2028, i32* %x441.addr, align 4
  %2029 = load i32, i32* %x441.addr, align 4
  %2030 = load i32, i32* %x394.addr, align 4
  %2031 = load i32, i32* %x425.addr, align 4
  %2032 = call i64 @p256FiatAddcarryxU32(i32 %2029, i32 %2030, i32 %2031)
  store i64 %2032, i64* %w442.addr, align 8
  %2033 = load i64, i64* %w442.addr, align 8
  %2034 = trunc i64 %2033 to i32
  store i32 %2034, i32* %x442.addr, align 4
  %2035 = load i64, i64* %w442.addr, align 8
  %2036 = lshr i64 %2035, 32
  %2037 = trunc i64 %2036 to i32
  store i32 %2037, i32* %x443.addr, align 4
  %2038 = load i32, i32* %x426.addr, align 4
  %2039 = call i64 @p256FiatMulxU32(i32 %2038, i32 4294967295)
  store i64 %2039, i64* %w444.addr, align 8
  %2040 = load i64, i64* %w444.addr, align 8
  %2041 = trunc i64 %2040 to i32
  store i32 %2041, i32* %x444.addr, align 4
  %2042 = load i64, i64* %w444.addr, align 8
  %2043 = lshr i64 %2042, 32
  %2044 = trunc i64 %2043 to i32
  store i32 %2044, i32* %x445.addr, align 4
  %2045 = load i32, i32* %x426.addr, align 4
  %2046 = call i64 @p256FiatMulxU32(i32 %2045, i32 4294967295)
  store i64 %2046, i64* %w446.addr, align 8
  %2047 = load i64, i64* %w446.addr, align 8
  %2048 = trunc i64 %2047 to i32
  store i32 %2048, i32* %x446.addr, align 4
  %2049 = load i64, i64* %w446.addr, align 8
  %2050 = lshr i64 %2049, 32
  %2051 = trunc i64 %2050 to i32
  store i32 %2051, i32* %x447.addr, align 4
  %2052 = load i32, i32* %x426.addr, align 4
  %2053 = call i64 @p256FiatMulxU32(i32 %2052, i32 4294967295)
  store i64 %2053, i64* %w448.addr, align 8
  %2054 = load i64, i64* %w448.addr, align 8
  %2055 = trunc i64 %2054 to i32
  store i32 %2055, i32* %x448.addr, align 4
  %2056 = load i64, i64* %w448.addr, align 8
  %2057 = lshr i64 %2056, 32
  %2058 = trunc i64 %2057 to i32
  store i32 %2058, i32* %x449.addr, align 4
  %2059 = load i32, i32* %x426.addr, align 4
  %2060 = call i64 @p256FiatMulxU32(i32 %2059, i32 4294967295)
  store i64 %2060, i64* %w450.addr, align 8
  %2061 = load i64, i64* %w450.addr, align 8
  %2062 = trunc i64 %2061 to i32
  store i32 %2062, i32* %x450.addr, align 4
  %2063 = load i64, i64* %w450.addr, align 8
  %2064 = lshr i64 %2063, 32
  %2065 = trunc i64 %2064 to i32
  store i32 %2065, i32* %x451.addr, align 4
  %2066 = load i32, i32* %x451.addr, align 4
  %2067 = load i32, i32* %x448.addr, align 4
  %2068 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2066, i32 %2067)
  store i64 %2068, i64* %w452.addr, align 8
  %2069 = load i64, i64* %w452.addr, align 8
  %2070 = trunc i64 %2069 to i32
  store i32 %2070, i32* %x452.addr, align 4
  %2071 = load i64, i64* %w452.addr, align 8
  %2072 = lshr i64 %2071, 32
  %2073 = trunc i64 %2072 to i32
  store i32 %2073, i32* %x453.addr, align 4
  %2074 = load i32, i32* %x453.addr, align 4
  %2075 = load i32, i32* %x449.addr, align 4
  %2076 = load i32, i32* %x446.addr, align 4
  %2077 = call i64 @p256FiatAddcarryxU32(i32 %2074, i32 %2075, i32 %2076)
  store i64 %2077, i64* %w454.addr, align 8
  %2078 = load i64, i64* %w454.addr, align 8
  %2079 = trunc i64 %2078 to i32
  store i32 %2079, i32* %x454.addr, align 4
  %2080 = load i64, i64* %w454.addr, align 8
  %2081 = lshr i64 %2080, 32
  %2082 = trunc i64 %2081 to i32
  store i32 %2082, i32* %x455.addr, align 4
  %2083 = load i32, i32* %x455.addr, align 4
  %2084 = load i32, i32* %x447.addr, align 4
  %2085 = add i32 %2083, %2084
  store i32 %2085, i32* %x456.addr, align 4
  %2086 = load i32, i32* %x426.addr, align 4
  %2087 = load i32, i32* %x450.addr, align 4
  %2088 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2086, i32 %2087)
  store i64 %2088, i64* %w457.addr, align 8
  %2089 = load i64, i64* %w457.addr, align 8
  %2090 = lshr i64 %2089, 32
  %2091 = trunc i64 %2090 to i32
  store i32 %2091, i32* %x458.addr, align 4
  %2092 = load i32, i32* %x458.addr, align 4
  %2093 = load i32, i32* %x428.addr, align 4
  %2094 = load i32, i32* %x452.addr, align 4
  %2095 = call i64 @p256FiatAddcarryxU32(i32 %2092, i32 %2093, i32 %2094)
  store i64 %2095, i64* %w459.addr, align 8
  %2096 = load i64, i64* %w459.addr, align 8
  %2097 = trunc i64 %2096 to i32
  store i32 %2097, i32* %x459.addr, align 4
  %2098 = load i64, i64* %w459.addr, align 8
  %2099 = lshr i64 %2098, 32
  %2100 = trunc i64 %2099 to i32
  store i32 %2100, i32* %x460.addr, align 4
  %2101 = load i32, i32* %x460.addr, align 4
  %2102 = load i32, i32* %x430.addr, align 4
  %2103 = load i32, i32* %x454.addr, align 4
  %2104 = call i64 @p256FiatAddcarryxU32(i32 %2101, i32 %2102, i32 %2103)
  store i64 %2104, i64* %w461.addr, align 8
  %2105 = load i64, i64* %w461.addr, align 8
  %2106 = trunc i64 %2105 to i32
  store i32 %2106, i32* %x461.addr, align 4
  %2107 = load i64, i64* %w461.addr, align 8
  %2108 = lshr i64 %2107, 32
  %2109 = trunc i64 %2108 to i32
  store i32 %2109, i32* %x462.addr, align 4
  %2110 = load i32, i32* %x462.addr, align 4
  %2111 = load i32, i32* %x432.addr, align 4
  %2112 = load i32, i32* %x456.addr, align 4
  %2113 = call i64 @p256FiatAddcarryxU32(i32 %2110, i32 %2111, i32 %2112)
  store i64 %2113, i64* %w463.addr, align 8
  %2114 = load i64, i64* %w463.addr, align 8
  %2115 = trunc i64 %2114 to i32
  store i32 %2115, i32* %x463.addr, align 4
  %2116 = load i64, i64* %w463.addr, align 8
  %2117 = lshr i64 %2116, 32
  %2118 = trunc i64 %2117 to i32
  store i32 %2118, i32* %x464.addr, align 4
  %2119 = load i32, i32* %x464.addr, align 4
  %2120 = load i32, i32* %x434.addr, align 4
  %2121 = call i64 @p256FiatAddcarryxU32(i32 %2119, i32 %2120, i32 0)
  store i64 %2121, i64* %w465.addr, align 8
  %2122 = load i64, i64* %w465.addr, align 8
  %2123 = trunc i64 %2122 to i32
  store i32 %2123, i32* %x465.addr, align 4
  %2124 = load i64, i64* %w465.addr, align 8
  %2125 = lshr i64 %2124, 32
  %2126 = trunc i64 %2125 to i32
  store i32 %2126, i32* %x466.addr, align 4
  %2127 = load i32, i32* %x466.addr, align 4
  %2128 = load i32, i32* %x436.addr, align 4
  %2129 = call i64 @p256FiatAddcarryxU32(i32 %2127, i32 %2128, i32 0)
  store i64 %2129, i64* %w467.addr, align 8
  %2130 = load i64, i64* %w467.addr, align 8
  %2131 = trunc i64 %2130 to i32
  store i32 %2131, i32* %x467.addr, align 4
  %2132 = load i64, i64* %w467.addr, align 8
  %2133 = lshr i64 %2132, 32
  %2134 = trunc i64 %2133 to i32
  store i32 %2134, i32* %x468.addr, align 4
  %2135 = load i32, i32* %x468.addr, align 4
  %2136 = load i32, i32* %x438.addr, align 4
  %2137 = load i32, i32* %x426.addr, align 4
  %2138 = call i64 @p256FiatAddcarryxU32(i32 %2135, i32 %2136, i32 %2137)
  store i64 %2138, i64* %w469.addr, align 8
  %2139 = load i64, i64* %w469.addr, align 8
  %2140 = trunc i64 %2139 to i32
  store i32 %2140, i32* %x469.addr, align 4
  %2141 = load i64, i64* %w469.addr, align 8
  %2142 = lshr i64 %2141, 32
  %2143 = trunc i64 %2142 to i32
  store i32 %2143, i32* %x470.addr, align 4
  %2144 = load i32, i32* %x470.addr, align 4
  %2145 = load i32, i32* %x440.addr, align 4
  %2146 = load i32, i32* %x444.addr, align 4
  %2147 = call i64 @p256FiatAddcarryxU32(i32 %2144, i32 %2145, i32 %2146)
  store i64 %2147, i64* %w471.addr, align 8
  %2148 = load i64, i64* %w471.addr, align 8
  %2149 = trunc i64 %2148 to i32
  store i32 %2149, i32* %x471.addr, align 4
  %2150 = load i64, i64* %w471.addr, align 8
  %2151 = lshr i64 %2150, 32
  %2152 = trunc i64 %2151 to i32
  store i32 %2152, i32* %x472.addr, align 4
  %2153 = load i32, i32* %x472.addr, align 4
  %2154 = load i32, i32* %x442.addr, align 4
  %2155 = load i32, i32* %x445.addr, align 4
  %2156 = call i64 @p256FiatAddcarryxU32(i32 %2153, i32 %2154, i32 %2155)
  store i64 %2156, i64* %w473.addr, align 8
  %2157 = load i64, i64* %w473.addr, align 8
  %2158 = trunc i64 %2157 to i32
  store i32 %2158, i32* %x473.addr, align 4
  %2159 = load i64, i64* %w473.addr, align 8
  %2160 = lshr i64 %2159, 32
  %2161 = trunc i64 %2160 to i32
  store i32 %2161, i32* %x474.addr, align 4
  %2162 = load i32, i32* %x474.addr, align 4
  %2163 = load i32, i32* %x443.addr, align 4
  %2164 = add i32 %2162, %2163
  store i32 %2164, i32* %x475.addr, align 4
  %2165 = load i32, i32* %x6.addr, align 4
  %2166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2167 = load i8*, i8** %2166, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2168 = bitcast i8* %2167 to i32*
  %2169 = getelementptr inbounds i32, i32* %2168, i64 7
  %2170 = load i32, i32* %2169, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2171 = call i64 @p256FiatMulxU32(i32 %2165, i32 %2170)
  store i64 %2171, i64* %w476.addr, align 8
  %2172 = load i64, i64* %w476.addr, align 8
  %2173 = trunc i64 %2172 to i32
  store i32 %2173, i32* %x476.addr, align 4
  %2174 = load i64, i64* %w476.addr, align 8
  %2175 = lshr i64 %2174, 32
  %2176 = trunc i64 %2175 to i32
  store i32 %2176, i32* %x477.addr, align 4
  %2177 = load i32, i32* %x6.addr, align 4
  %2178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2179 = load i8*, i8** %2178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2180 = bitcast i8* %2179 to i32*
  %2181 = getelementptr inbounds i32, i32* %2180, i64 6
  %2182 = load i32, i32* %2181, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2183 = call i64 @p256FiatMulxU32(i32 %2177, i32 %2182)
  store i64 %2183, i64* %w478.addr, align 8
  %2184 = load i64, i64* %w478.addr, align 8
  %2185 = trunc i64 %2184 to i32
  store i32 %2185, i32* %x478.addr, align 4
  %2186 = load i64, i64* %w478.addr, align 8
  %2187 = lshr i64 %2186, 32
  %2188 = trunc i64 %2187 to i32
  store i32 %2188, i32* %x479.addr, align 4
  %2189 = load i32, i32* %x6.addr, align 4
  %2190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2191 = load i8*, i8** %2190, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2192 = bitcast i8* %2191 to i32*
  %2193 = getelementptr inbounds i32, i32* %2192, i64 5
  %2194 = load i32, i32* %2193, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2195 = call i64 @p256FiatMulxU32(i32 %2189, i32 %2194)
  store i64 %2195, i64* %w480.addr, align 8
  %2196 = load i64, i64* %w480.addr, align 8
  %2197 = trunc i64 %2196 to i32
  store i32 %2197, i32* %x480.addr, align 4
  %2198 = load i64, i64* %w480.addr, align 8
  %2199 = lshr i64 %2198, 32
  %2200 = trunc i64 %2199 to i32
  store i32 %2200, i32* %x481.addr, align 4
  %2201 = load i32, i32* %x6.addr, align 4
  %2202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2203 = load i8*, i8** %2202, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2204 = bitcast i8* %2203 to i32*
  %2205 = getelementptr inbounds i32, i32* %2204, i64 4
  %2206 = load i32, i32* %2205, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2207 = call i64 @p256FiatMulxU32(i32 %2201, i32 %2206)
  store i64 %2207, i64* %w482.addr, align 8
  %2208 = load i64, i64* %w482.addr, align 8
  %2209 = trunc i64 %2208 to i32
  store i32 %2209, i32* %x482.addr, align 4
  %2210 = load i64, i64* %w482.addr, align 8
  %2211 = lshr i64 %2210, 32
  %2212 = trunc i64 %2211 to i32
  store i32 %2212, i32* %x483.addr, align 4
  %2213 = load i32, i32* %x6.addr, align 4
  %2214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2215 = load i8*, i8** %2214, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2216 = bitcast i8* %2215 to i32*
  %2217 = getelementptr inbounds i32, i32* %2216, i64 3
  %2218 = load i32, i32* %2217, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2219 = call i64 @p256FiatMulxU32(i32 %2213, i32 %2218)
  store i64 %2219, i64* %w484.addr, align 8
  %2220 = load i64, i64* %w484.addr, align 8
  %2221 = trunc i64 %2220 to i32
  store i32 %2221, i32* %x484.addr, align 4
  %2222 = load i64, i64* %w484.addr, align 8
  %2223 = lshr i64 %2222, 32
  %2224 = trunc i64 %2223 to i32
  store i32 %2224, i32* %x485.addr, align 4
  %2225 = load i32, i32* %x6.addr, align 4
  %2226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2227 = load i8*, i8** %2226, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2228 = bitcast i8* %2227 to i32*
  %2229 = getelementptr inbounds i32, i32* %2228, i64 2
  %2230 = load i32, i32* %2229, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2231 = call i64 @p256FiatMulxU32(i32 %2225, i32 %2230)
  store i64 %2231, i64* %w486.addr, align 8
  %2232 = load i64, i64* %w486.addr, align 8
  %2233 = trunc i64 %2232 to i32
  store i32 %2233, i32* %x486.addr, align 4
  %2234 = load i64, i64* %w486.addr, align 8
  %2235 = lshr i64 %2234, 32
  %2236 = trunc i64 %2235 to i32
  store i32 %2236, i32* %x487.addr, align 4
  %2237 = load i32, i32* %x6.addr, align 4
  %2238 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2239 = load i8*, i8** %2238, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2240 = bitcast i8* %2239 to i32*
  %2241 = getelementptr inbounds i32, i32* %2240, i64 1
  %2242 = load i32, i32* %2241, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2243 = call i64 @p256FiatMulxU32(i32 %2237, i32 %2242)
  store i64 %2243, i64* %w488.addr, align 8
  %2244 = load i64, i64* %w488.addr, align 8
  %2245 = trunc i64 %2244 to i32
  store i32 %2245, i32* %x488.addr, align 4
  %2246 = load i64, i64* %w488.addr, align 8
  %2247 = lshr i64 %2246, 32
  %2248 = trunc i64 %2247 to i32
  store i32 %2248, i32* %x489.addr, align 4
  %2249 = load i32, i32* %x6.addr, align 4
  %2250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2251 = load i8*, i8** %2250, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2252 = bitcast i8* %2251 to i32*
  %2253 = getelementptr inbounds i32, i32* %2252, i64 0
  %2254 = load i32, i32* %2253, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2255 = call i64 @p256FiatMulxU32(i32 %2249, i32 %2254)
  store i64 %2255, i64* %w490.addr, align 8
  %2256 = load i64, i64* %w490.addr, align 8
  %2257 = trunc i64 %2256 to i32
  store i32 %2257, i32* %x490.addr, align 4
  %2258 = load i64, i64* %w490.addr, align 8
  %2259 = lshr i64 %2258, 32
  %2260 = trunc i64 %2259 to i32
  store i32 %2260, i32* %x491.addr, align 4
  %2261 = load i32, i32* %x491.addr, align 4
  %2262 = load i32, i32* %x488.addr, align 4
  %2263 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2261, i32 %2262)
  store i64 %2263, i64* %w492.addr, align 8
  %2264 = load i64, i64* %w492.addr, align 8
  %2265 = trunc i64 %2264 to i32
  store i32 %2265, i32* %x492.addr, align 4
  %2266 = load i64, i64* %w492.addr, align 8
  %2267 = lshr i64 %2266, 32
  %2268 = trunc i64 %2267 to i32
  store i32 %2268, i32* %x493.addr, align 4
  %2269 = load i32, i32* %x493.addr, align 4
  %2270 = load i32, i32* %x489.addr, align 4
  %2271 = load i32, i32* %x486.addr, align 4
  %2272 = call i64 @p256FiatAddcarryxU32(i32 %2269, i32 %2270, i32 %2271)
  store i64 %2272, i64* %w494.addr, align 8
  %2273 = load i64, i64* %w494.addr, align 8
  %2274 = trunc i64 %2273 to i32
  store i32 %2274, i32* %x494.addr, align 4
  %2275 = load i64, i64* %w494.addr, align 8
  %2276 = lshr i64 %2275, 32
  %2277 = trunc i64 %2276 to i32
  store i32 %2277, i32* %x495.addr, align 4
  %2278 = load i32, i32* %x495.addr, align 4
  %2279 = load i32, i32* %x487.addr, align 4
  %2280 = load i32, i32* %x484.addr, align 4
  %2281 = call i64 @p256FiatAddcarryxU32(i32 %2278, i32 %2279, i32 %2280)
  store i64 %2281, i64* %w496.addr, align 8
  %2282 = load i64, i64* %w496.addr, align 8
  %2283 = trunc i64 %2282 to i32
  store i32 %2283, i32* %x496.addr, align 4
  %2284 = load i64, i64* %w496.addr, align 8
  %2285 = lshr i64 %2284, 32
  %2286 = trunc i64 %2285 to i32
  store i32 %2286, i32* %x497.addr, align 4
  %2287 = load i32, i32* %x497.addr, align 4
  %2288 = load i32, i32* %x485.addr, align 4
  %2289 = load i32, i32* %x482.addr, align 4
  %2290 = call i64 @p256FiatAddcarryxU32(i32 %2287, i32 %2288, i32 %2289)
  store i64 %2290, i64* %w498.addr, align 8
  %2291 = load i64, i64* %w498.addr, align 8
  %2292 = trunc i64 %2291 to i32
  store i32 %2292, i32* %x498.addr, align 4
  %2293 = load i64, i64* %w498.addr, align 8
  %2294 = lshr i64 %2293, 32
  %2295 = trunc i64 %2294 to i32
  store i32 %2295, i32* %x499.addr, align 4
  %2296 = load i32, i32* %x499.addr, align 4
  %2297 = load i32, i32* %x483.addr, align 4
  %2298 = load i32, i32* %x480.addr, align 4
  %2299 = call i64 @p256FiatAddcarryxU32(i32 %2296, i32 %2297, i32 %2298)
  store i64 %2299, i64* %w500.addr, align 8
  %2300 = load i64, i64* %w500.addr, align 8
  %2301 = trunc i64 %2300 to i32
  store i32 %2301, i32* %x500.addr, align 4
  %2302 = load i64, i64* %w500.addr, align 8
  %2303 = lshr i64 %2302, 32
  %2304 = trunc i64 %2303 to i32
  store i32 %2304, i32* %x501.addr, align 4
  %2305 = load i32, i32* %x501.addr, align 4
  %2306 = load i32, i32* %x481.addr, align 4
  %2307 = load i32, i32* %x478.addr, align 4
  %2308 = call i64 @p256FiatAddcarryxU32(i32 %2305, i32 %2306, i32 %2307)
  store i64 %2308, i64* %w502.addr, align 8
  %2309 = load i64, i64* %w502.addr, align 8
  %2310 = trunc i64 %2309 to i32
  store i32 %2310, i32* %x502.addr, align 4
  %2311 = load i64, i64* %w502.addr, align 8
  %2312 = lshr i64 %2311, 32
  %2313 = trunc i64 %2312 to i32
  store i32 %2313, i32* %x503.addr, align 4
  %2314 = load i32, i32* %x503.addr, align 4
  %2315 = load i32, i32* %x479.addr, align 4
  %2316 = load i32, i32* %x476.addr, align 4
  %2317 = call i64 @p256FiatAddcarryxU32(i32 %2314, i32 %2315, i32 %2316)
  store i64 %2317, i64* %w504.addr, align 8
  %2318 = load i64, i64* %w504.addr, align 8
  %2319 = trunc i64 %2318 to i32
  store i32 %2319, i32* %x504.addr, align 4
  %2320 = load i64, i64* %w504.addr, align 8
  %2321 = lshr i64 %2320, 32
  %2322 = trunc i64 %2321 to i32
  store i32 %2322, i32* %x505.addr, align 4
  %2323 = load i32, i32* %x505.addr, align 4
  %2324 = load i32, i32* %x477.addr, align 4
  %2325 = add i32 %2323, %2324
  store i32 %2325, i32* %x506.addr, align 4
  %2326 = load i32, i32* %x459.addr, align 4
  %2327 = load i32, i32* %x490.addr, align 4
  %2328 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2326, i32 %2327)
  store i64 %2328, i64* %w507.addr, align 8
  %2329 = load i64, i64* %w507.addr, align 8
  %2330 = trunc i64 %2329 to i32
  store i32 %2330, i32* %x507.addr, align 4
  %2331 = load i64, i64* %w507.addr, align 8
  %2332 = lshr i64 %2331, 32
  %2333 = trunc i64 %2332 to i32
  store i32 %2333, i32* %x508.addr, align 4
  %2334 = load i32, i32* %x508.addr, align 4
  %2335 = load i32, i32* %x461.addr, align 4
  %2336 = load i32, i32* %x492.addr, align 4
  %2337 = call i64 @p256FiatAddcarryxU32(i32 %2334, i32 %2335, i32 %2336)
  store i64 %2337, i64* %w509.addr, align 8
  %2338 = load i64, i64* %w509.addr, align 8
  %2339 = trunc i64 %2338 to i32
  store i32 %2339, i32* %x509.addr, align 4
  %2340 = load i64, i64* %w509.addr, align 8
  %2341 = lshr i64 %2340, 32
  %2342 = trunc i64 %2341 to i32
  store i32 %2342, i32* %x510.addr, align 4
  %2343 = load i32, i32* %x510.addr, align 4
  %2344 = load i32, i32* %x463.addr, align 4
  %2345 = load i32, i32* %x494.addr, align 4
  %2346 = call i64 @p256FiatAddcarryxU32(i32 %2343, i32 %2344, i32 %2345)
  store i64 %2346, i64* %w511.addr, align 8
  %2347 = load i64, i64* %w511.addr, align 8
  %2348 = trunc i64 %2347 to i32
  store i32 %2348, i32* %x511.addr, align 4
  %2349 = load i64, i64* %w511.addr, align 8
  %2350 = lshr i64 %2349, 32
  %2351 = trunc i64 %2350 to i32
  store i32 %2351, i32* %x512.addr, align 4
  %2352 = load i32, i32* %x512.addr, align 4
  %2353 = load i32, i32* %x465.addr, align 4
  %2354 = load i32, i32* %x496.addr, align 4
  %2355 = call i64 @p256FiatAddcarryxU32(i32 %2352, i32 %2353, i32 %2354)
  store i64 %2355, i64* %w513.addr, align 8
  %2356 = load i64, i64* %w513.addr, align 8
  %2357 = trunc i64 %2356 to i32
  store i32 %2357, i32* %x513.addr, align 4
  %2358 = load i64, i64* %w513.addr, align 8
  %2359 = lshr i64 %2358, 32
  %2360 = trunc i64 %2359 to i32
  store i32 %2360, i32* %x514.addr, align 4
  %2361 = load i32, i32* %x514.addr, align 4
  %2362 = load i32, i32* %x467.addr, align 4
  %2363 = load i32, i32* %x498.addr, align 4
  %2364 = call i64 @p256FiatAddcarryxU32(i32 %2361, i32 %2362, i32 %2363)
  store i64 %2364, i64* %w515.addr, align 8
  %2365 = load i64, i64* %w515.addr, align 8
  %2366 = trunc i64 %2365 to i32
  store i32 %2366, i32* %x515.addr, align 4
  %2367 = load i64, i64* %w515.addr, align 8
  %2368 = lshr i64 %2367, 32
  %2369 = trunc i64 %2368 to i32
  store i32 %2369, i32* %x516.addr, align 4
  %2370 = load i32, i32* %x516.addr, align 4
  %2371 = load i32, i32* %x469.addr, align 4
  %2372 = load i32, i32* %x500.addr, align 4
  %2373 = call i64 @p256FiatAddcarryxU32(i32 %2370, i32 %2371, i32 %2372)
  store i64 %2373, i64* %w517.addr, align 8
  %2374 = load i64, i64* %w517.addr, align 8
  %2375 = trunc i64 %2374 to i32
  store i32 %2375, i32* %x517.addr, align 4
  %2376 = load i64, i64* %w517.addr, align 8
  %2377 = lshr i64 %2376, 32
  %2378 = trunc i64 %2377 to i32
  store i32 %2378, i32* %x518.addr, align 4
  %2379 = load i32, i32* %x518.addr, align 4
  %2380 = load i32, i32* %x471.addr, align 4
  %2381 = load i32, i32* %x502.addr, align 4
  %2382 = call i64 @p256FiatAddcarryxU32(i32 %2379, i32 %2380, i32 %2381)
  store i64 %2382, i64* %w519.addr, align 8
  %2383 = load i64, i64* %w519.addr, align 8
  %2384 = trunc i64 %2383 to i32
  store i32 %2384, i32* %x519.addr, align 4
  %2385 = load i64, i64* %w519.addr, align 8
  %2386 = lshr i64 %2385, 32
  %2387 = trunc i64 %2386 to i32
  store i32 %2387, i32* %x520.addr, align 4
  %2388 = load i32, i32* %x520.addr, align 4
  %2389 = load i32, i32* %x473.addr, align 4
  %2390 = load i32, i32* %x504.addr, align 4
  %2391 = call i64 @p256FiatAddcarryxU32(i32 %2388, i32 %2389, i32 %2390)
  store i64 %2391, i64* %w521.addr, align 8
  %2392 = load i64, i64* %w521.addr, align 8
  %2393 = trunc i64 %2392 to i32
  store i32 %2393, i32* %x521.addr, align 4
  %2394 = load i64, i64* %w521.addr, align 8
  %2395 = lshr i64 %2394, 32
  %2396 = trunc i64 %2395 to i32
  store i32 %2396, i32* %x522.addr, align 4
  %2397 = load i32, i32* %x522.addr, align 4
  %2398 = load i32, i32* %x475.addr, align 4
  %2399 = load i32, i32* %x506.addr, align 4
  %2400 = call i64 @p256FiatAddcarryxU32(i32 %2397, i32 %2398, i32 %2399)
  store i64 %2400, i64* %w523.addr, align 8
  %2401 = load i64, i64* %w523.addr, align 8
  %2402 = trunc i64 %2401 to i32
  store i32 %2402, i32* %x523.addr, align 4
  %2403 = load i64, i64* %w523.addr, align 8
  %2404 = lshr i64 %2403, 32
  %2405 = trunc i64 %2404 to i32
  store i32 %2405, i32* %x524.addr, align 4
  %2406 = load i32, i32* %x507.addr, align 4
  %2407 = call i64 @p256FiatMulxU32(i32 %2406, i32 4294967295)
  store i64 %2407, i64* %w525.addr, align 8
  %2408 = load i64, i64* %w525.addr, align 8
  %2409 = trunc i64 %2408 to i32
  store i32 %2409, i32* %x525.addr, align 4
  %2410 = load i64, i64* %w525.addr, align 8
  %2411 = lshr i64 %2410, 32
  %2412 = trunc i64 %2411 to i32
  store i32 %2412, i32* %x526.addr, align 4
  %2413 = load i32, i32* %x507.addr, align 4
  %2414 = call i64 @p256FiatMulxU32(i32 %2413, i32 4294967295)
  store i64 %2414, i64* %w527.addr, align 8
  %2415 = load i64, i64* %w527.addr, align 8
  %2416 = trunc i64 %2415 to i32
  store i32 %2416, i32* %x527.addr, align 4
  %2417 = load i64, i64* %w527.addr, align 8
  %2418 = lshr i64 %2417, 32
  %2419 = trunc i64 %2418 to i32
  store i32 %2419, i32* %x528.addr, align 4
  %2420 = load i32, i32* %x507.addr, align 4
  %2421 = call i64 @p256FiatMulxU32(i32 %2420, i32 4294967295)
  store i64 %2421, i64* %w529.addr, align 8
  %2422 = load i64, i64* %w529.addr, align 8
  %2423 = trunc i64 %2422 to i32
  store i32 %2423, i32* %x529.addr, align 4
  %2424 = load i64, i64* %w529.addr, align 8
  %2425 = lshr i64 %2424, 32
  %2426 = trunc i64 %2425 to i32
  store i32 %2426, i32* %x530.addr, align 4
  %2427 = load i32, i32* %x507.addr, align 4
  %2428 = call i64 @p256FiatMulxU32(i32 %2427, i32 4294967295)
  store i64 %2428, i64* %w531.addr, align 8
  %2429 = load i64, i64* %w531.addr, align 8
  %2430 = trunc i64 %2429 to i32
  store i32 %2430, i32* %x531.addr, align 4
  %2431 = load i64, i64* %w531.addr, align 8
  %2432 = lshr i64 %2431, 32
  %2433 = trunc i64 %2432 to i32
  store i32 %2433, i32* %x532.addr, align 4
  %2434 = load i32, i32* %x532.addr, align 4
  %2435 = load i32, i32* %x529.addr, align 4
  %2436 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2434, i32 %2435)
  store i64 %2436, i64* %w533.addr, align 8
  %2437 = load i64, i64* %w533.addr, align 8
  %2438 = trunc i64 %2437 to i32
  store i32 %2438, i32* %x533.addr, align 4
  %2439 = load i64, i64* %w533.addr, align 8
  %2440 = lshr i64 %2439, 32
  %2441 = trunc i64 %2440 to i32
  store i32 %2441, i32* %x534.addr, align 4
  %2442 = load i32, i32* %x534.addr, align 4
  %2443 = load i32, i32* %x530.addr, align 4
  %2444 = load i32, i32* %x527.addr, align 4
  %2445 = call i64 @p256FiatAddcarryxU32(i32 %2442, i32 %2443, i32 %2444)
  store i64 %2445, i64* %w535.addr, align 8
  %2446 = load i64, i64* %w535.addr, align 8
  %2447 = trunc i64 %2446 to i32
  store i32 %2447, i32* %x535.addr, align 4
  %2448 = load i64, i64* %w535.addr, align 8
  %2449 = lshr i64 %2448, 32
  %2450 = trunc i64 %2449 to i32
  store i32 %2450, i32* %x536.addr, align 4
  %2451 = load i32, i32* %x536.addr, align 4
  %2452 = load i32, i32* %x528.addr, align 4
  %2453 = add i32 %2451, %2452
  store i32 %2453, i32* %x537.addr, align 4
  %2454 = load i32, i32* %x507.addr, align 4
  %2455 = load i32, i32* %x531.addr, align 4
  %2456 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2454, i32 %2455)
  store i64 %2456, i64* %w538.addr, align 8
  %2457 = load i64, i64* %w538.addr, align 8
  %2458 = lshr i64 %2457, 32
  %2459 = trunc i64 %2458 to i32
  store i32 %2459, i32* %x539.addr, align 4
  %2460 = load i32, i32* %x539.addr, align 4
  %2461 = load i32, i32* %x509.addr, align 4
  %2462 = load i32, i32* %x533.addr, align 4
  %2463 = call i64 @p256FiatAddcarryxU32(i32 %2460, i32 %2461, i32 %2462)
  store i64 %2463, i64* %w540.addr, align 8
  %2464 = load i64, i64* %w540.addr, align 8
  %2465 = trunc i64 %2464 to i32
  store i32 %2465, i32* %x540.addr, align 4
  %2466 = load i64, i64* %w540.addr, align 8
  %2467 = lshr i64 %2466, 32
  %2468 = trunc i64 %2467 to i32
  store i32 %2468, i32* %x541.addr, align 4
  %2469 = load i32, i32* %x541.addr, align 4
  %2470 = load i32, i32* %x511.addr, align 4
  %2471 = load i32, i32* %x535.addr, align 4
  %2472 = call i64 @p256FiatAddcarryxU32(i32 %2469, i32 %2470, i32 %2471)
  store i64 %2472, i64* %w542.addr, align 8
  %2473 = load i64, i64* %w542.addr, align 8
  %2474 = trunc i64 %2473 to i32
  store i32 %2474, i32* %x542.addr, align 4
  %2475 = load i64, i64* %w542.addr, align 8
  %2476 = lshr i64 %2475, 32
  %2477 = trunc i64 %2476 to i32
  store i32 %2477, i32* %x543.addr, align 4
  %2478 = load i32, i32* %x543.addr, align 4
  %2479 = load i32, i32* %x513.addr, align 4
  %2480 = load i32, i32* %x537.addr, align 4
  %2481 = call i64 @p256FiatAddcarryxU32(i32 %2478, i32 %2479, i32 %2480)
  store i64 %2481, i64* %w544.addr, align 8
  %2482 = load i64, i64* %w544.addr, align 8
  %2483 = trunc i64 %2482 to i32
  store i32 %2483, i32* %x544.addr, align 4
  %2484 = load i64, i64* %w544.addr, align 8
  %2485 = lshr i64 %2484, 32
  %2486 = trunc i64 %2485 to i32
  store i32 %2486, i32* %x545.addr, align 4
  %2487 = load i32, i32* %x545.addr, align 4
  %2488 = load i32, i32* %x515.addr, align 4
  %2489 = call i64 @p256FiatAddcarryxU32(i32 %2487, i32 %2488, i32 0)
  store i64 %2489, i64* %w546.addr, align 8
  %2490 = load i64, i64* %w546.addr, align 8
  %2491 = trunc i64 %2490 to i32
  store i32 %2491, i32* %x546.addr, align 4
  %2492 = load i64, i64* %w546.addr, align 8
  %2493 = lshr i64 %2492, 32
  %2494 = trunc i64 %2493 to i32
  store i32 %2494, i32* %x547.addr, align 4
  %2495 = load i32, i32* %x547.addr, align 4
  %2496 = load i32, i32* %x517.addr, align 4
  %2497 = call i64 @p256FiatAddcarryxU32(i32 %2495, i32 %2496, i32 0)
  store i64 %2497, i64* %w548.addr, align 8
  %2498 = load i64, i64* %w548.addr, align 8
  %2499 = trunc i64 %2498 to i32
  store i32 %2499, i32* %x548.addr, align 4
  %2500 = load i64, i64* %w548.addr, align 8
  %2501 = lshr i64 %2500, 32
  %2502 = trunc i64 %2501 to i32
  store i32 %2502, i32* %x549.addr, align 4
  %2503 = load i32, i32* %x549.addr, align 4
  %2504 = load i32, i32* %x519.addr, align 4
  %2505 = load i32, i32* %x507.addr, align 4
  %2506 = call i64 @p256FiatAddcarryxU32(i32 %2503, i32 %2504, i32 %2505)
  store i64 %2506, i64* %w550.addr, align 8
  %2507 = load i64, i64* %w550.addr, align 8
  %2508 = trunc i64 %2507 to i32
  store i32 %2508, i32* %x550.addr, align 4
  %2509 = load i64, i64* %w550.addr, align 8
  %2510 = lshr i64 %2509, 32
  %2511 = trunc i64 %2510 to i32
  store i32 %2511, i32* %x551.addr, align 4
  %2512 = load i32, i32* %x551.addr, align 4
  %2513 = load i32, i32* %x521.addr, align 4
  %2514 = load i32, i32* %x525.addr, align 4
  %2515 = call i64 @p256FiatAddcarryxU32(i32 %2512, i32 %2513, i32 %2514)
  store i64 %2515, i64* %w552.addr, align 8
  %2516 = load i64, i64* %w552.addr, align 8
  %2517 = trunc i64 %2516 to i32
  store i32 %2517, i32* %x552.addr, align 4
  %2518 = load i64, i64* %w552.addr, align 8
  %2519 = lshr i64 %2518, 32
  %2520 = trunc i64 %2519 to i32
  store i32 %2520, i32* %x553.addr, align 4
  %2521 = load i32, i32* %x553.addr, align 4
  %2522 = load i32, i32* %x523.addr, align 4
  %2523 = load i32, i32* %x526.addr, align 4
  %2524 = call i64 @p256FiatAddcarryxU32(i32 %2521, i32 %2522, i32 %2523)
  store i64 %2524, i64* %w554.addr, align 8
  %2525 = load i64, i64* %w554.addr, align 8
  %2526 = trunc i64 %2525 to i32
  store i32 %2526, i32* %x554.addr, align 4
  %2527 = load i64, i64* %w554.addr, align 8
  %2528 = lshr i64 %2527, 32
  %2529 = trunc i64 %2528 to i32
  store i32 %2529, i32* %x555.addr, align 4
  %2530 = load i32, i32* %x555.addr, align 4
  %2531 = load i32, i32* %x524.addr, align 4
  %2532 = add i32 %2530, %2531
  store i32 %2532, i32* %x556.addr, align 4
  %2533 = load i32, i32* %x7.addr, align 4
  %2534 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2535 = load i8*, i8** %2534, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2536 = bitcast i8* %2535 to i32*
  %2537 = getelementptr inbounds i32, i32* %2536, i64 7
  %2538 = load i32, i32* %2537, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2539 = call i64 @p256FiatMulxU32(i32 %2533, i32 %2538)
  store i64 %2539, i64* %w557.addr, align 8
  %2540 = load i64, i64* %w557.addr, align 8
  %2541 = trunc i64 %2540 to i32
  store i32 %2541, i32* %x557.addr, align 4
  %2542 = load i64, i64* %w557.addr, align 8
  %2543 = lshr i64 %2542, 32
  %2544 = trunc i64 %2543 to i32
  store i32 %2544, i32* %x558.addr, align 4
  %2545 = load i32, i32* %x7.addr, align 4
  %2546 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2547 = load i8*, i8** %2546, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2548 = bitcast i8* %2547 to i32*
  %2549 = getelementptr inbounds i32, i32* %2548, i64 6
  %2550 = load i32, i32* %2549, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2551 = call i64 @p256FiatMulxU32(i32 %2545, i32 %2550)
  store i64 %2551, i64* %w559.addr, align 8
  %2552 = load i64, i64* %w559.addr, align 8
  %2553 = trunc i64 %2552 to i32
  store i32 %2553, i32* %x559.addr, align 4
  %2554 = load i64, i64* %w559.addr, align 8
  %2555 = lshr i64 %2554, 32
  %2556 = trunc i64 %2555 to i32
  store i32 %2556, i32* %x560.addr, align 4
  %2557 = load i32, i32* %x7.addr, align 4
  %2558 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2559 = load i8*, i8** %2558, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2560 = bitcast i8* %2559 to i32*
  %2561 = getelementptr inbounds i32, i32* %2560, i64 5
  %2562 = load i32, i32* %2561, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2563 = call i64 @p256FiatMulxU32(i32 %2557, i32 %2562)
  store i64 %2563, i64* %w561.addr, align 8
  %2564 = load i64, i64* %w561.addr, align 8
  %2565 = trunc i64 %2564 to i32
  store i32 %2565, i32* %x561.addr, align 4
  %2566 = load i64, i64* %w561.addr, align 8
  %2567 = lshr i64 %2566, 32
  %2568 = trunc i64 %2567 to i32
  store i32 %2568, i32* %x562.addr, align 4
  %2569 = load i32, i32* %x7.addr, align 4
  %2570 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2571 = load i8*, i8** %2570, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2572 = bitcast i8* %2571 to i32*
  %2573 = getelementptr inbounds i32, i32* %2572, i64 4
  %2574 = load i32, i32* %2573, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2575 = call i64 @p256FiatMulxU32(i32 %2569, i32 %2574)
  store i64 %2575, i64* %w563.addr, align 8
  %2576 = load i64, i64* %w563.addr, align 8
  %2577 = trunc i64 %2576 to i32
  store i32 %2577, i32* %x563.addr, align 4
  %2578 = load i64, i64* %w563.addr, align 8
  %2579 = lshr i64 %2578, 32
  %2580 = trunc i64 %2579 to i32
  store i32 %2580, i32* %x564.addr, align 4
  %2581 = load i32, i32* %x7.addr, align 4
  %2582 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2583 = load i8*, i8** %2582, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2584 = bitcast i8* %2583 to i32*
  %2585 = getelementptr inbounds i32, i32* %2584, i64 3
  %2586 = load i32, i32* %2585, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2587 = call i64 @p256FiatMulxU32(i32 %2581, i32 %2586)
  store i64 %2587, i64* %w565.addr, align 8
  %2588 = load i64, i64* %w565.addr, align 8
  %2589 = trunc i64 %2588 to i32
  store i32 %2589, i32* %x565.addr, align 4
  %2590 = load i64, i64* %w565.addr, align 8
  %2591 = lshr i64 %2590, 32
  %2592 = trunc i64 %2591 to i32
  store i32 %2592, i32* %x566.addr, align 4
  %2593 = load i32, i32* %x7.addr, align 4
  %2594 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2595 = load i8*, i8** %2594, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2596 = bitcast i8* %2595 to i32*
  %2597 = getelementptr inbounds i32, i32* %2596, i64 2
  %2598 = load i32, i32* %2597, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2599 = call i64 @p256FiatMulxU32(i32 %2593, i32 %2598)
  store i64 %2599, i64* %w567.addr, align 8
  %2600 = load i64, i64* %w567.addr, align 8
  %2601 = trunc i64 %2600 to i32
  store i32 %2601, i32* %x567.addr, align 4
  %2602 = load i64, i64* %w567.addr, align 8
  %2603 = lshr i64 %2602, 32
  %2604 = trunc i64 %2603 to i32
  store i32 %2604, i32* %x568.addr, align 4
  %2605 = load i32, i32* %x7.addr, align 4
  %2606 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2607 = load i8*, i8** %2606, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2608 = bitcast i8* %2607 to i32*
  %2609 = getelementptr inbounds i32, i32* %2608, i64 1
  %2610 = load i32, i32* %2609, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2611 = call i64 @p256FiatMulxU32(i32 %2605, i32 %2610)
  store i64 %2611, i64* %w569.addr, align 8
  %2612 = load i64, i64* %w569.addr, align 8
  %2613 = trunc i64 %2612 to i32
  store i32 %2613, i32* %x569.addr, align 4
  %2614 = load i64, i64* %w569.addr, align 8
  %2615 = lshr i64 %2614, 32
  %2616 = trunc i64 %2615 to i32
  store i32 %2616, i32* %x570.addr, align 4
  %2617 = load i32, i32* %x7.addr, align 4
  %2618 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2619 = load i8*, i8** %2618, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2620 = bitcast i8* %2619 to i32*
  %2621 = getelementptr inbounds i32, i32* %2620, i64 0
  %2622 = load i32, i32* %2621, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2623 = call i64 @p256FiatMulxU32(i32 %2617, i32 %2622)
  store i64 %2623, i64* %w571.addr, align 8
  %2624 = load i64, i64* %w571.addr, align 8
  %2625 = trunc i64 %2624 to i32
  store i32 %2625, i32* %x571.addr, align 4
  %2626 = load i64, i64* %w571.addr, align 8
  %2627 = lshr i64 %2626, 32
  %2628 = trunc i64 %2627 to i32
  store i32 %2628, i32* %x572.addr, align 4
  %2629 = load i32, i32* %x572.addr, align 4
  %2630 = load i32, i32* %x569.addr, align 4
  %2631 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2629, i32 %2630)
  store i64 %2631, i64* %w573.addr, align 8
  %2632 = load i64, i64* %w573.addr, align 8
  %2633 = trunc i64 %2632 to i32
  store i32 %2633, i32* %x573.addr, align 4
  %2634 = load i64, i64* %w573.addr, align 8
  %2635 = lshr i64 %2634, 32
  %2636 = trunc i64 %2635 to i32
  store i32 %2636, i32* %x574.addr, align 4
  %2637 = load i32, i32* %x574.addr, align 4
  %2638 = load i32, i32* %x570.addr, align 4
  %2639 = load i32, i32* %x567.addr, align 4
  %2640 = call i64 @p256FiatAddcarryxU32(i32 %2637, i32 %2638, i32 %2639)
  store i64 %2640, i64* %w575.addr, align 8
  %2641 = load i64, i64* %w575.addr, align 8
  %2642 = trunc i64 %2641 to i32
  store i32 %2642, i32* %x575.addr, align 4
  %2643 = load i64, i64* %w575.addr, align 8
  %2644 = lshr i64 %2643, 32
  %2645 = trunc i64 %2644 to i32
  store i32 %2645, i32* %x576.addr, align 4
  %2646 = load i32, i32* %x576.addr, align 4
  %2647 = load i32, i32* %x568.addr, align 4
  %2648 = load i32, i32* %x565.addr, align 4
  %2649 = call i64 @p256FiatAddcarryxU32(i32 %2646, i32 %2647, i32 %2648)
  store i64 %2649, i64* %w577.addr, align 8
  %2650 = load i64, i64* %w577.addr, align 8
  %2651 = trunc i64 %2650 to i32
  store i32 %2651, i32* %x577.addr, align 4
  %2652 = load i64, i64* %w577.addr, align 8
  %2653 = lshr i64 %2652, 32
  %2654 = trunc i64 %2653 to i32
  store i32 %2654, i32* %x578.addr, align 4
  %2655 = load i32, i32* %x578.addr, align 4
  %2656 = load i32, i32* %x566.addr, align 4
  %2657 = load i32, i32* %x563.addr, align 4
  %2658 = call i64 @p256FiatAddcarryxU32(i32 %2655, i32 %2656, i32 %2657)
  store i64 %2658, i64* %w579.addr, align 8
  %2659 = load i64, i64* %w579.addr, align 8
  %2660 = trunc i64 %2659 to i32
  store i32 %2660, i32* %x579.addr, align 4
  %2661 = load i64, i64* %w579.addr, align 8
  %2662 = lshr i64 %2661, 32
  %2663 = trunc i64 %2662 to i32
  store i32 %2663, i32* %x580.addr, align 4
  %2664 = load i32, i32* %x580.addr, align 4
  %2665 = load i32, i32* %x564.addr, align 4
  %2666 = load i32, i32* %x561.addr, align 4
  %2667 = call i64 @p256FiatAddcarryxU32(i32 %2664, i32 %2665, i32 %2666)
  store i64 %2667, i64* %w581.addr, align 8
  %2668 = load i64, i64* %w581.addr, align 8
  %2669 = trunc i64 %2668 to i32
  store i32 %2669, i32* %x581.addr, align 4
  %2670 = load i64, i64* %w581.addr, align 8
  %2671 = lshr i64 %2670, 32
  %2672 = trunc i64 %2671 to i32
  store i32 %2672, i32* %x582.addr, align 4
  %2673 = load i32, i32* %x582.addr, align 4
  %2674 = load i32, i32* %x562.addr, align 4
  %2675 = load i32, i32* %x559.addr, align 4
  %2676 = call i64 @p256FiatAddcarryxU32(i32 %2673, i32 %2674, i32 %2675)
  store i64 %2676, i64* %w583.addr, align 8
  %2677 = load i64, i64* %w583.addr, align 8
  %2678 = trunc i64 %2677 to i32
  store i32 %2678, i32* %x583.addr, align 4
  %2679 = load i64, i64* %w583.addr, align 8
  %2680 = lshr i64 %2679, 32
  %2681 = trunc i64 %2680 to i32
  store i32 %2681, i32* %x584.addr, align 4
  %2682 = load i32, i32* %x584.addr, align 4
  %2683 = load i32, i32* %x560.addr, align 4
  %2684 = load i32, i32* %x557.addr, align 4
  %2685 = call i64 @p256FiatAddcarryxU32(i32 %2682, i32 %2683, i32 %2684)
  store i64 %2685, i64* %w585.addr, align 8
  %2686 = load i64, i64* %w585.addr, align 8
  %2687 = trunc i64 %2686 to i32
  store i32 %2687, i32* %x585.addr, align 4
  %2688 = load i64, i64* %w585.addr, align 8
  %2689 = lshr i64 %2688, 32
  %2690 = trunc i64 %2689 to i32
  store i32 %2690, i32* %x586.addr, align 4
  %2691 = load i32, i32* %x586.addr, align 4
  %2692 = load i32, i32* %x558.addr, align 4
  %2693 = add i32 %2691, %2692
  store i32 %2693, i32* %x587.addr, align 4
  %2694 = load i32, i32* %x540.addr, align 4
  %2695 = load i32, i32* %x571.addr, align 4
  %2696 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2694, i32 %2695)
  store i64 %2696, i64* %w588.addr, align 8
  %2697 = load i64, i64* %w588.addr, align 8
  %2698 = trunc i64 %2697 to i32
  store i32 %2698, i32* %x588.addr, align 4
  %2699 = load i64, i64* %w588.addr, align 8
  %2700 = lshr i64 %2699, 32
  %2701 = trunc i64 %2700 to i32
  store i32 %2701, i32* %x589.addr, align 4
  %2702 = load i32, i32* %x589.addr, align 4
  %2703 = load i32, i32* %x542.addr, align 4
  %2704 = load i32, i32* %x573.addr, align 4
  %2705 = call i64 @p256FiatAddcarryxU32(i32 %2702, i32 %2703, i32 %2704)
  store i64 %2705, i64* %w590.addr, align 8
  %2706 = load i64, i64* %w590.addr, align 8
  %2707 = trunc i64 %2706 to i32
  store i32 %2707, i32* %x590.addr, align 4
  %2708 = load i64, i64* %w590.addr, align 8
  %2709 = lshr i64 %2708, 32
  %2710 = trunc i64 %2709 to i32
  store i32 %2710, i32* %x591.addr, align 4
  %2711 = load i32, i32* %x591.addr, align 4
  %2712 = load i32, i32* %x544.addr, align 4
  %2713 = load i32, i32* %x575.addr, align 4
  %2714 = call i64 @p256FiatAddcarryxU32(i32 %2711, i32 %2712, i32 %2713)
  store i64 %2714, i64* %w592.addr, align 8
  %2715 = load i64, i64* %w592.addr, align 8
  %2716 = trunc i64 %2715 to i32
  store i32 %2716, i32* %x592.addr, align 4
  %2717 = load i64, i64* %w592.addr, align 8
  %2718 = lshr i64 %2717, 32
  %2719 = trunc i64 %2718 to i32
  store i32 %2719, i32* %x593.addr, align 4
  %2720 = load i32, i32* %x593.addr, align 4
  %2721 = load i32, i32* %x546.addr, align 4
  %2722 = load i32, i32* %x577.addr, align 4
  %2723 = call i64 @p256FiatAddcarryxU32(i32 %2720, i32 %2721, i32 %2722)
  store i64 %2723, i64* %w594.addr, align 8
  %2724 = load i64, i64* %w594.addr, align 8
  %2725 = trunc i64 %2724 to i32
  store i32 %2725, i32* %x594.addr, align 4
  %2726 = load i64, i64* %w594.addr, align 8
  %2727 = lshr i64 %2726, 32
  %2728 = trunc i64 %2727 to i32
  store i32 %2728, i32* %x595.addr, align 4
  %2729 = load i32, i32* %x595.addr, align 4
  %2730 = load i32, i32* %x548.addr, align 4
  %2731 = load i32, i32* %x579.addr, align 4
  %2732 = call i64 @p256FiatAddcarryxU32(i32 %2729, i32 %2730, i32 %2731)
  store i64 %2732, i64* %w596.addr, align 8
  %2733 = load i64, i64* %w596.addr, align 8
  %2734 = trunc i64 %2733 to i32
  store i32 %2734, i32* %x596.addr, align 4
  %2735 = load i64, i64* %w596.addr, align 8
  %2736 = lshr i64 %2735, 32
  %2737 = trunc i64 %2736 to i32
  store i32 %2737, i32* %x597.addr, align 4
  %2738 = load i32, i32* %x597.addr, align 4
  %2739 = load i32, i32* %x550.addr, align 4
  %2740 = load i32, i32* %x581.addr, align 4
  %2741 = call i64 @p256FiatAddcarryxU32(i32 %2738, i32 %2739, i32 %2740)
  store i64 %2741, i64* %w598.addr, align 8
  %2742 = load i64, i64* %w598.addr, align 8
  %2743 = trunc i64 %2742 to i32
  store i32 %2743, i32* %x598.addr, align 4
  %2744 = load i64, i64* %w598.addr, align 8
  %2745 = lshr i64 %2744, 32
  %2746 = trunc i64 %2745 to i32
  store i32 %2746, i32* %x599.addr, align 4
  %2747 = load i32, i32* %x599.addr, align 4
  %2748 = load i32, i32* %x552.addr, align 4
  %2749 = load i32, i32* %x583.addr, align 4
  %2750 = call i64 @p256FiatAddcarryxU32(i32 %2747, i32 %2748, i32 %2749)
  store i64 %2750, i64* %w600.addr, align 8
  %2751 = load i64, i64* %w600.addr, align 8
  %2752 = trunc i64 %2751 to i32
  store i32 %2752, i32* %x600.addr, align 4
  %2753 = load i64, i64* %w600.addr, align 8
  %2754 = lshr i64 %2753, 32
  %2755 = trunc i64 %2754 to i32
  store i32 %2755, i32* %x601.addr, align 4
  %2756 = load i32, i32* %x601.addr, align 4
  %2757 = load i32, i32* %x554.addr, align 4
  %2758 = load i32, i32* %x585.addr, align 4
  %2759 = call i64 @p256FiatAddcarryxU32(i32 %2756, i32 %2757, i32 %2758)
  store i64 %2759, i64* %w602.addr, align 8
  %2760 = load i64, i64* %w602.addr, align 8
  %2761 = trunc i64 %2760 to i32
  store i32 %2761, i32* %x602.addr, align 4
  %2762 = load i64, i64* %w602.addr, align 8
  %2763 = lshr i64 %2762, 32
  %2764 = trunc i64 %2763 to i32
  store i32 %2764, i32* %x603.addr, align 4
  %2765 = load i32, i32* %x603.addr, align 4
  %2766 = load i32, i32* %x556.addr, align 4
  %2767 = load i32, i32* %x587.addr, align 4
  %2768 = call i64 @p256FiatAddcarryxU32(i32 %2765, i32 %2766, i32 %2767)
  store i64 %2768, i64* %w604.addr, align 8
  %2769 = load i64, i64* %w604.addr, align 8
  %2770 = trunc i64 %2769 to i32
  store i32 %2770, i32* %x604.addr, align 4
  %2771 = load i64, i64* %w604.addr, align 8
  %2772 = lshr i64 %2771, 32
  %2773 = trunc i64 %2772 to i32
  store i32 %2773, i32* %x605.addr, align 4
  %2774 = load i32, i32* %x588.addr, align 4
  %2775 = call i64 @p256FiatMulxU32(i32 %2774, i32 4294967295)
  store i64 %2775, i64* %w606.addr, align 8
  %2776 = load i64, i64* %w606.addr, align 8
  %2777 = trunc i64 %2776 to i32
  store i32 %2777, i32* %x606.addr, align 4
  %2778 = load i64, i64* %w606.addr, align 8
  %2779 = lshr i64 %2778, 32
  %2780 = trunc i64 %2779 to i32
  store i32 %2780, i32* %x607.addr, align 4
  %2781 = load i32, i32* %x588.addr, align 4
  %2782 = call i64 @p256FiatMulxU32(i32 %2781, i32 4294967295)
  store i64 %2782, i64* %w608.addr, align 8
  %2783 = load i64, i64* %w608.addr, align 8
  %2784 = trunc i64 %2783 to i32
  store i32 %2784, i32* %x608.addr, align 4
  %2785 = load i64, i64* %w608.addr, align 8
  %2786 = lshr i64 %2785, 32
  %2787 = trunc i64 %2786 to i32
  store i32 %2787, i32* %x609.addr, align 4
  %2788 = load i32, i32* %x588.addr, align 4
  %2789 = call i64 @p256FiatMulxU32(i32 %2788, i32 4294967295)
  store i64 %2789, i64* %w610.addr, align 8
  %2790 = load i64, i64* %w610.addr, align 8
  %2791 = trunc i64 %2790 to i32
  store i32 %2791, i32* %x610.addr, align 4
  %2792 = load i64, i64* %w610.addr, align 8
  %2793 = lshr i64 %2792, 32
  %2794 = trunc i64 %2793 to i32
  store i32 %2794, i32* %x611.addr, align 4
  %2795 = load i32, i32* %x588.addr, align 4
  %2796 = call i64 @p256FiatMulxU32(i32 %2795, i32 4294967295)
  store i64 %2796, i64* %w612.addr, align 8
  %2797 = load i64, i64* %w612.addr, align 8
  %2798 = trunc i64 %2797 to i32
  store i32 %2798, i32* %x612.addr, align 4
  %2799 = load i64, i64* %w612.addr, align 8
  %2800 = lshr i64 %2799, 32
  %2801 = trunc i64 %2800 to i32
  store i32 %2801, i32* %x613.addr, align 4
  %2802 = load i32, i32* %x613.addr, align 4
  %2803 = load i32, i32* %x610.addr, align 4
  %2804 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2802, i32 %2803)
  store i64 %2804, i64* %w614.addr, align 8
  %2805 = load i64, i64* %w614.addr, align 8
  %2806 = trunc i64 %2805 to i32
  store i32 %2806, i32* %x614.addr, align 4
  %2807 = load i64, i64* %w614.addr, align 8
  %2808 = lshr i64 %2807, 32
  %2809 = trunc i64 %2808 to i32
  store i32 %2809, i32* %x615.addr, align 4
  %2810 = load i32, i32* %x615.addr, align 4
  %2811 = load i32, i32* %x611.addr, align 4
  %2812 = load i32, i32* %x608.addr, align 4
  %2813 = call i64 @p256FiatAddcarryxU32(i32 %2810, i32 %2811, i32 %2812)
  store i64 %2813, i64* %w616.addr, align 8
  %2814 = load i64, i64* %w616.addr, align 8
  %2815 = trunc i64 %2814 to i32
  store i32 %2815, i32* %x616.addr, align 4
  %2816 = load i64, i64* %w616.addr, align 8
  %2817 = lshr i64 %2816, 32
  %2818 = trunc i64 %2817 to i32
  store i32 %2818, i32* %x617.addr, align 4
  %2819 = load i32, i32* %x617.addr, align 4
  %2820 = load i32, i32* %x609.addr, align 4
  %2821 = add i32 %2819, %2820
  store i32 %2821, i32* %x618.addr, align 4
  %2822 = load i32, i32* %x588.addr, align 4
  %2823 = load i32, i32* %x612.addr, align 4
  %2824 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2822, i32 %2823)
  store i64 %2824, i64* %w619.addr, align 8
  %2825 = load i64, i64* %w619.addr, align 8
  %2826 = lshr i64 %2825, 32
  %2827 = trunc i64 %2826 to i32
  store i32 %2827, i32* %x620.addr, align 4
  %2828 = load i32, i32* %x620.addr, align 4
  %2829 = load i32, i32* %x590.addr, align 4
  %2830 = load i32, i32* %x614.addr, align 4
  %2831 = call i64 @p256FiatAddcarryxU32(i32 %2828, i32 %2829, i32 %2830)
  store i64 %2831, i64* %w621.addr, align 8
  %2832 = load i64, i64* %w621.addr, align 8
  %2833 = trunc i64 %2832 to i32
  store i32 %2833, i32* %x621.addr, align 4
  %2834 = load i64, i64* %w621.addr, align 8
  %2835 = lshr i64 %2834, 32
  %2836 = trunc i64 %2835 to i32
  store i32 %2836, i32* %x622.addr, align 4
  %2837 = load i32, i32* %x622.addr, align 4
  %2838 = load i32, i32* %x592.addr, align 4
  %2839 = load i32, i32* %x616.addr, align 4
  %2840 = call i64 @p256FiatAddcarryxU32(i32 %2837, i32 %2838, i32 %2839)
  store i64 %2840, i64* %w623.addr, align 8
  %2841 = load i64, i64* %w623.addr, align 8
  %2842 = trunc i64 %2841 to i32
  store i32 %2842, i32* %x623.addr, align 4
  %2843 = load i64, i64* %w623.addr, align 8
  %2844 = lshr i64 %2843, 32
  %2845 = trunc i64 %2844 to i32
  store i32 %2845, i32* %x624.addr, align 4
  %2846 = load i32, i32* %x624.addr, align 4
  %2847 = load i32, i32* %x594.addr, align 4
  %2848 = load i32, i32* %x618.addr, align 4
  %2849 = call i64 @p256FiatAddcarryxU32(i32 %2846, i32 %2847, i32 %2848)
  store i64 %2849, i64* %w625.addr, align 8
  %2850 = load i64, i64* %w625.addr, align 8
  %2851 = trunc i64 %2850 to i32
  store i32 %2851, i32* %x625.addr, align 4
  %2852 = load i64, i64* %w625.addr, align 8
  %2853 = lshr i64 %2852, 32
  %2854 = trunc i64 %2853 to i32
  store i32 %2854, i32* %x626.addr, align 4
  %2855 = load i32, i32* %x626.addr, align 4
  %2856 = load i32, i32* %x596.addr, align 4
  %2857 = call i64 @p256FiatAddcarryxU32(i32 %2855, i32 %2856, i32 0)
  store i64 %2857, i64* %w627.addr, align 8
  %2858 = load i64, i64* %w627.addr, align 8
  %2859 = trunc i64 %2858 to i32
  store i32 %2859, i32* %x627.addr, align 4
  %2860 = load i64, i64* %w627.addr, align 8
  %2861 = lshr i64 %2860, 32
  %2862 = trunc i64 %2861 to i32
  store i32 %2862, i32* %x628.addr, align 4
  %2863 = load i32, i32* %x628.addr, align 4
  %2864 = load i32, i32* %x598.addr, align 4
  %2865 = call i64 @p256FiatAddcarryxU32(i32 %2863, i32 %2864, i32 0)
  store i64 %2865, i64* %w629.addr, align 8
  %2866 = load i64, i64* %w629.addr, align 8
  %2867 = trunc i64 %2866 to i32
  store i32 %2867, i32* %x629.addr, align 4
  %2868 = load i64, i64* %w629.addr, align 8
  %2869 = lshr i64 %2868, 32
  %2870 = trunc i64 %2869 to i32
  store i32 %2870, i32* %x630.addr, align 4
  %2871 = load i32, i32* %x630.addr, align 4
  %2872 = load i32, i32* %x600.addr, align 4
  %2873 = load i32, i32* %x588.addr, align 4
  %2874 = call i64 @p256FiatAddcarryxU32(i32 %2871, i32 %2872, i32 %2873)
  store i64 %2874, i64* %w631.addr, align 8
  %2875 = load i64, i64* %w631.addr, align 8
  %2876 = trunc i64 %2875 to i32
  store i32 %2876, i32* %x631.addr, align 4
  %2877 = load i64, i64* %w631.addr, align 8
  %2878 = lshr i64 %2877, 32
  %2879 = trunc i64 %2878 to i32
  store i32 %2879, i32* %x632.addr, align 4
  %2880 = load i32, i32* %x632.addr, align 4
  %2881 = load i32, i32* %x602.addr, align 4
  %2882 = load i32, i32* %x606.addr, align 4
  %2883 = call i64 @p256FiatAddcarryxU32(i32 %2880, i32 %2881, i32 %2882)
  store i64 %2883, i64* %w633.addr, align 8
  %2884 = load i64, i64* %w633.addr, align 8
  %2885 = trunc i64 %2884 to i32
  store i32 %2885, i32* %x633.addr, align 4
  %2886 = load i64, i64* %w633.addr, align 8
  %2887 = lshr i64 %2886, 32
  %2888 = trunc i64 %2887 to i32
  store i32 %2888, i32* %x634.addr, align 4
  %2889 = load i32, i32* %x634.addr, align 4
  %2890 = load i32, i32* %x604.addr, align 4
  %2891 = load i32, i32* %x607.addr, align 4
  %2892 = call i64 @p256FiatAddcarryxU32(i32 %2889, i32 %2890, i32 %2891)
  store i64 %2892, i64* %w635.addr, align 8
  %2893 = load i64, i64* %w635.addr, align 8
  %2894 = trunc i64 %2893 to i32
  store i32 %2894, i32* %x635.addr, align 4
  %2895 = load i64, i64* %w635.addr, align 8
  %2896 = lshr i64 %2895, 32
  %2897 = trunc i64 %2896 to i32
  store i32 %2897, i32* %x636.addr, align 4
  %2898 = load i32, i32* %x636.addr, align 4
  %2899 = load i32, i32* %x605.addr, align 4
  %2900 = add i32 %2898, %2899
  store i32 %2900, i32* %x637.addr, align 4
  %2901 = load i32, i32* %x621.addr, align 4
  %2902 = call i64 @p256FiatSubborrowxU32(i32 0, i32 %2901, i32 4294967295)
  store i64 %2902, i64* %w638.addr, align 8
  %2903 = load i64, i64* %w638.addr, align 8
  %2904 = trunc i64 %2903 to i32
  store i32 %2904, i32* %x638.addr, align 4
  %2905 = load i64, i64* %w638.addr, align 8
  %2906 = lshr i64 %2905, 32
  %2907 = trunc i64 %2906 to i32
  store i32 %2907, i32* %x639.addr, align 4
  %2908 = load i32, i32* %x639.addr, align 4
  %2909 = load i32, i32* %x623.addr, align 4
  %2910 = call i64 @p256FiatSubborrowxU32(i32 %2908, i32 %2909, i32 4294967295)
  store i64 %2910, i64* %w640.addr, align 8
  %2911 = load i64, i64* %w640.addr, align 8
  %2912 = trunc i64 %2911 to i32
  store i32 %2912, i32* %x640.addr, align 4
  %2913 = load i64, i64* %w640.addr, align 8
  %2914 = lshr i64 %2913, 32
  %2915 = trunc i64 %2914 to i32
  store i32 %2915, i32* %x641.addr, align 4
  %2916 = load i32, i32* %x641.addr, align 4
  %2917 = load i32, i32* %x625.addr, align 4
  %2918 = call i64 @p256FiatSubborrowxU32(i32 %2916, i32 %2917, i32 4294967295)
  store i64 %2918, i64* %w642.addr, align 8
  %2919 = load i64, i64* %w642.addr, align 8
  %2920 = trunc i64 %2919 to i32
  store i32 %2920, i32* %x642.addr, align 4
  %2921 = load i64, i64* %w642.addr, align 8
  %2922 = lshr i64 %2921, 32
  %2923 = trunc i64 %2922 to i32
  store i32 %2923, i32* %x643.addr, align 4
  %2924 = load i32, i32* %x643.addr, align 4
  %2925 = load i32, i32* %x627.addr, align 4
  %2926 = call i64 @p256FiatSubborrowxU32(i32 %2924, i32 %2925, i32 0)
  store i64 %2926, i64* %w644.addr, align 8
  %2927 = load i64, i64* %w644.addr, align 8
  %2928 = trunc i64 %2927 to i32
  store i32 %2928, i32* %x644.addr, align 4
  %2929 = load i64, i64* %w644.addr, align 8
  %2930 = lshr i64 %2929, 32
  %2931 = trunc i64 %2930 to i32
  store i32 %2931, i32* %x645.addr, align 4
  %2932 = load i32, i32* %x645.addr, align 4
  %2933 = load i32, i32* %x629.addr, align 4
  %2934 = call i64 @p256FiatSubborrowxU32(i32 %2932, i32 %2933, i32 0)
  store i64 %2934, i64* %w646.addr, align 8
  %2935 = load i64, i64* %w646.addr, align 8
  %2936 = trunc i64 %2935 to i32
  store i32 %2936, i32* %x646.addr, align 4
  %2937 = load i64, i64* %w646.addr, align 8
  %2938 = lshr i64 %2937, 32
  %2939 = trunc i64 %2938 to i32
  store i32 %2939, i32* %x647.addr, align 4
  %2940 = load i32, i32* %x647.addr, align 4
  %2941 = load i32, i32* %x631.addr, align 4
  %2942 = call i64 @p256FiatSubborrowxU32(i32 %2940, i32 %2941, i32 0)
  store i64 %2942, i64* %w648.addr, align 8
  %2943 = load i64, i64* %w648.addr, align 8
  %2944 = trunc i64 %2943 to i32
  store i32 %2944, i32* %x648.addr, align 4
  %2945 = load i64, i64* %w648.addr, align 8
  %2946 = lshr i64 %2945, 32
  %2947 = trunc i64 %2946 to i32
  store i32 %2947, i32* %x649.addr, align 4
  %2948 = load i32, i32* %x649.addr, align 4
  %2949 = load i32, i32* %x633.addr, align 4
  %2950 = call i64 @p256FiatSubborrowxU32(i32 %2948, i32 %2949, i32 1)
  store i64 %2950, i64* %w650.addr, align 8
  %2951 = load i64, i64* %w650.addr, align 8
  %2952 = trunc i64 %2951 to i32
  store i32 %2952, i32* %x650.addr, align 4
  %2953 = load i64, i64* %w650.addr, align 8
  %2954 = lshr i64 %2953, 32
  %2955 = trunc i64 %2954 to i32
  store i32 %2955, i32* %x651.addr, align 4
  %2956 = load i32, i32* %x651.addr, align 4
  %2957 = load i32, i32* %x635.addr, align 4
  %2958 = call i64 @p256FiatSubborrowxU32(i32 %2956, i32 %2957, i32 4294967295)
  store i64 %2958, i64* %w652.addr, align 8
  %2959 = load i64, i64* %w652.addr, align 8
  %2960 = trunc i64 %2959 to i32
  store i32 %2960, i32* %x652.addr, align 4
  %2961 = load i64, i64* %w652.addr, align 8
  %2962 = lshr i64 %2961, 32
  %2963 = trunc i64 %2962 to i32
  store i32 %2963, i32* %x653.addr, align 4
  %2964 = load i32, i32* %x653.addr, align 4
  %2965 = load i32, i32* %x637.addr, align 4
  %2966 = call i64 @p256FiatSubborrowxU32(i32 %2964, i32 %2965, i32 0)
  store i64 %2966, i64* %w654.addr, align 8
  %2967 = load i64, i64* %w654.addr, align 8
  %2968 = lshr i64 %2967, 32
  %2969 = trunc i64 %2968 to i32
  store i32 %2969, i32* %x655.addr, align 4
  %2970 = load i32, i32* %x655.addr, align 4
  %2971 = load i32, i32* %x638.addr, align 4
  %2972 = load i32, i32* %x621.addr, align 4
  %2973 = call i32 @p256FiatCmovznzU32(i32 %2970, i32 %2971, i32 %2972)
  store i32 %2973, i32* %x656.addr, align 4
  %2974 = load i32, i32* %x655.addr, align 4
  %2975 = load i32, i32* %x640.addr, align 4
  %2976 = load i32, i32* %x623.addr, align 4
  %2977 = call i32 @p256FiatCmovznzU32(i32 %2974, i32 %2975, i32 %2976)
  store i32 %2977, i32* %x657.addr, align 4
  %2978 = load i32, i32* %x655.addr, align 4
  %2979 = load i32, i32* %x642.addr, align 4
  %2980 = load i32, i32* %x625.addr, align 4
  %2981 = call i32 @p256FiatCmovznzU32(i32 %2978, i32 %2979, i32 %2980)
  store i32 %2981, i32* %x658.addr, align 4
  %2982 = load i32, i32* %x655.addr, align 4
  %2983 = load i32, i32* %x644.addr, align 4
  %2984 = load i32, i32* %x627.addr, align 4
  %2985 = call i32 @p256FiatCmovznzU32(i32 %2982, i32 %2983, i32 %2984)
  store i32 %2985, i32* %x659.addr, align 4
  %2986 = load i32, i32* %x655.addr, align 4
  %2987 = load i32, i32* %x646.addr, align 4
  %2988 = load i32, i32* %x629.addr, align 4
  %2989 = call i32 @p256FiatCmovznzU32(i32 %2986, i32 %2987, i32 %2988)
  store i32 %2989, i32* %x660.addr, align 4
  %2990 = load i32, i32* %x655.addr, align 4
  %2991 = load i32, i32* %x648.addr, align 4
  %2992 = load i32, i32* %x631.addr, align 4
  %2993 = call i32 @p256FiatCmovznzU32(i32 %2990, i32 %2991, i32 %2992)
  store i32 %2993, i32* %x661.addr, align 4
  %2994 = load i32, i32* %x655.addr, align 4
  %2995 = load i32, i32* %x650.addr, align 4
  %2996 = load i32, i32* %x633.addr, align 4
  %2997 = call i32 @p256FiatCmovznzU32(i32 %2994, i32 %2995, i32 %2996)
  store i32 %2997, i32* %x662.addr, align 4
  %2998 = load i32, i32* %x655.addr, align 4
  %2999 = load i32, i32* %x652.addr, align 4
  %3000 = load i32, i32* %x635.addr, align 4
  %3001 = call i32 @p256FiatCmovznzU32(i32 %2998, i32 %2999, i32 %3000)
  store i32 %3001, i32* %x663.addr, align 4
  %3002 = load i32, i32* %x656.addr, align 4
  %3003 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3004 = load i8*, i8** %3003, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3005 = bitcast i8* %3004 to i32*
  %3006 = getelementptr inbounds i32, i32* %3005, i64 0
  store i32 %3002, i32* %3006, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3007 = load i32, i32* %x657.addr, align 4
  %3008 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3009 = load i8*, i8** %3008, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3010 = bitcast i8* %3009 to i32*
  %3011 = getelementptr inbounds i32, i32* %3010, i64 1
  store i32 %3007, i32* %3011, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3012 = load i32, i32* %x658.addr, align 4
  %3013 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3014 = load i8*, i8** %3013, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3015 = bitcast i8* %3014 to i32*
  %3016 = getelementptr inbounds i32, i32* %3015, i64 2
  store i32 %3012, i32* %3016, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3017 = load i32, i32* %x659.addr, align 4
  %3018 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3019 = load i8*, i8** %3018, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3020 = bitcast i8* %3019 to i32*
  %3021 = getelementptr inbounds i32, i32* %3020, i64 3
  store i32 %3017, i32* %3021, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3022 = load i32, i32* %x660.addr, align 4
  %3023 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3024 = load i8*, i8** %3023, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3025 = bitcast i8* %3024 to i32*
  %3026 = getelementptr inbounds i32, i32* %3025, i64 4
  store i32 %3022, i32* %3026, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3027 = load i32, i32* %x661.addr, align 4
  %3028 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3029 = load i8*, i8** %3028, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3030 = bitcast i8* %3029 to i32*
  %3031 = getelementptr inbounds i32, i32* %3030, i64 5
  store i32 %3027, i32* %3031, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3032 = load i32, i32* %x662.addr, align 4
  %3033 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3034 = load i8*, i8** %3033, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3035 = bitcast i8* %3034 to i32*
  %3036 = getelementptr inbounds i32, i32* %3035, i64 6
  store i32 %3032, i32* %3036, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3037 = load i32, i32* %x663.addr, align 4
  %3038 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3039 = load i8*, i8** %3038, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3040 = bitcast i8* %3039 to i32*
  %3041 = getelementptr inbounds i32, i32* %3040, i64 7
  store i32 %3037, i32* %3041, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define void @p256FiatSquare(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg1) #1 {
entry:
  %arg1Limb0.addr = alloca i32, align 4
  %arg1Limb1.addr = alloca i32, align 4
  %arg1Limb2.addr = alloca i32, align 4
  %arg1Limb3.addr = alloca i32, align 4
  %arg1Limb4.addr = alloca i32, align 4
  %arg1Limb5.addr = alloca i32, align 4
  %arg1Limb6.addr = alloca i32, align 4
  %arg1Limb7.addr = alloca i32, align 4
  %x1.addr = alloca i32, align 4
  %x2.addr = alloca i32, align 4
  %x3.addr = alloca i32, align 4
  %x4.addr = alloca i32, align 4
  %x5.addr = alloca i32, align 4
  %x6.addr = alloca i32, align 4
  %x7.addr = alloca i32, align 4
  %x8.addr = alloca i32, align 4
  %w9.addr = alloca i64, align 8
  %x9.addr = alloca i32, align 4
  %x10.addr = alloca i32, align 4
  %w11.addr = alloca i64, align 8
  %x11.addr = alloca i32, align 4
  %x12.addr = alloca i32, align 4
  %w13.addr = alloca i64, align 8
  %x13.addr = alloca i32, align 4
  %x14.addr = alloca i32, align 4
  %w15.addr = alloca i64, align 8
  %x15.addr = alloca i32, align 4
  %x16.addr = alloca i32, align 4
  %w17.addr = alloca i64, align 8
  %x17.addr = alloca i32, align 4
  %x18.addr = alloca i32, align 4
  %w19.addr = alloca i64, align 8
  %x19.addr = alloca i32, align 4
  %x20.addr = alloca i32, align 4
  %w21.addr = alloca i64, align 8
  %x21.addr = alloca i32, align 4
  %x22.addr = alloca i32, align 4
  %w23.addr = alloca i64, align 8
  %x23.addr = alloca i32, align 4
  %x24.addr = alloca i32, align 4
  %w25.addr = alloca i64, align 8
  %x25.addr = alloca i32, align 4
  %x26.addr = alloca i32, align 4
  %w27.addr = alloca i64, align 8
  %x27.addr = alloca i32, align 4
  %x28.addr = alloca i32, align 4
  %w29.addr = alloca i64, align 8
  %x29.addr = alloca i32, align 4
  %x30.addr = alloca i32, align 4
  %w31.addr = alloca i64, align 8
  %x31.addr = alloca i32, align 4
  %x32.addr = alloca i32, align 4
  %w33.addr = alloca i64, align 8
  %x33.addr = alloca i32, align 4
  %x34.addr = alloca i32, align 4
  %w35.addr = alloca i64, align 8
  %x35.addr = alloca i32, align 4
  %x36.addr = alloca i32, align 4
  %w37.addr = alloca i64, align 8
  %x37.addr = alloca i32, align 4
  %x38.addr = alloca i32, align 4
  %x39.addr = alloca i32, align 4
  %w40.addr = alloca i64, align 8
  %x40.addr = alloca i32, align 4
  %x41.addr = alloca i32, align 4
  %w42.addr = alloca i64, align 8
  %x42.addr = alloca i32, align 4
  %x43.addr = alloca i32, align 4
  %w44.addr = alloca i64, align 8
  %x44.addr = alloca i32, align 4
  %x45.addr = alloca i32, align 4
  %w46.addr = alloca i64, align 8
  %x46.addr = alloca i32, align 4
  %x47.addr = alloca i32, align 4
  %w48.addr = alloca i64, align 8
  %x48.addr = alloca i32, align 4
  %x49.addr = alloca i32, align 4
  %w50.addr = alloca i64, align 8
  %x50.addr = alloca i32, align 4
  %x51.addr = alloca i32, align 4
  %x52.addr = alloca i32, align 4
  %w53.addr = alloca i64, align 8
  %x54.addr = alloca i32, align 4
  %w55.addr = alloca i64, align 8
  %x55.addr = alloca i32, align 4
  %x56.addr = alloca i32, align 4
  %w57.addr = alloca i64, align 8
  %x57.addr = alloca i32, align 4
  %x58.addr = alloca i32, align 4
  %w59.addr = alloca i64, align 8
  %x59.addr = alloca i32, align 4
  %x60.addr = alloca i32, align 4
  %w61.addr = alloca i64, align 8
  %x61.addr = alloca i32, align 4
  %x62.addr = alloca i32, align 4
  %w63.addr = alloca i64, align 8
  %x63.addr = alloca i32, align 4
  %x64.addr = alloca i32, align 4
  %w65.addr = alloca i64, align 8
  %x65.addr = alloca i32, align 4
  %x66.addr = alloca i32, align 4
  %w67.addr = alloca i64, align 8
  %x67.addr = alloca i32, align 4
  %x68.addr = alloca i32, align 4
  %w69.addr = alloca i64, align 8
  %x69.addr = alloca i32, align 4
  %x70.addr = alloca i32, align 4
  %w71.addr = alloca i64, align 8
  %x71.addr = alloca i32, align 4
  %x72.addr = alloca i32, align 4
  %w73.addr = alloca i64, align 8
  %x73.addr = alloca i32, align 4
  %x74.addr = alloca i32, align 4
  %w75.addr = alloca i64, align 8
  %x75.addr = alloca i32, align 4
  %x76.addr = alloca i32, align 4
  %w77.addr = alloca i64, align 8
  %x77.addr = alloca i32, align 4
  %x78.addr = alloca i32, align 4
  %w79.addr = alloca i64, align 8
  %x79.addr = alloca i32, align 4
  %x80.addr = alloca i32, align 4
  %w81.addr = alloca i64, align 8
  %x81.addr = alloca i32, align 4
  %x82.addr = alloca i32, align 4
  %w83.addr = alloca i64, align 8
  %x83.addr = alloca i32, align 4
  %x84.addr = alloca i32, align 4
  %w85.addr = alloca i64, align 8
  %x85.addr = alloca i32, align 4
  %x86.addr = alloca i32, align 4
  %w87.addr = alloca i64, align 8
  %x87.addr = alloca i32, align 4
  %x88.addr = alloca i32, align 4
  %w89.addr = alloca i64, align 8
  %x89.addr = alloca i32, align 4
  %x90.addr = alloca i32, align 4
  %w91.addr = alloca i64, align 8
  %x91.addr = alloca i32, align 4
  %x92.addr = alloca i32, align 4
  %w93.addr = alloca i64, align 8
  %x93.addr = alloca i32, align 4
  %x94.addr = alloca i32, align 4
  %w95.addr = alloca i64, align 8
  %x95.addr = alloca i32, align 4
  %x96.addr = alloca i32, align 4
  %w97.addr = alloca i64, align 8
  %x97.addr = alloca i32, align 4
  %x98.addr = alloca i32, align 4
  %w99.addr = alloca i64, align 8
  %x99.addr = alloca i32, align 4
  %x100.addr = alloca i32, align 4
  %x101.addr = alloca i32, align 4
  %w102.addr = alloca i64, align 8
  %x102.addr = alloca i32, align 4
  %x103.addr = alloca i32, align 4
  %w104.addr = alloca i64, align 8
  %x104.addr = alloca i32, align 4
  %x105.addr = alloca i32, align 4
  %w106.addr = alloca i64, align 8
  %x106.addr = alloca i32, align 4
  %x107.addr = alloca i32, align 4
  %w108.addr = alloca i64, align 8
  %x108.addr = alloca i32, align 4
  %x109.addr = alloca i32, align 4
  %w110.addr = alloca i64, align 8
  %x110.addr = alloca i32, align 4
  %x111.addr = alloca i32, align 4
  %w112.addr = alloca i64, align 8
  %x112.addr = alloca i32, align 4
  %x113.addr = alloca i32, align 4
  %w114.addr = alloca i64, align 8
  %x114.addr = alloca i32, align 4
  %x115.addr = alloca i32, align 4
  %w116.addr = alloca i64, align 8
  %x116.addr = alloca i32, align 4
  %x117.addr = alloca i32, align 4
  %w118.addr = alloca i64, align 8
  %x118.addr = alloca i32, align 4
  %x119.addr = alloca i32, align 4
  %w120.addr = alloca i64, align 8
  %x120.addr = alloca i32, align 4
  %x121.addr = alloca i32, align 4
  %w122.addr = alloca i64, align 8
  %x122.addr = alloca i32, align 4
  %x123.addr = alloca i32, align 4
  %w124.addr = alloca i64, align 8
  %x124.addr = alloca i32, align 4
  %x125.addr = alloca i32, align 4
  %w126.addr = alloca i64, align 8
  %x126.addr = alloca i32, align 4
  %x127.addr = alloca i32, align 4
  %w128.addr = alloca i64, align 8
  %x128.addr = alloca i32, align 4
  %x129.addr = alloca i32, align 4
  %w130.addr = alloca i64, align 8
  %x130.addr = alloca i32, align 4
  %x131.addr = alloca i32, align 4
  %x132.addr = alloca i32, align 4
  %w133.addr = alloca i64, align 8
  %x134.addr = alloca i32, align 4
  %w135.addr = alloca i64, align 8
  %x135.addr = alloca i32, align 4
  %x136.addr = alloca i32, align 4
  %w137.addr = alloca i64, align 8
  %x137.addr = alloca i32, align 4
  %x138.addr = alloca i32, align 4
  %w139.addr = alloca i64, align 8
  %x139.addr = alloca i32, align 4
  %x140.addr = alloca i32, align 4
  %w141.addr = alloca i64, align 8
  %x141.addr = alloca i32, align 4
  %x142.addr = alloca i32, align 4
  %w143.addr = alloca i64, align 8
  %x143.addr = alloca i32, align 4
  %x144.addr = alloca i32, align 4
  %w145.addr = alloca i64, align 8
  %x145.addr = alloca i32, align 4
  %x146.addr = alloca i32, align 4
  %w147.addr = alloca i64, align 8
  %x147.addr = alloca i32, align 4
  %x148.addr = alloca i32, align 4
  %w149.addr = alloca i64, align 8
  %x149.addr = alloca i32, align 4
  %x150.addr = alloca i32, align 4
  %x151.addr = alloca i32, align 4
  %w152.addr = alloca i64, align 8
  %x152.addr = alloca i32, align 4
  %x153.addr = alloca i32, align 4
  %w154.addr = alloca i64, align 8
  %x154.addr = alloca i32, align 4
  %x155.addr = alloca i32, align 4
  %w156.addr = alloca i64, align 8
  %x156.addr = alloca i32, align 4
  %x157.addr = alloca i32, align 4
  %w158.addr = alloca i64, align 8
  %x158.addr = alloca i32, align 4
  %x159.addr = alloca i32, align 4
  %w160.addr = alloca i64, align 8
  %x160.addr = alloca i32, align 4
  %x161.addr = alloca i32, align 4
  %w162.addr = alloca i64, align 8
  %x162.addr = alloca i32, align 4
  %x163.addr = alloca i32, align 4
  %w164.addr = alloca i64, align 8
  %x164.addr = alloca i32, align 4
  %x165.addr = alloca i32, align 4
  %w166.addr = alloca i64, align 8
  %x166.addr = alloca i32, align 4
  %x167.addr = alloca i32, align 4
  %w168.addr = alloca i64, align 8
  %x168.addr = alloca i32, align 4
  %x169.addr = alloca i32, align 4
  %w170.addr = alloca i64, align 8
  %x170.addr = alloca i32, align 4
  %x171.addr = alloca i32, align 4
  %w172.addr = alloca i64, align 8
  %x172.addr = alloca i32, align 4
  %x173.addr = alloca i32, align 4
  %w174.addr = alloca i64, align 8
  %x174.addr = alloca i32, align 4
  %x175.addr = alloca i32, align 4
  %w176.addr = alloca i64, align 8
  %x176.addr = alloca i32, align 4
  %x177.addr = alloca i32, align 4
  %w178.addr = alloca i64, align 8
  %x178.addr = alloca i32, align 4
  %x179.addr = alloca i32, align 4
  %w180.addr = alloca i64, align 8
  %x180.addr = alloca i32, align 4
  %x181.addr = alloca i32, align 4
  %x182.addr = alloca i32, align 4
  %w183.addr = alloca i64, align 8
  %x183.addr = alloca i32, align 4
  %x184.addr = alloca i32, align 4
  %w185.addr = alloca i64, align 8
  %x185.addr = alloca i32, align 4
  %x186.addr = alloca i32, align 4
  %w187.addr = alloca i64, align 8
  %x187.addr = alloca i32, align 4
  %x188.addr = alloca i32, align 4
  %w189.addr = alloca i64, align 8
  %x189.addr = alloca i32, align 4
  %x190.addr = alloca i32, align 4
  %w191.addr = alloca i64, align 8
  %x191.addr = alloca i32, align 4
  %x192.addr = alloca i32, align 4
  %w193.addr = alloca i64, align 8
  %x193.addr = alloca i32, align 4
  %x194.addr = alloca i32, align 4
  %w195.addr = alloca i64, align 8
  %x195.addr = alloca i32, align 4
  %x196.addr = alloca i32, align 4
  %w197.addr = alloca i64, align 8
  %x197.addr = alloca i32, align 4
  %x198.addr = alloca i32, align 4
  %w199.addr = alloca i64, align 8
  %x199.addr = alloca i32, align 4
  %x200.addr = alloca i32, align 4
  %w201.addr = alloca i64, align 8
  %x201.addr = alloca i32, align 4
  %x202.addr = alloca i32, align 4
  %w203.addr = alloca i64, align 8
  %x203.addr = alloca i32, align 4
  %x204.addr = alloca i32, align 4
  %w205.addr = alloca i64, align 8
  %x205.addr = alloca i32, align 4
  %x206.addr = alloca i32, align 4
  %w207.addr = alloca i64, align 8
  %x207.addr = alloca i32, align 4
  %x208.addr = alloca i32, align 4
  %w209.addr = alloca i64, align 8
  %x209.addr = alloca i32, align 4
  %x210.addr = alloca i32, align 4
  %w211.addr = alloca i64, align 8
  %x211.addr = alloca i32, align 4
  %x212.addr = alloca i32, align 4
  %x213.addr = alloca i32, align 4
  %w214.addr = alloca i64, align 8
  %x215.addr = alloca i32, align 4
  %w216.addr = alloca i64, align 8
  %x216.addr = alloca i32, align 4
  %x217.addr = alloca i32, align 4
  %w218.addr = alloca i64, align 8
  %x218.addr = alloca i32, align 4
  %x219.addr = alloca i32, align 4
  %w220.addr = alloca i64, align 8
  %x220.addr = alloca i32, align 4
  %x221.addr = alloca i32, align 4
  %w222.addr = alloca i64, align 8
  %x222.addr = alloca i32, align 4
  %x223.addr = alloca i32, align 4
  %w224.addr = alloca i64, align 8
  %x224.addr = alloca i32, align 4
  %x225.addr = alloca i32, align 4
  %w226.addr = alloca i64, align 8
  %x226.addr = alloca i32, align 4
  %x227.addr = alloca i32, align 4
  %w228.addr = alloca i64, align 8
  %x228.addr = alloca i32, align 4
  %x229.addr = alloca i32, align 4
  %w230.addr = alloca i64, align 8
  %x230.addr = alloca i32, align 4
  %x231.addr = alloca i32, align 4
  %x232.addr = alloca i32, align 4
  %w233.addr = alloca i64, align 8
  %x233.addr = alloca i32, align 4
  %x234.addr = alloca i32, align 4
  %w235.addr = alloca i64, align 8
  %x235.addr = alloca i32, align 4
  %x236.addr = alloca i32, align 4
  %w237.addr = alloca i64, align 8
  %x237.addr = alloca i32, align 4
  %x238.addr = alloca i32, align 4
  %w239.addr = alloca i64, align 8
  %x239.addr = alloca i32, align 4
  %x240.addr = alloca i32, align 4
  %w241.addr = alloca i64, align 8
  %x241.addr = alloca i32, align 4
  %x242.addr = alloca i32, align 4
  %w243.addr = alloca i64, align 8
  %x243.addr = alloca i32, align 4
  %x244.addr = alloca i32, align 4
  %w245.addr = alloca i64, align 8
  %x245.addr = alloca i32, align 4
  %x246.addr = alloca i32, align 4
  %w247.addr = alloca i64, align 8
  %x247.addr = alloca i32, align 4
  %x248.addr = alloca i32, align 4
  %w249.addr = alloca i64, align 8
  %x249.addr = alloca i32, align 4
  %x250.addr = alloca i32, align 4
  %w251.addr = alloca i64, align 8
  %x251.addr = alloca i32, align 4
  %x252.addr = alloca i32, align 4
  %w253.addr = alloca i64, align 8
  %x253.addr = alloca i32, align 4
  %x254.addr = alloca i32, align 4
  %w255.addr = alloca i64, align 8
  %x255.addr = alloca i32, align 4
  %x256.addr = alloca i32, align 4
  %w257.addr = alloca i64, align 8
  %x257.addr = alloca i32, align 4
  %x258.addr = alloca i32, align 4
  %w259.addr = alloca i64, align 8
  %x259.addr = alloca i32, align 4
  %x260.addr = alloca i32, align 4
  %w261.addr = alloca i64, align 8
  %x261.addr = alloca i32, align 4
  %x262.addr = alloca i32, align 4
  %x263.addr = alloca i32, align 4
  %w264.addr = alloca i64, align 8
  %x264.addr = alloca i32, align 4
  %x265.addr = alloca i32, align 4
  %w266.addr = alloca i64, align 8
  %x266.addr = alloca i32, align 4
  %x267.addr = alloca i32, align 4
  %w268.addr = alloca i64, align 8
  %x268.addr = alloca i32, align 4
  %x269.addr = alloca i32, align 4
  %w270.addr = alloca i64, align 8
  %x270.addr = alloca i32, align 4
  %x271.addr = alloca i32, align 4
  %w272.addr = alloca i64, align 8
  %x272.addr = alloca i32, align 4
  %x273.addr = alloca i32, align 4
  %w274.addr = alloca i64, align 8
  %x274.addr = alloca i32, align 4
  %x275.addr = alloca i32, align 4
  %w276.addr = alloca i64, align 8
  %x276.addr = alloca i32, align 4
  %x277.addr = alloca i32, align 4
  %w278.addr = alloca i64, align 8
  %x278.addr = alloca i32, align 4
  %x279.addr = alloca i32, align 4
  %w280.addr = alloca i64, align 8
  %x280.addr = alloca i32, align 4
  %x281.addr = alloca i32, align 4
  %w282.addr = alloca i64, align 8
  %x282.addr = alloca i32, align 4
  %x283.addr = alloca i32, align 4
  %w284.addr = alloca i64, align 8
  %x284.addr = alloca i32, align 4
  %x285.addr = alloca i32, align 4
  %w286.addr = alloca i64, align 8
  %x286.addr = alloca i32, align 4
  %x287.addr = alloca i32, align 4
  %w288.addr = alloca i64, align 8
  %x288.addr = alloca i32, align 4
  %x289.addr = alloca i32, align 4
  %w290.addr = alloca i64, align 8
  %x290.addr = alloca i32, align 4
  %x291.addr = alloca i32, align 4
  %w292.addr = alloca i64, align 8
  %x292.addr = alloca i32, align 4
  %x293.addr = alloca i32, align 4
  %x294.addr = alloca i32, align 4
  %w295.addr = alloca i64, align 8
  %x296.addr = alloca i32, align 4
  %w297.addr = alloca i64, align 8
  %x297.addr = alloca i32, align 4
  %x298.addr = alloca i32, align 4
  %w299.addr = alloca i64, align 8
  %x299.addr = alloca i32, align 4
  %x300.addr = alloca i32, align 4
  %w301.addr = alloca i64, align 8
  %x301.addr = alloca i32, align 4
  %x302.addr = alloca i32, align 4
  %w303.addr = alloca i64, align 8
  %x303.addr = alloca i32, align 4
  %x304.addr = alloca i32, align 4
  %w305.addr = alloca i64, align 8
  %x305.addr = alloca i32, align 4
  %x306.addr = alloca i32, align 4
  %w307.addr = alloca i64, align 8
  %x307.addr = alloca i32, align 4
  %x308.addr = alloca i32, align 4
  %w309.addr = alloca i64, align 8
  %x309.addr = alloca i32, align 4
  %x310.addr = alloca i32, align 4
  %w311.addr = alloca i64, align 8
  %x311.addr = alloca i32, align 4
  %x312.addr = alloca i32, align 4
  %x313.addr = alloca i32, align 4
  %w314.addr = alloca i64, align 8
  %x314.addr = alloca i32, align 4
  %x315.addr = alloca i32, align 4
  %w316.addr = alloca i64, align 8
  %x316.addr = alloca i32, align 4
  %x317.addr = alloca i32, align 4
  %w318.addr = alloca i64, align 8
  %x318.addr = alloca i32, align 4
  %x319.addr = alloca i32, align 4
  %w320.addr = alloca i64, align 8
  %x320.addr = alloca i32, align 4
  %x321.addr = alloca i32, align 4
  %w322.addr = alloca i64, align 8
  %x322.addr = alloca i32, align 4
  %x323.addr = alloca i32, align 4
  %w324.addr = alloca i64, align 8
  %x324.addr = alloca i32, align 4
  %x325.addr = alloca i32, align 4
  %w326.addr = alloca i64, align 8
  %x326.addr = alloca i32, align 4
  %x327.addr = alloca i32, align 4
  %w328.addr = alloca i64, align 8
  %x328.addr = alloca i32, align 4
  %x329.addr = alloca i32, align 4
  %w330.addr = alloca i64, align 8
  %x330.addr = alloca i32, align 4
  %x331.addr = alloca i32, align 4
  %w332.addr = alloca i64, align 8
  %x332.addr = alloca i32, align 4
  %x333.addr = alloca i32, align 4
  %w334.addr = alloca i64, align 8
  %x334.addr = alloca i32, align 4
  %x335.addr = alloca i32, align 4
  %w336.addr = alloca i64, align 8
  %x336.addr = alloca i32, align 4
  %x337.addr = alloca i32, align 4
  %w338.addr = alloca i64, align 8
  %x338.addr = alloca i32, align 4
  %x339.addr = alloca i32, align 4
  %w340.addr = alloca i64, align 8
  %x340.addr = alloca i32, align 4
  %x341.addr = alloca i32, align 4
  %w342.addr = alloca i64, align 8
  %x342.addr = alloca i32, align 4
  %x343.addr = alloca i32, align 4
  %x344.addr = alloca i32, align 4
  %w345.addr = alloca i64, align 8
  %x345.addr = alloca i32, align 4
  %x346.addr = alloca i32, align 4
  %w347.addr = alloca i64, align 8
  %x347.addr = alloca i32, align 4
  %x348.addr = alloca i32, align 4
  %w349.addr = alloca i64, align 8
  %x349.addr = alloca i32, align 4
  %x350.addr = alloca i32, align 4
  %w351.addr = alloca i64, align 8
  %x351.addr = alloca i32, align 4
  %x352.addr = alloca i32, align 4
  %w353.addr = alloca i64, align 8
  %x353.addr = alloca i32, align 4
  %x354.addr = alloca i32, align 4
  %w355.addr = alloca i64, align 8
  %x355.addr = alloca i32, align 4
  %x356.addr = alloca i32, align 4
  %w357.addr = alloca i64, align 8
  %x357.addr = alloca i32, align 4
  %x358.addr = alloca i32, align 4
  %w359.addr = alloca i64, align 8
  %x359.addr = alloca i32, align 4
  %x360.addr = alloca i32, align 4
  %w361.addr = alloca i64, align 8
  %x361.addr = alloca i32, align 4
  %x362.addr = alloca i32, align 4
  %w363.addr = alloca i64, align 8
  %x363.addr = alloca i32, align 4
  %x364.addr = alloca i32, align 4
  %w365.addr = alloca i64, align 8
  %x365.addr = alloca i32, align 4
  %x366.addr = alloca i32, align 4
  %w367.addr = alloca i64, align 8
  %x367.addr = alloca i32, align 4
  %x368.addr = alloca i32, align 4
  %w369.addr = alloca i64, align 8
  %x369.addr = alloca i32, align 4
  %x370.addr = alloca i32, align 4
  %w371.addr = alloca i64, align 8
  %x371.addr = alloca i32, align 4
  %x372.addr = alloca i32, align 4
  %w373.addr = alloca i64, align 8
  %x373.addr = alloca i32, align 4
  %x374.addr = alloca i32, align 4
  %x375.addr = alloca i32, align 4
  %w376.addr = alloca i64, align 8
  %x377.addr = alloca i32, align 4
  %w378.addr = alloca i64, align 8
  %x378.addr = alloca i32, align 4
  %x379.addr = alloca i32, align 4
  %w380.addr = alloca i64, align 8
  %x380.addr = alloca i32, align 4
  %x381.addr = alloca i32, align 4
  %w382.addr = alloca i64, align 8
  %x382.addr = alloca i32, align 4
  %x383.addr = alloca i32, align 4
  %w384.addr = alloca i64, align 8
  %x384.addr = alloca i32, align 4
  %x385.addr = alloca i32, align 4
  %w386.addr = alloca i64, align 8
  %x386.addr = alloca i32, align 4
  %x387.addr = alloca i32, align 4
  %w388.addr = alloca i64, align 8
  %x388.addr = alloca i32, align 4
  %x389.addr = alloca i32, align 4
  %w390.addr = alloca i64, align 8
  %x390.addr = alloca i32, align 4
  %x391.addr = alloca i32, align 4
  %w392.addr = alloca i64, align 8
  %x392.addr = alloca i32, align 4
  %x393.addr = alloca i32, align 4
  %x394.addr = alloca i32, align 4
  %w395.addr = alloca i64, align 8
  %x395.addr = alloca i32, align 4
  %x396.addr = alloca i32, align 4
  %w397.addr = alloca i64, align 8
  %x397.addr = alloca i32, align 4
  %x398.addr = alloca i32, align 4
  %w399.addr = alloca i64, align 8
  %x399.addr = alloca i32, align 4
  %x400.addr = alloca i32, align 4
  %w401.addr = alloca i64, align 8
  %x401.addr = alloca i32, align 4
  %x402.addr = alloca i32, align 4
  %w403.addr = alloca i64, align 8
  %x403.addr = alloca i32, align 4
  %x404.addr = alloca i32, align 4
  %w405.addr = alloca i64, align 8
  %x405.addr = alloca i32, align 4
  %x406.addr = alloca i32, align 4
  %w407.addr = alloca i64, align 8
  %x407.addr = alloca i32, align 4
  %x408.addr = alloca i32, align 4
  %w409.addr = alloca i64, align 8
  %x409.addr = alloca i32, align 4
  %x410.addr = alloca i32, align 4
  %w411.addr = alloca i64, align 8
  %x411.addr = alloca i32, align 4
  %x412.addr = alloca i32, align 4
  %w413.addr = alloca i64, align 8
  %x413.addr = alloca i32, align 4
  %x414.addr = alloca i32, align 4
  %w415.addr = alloca i64, align 8
  %x415.addr = alloca i32, align 4
  %x416.addr = alloca i32, align 4
  %w417.addr = alloca i64, align 8
  %x417.addr = alloca i32, align 4
  %x418.addr = alloca i32, align 4
  %w419.addr = alloca i64, align 8
  %x419.addr = alloca i32, align 4
  %x420.addr = alloca i32, align 4
  %w421.addr = alloca i64, align 8
  %x421.addr = alloca i32, align 4
  %x422.addr = alloca i32, align 4
  %w423.addr = alloca i64, align 8
  %x423.addr = alloca i32, align 4
  %x424.addr = alloca i32, align 4
  %x425.addr = alloca i32, align 4
  %w426.addr = alloca i64, align 8
  %x426.addr = alloca i32, align 4
  %x427.addr = alloca i32, align 4
  %w428.addr = alloca i64, align 8
  %x428.addr = alloca i32, align 4
  %x429.addr = alloca i32, align 4
  %w430.addr = alloca i64, align 8
  %x430.addr = alloca i32, align 4
  %x431.addr = alloca i32, align 4
  %w432.addr = alloca i64, align 8
  %x432.addr = alloca i32, align 4
  %x433.addr = alloca i32, align 4
  %w434.addr = alloca i64, align 8
  %x434.addr = alloca i32, align 4
  %x435.addr = alloca i32, align 4
  %w436.addr = alloca i64, align 8
  %x436.addr = alloca i32, align 4
  %x437.addr = alloca i32, align 4
  %w438.addr = alloca i64, align 8
  %x438.addr = alloca i32, align 4
  %x439.addr = alloca i32, align 4
  %w440.addr = alloca i64, align 8
  %x440.addr = alloca i32, align 4
  %x441.addr = alloca i32, align 4
  %w442.addr = alloca i64, align 8
  %x442.addr = alloca i32, align 4
  %x443.addr = alloca i32, align 4
  %w444.addr = alloca i64, align 8
  %x444.addr = alloca i32, align 4
  %x445.addr = alloca i32, align 4
  %w446.addr = alloca i64, align 8
  %x446.addr = alloca i32, align 4
  %x447.addr = alloca i32, align 4
  %w448.addr = alloca i64, align 8
  %x448.addr = alloca i32, align 4
  %x449.addr = alloca i32, align 4
  %w450.addr = alloca i64, align 8
  %x450.addr = alloca i32, align 4
  %x451.addr = alloca i32, align 4
  %w452.addr = alloca i64, align 8
  %x452.addr = alloca i32, align 4
  %x453.addr = alloca i32, align 4
  %w454.addr = alloca i64, align 8
  %x454.addr = alloca i32, align 4
  %x455.addr = alloca i32, align 4
  %x456.addr = alloca i32, align 4
  %w457.addr = alloca i64, align 8
  %x458.addr = alloca i32, align 4
  %w459.addr = alloca i64, align 8
  %x459.addr = alloca i32, align 4
  %x460.addr = alloca i32, align 4
  %w461.addr = alloca i64, align 8
  %x461.addr = alloca i32, align 4
  %x462.addr = alloca i32, align 4
  %w463.addr = alloca i64, align 8
  %x463.addr = alloca i32, align 4
  %x464.addr = alloca i32, align 4
  %w465.addr = alloca i64, align 8
  %x465.addr = alloca i32, align 4
  %x466.addr = alloca i32, align 4
  %w467.addr = alloca i64, align 8
  %x467.addr = alloca i32, align 4
  %x468.addr = alloca i32, align 4
  %w469.addr = alloca i64, align 8
  %x469.addr = alloca i32, align 4
  %x470.addr = alloca i32, align 4
  %w471.addr = alloca i64, align 8
  %x471.addr = alloca i32, align 4
  %x472.addr = alloca i32, align 4
  %w473.addr = alloca i64, align 8
  %x473.addr = alloca i32, align 4
  %x474.addr = alloca i32, align 4
  %x475.addr = alloca i32, align 4
  %w476.addr = alloca i64, align 8
  %x476.addr = alloca i32, align 4
  %x477.addr = alloca i32, align 4
  %w478.addr = alloca i64, align 8
  %x478.addr = alloca i32, align 4
  %x479.addr = alloca i32, align 4
  %w480.addr = alloca i64, align 8
  %x480.addr = alloca i32, align 4
  %x481.addr = alloca i32, align 4
  %w482.addr = alloca i64, align 8
  %x482.addr = alloca i32, align 4
  %x483.addr = alloca i32, align 4
  %w484.addr = alloca i64, align 8
  %x484.addr = alloca i32, align 4
  %x485.addr = alloca i32, align 4
  %w486.addr = alloca i64, align 8
  %x486.addr = alloca i32, align 4
  %x487.addr = alloca i32, align 4
  %w488.addr = alloca i64, align 8
  %x488.addr = alloca i32, align 4
  %x489.addr = alloca i32, align 4
  %w490.addr = alloca i64, align 8
  %x490.addr = alloca i32, align 4
  %x491.addr = alloca i32, align 4
  %w492.addr = alloca i64, align 8
  %x492.addr = alloca i32, align 4
  %x493.addr = alloca i32, align 4
  %w494.addr = alloca i64, align 8
  %x494.addr = alloca i32, align 4
  %x495.addr = alloca i32, align 4
  %w496.addr = alloca i64, align 8
  %x496.addr = alloca i32, align 4
  %x497.addr = alloca i32, align 4
  %w498.addr = alloca i64, align 8
  %x498.addr = alloca i32, align 4
  %x499.addr = alloca i32, align 4
  %w500.addr = alloca i64, align 8
  %x500.addr = alloca i32, align 4
  %x501.addr = alloca i32, align 4
  %w502.addr = alloca i64, align 8
  %x502.addr = alloca i32, align 4
  %x503.addr = alloca i32, align 4
  %w504.addr = alloca i64, align 8
  %x504.addr = alloca i32, align 4
  %x505.addr = alloca i32, align 4
  %x506.addr = alloca i32, align 4
  %w507.addr = alloca i64, align 8
  %x507.addr = alloca i32, align 4
  %x508.addr = alloca i32, align 4
  %w509.addr = alloca i64, align 8
  %x509.addr = alloca i32, align 4
  %x510.addr = alloca i32, align 4
  %w511.addr = alloca i64, align 8
  %x511.addr = alloca i32, align 4
  %x512.addr = alloca i32, align 4
  %w513.addr = alloca i64, align 8
  %x513.addr = alloca i32, align 4
  %x514.addr = alloca i32, align 4
  %w515.addr = alloca i64, align 8
  %x515.addr = alloca i32, align 4
  %x516.addr = alloca i32, align 4
  %w517.addr = alloca i64, align 8
  %x517.addr = alloca i32, align 4
  %x518.addr = alloca i32, align 4
  %w519.addr = alloca i64, align 8
  %x519.addr = alloca i32, align 4
  %x520.addr = alloca i32, align 4
  %w521.addr = alloca i64, align 8
  %x521.addr = alloca i32, align 4
  %x522.addr = alloca i32, align 4
  %w523.addr = alloca i64, align 8
  %x523.addr = alloca i32, align 4
  %x524.addr = alloca i32, align 4
  %w525.addr = alloca i64, align 8
  %x525.addr = alloca i32, align 4
  %x526.addr = alloca i32, align 4
  %w527.addr = alloca i64, align 8
  %x527.addr = alloca i32, align 4
  %x528.addr = alloca i32, align 4
  %w529.addr = alloca i64, align 8
  %x529.addr = alloca i32, align 4
  %x530.addr = alloca i32, align 4
  %w531.addr = alloca i64, align 8
  %x531.addr = alloca i32, align 4
  %x532.addr = alloca i32, align 4
  %w533.addr = alloca i64, align 8
  %x533.addr = alloca i32, align 4
  %x534.addr = alloca i32, align 4
  %w535.addr = alloca i64, align 8
  %x535.addr = alloca i32, align 4
  %x536.addr = alloca i32, align 4
  %x537.addr = alloca i32, align 4
  %w538.addr = alloca i64, align 8
  %x539.addr = alloca i32, align 4
  %w540.addr = alloca i64, align 8
  %x540.addr = alloca i32, align 4
  %x541.addr = alloca i32, align 4
  %w542.addr = alloca i64, align 8
  %x542.addr = alloca i32, align 4
  %x543.addr = alloca i32, align 4
  %w544.addr = alloca i64, align 8
  %x544.addr = alloca i32, align 4
  %x545.addr = alloca i32, align 4
  %w546.addr = alloca i64, align 8
  %x546.addr = alloca i32, align 4
  %x547.addr = alloca i32, align 4
  %w548.addr = alloca i64, align 8
  %x548.addr = alloca i32, align 4
  %x549.addr = alloca i32, align 4
  %w550.addr = alloca i64, align 8
  %x550.addr = alloca i32, align 4
  %x551.addr = alloca i32, align 4
  %w552.addr = alloca i64, align 8
  %x552.addr = alloca i32, align 4
  %x553.addr = alloca i32, align 4
  %w554.addr = alloca i64, align 8
  %x554.addr = alloca i32, align 4
  %x555.addr = alloca i32, align 4
  %x556.addr = alloca i32, align 4
  %w557.addr = alloca i64, align 8
  %x557.addr = alloca i32, align 4
  %x558.addr = alloca i32, align 4
  %w559.addr = alloca i64, align 8
  %x559.addr = alloca i32, align 4
  %x560.addr = alloca i32, align 4
  %w561.addr = alloca i64, align 8
  %x561.addr = alloca i32, align 4
  %x562.addr = alloca i32, align 4
  %w563.addr = alloca i64, align 8
  %x563.addr = alloca i32, align 4
  %x564.addr = alloca i32, align 4
  %w565.addr = alloca i64, align 8
  %x565.addr = alloca i32, align 4
  %x566.addr = alloca i32, align 4
  %w567.addr = alloca i64, align 8
  %x567.addr = alloca i32, align 4
  %x568.addr = alloca i32, align 4
  %w569.addr = alloca i64, align 8
  %x569.addr = alloca i32, align 4
  %x570.addr = alloca i32, align 4
  %w571.addr = alloca i64, align 8
  %x571.addr = alloca i32, align 4
  %x572.addr = alloca i32, align 4
  %w573.addr = alloca i64, align 8
  %x573.addr = alloca i32, align 4
  %x574.addr = alloca i32, align 4
  %w575.addr = alloca i64, align 8
  %x575.addr = alloca i32, align 4
  %x576.addr = alloca i32, align 4
  %w577.addr = alloca i64, align 8
  %x577.addr = alloca i32, align 4
  %x578.addr = alloca i32, align 4
  %w579.addr = alloca i64, align 8
  %x579.addr = alloca i32, align 4
  %x580.addr = alloca i32, align 4
  %w581.addr = alloca i64, align 8
  %x581.addr = alloca i32, align 4
  %x582.addr = alloca i32, align 4
  %w583.addr = alloca i64, align 8
  %x583.addr = alloca i32, align 4
  %x584.addr = alloca i32, align 4
  %w585.addr = alloca i64, align 8
  %x585.addr = alloca i32, align 4
  %x586.addr = alloca i32, align 4
  %x587.addr = alloca i32, align 4
  %w588.addr = alloca i64, align 8
  %x588.addr = alloca i32, align 4
  %x589.addr = alloca i32, align 4
  %w590.addr = alloca i64, align 8
  %x590.addr = alloca i32, align 4
  %x591.addr = alloca i32, align 4
  %w592.addr = alloca i64, align 8
  %x592.addr = alloca i32, align 4
  %x593.addr = alloca i32, align 4
  %w594.addr = alloca i64, align 8
  %x594.addr = alloca i32, align 4
  %x595.addr = alloca i32, align 4
  %w596.addr = alloca i64, align 8
  %x596.addr = alloca i32, align 4
  %x597.addr = alloca i32, align 4
  %w598.addr = alloca i64, align 8
  %x598.addr = alloca i32, align 4
  %x599.addr = alloca i32, align 4
  %w600.addr = alloca i64, align 8
  %x600.addr = alloca i32, align 4
  %x601.addr = alloca i32, align 4
  %w602.addr = alloca i64, align 8
  %x602.addr = alloca i32, align 4
  %x603.addr = alloca i32, align 4
  %w604.addr = alloca i64, align 8
  %x604.addr = alloca i32, align 4
  %x605.addr = alloca i32, align 4
  %w606.addr = alloca i64, align 8
  %x606.addr = alloca i32, align 4
  %x607.addr = alloca i32, align 4
  %w608.addr = alloca i64, align 8
  %x608.addr = alloca i32, align 4
  %x609.addr = alloca i32, align 4
  %w610.addr = alloca i64, align 8
  %x610.addr = alloca i32, align 4
  %x611.addr = alloca i32, align 4
  %w612.addr = alloca i64, align 8
  %x612.addr = alloca i32, align 4
  %x613.addr = alloca i32, align 4
  %w614.addr = alloca i64, align 8
  %x614.addr = alloca i32, align 4
  %x615.addr = alloca i32, align 4
  %w616.addr = alloca i64, align 8
  %x616.addr = alloca i32, align 4
  %x617.addr = alloca i32, align 4
  %x618.addr = alloca i32, align 4
  %w619.addr = alloca i64, align 8
  %x620.addr = alloca i32, align 4
  %w621.addr = alloca i64, align 8
  %x621.addr = alloca i32, align 4
  %x622.addr = alloca i32, align 4
  %w623.addr = alloca i64, align 8
  %x623.addr = alloca i32, align 4
  %x624.addr = alloca i32, align 4
  %w625.addr = alloca i64, align 8
  %x625.addr = alloca i32, align 4
  %x626.addr = alloca i32, align 4
  %w627.addr = alloca i64, align 8
  %x627.addr = alloca i32, align 4
  %x628.addr = alloca i32, align 4
  %w629.addr = alloca i64, align 8
  %x629.addr = alloca i32, align 4
  %x630.addr = alloca i32, align 4
  %w631.addr = alloca i64, align 8
  %x631.addr = alloca i32, align 4
  %x632.addr = alloca i32, align 4
  %w633.addr = alloca i64, align 8
  %x633.addr = alloca i32, align 4
  %x634.addr = alloca i32, align 4
  %w635.addr = alloca i64, align 8
  %x635.addr = alloca i32, align 4
  %x636.addr = alloca i32, align 4
  %x637.addr = alloca i32, align 4
  %w638.addr = alloca i64, align 8
  %x638.addr = alloca i32, align 4
  %x639.addr = alloca i32, align 4
  %w640.addr = alloca i64, align 8
  %x640.addr = alloca i32, align 4
  %x641.addr = alloca i32, align 4
  %w642.addr = alloca i64, align 8
  %x642.addr = alloca i32, align 4
  %x643.addr = alloca i32, align 4
  %w644.addr = alloca i64, align 8
  %x644.addr = alloca i32, align 4
  %x645.addr = alloca i32, align 4
  %w646.addr = alloca i64, align 8
  %x646.addr = alloca i32, align 4
  %x647.addr = alloca i32, align 4
  %w648.addr = alloca i64, align 8
  %x648.addr = alloca i32, align 4
  %x649.addr = alloca i32, align 4
  %w650.addr = alloca i64, align 8
  %x650.addr = alloca i32, align 4
  %x651.addr = alloca i32, align 4
  %w652.addr = alloca i64, align 8
  %x652.addr = alloca i32, align 4
  %x653.addr = alloca i32, align 4
  %w654.addr = alloca i64, align 8
  %x655.addr = alloca i32, align 4
  %x656.addr = alloca i32, align 4
  %x657.addr = alloca i32, align 4
  %x658.addr = alloca i32, align 4
  %x659.addr = alloca i32, align 4
  %x660.addr = alloca i32, align 4
  %x661.addr = alloca i32, align 4
  %x662.addr = alloca i32, align 4
  %x663.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %4, i32* %arg1Limb0.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %9, i32* %arg1Limb1.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 2
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %14, i32* %arg1Limb2.addr, align 4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 3
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %19, i32* %arg1Limb3.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 4
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %24, i32* %arg1Limb4.addr, align 4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 5
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %29, i32* %arg1Limb5.addr, align 4
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 6
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %34, i32* %arg1Limb6.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 7
  %39 = load i32, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %39, i32* %arg1Limb7.addr, align 4
  %40 = load i32, i32* %arg1Limb1.addr, align 4
  store i32 %40, i32* %x1.addr, align 4
  %41 = load i32, i32* %arg1Limb2.addr, align 4
  store i32 %41, i32* %x2.addr, align 4
  %42 = load i32, i32* %arg1Limb3.addr, align 4
  store i32 %42, i32* %x3.addr, align 4
  %43 = load i32, i32* %arg1Limb4.addr, align 4
  store i32 %43, i32* %x4.addr, align 4
  %44 = load i32, i32* %arg1Limb5.addr, align 4
  store i32 %44, i32* %x5.addr, align 4
  %45 = load i32, i32* %arg1Limb6.addr, align 4
  store i32 %45, i32* %x6.addr, align 4
  %46 = load i32, i32* %arg1Limb7.addr, align 4
  store i32 %46, i32* %x7.addr, align 4
  %47 = load i32, i32* %arg1Limb0.addr, align 4
  store i32 %47, i32* %x8.addr, align 4
  %48 = load i32, i32* %x8.addr, align 4
  %49 = load i32, i32* %arg1Limb7.addr, align 4
  %50 = call i64 @p256FiatMulxU32(i32 %48, i32 %49)
  store i64 %50, i64* %w9.addr, align 8
  %51 = load i64, i64* %w9.addr, align 8
  %52 = trunc i64 %51 to i32
  store i32 %52, i32* %x9.addr, align 4
  %53 = load i64, i64* %w9.addr, align 8
  %54 = lshr i64 %53, 32
  %55 = trunc i64 %54 to i32
  store i32 %55, i32* %x10.addr, align 4
  %56 = load i32, i32* %x8.addr, align 4
  %57 = load i32, i32* %arg1Limb6.addr, align 4
  %58 = call i64 @p256FiatMulxU32(i32 %56, i32 %57)
  store i64 %58, i64* %w11.addr, align 8
  %59 = load i64, i64* %w11.addr, align 8
  %60 = trunc i64 %59 to i32
  store i32 %60, i32* %x11.addr, align 4
  %61 = load i64, i64* %w11.addr, align 8
  %62 = lshr i64 %61, 32
  %63 = trunc i64 %62 to i32
  store i32 %63, i32* %x12.addr, align 4
  %64 = load i32, i32* %x8.addr, align 4
  %65 = load i32, i32* %arg1Limb5.addr, align 4
  %66 = call i64 @p256FiatMulxU32(i32 %64, i32 %65)
  store i64 %66, i64* %w13.addr, align 8
  %67 = load i64, i64* %w13.addr, align 8
  %68 = trunc i64 %67 to i32
  store i32 %68, i32* %x13.addr, align 4
  %69 = load i64, i64* %w13.addr, align 8
  %70 = lshr i64 %69, 32
  %71 = trunc i64 %70 to i32
  store i32 %71, i32* %x14.addr, align 4
  %72 = load i32, i32* %x8.addr, align 4
  %73 = load i32, i32* %arg1Limb4.addr, align 4
  %74 = call i64 @p256FiatMulxU32(i32 %72, i32 %73)
  store i64 %74, i64* %w15.addr, align 8
  %75 = load i64, i64* %w15.addr, align 8
  %76 = trunc i64 %75 to i32
  store i32 %76, i32* %x15.addr, align 4
  %77 = load i64, i64* %w15.addr, align 8
  %78 = lshr i64 %77, 32
  %79 = trunc i64 %78 to i32
  store i32 %79, i32* %x16.addr, align 4
  %80 = load i32, i32* %x8.addr, align 4
  %81 = load i32, i32* %arg1Limb3.addr, align 4
  %82 = call i64 @p256FiatMulxU32(i32 %80, i32 %81)
  store i64 %82, i64* %w17.addr, align 8
  %83 = load i64, i64* %w17.addr, align 8
  %84 = trunc i64 %83 to i32
  store i32 %84, i32* %x17.addr, align 4
  %85 = load i64, i64* %w17.addr, align 8
  %86 = lshr i64 %85, 32
  %87 = trunc i64 %86 to i32
  store i32 %87, i32* %x18.addr, align 4
  %88 = load i32, i32* %x8.addr, align 4
  %89 = load i32, i32* %arg1Limb2.addr, align 4
  %90 = call i64 @p256FiatMulxU32(i32 %88, i32 %89)
  store i64 %90, i64* %w19.addr, align 8
  %91 = load i64, i64* %w19.addr, align 8
  %92 = trunc i64 %91 to i32
  store i32 %92, i32* %x19.addr, align 4
  %93 = load i64, i64* %w19.addr, align 8
  %94 = lshr i64 %93, 32
  %95 = trunc i64 %94 to i32
  store i32 %95, i32* %x20.addr, align 4
  %96 = load i32, i32* %x8.addr, align 4
  %97 = load i32, i32* %arg1Limb1.addr, align 4
  %98 = call i64 @p256FiatMulxU32(i32 %96, i32 %97)
  store i64 %98, i64* %w21.addr, align 8
  %99 = load i64, i64* %w21.addr, align 8
  %100 = trunc i64 %99 to i32
  store i32 %100, i32* %x21.addr, align 4
  %101 = load i64, i64* %w21.addr, align 8
  %102 = lshr i64 %101, 32
  %103 = trunc i64 %102 to i32
  store i32 %103, i32* %x22.addr, align 4
  %104 = load i32, i32* %x8.addr, align 4
  %105 = load i32, i32* %arg1Limb0.addr, align 4
  %106 = call i64 @p256FiatMulxU32(i32 %104, i32 %105)
  store i64 %106, i64* %w23.addr, align 8
  %107 = load i64, i64* %w23.addr, align 8
  %108 = trunc i64 %107 to i32
  store i32 %108, i32* %x23.addr, align 4
  %109 = load i64, i64* %w23.addr, align 8
  %110 = lshr i64 %109, 32
  %111 = trunc i64 %110 to i32
  store i32 %111, i32* %x24.addr, align 4
  %112 = load i32, i32* %x24.addr, align 4
  %113 = load i32, i32* %x21.addr, align 4
  %114 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %112, i32 %113)
  store i64 %114, i64* %w25.addr, align 8
  %115 = load i64, i64* %w25.addr, align 8
  %116 = trunc i64 %115 to i32
  store i32 %116, i32* %x25.addr, align 4
  %117 = load i64, i64* %w25.addr, align 8
  %118 = lshr i64 %117, 32
  %119 = trunc i64 %118 to i32
  store i32 %119, i32* %x26.addr, align 4
  %120 = load i32, i32* %x26.addr, align 4
  %121 = load i32, i32* %x22.addr, align 4
  %122 = load i32, i32* %x19.addr, align 4
  %123 = call i64 @p256FiatAddcarryxU32(i32 %120, i32 %121, i32 %122)
  store i64 %123, i64* %w27.addr, align 8
  %124 = load i64, i64* %w27.addr, align 8
  %125 = trunc i64 %124 to i32
  store i32 %125, i32* %x27.addr, align 4
  %126 = load i64, i64* %w27.addr, align 8
  %127 = lshr i64 %126, 32
  %128 = trunc i64 %127 to i32
  store i32 %128, i32* %x28.addr, align 4
  %129 = load i32, i32* %x28.addr, align 4
  %130 = load i32, i32* %x20.addr, align 4
  %131 = load i32, i32* %x17.addr, align 4
  %132 = call i64 @p256FiatAddcarryxU32(i32 %129, i32 %130, i32 %131)
  store i64 %132, i64* %w29.addr, align 8
  %133 = load i64, i64* %w29.addr, align 8
  %134 = trunc i64 %133 to i32
  store i32 %134, i32* %x29.addr, align 4
  %135 = load i64, i64* %w29.addr, align 8
  %136 = lshr i64 %135, 32
  %137 = trunc i64 %136 to i32
  store i32 %137, i32* %x30.addr, align 4
  %138 = load i32, i32* %x30.addr, align 4
  %139 = load i32, i32* %x18.addr, align 4
  %140 = load i32, i32* %x15.addr, align 4
  %141 = call i64 @p256FiatAddcarryxU32(i32 %138, i32 %139, i32 %140)
  store i64 %141, i64* %w31.addr, align 8
  %142 = load i64, i64* %w31.addr, align 8
  %143 = trunc i64 %142 to i32
  store i32 %143, i32* %x31.addr, align 4
  %144 = load i64, i64* %w31.addr, align 8
  %145 = lshr i64 %144, 32
  %146 = trunc i64 %145 to i32
  store i32 %146, i32* %x32.addr, align 4
  %147 = load i32, i32* %x32.addr, align 4
  %148 = load i32, i32* %x16.addr, align 4
  %149 = load i32, i32* %x13.addr, align 4
  %150 = call i64 @p256FiatAddcarryxU32(i32 %147, i32 %148, i32 %149)
  store i64 %150, i64* %w33.addr, align 8
  %151 = load i64, i64* %w33.addr, align 8
  %152 = trunc i64 %151 to i32
  store i32 %152, i32* %x33.addr, align 4
  %153 = load i64, i64* %w33.addr, align 8
  %154 = lshr i64 %153, 32
  %155 = trunc i64 %154 to i32
  store i32 %155, i32* %x34.addr, align 4
  %156 = load i32, i32* %x34.addr, align 4
  %157 = load i32, i32* %x14.addr, align 4
  %158 = load i32, i32* %x11.addr, align 4
  %159 = call i64 @p256FiatAddcarryxU32(i32 %156, i32 %157, i32 %158)
  store i64 %159, i64* %w35.addr, align 8
  %160 = load i64, i64* %w35.addr, align 8
  %161 = trunc i64 %160 to i32
  store i32 %161, i32* %x35.addr, align 4
  %162 = load i64, i64* %w35.addr, align 8
  %163 = lshr i64 %162, 32
  %164 = trunc i64 %163 to i32
  store i32 %164, i32* %x36.addr, align 4
  %165 = load i32, i32* %x36.addr, align 4
  %166 = load i32, i32* %x12.addr, align 4
  %167 = load i32, i32* %x9.addr, align 4
  %168 = call i64 @p256FiatAddcarryxU32(i32 %165, i32 %166, i32 %167)
  store i64 %168, i64* %w37.addr, align 8
  %169 = load i64, i64* %w37.addr, align 8
  %170 = trunc i64 %169 to i32
  store i32 %170, i32* %x37.addr, align 4
  %171 = load i64, i64* %w37.addr, align 8
  %172 = lshr i64 %171, 32
  %173 = trunc i64 %172 to i32
  store i32 %173, i32* %x38.addr, align 4
  %174 = load i32, i32* %x38.addr, align 4
  %175 = load i32, i32* %x10.addr, align 4
  %176 = add i32 %174, %175
  store i32 %176, i32* %x39.addr, align 4
  %177 = load i32, i32* %x23.addr, align 4
  %178 = call i64 @p256FiatMulxU32(i32 %177, i32 4294967295)
  store i64 %178, i64* %w40.addr, align 8
  %179 = load i64, i64* %w40.addr, align 8
  %180 = trunc i64 %179 to i32
  store i32 %180, i32* %x40.addr, align 4
  %181 = load i64, i64* %w40.addr, align 8
  %182 = lshr i64 %181, 32
  %183 = trunc i64 %182 to i32
  store i32 %183, i32* %x41.addr, align 4
  %184 = load i32, i32* %x23.addr, align 4
  %185 = call i64 @p256FiatMulxU32(i32 %184, i32 4294967295)
  store i64 %185, i64* %w42.addr, align 8
  %186 = load i64, i64* %w42.addr, align 8
  %187 = trunc i64 %186 to i32
  store i32 %187, i32* %x42.addr, align 4
  %188 = load i64, i64* %w42.addr, align 8
  %189 = lshr i64 %188, 32
  %190 = trunc i64 %189 to i32
  store i32 %190, i32* %x43.addr, align 4
  %191 = load i32, i32* %x23.addr, align 4
  %192 = call i64 @p256FiatMulxU32(i32 %191, i32 4294967295)
  store i64 %192, i64* %w44.addr, align 8
  %193 = load i64, i64* %w44.addr, align 8
  %194 = trunc i64 %193 to i32
  store i32 %194, i32* %x44.addr, align 4
  %195 = load i64, i64* %w44.addr, align 8
  %196 = lshr i64 %195, 32
  %197 = trunc i64 %196 to i32
  store i32 %197, i32* %x45.addr, align 4
  %198 = load i32, i32* %x23.addr, align 4
  %199 = call i64 @p256FiatMulxU32(i32 %198, i32 4294967295)
  store i64 %199, i64* %w46.addr, align 8
  %200 = load i64, i64* %w46.addr, align 8
  %201 = trunc i64 %200 to i32
  store i32 %201, i32* %x46.addr, align 4
  %202 = load i64, i64* %w46.addr, align 8
  %203 = lshr i64 %202, 32
  %204 = trunc i64 %203 to i32
  store i32 %204, i32* %x47.addr, align 4
  %205 = load i32, i32* %x47.addr, align 4
  %206 = load i32, i32* %x44.addr, align 4
  %207 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %205, i32 %206)
  store i64 %207, i64* %w48.addr, align 8
  %208 = load i64, i64* %w48.addr, align 8
  %209 = trunc i64 %208 to i32
  store i32 %209, i32* %x48.addr, align 4
  %210 = load i64, i64* %w48.addr, align 8
  %211 = lshr i64 %210, 32
  %212 = trunc i64 %211 to i32
  store i32 %212, i32* %x49.addr, align 4
  %213 = load i32, i32* %x49.addr, align 4
  %214 = load i32, i32* %x45.addr, align 4
  %215 = load i32, i32* %x42.addr, align 4
  %216 = call i64 @p256FiatAddcarryxU32(i32 %213, i32 %214, i32 %215)
  store i64 %216, i64* %w50.addr, align 8
  %217 = load i64, i64* %w50.addr, align 8
  %218 = trunc i64 %217 to i32
  store i32 %218, i32* %x50.addr, align 4
  %219 = load i64, i64* %w50.addr, align 8
  %220 = lshr i64 %219, 32
  %221 = trunc i64 %220 to i32
  store i32 %221, i32* %x51.addr, align 4
  %222 = load i32, i32* %x51.addr, align 4
  %223 = load i32, i32* %x43.addr, align 4
  %224 = add i32 %222, %223
  store i32 %224, i32* %x52.addr, align 4
  %225 = load i32, i32* %x23.addr, align 4
  %226 = load i32, i32* %x46.addr, align 4
  %227 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %225, i32 %226)
  store i64 %227, i64* %w53.addr, align 8
  %228 = load i64, i64* %w53.addr, align 8
  %229 = lshr i64 %228, 32
  %230 = trunc i64 %229 to i32
  store i32 %230, i32* %x54.addr, align 4
  %231 = load i32, i32* %x54.addr, align 4
  %232 = load i32, i32* %x25.addr, align 4
  %233 = load i32, i32* %x48.addr, align 4
  %234 = call i64 @p256FiatAddcarryxU32(i32 %231, i32 %232, i32 %233)
  store i64 %234, i64* %w55.addr, align 8
  %235 = load i64, i64* %w55.addr, align 8
  %236 = trunc i64 %235 to i32
  store i32 %236, i32* %x55.addr, align 4
  %237 = load i64, i64* %w55.addr, align 8
  %238 = lshr i64 %237, 32
  %239 = trunc i64 %238 to i32
  store i32 %239, i32* %x56.addr, align 4
  %240 = load i32, i32* %x56.addr, align 4
  %241 = load i32, i32* %x27.addr, align 4
  %242 = load i32, i32* %x50.addr, align 4
  %243 = call i64 @p256FiatAddcarryxU32(i32 %240, i32 %241, i32 %242)
  store i64 %243, i64* %w57.addr, align 8
  %244 = load i64, i64* %w57.addr, align 8
  %245 = trunc i64 %244 to i32
  store i32 %245, i32* %x57.addr, align 4
  %246 = load i64, i64* %w57.addr, align 8
  %247 = lshr i64 %246, 32
  %248 = trunc i64 %247 to i32
  store i32 %248, i32* %x58.addr, align 4
  %249 = load i32, i32* %x58.addr, align 4
  %250 = load i32, i32* %x29.addr, align 4
  %251 = load i32, i32* %x52.addr, align 4
  %252 = call i64 @p256FiatAddcarryxU32(i32 %249, i32 %250, i32 %251)
  store i64 %252, i64* %w59.addr, align 8
  %253 = load i64, i64* %w59.addr, align 8
  %254 = trunc i64 %253 to i32
  store i32 %254, i32* %x59.addr, align 4
  %255 = load i64, i64* %w59.addr, align 8
  %256 = lshr i64 %255, 32
  %257 = trunc i64 %256 to i32
  store i32 %257, i32* %x60.addr, align 4
  %258 = load i32, i32* %x60.addr, align 4
  %259 = load i32, i32* %x31.addr, align 4
  %260 = call i64 @p256FiatAddcarryxU32(i32 %258, i32 %259, i32 0)
  store i64 %260, i64* %w61.addr, align 8
  %261 = load i64, i64* %w61.addr, align 8
  %262 = trunc i64 %261 to i32
  store i32 %262, i32* %x61.addr, align 4
  %263 = load i64, i64* %w61.addr, align 8
  %264 = lshr i64 %263, 32
  %265 = trunc i64 %264 to i32
  store i32 %265, i32* %x62.addr, align 4
  %266 = load i32, i32* %x62.addr, align 4
  %267 = load i32, i32* %x33.addr, align 4
  %268 = call i64 @p256FiatAddcarryxU32(i32 %266, i32 %267, i32 0)
  store i64 %268, i64* %w63.addr, align 8
  %269 = load i64, i64* %w63.addr, align 8
  %270 = trunc i64 %269 to i32
  store i32 %270, i32* %x63.addr, align 4
  %271 = load i64, i64* %w63.addr, align 8
  %272 = lshr i64 %271, 32
  %273 = trunc i64 %272 to i32
  store i32 %273, i32* %x64.addr, align 4
  %274 = load i32, i32* %x64.addr, align 4
  %275 = load i32, i32* %x35.addr, align 4
  %276 = load i32, i32* %x23.addr, align 4
  %277 = call i64 @p256FiatAddcarryxU32(i32 %274, i32 %275, i32 %276)
  store i64 %277, i64* %w65.addr, align 8
  %278 = load i64, i64* %w65.addr, align 8
  %279 = trunc i64 %278 to i32
  store i32 %279, i32* %x65.addr, align 4
  %280 = load i64, i64* %w65.addr, align 8
  %281 = lshr i64 %280, 32
  %282 = trunc i64 %281 to i32
  store i32 %282, i32* %x66.addr, align 4
  %283 = load i32, i32* %x66.addr, align 4
  %284 = load i32, i32* %x37.addr, align 4
  %285 = load i32, i32* %x40.addr, align 4
  %286 = call i64 @p256FiatAddcarryxU32(i32 %283, i32 %284, i32 %285)
  store i64 %286, i64* %w67.addr, align 8
  %287 = load i64, i64* %w67.addr, align 8
  %288 = trunc i64 %287 to i32
  store i32 %288, i32* %x67.addr, align 4
  %289 = load i64, i64* %w67.addr, align 8
  %290 = lshr i64 %289, 32
  %291 = trunc i64 %290 to i32
  store i32 %291, i32* %x68.addr, align 4
  %292 = load i32, i32* %x68.addr, align 4
  %293 = load i32, i32* %x39.addr, align 4
  %294 = load i32, i32* %x41.addr, align 4
  %295 = call i64 @p256FiatAddcarryxU32(i32 %292, i32 %293, i32 %294)
  store i64 %295, i64* %w69.addr, align 8
  %296 = load i64, i64* %w69.addr, align 8
  %297 = trunc i64 %296 to i32
  store i32 %297, i32* %x69.addr, align 4
  %298 = load i64, i64* %w69.addr, align 8
  %299 = lshr i64 %298, 32
  %300 = trunc i64 %299 to i32
  store i32 %300, i32* %x70.addr, align 4
  %301 = load i32, i32* %x1.addr, align 4
  %302 = load i32, i32* %arg1Limb7.addr, align 4
  %303 = call i64 @p256FiatMulxU32(i32 %301, i32 %302)
  store i64 %303, i64* %w71.addr, align 8
  %304 = load i64, i64* %w71.addr, align 8
  %305 = trunc i64 %304 to i32
  store i32 %305, i32* %x71.addr, align 4
  %306 = load i64, i64* %w71.addr, align 8
  %307 = lshr i64 %306, 32
  %308 = trunc i64 %307 to i32
  store i32 %308, i32* %x72.addr, align 4
  %309 = load i32, i32* %x1.addr, align 4
  %310 = load i32, i32* %arg1Limb6.addr, align 4
  %311 = call i64 @p256FiatMulxU32(i32 %309, i32 %310)
  store i64 %311, i64* %w73.addr, align 8
  %312 = load i64, i64* %w73.addr, align 8
  %313 = trunc i64 %312 to i32
  store i32 %313, i32* %x73.addr, align 4
  %314 = load i64, i64* %w73.addr, align 8
  %315 = lshr i64 %314, 32
  %316 = trunc i64 %315 to i32
  store i32 %316, i32* %x74.addr, align 4
  %317 = load i32, i32* %x1.addr, align 4
  %318 = load i32, i32* %arg1Limb5.addr, align 4
  %319 = call i64 @p256FiatMulxU32(i32 %317, i32 %318)
  store i64 %319, i64* %w75.addr, align 8
  %320 = load i64, i64* %w75.addr, align 8
  %321 = trunc i64 %320 to i32
  store i32 %321, i32* %x75.addr, align 4
  %322 = load i64, i64* %w75.addr, align 8
  %323 = lshr i64 %322, 32
  %324 = trunc i64 %323 to i32
  store i32 %324, i32* %x76.addr, align 4
  %325 = load i32, i32* %x1.addr, align 4
  %326 = load i32, i32* %arg1Limb4.addr, align 4
  %327 = call i64 @p256FiatMulxU32(i32 %325, i32 %326)
  store i64 %327, i64* %w77.addr, align 8
  %328 = load i64, i64* %w77.addr, align 8
  %329 = trunc i64 %328 to i32
  store i32 %329, i32* %x77.addr, align 4
  %330 = load i64, i64* %w77.addr, align 8
  %331 = lshr i64 %330, 32
  %332 = trunc i64 %331 to i32
  store i32 %332, i32* %x78.addr, align 4
  %333 = load i32, i32* %x1.addr, align 4
  %334 = load i32, i32* %arg1Limb3.addr, align 4
  %335 = call i64 @p256FiatMulxU32(i32 %333, i32 %334)
  store i64 %335, i64* %w79.addr, align 8
  %336 = load i64, i64* %w79.addr, align 8
  %337 = trunc i64 %336 to i32
  store i32 %337, i32* %x79.addr, align 4
  %338 = load i64, i64* %w79.addr, align 8
  %339 = lshr i64 %338, 32
  %340 = trunc i64 %339 to i32
  store i32 %340, i32* %x80.addr, align 4
  %341 = load i32, i32* %x1.addr, align 4
  %342 = load i32, i32* %arg1Limb2.addr, align 4
  %343 = call i64 @p256FiatMulxU32(i32 %341, i32 %342)
  store i64 %343, i64* %w81.addr, align 8
  %344 = load i64, i64* %w81.addr, align 8
  %345 = trunc i64 %344 to i32
  store i32 %345, i32* %x81.addr, align 4
  %346 = load i64, i64* %w81.addr, align 8
  %347 = lshr i64 %346, 32
  %348 = trunc i64 %347 to i32
  store i32 %348, i32* %x82.addr, align 4
  %349 = load i32, i32* %x1.addr, align 4
  %350 = load i32, i32* %arg1Limb1.addr, align 4
  %351 = call i64 @p256FiatMulxU32(i32 %349, i32 %350)
  store i64 %351, i64* %w83.addr, align 8
  %352 = load i64, i64* %w83.addr, align 8
  %353 = trunc i64 %352 to i32
  store i32 %353, i32* %x83.addr, align 4
  %354 = load i64, i64* %w83.addr, align 8
  %355 = lshr i64 %354, 32
  %356 = trunc i64 %355 to i32
  store i32 %356, i32* %x84.addr, align 4
  %357 = load i32, i32* %x1.addr, align 4
  %358 = load i32, i32* %arg1Limb0.addr, align 4
  %359 = call i64 @p256FiatMulxU32(i32 %357, i32 %358)
  store i64 %359, i64* %w85.addr, align 8
  %360 = load i64, i64* %w85.addr, align 8
  %361 = trunc i64 %360 to i32
  store i32 %361, i32* %x85.addr, align 4
  %362 = load i64, i64* %w85.addr, align 8
  %363 = lshr i64 %362, 32
  %364 = trunc i64 %363 to i32
  store i32 %364, i32* %x86.addr, align 4
  %365 = load i32, i32* %x86.addr, align 4
  %366 = load i32, i32* %x83.addr, align 4
  %367 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %365, i32 %366)
  store i64 %367, i64* %w87.addr, align 8
  %368 = load i64, i64* %w87.addr, align 8
  %369 = trunc i64 %368 to i32
  store i32 %369, i32* %x87.addr, align 4
  %370 = load i64, i64* %w87.addr, align 8
  %371 = lshr i64 %370, 32
  %372 = trunc i64 %371 to i32
  store i32 %372, i32* %x88.addr, align 4
  %373 = load i32, i32* %x88.addr, align 4
  %374 = load i32, i32* %x84.addr, align 4
  %375 = load i32, i32* %x81.addr, align 4
  %376 = call i64 @p256FiatAddcarryxU32(i32 %373, i32 %374, i32 %375)
  store i64 %376, i64* %w89.addr, align 8
  %377 = load i64, i64* %w89.addr, align 8
  %378 = trunc i64 %377 to i32
  store i32 %378, i32* %x89.addr, align 4
  %379 = load i64, i64* %w89.addr, align 8
  %380 = lshr i64 %379, 32
  %381 = trunc i64 %380 to i32
  store i32 %381, i32* %x90.addr, align 4
  %382 = load i32, i32* %x90.addr, align 4
  %383 = load i32, i32* %x82.addr, align 4
  %384 = load i32, i32* %x79.addr, align 4
  %385 = call i64 @p256FiatAddcarryxU32(i32 %382, i32 %383, i32 %384)
  store i64 %385, i64* %w91.addr, align 8
  %386 = load i64, i64* %w91.addr, align 8
  %387 = trunc i64 %386 to i32
  store i32 %387, i32* %x91.addr, align 4
  %388 = load i64, i64* %w91.addr, align 8
  %389 = lshr i64 %388, 32
  %390 = trunc i64 %389 to i32
  store i32 %390, i32* %x92.addr, align 4
  %391 = load i32, i32* %x92.addr, align 4
  %392 = load i32, i32* %x80.addr, align 4
  %393 = load i32, i32* %x77.addr, align 4
  %394 = call i64 @p256FiatAddcarryxU32(i32 %391, i32 %392, i32 %393)
  store i64 %394, i64* %w93.addr, align 8
  %395 = load i64, i64* %w93.addr, align 8
  %396 = trunc i64 %395 to i32
  store i32 %396, i32* %x93.addr, align 4
  %397 = load i64, i64* %w93.addr, align 8
  %398 = lshr i64 %397, 32
  %399 = trunc i64 %398 to i32
  store i32 %399, i32* %x94.addr, align 4
  %400 = load i32, i32* %x94.addr, align 4
  %401 = load i32, i32* %x78.addr, align 4
  %402 = load i32, i32* %x75.addr, align 4
  %403 = call i64 @p256FiatAddcarryxU32(i32 %400, i32 %401, i32 %402)
  store i64 %403, i64* %w95.addr, align 8
  %404 = load i64, i64* %w95.addr, align 8
  %405 = trunc i64 %404 to i32
  store i32 %405, i32* %x95.addr, align 4
  %406 = load i64, i64* %w95.addr, align 8
  %407 = lshr i64 %406, 32
  %408 = trunc i64 %407 to i32
  store i32 %408, i32* %x96.addr, align 4
  %409 = load i32, i32* %x96.addr, align 4
  %410 = load i32, i32* %x76.addr, align 4
  %411 = load i32, i32* %x73.addr, align 4
  %412 = call i64 @p256FiatAddcarryxU32(i32 %409, i32 %410, i32 %411)
  store i64 %412, i64* %w97.addr, align 8
  %413 = load i64, i64* %w97.addr, align 8
  %414 = trunc i64 %413 to i32
  store i32 %414, i32* %x97.addr, align 4
  %415 = load i64, i64* %w97.addr, align 8
  %416 = lshr i64 %415, 32
  %417 = trunc i64 %416 to i32
  store i32 %417, i32* %x98.addr, align 4
  %418 = load i32, i32* %x98.addr, align 4
  %419 = load i32, i32* %x74.addr, align 4
  %420 = load i32, i32* %x71.addr, align 4
  %421 = call i64 @p256FiatAddcarryxU32(i32 %418, i32 %419, i32 %420)
  store i64 %421, i64* %w99.addr, align 8
  %422 = load i64, i64* %w99.addr, align 8
  %423 = trunc i64 %422 to i32
  store i32 %423, i32* %x99.addr, align 4
  %424 = load i64, i64* %w99.addr, align 8
  %425 = lshr i64 %424, 32
  %426 = trunc i64 %425 to i32
  store i32 %426, i32* %x100.addr, align 4
  %427 = load i32, i32* %x100.addr, align 4
  %428 = load i32, i32* %x72.addr, align 4
  %429 = add i32 %427, %428
  store i32 %429, i32* %x101.addr, align 4
  %430 = load i32, i32* %x55.addr, align 4
  %431 = load i32, i32* %x85.addr, align 4
  %432 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %430, i32 %431)
  store i64 %432, i64* %w102.addr, align 8
  %433 = load i64, i64* %w102.addr, align 8
  %434 = trunc i64 %433 to i32
  store i32 %434, i32* %x102.addr, align 4
  %435 = load i64, i64* %w102.addr, align 8
  %436 = lshr i64 %435, 32
  %437 = trunc i64 %436 to i32
  store i32 %437, i32* %x103.addr, align 4
  %438 = load i32, i32* %x103.addr, align 4
  %439 = load i32, i32* %x57.addr, align 4
  %440 = load i32, i32* %x87.addr, align 4
  %441 = call i64 @p256FiatAddcarryxU32(i32 %438, i32 %439, i32 %440)
  store i64 %441, i64* %w104.addr, align 8
  %442 = load i64, i64* %w104.addr, align 8
  %443 = trunc i64 %442 to i32
  store i32 %443, i32* %x104.addr, align 4
  %444 = load i64, i64* %w104.addr, align 8
  %445 = lshr i64 %444, 32
  %446 = trunc i64 %445 to i32
  store i32 %446, i32* %x105.addr, align 4
  %447 = load i32, i32* %x105.addr, align 4
  %448 = load i32, i32* %x59.addr, align 4
  %449 = load i32, i32* %x89.addr, align 4
  %450 = call i64 @p256FiatAddcarryxU32(i32 %447, i32 %448, i32 %449)
  store i64 %450, i64* %w106.addr, align 8
  %451 = load i64, i64* %w106.addr, align 8
  %452 = trunc i64 %451 to i32
  store i32 %452, i32* %x106.addr, align 4
  %453 = load i64, i64* %w106.addr, align 8
  %454 = lshr i64 %453, 32
  %455 = trunc i64 %454 to i32
  store i32 %455, i32* %x107.addr, align 4
  %456 = load i32, i32* %x107.addr, align 4
  %457 = load i32, i32* %x61.addr, align 4
  %458 = load i32, i32* %x91.addr, align 4
  %459 = call i64 @p256FiatAddcarryxU32(i32 %456, i32 %457, i32 %458)
  store i64 %459, i64* %w108.addr, align 8
  %460 = load i64, i64* %w108.addr, align 8
  %461 = trunc i64 %460 to i32
  store i32 %461, i32* %x108.addr, align 4
  %462 = load i64, i64* %w108.addr, align 8
  %463 = lshr i64 %462, 32
  %464 = trunc i64 %463 to i32
  store i32 %464, i32* %x109.addr, align 4
  %465 = load i32, i32* %x109.addr, align 4
  %466 = load i32, i32* %x63.addr, align 4
  %467 = load i32, i32* %x93.addr, align 4
  %468 = call i64 @p256FiatAddcarryxU32(i32 %465, i32 %466, i32 %467)
  store i64 %468, i64* %w110.addr, align 8
  %469 = load i64, i64* %w110.addr, align 8
  %470 = trunc i64 %469 to i32
  store i32 %470, i32* %x110.addr, align 4
  %471 = load i64, i64* %w110.addr, align 8
  %472 = lshr i64 %471, 32
  %473 = trunc i64 %472 to i32
  store i32 %473, i32* %x111.addr, align 4
  %474 = load i32, i32* %x111.addr, align 4
  %475 = load i32, i32* %x65.addr, align 4
  %476 = load i32, i32* %x95.addr, align 4
  %477 = call i64 @p256FiatAddcarryxU32(i32 %474, i32 %475, i32 %476)
  store i64 %477, i64* %w112.addr, align 8
  %478 = load i64, i64* %w112.addr, align 8
  %479 = trunc i64 %478 to i32
  store i32 %479, i32* %x112.addr, align 4
  %480 = load i64, i64* %w112.addr, align 8
  %481 = lshr i64 %480, 32
  %482 = trunc i64 %481 to i32
  store i32 %482, i32* %x113.addr, align 4
  %483 = load i32, i32* %x113.addr, align 4
  %484 = load i32, i32* %x67.addr, align 4
  %485 = load i32, i32* %x97.addr, align 4
  %486 = call i64 @p256FiatAddcarryxU32(i32 %483, i32 %484, i32 %485)
  store i64 %486, i64* %w114.addr, align 8
  %487 = load i64, i64* %w114.addr, align 8
  %488 = trunc i64 %487 to i32
  store i32 %488, i32* %x114.addr, align 4
  %489 = load i64, i64* %w114.addr, align 8
  %490 = lshr i64 %489, 32
  %491 = trunc i64 %490 to i32
  store i32 %491, i32* %x115.addr, align 4
  %492 = load i32, i32* %x115.addr, align 4
  %493 = load i32, i32* %x69.addr, align 4
  %494 = load i32, i32* %x99.addr, align 4
  %495 = call i64 @p256FiatAddcarryxU32(i32 %492, i32 %493, i32 %494)
  store i64 %495, i64* %w116.addr, align 8
  %496 = load i64, i64* %w116.addr, align 8
  %497 = trunc i64 %496 to i32
  store i32 %497, i32* %x116.addr, align 4
  %498 = load i64, i64* %w116.addr, align 8
  %499 = lshr i64 %498, 32
  %500 = trunc i64 %499 to i32
  store i32 %500, i32* %x117.addr, align 4
  %501 = load i32, i32* %x117.addr, align 4
  %502 = load i32, i32* %x70.addr, align 4
  %503 = load i32, i32* %x101.addr, align 4
  %504 = call i64 @p256FiatAddcarryxU32(i32 %501, i32 %502, i32 %503)
  store i64 %504, i64* %w118.addr, align 8
  %505 = load i64, i64* %w118.addr, align 8
  %506 = trunc i64 %505 to i32
  store i32 %506, i32* %x118.addr, align 4
  %507 = load i64, i64* %w118.addr, align 8
  %508 = lshr i64 %507, 32
  %509 = trunc i64 %508 to i32
  store i32 %509, i32* %x119.addr, align 4
  %510 = load i32, i32* %x102.addr, align 4
  %511 = call i64 @p256FiatMulxU32(i32 %510, i32 4294967295)
  store i64 %511, i64* %w120.addr, align 8
  %512 = load i64, i64* %w120.addr, align 8
  %513 = trunc i64 %512 to i32
  store i32 %513, i32* %x120.addr, align 4
  %514 = load i64, i64* %w120.addr, align 8
  %515 = lshr i64 %514, 32
  %516 = trunc i64 %515 to i32
  store i32 %516, i32* %x121.addr, align 4
  %517 = load i32, i32* %x102.addr, align 4
  %518 = call i64 @p256FiatMulxU32(i32 %517, i32 4294967295)
  store i64 %518, i64* %w122.addr, align 8
  %519 = load i64, i64* %w122.addr, align 8
  %520 = trunc i64 %519 to i32
  store i32 %520, i32* %x122.addr, align 4
  %521 = load i64, i64* %w122.addr, align 8
  %522 = lshr i64 %521, 32
  %523 = trunc i64 %522 to i32
  store i32 %523, i32* %x123.addr, align 4
  %524 = load i32, i32* %x102.addr, align 4
  %525 = call i64 @p256FiatMulxU32(i32 %524, i32 4294967295)
  store i64 %525, i64* %w124.addr, align 8
  %526 = load i64, i64* %w124.addr, align 8
  %527 = trunc i64 %526 to i32
  store i32 %527, i32* %x124.addr, align 4
  %528 = load i64, i64* %w124.addr, align 8
  %529 = lshr i64 %528, 32
  %530 = trunc i64 %529 to i32
  store i32 %530, i32* %x125.addr, align 4
  %531 = load i32, i32* %x102.addr, align 4
  %532 = call i64 @p256FiatMulxU32(i32 %531, i32 4294967295)
  store i64 %532, i64* %w126.addr, align 8
  %533 = load i64, i64* %w126.addr, align 8
  %534 = trunc i64 %533 to i32
  store i32 %534, i32* %x126.addr, align 4
  %535 = load i64, i64* %w126.addr, align 8
  %536 = lshr i64 %535, 32
  %537 = trunc i64 %536 to i32
  store i32 %537, i32* %x127.addr, align 4
  %538 = load i32, i32* %x127.addr, align 4
  %539 = load i32, i32* %x124.addr, align 4
  %540 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %538, i32 %539)
  store i64 %540, i64* %w128.addr, align 8
  %541 = load i64, i64* %w128.addr, align 8
  %542 = trunc i64 %541 to i32
  store i32 %542, i32* %x128.addr, align 4
  %543 = load i64, i64* %w128.addr, align 8
  %544 = lshr i64 %543, 32
  %545 = trunc i64 %544 to i32
  store i32 %545, i32* %x129.addr, align 4
  %546 = load i32, i32* %x129.addr, align 4
  %547 = load i32, i32* %x125.addr, align 4
  %548 = load i32, i32* %x122.addr, align 4
  %549 = call i64 @p256FiatAddcarryxU32(i32 %546, i32 %547, i32 %548)
  store i64 %549, i64* %w130.addr, align 8
  %550 = load i64, i64* %w130.addr, align 8
  %551 = trunc i64 %550 to i32
  store i32 %551, i32* %x130.addr, align 4
  %552 = load i64, i64* %w130.addr, align 8
  %553 = lshr i64 %552, 32
  %554 = trunc i64 %553 to i32
  store i32 %554, i32* %x131.addr, align 4
  %555 = load i32, i32* %x131.addr, align 4
  %556 = load i32, i32* %x123.addr, align 4
  %557 = add i32 %555, %556
  store i32 %557, i32* %x132.addr, align 4
  %558 = load i32, i32* %x102.addr, align 4
  %559 = load i32, i32* %x126.addr, align 4
  %560 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %558, i32 %559)
  store i64 %560, i64* %w133.addr, align 8
  %561 = load i64, i64* %w133.addr, align 8
  %562 = lshr i64 %561, 32
  %563 = trunc i64 %562 to i32
  store i32 %563, i32* %x134.addr, align 4
  %564 = load i32, i32* %x134.addr, align 4
  %565 = load i32, i32* %x104.addr, align 4
  %566 = load i32, i32* %x128.addr, align 4
  %567 = call i64 @p256FiatAddcarryxU32(i32 %564, i32 %565, i32 %566)
  store i64 %567, i64* %w135.addr, align 8
  %568 = load i64, i64* %w135.addr, align 8
  %569 = trunc i64 %568 to i32
  store i32 %569, i32* %x135.addr, align 4
  %570 = load i64, i64* %w135.addr, align 8
  %571 = lshr i64 %570, 32
  %572 = trunc i64 %571 to i32
  store i32 %572, i32* %x136.addr, align 4
  %573 = load i32, i32* %x136.addr, align 4
  %574 = load i32, i32* %x106.addr, align 4
  %575 = load i32, i32* %x130.addr, align 4
  %576 = call i64 @p256FiatAddcarryxU32(i32 %573, i32 %574, i32 %575)
  store i64 %576, i64* %w137.addr, align 8
  %577 = load i64, i64* %w137.addr, align 8
  %578 = trunc i64 %577 to i32
  store i32 %578, i32* %x137.addr, align 4
  %579 = load i64, i64* %w137.addr, align 8
  %580 = lshr i64 %579, 32
  %581 = trunc i64 %580 to i32
  store i32 %581, i32* %x138.addr, align 4
  %582 = load i32, i32* %x138.addr, align 4
  %583 = load i32, i32* %x108.addr, align 4
  %584 = load i32, i32* %x132.addr, align 4
  %585 = call i64 @p256FiatAddcarryxU32(i32 %582, i32 %583, i32 %584)
  store i64 %585, i64* %w139.addr, align 8
  %586 = load i64, i64* %w139.addr, align 8
  %587 = trunc i64 %586 to i32
  store i32 %587, i32* %x139.addr, align 4
  %588 = load i64, i64* %w139.addr, align 8
  %589 = lshr i64 %588, 32
  %590 = trunc i64 %589 to i32
  store i32 %590, i32* %x140.addr, align 4
  %591 = load i32, i32* %x140.addr, align 4
  %592 = load i32, i32* %x110.addr, align 4
  %593 = call i64 @p256FiatAddcarryxU32(i32 %591, i32 %592, i32 0)
  store i64 %593, i64* %w141.addr, align 8
  %594 = load i64, i64* %w141.addr, align 8
  %595 = trunc i64 %594 to i32
  store i32 %595, i32* %x141.addr, align 4
  %596 = load i64, i64* %w141.addr, align 8
  %597 = lshr i64 %596, 32
  %598 = trunc i64 %597 to i32
  store i32 %598, i32* %x142.addr, align 4
  %599 = load i32, i32* %x142.addr, align 4
  %600 = load i32, i32* %x112.addr, align 4
  %601 = call i64 @p256FiatAddcarryxU32(i32 %599, i32 %600, i32 0)
  store i64 %601, i64* %w143.addr, align 8
  %602 = load i64, i64* %w143.addr, align 8
  %603 = trunc i64 %602 to i32
  store i32 %603, i32* %x143.addr, align 4
  %604 = load i64, i64* %w143.addr, align 8
  %605 = lshr i64 %604, 32
  %606 = trunc i64 %605 to i32
  store i32 %606, i32* %x144.addr, align 4
  %607 = load i32, i32* %x144.addr, align 4
  %608 = load i32, i32* %x114.addr, align 4
  %609 = load i32, i32* %x102.addr, align 4
  %610 = call i64 @p256FiatAddcarryxU32(i32 %607, i32 %608, i32 %609)
  store i64 %610, i64* %w145.addr, align 8
  %611 = load i64, i64* %w145.addr, align 8
  %612 = trunc i64 %611 to i32
  store i32 %612, i32* %x145.addr, align 4
  %613 = load i64, i64* %w145.addr, align 8
  %614 = lshr i64 %613, 32
  %615 = trunc i64 %614 to i32
  store i32 %615, i32* %x146.addr, align 4
  %616 = load i32, i32* %x146.addr, align 4
  %617 = load i32, i32* %x116.addr, align 4
  %618 = load i32, i32* %x120.addr, align 4
  %619 = call i64 @p256FiatAddcarryxU32(i32 %616, i32 %617, i32 %618)
  store i64 %619, i64* %w147.addr, align 8
  %620 = load i64, i64* %w147.addr, align 8
  %621 = trunc i64 %620 to i32
  store i32 %621, i32* %x147.addr, align 4
  %622 = load i64, i64* %w147.addr, align 8
  %623 = lshr i64 %622, 32
  %624 = trunc i64 %623 to i32
  store i32 %624, i32* %x148.addr, align 4
  %625 = load i32, i32* %x148.addr, align 4
  %626 = load i32, i32* %x118.addr, align 4
  %627 = load i32, i32* %x121.addr, align 4
  %628 = call i64 @p256FiatAddcarryxU32(i32 %625, i32 %626, i32 %627)
  store i64 %628, i64* %w149.addr, align 8
  %629 = load i64, i64* %w149.addr, align 8
  %630 = trunc i64 %629 to i32
  store i32 %630, i32* %x149.addr, align 4
  %631 = load i64, i64* %w149.addr, align 8
  %632 = lshr i64 %631, 32
  %633 = trunc i64 %632 to i32
  store i32 %633, i32* %x150.addr, align 4
  %634 = load i32, i32* %x150.addr, align 4
  %635 = load i32, i32* %x119.addr, align 4
  %636 = add i32 %634, %635
  store i32 %636, i32* %x151.addr, align 4
  %637 = load i32, i32* %x2.addr, align 4
  %638 = load i32, i32* %arg1Limb7.addr, align 4
  %639 = call i64 @p256FiatMulxU32(i32 %637, i32 %638)
  store i64 %639, i64* %w152.addr, align 8
  %640 = load i64, i64* %w152.addr, align 8
  %641 = trunc i64 %640 to i32
  store i32 %641, i32* %x152.addr, align 4
  %642 = load i64, i64* %w152.addr, align 8
  %643 = lshr i64 %642, 32
  %644 = trunc i64 %643 to i32
  store i32 %644, i32* %x153.addr, align 4
  %645 = load i32, i32* %x2.addr, align 4
  %646 = load i32, i32* %arg1Limb6.addr, align 4
  %647 = call i64 @p256FiatMulxU32(i32 %645, i32 %646)
  store i64 %647, i64* %w154.addr, align 8
  %648 = load i64, i64* %w154.addr, align 8
  %649 = trunc i64 %648 to i32
  store i32 %649, i32* %x154.addr, align 4
  %650 = load i64, i64* %w154.addr, align 8
  %651 = lshr i64 %650, 32
  %652 = trunc i64 %651 to i32
  store i32 %652, i32* %x155.addr, align 4
  %653 = load i32, i32* %x2.addr, align 4
  %654 = load i32, i32* %arg1Limb5.addr, align 4
  %655 = call i64 @p256FiatMulxU32(i32 %653, i32 %654)
  store i64 %655, i64* %w156.addr, align 8
  %656 = load i64, i64* %w156.addr, align 8
  %657 = trunc i64 %656 to i32
  store i32 %657, i32* %x156.addr, align 4
  %658 = load i64, i64* %w156.addr, align 8
  %659 = lshr i64 %658, 32
  %660 = trunc i64 %659 to i32
  store i32 %660, i32* %x157.addr, align 4
  %661 = load i32, i32* %x2.addr, align 4
  %662 = load i32, i32* %arg1Limb4.addr, align 4
  %663 = call i64 @p256FiatMulxU32(i32 %661, i32 %662)
  store i64 %663, i64* %w158.addr, align 8
  %664 = load i64, i64* %w158.addr, align 8
  %665 = trunc i64 %664 to i32
  store i32 %665, i32* %x158.addr, align 4
  %666 = load i64, i64* %w158.addr, align 8
  %667 = lshr i64 %666, 32
  %668 = trunc i64 %667 to i32
  store i32 %668, i32* %x159.addr, align 4
  %669 = load i32, i32* %x2.addr, align 4
  %670 = load i32, i32* %arg1Limb3.addr, align 4
  %671 = call i64 @p256FiatMulxU32(i32 %669, i32 %670)
  store i64 %671, i64* %w160.addr, align 8
  %672 = load i64, i64* %w160.addr, align 8
  %673 = trunc i64 %672 to i32
  store i32 %673, i32* %x160.addr, align 4
  %674 = load i64, i64* %w160.addr, align 8
  %675 = lshr i64 %674, 32
  %676 = trunc i64 %675 to i32
  store i32 %676, i32* %x161.addr, align 4
  %677 = load i32, i32* %x2.addr, align 4
  %678 = load i32, i32* %arg1Limb2.addr, align 4
  %679 = call i64 @p256FiatMulxU32(i32 %677, i32 %678)
  store i64 %679, i64* %w162.addr, align 8
  %680 = load i64, i64* %w162.addr, align 8
  %681 = trunc i64 %680 to i32
  store i32 %681, i32* %x162.addr, align 4
  %682 = load i64, i64* %w162.addr, align 8
  %683 = lshr i64 %682, 32
  %684 = trunc i64 %683 to i32
  store i32 %684, i32* %x163.addr, align 4
  %685 = load i32, i32* %x2.addr, align 4
  %686 = load i32, i32* %arg1Limb1.addr, align 4
  %687 = call i64 @p256FiatMulxU32(i32 %685, i32 %686)
  store i64 %687, i64* %w164.addr, align 8
  %688 = load i64, i64* %w164.addr, align 8
  %689 = trunc i64 %688 to i32
  store i32 %689, i32* %x164.addr, align 4
  %690 = load i64, i64* %w164.addr, align 8
  %691 = lshr i64 %690, 32
  %692 = trunc i64 %691 to i32
  store i32 %692, i32* %x165.addr, align 4
  %693 = load i32, i32* %x2.addr, align 4
  %694 = load i32, i32* %arg1Limb0.addr, align 4
  %695 = call i64 @p256FiatMulxU32(i32 %693, i32 %694)
  store i64 %695, i64* %w166.addr, align 8
  %696 = load i64, i64* %w166.addr, align 8
  %697 = trunc i64 %696 to i32
  store i32 %697, i32* %x166.addr, align 4
  %698 = load i64, i64* %w166.addr, align 8
  %699 = lshr i64 %698, 32
  %700 = trunc i64 %699 to i32
  store i32 %700, i32* %x167.addr, align 4
  %701 = load i32, i32* %x167.addr, align 4
  %702 = load i32, i32* %x164.addr, align 4
  %703 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %701, i32 %702)
  store i64 %703, i64* %w168.addr, align 8
  %704 = load i64, i64* %w168.addr, align 8
  %705 = trunc i64 %704 to i32
  store i32 %705, i32* %x168.addr, align 4
  %706 = load i64, i64* %w168.addr, align 8
  %707 = lshr i64 %706, 32
  %708 = trunc i64 %707 to i32
  store i32 %708, i32* %x169.addr, align 4
  %709 = load i32, i32* %x169.addr, align 4
  %710 = load i32, i32* %x165.addr, align 4
  %711 = load i32, i32* %x162.addr, align 4
  %712 = call i64 @p256FiatAddcarryxU32(i32 %709, i32 %710, i32 %711)
  store i64 %712, i64* %w170.addr, align 8
  %713 = load i64, i64* %w170.addr, align 8
  %714 = trunc i64 %713 to i32
  store i32 %714, i32* %x170.addr, align 4
  %715 = load i64, i64* %w170.addr, align 8
  %716 = lshr i64 %715, 32
  %717 = trunc i64 %716 to i32
  store i32 %717, i32* %x171.addr, align 4
  %718 = load i32, i32* %x171.addr, align 4
  %719 = load i32, i32* %x163.addr, align 4
  %720 = load i32, i32* %x160.addr, align 4
  %721 = call i64 @p256FiatAddcarryxU32(i32 %718, i32 %719, i32 %720)
  store i64 %721, i64* %w172.addr, align 8
  %722 = load i64, i64* %w172.addr, align 8
  %723 = trunc i64 %722 to i32
  store i32 %723, i32* %x172.addr, align 4
  %724 = load i64, i64* %w172.addr, align 8
  %725 = lshr i64 %724, 32
  %726 = trunc i64 %725 to i32
  store i32 %726, i32* %x173.addr, align 4
  %727 = load i32, i32* %x173.addr, align 4
  %728 = load i32, i32* %x161.addr, align 4
  %729 = load i32, i32* %x158.addr, align 4
  %730 = call i64 @p256FiatAddcarryxU32(i32 %727, i32 %728, i32 %729)
  store i64 %730, i64* %w174.addr, align 8
  %731 = load i64, i64* %w174.addr, align 8
  %732 = trunc i64 %731 to i32
  store i32 %732, i32* %x174.addr, align 4
  %733 = load i64, i64* %w174.addr, align 8
  %734 = lshr i64 %733, 32
  %735 = trunc i64 %734 to i32
  store i32 %735, i32* %x175.addr, align 4
  %736 = load i32, i32* %x175.addr, align 4
  %737 = load i32, i32* %x159.addr, align 4
  %738 = load i32, i32* %x156.addr, align 4
  %739 = call i64 @p256FiatAddcarryxU32(i32 %736, i32 %737, i32 %738)
  store i64 %739, i64* %w176.addr, align 8
  %740 = load i64, i64* %w176.addr, align 8
  %741 = trunc i64 %740 to i32
  store i32 %741, i32* %x176.addr, align 4
  %742 = load i64, i64* %w176.addr, align 8
  %743 = lshr i64 %742, 32
  %744 = trunc i64 %743 to i32
  store i32 %744, i32* %x177.addr, align 4
  %745 = load i32, i32* %x177.addr, align 4
  %746 = load i32, i32* %x157.addr, align 4
  %747 = load i32, i32* %x154.addr, align 4
  %748 = call i64 @p256FiatAddcarryxU32(i32 %745, i32 %746, i32 %747)
  store i64 %748, i64* %w178.addr, align 8
  %749 = load i64, i64* %w178.addr, align 8
  %750 = trunc i64 %749 to i32
  store i32 %750, i32* %x178.addr, align 4
  %751 = load i64, i64* %w178.addr, align 8
  %752 = lshr i64 %751, 32
  %753 = trunc i64 %752 to i32
  store i32 %753, i32* %x179.addr, align 4
  %754 = load i32, i32* %x179.addr, align 4
  %755 = load i32, i32* %x155.addr, align 4
  %756 = load i32, i32* %x152.addr, align 4
  %757 = call i64 @p256FiatAddcarryxU32(i32 %754, i32 %755, i32 %756)
  store i64 %757, i64* %w180.addr, align 8
  %758 = load i64, i64* %w180.addr, align 8
  %759 = trunc i64 %758 to i32
  store i32 %759, i32* %x180.addr, align 4
  %760 = load i64, i64* %w180.addr, align 8
  %761 = lshr i64 %760, 32
  %762 = trunc i64 %761 to i32
  store i32 %762, i32* %x181.addr, align 4
  %763 = load i32, i32* %x181.addr, align 4
  %764 = load i32, i32* %x153.addr, align 4
  %765 = add i32 %763, %764
  store i32 %765, i32* %x182.addr, align 4
  %766 = load i32, i32* %x135.addr, align 4
  %767 = load i32, i32* %x166.addr, align 4
  %768 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %766, i32 %767)
  store i64 %768, i64* %w183.addr, align 8
  %769 = load i64, i64* %w183.addr, align 8
  %770 = trunc i64 %769 to i32
  store i32 %770, i32* %x183.addr, align 4
  %771 = load i64, i64* %w183.addr, align 8
  %772 = lshr i64 %771, 32
  %773 = trunc i64 %772 to i32
  store i32 %773, i32* %x184.addr, align 4
  %774 = load i32, i32* %x184.addr, align 4
  %775 = load i32, i32* %x137.addr, align 4
  %776 = load i32, i32* %x168.addr, align 4
  %777 = call i64 @p256FiatAddcarryxU32(i32 %774, i32 %775, i32 %776)
  store i64 %777, i64* %w185.addr, align 8
  %778 = load i64, i64* %w185.addr, align 8
  %779 = trunc i64 %778 to i32
  store i32 %779, i32* %x185.addr, align 4
  %780 = load i64, i64* %w185.addr, align 8
  %781 = lshr i64 %780, 32
  %782 = trunc i64 %781 to i32
  store i32 %782, i32* %x186.addr, align 4
  %783 = load i32, i32* %x186.addr, align 4
  %784 = load i32, i32* %x139.addr, align 4
  %785 = load i32, i32* %x170.addr, align 4
  %786 = call i64 @p256FiatAddcarryxU32(i32 %783, i32 %784, i32 %785)
  store i64 %786, i64* %w187.addr, align 8
  %787 = load i64, i64* %w187.addr, align 8
  %788 = trunc i64 %787 to i32
  store i32 %788, i32* %x187.addr, align 4
  %789 = load i64, i64* %w187.addr, align 8
  %790 = lshr i64 %789, 32
  %791 = trunc i64 %790 to i32
  store i32 %791, i32* %x188.addr, align 4
  %792 = load i32, i32* %x188.addr, align 4
  %793 = load i32, i32* %x141.addr, align 4
  %794 = load i32, i32* %x172.addr, align 4
  %795 = call i64 @p256FiatAddcarryxU32(i32 %792, i32 %793, i32 %794)
  store i64 %795, i64* %w189.addr, align 8
  %796 = load i64, i64* %w189.addr, align 8
  %797 = trunc i64 %796 to i32
  store i32 %797, i32* %x189.addr, align 4
  %798 = load i64, i64* %w189.addr, align 8
  %799 = lshr i64 %798, 32
  %800 = trunc i64 %799 to i32
  store i32 %800, i32* %x190.addr, align 4
  %801 = load i32, i32* %x190.addr, align 4
  %802 = load i32, i32* %x143.addr, align 4
  %803 = load i32, i32* %x174.addr, align 4
  %804 = call i64 @p256FiatAddcarryxU32(i32 %801, i32 %802, i32 %803)
  store i64 %804, i64* %w191.addr, align 8
  %805 = load i64, i64* %w191.addr, align 8
  %806 = trunc i64 %805 to i32
  store i32 %806, i32* %x191.addr, align 4
  %807 = load i64, i64* %w191.addr, align 8
  %808 = lshr i64 %807, 32
  %809 = trunc i64 %808 to i32
  store i32 %809, i32* %x192.addr, align 4
  %810 = load i32, i32* %x192.addr, align 4
  %811 = load i32, i32* %x145.addr, align 4
  %812 = load i32, i32* %x176.addr, align 4
  %813 = call i64 @p256FiatAddcarryxU32(i32 %810, i32 %811, i32 %812)
  store i64 %813, i64* %w193.addr, align 8
  %814 = load i64, i64* %w193.addr, align 8
  %815 = trunc i64 %814 to i32
  store i32 %815, i32* %x193.addr, align 4
  %816 = load i64, i64* %w193.addr, align 8
  %817 = lshr i64 %816, 32
  %818 = trunc i64 %817 to i32
  store i32 %818, i32* %x194.addr, align 4
  %819 = load i32, i32* %x194.addr, align 4
  %820 = load i32, i32* %x147.addr, align 4
  %821 = load i32, i32* %x178.addr, align 4
  %822 = call i64 @p256FiatAddcarryxU32(i32 %819, i32 %820, i32 %821)
  store i64 %822, i64* %w195.addr, align 8
  %823 = load i64, i64* %w195.addr, align 8
  %824 = trunc i64 %823 to i32
  store i32 %824, i32* %x195.addr, align 4
  %825 = load i64, i64* %w195.addr, align 8
  %826 = lshr i64 %825, 32
  %827 = trunc i64 %826 to i32
  store i32 %827, i32* %x196.addr, align 4
  %828 = load i32, i32* %x196.addr, align 4
  %829 = load i32, i32* %x149.addr, align 4
  %830 = load i32, i32* %x180.addr, align 4
  %831 = call i64 @p256FiatAddcarryxU32(i32 %828, i32 %829, i32 %830)
  store i64 %831, i64* %w197.addr, align 8
  %832 = load i64, i64* %w197.addr, align 8
  %833 = trunc i64 %832 to i32
  store i32 %833, i32* %x197.addr, align 4
  %834 = load i64, i64* %w197.addr, align 8
  %835 = lshr i64 %834, 32
  %836 = trunc i64 %835 to i32
  store i32 %836, i32* %x198.addr, align 4
  %837 = load i32, i32* %x198.addr, align 4
  %838 = load i32, i32* %x151.addr, align 4
  %839 = load i32, i32* %x182.addr, align 4
  %840 = call i64 @p256FiatAddcarryxU32(i32 %837, i32 %838, i32 %839)
  store i64 %840, i64* %w199.addr, align 8
  %841 = load i64, i64* %w199.addr, align 8
  %842 = trunc i64 %841 to i32
  store i32 %842, i32* %x199.addr, align 4
  %843 = load i64, i64* %w199.addr, align 8
  %844 = lshr i64 %843, 32
  %845 = trunc i64 %844 to i32
  store i32 %845, i32* %x200.addr, align 4
  %846 = load i32, i32* %x183.addr, align 4
  %847 = call i64 @p256FiatMulxU32(i32 %846, i32 4294967295)
  store i64 %847, i64* %w201.addr, align 8
  %848 = load i64, i64* %w201.addr, align 8
  %849 = trunc i64 %848 to i32
  store i32 %849, i32* %x201.addr, align 4
  %850 = load i64, i64* %w201.addr, align 8
  %851 = lshr i64 %850, 32
  %852 = trunc i64 %851 to i32
  store i32 %852, i32* %x202.addr, align 4
  %853 = load i32, i32* %x183.addr, align 4
  %854 = call i64 @p256FiatMulxU32(i32 %853, i32 4294967295)
  store i64 %854, i64* %w203.addr, align 8
  %855 = load i64, i64* %w203.addr, align 8
  %856 = trunc i64 %855 to i32
  store i32 %856, i32* %x203.addr, align 4
  %857 = load i64, i64* %w203.addr, align 8
  %858 = lshr i64 %857, 32
  %859 = trunc i64 %858 to i32
  store i32 %859, i32* %x204.addr, align 4
  %860 = load i32, i32* %x183.addr, align 4
  %861 = call i64 @p256FiatMulxU32(i32 %860, i32 4294967295)
  store i64 %861, i64* %w205.addr, align 8
  %862 = load i64, i64* %w205.addr, align 8
  %863 = trunc i64 %862 to i32
  store i32 %863, i32* %x205.addr, align 4
  %864 = load i64, i64* %w205.addr, align 8
  %865 = lshr i64 %864, 32
  %866 = trunc i64 %865 to i32
  store i32 %866, i32* %x206.addr, align 4
  %867 = load i32, i32* %x183.addr, align 4
  %868 = call i64 @p256FiatMulxU32(i32 %867, i32 4294967295)
  store i64 %868, i64* %w207.addr, align 8
  %869 = load i64, i64* %w207.addr, align 8
  %870 = trunc i64 %869 to i32
  store i32 %870, i32* %x207.addr, align 4
  %871 = load i64, i64* %w207.addr, align 8
  %872 = lshr i64 %871, 32
  %873 = trunc i64 %872 to i32
  store i32 %873, i32* %x208.addr, align 4
  %874 = load i32, i32* %x208.addr, align 4
  %875 = load i32, i32* %x205.addr, align 4
  %876 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %874, i32 %875)
  store i64 %876, i64* %w209.addr, align 8
  %877 = load i64, i64* %w209.addr, align 8
  %878 = trunc i64 %877 to i32
  store i32 %878, i32* %x209.addr, align 4
  %879 = load i64, i64* %w209.addr, align 8
  %880 = lshr i64 %879, 32
  %881 = trunc i64 %880 to i32
  store i32 %881, i32* %x210.addr, align 4
  %882 = load i32, i32* %x210.addr, align 4
  %883 = load i32, i32* %x206.addr, align 4
  %884 = load i32, i32* %x203.addr, align 4
  %885 = call i64 @p256FiatAddcarryxU32(i32 %882, i32 %883, i32 %884)
  store i64 %885, i64* %w211.addr, align 8
  %886 = load i64, i64* %w211.addr, align 8
  %887 = trunc i64 %886 to i32
  store i32 %887, i32* %x211.addr, align 4
  %888 = load i64, i64* %w211.addr, align 8
  %889 = lshr i64 %888, 32
  %890 = trunc i64 %889 to i32
  store i32 %890, i32* %x212.addr, align 4
  %891 = load i32, i32* %x212.addr, align 4
  %892 = load i32, i32* %x204.addr, align 4
  %893 = add i32 %891, %892
  store i32 %893, i32* %x213.addr, align 4
  %894 = load i32, i32* %x183.addr, align 4
  %895 = load i32, i32* %x207.addr, align 4
  %896 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %894, i32 %895)
  store i64 %896, i64* %w214.addr, align 8
  %897 = load i64, i64* %w214.addr, align 8
  %898 = lshr i64 %897, 32
  %899 = trunc i64 %898 to i32
  store i32 %899, i32* %x215.addr, align 4
  %900 = load i32, i32* %x215.addr, align 4
  %901 = load i32, i32* %x185.addr, align 4
  %902 = load i32, i32* %x209.addr, align 4
  %903 = call i64 @p256FiatAddcarryxU32(i32 %900, i32 %901, i32 %902)
  store i64 %903, i64* %w216.addr, align 8
  %904 = load i64, i64* %w216.addr, align 8
  %905 = trunc i64 %904 to i32
  store i32 %905, i32* %x216.addr, align 4
  %906 = load i64, i64* %w216.addr, align 8
  %907 = lshr i64 %906, 32
  %908 = trunc i64 %907 to i32
  store i32 %908, i32* %x217.addr, align 4
  %909 = load i32, i32* %x217.addr, align 4
  %910 = load i32, i32* %x187.addr, align 4
  %911 = load i32, i32* %x211.addr, align 4
  %912 = call i64 @p256FiatAddcarryxU32(i32 %909, i32 %910, i32 %911)
  store i64 %912, i64* %w218.addr, align 8
  %913 = load i64, i64* %w218.addr, align 8
  %914 = trunc i64 %913 to i32
  store i32 %914, i32* %x218.addr, align 4
  %915 = load i64, i64* %w218.addr, align 8
  %916 = lshr i64 %915, 32
  %917 = trunc i64 %916 to i32
  store i32 %917, i32* %x219.addr, align 4
  %918 = load i32, i32* %x219.addr, align 4
  %919 = load i32, i32* %x189.addr, align 4
  %920 = load i32, i32* %x213.addr, align 4
  %921 = call i64 @p256FiatAddcarryxU32(i32 %918, i32 %919, i32 %920)
  store i64 %921, i64* %w220.addr, align 8
  %922 = load i64, i64* %w220.addr, align 8
  %923 = trunc i64 %922 to i32
  store i32 %923, i32* %x220.addr, align 4
  %924 = load i64, i64* %w220.addr, align 8
  %925 = lshr i64 %924, 32
  %926 = trunc i64 %925 to i32
  store i32 %926, i32* %x221.addr, align 4
  %927 = load i32, i32* %x221.addr, align 4
  %928 = load i32, i32* %x191.addr, align 4
  %929 = call i64 @p256FiatAddcarryxU32(i32 %927, i32 %928, i32 0)
  store i64 %929, i64* %w222.addr, align 8
  %930 = load i64, i64* %w222.addr, align 8
  %931 = trunc i64 %930 to i32
  store i32 %931, i32* %x222.addr, align 4
  %932 = load i64, i64* %w222.addr, align 8
  %933 = lshr i64 %932, 32
  %934 = trunc i64 %933 to i32
  store i32 %934, i32* %x223.addr, align 4
  %935 = load i32, i32* %x223.addr, align 4
  %936 = load i32, i32* %x193.addr, align 4
  %937 = call i64 @p256FiatAddcarryxU32(i32 %935, i32 %936, i32 0)
  store i64 %937, i64* %w224.addr, align 8
  %938 = load i64, i64* %w224.addr, align 8
  %939 = trunc i64 %938 to i32
  store i32 %939, i32* %x224.addr, align 4
  %940 = load i64, i64* %w224.addr, align 8
  %941 = lshr i64 %940, 32
  %942 = trunc i64 %941 to i32
  store i32 %942, i32* %x225.addr, align 4
  %943 = load i32, i32* %x225.addr, align 4
  %944 = load i32, i32* %x195.addr, align 4
  %945 = load i32, i32* %x183.addr, align 4
  %946 = call i64 @p256FiatAddcarryxU32(i32 %943, i32 %944, i32 %945)
  store i64 %946, i64* %w226.addr, align 8
  %947 = load i64, i64* %w226.addr, align 8
  %948 = trunc i64 %947 to i32
  store i32 %948, i32* %x226.addr, align 4
  %949 = load i64, i64* %w226.addr, align 8
  %950 = lshr i64 %949, 32
  %951 = trunc i64 %950 to i32
  store i32 %951, i32* %x227.addr, align 4
  %952 = load i32, i32* %x227.addr, align 4
  %953 = load i32, i32* %x197.addr, align 4
  %954 = load i32, i32* %x201.addr, align 4
  %955 = call i64 @p256FiatAddcarryxU32(i32 %952, i32 %953, i32 %954)
  store i64 %955, i64* %w228.addr, align 8
  %956 = load i64, i64* %w228.addr, align 8
  %957 = trunc i64 %956 to i32
  store i32 %957, i32* %x228.addr, align 4
  %958 = load i64, i64* %w228.addr, align 8
  %959 = lshr i64 %958, 32
  %960 = trunc i64 %959 to i32
  store i32 %960, i32* %x229.addr, align 4
  %961 = load i32, i32* %x229.addr, align 4
  %962 = load i32, i32* %x199.addr, align 4
  %963 = load i32, i32* %x202.addr, align 4
  %964 = call i64 @p256FiatAddcarryxU32(i32 %961, i32 %962, i32 %963)
  store i64 %964, i64* %w230.addr, align 8
  %965 = load i64, i64* %w230.addr, align 8
  %966 = trunc i64 %965 to i32
  store i32 %966, i32* %x230.addr, align 4
  %967 = load i64, i64* %w230.addr, align 8
  %968 = lshr i64 %967, 32
  %969 = trunc i64 %968 to i32
  store i32 %969, i32* %x231.addr, align 4
  %970 = load i32, i32* %x231.addr, align 4
  %971 = load i32, i32* %x200.addr, align 4
  %972 = add i32 %970, %971
  store i32 %972, i32* %x232.addr, align 4
  %973 = load i32, i32* %x3.addr, align 4
  %974 = load i32, i32* %arg1Limb7.addr, align 4
  %975 = call i64 @p256FiatMulxU32(i32 %973, i32 %974)
  store i64 %975, i64* %w233.addr, align 8
  %976 = load i64, i64* %w233.addr, align 8
  %977 = trunc i64 %976 to i32
  store i32 %977, i32* %x233.addr, align 4
  %978 = load i64, i64* %w233.addr, align 8
  %979 = lshr i64 %978, 32
  %980 = trunc i64 %979 to i32
  store i32 %980, i32* %x234.addr, align 4
  %981 = load i32, i32* %x3.addr, align 4
  %982 = load i32, i32* %arg1Limb6.addr, align 4
  %983 = call i64 @p256FiatMulxU32(i32 %981, i32 %982)
  store i64 %983, i64* %w235.addr, align 8
  %984 = load i64, i64* %w235.addr, align 8
  %985 = trunc i64 %984 to i32
  store i32 %985, i32* %x235.addr, align 4
  %986 = load i64, i64* %w235.addr, align 8
  %987 = lshr i64 %986, 32
  %988 = trunc i64 %987 to i32
  store i32 %988, i32* %x236.addr, align 4
  %989 = load i32, i32* %x3.addr, align 4
  %990 = load i32, i32* %arg1Limb5.addr, align 4
  %991 = call i64 @p256FiatMulxU32(i32 %989, i32 %990)
  store i64 %991, i64* %w237.addr, align 8
  %992 = load i64, i64* %w237.addr, align 8
  %993 = trunc i64 %992 to i32
  store i32 %993, i32* %x237.addr, align 4
  %994 = load i64, i64* %w237.addr, align 8
  %995 = lshr i64 %994, 32
  %996 = trunc i64 %995 to i32
  store i32 %996, i32* %x238.addr, align 4
  %997 = load i32, i32* %x3.addr, align 4
  %998 = load i32, i32* %arg1Limb4.addr, align 4
  %999 = call i64 @p256FiatMulxU32(i32 %997, i32 %998)
  store i64 %999, i64* %w239.addr, align 8
  %1000 = load i64, i64* %w239.addr, align 8
  %1001 = trunc i64 %1000 to i32
  store i32 %1001, i32* %x239.addr, align 4
  %1002 = load i64, i64* %w239.addr, align 8
  %1003 = lshr i64 %1002, 32
  %1004 = trunc i64 %1003 to i32
  store i32 %1004, i32* %x240.addr, align 4
  %1005 = load i32, i32* %x3.addr, align 4
  %1006 = load i32, i32* %arg1Limb3.addr, align 4
  %1007 = call i64 @p256FiatMulxU32(i32 %1005, i32 %1006)
  store i64 %1007, i64* %w241.addr, align 8
  %1008 = load i64, i64* %w241.addr, align 8
  %1009 = trunc i64 %1008 to i32
  store i32 %1009, i32* %x241.addr, align 4
  %1010 = load i64, i64* %w241.addr, align 8
  %1011 = lshr i64 %1010, 32
  %1012 = trunc i64 %1011 to i32
  store i32 %1012, i32* %x242.addr, align 4
  %1013 = load i32, i32* %x3.addr, align 4
  %1014 = load i32, i32* %arg1Limb2.addr, align 4
  %1015 = call i64 @p256FiatMulxU32(i32 %1013, i32 %1014)
  store i64 %1015, i64* %w243.addr, align 8
  %1016 = load i64, i64* %w243.addr, align 8
  %1017 = trunc i64 %1016 to i32
  store i32 %1017, i32* %x243.addr, align 4
  %1018 = load i64, i64* %w243.addr, align 8
  %1019 = lshr i64 %1018, 32
  %1020 = trunc i64 %1019 to i32
  store i32 %1020, i32* %x244.addr, align 4
  %1021 = load i32, i32* %x3.addr, align 4
  %1022 = load i32, i32* %arg1Limb1.addr, align 4
  %1023 = call i64 @p256FiatMulxU32(i32 %1021, i32 %1022)
  store i64 %1023, i64* %w245.addr, align 8
  %1024 = load i64, i64* %w245.addr, align 8
  %1025 = trunc i64 %1024 to i32
  store i32 %1025, i32* %x245.addr, align 4
  %1026 = load i64, i64* %w245.addr, align 8
  %1027 = lshr i64 %1026, 32
  %1028 = trunc i64 %1027 to i32
  store i32 %1028, i32* %x246.addr, align 4
  %1029 = load i32, i32* %x3.addr, align 4
  %1030 = load i32, i32* %arg1Limb0.addr, align 4
  %1031 = call i64 @p256FiatMulxU32(i32 %1029, i32 %1030)
  store i64 %1031, i64* %w247.addr, align 8
  %1032 = load i64, i64* %w247.addr, align 8
  %1033 = trunc i64 %1032 to i32
  store i32 %1033, i32* %x247.addr, align 4
  %1034 = load i64, i64* %w247.addr, align 8
  %1035 = lshr i64 %1034, 32
  %1036 = trunc i64 %1035 to i32
  store i32 %1036, i32* %x248.addr, align 4
  %1037 = load i32, i32* %x248.addr, align 4
  %1038 = load i32, i32* %x245.addr, align 4
  %1039 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1037, i32 %1038)
  store i64 %1039, i64* %w249.addr, align 8
  %1040 = load i64, i64* %w249.addr, align 8
  %1041 = trunc i64 %1040 to i32
  store i32 %1041, i32* %x249.addr, align 4
  %1042 = load i64, i64* %w249.addr, align 8
  %1043 = lshr i64 %1042, 32
  %1044 = trunc i64 %1043 to i32
  store i32 %1044, i32* %x250.addr, align 4
  %1045 = load i32, i32* %x250.addr, align 4
  %1046 = load i32, i32* %x246.addr, align 4
  %1047 = load i32, i32* %x243.addr, align 4
  %1048 = call i64 @p256FiatAddcarryxU32(i32 %1045, i32 %1046, i32 %1047)
  store i64 %1048, i64* %w251.addr, align 8
  %1049 = load i64, i64* %w251.addr, align 8
  %1050 = trunc i64 %1049 to i32
  store i32 %1050, i32* %x251.addr, align 4
  %1051 = load i64, i64* %w251.addr, align 8
  %1052 = lshr i64 %1051, 32
  %1053 = trunc i64 %1052 to i32
  store i32 %1053, i32* %x252.addr, align 4
  %1054 = load i32, i32* %x252.addr, align 4
  %1055 = load i32, i32* %x244.addr, align 4
  %1056 = load i32, i32* %x241.addr, align 4
  %1057 = call i64 @p256FiatAddcarryxU32(i32 %1054, i32 %1055, i32 %1056)
  store i64 %1057, i64* %w253.addr, align 8
  %1058 = load i64, i64* %w253.addr, align 8
  %1059 = trunc i64 %1058 to i32
  store i32 %1059, i32* %x253.addr, align 4
  %1060 = load i64, i64* %w253.addr, align 8
  %1061 = lshr i64 %1060, 32
  %1062 = trunc i64 %1061 to i32
  store i32 %1062, i32* %x254.addr, align 4
  %1063 = load i32, i32* %x254.addr, align 4
  %1064 = load i32, i32* %x242.addr, align 4
  %1065 = load i32, i32* %x239.addr, align 4
  %1066 = call i64 @p256FiatAddcarryxU32(i32 %1063, i32 %1064, i32 %1065)
  store i64 %1066, i64* %w255.addr, align 8
  %1067 = load i64, i64* %w255.addr, align 8
  %1068 = trunc i64 %1067 to i32
  store i32 %1068, i32* %x255.addr, align 4
  %1069 = load i64, i64* %w255.addr, align 8
  %1070 = lshr i64 %1069, 32
  %1071 = trunc i64 %1070 to i32
  store i32 %1071, i32* %x256.addr, align 4
  %1072 = load i32, i32* %x256.addr, align 4
  %1073 = load i32, i32* %x240.addr, align 4
  %1074 = load i32, i32* %x237.addr, align 4
  %1075 = call i64 @p256FiatAddcarryxU32(i32 %1072, i32 %1073, i32 %1074)
  store i64 %1075, i64* %w257.addr, align 8
  %1076 = load i64, i64* %w257.addr, align 8
  %1077 = trunc i64 %1076 to i32
  store i32 %1077, i32* %x257.addr, align 4
  %1078 = load i64, i64* %w257.addr, align 8
  %1079 = lshr i64 %1078, 32
  %1080 = trunc i64 %1079 to i32
  store i32 %1080, i32* %x258.addr, align 4
  %1081 = load i32, i32* %x258.addr, align 4
  %1082 = load i32, i32* %x238.addr, align 4
  %1083 = load i32, i32* %x235.addr, align 4
  %1084 = call i64 @p256FiatAddcarryxU32(i32 %1081, i32 %1082, i32 %1083)
  store i64 %1084, i64* %w259.addr, align 8
  %1085 = load i64, i64* %w259.addr, align 8
  %1086 = trunc i64 %1085 to i32
  store i32 %1086, i32* %x259.addr, align 4
  %1087 = load i64, i64* %w259.addr, align 8
  %1088 = lshr i64 %1087, 32
  %1089 = trunc i64 %1088 to i32
  store i32 %1089, i32* %x260.addr, align 4
  %1090 = load i32, i32* %x260.addr, align 4
  %1091 = load i32, i32* %x236.addr, align 4
  %1092 = load i32, i32* %x233.addr, align 4
  %1093 = call i64 @p256FiatAddcarryxU32(i32 %1090, i32 %1091, i32 %1092)
  store i64 %1093, i64* %w261.addr, align 8
  %1094 = load i64, i64* %w261.addr, align 8
  %1095 = trunc i64 %1094 to i32
  store i32 %1095, i32* %x261.addr, align 4
  %1096 = load i64, i64* %w261.addr, align 8
  %1097 = lshr i64 %1096, 32
  %1098 = trunc i64 %1097 to i32
  store i32 %1098, i32* %x262.addr, align 4
  %1099 = load i32, i32* %x262.addr, align 4
  %1100 = load i32, i32* %x234.addr, align 4
  %1101 = add i32 %1099, %1100
  store i32 %1101, i32* %x263.addr, align 4
  %1102 = load i32, i32* %x216.addr, align 4
  %1103 = load i32, i32* %x247.addr, align 4
  %1104 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1102, i32 %1103)
  store i64 %1104, i64* %w264.addr, align 8
  %1105 = load i64, i64* %w264.addr, align 8
  %1106 = trunc i64 %1105 to i32
  store i32 %1106, i32* %x264.addr, align 4
  %1107 = load i64, i64* %w264.addr, align 8
  %1108 = lshr i64 %1107, 32
  %1109 = trunc i64 %1108 to i32
  store i32 %1109, i32* %x265.addr, align 4
  %1110 = load i32, i32* %x265.addr, align 4
  %1111 = load i32, i32* %x218.addr, align 4
  %1112 = load i32, i32* %x249.addr, align 4
  %1113 = call i64 @p256FiatAddcarryxU32(i32 %1110, i32 %1111, i32 %1112)
  store i64 %1113, i64* %w266.addr, align 8
  %1114 = load i64, i64* %w266.addr, align 8
  %1115 = trunc i64 %1114 to i32
  store i32 %1115, i32* %x266.addr, align 4
  %1116 = load i64, i64* %w266.addr, align 8
  %1117 = lshr i64 %1116, 32
  %1118 = trunc i64 %1117 to i32
  store i32 %1118, i32* %x267.addr, align 4
  %1119 = load i32, i32* %x267.addr, align 4
  %1120 = load i32, i32* %x220.addr, align 4
  %1121 = load i32, i32* %x251.addr, align 4
  %1122 = call i64 @p256FiatAddcarryxU32(i32 %1119, i32 %1120, i32 %1121)
  store i64 %1122, i64* %w268.addr, align 8
  %1123 = load i64, i64* %w268.addr, align 8
  %1124 = trunc i64 %1123 to i32
  store i32 %1124, i32* %x268.addr, align 4
  %1125 = load i64, i64* %w268.addr, align 8
  %1126 = lshr i64 %1125, 32
  %1127 = trunc i64 %1126 to i32
  store i32 %1127, i32* %x269.addr, align 4
  %1128 = load i32, i32* %x269.addr, align 4
  %1129 = load i32, i32* %x222.addr, align 4
  %1130 = load i32, i32* %x253.addr, align 4
  %1131 = call i64 @p256FiatAddcarryxU32(i32 %1128, i32 %1129, i32 %1130)
  store i64 %1131, i64* %w270.addr, align 8
  %1132 = load i64, i64* %w270.addr, align 8
  %1133 = trunc i64 %1132 to i32
  store i32 %1133, i32* %x270.addr, align 4
  %1134 = load i64, i64* %w270.addr, align 8
  %1135 = lshr i64 %1134, 32
  %1136 = trunc i64 %1135 to i32
  store i32 %1136, i32* %x271.addr, align 4
  %1137 = load i32, i32* %x271.addr, align 4
  %1138 = load i32, i32* %x224.addr, align 4
  %1139 = load i32, i32* %x255.addr, align 4
  %1140 = call i64 @p256FiatAddcarryxU32(i32 %1137, i32 %1138, i32 %1139)
  store i64 %1140, i64* %w272.addr, align 8
  %1141 = load i64, i64* %w272.addr, align 8
  %1142 = trunc i64 %1141 to i32
  store i32 %1142, i32* %x272.addr, align 4
  %1143 = load i64, i64* %w272.addr, align 8
  %1144 = lshr i64 %1143, 32
  %1145 = trunc i64 %1144 to i32
  store i32 %1145, i32* %x273.addr, align 4
  %1146 = load i32, i32* %x273.addr, align 4
  %1147 = load i32, i32* %x226.addr, align 4
  %1148 = load i32, i32* %x257.addr, align 4
  %1149 = call i64 @p256FiatAddcarryxU32(i32 %1146, i32 %1147, i32 %1148)
  store i64 %1149, i64* %w274.addr, align 8
  %1150 = load i64, i64* %w274.addr, align 8
  %1151 = trunc i64 %1150 to i32
  store i32 %1151, i32* %x274.addr, align 4
  %1152 = load i64, i64* %w274.addr, align 8
  %1153 = lshr i64 %1152, 32
  %1154 = trunc i64 %1153 to i32
  store i32 %1154, i32* %x275.addr, align 4
  %1155 = load i32, i32* %x275.addr, align 4
  %1156 = load i32, i32* %x228.addr, align 4
  %1157 = load i32, i32* %x259.addr, align 4
  %1158 = call i64 @p256FiatAddcarryxU32(i32 %1155, i32 %1156, i32 %1157)
  store i64 %1158, i64* %w276.addr, align 8
  %1159 = load i64, i64* %w276.addr, align 8
  %1160 = trunc i64 %1159 to i32
  store i32 %1160, i32* %x276.addr, align 4
  %1161 = load i64, i64* %w276.addr, align 8
  %1162 = lshr i64 %1161, 32
  %1163 = trunc i64 %1162 to i32
  store i32 %1163, i32* %x277.addr, align 4
  %1164 = load i32, i32* %x277.addr, align 4
  %1165 = load i32, i32* %x230.addr, align 4
  %1166 = load i32, i32* %x261.addr, align 4
  %1167 = call i64 @p256FiatAddcarryxU32(i32 %1164, i32 %1165, i32 %1166)
  store i64 %1167, i64* %w278.addr, align 8
  %1168 = load i64, i64* %w278.addr, align 8
  %1169 = trunc i64 %1168 to i32
  store i32 %1169, i32* %x278.addr, align 4
  %1170 = load i64, i64* %w278.addr, align 8
  %1171 = lshr i64 %1170, 32
  %1172 = trunc i64 %1171 to i32
  store i32 %1172, i32* %x279.addr, align 4
  %1173 = load i32, i32* %x279.addr, align 4
  %1174 = load i32, i32* %x232.addr, align 4
  %1175 = load i32, i32* %x263.addr, align 4
  %1176 = call i64 @p256FiatAddcarryxU32(i32 %1173, i32 %1174, i32 %1175)
  store i64 %1176, i64* %w280.addr, align 8
  %1177 = load i64, i64* %w280.addr, align 8
  %1178 = trunc i64 %1177 to i32
  store i32 %1178, i32* %x280.addr, align 4
  %1179 = load i64, i64* %w280.addr, align 8
  %1180 = lshr i64 %1179, 32
  %1181 = trunc i64 %1180 to i32
  store i32 %1181, i32* %x281.addr, align 4
  %1182 = load i32, i32* %x264.addr, align 4
  %1183 = call i64 @p256FiatMulxU32(i32 %1182, i32 4294967295)
  store i64 %1183, i64* %w282.addr, align 8
  %1184 = load i64, i64* %w282.addr, align 8
  %1185 = trunc i64 %1184 to i32
  store i32 %1185, i32* %x282.addr, align 4
  %1186 = load i64, i64* %w282.addr, align 8
  %1187 = lshr i64 %1186, 32
  %1188 = trunc i64 %1187 to i32
  store i32 %1188, i32* %x283.addr, align 4
  %1189 = load i32, i32* %x264.addr, align 4
  %1190 = call i64 @p256FiatMulxU32(i32 %1189, i32 4294967295)
  store i64 %1190, i64* %w284.addr, align 8
  %1191 = load i64, i64* %w284.addr, align 8
  %1192 = trunc i64 %1191 to i32
  store i32 %1192, i32* %x284.addr, align 4
  %1193 = load i64, i64* %w284.addr, align 8
  %1194 = lshr i64 %1193, 32
  %1195 = trunc i64 %1194 to i32
  store i32 %1195, i32* %x285.addr, align 4
  %1196 = load i32, i32* %x264.addr, align 4
  %1197 = call i64 @p256FiatMulxU32(i32 %1196, i32 4294967295)
  store i64 %1197, i64* %w286.addr, align 8
  %1198 = load i64, i64* %w286.addr, align 8
  %1199 = trunc i64 %1198 to i32
  store i32 %1199, i32* %x286.addr, align 4
  %1200 = load i64, i64* %w286.addr, align 8
  %1201 = lshr i64 %1200, 32
  %1202 = trunc i64 %1201 to i32
  store i32 %1202, i32* %x287.addr, align 4
  %1203 = load i32, i32* %x264.addr, align 4
  %1204 = call i64 @p256FiatMulxU32(i32 %1203, i32 4294967295)
  store i64 %1204, i64* %w288.addr, align 8
  %1205 = load i64, i64* %w288.addr, align 8
  %1206 = trunc i64 %1205 to i32
  store i32 %1206, i32* %x288.addr, align 4
  %1207 = load i64, i64* %w288.addr, align 8
  %1208 = lshr i64 %1207, 32
  %1209 = trunc i64 %1208 to i32
  store i32 %1209, i32* %x289.addr, align 4
  %1210 = load i32, i32* %x289.addr, align 4
  %1211 = load i32, i32* %x286.addr, align 4
  %1212 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1210, i32 %1211)
  store i64 %1212, i64* %w290.addr, align 8
  %1213 = load i64, i64* %w290.addr, align 8
  %1214 = trunc i64 %1213 to i32
  store i32 %1214, i32* %x290.addr, align 4
  %1215 = load i64, i64* %w290.addr, align 8
  %1216 = lshr i64 %1215, 32
  %1217 = trunc i64 %1216 to i32
  store i32 %1217, i32* %x291.addr, align 4
  %1218 = load i32, i32* %x291.addr, align 4
  %1219 = load i32, i32* %x287.addr, align 4
  %1220 = load i32, i32* %x284.addr, align 4
  %1221 = call i64 @p256FiatAddcarryxU32(i32 %1218, i32 %1219, i32 %1220)
  store i64 %1221, i64* %w292.addr, align 8
  %1222 = load i64, i64* %w292.addr, align 8
  %1223 = trunc i64 %1222 to i32
  store i32 %1223, i32* %x292.addr, align 4
  %1224 = load i64, i64* %w292.addr, align 8
  %1225 = lshr i64 %1224, 32
  %1226 = trunc i64 %1225 to i32
  store i32 %1226, i32* %x293.addr, align 4
  %1227 = load i32, i32* %x293.addr, align 4
  %1228 = load i32, i32* %x285.addr, align 4
  %1229 = add i32 %1227, %1228
  store i32 %1229, i32* %x294.addr, align 4
  %1230 = load i32, i32* %x264.addr, align 4
  %1231 = load i32, i32* %x288.addr, align 4
  %1232 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1230, i32 %1231)
  store i64 %1232, i64* %w295.addr, align 8
  %1233 = load i64, i64* %w295.addr, align 8
  %1234 = lshr i64 %1233, 32
  %1235 = trunc i64 %1234 to i32
  store i32 %1235, i32* %x296.addr, align 4
  %1236 = load i32, i32* %x296.addr, align 4
  %1237 = load i32, i32* %x266.addr, align 4
  %1238 = load i32, i32* %x290.addr, align 4
  %1239 = call i64 @p256FiatAddcarryxU32(i32 %1236, i32 %1237, i32 %1238)
  store i64 %1239, i64* %w297.addr, align 8
  %1240 = load i64, i64* %w297.addr, align 8
  %1241 = trunc i64 %1240 to i32
  store i32 %1241, i32* %x297.addr, align 4
  %1242 = load i64, i64* %w297.addr, align 8
  %1243 = lshr i64 %1242, 32
  %1244 = trunc i64 %1243 to i32
  store i32 %1244, i32* %x298.addr, align 4
  %1245 = load i32, i32* %x298.addr, align 4
  %1246 = load i32, i32* %x268.addr, align 4
  %1247 = load i32, i32* %x292.addr, align 4
  %1248 = call i64 @p256FiatAddcarryxU32(i32 %1245, i32 %1246, i32 %1247)
  store i64 %1248, i64* %w299.addr, align 8
  %1249 = load i64, i64* %w299.addr, align 8
  %1250 = trunc i64 %1249 to i32
  store i32 %1250, i32* %x299.addr, align 4
  %1251 = load i64, i64* %w299.addr, align 8
  %1252 = lshr i64 %1251, 32
  %1253 = trunc i64 %1252 to i32
  store i32 %1253, i32* %x300.addr, align 4
  %1254 = load i32, i32* %x300.addr, align 4
  %1255 = load i32, i32* %x270.addr, align 4
  %1256 = load i32, i32* %x294.addr, align 4
  %1257 = call i64 @p256FiatAddcarryxU32(i32 %1254, i32 %1255, i32 %1256)
  store i64 %1257, i64* %w301.addr, align 8
  %1258 = load i64, i64* %w301.addr, align 8
  %1259 = trunc i64 %1258 to i32
  store i32 %1259, i32* %x301.addr, align 4
  %1260 = load i64, i64* %w301.addr, align 8
  %1261 = lshr i64 %1260, 32
  %1262 = trunc i64 %1261 to i32
  store i32 %1262, i32* %x302.addr, align 4
  %1263 = load i32, i32* %x302.addr, align 4
  %1264 = load i32, i32* %x272.addr, align 4
  %1265 = call i64 @p256FiatAddcarryxU32(i32 %1263, i32 %1264, i32 0)
  store i64 %1265, i64* %w303.addr, align 8
  %1266 = load i64, i64* %w303.addr, align 8
  %1267 = trunc i64 %1266 to i32
  store i32 %1267, i32* %x303.addr, align 4
  %1268 = load i64, i64* %w303.addr, align 8
  %1269 = lshr i64 %1268, 32
  %1270 = trunc i64 %1269 to i32
  store i32 %1270, i32* %x304.addr, align 4
  %1271 = load i32, i32* %x304.addr, align 4
  %1272 = load i32, i32* %x274.addr, align 4
  %1273 = call i64 @p256FiatAddcarryxU32(i32 %1271, i32 %1272, i32 0)
  store i64 %1273, i64* %w305.addr, align 8
  %1274 = load i64, i64* %w305.addr, align 8
  %1275 = trunc i64 %1274 to i32
  store i32 %1275, i32* %x305.addr, align 4
  %1276 = load i64, i64* %w305.addr, align 8
  %1277 = lshr i64 %1276, 32
  %1278 = trunc i64 %1277 to i32
  store i32 %1278, i32* %x306.addr, align 4
  %1279 = load i32, i32* %x306.addr, align 4
  %1280 = load i32, i32* %x276.addr, align 4
  %1281 = load i32, i32* %x264.addr, align 4
  %1282 = call i64 @p256FiatAddcarryxU32(i32 %1279, i32 %1280, i32 %1281)
  store i64 %1282, i64* %w307.addr, align 8
  %1283 = load i64, i64* %w307.addr, align 8
  %1284 = trunc i64 %1283 to i32
  store i32 %1284, i32* %x307.addr, align 4
  %1285 = load i64, i64* %w307.addr, align 8
  %1286 = lshr i64 %1285, 32
  %1287 = trunc i64 %1286 to i32
  store i32 %1287, i32* %x308.addr, align 4
  %1288 = load i32, i32* %x308.addr, align 4
  %1289 = load i32, i32* %x278.addr, align 4
  %1290 = load i32, i32* %x282.addr, align 4
  %1291 = call i64 @p256FiatAddcarryxU32(i32 %1288, i32 %1289, i32 %1290)
  store i64 %1291, i64* %w309.addr, align 8
  %1292 = load i64, i64* %w309.addr, align 8
  %1293 = trunc i64 %1292 to i32
  store i32 %1293, i32* %x309.addr, align 4
  %1294 = load i64, i64* %w309.addr, align 8
  %1295 = lshr i64 %1294, 32
  %1296 = trunc i64 %1295 to i32
  store i32 %1296, i32* %x310.addr, align 4
  %1297 = load i32, i32* %x310.addr, align 4
  %1298 = load i32, i32* %x280.addr, align 4
  %1299 = load i32, i32* %x283.addr, align 4
  %1300 = call i64 @p256FiatAddcarryxU32(i32 %1297, i32 %1298, i32 %1299)
  store i64 %1300, i64* %w311.addr, align 8
  %1301 = load i64, i64* %w311.addr, align 8
  %1302 = trunc i64 %1301 to i32
  store i32 %1302, i32* %x311.addr, align 4
  %1303 = load i64, i64* %w311.addr, align 8
  %1304 = lshr i64 %1303, 32
  %1305 = trunc i64 %1304 to i32
  store i32 %1305, i32* %x312.addr, align 4
  %1306 = load i32, i32* %x312.addr, align 4
  %1307 = load i32, i32* %x281.addr, align 4
  %1308 = add i32 %1306, %1307
  store i32 %1308, i32* %x313.addr, align 4
  %1309 = load i32, i32* %x4.addr, align 4
  %1310 = load i32, i32* %arg1Limb7.addr, align 4
  %1311 = call i64 @p256FiatMulxU32(i32 %1309, i32 %1310)
  store i64 %1311, i64* %w314.addr, align 8
  %1312 = load i64, i64* %w314.addr, align 8
  %1313 = trunc i64 %1312 to i32
  store i32 %1313, i32* %x314.addr, align 4
  %1314 = load i64, i64* %w314.addr, align 8
  %1315 = lshr i64 %1314, 32
  %1316 = trunc i64 %1315 to i32
  store i32 %1316, i32* %x315.addr, align 4
  %1317 = load i32, i32* %x4.addr, align 4
  %1318 = load i32, i32* %arg1Limb6.addr, align 4
  %1319 = call i64 @p256FiatMulxU32(i32 %1317, i32 %1318)
  store i64 %1319, i64* %w316.addr, align 8
  %1320 = load i64, i64* %w316.addr, align 8
  %1321 = trunc i64 %1320 to i32
  store i32 %1321, i32* %x316.addr, align 4
  %1322 = load i64, i64* %w316.addr, align 8
  %1323 = lshr i64 %1322, 32
  %1324 = trunc i64 %1323 to i32
  store i32 %1324, i32* %x317.addr, align 4
  %1325 = load i32, i32* %x4.addr, align 4
  %1326 = load i32, i32* %arg1Limb5.addr, align 4
  %1327 = call i64 @p256FiatMulxU32(i32 %1325, i32 %1326)
  store i64 %1327, i64* %w318.addr, align 8
  %1328 = load i64, i64* %w318.addr, align 8
  %1329 = trunc i64 %1328 to i32
  store i32 %1329, i32* %x318.addr, align 4
  %1330 = load i64, i64* %w318.addr, align 8
  %1331 = lshr i64 %1330, 32
  %1332 = trunc i64 %1331 to i32
  store i32 %1332, i32* %x319.addr, align 4
  %1333 = load i32, i32* %x4.addr, align 4
  %1334 = load i32, i32* %arg1Limb4.addr, align 4
  %1335 = call i64 @p256FiatMulxU32(i32 %1333, i32 %1334)
  store i64 %1335, i64* %w320.addr, align 8
  %1336 = load i64, i64* %w320.addr, align 8
  %1337 = trunc i64 %1336 to i32
  store i32 %1337, i32* %x320.addr, align 4
  %1338 = load i64, i64* %w320.addr, align 8
  %1339 = lshr i64 %1338, 32
  %1340 = trunc i64 %1339 to i32
  store i32 %1340, i32* %x321.addr, align 4
  %1341 = load i32, i32* %x4.addr, align 4
  %1342 = load i32, i32* %arg1Limb3.addr, align 4
  %1343 = call i64 @p256FiatMulxU32(i32 %1341, i32 %1342)
  store i64 %1343, i64* %w322.addr, align 8
  %1344 = load i64, i64* %w322.addr, align 8
  %1345 = trunc i64 %1344 to i32
  store i32 %1345, i32* %x322.addr, align 4
  %1346 = load i64, i64* %w322.addr, align 8
  %1347 = lshr i64 %1346, 32
  %1348 = trunc i64 %1347 to i32
  store i32 %1348, i32* %x323.addr, align 4
  %1349 = load i32, i32* %x4.addr, align 4
  %1350 = load i32, i32* %arg1Limb2.addr, align 4
  %1351 = call i64 @p256FiatMulxU32(i32 %1349, i32 %1350)
  store i64 %1351, i64* %w324.addr, align 8
  %1352 = load i64, i64* %w324.addr, align 8
  %1353 = trunc i64 %1352 to i32
  store i32 %1353, i32* %x324.addr, align 4
  %1354 = load i64, i64* %w324.addr, align 8
  %1355 = lshr i64 %1354, 32
  %1356 = trunc i64 %1355 to i32
  store i32 %1356, i32* %x325.addr, align 4
  %1357 = load i32, i32* %x4.addr, align 4
  %1358 = load i32, i32* %arg1Limb1.addr, align 4
  %1359 = call i64 @p256FiatMulxU32(i32 %1357, i32 %1358)
  store i64 %1359, i64* %w326.addr, align 8
  %1360 = load i64, i64* %w326.addr, align 8
  %1361 = trunc i64 %1360 to i32
  store i32 %1361, i32* %x326.addr, align 4
  %1362 = load i64, i64* %w326.addr, align 8
  %1363 = lshr i64 %1362, 32
  %1364 = trunc i64 %1363 to i32
  store i32 %1364, i32* %x327.addr, align 4
  %1365 = load i32, i32* %x4.addr, align 4
  %1366 = load i32, i32* %arg1Limb0.addr, align 4
  %1367 = call i64 @p256FiatMulxU32(i32 %1365, i32 %1366)
  store i64 %1367, i64* %w328.addr, align 8
  %1368 = load i64, i64* %w328.addr, align 8
  %1369 = trunc i64 %1368 to i32
  store i32 %1369, i32* %x328.addr, align 4
  %1370 = load i64, i64* %w328.addr, align 8
  %1371 = lshr i64 %1370, 32
  %1372 = trunc i64 %1371 to i32
  store i32 %1372, i32* %x329.addr, align 4
  %1373 = load i32, i32* %x329.addr, align 4
  %1374 = load i32, i32* %x326.addr, align 4
  %1375 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1373, i32 %1374)
  store i64 %1375, i64* %w330.addr, align 8
  %1376 = load i64, i64* %w330.addr, align 8
  %1377 = trunc i64 %1376 to i32
  store i32 %1377, i32* %x330.addr, align 4
  %1378 = load i64, i64* %w330.addr, align 8
  %1379 = lshr i64 %1378, 32
  %1380 = trunc i64 %1379 to i32
  store i32 %1380, i32* %x331.addr, align 4
  %1381 = load i32, i32* %x331.addr, align 4
  %1382 = load i32, i32* %x327.addr, align 4
  %1383 = load i32, i32* %x324.addr, align 4
  %1384 = call i64 @p256FiatAddcarryxU32(i32 %1381, i32 %1382, i32 %1383)
  store i64 %1384, i64* %w332.addr, align 8
  %1385 = load i64, i64* %w332.addr, align 8
  %1386 = trunc i64 %1385 to i32
  store i32 %1386, i32* %x332.addr, align 4
  %1387 = load i64, i64* %w332.addr, align 8
  %1388 = lshr i64 %1387, 32
  %1389 = trunc i64 %1388 to i32
  store i32 %1389, i32* %x333.addr, align 4
  %1390 = load i32, i32* %x333.addr, align 4
  %1391 = load i32, i32* %x325.addr, align 4
  %1392 = load i32, i32* %x322.addr, align 4
  %1393 = call i64 @p256FiatAddcarryxU32(i32 %1390, i32 %1391, i32 %1392)
  store i64 %1393, i64* %w334.addr, align 8
  %1394 = load i64, i64* %w334.addr, align 8
  %1395 = trunc i64 %1394 to i32
  store i32 %1395, i32* %x334.addr, align 4
  %1396 = load i64, i64* %w334.addr, align 8
  %1397 = lshr i64 %1396, 32
  %1398 = trunc i64 %1397 to i32
  store i32 %1398, i32* %x335.addr, align 4
  %1399 = load i32, i32* %x335.addr, align 4
  %1400 = load i32, i32* %x323.addr, align 4
  %1401 = load i32, i32* %x320.addr, align 4
  %1402 = call i64 @p256FiatAddcarryxU32(i32 %1399, i32 %1400, i32 %1401)
  store i64 %1402, i64* %w336.addr, align 8
  %1403 = load i64, i64* %w336.addr, align 8
  %1404 = trunc i64 %1403 to i32
  store i32 %1404, i32* %x336.addr, align 4
  %1405 = load i64, i64* %w336.addr, align 8
  %1406 = lshr i64 %1405, 32
  %1407 = trunc i64 %1406 to i32
  store i32 %1407, i32* %x337.addr, align 4
  %1408 = load i32, i32* %x337.addr, align 4
  %1409 = load i32, i32* %x321.addr, align 4
  %1410 = load i32, i32* %x318.addr, align 4
  %1411 = call i64 @p256FiatAddcarryxU32(i32 %1408, i32 %1409, i32 %1410)
  store i64 %1411, i64* %w338.addr, align 8
  %1412 = load i64, i64* %w338.addr, align 8
  %1413 = trunc i64 %1412 to i32
  store i32 %1413, i32* %x338.addr, align 4
  %1414 = load i64, i64* %w338.addr, align 8
  %1415 = lshr i64 %1414, 32
  %1416 = trunc i64 %1415 to i32
  store i32 %1416, i32* %x339.addr, align 4
  %1417 = load i32, i32* %x339.addr, align 4
  %1418 = load i32, i32* %x319.addr, align 4
  %1419 = load i32, i32* %x316.addr, align 4
  %1420 = call i64 @p256FiatAddcarryxU32(i32 %1417, i32 %1418, i32 %1419)
  store i64 %1420, i64* %w340.addr, align 8
  %1421 = load i64, i64* %w340.addr, align 8
  %1422 = trunc i64 %1421 to i32
  store i32 %1422, i32* %x340.addr, align 4
  %1423 = load i64, i64* %w340.addr, align 8
  %1424 = lshr i64 %1423, 32
  %1425 = trunc i64 %1424 to i32
  store i32 %1425, i32* %x341.addr, align 4
  %1426 = load i32, i32* %x341.addr, align 4
  %1427 = load i32, i32* %x317.addr, align 4
  %1428 = load i32, i32* %x314.addr, align 4
  %1429 = call i64 @p256FiatAddcarryxU32(i32 %1426, i32 %1427, i32 %1428)
  store i64 %1429, i64* %w342.addr, align 8
  %1430 = load i64, i64* %w342.addr, align 8
  %1431 = trunc i64 %1430 to i32
  store i32 %1431, i32* %x342.addr, align 4
  %1432 = load i64, i64* %w342.addr, align 8
  %1433 = lshr i64 %1432, 32
  %1434 = trunc i64 %1433 to i32
  store i32 %1434, i32* %x343.addr, align 4
  %1435 = load i32, i32* %x343.addr, align 4
  %1436 = load i32, i32* %x315.addr, align 4
  %1437 = add i32 %1435, %1436
  store i32 %1437, i32* %x344.addr, align 4
  %1438 = load i32, i32* %x297.addr, align 4
  %1439 = load i32, i32* %x328.addr, align 4
  %1440 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1438, i32 %1439)
  store i64 %1440, i64* %w345.addr, align 8
  %1441 = load i64, i64* %w345.addr, align 8
  %1442 = trunc i64 %1441 to i32
  store i32 %1442, i32* %x345.addr, align 4
  %1443 = load i64, i64* %w345.addr, align 8
  %1444 = lshr i64 %1443, 32
  %1445 = trunc i64 %1444 to i32
  store i32 %1445, i32* %x346.addr, align 4
  %1446 = load i32, i32* %x346.addr, align 4
  %1447 = load i32, i32* %x299.addr, align 4
  %1448 = load i32, i32* %x330.addr, align 4
  %1449 = call i64 @p256FiatAddcarryxU32(i32 %1446, i32 %1447, i32 %1448)
  store i64 %1449, i64* %w347.addr, align 8
  %1450 = load i64, i64* %w347.addr, align 8
  %1451 = trunc i64 %1450 to i32
  store i32 %1451, i32* %x347.addr, align 4
  %1452 = load i64, i64* %w347.addr, align 8
  %1453 = lshr i64 %1452, 32
  %1454 = trunc i64 %1453 to i32
  store i32 %1454, i32* %x348.addr, align 4
  %1455 = load i32, i32* %x348.addr, align 4
  %1456 = load i32, i32* %x301.addr, align 4
  %1457 = load i32, i32* %x332.addr, align 4
  %1458 = call i64 @p256FiatAddcarryxU32(i32 %1455, i32 %1456, i32 %1457)
  store i64 %1458, i64* %w349.addr, align 8
  %1459 = load i64, i64* %w349.addr, align 8
  %1460 = trunc i64 %1459 to i32
  store i32 %1460, i32* %x349.addr, align 4
  %1461 = load i64, i64* %w349.addr, align 8
  %1462 = lshr i64 %1461, 32
  %1463 = trunc i64 %1462 to i32
  store i32 %1463, i32* %x350.addr, align 4
  %1464 = load i32, i32* %x350.addr, align 4
  %1465 = load i32, i32* %x303.addr, align 4
  %1466 = load i32, i32* %x334.addr, align 4
  %1467 = call i64 @p256FiatAddcarryxU32(i32 %1464, i32 %1465, i32 %1466)
  store i64 %1467, i64* %w351.addr, align 8
  %1468 = load i64, i64* %w351.addr, align 8
  %1469 = trunc i64 %1468 to i32
  store i32 %1469, i32* %x351.addr, align 4
  %1470 = load i64, i64* %w351.addr, align 8
  %1471 = lshr i64 %1470, 32
  %1472 = trunc i64 %1471 to i32
  store i32 %1472, i32* %x352.addr, align 4
  %1473 = load i32, i32* %x352.addr, align 4
  %1474 = load i32, i32* %x305.addr, align 4
  %1475 = load i32, i32* %x336.addr, align 4
  %1476 = call i64 @p256FiatAddcarryxU32(i32 %1473, i32 %1474, i32 %1475)
  store i64 %1476, i64* %w353.addr, align 8
  %1477 = load i64, i64* %w353.addr, align 8
  %1478 = trunc i64 %1477 to i32
  store i32 %1478, i32* %x353.addr, align 4
  %1479 = load i64, i64* %w353.addr, align 8
  %1480 = lshr i64 %1479, 32
  %1481 = trunc i64 %1480 to i32
  store i32 %1481, i32* %x354.addr, align 4
  %1482 = load i32, i32* %x354.addr, align 4
  %1483 = load i32, i32* %x307.addr, align 4
  %1484 = load i32, i32* %x338.addr, align 4
  %1485 = call i64 @p256FiatAddcarryxU32(i32 %1482, i32 %1483, i32 %1484)
  store i64 %1485, i64* %w355.addr, align 8
  %1486 = load i64, i64* %w355.addr, align 8
  %1487 = trunc i64 %1486 to i32
  store i32 %1487, i32* %x355.addr, align 4
  %1488 = load i64, i64* %w355.addr, align 8
  %1489 = lshr i64 %1488, 32
  %1490 = trunc i64 %1489 to i32
  store i32 %1490, i32* %x356.addr, align 4
  %1491 = load i32, i32* %x356.addr, align 4
  %1492 = load i32, i32* %x309.addr, align 4
  %1493 = load i32, i32* %x340.addr, align 4
  %1494 = call i64 @p256FiatAddcarryxU32(i32 %1491, i32 %1492, i32 %1493)
  store i64 %1494, i64* %w357.addr, align 8
  %1495 = load i64, i64* %w357.addr, align 8
  %1496 = trunc i64 %1495 to i32
  store i32 %1496, i32* %x357.addr, align 4
  %1497 = load i64, i64* %w357.addr, align 8
  %1498 = lshr i64 %1497, 32
  %1499 = trunc i64 %1498 to i32
  store i32 %1499, i32* %x358.addr, align 4
  %1500 = load i32, i32* %x358.addr, align 4
  %1501 = load i32, i32* %x311.addr, align 4
  %1502 = load i32, i32* %x342.addr, align 4
  %1503 = call i64 @p256FiatAddcarryxU32(i32 %1500, i32 %1501, i32 %1502)
  store i64 %1503, i64* %w359.addr, align 8
  %1504 = load i64, i64* %w359.addr, align 8
  %1505 = trunc i64 %1504 to i32
  store i32 %1505, i32* %x359.addr, align 4
  %1506 = load i64, i64* %w359.addr, align 8
  %1507 = lshr i64 %1506, 32
  %1508 = trunc i64 %1507 to i32
  store i32 %1508, i32* %x360.addr, align 4
  %1509 = load i32, i32* %x360.addr, align 4
  %1510 = load i32, i32* %x313.addr, align 4
  %1511 = load i32, i32* %x344.addr, align 4
  %1512 = call i64 @p256FiatAddcarryxU32(i32 %1509, i32 %1510, i32 %1511)
  store i64 %1512, i64* %w361.addr, align 8
  %1513 = load i64, i64* %w361.addr, align 8
  %1514 = trunc i64 %1513 to i32
  store i32 %1514, i32* %x361.addr, align 4
  %1515 = load i64, i64* %w361.addr, align 8
  %1516 = lshr i64 %1515, 32
  %1517 = trunc i64 %1516 to i32
  store i32 %1517, i32* %x362.addr, align 4
  %1518 = load i32, i32* %x345.addr, align 4
  %1519 = call i64 @p256FiatMulxU32(i32 %1518, i32 4294967295)
  store i64 %1519, i64* %w363.addr, align 8
  %1520 = load i64, i64* %w363.addr, align 8
  %1521 = trunc i64 %1520 to i32
  store i32 %1521, i32* %x363.addr, align 4
  %1522 = load i64, i64* %w363.addr, align 8
  %1523 = lshr i64 %1522, 32
  %1524 = trunc i64 %1523 to i32
  store i32 %1524, i32* %x364.addr, align 4
  %1525 = load i32, i32* %x345.addr, align 4
  %1526 = call i64 @p256FiatMulxU32(i32 %1525, i32 4294967295)
  store i64 %1526, i64* %w365.addr, align 8
  %1527 = load i64, i64* %w365.addr, align 8
  %1528 = trunc i64 %1527 to i32
  store i32 %1528, i32* %x365.addr, align 4
  %1529 = load i64, i64* %w365.addr, align 8
  %1530 = lshr i64 %1529, 32
  %1531 = trunc i64 %1530 to i32
  store i32 %1531, i32* %x366.addr, align 4
  %1532 = load i32, i32* %x345.addr, align 4
  %1533 = call i64 @p256FiatMulxU32(i32 %1532, i32 4294967295)
  store i64 %1533, i64* %w367.addr, align 8
  %1534 = load i64, i64* %w367.addr, align 8
  %1535 = trunc i64 %1534 to i32
  store i32 %1535, i32* %x367.addr, align 4
  %1536 = load i64, i64* %w367.addr, align 8
  %1537 = lshr i64 %1536, 32
  %1538 = trunc i64 %1537 to i32
  store i32 %1538, i32* %x368.addr, align 4
  %1539 = load i32, i32* %x345.addr, align 4
  %1540 = call i64 @p256FiatMulxU32(i32 %1539, i32 4294967295)
  store i64 %1540, i64* %w369.addr, align 8
  %1541 = load i64, i64* %w369.addr, align 8
  %1542 = trunc i64 %1541 to i32
  store i32 %1542, i32* %x369.addr, align 4
  %1543 = load i64, i64* %w369.addr, align 8
  %1544 = lshr i64 %1543, 32
  %1545 = trunc i64 %1544 to i32
  store i32 %1545, i32* %x370.addr, align 4
  %1546 = load i32, i32* %x370.addr, align 4
  %1547 = load i32, i32* %x367.addr, align 4
  %1548 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1546, i32 %1547)
  store i64 %1548, i64* %w371.addr, align 8
  %1549 = load i64, i64* %w371.addr, align 8
  %1550 = trunc i64 %1549 to i32
  store i32 %1550, i32* %x371.addr, align 4
  %1551 = load i64, i64* %w371.addr, align 8
  %1552 = lshr i64 %1551, 32
  %1553 = trunc i64 %1552 to i32
  store i32 %1553, i32* %x372.addr, align 4
  %1554 = load i32, i32* %x372.addr, align 4
  %1555 = load i32, i32* %x368.addr, align 4
  %1556 = load i32, i32* %x365.addr, align 4
  %1557 = call i64 @p256FiatAddcarryxU32(i32 %1554, i32 %1555, i32 %1556)
  store i64 %1557, i64* %w373.addr, align 8
  %1558 = load i64, i64* %w373.addr, align 8
  %1559 = trunc i64 %1558 to i32
  store i32 %1559, i32* %x373.addr, align 4
  %1560 = load i64, i64* %w373.addr, align 8
  %1561 = lshr i64 %1560, 32
  %1562 = trunc i64 %1561 to i32
  store i32 %1562, i32* %x374.addr, align 4
  %1563 = load i32, i32* %x374.addr, align 4
  %1564 = load i32, i32* %x366.addr, align 4
  %1565 = add i32 %1563, %1564
  store i32 %1565, i32* %x375.addr, align 4
  %1566 = load i32, i32* %x345.addr, align 4
  %1567 = load i32, i32* %x369.addr, align 4
  %1568 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1566, i32 %1567)
  store i64 %1568, i64* %w376.addr, align 8
  %1569 = load i64, i64* %w376.addr, align 8
  %1570 = lshr i64 %1569, 32
  %1571 = trunc i64 %1570 to i32
  store i32 %1571, i32* %x377.addr, align 4
  %1572 = load i32, i32* %x377.addr, align 4
  %1573 = load i32, i32* %x347.addr, align 4
  %1574 = load i32, i32* %x371.addr, align 4
  %1575 = call i64 @p256FiatAddcarryxU32(i32 %1572, i32 %1573, i32 %1574)
  store i64 %1575, i64* %w378.addr, align 8
  %1576 = load i64, i64* %w378.addr, align 8
  %1577 = trunc i64 %1576 to i32
  store i32 %1577, i32* %x378.addr, align 4
  %1578 = load i64, i64* %w378.addr, align 8
  %1579 = lshr i64 %1578, 32
  %1580 = trunc i64 %1579 to i32
  store i32 %1580, i32* %x379.addr, align 4
  %1581 = load i32, i32* %x379.addr, align 4
  %1582 = load i32, i32* %x349.addr, align 4
  %1583 = load i32, i32* %x373.addr, align 4
  %1584 = call i64 @p256FiatAddcarryxU32(i32 %1581, i32 %1582, i32 %1583)
  store i64 %1584, i64* %w380.addr, align 8
  %1585 = load i64, i64* %w380.addr, align 8
  %1586 = trunc i64 %1585 to i32
  store i32 %1586, i32* %x380.addr, align 4
  %1587 = load i64, i64* %w380.addr, align 8
  %1588 = lshr i64 %1587, 32
  %1589 = trunc i64 %1588 to i32
  store i32 %1589, i32* %x381.addr, align 4
  %1590 = load i32, i32* %x381.addr, align 4
  %1591 = load i32, i32* %x351.addr, align 4
  %1592 = load i32, i32* %x375.addr, align 4
  %1593 = call i64 @p256FiatAddcarryxU32(i32 %1590, i32 %1591, i32 %1592)
  store i64 %1593, i64* %w382.addr, align 8
  %1594 = load i64, i64* %w382.addr, align 8
  %1595 = trunc i64 %1594 to i32
  store i32 %1595, i32* %x382.addr, align 4
  %1596 = load i64, i64* %w382.addr, align 8
  %1597 = lshr i64 %1596, 32
  %1598 = trunc i64 %1597 to i32
  store i32 %1598, i32* %x383.addr, align 4
  %1599 = load i32, i32* %x383.addr, align 4
  %1600 = load i32, i32* %x353.addr, align 4
  %1601 = call i64 @p256FiatAddcarryxU32(i32 %1599, i32 %1600, i32 0)
  store i64 %1601, i64* %w384.addr, align 8
  %1602 = load i64, i64* %w384.addr, align 8
  %1603 = trunc i64 %1602 to i32
  store i32 %1603, i32* %x384.addr, align 4
  %1604 = load i64, i64* %w384.addr, align 8
  %1605 = lshr i64 %1604, 32
  %1606 = trunc i64 %1605 to i32
  store i32 %1606, i32* %x385.addr, align 4
  %1607 = load i32, i32* %x385.addr, align 4
  %1608 = load i32, i32* %x355.addr, align 4
  %1609 = call i64 @p256FiatAddcarryxU32(i32 %1607, i32 %1608, i32 0)
  store i64 %1609, i64* %w386.addr, align 8
  %1610 = load i64, i64* %w386.addr, align 8
  %1611 = trunc i64 %1610 to i32
  store i32 %1611, i32* %x386.addr, align 4
  %1612 = load i64, i64* %w386.addr, align 8
  %1613 = lshr i64 %1612, 32
  %1614 = trunc i64 %1613 to i32
  store i32 %1614, i32* %x387.addr, align 4
  %1615 = load i32, i32* %x387.addr, align 4
  %1616 = load i32, i32* %x357.addr, align 4
  %1617 = load i32, i32* %x345.addr, align 4
  %1618 = call i64 @p256FiatAddcarryxU32(i32 %1615, i32 %1616, i32 %1617)
  store i64 %1618, i64* %w388.addr, align 8
  %1619 = load i64, i64* %w388.addr, align 8
  %1620 = trunc i64 %1619 to i32
  store i32 %1620, i32* %x388.addr, align 4
  %1621 = load i64, i64* %w388.addr, align 8
  %1622 = lshr i64 %1621, 32
  %1623 = trunc i64 %1622 to i32
  store i32 %1623, i32* %x389.addr, align 4
  %1624 = load i32, i32* %x389.addr, align 4
  %1625 = load i32, i32* %x359.addr, align 4
  %1626 = load i32, i32* %x363.addr, align 4
  %1627 = call i64 @p256FiatAddcarryxU32(i32 %1624, i32 %1625, i32 %1626)
  store i64 %1627, i64* %w390.addr, align 8
  %1628 = load i64, i64* %w390.addr, align 8
  %1629 = trunc i64 %1628 to i32
  store i32 %1629, i32* %x390.addr, align 4
  %1630 = load i64, i64* %w390.addr, align 8
  %1631 = lshr i64 %1630, 32
  %1632 = trunc i64 %1631 to i32
  store i32 %1632, i32* %x391.addr, align 4
  %1633 = load i32, i32* %x391.addr, align 4
  %1634 = load i32, i32* %x361.addr, align 4
  %1635 = load i32, i32* %x364.addr, align 4
  %1636 = call i64 @p256FiatAddcarryxU32(i32 %1633, i32 %1634, i32 %1635)
  store i64 %1636, i64* %w392.addr, align 8
  %1637 = load i64, i64* %w392.addr, align 8
  %1638 = trunc i64 %1637 to i32
  store i32 %1638, i32* %x392.addr, align 4
  %1639 = load i64, i64* %w392.addr, align 8
  %1640 = lshr i64 %1639, 32
  %1641 = trunc i64 %1640 to i32
  store i32 %1641, i32* %x393.addr, align 4
  %1642 = load i32, i32* %x393.addr, align 4
  %1643 = load i32, i32* %x362.addr, align 4
  %1644 = add i32 %1642, %1643
  store i32 %1644, i32* %x394.addr, align 4
  %1645 = load i32, i32* %x5.addr, align 4
  %1646 = load i32, i32* %arg1Limb7.addr, align 4
  %1647 = call i64 @p256FiatMulxU32(i32 %1645, i32 %1646)
  store i64 %1647, i64* %w395.addr, align 8
  %1648 = load i64, i64* %w395.addr, align 8
  %1649 = trunc i64 %1648 to i32
  store i32 %1649, i32* %x395.addr, align 4
  %1650 = load i64, i64* %w395.addr, align 8
  %1651 = lshr i64 %1650, 32
  %1652 = trunc i64 %1651 to i32
  store i32 %1652, i32* %x396.addr, align 4
  %1653 = load i32, i32* %x5.addr, align 4
  %1654 = load i32, i32* %arg1Limb6.addr, align 4
  %1655 = call i64 @p256FiatMulxU32(i32 %1653, i32 %1654)
  store i64 %1655, i64* %w397.addr, align 8
  %1656 = load i64, i64* %w397.addr, align 8
  %1657 = trunc i64 %1656 to i32
  store i32 %1657, i32* %x397.addr, align 4
  %1658 = load i64, i64* %w397.addr, align 8
  %1659 = lshr i64 %1658, 32
  %1660 = trunc i64 %1659 to i32
  store i32 %1660, i32* %x398.addr, align 4
  %1661 = load i32, i32* %x5.addr, align 4
  %1662 = load i32, i32* %arg1Limb5.addr, align 4
  %1663 = call i64 @p256FiatMulxU32(i32 %1661, i32 %1662)
  store i64 %1663, i64* %w399.addr, align 8
  %1664 = load i64, i64* %w399.addr, align 8
  %1665 = trunc i64 %1664 to i32
  store i32 %1665, i32* %x399.addr, align 4
  %1666 = load i64, i64* %w399.addr, align 8
  %1667 = lshr i64 %1666, 32
  %1668 = trunc i64 %1667 to i32
  store i32 %1668, i32* %x400.addr, align 4
  %1669 = load i32, i32* %x5.addr, align 4
  %1670 = load i32, i32* %arg1Limb4.addr, align 4
  %1671 = call i64 @p256FiatMulxU32(i32 %1669, i32 %1670)
  store i64 %1671, i64* %w401.addr, align 8
  %1672 = load i64, i64* %w401.addr, align 8
  %1673 = trunc i64 %1672 to i32
  store i32 %1673, i32* %x401.addr, align 4
  %1674 = load i64, i64* %w401.addr, align 8
  %1675 = lshr i64 %1674, 32
  %1676 = trunc i64 %1675 to i32
  store i32 %1676, i32* %x402.addr, align 4
  %1677 = load i32, i32* %x5.addr, align 4
  %1678 = load i32, i32* %arg1Limb3.addr, align 4
  %1679 = call i64 @p256FiatMulxU32(i32 %1677, i32 %1678)
  store i64 %1679, i64* %w403.addr, align 8
  %1680 = load i64, i64* %w403.addr, align 8
  %1681 = trunc i64 %1680 to i32
  store i32 %1681, i32* %x403.addr, align 4
  %1682 = load i64, i64* %w403.addr, align 8
  %1683 = lshr i64 %1682, 32
  %1684 = trunc i64 %1683 to i32
  store i32 %1684, i32* %x404.addr, align 4
  %1685 = load i32, i32* %x5.addr, align 4
  %1686 = load i32, i32* %arg1Limb2.addr, align 4
  %1687 = call i64 @p256FiatMulxU32(i32 %1685, i32 %1686)
  store i64 %1687, i64* %w405.addr, align 8
  %1688 = load i64, i64* %w405.addr, align 8
  %1689 = trunc i64 %1688 to i32
  store i32 %1689, i32* %x405.addr, align 4
  %1690 = load i64, i64* %w405.addr, align 8
  %1691 = lshr i64 %1690, 32
  %1692 = trunc i64 %1691 to i32
  store i32 %1692, i32* %x406.addr, align 4
  %1693 = load i32, i32* %x5.addr, align 4
  %1694 = load i32, i32* %arg1Limb1.addr, align 4
  %1695 = call i64 @p256FiatMulxU32(i32 %1693, i32 %1694)
  store i64 %1695, i64* %w407.addr, align 8
  %1696 = load i64, i64* %w407.addr, align 8
  %1697 = trunc i64 %1696 to i32
  store i32 %1697, i32* %x407.addr, align 4
  %1698 = load i64, i64* %w407.addr, align 8
  %1699 = lshr i64 %1698, 32
  %1700 = trunc i64 %1699 to i32
  store i32 %1700, i32* %x408.addr, align 4
  %1701 = load i32, i32* %x5.addr, align 4
  %1702 = load i32, i32* %arg1Limb0.addr, align 4
  %1703 = call i64 @p256FiatMulxU32(i32 %1701, i32 %1702)
  store i64 %1703, i64* %w409.addr, align 8
  %1704 = load i64, i64* %w409.addr, align 8
  %1705 = trunc i64 %1704 to i32
  store i32 %1705, i32* %x409.addr, align 4
  %1706 = load i64, i64* %w409.addr, align 8
  %1707 = lshr i64 %1706, 32
  %1708 = trunc i64 %1707 to i32
  store i32 %1708, i32* %x410.addr, align 4
  %1709 = load i32, i32* %x410.addr, align 4
  %1710 = load i32, i32* %x407.addr, align 4
  %1711 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1709, i32 %1710)
  store i64 %1711, i64* %w411.addr, align 8
  %1712 = load i64, i64* %w411.addr, align 8
  %1713 = trunc i64 %1712 to i32
  store i32 %1713, i32* %x411.addr, align 4
  %1714 = load i64, i64* %w411.addr, align 8
  %1715 = lshr i64 %1714, 32
  %1716 = trunc i64 %1715 to i32
  store i32 %1716, i32* %x412.addr, align 4
  %1717 = load i32, i32* %x412.addr, align 4
  %1718 = load i32, i32* %x408.addr, align 4
  %1719 = load i32, i32* %x405.addr, align 4
  %1720 = call i64 @p256FiatAddcarryxU32(i32 %1717, i32 %1718, i32 %1719)
  store i64 %1720, i64* %w413.addr, align 8
  %1721 = load i64, i64* %w413.addr, align 8
  %1722 = trunc i64 %1721 to i32
  store i32 %1722, i32* %x413.addr, align 4
  %1723 = load i64, i64* %w413.addr, align 8
  %1724 = lshr i64 %1723, 32
  %1725 = trunc i64 %1724 to i32
  store i32 %1725, i32* %x414.addr, align 4
  %1726 = load i32, i32* %x414.addr, align 4
  %1727 = load i32, i32* %x406.addr, align 4
  %1728 = load i32, i32* %x403.addr, align 4
  %1729 = call i64 @p256FiatAddcarryxU32(i32 %1726, i32 %1727, i32 %1728)
  store i64 %1729, i64* %w415.addr, align 8
  %1730 = load i64, i64* %w415.addr, align 8
  %1731 = trunc i64 %1730 to i32
  store i32 %1731, i32* %x415.addr, align 4
  %1732 = load i64, i64* %w415.addr, align 8
  %1733 = lshr i64 %1732, 32
  %1734 = trunc i64 %1733 to i32
  store i32 %1734, i32* %x416.addr, align 4
  %1735 = load i32, i32* %x416.addr, align 4
  %1736 = load i32, i32* %x404.addr, align 4
  %1737 = load i32, i32* %x401.addr, align 4
  %1738 = call i64 @p256FiatAddcarryxU32(i32 %1735, i32 %1736, i32 %1737)
  store i64 %1738, i64* %w417.addr, align 8
  %1739 = load i64, i64* %w417.addr, align 8
  %1740 = trunc i64 %1739 to i32
  store i32 %1740, i32* %x417.addr, align 4
  %1741 = load i64, i64* %w417.addr, align 8
  %1742 = lshr i64 %1741, 32
  %1743 = trunc i64 %1742 to i32
  store i32 %1743, i32* %x418.addr, align 4
  %1744 = load i32, i32* %x418.addr, align 4
  %1745 = load i32, i32* %x402.addr, align 4
  %1746 = load i32, i32* %x399.addr, align 4
  %1747 = call i64 @p256FiatAddcarryxU32(i32 %1744, i32 %1745, i32 %1746)
  store i64 %1747, i64* %w419.addr, align 8
  %1748 = load i64, i64* %w419.addr, align 8
  %1749 = trunc i64 %1748 to i32
  store i32 %1749, i32* %x419.addr, align 4
  %1750 = load i64, i64* %w419.addr, align 8
  %1751 = lshr i64 %1750, 32
  %1752 = trunc i64 %1751 to i32
  store i32 %1752, i32* %x420.addr, align 4
  %1753 = load i32, i32* %x420.addr, align 4
  %1754 = load i32, i32* %x400.addr, align 4
  %1755 = load i32, i32* %x397.addr, align 4
  %1756 = call i64 @p256FiatAddcarryxU32(i32 %1753, i32 %1754, i32 %1755)
  store i64 %1756, i64* %w421.addr, align 8
  %1757 = load i64, i64* %w421.addr, align 8
  %1758 = trunc i64 %1757 to i32
  store i32 %1758, i32* %x421.addr, align 4
  %1759 = load i64, i64* %w421.addr, align 8
  %1760 = lshr i64 %1759, 32
  %1761 = trunc i64 %1760 to i32
  store i32 %1761, i32* %x422.addr, align 4
  %1762 = load i32, i32* %x422.addr, align 4
  %1763 = load i32, i32* %x398.addr, align 4
  %1764 = load i32, i32* %x395.addr, align 4
  %1765 = call i64 @p256FiatAddcarryxU32(i32 %1762, i32 %1763, i32 %1764)
  store i64 %1765, i64* %w423.addr, align 8
  %1766 = load i64, i64* %w423.addr, align 8
  %1767 = trunc i64 %1766 to i32
  store i32 %1767, i32* %x423.addr, align 4
  %1768 = load i64, i64* %w423.addr, align 8
  %1769 = lshr i64 %1768, 32
  %1770 = trunc i64 %1769 to i32
  store i32 %1770, i32* %x424.addr, align 4
  %1771 = load i32, i32* %x424.addr, align 4
  %1772 = load i32, i32* %x396.addr, align 4
  %1773 = add i32 %1771, %1772
  store i32 %1773, i32* %x425.addr, align 4
  %1774 = load i32, i32* %x378.addr, align 4
  %1775 = load i32, i32* %x409.addr, align 4
  %1776 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1774, i32 %1775)
  store i64 %1776, i64* %w426.addr, align 8
  %1777 = load i64, i64* %w426.addr, align 8
  %1778 = trunc i64 %1777 to i32
  store i32 %1778, i32* %x426.addr, align 4
  %1779 = load i64, i64* %w426.addr, align 8
  %1780 = lshr i64 %1779, 32
  %1781 = trunc i64 %1780 to i32
  store i32 %1781, i32* %x427.addr, align 4
  %1782 = load i32, i32* %x427.addr, align 4
  %1783 = load i32, i32* %x380.addr, align 4
  %1784 = load i32, i32* %x411.addr, align 4
  %1785 = call i64 @p256FiatAddcarryxU32(i32 %1782, i32 %1783, i32 %1784)
  store i64 %1785, i64* %w428.addr, align 8
  %1786 = load i64, i64* %w428.addr, align 8
  %1787 = trunc i64 %1786 to i32
  store i32 %1787, i32* %x428.addr, align 4
  %1788 = load i64, i64* %w428.addr, align 8
  %1789 = lshr i64 %1788, 32
  %1790 = trunc i64 %1789 to i32
  store i32 %1790, i32* %x429.addr, align 4
  %1791 = load i32, i32* %x429.addr, align 4
  %1792 = load i32, i32* %x382.addr, align 4
  %1793 = load i32, i32* %x413.addr, align 4
  %1794 = call i64 @p256FiatAddcarryxU32(i32 %1791, i32 %1792, i32 %1793)
  store i64 %1794, i64* %w430.addr, align 8
  %1795 = load i64, i64* %w430.addr, align 8
  %1796 = trunc i64 %1795 to i32
  store i32 %1796, i32* %x430.addr, align 4
  %1797 = load i64, i64* %w430.addr, align 8
  %1798 = lshr i64 %1797, 32
  %1799 = trunc i64 %1798 to i32
  store i32 %1799, i32* %x431.addr, align 4
  %1800 = load i32, i32* %x431.addr, align 4
  %1801 = load i32, i32* %x384.addr, align 4
  %1802 = load i32, i32* %x415.addr, align 4
  %1803 = call i64 @p256FiatAddcarryxU32(i32 %1800, i32 %1801, i32 %1802)
  store i64 %1803, i64* %w432.addr, align 8
  %1804 = load i64, i64* %w432.addr, align 8
  %1805 = trunc i64 %1804 to i32
  store i32 %1805, i32* %x432.addr, align 4
  %1806 = load i64, i64* %w432.addr, align 8
  %1807 = lshr i64 %1806, 32
  %1808 = trunc i64 %1807 to i32
  store i32 %1808, i32* %x433.addr, align 4
  %1809 = load i32, i32* %x433.addr, align 4
  %1810 = load i32, i32* %x386.addr, align 4
  %1811 = load i32, i32* %x417.addr, align 4
  %1812 = call i64 @p256FiatAddcarryxU32(i32 %1809, i32 %1810, i32 %1811)
  store i64 %1812, i64* %w434.addr, align 8
  %1813 = load i64, i64* %w434.addr, align 8
  %1814 = trunc i64 %1813 to i32
  store i32 %1814, i32* %x434.addr, align 4
  %1815 = load i64, i64* %w434.addr, align 8
  %1816 = lshr i64 %1815, 32
  %1817 = trunc i64 %1816 to i32
  store i32 %1817, i32* %x435.addr, align 4
  %1818 = load i32, i32* %x435.addr, align 4
  %1819 = load i32, i32* %x388.addr, align 4
  %1820 = load i32, i32* %x419.addr, align 4
  %1821 = call i64 @p256FiatAddcarryxU32(i32 %1818, i32 %1819, i32 %1820)
  store i64 %1821, i64* %w436.addr, align 8
  %1822 = load i64, i64* %w436.addr, align 8
  %1823 = trunc i64 %1822 to i32
  store i32 %1823, i32* %x436.addr, align 4
  %1824 = load i64, i64* %w436.addr, align 8
  %1825 = lshr i64 %1824, 32
  %1826 = trunc i64 %1825 to i32
  store i32 %1826, i32* %x437.addr, align 4
  %1827 = load i32, i32* %x437.addr, align 4
  %1828 = load i32, i32* %x390.addr, align 4
  %1829 = load i32, i32* %x421.addr, align 4
  %1830 = call i64 @p256FiatAddcarryxU32(i32 %1827, i32 %1828, i32 %1829)
  store i64 %1830, i64* %w438.addr, align 8
  %1831 = load i64, i64* %w438.addr, align 8
  %1832 = trunc i64 %1831 to i32
  store i32 %1832, i32* %x438.addr, align 4
  %1833 = load i64, i64* %w438.addr, align 8
  %1834 = lshr i64 %1833, 32
  %1835 = trunc i64 %1834 to i32
  store i32 %1835, i32* %x439.addr, align 4
  %1836 = load i32, i32* %x439.addr, align 4
  %1837 = load i32, i32* %x392.addr, align 4
  %1838 = load i32, i32* %x423.addr, align 4
  %1839 = call i64 @p256FiatAddcarryxU32(i32 %1836, i32 %1837, i32 %1838)
  store i64 %1839, i64* %w440.addr, align 8
  %1840 = load i64, i64* %w440.addr, align 8
  %1841 = trunc i64 %1840 to i32
  store i32 %1841, i32* %x440.addr, align 4
  %1842 = load i64, i64* %w440.addr, align 8
  %1843 = lshr i64 %1842, 32
  %1844 = trunc i64 %1843 to i32
  store i32 %1844, i32* %x441.addr, align 4
  %1845 = load i32, i32* %x441.addr, align 4
  %1846 = load i32, i32* %x394.addr, align 4
  %1847 = load i32, i32* %x425.addr, align 4
  %1848 = call i64 @p256FiatAddcarryxU32(i32 %1845, i32 %1846, i32 %1847)
  store i64 %1848, i64* %w442.addr, align 8
  %1849 = load i64, i64* %w442.addr, align 8
  %1850 = trunc i64 %1849 to i32
  store i32 %1850, i32* %x442.addr, align 4
  %1851 = load i64, i64* %w442.addr, align 8
  %1852 = lshr i64 %1851, 32
  %1853 = trunc i64 %1852 to i32
  store i32 %1853, i32* %x443.addr, align 4
  %1854 = load i32, i32* %x426.addr, align 4
  %1855 = call i64 @p256FiatMulxU32(i32 %1854, i32 4294967295)
  store i64 %1855, i64* %w444.addr, align 8
  %1856 = load i64, i64* %w444.addr, align 8
  %1857 = trunc i64 %1856 to i32
  store i32 %1857, i32* %x444.addr, align 4
  %1858 = load i64, i64* %w444.addr, align 8
  %1859 = lshr i64 %1858, 32
  %1860 = trunc i64 %1859 to i32
  store i32 %1860, i32* %x445.addr, align 4
  %1861 = load i32, i32* %x426.addr, align 4
  %1862 = call i64 @p256FiatMulxU32(i32 %1861, i32 4294967295)
  store i64 %1862, i64* %w446.addr, align 8
  %1863 = load i64, i64* %w446.addr, align 8
  %1864 = trunc i64 %1863 to i32
  store i32 %1864, i32* %x446.addr, align 4
  %1865 = load i64, i64* %w446.addr, align 8
  %1866 = lshr i64 %1865, 32
  %1867 = trunc i64 %1866 to i32
  store i32 %1867, i32* %x447.addr, align 4
  %1868 = load i32, i32* %x426.addr, align 4
  %1869 = call i64 @p256FiatMulxU32(i32 %1868, i32 4294967295)
  store i64 %1869, i64* %w448.addr, align 8
  %1870 = load i64, i64* %w448.addr, align 8
  %1871 = trunc i64 %1870 to i32
  store i32 %1871, i32* %x448.addr, align 4
  %1872 = load i64, i64* %w448.addr, align 8
  %1873 = lshr i64 %1872, 32
  %1874 = trunc i64 %1873 to i32
  store i32 %1874, i32* %x449.addr, align 4
  %1875 = load i32, i32* %x426.addr, align 4
  %1876 = call i64 @p256FiatMulxU32(i32 %1875, i32 4294967295)
  store i64 %1876, i64* %w450.addr, align 8
  %1877 = load i64, i64* %w450.addr, align 8
  %1878 = trunc i64 %1877 to i32
  store i32 %1878, i32* %x450.addr, align 4
  %1879 = load i64, i64* %w450.addr, align 8
  %1880 = lshr i64 %1879, 32
  %1881 = trunc i64 %1880 to i32
  store i32 %1881, i32* %x451.addr, align 4
  %1882 = load i32, i32* %x451.addr, align 4
  %1883 = load i32, i32* %x448.addr, align 4
  %1884 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1882, i32 %1883)
  store i64 %1884, i64* %w452.addr, align 8
  %1885 = load i64, i64* %w452.addr, align 8
  %1886 = trunc i64 %1885 to i32
  store i32 %1886, i32* %x452.addr, align 4
  %1887 = load i64, i64* %w452.addr, align 8
  %1888 = lshr i64 %1887, 32
  %1889 = trunc i64 %1888 to i32
  store i32 %1889, i32* %x453.addr, align 4
  %1890 = load i32, i32* %x453.addr, align 4
  %1891 = load i32, i32* %x449.addr, align 4
  %1892 = load i32, i32* %x446.addr, align 4
  %1893 = call i64 @p256FiatAddcarryxU32(i32 %1890, i32 %1891, i32 %1892)
  store i64 %1893, i64* %w454.addr, align 8
  %1894 = load i64, i64* %w454.addr, align 8
  %1895 = trunc i64 %1894 to i32
  store i32 %1895, i32* %x454.addr, align 4
  %1896 = load i64, i64* %w454.addr, align 8
  %1897 = lshr i64 %1896, 32
  %1898 = trunc i64 %1897 to i32
  store i32 %1898, i32* %x455.addr, align 4
  %1899 = load i32, i32* %x455.addr, align 4
  %1900 = load i32, i32* %x447.addr, align 4
  %1901 = add i32 %1899, %1900
  store i32 %1901, i32* %x456.addr, align 4
  %1902 = load i32, i32* %x426.addr, align 4
  %1903 = load i32, i32* %x450.addr, align 4
  %1904 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1902, i32 %1903)
  store i64 %1904, i64* %w457.addr, align 8
  %1905 = load i64, i64* %w457.addr, align 8
  %1906 = lshr i64 %1905, 32
  %1907 = trunc i64 %1906 to i32
  store i32 %1907, i32* %x458.addr, align 4
  %1908 = load i32, i32* %x458.addr, align 4
  %1909 = load i32, i32* %x428.addr, align 4
  %1910 = load i32, i32* %x452.addr, align 4
  %1911 = call i64 @p256FiatAddcarryxU32(i32 %1908, i32 %1909, i32 %1910)
  store i64 %1911, i64* %w459.addr, align 8
  %1912 = load i64, i64* %w459.addr, align 8
  %1913 = trunc i64 %1912 to i32
  store i32 %1913, i32* %x459.addr, align 4
  %1914 = load i64, i64* %w459.addr, align 8
  %1915 = lshr i64 %1914, 32
  %1916 = trunc i64 %1915 to i32
  store i32 %1916, i32* %x460.addr, align 4
  %1917 = load i32, i32* %x460.addr, align 4
  %1918 = load i32, i32* %x430.addr, align 4
  %1919 = load i32, i32* %x454.addr, align 4
  %1920 = call i64 @p256FiatAddcarryxU32(i32 %1917, i32 %1918, i32 %1919)
  store i64 %1920, i64* %w461.addr, align 8
  %1921 = load i64, i64* %w461.addr, align 8
  %1922 = trunc i64 %1921 to i32
  store i32 %1922, i32* %x461.addr, align 4
  %1923 = load i64, i64* %w461.addr, align 8
  %1924 = lshr i64 %1923, 32
  %1925 = trunc i64 %1924 to i32
  store i32 %1925, i32* %x462.addr, align 4
  %1926 = load i32, i32* %x462.addr, align 4
  %1927 = load i32, i32* %x432.addr, align 4
  %1928 = load i32, i32* %x456.addr, align 4
  %1929 = call i64 @p256FiatAddcarryxU32(i32 %1926, i32 %1927, i32 %1928)
  store i64 %1929, i64* %w463.addr, align 8
  %1930 = load i64, i64* %w463.addr, align 8
  %1931 = trunc i64 %1930 to i32
  store i32 %1931, i32* %x463.addr, align 4
  %1932 = load i64, i64* %w463.addr, align 8
  %1933 = lshr i64 %1932, 32
  %1934 = trunc i64 %1933 to i32
  store i32 %1934, i32* %x464.addr, align 4
  %1935 = load i32, i32* %x464.addr, align 4
  %1936 = load i32, i32* %x434.addr, align 4
  %1937 = call i64 @p256FiatAddcarryxU32(i32 %1935, i32 %1936, i32 0)
  store i64 %1937, i64* %w465.addr, align 8
  %1938 = load i64, i64* %w465.addr, align 8
  %1939 = trunc i64 %1938 to i32
  store i32 %1939, i32* %x465.addr, align 4
  %1940 = load i64, i64* %w465.addr, align 8
  %1941 = lshr i64 %1940, 32
  %1942 = trunc i64 %1941 to i32
  store i32 %1942, i32* %x466.addr, align 4
  %1943 = load i32, i32* %x466.addr, align 4
  %1944 = load i32, i32* %x436.addr, align 4
  %1945 = call i64 @p256FiatAddcarryxU32(i32 %1943, i32 %1944, i32 0)
  store i64 %1945, i64* %w467.addr, align 8
  %1946 = load i64, i64* %w467.addr, align 8
  %1947 = trunc i64 %1946 to i32
  store i32 %1947, i32* %x467.addr, align 4
  %1948 = load i64, i64* %w467.addr, align 8
  %1949 = lshr i64 %1948, 32
  %1950 = trunc i64 %1949 to i32
  store i32 %1950, i32* %x468.addr, align 4
  %1951 = load i32, i32* %x468.addr, align 4
  %1952 = load i32, i32* %x438.addr, align 4
  %1953 = load i32, i32* %x426.addr, align 4
  %1954 = call i64 @p256FiatAddcarryxU32(i32 %1951, i32 %1952, i32 %1953)
  store i64 %1954, i64* %w469.addr, align 8
  %1955 = load i64, i64* %w469.addr, align 8
  %1956 = trunc i64 %1955 to i32
  store i32 %1956, i32* %x469.addr, align 4
  %1957 = load i64, i64* %w469.addr, align 8
  %1958 = lshr i64 %1957, 32
  %1959 = trunc i64 %1958 to i32
  store i32 %1959, i32* %x470.addr, align 4
  %1960 = load i32, i32* %x470.addr, align 4
  %1961 = load i32, i32* %x440.addr, align 4
  %1962 = load i32, i32* %x444.addr, align 4
  %1963 = call i64 @p256FiatAddcarryxU32(i32 %1960, i32 %1961, i32 %1962)
  store i64 %1963, i64* %w471.addr, align 8
  %1964 = load i64, i64* %w471.addr, align 8
  %1965 = trunc i64 %1964 to i32
  store i32 %1965, i32* %x471.addr, align 4
  %1966 = load i64, i64* %w471.addr, align 8
  %1967 = lshr i64 %1966, 32
  %1968 = trunc i64 %1967 to i32
  store i32 %1968, i32* %x472.addr, align 4
  %1969 = load i32, i32* %x472.addr, align 4
  %1970 = load i32, i32* %x442.addr, align 4
  %1971 = load i32, i32* %x445.addr, align 4
  %1972 = call i64 @p256FiatAddcarryxU32(i32 %1969, i32 %1970, i32 %1971)
  store i64 %1972, i64* %w473.addr, align 8
  %1973 = load i64, i64* %w473.addr, align 8
  %1974 = trunc i64 %1973 to i32
  store i32 %1974, i32* %x473.addr, align 4
  %1975 = load i64, i64* %w473.addr, align 8
  %1976 = lshr i64 %1975, 32
  %1977 = trunc i64 %1976 to i32
  store i32 %1977, i32* %x474.addr, align 4
  %1978 = load i32, i32* %x474.addr, align 4
  %1979 = load i32, i32* %x443.addr, align 4
  %1980 = add i32 %1978, %1979
  store i32 %1980, i32* %x475.addr, align 4
  %1981 = load i32, i32* %x6.addr, align 4
  %1982 = load i32, i32* %arg1Limb7.addr, align 4
  %1983 = call i64 @p256FiatMulxU32(i32 %1981, i32 %1982)
  store i64 %1983, i64* %w476.addr, align 8
  %1984 = load i64, i64* %w476.addr, align 8
  %1985 = trunc i64 %1984 to i32
  store i32 %1985, i32* %x476.addr, align 4
  %1986 = load i64, i64* %w476.addr, align 8
  %1987 = lshr i64 %1986, 32
  %1988 = trunc i64 %1987 to i32
  store i32 %1988, i32* %x477.addr, align 4
  %1989 = load i32, i32* %x6.addr, align 4
  %1990 = load i32, i32* %arg1Limb6.addr, align 4
  %1991 = call i64 @p256FiatMulxU32(i32 %1989, i32 %1990)
  store i64 %1991, i64* %w478.addr, align 8
  %1992 = load i64, i64* %w478.addr, align 8
  %1993 = trunc i64 %1992 to i32
  store i32 %1993, i32* %x478.addr, align 4
  %1994 = load i64, i64* %w478.addr, align 8
  %1995 = lshr i64 %1994, 32
  %1996 = trunc i64 %1995 to i32
  store i32 %1996, i32* %x479.addr, align 4
  %1997 = load i32, i32* %x6.addr, align 4
  %1998 = load i32, i32* %arg1Limb5.addr, align 4
  %1999 = call i64 @p256FiatMulxU32(i32 %1997, i32 %1998)
  store i64 %1999, i64* %w480.addr, align 8
  %2000 = load i64, i64* %w480.addr, align 8
  %2001 = trunc i64 %2000 to i32
  store i32 %2001, i32* %x480.addr, align 4
  %2002 = load i64, i64* %w480.addr, align 8
  %2003 = lshr i64 %2002, 32
  %2004 = trunc i64 %2003 to i32
  store i32 %2004, i32* %x481.addr, align 4
  %2005 = load i32, i32* %x6.addr, align 4
  %2006 = load i32, i32* %arg1Limb4.addr, align 4
  %2007 = call i64 @p256FiatMulxU32(i32 %2005, i32 %2006)
  store i64 %2007, i64* %w482.addr, align 8
  %2008 = load i64, i64* %w482.addr, align 8
  %2009 = trunc i64 %2008 to i32
  store i32 %2009, i32* %x482.addr, align 4
  %2010 = load i64, i64* %w482.addr, align 8
  %2011 = lshr i64 %2010, 32
  %2012 = trunc i64 %2011 to i32
  store i32 %2012, i32* %x483.addr, align 4
  %2013 = load i32, i32* %x6.addr, align 4
  %2014 = load i32, i32* %arg1Limb3.addr, align 4
  %2015 = call i64 @p256FiatMulxU32(i32 %2013, i32 %2014)
  store i64 %2015, i64* %w484.addr, align 8
  %2016 = load i64, i64* %w484.addr, align 8
  %2017 = trunc i64 %2016 to i32
  store i32 %2017, i32* %x484.addr, align 4
  %2018 = load i64, i64* %w484.addr, align 8
  %2019 = lshr i64 %2018, 32
  %2020 = trunc i64 %2019 to i32
  store i32 %2020, i32* %x485.addr, align 4
  %2021 = load i32, i32* %x6.addr, align 4
  %2022 = load i32, i32* %arg1Limb2.addr, align 4
  %2023 = call i64 @p256FiatMulxU32(i32 %2021, i32 %2022)
  store i64 %2023, i64* %w486.addr, align 8
  %2024 = load i64, i64* %w486.addr, align 8
  %2025 = trunc i64 %2024 to i32
  store i32 %2025, i32* %x486.addr, align 4
  %2026 = load i64, i64* %w486.addr, align 8
  %2027 = lshr i64 %2026, 32
  %2028 = trunc i64 %2027 to i32
  store i32 %2028, i32* %x487.addr, align 4
  %2029 = load i32, i32* %x6.addr, align 4
  %2030 = load i32, i32* %arg1Limb1.addr, align 4
  %2031 = call i64 @p256FiatMulxU32(i32 %2029, i32 %2030)
  store i64 %2031, i64* %w488.addr, align 8
  %2032 = load i64, i64* %w488.addr, align 8
  %2033 = trunc i64 %2032 to i32
  store i32 %2033, i32* %x488.addr, align 4
  %2034 = load i64, i64* %w488.addr, align 8
  %2035 = lshr i64 %2034, 32
  %2036 = trunc i64 %2035 to i32
  store i32 %2036, i32* %x489.addr, align 4
  %2037 = load i32, i32* %x6.addr, align 4
  %2038 = load i32, i32* %arg1Limb0.addr, align 4
  %2039 = call i64 @p256FiatMulxU32(i32 %2037, i32 %2038)
  store i64 %2039, i64* %w490.addr, align 8
  %2040 = load i64, i64* %w490.addr, align 8
  %2041 = trunc i64 %2040 to i32
  store i32 %2041, i32* %x490.addr, align 4
  %2042 = load i64, i64* %w490.addr, align 8
  %2043 = lshr i64 %2042, 32
  %2044 = trunc i64 %2043 to i32
  store i32 %2044, i32* %x491.addr, align 4
  %2045 = load i32, i32* %x491.addr, align 4
  %2046 = load i32, i32* %x488.addr, align 4
  %2047 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2045, i32 %2046)
  store i64 %2047, i64* %w492.addr, align 8
  %2048 = load i64, i64* %w492.addr, align 8
  %2049 = trunc i64 %2048 to i32
  store i32 %2049, i32* %x492.addr, align 4
  %2050 = load i64, i64* %w492.addr, align 8
  %2051 = lshr i64 %2050, 32
  %2052 = trunc i64 %2051 to i32
  store i32 %2052, i32* %x493.addr, align 4
  %2053 = load i32, i32* %x493.addr, align 4
  %2054 = load i32, i32* %x489.addr, align 4
  %2055 = load i32, i32* %x486.addr, align 4
  %2056 = call i64 @p256FiatAddcarryxU32(i32 %2053, i32 %2054, i32 %2055)
  store i64 %2056, i64* %w494.addr, align 8
  %2057 = load i64, i64* %w494.addr, align 8
  %2058 = trunc i64 %2057 to i32
  store i32 %2058, i32* %x494.addr, align 4
  %2059 = load i64, i64* %w494.addr, align 8
  %2060 = lshr i64 %2059, 32
  %2061 = trunc i64 %2060 to i32
  store i32 %2061, i32* %x495.addr, align 4
  %2062 = load i32, i32* %x495.addr, align 4
  %2063 = load i32, i32* %x487.addr, align 4
  %2064 = load i32, i32* %x484.addr, align 4
  %2065 = call i64 @p256FiatAddcarryxU32(i32 %2062, i32 %2063, i32 %2064)
  store i64 %2065, i64* %w496.addr, align 8
  %2066 = load i64, i64* %w496.addr, align 8
  %2067 = trunc i64 %2066 to i32
  store i32 %2067, i32* %x496.addr, align 4
  %2068 = load i64, i64* %w496.addr, align 8
  %2069 = lshr i64 %2068, 32
  %2070 = trunc i64 %2069 to i32
  store i32 %2070, i32* %x497.addr, align 4
  %2071 = load i32, i32* %x497.addr, align 4
  %2072 = load i32, i32* %x485.addr, align 4
  %2073 = load i32, i32* %x482.addr, align 4
  %2074 = call i64 @p256FiatAddcarryxU32(i32 %2071, i32 %2072, i32 %2073)
  store i64 %2074, i64* %w498.addr, align 8
  %2075 = load i64, i64* %w498.addr, align 8
  %2076 = trunc i64 %2075 to i32
  store i32 %2076, i32* %x498.addr, align 4
  %2077 = load i64, i64* %w498.addr, align 8
  %2078 = lshr i64 %2077, 32
  %2079 = trunc i64 %2078 to i32
  store i32 %2079, i32* %x499.addr, align 4
  %2080 = load i32, i32* %x499.addr, align 4
  %2081 = load i32, i32* %x483.addr, align 4
  %2082 = load i32, i32* %x480.addr, align 4
  %2083 = call i64 @p256FiatAddcarryxU32(i32 %2080, i32 %2081, i32 %2082)
  store i64 %2083, i64* %w500.addr, align 8
  %2084 = load i64, i64* %w500.addr, align 8
  %2085 = trunc i64 %2084 to i32
  store i32 %2085, i32* %x500.addr, align 4
  %2086 = load i64, i64* %w500.addr, align 8
  %2087 = lshr i64 %2086, 32
  %2088 = trunc i64 %2087 to i32
  store i32 %2088, i32* %x501.addr, align 4
  %2089 = load i32, i32* %x501.addr, align 4
  %2090 = load i32, i32* %x481.addr, align 4
  %2091 = load i32, i32* %x478.addr, align 4
  %2092 = call i64 @p256FiatAddcarryxU32(i32 %2089, i32 %2090, i32 %2091)
  store i64 %2092, i64* %w502.addr, align 8
  %2093 = load i64, i64* %w502.addr, align 8
  %2094 = trunc i64 %2093 to i32
  store i32 %2094, i32* %x502.addr, align 4
  %2095 = load i64, i64* %w502.addr, align 8
  %2096 = lshr i64 %2095, 32
  %2097 = trunc i64 %2096 to i32
  store i32 %2097, i32* %x503.addr, align 4
  %2098 = load i32, i32* %x503.addr, align 4
  %2099 = load i32, i32* %x479.addr, align 4
  %2100 = load i32, i32* %x476.addr, align 4
  %2101 = call i64 @p256FiatAddcarryxU32(i32 %2098, i32 %2099, i32 %2100)
  store i64 %2101, i64* %w504.addr, align 8
  %2102 = load i64, i64* %w504.addr, align 8
  %2103 = trunc i64 %2102 to i32
  store i32 %2103, i32* %x504.addr, align 4
  %2104 = load i64, i64* %w504.addr, align 8
  %2105 = lshr i64 %2104, 32
  %2106 = trunc i64 %2105 to i32
  store i32 %2106, i32* %x505.addr, align 4
  %2107 = load i32, i32* %x505.addr, align 4
  %2108 = load i32, i32* %x477.addr, align 4
  %2109 = add i32 %2107, %2108
  store i32 %2109, i32* %x506.addr, align 4
  %2110 = load i32, i32* %x459.addr, align 4
  %2111 = load i32, i32* %x490.addr, align 4
  %2112 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2110, i32 %2111)
  store i64 %2112, i64* %w507.addr, align 8
  %2113 = load i64, i64* %w507.addr, align 8
  %2114 = trunc i64 %2113 to i32
  store i32 %2114, i32* %x507.addr, align 4
  %2115 = load i64, i64* %w507.addr, align 8
  %2116 = lshr i64 %2115, 32
  %2117 = trunc i64 %2116 to i32
  store i32 %2117, i32* %x508.addr, align 4
  %2118 = load i32, i32* %x508.addr, align 4
  %2119 = load i32, i32* %x461.addr, align 4
  %2120 = load i32, i32* %x492.addr, align 4
  %2121 = call i64 @p256FiatAddcarryxU32(i32 %2118, i32 %2119, i32 %2120)
  store i64 %2121, i64* %w509.addr, align 8
  %2122 = load i64, i64* %w509.addr, align 8
  %2123 = trunc i64 %2122 to i32
  store i32 %2123, i32* %x509.addr, align 4
  %2124 = load i64, i64* %w509.addr, align 8
  %2125 = lshr i64 %2124, 32
  %2126 = trunc i64 %2125 to i32
  store i32 %2126, i32* %x510.addr, align 4
  %2127 = load i32, i32* %x510.addr, align 4
  %2128 = load i32, i32* %x463.addr, align 4
  %2129 = load i32, i32* %x494.addr, align 4
  %2130 = call i64 @p256FiatAddcarryxU32(i32 %2127, i32 %2128, i32 %2129)
  store i64 %2130, i64* %w511.addr, align 8
  %2131 = load i64, i64* %w511.addr, align 8
  %2132 = trunc i64 %2131 to i32
  store i32 %2132, i32* %x511.addr, align 4
  %2133 = load i64, i64* %w511.addr, align 8
  %2134 = lshr i64 %2133, 32
  %2135 = trunc i64 %2134 to i32
  store i32 %2135, i32* %x512.addr, align 4
  %2136 = load i32, i32* %x512.addr, align 4
  %2137 = load i32, i32* %x465.addr, align 4
  %2138 = load i32, i32* %x496.addr, align 4
  %2139 = call i64 @p256FiatAddcarryxU32(i32 %2136, i32 %2137, i32 %2138)
  store i64 %2139, i64* %w513.addr, align 8
  %2140 = load i64, i64* %w513.addr, align 8
  %2141 = trunc i64 %2140 to i32
  store i32 %2141, i32* %x513.addr, align 4
  %2142 = load i64, i64* %w513.addr, align 8
  %2143 = lshr i64 %2142, 32
  %2144 = trunc i64 %2143 to i32
  store i32 %2144, i32* %x514.addr, align 4
  %2145 = load i32, i32* %x514.addr, align 4
  %2146 = load i32, i32* %x467.addr, align 4
  %2147 = load i32, i32* %x498.addr, align 4
  %2148 = call i64 @p256FiatAddcarryxU32(i32 %2145, i32 %2146, i32 %2147)
  store i64 %2148, i64* %w515.addr, align 8
  %2149 = load i64, i64* %w515.addr, align 8
  %2150 = trunc i64 %2149 to i32
  store i32 %2150, i32* %x515.addr, align 4
  %2151 = load i64, i64* %w515.addr, align 8
  %2152 = lshr i64 %2151, 32
  %2153 = trunc i64 %2152 to i32
  store i32 %2153, i32* %x516.addr, align 4
  %2154 = load i32, i32* %x516.addr, align 4
  %2155 = load i32, i32* %x469.addr, align 4
  %2156 = load i32, i32* %x500.addr, align 4
  %2157 = call i64 @p256FiatAddcarryxU32(i32 %2154, i32 %2155, i32 %2156)
  store i64 %2157, i64* %w517.addr, align 8
  %2158 = load i64, i64* %w517.addr, align 8
  %2159 = trunc i64 %2158 to i32
  store i32 %2159, i32* %x517.addr, align 4
  %2160 = load i64, i64* %w517.addr, align 8
  %2161 = lshr i64 %2160, 32
  %2162 = trunc i64 %2161 to i32
  store i32 %2162, i32* %x518.addr, align 4
  %2163 = load i32, i32* %x518.addr, align 4
  %2164 = load i32, i32* %x471.addr, align 4
  %2165 = load i32, i32* %x502.addr, align 4
  %2166 = call i64 @p256FiatAddcarryxU32(i32 %2163, i32 %2164, i32 %2165)
  store i64 %2166, i64* %w519.addr, align 8
  %2167 = load i64, i64* %w519.addr, align 8
  %2168 = trunc i64 %2167 to i32
  store i32 %2168, i32* %x519.addr, align 4
  %2169 = load i64, i64* %w519.addr, align 8
  %2170 = lshr i64 %2169, 32
  %2171 = trunc i64 %2170 to i32
  store i32 %2171, i32* %x520.addr, align 4
  %2172 = load i32, i32* %x520.addr, align 4
  %2173 = load i32, i32* %x473.addr, align 4
  %2174 = load i32, i32* %x504.addr, align 4
  %2175 = call i64 @p256FiatAddcarryxU32(i32 %2172, i32 %2173, i32 %2174)
  store i64 %2175, i64* %w521.addr, align 8
  %2176 = load i64, i64* %w521.addr, align 8
  %2177 = trunc i64 %2176 to i32
  store i32 %2177, i32* %x521.addr, align 4
  %2178 = load i64, i64* %w521.addr, align 8
  %2179 = lshr i64 %2178, 32
  %2180 = trunc i64 %2179 to i32
  store i32 %2180, i32* %x522.addr, align 4
  %2181 = load i32, i32* %x522.addr, align 4
  %2182 = load i32, i32* %x475.addr, align 4
  %2183 = load i32, i32* %x506.addr, align 4
  %2184 = call i64 @p256FiatAddcarryxU32(i32 %2181, i32 %2182, i32 %2183)
  store i64 %2184, i64* %w523.addr, align 8
  %2185 = load i64, i64* %w523.addr, align 8
  %2186 = trunc i64 %2185 to i32
  store i32 %2186, i32* %x523.addr, align 4
  %2187 = load i64, i64* %w523.addr, align 8
  %2188 = lshr i64 %2187, 32
  %2189 = trunc i64 %2188 to i32
  store i32 %2189, i32* %x524.addr, align 4
  %2190 = load i32, i32* %x507.addr, align 4
  %2191 = call i64 @p256FiatMulxU32(i32 %2190, i32 4294967295)
  store i64 %2191, i64* %w525.addr, align 8
  %2192 = load i64, i64* %w525.addr, align 8
  %2193 = trunc i64 %2192 to i32
  store i32 %2193, i32* %x525.addr, align 4
  %2194 = load i64, i64* %w525.addr, align 8
  %2195 = lshr i64 %2194, 32
  %2196 = trunc i64 %2195 to i32
  store i32 %2196, i32* %x526.addr, align 4
  %2197 = load i32, i32* %x507.addr, align 4
  %2198 = call i64 @p256FiatMulxU32(i32 %2197, i32 4294967295)
  store i64 %2198, i64* %w527.addr, align 8
  %2199 = load i64, i64* %w527.addr, align 8
  %2200 = trunc i64 %2199 to i32
  store i32 %2200, i32* %x527.addr, align 4
  %2201 = load i64, i64* %w527.addr, align 8
  %2202 = lshr i64 %2201, 32
  %2203 = trunc i64 %2202 to i32
  store i32 %2203, i32* %x528.addr, align 4
  %2204 = load i32, i32* %x507.addr, align 4
  %2205 = call i64 @p256FiatMulxU32(i32 %2204, i32 4294967295)
  store i64 %2205, i64* %w529.addr, align 8
  %2206 = load i64, i64* %w529.addr, align 8
  %2207 = trunc i64 %2206 to i32
  store i32 %2207, i32* %x529.addr, align 4
  %2208 = load i64, i64* %w529.addr, align 8
  %2209 = lshr i64 %2208, 32
  %2210 = trunc i64 %2209 to i32
  store i32 %2210, i32* %x530.addr, align 4
  %2211 = load i32, i32* %x507.addr, align 4
  %2212 = call i64 @p256FiatMulxU32(i32 %2211, i32 4294967295)
  store i64 %2212, i64* %w531.addr, align 8
  %2213 = load i64, i64* %w531.addr, align 8
  %2214 = trunc i64 %2213 to i32
  store i32 %2214, i32* %x531.addr, align 4
  %2215 = load i64, i64* %w531.addr, align 8
  %2216 = lshr i64 %2215, 32
  %2217 = trunc i64 %2216 to i32
  store i32 %2217, i32* %x532.addr, align 4
  %2218 = load i32, i32* %x532.addr, align 4
  %2219 = load i32, i32* %x529.addr, align 4
  %2220 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2218, i32 %2219)
  store i64 %2220, i64* %w533.addr, align 8
  %2221 = load i64, i64* %w533.addr, align 8
  %2222 = trunc i64 %2221 to i32
  store i32 %2222, i32* %x533.addr, align 4
  %2223 = load i64, i64* %w533.addr, align 8
  %2224 = lshr i64 %2223, 32
  %2225 = trunc i64 %2224 to i32
  store i32 %2225, i32* %x534.addr, align 4
  %2226 = load i32, i32* %x534.addr, align 4
  %2227 = load i32, i32* %x530.addr, align 4
  %2228 = load i32, i32* %x527.addr, align 4
  %2229 = call i64 @p256FiatAddcarryxU32(i32 %2226, i32 %2227, i32 %2228)
  store i64 %2229, i64* %w535.addr, align 8
  %2230 = load i64, i64* %w535.addr, align 8
  %2231 = trunc i64 %2230 to i32
  store i32 %2231, i32* %x535.addr, align 4
  %2232 = load i64, i64* %w535.addr, align 8
  %2233 = lshr i64 %2232, 32
  %2234 = trunc i64 %2233 to i32
  store i32 %2234, i32* %x536.addr, align 4
  %2235 = load i32, i32* %x536.addr, align 4
  %2236 = load i32, i32* %x528.addr, align 4
  %2237 = add i32 %2235, %2236
  store i32 %2237, i32* %x537.addr, align 4
  %2238 = load i32, i32* %x507.addr, align 4
  %2239 = load i32, i32* %x531.addr, align 4
  %2240 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2238, i32 %2239)
  store i64 %2240, i64* %w538.addr, align 8
  %2241 = load i64, i64* %w538.addr, align 8
  %2242 = lshr i64 %2241, 32
  %2243 = trunc i64 %2242 to i32
  store i32 %2243, i32* %x539.addr, align 4
  %2244 = load i32, i32* %x539.addr, align 4
  %2245 = load i32, i32* %x509.addr, align 4
  %2246 = load i32, i32* %x533.addr, align 4
  %2247 = call i64 @p256FiatAddcarryxU32(i32 %2244, i32 %2245, i32 %2246)
  store i64 %2247, i64* %w540.addr, align 8
  %2248 = load i64, i64* %w540.addr, align 8
  %2249 = trunc i64 %2248 to i32
  store i32 %2249, i32* %x540.addr, align 4
  %2250 = load i64, i64* %w540.addr, align 8
  %2251 = lshr i64 %2250, 32
  %2252 = trunc i64 %2251 to i32
  store i32 %2252, i32* %x541.addr, align 4
  %2253 = load i32, i32* %x541.addr, align 4
  %2254 = load i32, i32* %x511.addr, align 4
  %2255 = load i32, i32* %x535.addr, align 4
  %2256 = call i64 @p256FiatAddcarryxU32(i32 %2253, i32 %2254, i32 %2255)
  store i64 %2256, i64* %w542.addr, align 8
  %2257 = load i64, i64* %w542.addr, align 8
  %2258 = trunc i64 %2257 to i32
  store i32 %2258, i32* %x542.addr, align 4
  %2259 = load i64, i64* %w542.addr, align 8
  %2260 = lshr i64 %2259, 32
  %2261 = trunc i64 %2260 to i32
  store i32 %2261, i32* %x543.addr, align 4
  %2262 = load i32, i32* %x543.addr, align 4
  %2263 = load i32, i32* %x513.addr, align 4
  %2264 = load i32, i32* %x537.addr, align 4
  %2265 = call i64 @p256FiatAddcarryxU32(i32 %2262, i32 %2263, i32 %2264)
  store i64 %2265, i64* %w544.addr, align 8
  %2266 = load i64, i64* %w544.addr, align 8
  %2267 = trunc i64 %2266 to i32
  store i32 %2267, i32* %x544.addr, align 4
  %2268 = load i64, i64* %w544.addr, align 8
  %2269 = lshr i64 %2268, 32
  %2270 = trunc i64 %2269 to i32
  store i32 %2270, i32* %x545.addr, align 4
  %2271 = load i32, i32* %x545.addr, align 4
  %2272 = load i32, i32* %x515.addr, align 4
  %2273 = call i64 @p256FiatAddcarryxU32(i32 %2271, i32 %2272, i32 0)
  store i64 %2273, i64* %w546.addr, align 8
  %2274 = load i64, i64* %w546.addr, align 8
  %2275 = trunc i64 %2274 to i32
  store i32 %2275, i32* %x546.addr, align 4
  %2276 = load i64, i64* %w546.addr, align 8
  %2277 = lshr i64 %2276, 32
  %2278 = trunc i64 %2277 to i32
  store i32 %2278, i32* %x547.addr, align 4
  %2279 = load i32, i32* %x547.addr, align 4
  %2280 = load i32, i32* %x517.addr, align 4
  %2281 = call i64 @p256FiatAddcarryxU32(i32 %2279, i32 %2280, i32 0)
  store i64 %2281, i64* %w548.addr, align 8
  %2282 = load i64, i64* %w548.addr, align 8
  %2283 = trunc i64 %2282 to i32
  store i32 %2283, i32* %x548.addr, align 4
  %2284 = load i64, i64* %w548.addr, align 8
  %2285 = lshr i64 %2284, 32
  %2286 = trunc i64 %2285 to i32
  store i32 %2286, i32* %x549.addr, align 4
  %2287 = load i32, i32* %x549.addr, align 4
  %2288 = load i32, i32* %x519.addr, align 4
  %2289 = load i32, i32* %x507.addr, align 4
  %2290 = call i64 @p256FiatAddcarryxU32(i32 %2287, i32 %2288, i32 %2289)
  store i64 %2290, i64* %w550.addr, align 8
  %2291 = load i64, i64* %w550.addr, align 8
  %2292 = trunc i64 %2291 to i32
  store i32 %2292, i32* %x550.addr, align 4
  %2293 = load i64, i64* %w550.addr, align 8
  %2294 = lshr i64 %2293, 32
  %2295 = trunc i64 %2294 to i32
  store i32 %2295, i32* %x551.addr, align 4
  %2296 = load i32, i32* %x551.addr, align 4
  %2297 = load i32, i32* %x521.addr, align 4
  %2298 = load i32, i32* %x525.addr, align 4
  %2299 = call i64 @p256FiatAddcarryxU32(i32 %2296, i32 %2297, i32 %2298)
  store i64 %2299, i64* %w552.addr, align 8
  %2300 = load i64, i64* %w552.addr, align 8
  %2301 = trunc i64 %2300 to i32
  store i32 %2301, i32* %x552.addr, align 4
  %2302 = load i64, i64* %w552.addr, align 8
  %2303 = lshr i64 %2302, 32
  %2304 = trunc i64 %2303 to i32
  store i32 %2304, i32* %x553.addr, align 4
  %2305 = load i32, i32* %x553.addr, align 4
  %2306 = load i32, i32* %x523.addr, align 4
  %2307 = load i32, i32* %x526.addr, align 4
  %2308 = call i64 @p256FiatAddcarryxU32(i32 %2305, i32 %2306, i32 %2307)
  store i64 %2308, i64* %w554.addr, align 8
  %2309 = load i64, i64* %w554.addr, align 8
  %2310 = trunc i64 %2309 to i32
  store i32 %2310, i32* %x554.addr, align 4
  %2311 = load i64, i64* %w554.addr, align 8
  %2312 = lshr i64 %2311, 32
  %2313 = trunc i64 %2312 to i32
  store i32 %2313, i32* %x555.addr, align 4
  %2314 = load i32, i32* %x555.addr, align 4
  %2315 = load i32, i32* %x524.addr, align 4
  %2316 = add i32 %2314, %2315
  store i32 %2316, i32* %x556.addr, align 4
  %2317 = load i32, i32* %x7.addr, align 4
  %2318 = load i32, i32* %arg1Limb7.addr, align 4
  %2319 = call i64 @p256FiatMulxU32(i32 %2317, i32 %2318)
  store i64 %2319, i64* %w557.addr, align 8
  %2320 = load i64, i64* %w557.addr, align 8
  %2321 = trunc i64 %2320 to i32
  store i32 %2321, i32* %x557.addr, align 4
  %2322 = load i64, i64* %w557.addr, align 8
  %2323 = lshr i64 %2322, 32
  %2324 = trunc i64 %2323 to i32
  store i32 %2324, i32* %x558.addr, align 4
  %2325 = load i32, i32* %x7.addr, align 4
  %2326 = load i32, i32* %arg1Limb6.addr, align 4
  %2327 = call i64 @p256FiatMulxU32(i32 %2325, i32 %2326)
  store i64 %2327, i64* %w559.addr, align 8
  %2328 = load i64, i64* %w559.addr, align 8
  %2329 = trunc i64 %2328 to i32
  store i32 %2329, i32* %x559.addr, align 4
  %2330 = load i64, i64* %w559.addr, align 8
  %2331 = lshr i64 %2330, 32
  %2332 = trunc i64 %2331 to i32
  store i32 %2332, i32* %x560.addr, align 4
  %2333 = load i32, i32* %x7.addr, align 4
  %2334 = load i32, i32* %arg1Limb5.addr, align 4
  %2335 = call i64 @p256FiatMulxU32(i32 %2333, i32 %2334)
  store i64 %2335, i64* %w561.addr, align 8
  %2336 = load i64, i64* %w561.addr, align 8
  %2337 = trunc i64 %2336 to i32
  store i32 %2337, i32* %x561.addr, align 4
  %2338 = load i64, i64* %w561.addr, align 8
  %2339 = lshr i64 %2338, 32
  %2340 = trunc i64 %2339 to i32
  store i32 %2340, i32* %x562.addr, align 4
  %2341 = load i32, i32* %x7.addr, align 4
  %2342 = load i32, i32* %arg1Limb4.addr, align 4
  %2343 = call i64 @p256FiatMulxU32(i32 %2341, i32 %2342)
  store i64 %2343, i64* %w563.addr, align 8
  %2344 = load i64, i64* %w563.addr, align 8
  %2345 = trunc i64 %2344 to i32
  store i32 %2345, i32* %x563.addr, align 4
  %2346 = load i64, i64* %w563.addr, align 8
  %2347 = lshr i64 %2346, 32
  %2348 = trunc i64 %2347 to i32
  store i32 %2348, i32* %x564.addr, align 4
  %2349 = load i32, i32* %x7.addr, align 4
  %2350 = load i32, i32* %arg1Limb3.addr, align 4
  %2351 = call i64 @p256FiatMulxU32(i32 %2349, i32 %2350)
  store i64 %2351, i64* %w565.addr, align 8
  %2352 = load i64, i64* %w565.addr, align 8
  %2353 = trunc i64 %2352 to i32
  store i32 %2353, i32* %x565.addr, align 4
  %2354 = load i64, i64* %w565.addr, align 8
  %2355 = lshr i64 %2354, 32
  %2356 = trunc i64 %2355 to i32
  store i32 %2356, i32* %x566.addr, align 4
  %2357 = load i32, i32* %x7.addr, align 4
  %2358 = load i32, i32* %arg1Limb2.addr, align 4
  %2359 = call i64 @p256FiatMulxU32(i32 %2357, i32 %2358)
  store i64 %2359, i64* %w567.addr, align 8
  %2360 = load i64, i64* %w567.addr, align 8
  %2361 = trunc i64 %2360 to i32
  store i32 %2361, i32* %x567.addr, align 4
  %2362 = load i64, i64* %w567.addr, align 8
  %2363 = lshr i64 %2362, 32
  %2364 = trunc i64 %2363 to i32
  store i32 %2364, i32* %x568.addr, align 4
  %2365 = load i32, i32* %x7.addr, align 4
  %2366 = load i32, i32* %arg1Limb1.addr, align 4
  %2367 = call i64 @p256FiatMulxU32(i32 %2365, i32 %2366)
  store i64 %2367, i64* %w569.addr, align 8
  %2368 = load i64, i64* %w569.addr, align 8
  %2369 = trunc i64 %2368 to i32
  store i32 %2369, i32* %x569.addr, align 4
  %2370 = load i64, i64* %w569.addr, align 8
  %2371 = lshr i64 %2370, 32
  %2372 = trunc i64 %2371 to i32
  store i32 %2372, i32* %x570.addr, align 4
  %2373 = load i32, i32* %x7.addr, align 4
  %2374 = load i32, i32* %arg1Limb0.addr, align 4
  %2375 = call i64 @p256FiatMulxU32(i32 %2373, i32 %2374)
  store i64 %2375, i64* %w571.addr, align 8
  %2376 = load i64, i64* %w571.addr, align 8
  %2377 = trunc i64 %2376 to i32
  store i32 %2377, i32* %x571.addr, align 4
  %2378 = load i64, i64* %w571.addr, align 8
  %2379 = lshr i64 %2378, 32
  %2380 = trunc i64 %2379 to i32
  store i32 %2380, i32* %x572.addr, align 4
  %2381 = load i32, i32* %x572.addr, align 4
  %2382 = load i32, i32* %x569.addr, align 4
  %2383 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2381, i32 %2382)
  store i64 %2383, i64* %w573.addr, align 8
  %2384 = load i64, i64* %w573.addr, align 8
  %2385 = trunc i64 %2384 to i32
  store i32 %2385, i32* %x573.addr, align 4
  %2386 = load i64, i64* %w573.addr, align 8
  %2387 = lshr i64 %2386, 32
  %2388 = trunc i64 %2387 to i32
  store i32 %2388, i32* %x574.addr, align 4
  %2389 = load i32, i32* %x574.addr, align 4
  %2390 = load i32, i32* %x570.addr, align 4
  %2391 = load i32, i32* %x567.addr, align 4
  %2392 = call i64 @p256FiatAddcarryxU32(i32 %2389, i32 %2390, i32 %2391)
  store i64 %2392, i64* %w575.addr, align 8
  %2393 = load i64, i64* %w575.addr, align 8
  %2394 = trunc i64 %2393 to i32
  store i32 %2394, i32* %x575.addr, align 4
  %2395 = load i64, i64* %w575.addr, align 8
  %2396 = lshr i64 %2395, 32
  %2397 = trunc i64 %2396 to i32
  store i32 %2397, i32* %x576.addr, align 4
  %2398 = load i32, i32* %x576.addr, align 4
  %2399 = load i32, i32* %x568.addr, align 4
  %2400 = load i32, i32* %x565.addr, align 4
  %2401 = call i64 @p256FiatAddcarryxU32(i32 %2398, i32 %2399, i32 %2400)
  store i64 %2401, i64* %w577.addr, align 8
  %2402 = load i64, i64* %w577.addr, align 8
  %2403 = trunc i64 %2402 to i32
  store i32 %2403, i32* %x577.addr, align 4
  %2404 = load i64, i64* %w577.addr, align 8
  %2405 = lshr i64 %2404, 32
  %2406 = trunc i64 %2405 to i32
  store i32 %2406, i32* %x578.addr, align 4
  %2407 = load i32, i32* %x578.addr, align 4
  %2408 = load i32, i32* %x566.addr, align 4
  %2409 = load i32, i32* %x563.addr, align 4
  %2410 = call i64 @p256FiatAddcarryxU32(i32 %2407, i32 %2408, i32 %2409)
  store i64 %2410, i64* %w579.addr, align 8
  %2411 = load i64, i64* %w579.addr, align 8
  %2412 = trunc i64 %2411 to i32
  store i32 %2412, i32* %x579.addr, align 4
  %2413 = load i64, i64* %w579.addr, align 8
  %2414 = lshr i64 %2413, 32
  %2415 = trunc i64 %2414 to i32
  store i32 %2415, i32* %x580.addr, align 4
  %2416 = load i32, i32* %x580.addr, align 4
  %2417 = load i32, i32* %x564.addr, align 4
  %2418 = load i32, i32* %x561.addr, align 4
  %2419 = call i64 @p256FiatAddcarryxU32(i32 %2416, i32 %2417, i32 %2418)
  store i64 %2419, i64* %w581.addr, align 8
  %2420 = load i64, i64* %w581.addr, align 8
  %2421 = trunc i64 %2420 to i32
  store i32 %2421, i32* %x581.addr, align 4
  %2422 = load i64, i64* %w581.addr, align 8
  %2423 = lshr i64 %2422, 32
  %2424 = trunc i64 %2423 to i32
  store i32 %2424, i32* %x582.addr, align 4
  %2425 = load i32, i32* %x582.addr, align 4
  %2426 = load i32, i32* %x562.addr, align 4
  %2427 = load i32, i32* %x559.addr, align 4
  %2428 = call i64 @p256FiatAddcarryxU32(i32 %2425, i32 %2426, i32 %2427)
  store i64 %2428, i64* %w583.addr, align 8
  %2429 = load i64, i64* %w583.addr, align 8
  %2430 = trunc i64 %2429 to i32
  store i32 %2430, i32* %x583.addr, align 4
  %2431 = load i64, i64* %w583.addr, align 8
  %2432 = lshr i64 %2431, 32
  %2433 = trunc i64 %2432 to i32
  store i32 %2433, i32* %x584.addr, align 4
  %2434 = load i32, i32* %x584.addr, align 4
  %2435 = load i32, i32* %x560.addr, align 4
  %2436 = load i32, i32* %x557.addr, align 4
  %2437 = call i64 @p256FiatAddcarryxU32(i32 %2434, i32 %2435, i32 %2436)
  store i64 %2437, i64* %w585.addr, align 8
  %2438 = load i64, i64* %w585.addr, align 8
  %2439 = trunc i64 %2438 to i32
  store i32 %2439, i32* %x585.addr, align 4
  %2440 = load i64, i64* %w585.addr, align 8
  %2441 = lshr i64 %2440, 32
  %2442 = trunc i64 %2441 to i32
  store i32 %2442, i32* %x586.addr, align 4
  %2443 = load i32, i32* %x586.addr, align 4
  %2444 = load i32, i32* %x558.addr, align 4
  %2445 = add i32 %2443, %2444
  store i32 %2445, i32* %x587.addr, align 4
  %2446 = load i32, i32* %x540.addr, align 4
  %2447 = load i32, i32* %x571.addr, align 4
  %2448 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2446, i32 %2447)
  store i64 %2448, i64* %w588.addr, align 8
  %2449 = load i64, i64* %w588.addr, align 8
  %2450 = trunc i64 %2449 to i32
  store i32 %2450, i32* %x588.addr, align 4
  %2451 = load i64, i64* %w588.addr, align 8
  %2452 = lshr i64 %2451, 32
  %2453 = trunc i64 %2452 to i32
  store i32 %2453, i32* %x589.addr, align 4
  %2454 = load i32, i32* %x589.addr, align 4
  %2455 = load i32, i32* %x542.addr, align 4
  %2456 = load i32, i32* %x573.addr, align 4
  %2457 = call i64 @p256FiatAddcarryxU32(i32 %2454, i32 %2455, i32 %2456)
  store i64 %2457, i64* %w590.addr, align 8
  %2458 = load i64, i64* %w590.addr, align 8
  %2459 = trunc i64 %2458 to i32
  store i32 %2459, i32* %x590.addr, align 4
  %2460 = load i64, i64* %w590.addr, align 8
  %2461 = lshr i64 %2460, 32
  %2462 = trunc i64 %2461 to i32
  store i32 %2462, i32* %x591.addr, align 4
  %2463 = load i32, i32* %x591.addr, align 4
  %2464 = load i32, i32* %x544.addr, align 4
  %2465 = load i32, i32* %x575.addr, align 4
  %2466 = call i64 @p256FiatAddcarryxU32(i32 %2463, i32 %2464, i32 %2465)
  store i64 %2466, i64* %w592.addr, align 8
  %2467 = load i64, i64* %w592.addr, align 8
  %2468 = trunc i64 %2467 to i32
  store i32 %2468, i32* %x592.addr, align 4
  %2469 = load i64, i64* %w592.addr, align 8
  %2470 = lshr i64 %2469, 32
  %2471 = trunc i64 %2470 to i32
  store i32 %2471, i32* %x593.addr, align 4
  %2472 = load i32, i32* %x593.addr, align 4
  %2473 = load i32, i32* %x546.addr, align 4
  %2474 = load i32, i32* %x577.addr, align 4
  %2475 = call i64 @p256FiatAddcarryxU32(i32 %2472, i32 %2473, i32 %2474)
  store i64 %2475, i64* %w594.addr, align 8
  %2476 = load i64, i64* %w594.addr, align 8
  %2477 = trunc i64 %2476 to i32
  store i32 %2477, i32* %x594.addr, align 4
  %2478 = load i64, i64* %w594.addr, align 8
  %2479 = lshr i64 %2478, 32
  %2480 = trunc i64 %2479 to i32
  store i32 %2480, i32* %x595.addr, align 4
  %2481 = load i32, i32* %x595.addr, align 4
  %2482 = load i32, i32* %x548.addr, align 4
  %2483 = load i32, i32* %x579.addr, align 4
  %2484 = call i64 @p256FiatAddcarryxU32(i32 %2481, i32 %2482, i32 %2483)
  store i64 %2484, i64* %w596.addr, align 8
  %2485 = load i64, i64* %w596.addr, align 8
  %2486 = trunc i64 %2485 to i32
  store i32 %2486, i32* %x596.addr, align 4
  %2487 = load i64, i64* %w596.addr, align 8
  %2488 = lshr i64 %2487, 32
  %2489 = trunc i64 %2488 to i32
  store i32 %2489, i32* %x597.addr, align 4
  %2490 = load i32, i32* %x597.addr, align 4
  %2491 = load i32, i32* %x550.addr, align 4
  %2492 = load i32, i32* %x581.addr, align 4
  %2493 = call i64 @p256FiatAddcarryxU32(i32 %2490, i32 %2491, i32 %2492)
  store i64 %2493, i64* %w598.addr, align 8
  %2494 = load i64, i64* %w598.addr, align 8
  %2495 = trunc i64 %2494 to i32
  store i32 %2495, i32* %x598.addr, align 4
  %2496 = load i64, i64* %w598.addr, align 8
  %2497 = lshr i64 %2496, 32
  %2498 = trunc i64 %2497 to i32
  store i32 %2498, i32* %x599.addr, align 4
  %2499 = load i32, i32* %x599.addr, align 4
  %2500 = load i32, i32* %x552.addr, align 4
  %2501 = load i32, i32* %x583.addr, align 4
  %2502 = call i64 @p256FiatAddcarryxU32(i32 %2499, i32 %2500, i32 %2501)
  store i64 %2502, i64* %w600.addr, align 8
  %2503 = load i64, i64* %w600.addr, align 8
  %2504 = trunc i64 %2503 to i32
  store i32 %2504, i32* %x600.addr, align 4
  %2505 = load i64, i64* %w600.addr, align 8
  %2506 = lshr i64 %2505, 32
  %2507 = trunc i64 %2506 to i32
  store i32 %2507, i32* %x601.addr, align 4
  %2508 = load i32, i32* %x601.addr, align 4
  %2509 = load i32, i32* %x554.addr, align 4
  %2510 = load i32, i32* %x585.addr, align 4
  %2511 = call i64 @p256FiatAddcarryxU32(i32 %2508, i32 %2509, i32 %2510)
  store i64 %2511, i64* %w602.addr, align 8
  %2512 = load i64, i64* %w602.addr, align 8
  %2513 = trunc i64 %2512 to i32
  store i32 %2513, i32* %x602.addr, align 4
  %2514 = load i64, i64* %w602.addr, align 8
  %2515 = lshr i64 %2514, 32
  %2516 = trunc i64 %2515 to i32
  store i32 %2516, i32* %x603.addr, align 4
  %2517 = load i32, i32* %x603.addr, align 4
  %2518 = load i32, i32* %x556.addr, align 4
  %2519 = load i32, i32* %x587.addr, align 4
  %2520 = call i64 @p256FiatAddcarryxU32(i32 %2517, i32 %2518, i32 %2519)
  store i64 %2520, i64* %w604.addr, align 8
  %2521 = load i64, i64* %w604.addr, align 8
  %2522 = trunc i64 %2521 to i32
  store i32 %2522, i32* %x604.addr, align 4
  %2523 = load i64, i64* %w604.addr, align 8
  %2524 = lshr i64 %2523, 32
  %2525 = trunc i64 %2524 to i32
  store i32 %2525, i32* %x605.addr, align 4
  %2526 = load i32, i32* %x588.addr, align 4
  %2527 = call i64 @p256FiatMulxU32(i32 %2526, i32 4294967295)
  store i64 %2527, i64* %w606.addr, align 8
  %2528 = load i64, i64* %w606.addr, align 8
  %2529 = trunc i64 %2528 to i32
  store i32 %2529, i32* %x606.addr, align 4
  %2530 = load i64, i64* %w606.addr, align 8
  %2531 = lshr i64 %2530, 32
  %2532 = trunc i64 %2531 to i32
  store i32 %2532, i32* %x607.addr, align 4
  %2533 = load i32, i32* %x588.addr, align 4
  %2534 = call i64 @p256FiatMulxU32(i32 %2533, i32 4294967295)
  store i64 %2534, i64* %w608.addr, align 8
  %2535 = load i64, i64* %w608.addr, align 8
  %2536 = trunc i64 %2535 to i32
  store i32 %2536, i32* %x608.addr, align 4
  %2537 = load i64, i64* %w608.addr, align 8
  %2538 = lshr i64 %2537, 32
  %2539 = trunc i64 %2538 to i32
  store i32 %2539, i32* %x609.addr, align 4
  %2540 = load i32, i32* %x588.addr, align 4
  %2541 = call i64 @p256FiatMulxU32(i32 %2540, i32 4294967295)
  store i64 %2541, i64* %w610.addr, align 8
  %2542 = load i64, i64* %w610.addr, align 8
  %2543 = trunc i64 %2542 to i32
  store i32 %2543, i32* %x610.addr, align 4
  %2544 = load i64, i64* %w610.addr, align 8
  %2545 = lshr i64 %2544, 32
  %2546 = trunc i64 %2545 to i32
  store i32 %2546, i32* %x611.addr, align 4
  %2547 = load i32, i32* %x588.addr, align 4
  %2548 = call i64 @p256FiatMulxU32(i32 %2547, i32 4294967295)
  store i64 %2548, i64* %w612.addr, align 8
  %2549 = load i64, i64* %w612.addr, align 8
  %2550 = trunc i64 %2549 to i32
  store i32 %2550, i32* %x612.addr, align 4
  %2551 = load i64, i64* %w612.addr, align 8
  %2552 = lshr i64 %2551, 32
  %2553 = trunc i64 %2552 to i32
  store i32 %2553, i32* %x613.addr, align 4
  %2554 = load i32, i32* %x613.addr, align 4
  %2555 = load i32, i32* %x610.addr, align 4
  %2556 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2554, i32 %2555)
  store i64 %2556, i64* %w614.addr, align 8
  %2557 = load i64, i64* %w614.addr, align 8
  %2558 = trunc i64 %2557 to i32
  store i32 %2558, i32* %x614.addr, align 4
  %2559 = load i64, i64* %w614.addr, align 8
  %2560 = lshr i64 %2559, 32
  %2561 = trunc i64 %2560 to i32
  store i32 %2561, i32* %x615.addr, align 4
  %2562 = load i32, i32* %x615.addr, align 4
  %2563 = load i32, i32* %x611.addr, align 4
  %2564 = load i32, i32* %x608.addr, align 4
  %2565 = call i64 @p256FiatAddcarryxU32(i32 %2562, i32 %2563, i32 %2564)
  store i64 %2565, i64* %w616.addr, align 8
  %2566 = load i64, i64* %w616.addr, align 8
  %2567 = trunc i64 %2566 to i32
  store i32 %2567, i32* %x616.addr, align 4
  %2568 = load i64, i64* %w616.addr, align 8
  %2569 = lshr i64 %2568, 32
  %2570 = trunc i64 %2569 to i32
  store i32 %2570, i32* %x617.addr, align 4
  %2571 = load i32, i32* %x617.addr, align 4
  %2572 = load i32, i32* %x609.addr, align 4
  %2573 = add i32 %2571, %2572
  store i32 %2573, i32* %x618.addr, align 4
  %2574 = load i32, i32* %x588.addr, align 4
  %2575 = load i32, i32* %x612.addr, align 4
  %2576 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2574, i32 %2575)
  store i64 %2576, i64* %w619.addr, align 8
  %2577 = load i64, i64* %w619.addr, align 8
  %2578 = lshr i64 %2577, 32
  %2579 = trunc i64 %2578 to i32
  store i32 %2579, i32* %x620.addr, align 4
  %2580 = load i32, i32* %x620.addr, align 4
  %2581 = load i32, i32* %x590.addr, align 4
  %2582 = load i32, i32* %x614.addr, align 4
  %2583 = call i64 @p256FiatAddcarryxU32(i32 %2580, i32 %2581, i32 %2582)
  store i64 %2583, i64* %w621.addr, align 8
  %2584 = load i64, i64* %w621.addr, align 8
  %2585 = trunc i64 %2584 to i32
  store i32 %2585, i32* %x621.addr, align 4
  %2586 = load i64, i64* %w621.addr, align 8
  %2587 = lshr i64 %2586, 32
  %2588 = trunc i64 %2587 to i32
  store i32 %2588, i32* %x622.addr, align 4
  %2589 = load i32, i32* %x622.addr, align 4
  %2590 = load i32, i32* %x592.addr, align 4
  %2591 = load i32, i32* %x616.addr, align 4
  %2592 = call i64 @p256FiatAddcarryxU32(i32 %2589, i32 %2590, i32 %2591)
  store i64 %2592, i64* %w623.addr, align 8
  %2593 = load i64, i64* %w623.addr, align 8
  %2594 = trunc i64 %2593 to i32
  store i32 %2594, i32* %x623.addr, align 4
  %2595 = load i64, i64* %w623.addr, align 8
  %2596 = lshr i64 %2595, 32
  %2597 = trunc i64 %2596 to i32
  store i32 %2597, i32* %x624.addr, align 4
  %2598 = load i32, i32* %x624.addr, align 4
  %2599 = load i32, i32* %x594.addr, align 4
  %2600 = load i32, i32* %x618.addr, align 4
  %2601 = call i64 @p256FiatAddcarryxU32(i32 %2598, i32 %2599, i32 %2600)
  store i64 %2601, i64* %w625.addr, align 8
  %2602 = load i64, i64* %w625.addr, align 8
  %2603 = trunc i64 %2602 to i32
  store i32 %2603, i32* %x625.addr, align 4
  %2604 = load i64, i64* %w625.addr, align 8
  %2605 = lshr i64 %2604, 32
  %2606 = trunc i64 %2605 to i32
  store i32 %2606, i32* %x626.addr, align 4
  %2607 = load i32, i32* %x626.addr, align 4
  %2608 = load i32, i32* %x596.addr, align 4
  %2609 = call i64 @p256FiatAddcarryxU32(i32 %2607, i32 %2608, i32 0)
  store i64 %2609, i64* %w627.addr, align 8
  %2610 = load i64, i64* %w627.addr, align 8
  %2611 = trunc i64 %2610 to i32
  store i32 %2611, i32* %x627.addr, align 4
  %2612 = load i64, i64* %w627.addr, align 8
  %2613 = lshr i64 %2612, 32
  %2614 = trunc i64 %2613 to i32
  store i32 %2614, i32* %x628.addr, align 4
  %2615 = load i32, i32* %x628.addr, align 4
  %2616 = load i32, i32* %x598.addr, align 4
  %2617 = call i64 @p256FiatAddcarryxU32(i32 %2615, i32 %2616, i32 0)
  store i64 %2617, i64* %w629.addr, align 8
  %2618 = load i64, i64* %w629.addr, align 8
  %2619 = trunc i64 %2618 to i32
  store i32 %2619, i32* %x629.addr, align 4
  %2620 = load i64, i64* %w629.addr, align 8
  %2621 = lshr i64 %2620, 32
  %2622 = trunc i64 %2621 to i32
  store i32 %2622, i32* %x630.addr, align 4
  %2623 = load i32, i32* %x630.addr, align 4
  %2624 = load i32, i32* %x600.addr, align 4
  %2625 = load i32, i32* %x588.addr, align 4
  %2626 = call i64 @p256FiatAddcarryxU32(i32 %2623, i32 %2624, i32 %2625)
  store i64 %2626, i64* %w631.addr, align 8
  %2627 = load i64, i64* %w631.addr, align 8
  %2628 = trunc i64 %2627 to i32
  store i32 %2628, i32* %x631.addr, align 4
  %2629 = load i64, i64* %w631.addr, align 8
  %2630 = lshr i64 %2629, 32
  %2631 = trunc i64 %2630 to i32
  store i32 %2631, i32* %x632.addr, align 4
  %2632 = load i32, i32* %x632.addr, align 4
  %2633 = load i32, i32* %x602.addr, align 4
  %2634 = load i32, i32* %x606.addr, align 4
  %2635 = call i64 @p256FiatAddcarryxU32(i32 %2632, i32 %2633, i32 %2634)
  store i64 %2635, i64* %w633.addr, align 8
  %2636 = load i64, i64* %w633.addr, align 8
  %2637 = trunc i64 %2636 to i32
  store i32 %2637, i32* %x633.addr, align 4
  %2638 = load i64, i64* %w633.addr, align 8
  %2639 = lshr i64 %2638, 32
  %2640 = trunc i64 %2639 to i32
  store i32 %2640, i32* %x634.addr, align 4
  %2641 = load i32, i32* %x634.addr, align 4
  %2642 = load i32, i32* %x604.addr, align 4
  %2643 = load i32, i32* %x607.addr, align 4
  %2644 = call i64 @p256FiatAddcarryxU32(i32 %2641, i32 %2642, i32 %2643)
  store i64 %2644, i64* %w635.addr, align 8
  %2645 = load i64, i64* %w635.addr, align 8
  %2646 = trunc i64 %2645 to i32
  store i32 %2646, i32* %x635.addr, align 4
  %2647 = load i64, i64* %w635.addr, align 8
  %2648 = lshr i64 %2647, 32
  %2649 = trunc i64 %2648 to i32
  store i32 %2649, i32* %x636.addr, align 4
  %2650 = load i32, i32* %x636.addr, align 4
  %2651 = load i32, i32* %x605.addr, align 4
  %2652 = add i32 %2650, %2651
  store i32 %2652, i32* %x637.addr, align 4
  %2653 = load i32, i32* %x621.addr, align 4
  %2654 = call i64 @p256FiatSubborrowxU32(i32 0, i32 %2653, i32 4294967295)
  store i64 %2654, i64* %w638.addr, align 8
  %2655 = load i64, i64* %w638.addr, align 8
  %2656 = trunc i64 %2655 to i32
  store i32 %2656, i32* %x638.addr, align 4
  %2657 = load i64, i64* %w638.addr, align 8
  %2658 = lshr i64 %2657, 32
  %2659 = trunc i64 %2658 to i32
  store i32 %2659, i32* %x639.addr, align 4
  %2660 = load i32, i32* %x639.addr, align 4
  %2661 = load i32, i32* %x623.addr, align 4
  %2662 = call i64 @p256FiatSubborrowxU32(i32 %2660, i32 %2661, i32 4294967295)
  store i64 %2662, i64* %w640.addr, align 8
  %2663 = load i64, i64* %w640.addr, align 8
  %2664 = trunc i64 %2663 to i32
  store i32 %2664, i32* %x640.addr, align 4
  %2665 = load i64, i64* %w640.addr, align 8
  %2666 = lshr i64 %2665, 32
  %2667 = trunc i64 %2666 to i32
  store i32 %2667, i32* %x641.addr, align 4
  %2668 = load i32, i32* %x641.addr, align 4
  %2669 = load i32, i32* %x625.addr, align 4
  %2670 = call i64 @p256FiatSubborrowxU32(i32 %2668, i32 %2669, i32 4294967295)
  store i64 %2670, i64* %w642.addr, align 8
  %2671 = load i64, i64* %w642.addr, align 8
  %2672 = trunc i64 %2671 to i32
  store i32 %2672, i32* %x642.addr, align 4
  %2673 = load i64, i64* %w642.addr, align 8
  %2674 = lshr i64 %2673, 32
  %2675 = trunc i64 %2674 to i32
  store i32 %2675, i32* %x643.addr, align 4
  %2676 = load i32, i32* %x643.addr, align 4
  %2677 = load i32, i32* %x627.addr, align 4
  %2678 = call i64 @p256FiatSubborrowxU32(i32 %2676, i32 %2677, i32 0)
  store i64 %2678, i64* %w644.addr, align 8
  %2679 = load i64, i64* %w644.addr, align 8
  %2680 = trunc i64 %2679 to i32
  store i32 %2680, i32* %x644.addr, align 4
  %2681 = load i64, i64* %w644.addr, align 8
  %2682 = lshr i64 %2681, 32
  %2683 = trunc i64 %2682 to i32
  store i32 %2683, i32* %x645.addr, align 4
  %2684 = load i32, i32* %x645.addr, align 4
  %2685 = load i32, i32* %x629.addr, align 4
  %2686 = call i64 @p256FiatSubborrowxU32(i32 %2684, i32 %2685, i32 0)
  store i64 %2686, i64* %w646.addr, align 8
  %2687 = load i64, i64* %w646.addr, align 8
  %2688 = trunc i64 %2687 to i32
  store i32 %2688, i32* %x646.addr, align 4
  %2689 = load i64, i64* %w646.addr, align 8
  %2690 = lshr i64 %2689, 32
  %2691 = trunc i64 %2690 to i32
  store i32 %2691, i32* %x647.addr, align 4
  %2692 = load i32, i32* %x647.addr, align 4
  %2693 = load i32, i32* %x631.addr, align 4
  %2694 = call i64 @p256FiatSubborrowxU32(i32 %2692, i32 %2693, i32 0)
  store i64 %2694, i64* %w648.addr, align 8
  %2695 = load i64, i64* %w648.addr, align 8
  %2696 = trunc i64 %2695 to i32
  store i32 %2696, i32* %x648.addr, align 4
  %2697 = load i64, i64* %w648.addr, align 8
  %2698 = lshr i64 %2697, 32
  %2699 = trunc i64 %2698 to i32
  store i32 %2699, i32* %x649.addr, align 4
  %2700 = load i32, i32* %x649.addr, align 4
  %2701 = load i32, i32* %x633.addr, align 4
  %2702 = call i64 @p256FiatSubborrowxU32(i32 %2700, i32 %2701, i32 1)
  store i64 %2702, i64* %w650.addr, align 8
  %2703 = load i64, i64* %w650.addr, align 8
  %2704 = trunc i64 %2703 to i32
  store i32 %2704, i32* %x650.addr, align 4
  %2705 = load i64, i64* %w650.addr, align 8
  %2706 = lshr i64 %2705, 32
  %2707 = trunc i64 %2706 to i32
  store i32 %2707, i32* %x651.addr, align 4
  %2708 = load i32, i32* %x651.addr, align 4
  %2709 = load i32, i32* %x635.addr, align 4
  %2710 = call i64 @p256FiatSubborrowxU32(i32 %2708, i32 %2709, i32 4294967295)
  store i64 %2710, i64* %w652.addr, align 8
  %2711 = load i64, i64* %w652.addr, align 8
  %2712 = trunc i64 %2711 to i32
  store i32 %2712, i32* %x652.addr, align 4
  %2713 = load i64, i64* %w652.addr, align 8
  %2714 = lshr i64 %2713, 32
  %2715 = trunc i64 %2714 to i32
  store i32 %2715, i32* %x653.addr, align 4
  %2716 = load i32, i32* %x653.addr, align 4
  %2717 = load i32, i32* %x637.addr, align 4
  %2718 = call i64 @p256FiatSubborrowxU32(i32 %2716, i32 %2717, i32 0)
  store i64 %2718, i64* %w654.addr, align 8
  %2719 = load i64, i64* %w654.addr, align 8
  %2720 = lshr i64 %2719, 32
  %2721 = trunc i64 %2720 to i32
  store i32 %2721, i32* %x655.addr, align 4
  %2722 = load i32, i32* %x655.addr, align 4
  %2723 = load i32, i32* %x638.addr, align 4
  %2724 = load i32, i32* %x621.addr, align 4
  %2725 = call i32 @p256FiatCmovznzU32(i32 %2722, i32 %2723, i32 %2724)
  store i32 %2725, i32* %x656.addr, align 4
  %2726 = load i32, i32* %x655.addr, align 4
  %2727 = load i32, i32* %x640.addr, align 4
  %2728 = load i32, i32* %x623.addr, align 4
  %2729 = call i32 @p256FiatCmovznzU32(i32 %2726, i32 %2727, i32 %2728)
  store i32 %2729, i32* %x657.addr, align 4
  %2730 = load i32, i32* %x655.addr, align 4
  %2731 = load i32, i32* %x642.addr, align 4
  %2732 = load i32, i32* %x625.addr, align 4
  %2733 = call i32 @p256FiatCmovznzU32(i32 %2730, i32 %2731, i32 %2732)
  store i32 %2733, i32* %x658.addr, align 4
  %2734 = load i32, i32* %x655.addr, align 4
  %2735 = load i32, i32* %x644.addr, align 4
  %2736 = load i32, i32* %x627.addr, align 4
  %2737 = call i32 @p256FiatCmovznzU32(i32 %2734, i32 %2735, i32 %2736)
  store i32 %2737, i32* %x659.addr, align 4
  %2738 = load i32, i32* %x655.addr, align 4
  %2739 = load i32, i32* %x646.addr, align 4
  %2740 = load i32, i32* %x629.addr, align 4
  %2741 = call i32 @p256FiatCmovznzU32(i32 %2738, i32 %2739, i32 %2740)
  store i32 %2741, i32* %x660.addr, align 4
  %2742 = load i32, i32* %x655.addr, align 4
  %2743 = load i32, i32* %x648.addr, align 4
  %2744 = load i32, i32* %x631.addr, align 4
  %2745 = call i32 @p256FiatCmovznzU32(i32 %2742, i32 %2743, i32 %2744)
  store i32 %2745, i32* %x661.addr, align 4
  %2746 = load i32, i32* %x655.addr, align 4
  %2747 = load i32, i32* %x650.addr, align 4
  %2748 = load i32, i32* %x633.addr, align 4
  %2749 = call i32 @p256FiatCmovznzU32(i32 %2746, i32 %2747, i32 %2748)
  store i32 %2749, i32* %x662.addr, align 4
  %2750 = load i32, i32* %x655.addr, align 4
  %2751 = load i32, i32* %x652.addr, align 4
  %2752 = load i32, i32* %x635.addr, align 4
  %2753 = call i32 @p256FiatCmovznzU32(i32 %2750, i32 %2751, i32 %2752)
  store i32 %2753, i32* %x663.addr, align 4
  %2754 = load i32, i32* %x656.addr, align 4
  %2755 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2756 = load i8*, i8** %2755, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2757 = bitcast i8* %2756 to i32*
  %2758 = getelementptr inbounds i32, i32* %2757, i64 0
  store i32 %2754, i32* %2758, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2759 = load i32, i32* %x657.addr, align 4
  %2760 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2761 = load i8*, i8** %2760, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2762 = bitcast i8* %2761 to i32*
  %2763 = getelementptr inbounds i32, i32* %2762, i64 1
  store i32 %2759, i32* %2763, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2764 = load i32, i32* %x658.addr, align 4
  %2765 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2766 = load i8*, i8** %2765, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2767 = bitcast i8* %2766 to i32*
  %2768 = getelementptr inbounds i32, i32* %2767, i64 2
  store i32 %2764, i32* %2768, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2769 = load i32, i32* %x659.addr, align 4
  %2770 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2771 = load i8*, i8** %2770, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2772 = bitcast i8* %2771 to i32*
  %2773 = getelementptr inbounds i32, i32* %2772, i64 3
  store i32 %2769, i32* %2773, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2774 = load i32, i32* %x660.addr, align 4
  %2775 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2776 = load i8*, i8** %2775, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2777 = bitcast i8* %2776 to i32*
  %2778 = getelementptr inbounds i32, i32* %2777, i64 4
  store i32 %2774, i32* %2778, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2779 = load i32, i32* %x661.addr, align 4
  %2780 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2781 = load i8*, i8** %2780, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2782 = bitcast i8* %2781 to i32*
  %2783 = getelementptr inbounds i32, i32* %2782, i64 5
  store i32 %2779, i32* %2783, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2784 = load i32, i32* %x662.addr, align 4
  %2785 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2786 = load i8*, i8** %2785, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2787 = bitcast i8* %2786 to i32*
  %2788 = getelementptr inbounds i32, i32* %2787, i64 6
  store i32 %2784, i32* %2788, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2789 = load i32, i32* %x663.addr, align 4
  %2790 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %2791 = load i8*, i8** %2790, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2792 = bitcast i8* %2791 to i32*
  %2793 = getelementptr inbounds i32, i32* %2792, i64 7
  store i32 %2789, i32* %2793, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define void @p256FiatScalarMul(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg2) #1 {
entry:
  %x1.addr = alloca i32, align 4
  %x2.addr = alloca i32, align 4
  %x3.addr = alloca i32, align 4
  %x4.addr = alloca i32, align 4
  %x5.addr = alloca i32, align 4
  %x6.addr = alloca i32, align 4
  %x7.addr = alloca i32, align 4
  %x8.addr = alloca i32, align 4
  %w9.addr = alloca i64, align 8
  %x9.addr = alloca i32, align 4
  %x10.addr = alloca i32, align 4
  %w11.addr = alloca i64, align 8
  %x11.addr = alloca i32, align 4
  %x12.addr = alloca i32, align 4
  %w13.addr = alloca i64, align 8
  %x13.addr = alloca i32, align 4
  %x14.addr = alloca i32, align 4
  %w15.addr = alloca i64, align 8
  %x15.addr = alloca i32, align 4
  %x16.addr = alloca i32, align 4
  %w17.addr = alloca i64, align 8
  %x17.addr = alloca i32, align 4
  %x18.addr = alloca i32, align 4
  %w19.addr = alloca i64, align 8
  %x19.addr = alloca i32, align 4
  %x20.addr = alloca i32, align 4
  %w21.addr = alloca i64, align 8
  %x21.addr = alloca i32, align 4
  %x22.addr = alloca i32, align 4
  %w23.addr = alloca i64, align 8
  %x23.addr = alloca i32, align 4
  %x24.addr = alloca i32, align 4
  %w25.addr = alloca i64, align 8
  %x25.addr = alloca i32, align 4
  %x26.addr = alloca i32, align 4
  %w27.addr = alloca i64, align 8
  %x27.addr = alloca i32, align 4
  %x28.addr = alloca i32, align 4
  %w29.addr = alloca i64, align 8
  %x29.addr = alloca i32, align 4
  %x30.addr = alloca i32, align 4
  %w31.addr = alloca i64, align 8
  %x31.addr = alloca i32, align 4
  %x32.addr = alloca i32, align 4
  %w33.addr = alloca i64, align 8
  %x33.addr = alloca i32, align 4
  %x34.addr = alloca i32, align 4
  %w35.addr = alloca i64, align 8
  %x35.addr = alloca i32, align 4
  %x36.addr = alloca i32, align 4
  %w37.addr = alloca i64, align 8
  %x37.addr = alloca i32, align 4
  %x38.addr = alloca i32, align 4
  %x39.addr = alloca i32, align 4
  %w40.addr = alloca i64, align 8
  %x40.addr = alloca i32, align 4
  %w42.addr = alloca i64, align 8
  %x42.addr = alloca i32, align 4
  %x43.addr = alloca i32, align 4
  %w44.addr = alloca i64, align 8
  %x44.addr = alloca i32, align 4
  %x45.addr = alloca i32, align 4
  %w46.addr = alloca i64, align 8
  %x46.addr = alloca i32, align 4
  %x47.addr = alloca i32, align 4
  %w48.addr = alloca i64, align 8
  %x48.addr = alloca i32, align 4
  %x49.addr = alloca i32, align 4
  %w50.addr = alloca i64, align 8
  %x50.addr = alloca i32, align 4
  %x51.addr = alloca i32, align 4
  %w52.addr = alloca i64, align 8
  %x52.addr = alloca i32, align 4
  %x53.addr = alloca i32, align 4
  %w54.addr = alloca i64, align 8
  %x54.addr = alloca i32, align 4
  %x55.addr = alloca i32, align 4
  %w56.addr = alloca i64, align 8
  %x56.addr = alloca i32, align 4
  %x57.addr = alloca i32, align 4
  %w58.addr = alloca i64, align 8
  %x58.addr = alloca i32, align 4
  %x59.addr = alloca i32, align 4
  %w60.addr = alloca i64, align 8
  %x60.addr = alloca i32, align 4
  %x61.addr = alloca i32, align 4
  %w62.addr = alloca i64, align 8
  %x62.addr = alloca i32, align 4
  %x63.addr = alloca i32, align 4
  %w64.addr = alloca i64, align 8
  %x64.addr = alloca i32, align 4
  %x65.addr = alloca i32, align 4
  %x66.addr = alloca i32, align 4
  %w67.addr = alloca i64, align 8
  %x68.addr = alloca i32, align 4
  %w69.addr = alloca i64, align 8
  %x69.addr = alloca i32, align 4
  %x70.addr = alloca i32, align 4
  %w71.addr = alloca i64, align 8
  %x71.addr = alloca i32, align 4
  %x72.addr = alloca i32, align 4
  %w73.addr = alloca i64, align 8
  %x73.addr = alloca i32, align 4
  %x74.addr = alloca i32, align 4
  %w75.addr = alloca i64, align 8
  %x75.addr = alloca i32, align 4
  %x76.addr = alloca i32, align 4
  %w77.addr = alloca i64, align 8
  %x77.addr = alloca i32, align 4
  %x78.addr = alloca i32, align 4
  %w79.addr = alloca i64, align 8
  %x79.addr = alloca i32, align 4
  %x80.addr = alloca i32, align 4
  %w81.addr = alloca i64, align 8
  %x81.addr = alloca i32, align 4
  %x82.addr = alloca i32, align 4
  %w83.addr = alloca i64, align 8
  %x83.addr = alloca i32, align 4
  %x84.addr = alloca i32, align 4
  %w85.addr = alloca i64, align 8
  %x85.addr = alloca i32, align 4
  %x86.addr = alloca i32, align 4
  %w87.addr = alloca i64, align 8
  %x87.addr = alloca i32, align 4
  %x88.addr = alloca i32, align 4
  %w89.addr = alloca i64, align 8
  %x89.addr = alloca i32, align 4
  %x90.addr = alloca i32, align 4
  %w91.addr = alloca i64, align 8
  %x91.addr = alloca i32, align 4
  %x92.addr = alloca i32, align 4
  %w93.addr = alloca i64, align 8
  %x93.addr = alloca i32, align 4
  %x94.addr = alloca i32, align 4
  %w95.addr = alloca i64, align 8
  %x95.addr = alloca i32, align 4
  %x96.addr = alloca i32, align 4
  %w97.addr = alloca i64, align 8
  %x97.addr = alloca i32, align 4
  %x98.addr = alloca i32, align 4
  %w99.addr = alloca i64, align 8
  %x99.addr = alloca i32, align 4
  %x100.addr = alloca i32, align 4
  %w101.addr = alloca i64, align 8
  %x101.addr = alloca i32, align 4
  %x102.addr = alloca i32, align 4
  %w103.addr = alloca i64, align 8
  %x103.addr = alloca i32, align 4
  %x104.addr = alloca i32, align 4
  %w105.addr = alloca i64, align 8
  %x105.addr = alloca i32, align 4
  %x106.addr = alloca i32, align 4
  %w107.addr = alloca i64, align 8
  %x107.addr = alloca i32, align 4
  %x108.addr = alloca i32, align 4
  %w109.addr = alloca i64, align 8
  %x109.addr = alloca i32, align 4
  %x110.addr = alloca i32, align 4
  %w111.addr = alloca i64, align 8
  %x111.addr = alloca i32, align 4
  %x112.addr = alloca i32, align 4
  %w113.addr = alloca i64, align 8
  %x113.addr = alloca i32, align 4
  %x114.addr = alloca i32, align 4
  %x115.addr = alloca i32, align 4
  %w116.addr = alloca i64, align 8
  %x116.addr = alloca i32, align 4
  %x117.addr = alloca i32, align 4
  %w118.addr = alloca i64, align 8
  %x118.addr = alloca i32, align 4
  %x119.addr = alloca i32, align 4
  %w120.addr = alloca i64, align 8
  %x120.addr = alloca i32, align 4
  %x121.addr = alloca i32, align 4
  %w122.addr = alloca i64, align 8
  %x122.addr = alloca i32, align 4
  %x123.addr = alloca i32, align 4
  %w124.addr = alloca i64, align 8
  %x124.addr = alloca i32, align 4
  %x125.addr = alloca i32, align 4
  %w126.addr = alloca i64, align 8
  %x126.addr = alloca i32, align 4
  %x127.addr = alloca i32, align 4
  %w128.addr = alloca i64, align 8
  %x128.addr = alloca i32, align 4
  %x129.addr = alloca i32, align 4
  %w130.addr = alloca i64, align 8
  %x130.addr = alloca i32, align 4
  %x131.addr = alloca i32, align 4
  %w132.addr = alloca i64, align 8
  %x132.addr = alloca i32, align 4
  %x133.addr = alloca i32, align 4
  %w134.addr = alloca i64, align 8
  %x134.addr = alloca i32, align 4
  %w136.addr = alloca i64, align 8
  %x136.addr = alloca i32, align 4
  %x137.addr = alloca i32, align 4
  %w138.addr = alloca i64, align 8
  %x138.addr = alloca i32, align 4
  %x139.addr = alloca i32, align 4
  %w140.addr = alloca i64, align 8
  %x140.addr = alloca i32, align 4
  %x141.addr = alloca i32, align 4
  %w142.addr = alloca i64, align 8
  %x142.addr = alloca i32, align 4
  %x143.addr = alloca i32, align 4
  %w144.addr = alloca i64, align 8
  %x144.addr = alloca i32, align 4
  %x145.addr = alloca i32, align 4
  %w146.addr = alloca i64, align 8
  %x146.addr = alloca i32, align 4
  %x147.addr = alloca i32, align 4
  %w148.addr = alloca i64, align 8
  %x148.addr = alloca i32, align 4
  %x149.addr = alloca i32, align 4
  %w150.addr = alloca i64, align 8
  %x150.addr = alloca i32, align 4
  %x151.addr = alloca i32, align 4
  %w152.addr = alloca i64, align 8
  %x152.addr = alloca i32, align 4
  %x153.addr = alloca i32, align 4
  %w154.addr = alloca i64, align 8
  %x154.addr = alloca i32, align 4
  %x155.addr = alloca i32, align 4
  %w156.addr = alloca i64, align 8
  %x156.addr = alloca i32, align 4
  %x157.addr = alloca i32, align 4
  %w158.addr = alloca i64, align 8
  %x158.addr = alloca i32, align 4
  %x159.addr = alloca i32, align 4
  %x160.addr = alloca i32, align 4
  %w161.addr = alloca i64, align 8
  %x162.addr = alloca i32, align 4
  %w163.addr = alloca i64, align 8
  %x163.addr = alloca i32, align 4
  %x164.addr = alloca i32, align 4
  %w165.addr = alloca i64, align 8
  %x165.addr = alloca i32, align 4
  %x166.addr = alloca i32, align 4
  %w167.addr = alloca i64, align 8
  %x167.addr = alloca i32, align 4
  %x168.addr = alloca i32, align 4
  %w169.addr = alloca i64, align 8
  %x169.addr = alloca i32, align 4
  %x170.addr = alloca i32, align 4
  %w171.addr = alloca i64, align 8
  %x171.addr = alloca i32, align 4
  %x172.addr = alloca i32, align 4
  %w173.addr = alloca i64, align 8
  %x173.addr = alloca i32, align 4
  %x174.addr = alloca i32, align 4
  %w175.addr = alloca i64, align 8
  %x175.addr = alloca i32, align 4
  %x176.addr = alloca i32, align 4
  %w177.addr = alloca i64, align 8
  %x177.addr = alloca i32, align 4
  %x178.addr = alloca i32, align 4
  %x179.addr = alloca i32, align 4
  %w180.addr = alloca i64, align 8
  %x180.addr = alloca i32, align 4
  %x181.addr = alloca i32, align 4
  %w182.addr = alloca i64, align 8
  %x182.addr = alloca i32, align 4
  %x183.addr = alloca i32, align 4
  %w184.addr = alloca i64, align 8
  %x184.addr = alloca i32, align 4
  %x185.addr = alloca i32, align 4
  %w186.addr = alloca i64, align 8
  %x186.addr = alloca i32, align 4
  %x187.addr = alloca i32, align 4
  %w188.addr = alloca i64, align 8
  %x188.addr = alloca i32, align 4
  %x189.addr = alloca i32, align 4
  %w190.addr = alloca i64, align 8
  %x190.addr = alloca i32, align 4
  %x191.addr = alloca i32, align 4
  %w192.addr = alloca i64, align 8
  %x192.addr = alloca i32, align 4
  %x193.addr = alloca i32, align 4
  %w194.addr = alloca i64, align 8
  %x194.addr = alloca i32, align 4
  %x195.addr = alloca i32, align 4
  %w196.addr = alloca i64, align 8
  %x196.addr = alloca i32, align 4
  %x197.addr = alloca i32, align 4
  %w198.addr = alloca i64, align 8
  %x198.addr = alloca i32, align 4
  %x199.addr = alloca i32, align 4
  %w200.addr = alloca i64, align 8
  %x200.addr = alloca i32, align 4
  %x201.addr = alloca i32, align 4
  %w202.addr = alloca i64, align 8
  %x202.addr = alloca i32, align 4
  %x203.addr = alloca i32, align 4
  %w204.addr = alloca i64, align 8
  %x204.addr = alloca i32, align 4
  %x205.addr = alloca i32, align 4
  %w206.addr = alloca i64, align 8
  %x206.addr = alloca i32, align 4
  %x207.addr = alloca i32, align 4
  %w208.addr = alloca i64, align 8
  %x208.addr = alloca i32, align 4
  %x209.addr = alloca i32, align 4
  %x210.addr = alloca i32, align 4
  %w211.addr = alloca i64, align 8
  %x211.addr = alloca i32, align 4
  %x212.addr = alloca i32, align 4
  %w213.addr = alloca i64, align 8
  %x213.addr = alloca i32, align 4
  %x214.addr = alloca i32, align 4
  %w215.addr = alloca i64, align 8
  %x215.addr = alloca i32, align 4
  %x216.addr = alloca i32, align 4
  %w217.addr = alloca i64, align 8
  %x217.addr = alloca i32, align 4
  %x218.addr = alloca i32, align 4
  %w219.addr = alloca i64, align 8
  %x219.addr = alloca i32, align 4
  %x220.addr = alloca i32, align 4
  %w221.addr = alloca i64, align 8
  %x221.addr = alloca i32, align 4
  %x222.addr = alloca i32, align 4
  %w223.addr = alloca i64, align 8
  %x223.addr = alloca i32, align 4
  %x224.addr = alloca i32, align 4
  %w225.addr = alloca i64, align 8
  %x225.addr = alloca i32, align 4
  %x226.addr = alloca i32, align 4
  %w227.addr = alloca i64, align 8
  %x227.addr = alloca i32, align 4
  %x228.addr = alloca i32, align 4
  %w229.addr = alloca i64, align 8
  %x229.addr = alloca i32, align 4
  %w231.addr = alloca i64, align 8
  %x231.addr = alloca i32, align 4
  %x232.addr = alloca i32, align 4
  %w233.addr = alloca i64, align 8
  %x233.addr = alloca i32, align 4
  %x234.addr = alloca i32, align 4
  %w235.addr = alloca i64, align 8
  %x235.addr = alloca i32, align 4
  %x236.addr = alloca i32, align 4
  %w237.addr = alloca i64, align 8
  %x237.addr = alloca i32, align 4
  %x238.addr = alloca i32, align 4
  %w239.addr = alloca i64, align 8
  %x239.addr = alloca i32, align 4
  %x240.addr = alloca i32, align 4
  %w241.addr = alloca i64, align 8
  %x241.addr = alloca i32, align 4
  %x242.addr = alloca i32, align 4
  %w243.addr = alloca i64, align 8
  %x243.addr = alloca i32, align 4
  %x244.addr = alloca i32, align 4
  %w245.addr = alloca i64, align 8
  %x245.addr = alloca i32, align 4
  %x246.addr = alloca i32, align 4
  %w247.addr = alloca i64, align 8
  %x247.addr = alloca i32, align 4
  %x248.addr = alloca i32, align 4
  %w249.addr = alloca i64, align 8
  %x249.addr = alloca i32, align 4
  %x250.addr = alloca i32, align 4
  %w251.addr = alloca i64, align 8
  %x251.addr = alloca i32, align 4
  %x252.addr = alloca i32, align 4
  %w253.addr = alloca i64, align 8
  %x253.addr = alloca i32, align 4
  %x254.addr = alloca i32, align 4
  %x255.addr = alloca i32, align 4
  %w256.addr = alloca i64, align 8
  %x257.addr = alloca i32, align 4
  %w258.addr = alloca i64, align 8
  %x258.addr = alloca i32, align 4
  %x259.addr = alloca i32, align 4
  %w260.addr = alloca i64, align 8
  %x260.addr = alloca i32, align 4
  %x261.addr = alloca i32, align 4
  %w262.addr = alloca i64, align 8
  %x262.addr = alloca i32, align 4
  %x263.addr = alloca i32, align 4
  %w264.addr = alloca i64, align 8
  %x264.addr = alloca i32, align 4
  %x265.addr = alloca i32, align 4
  %w266.addr = alloca i64, align 8
  %x266.addr = alloca i32, align 4
  %x267.addr = alloca i32, align 4
  %w268.addr = alloca i64, align 8
  %x268.addr = alloca i32, align 4
  %x269.addr = alloca i32, align 4
  %w270.addr = alloca i64, align 8
  %x270.addr = alloca i32, align 4
  %x271.addr = alloca i32, align 4
  %w272.addr = alloca i64, align 8
  %x272.addr = alloca i32, align 4
  %x273.addr = alloca i32, align 4
  %x274.addr = alloca i32, align 4
  %w275.addr = alloca i64, align 8
  %x275.addr = alloca i32, align 4
  %x276.addr = alloca i32, align 4
  %w277.addr = alloca i64, align 8
  %x277.addr = alloca i32, align 4
  %x278.addr = alloca i32, align 4
  %w279.addr = alloca i64, align 8
  %x279.addr = alloca i32, align 4
  %x280.addr = alloca i32, align 4
  %w281.addr = alloca i64, align 8
  %x281.addr = alloca i32, align 4
  %x282.addr = alloca i32, align 4
  %w283.addr = alloca i64, align 8
  %x283.addr = alloca i32, align 4
  %x284.addr = alloca i32, align 4
  %w285.addr = alloca i64, align 8
  %x285.addr = alloca i32, align 4
  %x286.addr = alloca i32, align 4
  %w287.addr = alloca i64, align 8
  %x287.addr = alloca i32, align 4
  %x288.addr = alloca i32, align 4
  %w289.addr = alloca i64, align 8
  %x289.addr = alloca i32, align 4
  %x290.addr = alloca i32, align 4
  %w291.addr = alloca i64, align 8
  %x291.addr = alloca i32, align 4
  %x292.addr = alloca i32, align 4
  %w293.addr = alloca i64, align 8
  %x293.addr = alloca i32, align 4
  %x294.addr = alloca i32, align 4
  %w295.addr = alloca i64, align 8
  %x295.addr = alloca i32, align 4
  %x296.addr = alloca i32, align 4
  %w297.addr = alloca i64, align 8
  %x297.addr = alloca i32, align 4
  %x298.addr = alloca i32, align 4
  %w299.addr = alloca i64, align 8
  %x299.addr = alloca i32, align 4
  %x300.addr = alloca i32, align 4
  %w301.addr = alloca i64, align 8
  %x301.addr = alloca i32, align 4
  %x302.addr = alloca i32, align 4
  %w303.addr = alloca i64, align 8
  %x303.addr = alloca i32, align 4
  %x304.addr = alloca i32, align 4
  %x305.addr = alloca i32, align 4
  %w306.addr = alloca i64, align 8
  %x306.addr = alloca i32, align 4
  %x307.addr = alloca i32, align 4
  %w308.addr = alloca i64, align 8
  %x308.addr = alloca i32, align 4
  %x309.addr = alloca i32, align 4
  %w310.addr = alloca i64, align 8
  %x310.addr = alloca i32, align 4
  %x311.addr = alloca i32, align 4
  %w312.addr = alloca i64, align 8
  %x312.addr = alloca i32, align 4
  %x313.addr = alloca i32, align 4
  %w314.addr = alloca i64, align 8
  %x314.addr = alloca i32, align 4
  %x315.addr = alloca i32, align 4
  %w316.addr = alloca i64, align 8
  %x316.addr = alloca i32, align 4
  %x317.addr = alloca i32, align 4
  %w318.addr = alloca i64, align 8
  %x318.addr = alloca i32, align 4
  %x319.addr = alloca i32, align 4
  %w320.addr = alloca i64, align 8
  %x320.addr = alloca i32, align 4
  %x321.addr = alloca i32, align 4
  %w322.addr = alloca i64, align 8
  %x322.addr = alloca i32, align 4
  %x323.addr = alloca i32, align 4
  %w324.addr = alloca i64, align 8
  %x324.addr = alloca i32, align 4
  %w326.addr = alloca i64, align 8
  %x326.addr = alloca i32, align 4
  %x327.addr = alloca i32, align 4
  %w328.addr = alloca i64, align 8
  %x328.addr = alloca i32, align 4
  %x329.addr = alloca i32, align 4
  %w330.addr = alloca i64, align 8
  %x330.addr = alloca i32, align 4
  %x331.addr = alloca i32, align 4
  %w332.addr = alloca i64, align 8
  %x332.addr = alloca i32, align 4
  %x333.addr = alloca i32, align 4
  %w334.addr = alloca i64, align 8
  %x334.addr = alloca i32, align 4
  %x335.addr = alloca i32, align 4
  %w336.addr = alloca i64, align 8
  %x336.addr = alloca i32, align 4
  %x337.addr = alloca i32, align 4
  %w338.addr = alloca i64, align 8
  %x338.addr = alloca i32, align 4
  %x339.addr = alloca i32, align 4
  %w340.addr = alloca i64, align 8
  %x340.addr = alloca i32, align 4
  %x341.addr = alloca i32, align 4
  %w342.addr = alloca i64, align 8
  %x342.addr = alloca i32, align 4
  %x343.addr = alloca i32, align 4
  %w344.addr = alloca i64, align 8
  %x344.addr = alloca i32, align 4
  %x345.addr = alloca i32, align 4
  %w346.addr = alloca i64, align 8
  %x346.addr = alloca i32, align 4
  %x347.addr = alloca i32, align 4
  %w348.addr = alloca i64, align 8
  %x348.addr = alloca i32, align 4
  %x349.addr = alloca i32, align 4
  %x350.addr = alloca i32, align 4
  %w351.addr = alloca i64, align 8
  %x352.addr = alloca i32, align 4
  %w353.addr = alloca i64, align 8
  %x353.addr = alloca i32, align 4
  %x354.addr = alloca i32, align 4
  %w355.addr = alloca i64, align 8
  %x355.addr = alloca i32, align 4
  %x356.addr = alloca i32, align 4
  %w357.addr = alloca i64, align 8
  %x357.addr = alloca i32, align 4
  %x358.addr = alloca i32, align 4
  %w359.addr = alloca i64, align 8
  %x359.addr = alloca i32, align 4
  %x360.addr = alloca i32, align 4
  %w361.addr = alloca i64, align 8
  %x361.addr = alloca i32, align 4
  %x362.addr = alloca i32, align 4
  %w363.addr = alloca i64, align 8
  %x363.addr = alloca i32, align 4
  %x364.addr = alloca i32, align 4
  %w365.addr = alloca i64, align 8
  %x365.addr = alloca i32, align 4
  %x366.addr = alloca i32, align 4
  %w367.addr = alloca i64, align 8
  %x367.addr = alloca i32, align 4
  %x368.addr = alloca i32, align 4
  %x369.addr = alloca i32, align 4
  %w370.addr = alloca i64, align 8
  %x370.addr = alloca i32, align 4
  %x371.addr = alloca i32, align 4
  %w372.addr = alloca i64, align 8
  %x372.addr = alloca i32, align 4
  %x373.addr = alloca i32, align 4
  %w374.addr = alloca i64, align 8
  %x374.addr = alloca i32, align 4
  %x375.addr = alloca i32, align 4
  %w376.addr = alloca i64, align 8
  %x376.addr = alloca i32, align 4
  %x377.addr = alloca i32, align 4
  %w378.addr = alloca i64, align 8
  %x378.addr = alloca i32, align 4
  %x379.addr = alloca i32, align 4
  %w380.addr = alloca i64, align 8
  %x380.addr = alloca i32, align 4
  %x381.addr = alloca i32, align 4
  %w382.addr = alloca i64, align 8
  %x382.addr = alloca i32, align 4
  %x383.addr = alloca i32, align 4
  %w384.addr = alloca i64, align 8
  %x384.addr = alloca i32, align 4
  %x385.addr = alloca i32, align 4
  %w386.addr = alloca i64, align 8
  %x386.addr = alloca i32, align 4
  %x387.addr = alloca i32, align 4
  %w388.addr = alloca i64, align 8
  %x388.addr = alloca i32, align 4
  %x389.addr = alloca i32, align 4
  %w390.addr = alloca i64, align 8
  %x390.addr = alloca i32, align 4
  %x391.addr = alloca i32, align 4
  %w392.addr = alloca i64, align 8
  %x392.addr = alloca i32, align 4
  %x393.addr = alloca i32, align 4
  %w394.addr = alloca i64, align 8
  %x394.addr = alloca i32, align 4
  %x395.addr = alloca i32, align 4
  %w396.addr = alloca i64, align 8
  %x396.addr = alloca i32, align 4
  %x397.addr = alloca i32, align 4
  %w398.addr = alloca i64, align 8
  %x398.addr = alloca i32, align 4
  %x399.addr = alloca i32, align 4
  %x400.addr = alloca i32, align 4
  %w401.addr = alloca i64, align 8
  %x401.addr = alloca i32, align 4
  %x402.addr = alloca i32, align 4
  %w403.addr = alloca i64, align 8
  %x403.addr = alloca i32, align 4
  %x404.addr = alloca i32, align 4
  %w405.addr = alloca i64, align 8
  %x405.addr = alloca i32, align 4
  %x406.addr = alloca i32, align 4
  %w407.addr = alloca i64, align 8
  %x407.addr = alloca i32, align 4
  %x408.addr = alloca i32, align 4
  %w409.addr = alloca i64, align 8
  %x409.addr = alloca i32, align 4
  %x410.addr = alloca i32, align 4
  %w411.addr = alloca i64, align 8
  %x411.addr = alloca i32, align 4
  %x412.addr = alloca i32, align 4
  %w413.addr = alloca i64, align 8
  %x413.addr = alloca i32, align 4
  %x414.addr = alloca i32, align 4
  %w415.addr = alloca i64, align 8
  %x415.addr = alloca i32, align 4
  %x416.addr = alloca i32, align 4
  %w417.addr = alloca i64, align 8
  %x417.addr = alloca i32, align 4
  %x418.addr = alloca i32, align 4
  %w419.addr = alloca i64, align 8
  %x419.addr = alloca i32, align 4
  %w421.addr = alloca i64, align 8
  %x421.addr = alloca i32, align 4
  %x422.addr = alloca i32, align 4
  %w423.addr = alloca i64, align 8
  %x423.addr = alloca i32, align 4
  %x424.addr = alloca i32, align 4
  %w425.addr = alloca i64, align 8
  %x425.addr = alloca i32, align 4
  %x426.addr = alloca i32, align 4
  %w427.addr = alloca i64, align 8
  %x427.addr = alloca i32, align 4
  %x428.addr = alloca i32, align 4
  %w429.addr = alloca i64, align 8
  %x429.addr = alloca i32, align 4
  %x430.addr = alloca i32, align 4
  %w431.addr = alloca i64, align 8
  %x431.addr = alloca i32, align 4
  %x432.addr = alloca i32, align 4
  %w433.addr = alloca i64, align 8
  %x433.addr = alloca i32, align 4
  %x434.addr = alloca i32, align 4
  %w435.addr = alloca i64, align 8
  %x435.addr = alloca i32, align 4
  %x436.addr = alloca i32, align 4
  %w437.addr = alloca i64, align 8
  %x437.addr = alloca i32, align 4
  %x438.addr = alloca i32, align 4
  %w439.addr = alloca i64, align 8
  %x439.addr = alloca i32, align 4
  %x440.addr = alloca i32, align 4
  %w441.addr = alloca i64, align 8
  %x441.addr = alloca i32, align 4
  %x442.addr = alloca i32, align 4
  %w443.addr = alloca i64, align 8
  %x443.addr = alloca i32, align 4
  %x444.addr = alloca i32, align 4
  %x445.addr = alloca i32, align 4
  %w446.addr = alloca i64, align 8
  %x447.addr = alloca i32, align 4
  %w448.addr = alloca i64, align 8
  %x448.addr = alloca i32, align 4
  %x449.addr = alloca i32, align 4
  %w450.addr = alloca i64, align 8
  %x450.addr = alloca i32, align 4
  %x451.addr = alloca i32, align 4
  %w452.addr = alloca i64, align 8
  %x452.addr = alloca i32, align 4
  %x453.addr = alloca i32, align 4
  %w454.addr = alloca i64, align 8
  %x454.addr = alloca i32, align 4
  %x455.addr = alloca i32, align 4
  %w456.addr = alloca i64, align 8
  %x456.addr = alloca i32, align 4
  %x457.addr = alloca i32, align 4
  %w458.addr = alloca i64, align 8
  %x458.addr = alloca i32, align 4
  %x459.addr = alloca i32, align 4
  %w460.addr = alloca i64, align 8
  %x460.addr = alloca i32, align 4
  %x461.addr = alloca i32, align 4
  %w462.addr = alloca i64, align 8
  %x462.addr = alloca i32, align 4
  %x463.addr = alloca i32, align 4
  %x464.addr = alloca i32, align 4
  %w465.addr = alloca i64, align 8
  %x465.addr = alloca i32, align 4
  %x466.addr = alloca i32, align 4
  %w467.addr = alloca i64, align 8
  %x467.addr = alloca i32, align 4
  %x468.addr = alloca i32, align 4
  %w469.addr = alloca i64, align 8
  %x469.addr = alloca i32, align 4
  %x470.addr = alloca i32, align 4
  %w471.addr = alloca i64, align 8
  %x471.addr = alloca i32, align 4
  %x472.addr = alloca i32, align 4
  %w473.addr = alloca i64, align 8
  %x473.addr = alloca i32, align 4
  %x474.addr = alloca i32, align 4
  %w475.addr = alloca i64, align 8
  %x475.addr = alloca i32, align 4
  %x476.addr = alloca i32, align 4
  %w477.addr = alloca i64, align 8
  %x477.addr = alloca i32, align 4
  %x478.addr = alloca i32, align 4
  %w479.addr = alloca i64, align 8
  %x479.addr = alloca i32, align 4
  %x480.addr = alloca i32, align 4
  %w481.addr = alloca i64, align 8
  %x481.addr = alloca i32, align 4
  %x482.addr = alloca i32, align 4
  %w483.addr = alloca i64, align 8
  %x483.addr = alloca i32, align 4
  %x484.addr = alloca i32, align 4
  %w485.addr = alloca i64, align 8
  %x485.addr = alloca i32, align 4
  %x486.addr = alloca i32, align 4
  %w487.addr = alloca i64, align 8
  %x487.addr = alloca i32, align 4
  %x488.addr = alloca i32, align 4
  %w489.addr = alloca i64, align 8
  %x489.addr = alloca i32, align 4
  %x490.addr = alloca i32, align 4
  %w491.addr = alloca i64, align 8
  %x491.addr = alloca i32, align 4
  %x492.addr = alloca i32, align 4
  %w493.addr = alloca i64, align 8
  %x493.addr = alloca i32, align 4
  %x494.addr = alloca i32, align 4
  %x495.addr = alloca i32, align 4
  %w496.addr = alloca i64, align 8
  %x496.addr = alloca i32, align 4
  %x497.addr = alloca i32, align 4
  %w498.addr = alloca i64, align 8
  %x498.addr = alloca i32, align 4
  %x499.addr = alloca i32, align 4
  %w500.addr = alloca i64, align 8
  %x500.addr = alloca i32, align 4
  %x501.addr = alloca i32, align 4
  %w502.addr = alloca i64, align 8
  %x502.addr = alloca i32, align 4
  %x503.addr = alloca i32, align 4
  %w504.addr = alloca i64, align 8
  %x504.addr = alloca i32, align 4
  %x505.addr = alloca i32, align 4
  %w506.addr = alloca i64, align 8
  %x506.addr = alloca i32, align 4
  %x507.addr = alloca i32, align 4
  %w508.addr = alloca i64, align 8
  %x508.addr = alloca i32, align 4
  %x509.addr = alloca i32, align 4
  %w510.addr = alloca i64, align 8
  %x510.addr = alloca i32, align 4
  %x511.addr = alloca i32, align 4
  %w512.addr = alloca i64, align 8
  %x512.addr = alloca i32, align 4
  %x513.addr = alloca i32, align 4
  %w514.addr = alloca i64, align 8
  %x514.addr = alloca i32, align 4
  %w516.addr = alloca i64, align 8
  %x516.addr = alloca i32, align 4
  %x517.addr = alloca i32, align 4
  %w518.addr = alloca i64, align 8
  %x518.addr = alloca i32, align 4
  %x519.addr = alloca i32, align 4
  %w520.addr = alloca i64, align 8
  %x520.addr = alloca i32, align 4
  %x521.addr = alloca i32, align 4
  %w522.addr = alloca i64, align 8
  %x522.addr = alloca i32, align 4
  %x523.addr = alloca i32, align 4
  %w524.addr = alloca i64, align 8
  %x524.addr = alloca i32, align 4
  %x525.addr = alloca i32, align 4
  %w526.addr = alloca i64, align 8
  %x526.addr = alloca i32, align 4
  %x527.addr = alloca i32, align 4
  %w528.addr = alloca i64, align 8
  %x528.addr = alloca i32, align 4
  %x529.addr = alloca i32, align 4
  %w530.addr = alloca i64, align 8
  %x530.addr = alloca i32, align 4
  %x531.addr = alloca i32, align 4
  %w532.addr = alloca i64, align 8
  %x532.addr = alloca i32, align 4
  %x533.addr = alloca i32, align 4
  %w534.addr = alloca i64, align 8
  %x534.addr = alloca i32, align 4
  %x535.addr = alloca i32, align 4
  %w536.addr = alloca i64, align 8
  %x536.addr = alloca i32, align 4
  %x537.addr = alloca i32, align 4
  %w538.addr = alloca i64, align 8
  %x538.addr = alloca i32, align 4
  %x539.addr = alloca i32, align 4
  %x540.addr = alloca i32, align 4
  %w541.addr = alloca i64, align 8
  %x542.addr = alloca i32, align 4
  %w543.addr = alloca i64, align 8
  %x543.addr = alloca i32, align 4
  %x544.addr = alloca i32, align 4
  %w545.addr = alloca i64, align 8
  %x545.addr = alloca i32, align 4
  %x546.addr = alloca i32, align 4
  %w547.addr = alloca i64, align 8
  %x547.addr = alloca i32, align 4
  %x548.addr = alloca i32, align 4
  %w549.addr = alloca i64, align 8
  %x549.addr = alloca i32, align 4
  %x550.addr = alloca i32, align 4
  %w551.addr = alloca i64, align 8
  %x551.addr = alloca i32, align 4
  %x552.addr = alloca i32, align 4
  %w553.addr = alloca i64, align 8
  %x553.addr = alloca i32, align 4
  %x554.addr = alloca i32, align 4
  %w555.addr = alloca i64, align 8
  %x555.addr = alloca i32, align 4
  %x556.addr = alloca i32, align 4
  %w557.addr = alloca i64, align 8
  %x557.addr = alloca i32, align 4
  %x558.addr = alloca i32, align 4
  %x559.addr = alloca i32, align 4
  %w560.addr = alloca i64, align 8
  %x560.addr = alloca i32, align 4
  %x561.addr = alloca i32, align 4
  %w562.addr = alloca i64, align 8
  %x562.addr = alloca i32, align 4
  %x563.addr = alloca i32, align 4
  %w564.addr = alloca i64, align 8
  %x564.addr = alloca i32, align 4
  %x565.addr = alloca i32, align 4
  %w566.addr = alloca i64, align 8
  %x566.addr = alloca i32, align 4
  %x567.addr = alloca i32, align 4
  %w568.addr = alloca i64, align 8
  %x568.addr = alloca i32, align 4
  %x569.addr = alloca i32, align 4
  %w570.addr = alloca i64, align 8
  %x570.addr = alloca i32, align 4
  %x571.addr = alloca i32, align 4
  %w572.addr = alloca i64, align 8
  %x572.addr = alloca i32, align 4
  %x573.addr = alloca i32, align 4
  %w574.addr = alloca i64, align 8
  %x574.addr = alloca i32, align 4
  %x575.addr = alloca i32, align 4
  %w576.addr = alloca i64, align 8
  %x576.addr = alloca i32, align 4
  %x577.addr = alloca i32, align 4
  %w578.addr = alloca i64, align 8
  %x578.addr = alloca i32, align 4
  %x579.addr = alloca i32, align 4
  %w580.addr = alloca i64, align 8
  %x580.addr = alloca i32, align 4
  %x581.addr = alloca i32, align 4
  %w582.addr = alloca i64, align 8
  %x582.addr = alloca i32, align 4
  %x583.addr = alloca i32, align 4
  %w584.addr = alloca i64, align 8
  %x584.addr = alloca i32, align 4
  %x585.addr = alloca i32, align 4
  %w586.addr = alloca i64, align 8
  %x586.addr = alloca i32, align 4
  %x587.addr = alloca i32, align 4
  %w588.addr = alloca i64, align 8
  %x588.addr = alloca i32, align 4
  %x589.addr = alloca i32, align 4
  %x590.addr = alloca i32, align 4
  %w591.addr = alloca i64, align 8
  %x591.addr = alloca i32, align 4
  %x592.addr = alloca i32, align 4
  %w593.addr = alloca i64, align 8
  %x593.addr = alloca i32, align 4
  %x594.addr = alloca i32, align 4
  %w595.addr = alloca i64, align 8
  %x595.addr = alloca i32, align 4
  %x596.addr = alloca i32, align 4
  %w597.addr = alloca i64, align 8
  %x597.addr = alloca i32, align 4
  %x598.addr = alloca i32, align 4
  %w599.addr = alloca i64, align 8
  %x599.addr = alloca i32, align 4
  %x600.addr = alloca i32, align 4
  %w601.addr = alloca i64, align 8
  %x601.addr = alloca i32, align 4
  %x602.addr = alloca i32, align 4
  %w603.addr = alloca i64, align 8
  %x603.addr = alloca i32, align 4
  %x604.addr = alloca i32, align 4
  %w605.addr = alloca i64, align 8
  %x605.addr = alloca i32, align 4
  %x606.addr = alloca i32, align 4
  %w607.addr = alloca i64, align 8
  %x607.addr = alloca i32, align 4
  %x608.addr = alloca i32, align 4
  %w609.addr = alloca i64, align 8
  %x609.addr = alloca i32, align 4
  %w611.addr = alloca i64, align 8
  %x611.addr = alloca i32, align 4
  %x612.addr = alloca i32, align 4
  %w613.addr = alloca i64, align 8
  %x613.addr = alloca i32, align 4
  %x614.addr = alloca i32, align 4
  %w615.addr = alloca i64, align 8
  %x615.addr = alloca i32, align 4
  %x616.addr = alloca i32, align 4
  %w617.addr = alloca i64, align 8
  %x617.addr = alloca i32, align 4
  %x618.addr = alloca i32, align 4
  %w619.addr = alloca i64, align 8
  %x619.addr = alloca i32, align 4
  %x620.addr = alloca i32, align 4
  %w621.addr = alloca i64, align 8
  %x621.addr = alloca i32, align 4
  %x622.addr = alloca i32, align 4
  %w623.addr = alloca i64, align 8
  %x623.addr = alloca i32, align 4
  %x624.addr = alloca i32, align 4
  %w625.addr = alloca i64, align 8
  %x625.addr = alloca i32, align 4
  %x626.addr = alloca i32, align 4
  %w627.addr = alloca i64, align 8
  %x627.addr = alloca i32, align 4
  %x628.addr = alloca i32, align 4
  %w629.addr = alloca i64, align 8
  %x629.addr = alloca i32, align 4
  %x630.addr = alloca i32, align 4
  %w631.addr = alloca i64, align 8
  %x631.addr = alloca i32, align 4
  %x632.addr = alloca i32, align 4
  %w633.addr = alloca i64, align 8
  %x633.addr = alloca i32, align 4
  %x634.addr = alloca i32, align 4
  %x635.addr = alloca i32, align 4
  %w636.addr = alloca i64, align 8
  %x637.addr = alloca i32, align 4
  %w638.addr = alloca i64, align 8
  %x638.addr = alloca i32, align 4
  %x639.addr = alloca i32, align 4
  %w640.addr = alloca i64, align 8
  %x640.addr = alloca i32, align 4
  %x641.addr = alloca i32, align 4
  %w642.addr = alloca i64, align 8
  %x642.addr = alloca i32, align 4
  %x643.addr = alloca i32, align 4
  %w644.addr = alloca i64, align 8
  %x644.addr = alloca i32, align 4
  %x645.addr = alloca i32, align 4
  %w646.addr = alloca i64, align 8
  %x646.addr = alloca i32, align 4
  %x647.addr = alloca i32, align 4
  %w648.addr = alloca i64, align 8
  %x648.addr = alloca i32, align 4
  %x649.addr = alloca i32, align 4
  %w650.addr = alloca i64, align 8
  %x650.addr = alloca i32, align 4
  %x651.addr = alloca i32, align 4
  %w652.addr = alloca i64, align 8
  %x652.addr = alloca i32, align 4
  %x653.addr = alloca i32, align 4
  %x654.addr = alloca i32, align 4
  %w655.addr = alloca i64, align 8
  %x655.addr = alloca i32, align 4
  %x656.addr = alloca i32, align 4
  %w657.addr = alloca i64, align 8
  %x657.addr = alloca i32, align 4
  %x658.addr = alloca i32, align 4
  %w659.addr = alloca i64, align 8
  %x659.addr = alloca i32, align 4
  %x660.addr = alloca i32, align 4
  %w661.addr = alloca i64, align 8
  %x661.addr = alloca i32, align 4
  %x662.addr = alloca i32, align 4
  %w663.addr = alloca i64, align 8
  %x663.addr = alloca i32, align 4
  %x664.addr = alloca i32, align 4
  %w665.addr = alloca i64, align 8
  %x665.addr = alloca i32, align 4
  %x666.addr = alloca i32, align 4
  %w667.addr = alloca i64, align 8
  %x667.addr = alloca i32, align 4
  %x668.addr = alloca i32, align 4
  %w669.addr = alloca i64, align 8
  %x669.addr = alloca i32, align 4
  %x670.addr = alloca i32, align 4
  %w671.addr = alloca i64, align 8
  %x671.addr = alloca i32, align 4
  %x672.addr = alloca i32, align 4
  %w673.addr = alloca i64, align 8
  %x673.addr = alloca i32, align 4
  %x674.addr = alloca i32, align 4
  %w675.addr = alloca i64, align 8
  %x675.addr = alloca i32, align 4
  %x676.addr = alloca i32, align 4
  %w677.addr = alloca i64, align 8
  %x677.addr = alloca i32, align 4
  %x678.addr = alloca i32, align 4
  %w679.addr = alloca i64, align 8
  %x679.addr = alloca i32, align 4
  %x680.addr = alloca i32, align 4
  %w681.addr = alloca i64, align 8
  %x681.addr = alloca i32, align 4
  %x682.addr = alloca i32, align 4
  %w683.addr = alloca i64, align 8
  %x683.addr = alloca i32, align 4
  %x684.addr = alloca i32, align 4
  %x685.addr = alloca i32, align 4
  %w686.addr = alloca i64, align 8
  %x686.addr = alloca i32, align 4
  %x687.addr = alloca i32, align 4
  %w688.addr = alloca i64, align 8
  %x688.addr = alloca i32, align 4
  %x689.addr = alloca i32, align 4
  %w690.addr = alloca i64, align 8
  %x690.addr = alloca i32, align 4
  %x691.addr = alloca i32, align 4
  %w692.addr = alloca i64, align 8
  %x692.addr = alloca i32, align 4
  %x693.addr = alloca i32, align 4
  %w694.addr = alloca i64, align 8
  %x694.addr = alloca i32, align 4
  %x695.addr = alloca i32, align 4
  %w696.addr = alloca i64, align 8
  %x696.addr = alloca i32, align 4
  %x697.addr = alloca i32, align 4
  %w698.addr = alloca i64, align 8
  %x698.addr = alloca i32, align 4
  %x699.addr = alloca i32, align 4
  %w700.addr = alloca i64, align 8
  %x700.addr = alloca i32, align 4
  %x701.addr = alloca i32, align 4
  %w702.addr = alloca i64, align 8
  %x702.addr = alloca i32, align 4
  %x703.addr = alloca i32, align 4
  %w704.addr = alloca i64, align 8
  %x704.addr = alloca i32, align 4
  %w706.addr = alloca i64, align 8
  %x706.addr = alloca i32, align 4
  %x707.addr = alloca i32, align 4
  %w708.addr = alloca i64, align 8
  %x708.addr = alloca i32, align 4
  %x709.addr = alloca i32, align 4
  %w710.addr = alloca i64, align 8
  %x710.addr = alloca i32, align 4
  %x711.addr = alloca i32, align 4
  %w712.addr = alloca i64, align 8
  %x712.addr = alloca i32, align 4
  %x713.addr = alloca i32, align 4
  %w714.addr = alloca i64, align 8
  %x714.addr = alloca i32, align 4
  %x715.addr = alloca i32, align 4
  %w716.addr = alloca i64, align 8
  %x716.addr = alloca i32, align 4
  %x717.addr = alloca i32, align 4
  %w718.addr = alloca i64, align 8
  %x718.addr = alloca i32, align 4
  %x719.addr = alloca i32, align 4
  %w720.addr = alloca i64, align 8
  %x720.addr = alloca i32, align 4
  %x721.addr = alloca i32, align 4
  %w722.addr = alloca i64, align 8
  %x722.addr = alloca i32, align 4
  %x723.addr = alloca i32, align 4
  %w724.addr = alloca i64, align 8
  %x724.addr = alloca i32, align 4
  %x725.addr = alloca i32, align 4
  %w726.addr = alloca i64, align 8
  %x726.addr = alloca i32, align 4
  %x727.addr = alloca i32, align 4
  %w728.addr = alloca i64, align 8
  %x728.addr = alloca i32, align 4
  %x729.addr = alloca i32, align 4
  %x730.addr = alloca i32, align 4
  %w731.addr = alloca i64, align 8
  %x732.addr = alloca i32, align 4
  %w733.addr = alloca i64, align 8
  %x733.addr = alloca i32, align 4
  %x734.addr = alloca i32, align 4
  %w735.addr = alloca i64, align 8
  %x735.addr = alloca i32, align 4
  %x736.addr = alloca i32, align 4
  %w737.addr = alloca i64, align 8
  %x737.addr = alloca i32, align 4
  %x738.addr = alloca i32, align 4
  %w739.addr = alloca i64, align 8
  %x739.addr = alloca i32, align 4
  %x740.addr = alloca i32, align 4
  %w741.addr = alloca i64, align 8
  %x741.addr = alloca i32, align 4
  %x742.addr = alloca i32, align 4
  %w743.addr = alloca i64, align 8
  %x743.addr = alloca i32, align 4
  %x744.addr = alloca i32, align 4
  %w745.addr = alloca i64, align 8
  %x745.addr = alloca i32, align 4
  %x746.addr = alloca i32, align 4
  %w747.addr = alloca i64, align 8
  %x747.addr = alloca i32, align 4
  %x748.addr = alloca i32, align 4
  %x749.addr = alloca i32, align 4
  %w750.addr = alloca i64, align 8
  %x750.addr = alloca i32, align 4
  %x751.addr = alloca i32, align 4
  %w752.addr = alloca i64, align 8
  %x752.addr = alloca i32, align 4
  %x753.addr = alloca i32, align 4
  %w754.addr = alloca i64, align 8
  %x754.addr = alloca i32, align 4
  %x755.addr = alloca i32, align 4
  %w756.addr = alloca i64, align 8
  %x756.addr = alloca i32, align 4
  %x757.addr = alloca i32, align 4
  %w758.addr = alloca i64, align 8
  %x758.addr = alloca i32, align 4
  %x759.addr = alloca i32, align 4
  %w760.addr = alloca i64, align 8
  %x760.addr = alloca i32, align 4
  %x761.addr = alloca i32, align 4
  %w762.addr = alloca i64, align 8
  %x762.addr = alloca i32, align 4
  %x763.addr = alloca i32, align 4
  %w764.addr = alloca i64, align 8
  %x764.addr = alloca i32, align 4
  %x765.addr = alloca i32, align 4
  %w766.addr = alloca i64, align 8
  %x767.addr = alloca i32, align 4
  %x768.addr = alloca i32, align 4
  %x769.addr = alloca i32, align 4
  %x770.addr = alloca i32, align 4
  %x771.addr = alloca i32, align 4
  %x772.addr = alloca i32, align 4
  %x773.addr = alloca i32, align 4
  %x774.addr = alloca i32, align 4
  %x775.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 1
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %4, i32* %x1.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 2
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %9, i32* %x2.addr, align 4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 3
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %14, i32* %x3.addr, align 4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 4
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %19, i32* %x4.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 5
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %24, i32* %x5.addr, align 4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 6
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %29, i32* %x6.addr, align 4
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 7
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %34, i32* %x7.addr, align 4
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 0
  %39 = load i32, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %39, i32* %x8.addr, align 4
  %40 = load i32, i32* %x8.addr, align 4
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 7
  %45 = load i32, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %46 = call i64 @p256FiatMulxU32(i32 %40, i32 %45)
  store i64 %46, i64* %w9.addr, align 8
  %47 = load i64, i64* %w9.addr, align 8
  %48 = trunc i64 %47 to i32
  store i32 %48, i32* %x9.addr, align 4
  %49 = load i64, i64* %w9.addr, align 8
  %50 = lshr i64 %49, 32
  %51 = trunc i64 %50 to i32
  store i32 %51, i32* %x10.addr, align 4
  %52 = load i32, i32* %x8.addr, align 4
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 6
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %58 = call i64 @p256FiatMulxU32(i32 %52, i32 %57)
  store i64 %58, i64* %w11.addr, align 8
  %59 = load i64, i64* %w11.addr, align 8
  %60 = trunc i64 %59 to i32
  store i32 %60, i32* %x11.addr, align 4
  %61 = load i64, i64* %w11.addr, align 8
  %62 = lshr i64 %61, 32
  %63 = trunc i64 %62 to i32
  store i32 %63, i32* %x12.addr, align 4
  %64 = load i32, i32* %x8.addr, align 4
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = bitcast i8* %66 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 5
  %69 = load i32, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %70 = call i64 @p256FiatMulxU32(i32 %64, i32 %69)
  store i64 %70, i64* %w13.addr, align 8
  %71 = load i64, i64* %w13.addr, align 8
  %72 = trunc i64 %71 to i32
  store i32 %72, i32* %x13.addr, align 4
  %73 = load i64, i64* %w13.addr, align 8
  %74 = lshr i64 %73, 32
  %75 = trunc i64 %74 to i32
  store i32 %75, i32* %x14.addr, align 4
  %76 = load i32, i32* %x8.addr, align 4
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 4
  %81 = load i32, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %82 = call i64 @p256FiatMulxU32(i32 %76, i32 %81)
  store i64 %82, i64* %w15.addr, align 8
  %83 = load i64, i64* %w15.addr, align 8
  %84 = trunc i64 %83 to i32
  store i32 %84, i32* %x15.addr, align 4
  %85 = load i64, i64* %w15.addr, align 8
  %86 = lshr i64 %85, 32
  %87 = trunc i64 %86 to i32
  store i32 %87, i32* %x16.addr, align 4
  %88 = load i32, i32* %x8.addr, align 4
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 3
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %94 = call i64 @p256FiatMulxU32(i32 %88, i32 %93)
  store i64 %94, i64* %w17.addr, align 8
  %95 = load i64, i64* %w17.addr, align 8
  %96 = trunc i64 %95 to i32
  store i32 %96, i32* %x17.addr, align 4
  %97 = load i64, i64* %w17.addr, align 8
  %98 = lshr i64 %97, 32
  %99 = trunc i64 %98 to i32
  store i32 %99, i32* %x18.addr, align 4
  %100 = load i32, i32* %x8.addr, align 4
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = bitcast i8* %102 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 2
  %105 = load i32, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %106 = call i64 @p256FiatMulxU32(i32 %100, i32 %105)
  store i64 %106, i64* %w19.addr, align 8
  %107 = load i64, i64* %w19.addr, align 8
  %108 = trunc i64 %107 to i32
  store i32 %108, i32* %x19.addr, align 4
  %109 = load i64, i64* %w19.addr, align 8
  %110 = lshr i64 %109, 32
  %111 = trunc i64 %110 to i32
  store i32 %111, i32* %x20.addr, align 4
  %112 = load i32, i32* %x8.addr, align 4
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = bitcast i8* %114 to i32*
  %116 = getelementptr inbounds i32, i32* %115, i64 1
  %117 = load i32, i32* %116, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %118 = call i64 @p256FiatMulxU32(i32 %112, i32 %117)
  store i64 %118, i64* %w21.addr, align 8
  %119 = load i64, i64* %w21.addr, align 8
  %120 = trunc i64 %119 to i32
  store i32 %120, i32* %x21.addr, align 4
  %121 = load i64, i64* %w21.addr, align 8
  %122 = lshr i64 %121, 32
  %123 = trunc i64 %122 to i32
  store i32 %123, i32* %x22.addr, align 4
  %124 = load i32, i32* %x8.addr, align 4
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = bitcast i8* %126 to i32*
  %128 = getelementptr inbounds i32, i32* %127, i64 0
  %129 = load i32, i32* %128, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %130 = call i64 @p256FiatMulxU32(i32 %124, i32 %129)
  store i64 %130, i64* %w23.addr, align 8
  %131 = load i64, i64* %w23.addr, align 8
  %132 = trunc i64 %131 to i32
  store i32 %132, i32* %x23.addr, align 4
  %133 = load i64, i64* %w23.addr, align 8
  %134 = lshr i64 %133, 32
  %135 = trunc i64 %134 to i32
  store i32 %135, i32* %x24.addr, align 4
  %136 = load i32, i32* %x24.addr, align 4
  %137 = load i32, i32* %x21.addr, align 4
  %138 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %136, i32 %137)
  store i64 %138, i64* %w25.addr, align 8
  %139 = load i64, i64* %w25.addr, align 8
  %140 = trunc i64 %139 to i32
  store i32 %140, i32* %x25.addr, align 4
  %141 = load i64, i64* %w25.addr, align 8
  %142 = lshr i64 %141, 32
  %143 = trunc i64 %142 to i32
  store i32 %143, i32* %x26.addr, align 4
  %144 = load i32, i32* %x26.addr, align 4
  %145 = load i32, i32* %x22.addr, align 4
  %146 = load i32, i32* %x19.addr, align 4
  %147 = call i64 @p256FiatAddcarryxU32(i32 %144, i32 %145, i32 %146)
  store i64 %147, i64* %w27.addr, align 8
  %148 = load i64, i64* %w27.addr, align 8
  %149 = trunc i64 %148 to i32
  store i32 %149, i32* %x27.addr, align 4
  %150 = load i64, i64* %w27.addr, align 8
  %151 = lshr i64 %150, 32
  %152 = trunc i64 %151 to i32
  store i32 %152, i32* %x28.addr, align 4
  %153 = load i32, i32* %x28.addr, align 4
  %154 = load i32, i32* %x20.addr, align 4
  %155 = load i32, i32* %x17.addr, align 4
  %156 = call i64 @p256FiatAddcarryxU32(i32 %153, i32 %154, i32 %155)
  store i64 %156, i64* %w29.addr, align 8
  %157 = load i64, i64* %w29.addr, align 8
  %158 = trunc i64 %157 to i32
  store i32 %158, i32* %x29.addr, align 4
  %159 = load i64, i64* %w29.addr, align 8
  %160 = lshr i64 %159, 32
  %161 = trunc i64 %160 to i32
  store i32 %161, i32* %x30.addr, align 4
  %162 = load i32, i32* %x30.addr, align 4
  %163 = load i32, i32* %x18.addr, align 4
  %164 = load i32, i32* %x15.addr, align 4
  %165 = call i64 @p256FiatAddcarryxU32(i32 %162, i32 %163, i32 %164)
  store i64 %165, i64* %w31.addr, align 8
  %166 = load i64, i64* %w31.addr, align 8
  %167 = trunc i64 %166 to i32
  store i32 %167, i32* %x31.addr, align 4
  %168 = load i64, i64* %w31.addr, align 8
  %169 = lshr i64 %168, 32
  %170 = trunc i64 %169 to i32
  store i32 %170, i32* %x32.addr, align 4
  %171 = load i32, i32* %x32.addr, align 4
  %172 = load i32, i32* %x16.addr, align 4
  %173 = load i32, i32* %x13.addr, align 4
  %174 = call i64 @p256FiatAddcarryxU32(i32 %171, i32 %172, i32 %173)
  store i64 %174, i64* %w33.addr, align 8
  %175 = load i64, i64* %w33.addr, align 8
  %176 = trunc i64 %175 to i32
  store i32 %176, i32* %x33.addr, align 4
  %177 = load i64, i64* %w33.addr, align 8
  %178 = lshr i64 %177, 32
  %179 = trunc i64 %178 to i32
  store i32 %179, i32* %x34.addr, align 4
  %180 = load i32, i32* %x34.addr, align 4
  %181 = load i32, i32* %x14.addr, align 4
  %182 = load i32, i32* %x11.addr, align 4
  %183 = call i64 @p256FiatAddcarryxU32(i32 %180, i32 %181, i32 %182)
  store i64 %183, i64* %w35.addr, align 8
  %184 = load i64, i64* %w35.addr, align 8
  %185 = trunc i64 %184 to i32
  store i32 %185, i32* %x35.addr, align 4
  %186 = load i64, i64* %w35.addr, align 8
  %187 = lshr i64 %186, 32
  %188 = trunc i64 %187 to i32
  store i32 %188, i32* %x36.addr, align 4
  %189 = load i32, i32* %x36.addr, align 4
  %190 = load i32, i32* %x12.addr, align 4
  %191 = load i32, i32* %x9.addr, align 4
  %192 = call i64 @p256FiatAddcarryxU32(i32 %189, i32 %190, i32 %191)
  store i64 %192, i64* %w37.addr, align 8
  %193 = load i64, i64* %w37.addr, align 8
  %194 = trunc i64 %193 to i32
  store i32 %194, i32* %x37.addr, align 4
  %195 = load i64, i64* %w37.addr, align 8
  %196 = lshr i64 %195, 32
  %197 = trunc i64 %196 to i32
  store i32 %197, i32* %x38.addr, align 4
  %198 = load i32, i32* %x38.addr, align 4
  %199 = load i32, i32* %x10.addr, align 4
  %200 = add i32 %198, %199
  store i32 %200, i32* %x39.addr, align 4
  %201 = load i32, i32* %x23.addr, align 4
  %202 = call i64 @p256FiatMulxU32(i32 %201, i32 3993025615)
  store i64 %202, i64* %w40.addr, align 8
  %203 = load i64, i64* %w40.addr, align 8
  %204 = trunc i64 %203 to i32
  store i32 %204, i32* %x40.addr, align 4
  %205 = load i32, i32* %x40.addr, align 4
  %206 = call i64 @p256FiatMulxU32(i32 %205, i32 4294967295)
  store i64 %206, i64* %w42.addr, align 8
  %207 = load i64, i64* %w42.addr, align 8
  %208 = trunc i64 %207 to i32
  store i32 %208, i32* %x42.addr, align 4
  %209 = load i64, i64* %w42.addr, align 8
  %210 = lshr i64 %209, 32
  %211 = trunc i64 %210 to i32
  store i32 %211, i32* %x43.addr, align 4
  %212 = load i32, i32* %x40.addr, align 4
  %213 = call i64 @p256FiatMulxU32(i32 %212, i32 4294967295)
  store i64 %213, i64* %w44.addr, align 8
  %214 = load i64, i64* %w44.addr, align 8
  %215 = trunc i64 %214 to i32
  store i32 %215, i32* %x44.addr, align 4
  %216 = load i64, i64* %w44.addr, align 8
  %217 = lshr i64 %216, 32
  %218 = trunc i64 %217 to i32
  store i32 %218, i32* %x45.addr, align 4
  %219 = load i32, i32* %x40.addr, align 4
  %220 = call i64 @p256FiatMulxU32(i32 %219, i32 4294967295)
  store i64 %220, i64* %w46.addr, align 8
  %221 = load i64, i64* %w46.addr, align 8
  %222 = trunc i64 %221 to i32
  store i32 %222, i32* %x46.addr, align 4
  %223 = load i64, i64* %w46.addr, align 8
  %224 = lshr i64 %223, 32
  %225 = trunc i64 %224 to i32
  store i32 %225, i32* %x47.addr, align 4
  %226 = load i32, i32* %x40.addr, align 4
  %227 = call i64 @p256FiatMulxU32(i32 %226, i32 3169254061)
  store i64 %227, i64* %w48.addr, align 8
  %228 = load i64, i64* %w48.addr, align 8
  %229 = trunc i64 %228 to i32
  store i32 %229, i32* %x48.addr, align 4
  %230 = load i64, i64* %w48.addr, align 8
  %231 = lshr i64 %230, 32
  %232 = trunc i64 %231 to i32
  store i32 %232, i32* %x49.addr, align 4
  %233 = load i32, i32* %x40.addr, align 4
  %234 = call i64 @p256FiatMulxU32(i32 %233, i32 2803342980)
  store i64 %234, i64* %w50.addr, align 8
  %235 = load i64, i64* %w50.addr, align 8
  %236 = trunc i64 %235 to i32
  store i32 %236, i32* %x50.addr, align 4
  %237 = load i64, i64* %w50.addr, align 8
  %238 = lshr i64 %237, 32
  %239 = trunc i64 %238 to i32
  store i32 %239, i32* %x51.addr, align 4
  %240 = load i32, i32* %x40.addr, align 4
  %241 = call i64 @p256FiatMulxU32(i32 %240, i32 4089039554)
  store i64 %241, i64* %w52.addr, align 8
  %242 = load i64, i64* %w52.addr, align 8
  %243 = trunc i64 %242 to i32
  store i32 %243, i32* %x52.addr, align 4
  %244 = load i64, i64* %w52.addr, align 8
  %245 = lshr i64 %244, 32
  %246 = trunc i64 %245 to i32
  store i32 %246, i32* %x53.addr, align 4
  %247 = load i32, i32* %x40.addr, align 4
  %248 = call i64 @p256FiatMulxU32(i32 %247, i32 4234356049)
  store i64 %248, i64* %w54.addr, align 8
  %249 = load i64, i64* %w54.addr, align 8
  %250 = trunc i64 %249 to i32
  store i32 %250, i32* %x54.addr, align 4
  %251 = load i64, i64* %w54.addr, align 8
  %252 = lshr i64 %251, 32
  %253 = trunc i64 %252 to i32
  store i32 %253, i32* %x55.addr, align 4
  %254 = load i32, i32* %x55.addr, align 4
  %255 = load i32, i32* %x52.addr, align 4
  %256 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %254, i32 %255)
  store i64 %256, i64* %w56.addr, align 8
  %257 = load i64, i64* %w56.addr, align 8
  %258 = trunc i64 %257 to i32
  store i32 %258, i32* %x56.addr, align 4
  %259 = load i64, i64* %w56.addr, align 8
  %260 = lshr i64 %259, 32
  %261 = trunc i64 %260 to i32
  store i32 %261, i32* %x57.addr, align 4
  %262 = load i32, i32* %x57.addr, align 4
  %263 = load i32, i32* %x53.addr, align 4
  %264 = load i32, i32* %x50.addr, align 4
  %265 = call i64 @p256FiatAddcarryxU32(i32 %262, i32 %263, i32 %264)
  store i64 %265, i64* %w58.addr, align 8
  %266 = load i64, i64* %w58.addr, align 8
  %267 = trunc i64 %266 to i32
  store i32 %267, i32* %x58.addr, align 4
  %268 = load i64, i64* %w58.addr, align 8
  %269 = lshr i64 %268, 32
  %270 = trunc i64 %269 to i32
  store i32 %270, i32* %x59.addr, align 4
  %271 = load i32, i32* %x59.addr, align 4
  %272 = load i32, i32* %x51.addr, align 4
  %273 = load i32, i32* %x48.addr, align 4
  %274 = call i64 @p256FiatAddcarryxU32(i32 %271, i32 %272, i32 %273)
  store i64 %274, i64* %w60.addr, align 8
  %275 = load i64, i64* %w60.addr, align 8
  %276 = trunc i64 %275 to i32
  store i32 %276, i32* %x60.addr, align 4
  %277 = load i64, i64* %w60.addr, align 8
  %278 = lshr i64 %277, 32
  %279 = trunc i64 %278 to i32
  store i32 %279, i32* %x61.addr, align 4
  %280 = load i32, i32* %x61.addr, align 4
  %281 = load i32, i32* %x49.addr, align 4
  %282 = load i32, i32* %x46.addr, align 4
  %283 = call i64 @p256FiatAddcarryxU32(i32 %280, i32 %281, i32 %282)
  store i64 %283, i64* %w62.addr, align 8
  %284 = load i64, i64* %w62.addr, align 8
  %285 = trunc i64 %284 to i32
  store i32 %285, i32* %x62.addr, align 4
  %286 = load i64, i64* %w62.addr, align 8
  %287 = lshr i64 %286, 32
  %288 = trunc i64 %287 to i32
  store i32 %288, i32* %x63.addr, align 4
  %289 = load i32, i32* %x63.addr, align 4
  %290 = load i32, i32* %x47.addr, align 4
  %291 = load i32, i32* %x44.addr, align 4
  %292 = call i64 @p256FiatAddcarryxU32(i32 %289, i32 %290, i32 %291)
  store i64 %292, i64* %w64.addr, align 8
  %293 = load i64, i64* %w64.addr, align 8
  %294 = trunc i64 %293 to i32
  store i32 %294, i32* %x64.addr, align 4
  %295 = load i64, i64* %w64.addr, align 8
  %296 = lshr i64 %295, 32
  %297 = trunc i64 %296 to i32
  store i32 %297, i32* %x65.addr, align 4
  %298 = load i32, i32* %x65.addr, align 4
  %299 = load i32, i32* %x45.addr, align 4
  %300 = add i32 %298, %299
  store i32 %300, i32* %x66.addr, align 4
  %301 = load i32, i32* %x23.addr, align 4
  %302 = load i32, i32* %x54.addr, align 4
  %303 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %301, i32 %302)
  store i64 %303, i64* %w67.addr, align 8
  %304 = load i64, i64* %w67.addr, align 8
  %305 = lshr i64 %304, 32
  %306 = trunc i64 %305 to i32
  store i32 %306, i32* %x68.addr, align 4
  %307 = load i32, i32* %x68.addr, align 4
  %308 = load i32, i32* %x25.addr, align 4
  %309 = load i32, i32* %x56.addr, align 4
  %310 = call i64 @p256FiatAddcarryxU32(i32 %307, i32 %308, i32 %309)
  store i64 %310, i64* %w69.addr, align 8
  %311 = load i64, i64* %w69.addr, align 8
  %312 = trunc i64 %311 to i32
  store i32 %312, i32* %x69.addr, align 4
  %313 = load i64, i64* %w69.addr, align 8
  %314 = lshr i64 %313, 32
  %315 = trunc i64 %314 to i32
  store i32 %315, i32* %x70.addr, align 4
  %316 = load i32, i32* %x70.addr, align 4
  %317 = load i32, i32* %x27.addr, align 4
  %318 = load i32, i32* %x58.addr, align 4
  %319 = call i64 @p256FiatAddcarryxU32(i32 %316, i32 %317, i32 %318)
  store i64 %319, i64* %w71.addr, align 8
  %320 = load i64, i64* %w71.addr, align 8
  %321 = trunc i64 %320 to i32
  store i32 %321, i32* %x71.addr, align 4
  %322 = load i64, i64* %w71.addr, align 8
  %323 = lshr i64 %322, 32
  %324 = trunc i64 %323 to i32
  store i32 %324, i32* %x72.addr, align 4
  %325 = load i32, i32* %x72.addr, align 4
  %326 = load i32, i32* %x29.addr, align 4
  %327 = load i32, i32* %x60.addr, align 4
  %328 = call i64 @p256FiatAddcarryxU32(i32 %325, i32 %326, i32 %327)
  store i64 %328, i64* %w73.addr, align 8
  %329 = load i64, i64* %w73.addr, align 8
  %330 = trunc i64 %329 to i32
  store i32 %330, i32* %x73.addr, align 4
  %331 = load i64, i64* %w73.addr, align 8
  %332 = lshr i64 %331, 32
  %333 = trunc i64 %332 to i32
  store i32 %333, i32* %x74.addr, align 4
  %334 = load i32, i32* %x74.addr, align 4
  %335 = load i32, i32* %x31.addr, align 4
  %336 = load i32, i32* %x62.addr, align 4
  %337 = call i64 @p256FiatAddcarryxU32(i32 %334, i32 %335, i32 %336)
  store i64 %337, i64* %w75.addr, align 8
  %338 = load i64, i64* %w75.addr, align 8
  %339 = trunc i64 %338 to i32
  store i32 %339, i32* %x75.addr, align 4
  %340 = load i64, i64* %w75.addr, align 8
  %341 = lshr i64 %340, 32
  %342 = trunc i64 %341 to i32
  store i32 %342, i32* %x76.addr, align 4
  %343 = load i32, i32* %x76.addr, align 4
  %344 = load i32, i32* %x33.addr, align 4
  %345 = load i32, i32* %x64.addr, align 4
  %346 = call i64 @p256FiatAddcarryxU32(i32 %343, i32 %344, i32 %345)
  store i64 %346, i64* %w77.addr, align 8
  %347 = load i64, i64* %w77.addr, align 8
  %348 = trunc i64 %347 to i32
  store i32 %348, i32* %x77.addr, align 4
  %349 = load i64, i64* %w77.addr, align 8
  %350 = lshr i64 %349, 32
  %351 = trunc i64 %350 to i32
  store i32 %351, i32* %x78.addr, align 4
  %352 = load i32, i32* %x78.addr, align 4
  %353 = load i32, i32* %x35.addr, align 4
  %354 = load i32, i32* %x66.addr, align 4
  %355 = call i64 @p256FiatAddcarryxU32(i32 %352, i32 %353, i32 %354)
  store i64 %355, i64* %w79.addr, align 8
  %356 = load i64, i64* %w79.addr, align 8
  %357 = trunc i64 %356 to i32
  store i32 %357, i32* %x79.addr, align 4
  %358 = load i64, i64* %w79.addr, align 8
  %359 = lshr i64 %358, 32
  %360 = trunc i64 %359 to i32
  store i32 %360, i32* %x80.addr, align 4
  %361 = load i32, i32* %x80.addr, align 4
  %362 = load i32, i32* %x37.addr, align 4
  %363 = load i32, i32* %x42.addr, align 4
  %364 = call i64 @p256FiatAddcarryxU32(i32 %361, i32 %362, i32 %363)
  store i64 %364, i64* %w81.addr, align 8
  %365 = load i64, i64* %w81.addr, align 8
  %366 = trunc i64 %365 to i32
  store i32 %366, i32* %x81.addr, align 4
  %367 = load i64, i64* %w81.addr, align 8
  %368 = lshr i64 %367, 32
  %369 = trunc i64 %368 to i32
  store i32 %369, i32* %x82.addr, align 4
  %370 = load i32, i32* %x82.addr, align 4
  %371 = load i32, i32* %x39.addr, align 4
  %372 = load i32, i32* %x43.addr, align 4
  %373 = call i64 @p256FiatAddcarryxU32(i32 %370, i32 %371, i32 %372)
  store i64 %373, i64* %w83.addr, align 8
  %374 = load i64, i64* %w83.addr, align 8
  %375 = trunc i64 %374 to i32
  store i32 %375, i32* %x83.addr, align 4
  %376 = load i64, i64* %w83.addr, align 8
  %377 = lshr i64 %376, 32
  %378 = trunc i64 %377 to i32
  store i32 %378, i32* %x84.addr, align 4
  %379 = load i32, i32* %x1.addr, align 4
  %380 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %381 = load i8*, i8** %380, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %382 = bitcast i8* %381 to i32*
  %383 = getelementptr inbounds i32, i32* %382, i64 7
  %384 = load i32, i32* %383, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %385 = call i64 @p256FiatMulxU32(i32 %379, i32 %384)
  store i64 %385, i64* %w85.addr, align 8
  %386 = load i64, i64* %w85.addr, align 8
  %387 = trunc i64 %386 to i32
  store i32 %387, i32* %x85.addr, align 4
  %388 = load i64, i64* %w85.addr, align 8
  %389 = lshr i64 %388, 32
  %390 = trunc i64 %389 to i32
  store i32 %390, i32* %x86.addr, align 4
  %391 = load i32, i32* %x1.addr, align 4
  %392 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %393 = load i8*, i8** %392, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %394 = bitcast i8* %393 to i32*
  %395 = getelementptr inbounds i32, i32* %394, i64 6
  %396 = load i32, i32* %395, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %397 = call i64 @p256FiatMulxU32(i32 %391, i32 %396)
  store i64 %397, i64* %w87.addr, align 8
  %398 = load i64, i64* %w87.addr, align 8
  %399 = trunc i64 %398 to i32
  store i32 %399, i32* %x87.addr, align 4
  %400 = load i64, i64* %w87.addr, align 8
  %401 = lshr i64 %400, 32
  %402 = trunc i64 %401 to i32
  store i32 %402, i32* %x88.addr, align 4
  %403 = load i32, i32* %x1.addr, align 4
  %404 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %405 = load i8*, i8** %404, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %406 = bitcast i8* %405 to i32*
  %407 = getelementptr inbounds i32, i32* %406, i64 5
  %408 = load i32, i32* %407, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %409 = call i64 @p256FiatMulxU32(i32 %403, i32 %408)
  store i64 %409, i64* %w89.addr, align 8
  %410 = load i64, i64* %w89.addr, align 8
  %411 = trunc i64 %410 to i32
  store i32 %411, i32* %x89.addr, align 4
  %412 = load i64, i64* %w89.addr, align 8
  %413 = lshr i64 %412, 32
  %414 = trunc i64 %413 to i32
  store i32 %414, i32* %x90.addr, align 4
  %415 = load i32, i32* %x1.addr, align 4
  %416 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %417 = load i8*, i8** %416, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %418 = bitcast i8* %417 to i32*
  %419 = getelementptr inbounds i32, i32* %418, i64 4
  %420 = load i32, i32* %419, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %421 = call i64 @p256FiatMulxU32(i32 %415, i32 %420)
  store i64 %421, i64* %w91.addr, align 8
  %422 = load i64, i64* %w91.addr, align 8
  %423 = trunc i64 %422 to i32
  store i32 %423, i32* %x91.addr, align 4
  %424 = load i64, i64* %w91.addr, align 8
  %425 = lshr i64 %424, 32
  %426 = trunc i64 %425 to i32
  store i32 %426, i32* %x92.addr, align 4
  %427 = load i32, i32* %x1.addr, align 4
  %428 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %429 = load i8*, i8** %428, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %430 = bitcast i8* %429 to i32*
  %431 = getelementptr inbounds i32, i32* %430, i64 3
  %432 = load i32, i32* %431, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %433 = call i64 @p256FiatMulxU32(i32 %427, i32 %432)
  store i64 %433, i64* %w93.addr, align 8
  %434 = load i64, i64* %w93.addr, align 8
  %435 = trunc i64 %434 to i32
  store i32 %435, i32* %x93.addr, align 4
  %436 = load i64, i64* %w93.addr, align 8
  %437 = lshr i64 %436, 32
  %438 = trunc i64 %437 to i32
  store i32 %438, i32* %x94.addr, align 4
  %439 = load i32, i32* %x1.addr, align 4
  %440 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %441 = load i8*, i8** %440, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %442 = bitcast i8* %441 to i32*
  %443 = getelementptr inbounds i32, i32* %442, i64 2
  %444 = load i32, i32* %443, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %445 = call i64 @p256FiatMulxU32(i32 %439, i32 %444)
  store i64 %445, i64* %w95.addr, align 8
  %446 = load i64, i64* %w95.addr, align 8
  %447 = trunc i64 %446 to i32
  store i32 %447, i32* %x95.addr, align 4
  %448 = load i64, i64* %w95.addr, align 8
  %449 = lshr i64 %448, 32
  %450 = trunc i64 %449 to i32
  store i32 %450, i32* %x96.addr, align 4
  %451 = load i32, i32* %x1.addr, align 4
  %452 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %453 = load i8*, i8** %452, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %454 = bitcast i8* %453 to i32*
  %455 = getelementptr inbounds i32, i32* %454, i64 1
  %456 = load i32, i32* %455, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %457 = call i64 @p256FiatMulxU32(i32 %451, i32 %456)
  store i64 %457, i64* %w97.addr, align 8
  %458 = load i64, i64* %w97.addr, align 8
  %459 = trunc i64 %458 to i32
  store i32 %459, i32* %x97.addr, align 4
  %460 = load i64, i64* %w97.addr, align 8
  %461 = lshr i64 %460, 32
  %462 = trunc i64 %461 to i32
  store i32 %462, i32* %x98.addr, align 4
  %463 = load i32, i32* %x1.addr, align 4
  %464 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %465 = load i8*, i8** %464, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %466 = bitcast i8* %465 to i32*
  %467 = getelementptr inbounds i32, i32* %466, i64 0
  %468 = load i32, i32* %467, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %469 = call i64 @p256FiatMulxU32(i32 %463, i32 %468)
  store i64 %469, i64* %w99.addr, align 8
  %470 = load i64, i64* %w99.addr, align 8
  %471 = trunc i64 %470 to i32
  store i32 %471, i32* %x99.addr, align 4
  %472 = load i64, i64* %w99.addr, align 8
  %473 = lshr i64 %472, 32
  %474 = trunc i64 %473 to i32
  store i32 %474, i32* %x100.addr, align 4
  %475 = load i32, i32* %x100.addr, align 4
  %476 = load i32, i32* %x97.addr, align 4
  %477 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %475, i32 %476)
  store i64 %477, i64* %w101.addr, align 8
  %478 = load i64, i64* %w101.addr, align 8
  %479 = trunc i64 %478 to i32
  store i32 %479, i32* %x101.addr, align 4
  %480 = load i64, i64* %w101.addr, align 8
  %481 = lshr i64 %480, 32
  %482 = trunc i64 %481 to i32
  store i32 %482, i32* %x102.addr, align 4
  %483 = load i32, i32* %x102.addr, align 4
  %484 = load i32, i32* %x98.addr, align 4
  %485 = load i32, i32* %x95.addr, align 4
  %486 = call i64 @p256FiatAddcarryxU32(i32 %483, i32 %484, i32 %485)
  store i64 %486, i64* %w103.addr, align 8
  %487 = load i64, i64* %w103.addr, align 8
  %488 = trunc i64 %487 to i32
  store i32 %488, i32* %x103.addr, align 4
  %489 = load i64, i64* %w103.addr, align 8
  %490 = lshr i64 %489, 32
  %491 = trunc i64 %490 to i32
  store i32 %491, i32* %x104.addr, align 4
  %492 = load i32, i32* %x104.addr, align 4
  %493 = load i32, i32* %x96.addr, align 4
  %494 = load i32, i32* %x93.addr, align 4
  %495 = call i64 @p256FiatAddcarryxU32(i32 %492, i32 %493, i32 %494)
  store i64 %495, i64* %w105.addr, align 8
  %496 = load i64, i64* %w105.addr, align 8
  %497 = trunc i64 %496 to i32
  store i32 %497, i32* %x105.addr, align 4
  %498 = load i64, i64* %w105.addr, align 8
  %499 = lshr i64 %498, 32
  %500 = trunc i64 %499 to i32
  store i32 %500, i32* %x106.addr, align 4
  %501 = load i32, i32* %x106.addr, align 4
  %502 = load i32, i32* %x94.addr, align 4
  %503 = load i32, i32* %x91.addr, align 4
  %504 = call i64 @p256FiatAddcarryxU32(i32 %501, i32 %502, i32 %503)
  store i64 %504, i64* %w107.addr, align 8
  %505 = load i64, i64* %w107.addr, align 8
  %506 = trunc i64 %505 to i32
  store i32 %506, i32* %x107.addr, align 4
  %507 = load i64, i64* %w107.addr, align 8
  %508 = lshr i64 %507, 32
  %509 = trunc i64 %508 to i32
  store i32 %509, i32* %x108.addr, align 4
  %510 = load i32, i32* %x108.addr, align 4
  %511 = load i32, i32* %x92.addr, align 4
  %512 = load i32, i32* %x89.addr, align 4
  %513 = call i64 @p256FiatAddcarryxU32(i32 %510, i32 %511, i32 %512)
  store i64 %513, i64* %w109.addr, align 8
  %514 = load i64, i64* %w109.addr, align 8
  %515 = trunc i64 %514 to i32
  store i32 %515, i32* %x109.addr, align 4
  %516 = load i64, i64* %w109.addr, align 8
  %517 = lshr i64 %516, 32
  %518 = trunc i64 %517 to i32
  store i32 %518, i32* %x110.addr, align 4
  %519 = load i32, i32* %x110.addr, align 4
  %520 = load i32, i32* %x90.addr, align 4
  %521 = load i32, i32* %x87.addr, align 4
  %522 = call i64 @p256FiatAddcarryxU32(i32 %519, i32 %520, i32 %521)
  store i64 %522, i64* %w111.addr, align 8
  %523 = load i64, i64* %w111.addr, align 8
  %524 = trunc i64 %523 to i32
  store i32 %524, i32* %x111.addr, align 4
  %525 = load i64, i64* %w111.addr, align 8
  %526 = lshr i64 %525, 32
  %527 = trunc i64 %526 to i32
  store i32 %527, i32* %x112.addr, align 4
  %528 = load i32, i32* %x112.addr, align 4
  %529 = load i32, i32* %x88.addr, align 4
  %530 = load i32, i32* %x85.addr, align 4
  %531 = call i64 @p256FiatAddcarryxU32(i32 %528, i32 %529, i32 %530)
  store i64 %531, i64* %w113.addr, align 8
  %532 = load i64, i64* %w113.addr, align 8
  %533 = trunc i64 %532 to i32
  store i32 %533, i32* %x113.addr, align 4
  %534 = load i64, i64* %w113.addr, align 8
  %535 = lshr i64 %534, 32
  %536 = trunc i64 %535 to i32
  store i32 %536, i32* %x114.addr, align 4
  %537 = load i32, i32* %x114.addr, align 4
  %538 = load i32, i32* %x86.addr, align 4
  %539 = add i32 %537, %538
  store i32 %539, i32* %x115.addr, align 4
  %540 = load i32, i32* %x69.addr, align 4
  %541 = load i32, i32* %x99.addr, align 4
  %542 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %540, i32 %541)
  store i64 %542, i64* %w116.addr, align 8
  %543 = load i64, i64* %w116.addr, align 8
  %544 = trunc i64 %543 to i32
  store i32 %544, i32* %x116.addr, align 4
  %545 = load i64, i64* %w116.addr, align 8
  %546 = lshr i64 %545, 32
  %547 = trunc i64 %546 to i32
  store i32 %547, i32* %x117.addr, align 4
  %548 = load i32, i32* %x117.addr, align 4
  %549 = load i32, i32* %x71.addr, align 4
  %550 = load i32, i32* %x101.addr, align 4
  %551 = call i64 @p256FiatAddcarryxU32(i32 %548, i32 %549, i32 %550)
  store i64 %551, i64* %w118.addr, align 8
  %552 = load i64, i64* %w118.addr, align 8
  %553 = trunc i64 %552 to i32
  store i32 %553, i32* %x118.addr, align 4
  %554 = load i64, i64* %w118.addr, align 8
  %555 = lshr i64 %554, 32
  %556 = trunc i64 %555 to i32
  store i32 %556, i32* %x119.addr, align 4
  %557 = load i32, i32* %x119.addr, align 4
  %558 = load i32, i32* %x73.addr, align 4
  %559 = load i32, i32* %x103.addr, align 4
  %560 = call i64 @p256FiatAddcarryxU32(i32 %557, i32 %558, i32 %559)
  store i64 %560, i64* %w120.addr, align 8
  %561 = load i64, i64* %w120.addr, align 8
  %562 = trunc i64 %561 to i32
  store i32 %562, i32* %x120.addr, align 4
  %563 = load i64, i64* %w120.addr, align 8
  %564 = lshr i64 %563, 32
  %565 = trunc i64 %564 to i32
  store i32 %565, i32* %x121.addr, align 4
  %566 = load i32, i32* %x121.addr, align 4
  %567 = load i32, i32* %x75.addr, align 4
  %568 = load i32, i32* %x105.addr, align 4
  %569 = call i64 @p256FiatAddcarryxU32(i32 %566, i32 %567, i32 %568)
  store i64 %569, i64* %w122.addr, align 8
  %570 = load i64, i64* %w122.addr, align 8
  %571 = trunc i64 %570 to i32
  store i32 %571, i32* %x122.addr, align 4
  %572 = load i64, i64* %w122.addr, align 8
  %573 = lshr i64 %572, 32
  %574 = trunc i64 %573 to i32
  store i32 %574, i32* %x123.addr, align 4
  %575 = load i32, i32* %x123.addr, align 4
  %576 = load i32, i32* %x77.addr, align 4
  %577 = load i32, i32* %x107.addr, align 4
  %578 = call i64 @p256FiatAddcarryxU32(i32 %575, i32 %576, i32 %577)
  store i64 %578, i64* %w124.addr, align 8
  %579 = load i64, i64* %w124.addr, align 8
  %580 = trunc i64 %579 to i32
  store i32 %580, i32* %x124.addr, align 4
  %581 = load i64, i64* %w124.addr, align 8
  %582 = lshr i64 %581, 32
  %583 = trunc i64 %582 to i32
  store i32 %583, i32* %x125.addr, align 4
  %584 = load i32, i32* %x125.addr, align 4
  %585 = load i32, i32* %x79.addr, align 4
  %586 = load i32, i32* %x109.addr, align 4
  %587 = call i64 @p256FiatAddcarryxU32(i32 %584, i32 %585, i32 %586)
  store i64 %587, i64* %w126.addr, align 8
  %588 = load i64, i64* %w126.addr, align 8
  %589 = trunc i64 %588 to i32
  store i32 %589, i32* %x126.addr, align 4
  %590 = load i64, i64* %w126.addr, align 8
  %591 = lshr i64 %590, 32
  %592 = trunc i64 %591 to i32
  store i32 %592, i32* %x127.addr, align 4
  %593 = load i32, i32* %x127.addr, align 4
  %594 = load i32, i32* %x81.addr, align 4
  %595 = load i32, i32* %x111.addr, align 4
  %596 = call i64 @p256FiatAddcarryxU32(i32 %593, i32 %594, i32 %595)
  store i64 %596, i64* %w128.addr, align 8
  %597 = load i64, i64* %w128.addr, align 8
  %598 = trunc i64 %597 to i32
  store i32 %598, i32* %x128.addr, align 4
  %599 = load i64, i64* %w128.addr, align 8
  %600 = lshr i64 %599, 32
  %601 = trunc i64 %600 to i32
  store i32 %601, i32* %x129.addr, align 4
  %602 = load i32, i32* %x129.addr, align 4
  %603 = load i32, i32* %x83.addr, align 4
  %604 = load i32, i32* %x113.addr, align 4
  %605 = call i64 @p256FiatAddcarryxU32(i32 %602, i32 %603, i32 %604)
  store i64 %605, i64* %w130.addr, align 8
  %606 = load i64, i64* %w130.addr, align 8
  %607 = trunc i64 %606 to i32
  store i32 %607, i32* %x130.addr, align 4
  %608 = load i64, i64* %w130.addr, align 8
  %609 = lshr i64 %608, 32
  %610 = trunc i64 %609 to i32
  store i32 %610, i32* %x131.addr, align 4
  %611 = load i32, i32* %x131.addr, align 4
  %612 = load i32, i32* %x84.addr, align 4
  %613 = load i32, i32* %x115.addr, align 4
  %614 = call i64 @p256FiatAddcarryxU32(i32 %611, i32 %612, i32 %613)
  store i64 %614, i64* %w132.addr, align 8
  %615 = load i64, i64* %w132.addr, align 8
  %616 = trunc i64 %615 to i32
  store i32 %616, i32* %x132.addr, align 4
  %617 = load i64, i64* %w132.addr, align 8
  %618 = lshr i64 %617, 32
  %619 = trunc i64 %618 to i32
  store i32 %619, i32* %x133.addr, align 4
  %620 = load i32, i32* %x116.addr, align 4
  %621 = call i64 @p256FiatMulxU32(i32 %620, i32 3993025615)
  store i64 %621, i64* %w134.addr, align 8
  %622 = load i64, i64* %w134.addr, align 8
  %623 = trunc i64 %622 to i32
  store i32 %623, i32* %x134.addr, align 4
  %624 = load i32, i32* %x134.addr, align 4
  %625 = call i64 @p256FiatMulxU32(i32 %624, i32 4294967295)
  store i64 %625, i64* %w136.addr, align 8
  %626 = load i64, i64* %w136.addr, align 8
  %627 = trunc i64 %626 to i32
  store i32 %627, i32* %x136.addr, align 4
  %628 = load i64, i64* %w136.addr, align 8
  %629 = lshr i64 %628, 32
  %630 = trunc i64 %629 to i32
  store i32 %630, i32* %x137.addr, align 4
  %631 = load i32, i32* %x134.addr, align 4
  %632 = call i64 @p256FiatMulxU32(i32 %631, i32 4294967295)
  store i64 %632, i64* %w138.addr, align 8
  %633 = load i64, i64* %w138.addr, align 8
  %634 = trunc i64 %633 to i32
  store i32 %634, i32* %x138.addr, align 4
  %635 = load i64, i64* %w138.addr, align 8
  %636 = lshr i64 %635, 32
  %637 = trunc i64 %636 to i32
  store i32 %637, i32* %x139.addr, align 4
  %638 = load i32, i32* %x134.addr, align 4
  %639 = call i64 @p256FiatMulxU32(i32 %638, i32 4294967295)
  store i64 %639, i64* %w140.addr, align 8
  %640 = load i64, i64* %w140.addr, align 8
  %641 = trunc i64 %640 to i32
  store i32 %641, i32* %x140.addr, align 4
  %642 = load i64, i64* %w140.addr, align 8
  %643 = lshr i64 %642, 32
  %644 = trunc i64 %643 to i32
  store i32 %644, i32* %x141.addr, align 4
  %645 = load i32, i32* %x134.addr, align 4
  %646 = call i64 @p256FiatMulxU32(i32 %645, i32 3169254061)
  store i64 %646, i64* %w142.addr, align 8
  %647 = load i64, i64* %w142.addr, align 8
  %648 = trunc i64 %647 to i32
  store i32 %648, i32* %x142.addr, align 4
  %649 = load i64, i64* %w142.addr, align 8
  %650 = lshr i64 %649, 32
  %651 = trunc i64 %650 to i32
  store i32 %651, i32* %x143.addr, align 4
  %652 = load i32, i32* %x134.addr, align 4
  %653 = call i64 @p256FiatMulxU32(i32 %652, i32 2803342980)
  store i64 %653, i64* %w144.addr, align 8
  %654 = load i64, i64* %w144.addr, align 8
  %655 = trunc i64 %654 to i32
  store i32 %655, i32* %x144.addr, align 4
  %656 = load i64, i64* %w144.addr, align 8
  %657 = lshr i64 %656, 32
  %658 = trunc i64 %657 to i32
  store i32 %658, i32* %x145.addr, align 4
  %659 = load i32, i32* %x134.addr, align 4
  %660 = call i64 @p256FiatMulxU32(i32 %659, i32 4089039554)
  store i64 %660, i64* %w146.addr, align 8
  %661 = load i64, i64* %w146.addr, align 8
  %662 = trunc i64 %661 to i32
  store i32 %662, i32* %x146.addr, align 4
  %663 = load i64, i64* %w146.addr, align 8
  %664 = lshr i64 %663, 32
  %665 = trunc i64 %664 to i32
  store i32 %665, i32* %x147.addr, align 4
  %666 = load i32, i32* %x134.addr, align 4
  %667 = call i64 @p256FiatMulxU32(i32 %666, i32 4234356049)
  store i64 %667, i64* %w148.addr, align 8
  %668 = load i64, i64* %w148.addr, align 8
  %669 = trunc i64 %668 to i32
  store i32 %669, i32* %x148.addr, align 4
  %670 = load i64, i64* %w148.addr, align 8
  %671 = lshr i64 %670, 32
  %672 = trunc i64 %671 to i32
  store i32 %672, i32* %x149.addr, align 4
  %673 = load i32, i32* %x149.addr, align 4
  %674 = load i32, i32* %x146.addr, align 4
  %675 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %673, i32 %674)
  store i64 %675, i64* %w150.addr, align 8
  %676 = load i64, i64* %w150.addr, align 8
  %677 = trunc i64 %676 to i32
  store i32 %677, i32* %x150.addr, align 4
  %678 = load i64, i64* %w150.addr, align 8
  %679 = lshr i64 %678, 32
  %680 = trunc i64 %679 to i32
  store i32 %680, i32* %x151.addr, align 4
  %681 = load i32, i32* %x151.addr, align 4
  %682 = load i32, i32* %x147.addr, align 4
  %683 = load i32, i32* %x144.addr, align 4
  %684 = call i64 @p256FiatAddcarryxU32(i32 %681, i32 %682, i32 %683)
  store i64 %684, i64* %w152.addr, align 8
  %685 = load i64, i64* %w152.addr, align 8
  %686 = trunc i64 %685 to i32
  store i32 %686, i32* %x152.addr, align 4
  %687 = load i64, i64* %w152.addr, align 8
  %688 = lshr i64 %687, 32
  %689 = trunc i64 %688 to i32
  store i32 %689, i32* %x153.addr, align 4
  %690 = load i32, i32* %x153.addr, align 4
  %691 = load i32, i32* %x145.addr, align 4
  %692 = load i32, i32* %x142.addr, align 4
  %693 = call i64 @p256FiatAddcarryxU32(i32 %690, i32 %691, i32 %692)
  store i64 %693, i64* %w154.addr, align 8
  %694 = load i64, i64* %w154.addr, align 8
  %695 = trunc i64 %694 to i32
  store i32 %695, i32* %x154.addr, align 4
  %696 = load i64, i64* %w154.addr, align 8
  %697 = lshr i64 %696, 32
  %698 = trunc i64 %697 to i32
  store i32 %698, i32* %x155.addr, align 4
  %699 = load i32, i32* %x155.addr, align 4
  %700 = load i32, i32* %x143.addr, align 4
  %701 = load i32, i32* %x140.addr, align 4
  %702 = call i64 @p256FiatAddcarryxU32(i32 %699, i32 %700, i32 %701)
  store i64 %702, i64* %w156.addr, align 8
  %703 = load i64, i64* %w156.addr, align 8
  %704 = trunc i64 %703 to i32
  store i32 %704, i32* %x156.addr, align 4
  %705 = load i64, i64* %w156.addr, align 8
  %706 = lshr i64 %705, 32
  %707 = trunc i64 %706 to i32
  store i32 %707, i32* %x157.addr, align 4
  %708 = load i32, i32* %x157.addr, align 4
  %709 = load i32, i32* %x141.addr, align 4
  %710 = load i32, i32* %x138.addr, align 4
  %711 = call i64 @p256FiatAddcarryxU32(i32 %708, i32 %709, i32 %710)
  store i64 %711, i64* %w158.addr, align 8
  %712 = load i64, i64* %w158.addr, align 8
  %713 = trunc i64 %712 to i32
  store i32 %713, i32* %x158.addr, align 4
  %714 = load i64, i64* %w158.addr, align 8
  %715 = lshr i64 %714, 32
  %716 = trunc i64 %715 to i32
  store i32 %716, i32* %x159.addr, align 4
  %717 = load i32, i32* %x159.addr, align 4
  %718 = load i32, i32* %x139.addr, align 4
  %719 = add i32 %717, %718
  store i32 %719, i32* %x160.addr, align 4
  %720 = load i32, i32* %x116.addr, align 4
  %721 = load i32, i32* %x148.addr, align 4
  %722 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %720, i32 %721)
  store i64 %722, i64* %w161.addr, align 8
  %723 = load i64, i64* %w161.addr, align 8
  %724 = lshr i64 %723, 32
  %725 = trunc i64 %724 to i32
  store i32 %725, i32* %x162.addr, align 4
  %726 = load i32, i32* %x162.addr, align 4
  %727 = load i32, i32* %x118.addr, align 4
  %728 = load i32, i32* %x150.addr, align 4
  %729 = call i64 @p256FiatAddcarryxU32(i32 %726, i32 %727, i32 %728)
  store i64 %729, i64* %w163.addr, align 8
  %730 = load i64, i64* %w163.addr, align 8
  %731 = trunc i64 %730 to i32
  store i32 %731, i32* %x163.addr, align 4
  %732 = load i64, i64* %w163.addr, align 8
  %733 = lshr i64 %732, 32
  %734 = trunc i64 %733 to i32
  store i32 %734, i32* %x164.addr, align 4
  %735 = load i32, i32* %x164.addr, align 4
  %736 = load i32, i32* %x120.addr, align 4
  %737 = load i32, i32* %x152.addr, align 4
  %738 = call i64 @p256FiatAddcarryxU32(i32 %735, i32 %736, i32 %737)
  store i64 %738, i64* %w165.addr, align 8
  %739 = load i64, i64* %w165.addr, align 8
  %740 = trunc i64 %739 to i32
  store i32 %740, i32* %x165.addr, align 4
  %741 = load i64, i64* %w165.addr, align 8
  %742 = lshr i64 %741, 32
  %743 = trunc i64 %742 to i32
  store i32 %743, i32* %x166.addr, align 4
  %744 = load i32, i32* %x166.addr, align 4
  %745 = load i32, i32* %x122.addr, align 4
  %746 = load i32, i32* %x154.addr, align 4
  %747 = call i64 @p256FiatAddcarryxU32(i32 %744, i32 %745, i32 %746)
  store i64 %747, i64* %w167.addr, align 8
  %748 = load i64, i64* %w167.addr, align 8
  %749 = trunc i64 %748 to i32
  store i32 %749, i32* %x167.addr, align 4
  %750 = load i64, i64* %w167.addr, align 8
  %751 = lshr i64 %750, 32
  %752 = trunc i64 %751 to i32
  store i32 %752, i32* %x168.addr, align 4
  %753 = load i32, i32* %x168.addr, align 4
  %754 = load i32, i32* %x124.addr, align 4
  %755 = load i32, i32* %x156.addr, align 4
  %756 = call i64 @p256FiatAddcarryxU32(i32 %753, i32 %754, i32 %755)
  store i64 %756, i64* %w169.addr, align 8
  %757 = load i64, i64* %w169.addr, align 8
  %758 = trunc i64 %757 to i32
  store i32 %758, i32* %x169.addr, align 4
  %759 = load i64, i64* %w169.addr, align 8
  %760 = lshr i64 %759, 32
  %761 = trunc i64 %760 to i32
  store i32 %761, i32* %x170.addr, align 4
  %762 = load i32, i32* %x170.addr, align 4
  %763 = load i32, i32* %x126.addr, align 4
  %764 = load i32, i32* %x158.addr, align 4
  %765 = call i64 @p256FiatAddcarryxU32(i32 %762, i32 %763, i32 %764)
  store i64 %765, i64* %w171.addr, align 8
  %766 = load i64, i64* %w171.addr, align 8
  %767 = trunc i64 %766 to i32
  store i32 %767, i32* %x171.addr, align 4
  %768 = load i64, i64* %w171.addr, align 8
  %769 = lshr i64 %768, 32
  %770 = trunc i64 %769 to i32
  store i32 %770, i32* %x172.addr, align 4
  %771 = load i32, i32* %x172.addr, align 4
  %772 = load i32, i32* %x128.addr, align 4
  %773 = load i32, i32* %x160.addr, align 4
  %774 = call i64 @p256FiatAddcarryxU32(i32 %771, i32 %772, i32 %773)
  store i64 %774, i64* %w173.addr, align 8
  %775 = load i64, i64* %w173.addr, align 8
  %776 = trunc i64 %775 to i32
  store i32 %776, i32* %x173.addr, align 4
  %777 = load i64, i64* %w173.addr, align 8
  %778 = lshr i64 %777, 32
  %779 = trunc i64 %778 to i32
  store i32 %779, i32* %x174.addr, align 4
  %780 = load i32, i32* %x174.addr, align 4
  %781 = load i32, i32* %x130.addr, align 4
  %782 = load i32, i32* %x136.addr, align 4
  %783 = call i64 @p256FiatAddcarryxU32(i32 %780, i32 %781, i32 %782)
  store i64 %783, i64* %w175.addr, align 8
  %784 = load i64, i64* %w175.addr, align 8
  %785 = trunc i64 %784 to i32
  store i32 %785, i32* %x175.addr, align 4
  %786 = load i64, i64* %w175.addr, align 8
  %787 = lshr i64 %786, 32
  %788 = trunc i64 %787 to i32
  store i32 %788, i32* %x176.addr, align 4
  %789 = load i32, i32* %x176.addr, align 4
  %790 = load i32, i32* %x132.addr, align 4
  %791 = load i32, i32* %x137.addr, align 4
  %792 = call i64 @p256FiatAddcarryxU32(i32 %789, i32 %790, i32 %791)
  store i64 %792, i64* %w177.addr, align 8
  %793 = load i64, i64* %w177.addr, align 8
  %794 = trunc i64 %793 to i32
  store i32 %794, i32* %x177.addr, align 4
  %795 = load i64, i64* %w177.addr, align 8
  %796 = lshr i64 %795, 32
  %797 = trunc i64 %796 to i32
  store i32 %797, i32* %x178.addr, align 4
  %798 = load i32, i32* %x178.addr, align 4
  %799 = load i32, i32* %x133.addr, align 4
  %800 = add i32 %798, %799
  store i32 %800, i32* %x179.addr, align 4
  %801 = load i32, i32* %x2.addr, align 4
  %802 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %803 = load i8*, i8** %802, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %804 = bitcast i8* %803 to i32*
  %805 = getelementptr inbounds i32, i32* %804, i64 7
  %806 = load i32, i32* %805, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %807 = call i64 @p256FiatMulxU32(i32 %801, i32 %806)
  store i64 %807, i64* %w180.addr, align 8
  %808 = load i64, i64* %w180.addr, align 8
  %809 = trunc i64 %808 to i32
  store i32 %809, i32* %x180.addr, align 4
  %810 = load i64, i64* %w180.addr, align 8
  %811 = lshr i64 %810, 32
  %812 = trunc i64 %811 to i32
  store i32 %812, i32* %x181.addr, align 4
  %813 = load i32, i32* %x2.addr, align 4
  %814 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %815 = load i8*, i8** %814, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %816 = bitcast i8* %815 to i32*
  %817 = getelementptr inbounds i32, i32* %816, i64 6
  %818 = load i32, i32* %817, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %819 = call i64 @p256FiatMulxU32(i32 %813, i32 %818)
  store i64 %819, i64* %w182.addr, align 8
  %820 = load i64, i64* %w182.addr, align 8
  %821 = trunc i64 %820 to i32
  store i32 %821, i32* %x182.addr, align 4
  %822 = load i64, i64* %w182.addr, align 8
  %823 = lshr i64 %822, 32
  %824 = trunc i64 %823 to i32
  store i32 %824, i32* %x183.addr, align 4
  %825 = load i32, i32* %x2.addr, align 4
  %826 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %827 = load i8*, i8** %826, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %828 = bitcast i8* %827 to i32*
  %829 = getelementptr inbounds i32, i32* %828, i64 5
  %830 = load i32, i32* %829, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %831 = call i64 @p256FiatMulxU32(i32 %825, i32 %830)
  store i64 %831, i64* %w184.addr, align 8
  %832 = load i64, i64* %w184.addr, align 8
  %833 = trunc i64 %832 to i32
  store i32 %833, i32* %x184.addr, align 4
  %834 = load i64, i64* %w184.addr, align 8
  %835 = lshr i64 %834, 32
  %836 = trunc i64 %835 to i32
  store i32 %836, i32* %x185.addr, align 4
  %837 = load i32, i32* %x2.addr, align 4
  %838 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %839 = load i8*, i8** %838, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %840 = bitcast i8* %839 to i32*
  %841 = getelementptr inbounds i32, i32* %840, i64 4
  %842 = load i32, i32* %841, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %843 = call i64 @p256FiatMulxU32(i32 %837, i32 %842)
  store i64 %843, i64* %w186.addr, align 8
  %844 = load i64, i64* %w186.addr, align 8
  %845 = trunc i64 %844 to i32
  store i32 %845, i32* %x186.addr, align 4
  %846 = load i64, i64* %w186.addr, align 8
  %847 = lshr i64 %846, 32
  %848 = trunc i64 %847 to i32
  store i32 %848, i32* %x187.addr, align 4
  %849 = load i32, i32* %x2.addr, align 4
  %850 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %851 = load i8*, i8** %850, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %852 = bitcast i8* %851 to i32*
  %853 = getelementptr inbounds i32, i32* %852, i64 3
  %854 = load i32, i32* %853, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %855 = call i64 @p256FiatMulxU32(i32 %849, i32 %854)
  store i64 %855, i64* %w188.addr, align 8
  %856 = load i64, i64* %w188.addr, align 8
  %857 = trunc i64 %856 to i32
  store i32 %857, i32* %x188.addr, align 4
  %858 = load i64, i64* %w188.addr, align 8
  %859 = lshr i64 %858, 32
  %860 = trunc i64 %859 to i32
  store i32 %860, i32* %x189.addr, align 4
  %861 = load i32, i32* %x2.addr, align 4
  %862 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %863 = load i8*, i8** %862, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %864 = bitcast i8* %863 to i32*
  %865 = getelementptr inbounds i32, i32* %864, i64 2
  %866 = load i32, i32* %865, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %867 = call i64 @p256FiatMulxU32(i32 %861, i32 %866)
  store i64 %867, i64* %w190.addr, align 8
  %868 = load i64, i64* %w190.addr, align 8
  %869 = trunc i64 %868 to i32
  store i32 %869, i32* %x190.addr, align 4
  %870 = load i64, i64* %w190.addr, align 8
  %871 = lshr i64 %870, 32
  %872 = trunc i64 %871 to i32
  store i32 %872, i32* %x191.addr, align 4
  %873 = load i32, i32* %x2.addr, align 4
  %874 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %875 = load i8*, i8** %874, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %876 = bitcast i8* %875 to i32*
  %877 = getelementptr inbounds i32, i32* %876, i64 1
  %878 = load i32, i32* %877, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %879 = call i64 @p256FiatMulxU32(i32 %873, i32 %878)
  store i64 %879, i64* %w192.addr, align 8
  %880 = load i64, i64* %w192.addr, align 8
  %881 = trunc i64 %880 to i32
  store i32 %881, i32* %x192.addr, align 4
  %882 = load i64, i64* %w192.addr, align 8
  %883 = lshr i64 %882, 32
  %884 = trunc i64 %883 to i32
  store i32 %884, i32* %x193.addr, align 4
  %885 = load i32, i32* %x2.addr, align 4
  %886 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %887 = load i8*, i8** %886, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %888 = bitcast i8* %887 to i32*
  %889 = getelementptr inbounds i32, i32* %888, i64 0
  %890 = load i32, i32* %889, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %891 = call i64 @p256FiatMulxU32(i32 %885, i32 %890)
  store i64 %891, i64* %w194.addr, align 8
  %892 = load i64, i64* %w194.addr, align 8
  %893 = trunc i64 %892 to i32
  store i32 %893, i32* %x194.addr, align 4
  %894 = load i64, i64* %w194.addr, align 8
  %895 = lshr i64 %894, 32
  %896 = trunc i64 %895 to i32
  store i32 %896, i32* %x195.addr, align 4
  %897 = load i32, i32* %x195.addr, align 4
  %898 = load i32, i32* %x192.addr, align 4
  %899 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %897, i32 %898)
  store i64 %899, i64* %w196.addr, align 8
  %900 = load i64, i64* %w196.addr, align 8
  %901 = trunc i64 %900 to i32
  store i32 %901, i32* %x196.addr, align 4
  %902 = load i64, i64* %w196.addr, align 8
  %903 = lshr i64 %902, 32
  %904 = trunc i64 %903 to i32
  store i32 %904, i32* %x197.addr, align 4
  %905 = load i32, i32* %x197.addr, align 4
  %906 = load i32, i32* %x193.addr, align 4
  %907 = load i32, i32* %x190.addr, align 4
  %908 = call i64 @p256FiatAddcarryxU32(i32 %905, i32 %906, i32 %907)
  store i64 %908, i64* %w198.addr, align 8
  %909 = load i64, i64* %w198.addr, align 8
  %910 = trunc i64 %909 to i32
  store i32 %910, i32* %x198.addr, align 4
  %911 = load i64, i64* %w198.addr, align 8
  %912 = lshr i64 %911, 32
  %913 = trunc i64 %912 to i32
  store i32 %913, i32* %x199.addr, align 4
  %914 = load i32, i32* %x199.addr, align 4
  %915 = load i32, i32* %x191.addr, align 4
  %916 = load i32, i32* %x188.addr, align 4
  %917 = call i64 @p256FiatAddcarryxU32(i32 %914, i32 %915, i32 %916)
  store i64 %917, i64* %w200.addr, align 8
  %918 = load i64, i64* %w200.addr, align 8
  %919 = trunc i64 %918 to i32
  store i32 %919, i32* %x200.addr, align 4
  %920 = load i64, i64* %w200.addr, align 8
  %921 = lshr i64 %920, 32
  %922 = trunc i64 %921 to i32
  store i32 %922, i32* %x201.addr, align 4
  %923 = load i32, i32* %x201.addr, align 4
  %924 = load i32, i32* %x189.addr, align 4
  %925 = load i32, i32* %x186.addr, align 4
  %926 = call i64 @p256FiatAddcarryxU32(i32 %923, i32 %924, i32 %925)
  store i64 %926, i64* %w202.addr, align 8
  %927 = load i64, i64* %w202.addr, align 8
  %928 = trunc i64 %927 to i32
  store i32 %928, i32* %x202.addr, align 4
  %929 = load i64, i64* %w202.addr, align 8
  %930 = lshr i64 %929, 32
  %931 = trunc i64 %930 to i32
  store i32 %931, i32* %x203.addr, align 4
  %932 = load i32, i32* %x203.addr, align 4
  %933 = load i32, i32* %x187.addr, align 4
  %934 = load i32, i32* %x184.addr, align 4
  %935 = call i64 @p256FiatAddcarryxU32(i32 %932, i32 %933, i32 %934)
  store i64 %935, i64* %w204.addr, align 8
  %936 = load i64, i64* %w204.addr, align 8
  %937 = trunc i64 %936 to i32
  store i32 %937, i32* %x204.addr, align 4
  %938 = load i64, i64* %w204.addr, align 8
  %939 = lshr i64 %938, 32
  %940 = trunc i64 %939 to i32
  store i32 %940, i32* %x205.addr, align 4
  %941 = load i32, i32* %x205.addr, align 4
  %942 = load i32, i32* %x185.addr, align 4
  %943 = load i32, i32* %x182.addr, align 4
  %944 = call i64 @p256FiatAddcarryxU32(i32 %941, i32 %942, i32 %943)
  store i64 %944, i64* %w206.addr, align 8
  %945 = load i64, i64* %w206.addr, align 8
  %946 = trunc i64 %945 to i32
  store i32 %946, i32* %x206.addr, align 4
  %947 = load i64, i64* %w206.addr, align 8
  %948 = lshr i64 %947, 32
  %949 = trunc i64 %948 to i32
  store i32 %949, i32* %x207.addr, align 4
  %950 = load i32, i32* %x207.addr, align 4
  %951 = load i32, i32* %x183.addr, align 4
  %952 = load i32, i32* %x180.addr, align 4
  %953 = call i64 @p256FiatAddcarryxU32(i32 %950, i32 %951, i32 %952)
  store i64 %953, i64* %w208.addr, align 8
  %954 = load i64, i64* %w208.addr, align 8
  %955 = trunc i64 %954 to i32
  store i32 %955, i32* %x208.addr, align 4
  %956 = load i64, i64* %w208.addr, align 8
  %957 = lshr i64 %956, 32
  %958 = trunc i64 %957 to i32
  store i32 %958, i32* %x209.addr, align 4
  %959 = load i32, i32* %x209.addr, align 4
  %960 = load i32, i32* %x181.addr, align 4
  %961 = add i32 %959, %960
  store i32 %961, i32* %x210.addr, align 4
  %962 = load i32, i32* %x163.addr, align 4
  %963 = load i32, i32* %x194.addr, align 4
  %964 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %962, i32 %963)
  store i64 %964, i64* %w211.addr, align 8
  %965 = load i64, i64* %w211.addr, align 8
  %966 = trunc i64 %965 to i32
  store i32 %966, i32* %x211.addr, align 4
  %967 = load i64, i64* %w211.addr, align 8
  %968 = lshr i64 %967, 32
  %969 = trunc i64 %968 to i32
  store i32 %969, i32* %x212.addr, align 4
  %970 = load i32, i32* %x212.addr, align 4
  %971 = load i32, i32* %x165.addr, align 4
  %972 = load i32, i32* %x196.addr, align 4
  %973 = call i64 @p256FiatAddcarryxU32(i32 %970, i32 %971, i32 %972)
  store i64 %973, i64* %w213.addr, align 8
  %974 = load i64, i64* %w213.addr, align 8
  %975 = trunc i64 %974 to i32
  store i32 %975, i32* %x213.addr, align 4
  %976 = load i64, i64* %w213.addr, align 8
  %977 = lshr i64 %976, 32
  %978 = trunc i64 %977 to i32
  store i32 %978, i32* %x214.addr, align 4
  %979 = load i32, i32* %x214.addr, align 4
  %980 = load i32, i32* %x167.addr, align 4
  %981 = load i32, i32* %x198.addr, align 4
  %982 = call i64 @p256FiatAddcarryxU32(i32 %979, i32 %980, i32 %981)
  store i64 %982, i64* %w215.addr, align 8
  %983 = load i64, i64* %w215.addr, align 8
  %984 = trunc i64 %983 to i32
  store i32 %984, i32* %x215.addr, align 4
  %985 = load i64, i64* %w215.addr, align 8
  %986 = lshr i64 %985, 32
  %987 = trunc i64 %986 to i32
  store i32 %987, i32* %x216.addr, align 4
  %988 = load i32, i32* %x216.addr, align 4
  %989 = load i32, i32* %x169.addr, align 4
  %990 = load i32, i32* %x200.addr, align 4
  %991 = call i64 @p256FiatAddcarryxU32(i32 %988, i32 %989, i32 %990)
  store i64 %991, i64* %w217.addr, align 8
  %992 = load i64, i64* %w217.addr, align 8
  %993 = trunc i64 %992 to i32
  store i32 %993, i32* %x217.addr, align 4
  %994 = load i64, i64* %w217.addr, align 8
  %995 = lshr i64 %994, 32
  %996 = trunc i64 %995 to i32
  store i32 %996, i32* %x218.addr, align 4
  %997 = load i32, i32* %x218.addr, align 4
  %998 = load i32, i32* %x171.addr, align 4
  %999 = load i32, i32* %x202.addr, align 4
  %1000 = call i64 @p256FiatAddcarryxU32(i32 %997, i32 %998, i32 %999)
  store i64 %1000, i64* %w219.addr, align 8
  %1001 = load i64, i64* %w219.addr, align 8
  %1002 = trunc i64 %1001 to i32
  store i32 %1002, i32* %x219.addr, align 4
  %1003 = load i64, i64* %w219.addr, align 8
  %1004 = lshr i64 %1003, 32
  %1005 = trunc i64 %1004 to i32
  store i32 %1005, i32* %x220.addr, align 4
  %1006 = load i32, i32* %x220.addr, align 4
  %1007 = load i32, i32* %x173.addr, align 4
  %1008 = load i32, i32* %x204.addr, align 4
  %1009 = call i64 @p256FiatAddcarryxU32(i32 %1006, i32 %1007, i32 %1008)
  store i64 %1009, i64* %w221.addr, align 8
  %1010 = load i64, i64* %w221.addr, align 8
  %1011 = trunc i64 %1010 to i32
  store i32 %1011, i32* %x221.addr, align 4
  %1012 = load i64, i64* %w221.addr, align 8
  %1013 = lshr i64 %1012, 32
  %1014 = trunc i64 %1013 to i32
  store i32 %1014, i32* %x222.addr, align 4
  %1015 = load i32, i32* %x222.addr, align 4
  %1016 = load i32, i32* %x175.addr, align 4
  %1017 = load i32, i32* %x206.addr, align 4
  %1018 = call i64 @p256FiatAddcarryxU32(i32 %1015, i32 %1016, i32 %1017)
  store i64 %1018, i64* %w223.addr, align 8
  %1019 = load i64, i64* %w223.addr, align 8
  %1020 = trunc i64 %1019 to i32
  store i32 %1020, i32* %x223.addr, align 4
  %1021 = load i64, i64* %w223.addr, align 8
  %1022 = lshr i64 %1021, 32
  %1023 = trunc i64 %1022 to i32
  store i32 %1023, i32* %x224.addr, align 4
  %1024 = load i32, i32* %x224.addr, align 4
  %1025 = load i32, i32* %x177.addr, align 4
  %1026 = load i32, i32* %x208.addr, align 4
  %1027 = call i64 @p256FiatAddcarryxU32(i32 %1024, i32 %1025, i32 %1026)
  store i64 %1027, i64* %w225.addr, align 8
  %1028 = load i64, i64* %w225.addr, align 8
  %1029 = trunc i64 %1028 to i32
  store i32 %1029, i32* %x225.addr, align 4
  %1030 = load i64, i64* %w225.addr, align 8
  %1031 = lshr i64 %1030, 32
  %1032 = trunc i64 %1031 to i32
  store i32 %1032, i32* %x226.addr, align 4
  %1033 = load i32, i32* %x226.addr, align 4
  %1034 = load i32, i32* %x179.addr, align 4
  %1035 = load i32, i32* %x210.addr, align 4
  %1036 = call i64 @p256FiatAddcarryxU32(i32 %1033, i32 %1034, i32 %1035)
  store i64 %1036, i64* %w227.addr, align 8
  %1037 = load i64, i64* %w227.addr, align 8
  %1038 = trunc i64 %1037 to i32
  store i32 %1038, i32* %x227.addr, align 4
  %1039 = load i64, i64* %w227.addr, align 8
  %1040 = lshr i64 %1039, 32
  %1041 = trunc i64 %1040 to i32
  store i32 %1041, i32* %x228.addr, align 4
  %1042 = load i32, i32* %x211.addr, align 4
  %1043 = call i64 @p256FiatMulxU32(i32 %1042, i32 3993025615)
  store i64 %1043, i64* %w229.addr, align 8
  %1044 = load i64, i64* %w229.addr, align 8
  %1045 = trunc i64 %1044 to i32
  store i32 %1045, i32* %x229.addr, align 4
  %1046 = load i32, i32* %x229.addr, align 4
  %1047 = call i64 @p256FiatMulxU32(i32 %1046, i32 4294967295)
  store i64 %1047, i64* %w231.addr, align 8
  %1048 = load i64, i64* %w231.addr, align 8
  %1049 = trunc i64 %1048 to i32
  store i32 %1049, i32* %x231.addr, align 4
  %1050 = load i64, i64* %w231.addr, align 8
  %1051 = lshr i64 %1050, 32
  %1052 = trunc i64 %1051 to i32
  store i32 %1052, i32* %x232.addr, align 4
  %1053 = load i32, i32* %x229.addr, align 4
  %1054 = call i64 @p256FiatMulxU32(i32 %1053, i32 4294967295)
  store i64 %1054, i64* %w233.addr, align 8
  %1055 = load i64, i64* %w233.addr, align 8
  %1056 = trunc i64 %1055 to i32
  store i32 %1056, i32* %x233.addr, align 4
  %1057 = load i64, i64* %w233.addr, align 8
  %1058 = lshr i64 %1057, 32
  %1059 = trunc i64 %1058 to i32
  store i32 %1059, i32* %x234.addr, align 4
  %1060 = load i32, i32* %x229.addr, align 4
  %1061 = call i64 @p256FiatMulxU32(i32 %1060, i32 4294967295)
  store i64 %1061, i64* %w235.addr, align 8
  %1062 = load i64, i64* %w235.addr, align 8
  %1063 = trunc i64 %1062 to i32
  store i32 %1063, i32* %x235.addr, align 4
  %1064 = load i64, i64* %w235.addr, align 8
  %1065 = lshr i64 %1064, 32
  %1066 = trunc i64 %1065 to i32
  store i32 %1066, i32* %x236.addr, align 4
  %1067 = load i32, i32* %x229.addr, align 4
  %1068 = call i64 @p256FiatMulxU32(i32 %1067, i32 3169254061)
  store i64 %1068, i64* %w237.addr, align 8
  %1069 = load i64, i64* %w237.addr, align 8
  %1070 = trunc i64 %1069 to i32
  store i32 %1070, i32* %x237.addr, align 4
  %1071 = load i64, i64* %w237.addr, align 8
  %1072 = lshr i64 %1071, 32
  %1073 = trunc i64 %1072 to i32
  store i32 %1073, i32* %x238.addr, align 4
  %1074 = load i32, i32* %x229.addr, align 4
  %1075 = call i64 @p256FiatMulxU32(i32 %1074, i32 2803342980)
  store i64 %1075, i64* %w239.addr, align 8
  %1076 = load i64, i64* %w239.addr, align 8
  %1077 = trunc i64 %1076 to i32
  store i32 %1077, i32* %x239.addr, align 4
  %1078 = load i64, i64* %w239.addr, align 8
  %1079 = lshr i64 %1078, 32
  %1080 = trunc i64 %1079 to i32
  store i32 %1080, i32* %x240.addr, align 4
  %1081 = load i32, i32* %x229.addr, align 4
  %1082 = call i64 @p256FiatMulxU32(i32 %1081, i32 4089039554)
  store i64 %1082, i64* %w241.addr, align 8
  %1083 = load i64, i64* %w241.addr, align 8
  %1084 = trunc i64 %1083 to i32
  store i32 %1084, i32* %x241.addr, align 4
  %1085 = load i64, i64* %w241.addr, align 8
  %1086 = lshr i64 %1085, 32
  %1087 = trunc i64 %1086 to i32
  store i32 %1087, i32* %x242.addr, align 4
  %1088 = load i32, i32* %x229.addr, align 4
  %1089 = call i64 @p256FiatMulxU32(i32 %1088, i32 4234356049)
  store i64 %1089, i64* %w243.addr, align 8
  %1090 = load i64, i64* %w243.addr, align 8
  %1091 = trunc i64 %1090 to i32
  store i32 %1091, i32* %x243.addr, align 4
  %1092 = load i64, i64* %w243.addr, align 8
  %1093 = lshr i64 %1092, 32
  %1094 = trunc i64 %1093 to i32
  store i32 %1094, i32* %x244.addr, align 4
  %1095 = load i32, i32* %x244.addr, align 4
  %1096 = load i32, i32* %x241.addr, align 4
  %1097 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1095, i32 %1096)
  store i64 %1097, i64* %w245.addr, align 8
  %1098 = load i64, i64* %w245.addr, align 8
  %1099 = trunc i64 %1098 to i32
  store i32 %1099, i32* %x245.addr, align 4
  %1100 = load i64, i64* %w245.addr, align 8
  %1101 = lshr i64 %1100, 32
  %1102 = trunc i64 %1101 to i32
  store i32 %1102, i32* %x246.addr, align 4
  %1103 = load i32, i32* %x246.addr, align 4
  %1104 = load i32, i32* %x242.addr, align 4
  %1105 = load i32, i32* %x239.addr, align 4
  %1106 = call i64 @p256FiatAddcarryxU32(i32 %1103, i32 %1104, i32 %1105)
  store i64 %1106, i64* %w247.addr, align 8
  %1107 = load i64, i64* %w247.addr, align 8
  %1108 = trunc i64 %1107 to i32
  store i32 %1108, i32* %x247.addr, align 4
  %1109 = load i64, i64* %w247.addr, align 8
  %1110 = lshr i64 %1109, 32
  %1111 = trunc i64 %1110 to i32
  store i32 %1111, i32* %x248.addr, align 4
  %1112 = load i32, i32* %x248.addr, align 4
  %1113 = load i32, i32* %x240.addr, align 4
  %1114 = load i32, i32* %x237.addr, align 4
  %1115 = call i64 @p256FiatAddcarryxU32(i32 %1112, i32 %1113, i32 %1114)
  store i64 %1115, i64* %w249.addr, align 8
  %1116 = load i64, i64* %w249.addr, align 8
  %1117 = trunc i64 %1116 to i32
  store i32 %1117, i32* %x249.addr, align 4
  %1118 = load i64, i64* %w249.addr, align 8
  %1119 = lshr i64 %1118, 32
  %1120 = trunc i64 %1119 to i32
  store i32 %1120, i32* %x250.addr, align 4
  %1121 = load i32, i32* %x250.addr, align 4
  %1122 = load i32, i32* %x238.addr, align 4
  %1123 = load i32, i32* %x235.addr, align 4
  %1124 = call i64 @p256FiatAddcarryxU32(i32 %1121, i32 %1122, i32 %1123)
  store i64 %1124, i64* %w251.addr, align 8
  %1125 = load i64, i64* %w251.addr, align 8
  %1126 = trunc i64 %1125 to i32
  store i32 %1126, i32* %x251.addr, align 4
  %1127 = load i64, i64* %w251.addr, align 8
  %1128 = lshr i64 %1127, 32
  %1129 = trunc i64 %1128 to i32
  store i32 %1129, i32* %x252.addr, align 4
  %1130 = load i32, i32* %x252.addr, align 4
  %1131 = load i32, i32* %x236.addr, align 4
  %1132 = load i32, i32* %x233.addr, align 4
  %1133 = call i64 @p256FiatAddcarryxU32(i32 %1130, i32 %1131, i32 %1132)
  store i64 %1133, i64* %w253.addr, align 8
  %1134 = load i64, i64* %w253.addr, align 8
  %1135 = trunc i64 %1134 to i32
  store i32 %1135, i32* %x253.addr, align 4
  %1136 = load i64, i64* %w253.addr, align 8
  %1137 = lshr i64 %1136, 32
  %1138 = trunc i64 %1137 to i32
  store i32 %1138, i32* %x254.addr, align 4
  %1139 = load i32, i32* %x254.addr, align 4
  %1140 = load i32, i32* %x234.addr, align 4
  %1141 = add i32 %1139, %1140
  store i32 %1141, i32* %x255.addr, align 4
  %1142 = load i32, i32* %x211.addr, align 4
  %1143 = load i32, i32* %x243.addr, align 4
  %1144 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1142, i32 %1143)
  store i64 %1144, i64* %w256.addr, align 8
  %1145 = load i64, i64* %w256.addr, align 8
  %1146 = lshr i64 %1145, 32
  %1147 = trunc i64 %1146 to i32
  store i32 %1147, i32* %x257.addr, align 4
  %1148 = load i32, i32* %x257.addr, align 4
  %1149 = load i32, i32* %x213.addr, align 4
  %1150 = load i32, i32* %x245.addr, align 4
  %1151 = call i64 @p256FiatAddcarryxU32(i32 %1148, i32 %1149, i32 %1150)
  store i64 %1151, i64* %w258.addr, align 8
  %1152 = load i64, i64* %w258.addr, align 8
  %1153 = trunc i64 %1152 to i32
  store i32 %1153, i32* %x258.addr, align 4
  %1154 = load i64, i64* %w258.addr, align 8
  %1155 = lshr i64 %1154, 32
  %1156 = trunc i64 %1155 to i32
  store i32 %1156, i32* %x259.addr, align 4
  %1157 = load i32, i32* %x259.addr, align 4
  %1158 = load i32, i32* %x215.addr, align 4
  %1159 = load i32, i32* %x247.addr, align 4
  %1160 = call i64 @p256FiatAddcarryxU32(i32 %1157, i32 %1158, i32 %1159)
  store i64 %1160, i64* %w260.addr, align 8
  %1161 = load i64, i64* %w260.addr, align 8
  %1162 = trunc i64 %1161 to i32
  store i32 %1162, i32* %x260.addr, align 4
  %1163 = load i64, i64* %w260.addr, align 8
  %1164 = lshr i64 %1163, 32
  %1165 = trunc i64 %1164 to i32
  store i32 %1165, i32* %x261.addr, align 4
  %1166 = load i32, i32* %x261.addr, align 4
  %1167 = load i32, i32* %x217.addr, align 4
  %1168 = load i32, i32* %x249.addr, align 4
  %1169 = call i64 @p256FiatAddcarryxU32(i32 %1166, i32 %1167, i32 %1168)
  store i64 %1169, i64* %w262.addr, align 8
  %1170 = load i64, i64* %w262.addr, align 8
  %1171 = trunc i64 %1170 to i32
  store i32 %1171, i32* %x262.addr, align 4
  %1172 = load i64, i64* %w262.addr, align 8
  %1173 = lshr i64 %1172, 32
  %1174 = trunc i64 %1173 to i32
  store i32 %1174, i32* %x263.addr, align 4
  %1175 = load i32, i32* %x263.addr, align 4
  %1176 = load i32, i32* %x219.addr, align 4
  %1177 = load i32, i32* %x251.addr, align 4
  %1178 = call i64 @p256FiatAddcarryxU32(i32 %1175, i32 %1176, i32 %1177)
  store i64 %1178, i64* %w264.addr, align 8
  %1179 = load i64, i64* %w264.addr, align 8
  %1180 = trunc i64 %1179 to i32
  store i32 %1180, i32* %x264.addr, align 4
  %1181 = load i64, i64* %w264.addr, align 8
  %1182 = lshr i64 %1181, 32
  %1183 = trunc i64 %1182 to i32
  store i32 %1183, i32* %x265.addr, align 4
  %1184 = load i32, i32* %x265.addr, align 4
  %1185 = load i32, i32* %x221.addr, align 4
  %1186 = load i32, i32* %x253.addr, align 4
  %1187 = call i64 @p256FiatAddcarryxU32(i32 %1184, i32 %1185, i32 %1186)
  store i64 %1187, i64* %w266.addr, align 8
  %1188 = load i64, i64* %w266.addr, align 8
  %1189 = trunc i64 %1188 to i32
  store i32 %1189, i32* %x266.addr, align 4
  %1190 = load i64, i64* %w266.addr, align 8
  %1191 = lshr i64 %1190, 32
  %1192 = trunc i64 %1191 to i32
  store i32 %1192, i32* %x267.addr, align 4
  %1193 = load i32, i32* %x267.addr, align 4
  %1194 = load i32, i32* %x223.addr, align 4
  %1195 = load i32, i32* %x255.addr, align 4
  %1196 = call i64 @p256FiatAddcarryxU32(i32 %1193, i32 %1194, i32 %1195)
  store i64 %1196, i64* %w268.addr, align 8
  %1197 = load i64, i64* %w268.addr, align 8
  %1198 = trunc i64 %1197 to i32
  store i32 %1198, i32* %x268.addr, align 4
  %1199 = load i64, i64* %w268.addr, align 8
  %1200 = lshr i64 %1199, 32
  %1201 = trunc i64 %1200 to i32
  store i32 %1201, i32* %x269.addr, align 4
  %1202 = load i32, i32* %x269.addr, align 4
  %1203 = load i32, i32* %x225.addr, align 4
  %1204 = load i32, i32* %x231.addr, align 4
  %1205 = call i64 @p256FiatAddcarryxU32(i32 %1202, i32 %1203, i32 %1204)
  store i64 %1205, i64* %w270.addr, align 8
  %1206 = load i64, i64* %w270.addr, align 8
  %1207 = trunc i64 %1206 to i32
  store i32 %1207, i32* %x270.addr, align 4
  %1208 = load i64, i64* %w270.addr, align 8
  %1209 = lshr i64 %1208, 32
  %1210 = trunc i64 %1209 to i32
  store i32 %1210, i32* %x271.addr, align 4
  %1211 = load i32, i32* %x271.addr, align 4
  %1212 = load i32, i32* %x227.addr, align 4
  %1213 = load i32, i32* %x232.addr, align 4
  %1214 = call i64 @p256FiatAddcarryxU32(i32 %1211, i32 %1212, i32 %1213)
  store i64 %1214, i64* %w272.addr, align 8
  %1215 = load i64, i64* %w272.addr, align 8
  %1216 = trunc i64 %1215 to i32
  store i32 %1216, i32* %x272.addr, align 4
  %1217 = load i64, i64* %w272.addr, align 8
  %1218 = lshr i64 %1217, 32
  %1219 = trunc i64 %1218 to i32
  store i32 %1219, i32* %x273.addr, align 4
  %1220 = load i32, i32* %x273.addr, align 4
  %1221 = load i32, i32* %x228.addr, align 4
  %1222 = add i32 %1220, %1221
  store i32 %1222, i32* %x274.addr, align 4
  %1223 = load i32, i32* %x3.addr, align 4
  %1224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1225 = load i8*, i8** %1224, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1226 = bitcast i8* %1225 to i32*
  %1227 = getelementptr inbounds i32, i32* %1226, i64 7
  %1228 = load i32, i32* %1227, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1229 = call i64 @p256FiatMulxU32(i32 %1223, i32 %1228)
  store i64 %1229, i64* %w275.addr, align 8
  %1230 = load i64, i64* %w275.addr, align 8
  %1231 = trunc i64 %1230 to i32
  store i32 %1231, i32* %x275.addr, align 4
  %1232 = load i64, i64* %w275.addr, align 8
  %1233 = lshr i64 %1232, 32
  %1234 = trunc i64 %1233 to i32
  store i32 %1234, i32* %x276.addr, align 4
  %1235 = load i32, i32* %x3.addr, align 4
  %1236 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1237 = load i8*, i8** %1236, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1238 = bitcast i8* %1237 to i32*
  %1239 = getelementptr inbounds i32, i32* %1238, i64 6
  %1240 = load i32, i32* %1239, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1241 = call i64 @p256FiatMulxU32(i32 %1235, i32 %1240)
  store i64 %1241, i64* %w277.addr, align 8
  %1242 = load i64, i64* %w277.addr, align 8
  %1243 = trunc i64 %1242 to i32
  store i32 %1243, i32* %x277.addr, align 4
  %1244 = load i64, i64* %w277.addr, align 8
  %1245 = lshr i64 %1244, 32
  %1246 = trunc i64 %1245 to i32
  store i32 %1246, i32* %x278.addr, align 4
  %1247 = load i32, i32* %x3.addr, align 4
  %1248 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1249 = load i8*, i8** %1248, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1250 = bitcast i8* %1249 to i32*
  %1251 = getelementptr inbounds i32, i32* %1250, i64 5
  %1252 = load i32, i32* %1251, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1253 = call i64 @p256FiatMulxU32(i32 %1247, i32 %1252)
  store i64 %1253, i64* %w279.addr, align 8
  %1254 = load i64, i64* %w279.addr, align 8
  %1255 = trunc i64 %1254 to i32
  store i32 %1255, i32* %x279.addr, align 4
  %1256 = load i64, i64* %w279.addr, align 8
  %1257 = lshr i64 %1256, 32
  %1258 = trunc i64 %1257 to i32
  store i32 %1258, i32* %x280.addr, align 4
  %1259 = load i32, i32* %x3.addr, align 4
  %1260 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1261 = load i8*, i8** %1260, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1262 = bitcast i8* %1261 to i32*
  %1263 = getelementptr inbounds i32, i32* %1262, i64 4
  %1264 = load i32, i32* %1263, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1265 = call i64 @p256FiatMulxU32(i32 %1259, i32 %1264)
  store i64 %1265, i64* %w281.addr, align 8
  %1266 = load i64, i64* %w281.addr, align 8
  %1267 = trunc i64 %1266 to i32
  store i32 %1267, i32* %x281.addr, align 4
  %1268 = load i64, i64* %w281.addr, align 8
  %1269 = lshr i64 %1268, 32
  %1270 = trunc i64 %1269 to i32
  store i32 %1270, i32* %x282.addr, align 4
  %1271 = load i32, i32* %x3.addr, align 4
  %1272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1273 = load i8*, i8** %1272, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1274 = bitcast i8* %1273 to i32*
  %1275 = getelementptr inbounds i32, i32* %1274, i64 3
  %1276 = load i32, i32* %1275, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1277 = call i64 @p256FiatMulxU32(i32 %1271, i32 %1276)
  store i64 %1277, i64* %w283.addr, align 8
  %1278 = load i64, i64* %w283.addr, align 8
  %1279 = trunc i64 %1278 to i32
  store i32 %1279, i32* %x283.addr, align 4
  %1280 = load i64, i64* %w283.addr, align 8
  %1281 = lshr i64 %1280, 32
  %1282 = trunc i64 %1281 to i32
  store i32 %1282, i32* %x284.addr, align 4
  %1283 = load i32, i32* %x3.addr, align 4
  %1284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1285 = load i8*, i8** %1284, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1286 = bitcast i8* %1285 to i32*
  %1287 = getelementptr inbounds i32, i32* %1286, i64 2
  %1288 = load i32, i32* %1287, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1289 = call i64 @p256FiatMulxU32(i32 %1283, i32 %1288)
  store i64 %1289, i64* %w285.addr, align 8
  %1290 = load i64, i64* %w285.addr, align 8
  %1291 = trunc i64 %1290 to i32
  store i32 %1291, i32* %x285.addr, align 4
  %1292 = load i64, i64* %w285.addr, align 8
  %1293 = lshr i64 %1292, 32
  %1294 = trunc i64 %1293 to i32
  store i32 %1294, i32* %x286.addr, align 4
  %1295 = load i32, i32* %x3.addr, align 4
  %1296 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1297 = load i8*, i8** %1296, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1298 = bitcast i8* %1297 to i32*
  %1299 = getelementptr inbounds i32, i32* %1298, i64 1
  %1300 = load i32, i32* %1299, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1301 = call i64 @p256FiatMulxU32(i32 %1295, i32 %1300)
  store i64 %1301, i64* %w287.addr, align 8
  %1302 = load i64, i64* %w287.addr, align 8
  %1303 = trunc i64 %1302 to i32
  store i32 %1303, i32* %x287.addr, align 4
  %1304 = load i64, i64* %w287.addr, align 8
  %1305 = lshr i64 %1304, 32
  %1306 = trunc i64 %1305 to i32
  store i32 %1306, i32* %x288.addr, align 4
  %1307 = load i32, i32* %x3.addr, align 4
  %1308 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1309 = load i8*, i8** %1308, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1310 = bitcast i8* %1309 to i32*
  %1311 = getelementptr inbounds i32, i32* %1310, i64 0
  %1312 = load i32, i32* %1311, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1313 = call i64 @p256FiatMulxU32(i32 %1307, i32 %1312)
  store i64 %1313, i64* %w289.addr, align 8
  %1314 = load i64, i64* %w289.addr, align 8
  %1315 = trunc i64 %1314 to i32
  store i32 %1315, i32* %x289.addr, align 4
  %1316 = load i64, i64* %w289.addr, align 8
  %1317 = lshr i64 %1316, 32
  %1318 = trunc i64 %1317 to i32
  store i32 %1318, i32* %x290.addr, align 4
  %1319 = load i32, i32* %x290.addr, align 4
  %1320 = load i32, i32* %x287.addr, align 4
  %1321 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1319, i32 %1320)
  store i64 %1321, i64* %w291.addr, align 8
  %1322 = load i64, i64* %w291.addr, align 8
  %1323 = trunc i64 %1322 to i32
  store i32 %1323, i32* %x291.addr, align 4
  %1324 = load i64, i64* %w291.addr, align 8
  %1325 = lshr i64 %1324, 32
  %1326 = trunc i64 %1325 to i32
  store i32 %1326, i32* %x292.addr, align 4
  %1327 = load i32, i32* %x292.addr, align 4
  %1328 = load i32, i32* %x288.addr, align 4
  %1329 = load i32, i32* %x285.addr, align 4
  %1330 = call i64 @p256FiatAddcarryxU32(i32 %1327, i32 %1328, i32 %1329)
  store i64 %1330, i64* %w293.addr, align 8
  %1331 = load i64, i64* %w293.addr, align 8
  %1332 = trunc i64 %1331 to i32
  store i32 %1332, i32* %x293.addr, align 4
  %1333 = load i64, i64* %w293.addr, align 8
  %1334 = lshr i64 %1333, 32
  %1335 = trunc i64 %1334 to i32
  store i32 %1335, i32* %x294.addr, align 4
  %1336 = load i32, i32* %x294.addr, align 4
  %1337 = load i32, i32* %x286.addr, align 4
  %1338 = load i32, i32* %x283.addr, align 4
  %1339 = call i64 @p256FiatAddcarryxU32(i32 %1336, i32 %1337, i32 %1338)
  store i64 %1339, i64* %w295.addr, align 8
  %1340 = load i64, i64* %w295.addr, align 8
  %1341 = trunc i64 %1340 to i32
  store i32 %1341, i32* %x295.addr, align 4
  %1342 = load i64, i64* %w295.addr, align 8
  %1343 = lshr i64 %1342, 32
  %1344 = trunc i64 %1343 to i32
  store i32 %1344, i32* %x296.addr, align 4
  %1345 = load i32, i32* %x296.addr, align 4
  %1346 = load i32, i32* %x284.addr, align 4
  %1347 = load i32, i32* %x281.addr, align 4
  %1348 = call i64 @p256FiatAddcarryxU32(i32 %1345, i32 %1346, i32 %1347)
  store i64 %1348, i64* %w297.addr, align 8
  %1349 = load i64, i64* %w297.addr, align 8
  %1350 = trunc i64 %1349 to i32
  store i32 %1350, i32* %x297.addr, align 4
  %1351 = load i64, i64* %w297.addr, align 8
  %1352 = lshr i64 %1351, 32
  %1353 = trunc i64 %1352 to i32
  store i32 %1353, i32* %x298.addr, align 4
  %1354 = load i32, i32* %x298.addr, align 4
  %1355 = load i32, i32* %x282.addr, align 4
  %1356 = load i32, i32* %x279.addr, align 4
  %1357 = call i64 @p256FiatAddcarryxU32(i32 %1354, i32 %1355, i32 %1356)
  store i64 %1357, i64* %w299.addr, align 8
  %1358 = load i64, i64* %w299.addr, align 8
  %1359 = trunc i64 %1358 to i32
  store i32 %1359, i32* %x299.addr, align 4
  %1360 = load i64, i64* %w299.addr, align 8
  %1361 = lshr i64 %1360, 32
  %1362 = trunc i64 %1361 to i32
  store i32 %1362, i32* %x300.addr, align 4
  %1363 = load i32, i32* %x300.addr, align 4
  %1364 = load i32, i32* %x280.addr, align 4
  %1365 = load i32, i32* %x277.addr, align 4
  %1366 = call i64 @p256FiatAddcarryxU32(i32 %1363, i32 %1364, i32 %1365)
  store i64 %1366, i64* %w301.addr, align 8
  %1367 = load i64, i64* %w301.addr, align 8
  %1368 = trunc i64 %1367 to i32
  store i32 %1368, i32* %x301.addr, align 4
  %1369 = load i64, i64* %w301.addr, align 8
  %1370 = lshr i64 %1369, 32
  %1371 = trunc i64 %1370 to i32
  store i32 %1371, i32* %x302.addr, align 4
  %1372 = load i32, i32* %x302.addr, align 4
  %1373 = load i32, i32* %x278.addr, align 4
  %1374 = load i32, i32* %x275.addr, align 4
  %1375 = call i64 @p256FiatAddcarryxU32(i32 %1372, i32 %1373, i32 %1374)
  store i64 %1375, i64* %w303.addr, align 8
  %1376 = load i64, i64* %w303.addr, align 8
  %1377 = trunc i64 %1376 to i32
  store i32 %1377, i32* %x303.addr, align 4
  %1378 = load i64, i64* %w303.addr, align 8
  %1379 = lshr i64 %1378, 32
  %1380 = trunc i64 %1379 to i32
  store i32 %1380, i32* %x304.addr, align 4
  %1381 = load i32, i32* %x304.addr, align 4
  %1382 = load i32, i32* %x276.addr, align 4
  %1383 = add i32 %1381, %1382
  store i32 %1383, i32* %x305.addr, align 4
  %1384 = load i32, i32* %x258.addr, align 4
  %1385 = load i32, i32* %x289.addr, align 4
  %1386 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1384, i32 %1385)
  store i64 %1386, i64* %w306.addr, align 8
  %1387 = load i64, i64* %w306.addr, align 8
  %1388 = trunc i64 %1387 to i32
  store i32 %1388, i32* %x306.addr, align 4
  %1389 = load i64, i64* %w306.addr, align 8
  %1390 = lshr i64 %1389, 32
  %1391 = trunc i64 %1390 to i32
  store i32 %1391, i32* %x307.addr, align 4
  %1392 = load i32, i32* %x307.addr, align 4
  %1393 = load i32, i32* %x260.addr, align 4
  %1394 = load i32, i32* %x291.addr, align 4
  %1395 = call i64 @p256FiatAddcarryxU32(i32 %1392, i32 %1393, i32 %1394)
  store i64 %1395, i64* %w308.addr, align 8
  %1396 = load i64, i64* %w308.addr, align 8
  %1397 = trunc i64 %1396 to i32
  store i32 %1397, i32* %x308.addr, align 4
  %1398 = load i64, i64* %w308.addr, align 8
  %1399 = lshr i64 %1398, 32
  %1400 = trunc i64 %1399 to i32
  store i32 %1400, i32* %x309.addr, align 4
  %1401 = load i32, i32* %x309.addr, align 4
  %1402 = load i32, i32* %x262.addr, align 4
  %1403 = load i32, i32* %x293.addr, align 4
  %1404 = call i64 @p256FiatAddcarryxU32(i32 %1401, i32 %1402, i32 %1403)
  store i64 %1404, i64* %w310.addr, align 8
  %1405 = load i64, i64* %w310.addr, align 8
  %1406 = trunc i64 %1405 to i32
  store i32 %1406, i32* %x310.addr, align 4
  %1407 = load i64, i64* %w310.addr, align 8
  %1408 = lshr i64 %1407, 32
  %1409 = trunc i64 %1408 to i32
  store i32 %1409, i32* %x311.addr, align 4
  %1410 = load i32, i32* %x311.addr, align 4
  %1411 = load i32, i32* %x264.addr, align 4
  %1412 = load i32, i32* %x295.addr, align 4
  %1413 = call i64 @p256FiatAddcarryxU32(i32 %1410, i32 %1411, i32 %1412)
  store i64 %1413, i64* %w312.addr, align 8
  %1414 = load i64, i64* %w312.addr, align 8
  %1415 = trunc i64 %1414 to i32
  store i32 %1415, i32* %x312.addr, align 4
  %1416 = load i64, i64* %w312.addr, align 8
  %1417 = lshr i64 %1416, 32
  %1418 = trunc i64 %1417 to i32
  store i32 %1418, i32* %x313.addr, align 4
  %1419 = load i32, i32* %x313.addr, align 4
  %1420 = load i32, i32* %x266.addr, align 4
  %1421 = load i32, i32* %x297.addr, align 4
  %1422 = call i64 @p256FiatAddcarryxU32(i32 %1419, i32 %1420, i32 %1421)
  store i64 %1422, i64* %w314.addr, align 8
  %1423 = load i64, i64* %w314.addr, align 8
  %1424 = trunc i64 %1423 to i32
  store i32 %1424, i32* %x314.addr, align 4
  %1425 = load i64, i64* %w314.addr, align 8
  %1426 = lshr i64 %1425, 32
  %1427 = trunc i64 %1426 to i32
  store i32 %1427, i32* %x315.addr, align 4
  %1428 = load i32, i32* %x315.addr, align 4
  %1429 = load i32, i32* %x268.addr, align 4
  %1430 = load i32, i32* %x299.addr, align 4
  %1431 = call i64 @p256FiatAddcarryxU32(i32 %1428, i32 %1429, i32 %1430)
  store i64 %1431, i64* %w316.addr, align 8
  %1432 = load i64, i64* %w316.addr, align 8
  %1433 = trunc i64 %1432 to i32
  store i32 %1433, i32* %x316.addr, align 4
  %1434 = load i64, i64* %w316.addr, align 8
  %1435 = lshr i64 %1434, 32
  %1436 = trunc i64 %1435 to i32
  store i32 %1436, i32* %x317.addr, align 4
  %1437 = load i32, i32* %x317.addr, align 4
  %1438 = load i32, i32* %x270.addr, align 4
  %1439 = load i32, i32* %x301.addr, align 4
  %1440 = call i64 @p256FiatAddcarryxU32(i32 %1437, i32 %1438, i32 %1439)
  store i64 %1440, i64* %w318.addr, align 8
  %1441 = load i64, i64* %w318.addr, align 8
  %1442 = trunc i64 %1441 to i32
  store i32 %1442, i32* %x318.addr, align 4
  %1443 = load i64, i64* %w318.addr, align 8
  %1444 = lshr i64 %1443, 32
  %1445 = trunc i64 %1444 to i32
  store i32 %1445, i32* %x319.addr, align 4
  %1446 = load i32, i32* %x319.addr, align 4
  %1447 = load i32, i32* %x272.addr, align 4
  %1448 = load i32, i32* %x303.addr, align 4
  %1449 = call i64 @p256FiatAddcarryxU32(i32 %1446, i32 %1447, i32 %1448)
  store i64 %1449, i64* %w320.addr, align 8
  %1450 = load i64, i64* %w320.addr, align 8
  %1451 = trunc i64 %1450 to i32
  store i32 %1451, i32* %x320.addr, align 4
  %1452 = load i64, i64* %w320.addr, align 8
  %1453 = lshr i64 %1452, 32
  %1454 = trunc i64 %1453 to i32
  store i32 %1454, i32* %x321.addr, align 4
  %1455 = load i32, i32* %x321.addr, align 4
  %1456 = load i32, i32* %x274.addr, align 4
  %1457 = load i32, i32* %x305.addr, align 4
  %1458 = call i64 @p256FiatAddcarryxU32(i32 %1455, i32 %1456, i32 %1457)
  store i64 %1458, i64* %w322.addr, align 8
  %1459 = load i64, i64* %w322.addr, align 8
  %1460 = trunc i64 %1459 to i32
  store i32 %1460, i32* %x322.addr, align 4
  %1461 = load i64, i64* %w322.addr, align 8
  %1462 = lshr i64 %1461, 32
  %1463 = trunc i64 %1462 to i32
  store i32 %1463, i32* %x323.addr, align 4
  %1464 = load i32, i32* %x306.addr, align 4
  %1465 = call i64 @p256FiatMulxU32(i32 %1464, i32 3993025615)
  store i64 %1465, i64* %w324.addr, align 8
  %1466 = load i64, i64* %w324.addr, align 8
  %1467 = trunc i64 %1466 to i32
  store i32 %1467, i32* %x324.addr, align 4
  %1468 = load i32, i32* %x324.addr, align 4
  %1469 = call i64 @p256FiatMulxU32(i32 %1468, i32 4294967295)
  store i64 %1469, i64* %w326.addr, align 8
  %1470 = load i64, i64* %w326.addr, align 8
  %1471 = trunc i64 %1470 to i32
  store i32 %1471, i32* %x326.addr, align 4
  %1472 = load i64, i64* %w326.addr, align 8
  %1473 = lshr i64 %1472, 32
  %1474 = trunc i64 %1473 to i32
  store i32 %1474, i32* %x327.addr, align 4
  %1475 = load i32, i32* %x324.addr, align 4
  %1476 = call i64 @p256FiatMulxU32(i32 %1475, i32 4294967295)
  store i64 %1476, i64* %w328.addr, align 8
  %1477 = load i64, i64* %w328.addr, align 8
  %1478 = trunc i64 %1477 to i32
  store i32 %1478, i32* %x328.addr, align 4
  %1479 = load i64, i64* %w328.addr, align 8
  %1480 = lshr i64 %1479, 32
  %1481 = trunc i64 %1480 to i32
  store i32 %1481, i32* %x329.addr, align 4
  %1482 = load i32, i32* %x324.addr, align 4
  %1483 = call i64 @p256FiatMulxU32(i32 %1482, i32 4294967295)
  store i64 %1483, i64* %w330.addr, align 8
  %1484 = load i64, i64* %w330.addr, align 8
  %1485 = trunc i64 %1484 to i32
  store i32 %1485, i32* %x330.addr, align 4
  %1486 = load i64, i64* %w330.addr, align 8
  %1487 = lshr i64 %1486, 32
  %1488 = trunc i64 %1487 to i32
  store i32 %1488, i32* %x331.addr, align 4
  %1489 = load i32, i32* %x324.addr, align 4
  %1490 = call i64 @p256FiatMulxU32(i32 %1489, i32 3169254061)
  store i64 %1490, i64* %w332.addr, align 8
  %1491 = load i64, i64* %w332.addr, align 8
  %1492 = trunc i64 %1491 to i32
  store i32 %1492, i32* %x332.addr, align 4
  %1493 = load i64, i64* %w332.addr, align 8
  %1494 = lshr i64 %1493, 32
  %1495 = trunc i64 %1494 to i32
  store i32 %1495, i32* %x333.addr, align 4
  %1496 = load i32, i32* %x324.addr, align 4
  %1497 = call i64 @p256FiatMulxU32(i32 %1496, i32 2803342980)
  store i64 %1497, i64* %w334.addr, align 8
  %1498 = load i64, i64* %w334.addr, align 8
  %1499 = trunc i64 %1498 to i32
  store i32 %1499, i32* %x334.addr, align 4
  %1500 = load i64, i64* %w334.addr, align 8
  %1501 = lshr i64 %1500, 32
  %1502 = trunc i64 %1501 to i32
  store i32 %1502, i32* %x335.addr, align 4
  %1503 = load i32, i32* %x324.addr, align 4
  %1504 = call i64 @p256FiatMulxU32(i32 %1503, i32 4089039554)
  store i64 %1504, i64* %w336.addr, align 8
  %1505 = load i64, i64* %w336.addr, align 8
  %1506 = trunc i64 %1505 to i32
  store i32 %1506, i32* %x336.addr, align 4
  %1507 = load i64, i64* %w336.addr, align 8
  %1508 = lshr i64 %1507, 32
  %1509 = trunc i64 %1508 to i32
  store i32 %1509, i32* %x337.addr, align 4
  %1510 = load i32, i32* %x324.addr, align 4
  %1511 = call i64 @p256FiatMulxU32(i32 %1510, i32 4234356049)
  store i64 %1511, i64* %w338.addr, align 8
  %1512 = load i64, i64* %w338.addr, align 8
  %1513 = trunc i64 %1512 to i32
  store i32 %1513, i32* %x338.addr, align 4
  %1514 = load i64, i64* %w338.addr, align 8
  %1515 = lshr i64 %1514, 32
  %1516 = trunc i64 %1515 to i32
  store i32 %1516, i32* %x339.addr, align 4
  %1517 = load i32, i32* %x339.addr, align 4
  %1518 = load i32, i32* %x336.addr, align 4
  %1519 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1517, i32 %1518)
  store i64 %1519, i64* %w340.addr, align 8
  %1520 = load i64, i64* %w340.addr, align 8
  %1521 = trunc i64 %1520 to i32
  store i32 %1521, i32* %x340.addr, align 4
  %1522 = load i64, i64* %w340.addr, align 8
  %1523 = lshr i64 %1522, 32
  %1524 = trunc i64 %1523 to i32
  store i32 %1524, i32* %x341.addr, align 4
  %1525 = load i32, i32* %x341.addr, align 4
  %1526 = load i32, i32* %x337.addr, align 4
  %1527 = load i32, i32* %x334.addr, align 4
  %1528 = call i64 @p256FiatAddcarryxU32(i32 %1525, i32 %1526, i32 %1527)
  store i64 %1528, i64* %w342.addr, align 8
  %1529 = load i64, i64* %w342.addr, align 8
  %1530 = trunc i64 %1529 to i32
  store i32 %1530, i32* %x342.addr, align 4
  %1531 = load i64, i64* %w342.addr, align 8
  %1532 = lshr i64 %1531, 32
  %1533 = trunc i64 %1532 to i32
  store i32 %1533, i32* %x343.addr, align 4
  %1534 = load i32, i32* %x343.addr, align 4
  %1535 = load i32, i32* %x335.addr, align 4
  %1536 = load i32, i32* %x332.addr, align 4
  %1537 = call i64 @p256FiatAddcarryxU32(i32 %1534, i32 %1535, i32 %1536)
  store i64 %1537, i64* %w344.addr, align 8
  %1538 = load i64, i64* %w344.addr, align 8
  %1539 = trunc i64 %1538 to i32
  store i32 %1539, i32* %x344.addr, align 4
  %1540 = load i64, i64* %w344.addr, align 8
  %1541 = lshr i64 %1540, 32
  %1542 = trunc i64 %1541 to i32
  store i32 %1542, i32* %x345.addr, align 4
  %1543 = load i32, i32* %x345.addr, align 4
  %1544 = load i32, i32* %x333.addr, align 4
  %1545 = load i32, i32* %x330.addr, align 4
  %1546 = call i64 @p256FiatAddcarryxU32(i32 %1543, i32 %1544, i32 %1545)
  store i64 %1546, i64* %w346.addr, align 8
  %1547 = load i64, i64* %w346.addr, align 8
  %1548 = trunc i64 %1547 to i32
  store i32 %1548, i32* %x346.addr, align 4
  %1549 = load i64, i64* %w346.addr, align 8
  %1550 = lshr i64 %1549, 32
  %1551 = trunc i64 %1550 to i32
  store i32 %1551, i32* %x347.addr, align 4
  %1552 = load i32, i32* %x347.addr, align 4
  %1553 = load i32, i32* %x331.addr, align 4
  %1554 = load i32, i32* %x328.addr, align 4
  %1555 = call i64 @p256FiatAddcarryxU32(i32 %1552, i32 %1553, i32 %1554)
  store i64 %1555, i64* %w348.addr, align 8
  %1556 = load i64, i64* %w348.addr, align 8
  %1557 = trunc i64 %1556 to i32
  store i32 %1557, i32* %x348.addr, align 4
  %1558 = load i64, i64* %w348.addr, align 8
  %1559 = lshr i64 %1558, 32
  %1560 = trunc i64 %1559 to i32
  store i32 %1560, i32* %x349.addr, align 4
  %1561 = load i32, i32* %x349.addr, align 4
  %1562 = load i32, i32* %x329.addr, align 4
  %1563 = add i32 %1561, %1562
  store i32 %1563, i32* %x350.addr, align 4
  %1564 = load i32, i32* %x306.addr, align 4
  %1565 = load i32, i32* %x338.addr, align 4
  %1566 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1564, i32 %1565)
  store i64 %1566, i64* %w351.addr, align 8
  %1567 = load i64, i64* %w351.addr, align 8
  %1568 = lshr i64 %1567, 32
  %1569 = trunc i64 %1568 to i32
  store i32 %1569, i32* %x352.addr, align 4
  %1570 = load i32, i32* %x352.addr, align 4
  %1571 = load i32, i32* %x308.addr, align 4
  %1572 = load i32, i32* %x340.addr, align 4
  %1573 = call i64 @p256FiatAddcarryxU32(i32 %1570, i32 %1571, i32 %1572)
  store i64 %1573, i64* %w353.addr, align 8
  %1574 = load i64, i64* %w353.addr, align 8
  %1575 = trunc i64 %1574 to i32
  store i32 %1575, i32* %x353.addr, align 4
  %1576 = load i64, i64* %w353.addr, align 8
  %1577 = lshr i64 %1576, 32
  %1578 = trunc i64 %1577 to i32
  store i32 %1578, i32* %x354.addr, align 4
  %1579 = load i32, i32* %x354.addr, align 4
  %1580 = load i32, i32* %x310.addr, align 4
  %1581 = load i32, i32* %x342.addr, align 4
  %1582 = call i64 @p256FiatAddcarryxU32(i32 %1579, i32 %1580, i32 %1581)
  store i64 %1582, i64* %w355.addr, align 8
  %1583 = load i64, i64* %w355.addr, align 8
  %1584 = trunc i64 %1583 to i32
  store i32 %1584, i32* %x355.addr, align 4
  %1585 = load i64, i64* %w355.addr, align 8
  %1586 = lshr i64 %1585, 32
  %1587 = trunc i64 %1586 to i32
  store i32 %1587, i32* %x356.addr, align 4
  %1588 = load i32, i32* %x356.addr, align 4
  %1589 = load i32, i32* %x312.addr, align 4
  %1590 = load i32, i32* %x344.addr, align 4
  %1591 = call i64 @p256FiatAddcarryxU32(i32 %1588, i32 %1589, i32 %1590)
  store i64 %1591, i64* %w357.addr, align 8
  %1592 = load i64, i64* %w357.addr, align 8
  %1593 = trunc i64 %1592 to i32
  store i32 %1593, i32* %x357.addr, align 4
  %1594 = load i64, i64* %w357.addr, align 8
  %1595 = lshr i64 %1594, 32
  %1596 = trunc i64 %1595 to i32
  store i32 %1596, i32* %x358.addr, align 4
  %1597 = load i32, i32* %x358.addr, align 4
  %1598 = load i32, i32* %x314.addr, align 4
  %1599 = load i32, i32* %x346.addr, align 4
  %1600 = call i64 @p256FiatAddcarryxU32(i32 %1597, i32 %1598, i32 %1599)
  store i64 %1600, i64* %w359.addr, align 8
  %1601 = load i64, i64* %w359.addr, align 8
  %1602 = trunc i64 %1601 to i32
  store i32 %1602, i32* %x359.addr, align 4
  %1603 = load i64, i64* %w359.addr, align 8
  %1604 = lshr i64 %1603, 32
  %1605 = trunc i64 %1604 to i32
  store i32 %1605, i32* %x360.addr, align 4
  %1606 = load i32, i32* %x360.addr, align 4
  %1607 = load i32, i32* %x316.addr, align 4
  %1608 = load i32, i32* %x348.addr, align 4
  %1609 = call i64 @p256FiatAddcarryxU32(i32 %1606, i32 %1607, i32 %1608)
  store i64 %1609, i64* %w361.addr, align 8
  %1610 = load i64, i64* %w361.addr, align 8
  %1611 = trunc i64 %1610 to i32
  store i32 %1611, i32* %x361.addr, align 4
  %1612 = load i64, i64* %w361.addr, align 8
  %1613 = lshr i64 %1612, 32
  %1614 = trunc i64 %1613 to i32
  store i32 %1614, i32* %x362.addr, align 4
  %1615 = load i32, i32* %x362.addr, align 4
  %1616 = load i32, i32* %x318.addr, align 4
  %1617 = load i32, i32* %x350.addr, align 4
  %1618 = call i64 @p256FiatAddcarryxU32(i32 %1615, i32 %1616, i32 %1617)
  store i64 %1618, i64* %w363.addr, align 8
  %1619 = load i64, i64* %w363.addr, align 8
  %1620 = trunc i64 %1619 to i32
  store i32 %1620, i32* %x363.addr, align 4
  %1621 = load i64, i64* %w363.addr, align 8
  %1622 = lshr i64 %1621, 32
  %1623 = trunc i64 %1622 to i32
  store i32 %1623, i32* %x364.addr, align 4
  %1624 = load i32, i32* %x364.addr, align 4
  %1625 = load i32, i32* %x320.addr, align 4
  %1626 = load i32, i32* %x326.addr, align 4
  %1627 = call i64 @p256FiatAddcarryxU32(i32 %1624, i32 %1625, i32 %1626)
  store i64 %1627, i64* %w365.addr, align 8
  %1628 = load i64, i64* %w365.addr, align 8
  %1629 = trunc i64 %1628 to i32
  store i32 %1629, i32* %x365.addr, align 4
  %1630 = load i64, i64* %w365.addr, align 8
  %1631 = lshr i64 %1630, 32
  %1632 = trunc i64 %1631 to i32
  store i32 %1632, i32* %x366.addr, align 4
  %1633 = load i32, i32* %x366.addr, align 4
  %1634 = load i32, i32* %x322.addr, align 4
  %1635 = load i32, i32* %x327.addr, align 4
  %1636 = call i64 @p256FiatAddcarryxU32(i32 %1633, i32 %1634, i32 %1635)
  store i64 %1636, i64* %w367.addr, align 8
  %1637 = load i64, i64* %w367.addr, align 8
  %1638 = trunc i64 %1637 to i32
  store i32 %1638, i32* %x367.addr, align 4
  %1639 = load i64, i64* %w367.addr, align 8
  %1640 = lshr i64 %1639, 32
  %1641 = trunc i64 %1640 to i32
  store i32 %1641, i32* %x368.addr, align 4
  %1642 = load i32, i32* %x368.addr, align 4
  %1643 = load i32, i32* %x323.addr, align 4
  %1644 = add i32 %1642, %1643
  store i32 %1644, i32* %x369.addr, align 4
  %1645 = load i32, i32* %x4.addr, align 4
  %1646 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1647 = load i8*, i8** %1646, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1648 = bitcast i8* %1647 to i32*
  %1649 = getelementptr inbounds i32, i32* %1648, i64 7
  %1650 = load i32, i32* %1649, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1651 = call i64 @p256FiatMulxU32(i32 %1645, i32 %1650)
  store i64 %1651, i64* %w370.addr, align 8
  %1652 = load i64, i64* %w370.addr, align 8
  %1653 = trunc i64 %1652 to i32
  store i32 %1653, i32* %x370.addr, align 4
  %1654 = load i64, i64* %w370.addr, align 8
  %1655 = lshr i64 %1654, 32
  %1656 = trunc i64 %1655 to i32
  store i32 %1656, i32* %x371.addr, align 4
  %1657 = load i32, i32* %x4.addr, align 4
  %1658 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1659 = load i8*, i8** %1658, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1660 = bitcast i8* %1659 to i32*
  %1661 = getelementptr inbounds i32, i32* %1660, i64 6
  %1662 = load i32, i32* %1661, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1663 = call i64 @p256FiatMulxU32(i32 %1657, i32 %1662)
  store i64 %1663, i64* %w372.addr, align 8
  %1664 = load i64, i64* %w372.addr, align 8
  %1665 = trunc i64 %1664 to i32
  store i32 %1665, i32* %x372.addr, align 4
  %1666 = load i64, i64* %w372.addr, align 8
  %1667 = lshr i64 %1666, 32
  %1668 = trunc i64 %1667 to i32
  store i32 %1668, i32* %x373.addr, align 4
  %1669 = load i32, i32* %x4.addr, align 4
  %1670 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1671 = load i8*, i8** %1670, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1672 = bitcast i8* %1671 to i32*
  %1673 = getelementptr inbounds i32, i32* %1672, i64 5
  %1674 = load i32, i32* %1673, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1675 = call i64 @p256FiatMulxU32(i32 %1669, i32 %1674)
  store i64 %1675, i64* %w374.addr, align 8
  %1676 = load i64, i64* %w374.addr, align 8
  %1677 = trunc i64 %1676 to i32
  store i32 %1677, i32* %x374.addr, align 4
  %1678 = load i64, i64* %w374.addr, align 8
  %1679 = lshr i64 %1678, 32
  %1680 = trunc i64 %1679 to i32
  store i32 %1680, i32* %x375.addr, align 4
  %1681 = load i32, i32* %x4.addr, align 4
  %1682 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1683 = load i8*, i8** %1682, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1684 = bitcast i8* %1683 to i32*
  %1685 = getelementptr inbounds i32, i32* %1684, i64 4
  %1686 = load i32, i32* %1685, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1687 = call i64 @p256FiatMulxU32(i32 %1681, i32 %1686)
  store i64 %1687, i64* %w376.addr, align 8
  %1688 = load i64, i64* %w376.addr, align 8
  %1689 = trunc i64 %1688 to i32
  store i32 %1689, i32* %x376.addr, align 4
  %1690 = load i64, i64* %w376.addr, align 8
  %1691 = lshr i64 %1690, 32
  %1692 = trunc i64 %1691 to i32
  store i32 %1692, i32* %x377.addr, align 4
  %1693 = load i32, i32* %x4.addr, align 4
  %1694 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1695 = load i8*, i8** %1694, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1696 = bitcast i8* %1695 to i32*
  %1697 = getelementptr inbounds i32, i32* %1696, i64 3
  %1698 = load i32, i32* %1697, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1699 = call i64 @p256FiatMulxU32(i32 %1693, i32 %1698)
  store i64 %1699, i64* %w378.addr, align 8
  %1700 = load i64, i64* %w378.addr, align 8
  %1701 = trunc i64 %1700 to i32
  store i32 %1701, i32* %x378.addr, align 4
  %1702 = load i64, i64* %w378.addr, align 8
  %1703 = lshr i64 %1702, 32
  %1704 = trunc i64 %1703 to i32
  store i32 %1704, i32* %x379.addr, align 4
  %1705 = load i32, i32* %x4.addr, align 4
  %1706 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1707 = load i8*, i8** %1706, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1708 = bitcast i8* %1707 to i32*
  %1709 = getelementptr inbounds i32, i32* %1708, i64 2
  %1710 = load i32, i32* %1709, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1711 = call i64 @p256FiatMulxU32(i32 %1705, i32 %1710)
  store i64 %1711, i64* %w380.addr, align 8
  %1712 = load i64, i64* %w380.addr, align 8
  %1713 = trunc i64 %1712 to i32
  store i32 %1713, i32* %x380.addr, align 4
  %1714 = load i64, i64* %w380.addr, align 8
  %1715 = lshr i64 %1714, 32
  %1716 = trunc i64 %1715 to i32
  store i32 %1716, i32* %x381.addr, align 4
  %1717 = load i32, i32* %x4.addr, align 4
  %1718 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1719 = load i8*, i8** %1718, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1720 = bitcast i8* %1719 to i32*
  %1721 = getelementptr inbounds i32, i32* %1720, i64 1
  %1722 = load i32, i32* %1721, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1723 = call i64 @p256FiatMulxU32(i32 %1717, i32 %1722)
  store i64 %1723, i64* %w382.addr, align 8
  %1724 = load i64, i64* %w382.addr, align 8
  %1725 = trunc i64 %1724 to i32
  store i32 %1725, i32* %x382.addr, align 4
  %1726 = load i64, i64* %w382.addr, align 8
  %1727 = lshr i64 %1726, 32
  %1728 = trunc i64 %1727 to i32
  store i32 %1728, i32* %x383.addr, align 4
  %1729 = load i32, i32* %x4.addr, align 4
  %1730 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %1731 = load i8*, i8** %1730, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1732 = bitcast i8* %1731 to i32*
  %1733 = getelementptr inbounds i32, i32* %1732, i64 0
  %1734 = load i32, i32* %1733, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %1735 = call i64 @p256FiatMulxU32(i32 %1729, i32 %1734)
  store i64 %1735, i64* %w384.addr, align 8
  %1736 = load i64, i64* %w384.addr, align 8
  %1737 = trunc i64 %1736 to i32
  store i32 %1737, i32* %x384.addr, align 4
  %1738 = load i64, i64* %w384.addr, align 8
  %1739 = lshr i64 %1738, 32
  %1740 = trunc i64 %1739 to i32
  store i32 %1740, i32* %x385.addr, align 4
  %1741 = load i32, i32* %x385.addr, align 4
  %1742 = load i32, i32* %x382.addr, align 4
  %1743 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1741, i32 %1742)
  store i64 %1743, i64* %w386.addr, align 8
  %1744 = load i64, i64* %w386.addr, align 8
  %1745 = trunc i64 %1744 to i32
  store i32 %1745, i32* %x386.addr, align 4
  %1746 = load i64, i64* %w386.addr, align 8
  %1747 = lshr i64 %1746, 32
  %1748 = trunc i64 %1747 to i32
  store i32 %1748, i32* %x387.addr, align 4
  %1749 = load i32, i32* %x387.addr, align 4
  %1750 = load i32, i32* %x383.addr, align 4
  %1751 = load i32, i32* %x380.addr, align 4
  %1752 = call i64 @p256FiatAddcarryxU32(i32 %1749, i32 %1750, i32 %1751)
  store i64 %1752, i64* %w388.addr, align 8
  %1753 = load i64, i64* %w388.addr, align 8
  %1754 = trunc i64 %1753 to i32
  store i32 %1754, i32* %x388.addr, align 4
  %1755 = load i64, i64* %w388.addr, align 8
  %1756 = lshr i64 %1755, 32
  %1757 = trunc i64 %1756 to i32
  store i32 %1757, i32* %x389.addr, align 4
  %1758 = load i32, i32* %x389.addr, align 4
  %1759 = load i32, i32* %x381.addr, align 4
  %1760 = load i32, i32* %x378.addr, align 4
  %1761 = call i64 @p256FiatAddcarryxU32(i32 %1758, i32 %1759, i32 %1760)
  store i64 %1761, i64* %w390.addr, align 8
  %1762 = load i64, i64* %w390.addr, align 8
  %1763 = trunc i64 %1762 to i32
  store i32 %1763, i32* %x390.addr, align 4
  %1764 = load i64, i64* %w390.addr, align 8
  %1765 = lshr i64 %1764, 32
  %1766 = trunc i64 %1765 to i32
  store i32 %1766, i32* %x391.addr, align 4
  %1767 = load i32, i32* %x391.addr, align 4
  %1768 = load i32, i32* %x379.addr, align 4
  %1769 = load i32, i32* %x376.addr, align 4
  %1770 = call i64 @p256FiatAddcarryxU32(i32 %1767, i32 %1768, i32 %1769)
  store i64 %1770, i64* %w392.addr, align 8
  %1771 = load i64, i64* %w392.addr, align 8
  %1772 = trunc i64 %1771 to i32
  store i32 %1772, i32* %x392.addr, align 4
  %1773 = load i64, i64* %w392.addr, align 8
  %1774 = lshr i64 %1773, 32
  %1775 = trunc i64 %1774 to i32
  store i32 %1775, i32* %x393.addr, align 4
  %1776 = load i32, i32* %x393.addr, align 4
  %1777 = load i32, i32* %x377.addr, align 4
  %1778 = load i32, i32* %x374.addr, align 4
  %1779 = call i64 @p256FiatAddcarryxU32(i32 %1776, i32 %1777, i32 %1778)
  store i64 %1779, i64* %w394.addr, align 8
  %1780 = load i64, i64* %w394.addr, align 8
  %1781 = trunc i64 %1780 to i32
  store i32 %1781, i32* %x394.addr, align 4
  %1782 = load i64, i64* %w394.addr, align 8
  %1783 = lshr i64 %1782, 32
  %1784 = trunc i64 %1783 to i32
  store i32 %1784, i32* %x395.addr, align 4
  %1785 = load i32, i32* %x395.addr, align 4
  %1786 = load i32, i32* %x375.addr, align 4
  %1787 = load i32, i32* %x372.addr, align 4
  %1788 = call i64 @p256FiatAddcarryxU32(i32 %1785, i32 %1786, i32 %1787)
  store i64 %1788, i64* %w396.addr, align 8
  %1789 = load i64, i64* %w396.addr, align 8
  %1790 = trunc i64 %1789 to i32
  store i32 %1790, i32* %x396.addr, align 4
  %1791 = load i64, i64* %w396.addr, align 8
  %1792 = lshr i64 %1791, 32
  %1793 = trunc i64 %1792 to i32
  store i32 %1793, i32* %x397.addr, align 4
  %1794 = load i32, i32* %x397.addr, align 4
  %1795 = load i32, i32* %x373.addr, align 4
  %1796 = load i32, i32* %x370.addr, align 4
  %1797 = call i64 @p256FiatAddcarryxU32(i32 %1794, i32 %1795, i32 %1796)
  store i64 %1797, i64* %w398.addr, align 8
  %1798 = load i64, i64* %w398.addr, align 8
  %1799 = trunc i64 %1798 to i32
  store i32 %1799, i32* %x398.addr, align 4
  %1800 = load i64, i64* %w398.addr, align 8
  %1801 = lshr i64 %1800, 32
  %1802 = trunc i64 %1801 to i32
  store i32 %1802, i32* %x399.addr, align 4
  %1803 = load i32, i32* %x399.addr, align 4
  %1804 = load i32, i32* %x371.addr, align 4
  %1805 = add i32 %1803, %1804
  store i32 %1805, i32* %x400.addr, align 4
  %1806 = load i32, i32* %x353.addr, align 4
  %1807 = load i32, i32* %x384.addr, align 4
  %1808 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1806, i32 %1807)
  store i64 %1808, i64* %w401.addr, align 8
  %1809 = load i64, i64* %w401.addr, align 8
  %1810 = trunc i64 %1809 to i32
  store i32 %1810, i32* %x401.addr, align 4
  %1811 = load i64, i64* %w401.addr, align 8
  %1812 = lshr i64 %1811, 32
  %1813 = trunc i64 %1812 to i32
  store i32 %1813, i32* %x402.addr, align 4
  %1814 = load i32, i32* %x402.addr, align 4
  %1815 = load i32, i32* %x355.addr, align 4
  %1816 = load i32, i32* %x386.addr, align 4
  %1817 = call i64 @p256FiatAddcarryxU32(i32 %1814, i32 %1815, i32 %1816)
  store i64 %1817, i64* %w403.addr, align 8
  %1818 = load i64, i64* %w403.addr, align 8
  %1819 = trunc i64 %1818 to i32
  store i32 %1819, i32* %x403.addr, align 4
  %1820 = load i64, i64* %w403.addr, align 8
  %1821 = lshr i64 %1820, 32
  %1822 = trunc i64 %1821 to i32
  store i32 %1822, i32* %x404.addr, align 4
  %1823 = load i32, i32* %x404.addr, align 4
  %1824 = load i32, i32* %x357.addr, align 4
  %1825 = load i32, i32* %x388.addr, align 4
  %1826 = call i64 @p256FiatAddcarryxU32(i32 %1823, i32 %1824, i32 %1825)
  store i64 %1826, i64* %w405.addr, align 8
  %1827 = load i64, i64* %w405.addr, align 8
  %1828 = trunc i64 %1827 to i32
  store i32 %1828, i32* %x405.addr, align 4
  %1829 = load i64, i64* %w405.addr, align 8
  %1830 = lshr i64 %1829, 32
  %1831 = trunc i64 %1830 to i32
  store i32 %1831, i32* %x406.addr, align 4
  %1832 = load i32, i32* %x406.addr, align 4
  %1833 = load i32, i32* %x359.addr, align 4
  %1834 = load i32, i32* %x390.addr, align 4
  %1835 = call i64 @p256FiatAddcarryxU32(i32 %1832, i32 %1833, i32 %1834)
  store i64 %1835, i64* %w407.addr, align 8
  %1836 = load i64, i64* %w407.addr, align 8
  %1837 = trunc i64 %1836 to i32
  store i32 %1837, i32* %x407.addr, align 4
  %1838 = load i64, i64* %w407.addr, align 8
  %1839 = lshr i64 %1838, 32
  %1840 = trunc i64 %1839 to i32
  store i32 %1840, i32* %x408.addr, align 4
  %1841 = load i32, i32* %x408.addr, align 4
  %1842 = load i32, i32* %x361.addr, align 4
  %1843 = load i32, i32* %x392.addr, align 4
  %1844 = call i64 @p256FiatAddcarryxU32(i32 %1841, i32 %1842, i32 %1843)
  store i64 %1844, i64* %w409.addr, align 8
  %1845 = load i64, i64* %w409.addr, align 8
  %1846 = trunc i64 %1845 to i32
  store i32 %1846, i32* %x409.addr, align 4
  %1847 = load i64, i64* %w409.addr, align 8
  %1848 = lshr i64 %1847, 32
  %1849 = trunc i64 %1848 to i32
  store i32 %1849, i32* %x410.addr, align 4
  %1850 = load i32, i32* %x410.addr, align 4
  %1851 = load i32, i32* %x363.addr, align 4
  %1852 = load i32, i32* %x394.addr, align 4
  %1853 = call i64 @p256FiatAddcarryxU32(i32 %1850, i32 %1851, i32 %1852)
  store i64 %1853, i64* %w411.addr, align 8
  %1854 = load i64, i64* %w411.addr, align 8
  %1855 = trunc i64 %1854 to i32
  store i32 %1855, i32* %x411.addr, align 4
  %1856 = load i64, i64* %w411.addr, align 8
  %1857 = lshr i64 %1856, 32
  %1858 = trunc i64 %1857 to i32
  store i32 %1858, i32* %x412.addr, align 4
  %1859 = load i32, i32* %x412.addr, align 4
  %1860 = load i32, i32* %x365.addr, align 4
  %1861 = load i32, i32* %x396.addr, align 4
  %1862 = call i64 @p256FiatAddcarryxU32(i32 %1859, i32 %1860, i32 %1861)
  store i64 %1862, i64* %w413.addr, align 8
  %1863 = load i64, i64* %w413.addr, align 8
  %1864 = trunc i64 %1863 to i32
  store i32 %1864, i32* %x413.addr, align 4
  %1865 = load i64, i64* %w413.addr, align 8
  %1866 = lshr i64 %1865, 32
  %1867 = trunc i64 %1866 to i32
  store i32 %1867, i32* %x414.addr, align 4
  %1868 = load i32, i32* %x414.addr, align 4
  %1869 = load i32, i32* %x367.addr, align 4
  %1870 = load i32, i32* %x398.addr, align 4
  %1871 = call i64 @p256FiatAddcarryxU32(i32 %1868, i32 %1869, i32 %1870)
  store i64 %1871, i64* %w415.addr, align 8
  %1872 = load i64, i64* %w415.addr, align 8
  %1873 = trunc i64 %1872 to i32
  store i32 %1873, i32* %x415.addr, align 4
  %1874 = load i64, i64* %w415.addr, align 8
  %1875 = lshr i64 %1874, 32
  %1876 = trunc i64 %1875 to i32
  store i32 %1876, i32* %x416.addr, align 4
  %1877 = load i32, i32* %x416.addr, align 4
  %1878 = load i32, i32* %x369.addr, align 4
  %1879 = load i32, i32* %x400.addr, align 4
  %1880 = call i64 @p256FiatAddcarryxU32(i32 %1877, i32 %1878, i32 %1879)
  store i64 %1880, i64* %w417.addr, align 8
  %1881 = load i64, i64* %w417.addr, align 8
  %1882 = trunc i64 %1881 to i32
  store i32 %1882, i32* %x417.addr, align 4
  %1883 = load i64, i64* %w417.addr, align 8
  %1884 = lshr i64 %1883, 32
  %1885 = trunc i64 %1884 to i32
  store i32 %1885, i32* %x418.addr, align 4
  %1886 = load i32, i32* %x401.addr, align 4
  %1887 = call i64 @p256FiatMulxU32(i32 %1886, i32 3993025615)
  store i64 %1887, i64* %w419.addr, align 8
  %1888 = load i64, i64* %w419.addr, align 8
  %1889 = trunc i64 %1888 to i32
  store i32 %1889, i32* %x419.addr, align 4
  %1890 = load i32, i32* %x419.addr, align 4
  %1891 = call i64 @p256FiatMulxU32(i32 %1890, i32 4294967295)
  store i64 %1891, i64* %w421.addr, align 8
  %1892 = load i64, i64* %w421.addr, align 8
  %1893 = trunc i64 %1892 to i32
  store i32 %1893, i32* %x421.addr, align 4
  %1894 = load i64, i64* %w421.addr, align 8
  %1895 = lshr i64 %1894, 32
  %1896 = trunc i64 %1895 to i32
  store i32 %1896, i32* %x422.addr, align 4
  %1897 = load i32, i32* %x419.addr, align 4
  %1898 = call i64 @p256FiatMulxU32(i32 %1897, i32 4294967295)
  store i64 %1898, i64* %w423.addr, align 8
  %1899 = load i64, i64* %w423.addr, align 8
  %1900 = trunc i64 %1899 to i32
  store i32 %1900, i32* %x423.addr, align 4
  %1901 = load i64, i64* %w423.addr, align 8
  %1902 = lshr i64 %1901, 32
  %1903 = trunc i64 %1902 to i32
  store i32 %1903, i32* %x424.addr, align 4
  %1904 = load i32, i32* %x419.addr, align 4
  %1905 = call i64 @p256FiatMulxU32(i32 %1904, i32 4294967295)
  store i64 %1905, i64* %w425.addr, align 8
  %1906 = load i64, i64* %w425.addr, align 8
  %1907 = trunc i64 %1906 to i32
  store i32 %1907, i32* %x425.addr, align 4
  %1908 = load i64, i64* %w425.addr, align 8
  %1909 = lshr i64 %1908, 32
  %1910 = trunc i64 %1909 to i32
  store i32 %1910, i32* %x426.addr, align 4
  %1911 = load i32, i32* %x419.addr, align 4
  %1912 = call i64 @p256FiatMulxU32(i32 %1911, i32 3169254061)
  store i64 %1912, i64* %w427.addr, align 8
  %1913 = load i64, i64* %w427.addr, align 8
  %1914 = trunc i64 %1913 to i32
  store i32 %1914, i32* %x427.addr, align 4
  %1915 = load i64, i64* %w427.addr, align 8
  %1916 = lshr i64 %1915, 32
  %1917 = trunc i64 %1916 to i32
  store i32 %1917, i32* %x428.addr, align 4
  %1918 = load i32, i32* %x419.addr, align 4
  %1919 = call i64 @p256FiatMulxU32(i32 %1918, i32 2803342980)
  store i64 %1919, i64* %w429.addr, align 8
  %1920 = load i64, i64* %w429.addr, align 8
  %1921 = trunc i64 %1920 to i32
  store i32 %1921, i32* %x429.addr, align 4
  %1922 = load i64, i64* %w429.addr, align 8
  %1923 = lshr i64 %1922, 32
  %1924 = trunc i64 %1923 to i32
  store i32 %1924, i32* %x430.addr, align 4
  %1925 = load i32, i32* %x419.addr, align 4
  %1926 = call i64 @p256FiatMulxU32(i32 %1925, i32 4089039554)
  store i64 %1926, i64* %w431.addr, align 8
  %1927 = load i64, i64* %w431.addr, align 8
  %1928 = trunc i64 %1927 to i32
  store i32 %1928, i32* %x431.addr, align 4
  %1929 = load i64, i64* %w431.addr, align 8
  %1930 = lshr i64 %1929, 32
  %1931 = trunc i64 %1930 to i32
  store i32 %1931, i32* %x432.addr, align 4
  %1932 = load i32, i32* %x419.addr, align 4
  %1933 = call i64 @p256FiatMulxU32(i32 %1932, i32 4234356049)
  store i64 %1933, i64* %w433.addr, align 8
  %1934 = load i64, i64* %w433.addr, align 8
  %1935 = trunc i64 %1934 to i32
  store i32 %1935, i32* %x433.addr, align 4
  %1936 = load i64, i64* %w433.addr, align 8
  %1937 = lshr i64 %1936, 32
  %1938 = trunc i64 %1937 to i32
  store i32 %1938, i32* %x434.addr, align 4
  %1939 = load i32, i32* %x434.addr, align 4
  %1940 = load i32, i32* %x431.addr, align 4
  %1941 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1939, i32 %1940)
  store i64 %1941, i64* %w435.addr, align 8
  %1942 = load i64, i64* %w435.addr, align 8
  %1943 = trunc i64 %1942 to i32
  store i32 %1943, i32* %x435.addr, align 4
  %1944 = load i64, i64* %w435.addr, align 8
  %1945 = lshr i64 %1944, 32
  %1946 = trunc i64 %1945 to i32
  store i32 %1946, i32* %x436.addr, align 4
  %1947 = load i32, i32* %x436.addr, align 4
  %1948 = load i32, i32* %x432.addr, align 4
  %1949 = load i32, i32* %x429.addr, align 4
  %1950 = call i64 @p256FiatAddcarryxU32(i32 %1947, i32 %1948, i32 %1949)
  store i64 %1950, i64* %w437.addr, align 8
  %1951 = load i64, i64* %w437.addr, align 8
  %1952 = trunc i64 %1951 to i32
  store i32 %1952, i32* %x437.addr, align 4
  %1953 = load i64, i64* %w437.addr, align 8
  %1954 = lshr i64 %1953, 32
  %1955 = trunc i64 %1954 to i32
  store i32 %1955, i32* %x438.addr, align 4
  %1956 = load i32, i32* %x438.addr, align 4
  %1957 = load i32, i32* %x430.addr, align 4
  %1958 = load i32, i32* %x427.addr, align 4
  %1959 = call i64 @p256FiatAddcarryxU32(i32 %1956, i32 %1957, i32 %1958)
  store i64 %1959, i64* %w439.addr, align 8
  %1960 = load i64, i64* %w439.addr, align 8
  %1961 = trunc i64 %1960 to i32
  store i32 %1961, i32* %x439.addr, align 4
  %1962 = load i64, i64* %w439.addr, align 8
  %1963 = lshr i64 %1962, 32
  %1964 = trunc i64 %1963 to i32
  store i32 %1964, i32* %x440.addr, align 4
  %1965 = load i32, i32* %x440.addr, align 4
  %1966 = load i32, i32* %x428.addr, align 4
  %1967 = load i32, i32* %x425.addr, align 4
  %1968 = call i64 @p256FiatAddcarryxU32(i32 %1965, i32 %1966, i32 %1967)
  store i64 %1968, i64* %w441.addr, align 8
  %1969 = load i64, i64* %w441.addr, align 8
  %1970 = trunc i64 %1969 to i32
  store i32 %1970, i32* %x441.addr, align 4
  %1971 = load i64, i64* %w441.addr, align 8
  %1972 = lshr i64 %1971, 32
  %1973 = trunc i64 %1972 to i32
  store i32 %1973, i32* %x442.addr, align 4
  %1974 = load i32, i32* %x442.addr, align 4
  %1975 = load i32, i32* %x426.addr, align 4
  %1976 = load i32, i32* %x423.addr, align 4
  %1977 = call i64 @p256FiatAddcarryxU32(i32 %1974, i32 %1975, i32 %1976)
  store i64 %1977, i64* %w443.addr, align 8
  %1978 = load i64, i64* %w443.addr, align 8
  %1979 = trunc i64 %1978 to i32
  store i32 %1979, i32* %x443.addr, align 4
  %1980 = load i64, i64* %w443.addr, align 8
  %1981 = lshr i64 %1980, 32
  %1982 = trunc i64 %1981 to i32
  store i32 %1982, i32* %x444.addr, align 4
  %1983 = load i32, i32* %x444.addr, align 4
  %1984 = load i32, i32* %x424.addr, align 4
  %1985 = add i32 %1983, %1984
  store i32 %1985, i32* %x445.addr, align 4
  %1986 = load i32, i32* %x401.addr, align 4
  %1987 = load i32, i32* %x433.addr, align 4
  %1988 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %1986, i32 %1987)
  store i64 %1988, i64* %w446.addr, align 8
  %1989 = load i64, i64* %w446.addr, align 8
  %1990 = lshr i64 %1989, 32
  %1991 = trunc i64 %1990 to i32
  store i32 %1991, i32* %x447.addr, align 4
  %1992 = load i32, i32* %x447.addr, align 4
  %1993 = load i32, i32* %x403.addr, align 4
  %1994 = load i32, i32* %x435.addr, align 4
  %1995 = call i64 @p256FiatAddcarryxU32(i32 %1992, i32 %1993, i32 %1994)
  store i64 %1995, i64* %w448.addr, align 8
  %1996 = load i64, i64* %w448.addr, align 8
  %1997 = trunc i64 %1996 to i32
  store i32 %1997, i32* %x448.addr, align 4
  %1998 = load i64, i64* %w448.addr, align 8
  %1999 = lshr i64 %1998, 32
  %2000 = trunc i64 %1999 to i32
  store i32 %2000, i32* %x449.addr, align 4
  %2001 = load i32, i32* %x449.addr, align 4
  %2002 = load i32, i32* %x405.addr, align 4
  %2003 = load i32, i32* %x437.addr, align 4
  %2004 = call i64 @p256FiatAddcarryxU32(i32 %2001, i32 %2002, i32 %2003)
  store i64 %2004, i64* %w450.addr, align 8
  %2005 = load i64, i64* %w450.addr, align 8
  %2006 = trunc i64 %2005 to i32
  store i32 %2006, i32* %x450.addr, align 4
  %2007 = load i64, i64* %w450.addr, align 8
  %2008 = lshr i64 %2007, 32
  %2009 = trunc i64 %2008 to i32
  store i32 %2009, i32* %x451.addr, align 4
  %2010 = load i32, i32* %x451.addr, align 4
  %2011 = load i32, i32* %x407.addr, align 4
  %2012 = load i32, i32* %x439.addr, align 4
  %2013 = call i64 @p256FiatAddcarryxU32(i32 %2010, i32 %2011, i32 %2012)
  store i64 %2013, i64* %w452.addr, align 8
  %2014 = load i64, i64* %w452.addr, align 8
  %2015 = trunc i64 %2014 to i32
  store i32 %2015, i32* %x452.addr, align 4
  %2016 = load i64, i64* %w452.addr, align 8
  %2017 = lshr i64 %2016, 32
  %2018 = trunc i64 %2017 to i32
  store i32 %2018, i32* %x453.addr, align 4
  %2019 = load i32, i32* %x453.addr, align 4
  %2020 = load i32, i32* %x409.addr, align 4
  %2021 = load i32, i32* %x441.addr, align 4
  %2022 = call i64 @p256FiatAddcarryxU32(i32 %2019, i32 %2020, i32 %2021)
  store i64 %2022, i64* %w454.addr, align 8
  %2023 = load i64, i64* %w454.addr, align 8
  %2024 = trunc i64 %2023 to i32
  store i32 %2024, i32* %x454.addr, align 4
  %2025 = load i64, i64* %w454.addr, align 8
  %2026 = lshr i64 %2025, 32
  %2027 = trunc i64 %2026 to i32
  store i32 %2027, i32* %x455.addr, align 4
  %2028 = load i32, i32* %x455.addr, align 4
  %2029 = load i32, i32* %x411.addr, align 4
  %2030 = load i32, i32* %x443.addr, align 4
  %2031 = call i64 @p256FiatAddcarryxU32(i32 %2028, i32 %2029, i32 %2030)
  store i64 %2031, i64* %w456.addr, align 8
  %2032 = load i64, i64* %w456.addr, align 8
  %2033 = trunc i64 %2032 to i32
  store i32 %2033, i32* %x456.addr, align 4
  %2034 = load i64, i64* %w456.addr, align 8
  %2035 = lshr i64 %2034, 32
  %2036 = trunc i64 %2035 to i32
  store i32 %2036, i32* %x457.addr, align 4
  %2037 = load i32, i32* %x457.addr, align 4
  %2038 = load i32, i32* %x413.addr, align 4
  %2039 = load i32, i32* %x445.addr, align 4
  %2040 = call i64 @p256FiatAddcarryxU32(i32 %2037, i32 %2038, i32 %2039)
  store i64 %2040, i64* %w458.addr, align 8
  %2041 = load i64, i64* %w458.addr, align 8
  %2042 = trunc i64 %2041 to i32
  store i32 %2042, i32* %x458.addr, align 4
  %2043 = load i64, i64* %w458.addr, align 8
  %2044 = lshr i64 %2043, 32
  %2045 = trunc i64 %2044 to i32
  store i32 %2045, i32* %x459.addr, align 4
  %2046 = load i32, i32* %x459.addr, align 4
  %2047 = load i32, i32* %x415.addr, align 4
  %2048 = load i32, i32* %x421.addr, align 4
  %2049 = call i64 @p256FiatAddcarryxU32(i32 %2046, i32 %2047, i32 %2048)
  store i64 %2049, i64* %w460.addr, align 8
  %2050 = load i64, i64* %w460.addr, align 8
  %2051 = trunc i64 %2050 to i32
  store i32 %2051, i32* %x460.addr, align 4
  %2052 = load i64, i64* %w460.addr, align 8
  %2053 = lshr i64 %2052, 32
  %2054 = trunc i64 %2053 to i32
  store i32 %2054, i32* %x461.addr, align 4
  %2055 = load i32, i32* %x461.addr, align 4
  %2056 = load i32, i32* %x417.addr, align 4
  %2057 = load i32, i32* %x422.addr, align 4
  %2058 = call i64 @p256FiatAddcarryxU32(i32 %2055, i32 %2056, i32 %2057)
  store i64 %2058, i64* %w462.addr, align 8
  %2059 = load i64, i64* %w462.addr, align 8
  %2060 = trunc i64 %2059 to i32
  store i32 %2060, i32* %x462.addr, align 4
  %2061 = load i64, i64* %w462.addr, align 8
  %2062 = lshr i64 %2061, 32
  %2063 = trunc i64 %2062 to i32
  store i32 %2063, i32* %x463.addr, align 4
  %2064 = load i32, i32* %x463.addr, align 4
  %2065 = load i32, i32* %x418.addr, align 4
  %2066 = add i32 %2064, %2065
  store i32 %2066, i32* %x464.addr, align 4
  %2067 = load i32, i32* %x5.addr, align 4
  %2068 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2069 = load i8*, i8** %2068, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2070 = bitcast i8* %2069 to i32*
  %2071 = getelementptr inbounds i32, i32* %2070, i64 7
  %2072 = load i32, i32* %2071, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2073 = call i64 @p256FiatMulxU32(i32 %2067, i32 %2072)
  store i64 %2073, i64* %w465.addr, align 8
  %2074 = load i64, i64* %w465.addr, align 8
  %2075 = trunc i64 %2074 to i32
  store i32 %2075, i32* %x465.addr, align 4
  %2076 = load i64, i64* %w465.addr, align 8
  %2077 = lshr i64 %2076, 32
  %2078 = trunc i64 %2077 to i32
  store i32 %2078, i32* %x466.addr, align 4
  %2079 = load i32, i32* %x5.addr, align 4
  %2080 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2081 = load i8*, i8** %2080, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2082 = bitcast i8* %2081 to i32*
  %2083 = getelementptr inbounds i32, i32* %2082, i64 6
  %2084 = load i32, i32* %2083, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2085 = call i64 @p256FiatMulxU32(i32 %2079, i32 %2084)
  store i64 %2085, i64* %w467.addr, align 8
  %2086 = load i64, i64* %w467.addr, align 8
  %2087 = trunc i64 %2086 to i32
  store i32 %2087, i32* %x467.addr, align 4
  %2088 = load i64, i64* %w467.addr, align 8
  %2089 = lshr i64 %2088, 32
  %2090 = trunc i64 %2089 to i32
  store i32 %2090, i32* %x468.addr, align 4
  %2091 = load i32, i32* %x5.addr, align 4
  %2092 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2093 = load i8*, i8** %2092, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2094 = bitcast i8* %2093 to i32*
  %2095 = getelementptr inbounds i32, i32* %2094, i64 5
  %2096 = load i32, i32* %2095, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2097 = call i64 @p256FiatMulxU32(i32 %2091, i32 %2096)
  store i64 %2097, i64* %w469.addr, align 8
  %2098 = load i64, i64* %w469.addr, align 8
  %2099 = trunc i64 %2098 to i32
  store i32 %2099, i32* %x469.addr, align 4
  %2100 = load i64, i64* %w469.addr, align 8
  %2101 = lshr i64 %2100, 32
  %2102 = trunc i64 %2101 to i32
  store i32 %2102, i32* %x470.addr, align 4
  %2103 = load i32, i32* %x5.addr, align 4
  %2104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2105 = load i8*, i8** %2104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2106 = bitcast i8* %2105 to i32*
  %2107 = getelementptr inbounds i32, i32* %2106, i64 4
  %2108 = load i32, i32* %2107, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2109 = call i64 @p256FiatMulxU32(i32 %2103, i32 %2108)
  store i64 %2109, i64* %w471.addr, align 8
  %2110 = load i64, i64* %w471.addr, align 8
  %2111 = trunc i64 %2110 to i32
  store i32 %2111, i32* %x471.addr, align 4
  %2112 = load i64, i64* %w471.addr, align 8
  %2113 = lshr i64 %2112, 32
  %2114 = trunc i64 %2113 to i32
  store i32 %2114, i32* %x472.addr, align 4
  %2115 = load i32, i32* %x5.addr, align 4
  %2116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2117 = load i8*, i8** %2116, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2118 = bitcast i8* %2117 to i32*
  %2119 = getelementptr inbounds i32, i32* %2118, i64 3
  %2120 = load i32, i32* %2119, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2121 = call i64 @p256FiatMulxU32(i32 %2115, i32 %2120)
  store i64 %2121, i64* %w473.addr, align 8
  %2122 = load i64, i64* %w473.addr, align 8
  %2123 = trunc i64 %2122 to i32
  store i32 %2123, i32* %x473.addr, align 4
  %2124 = load i64, i64* %w473.addr, align 8
  %2125 = lshr i64 %2124, 32
  %2126 = trunc i64 %2125 to i32
  store i32 %2126, i32* %x474.addr, align 4
  %2127 = load i32, i32* %x5.addr, align 4
  %2128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2129 = load i8*, i8** %2128, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2130 = bitcast i8* %2129 to i32*
  %2131 = getelementptr inbounds i32, i32* %2130, i64 2
  %2132 = load i32, i32* %2131, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2133 = call i64 @p256FiatMulxU32(i32 %2127, i32 %2132)
  store i64 %2133, i64* %w475.addr, align 8
  %2134 = load i64, i64* %w475.addr, align 8
  %2135 = trunc i64 %2134 to i32
  store i32 %2135, i32* %x475.addr, align 4
  %2136 = load i64, i64* %w475.addr, align 8
  %2137 = lshr i64 %2136, 32
  %2138 = trunc i64 %2137 to i32
  store i32 %2138, i32* %x476.addr, align 4
  %2139 = load i32, i32* %x5.addr, align 4
  %2140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2141 = load i8*, i8** %2140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2142 = bitcast i8* %2141 to i32*
  %2143 = getelementptr inbounds i32, i32* %2142, i64 1
  %2144 = load i32, i32* %2143, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2145 = call i64 @p256FiatMulxU32(i32 %2139, i32 %2144)
  store i64 %2145, i64* %w477.addr, align 8
  %2146 = load i64, i64* %w477.addr, align 8
  %2147 = trunc i64 %2146 to i32
  store i32 %2147, i32* %x477.addr, align 4
  %2148 = load i64, i64* %w477.addr, align 8
  %2149 = lshr i64 %2148, 32
  %2150 = trunc i64 %2149 to i32
  store i32 %2150, i32* %x478.addr, align 4
  %2151 = load i32, i32* %x5.addr, align 4
  %2152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2153 = load i8*, i8** %2152, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2154 = bitcast i8* %2153 to i32*
  %2155 = getelementptr inbounds i32, i32* %2154, i64 0
  %2156 = load i32, i32* %2155, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2157 = call i64 @p256FiatMulxU32(i32 %2151, i32 %2156)
  store i64 %2157, i64* %w479.addr, align 8
  %2158 = load i64, i64* %w479.addr, align 8
  %2159 = trunc i64 %2158 to i32
  store i32 %2159, i32* %x479.addr, align 4
  %2160 = load i64, i64* %w479.addr, align 8
  %2161 = lshr i64 %2160, 32
  %2162 = trunc i64 %2161 to i32
  store i32 %2162, i32* %x480.addr, align 4
  %2163 = load i32, i32* %x480.addr, align 4
  %2164 = load i32, i32* %x477.addr, align 4
  %2165 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2163, i32 %2164)
  store i64 %2165, i64* %w481.addr, align 8
  %2166 = load i64, i64* %w481.addr, align 8
  %2167 = trunc i64 %2166 to i32
  store i32 %2167, i32* %x481.addr, align 4
  %2168 = load i64, i64* %w481.addr, align 8
  %2169 = lshr i64 %2168, 32
  %2170 = trunc i64 %2169 to i32
  store i32 %2170, i32* %x482.addr, align 4
  %2171 = load i32, i32* %x482.addr, align 4
  %2172 = load i32, i32* %x478.addr, align 4
  %2173 = load i32, i32* %x475.addr, align 4
  %2174 = call i64 @p256FiatAddcarryxU32(i32 %2171, i32 %2172, i32 %2173)
  store i64 %2174, i64* %w483.addr, align 8
  %2175 = load i64, i64* %w483.addr, align 8
  %2176 = trunc i64 %2175 to i32
  store i32 %2176, i32* %x483.addr, align 4
  %2177 = load i64, i64* %w483.addr, align 8
  %2178 = lshr i64 %2177, 32
  %2179 = trunc i64 %2178 to i32
  store i32 %2179, i32* %x484.addr, align 4
  %2180 = load i32, i32* %x484.addr, align 4
  %2181 = load i32, i32* %x476.addr, align 4
  %2182 = load i32, i32* %x473.addr, align 4
  %2183 = call i64 @p256FiatAddcarryxU32(i32 %2180, i32 %2181, i32 %2182)
  store i64 %2183, i64* %w485.addr, align 8
  %2184 = load i64, i64* %w485.addr, align 8
  %2185 = trunc i64 %2184 to i32
  store i32 %2185, i32* %x485.addr, align 4
  %2186 = load i64, i64* %w485.addr, align 8
  %2187 = lshr i64 %2186, 32
  %2188 = trunc i64 %2187 to i32
  store i32 %2188, i32* %x486.addr, align 4
  %2189 = load i32, i32* %x486.addr, align 4
  %2190 = load i32, i32* %x474.addr, align 4
  %2191 = load i32, i32* %x471.addr, align 4
  %2192 = call i64 @p256FiatAddcarryxU32(i32 %2189, i32 %2190, i32 %2191)
  store i64 %2192, i64* %w487.addr, align 8
  %2193 = load i64, i64* %w487.addr, align 8
  %2194 = trunc i64 %2193 to i32
  store i32 %2194, i32* %x487.addr, align 4
  %2195 = load i64, i64* %w487.addr, align 8
  %2196 = lshr i64 %2195, 32
  %2197 = trunc i64 %2196 to i32
  store i32 %2197, i32* %x488.addr, align 4
  %2198 = load i32, i32* %x488.addr, align 4
  %2199 = load i32, i32* %x472.addr, align 4
  %2200 = load i32, i32* %x469.addr, align 4
  %2201 = call i64 @p256FiatAddcarryxU32(i32 %2198, i32 %2199, i32 %2200)
  store i64 %2201, i64* %w489.addr, align 8
  %2202 = load i64, i64* %w489.addr, align 8
  %2203 = trunc i64 %2202 to i32
  store i32 %2203, i32* %x489.addr, align 4
  %2204 = load i64, i64* %w489.addr, align 8
  %2205 = lshr i64 %2204, 32
  %2206 = trunc i64 %2205 to i32
  store i32 %2206, i32* %x490.addr, align 4
  %2207 = load i32, i32* %x490.addr, align 4
  %2208 = load i32, i32* %x470.addr, align 4
  %2209 = load i32, i32* %x467.addr, align 4
  %2210 = call i64 @p256FiatAddcarryxU32(i32 %2207, i32 %2208, i32 %2209)
  store i64 %2210, i64* %w491.addr, align 8
  %2211 = load i64, i64* %w491.addr, align 8
  %2212 = trunc i64 %2211 to i32
  store i32 %2212, i32* %x491.addr, align 4
  %2213 = load i64, i64* %w491.addr, align 8
  %2214 = lshr i64 %2213, 32
  %2215 = trunc i64 %2214 to i32
  store i32 %2215, i32* %x492.addr, align 4
  %2216 = load i32, i32* %x492.addr, align 4
  %2217 = load i32, i32* %x468.addr, align 4
  %2218 = load i32, i32* %x465.addr, align 4
  %2219 = call i64 @p256FiatAddcarryxU32(i32 %2216, i32 %2217, i32 %2218)
  store i64 %2219, i64* %w493.addr, align 8
  %2220 = load i64, i64* %w493.addr, align 8
  %2221 = trunc i64 %2220 to i32
  store i32 %2221, i32* %x493.addr, align 4
  %2222 = load i64, i64* %w493.addr, align 8
  %2223 = lshr i64 %2222, 32
  %2224 = trunc i64 %2223 to i32
  store i32 %2224, i32* %x494.addr, align 4
  %2225 = load i32, i32* %x494.addr, align 4
  %2226 = load i32, i32* %x466.addr, align 4
  %2227 = add i32 %2225, %2226
  store i32 %2227, i32* %x495.addr, align 4
  %2228 = load i32, i32* %x448.addr, align 4
  %2229 = load i32, i32* %x479.addr, align 4
  %2230 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2228, i32 %2229)
  store i64 %2230, i64* %w496.addr, align 8
  %2231 = load i64, i64* %w496.addr, align 8
  %2232 = trunc i64 %2231 to i32
  store i32 %2232, i32* %x496.addr, align 4
  %2233 = load i64, i64* %w496.addr, align 8
  %2234 = lshr i64 %2233, 32
  %2235 = trunc i64 %2234 to i32
  store i32 %2235, i32* %x497.addr, align 4
  %2236 = load i32, i32* %x497.addr, align 4
  %2237 = load i32, i32* %x450.addr, align 4
  %2238 = load i32, i32* %x481.addr, align 4
  %2239 = call i64 @p256FiatAddcarryxU32(i32 %2236, i32 %2237, i32 %2238)
  store i64 %2239, i64* %w498.addr, align 8
  %2240 = load i64, i64* %w498.addr, align 8
  %2241 = trunc i64 %2240 to i32
  store i32 %2241, i32* %x498.addr, align 4
  %2242 = load i64, i64* %w498.addr, align 8
  %2243 = lshr i64 %2242, 32
  %2244 = trunc i64 %2243 to i32
  store i32 %2244, i32* %x499.addr, align 4
  %2245 = load i32, i32* %x499.addr, align 4
  %2246 = load i32, i32* %x452.addr, align 4
  %2247 = load i32, i32* %x483.addr, align 4
  %2248 = call i64 @p256FiatAddcarryxU32(i32 %2245, i32 %2246, i32 %2247)
  store i64 %2248, i64* %w500.addr, align 8
  %2249 = load i64, i64* %w500.addr, align 8
  %2250 = trunc i64 %2249 to i32
  store i32 %2250, i32* %x500.addr, align 4
  %2251 = load i64, i64* %w500.addr, align 8
  %2252 = lshr i64 %2251, 32
  %2253 = trunc i64 %2252 to i32
  store i32 %2253, i32* %x501.addr, align 4
  %2254 = load i32, i32* %x501.addr, align 4
  %2255 = load i32, i32* %x454.addr, align 4
  %2256 = load i32, i32* %x485.addr, align 4
  %2257 = call i64 @p256FiatAddcarryxU32(i32 %2254, i32 %2255, i32 %2256)
  store i64 %2257, i64* %w502.addr, align 8
  %2258 = load i64, i64* %w502.addr, align 8
  %2259 = trunc i64 %2258 to i32
  store i32 %2259, i32* %x502.addr, align 4
  %2260 = load i64, i64* %w502.addr, align 8
  %2261 = lshr i64 %2260, 32
  %2262 = trunc i64 %2261 to i32
  store i32 %2262, i32* %x503.addr, align 4
  %2263 = load i32, i32* %x503.addr, align 4
  %2264 = load i32, i32* %x456.addr, align 4
  %2265 = load i32, i32* %x487.addr, align 4
  %2266 = call i64 @p256FiatAddcarryxU32(i32 %2263, i32 %2264, i32 %2265)
  store i64 %2266, i64* %w504.addr, align 8
  %2267 = load i64, i64* %w504.addr, align 8
  %2268 = trunc i64 %2267 to i32
  store i32 %2268, i32* %x504.addr, align 4
  %2269 = load i64, i64* %w504.addr, align 8
  %2270 = lshr i64 %2269, 32
  %2271 = trunc i64 %2270 to i32
  store i32 %2271, i32* %x505.addr, align 4
  %2272 = load i32, i32* %x505.addr, align 4
  %2273 = load i32, i32* %x458.addr, align 4
  %2274 = load i32, i32* %x489.addr, align 4
  %2275 = call i64 @p256FiatAddcarryxU32(i32 %2272, i32 %2273, i32 %2274)
  store i64 %2275, i64* %w506.addr, align 8
  %2276 = load i64, i64* %w506.addr, align 8
  %2277 = trunc i64 %2276 to i32
  store i32 %2277, i32* %x506.addr, align 4
  %2278 = load i64, i64* %w506.addr, align 8
  %2279 = lshr i64 %2278, 32
  %2280 = trunc i64 %2279 to i32
  store i32 %2280, i32* %x507.addr, align 4
  %2281 = load i32, i32* %x507.addr, align 4
  %2282 = load i32, i32* %x460.addr, align 4
  %2283 = load i32, i32* %x491.addr, align 4
  %2284 = call i64 @p256FiatAddcarryxU32(i32 %2281, i32 %2282, i32 %2283)
  store i64 %2284, i64* %w508.addr, align 8
  %2285 = load i64, i64* %w508.addr, align 8
  %2286 = trunc i64 %2285 to i32
  store i32 %2286, i32* %x508.addr, align 4
  %2287 = load i64, i64* %w508.addr, align 8
  %2288 = lshr i64 %2287, 32
  %2289 = trunc i64 %2288 to i32
  store i32 %2289, i32* %x509.addr, align 4
  %2290 = load i32, i32* %x509.addr, align 4
  %2291 = load i32, i32* %x462.addr, align 4
  %2292 = load i32, i32* %x493.addr, align 4
  %2293 = call i64 @p256FiatAddcarryxU32(i32 %2290, i32 %2291, i32 %2292)
  store i64 %2293, i64* %w510.addr, align 8
  %2294 = load i64, i64* %w510.addr, align 8
  %2295 = trunc i64 %2294 to i32
  store i32 %2295, i32* %x510.addr, align 4
  %2296 = load i64, i64* %w510.addr, align 8
  %2297 = lshr i64 %2296, 32
  %2298 = trunc i64 %2297 to i32
  store i32 %2298, i32* %x511.addr, align 4
  %2299 = load i32, i32* %x511.addr, align 4
  %2300 = load i32, i32* %x464.addr, align 4
  %2301 = load i32, i32* %x495.addr, align 4
  %2302 = call i64 @p256FiatAddcarryxU32(i32 %2299, i32 %2300, i32 %2301)
  store i64 %2302, i64* %w512.addr, align 8
  %2303 = load i64, i64* %w512.addr, align 8
  %2304 = trunc i64 %2303 to i32
  store i32 %2304, i32* %x512.addr, align 4
  %2305 = load i64, i64* %w512.addr, align 8
  %2306 = lshr i64 %2305, 32
  %2307 = trunc i64 %2306 to i32
  store i32 %2307, i32* %x513.addr, align 4
  %2308 = load i32, i32* %x496.addr, align 4
  %2309 = call i64 @p256FiatMulxU32(i32 %2308, i32 3993025615)
  store i64 %2309, i64* %w514.addr, align 8
  %2310 = load i64, i64* %w514.addr, align 8
  %2311 = trunc i64 %2310 to i32
  store i32 %2311, i32* %x514.addr, align 4
  %2312 = load i32, i32* %x514.addr, align 4
  %2313 = call i64 @p256FiatMulxU32(i32 %2312, i32 4294967295)
  store i64 %2313, i64* %w516.addr, align 8
  %2314 = load i64, i64* %w516.addr, align 8
  %2315 = trunc i64 %2314 to i32
  store i32 %2315, i32* %x516.addr, align 4
  %2316 = load i64, i64* %w516.addr, align 8
  %2317 = lshr i64 %2316, 32
  %2318 = trunc i64 %2317 to i32
  store i32 %2318, i32* %x517.addr, align 4
  %2319 = load i32, i32* %x514.addr, align 4
  %2320 = call i64 @p256FiatMulxU32(i32 %2319, i32 4294967295)
  store i64 %2320, i64* %w518.addr, align 8
  %2321 = load i64, i64* %w518.addr, align 8
  %2322 = trunc i64 %2321 to i32
  store i32 %2322, i32* %x518.addr, align 4
  %2323 = load i64, i64* %w518.addr, align 8
  %2324 = lshr i64 %2323, 32
  %2325 = trunc i64 %2324 to i32
  store i32 %2325, i32* %x519.addr, align 4
  %2326 = load i32, i32* %x514.addr, align 4
  %2327 = call i64 @p256FiatMulxU32(i32 %2326, i32 4294967295)
  store i64 %2327, i64* %w520.addr, align 8
  %2328 = load i64, i64* %w520.addr, align 8
  %2329 = trunc i64 %2328 to i32
  store i32 %2329, i32* %x520.addr, align 4
  %2330 = load i64, i64* %w520.addr, align 8
  %2331 = lshr i64 %2330, 32
  %2332 = trunc i64 %2331 to i32
  store i32 %2332, i32* %x521.addr, align 4
  %2333 = load i32, i32* %x514.addr, align 4
  %2334 = call i64 @p256FiatMulxU32(i32 %2333, i32 3169254061)
  store i64 %2334, i64* %w522.addr, align 8
  %2335 = load i64, i64* %w522.addr, align 8
  %2336 = trunc i64 %2335 to i32
  store i32 %2336, i32* %x522.addr, align 4
  %2337 = load i64, i64* %w522.addr, align 8
  %2338 = lshr i64 %2337, 32
  %2339 = trunc i64 %2338 to i32
  store i32 %2339, i32* %x523.addr, align 4
  %2340 = load i32, i32* %x514.addr, align 4
  %2341 = call i64 @p256FiatMulxU32(i32 %2340, i32 2803342980)
  store i64 %2341, i64* %w524.addr, align 8
  %2342 = load i64, i64* %w524.addr, align 8
  %2343 = trunc i64 %2342 to i32
  store i32 %2343, i32* %x524.addr, align 4
  %2344 = load i64, i64* %w524.addr, align 8
  %2345 = lshr i64 %2344, 32
  %2346 = trunc i64 %2345 to i32
  store i32 %2346, i32* %x525.addr, align 4
  %2347 = load i32, i32* %x514.addr, align 4
  %2348 = call i64 @p256FiatMulxU32(i32 %2347, i32 4089039554)
  store i64 %2348, i64* %w526.addr, align 8
  %2349 = load i64, i64* %w526.addr, align 8
  %2350 = trunc i64 %2349 to i32
  store i32 %2350, i32* %x526.addr, align 4
  %2351 = load i64, i64* %w526.addr, align 8
  %2352 = lshr i64 %2351, 32
  %2353 = trunc i64 %2352 to i32
  store i32 %2353, i32* %x527.addr, align 4
  %2354 = load i32, i32* %x514.addr, align 4
  %2355 = call i64 @p256FiatMulxU32(i32 %2354, i32 4234356049)
  store i64 %2355, i64* %w528.addr, align 8
  %2356 = load i64, i64* %w528.addr, align 8
  %2357 = trunc i64 %2356 to i32
  store i32 %2357, i32* %x528.addr, align 4
  %2358 = load i64, i64* %w528.addr, align 8
  %2359 = lshr i64 %2358, 32
  %2360 = trunc i64 %2359 to i32
  store i32 %2360, i32* %x529.addr, align 4
  %2361 = load i32, i32* %x529.addr, align 4
  %2362 = load i32, i32* %x526.addr, align 4
  %2363 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2361, i32 %2362)
  store i64 %2363, i64* %w530.addr, align 8
  %2364 = load i64, i64* %w530.addr, align 8
  %2365 = trunc i64 %2364 to i32
  store i32 %2365, i32* %x530.addr, align 4
  %2366 = load i64, i64* %w530.addr, align 8
  %2367 = lshr i64 %2366, 32
  %2368 = trunc i64 %2367 to i32
  store i32 %2368, i32* %x531.addr, align 4
  %2369 = load i32, i32* %x531.addr, align 4
  %2370 = load i32, i32* %x527.addr, align 4
  %2371 = load i32, i32* %x524.addr, align 4
  %2372 = call i64 @p256FiatAddcarryxU32(i32 %2369, i32 %2370, i32 %2371)
  store i64 %2372, i64* %w532.addr, align 8
  %2373 = load i64, i64* %w532.addr, align 8
  %2374 = trunc i64 %2373 to i32
  store i32 %2374, i32* %x532.addr, align 4
  %2375 = load i64, i64* %w532.addr, align 8
  %2376 = lshr i64 %2375, 32
  %2377 = trunc i64 %2376 to i32
  store i32 %2377, i32* %x533.addr, align 4
  %2378 = load i32, i32* %x533.addr, align 4
  %2379 = load i32, i32* %x525.addr, align 4
  %2380 = load i32, i32* %x522.addr, align 4
  %2381 = call i64 @p256FiatAddcarryxU32(i32 %2378, i32 %2379, i32 %2380)
  store i64 %2381, i64* %w534.addr, align 8
  %2382 = load i64, i64* %w534.addr, align 8
  %2383 = trunc i64 %2382 to i32
  store i32 %2383, i32* %x534.addr, align 4
  %2384 = load i64, i64* %w534.addr, align 8
  %2385 = lshr i64 %2384, 32
  %2386 = trunc i64 %2385 to i32
  store i32 %2386, i32* %x535.addr, align 4
  %2387 = load i32, i32* %x535.addr, align 4
  %2388 = load i32, i32* %x523.addr, align 4
  %2389 = load i32, i32* %x520.addr, align 4
  %2390 = call i64 @p256FiatAddcarryxU32(i32 %2387, i32 %2388, i32 %2389)
  store i64 %2390, i64* %w536.addr, align 8
  %2391 = load i64, i64* %w536.addr, align 8
  %2392 = trunc i64 %2391 to i32
  store i32 %2392, i32* %x536.addr, align 4
  %2393 = load i64, i64* %w536.addr, align 8
  %2394 = lshr i64 %2393, 32
  %2395 = trunc i64 %2394 to i32
  store i32 %2395, i32* %x537.addr, align 4
  %2396 = load i32, i32* %x537.addr, align 4
  %2397 = load i32, i32* %x521.addr, align 4
  %2398 = load i32, i32* %x518.addr, align 4
  %2399 = call i64 @p256FiatAddcarryxU32(i32 %2396, i32 %2397, i32 %2398)
  store i64 %2399, i64* %w538.addr, align 8
  %2400 = load i64, i64* %w538.addr, align 8
  %2401 = trunc i64 %2400 to i32
  store i32 %2401, i32* %x538.addr, align 4
  %2402 = load i64, i64* %w538.addr, align 8
  %2403 = lshr i64 %2402, 32
  %2404 = trunc i64 %2403 to i32
  store i32 %2404, i32* %x539.addr, align 4
  %2405 = load i32, i32* %x539.addr, align 4
  %2406 = load i32, i32* %x519.addr, align 4
  %2407 = add i32 %2405, %2406
  store i32 %2407, i32* %x540.addr, align 4
  %2408 = load i32, i32* %x496.addr, align 4
  %2409 = load i32, i32* %x528.addr, align 4
  %2410 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2408, i32 %2409)
  store i64 %2410, i64* %w541.addr, align 8
  %2411 = load i64, i64* %w541.addr, align 8
  %2412 = lshr i64 %2411, 32
  %2413 = trunc i64 %2412 to i32
  store i32 %2413, i32* %x542.addr, align 4
  %2414 = load i32, i32* %x542.addr, align 4
  %2415 = load i32, i32* %x498.addr, align 4
  %2416 = load i32, i32* %x530.addr, align 4
  %2417 = call i64 @p256FiatAddcarryxU32(i32 %2414, i32 %2415, i32 %2416)
  store i64 %2417, i64* %w543.addr, align 8
  %2418 = load i64, i64* %w543.addr, align 8
  %2419 = trunc i64 %2418 to i32
  store i32 %2419, i32* %x543.addr, align 4
  %2420 = load i64, i64* %w543.addr, align 8
  %2421 = lshr i64 %2420, 32
  %2422 = trunc i64 %2421 to i32
  store i32 %2422, i32* %x544.addr, align 4
  %2423 = load i32, i32* %x544.addr, align 4
  %2424 = load i32, i32* %x500.addr, align 4
  %2425 = load i32, i32* %x532.addr, align 4
  %2426 = call i64 @p256FiatAddcarryxU32(i32 %2423, i32 %2424, i32 %2425)
  store i64 %2426, i64* %w545.addr, align 8
  %2427 = load i64, i64* %w545.addr, align 8
  %2428 = trunc i64 %2427 to i32
  store i32 %2428, i32* %x545.addr, align 4
  %2429 = load i64, i64* %w545.addr, align 8
  %2430 = lshr i64 %2429, 32
  %2431 = trunc i64 %2430 to i32
  store i32 %2431, i32* %x546.addr, align 4
  %2432 = load i32, i32* %x546.addr, align 4
  %2433 = load i32, i32* %x502.addr, align 4
  %2434 = load i32, i32* %x534.addr, align 4
  %2435 = call i64 @p256FiatAddcarryxU32(i32 %2432, i32 %2433, i32 %2434)
  store i64 %2435, i64* %w547.addr, align 8
  %2436 = load i64, i64* %w547.addr, align 8
  %2437 = trunc i64 %2436 to i32
  store i32 %2437, i32* %x547.addr, align 4
  %2438 = load i64, i64* %w547.addr, align 8
  %2439 = lshr i64 %2438, 32
  %2440 = trunc i64 %2439 to i32
  store i32 %2440, i32* %x548.addr, align 4
  %2441 = load i32, i32* %x548.addr, align 4
  %2442 = load i32, i32* %x504.addr, align 4
  %2443 = load i32, i32* %x536.addr, align 4
  %2444 = call i64 @p256FiatAddcarryxU32(i32 %2441, i32 %2442, i32 %2443)
  store i64 %2444, i64* %w549.addr, align 8
  %2445 = load i64, i64* %w549.addr, align 8
  %2446 = trunc i64 %2445 to i32
  store i32 %2446, i32* %x549.addr, align 4
  %2447 = load i64, i64* %w549.addr, align 8
  %2448 = lshr i64 %2447, 32
  %2449 = trunc i64 %2448 to i32
  store i32 %2449, i32* %x550.addr, align 4
  %2450 = load i32, i32* %x550.addr, align 4
  %2451 = load i32, i32* %x506.addr, align 4
  %2452 = load i32, i32* %x538.addr, align 4
  %2453 = call i64 @p256FiatAddcarryxU32(i32 %2450, i32 %2451, i32 %2452)
  store i64 %2453, i64* %w551.addr, align 8
  %2454 = load i64, i64* %w551.addr, align 8
  %2455 = trunc i64 %2454 to i32
  store i32 %2455, i32* %x551.addr, align 4
  %2456 = load i64, i64* %w551.addr, align 8
  %2457 = lshr i64 %2456, 32
  %2458 = trunc i64 %2457 to i32
  store i32 %2458, i32* %x552.addr, align 4
  %2459 = load i32, i32* %x552.addr, align 4
  %2460 = load i32, i32* %x508.addr, align 4
  %2461 = load i32, i32* %x540.addr, align 4
  %2462 = call i64 @p256FiatAddcarryxU32(i32 %2459, i32 %2460, i32 %2461)
  store i64 %2462, i64* %w553.addr, align 8
  %2463 = load i64, i64* %w553.addr, align 8
  %2464 = trunc i64 %2463 to i32
  store i32 %2464, i32* %x553.addr, align 4
  %2465 = load i64, i64* %w553.addr, align 8
  %2466 = lshr i64 %2465, 32
  %2467 = trunc i64 %2466 to i32
  store i32 %2467, i32* %x554.addr, align 4
  %2468 = load i32, i32* %x554.addr, align 4
  %2469 = load i32, i32* %x510.addr, align 4
  %2470 = load i32, i32* %x516.addr, align 4
  %2471 = call i64 @p256FiatAddcarryxU32(i32 %2468, i32 %2469, i32 %2470)
  store i64 %2471, i64* %w555.addr, align 8
  %2472 = load i64, i64* %w555.addr, align 8
  %2473 = trunc i64 %2472 to i32
  store i32 %2473, i32* %x555.addr, align 4
  %2474 = load i64, i64* %w555.addr, align 8
  %2475 = lshr i64 %2474, 32
  %2476 = trunc i64 %2475 to i32
  store i32 %2476, i32* %x556.addr, align 4
  %2477 = load i32, i32* %x556.addr, align 4
  %2478 = load i32, i32* %x512.addr, align 4
  %2479 = load i32, i32* %x517.addr, align 4
  %2480 = call i64 @p256FiatAddcarryxU32(i32 %2477, i32 %2478, i32 %2479)
  store i64 %2480, i64* %w557.addr, align 8
  %2481 = load i64, i64* %w557.addr, align 8
  %2482 = trunc i64 %2481 to i32
  store i32 %2482, i32* %x557.addr, align 4
  %2483 = load i64, i64* %w557.addr, align 8
  %2484 = lshr i64 %2483, 32
  %2485 = trunc i64 %2484 to i32
  store i32 %2485, i32* %x558.addr, align 4
  %2486 = load i32, i32* %x558.addr, align 4
  %2487 = load i32, i32* %x513.addr, align 4
  %2488 = add i32 %2486, %2487
  store i32 %2488, i32* %x559.addr, align 4
  %2489 = load i32, i32* %x6.addr, align 4
  %2490 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2491 = load i8*, i8** %2490, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2492 = bitcast i8* %2491 to i32*
  %2493 = getelementptr inbounds i32, i32* %2492, i64 7
  %2494 = load i32, i32* %2493, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2495 = call i64 @p256FiatMulxU32(i32 %2489, i32 %2494)
  store i64 %2495, i64* %w560.addr, align 8
  %2496 = load i64, i64* %w560.addr, align 8
  %2497 = trunc i64 %2496 to i32
  store i32 %2497, i32* %x560.addr, align 4
  %2498 = load i64, i64* %w560.addr, align 8
  %2499 = lshr i64 %2498, 32
  %2500 = trunc i64 %2499 to i32
  store i32 %2500, i32* %x561.addr, align 4
  %2501 = load i32, i32* %x6.addr, align 4
  %2502 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2503 = load i8*, i8** %2502, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2504 = bitcast i8* %2503 to i32*
  %2505 = getelementptr inbounds i32, i32* %2504, i64 6
  %2506 = load i32, i32* %2505, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2507 = call i64 @p256FiatMulxU32(i32 %2501, i32 %2506)
  store i64 %2507, i64* %w562.addr, align 8
  %2508 = load i64, i64* %w562.addr, align 8
  %2509 = trunc i64 %2508 to i32
  store i32 %2509, i32* %x562.addr, align 4
  %2510 = load i64, i64* %w562.addr, align 8
  %2511 = lshr i64 %2510, 32
  %2512 = trunc i64 %2511 to i32
  store i32 %2512, i32* %x563.addr, align 4
  %2513 = load i32, i32* %x6.addr, align 4
  %2514 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2515 = load i8*, i8** %2514, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2516 = bitcast i8* %2515 to i32*
  %2517 = getelementptr inbounds i32, i32* %2516, i64 5
  %2518 = load i32, i32* %2517, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2519 = call i64 @p256FiatMulxU32(i32 %2513, i32 %2518)
  store i64 %2519, i64* %w564.addr, align 8
  %2520 = load i64, i64* %w564.addr, align 8
  %2521 = trunc i64 %2520 to i32
  store i32 %2521, i32* %x564.addr, align 4
  %2522 = load i64, i64* %w564.addr, align 8
  %2523 = lshr i64 %2522, 32
  %2524 = trunc i64 %2523 to i32
  store i32 %2524, i32* %x565.addr, align 4
  %2525 = load i32, i32* %x6.addr, align 4
  %2526 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2527 = load i8*, i8** %2526, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2528 = bitcast i8* %2527 to i32*
  %2529 = getelementptr inbounds i32, i32* %2528, i64 4
  %2530 = load i32, i32* %2529, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2531 = call i64 @p256FiatMulxU32(i32 %2525, i32 %2530)
  store i64 %2531, i64* %w566.addr, align 8
  %2532 = load i64, i64* %w566.addr, align 8
  %2533 = trunc i64 %2532 to i32
  store i32 %2533, i32* %x566.addr, align 4
  %2534 = load i64, i64* %w566.addr, align 8
  %2535 = lshr i64 %2534, 32
  %2536 = trunc i64 %2535 to i32
  store i32 %2536, i32* %x567.addr, align 4
  %2537 = load i32, i32* %x6.addr, align 4
  %2538 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2539 = load i8*, i8** %2538, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2540 = bitcast i8* %2539 to i32*
  %2541 = getelementptr inbounds i32, i32* %2540, i64 3
  %2542 = load i32, i32* %2541, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2543 = call i64 @p256FiatMulxU32(i32 %2537, i32 %2542)
  store i64 %2543, i64* %w568.addr, align 8
  %2544 = load i64, i64* %w568.addr, align 8
  %2545 = trunc i64 %2544 to i32
  store i32 %2545, i32* %x568.addr, align 4
  %2546 = load i64, i64* %w568.addr, align 8
  %2547 = lshr i64 %2546, 32
  %2548 = trunc i64 %2547 to i32
  store i32 %2548, i32* %x569.addr, align 4
  %2549 = load i32, i32* %x6.addr, align 4
  %2550 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2551 = load i8*, i8** %2550, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2552 = bitcast i8* %2551 to i32*
  %2553 = getelementptr inbounds i32, i32* %2552, i64 2
  %2554 = load i32, i32* %2553, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2555 = call i64 @p256FiatMulxU32(i32 %2549, i32 %2554)
  store i64 %2555, i64* %w570.addr, align 8
  %2556 = load i64, i64* %w570.addr, align 8
  %2557 = trunc i64 %2556 to i32
  store i32 %2557, i32* %x570.addr, align 4
  %2558 = load i64, i64* %w570.addr, align 8
  %2559 = lshr i64 %2558, 32
  %2560 = trunc i64 %2559 to i32
  store i32 %2560, i32* %x571.addr, align 4
  %2561 = load i32, i32* %x6.addr, align 4
  %2562 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2563 = load i8*, i8** %2562, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2564 = bitcast i8* %2563 to i32*
  %2565 = getelementptr inbounds i32, i32* %2564, i64 1
  %2566 = load i32, i32* %2565, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2567 = call i64 @p256FiatMulxU32(i32 %2561, i32 %2566)
  store i64 %2567, i64* %w572.addr, align 8
  %2568 = load i64, i64* %w572.addr, align 8
  %2569 = trunc i64 %2568 to i32
  store i32 %2569, i32* %x572.addr, align 4
  %2570 = load i64, i64* %w572.addr, align 8
  %2571 = lshr i64 %2570, 32
  %2572 = trunc i64 %2571 to i32
  store i32 %2572, i32* %x573.addr, align 4
  %2573 = load i32, i32* %x6.addr, align 4
  %2574 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2575 = load i8*, i8** %2574, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2576 = bitcast i8* %2575 to i32*
  %2577 = getelementptr inbounds i32, i32* %2576, i64 0
  %2578 = load i32, i32* %2577, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2579 = call i64 @p256FiatMulxU32(i32 %2573, i32 %2578)
  store i64 %2579, i64* %w574.addr, align 8
  %2580 = load i64, i64* %w574.addr, align 8
  %2581 = trunc i64 %2580 to i32
  store i32 %2581, i32* %x574.addr, align 4
  %2582 = load i64, i64* %w574.addr, align 8
  %2583 = lshr i64 %2582, 32
  %2584 = trunc i64 %2583 to i32
  store i32 %2584, i32* %x575.addr, align 4
  %2585 = load i32, i32* %x575.addr, align 4
  %2586 = load i32, i32* %x572.addr, align 4
  %2587 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2585, i32 %2586)
  store i64 %2587, i64* %w576.addr, align 8
  %2588 = load i64, i64* %w576.addr, align 8
  %2589 = trunc i64 %2588 to i32
  store i32 %2589, i32* %x576.addr, align 4
  %2590 = load i64, i64* %w576.addr, align 8
  %2591 = lshr i64 %2590, 32
  %2592 = trunc i64 %2591 to i32
  store i32 %2592, i32* %x577.addr, align 4
  %2593 = load i32, i32* %x577.addr, align 4
  %2594 = load i32, i32* %x573.addr, align 4
  %2595 = load i32, i32* %x570.addr, align 4
  %2596 = call i64 @p256FiatAddcarryxU32(i32 %2593, i32 %2594, i32 %2595)
  store i64 %2596, i64* %w578.addr, align 8
  %2597 = load i64, i64* %w578.addr, align 8
  %2598 = trunc i64 %2597 to i32
  store i32 %2598, i32* %x578.addr, align 4
  %2599 = load i64, i64* %w578.addr, align 8
  %2600 = lshr i64 %2599, 32
  %2601 = trunc i64 %2600 to i32
  store i32 %2601, i32* %x579.addr, align 4
  %2602 = load i32, i32* %x579.addr, align 4
  %2603 = load i32, i32* %x571.addr, align 4
  %2604 = load i32, i32* %x568.addr, align 4
  %2605 = call i64 @p256FiatAddcarryxU32(i32 %2602, i32 %2603, i32 %2604)
  store i64 %2605, i64* %w580.addr, align 8
  %2606 = load i64, i64* %w580.addr, align 8
  %2607 = trunc i64 %2606 to i32
  store i32 %2607, i32* %x580.addr, align 4
  %2608 = load i64, i64* %w580.addr, align 8
  %2609 = lshr i64 %2608, 32
  %2610 = trunc i64 %2609 to i32
  store i32 %2610, i32* %x581.addr, align 4
  %2611 = load i32, i32* %x581.addr, align 4
  %2612 = load i32, i32* %x569.addr, align 4
  %2613 = load i32, i32* %x566.addr, align 4
  %2614 = call i64 @p256FiatAddcarryxU32(i32 %2611, i32 %2612, i32 %2613)
  store i64 %2614, i64* %w582.addr, align 8
  %2615 = load i64, i64* %w582.addr, align 8
  %2616 = trunc i64 %2615 to i32
  store i32 %2616, i32* %x582.addr, align 4
  %2617 = load i64, i64* %w582.addr, align 8
  %2618 = lshr i64 %2617, 32
  %2619 = trunc i64 %2618 to i32
  store i32 %2619, i32* %x583.addr, align 4
  %2620 = load i32, i32* %x583.addr, align 4
  %2621 = load i32, i32* %x567.addr, align 4
  %2622 = load i32, i32* %x564.addr, align 4
  %2623 = call i64 @p256FiatAddcarryxU32(i32 %2620, i32 %2621, i32 %2622)
  store i64 %2623, i64* %w584.addr, align 8
  %2624 = load i64, i64* %w584.addr, align 8
  %2625 = trunc i64 %2624 to i32
  store i32 %2625, i32* %x584.addr, align 4
  %2626 = load i64, i64* %w584.addr, align 8
  %2627 = lshr i64 %2626, 32
  %2628 = trunc i64 %2627 to i32
  store i32 %2628, i32* %x585.addr, align 4
  %2629 = load i32, i32* %x585.addr, align 4
  %2630 = load i32, i32* %x565.addr, align 4
  %2631 = load i32, i32* %x562.addr, align 4
  %2632 = call i64 @p256FiatAddcarryxU32(i32 %2629, i32 %2630, i32 %2631)
  store i64 %2632, i64* %w586.addr, align 8
  %2633 = load i64, i64* %w586.addr, align 8
  %2634 = trunc i64 %2633 to i32
  store i32 %2634, i32* %x586.addr, align 4
  %2635 = load i64, i64* %w586.addr, align 8
  %2636 = lshr i64 %2635, 32
  %2637 = trunc i64 %2636 to i32
  store i32 %2637, i32* %x587.addr, align 4
  %2638 = load i32, i32* %x587.addr, align 4
  %2639 = load i32, i32* %x563.addr, align 4
  %2640 = load i32, i32* %x560.addr, align 4
  %2641 = call i64 @p256FiatAddcarryxU32(i32 %2638, i32 %2639, i32 %2640)
  store i64 %2641, i64* %w588.addr, align 8
  %2642 = load i64, i64* %w588.addr, align 8
  %2643 = trunc i64 %2642 to i32
  store i32 %2643, i32* %x588.addr, align 4
  %2644 = load i64, i64* %w588.addr, align 8
  %2645 = lshr i64 %2644, 32
  %2646 = trunc i64 %2645 to i32
  store i32 %2646, i32* %x589.addr, align 4
  %2647 = load i32, i32* %x589.addr, align 4
  %2648 = load i32, i32* %x561.addr, align 4
  %2649 = add i32 %2647, %2648
  store i32 %2649, i32* %x590.addr, align 4
  %2650 = load i32, i32* %x543.addr, align 4
  %2651 = load i32, i32* %x574.addr, align 4
  %2652 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2650, i32 %2651)
  store i64 %2652, i64* %w591.addr, align 8
  %2653 = load i64, i64* %w591.addr, align 8
  %2654 = trunc i64 %2653 to i32
  store i32 %2654, i32* %x591.addr, align 4
  %2655 = load i64, i64* %w591.addr, align 8
  %2656 = lshr i64 %2655, 32
  %2657 = trunc i64 %2656 to i32
  store i32 %2657, i32* %x592.addr, align 4
  %2658 = load i32, i32* %x592.addr, align 4
  %2659 = load i32, i32* %x545.addr, align 4
  %2660 = load i32, i32* %x576.addr, align 4
  %2661 = call i64 @p256FiatAddcarryxU32(i32 %2658, i32 %2659, i32 %2660)
  store i64 %2661, i64* %w593.addr, align 8
  %2662 = load i64, i64* %w593.addr, align 8
  %2663 = trunc i64 %2662 to i32
  store i32 %2663, i32* %x593.addr, align 4
  %2664 = load i64, i64* %w593.addr, align 8
  %2665 = lshr i64 %2664, 32
  %2666 = trunc i64 %2665 to i32
  store i32 %2666, i32* %x594.addr, align 4
  %2667 = load i32, i32* %x594.addr, align 4
  %2668 = load i32, i32* %x547.addr, align 4
  %2669 = load i32, i32* %x578.addr, align 4
  %2670 = call i64 @p256FiatAddcarryxU32(i32 %2667, i32 %2668, i32 %2669)
  store i64 %2670, i64* %w595.addr, align 8
  %2671 = load i64, i64* %w595.addr, align 8
  %2672 = trunc i64 %2671 to i32
  store i32 %2672, i32* %x595.addr, align 4
  %2673 = load i64, i64* %w595.addr, align 8
  %2674 = lshr i64 %2673, 32
  %2675 = trunc i64 %2674 to i32
  store i32 %2675, i32* %x596.addr, align 4
  %2676 = load i32, i32* %x596.addr, align 4
  %2677 = load i32, i32* %x549.addr, align 4
  %2678 = load i32, i32* %x580.addr, align 4
  %2679 = call i64 @p256FiatAddcarryxU32(i32 %2676, i32 %2677, i32 %2678)
  store i64 %2679, i64* %w597.addr, align 8
  %2680 = load i64, i64* %w597.addr, align 8
  %2681 = trunc i64 %2680 to i32
  store i32 %2681, i32* %x597.addr, align 4
  %2682 = load i64, i64* %w597.addr, align 8
  %2683 = lshr i64 %2682, 32
  %2684 = trunc i64 %2683 to i32
  store i32 %2684, i32* %x598.addr, align 4
  %2685 = load i32, i32* %x598.addr, align 4
  %2686 = load i32, i32* %x551.addr, align 4
  %2687 = load i32, i32* %x582.addr, align 4
  %2688 = call i64 @p256FiatAddcarryxU32(i32 %2685, i32 %2686, i32 %2687)
  store i64 %2688, i64* %w599.addr, align 8
  %2689 = load i64, i64* %w599.addr, align 8
  %2690 = trunc i64 %2689 to i32
  store i32 %2690, i32* %x599.addr, align 4
  %2691 = load i64, i64* %w599.addr, align 8
  %2692 = lshr i64 %2691, 32
  %2693 = trunc i64 %2692 to i32
  store i32 %2693, i32* %x600.addr, align 4
  %2694 = load i32, i32* %x600.addr, align 4
  %2695 = load i32, i32* %x553.addr, align 4
  %2696 = load i32, i32* %x584.addr, align 4
  %2697 = call i64 @p256FiatAddcarryxU32(i32 %2694, i32 %2695, i32 %2696)
  store i64 %2697, i64* %w601.addr, align 8
  %2698 = load i64, i64* %w601.addr, align 8
  %2699 = trunc i64 %2698 to i32
  store i32 %2699, i32* %x601.addr, align 4
  %2700 = load i64, i64* %w601.addr, align 8
  %2701 = lshr i64 %2700, 32
  %2702 = trunc i64 %2701 to i32
  store i32 %2702, i32* %x602.addr, align 4
  %2703 = load i32, i32* %x602.addr, align 4
  %2704 = load i32, i32* %x555.addr, align 4
  %2705 = load i32, i32* %x586.addr, align 4
  %2706 = call i64 @p256FiatAddcarryxU32(i32 %2703, i32 %2704, i32 %2705)
  store i64 %2706, i64* %w603.addr, align 8
  %2707 = load i64, i64* %w603.addr, align 8
  %2708 = trunc i64 %2707 to i32
  store i32 %2708, i32* %x603.addr, align 4
  %2709 = load i64, i64* %w603.addr, align 8
  %2710 = lshr i64 %2709, 32
  %2711 = trunc i64 %2710 to i32
  store i32 %2711, i32* %x604.addr, align 4
  %2712 = load i32, i32* %x604.addr, align 4
  %2713 = load i32, i32* %x557.addr, align 4
  %2714 = load i32, i32* %x588.addr, align 4
  %2715 = call i64 @p256FiatAddcarryxU32(i32 %2712, i32 %2713, i32 %2714)
  store i64 %2715, i64* %w605.addr, align 8
  %2716 = load i64, i64* %w605.addr, align 8
  %2717 = trunc i64 %2716 to i32
  store i32 %2717, i32* %x605.addr, align 4
  %2718 = load i64, i64* %w605.addr, align 8
  %2719 = lshr i64 %2718, 32
  %2720 = trunc i64 %2719 to i32
  store i32 %2720, i32* %x606.addr, align 4
  %2721 = load i32, i32* %x606.addr, align 4
  %2722 = load i32, i32* %x559.addr, align 4
  %2723 = load i32, i32* %x590.addr, align 4
  %2724 = call i64 @p256FiatAddcarryxU32(i32 %2721, i32 %2722, i32 %2723)
  store i64 %2724, i64* %w607.addr, align 8
  %2725 = load i64, i64* %w607.addr, align 8
  %2726 = trunc i64 %2725 to i32
  store i32 %2726, i32* %x607.addr, align 4
  %2727 = load i64, i64* %w607.addr, align 8
  %2728 = lshr i64 %2727, 32
  %2729 = trunc i64 %2728 to i32
  store i32 %2729, i32* %x608.addr, align 4
  %2730 = load i32, i32* %x591.addr, align 4
  %2731 = call i64 @p256FiatMulxU32(i32 %2730, i32 3993025615)
  store i64 %2731, i64* %w609.addr, align 8
  %2732 = load i64, i64* %w609.addr, align 8
  %2733 = trunc i64 %2732 to i32
  store i32 %2733, i32* %x609.addr, align 4
  %2734 = load i32, i32* %x609.addr, align 4
  %2735 = call i64 @p256FiatMulxU32(i32 %2734, i32 4294967295)
  store i64 %2735, i64* %w611.addr, align 8
  %2736 = load i64, i64* %w611.addr, align 8
  %2737 = trunc i64 %2736 to i32
  store i32 %2737, i32* %x611.addr, align 4
  %2738 = load i64, i64* %w611.addr, align 8
  %2739 = lshr i64 %2738, 32
  %2740 = trunc i64 %2739 to i32
  store i32 %2740, i32* %x612.addr, align 4
  %2741 = load i32, i32* %x609.addr, align 4
  %2742 = call i64 @p256FiatMulxU32(i32 %2741, i32 4294967295)
  store i64 %2742, i64* %w613.addr, align 8
  %2743 = load i64, i64* %w613.addr, align 8
  %2744 = trunc i64 %2743 to i32
  store i32 %2744, i32* %x613.addr, align 4
  %2745 = load i64, i64* %w613.addr, align 8
  %2746 = lshr i64 %2745, 32
  %2747 = trunc i64 %2746 to i32
  store i32 %2747, i32* %x614.addr, align 4
  %2748 = load i32, i32* %x609.addr, align 4
  %2749 = call i64 @p256FiatMulxU32(i32 %2748, i32 4294967295)
  store i64 %2749, i64* %w615.addr, align 8
  %2750 = load i64, i64* %w615.addr, align 8
  %2751 = trunc i64 %2750 to i32
  store i32 %2751, i32* %x615.addr, align 4
  %2752 = load i64, i64* %w615.addr, align 8
  %2753 = lshr i64 %2752, 32
  %2754 = trunc i64 %2753 to i32
  store i32 %2754, i32* %x616.addr, align 4
  %2755 = load i32, i32* %x609.addr, align 4
  %2756 = call i64 @p256FiatMulxU32(i32 %2755, i32 3169254061)
  store i64 %2756, i64* %w617.addr, align 8
  %2757 = load i64, i64* %w617.addr, align 8
  %2758 = trunc i64 %2757 to i32
  store i32 %2758, i32* %x617.addr, align 4
  %2759 = load i64, i64* %w617.addr, align 8
  %2760 = lshr i64 %2759, 32
  %2761 = trunc i64 %2760 to i32
  store i32 %2761, i32* %x618.addr, align 4
  %2762 = load i32, i32* %x609.addr, align 4
  %2763 = call i64 @p256FiatMulxU32(i32 %2762, i32 2803342980)
  store i64 %2763, i64* %w619.addr, align 8
  %2764 = load i64, i64* %w619.addr, align 8
  %2765 = trunc i64 %2764 to i32
  store i32 %2765, i32* %x619.addr, align 4
  %2766 = load i64, i64* %w619.addr, align 8
  %2767 = lshr i64 %2766, 32
  %2768 = trunc i64 %2767 to i32
  store i32 %2768, i32* %x620.addr, align 4
  %2769 = load i32, i32* %x609.addr, align 4
  %2770 = call i64 @p256FiatMulxU32(i32 %2769, i32 4089039554)
  store i64 %2770, i64* %w621.addr, align 8
  %2771 = load i64, i64* %w621.addr, align 8
  %2772 = trunc i64 %2771 to i32
  store i32 %2772, i32* %x621.addr, align 4
  %2773 = load i64, i64* %w621.addr, align 8
  %2774 = lshr i64 %2773, 32
  %2775 = trunc i64 %2774 to i32
  store i32 %2775, i32* %x622.addr, align 4
  %2776 = load i32, i32* %x609.addr, align 4
  %2777 = call i64 @p256FiatMulxU32(i32 %2776, i32 4234356049)
  store i64 %2777, i64* %w623.addr, align 8
  %2778 = load i64, i64* %w623.addr, align 8
  %2779 = trunc i64 %2778 to i32
  store i32 %2779, i32* %x623.addr, align 4
  %2780 = load i64, i64* %w623.addr, align 8
  %2781 = lshr i64 %2780, 32
  %2782 = trunc i64 %2781 to i32
  store i32 %2782, i32* %x624.addr, align 4
  %2783 = load i32, i32* %x624.addr, align 4
  %2784 = load i32, i32* %x621.addr, align 4
  %2785 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2783, i32 %2784)
  store i64 %2785, i64* %w625.addr, align 8
  %2786 = load i64, i64* %w625.addr, align 8
  %2787 = trunc i64 %2786 to i32
  store i32 %2787, i32* %x625.addr, align 4
  %2788 = load i64, i64* %w625.addr, align 8
  %2789 = lshr i64 %2788, 32
  %2790 = trunc i64 %2789 to i32
  store i32 %2790, i32* %x626.addr, align 4
  %2791 = load i32, i32* %x626.addr, align 4
  %2792 = load i32, i32* %x622.addr, align 4
  %2793 = load i32, i32* %x619.addr, align 4
  %2794 = call i64 @p256FiatAddcarryxU32(i32 %2791, i32 %2792, i32 %2793)
  store i64 %2794, i64* %w627.addr, align 8
  %2795 = load i64, i64* %w627.addr, align 8
  %2796 = trunc i64 %2795 to i32
  store i32 %2796, i32* %x627.addr, align 4
  %2797 = load i64, i64* %w627.addr, align 8
  %2798 = lshr i64 %2797, 32
  %2799 = trunc i64 %2798 to i32
  store i32 %2799, i32* %x628.addr, align 4
  %2800 = load i32, i32* %x628.addr, align 4
  %2801 = load i32, i32* %x620.addr, align 4
  %2802 = load i32, i32* %x617.addr, align 4
  %2803 = call i64 @p256FiatAddcarryxU32(i32 %2800, i32 %2801, i32 %2802)
  store i64 %2803, i64* %w629.addr, align 8
  %2804 = load i64, i64* %w629.addr, align 8
  %2805 = trunc i64 %2804 to i32
  store i32 %2805, i32* %x629.addr, align 4
  %2806 = load i64, i64* %w629.addr, align 8
  %2807 = lshr i64 %2806, 32
  %2808 = trunc i64 %2807 to i32
  store i32 %2808, i32* %x630.addr, align 4
  %2809 = load i32, i32* %x630.addr, align 4
  %2810 = load i32, i32* %x618.addr, align 4
  %2811 = load i32, i32* %x615.addr, align 4
  %2812 = call i64 @p256FiatAddcarryxU32(i32 %2809, i32 %2810, i32 %2811)
  store i64 %2812, i64* %w631.addr, align 8
  %2813 = load i64, i64* %w631.addr, align 8
  %2814 = trunc i64 %2813 to i32
  store i32 %2814, i32* %x631.addr, align 4
  %2815 = load i64, i64* %w631.addr, align 8
  %2816 = lshr i64 %2815, 32
  %2817 = trunc i64 %2816 to i32
  store i32 %2817, i32* %x632.addr, align 4
  %2818 = load i32, i32* %x632.addr, align 4
  %2819 = load i32, i32* %x616.addr, align 4
  %2820 = load i32, i32* %x613.addr, align 4
  %2821 = call i64 @p256FiatAddcarryxU32(i32 %2818, i32 %2819, i32 %2820)
  store i64 %2821, i64* %w633.addr, align 8
  %2822 = load i64, i64* %w633.addr, align 8
  %2823 = trunc i64 %2822 to i32
  store i32 %2823, i32* %x633.addr, align 4
  %2824 = load i64, i64* %w633.addr, align 8
  %2825 = lshr i64 %2824, 32
  %2826 = trunc i64 %2825 to i32
  store i32 %2826, i32* %x634.addr, align 4
  %2827 = load i32, i32* %x634.addr, align 4
  %2828 = load i32, i32* %x614.addr, align 4
  %2829 = add i32 %2827, %2828
  store i32 %2829, i32* %x635.addr, align 4
  %2830 = load i32, i32* %x591.addr, align 4
  %2831 = load i32, i32* %x623.addr, align 4
  %2832 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %2830, i32 %2831)
  store i64 %2832, i64* %w636.addr, align 8
  %2833 = load i64, i64* %w636.addr, align 8
  %2834 = lshr i64 %2833, 32
  %2835 = trunc i64 %2834 to i32
  store i32 %2835, i32* %x637.addr, align 4
  %2836 = load i32, i32* %x637.addr, align 4
  %2837 = load i32, i32* %x593.addr, align 4
  %2838 = load i32, i32* %x625.addr, align 4
  %2839 = call i64 @p256FiatAddcarryxU32(i32 %2836, i32 %2837, i32 %2838)
  store i64 %2839, i64* %w638.addr, align 8
  %2840 = load i64, i64* %w638.addr, align 8
  %2841 = trunc i64 %2840 to i32
  store i32 %2841, i32* %x638.addr, align 4
  %2842 = load i64, i64* %w638.addr, align 8
  %2843 = lshr i64 %2842, 32
  %2844 = trunc i64 %2843 to i32
  store i32 %2844, i32* %x639.addr, align 4
  %2845 = load i32, i32* %x639.addr, align 4
  %2846 = load i32, i32* %x595.addr, align 4
  %2847 = load i32, i32* %x627.addr, align 4
  %2848 = call i64 @p256FiatAddcarryxU32(i32 %2845, i32 %2846, i32 %2847)
  store i64 %2848, i64* %w640.addr, align 8
  %2849 = load i64, i64* %w640.addr, align 8
  %2850 = trunc i64 %2849 to i32
  store i32 %2850, i32* %x640.addr, align 4
  %2851 = load i64, i64* %w640.addr, align 8
  %2852 = lshr i64 %2851, 32
  %2853 = trunc i64 %2852 to i32
  store i32 %2853, i32* %x641.addr, align 4
  %2854 = load i32, i32* %x641.addr, align 4
  %2855 = load i32, i32* %x597.addr, align 4
  %2856 = load i32, i32* %x629.addr, align 4
  %2857 = call i64 @p256FiatAddcarryxU32(i32 %2854, i32 %2855, i32 %2856)
  store i64 %2857, i64* %w642.addr, align 8
  %2858 = load i64, i64* %w642.addr, align 8
  %2859 = trunc i64 %2858 to i32
  store i32 %2859, i32* %x642.addr, align 4
  %2860 = load i64, i64* %w642.addr, align 8
  %2861 = lshr i64 %2860, 32
  %2862 = trunc i64 %2861 to i32
  store i32 %2862, i32* %x643.addr, align 4
  %2863 = load i32, i32* %x643.addr, align 4
  %2864 = load i32, i32* %x599.addr, align 4
  %2865 = load i32, i32* %x631.addr, align 4
  %2866 = call i64 @p256FiatAddcarryxU32(i32 %2863, i32 %2864, i32 %2865)
  store i64 %2866, i64* %w644.addr, align 8
  %2867 = load i64, i64* %w644.addr, align 8
  %2868 = trunc i64 %2867 to i32
  store i32 %2868, i32* %x644.addr, align 4
  %2869 = load i64, i64* %w644.addr, align 8
  %2870 = lshr i64 %2869, 32
  %2871 = trunc i64 %2870 to i32
  store i32 %2871, i32* %x645.addr, align 4
  %2872 = load i32, i32* %x645.addr, align 4
  %2873 = load i32, i32* %x601.addr, align 4
  %2874 = load i32, i32* %x633.addr, align 4
  %2875 = call i64 @p256FiatAddcarryxU32(i32 %2872, i32 %2873, i32 %2874)
  store i64 %2875, i64* %w646.addr, align 8
  %2876 = load i64, i64* %w646.addr, align 8
  %2877 = trunc i64 %2876 to i32
  store i32 %2877, i32* %x646.addr, align 4
  %2878 = load i64, i64* %w646.addr, align 8
  %2879 = lshr i64 %2878, 32
  %2880 = trunc i64 %2879 to i32
  store i32 %2880, i32* %x647.addr, align 4
  %2881 = load i32, i32* %x647.addr, align 4
  %2882 = load i32, i32* %x603.addr, align 4
  %2883 = load i32, i32* %x635.addr, align 4
  %2884 = call i64 @p256FiatAddcarryxU32(i32 %2881, i32 %2882, i32 %2883)
  store i64 %2884, i64* %w648.addr, align 8
  %2885 = load i64, i64* %w648.addr, align 8
  %2886 = trunc i64 %2885 to i32
  store i32 %2886, i32* %x648.addr, align 4
  %2887 = load i64, i64* %w648.addr, align 8
  %2888 = lshr i64 %2887, 32
  %2889 = trunc i64 %2888 to i32
  store i32 %2889, i32* %x649.addr, align 4
  %2890 = load i32, i32* %x649.addr, align 4
  %2891 = load i32, i32* %x605.addr, align 4
  %2892 = load i32, i32* %x611.addr, align 4
  %2893 = call i64 @p256FiatAddcarryxU32(i32 %2890, i32 %2891, i32 %2892)
  store i64 %2893, i64* %w650.addr, align 8
  %2894 = load i64, i64* %w650.addr, align 8
  %2895 = trunc i64 %2894 to i32
  store i32 %2895, i32* %x650.addr, align 4
  %2896 = load i64, i64* %w650.addr, align 8
  %2897 = lshr i64 %2896, 32
  %2898 = trunc i64 %2897 to i32
  store i32 %2898, i32* %x651.addr, align 4
  %2899 = load i32, i32* %x651.addr, align 4
  %2900 = load i32, i32* %x607.addr, align 4
  %2901 = load i32, i32* %x612.addr, align 4
  %2902 = call i64 @p256FiatAddcarryxU32(i32 %2899, i32 %2900, i32 %2901)
  store i64 %2902, i64* %w652.addr, align 8
  %2903 = load i64, i64* %w652.addr, align 8
  %2904 = trunc i64 %2903 to i32
  store i32 %2904, i32* %x652.addr, align 4
  %2905 = load i64, i64* %w652.addr, align 8
  %2906 = lshr i64 %2905, 32
  %2907 = trunc i64 %2906 to i32
  store i32 %2907, i32* %x653.addr, align 4
  %2908 = load i32, i32* %x653.addr, align 4
  %2909 = load i32, i32* %x608.addr, align 4
  %2910 = add i32 %2908, %2909
  store i32 %2910, i32* %x654.addr, align 4
  %2911 = load i32, i32* %x7.addr, align 4
  %2912 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2913 = load i8*, i8** %2912, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2914 = bitcast i8* %2913 to i32*
  %2915 = getelementptr inbounds i32, i32* %2914, i64 7
  %2916 = load i32, i32* %2915, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2917 = call i64 @p256FiatMulxU32(i32 %2911, i32 %2916)
  store i64 %2917, i64* %w655.addr, align 8
  %2918 = load i64, i64* %w655.addr, align 8
  %2919 = trunc i64 %2918 to i32
  store i32 %2919, i32* %x655.addr, align 4
  %2920 = load i64, i64* %w655.addr, align 8
  %2921 = lshr i64 %2920, 32
  %2922 = trunc i64 %2921 to i32
  store i32 %2922, i32* %x656.addr, align 4
  %2923 = load i32, i32* %x7.addr, align 4
  %2924 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2925 = load i8*, i8** %2924, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2926 = bitcast i8* %2925 to i32*
  %2927 = getelementptr inbounds i32, i32* %2926, i64 6
  %2928 = load i32, i32* %2927, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2929 = call i64 @p256FiatMulxU32(i32 %2923, i32 %2928)
  store i64 %2929, i64* %w657.addr, align 8
  %2930 = load i64, i64* %w657.addr, align 8
  %2931 = trunc i64 %2930 to i32
  store i32 %2931, i32* %x657.addr, align 4
  %2932 = load i64, i64* %w657.addr, align 8
  %2933 = lshr i64 %2932, 32
  %2934 = trunc i64 %2933 to i32
  store i32 %2934, i32* %x658.addr, align 4
  %2935 = load i32, i32* %x7.addr, align 4
  %2936 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2937 = load i8*, i8** %2936, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2938 = bitcast i8* %2937 to i32*
  %2939 = getelementptr inbounds i32, i32* %2938, i64 5
  %2940 = load i32, i32* %2939, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2941 = call i64 @p256FiatMulxU32(i32 %2935, i32 %2940)
  store i64 %2941, i64* %w659.addr, align 8
  %2942 = load i64, i64* %w659.addr, align 8
  %2943 = trunc i64 %2942 to i32
  store i32 %2943, i32* %x659.addr, align 4
  %2944 = load i64, i64* %w659.addr, align 8
  %2945 = lshr i64 %2944, 32
  %2946 = trunc i64 %2945 to i32
  store i32 %2946, i32* %x660.addr, align 4
  %2947 = load i32, i32* %x7.addr, align 4
  %2948 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2949 = load i8*, i8** %2948, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2950 = bitcast i8* %2949 to i32*
  %2951 = getelementptr inbounds i32, i32* %2950, i64 4
  %2952 = load i32, i32* %2951, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2953 = call i64 @p256FiatMulxU32(i32 %2947, i32 %2952)
  store i64 %2953, i64* %w661.addr, align 8
  %2954 = load i64, i64* %w661.addr, align 8
  %2955 = trunc i64 %2954 to i32
  store i32 %2955, i32* %x661.addr, align 4
  %2956 = load i64, i64* %w661.addr, align 8
  %2957 = lshr i64 %2956, 32
  %2958 = trunc i64 %2957 to i32
  store i32 %2958, i32* %x662.addr, align 4
  %2959 = load i32, i32* %x7.addr, align 4
  %2960 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2961 = load i8*, i8** %2960, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2962 = bitcast i8* %2961 to i32*
  %2963 = getelementptr inbounds i32, i32* %2962, i64 3
  %2964 = load i32, i32* %2963, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2965 = call i64 @p256FiatMulxU32(i32 %2959, i32 %2964)
  store i64 %2965, i64* %w663.addr, align 8
  %2966 = load i64, i64* %w663.addr, align 8
  %2967 = trunc i64 %2966 to i32
  store i32 %2967, i32* %x663.addr, align 4
  %2968 = load i64, i64* %w663.addr, align 8
  %2969 = lshr i64 %2968, 32
  %2970 = trunc i64 %2969 to i32
  store i32 %2970, i32* %x664.addr, align 4
  %2971 = load i32, i32* %x7.addr, align 4
  %2972 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2973 = load i8*, i8** %2972, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2974 = bitcast i8* %2973 to i32*
  %2975 = getelementptr inbounds i32, i32* %2974, i64 2
  %2976 = load i32, i32* %2975, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2977 = call i64 @p256FiatMulxU32(i32 %2971, i32 %2976)
  store i64 %2977, i64* %w665.addr, align 8
  %2978 = load i64, i64* %w665.addr, align 8
  %2979 = trunc i64 %2978 to i32
  store i32 %2979, i32* %x665.addr, align 4
  %2980 = load i64, i64* %w665.addr, align 8
  %2981 = lshr i64 %2980, 32
  %2982 = trunc i64 %2981 to i32
  store i32 %2982, i32* %x666.addr, align 4
  %2983 = load i32, i32* %x7.addr, align 4
  %2984 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2985 = load i8*, i8** %2984, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2986 = bitcast i8* %2985 to i32*
  %2987 = getelementptr inbounds i32, i32* %2986, i64 1
  %2988 = load i32, i32* %2987, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %2989 = call i64 @p256FiatMulxU32(i32 %2983, i32 %2988)
  store i64 %2989, i64* %w667.addr, align 8
  %2990 = load i64, i64* %w667.addr, align 8
  %2991 = trunc i64 %2990 to i32
  store i32 %2991, i32* %x667.addr, align 4
  %2992 = load i64, i64* %w667.addr, align 8
  %2993 = lshr i64 %2992, 32
  %2994 = trunc i64 %2993 to i32
  store i32 %2994, i32* %x668.addr, align 4
  %2995 = load i32, i32* %x7.addr, align 4
  %2996 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %2997 = load i8*, i8** %2996, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2998 = bitcast i8* %2997 to i32*
  %2999 = getelementptr inbounds i32, i32* %2998, i64 0
  %3000 = load i32, i32* %2999, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3001 = call i64 @p256FiatMulxU32(i32 %2995, i32 %3000)
  store i64 %3001, i64* %w669.addr, align 8
  %3002 = load i64, i64* %w669.addr, align 8
  %3003 = trunc i64 %3002 to i32
  store i32 %3003, i32* %x669.addr, align 4
  %3004 = load i64, i64* %w669.addr, align 8
  %3005 = lshr i64 %3004, 32
  %3006 = trunc i64 %3005 to i32
  store i32 %3006, i32* %x670.addr, align 4
  %3007 = load i32, i32* %x670.addr, align 4
  %3008 = load i32, i32* %x667.addr, align 4
  %3009 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %3007, i32 %3008)
  store i64 %3009, i64* %w671.addr, align 8
  %3010 = load i64, i64* %w671.addr, align 8
  %3011 = trunc i64 %3010 to i32
  store i32 %3011, i32* %x671.addr, align 4
  %3012 = load i64, i64* %w671.addr, align 8
  %3013 = lshr i64 %3012, 32
  %3014 = trunc i64 %3013 to i32
  store i32 %3014, i32* %x672.addr, align 4
  %3015 = load i32, i32* %x672.addr, align 4
  %3016 = load i32, i32* %x668.addr, align 4
  %3017 = load i32, i32* %x665.addr, align 4
  %3018 = call i64 @p256FiatAddcarryxU32(i32 %3015, i32 %3016, i32 %3017)
  store i64 %3018, i64* %w673.addr, align 8
  %3019 = load i64, i64* %w673.addr, align 8
  %3020 = trunc i64 %3019 to i32
  store i32 %3020, i32* %x673.addr, align 4
  %3021 = load i64, i64* %w673.addr, align 8
  %3022 = lshr i64 %3021, 32
  %3023 = trunc i64 %3022 to i32
  store i32 %3023, i32* %x674.addr, align 4
  %3024 = load i32, i32* %x674.addr, align 4
  %3025 = load i32, i32* %x666.addr, align 4
  %3026 = load i32, i32* %x663.addr, align 4
  %3027 = call i64 @p256FiatAddcarryxU32(i32 %3024, i32 %3025, i32 %3026)
  store i64 %3027, i64* %w675.addr, align 8
  %3028 = load i64, i64* %w675.addr, align 8
  %3029 = trunc i64 %3028 to i32
  store i32 %3029, i32* %x675.addr, align 4
  %3030 = load i64, i64* %w675.addr, align 8
  %3031 = lshr i64 %3030, 32
  %3032 = trunc i64 %3031 to i32
  store i32 %3032, i32* %x676.addr, align 4
  %3033 = load i32, i32* %x676.addr, align 4
  %3034 = load i32, i32* %x664.addr, align 4
  %3035 = load i32, i32* %x661.addr, align 4
  %3036 = call i64 @p256FiatAddcarryxU32(i32 %3033, i32 %3034, i32 %3035)
  store i64 %3036, i64* %w677.addr, align 8
  %3037 = load i64, i64* %w677.addr, align 8
  %3038 = trunc i64 %3037 to i32
  store i32 %3038, i32* %x677.addr, align 4
  %3039 = load i64, i64* %w677.addr, align 8
  %3040 = lshr i64 %3039, 32
  %3041 = trunc i64 %3040 to i32
  store i32 %3041, i32* %x678.addr, align 4
  %3042 = load i32, i32* %x678.addr, align 4
  %3043 = load i32, i32* %x662.addr, align 4
  %3044 = load i32, i32* %x659.addr, align 4
  %3045 = call i64 @p256FiatAddcarryxU32(i32 %3042, i32 %3043, i32 %3044)
  store i64 %3045, i64* %w679.addr, align 8
  %3046 = load i64, i64* %w679.addr, align 8
  %3047 = trunc i64 %3046 to i32
  store i32 %3047, i32* %x679.addr, align 4
  %3048 = load i64, i64* %w679.addr, align 8
  %3049 = lshr i64 %3048, 32
  %3050 = trunc i64 %3049 to i32
  store i32 %3050, i32* %x680.addr, align 4
  %3051 = load i32, i32* %x680.addr, align 4
  %3052 = load i32, i32* %x660.addr, align 4
  %3053 = load i32, i32* %x657.addr, align 4
  %3054 = call i64 @p256FiatAddcarryxU32(i32 %3051, i32 %3052, i32 %3053)
  store i64 %3054, i64* %w681.addr, align 8
  %3055 = load i64, i64* %w681.addr, align 8
  %3056 = trunc i64 %3055 to i32
  store i32 %3056, i32* %x681.addr, align 4
  %3057 = load i64, i64* %w681.addr, align 8
  %3058 = lshr i64 %3057, 32
  %3059 = trunc i64 %3058 to i32
  store i32 %3059, i32* %x682.addr, align 4
  %3060 = load i32, i32* %x682.addr, align 4
  %3061 = load i32, i32* %x658.addr, align 4
  %3062 = load i32, i32* %x655.addr, align 4
  %3063 = call i64 @p256FiatAddcarryxU32(i32 %3060, i32 %3061, i32 %3062)
  store i64 %3063, i64* %w683.addr, align 8
  %3064 = load i64, i64* %w683.addr, align 8
  %3065 = trunc i64 %3064 to i32
  store i32 %3065, i32* %x683.addr, align 4
  %3066 = load i64, i64* %w683.addr, align 8
  %3067 = lshr i64 %3066, 32
  %3068 = trunc i64 %3067 to i32
  store i32 %3068, i32* %x684.addr, align 4
  %3069 = load i32, i32* %x684.addr, align 4
  %3070 = load i32, i32* %x656.addr, align 4
  %3071 = add i32 %3069, %3070
  store i32 %3071, i32* %x685.addr, align 4
  %3072 = load i32, i32* %x638.addr, align 4
  %3073 = load i32, i32* %x669.addr, align 4
  %3074 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %3072, i32 %3073)
  store i64 %3074, i64* %w686.addr, align 8
  %3075 = load i64, i64* %w686.addr, align 8
  %3076 = trunc i64 %3075 to i32
  store i32 %3076, i32* %x686.addr, align 4
  %3077 = load i64, i64* %w686.addr, align 8
  %3078 = lshr i64 %3077, 32
  %3079 = trunc i64 %3078 to i32
  store i32 %3079, i32* %x687.addr, align 4
  %3080 = load i32, i32* %x687.addr, align 4
  %3081 = load i32, i32* %x640.addr, align 4
  %3082 = load i32, i32* %x671.addr, align 4
  %3083 = call i64 @p256FiatAddcarryxU32(i32 %3080, i32 %3081, i32 %3082)
  store i64 %3083, i64* %w688.addr, align 8
  %3084 = load i64, i64* %w688.addr, align 8
  %3085 = trunc i64 %3084 to i32
  store i32 %3085, i32* %x688.addr, align 4
  %3086 = load i64, i64* %w688.addr, align 8
  %3087 = lshr i64 %3086, 32
  %3088 = trunc i64 %3087 to i32
  store i32 %3088, i32* %x689.addr, align 4
  %3089 = load i32, i32* %x689.addr, align 4
  %3090 = load i32, i32* %x642.addr, align 4
  %3091 = load i32, i32* %x673.addr, align 4
  %3092 = call i64 @p256FiatAddcarryxU32(i32 %3089, i32 %3090, i32 %3091)
  store i64 %3092, i64* %w690.addr, align 8
  %3093 = load i64, i64* %w690.addr, align 8
  %3094 = trunc i64 %3093 to i32
  store i32 %3094, i32* %x690.addr, align 4
  %3095 = load i64, i64* %w690.addr, align 8
  %3096 = lshr i64 %3095, 32
  %3097 = trunc i64 %3096 to i32
  store i32 %3097, i32* %x691.addr, align 4
  %3098 = load i32, i32* %x691.addr, align 4
  %3099 = load i32, i32* %x644.addr, align 4
  %3100 = load i32, i32* %x675.addr, align 4
  %3101 = call i64 @p256FiatAddcarryxU32(i32 %3098, i32 %3099, i32 %3100)
  store i64 %3101, i64* %w692.addr, align 8
  %3102 = load i64, i64* %w692.addr, align 8
  %3103 = trunc i64 %3102 to i32
  store i32 %3103, i32* %x692.addr, align 4
  %3104 = load i64, i64* %w692.addr, align 8
  %3105 = lshr i64 %3104, 32
  %3106 = trunc i64 %3105 to i32
  store i32 %3106, i32* %x693.addr, align 4
  %3107 = load i32, i32* %x693.addr, align 4
  %3108 = load i32, i32* %x646.addr, align 4
  %3109 = load i32, i32* %x677.addr, align 4
  %3110 = call i64 @p256FiatAddcarryxU32(i32 %3107, i32 %3108, i32 %3109)
  store i64 %3110, i64* %w694.addr, align 8
  %3111 = load i64, i64* %w694.addr, align 8
  %3112 = trunc i64 %3111 to i32
  store i32 %3112, i32* %x694.addr, align 4
  %3113 = load i64, i64* %w694.addr, align 8
  %3114 = lshr i64 %3113, 32
  %3115 = trunc i64 %3114 to i32
  store i32 %3115, i32* %x695.addr, align 4
  %3116 = load i32, i32* %x695.addr, align 4
  %3117 = load i32, i32* %x648.addr, align 4
  %3118 = load i32, i32* %x679.addr, align 4
  %3119 = call i64 @p256FiatAddcarryxU32(i32 %3116, i32 %3117, i32 %3118)
  store i64 %3119, i64* %w696.addr, align 8
  %3120 = load i64, i64* %w696.addr, align 8
  %3121 = trunc i64 %3120 to i32
  store i32 %3121, i32* %x696.addr, align 4
  %3122 = load i64, i64* %w696.addr, align 8
  %3123 = lshr i64 %3122, 32
  %3124 = trunc i64 %3123 to i32
  store i32 %3124, i32* %x697.addr, align 4
  %3125 = load i32, i32* %x697.addr, align 4
  %3126 = load i32, i32* %x650.addr, align 4
  %3127 = load i32, i32* %x681.addr, align 4
  %3128 = call i64 @p256FiatAddcarryxU32(i32 %3125, i32 %3126, i32 %3127)
  store i64 %3128, i64* %w698.addr, align 8
  %3129 = load i64, i64* %w698.addr, align 8
  %3130 = trunc i64 %3129 to i32
  store i32 %3130, i32* %x698.addr, align 4
  %3131 = load i64, i64* %w698.addr, align 8
  %3132 = lshr i64 %3131, 32
  %3133 = trunc i64 %3132 to i32
  store i32 %3133, i32* %x699.addr, align 4
  %3134 = load i32, i32* %x699.addr, align 4
  %3135 = load i32, i32* %x652.addr, align 4
  %3136 = load i32, i32* %x683.addr, align 4
  %3137 = call i64 @p256FiatAddcarryxU32(i32 %3134, i32 %3135, i32 %3136)
  store i64 %3137, i64* %w700.addr, align 8
  %3138 = load i64, i64* %w700.addr, align 8
  %3139 = trunc i64 %3138 to i32
  store i32 %3139, i32* %x700.addr, align 4
  %3140 = load i64, i64* %w700.addr, align 8
  %3141 = lshr i64 %3140, 32
  %3142 = trunc i64 %3141 to i32
  store i32 %3142, i32* %x701.addr, align 4
  %3143 = load i32, i32* %x701.addr, align 4
  %3144 = load i32, i32* %x654.addr, align 4
  %3145 = load i32, i32* %x685.addr, align 4
  %3146 = call i64 @p256FiatAddcarryxU32(i32 %3143, i32 %3144, i32 %3145)
  store i64 %3146, i64* %w702.addr, align 8
  %3147 = load i64, i64* %w702.addr, align 8
  %3148 = trunc i64 %3147 to i32
  store i32 %3148, i32* %x702.addr, align 4
  %3149 = load i64, i64* %w702.addr, align 8
  %3150 = lshr i64 %3149, 32
  %3151 = trunc i64 %3150 to i32
  store i32 %3151, i32* %x703.addr, align 4
  %3152 = load i32, i32* %x686.addr, align 4
  %3153 = call i64 @p256FiatMulxU32(i32 %3152, i32 3993025615)
  store i64 %3153, i64* %w704.addr, align 8
  %3154 = load i64, i64* %w704.addr, align 8
  %3155 = trunc i64 %3154 to i32
  store i32 %3155, i32* %x704.addr, align 4
  %3156 = load i32, i32* %x704.addr, align 4
  %3157 = call i64 @p256FiatMulxU32(i32 %3156, i32 4294967295)
  store i64 %3157, i64* %w706.addr, align 8
  %3158 = load i64, i64* %w706.addr, align 8
  %3159 = trunc i64 %3158 to i32
  store i32 %3159, i32* %x706.addr, align 4
  %3160 = load i64, i64* %w706.addr, align 8
  %3161 = lshr i64 %3160, 32
  %3162 = trunc i64 %3161 to i32
  store i32 %3162, i32* %x707.addr, align 4
  %3163 = load i32, i32* %x704.addr, align 4
  %3164 = call i64 @p256FiatMulxU32(i32 %3163, i32 4294967295)
  store i64 %3164, i64* %w708.addr, align 8
  %3165 = load i64, i64* %w708.addr, align 8
  %3166 = trunc i64 %3165 to i32
  store i32 %3166, i32* %x708.addr, align 4
  %3167 = load i64, i64* %w708.addr, align 8
  %3168 = lshr i64 %3167, 32
  %3169 = trunc i64 %3168 to i32
  store i32 %3169, i32* %x709.addr, align 4
  %3170 = load i32, i32* %x704.addr, align 4
  %3171 = call i64 @p256FiatMulxU32(i32 %3170, i32 4294967295)
  store i64 %3171, i64* %w710.addr, align 8
  %3172 = load i64, i64* %w710.addr, align 8
  %3173 = trunc i64 %3172 to i32
  store i32 %3173, i32* %x710.addr, align 4
  %3174 = load i64, i64* %w710.addr, align 8
  %3175 = lshr i64 %3174, 32
  %3176 = trunc i64 %3175 to i32
  store i32 %3176, i32* %x711.addr, align 4
  %3177 = load i32, i32* %x704.addr, align 4
  %3178 = call i64 @p256FiatMulxU32(i32 %3177, i32 3169254061)
  store i64 %3178, i64* %w712.addr, align 8
  %3179 = load i64, i64* %w712.addr, align 8
  %3180 = trunc i64 %3179 to i32
  store i32 %3180, i32* %x712.addr, align 4
  %3181 = load i64, i64* %w712.addr, align 8
  %3182 = lshr i64 %3181, 32
  %3183 = trunc i64 %3182 to i32
  store i32 %3183, i32* %x713.addr, align 4
  %3184 = load i32, i32* %x704.addr, align 4
  %3185 = call i64 @p256FiatMulxU32(i32 %3184, i32 2803342980)
  store i64 %3185, i64* %w714.addr, align 8
  %3186 = load i64, i64* %w714.addr, align 8
  %3187 = trunc i64 %3186 to i32
  store i32 %3187, i32* %x714.addr, align 4
  %3188 = load i64, i64* %w714.addr, align 8
  %3189 = lshr i64 %3188, 32
  %3190 = trunc i64 %3189 to i32
  store i32 %3190, i32* %x715.addr, align 4
  %3191 = load i32, i32* %x704.addr, align 4
  %3192 = call i64 @p256FiatMulxU32(i32 %3191, i32 4089039554)
  store i64 %3192, i64* %w716.addr, align 8
  %3193 = load i64, i64* %w716.addr, align 8
  %3194 = trunc i64 %3193 to i32
  store i32 %3194, i32* %x716.addr, align 4
  %3195 = load i64, i64* %w716.addr, align 8
  %3196 = lshr i64 %3195, 32
  %3197 = trunc i64 %3196 to i32
  store i32 %3197, i32* %x717.addr, align 4
  %3198 = load i32, i32* %x704.addr, align 4
  %3199 = call i64 @p256FiatMulxU32(i32 %3198, i32 4234356049)
  store i64 %3199, i64* %w718.addr, align 8
  %3200 = load i64, i64* %w718.addr, align 8
  %3201 = trunc i64 %3200 to i32
  store i32 %3201, i32* %x718.addr, align 4
  %3202 = load i64, i64* %w718.addr, align 8
  %3203 = lshr i64 %3202, 32
  %3204 = trunc i64 %3203 to i32
  store i32 %3204, i32* %x719.addr, align 4
  %3205 = load i32, i32* %x719.addr, align 4
  %3206 = load i32, i32* %x716.addr, align 4
  %3207 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %3205, i32 %3206)
  store i64 %3207, i64* %w720.addr, align 8
  %3208 = load i64, i64* %w720.addr, align 8
  %3209 = trunc i64 %3208 to i32
  store i32 %3209, i32* %x720.addr, align 4
  %3210 = load i64, i64* %w720.addr, align 8
  %3211 = lshr i64 %3210, 32
  %3212 = trunc i64 %3211 to i32
  store i32 %3212, i32* %x721.addr, align 4
  %3213 = load i32, i32* %x721.addr, align 4
  %3214 = load i32, i32* %x717.addr, align 4
  %3215 = load i32, i32* %x714.addr, align 4
  %3216 = call i64 @p256FiatAddcarryxU32(i32 %3213, i32 %3214, i32 %3215)
  store i64 %3216, i64* %w722.addr, align 8
  %3217 = load i64, i64* %w722.addr, align 8
  %3218 = trunc i64 %3217 to i32
  store i32 %3218, i32* %x722.addr, align 4
  %3219 = load i64, i64* %w722.addr, align 8
  %3220 = lshr i64 %3219, 32
  %3221 = trunc i64 %3220 to i32
  store i32 %3221, i32* %x723.addr, align 4
  %3222 = load i32, i32* %x723.addr, align 4
  %3223 = load i32, i32* %x715.addr, align 4
  %3224 = load i32, i32* %x712.addr, align 4
  %3225 = call i64 @p256FiatAddcarryxU32(i32 %3222, i32 %3223, i32 %3224)
  store i64 %3225, i64* %w724.addr, align 8
  %3226 = load i64, i64* %w724.addr, align 8
  %3227 = trunc i64 %3226 to i32
  store i32 %3227, i32* %x724.addr, align 4
  %3228 = load i64, i64* %w724.addr, align 8
  %3229 = lshr i64 %3228, 32
  %3230 = trunc i64 %3229 to i32
  store i32 %3230, i32* %x725.addr, align 4
  %3231 = load i32, i32* %x725.addr, align 4
  %3232 = load i32, i32* %x713.addr, align 4
  %3233 = load i32, i32* %x710.addr, align 4
  %3234 = call i64 @p256FiatAddcarryxU32(i32 %3231, i32 %3232, i32 %3233)
  store i64 %3234, i64* %w726.addr, align 8
  %3235 = load i64, i64* %w726.addr, align 8
  %3236 = trunc i64 %3235 to i32
  store i32 %3236, i32* %x726.addr, align 4
  %3237 = load i64, i64* %w726.addr, align 8
  %3238 = lshr i64 %3237, 32
  %3239 = trunc i64 %3238 to i32
  store i32 %3239, i32* %x727.addr, align 4
  %3240 = load i32, i32* %x727.addr, align 4
  %3241 = load i32, i32* %x711.addr, align 4
  %3242 = load i32, i32* %x708.addr, align 4
  %3243 = call i64 @p256FiatAddcarryxU32(i32 %3240, i32 %3241, i32 %3242)
  store i64 %3243, i64* %w728.addr, align 8
  %3244 = load i64, i64* %w728.addr, align 8
  %3245 = trunc i64 %3244 to i32
  store i32 %3245, i32* %x728.addr, align 4
  %3246 = load i64, i64* %w728.addr, align 8
  %3247 = lshr i64 %3246, 32
  %3248 = trunc i64 %3247 to i32
  store i32 %3248, i32* %x729.addr, align 4
  %3249 = load i32, i32* %x729.addr, align 4
  %3250 = load i32, i32* %x709.addr, align 4
  %3251 = add i32 %3249, %3250
  store i32 %3251, i32* %x730.addr, align 4
  %3252 = load i32, i32* %x686.addr, align 4
  %3253 = load i32, i32* %x718.addr, align 4
  %3254 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %3252, i32 %3253)
  store i64 %3254, i64* %w731.addr, align 8
  %3255 = load i64, i64* %w731.addr, align 8
  %3256 = lshr i64 %3255, 32
  %3257 = trunc i64 %3256 to i32
  store i32 %3257, i32* %x732.addr, align 4
  %3258 = load i32, i32* %x732.addr, align 4
  %3259 = load i32, i32* %x688.addr, align 4
  %3260 = load i32, i32* %x720.addr, align 4
  %3261 = call i64 @p256FiatAddcarryxU32(i32 %3258, i32 %3259, i32 %3260)
  store i64 %3261, i64* %w733.addr, align 8
  %3262 = load i64, i64* %w733.addr, align 8
  %3263 = trunc i64 %3262 to i32
  store i32 %3263, i32* %x733.addr, align 4
  %3264 = load i64, i64* %w733.addr, align 8
  %3265 = lshr i64 %3264, 32
  %3266 = trunc i64 %3265 to i32
  store i32 %3266, i32* %x734.addr, align 4
  %3267 = load i32, i32* %x734.addr, align 4
  %3268 = load i32, i32* %x690.addr, align 4
  %3269 = load i32, i32* %x722.addr, align 4
  %3270 = call i64 @p256FiatAddcarryxU32(i32 %3267, i32 %3268, i32 %3269)
  store i64 %3270, i64* %w735.addr, align 8
  %3271 = load i64, i64* %w735.addr, align 8
  %3272 = trunc i64 %3271 to i32
  store i32 %3272, i32* %x735.addr, align 4
  %3273 = load i64, i64* %w735.addr, align 8
  %3274 = lshr i64 %3273, 32
  %3275 = trunc i64 %3274 to i32
  store i32 %3275, i32* %x736.addr, align 4
  %3276 = load i32, i32* %x736.addr, align 4
  %3277 = load i32, i32* %x692.addr, align 4
  %3278 = load i32, i32* %x724.addr, align 4
  %3279 = call i64 @p256FiatAddcarryxU32(i32 %3276, i32 %3277, i32 %3278)
  store i64 %3279, i64* %w737.addr, align 8
  %3280 = load i64, i64* %w737.addr, align 8
  %3281 = trunc i64 %3280 to i32
  store i32 %3281, i32* %x737.addr, align 4
  %3282 = load i64, i64* %w737.addr, align 8
  %3283 = lshr i64 %3282, 32
  %3284 = trunc i64 %3283 to i32
  store i32 %3284, i32* %x738.addr, align 4
  %3285 = load i32, i32* %x738.addr, align 4
  %3286 = load i32, i32* %x694.addr, align 4
  %3287 = load i32, i32* %x726.addr, align 4
  %3288 = call i64 @p256FiatAddcarryxU32(i32 %3285, i32 %3286, i32 %3287)
  store i64 %3288, i64* %w739.addr, align 8
  %3289 = load i64, i64* %w739.addr, align 8
  %3290 = trunc i64 %3289 to i32
  store i32 %3290, i32* %x739.addr, align 4
  %3291 = load i64, i64* %w739.addr, align 8
  %3292 = lshr i64 %3291, 32
  %3293 = trunc i64 %3292 to i32
  store i32 %3293, i32* %x740.addr, align 4
  %3294 = load i32, i32* %x740.addr, align 4
  %3295 = load i32, i32* %x696.addr, align 4
  %3296 = load i32, i32* %x728.addr, align 4
  %3297 = call i64 @p256FiatAddcarryxU32(i32 %3294, i32 %3295, i32 %3296)
  store i64 %3297, i64* %w741.addr, align 8
  %3298 = load i64, i64* %w741.addr, align 8
  %3299 = trunc i64 %3298 to i32
  store i32 %3299, i32* %x741.addr, align 4
  %3300 = load i64, i64* %w741.addr, align 8
  %3301 = lshr i64 %3300, 32
  %3302 = trunc i64 %3301 to i32
  store i32 %3302, i32* %x742.addr, align 4
  %3303 = load i32, i32* %x742.addr, align 4
  %3304 = load i32, i32* %x698.addr, align 4
  %3305 = load i32, i32* %x730.addr, align 4
  %3306 = call i64 @p256FiatAddcarryxU32(i32 %3303, i32 %3304, i32 %3305)
  store i64 %3306, i64* %w743.addr, align 8
  %3307 = load i64, i64* %w743.addr, align 8
  %3308 = trunc i64 %3307 to i32
  store i32 %3308, i32* %x743.addr, align 4
  %3309 = load i64, i64* %w743.addr, align 8
  %3310 = lshr i64 %3309, 32
  %3311 = trunc i64 %3310 to i32
  store i32 %3311, i32* %x744.addr, align 4
  %3312 = load i32, i32* %x744.addr, align 4
  %3313 = load i32, i32* %x700.addr, align 4
  %3314 = load i32, i32* %x706.addr, align 4
  %3315 = call i64 @p256FiatAddcarryxU32(i32 %3312, i32 %3313, i32 %3314)
  store i64 %3315, i64* %w745.addr, align 8
  %3316 = load i64, i64* %w745.addr, align 8
  %3317 = trunc i64 %3316 to i32
  store i32 %3317, i32* %x745.addr, align 4
  %3318 = load i64, i64* %w745.addr, align 8
  %3319 = lshr i64 %3318, 32
  %3320 = trunc i64 %3319 to i32
  store i32 %3320, i32* %x746.addr, align 4
  %3321 = load i32, i32* %x746.addr, align 4
  %3322 = load i32, i32* %x702.addr, align 4
  %3323 = load i32, i32* %x707.addr, align 4
  %3324 = call i64 @p256FiatAddcarryxU32(i32 %3321, i32 %3322, i32 %3323)
  store i64 %3324, i64* %w747.addr, align 8
  %3325 = load i64, i64* %w747.addr, align 8
  %3326 = trunc i64 %3325 to i32
  store i32 %3326, i32* %x747.addr, align 4
  %3327 = load i64, i64* %w747.addr, align 8
  %3328 = lshr i64 %3327, 32
  %3329 = trunc i64 %3328 to i32
  store i32 %3329, i32* %x748.addr, align 4
  %3330 = load i32, i32* %x748.addr, align 4
  %3331 = load i32, i32* %x703.addr, align 4
  %3332 = add i32 %3330, %3331
  store i32 %3332, i32* %x749.addr, align 4
  %3333 = load i32, i32* %x733.addr, align 4
  %3334 = call i64 @p256FiatSubborrowxU32(i32 0, i32 %3333, i32 4234356049)
  store i64 %3334, i64* %w750.addr, align 8
  %3335 = load i64, i64* %w750.addr, align 8
  %3336 = trunc i64 %3335 to i32
  store i32 %3336, i32* %x750.addr, align 4
  %3337 = load i64, i64* %w750.addr, align 8
  %3338 = lshr i64 %3337, 32
  %3339 = trunc i64 %3338 to i32
  store i32 %3339, i32* %x751.addr, align 4
  %3340 = load i32, i32* %x751.addr, align 4
  %3341 = load i32, i32* %x735.addr, align 4
  %3342 = call i64 @p256FiatSubborrowxU32(i32 %3340, i32 %3341, i32 4089039554)
  store i64 %3342, i64* %w752.addr, align 8
  %3343 = load i64, i64* %w752.addr, align 8
  %3344 = trunc i64 %3343 to i32
  store i32 %3344, i32* %x752.addr, align 4
  %3345 = load i64, i64* %w752.addr, align 8
  %3346 = lshr i64 %3345, 32
  %3347 = trunc i64 %3346 to i32
  store i32 %3347, i32* %x753.addr, align 4
  %3348 = load i32, i32* %x753.addr, align 4
  %3349 = load i32, i32* %x737.addr, align 4
  %3350 = call i64 @p256FiatSubborrowxU32(i32 %3348, i32 %3349, i32 2803342980)
  store i64 %3350, i64* %w754.addr, align 8
  %3351 = load i64, i64* %w754.addr, align 8
  %3352 = trunc i64 %3351 to i32
  store i32 %3352, i32* %x754.addr, align 4
  %3353 = load i64, i64* %w754.addr, align 8
  %3354 = lshr i64 %3353, 32
  %3355 = trunc i64 %3354 to i32
  store i32 %3355, i32* %x755.addr, align 4
  %3356 = load i32, i32* %x755.addr, align 4
  %3357 = load i32, i32* %x739.addr, align 4
  %3358 = call i64 @p256FiatSubborrowxU32(i32 %3356, i32 %3357, i32 3169254061)
  store i64 %3358, i64* %w756.addr, align 8
  %3359 = load i64, i64* %w756.addr, align 8
  %3360 = trunc i64 %3359 to i32
  store i32 %3360, i32* %x756.addr, align 4
  %3361 = load i64, i64* %w756.addr, align 8
  %3362 = lshr i64 %3361, 32
  %3363 = trunc i64 %3362 to i32
  store i32 %3363, i32* %x757.addr, align 4
  %3364 = load i32, i32* %x757.addr, align 4
  %3365 = load i32, i32* %x741.addr, align 4
  %3366 = call i64 @p256FiatSubborrowxU32(i32 %3364, i32 %3365, i32 4294967295)
  store i64 %3366, i64* %w758.addr, align 8
  %3367 = load i64, i64* %w758.addr, align 8
  %3368 = trunc i64 %3367 to i32
  store i32 %3368, i32* %x758.addr, align 4
  %3369 = load i64, i64* %w758.addr, align 8
  %3370 = lshr i64 %3369, 32
  %3371 = trunc i64 %3370 to i32
  store i32 %3371, i32* %x759.addr, align 4
  %3372 = load i32, i32* %x759.addr, align 4
  %3373 = load i32, i32* %x743.addr, align 4
  %3374 = call i64 @p256FiatSubborrowxU32(i32 %3372, i32 %3373, i32 4294967295)
  store i64 %3374, i64* %w760.addr, align 8
  %3375 = load i64, i64* %w760.addr, align 8
  %3376 = trunc i64 %3375 to i32
  store i32 %3376, i32* %x760.addr, align 4
  %3377 = load i64, i64* %w760.addr, align 8
  %3378 = lshr i64 %3377, 32
  %3379 = trunc i64 %3378 to i32
  store i32 %3379, i32* %x761.addr, align 4
  %3380 = load i32, i32* %x761.addr, align 4
  %3381 = load i32, i32* %x745.addr, align 4
  %3382 = call i64 @p256FiatSubborrowxU32(i32 %3380, i32 %3381, i32 0)
  store i64 %3382, i64* %w762.addr, align 8
  %3383 = load i64, i64* %w762.addr, align 8
  %3384 = trunc i64 %3383 to i32
  store i32 %3384, i32* %x762.addr, align 4
  %3385 = load i64, i64* %w762.addr, align 8
  %3386 = lshr i64 %3385, 32
  %3387 = trunc i64 %3386 to i32
  store i32 %3387, i32* %x763.addr, align 4
  %3388 = load i32, i32* %x763.addr, align 4
  %3389 = load i32, i32* %x747.addr, align 4
  %3390 = call i64 @p256FiatSubborrowxU32(i32 %3388, i32 %3389, i32 4294967295)
  store i64 %3390, i64* %w764.addr, align 8
  %3391 = load i64, i64* %w764.addr, align 8
  %3392 = trunc i64 %3391 to i32
  store i32 %3392, i32* %x764.addr, align 4
  %3393 = load i64, i64* %w764.addr, align 8
  %3394 = lshr i64 %3393, 32
  %3395 = trunc i64 %3394 to i32
  store i32 %3395, i32* %x765.addr, align 4
  %3396 = load i32, i32* %x765.addr, align 4
  %3397 = load i32, i32* %x749.addr, align 4
  %3398 = call i64 @p256FiatSubborrowxU32(i32 %3396, i32 %3397, i32 0)
  store i64 %3398, i64* %w766.addr, align 8
  %3399 = load i64, i64* %w766.addr, align 8
  %3400 = lshr i64 %3399, 32
  %3401 = trunc i64 %3400 to i32
  store i32 %3401, i32* %x767.addr, align 4
  %3402 = load i32, i32* %x767.addr, align 4
  %3403 = load i32, i32* %x750.addr, align 4
  %3404 = load i32, i32* %x733.addr, align 4
  %3405 = call i32 @p256FiatCmovznzU32(i32 %3402, i32 %3403, i32 %3404)
  store i32 %3405, i32* %x768.addr, align 4
  %3406 = load i32, i32* %x767.addr, align 4
  %3407 = load i32, i32* %x752.addr, align 4
  %3408 = load i32, i32* %x735.addr, align 4
  %3409 = call i32 @p256FiatCmovznzU32(i32 %3406, i32 %3407, i32 %3408)
  store i32 %3409, i32* %x769.addr, align 4
  %3410 = load i32, i32* %x767.addr, align 4
  %3411 = load i32, i32* %x754.addr, align 4
  %3412 = load i32, i32* %x737.addr, align 4
  %3413 = call i32 @p256FiatCmovznzU32(i32 %3410, i32 %3411, i32 %3412)
  store i32 %3413, i32* %x770.addr, align 4
  %3414 = load i32, i32* %x767.addr, align 4
  %3415 = load i32, i32* %x756.addr, align 4
  %3416 = load i32, i32* %x739.addr, align 4
  %3417 = call i32 @p256FiatCmovznzU32(i32 %3414, i32 %3415, i32 %3416)
  store i32 %3417, i32* %x771.addr, align 4
  %3418 = load i32, i32* %x767.addr, align 4
  %3419 = load i32, i32* %x758.addr, align 4
  %3420 = load i32, i32* %x741.addr, align 4
  %3421 = call i32 @p256FiatCmovznzU32(i32 %3418, i32 %3419, i32 %3420)
  store i32 %3421, i32* %x772.addr, align 4
  %3422 = load i32, i32* %x767.addr, align 4
  %3423 = load i32, i32* %x760.addr, align 4
  %3424 = load i32, i32* %x743.addr, align 4
  %3425 = call i32 @p256FiatCmovznzU32(i32 %3422, i32 %3423, i32 %3424)
  store i32 %3425, i32* %x773.addr, align 4
  %3426 = load i32, i32* %x767.addr, align 4
  %3427 = load i32, i32* %x762.addr, align 4
  %3428 = load i32, i32* %x745.addr, align 4
  %3429 = call i32 @p256FiatCmovznzU32(i32 %3426, i32 %3427, i32 %3428)
  store i32 %3429, i32* %x774.addr, align 4
  %3430 = load i32, i32* %x767.addr, align 4
  %3431 = load i32, i32* %x764.addr, align 4
  %3432 = load i32, i32* %x747.addr, align 4
  %3433 = call i32 @p256FiatCmovznzU32(i32 %3430, i32 %3431, i32 %3432)
  store i32 %3433, i32* %x775.addr, align 4
  %3434 = load i32, i32* %x768.addr, align 4
  %3435 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3436 = load i8*, i8** %3435, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3437 = bitcast i8* %3436 to i32*
  %3438 = getelementptr inbounds i32, i32* %3437, i64 0
  store i32 %3434, i32* %3438, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3439 = load i32, i32* %x769.addr, align 4
  %3440 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3441 = load i8*, i8** %3440, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3442 = bitcast i8* %3441 to i32*
  %3443 = getelementptr inbounds i32, i32* %3442, i64 1
  store i32 %3439, i32* %3443, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3444 = load i32, i32* %x770.addr, align 4
  %3445 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3446 = load i8*, i8** %3445, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3447 = bitcast i8* %3446 to i32*
  %3448 = getelementptr inbounds i32, i32* %3447, i64 2
  store i32 %3444, i32* %3448, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3449 = load i32, i32* %x771.addr, align 4
  %3450 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3451 = load i8*, i8** %3450, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3452 = bitcast i8* %3451 to i32*
  %3453 = getelementptr inbounds i32, i32* %3452, i64 3
  store i32 %3449, i32* %3453, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3454 = load i32, i32* %x772.addr, align 4
  %3455 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3456 = load i8*, i8** %3455, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3457 = bitcast i8* %3456 to i32*
  %3458 = getelementptr inbounds i32, i32* %3457, i64 4
  store i32 %3454, i32* %3458, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3459 = load i32, i32* %x773.addr, align 4
  %3460 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3461 = load i8*, i8** %3460, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3462 = bitcast i8* %3461 to i32*
  %3463 = getelementptr inbounds i32, i32* %3462, i64 5
  store i32 %3459, i32* %3463, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3464 = load i32, i32* %x774.addr, align 4
  %3465 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3466 = load i8*, i8** %3465, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3467 = bitcast i8* %3466 to i32*
  %3468 = getelementptr inbounds i32, i32* %3467, i64 6
  store i32 %3464, i32* %3468, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %3469 = load i32, i32* %x775.addr, align 4
  %3470 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %3471 = load i8*, i8** %3470, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3472 = bitcast i8* %3471 to i32*
  %3473 = getelementptr inbounds i32, i32* %3472, i64 7
  store i32 %3469, i32* %3473, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define void @p256TableMove(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %at, i32 noundef %hit) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = sext i32 %at to i64
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %5
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %11 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %4, i32 %10)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 %11, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 1
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %21 = add i32 %at, 1
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %22
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %28 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %20, i32 %27)
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 1
  store i32 %28, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 2
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %38 = add i32 %at, 2
  %39 = sext i32 %38 to i64
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %45 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %37, i32 %44)
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 2
  store i32 %45, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = bitcast i8* %51 to i32*
  %53 = getelementptr inbounds i32, i32* %52, i64 3
  %54 = load i32, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %55 = add i32 %at, 3
  %56 = sext i32 %55 to i64
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %62 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %54, i32 %61)
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = bitcast i8* %64 to i32*
  %66 = getelementptr inbounds i32, i32* %65, i64 3
  store i32 %62, i32* %66, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = bitcast i8* %68 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 4
  %71 = load i32, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %72 = add i32 %at, 4
  %73 = sext i32 %72 to i64
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 %73
  %78 = load i32, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %79 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %71, i32 %78)
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = bitcast i8* %81 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 4
  store i32 %79, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = bitcast i8* %85 to i32*
  %87 = getelementptr inbounds i32, i32* %86, i64 5
  %88 = load i32, i32* %87, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %89 = add i32 %at, 5
  %90 = sext i32 %89 to i64
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = bitcast i8* %92 to i32*
  %94 = getelementptr inbounds i32, i32* %93, i64 %90
  %95 = load i32, i32* %94, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %96 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %88, i32 %95)
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 5
  store i32 %96, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = bitcast i8* %102 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 6
  %105 = load i32, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %106 = add i32 %at, 6
  %107 = sext i32 %106 to i64
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = bitcast i8* %109 to i32*
  %111 = getelementptr inbounds i32, i32* %110, i64 %107
  %112 = load i32, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %113 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %105, i32 %112)
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %116 = bitcast i8* %115 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 6
  store i32 %113, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = bitcast i8* %119 to i32*
  %121 = getelementptr inbounds i32, i32* %120, i64 7
  %122 = load i32, i32* %121, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %123 = add i32 %at, 7
  %124 = sext i32 %123 to i64
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = bitcast i8* %126 to i32*
  %128 = getelementptr inbounds i32, i32* %127, i64 %124
  %129 = load i32, i32* %128, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %130 = call i32 @p256FiatCmovznzU32(i32 %hit, i32 %122, i32 %129)
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = bitcast i8* %132 to i32*
  %134 = getelementptr inbounds i32, i32* %133, i64 7
  store i32 %130, i32* %134, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define void @p256FiatAdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg2) #1 {
entry:
  %w1.addr = alloca i64, align 8
  %x1.addr = alloca i32, align 4
  %x2.addr = alloca i32, align 4
  %w3.addr = alloca i64, align 8
  %x3.addr = alloca i32, align 4
  %x4.addr = alloca i32, align 4
  %w5.addr = alloca i64, align 8
  %x5.addr = alloca i32, align 4
  %x6.addr = alloca i32, align 4
  %w7.addr = alloca i64, align 8
  %x7.addr = alloca i32, align 4
  %x8.addr = alloca i32, align 4
  %w9.addr = alloca i64, align 8
  %x9.addr = alloca i32, align 4
  %x10.addr = alloca i32, align 4
  %w11.addr = alloca i64, align 8
  %x11.addr = alloca i32, align 4
  %x12.addr = alloca i32, align 4
  %w13.addr = alloca i64, align 8
  %x13.addr = alloca i32, align 4
  %x14.addr = alloca i32, align 4
  %w15.addr = alloca i64, align 8
  %x15.addr = alloca i32, align 4
  %x16.addr = alloca i32, align 4
  %w17.addr = alloca i64, align 8
  %x17.addr = alloca i32, align 4
  %x18.addr = alloca i32, align 4
  %w19.addr = alloca i64, align 8
  %x19.addr = alloca i32, align 4
  %x20.addr = alloca i32, align 4
  %w21.addr = alloca i64, align 8
  %x21.addr = alloca i32, align 4
  %x22.addr = alloca i32, align 4
  %w23.addr = alloca i64, align 8
  %x23.addr = alloca i32, align 4
  %x24.addr = alloca i32, align 4
  %w25.addr = alloca i64, align 8
  %x25.addr = alloca i32, align 4
  %x26.addr = alloca i32, align 4
  %w27.addr = alloca i64, align 8
  %x27.addr = alloca i32, align 4
  %x28.addr = alloca i32, align 4
  %w29.addr = alloca i64, align 8
  %x29.addr = alloca i32, align 4
  %x30.addr = alloca i32, align 4
  %w31.addr = alloca i64, align 8
  %x31.addr = alloca i32, align 4
  %x32.addr = alloca i32, align 4
  %w33.addr = alloca i64, align 8
  %x34.addr = alloca i32, align 4
  %x35.addr = alloca i32, align 4
  %x36.addr = alloca i32, align 4
  %x37.addr = alloca i32, align 4
  %x38.addr = alloca i32, align 4
  %x39.addr = alloca i32, align 4
  %x40.addr = alloca i32, align 4
  %x41.addr = alloca i32, align 4
  %x42.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %10 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %4, i32 %9)
  store i64 %10, i64* %w1.addr, align 8
  %11 = load i64, i64* %w1.addr, align 8
  %12 = trunc i64 %11 to i32
  store i32 %12, i32* %x1.addr, align 4
  %13 = load i64, i64* %w1.addr, align 8
  %14 = lshr i64 %13, 32
  %15 = trunc i64 %14 to i32
  store i32 %15, i32* %x2.addr, align 4
  %16 = load i32, i32* %x2.addr, align 4
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 1
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 1
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %27 = call i64 @p256FiatAddcarryxU32(i32 %16, i32 %21, i32 %26)
  store i64 %27, i64* %w3.addr, align 8
  %28 = load i64, i64* %w3.addr, align 8
  %29 = trunc i64 %28 to i32
  store i32 %29, i32* %x3.addr, align 4
  %30 = load i64, i64* %w3.addr, align 8
  %31 = lshr i64 %30, 32
  %32 = trunc i64 %31 to i32
  store i32 %32, i32* %x4.addr, align 4
  %33 = load i32, i32* %x4.addr, align 4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 2
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 2
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %44 = call i64 @p256FiatAddcarryxU32(i32 %33, i32 %38, i32 %43)
  store i64 %44, i64* %w5.addr, align 8
  %45 = load i64, i64* %w5.addr, align 8
  %46 = trunc i64 %45 to i32
  store i32 %46, i32* %x5.addr, align 4
  %47 = load i64, i64* %w5.addr, align 8
  %48 = lshr i64 %47, 32
  %49 = trunc i64 %48 to i32
  store i32 %49, i32* %x6.addr, align 4
  %50 = load i32, i32* %x6.addr, align 4
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 3
  %55 = load i32, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 3
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %61 = call i64 @p256FiatAddcarryxU32(i32 %50, i32 %55, i32 %60)
  store i64 %61, i64* %w7.addr, align 8
  %62 = load i64, i64* %w7.addr, align 8
  %63 = trunc i64 %62 to i32
  store i32 %63, i32* %x7.addr, align 4
  %64 = load i64, i64* %w7.addr, align 8
  %65 = lshr i64 %64, 32
  %66 = trunc i64 %65 to i32
  store i32 %66, i32* %x8.addr, align 4
  %67 = load i32, i32* %x8.addr, align 4
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 4
  %72 = load i32, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = bitcast i8* %74 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 4
  %77 = load i32, i32* %76, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %78 = call i64 @p256FiatAddcarryxU32(i32 %67, i32 %72, i32 %77)
  store i64 %78, i64* %w9.addr, align 8
  %79 = load i64, i64* %w9.addr, align 8
  %80 = trunc i64 %79 to i32
  store i32 %80, i32* %x9.addr, align 4
  %81 = load i64, i64* %w9.addr, align 8
  %82 = lshr i64 %81, 32
  %83 = trunc i64 %82 to i32
  store i32 %83, i32* %x10.addr, align 4
  %84 = load i32, i32* %x10.addr, align 4
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 5
  %89 = load i32, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = bitcast i8* %91 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 5
  %94 = load i32, i32* %93, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %95 = call i64 @p256FiatAddcarryxU32(i32 %84, i32 %89, i32 %94)
  store i64 %95, i64* %w11.addr, align 8
  %96 = load i64, i64* %w11.addr, align 8
  %97 = trunc i64 %96 to i32
  store i32 %97, i32* %x11.addr, align 4
  %98 = load i64, i64* %w11.addr, align 8
  %99 = lshr i64 %98, 32
  %100 = trunc i64 %99 to i32
  store i32 %100, i32* %x12.addr, align 4
  %101 = load i32, i32* %x12.addr, align 4
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = bitcast i8* %103 to i32*
  %105 = getelementptr inbounds i32, i32* %104, i64 6
  %106 = load i32, i32* %105, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %108 = load i8*, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %109 = bitcast i8* %108 to i32*
  %110 = getelementptr inbounds i32, i32* %109, i64 6
  %111 = load i32, i32* %110, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %112 = call i64 @p256FiatAddcarryxU32(i32 %101, i32 %106, i32 %111)
  store i64 %112, i64* %w13.addr, align 8
  %113 = load i64, i64* %w13.addr, align 8
  %114 = trunc i64 %113 to i32
  store i32 %114, i32* %x13.addr, align 4
  %115 = load i64, i64* %w13.addr, align 8
  %116 = lshr i64 %115, 32
  %117 = trunc i64 %116 to i32
  store i32 %117, i32* %x14.addr, align 4
  %118 = load i32, i32* %x14.addr, align 4
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %121 = bitcast i8* %120 to i32*
  %122 = getelementptr inbounds i32, i32* %121, i64 7
  %123 = load i32, i32* %122, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = bitcast i8* %125 to i32*
  %127 = getelementptr inbounds i32, i32* %126, i64 7
  %128 = load i32, i32* %127, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %129 = call i64 @p256FiatAddcarryxU32(i32 %118, i32 %123, i32 %128)
  store i64 %129, i64* %w15.addr, align 8
  %130 = load i64, i64* %w15.addr, align 8
  %131 = trunc i64 %130 to i32
  store i32 %131, i32* %x15.addr, align 4
  %132 = load i64, i64* %w15.addr, align 8
  %133 = lshr i64 %132, 32
  %134 = trunc i64 %133 to i32
  store i32 %134, i32* %x16.addr, align 4
  %135 = load i32, i32* %x1.addr, align 4
  %136 = call i64 @p256FiatSubborrowxU32(i32 0, i32 %135, i32 4294967295)
  store i64 %136, i64* %w17.addr, align 8
  %137 = load i64, i64* %w17.addr, align 8
  %138 = trunc i64 %137 to i32
  store i32 %138, i32* %x17.addr, align 4
  %139 = load i64, i64* %w17.addr, align 8
  %140 = lshr i64 %139, 32
  %141 = trunc i64 %140 to i32
  store i32 %141, i32* %x18.addr, align 4
  %142 = load i32, i32* %x18.addr, align 4
  %143 = load i32, i32* %x3.addr, align 4
  %144 = call i64 @p256FiatSubborrowxU32(i32 %142, i32 %143, i32 4294967295)
  store i64 %144, i64* %w19.addr, align 8
  %145 = load i64, i64* %w19.addr, align 8
  %146 = trunc i64 %145 to i32
  store i32 %146, i32* %x19.addr, align 4
  %147 = load i64, i64* %w19.addr, align 8
  %148 = lshr i64 %147, 32
  %149 = trunc i64 %148 to i32
  store i32 %149, i32* %x20.addr, align 4
  %150 = load i32, i32* %x20.addr, align 4
  %151 = load i32, i32* %x5.addr, align 4
  %152 = call i64 @p256FiatSubborrowxU32(i32 %150, i32 %151, i32 4294967295)
  store i64 %152, i64* %w21.addr, align 8
  %153 = load i64, i64* %w21.addr, align 8
  %154 = trunc i64 %153 to i32
  store i32 %154, i32* %x21.addr, align 4
  %155 = load i64, i64* %w21.addr, align 8
  %156 = lshr i64 %155, 32
  %157 = trunc i64 %156 to i32
  store i32 %157, i32* %x22.addr, align 4
  %158 = load i32, i32* %x22.addr, align 4
  %159 = load i32, i32* %x7.addr, align 4
  %160 = call i64 @p256FiatSubborrowxU32(i32 %158, i32 %159, i32 0)
  store i64 %160, i64* %w23.addr, align 8
  %161 = load i64, i64* %w23.addr, align 8
  %162 = trunc i64 %161 to i32
  store i32 %162, i32* %x23.addr, align 4
  %163 = load i64, i64* %w23.addr, align 8
  %164 = lshr i64 %163, 32
  %165 = trunc i64 %164 to i32
  store i32 %165, i32* %x24.addr, align 4
  %166 = load i32, i32* %x24.addr, align 4
  %167 = load i32, i32* %x9.addr, align 4
  %168 = call i64 @p256FiatSubborrowxU32(i32 %166, i32 %167, i32 0)
  store i64 %168, i64* %w25.addr, align 8
  %169 = load i64, i64* %w25.addr, align 8
  %170 = trunc i64 %169 to i32
  store i32 %170, i32* %x25.addr, align 4
  %171 = load i64, i64* %w25.addr, align 8
  %172 = lshr i64 %171, 32
  %173 = trunc i64 %172 to i32
  store i32 %173, i32* %x26.addr, align 4
  %174 = load i32, i32* %x26.addr, align 4
  %175 = load i32, i32* %x11.addr, align 4
  %176 = call i64 @p256FiatSubborrowxU32(i32 %174, i32 %175, i32 0)
  store i64 %176, i64* %w27.addr, align 8
  %177 = load i64, i64* %w27.addr, align 8
  %178 = trunc i64 %177 to i32
  store i32 %178, i32* %x27.addr, align 4
  %179 = load i64, i64* %w27.addr, align 8
  %180 = lshr i64 %179, 32
  %181 = trunc i64 %180 to i32
  store i32 %181, i32* %x28.addr, align 4
  %182 = load i32, i32* %x28.addr, align 4
  %183 = load i32, i32* %x13.addr, align 4
  %184 = call i64 @p256FiatSubborrowxU32(i32 %182, i32 %183, i32 1)
  store i64 %184, i64* %w29.addr, align 8
  %185 = load i64, i64* %w29.addr, align 8
  %186 = trunc i64 %185 to i32
  store i32 %186, i32* %x29.addr, align 4
  %187 = load i64, i64* %w29.addr, align 8
  %188 = lshr i64 %187, 32
  %189 = trunc i64 %188 to i32
  store i32 %189, i32* %x30.addr, align 4
  %190 = load i32, i32* %x30.addr, align 4
  %191 = load i32, i32* %x15.addr, align 4
  %192 = call i64 @p256FiatSubborrowxU32(i32 %190, i32 %191, i32 4294967295)
  store i64 %192, i64* %w31.addr, align 8
  %193 = load i64, i64* %w31.addr, align 8
  %194 = trunc i64 %193 to i32
  store i32 %194, i32* %x31.addr, align 4
  %195 = load i64, i64* %w31.addr, align 8
  %196 = lshr i64 %195, 32
  %197 = trunc i64 %196 to i32
  store i32 %197, i32* %x32.addr, align 4
  %198 = load i32, i32* %x32.addr, align 4
  %199 = load i32, i32* %x16.addr, align 4
  %200 = call i64 @p256FiatSubborrowxU32(i32 %198, i32 %199, i32 0)
  store i64 %200, i64* %w33.addr, align 8
  %201 = load i64, i64* %w33.addr, align 8
  %202 = lshr i64 %201, 32
  %203 = trunc i64 %202 to i32
  store i32 %203, i32* %x34.addr, align 4
  %204 = load i32, i32* %x34.addr, align 4
  %205 = load i32, i32* %x17.addr, align 4
  %206 = load i32, i32* %x1.addr, align 4
  %207 = call i32 @p256FiatCmovznzU32(i32 %204, i32 %205, i32 %206)
  store i32 %207, i32* %x35.addr, align 4
  %208 = load i32, i32* %x34.addr, align 4
  %209 = load i32, i32* %x19.addr, align 4
  %210 = load i32, i32* %x3.addr, align 4
  %211 = call i32 @p256FiatCmovznzU32(i32 %208, i32 %209, i32 %210)
  store i32 %211, i32* %x36.addr, align 4
  %212 = load i32, i32* %x34.addr, align 4
  %213 = load i32, i32* %x21.addr, align 4
  %214 = load i32, i32* %x5.addr, align 4
  %215 = call i32 @p256FiatCmovznzU32(i32 %212, i32 %213, i32 %214)
  store i32 %215, i32* %x37.addr, align 4
  %216 = load i32, i32* %x34.addr, align 4
  %217 = load i32, i32* %x23.addr, align 4
  %218 = load i32, i32* %x7.addr, align 4
  %219 = call i32 @p256FiatCmovznzU32(i32 %216, i32 %217, i32 %218)
  store i32 %219, i32* %x38.addr, align 4
  %220 = load i32, i32* %x34.addr, align 4
  %221 = load i32, i32* %x25.addr, align 4
  %222 = load i32, i32* %x9.addr, align 4
  %223 = call i32 @p256FiatCmovznzU32(i32 %220, i32 %221, i32 %222)
  store i32 %223, i32* %x39.addr, align 4
  %224 = load i32, i32* %x34.addr, align 4
  %225 = load i32, i32* %x27.addr, align 4
  %226 = load i32, i32* %x11.addr, align 4
  %227 = call i32 @p256FiatCmovznzU32(i32 %224, i32 %225, i32 %226)
  store i32 %227, i32* %x40.addr, align 4
  %228 = load i32, i32* %x34.addr, align 4
  %229 = load i32, i32* %x29.addr, align 4
  %230 = load i32, i32* %x13.addr, align 4
  %231 = call i32 @p256FiatCmovznzU32(i32 %228, i32 %229, i32 %230)
  store i32 %231, i32* %x41.addr, align 4
  %232 = load i32, i32* %x34.addr, align 4
  %233 = load i32, i32* %x31.addr, align 4
  %234 = load i32, i32* %x15.addr, align 4
  %235 = call i32 @p256FiatCmovznzU32(i32 %232, i32 %233, i32 %234)
  store i32 %235, i32* %x42.addr, align 4
  %236 = load i32, i32* %x35.addr, align 4
  %237 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %238 = load i8*, i8** %237, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %239 = bitcast i8* %238 to i32*
  %240 = getelementptr inbounds i32, i32* %239, i64 0
  store i32 %236, i32* %240, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %241 = load i32, i32* %x36.addr, align 4
  %242 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %243 = load i8*, i8** %242, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %244 = bitcast i8* %243 to i32*
  %245 = getelementptr inbounds i32, i32* %244, i64 1
  store i32 %241, i32* %245, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %246 = load i32, i32* %x37.addr, align 4
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %248 = load i8*, i8** %247, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %249 = bitcast i8* %248 to i32*
  %250 = getelementptr inbounds i32, i32* %249, i64 2
  store i32 %246, i32* %250, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %251 = load i32, i32* %x38.addr, align 4
  %252 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %253 = load i8*, i8** %252, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %254 = bitcast i8* %253 to i32*
  %255 = getelementptr inbounds i32, i32* %254, i64 3
  store i32 %251, i32* %255, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %256 = load i32, i32* %x39.addr, align 4
  %257 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %258 = load i8*, i8** %257, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %259 = bitcast i8* %258 to i32*
  %260 = getelementptr inbounds i32, i32* %259, i64 4
  store i32 %256, i32* %260, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %261 = load i32, i32* %x40.addr, align 4
  %262 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %263 = load i8*, i8** %262, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %264 = bitcast i8* %263 to i32*
  %265 = getelementptr inbounds i32, i32* %264, i64 5
  store i32 %261, i32* %265, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %266 = load i32, i32* %x41.addr, align 4
  %267 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %268 = load i8*, i8** %267, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %269 = bitcast i8* %268 to i32*
  %270 = getelementptr inbounds i32, i32* %269, i64 6
  store i32 %266, i32* %270, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %271 = load i32, i32* %x42.addr, align 4
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %273 = load i8*, i8** %272, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %274 = bitcast i8* %273 to i32*
  %275 = getelementptr inbounds i32, i32* %274, i64 7
  store i32 %271, i32* %275, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define void @p256FiatSub(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %arg2) #1 {
entry:
  %w1.addr = alloca i64, align 8
  %x1.addr = alloca i32, align 4
  %x2.addr = alloca i32, align 4
  %w3.addr = alloca i64, align 8
  %x3.addr = alloca i32, align 4
  %x4.addr = alloca i32, align 4
  %w5.addr = alloca i64, align 8
  %x5.addr = alloca i32, align 4
  %x6.addr = alloca i32, align 4
  %w7.addr = alloca i64, align 8
  %x7.addr = alloca i32, align 4
  %x8.addr = alloca i32, align 4
  %w9.addr = alloca i64, align 8
  %x9.addr = alloca i32, align 4
  %x10.addr = alloca i32, align 4
  %w11.addr = alloca i64, align 8
  %x11.addr = alloca i32, align 4
  %x12.addr = alloca i32, align 4
  %w13.addr = alloca i64, align 8
  %x13.addr = alloca i32, align 4
  %x14.addr = alloca i32, align 4
  %w15.addr = alloca i64, align 8
  %x15.addr = alloca i32, align 4
  %x16.addr = alloca i32, align 4
  %x17.addr = alloca i32, align 4
  %w18.addr = alloca i64, align 8
  %x18.addr = alloca i32, align 4
  %x19.addr = alloca i32, align 4
  %w20.addr = alloca i64, align 8
  %x20.addr = alloca i32, align 4
  %x21.addr = alloca i32, align 4
  %w22.addr = alloca i64, align 8
  %x22.addr = alloca i32, align 4
  %x23.addr = alloca i32, align 4
  %w24.addr = alloca i64, align 8
  %x24.addr = alloca i32, align 4
  %x25.addr = alloca i32, align 4
  %w26.addr = alloca i64, align 8
  %x26.addr = alloca i32, align 4
  %x27.addr = alloca i32, align 4
  %w28.addr = alloca i64, align 8
  %x28.addr = alloca i32, align 4
  %x29.addr = alloca i32, align 4
  %w30.addr = alloca i64, align 8
  %x30.addr = alloca i32, align 4
  %x31.addr = alloca i32, align 4
  %w32.addr = alloca i64, align 8
  %x32.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  %4 = load i32, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %10 = call i64 @p256FiatSubborrowxU32(i32 0, i32 %4, i32 %9)
  store i64 %10, i64* %w1.addr, align 8
  %11 = load i64, i64* %w1.addr, align 8
  %12 = trunc i64 %11 to i32
  store i32 %12, i32* %x1.addr, align 4
  %13 = load i64, i64* %w1.addr, align 8
  %14 = lshr i64 %13, 32
  %15 = trunc i64 %14 to i32
  store i32 %15, i32* %x2.addr, align 4
  %16 = load i32, i32* %x2.addr, align 4
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 1
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 1
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %27 = call i64 @p256FiatSubborrowxU32(i32 %16, i32 %21, i32 %26)
  store i64 %27, i64* %w3.addr, align 8
  %28 = load i64, i64* %w3.addr, align 8
  %29 = trunc i64 %28 to i32
  store i32 %29, i32* %x3.addr, align 4
  %30 = load i64, i64* %w3.addr, align 8
  %31 = lshr i64 %30, 32
  %32 = trunc i64 %31 to i32
  store i32 %32, i32* %x4.addr, align 4
  %33 = load i32, i32* %x4.addr, align 4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 2
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 2
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %44 = call i64 @p256FiatSubborrowxU32(i32 %33, i32 %38, i32 %43)
  store i64 %44, i64* %w5.addr, align 8
  %45 = load i64, i64* %w5.addr, align 8
  %46 = trunc i64 %45 to i32
  store i32 %46, i32* %x5.addr, align 4
  %47 = load i64, i64* %w5.addr, align 8
  %48 = lshr i64 %47, 32
  %49 = trunc i64 %48 to i32
  store i32 %49, i32* %x6.addr, align 4
  %50 = load i32, i32* %x6.addr, align 4
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 3
  %55 = load i32, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 3
  %60 = load i32, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %61 = call i64 @p256FiatSubborrowxU32(i32 %50, i32 %55, i32 %60)
  store i64 %61, i64* %w7.addr, align 8
  %62 = load i64, i64* %w7.addr, align 8
  %63 = trunc i64 %62 to i32
  store i32 %63, i32* %x7.addr, align 4
  %64 = load i64, i64* %w7.addr, align 8
  %65 = lshr i64 %64, 32
  %66 = trunc i64 %65 to i32
  store i32 %66, i32* %x8.addr, align 4
  %67 = load i32, i32* %x8.addr, align 4
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 4
  %72 = load i32, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = bitcast i8* %74 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 4
  %77 = load i32, i32* %76, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %78 = call i64 @p256FiatSubborrowxU32(i32 %67, i32 %72, i32 %77)
  store i64 %78, i64* %w9.addr, align 8
  %79 = load i64, i64* %w9.addr, align 8
  %80 = trunc i64 %79 to i32
  store i32 %80, i32* %x9.addr, align 4
  %81 = load i64, i64* %w9.addr, align 8
  %82 = lshr i64 %81, 32
  %83 = trunc i64 %82 to i32
  store i32 %83, i32* %x10.addr, align 4
  %84 = load i32, i32* %x10.addr, align 4
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 5
  %89 = load i32, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = bitcast i8* %91 to i32*
  %93 = getelementptr inbounds i32, i32* %92, i64 5
  %94 = load i32, i32* %93, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %95 = call i64 @p256FiatSubborrowxU32(i32 %84, i32 %89, i32 %94)
  store i64 %95, i64* %w11.addr, align 8
  %96 = load i64, i64* %w11.addr, align 8
  %97 = trunc i64 %96 to i32
  store i32 %97, i32* %x11.addr, align 4
  %98 = load i64, i64* %w11.addr, align 8
  %99 = lshr i64 %98, 32
  %100 = trunc i64 %99 to i32
  store i32 %100, i32* %x12.addr, align 4
  %101 = load i32, i32* %x12.addr, align 4
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = bitcast i8* %103 to i32*
  %105 = getelementptr inbounds i32, i32* %104, i64 6
  %106 = load i32, i32* %105, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %108 = load i8*, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %109 = bitcast i8* %108 to i32*
  %110 = getelementptr inbounds i32, i32* %109, i64 6
  %111 = load i32, i32* %110, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %112 = call i64 @p256FiatSubborrowxU32(i32 %101, i32 %106, i32 %111)
  store i64 %112, i64* %w13.addr, align 8
  %113 = load i64, i64* %w13.addr, align 8
  %114 = trunc i64 %113 to i32
  store i32 %114, i32* %x13.addr, align 4
  %115 = load i64, i64* %w13.addr, align 8
  %116 = lshr i64 %115, 32
  %117 = trunc i64 %116 to i32
  store i32 %117, i32* %x14.addr, align 4
  %118 = load i32, i32* %x14.addr, align 4
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg1, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %121 = bitcast i8* %120 to i32*
  %122 = getelementptr inbounds i32, i32* %121, i64 7
  %123 = load i32, i32* %122, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arg2, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = bitcast i8* %125 to i32*
  %127 = getelementptr inbounds i32, i32* %126, i64 7
  %128 = load i32, i32* %127, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %129 = call i64 @p256FiatSubborrowxU32(i32 %118, i32 %123, i32 %128)
  store i64 %129, i64* %w15.addr, align 8
  %130 = load i64, i64* %w15.addr, align 8
  %131 = trunc i64 %130 to i32
  store i32 %131, i32* %x15.addr, align 4
  %132 = load i64, i64* %w15.addr, align 8
  %133 = lshr i64 %132, 32
  %134 = trunc i64 %133 to i32
  store i32 %134, i32* %x16.addr, align 4
  %135 = load i32, i32* %x16.addr, align 4
  %136 = call i32 @p256FiatCmovznzU32(i32 %135, i32 0, i32 4294967295)
  store i32 %136, i32* %x17.addr, align 4
  %137 = load i32, i32* %x1.addr, align 4
  %138 = load i32, i32* %x17.addr, align 4
  %139 = call i64 @p256FiatAddcarryxU32(i32 0, i32 %137, i32 %138)
  store i64 %139, i64* %w18.addr, align 8
  %140 = load i64, i64* %w18.addr, align 8
  %141 = trunc i64 %140 to i32
  store i32 %141, i32* %x18.addr, align 4
  %142 = load i64, i64* %w18.addr, align 8
  %143 = lshr i64 %142, 32
  %144 = trunc i64 %143 to i32
  store i32 %144, i32* %x19.addr, align 4
  %145 = load i32, i32* %x19.addr, align 4
  %146 = load i32, i32* %x3.addr, align 4
  %147 = load i32, i32* %x17.addr, align 4
  %148 = call i64 @p256FiatAddcarryxU32(i32 %145, i32 %146, i32 %147)
  store i64 %148, i64* %w20.addr, align 8
  %149 = load i64, i64* %w20.addr, align 8
  %150 = trunc i64 %149 to i32
  store i32 %150, i32* %x20.addr, align 4
  %151 = load i64, i64* %w20.addr, align 8
  %152 = lshr i64 %151, 32
  %153 = trunc i64 %152 to i32
  store i32 %153, i32* %x21.addr, align 4
  %154 = load i32, i32* %x21.addr, align 4
  %155 = load i32, i32* %x5.addr, align 4
  %156 = load i32, i32* %x17.addr, align 4
  %157 = call i64 @p256FiatAddcarryxU32(i32 %154, i32 %155, i32 %156)
  store i64 %157, i64* %w22.addr, align 8
  %158 = load i64, i64* %w22.addr, align 8
  %159 = trunc i64 %158 to i32
  store i32 %159, i32* %x22.addr, align 4
  %160 = load i64, i64* %w22.addr, align 8
  %161 = lshr i64 %160, 32
  %162 = trunc i64 %161 to i32
  store i32 %162, i32* %x23.addr, align 4
  %163 = load i32, i32* %x23.addr, align 4
  %164 = load i32, i32* %x7.addr, align 4
  %165 = call i64 @p256FiatAddcarryxU32(i32 %163, i32 %164, i32 0)
  store i64 %165, i64* %w24.addr, align 8
  %166 = load i64, i64* %w24.addr, align 8
  %167 = trunc i64 %166 to i32
  store i32 %167, i32* %x24.addr, align 4
  %168 = load i64, i64* %w24.addr, align 8
  %169 = lshr i64 %168, 32
  %170 = trunc i64 %169 to i32
  store i32 %170, i32* %x25.addr, align 4
  %171 = load i32, i32* %x25.addr, align 4
  %172 = load i32, i32* %x9.addr, align 4
  %173 = call i64 @p256FiatAddcarryxU32(i32 %171, i32 %172, i32 0)
  store i64 %173, i64* %w26.addr, align 8
  %174 = load i64, i64* %w26.addr, align 8
  %175 = trunc i64 %174 to i32
  store i32 %175, i32* %x26.addr, align 4
  %176 = load i64, i64* %w26.addr, align 8
  %177 = lshr i64 %176, 32
  %178 = trunc i64 %177 to i32
  store i32 %178, i32* %x27.addr, align 4
  %179 = load i32, i32* %x27.addr, align 4
  %180 = load i32, i32* %x11.addr, align 4
  %181 = call i64 @p256FiatAddcarryxU32(i32 %179, i32 %180, i32 0)
  store i64 %181, i64* %w28.addr, align 8
  %182 = load i64, i64* %w28.addr, align 8
  %183 = trunc i64 %182 to i32
  store i32 %183, i32* %x28.addr, align 4
  %184 = load i64, i64* %w28.addr, align 8
  %185 = lshr i64 %184, 32
  %186 = trunc i64 %185 to i32
  store i32 %186, i32* %x29.addr, align 4
  %187 = load i32, i32* %x29.addr, align 4
  %188 = load i32, i32* %x13.addr, align 4
  %189 = load i32, i32* %x17.addr, align 4
  %190 = and i32 %189, 1
  %191 = call i64 @p256FiatAddcarryxU32(i32 %187, i32 %188, i32 %190)
  store i64 %191, i64* %w30.addr, align 8
  %192 = load i64, i64* %w30.addr, align 8
  %193 = trunc i64 %192 to i32
  store i32 %193, i32* %x30.addr, align 4
  %194 = load i64, i64* %w30.addr, align 8
  %195 = lshr i64 %194, 32
  %196 = trunc i64 %195 to i32
  store i32 %196, i32* %x31.addr, align 4
  %197 = load i32, i32* %x31.addr, align 4
  %198 = load i32, i32* %x15.addr, align 4
  %199 = load i32, i32* %x17.addr, align 4
  %200 = call i64 @p256FiatAddcarryxU32(i32 %197, i32 %198, i32 %199)
  store i64 %200, i64* %w32.addr, align 8
  %201 = load i64, i64* %w32.addr, align 8
  %202 = trunc i64 %201 to i32
  store i32 %202, i32* %x32.addr, align 4
  %203 = load i32, i32* %x18.addr, align 4
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %205 = load i8*, i8** %204, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %206 = bitcast i8* %205 to i32*
  %207 = getelementptr inbounds i32, i32* %206, i64 0
  store i32 %203, i32* %207, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %208 = load i32, i32* %x20.addr, align 4
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %210 = load i8*, i8** %209, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %211 = bitcast i8* %210 to i32*
  %212 = getelementptr inbounds i32, i32* %211, i64 1
  store i32 %208, i32* %212, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %213 = load i32, i32* %x22.addr, align 4
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %215 = load i8*, i8** %214, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %216 = bitcast i8* %215 to i32*
  %217 = getelementptr inbounds i32, i32* %216, i64 2
  store i32 %213, i32* %217, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %218 = load i32, i32* %x24.addr, align 4
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %220 = load i8*, i8** %219, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %221 = bitcast i8* %220 to i32*
  %222 = getelementptr inbounds i32, i32* %221, i64 3
  store i32 %218, i32* %222, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %223 = load i32, i32* %x26.addr, align 4
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %225 = load i8*, i8** %224, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %226 = bitcast i8* %225 to i32*
  %227 = getelementptr inbounds i32, i32* %226, i64 4
  store i32 %223, i32* %227, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %228 = load i32, i32* %x28.addr, align 4
  %229 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %230 = load i8*, i8** %229, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %231 = bitcast i8* %230 to i32*
  %232 = getelementptr inbounds i32, i32* %231, i64 5
  store i32 %228, i32* %232, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %233 = load i32, i32* %x30.addr, align 4
  %234 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %235 = load i8*, i8** %234, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %236 = bitcast i8* %235 to i32*
  %237 = getelementptr inbounds i32, i32* %236, i64 6
  store i32 %233, i32* %237, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %238 = load i32, i32* %x32.addr, align 4
  %239 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out1, i64 0, i32 2
  %240 = load i8*, i8** %239, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %241 = bitcast i8* %240 to i32*
  %242 = getelementptr inbounds i32, i32* %241, i64 7
  store i32 %238, i32* %242, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define internal void @p256CurveB(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i32*
  %3 = getelementptr inbounds i32, i32* %2, i64 0
  store i32 700759519, i32* %3, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 3634159458, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 2
  store i32 2021929104, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 3
  store i32 2901411277, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 4
  store i32 4146147030, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 5
  store i32 3852607659, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 6
  store i32 75974708, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 7
  store i32 3694134813, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define internal void @p256Copy(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 8
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = bitcast i8* %1 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  store i32 %12, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @p256PointAdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %x1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %y1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %z1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %x2, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %y2, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %z2) #1 {
entry:
  %t0.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %t1.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %t2.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %t3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [8 x i32], align 8
  %t4.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [8 x i32], align 8
  %x3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [8 x i32], align 8
  %y3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [8 x i32], align 8
  %z3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [8 x i32], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.8 = alloca [8 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 8, 4
  %3 = bitcast [8 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %t0.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = mul i64 8, 4
  %8 = bitcast [8 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %t1.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = mul i64 8, 4
  %13 = bitcast [8 x i32]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %t2.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = mul i64 8, 4
  %18 = bitcast [8 x i32]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %t3.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 8, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 8, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = mul i64 8, 4
  %23 = bitcast [8 x i32]* %arr.data.4 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %23, i8 0, i64 %22, i1 false), !alias.scope !4, !noalias !3
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %t4.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 8, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 8, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %27 = mul i64 8, 4
  %28 = bitcast [8 x i32]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %28, i8 0, i64 %27, i1 false), !alias.scope !4, !noalias !3
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %x3.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 8, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 8, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = mul i64 8, 4
  %33 = bitcast [8 x i32]* %arr.data.6 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 %32, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %y3.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 8, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 8, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %37 = mul i64 8, 4
  %38 = bitcast [8 x i32]* %arr.data.7 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %38, i8 0, i64 %37, i1 false), !alias.scope !4, !noalias !3
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %38, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.7, %struct.nish_array** %z3.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 8, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 8, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %42 = mul i64 8, 4
  %43 = bitcast [8 x i32]* %arr.data.8 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %43, i8 0, i64 %42, i1 false), !alias.scope !4, !noalias !3
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.8, %struct.nish_array** %b.addr, align 8
  %45 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @p256CurveB(%struct.nish_array* %45)
  %46 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %46, %struct.nish_array* %x1, %struct.nish_array* %x2)
  %47 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %47, %struct.nish_array* %y1, %struct.nish_array* %y2)
  %48 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %48, %struct.nish_array* %z1, %struct.nish_array* %z2)
  %49 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %49, %struct.nish_array* %x1, %struct.nish_array* %y1)
  %50 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %50, %struct.nish_array* %x2, %struct.nish_array* %y2)
  %51 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %53 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %51, %struct.nish_array* %52, %struct.nish_array* %53)
  %54 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  %55 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %56 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %54, %struct.nish_array* %55, %struct.nish_array* %56)
  %57 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %57, %struct.nish_array* %58, %struct.nish_array* %59)
  %60 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %60, %struct.nish_array* %y1, %struct.nish_array* %z1)
  %61 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %61, %struct.nish_array* %y2, %struct.nish_array* %z2)
  %62 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  %64 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %62, %struct.nish_array* %63, %struct.nish_array* %64)
  %65 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %66 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %67 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %65, %struct.nish_array* %66, %struct.nish_array* %67)
  %68 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  %69 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  %70 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %68, %struct.nish_array* %69, %struct.nish_array* %70)
  %71 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %71, %struct.nish_array* %x1, %struct.nish_array* %z1)
  %72 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %72, %struct.nish_array* %x2, %struct.nish_array* %z2)
  %73 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %74 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %73, %struct.nish_array* %74, %struct.nish_array* %75)
  %76 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %77 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %78 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %76, %struct.nish_array* %77, %struct.nish_array* %78)
  %79 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %81 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %79, %struct.nish_array* %80, %struct.nish_array* %81)
  %82 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %83 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %84 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %82, %struct.nish_array* %83, %struct.nish_array* %84)
  %85 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %86 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %85, %struct.nish_array* %86, %struct.nish_array* %87)
  %88 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %89 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %90 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %88, %struct.nish_array* %89, %struct.nish_array* %90)
  %91 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %92 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %93 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %91, %struct.nish_array* %92, %struct.nish_array* %93)
  %94 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %95 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %96 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %94, %struct.nish_array* %95, %struct.nish_array* %96)
  %97 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %98 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %99 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %97, %struct.nish_array* %98, %struct.nish_array* %99)
  %100 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %101 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %102 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %100, %struct.nish_array* %101, %struct.nish_array* %102)
  %103 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %104 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  %105 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %103, %struct.nish_array* %104, %struct.nish_array* %105)
  %106 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  %107 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %108 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %106, %struct.nish_array* %107, %struct.nish_array* %108)
  %109 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %110 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %111 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %109, %struct.nish_array* %110, %struct.nish_array* %111)
  %112 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %113 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %114 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %112, %struct.nish_array* %113, %struct.nish_array* %114)
  %115 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %116 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %117 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %115, %struct.nish_array* %116, %struct.nish_array* %117)
  %118 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %120 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %118, %struct.nish_array* %119, %struct.nish_array* %120)
  %121 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %122 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %123 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %121, %struct.nish_array* %122, %struct.nish_array* %123)
  %124 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %125 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %126 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %124, %struct.nish_array* %125, %struct.nish_array* %126)
  %127 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %128 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %129 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %127, %struct.nish_array* %128, %struct.nish_array* %129)
  %130 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %131 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  %132 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %130, %struct.nish_array* %131, %struct.nish_array* %132)
  %133 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  %134 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %135 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %133, %struct.nish_array* %134, %struct.nish_array* %135)
  %136 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %137 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %138 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %136, %struct.nish_array* %137, %struct.nish_array* %138)
  %139 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %140 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %141 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %139, %struct.nish_array* %140, %struct.nish_array* %141)
  %142 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %143 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %144 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %142, %struct.nish_array* %143, %struct.nish_array* %144)
  %145 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %146 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %147 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %145, %struct.nish_array* %146, %struct.nish_array* %147)
  %148 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %149 = load %struct.nish_array*, %struct.nish_array** %t4.addr, align 8
  %150 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %148, %struct.nish_array* %149, %struct.nish_array* %150)
  %151 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %152 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %153 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %151, %struct.nish_array* %152, %struct.nish_array* %153)
  %154 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %155 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %156 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %154, %struct.nish_array* %155, %struct.nish_array* %156)
  %157 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256Copy(%struct.nish_array* %x1, %struct.nish_array* %157)
  %158 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256Copy(%struct.nish_array* %y1, %struct.nish_array* %158)
  %159 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256Copy(%struct.nish_array* %z1, %struct.nish_array* %159)
  ret void
}

define void @p256PointDouble(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %y, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %z) #1 {
entry:
  %t0.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %t1.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %t2.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %t3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [8 x i32], align 8
  %x3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [8 x i32], align 8
  %y3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [8 x i32], align 8
  %z3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [8 x i32], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [8 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 8, 4
  %3 = bitcast [8 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %t0.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = mul i64 8, 4
  %8 = bitcast [8 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %t1.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = mul i64 8, 4
  %13 = bitcast [8 x i32]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %t2.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = mul i64 8, 4
  %18 = bitcast [8 x i32]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %t3.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 8, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 8, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = mul i64 8, 4
  %23 = bitcast [8 x i32]* %arr.data.4 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %23, i8 0, i64 %22, i1 false), !alias.scope !4, !noalias !3
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %x3.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 8, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 8, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %27 = mul i64 8, 4
  %28 = bitcast [8 x i32]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %28, i8 0, i64 %27, i1 false), !alias.scope !4, !noalias !3
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %y3.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 8, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 8, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = mul i64 8, 4
  %33 = bitcast [8 x i32]* %arr.data.6 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 %32, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %z3.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 8, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 8, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %37 = mul i64 8, 4
  %38 = bitcast [8 x i32]* %arr.data.7 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %38, i8 0, i64 %37, i1 false), !alias.scope !4, !noalias !3
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %38, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.7, %struct.nish_array** %b.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @p256CurveB(%struct.nish_array* %40)
  %41 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatSquare(%struct.nish_array* %41, %struct.nish_array* %x)
  %42 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  call void @p256FiatSquare(%struct.nish_array* %42, %struct.nish_array* %y)
  %43 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatSquare(%struct.nish_array* %43, %struct.nish_array* %z)
  %44 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %44, %struct.nish_array* %x, %struct.nish_array* %y)
  %45 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %47 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %45, %struct.nish_array* %46, %struct.nish_array* %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %48, %struct.nish_array* %x, %struct.nish_array* %z)
  %49 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %51 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %49, %struct.nish_array* %50, %struct.nish_array* %51)
  %52 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %53 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %54 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %52, %struct.nish_array* %53, %struct.nish_array* %54)
  %55 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %56 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %55, %struct.nish_array* %56, %struct.nish_array* %57)
  %58 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %60 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %58, %struct.nish_array* %59, %struct.nish_array* %60)
  %61 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %62 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %61, %struct.nish_array* %62, %struct.nish_array* %63)
  %64 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %65 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %66 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %64, %struct.nish_array* %65, %struct.nish_array* %66)
  %67 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %68 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  %69 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %67, %struct.nish_array* %68, %struct.nish_array* %69)
  %70 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %71 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %70, %struct.nish_array* %71, %struct.nish_array* %72)
  %73 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %74 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %73, %struct.nish_array* %74, %struct.nish_array* %75)
  %76 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %77 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  %78 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %76, %struct.nish_array* %77, %struct.nish_array* %78)
  %79 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  %81 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %79, %struct.nish_array* %80, %struct.nish_array* %81)
  %82 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %83 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %84 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %82, %struct.nish_array* %83, %struct.nish_array* %84)
  %85 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %86 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %85, %struct.nish_array* %86, %struct.nish_array* %87)
  %88 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %89 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %90 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %88, %struct.nish_array* %89, %struct.nish_array* %90)
  %91 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %92 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %93 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %91, %struct.nish_array* %92, %struct.nish_array* %93)
  %94 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %95 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %96 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %94, %struct.nish_array* %95, %struct.nish_array* %96)
  %97 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %98 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %99 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %97, %struct.nish_array* %98, %struct.nish_array* %99)
  %100 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %101 = load %struct.nish_array*, %struct.nish_array** %t3.addr, align 8
  %102 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %100, %struct.nish_array* %101, %struct.nish_array* %102)
  %103 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %104 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %105 = load %struct.nish_array*, %struct.nish_array** %t2.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %103, %struct.nish_array* %104, %struct.nish_array* %105)
  %106 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %107 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %108 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %106, %struct.nish_array* %107, %struct.nish_array* %108)
  %109 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %110 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  %111 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %109, %struct.nish_array* %110, %struct.nish_array* %111)
  %112 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %112, %struct.nish_array* %y, %struct.nish_array* %z)
  %113 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %114 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %115 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %113, %struct.nish_array* %114, %struct.nish_array* %115)
  %116 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %117 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %118 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %116, %struct.nish_array* %117, %struct.nish_array* %118)
  %119 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %120 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %121 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatSub(%struct.nish_array* %119, %struct.nish_array* %120, %struct.nish_array* %121)
  %122 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %123 = load %struct.nish_array*, %struct.nish_array** %t0.addr, align 8
  %124 = load %struct.nish_array*, %struct.nish_array** %t1.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %122, %struct.nish_array* %123, %struct.nish_array* %124)
  %125 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %126 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %127 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %125, %struct.nish_array* %126, %struct.nish_array* %127)
  %128 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %129 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %130 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256FiatAdd(%struct.nish_array* %128, %struct.nish_array* %129, %struct.nish_array* %130)
  %131 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  call void @p256Copy(%struct.nish_array* %x, %struct.nish_array* %131)
  %132 = load %struct.nish_array*, %struct.nish_array** %y3.addr, align 8
  call void @p256Copy(%struct.nish_array* %y, %struct.nish_array* %132)
  %133 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  call void @p256Copy(%struct.nish_array* %z, %struct.nish_array* %133)
  ret void
}

define internal void @p256TableSelectEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %outX, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %outY, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %outZ, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %i, i32 noundef %digit) #1 {
entry:
  %hit.addr = alloca i32, align 4
  %0 = xor i32 %i, %digit
  %1 = sub i32 0, %0
  %2 = or i32 %0, %1
  %3 = lshr i32 %2, 31
  %4 = sub i32 %3, 1
  %5 = call i32 asm "", "=r,0"(i32 %4) readnone nounwind
  %6 = and i32 %5, 1
  store i32 %6, i32* %hit.addr, align 4
  %7 = mul nsw i32 %i, 24
  %8 = load i32, i32* %hit.addr, align 4
  call void @p256TableMove(%struct.nish_array* %outX, %struct.nish_array* %table, i32 %7, i32 %8)
  %9 = mul nsw i32 %i, 24
  %10 = add nsw i32 %9, 8
  %11 = load i32, i32* %hit.addr, align 4
  call void @p256TableMove(%struct.nish_array* %outY, %struct.nish_array* %table, i32 %10, i32 %11)
  %12 = mul nsw i32 %i, 24
  %13 = add nsw i32 %12, 16
  %14 = load i32, i32* %hit.addr, align 4
  call void @p256TableMove(%struct.nish_array* %outZ, %struct.nish_array* %table, i32 %13, i32 %14)
  ret void
}

define void @p256TableSelect(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %outX, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %outY, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %outZ, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %digit) #1 {
entry:
  %j.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %outX, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %outY, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %outZ, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp slt i32 %6, 8
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %j.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %1 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %12 = load i32, i32* %j.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %3 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  store i32 0, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %16 = load i32, i32* %j.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %5 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  store i32 0, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %20 = load i32, i32* %j.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %j.addr, align 4
  br label %for.cond

for.end:
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 0, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 1, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 2, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 3, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 4, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 5, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 6, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 7, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 8, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 9, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 10, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 11, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 12, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 13, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 14, i32 %digit)
  call void @p256TableSelectEntry(%struct.nish_array* %outX, %struct.nish_array* %outY, %struct.nish_array* %outZ, %struct.nish_array* %table, i32 15, i32 %digit)
  ret void
}

define void @p256WindowStep(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %y, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %z, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, i32 noundef %digit) #1 {
entry:
  %ex.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %ey.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %ez.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 8, 4
  %3 = bitcast [8 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ex.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = mul i64 8, 4
  %8 = bitcast [8 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ey.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = mul i64 8, 4
  %13 = bitcast [8 x i32]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %ez.addr, align 8
  call void @p256PointDouble(%struct.nish_array* %x, %struct.nish_array* %y, %struct.nish_array* %z)
  call void @p256PointDouble(%struct.nish_array* %x, %struct.nish_array* %y, %struct.nish_array* %z)
  call void @p256PointDouble(%struct.nish_array* %x, %struct.nish_array* %y, %struct.nish_array* %z)
  call void @p256PointDouble(%struct.nish_array* %x, %struct.nish_array* %y, %struct.nish_array* %z)
  %15 = load %struct.nish_array*, %struct.nish_array** %ex.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %ey.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %ez.addr, align 8
  call void @p256TableSelect(%struct.nish_array* %15, %struct.nish_array* %16, %struct.nish_array* %17, %struct.nish_array* %table, i32 %digit)
  %18 = load %struct.nish_array*, %struct.nish_array** %ex.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %ey.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %ez.addr, align 8
  call void @p256PointAdd(%struct.nish_array* %x, %struct.nish_array* %y, %struct.nish_array* %z, %struct.nish_array* %18, %struct.nish_array* %19, %struct.nish_array* %20)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @limbsOfHex(i8* noundef nonnull noalias readonly align 8 nocapture %text) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %code.addr = alloca i32, align 4
  %nibble.addr = alloca i32, align 4
  %limb.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 8, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 8, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = mul i64 8, 4
  %5 = call i8* @nish_alloc_struct(i64 %4)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 64
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %text to i64*
  %15 = load i64, i64* %14, align 8
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok:
  %17 = getelementptr inbounds i8, i8* %text, i64 8
  %18 = getelementptr inbounds i8, i8* %17, i64 %13
  %19 = load i8, i8* %18, align 1
  %20 = zext i8 %19 to i32
  store i32 %20, i32* %code.addr, align 4
  %21 = load i32, i32* %code.addr, align 4
  %22 = icmp sle i32 %21, 57
  br i1 %22, label %cond.true, label %cond.false

cond.true:
  %23 = load i32, i32* %code.addr, align 4
  %24 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %23, i32 48)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %27 = load i32, i32* %code.addr, align 4
  %28 = sub nsw i32 %27, 87
  br label %cond.end

cond.end:
  %29 = phi i32 [ %25, %ovf.ok ], [ %28, %cond.false ]
  store i32 %29, i32* %nibble.addr, align 4
  %30 = load i32, i32* %i.addr, align 4
  %31 = sub nsw i32 63, %30
  %32 = ashr i32 %31, 3
  store i32 %32, i32* %limb.addr, align 4
  %33 = load i32, i32* %limb.addr, align 4
  %34 = icmp sge i32 %33, 0
  br i1 %34, label %land.rhs, label %land.end

land.rhs:
  %35 = load i32, i32* %limb.addr, align 4
  %36 = icmp slt i32 %35, 8
  br label %land.end

land.end:
  %37 = phi i1 [ false, %cond.end ], [ %36, %land.rhs ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %limb.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %limb.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %9 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %41
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %45 = load i32, i32* %nibble.addr, align 4
  %46 = load i32, i32* %i.addr, align 4
  %47 = sub nsw i32 63, %46
  %48 = and i32 %47, 7
  %49 = mul nsw i32 4, %48
  %50 = and i32 %49, 31
  %51 = shl i32 %45, %50
  %52 = or i32 %44, %51
  %53 = bitcast i8* %9 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 %39
  store i32 %52, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %55 = load i32, i32* %i.addr, align 4
  %56 = add nsw i32 %55, 1
  store i32 %56, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %57 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %57

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 i8* @hexOfLimbs(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #1 {
entry:
  %digits.addr = alloca i8*, align 8
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %limb.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  store i8* bitcast ({ i64, [17 x i8] }* @.str.0 to i8*), i8** %digits.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 63, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = ashr i32 %5, 3
  store i32 %6, i32* %limb.addr, align 4
  %7 = load i32, i32* %limb.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %limb.addr, align 4
  %10 = icmp slt i32 %9, 8
  br label %land.end

land.end:
  %11 = phi i1 [ false, %for.body ], [ %10, %land.rhs ]
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load i32, i32* %limb.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %19 = load i32, i32* %i.addr, align 4
  %20 = and i32 %19, 7
  %21 = mul nsw i32 4, %20
  %22 = and i32 %21, 31
  %23 = lshr i32 %18, %22
  %24 = and i32 %23, 15
  store i32 %24, i32* %v.addr, align 4
  %25 = load i32, i32* %v.addr, align 4
  %26 = icmp sge i32 %25, 0
  br i1 %26, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %27 = load i32, i32* %v.addr, align 4
  %28 = load i8*, i8** %digits.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = trunc i64 %30 to i32
  %32 = icmp slt i32 %27, %31
  br label %land.end.1

land.end.1:
  %33 = phi i1 [ false, %if.then ], [ %32, %land.rhs.1 ]
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  %34 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %35 = load i8*, i8** %digits.addr, align 8
  %36 = bitcast i8* %35 to i64*
  %37 = load i64, i64* %36, align 8
  %38 = load i32, i32* %v.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %v.addr, align 4
  %41 = add nsw i32 %40, 1
  %42 = sext i32 %41 to i64
  %43 = call i64 @llvm.smin.i64(i64 %42, i64 %37)
  %44 = call i64 @llvm.smax.i64(i64 %43, i64 0)
  %45 = call i64 @llvm.smin.i64(i64 %39, i64 %44)
  %46 = call i64 @llvm.smax.i64(i64 %39, i64 %44)
  %47 = sub i64 %46, %45
  %48 = getelementptr inbounds i8, i8* %35, i64 8
  %49 = getelementptr inbounds i8, i8* %48, i64 %45
  %50 = call i8* @nish_str_new(i8* %49, i64 %47)
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %55 = icmp eq i64 %52, %54
  br i1 %55, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %34, i64 8)
  br label %push.store

push.store:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = bitcast i8* %57 to i8**
  %59 = getelementptr inbounds i8*, i8** %58, i64 %52
  store i8* %50, i8** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %60 = add i64 %52, 1
  store i64 %60, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %61 = trunc i64 %60 to i32
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %62 = load i32, i32* %i.addr, align 4
  %63 = sub nsw i32 %62, 1
  store i32 %63, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %64 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %67 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*) to i64*
  %68 = load i64, i64* %67, align 8
  %69 = sub i64 %66, 1
  %70 = mul i64 %68, %69
  %71 = icmp eq i64 %66, 0
  %72 = select i1 %71, i64 0, i64 %70
  store i64 %72, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %73 = load i64, i64* %join.at, align 8
  %74 = icmp ult i64 %73, %66
  br i1 %74, label %join.sum.body, label %join.copy

join.sum.body:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = bitcast i8* %76 to i8**
  %78 = getelementptr inbounds i8*, i8** %77, i64 %73
  %79 = load i8*, i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %80 = load i64, i64* %join.total, align 8
  %81 = bitcast i8* %79 to i64*
  %82 = load i64, i64* %81, align 8
  %83 = add i64 %80, %82
  store i64 %83, i64* %join.total, align 8
  %84 = add i64 %73, 1
  store i64 %84, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %85 = load i64, i64* %join.total, align 8
  %86 = icmp ugt i64 %85, 2147483647
  %87 = add i64 %85, 9
  %88 = select i1 %86, i64 4611686018427387904, i64 %87
  %89 = call i8* @nish_alloc_struct(i64 %88)
  %90 = bitcast i8* %89 to i64*
  store i64 %85, i64* %90, align 8
  %91 = getelementptr inbounds i8, i8* %89, i64 8
  store i8* %91, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %92 = load i64, i64* %join.at, align 8
  %93 = icmp ult i64 %92, %66
  br i1 %93, label %join.part, label %join.end

join.part:
  %94 = load i8*, i8** %join.p, align 8
  %95 = icmp eq i64 %92, 0
  %96 = select i1 %95, i64 0, i64 %68
  %97 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %94, i8* %97, i64 %96, i1 false)
  %98 = getelementptr inbounds i8, i8* %94, i64 %96
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = bitcast i8* %100 to i8**
  %102 = getelementptr inbounds i8*, i8** %101, i64 %92
  %103 = load i8*, i8** %102, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %104 = bitcast i8* %103 to i64*
  %105 = load i64, i64* %104, align 8
  %106 = getelementptr inbounds i8, i8* %103, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %98, i8* %106, i64 %105, i1 false)
  %107 = getelementptr inbounds i8, i8* %98, i64 %105
  store i8* %107, i8** %join.p, align 8
  %108 = add i64 %92, 1
  store i64 %108, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %109 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %109, align 1
  ret i8* %89
}

define internal void @toMontgomery(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %a) #2 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.2 to i8*))
  call void @p256FiatMul(%struct.nish_array* %a, %struct.nish_array* %a, %struct.nish_array* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @fromMontgomery(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %a) #2 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.3 to i8*))
  call void @p256FiatMul(%struct.nish_array* %a, %struct.nish_array* %a, %struct.nish_array* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @invert(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a) #2 {
entry:
  %e.addr = alloca %struct.nish_array*, align 8
  %acc.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %limb.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.4 to i8*))
  store %struct.nish_array* %0, %struct.nish_array** %e.addr, align 8
  %1 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.5 to i8*))
  store %struct.nish_array* %1, %struct.nish_array** %acc.addr, align 8
  store i32 255, i32* %i.addr, align 4
  %2 = load %struct.nish_array*, %struct.nish_array** %e.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp sge i32 %5, 0
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @p256FiatSquare(%struct.nish_array* %7, %struct.nish_array* %8)
  %9 = load i32, i32* %i.addr, align 4
  %10 = ashr i32 %9, 5
  store i32 %10, i32* %limb.addr, align 4
  %11 = load i32, i32* %limb.addr, align 4
  %12 = icmp sge i32 %11, 0
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %limb.addr, align 4
  %14 = icmp slt i32 %13, 8
  br label %land.end.1

land.end.1:
  %15 = phi i1 [ false, %for.body ], [ %14, %land.rhs.1 ]
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load i32, i32* %limb.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %4 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %21 = load i32, i32* %i.addr, align 4
  %22 = and i32 %21, 31
  %23 = and i32 %22, 31
  %24 = lshr i32 %20, %23
  %25 = and i32 %24, 1
  %26 = icmp eq i32 %25, 1
  br label %land.end

land.end:
  %27 = phi i1 [ false, %land.end.1 ], [ %26, %land.rhs ]
  br i1 %27, label %if.then, label %if.end

if.then:
  %28 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  %29 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %28, %struct.nish_array* %29, %struct.nish_array* %a)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = sub nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %32 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @p256Copy(%struct.nish_array* %out, %struct.nish_array* %32)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef nonnull align 8 i8* @baseMult(i8* noundef nonnull noalias readonly align 8 nocapture %k) #2 {
entry:
  %gx.addr = alloca %struct.nish_array*, align 8
  %gy.addr = alloca %struct.nish_array*, align 8
  %gz.addr = alloca %struct.nish_array*, align 8
  %table.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [384 x i32], align 8
  %ax.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %ay.addr = alloca %struct.nish_array*, align 8
  %az.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %x.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [8 x i32], align 8
  %y.addr = alloca %struct.nish_array*, align 8
  %z.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [8 x i32], align 8
  %i.addr.1 = alloca i32, align 4
  %code.addr = alloca i32, align 4
  %zInverse.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [8 x i32], align 8
  %0 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.6 to i8*))
  store %struct.nish_array* %0, %struct.nish_array** %gx.addr, align 8
  %1 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.7 to i8*))
  store %struct.nish_array* %1, %struct.nish_array** %gy.addr, align 8
  %2 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.5 to i8*))
  store %struct.nish_array* %2, %struct.nish_array** %gz.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %gx.addr, align 8
  call void @toMontgomery(%struct.nish_array* %3)
  %4 = load %struct.nish_array*, %struct.nish_array** %gy.addr, align 8
  call void @toMontgomery(%struct.nish_array* %4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 384, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 384, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = mul i64 384, 4
  %8 = bitcast [384 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %table.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = mul i64 8, 4
  %13 = bitcast [8 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ax.addr, align 8
  %15 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.5 to i8*))
  store %struct.nish_array* %15, %struct.nish_array** %ay.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %18 = mul i64 8, 4
  %19 = bitcast [8 x i32]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %19, i8 0, i64 %18, i1 false), !alias.scope !4, !noalias !3
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %az.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %21 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = load %struct.nish_array*, %struct.nish_array** %ax.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = load %struct.nish_array*, %struct.nish_array** %ay.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = load %struct.nish_array*, %struct.nish_array** %az.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %33 = load i32, i32* %i.addr, align 4
  %34 = icmp slt i32 %33, 16
  br i1 %34, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  %35 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = load %struct.nish_array*, %struct.nish_array** %ax.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = load %struct.nish_array*, %struct.nish_array** %ay.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = load %struct.nish_array*, %struct.nish_array** %az.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.1

for.cond.1:
  %47 = load i32, i32* %j.addr, align 4
  %48 = icmp slt i32 %47, 8
  br i1 %48, label %for.body.1, label %for.end.1

for.body.1:
  %49 = load i32, i32* %i.addr, align 4
  %50 = mul nsw i32 %49, 24
  %51 = load i32, i32* %j.addr, align 4
  %52 = add nsw i32 %50, %51
  %53 = sext i32 %52 to i64
  %54 = load i32, i32* %j.addr, align 4
  %55 = sext i32 %54 to i64
  %56 = bitcast i8* %40 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %55
  %58 = load i32, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %59 = bitcast i8* %37 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %53
  store i32 %58, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %61 = load i32, i32* %i.addr, align 4
  %62 = mul nsw i32 %61, 24
  %63 = add nsw i32 %62, 8
  %64 = load i32, i32* %j.addr, align 4
  %65 = add nsw i32 %63, %64
  %66 = sext i32 %65 to i64
  %67 = load i32, i32* %j.addr, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %43 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 %68
  %71 = load i32, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %72 = bitcast i8* %37 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 %66
  store i32 %71, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %74 = load i32, i32* %i.addr, align 4
  %75 = mul nsw i32 %74, 24
  %76 = add nsw i32 %75, 16
  %77 = load i32, i32* %j.addr, align 4
  %78 = add nsw i32 %76, %77
  %79 = sext i32 %78 to i64
  %80 = load i32, i32* %j.addr, align 4
  %81 = sext i32 %80 to i64
  %82 = bitcast i8* %46 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 %81
  %84 = load i32, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %85 = bitcast i8* %37 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 %79
  store i32 %84, i32* %86, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc.1

for.inc.1:
  %87 = load i32, i32* %j.addr, align 4
  %88 = add nsw i32 %87, 1
  store i32 %88, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %89 = load %struct.nish_array*, %struct.nish_array** %ax.addr, align 8
  %90 = load %struct.nish_array*, %struct.nish_array** %ay.addr, align 8
  %91 = load %struct.nish_array*, %struct.nish_array** %az.addr, align 8
  %92 = load %struct.nish_array*, %struct.nish_array** %gx.addr, align 8
  %93 = load %struct.nish_array*, %struct.nish_array** %gy.addr, align 8
  %94 = load %struct.nish_array*, %struct.nish_array** %gz.addr, align 8
  call void @p256PointAdd(%struct.nish_array* %89, %struct.nish_array* %90, %struct.nish_array* %91, %struct.nish_array* %92, %struct.nish_array* %93, %struct.nish_array* %94)
  br label %for.inc

for.inc:
  %95 = load i32, i32* %i.addr, align 4
  %96 = add nsw i32 %95, 1
  store i32 %96, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %99 = mul i64 8, 4
  %100 = bitcast [8 x i32]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %100, i8 0, i64 %99, i1 false), !alias.scope !4, !noalias !3
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %100, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %x.addr, align 8
  %102 = call %struct.nish_array* @limbsOfHex(i8* bitcast ({ i64, [65 x i8] }* @.str.5 to i8*))
  store %struct.nish_array* %102, %struct.nish_array** %y.addr, align 8
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 8, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 8, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %105 = mul i64 8, 4
  %106 = bitcast [8 x i32]* %arr.data.4 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %106, i8 0, i64 %105, i1 false), !alias.scope !4, !noalias !3
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %106, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %z.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.2

for.cond.2:
  %108 = load i32, i32* %i.addr.1, align 4
  %109 = icmp slt i32 %108, 64
  br i1 %109, label %for.body.2, label %for.end.2

for.body.2:
  %110 = load i32, i32* %i.addr.1, align 4
  %111 = sext i32 %110 to i64
  %112 = bitcast i8* %k to i64*
  %113 = load i64, i64* %112, align 8
  %114 = icmp ult i64 %111, %113
  br i1 %114, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %111, i64 %113)
  unreachable

bounds.ok:
  %115 = getelementptr inbounds i8, i8* %k, i64 8
  %116 = getelementptr inbounds i8, i8* %115, i64 %111
  %117 = load i8, i8* %116, align 1
  %118 = zext i8 %117 to i32
  store i32 %118, i32* %code.addr, align 4
  %119 = load %struct.nish_array*, %struct.nish_array** %x.addr, align 8
  %120 = load %struct.nish_array*, %struct.nish_array** %y.addr, align 8
  %121 = load %struct.nish_array*, %struct.nish_array** %z.addr, align 8
  %122 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %123 = load i32, i32* %code.addr, align 4
  %124 = icmp sle i32 %123, 57
  br i1 %124, label %cond.true, label %cond.false

cond.true:
  %125 = load i32, i32* %code.addr, align 4
  %126 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %125, i32 48)
  %127 = extractvalue { i32, i1 } %126, 0
  %128 = extractvalue { i32, i1 } %126, 1
  br i1 %128, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %129 = load i32, i32* %code.addr, align 4
  %130 = sub nsw i32 %129, 87
  br label %cond.end

cond.end:
  %131 = phi i32 [ %127, %ovf.ok ], [ %130, %cond.false ]
  call void @p256WindowStep(%struct.nish_array* %119, %struct.nish_array* %120, %struct.nish_array* %121, %struct.nish_array* %122, i32 %131)
  br label %for.inc.2

for.inc.2:
  %132 = load i32, i32* %i.addr.1, align 4
  %133 = add nsw i32 %132, 1
  store i32 %133, i32* %i.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 8, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 8, i64* %135, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %136 = mul i64 8, 4
  %137 = bitcast [8 x i32]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %137, i8 0, i64 %136, i1 false), !alias.scope !4, !noalias !3
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %137, i8** %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %zInverse.addr, align 8
  %139 = load %struct.nish_array*, %struct.nish_array** %zInverse.addr, align 8
  %140 = load %struct.nish_array*, %struct.nish_array** %z.addr, align 8
  call void @invert(%struct.nish_array* %139, %struct.nish_array* %140)
  %141 = load %struct.nish_array*, %struct.nish_array** %x.addr, align 8
  %142 = load %struct.nish_array*, %struct.nish_array** %x.addr, align 8
  %143 = load %struct.nish_array*, %struct.nish_array** %zInverse.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %141, %struct.nish_array* %142, %struct.nish_array* %143)
  %144 = load %struct.nish_array*, %struct.nish_array** %y.addr, align 8
  %145 = load %struct.nish_array*, %struct.nish_array** %y.addr, align 8
  %146 = load %struct.nish_array*, %struct.nish_array** %zInverse.addr, align 8
  call void @p256FiatMul(%struct.nish_array* %144, %struct.nish_array* %145, %struct.nish_array* %146)
  %147 = load %struct.nish_array*, %struct.nish_array** %x.addr, align 8
  call void @fromMontgomery(%struct.nish_array* %147)
  %148 = load %struct.nish_array*, %struct.nish_array** %y.addr, align 8
  call void @fromMontgomery(%struct.nish_array* %148)
  %149 = load %struct.nish_array*, %struct.nish_array** %x.addr, align 8
  %150 = call i64 @nish_arena_mark()
  %151 = call i8* @hexOfLimbs(%struct.nish_array* %149)
  %152 = call i8* @nish_arena_keep(i64 %150, i8* %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %154 = load %struct.nish_array*, %struct.nish_array** %y.addr, align 8
  %155 = call i64 @nish_arena_mark()
  %156 = call i8* @hexOfLimbs(%struct.nish_array* %154)
  %157 = call i8* @nish_arena_keep(i64 %155, i8* %156)
  %158 = call i8* @nish_str_concat(i8* %153, i8* %157)
  ret i8* %158

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @report(i8* noundef nonnull noalias readonly align 8 nocapture %name, i8* noundef nonnull noalias readonly align 8 nocapture %actual, i8* noundef nonnull noalias readonly align 8 nocapture %expected) #2 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_str_eq(i8* %actual, i8* %expected)
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.9 to i8*), i8* %name)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

if.end:
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*), i8* %name)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [3 x i8] }* @.str.11 to i8*))
  %4 = call i8* @nish_str_concat(i8* %3, i8* %actual)
  call void @nish_print(i8* %4)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1
}

define internal noundef nonnull align 8 i8* @mulHex(i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 %b) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 8, 4
  %3 = bitcast [8 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %6 = call %struct.nish_array* @limbsOfHex(i8* %a)
  %7 = call %struct.nish_array* @limbsOfHex(i8* %b)
  call void @p256FiatMul(%struct.nish_array* %5, %struct.nish_array* %6, %struct.nish_array* %7)
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @hexOfLimbs(%struct.nish_array* %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  ret i8* %11
}

define internal noundef nonnull align 8 i8* @squareHex(i8* noundef nonnull noalias readonly align 8 %a) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 8, 4
  %3 = bitcast [8 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %6 = call %struct.nish_array* @limbsOfHex(i8* %a)
  call void @p256FiatSquare(%struct.nish_array* %5, %struct.nish_array* %6)
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = call i64 @nish_arena_mark()
  %9 = call i8* @hexOfLimbs(%struct.nish_array* %7)
  %10 = call i8* @nish_arena_keep(i64 %8, i8* %9)
  ret i8* %10
}

define internal noundef nonnull align 8 i8* @scalarMulHex(i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 %b) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 8, 4
  %3 = bitcast [8 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %6 = call %struct.nish_array* @limbsOfHex(i8* %a)
  %7 = call %struct.nish_array* @limbsOfHex(i8* %b)
  call void @p256FiatScalarMul(%struct.nish_array* %5, %struct.nish_array* %6, %struct.nish_array* %7)
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @hexOfLimbs(%struct.nish_array* %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  ret i8* %11
}

define internal noundef i32 @knownAnswers() #2 {
entry:
  %a.addr = alloca i8*, align 8
  %b.addr = alloca i8*, align 8
  %pMinus1.addr = alloca i8*, align 8
  %pMinus1Squared.addr = alloca i8*, align 8
  %montOne.addr = alloca i8*, align 8
  %zero.addr = alloca i8*, align 8
  %nMinus1.addr = alloca i8*, align 8
  %failed.addr = alloca i32, align 4
  %inPlace.addr = alloca %struct.nish_array*, align 8
  %table.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [24 x i32], align 8
  %i.addr = alloca i32, align 4
  %moved.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [65 x i8] }* @.str.12 to i8*), i8** %a.addr, align 8
  store i8* bitcast ({ i64, [65 x i8] }* @.str.13 to i8*), i8** %b.addr, align 8
  store i8* bitcast ({ i64, [65 x i8] }* @.str.14 to i8*), i8** %pMinus1.addr, align 8
  store i8* bitcast ({ i64, [65 x i8] }* @.str.15 to i8*), i8** %pMinus1Squared.addr, align 8
  store i8* bitcast ({ i64, [65 x i8] }* @.str.5 to i8*), i8** %montOne.addr, align 8
  store i8* bitcast ({ i64, [65 x i8] }* @.str.16 to i8*), i8** %zero.addr, align 8
  store i8* bitcast ({ i64, [65 x i8] }* @.str.17 to i8*), i8** %nMinus1.addr, align 8
  store i32 0, i32* %failed.addr, align 4
  %0 = load i32, i32* %failed.addr, align 4
  %1 = load i8*, i8** %a.addr, align 8
  %2 = load i8*, i8** %b.addr, align 8
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @mulHex(i8* %1, i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  %6 = call i32 @report(i8* bitcast ({ i64, [27 x i8] }* @.str.18 to i8*), i8* %5, i8* bitcast ({ i64, [65 x i8] }* @.str.19 to i8*))
  %7 = add nsw i32 %0, %6
  store i32 %7, i32* %failed.addr, align 4
  %8 = load i32, i32* %failed.addr, align 4
  %9 = load i8*, i8** %pMinus1.addr, align 8
  %10 = load i8*, i8** %pMinus1.addr, align 8
  %11 = call i64 @nish_arena_mark()
  %12 = call i8* @mulHex(i8* %9, i8* %10)
  %13 = call i8* @nish_arena_keep(i64 %11, i8* %12)
  %14 = load i8*, i8** %pMinus1Squared.addr, align 8
  %15 = call i32 @report(i8* bitcast ({ i64, [33 x i8] }* @.str.20 to i8*), i8* %13, i8* %14)
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %failed.addr, align 4
  %19 = load i32, i32* %failed.addr, align 4
  %20 = load i8*, i8** %montOne.addr, align 8
  %21 = load i8*, i8** %a.addr, align 8
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @mulHex(i8* %20, i8* %21)
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  %25 = load i8*, i8** %a.addr, align 8
  %26 = call i32 @report(i8* bitcast ({ i64, [30 x i8] }* @.str.21 to i8*), i8* %24, i8* %25)
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %28, i32* %failed.addr, align 4
  %30 = load i32, i32* %failed.addr, align 4
  %31 = load i8*, i8** %zero.addr, align 8
  %32 = load i8*, i8** %a.addr, align 8
  %33 = call i64 @nish_arena_mark()
  %34 = call i8* @mulHex(i8* %31, i8* %32)
  %35 = call i8* @nish_arena_keep(i64 %33, i8* %34)
  %36 = load i8*, i8** %zero.addr, align 8
  %37 = call i32 @report(i8* bitcast ({ i64, [34 x i8] }* @.str.22 to i8*), i8* %35, i8* %36)
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %39, i32* %failed.addr, align 4
  %41 = load i8*, i8** %a.addr, align 8
  %42 = call %struct.nish_array* @limbsOfHex(i8* %41)
  store %struct.nish_array* %42, %struct.nish_array** %inPlace.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %inPlace.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %inPlace.addr, align 8
  %45 = load i8*, i8** %b.addr, align 8
  %46 = call %struct.nish_array* @limbsOfHex(i8* %45)
  call void @p256FiatMul(%struct.nish_array* %43, %struct.nish_array* %44, %struct.nish_array* %46)
  %47 = load i32, i32* %failed.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %inPlace.addr, align 8
  %49 = call i64 @nish_arena_mark()
  %50 = call i8* @hexOfLimbs(%struct.nish_array* %48)
  %51 = call i8* @nish_arena_keep(i64 %49, i8* %50)
  %52 = load i8*, i8** %a.addr, align 8
  %53 = load i8*, i8** %b.addr, align 8
  %54 = call i64 @nish_arena_mark()
  %55 = call i8* @mulHex(i8* %52, i8* %53)
  %56 = call i8* @nish_arena_keep(i64 %54, i8* %55)
  %57 = call i32 @report(i8* bitcast ({ i64, [29 x i8] }* @.str.23 to i8*), i8* %51, i8* %56)
  %58 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %47, i32 %57)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %59, i32* %failed.addr, align 4
  %61 = load i32, i32* %failed.addr, align 4
  %62 = load i8*, i8** %a.addr, align 8
  %63 = call i64 @nish_arena_mark()
  %64 = call i8* @squareHex(i8* %62)
  %65 = call i8* @nish_arena_keep(i64 %63, i8* %64)
  %66 = call i32 @report(i8* bitcast ({ i64, [30 x i8] }* @.str.24 to i8*), i8* %65, i8* bitcast ({ i64, [65 x i8] }* @.str.25 to i8*))
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %66)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %68, i32* %failed.addr, align 4
  %70 = load i32, i32* %failed.addr, align 4
  %71 = load i8*, i8** %pMinus1.addr, align 8
  %72 = call i64 @nish_arena_mark()
  %73 = call i8* @squareHex(i8* %71)
  %74 = call i8* @nish_arena_keep(i64 %72, i8* %73)
  %75 = load i8*, i8** %pMinus1Squared.addr, align 8
  %76 = call i32 @report(i8* bitcast ({ i64, [36 x i8] }* @.str.26 to i8*), i8* %74, i8* %75)
  %77 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %70, i32 %76)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %78, i32* %failed.addr, align 4
  %80 = load i32, i32* %failed.addr, align 4
  %81 = call i64 @nish_arena_mark()
  %82 = call i8* @scalarMulHex(i8* bitcast ({ i64, [65 x i8] }* @.str.28 to i8*), i8* bitcast ({ i64, [65 x i8] }* @.str.29 to i8*))
  %83 = call i8* @nish_arena_keep(i64 %81, i8* %82)
  %84 = call i32 @report(i8* bitcast ({ i64, [33 x i8] }* @.str.27 to i8*), i8* %83, i8* bitcast ({ i64, [65 x i8] }* @.str.30 to i8*))
  %85 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %80, i32 %84)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %86, i32* %failed.addr, align 4
  %88 = load i32, i32* %failed.addr, align 4
  %89 = load i8*, i8** %nMinus1.addr, align 8
  %90 = load i8*, i8** %nMinus1.addr, align 8
  %91 = call i64 @nish_arena_mark()
  %92 = call i8* @scalarMulHex(i8* %89, i8* %90)
  %93 = call i8* @nish_arena_keep(i64 %91, i8* %92)
  %94 = call i32 @report(i8* bitcast ({ i64, [39 x i8] }* @.str.31 to i8*), i8* %93, i8* bitcast ({ i64, [65 x i8] }* @.str.32 to i8*))
  %95 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %88, i32 %94)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %96, i32* %failed.addr, align 4
  %98 = load i32, i32* %failed.addr, align 4
  %99 = call i32 @p256FiatCmovznzU32(i32 0, i32 7, i32 9)
  %100 = zext i32 %99 to i64
  %101 = call i8* @nish_str_from_u64(i64 %100)
  %102 = call i32 @report(i8* bitcast ({ i64, [33 x i8] }* @.str.33 to i8*), i8* %101, i8* bitcast ({ i64, [2 x i8] }* @.str.34 to i8*))
  %103 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %98, i32 %102)
  %104 = extractvalue { i32, i1 } %103, 0
  %105 = extractvalue { i32, i1 } %103, 1
  br i1 %105, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  store i32 %104, i32* %failed.addr, align 4
  %106 = load i32, i32* %failed.addr, align 4
  %107 = call i32 @p256FiatCmovznzU32(i32 1, i32 7, i32 9)
  %108 = zext i32 %107 to i64
  %109 = call i8* @nish_str_from_u64(i64 %108)
  %110 = call i32 @report(i8* bitcast ({ i64, [33 x i8] }* @.str.35 to i8*), i8* %109, i8* bitcast ({ i64, [2 x i8] }* @.str.36 to i8*))
  %111 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %106, i32 %110)
  %112 = extractvalue { i32, i1 } %111, 0
  %113 = extractvalue { i32, i1 } %111, 1
  br i1 %113, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  store i32 %112, i32* %failed.addr, align 4
  %114 = load i32, i32* %failed.addr, align 4
  %115 = call i32 @p256FiatCmovznzU32(i32 2147483648, i32 7, i32 9)
  %116 = zext i32 %115 to i64
  %117 = call i8* @nish_str_from_u64(i64 %116)
  %118 = call i32 @report(i8* bitcast ({ i64, [44 x i8] }* @.str.37 to i8*), i8* %117, i8* bitcast ({ i64, [2 x i8] }* @.str.36 to i8*))
  %119 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %114, i32 %118)
  %120 = extractvalue { i32, i1 } %119, 0
  %121 = extractvalue { i32, i1 } %119, 1
  br i1 %121, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  store i32 %120, i32* %failed.addr, align 4
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 24, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 24, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %124 = mul i64 24, 4
  %125 = bitcast [24 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %125, i8 0, i64 %124, i1 false), !alias.scope !4, !noalias !3
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %125, i8** %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %table.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %127 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %130 = load i32, i32* %i.addr, align 4
  %131 = icmp slt i32 %130, 24
  br i1 %131, label %for.body, label %for.end

for.body:
  %132 = load i32, i32* %i.addr, align 4
  %133 = sext i32 %132 to i64
  %134 = load i32, i32* %i.addr, align 4
  %135 = ashr i32 %134, 3
  %136 = mul nsw i32 100, %135
  %137 = load i32, i32* %i.addr, align 4
  %138 = and i32 %137, 7
  %139 = add nsw i32 %136, %138
  %140 = bitcast i8* %129 to i32*
  %141 = getelementptr inbounds i32, i32* %140, i64 %133
  store i32 %139, i32* %141, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %142 = load i32, i32* %i.addr, align 4
  %143 = add nsw i32 %142, 1
  store i32 %143, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %144 = load i8*, i8** %a.addr, align 8
  %145 = call %struct.nish_array* @limbsOfHex(i8* %144)
  store %struct.nish_array* %145, %struct.nish_array** %moved.addr, align 8
  %146 = load %struct.nish_array*, %struct.nish_array** %moved.addr, align 8
  %147 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  call void @p256TableMove(%struct.nish_array* %146, %struct.nish_array* %147, i32 8, i32 0)
  %148 = load i32, i32* %failed.addr, align 4
  %149 = load %struct.nish_array*, %struct.nish_array** %moved.addr, align 8
  %150 = call i64 @nish_arena_mark()
  %151 = call i8* @hexOfLimbs(%struct.nish_array* %149)
  %152 = call i8* @nish_arena_keep(i64 %150, i8* %151)
  %153 = load i8*, i8** %a.addr, align 8
  %154 = call i32 @report(i8* bitcast ({ i64, [42 x i8] }* @.str.38 to i8*), i8* %152, i8* %153)
  %155 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %148, i32 %154)
  %156 = extractvalue { i32, i1 } %155, 0
  %157 = extractvalue { i32, i1 } %155, 1
  br i1 %157, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  store i32 %156, i32* %failed.addr, align 4
  %158 = load %struct.nish_array*, %struct.nish_array** %moved.addr, align 8
  %159 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  call void @p256TableMove(%struct.nish_array* %158, %struct.nish_array* %159, i32 8, i32 1)
  %160 = load i32, i32* %failed.addr, align 4
  %161 = load %struct.nish_array*, %struct.nish_array** %moved.addr, align 8
  %162 = call i64 @nish_arena_mark()
  %163 = call i8* @hexOfLimbs(%struct.nish_array* %161)
  %164 = call i8* @nish_arena_keep(i64 %162, i8* %163)
  %165 = call i32 @report(i8* bitcast ({ i64, [51 x i8] }* @.str.39 to i8*), i8* %164, i8* bitcast ({ i64, [65 x i8] }* @.str.40 to i8*))
  %166 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %160, i32 %165)
  %167 = extractvalue { i32, i1 } %166, 0
  %168 = extractvalue { i32, i1 } %166, 1
  br i1 %168, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  store i32 %167, i32* %failed.addr, align 4
  %169 = load i32, i32* %failed.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %169

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #2 {
entry:
  %failed.addr = alloca i32, align 4
  %sample.addr = alloca i8*, align 8
  %test.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @knownAnswers()
  store i32 %0, i32* %failed.addr, align 4
  %1 = load i32, i32* %failed.addr, align 4
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @baseMult(i8* bitcast ({ i64, [65 x i8] }* @.str.42 to i8*))
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  %5 = call i32 @report(i8* bitcast ({ i64, [26 x i8] }* @.str.41 to i8*), i8* %4, i8* bitcast ({ i64, [130 x i8] }* @.str.43 to i8*))
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %failed.addr, align 4
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @baseMult(i8* bitcast ({ i64, [65 x i8] }* @.str.44 to i8*))
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  store i8* %11, i8** %sample.addr, align 8
  %12 = load i32, i32* %failed.addr, align 4
  %13 = load i8*, i8** %sample.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = call i64 @llvm.smin.i64(i64 64, i64 %15)
  %17 = call i64 @llvm.smax.i64(i64 %16, i64 0)
  %18 = call i64 @llvm.smin.i64(i64 0, i64 %17)
  %19 = call i64 @llvm.smax.i64(i64 0, i64 %17)
  %20 = sub i64 %19, %18
  %21 = getelementptr inbounds i8, i8* %13, i64 8
  %22 = getelementptr inbounds i8, i8* %21, i64 %18
  %23 = call i8* @nish_str_new(i8* %22, i64 %20)
  %24 = call i32 @report(i8* bitcast ({ i64, [47 x i8] }* @.str.45 to i8*), i8* %23, i8* bitcast ({ i64, [65 x i8] }* @.str.46 to i8*))
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %26, i32* %failed.addr, align 4
  %28 = call i64 @nish_arena_mark()
  %29 = call i8* @baseMult(i8* bitcast ({ i64, [65 x i8] }* @.str.47 to i8*))
  %30 = call i8* @nish_arena_keep(i64 %28, i8* %29)
  store i8* %30, i8** %test.addr, align 8
  %31 = load i32, i32* %failed.addr, align 4
  %32 = load i8*, i8** %test.addr, align 8
  %33 = bitcast i8* %32 to i64*
  %34 = load i64, i64* %33, align 8
  %35 = call i64 @llvm.smin.i64(i64 64, i64 %34)
  %36 = call i64 @llvm.smax.i64(i64 %35, i64 0)
  %37 = call i64 @llvm.smin.i64(i64 0, i64 %36)
  %38 = call i64 @llvm.smax.i64(i64 0, i64 %36)
  %39 = sub i64 %38, %37
  %40 = getelementptr inbounds i8, i8* %32, i64 8
  %41 = getelementptr inbounds i8, i8* %40, i64 %37
  %42 = call i8* @nish_str_new(i8* %41, i64 %39)
  %43 = call i32 @report(i8* bitcast ({ i64, [45 x i8] }* @.str.48 to i8*), i8* %42, i8* bitcast ({ i64, [65 x i8] }* @.str.49 to i8*))
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %43)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %45, i32* %failed.addr, align 4
  %47 = load i32, i32* %failed.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %47

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !8, i64 16}
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
