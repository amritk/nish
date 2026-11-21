%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"length \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c": scalar \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c", lanes \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"4000 bytes of 0xff: scalar \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"Wikipedia\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"11e60398\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"Wikipedia: scalar \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c" (published 11e60398)\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [37 x i8] } { i64 36, [37 x i8] c"WikipediaWikipediaWikipediaWikipedia\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"Wikipedia x4: scalar \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"mismatches: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5
declare i32 @llvm.vector.reduce.add.v16i32(<16 x i32>) #5
declare i32 @llvm.vector.reduce.add.v8i32(<8 x i32>) #5

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

define internal noundef i32 @adlerScalar(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 1, i32* %a.addr, align 4
  store i32 0, i32* %b.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %a.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = zext i8 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = srem i32 %15, 65521
  store i32 %17, i32* %a.addr, align 4
  %18 = load i32, i32* %b.addr, align 4
  %19 = load i32, i32* %a.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %23 = srem i32 %21, 65521
  store i32 %23, i32* %b.addr, align 4
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load i32, i32* %b.addr, align 4
  %27 = and i32 16, 31
  %28 = shl i32 %26, %27
  %29 = load i32, i32* %a.addr, align 4
  %30 = or i32 %28, %29
  ret i32 %30

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @adlerLanes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %zero.addr = alloca <16 x i8>, align 8
  %weightsLow.addr = alloca <8 x i16>, align 8
  %weightsHigh.addr = alloca <8 x i16>, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %v.addr = alloca <16 x i8>, align 8
  %low.addr = alloca <8 x i16>, align 8
  %high.addr = alloca <8 x i16>, align 8
  %weighted.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = insertelement <16 x i8> undef, i8 0, i32 0
  %4 = shufflevector <16 x i8> %3, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %4, <16 x i8>* %zero.addr, align 8
  %5 = insertelement <8 x i16> undef, i16 16, i32 0
  %6 = insertelement <8 x i16> %5, i16 15, i32 1
  %7 = insertelement <8 x i16> %6, i16 14, i32 2
  %8 = insertelement <8 x i16> %7, i16 13, i32 3
  %9 = insertelement <8 x i16> %8, i16 12, i32 4
  %10 = insertelement <8 x i16> %9, i16 11, i32 5
  %11 = insertelement <8 x i16> %10, i16 10, i32 6
  %12 = insertelement <8 x i16> %11, i16 9, i32 7
  store <8 x i16> %12, <8 x i16>* %weightsLow.addr, align 8
  %13 = insertelement <8 x i16> undef, i16 8, i32 0
  %14 = insertelement <8 x i16> %13, i16 7, i32 1
  %15 = insertelement <8 x i16> %14, i16 6, i32 2
  %16 = insertelement <8 x i16> %15, i16 5, i32 3
  %17 = insertelement <8 x i16> %16, i16 4, i32 4
  %18 = insertelement <8 x i16> %17, i16 3, i32 5
  %19 = insertelement <8 x i16> %18, i16 2, i32 6
  %20 = insertelement <8 x i16> %19, i16 1, i32 7
  store <8 x i16> %20, <8 x i16>* %weightsHigh.addr, align 8
  store i32 1, i32* %a.addr, align 4
  store i32 0, i32* %b.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %25 = load i32, i32* %i.addr, align 4
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 16)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  %29 = load i32, i32* %n.addr, align 4
  %30 = icmp sle i32 %27, %29
  br i1 %30, label %while.body, label %while.end

while.body:
  %31 = load i32, i32* %i.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = bitcast i8* %24 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 %32
  %35 = bitcast i8* %34 to <16 x i8>*
  %36 = load <16 x i8>, <16 x i8>* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  store <16 x i8> %36, <16 x i8>* %v.addr, align 8
  %37 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %38 = load <16 x i8>, <16 x i8>* %zero.addr, align 8
  %39 = shufflevector <16 x i8> %37, <16 x i8> %38, <16 x i32> <i32 0, i32 16, i32 1, i32 17, i32 2, i32 18, i32 3, i32 19, i32 4, i32 20, i32 5, i32 21, i32 6, i32 22, i32 7, i32 23>
  %40 = bitcast <16 x i8> %39 to <8 x i16>
  store <8 x i16> %40, <8 x i16>* %low.addr, align 8
  %41 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %42 = load <16 x i8>, <16 x i8>* %zero.addr, align 8
  %43 = shufflevector <16 x i8> %41, <16 x i8> %42, <16 x i32> <i32 8, i32 24, i32 9, i32 25, i32 10, i32 26, i32 11, i32 27, i32 12, i32 28, i32 13, i32 29, i32 14, i32 30, i32 15, i32 31>
  %44 = bitcast <16 x i8> %43 to <8 x i16>
  store <8 x i16> %44, <8 x i16>* %high.addr, align 8
  %45 = load <8 x i16>, <8 x i16>* %low.addr, align 8
  %46 = load <8 x i16>, <8 x i16>* %weightsLow.addr, align 8
  %47 = mul <8 x i16> %45, %46
  %48 = zext <8 x i16> %47 to <8 x i32>
  %49 = call i32 @llvm.vector.reduce.add.v8i32(<8 x i32> %48)
  %50 = load <8 x i16>, <8 x i16>* %high.addr, align 8
  %51 = load <8 x i16>, <8 x i16>* %weightsHigh.addr, align 8
  %52 = mul <8 x i16> %50, %51
  %53 = zext <8 x i16> %52 to <8 x i32>
  %54 = call i32 @llvm.vector.reduce.add.v8i32(<8 x i32> %53)
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 %54)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %56, i32* %weighted.addr, align 4
  %58 = load i32, i32* %b.addr, align 4
  %59 = load i32, i32* %a.addr, align 4
  %60 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 16, i32 %59)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 %61)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %66 = load i32, i32* %weighted.addr, align 4
  %67 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %64, i32 %66)
  %68 = extractvalue { i32, i1 } %67, 0
  %69 = extractvalue { i32, i1 } %67, 1
  br i1 %69, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %70 = srem i32 %68, 65521
  store i32 %70, i32* %b.addr, align 4
  %71 = load i32, i32* %a.addr, align 4
  %72 = load <16 x i8>, <16 x i8>* %v.addr, align 8
  %73 = zext <16 x i8> %72 to <16 x i32>
  %74 = call i32 @llvm.vector.reduce.add.v16i32(<16 x i32> %73)
  %75 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %71, i32 %74)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %78 = srem i32 %76, 65521
  store i32 %78, i32* %a.addr, align 4
  %79 = load i32, i32* %i.addr, align 4
  %80 = add nsw i32 %79, 16
  store i32 %80, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %83 = load i32, i32* %i.addr, align 4
  %84 = load i32, i32* %n.addr, align 4
  %85 = icmp slt i32 %83, %84
  br i1 %85, label %for.body, label %for.end

for.body:
  %86 = load i32, i32* %a.addr, align 4
  %87 = load i32, i32* %i.addr, align 4
  %88 = sext i32 %87 to i64
  %89 = bitcast i8* %82 to i8*
  %90 = getelementptr inbounds i8, i8* %89, i64 %88
  %91 = load i8, i8* %90, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %92 = zext i8 %91 to i32
  %93 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %86, i32 %92)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %96 = srem i32 %94, 65521
  store i32 %96, i32* %a.addr, align 4
  %97 = load i32, i32* %b.addr, align 4
  %98 = load i32, i32* %a.addr, align 4
  %99 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %97, i32 %98)
  %100 = extractvalue { i32, i1 } %99, 0
  %101 = extractvalue { i32, i1 } %99, 1
  br i1 %101, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %102 = srem i32 %100, 65521
  store i32 %102, i32* %b.addr, align 4
  br label %for.inc

for.inc:
  %103 = load i32, i32* %i.addr, align 4
  %104 = add nsw i32 %103, 1
  store i32 %104, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %105 = load i32, i32* %b.addr, align 4
  %106 = and i32 16, 31
  %107 = shl i32 %105, %106
  %108 = load i32, i32* %a.addr, align 4
  %109 = or i32 %107, %108
  ret i32 %109

ovf.fail:
  %ovf.op = phi i32 [ 0, %while.cond ], [ 0, %while.body ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 0, %ovf.ok.4 ], [ 0, %for.body ], [ 0, %ovf.ok.6 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @noise(i32 noundef %n, i32 noundef %seed) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %x.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 %seed, i32* %x.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %x.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 75)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 74)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %14 = srem i32 %12, 65537
  store i32 %14, i32* %x.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %16 = load i32, i32* %x.addr, align 4
  %17 = and i32 %16, 255
  %18 = trunc i32 %17 to i8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 1)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 %20
  store i8 %18, i8* %27, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %32 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %32

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @ascii(i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = bitcast i8* %text to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds i8, i8* %text, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1
  %16 = zext i8 %15 to i32
  %17 = trunc i32 %16 to i8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 1)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to i8*
  %26 = getelementptr inbounds i8, i8* %25, i64 %19
  store i8 %17, i8* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %31
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @ones(i32 noundef %n) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = trunc i32 255 to i8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 1)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %10
  store i8 %8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %22
}

define internal noundef nonnull align 8 i8* @hex8(i32 noundef %x) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %k.addr = alloca i32, align 4
  %nibble.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [8 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %4 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load i32, i32* %k.addr, align 4
  %8 = icmp slt i32 %7, 8
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %k.addr, align 4
  %10 = mul nsw i32 4, %9
  %11 = sub nsw i32 28, %10
  %12 = and i32 %11, 31
  %13 = lshr i32 %x, %12
  %14 = and i32 %13, 15
  store i32 %14, i32* %nibble.addr, align 4
  %15 = load i32, i32* %k.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = load i32, i32* %nibble.addr, align 4
  %18 = icmp slt i32 %17, 10
  br i1 %18, label %cond.true, label %cond.false

cond.true:
  %19 = load i32, i32* %nibble.addr, align 4
  %20 = add nsw i32 48, %19
  br label %cond.end

cond.false:
  %21 = load i32, i32* %nibble.addr, align 4
  %22 = add nsw i32 87, %21
  br label %cond.end

cond.end:
  %23 = phi i32 [ %20, %cond.true ], [ %22, %cond.false ]
  %24 = trunc i32 %23 to i8
  %25 = bitcast i8* %6 to i8*
  %26 = getelementptr inbounds i8, i8* %25, i64 %16
  store i8 %24, i8* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %27 = load i32, i32* %k.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %29 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ule i64 0, 8
  %33 = icmp ule i64 8, %31
  %34 = and i1 %32, %33
  br i1 %34, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 8, i64 %31)
  unreachable

bytes.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds i8, i8* %36, i64 0
  %38 = sub i64 8, 0
  %39 = call i8* @nish_str_new(i8* %37, i64 %38)
  ret i8* %39
}

define noundef i32 @nish_main() #0 {
entry:
  %lengths.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [9 x i32], align 8
  %mismatches.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %scalar.addr = alloca i32, align 4
  %lanes.addr = alloca i32, align 4
  %saturated.addr = alloca %struct.nish_array*, align 8
  %scalarOnes.addr = alloca i32, align 4
  %lanesOnes.addr = alloca i32, align 4
  %wiki.addr = alloca %struct.nish_array*, align 8
  %scalarWiki.addr = alloca i32, align 4
  %lanesWiki.addr = alloca i32, align 4
  %wiki4.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 9, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [9 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 15, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 16, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 17, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 31, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %11 = getelementptr inbounds i32, i32* %4, i64 6
  store i32 32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %12 = getelementptr inbounds i32, i32* %4, i64 7
  store i32 33, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %13 = getelementptr inbounds i32, i32* %4, i64 8
  store i32 100, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %lengths.addr, align 8
  store i32 0, i32* %mismatches.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %lengths.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %forof.body, label %forof.end

forof.body:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %15
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %23, i32* %n.addr, align 4
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %25 = load i8*, i8** %24, align 8
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %27 = load i64, i64* %26, align 8
  %28 = load i32, i32* %n.addr, align 4
  %29 = load i32, i32* %n.addr, align 4
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 1)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok

ovf.ok:
  %33 = call %struct.nish_array* @noise(i32 %28, i32 %31)
  store %struct.nish_array* %33, %struct.nish_array** %xs.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %35 = call i32 @adlerScalar(%struct.nish_array* %34)
  store i32 %35, i32* %scalar.addr, align 4
  %36 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %37 = call i32 @adlerLanes(%struct.nish_array* %36)
  store i32 %37, i32* %lanes.addr, align 4
  %38 = load i32, i32* %scalar.addr, align 4
  %39 = load i32, i32* %lanes.addr, align 4
  %40 = icmp ne i32 %38, %39
  br i1 %40, label %if.then, label %if.end

if.then:
  %41 = load i32, i32* %mismatches.addr, align 4
  %42 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %41, i32 1)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %43, i32* %mismatches.addr, align 4
  br label %if.end

if.end:
  %45 = load i32, i32* %n.addr, align 4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*))
  %49 = load i32, i32* %scalar.addr, align 4
  %50 = call i64 @nish_arena_mark()
  %51 = call i8* @hex8(i32 %49)
  %52 = call i8* @nish_arena_keep(i64 %50, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %48, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*))
  %55 = load i32, i32* %lanes.addr, align 4
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @hex8(i32 %55)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  %59 = call i8* @nish_str_concat(i8* %54, i8* %58)
  call void @nish_print(i8* %59)
  %60 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %61 = load i8*, i8** %60, align 8
  %62 = icmp eq i8* %61, %25
  br i1 %62, label %pass.rewind, label %pass.free

pass.rewind:
  %63 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %27, i64* %63, align 8
  br label %pass.done

pass.free:
  %64 = ptrtoint i8* %25 to i64
  %65 = add i64 %64, %27
  call void @nish_arena_release(i64 %65)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %66 = load i64, i64* %forof.idx, align 8
  %67 = add i64 %66, 1
  store i64 %67, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %68 = call %struct.nish_array* @ones(i32 4000)
  store %struct.nish_array* %68, %struct.nish_array** %saturated.addr, align 8
  %69 = load %struct.nish_array*, %struct.nish_array** %saturated.addr, align 8
  %70 = call i32 @adlerScalar(%struct.nish_array* %69)
  store i32 %70, i32* %scalarOnes.addr, align 4
  %71 = load %struct.nish_array*, %struct.nish_array** %saturated.addr, align 8
  %72 = call i32 @adlerLanes(%struct.nish_array* %71)
  store i32 %72, i32* %lanesOnes.addr, align 4
  %73 = load i32, i32* %scalarOnes.addr, align 4
  %74 = load i32, i32* %lanesOnes.addr, align 4
  %75 = icmp ne i32 %73, %74
  br i1 %75, label %if.then.1, label %if.end.1

if.then.1:
  %76 = load i32, i32* %mismatches.addr, align 4
  %77 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %76, i32 1)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %78, i32* %mismatches.addr, align 4
  br label %if.end.1

if.end.1:
  %80 = load i32, i32* %scalarOnes.addr, align 4
  %81 = call i64 @nish_arena_mark()
  %82 = call i8* @hex8(i32 %80)
  %83 = call i8* @nish_arena_keep(i64 %81, i8* %82)
  %84 = call i8* @nish_str_concat(i8* bitcast ({ i64, [28 x i8] }* @.str.3 to i8*), i8* %83)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*))
  %86 = load i32, i32* %lanesOnes.addr, align 4
  %87 = call i64 @nish_arena_mark()
  %88 = call i8* @hex8(i32 %86)
  %89 = call i8* @nish_arena_keep(i64 %87, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %85, i8* %89)
  call void @nish_print(i8* %90)
  %91 = call %struct.nish_array* @ascii(i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  store %struct.nish_array* %91, %struct.nish_array** %wiki.addr, align 8
  %92 = load %struct.nish_array*, %struct.nish_array** %wiki.addr, align 8
  %93 = call i32 @adlerScalar(%struct.nish_array* %92)
  store i32 %93, i32* %scalarWiki.addr, align 4
  %94 = load %struct.nish_array*, %struct.nish_array** %wiki.addr, align 8
  %95 = call i32 @adlerLanes(%struct.nish_array* %94)
  store i32 %95, i32* %lanesWiki.addr, align 4
  %96 = load i32, i32* %scalarWiki.addr, align 4
  %97 = load i32, i32* %lanesWiki.addr, align 4
  %98 = icmp ne i32 %96, %97
  br i1 %98, label %lor.end, label %lor.rhs

lor.rhs:
  %99 = load i32, i32* %scalarWiki.addr, align 4
  %100 = call i64 @nish_arena_mark()
  %101 = call i8* @hex8(i32 %99)
  %102 = call i8* @nish_arena_keep(i64 %100, i8* %101)
  %103 = call zeroext i1 @nish_str_eq(i8* %102, i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*))
  %104 = xor i1 %103, true
  br label %lor.end

lor.end:
  %105 = phi i1 [ true, %if.end.1 ], [ %104, %lor.rhs ]
  br i1 %105, label %if.then.2, label %if.end.2

if.then.2:
  %106 = load i32, i32* %mismatches.addr, align 4
  %107 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %106, i32 1)
  %108 = extractvalue { i32, i1 } %107, 0
  %109 = extractvalue { i32, i1 } %107, 1
  br i1 %109, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %108, i32* %mismatches.addr, align 4
  br label %if.end.2

if.end.2:
  %110 = load i32, i32* %scalarWiki.addr, align 4
  %111 = call i64 @nish_arena_mark()
  %112 = call i8* @hex8(i32 %110)
  %113 = call i8* @nish_arena_keep(i64 %111, i8* %112)
  %114 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.6 to i8*), i8* %113)
  %115 = call i8* @nish_str_concat(i8* %114, i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*))
  %116 = load i32, i32* %lanesWiki.addr, align 4
  %117 = call i64 @nish_arena_mark()
  %118 = call i8* @hex8(i32 %116)
  %119 = call i8* @nish_arena_keep(i64 %117, i8* %118)
  %120 = call i8* @nish_str_concat(i8* %115, i8* %119)
  %121 = call i8* @nish_str_concat(i8* %120, i8* bitcast ({ i64, [22 x i8] }* @.str.7 to i8*))
  call void @nish_print(i8* %121)
  %122 = call %struct.nish_array* @ascii(i8* bitcast ({ i64, [37 x i8] }* @.str.8 to i8*))
  store %struct.nish_array* %122, %struct.nish_array** %wiki4.addr, align 8
  %123 = load %struct.nish_array*, %struct.nish_array** %wiki4.addr, align 8
  %124 = call i32 @adlerScalar(%struct.nish_array* %123)
  %125 = load %struct.nish_array*, %struct.nish_array** %wiki4.addr, align 8
  %126 = call i32 @adlerLanes(%struct.nish_array* %125)
  %127 = icmp ne i32 %124, %126
  br i1 %127, label %if.then.3, label %if.end.3

if.then.3:
  %128 = load i32, i32* %mismatches.addr, align 4
  %129 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %128, i32 1)
  %130 = extractvalue { i32, i1 } %129, 0
  %131 = extractvalue { i32, i1 } %129, 1
  br i1 %131, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %130, i32* %mismatches.addr, align 4
  br label %if.end.3

if.end.3:
  %132 = load %struct.nish_array*, %struct.nish_array** %wiki4.addr, align 8
  %133 = call i32 @adlerScalar(%struct.nish_array* %132)
  %134 = call i64 @nish_arena_mark()
  %135 = call i8* @hex8(i32 %133)
  %136 = call i8* @nish_arena_keep(i64 %134, i8* %135)
  %137 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.9 to i8*), i8* %136)
  %138 = call i8* @nish_str_concat(i8* %137, i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*))
  %139 = load %struct.nish_array*, %struct.nish_array** %wiki4.addr, align 8
  %140 = call i32 @adlerLanes(%struct.nish_array* %139)
  %141 = call i64 @nish_arena_mark()
  %142 = call i8* @hex8(i32 %140)
  %143 = call i8* @nish_arena_keep(i64 %141, i8* %142)
  %144 = call i8* @nish_str_concat(i8* %138, i8* %143)
  call void @nish_print(i8* %144)
  %145 = load i32, i32* %mismatches.addr, align 4
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.10 to i8*), i8* %146)
  call void @nish_print(i8* %147)
  %148 = load i32, i32* %mismatches.addr, align 4
  %149 = icmp eq i32 %148, 0
  br i1 %149, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %150 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %150

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
