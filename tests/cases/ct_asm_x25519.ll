%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"null\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"0123456789abcdef\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"ok    \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"FAIL  \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"RFC 7748 \C2\A75.2 first vector\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c"RFC 7748 \C2\A75.2 second vector\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"4b66e9d4d1b4673c5ad22691957d6af5c11b6421e0ea01d42ca4169e7918ba0d\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"e5210f12786811d3f4b7959d0538ae2c31dbe7106fc03c3efc4cd549c715a493\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"95cbde9476e8907d7aade45cb4b873f88b595a68799fa152e6f8f7647aac7957\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"RFC 7748 \C2\A76.1 Alice's public key\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"0900000000000000000000000000000000000000000000000000000000000000\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"RFC 7748 \C2\A75.2 iterated 1,000 times\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [65 x i8] } { i64 64, [65 x i8] c"684cf59ba83309552800ef566f2f4d3c1c3887c49360e3875f2eb94d99532c51\00" }, align 8
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
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #0
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #0

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

define internal noundef i64 @fieldAdd64(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = add i64 %a, %b
  ret i64 %0
}

define internal noundef i64 @fieldSub64(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = sub i64 %a, %b
  ret i64 %0
}

define internal noundef i64 @fieldMul64(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = mul i64 %a, %b
  ret i64 %0
}

define internal noundef i64 @fieldWidth(i32 noundef %i) #0 {
entry:
  %odd.addr = alloca i64, align 8
  %0 = and i32 %i, 1
  %1 = sext i32 %0 to i64
  store i64 %1, i64* %odd.addr, align 8
  %2 = load i64, i64* %odd.addr, align 8
  %3 = sub nsw i64 26, %2
  ret i64 %3
}

define internal noundef i64 @fieldLimbMask(i32 noundef %i) #0 {
entry:
  %0 = sext i32 1 to i64
  %1 = call i64 @fieldWidth(i32 %i)
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  %4 = sext i32 1 to i64
  %5 = tail call i64 @fieldSub64(i64 %3, i64 %4)
  ret i64 %5
}

define internal void @fieldCopy(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %f, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 10
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i64*
  %11 = getelementptr inbounds i64, i64* %10, i64 %9
  %12 = load i64, i64* %11, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = bitcast i8* %1 to i64*
  %14 = getelementptr inbounds i64, i64* %13, i64 %7
  store i64 %12, i64* %14, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @fieldCarryChain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %h) #1 {
entry:
  %i.addr = alloca i32, align 4
  %c.addr = alloca i64, align 8
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, 9
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %i.addr, align 4
  %5 = sext i32 %4 to i64
  %6 = bitcast i8* %1 to i64*
  %7 = getelementptr inbounds i64, i64* %6, i64 %5
  %8 = load i64, i64* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %9 = load i32, i32* %i.addr, align 4
  %10 = call i64 @fieldWidth(i32 %9)
  %11 = and i64 %10, 63
  %12 = ashr i64 %8, %11
  store i64 %12, i64* %c.addr, align 8
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %1 to i64*
  %18 = getelementptr inbounds i64, i64* %17, i64 %16
  %19 = load i64, i64* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %20 = load i32, i32* %i.addr, align 4
  %21 = call i64 @fieldLimbMask(i32 %20)
  %22 = and i64 %19, %21
  %23 = bitcast i8* %1 to i64*
  %24 = getelementptr inbounds i64, i64* %23, i64 %14
  store i64 %22, i64* %24, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  %27 = sext i32 %26 to i64
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  %30 = sext i32 %29 to i64
  %31 = bitcast i8* %1 to i64*
  %32 = getelementptr inbounds i64, i64* %31, i64 %30
  %33 = load i64, i64* %32, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %34 = load i64, i64* %c.addr, align 8
  %35 = call i64 @fieldAdd64(i64 %33, i64 %34)
  %36 = bitcast i8* %1 to i64*
  %37 = getelementptr inbounds i64, i64* %36, i64 %27
  store i64 %35, i64* %37, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %38 = load i32, i32* %i.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @fieldCarry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %h) #1 {
entry:
  %top.addr = alloca i64, align 8
  %c0.addr = alloca i64, align 8
  call void @fieldCarryChain(%struct.nish_array* %h)
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i64*
  %3 = getelementptr inbounds i64, i64* %2, i64 9
  %4 = load i64, i64* %3, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = sext i32 25 to i64
  %6 = and i64 %5, 63
  %7 = ashr i64 %4, %6
  store i64 %7, i64* %top.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to i64*
  %11 = getelementptr inbounds i64, i64* %10, i64 9
  %12 = load i64, i64* %11, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = call i64 @fieldLimbMask(i32 9)
  %14 = and i64 %12, %13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = bitcast i8* %16 to i64*
  %18 = getelementptr inbounds i64, i64* %17, i64 9
  store i64 %14, i64* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = bitcast i8* %20 to i64*
  %22 = getelementptr inbounds i64, i64* %21, i64 0
  %23 = load i64, i64* %22, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %24 = load i64, i64* %top.addr, align 8
  %25 = sext i32 19 to i64
  %26 = call i64 @fieldMul64(i64 %24, i64 %25)
  %27 = call i64 @fieldAdd64(i64 %23, i64 %26)
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = bitcast i8* %29 to i64*
  %31 = getelementptr inbounds i64, i64* %30, i64 0
  store i64 %27, i64* %31, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = bitcast i8* %33 to i64*
  %35 = getelementptr inbounds i64, i64* %34, i64 0
  %36 = load i64, i64* %35, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %37 = sext i32 26 to i64
  %38 = and i64 %37, 63
  %39 = ashr i64 %36, %38
  store i64 %39, i64* %c0.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = bitcast i8* %41 to i64*
  %43 = getelementptr inbounds i64, i64* %42, i64 0
  %44 = load i64, i64* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %45 = call i64 @fieldLimbMask(i32 0)
  %46 = and i64 %44, %45
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = bitcast i8* %48 to i64*
  %50 = getelementptr inbounds i64, i64* %49, i64 0
  store i64 %46, i64* %50, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = bitcast i8* %52 to i64*
  %54 = getelementptr inbounds i64, i64* %53, i64 1
  %55 = load i64, i64* %54, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %56 = load i64, i64* %c0.addr, align 8
  %57 = call i64 @fieldAdd64(i64 %55, i64 %56)
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = bitcast i8* %59 to i64*
  %61 = getelementptr inbounds i64, i64* %60, i64 1
  store i64 %57, i64* %61, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define void @fieldAdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %g) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %f, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %g, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 10
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i64*
  %13 = getelementptr inbounds i64, i64* %12, i64 %11
  %14 = load i64, i64* %13, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %5 to i64*
  %18 = getelementptr inbounds i64, i64* %17, i64 %16
  %19 = load i64, i64* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %20 = call i64 @fieldAdd64(i64 %14, i64 %19)
  %21 = bitcast i8* %1 to i64*
  %22 = getelementptr inbounds i64, i64* %21, i64 %9
  store i64 %20, i64* %22, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @fieldSub(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %g) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %f, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %g, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 10
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i64*
  %13 = getelementptr inbounds i64, i64* %12, i64 %11
  %14 = load i64, i64* %13, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %5 to i64*
  %18 = getelementptr inbounds i64, i64* %17, i64 %16
  %19 = load i64, i64* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %20 = call i64 @fieldSub64(i64 %14, i64 %19)
  %21 = bitcast i8* %1 to i64*
  %22 = getelementptr inbounds i64, i64* %21, i64 %9
  store i64 %20, i64* %22, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @fieldMulRow(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %wide, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %doubled, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %g, i32 noundef %i) #1 {
entry:
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %fi.addr = alloca i64, align 8
  store i32 0, i32* %j.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %doubled, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %f, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %wide, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %g, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %8 = load i32, i32* %j.addr, align 4
  %9 = icmp slt i32 %8, 10
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %j.addr, align 4
  %11 = add nsw i32 %i, %10
  store i32 %11, i32* %k.addr, align 4
  %12 = load i32, i32* %j.addr, align 4
  %13 = and i32 %i, %12
  %14 = and i32 %13, 1
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %cond.true, label %cond.false

cond.true:
  %16 = sext i32 %i to i64
  %17 = bitcast i8* %1 to i64*
  %18 = getelementptr inbounds i64, i64* %17, i64 %16
  %19 = load i64, i64* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %cond.end

cond.false:
  %20 = sext i32 %i to i64
  %21 = bitcast i8* %3 to i64*
  %22 = getelementptr inbounds i64, i64* %21, i64 %20
  %23 = load i64, i64* %22, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %cond.end

cond.end:
  %24 = phi i64 [ %19, %cond.true ], [ %23, %cond.false ]
  store i64 %24, i64* %fi.addr, align 8
  %25 = load i32, i32* %k.addr, align 4
  %26 = icmp sge i32 %25, 0
  br i1 %26, label %land.rhs, label %land.end

land.rhs:
  %27 = load i32, i32* %k.addr, align 4
  %28 = icmp slt i32 %27, 19
  br label %land.end

land.end:
  %29 = phi i1 [ false, %cond.end ], [ %28, %land.rhs ]
  br i1 %29, label %if.then, label %if.end

if.then:
  %30 = load i32, i32* %k.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %5 to i64*
  %35 = getelementptr inbounds i64, i64* %34, i64 %33
  %36 = load i64, i64* %35, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %37 = load i64, i64* %fi.addr, align 8
  %38 = load i32, i32* %j.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = bitcast i8* %7 to i64*
  %41 = getelementptr inbounds i64, i64* %40, i64 %39
  %42 = load i64, i64* %41, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %43 = call i64 @fieldMul64(i64 %37, i64 %42)
  %44 = call i64 @fieldAdd64(i64 %36, i64 %43)
  %45 = bitcast i8* %5 to i64*
  %46 = getelementptr inbounds i64, i64* %45, i64 %31
  store i64 %44, i64* %46, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %47 = load i32, i32* %j.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %j.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @fieldMul(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %g) #1 {
entry:
  %doubled.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [10 x i64], align 8
  %i.addr = alloca i32, align 4
  %wide.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [19 x i64], align 8
  %h.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [10 x i64], align 8
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 10, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 10, 8
  %3 = bitcast [10 x i64]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %doubled.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %5 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %f, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 10
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %9 to i64*
  %17 = getelementptr inbounds i64, i64* %16, i64 %15
  %18 = load i64, i64* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %19 = load i32, i32* %i.addr, align 4
  %20 = and i32 %19, 1
  %21 = add nsw i32 %20, 1
  %22 = sext i32 %21 to i64
  %23 = call i64 @fieldMul64(i64 %18, i64 %22)
  %24 = bitcast i8* %7 to i64*
  %25 = getelementptr inbounds i64, i64* %24, i64 %13
  store i64 %23, i64* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 19, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 19, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %30 = mul i64 19, 8
  %31 = bitcast [19 x i64]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %31, i8 0, i64 %30, i1 false), !alias.scope !4, !noalias !3
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %31, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %wide.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %33, %struct.nish_array* %f, %struct.nish_array* %34, %struct.nish_array* %g, i32 0)
  %35 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %35, %struct.nish_array* %f, %struct.nish_array* %36, %struct.nish_array* %g, i32 1)
  %37 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %37, %struct.nish_array* %f, %struct.nish_array* %38, %struct.nish_array* %g, i32 2)
  %39 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %39, %struct.nish_array* %f, %struct.nish_array* %40, %struct.nish_array* %g, i32 3)
  %41 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %42 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %41, %struct.nish_array* %f, %struct.nish_array* %42, %struct.nish_array* %g, i32 4)
  %43 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %43, %struct.nish_array* %f, %struct.nish_array* %44, %struct.nish_array* %g, i32 5)
  %45 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %45, %struct.nish_array* %f, %struct.nish_array* %46, %struct.nish_array* %g, i32 6)
  %47 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %47, %struct.nish_array* %f, %struct.nish_array* %48, %struct.nish_array* %g, i32 7)
  %49 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %49, %struct.nish_array* %f, %struct.nish_array* %50, %struct.nish_array* %g, i32 8)
  %51 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %doubled.addr, align 8
  call void @fieldMulRow(%struct.nish_array* %51, %struct.nish_array* %f, %struct.nish_array* %52, %struct.nish_array* %g, i32 9)
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 10, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 10, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %55 = mul i64 10, 8
  %56 = bitcast [10 x i64]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %56, i8 0, i64 %55, i1 false), !alias.scope !4, !noalias !3
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %56, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %h.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %58 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.1

for.cond.1:
  %64 = load i32, i32* %k.addr, align 4
  %65 = icmp slt i32 %64, 9
  br i1 %65, label %for.body.1, label %for.end.1

for.body.1:
  %66 = load i32, i32* %k.addr, align 4
  %67 = sext i32 %66 to i64
  %68 = load i32, i32* %k.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = bitcast i8* %63 to i64*
  %71 = getelementptr inbounds i64, i64* %70, i64 %69
  %72 = load i64, i64* %71, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %73 = load i32, i32* %k.addr, align 4
  %74 = add nsw i32 %73, 10
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %63 to i64*
  %77 = getelementptr inbounds i64, i64* %76, i64 %75
  %78 = load i64, i64* %77, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %79 = sext i32 19 to i64
  %80 = call i64 @fieldMul64(i64 %78, i64 %79)
  %81 = call i64 @fieldAdd64(i64 %72, i64 %80)
  %82 = bitcast i8* %60 to i64*
  %83 = getelementptr inbounds i64, i64* %82, i64 %67
  store i64 %81, i64* %83, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc.1

for.inc.1:
  %84 = load i32, i32* %k.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %86 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = bitcast i8* %89 to i64*
  %91 = getelementptr inbounds i64, i64* %90, i64 9
  %92 = load i64, i64* %91, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 2
  %94 = load i8*, i8** %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = bitcast i8* %94 to i64*
  %96 = getelementptr inbounds i64, i64* %95, i64 9
  store i64 %92, i64* %96, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %97 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  call void @fieldCarry(%struct.nish_array* %97)
  %98 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  call void @fieldCopy(%struct.nish_array* %out, %struct.nish_array* %98)
  ret void
}

define void @fieldSquare(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f) #1 {
entry:
  call void @fieldMul(%struct.nish_array* %out, %struct.nish_array* %f, %struct.nish_array* %f)
  ret void
}

define void @fieldMulA24(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %f, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 10
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i64*
  %11 = getelementptr inbounds i64, i64* %10, i64 %9
  %12 = load i64, i64* %11, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = sext i32 121665 to i64
  %14 = call i64 @fieldMul64(i64 %12, i64 %13)
  %15 = bitcast i8* %1 to i64*
  %16 = getelementptr inbounds i64, i64* %15, i64 %7
  store i64 %14, i64* %16, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @fieldCarry(%struct.nish_array* %out)
  ret void
}

define void @condSwap(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %f, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %g, i64 noundef %bit) #1 {
entry:
  %mask.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %t.addr = alloca i64, align 8
  %0 = sext i32 0 to i64
  %1 = call i64 @fieldSub64(i64 %0, i64 %bit)
  store i64 %1, i64* %mask.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %f, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %g, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 10
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i64, i64* %mask.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %3 to i64*
  %12 = getelementptr inbounds i64, i64* %11, i64 %10
  %13 = load i64, i64* %12, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %5 to i64*
  %17 = getelementptr inbounds i64, i64* %16, i64 %15
  %18 = load i64, i64* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %19 = xor i64 %13, %18
  %20 = and i64 %8, %19
  store i64 %20, i64* %t.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %3 to i64*
  %26 = getelementptr inbounds i64, i64* %25, i64 %24
  %27 = load i64, i64* %26, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %28 = load i64, i64* %t.addr, align 8
  %29 = xor i64 %27, %28
  %30 = bitcast i8* %3 to i64*
  %31 = getelementptr inbounds i64, i64* %30, i64 %22
  store i64 %29, i64* %31, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = bitcast i8* %5 to i64*
  %37 = getelementptr inbounds i64, i64* %36, i64 %35
  %38 = load i64, i64* %37, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %39 = load i64, i64* %t.addr, align 8
  %40 = xor i64 %38, %39
  %41 = bitcast i8* %5 to i64*
  %42 = getelementptr inbounds i64, i64* %41, i64 %33
  store i64 %40, i64* %42, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %43 = load i32, i32* %i.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @ladderStep(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %x2, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %z2, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %x3, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %z3, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %u, i64 noundef %swap) #1 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [10 x i64], align 8
  %aa.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [10 x i64], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [10 x i64], align 8
  %bb.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [10 x i64], align 8
  %e.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [10 x i64], align 8
  %c.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [10 x i64], align 8
  %d.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [10 x i64], align 8
  %da.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [10 x i64], align 8
  %cb.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.8 = alloca [10 x i64], align 8
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.9 = alloca %struct.nish_array, align 8
  %arr.data.9 = alloca [10 x i64], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 10, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 10, 8
  %3 = bitcast [10 x i64]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 10, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 10, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = mul i64 10, 8
  %8 = bitcast [10 x i64]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %aa.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 10, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 10, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = mul i64 10, 8
  %13 = bitcast [10 x i64]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %b.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 10, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 10, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = mul i64 10, 8
  %18 = bitcast [10 x i64]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %bb.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 10, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 10, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = mul i64 10, 8
  %23 = bitcast [10 x i64]* %arr.data.4 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %23, i8 0, i64 %22, i1 false), !alias.scope !4, !noalias !3
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %e.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 10, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 10, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %27 = mul i64 10, 8
  %28 = bitcast [10 x i64]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %28, i8 0, i64 %27, i1 false), !alias.scope !4, !noalias !3
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %c.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 10, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 10, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = mul i64 10, 8
  %33 = bitcast [10 x i64]* %arr.data.6 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 %32, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %d.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 10, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 10, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %37 = mul i64 10, 8
  %38 = bitcast [10 x i64]* %arr.data.7 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %38, i8 0, i64 %37, i1 false), !alias.scope !4, !noalias !3
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %38, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.7, %struct.nish_array** %da.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 10, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 10, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %42 = mul i64 10, 8
  %43 = bitcast [10 x i64]* %arr.data.8 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %43, i8 0, i64 %42, i1 false), !alias.scope !4, !noalias !3
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.8, %struct.nish_array** %cb.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 0
  store i64 10, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 1
  store i64 10, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %47 = mul i64 10, 8
  %48 = bitcast [10 x i64]* %arr.data.9 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %48, i8 0, i64 %47, i1 false), !alias.scope !4, !noalias !3
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 2
  store i8* %48, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.9, %struct.nish_array** %t.addr, align 8
  call void @condSwap(%struct.nish_array* %x2, %struct.nish_array* %x3, i64 %swap)
  call void @condSwap(%struct.nish_array* %z2, %struct.nish_array* %z3, i64 %swap)
  %50 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  call void @fieldAdd(%struct.nish_array* %50, %struct.nish_array* %x2, %struct.nish_array* %z2)
  %51 = load %struct.nish_array*, %struct.nish_array** %aa.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  call void @fieldSquare(%struct.nish_array* %51, %struct.nish_array* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @fieldSub(%struct.nish_array* %53, %struct.nish_array* %x2, %struct.nish_array* %z2)
  %54 = load %struct.nish_array*, %struct.nish_array** %bb.addr, align 8
  %55 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @fieldSquare(%struct.nish_array* %54, %struct.nish_array* %55)
  %56 = load %struct.nish_array*, %struct.nish_array** %e.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %aa.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %bb.addr, align 8
  call void @fieldSub(%struct.nish_array* %56, %struct.nish_array* %57, %struct.nish_array* %58)
  %59 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  call void @fieldAdd(%struct.nish_array* %59, %struct.nish_array* %x3, %struct.nish_array* %z3)
  %60 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  call void @fieldSub(%struct.nish_array* %60, %struct.nish_array* %x3, %struct.nish_array* %z3)
  %61 = load %struct.nish_array*, %struct.nish_array** %da.addr, align 8
  %62 = load %struct.nish_array*, %struct.nish_array** %d.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  call void @fieldMul(%struct.nish_array* %61, %struct.nish_array* %62, %struct.nish_array* %63)
  %64 = load %struct.nish_array*, %struct.nish_array** %cb.addr, align 8
  %65 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %66 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @fieldMul(%struct.nish_array* %64, %struct.nish_array* %65, %struct.nish_array* %66)
  %67 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %68 = load %struct.nish_array*, %struct.nish_array** %da.addr, align 8
  %69 = load %struct.nish_array*, %struct.nish_array** %cb.addr, align 8
  call void @fieldAdd(%struct.nish_array* %67, %struct.nish_array* %68, %struct.nish_array* %69)
  %70 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldSquare(%struct.nish_array* %x3, %struct.nish_array* %70)
  %71 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %da.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %cb.addr, align 8
  call void @fieldSub(%struct.nish_array* %71, %struct.nish_array* %72, %struct.nish_array* %73)
  %74 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldSquare(%struct.nish_array* %74, %struct.nish_array* %75)
  %76 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldMul(%struct.nish_array* %z3, %struct.nish_array* %u, %struct.nish_array* %76)
  %77 = load %struct.nish_array*, %struct.nish_array** %aa.addr, align 8
  %78 = load %struct.nish_array*, %struct.nish_array** %bb.addr, align 8
  call void @fieldMul(%struct.nish_array* %x2, %struct.nish_array* %77, %struct.nish_array* %78)
  %79 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %e.addr, align 8
  call void @fieldMulA24(%struct.nish_array* %79, %struct.nish_array* %80)
  %81 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %82 = load %struct.nish_array*, %struct.nish_array** %aa.addr, align 8
  %83 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldAdd(%struct.nish_array* %81, %struct.nish_array* %82, %struct.nish_array* %83)
  %84 = load %struct.nish_array*, %struct.nish_array** %e.addr, align 8
  %85 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldMul(%struct.nish_array* %z2, %struct.nish_array* %84, %struct.nish_array* %85)
  ret void
}

define noundef i64 @indexAfterMul(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %g, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table) #1 {
entry:
  %h.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [10 x i64], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 10, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 10, 8
  %3 = bitcast [10 x i64]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %h.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  call void @fieldMul(%struct.nish_array* %5, %struct.nish_array* %f, %struct.nish_array* %g)
  %6 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = bitcast i8* %8 to i64*
  %10 = getelementptr inbounds i64, i64* %9, i64 0
  %11 = load i64, i64* %10, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %12 = sext i32 7 to i64
  %13 = and i64 %11, %12
  %14 = trunc i64 %13 to i32
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = bitcast i8* %17 to i64*
  %19 = getelementptr inbounds i64, i64* %18, i64 %15
  %20 = load i64, i64* %19, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret i64 %20
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fieldDecode(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes) #2 {
entry:
  %f.addr = alloca %struct.nish_array*, align 8
  %acc.addr = alloca i64, align 8
  %bits.addr = alloca i64, align 8
  %limb.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %v.addr = alloca i64, align 8
  %width.addr = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 10, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 10, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = mul i64 10, 8
  %5 = call i8* @nish_alloc_struct(i64 %4)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %1, %struct.nish_array** %f.addr, align 8
  store i64 0, i64* %acc.addr, align 8
  store i64 0, i64* %bits.addr, align 8
  store i32 0, i32* %limb.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = load %struct.nish_array*, %struct.nish_array** %f.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %12 = load i32, i32* %i.addr, align 4
  %13 = icmp slt i32 %12, 32
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %8 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %15
  %18 = load i8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %19 = zext i8 %18 to i64
  store i64 %19, i64* %v.addr, align 8
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp eq i32 %20, 31
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i64, i64* %v.addr, align 8
  %23 = sext i32 127 to i64
  %24 = and i64 %22, %23
  store i64 %24, i64* %v.addr, align 8
  br label %if.end

if.end:
  %25 = load i64, i64* %acc.addr, align 8
  %26 = load i64, i64* %v.addr, align 8
  %27 = load i64, i64* %bits.addr, align 8
  %28 = and i64 %27, 63
  %29 = shl i64 %26, %28
  %30 = or i64 %25, %29
  store i64 %30, i64* %acc.addr, align 8
  %31 = load i64, i64* %bits.addr, align 8
  %32 = sext i32 8 to i64
  %33 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %31, i64 %32)
  %34 = extractvalue { i64, i1 } %33, 0
  %35 = extractvalue { i64, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %34, i64* %bits.addr, align 8
  %36 = load i32, i32* %limb.addr, align 4
  %37 = icmp sge i32 %36, 0
  br i1 %37, label %land.rhs, label %land.end

land.rhs:
  %38 = load i32, i32* %limb.addr, align 4
  %39 = icmp slt i32 %38, 10
  br label %land.end

land.end:
  %40 = phi i1 [ false, %ovf.ok ], [ %39, %land.rhs ]
  br i1 %40, label %if.then.1, label %if.end.1

if.then.1:
  %41 = load i32, i32* %limb.addr, align 4
  %42 = call i64 @fieldWidth(i32 %41)
  store i64 %42, i64* %width.addr, align 8
  %43 = load i64, i64* %bits.addr, align 8
  %44 = load i64, i64* %width.addr, align 8
  %45 = icmp sge i64 %43, %44
  br i1 %45, label %if.then.2, label %if.end.2

if.then.2:
  %46 = load i32, i32* %limb.addr, align 4
  %47 = sext i32 %46 to i64
  %48 = load i64, i64* %acc.addr, align 8
  %49 = load i32, i32* %limb.addr, align 4
  %50 = call i64 @fieldLimbMask(i32 %49)
  %51 = and i64 %48, %50
  %52 = bitcast i8* %11 to i64*
  %53 = getelementptr inbounds i64, i64* %52, i64 %47
  store i64 %51, i64* %53, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %54 = load i64, i64* %acc.addr, align 8
  %55 = load i64, i64* %width.addr, align 8
  %56 = and i64 %55, 63
  %57 = ashr i64 %54, %56
  store i64 %57, i64* %acc.addr, align 8
  %58 = load i64, i64* %bits.addr, align 8
  %59 = load i64, i64* %width.addr, align 8
  %60 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %58, i64 %59)
  %61 = extractvalue { i64, i1 } %60, 0
  %62 = extractvalue { i64, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i64 %61, i64* %bits.addr, align 8
  %63 = load i32, i32* %limb.addr, align 4
  %64 = add nsw i32 %63, 1
  store i32 %64, i32* %limb.addr, align 4
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %65 = load i32, i32* %i.addr, align 4
  %66 = add nsw i32 %65, 1
  store i32 %66, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %67 = load %struct.nish_array*, %struct.nish_array** %f.addr, align 8
  ret %struct.nish_array* %67

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.end ], [ 1, %if.then.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fieldEncode(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f) #2 {
entry:
  %h.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [10 x i64], align 8
  %q.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %out.addr = alloca %struct.nish_array*, align 8
  %acc.addr = alloca i64, align 8
  %bits.addr = alloca i64, align 8
  %at.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 10, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 10, 8
  %3 = bitcast [10 x i64]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %h.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  call void @fieldCopy(%struct.nish_array* %5, %struct.nish_array* %f)
  %6 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  call void @fieldCarry(%struct.nish_array* %6)
  %7 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  call void @fieldCarry(%struct.nish_array* %7)
  %8 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i64*
  %12 = getelementptr inbounds i64, i64* %11, i64 0
  %13 = load i64, i64* %12, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = sext i32 19 to i64
  %15 = call i64 @fieldAdd64(i64 %13, i64 %14)
  %16 = sext i32 26 to i64
  %17 = and i64 %16, 63
  %18 = ashr i64 %15, %17
  store i64 %18, i64* %q.addr, align 8
  store i32 1, i32* %i.addr, align 4
  %19 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %22 = load i32, i32* %i.addr, align 4
  %23 = icmp slt i32 %22, 10
  br i1 %23, label %for.body, label %for.end

for.body:
  %24 = load i32, i32* %i.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %21 to i64*
  %27 = getelementptr inbounds i64, i64* %26, i64 %25
  %28 = load i64, i64* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %29 = load i64, i64* %q.addr, align 8
  %30 = call i64 @fieldAdd64(i64 %28, i64 %29)
  %31 = load i32, i32* %i.addr, align 4
  %32 = call i64 @fieldWidth(i32 %31)
  %33 = and i64 %32, 63
  %34 = ashr i64 %30, %33
  store i64 %34, i64* %q.addr, align 8
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %37 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to i64*
  %42 = getelementptr inbounds i64, i64* %41, i64 0
  %43 = load i64, i64* %42, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %44 = load i64, i64* %q.addr, align 8
  %45 = sext i32 19 to i64
  %46 = call i64 @fieldMul64(i64 %44, i64 %45)
  %47 = call i64 @fieldAdd64(i64 %43, i64 %46)
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = bitcast i8* %49 to i64*
  %51 = getelementptr inbounds i64, i64* %50, i64 0
  store i64 %47, i64* %51, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %52 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  call void @fieldCarryChain(%struct.nish_array* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %54 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = bitcast i8* %56 to i64*
  %58 = getelementptr inbounds i64, i64* %57, i64 9
  %59 = load i64, i64* %58, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %60 = call i64 @fieldLimbMask(i32 9)
  %61 = and i64 %59, %60
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = bitcast i8* %63 to i64*
  %65 = getelementptr inbounds i64, i64* %64, i64 9
  store i64 %61, i64* %65, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %66 = call i8* @nish_alloc_struct(i64 24)
  %67 = bitcast i8* %66 to %struct.nish_array*
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  store i64 32, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 1
  store i64 32, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %70 = call i8* @nish_alloc_struct(i64 32)
  call void @llvm.memset.p0i8.i64(i8* align 8 %70, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  store i8* %70, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %67, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %acc.addr, align 8
  store i64 0, i64* %bits.addr, align 8
  store i32 0, i32* %at.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %72 = load %struct.nish_array*, %struct.nish_array** %h.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.1

for.cond.1:
  %78 = load i32, i32* %i.addr.1, align 4
  %79 = icmp slt i32 %78, 10
  br i1 %79, label %for.body.1, label %for.end.1

for.body.1:
  %80 = load i64, i64* %acc.addr, align 8
  %81 = load i32, i32* %i.addr.1, align 4
  %82 = sext i32 %81 to i64
  %83 = bitcast i8* %74 to i64*
  %84 = getelementptr inbounds i64, i64* %83, i64 %82
  %85 = load i64, i64* %84, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %86 = load i64, i64* %bits.addr, align 8
  %87 = and i64 %86, 63
  %88 = shl i64 %85, %87
  %89 = or i64 %80, %88
  store i64 %89, i64* %acc.addr, align 8
  %90 = load i64, i64* %bits.addr, align 8
  %91 = load i32, i32* %i.addr.1, align 4
  %92 = call i64 @fieldWidth(i32 %91)
  %93 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %90, i64 %92)
  %94 = extractvalue { i64, i1 } %93, 0
  %95 = extractvalue { i64, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %94, i64* %bits.addr, align 8
  %96 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %99 = load i64, i64* %bits.addr, align 8
  %100 = sext i32 8 to i64
  %101 = icmp sge i64 %99, %100
  br i1 %101, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %102 = load i32, i32* %at.addr, align 4
  %103 = icmp sge i32 %102, 0
  br label %land.end.1

land.end.1:
  %104 = phi i1 [ false, %while.cond ], [ %103, %land.rhs.1 ]
  br i1 %104, label %land.rhs, label %land.end

land.rhs:
  %105 = load i32, i32* %at.addr, align 4
  %106 = icmp slt i32 %105, 32
  br label %land.end

land.end:
  %107 = phi i1 [ false, %land.end.1 ], [ %106, %land.rhs ]
  br i1 %107, label %while.body, label %while.end

while.body:
  %108 = load i32, i32* %at.addr, align 4
  %109 = sext i32 %108 to i64
  %110 = load i64, i64* %acc.addr, align 8
  %111 = sext i32 255 to i64
  %112 = and i64 %110, %111
  %113 = trunc i64 %112 to i8
  %114 = bitcast i8* %98 to i8*
  %115 = getelementptr inbounds i8, i8* %114, i64 %109
  store i8 %113, i8* %115, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %116 = load i64, i64* %acc.addr, align 8
  %117 = sext i32 8 to i64
  %118 = and i64 %117, 63
  %119 = ashr i64 %116, %118
  store i64 %119, i64* %acc.addr, align 8
  %120 = load i64, i64* %bits.addr, align 8
  %121 = sext i32 8 to i64
  %122 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %120, i64 %121)
  %123 = extractvalue { i64, i1 } %122, 0
  %124 = extractvalue { i64, i1 } %122, 1
  br i1 %124, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i64 %123, i64* %bits.addr, align 8
  %125 = load i32, i32* %at.addr, align 4
  %126 = add nsw i32 %125, 1
  store i32 %126, i32* %at.addr, align 4
  br label %while.cond

while.end:
  br label %for.inc.1

for.inc.1:
  %127 = load i32, i32* %i.addr.1, align 4
  %128 = add nsw i32 %127, 1
  store i32 %128, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %129 = load i32, i32* %at.addr, align 4
  %130 = icmp sge i32 %129, 0
  br i1 %130, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %131 = load i32, i32* %at.addr, align 4
  %132 = icmp slt i32 %131, 32
  br label %land.end.2

land.end.2:
  %133 = phi i1 [ false, %for.end.1 ], [ %132, %land.rhs.2 ]
  br i1 %133, label %if.then, label %if.end

if.then:
  %134 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %135 = load i32, i32* %at.addr, align 4
  %136 = sext i32 %135 to i64
  %137 = load i64, i64* %acc.addr, align 8
  %138 = sext i32 255 to i64
  %139 = and i64 %137, %138
  %140 = trunc i64 %139 to i8
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %143 = bitcast i8* %142 to i8*
  %144 = getelementptr inbounds i8, i8* %143, i64 %136
  store i8 %140, i8* %144, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end

if.end:
  %145 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %145

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body.1 ], [ 1, %while.body ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @fieldSquareTimes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %f, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  call void @fieldSquare(%struct.nish_array* %out, %struct.nish_array* %f)
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  call void @fieldSquare(%struct.nish_array* %out, %struct.nish_array* %out)
  br label %for.inc

for.inc:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @fieldInvert(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %z) #1 {
entry:
  %z2.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [10 x i64], align 8
  %z11.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [10 x i64], align 8
  %e2.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [10 x i64], align 8
  %e5.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [10 x i64], align 8
  %e10.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [10 x i64], align 8
  %e50.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [10 x i64], align 8
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [10 x i64], align 8
  %acc.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [10 x i64], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 10, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = mul i64 10, 8
  %3 = bitcast [10 x i64]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %z2.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 10, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 10, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = mul i64 10, 8
  %8 = bitcast [10 x i64]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %z11.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 10, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 10, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %12 = mul i64 10, 8
  %13 = bitcast [10 x i64]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %e2.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 10, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 10, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %17 = mul i64 10, 8
  %18 = bitcast [10 x i64]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !4, !noalias !3
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %e5.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 10, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 10, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = mul i64 10, 8
  %23 = bitcast [10 x i64]* %arr.data.4 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %23, i8 0, i64 %22, i1 false), !alias.scope !4, !noalias !3
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %e10.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 10, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 10, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %27 = mul i64 10, 8
  %28 = bitcast [10 x i64]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %28, i8 0, i64 %27, i1 false), !alias.scope !4, !noalias !3
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %e50.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 10, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 10, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = mul i64 10, 8
  %33 = bitcast [10 x i64]* %arr.data.6 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 %32, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.6, %struct.nish_array** %t.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 10, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 10, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %37 = mul i64 10, 8
  %38 = bitcast [10 x i64]* %arr.data.7 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %38, i8 0, i64 %37, i1 false), !alias.scope !4, !noalias !3
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %38, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.7, %struct.nish_array** %acc.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** %z2.addr, align 8
  call void @fieldSquare(%struct.nish_array* %40, %struct.nish_array* %z)
  %41 = load %struct.nish_array*, %struct.nish_array** %e2.addr, align 8
  %42 = load %struct.nish_array*, %struct.nish_array** %z2.addr, align 8
  call void @fieldMul(%struct.nish_array* %41, %struct.nish_array* %42, %struct.nish_array* %z)
  %43 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %z2.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %43, %struct.nish_array* %44, i32 2)
  %45 = load %struct.nish_array*, %struct.nish_array** %z11.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %47 = load %struct.nish_array*, %struct.nish_array** %e2.addr, align 8
  call void @fieldMul(%struct.nish_array* %45, %struct.nish_array* %46, %struct.nish_array* %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %49 = load %struct.nish_array*, %struct.nish_array** %e2.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %48, %struct.nish_array* %49, i32 2)
  %50 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %51 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %e2.addr, align 8
  call void @fieldMul(%struct.nish_array* %50, %struct.nish_array* %51, %struct.nish_array* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %54 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldSquare(%struct.nish_array* %53, %struct.nish_array* %54)
  %55 = load %struct.nish_array*, %struct.nish_array** %e5.addr, align 8
  %56 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldMul(%struct.nish_array* %55, %struct.nish_array* %56, %struct.nish_array* %z)
  %57 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %e5.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %57, %struct.nish_array* %58, i32 5)
  %59 = load %struct.nish_array*, %struct.nish_array** %e10.addr, align 8
  %60 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %61 = load %struct.nish_array*, %struct.nish_array** %e5.addr, align 8
  call void @fieldMul(%struct.nish_array* %59, %struct.nish_array* %60, %struct.nish_array* %61)
  %62 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %e10.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %62, %struct.nish_array* %63, i32 10)
  %64 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  %65 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %66 = load %struct.nish_array*, %struct.nish_array** %e10.addr, align 8
  call void @fieldMul(%struct.nish_array* %64, %struct.nish_array* %65, %struct.nish_array* %66)
  %67 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %68 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %67, %struct.nish_array* %68, i32 20)
  %69 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  %70 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %71 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @fieldMul(%struct.nish_array* %69, %struct.nish_array* %70, %struct.nish_array* %71)
  %72 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %72, %struct.nish_array* %73, i32 10)
  %74 = load %struct.nish_array*, %struct.nish_array** %e50.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %76 = load %struct.nish_array*, %struct.nish_array** %e10.addr, align 8
  call void @fieldMul(%struct.nish_array* %74, %struct.nish_array* %75, %struct.nish_array* %76)
  %77 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %78 = load %struct.nish_array*, %struct.nish_array** %e50.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %77, %struct.nish_array* %78, i32 50)
  %79 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %81 = load %struct.nish_array*, %struct.nish_array** %e50.addr, align 8
  call void @fieldMul(%struct.nish_array* %79, %struct.nish_array* %80, %struct.nish_array* %81)
  %82 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %83 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %82, %struct.nish_array* %83, i32 100)
  %84 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  %85 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %86 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @fieldMul(%struct.nish_array* %84, %struct.nish_array* %85, %struct.nish_array* %86)
  %87 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %88 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %87, %struct.nish_array* %88, i32 50)
  %89 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  %90 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %91 = load %struct.nish_array*, %struct.nish_array** %e50.addr, align 8
  call void @fieldMul(%struct.nish_array* %89, %struct.nish_array* %90, %struct.nish_array* %91)
  %92 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %93 = load %struct.nish_array*, %struct.nish_array** %acc.addr, align 8
  call void @fieldSquareTimes(%struct.nish_array* %92, %struct.nish_array* %93, i32 5)
  %94 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %95 = load %struct.nish_array*, %struct.nish_array** %z11.addr, align 8
  call void @fieldMul(%struct.nish_array* %out, %struct.nish_array* %94, %struct.nish_array* %95)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @ladder(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %scalar, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %uBytes) #2 {
entry:
  %k.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [32 x i8], align 8
  %i.addr = alloca i32, align 4
  %u.addr = alloca %struct.nish_array*, align 8
  %x2.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [10 x i64], align 8
  %z2.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [10 x i64], align 8
  %x3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [10 x i64], align 8
  %z3.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [10 x i64], align 8
  %swap.addr = alloca i64, align 8
  %byte.addr = alloca i32, align 4
  %shift.addr = alloca i32, align 4
  %bit.addr = alloca i64, align 8
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [10 x i64], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 32, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 32, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [32 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %k.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %4 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %scalar, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 32
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %8 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = bitcast i8* %6 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %12
  store i8 %17, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = bitcast i8* %25 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 0
  %28 = load i8, i8* %27, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = trunc i32 248 to i8
  %30 = and i8 %28, %29
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = bitcast i8* %32 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 0
  store i8 %30, i8* %34, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %35 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = bitcast i8* %38 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 31
  %41 = load i8, i8* %40, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %42 = trunc i32 127 to i8
  %43 = and i8 %41, %42
  %44 = trunc i32 64 to i8
  %45 = or i8 %43, %44
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = bitcast i8* %47 to i8*
  %49 = getelementptr inbounds i8, i8* %48, i64 31
  store i8 %45, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %50 = call %struct.nish_array* @fieldDecode(%struct.nish_array* %uBytes)
  store %struct.nish_array* %50, %struct.nish_array** %u.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 10, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 10, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %53 = mul i64 10, 8
  %54 = bitcast [10 x i64]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %54, i8 0, i64 %53, i1 false), !alias.scope !4, !noalias !3
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %54, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %x2.addr, align 8
  %56 = load %struct.nish_array*, %struct.nish_array** %x2.addr, align 8
  %57 = sext i32 1 to i64
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = bitcast i8* %59 to i64*
  %61 = getelementptr inbounds i64, i64* %60, i64 0
  store i64 %57, i64* %61, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 10, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 10, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %64 = mul i64 10, 8
  %65 = bitcast [10 x i64]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %65, i8 0, i64 %64, i1 false), !alias.scope !4, !noalias !3
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %z2.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 10, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 10, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %69 = mul i64 10, 8
  %70 = bitcast [10 x i64]* %arr.data.3 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %70, i8 0, i64 %69, i1 false), !alias.scope !4, !noalias !3
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %70, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %x3.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %u.addr, align 8
  call void @fieldCopy(%struct.nish_array* %72, %struct.nish_array* %73)
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 10, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 10, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %76 = mul i64 10, 8
  %77 = bitcast [10 x i64]* %arr.data.4 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %77, i8 0, i64 %76, i1 false), !alias.scope !4, !noalias !3
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %77, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %z3.addr, align 8
  %79 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %80 = sext i32 1 to i64
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = bitcast i8* %82 to i64*
  %84 = getelementptr inbounds i64, i64* %83, i64 0
  store i64 %80, i64* %84, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  store i64 0, i64* %swap.addr, align 8
  store i32 31, i32* %byte.addr, align 4
  %85 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.1

for.cond.1:
  %88 = load i32, i32* %byte.addr, align 4
  %89 = icmp sge i32 %88, 0
  br i1 %89, label %for.body.1, label %for.end.1

for.body.1:
  store i32 7, i32* %shift.addr, align 4
  %90 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.2

for.cond.2:
  %93 = load i32, i32* %shift.addr, align 4
  %94 = icmp sge i32 %93, 0
  br i1 %94, label %for.body.2, label %for.end.2

for.body.2:
  %95 = load i32, i32* %byte.addr, align 4
  %96 = icmp eq i32 %95, 31
  br i1 %96, label %land.rhs, label %land.end

land.rhs:
  %97 = load i32, i32* %shift.addr, align 4
  %98 = icmp eq i32 %97, 7
  br label %land.end

land.end:
  %99 = phi i1 [ false, %for.body.2 ], [ %98, %land.rhs ]
  br i1 %99, label %if.then, label %if.end

if.then:
  br label %for.inc.2

if.end:
  %100 = load i32, i32* %byte.addr, align 4
  %101 = sext i32 %100 to i64
  %102 = bitcast i8* %92 to i8*
  %103 = getelementptr inbounds i8, i8* %102, i64 %101
  %104 = load i8, i8* %103, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %105 = load i32, i32* %shift.addr, align 4
  %106 = trunc i32 %105 to i8
  %107 = and i8 %106, 7
  %108 = lshr i8 %104, %107
  %109 = zext i8 %108 to i64
  %110 = sext i32 1 to i64
  %111 = and i64 %109, %110
  store i64 %111, i64* %bit.addr, align 8
  %112 = load i64, i64* %swap.addr, align 8
  %113 = load i64, i64* %bit.addr, align 8
  %114 = xor i64 %112, %113
  store i64 %114, i64* %swap.addr, align 8
  %115 = load %struct.nish_array*, %struct.nish_array** %x2.addr, align 8
  %116 = load %struct.nish_array*, %struct.nish_array** %z2.addr, align 8
  %117 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %118 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %u.addr, align 8
  %120 = load i64, i64* %swap.addr, align 8
  call void @ladderStep(%struct.nish_array* %115, %struct.nish_array* %116, %struct.nish_array* %117, %struct.nish_array* %118, %struct.nish_array* %119, i64 %120)
  %121 = load i64, i64* %bit.addr, align 8
  store i64 %121, i64* %swap.addr, align 8
  br label %for.inc.2

for.inc.2:
  %122 = load i32, i32* %shift.addr, align 4
  %123 = sub nsw i32 %122, 1
  store i32 %123, i32* %shift.addr, align 4
  br label %for.cond.2

for.end.2:
  br label %for.inc.1

for.inc.1:
  %124 = load i32, i32* %byte.addr, align 4
  %125 = sub nsw i32 %124, 1
  store i32 %125, i32* %byte.addr, align 4
  br label %for.cond.1

for.end.1:
  %126 = load %struct.nish_array*, %struct.nish_array** %x2.addr, align 8
  %127 = load %struct.nish_array*, %struct.nish_array** %x3.addr, align 8
  %128 = load i64, i64* %swap.addr, align 8
  call void @condSwap(%struct.nish_array* %126, %struct.nish_array* %127, i64 %128)
  %129 = load %struct.nish_array*, %struct.nish_array** %z2.addr, align 8
  %130 = load %struct.nish_array*, %struct.nish_array** %z3.addr, align 8
  %131 = load i64, i64* %swap.addr, align 8
  call void @condSwap(%struct.nish_array* %129, %struct.nish_array* %130, i64 %131)
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 10, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 10, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %134 = mul i64 10, 8
  %135 = bitcast [10 x i64]* %arr.data.5 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %135, i8 0, i64 %134, i1 false), !alias.scope !4, !noalias !3
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %135, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr.5, %struct.nish_array** %t.addr, align 8
  %137 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %138 = load %struct.nish_array*, %struct.nish_array** %z2.addr, align 8
  call void @fieldInvert(%struct.nish_array* %137, %struct.nish_array* %138)
  %139 = load %struct.nish_array*, %struct.nish_array** %x2.addr, align 8
  %140 = load %struct.nish_array*, %struct.nish_array** %x2.addr, align 8
  %141 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  call void @fieldMul(%struct.nish_array* %139, %struct.nish_array* %140, %struct.nish_array* %141)
  %142 = load %struct.nish_array*, %struct.nish_array** %x2.addr, align 8
  %143 = call %struct.nish_array* @fieldEncode(%struct.nish_array* %142)
  ret %struct.nish_array* %143
}

define internal noundef i32 @hexNibble(i32 noundef %code) #2 {
entry:
  %0 = icmp sle i32 %code, 57
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %code, i32 48)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %4 = sub nsw i32 %code, 87
  br label %cond.end

cond.end:
  %5 = phi i32 [ %2, %ovf.ok ], [ %4, %cond.false ]
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fromHex(i8* noundef nonnull noalias readonly align 8 nocapture %text) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %high.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 32, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 32, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 32)
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %6 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 32
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = mul nsw i32 2, %11
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
  %21 = call i32 @hexNibble(i32 %20)
  store i32 %21, i32* %high.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  %23 = mul nsw i32 2, %22
  %24 = add nsw i32 %23, 1
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %text to i64*
  %27 = load i64, i64* %26, align 8
  %28 = icmp ult i64 %25, %27
  br i1 %28, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %25, i64 %27)
  unreachable

bounds.ok.1:
  %29 = getelementptr inbounds i8, i8* %text, i64 8
  %30 = getelementptr inbounds i8, i8* %29, i64 %25
  %31 = load i8, i8* %30, align 1
  %32 = zext i8 %31 to i32
  %33 = call i32 @hexNibble(i32 %32)
  store i32 %33, i32* %low.addr, align 4
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = load i32, i32* %high.addr, align 4
  %37 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %36, i32 16)
  %38 = extractvalue { i32, i1 } %37, 0
  %39 = extractvalue { i32, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok

ovf.ok:
  %40 = load i32, i32* %low.addr, align 4
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 %40)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %44 = trunc i32 %42 to i8
  %45 = bitcast i8* %8 to i8*
  %46 = getelementptr inbounds i8, i8* %45, i64 %35
  store i8 %44, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %47 = load i32, i32* %i.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %49 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %49

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 i8* @toHex(%struct.nish_array* noundef readonly align 8 nocapture %bytes) #1 {
entry:
  %digits.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = icmp eq %struct.nish_array* %bytes, null
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)

if.end:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %digits.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 32
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %7
  %12 = load i8, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %13 = zext i8 %12 to i32
  store i32 %13, i32* %v.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %digits.addr, align 8
  %15 = bitcast i8* bitcast ({ i64, [17 x i8] }* @.str.1 to i8*) to i64*
  %16 = load i64, i64* %15, align 8
  %17 = load i32, i32* %v.addr, align 4
  %18 = ashr i32 %17, 4
  %19 = sext i32 %18 to i64
  %20 = call i64 @llvm.smin.i64(i64 %19, i64 %16)
  %21 = call i64 @llvm.smax.i64(i64 %20, i64 0)
  %22 = load i32, i32* %v.addr, align 4
  %23 = ashr i32 %22, 4
  %24 = add nsw i32 %23, 1
  %25 = sext i32 %24 to i64
  %26 = call i64 @llvm.smin.i64(i64 %25, i64 %16)
  %27 = call i64 @llvm.smax.i64(i64 %26, i64 0)
  %28 = call i64 @llvm.smin.i64(i64 %21, i64 %27)
  %29 = call i64 @llvm.smax.i64(i64 %21, i64 %27)
  %30 = sub i64 %29, %28
  %31 = getelementptr inbounds i8, i8* bitcast ({ i64, [17 x i8] }* @.str.1 to i8*), i64 8
  %32 = getelementptr inbounds i8, i8* %31, i64 %28
  %33 = call i8* @nish_str_new(i8* %32, i64 %30)
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 8)
  br label %push.store

push.store:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to i8**
  %42 = getelementptr inbounds i8*, i8** %41, i64 %35
  store i8* %33, i8** %42, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %44 = trunc i64 %43 to i32
  %45 = load %struct.nish_array*, %struct.nish_array** %digits.addr, align 8
  %46 = bitcast i8* bitcast ({ i64, [17 x i8] }* @.str.1 to i8*) to i64*
  %47 = load i64, i64* %46, align 8
  %48 = load i32, i32* %v.addr, align 4
  %49 = and i32 %48, 15
  %50 = sext i32 %49 to i64
  %51 = call i64 @llvm.smin.i64(i64 %50, i64 %47)
  %52 = call i64 @llvm.smax.i64(i64 %51, i64 0)
  %53 = load i32, i32* %v.addr, align 4
  %54 = and i32 %53, 15
  %55 = add nsw i32 %54, 1
  %56 = sext i32 %55 to i64
  %57 = call i64 @llvm.smin.i64(i64 %56, i64 %47)
  %58 = call i64 @llvm.smax.i64(i64 %57, i64 0)
  %59 = call i64 @llvm.smin.i64(i64 %52, i64 %58)
  %60 = call i64 @llvm.smax.i64(i64 %52, i64 %58)
  %61 = sub i64 %60, %59
  %62 = getelementptr inbounds i8, i8* bitcast ({ i64, [17 x i8] }* @.str.1 to i8*), i64 8
  %63 = getelementptr inbounds i8, i8* %62, i64 %59
  %64 = call i8* @nish_str_new(i8* %63, i64 %61)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 1
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %69 = icmp eq i64 %66, %68
  br i1 %69, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %45, i64 8)
  br label %push.store.1

push.store.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = bitcast i8* %71 to i8**
  %73 = getelementptr inbounds i8*, i8** %72, i64 %66
  store i8* %64, i8** %73, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %74 = add i64 %66, 1
  store i64 %74, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %75 = trunc i64 %74 to i32
  br label %for.inc

for.inc:
  %76 = load i32, i32* %i.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %78 = load %struct.nish_array*, %struct.nish_array** %digits.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %81 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %82 = load i64, i64* %81, align 8
  %83 = sub i64 %80, 1
  %84 = mul i64 %82, %83
  %85 = icmp eq i64 %80, 0
  %86 = select i1 %85, i64 0, i64 %84
  store i64 %86, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %87 = load i64, i64* %join.at, align 8
  %88 = icmp ult i64 %87, %80
  br i1 %88, label %join.sum.body, label %join.copy

join.sum.body:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = bitcast i8* %90 to i8**
  %92 = getelementptr inbounds i8*, i8** %91, i64 %87
  %93 = load i8*, i8** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %94 = load i64, i64* %join.total, align 8
  %95 = bitcast i8* %93 to i64*
  %96 = load i64, i64* %95, align 8
  %97 = add i64 %94, %96
  store i64 %97, i64* %join.total, align 8
  %98 = add i64 %87, 1
  store i64 %98, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %99 = load i64, i64* %join.total, align 8
  %100 = icmp ugt i64 %99, 2147483647
  %101 = add i64 %99, 9
  %102 = select i1 %100, i64 4611686018427387904, i64 %101
  %103 = call i8* @nish_alloc_struct(i64 %102)
  %104 = bitcast i8* %103 to i64*
  store i64 %99, i64* %104, align 8
  %105 = getelementptr inbounds i8, i8* %103, i64 8
  store i8* %105, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %106 = load i64, i64* %join.at, align 8
  %107 = icmp ult i64 %106, %80
  br i1 %107, label %join.part, label %join.end

join.part:
  %108 = load i8*, i8** %join.p, align 8
  %109 = icmp eq i64 %106, 0
  %110 = select i1 %109, i64 0, i64 %82
  %111 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %108, i8* %111, i64 %110, i1 false)
  %112 = getelementptr inbounds i8, i8* %108, i64 %110
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = bitcast i8* %114 to i8**
  %116 = getelementptr inbounds i8*, i8** %115, i64 %106
  %117 = load i8*, i8** %116, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %118 = bitcast i8* %117 to i64*
  %119 = load i64, i64* %118, align 8
  %120 = getelementptr inbounds i8, i8* %117, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %112, i8* %120, i64 %119, i1 false)
  %121 = getelementptr inbounds i8, i8* %112, i64 %119
  store i8* %121, i8** %join.p, align 8
  %122 = add i64 %106, 1
  store i64 %122, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %123 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %123, align 1
  ret i8* %103
}

define internal noundef i32 @check(i8* noundef nonnull noalias readonly align 8 nocapture %label, i8* noundef nonnull noalias readonly align 8 nocapture %got, i8* noundef nonnull noalias readonly align 8 nocapture %want) #2 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call zeroext i1 @nish_str_eq(i8* %got, i8* %want)
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i8* %label)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

if.end:
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %label)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*))
  %4 = call i8* @nish_str_concat(i8* %3, i8* %got)
  call void @nish_print(i8* %4)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1
}

define internal noundef nonnull align 8 i8* @iterate(i32 noundef %times) #2 {
entry:
  %k.addr = alloca %struct.nish_array*, align 8
  %u.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %next.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 32, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 32, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 32)
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %1, %struct.nish_array** %k.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %7 = trunc i32 9 to i8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 0
  store i8 %7, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 32, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 32, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %16 = call i8* @nish_alloc_struct(i64 32)
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %13, %struct.nish_array** %u.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %u.addr, align 8
  %19 = trunc i32 9 to i8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 0
  store i8 %19, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %24 = load i32, i32* %i.addr, align 4
  %25 = icmp slt i32 %24, %times
  br i1 %25, label %for.body, label %for.end

for.body:
  %26 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %u.addr, align 8
  %28 = call %struct.nish_array* @ladder(%struct.nish_array* %26, %struct.nish_array* %27)
  store %struct.nish_array* %28, %struct.nish_array** %next.addr, align 8
  %29 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  store %struct.nish_array* %29, %struct.nish_array** %u.addr, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %next.addr, align 8
  store %struct.nish_array* %30, %struct.nish_array** %k.addr, align 8
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %k.addr, align 8
  %34 = call i64 @nish_arena_mark()
  %35 = call i8* @toHex(%struct.nish_array* %33)
  %36 = call i8* @nish_arena_keep(i64 %34, i8* %35)
  ret i8* %36
}

define noundef i32 @nish_main() #2 {
entry:
  %failed.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %failed.addr, align 4
  %0 = load i32, i32* %failed.addr, align 4
  %1 = call %struct.nish_array* @fromHex(i8* bitcast ({ i64, [65 x i8] }* @.str.7 to i8*))
  %2 = call %struct.nish_array* @fromHex(i8* bitcast ({ i64, [65 x i8] }* @.str.8 to i8*))
  %3 = call %struct.nish_array* @ladder(%struct.nish_array* %1, %struct.nish_array* %2)
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @toHex(%struct.nish_array* %3)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i32 @check(i8* bitcast ({ i64, [28 x i8] }* @.str.6 to i8*), i8* %6, i8* bitcast ({ i64, [65 x i8] }* @.str.9 to i8*))
  %8 = add nsw i32 %0, %7
  store i32 %8, i32* %failed.addr, align 4
  %9 = load i32, i32* %failed.addr, align 4
  %10 = call %struct.nish_array* @fromHex(i8* bitcast ({ i64, [65 x i8] }* @.str.11 to i8*))
  %11 = call %struct.nish_array* @fromHex(i8* bitcast ({ i64, [65 x i8] }* @.str.12 to i8*))
  %12 = call %struct.nish_array* @ladder(%struct.nish_array* %10, %struct.nish_array* %11)
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @toHex(%struct.nish_array* %12)
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  %16 = call i32 @check(i8* bitcast ({ i64, [29 x i8] }* @.str.10 to i8*), i8* %15, i8* bitcast ({ i64, [65 x i8] }* @.str.13 to i8*))
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %18, i32* %failed.addr, align 4
  %20 = load i32, i32* %failed.addr, align 4
  %21 = call %struct.nish_array* @fromHex(i8* bitcast ({ i64, [65 x i8] }* @.str.15 to i8*))
  %22 = call %struct.nish_array* @fromHex(i8* bitcast ({ i64, [65 x i8] }* @.str.16 to i8*))
  %23 = call %struct.nish_array* @ladder(%struct.nish_array* %21, %struct.nish_array* %22)
  %24 = call i64 @nish_arena_mark()
  %25 = call i8* @toHex(%struct.nish_array* %23)
  %26 = call i8* @nish_arena_keep(i64 %24, i8* %25)
  %27 = call i32 @check(i8* bitcast ({ i64, [34 x i8] }* @.str.14 to i8*), i8* %26, i8* bitcast ({ i64, [65 x i8] }* @.str.17 to i8*))
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %29, i32* %failed.addr, align 4
  %31 = load i32, i32* %failed.addr, align 4
  %32 = call i64 @nish_arena_mark()
  %33 = call i8* @iterate(i32 1000)
  %34 = call i8* @nish_arena_keep(i64 %32, i8* %33)
  %35 = call i32 @check(i8* bitcast ({ i64, [36 x i8] }* @.str.18 to i8*), i8* %34, i8* bitcast ({ i64, [65 x i8] }* @.str.19 to i8*))
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %37, i32* %failed.addr, align 4
  %39 = load i32, i32* %failed.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %39

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
!11 = !{!"element i64", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
