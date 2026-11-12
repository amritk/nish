%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @ctChacha20Word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %at) #0 {
entry:
  %0 = sext i32 %at to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = zext i8 %5 to i32
  %7 = add i32 %at, 1
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %8
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = zext i8 %13 to i32
  %15 = shl i32 %14, 8
  %16 = or i32 %6, %15
  %17 = add i32 %at, 2
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %18
  %23 = load i8, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %24 = zext i8 %23 to i32
  %25 = shl i32 %24, 16
  %26 = or i32 %16, %25
  %27 = add i32 %at, 3
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* %30 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %28
  %33 = load i8, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %34 = zext i8 %33 to i32
  %35 = shl i32 %34, 24
  %36 = or i32 %26, %35
  ret i32 %36
}

define internal noundef i64 @ctPoly1305Le64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %at) #0 {
entry:
  %0 = sext i32 %at to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = zext i8 %5 to i64
  %7 = add i32 %at, 1
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %8
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = zext i8 %13 to i64
  %15 = shl i64 %14, 8
  %16 = or i64 %6, %15
  %17 = add i32 %at, 2
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %18
  %23 = load i8, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %24 = zext i8 %23 to i64
  %25 = shl i64 %24, 16
  %26 = or i64 %16, %25
  %27 = add i32 %at, 3
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* %30 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %28
  %33 = load i8, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %34 = zext i8 %33 to i64
  %35 = shl i64 %34, 24
  %36 = or i64 %26, %35
  %37 = add i32 %at, 4
  %38 = sext i32 %37 to i64
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 %38
  %43 = load i8, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %44 = zext i8 %43 to i64
  %45 = shl i64 %44, 32
  %46 = or i64 %36, %45
  %47 = add i32 %at, 5
  %48 = sext i32 %47 to i64
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = bitcast i8* %50 to i8*
  %52 = getelementptr inbounds i8, i8* %51, i64 %48
  %53 = load i8, i8* %52, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %54 = zext i8 %53 to i64
  %55 = shl i64 %54, 40
  %56 = or i64 %46, %55
  %57 = add i32 %at, 6
  %58 = sext i32 %57 to i64
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = bitcast i8* %60 to i8*
  %62 = getelementptr inbounds i8, i8* %61, i64 %58
  %63 = load i8, i8* %62, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %64 = zext i8 %63 to i64
  %65 = shl i64 %64, 48
  %66 = or i64 %56, %65
  %67 = add i32 %at, 7
  %68 = sext i32 %67 to i64
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = bitcast i8* %70 to i8*
  %72 = getelementptr inbounds i8, i8* %71, i64 %68
  %73 = load i8, i8* %72, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %74 = zext i8 %73 to i64
  %75 = shl i64 %74, 56
  %76 = or i64 %66, %75
  ret i64 %76
}

define void @ctPoly1305Clamp(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %key, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %r) #1 {
entry:
  %lo.addr = alloca i64, align 8
  %hi.addr = alloca i64, align 8
  %0 = call i64 @ctPoly1305Le64(%struct.nish_array* %key, i32 0)
  %1 = sext i32 268435452 to i64
  %2 = shl i64 %1, 32
  %3 = or i64 %2, 268435455
  %4 = and i64 %0, %3
  store i64 %4, i64* %lo.addr, align 8
  %5 = call i64 @ctPoly1305Le64(%struct.nish_array* %key, i32 8)
  %6 = sext i32 268435452 to i64
  %7 = shl i64 %6, 32
  %8 = or i64 %7, 268435452
  %9 = and i64 %5, %8
  store i64 %9, i64* %hi.addr, align 8
  %10 = load i64, i64* %lo.addr, align 8
  %11 = and i64 %10, 67108863
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = bitcast i8* %13 to i64*
  %15 = getelementptr inbounds i64, i64* %14, i64 0
  store i64 %11, i64* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = load i64, i64* %lo.addr, align 8
  %17 = lshr i64 %16, 26
  %18 = and i64 %17, 67108863
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = bitcast i8* %20 to i64*
  %22 = getelementptr inbounds i64, i64* %21, i64 1
  store i64 %18, i64* %22, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = load i64, i64* %lo.addr, align 8
  %24 = lshr i64 %23, 52
  %25 = load i64, i64* %hi.addr, align 8
  %26 = shl i64 %25, 12
  %27 = or i64 %24, %26
  %28 = and i64 %27, 67108863
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* %30 to i64*
  %32 = getelementptr inbounds i64, i64* %31, i64 2
  store i64 %28, i64* %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = load i64, i64* %hi.addr, align 8
  %34 = lshr i64 %33, 14
  %35 = and i64 %34, 67108863
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = bitcast i8* %37 to i64*
  %39 = getelementptr inbounds i64, i64* %38, i64 3
  store i64 %35, i64* %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = load i64, i64* %hi.addr, align 8
  %41 = lshr i64 %40, 40
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = bitcast i8* %43 to i64*
  %45 = getelementptr inbounds i64, i64* %44, i64 4
  store i64 %41, i64* %45, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret void
}

define void @ctPoly1305Block(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %r, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %m, i32 noundef %at, i64 noundef %high) #1 {
entry:
  %lo.addr = alloca i64, align 8
  %hi.addr = alloca i64, align 8
  %h0.addr = alloca i64, align 8
  %h1.addr = alloca i64, align 8
  %h2.addr = alloca i64, align 8
  %h3.addr = alloca i64, align 8
  %h4.addr = alloca i64, align 8
  %r0.addr = alloca i64, align 8
  %r1.addr = alloca i64, align 8
  %r2.addr = alloca i64, align 8
  %r3.addr = alloca i64, align 8
  %r4.addr = alloca i64, align 8
  %s1.addr = alloca i64, align 8
  %s2.addr = alloca i64, align 8
  %s3.addr = alloca i64, align 8
  %s4.addr = alloca i64, align 8
  %d0.addr = alloca i64, align 8
  %d1.addr = alloca i64, align 8
  %d2.addr = alloca i64, align 8
  %d3.addr = alloca i64, align 8
  %d4.addr = alloca i64, align 8
  %0 = call i64 @ctPoly1305Le64(%struct.nish_array* %m, i32 %at)
  store i64 %0, i64* %lo.addr, align 8
  %1 = add i32 %at, 8
  %2 = call i64 @ctPoly1305Le64(%struct.nish_array* %m, i32 %1)
  store i64 %2, i64* %hi.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = bitcast i8* %4 to i64*
  %6 = getelementptr inbounds i64, i64* %5, i64 0
  %7 = load i64, i64* %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = load i64, i64* %lo.addr, align 8
  %9 = and i64 %8, 67108863
  %10 = add i64 %7, %9
  store i64 %10, i64* %h0.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = bitcast i8* %12 to i64*
  %14 = getelementptr inbounds i64, i64* %13, i64 1
  %15 = load i64, i64* %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = load i64, i64* %lo.addr, align 8
  %17 = lshr i64 %16, 26
  %18 = and i64 %17, 67108863
  %19 = add i64 %15, %18
  store i64 %19, i64* %h1.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i64*
  %23 = getelementptr inbounds i64, i64* %22, i64 2
  %24 = load i64, i64* %23, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = load i64, i64* %lo.addr, align 8
  %26 = lshr i64 %25, 52
  %27 = load i64, i64* %hi.addr, align 8
  %28 = shl i64 %27, 12
  %29 = or i64 %26, %28
  %30 = and i64 %29, 67108863
  %31 = add i64 %24, %30
  store i64 %31, i64* %h2.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = bitcast i8* %33 to i64*
  %35 = getelementptr inbounds i64, i64* %34, i64 3
  %36 = load i64, i64* %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = load i64, i64* %hi.addr, align 8
  %38 = lshr i64 %37, 14
  %39 = and i64 %38, 67108863
  %40 = add i64 %36, %39
  store i64 %40, i64* %h3.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = bitcast i8* %42 to i64*
  %44 = getelementptr inbounds i64, i64* %43, i64 4
  %45 = load i64, i64* %44, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %46 = load i64, i64* %hi.addr, align 8
  %47 = lshr i64 %46, 40
  %48 = or i64 %47, %high
  %49 = add i64 %45, %48
  store i64 %49, i64* %h4.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = bitcast i8* %51 to i64*
  %53 = getelementptr inbounds i64, i64* %52, i64 0
  %54 = load i64, i64* %53, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %54, i64* %r0.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = bitcast i8* %56 to i64*
  %58 = getelementptr inbounds i64, i64* %57, i64 1
  %59 = load i64, i64* %58, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %59, i64* %r1.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = bitcast i8* %61 to i64*
  %63 = getelementptr inbounds i64, i64* %62, i64 2
  %64 = load i64, i64* %63, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %64, i64* %r2.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = bitcast i8* %66 to i64*
  %68 = getelementptr inbounds i64, i64* %67, i64 3
  %69 = load i64, i64* %68, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %69, i64* %r3.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %r, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = bitcast i8* %71 to i64*
  %73 = getelementptr inbounds i64, i64* %72, i64 4
  %74 = load i64, i64* %73, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %74, i64* %r4.addr, align 8
  %75 = load i64, i64* %r1.addr, align 8
  %76 = mul i64 %75, 5
  store i64 %76, i64* %s1.addr, align 8
  %77 = load i64, i64* %r2.addr, align 8
  %78 = mul i64 %77, 5
  store i64 %78, i64* %s2.addr, align 8
  %79 = load i64, i64* %r3.addr, align 8
  %80 = mul i64 %79, 5
  store i64 %80, i64* %s3.addr, align 8
  %81 = load i64, i64* %r4.addr, align 8
  %82 = mul i64 %81, 5
  store i64 %82, i64* %s4.addr, align 8
  %83 = load i64, i64* %h0.addr, align 8
  %84 = load i64, i64* %r0.addr, align 8
  %85 = mul i64 %83, %84
  %86 = load i64, i64* %h1.addr, align 8
  %87 = load i64, i64* %s4.addr, align 8
  %88 = mul i64 %86, %87
  %89 = add i64 %85, %88
  %90 = load i64, i64* %h2.addr, align 8
  %91 = load i64, i64* %s3.addr, align 8
  %92 = mul i64 %90, %91
  %93 = add i64 %89, %92
  %94 = load i64, i64* %h3.addr, align 8
  %95 = load i64, i64* %s2.addr, align 8
  %96 = mul i64 %94, %95
  %97 = add i64 %93, %96
  %98 = load i64, i64* %h4.addr, align 8
  %99 = load i64, i64* %s1.addr, align 8
  %100 = mul i64 %98, %99
  %101 = add i64 %97, %100
  store i64 %101, i64* %d0.addr, align 8
  %102 = load i64, i64* %h0.addr, align 8
  %103 = load i64, i64* %r1.addr, align 8
  %104 = mul i64 %102, %103
  %105 = load i64, i64* %h1.addr, align 8
  %106 = load i64, i64* %r0.addr, align 8
  %107 = mul i64 %105, %106
  %108 = add i64 %104, %107
  %109 = load i64, i64* %h2.addr, align 8
  %110 = load i64, i64* %s4.addr, align 8
  %111 = mul i64 %109, %110
  %112 = add i64 %108, %111
  %113 = load i64, i64* %h3.addr, align 8
  %114 = load i64, i64* %s3.addr, align 8
  %115 = mul i64 %113, %114
  %116 = add i64 %112, %115
  %117 = load i64, i64* %h4.addr, align 8
  %118 = load i64, i64* %s2.addr, align 8
  %119 = mul i64 %117, %118
  %120 = add i64 %116, %119
  store i64 %120, i64* %d1.addr, align 8
  %121 = load i64, i64* %h0.addr, align 8
  %122 = load i64, i64* %r2.addr, align 8
  %123 = mul i64 %121, %122
  %124 = load i64, i64* %h1.addr, align 8
  %125 = load i64, i64* %r1.addr, align 8
  %126 = mul i64 %124, %125
  %127 = add i64 %123, %126
  %128 = load i64, i64* %h2.addr, align 8
  %129 = load i64, i64* %r0.addr, align 8
  %130 = mul i64 %128, %129
  %131 = add i64 %127, %130
  %132 = load i64, i64* %h3.addr, align 8
  %133 = load i64, i64* %s4.addr, align 8
  %134 = mul i64 %132, %133
  %135 = add i64 %131, %134
  %136 = load i64, i64* %h4.addr, align 8
  %137 = load i64, i64* %s3.addr, align 8
  %138 = mul i64 %136, %137
  %139 = add i64 %135, %138
  store i64 %139, i64* %d2.addr, align 8
  %140 = load i64, i64* %h0.addr, align 8
  %141 = load i64, i64* %r3.addr, align 8
  %142 = mul i64 %140, %141
  %143 = load i64, i64* %h1.addr, align 8
  %144 = load i64, i64* %r2.addr, align 8
  %145 = mul i64 %143, %144
  %146 = add i64 %142, %145
  %147 = load i64, i64* %h2.addr, align 8
  %148 = load i64, i64* %r1.addr, align 8
  %149 = mul i64 %147, %148
  %150 = add i64 %146, %149
  %151 = load i64, i64* %h3.addr, align 8
  %152 = load i64, i64* %r0.addr, align 8
  %153 = mul i64 %151, %152
  %154 = add i64 %150, %153
  %155 = load i64, i64* %h4.addr, align 8
  %156 = load i64, i64* %s4.addr, align 8
  %157 = mul i64 %155, %156
  %158 = add i64 %154, %157
  store i64 %158, i64* %d3.addr, align 8
  %159 = load i64, i64* %h0.addr, align 8
  %160 = load i64, i64* %r4.addr, align 8
  %161 = mul i64 %159, %160
  %162 = load i64, i64* %h1.addr, align 8
  %163 = load i64, i64* %r3.addr, align 8
  %164 = mul i64 %162, %163
  %165 = add i64 %161, %164
  %166 = load i64, i64* %h2.addr, align 8
  %167 = load i64, i64* %r2.addr, align 8
  %168 = mul i64 %166, %167
  %169 = add i64 %165, %168
  %170 = load i64, i64* %h3.addr, align 8
  %171 = load i64, i64* %r1.addr, align 8
  %172 = mul i64 %170, %171
  %173 = add i64 %169, %172
  %174 = load i64, i64* %h4.addr, align 8
  %175 = load i64, i64* %r0.addr, align 8
  %176 = mul i64 %174, %175
  %177 = add i64 %173, %176
  store i64 %177, i64* %d4.addr, align 8
  %178 = load i64, i64* %d1.addr, align 8
  %179 = load i64, i64* %d0.addr, align 8
  %180 = lshr i64 %179, 26
  %181 = add i64 %178, %180
  store i64 %181, i64* %d1.addr, align 8
  %182 = load i64, i64* %d2.addr, align 8
  %183 = load i64, i64* %d1.addr, align 8
  %184 = lshr i64 %183, 26
  %185 = add i64 %182, %184
  store i64 %185, i64* %d2.addr, align 8
  %186 = load i64, i64* %d3.addr, align 8
  %187 = load i64, i64* %d2.addr, align 8
  %188 = lshr i64 %187, 26
  %189 = add i64 %186, %188
  store i64 %189, i64* %d3.addr, align 8
  %190 = load i64, i64* %d4.addr, align 8
  %191 = load i64, i64* %d3.addr, align 8
  %192 = lshr i64 %191, 26
  %193 = add i64 %190, %192
  store i64 %193, i64* %d4.addr, align 8
  %194 = load i64, i64* %d0.addr, align 8
  %195 = and i64 %194, 67108863
  %196 = load i64, i64* %d4.addr, align 8
  %197 = lshr i64 %196, 26
  %198 = mul i64 %197, 5
  %199 = add i64 %195, %198
  store i64 %199, i64* %d0.addr, align 8
  %200 = load i64, i64* %d0.addr, align 8
  %201 = and i64 %200, 67108863
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %203 = load i8*, i8** %202, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %204 = bitcast i8* %203 to i64*
  %205 = getelementptr inbounds i64, i64* %204, i64 0
  store i64 %201, i64* %205, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %206 = load i64, i64* %d1.addr, align 8
  %207 = and i64 %206, 67108863
  %208 = load i64, i64* %d0.addr, align 8
  %209 = lshr i64 %208, 26
  %210 = add i64 %207, %209
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %212 = load i8*, i8** %211, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %213 = bitcast i8* %212 to i64*
  %214 = getelementptr inbounds i64, i64* %213, i64 1
  store i64 %210, i64* %214, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %215 = load i64, i64* %d2.addr, align 8
  %216 = and i64 %215, 67108863
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %218 = load i8*, i8** %217, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = bitcast i8* %218 to i64*
  %220 = getelementptr inbounds i64, i64* %219, i64 2
  store i64 %216, i64* %220, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %221 = load i64, i64* %d3.addr, align 8
  %222 = and i64 %221, 67108863
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %224 = load i8*, i8** %223, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %225 = bitcast i8* %224 to i64*
  %226 = getelementptr inbounds i64, i64* %225, i64 3
  store i64 %222, i64* %226, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %227 = load i64, i64* %d4.addr, align 8
  %228 = and i64 %227, 67108863
  %229 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %230 = load i8*, i8** %229, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %231 = bitcast i8* %230 to i64*
  %232 = getelementptr inbounds i64, i64* %231, i64 4
  store i64 %228, i64* %232, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret void
}

define void @ctPoly1305Finish(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %key, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %tag) #1 {
entry:
  %h0.addr = alloca i64, align 8
  %h1.addr = alloca i64, align 8
  %h2.addr = alloca i64, align 8
  %h3.addr = alloca i64, align 8
  %h4.addr = alloca i64, align 8
  %pass.addr = alloca i32, align 4
  %g0.addr = alloca i64, align 8
  %g1.addr = alloca i64, align 8
  %g2.addr = alloca i64, align 8
  %g3.addr = alloca i64, align 8
  %g4.addr = alloca i64, align 8
  %keep.addr = alloca i64, align 8
  %word.addr = alloca i64, align 8
  %f.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i64*
  %3 = getelementptr inbounds i64, i64* %2, i64 0
  %4 = load i64, i64* %3, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %4, i64* %h0.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = bitcast i8* %6 to i64*
  %8 = getelementptr inbounds i64, i64* %7, i64 1
  %9 = load i64, i64* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %9, i64* %h1.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i64*
  %13 = getelementptr inbounds i64, i64* %12, i64 2
  %14 = load i64, i64* %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %14, i64* %h2.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = bitcast i8* %16 to i64*
  %18 = getelementptr inbounds i64, i64* %17, i64 3
  %19 = load i64, i64* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %19, i64* %h3.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %h, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i64*
  %23 = getelementptr inbounds i64, i64* %22, i64 4
  %24 = load i64, i64* %23, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 %24, i64* %h4.addr, align 8
  store i32 0, i32* %pass.addr, align 4
  br label %for.cond

for.cond:
  %25 = load i32, i32* %pass.addr, align 4
  %26 = icmp slt i32 %25, 2
  br i1 %26, label %for.body, label %for.end

for.body:
  %27 = load i64, i64* %h1.addr, align 8
  %28 = load i64, i64* %h0.addr, align 8
  %29 = lshr i64 %28, 26
  %30 = add i64 %27, %29
  store i64 %30, i64* %h1.addr, align 8
  %31 = load i64, i64* %h0.addr, align 8
  %32 = and i64 %31, 67108863
  store i64 %32, i64* %h0.addr, align 8
  %33 = load i64, i64* %h2.addr, align 8
  %34 = load i64, i64* %h1.addr, align 8
  %35 = lshr i64 %34, 26
  %36 = add i64 %33, %35
  store i64 %36, i64* %h2.addr, align 8
  %37 = load i64, i64* %h1.addr, align 8
  %38 = and i64 %37, 67108863
  store i64 %38, i64* %h1.addr, align 8
  %39 = load i64, i64* %h3.addr, align 8
  %40 = load i64, i64* %h2.addr, align 8
  %41 = lshr i64 %40, 26
  %42 = add i64 %39, %41
  store i64 %42, i64* %h3.addr, align 8
  %43 = load i64, i64* %h2.addr, align 8
  %44 = and i64 %43, 67108863
  store i64 %44, i64* %h2.addr, align 8
  %45 = load i64, i64* %h4.addr, align 8
  %46 = load i64, i64* %h3.addr, align 8
  %47 = lshr i64 %46, 26
  %48 = add i64 %45, %47
  store i64 %48, i64* %h4.addr, align 8
  %49 = load i64, i64* %h3.addr, align 8
  %50 = and i64 %49, 67108863
  store i64 %50, i64* %h3.addr, align 8
  %51 = load i64, i64* %h0.addr, align 8
  %52 = load i64, i64* %h4.addr, align 8
  %53 = lshr i64 %52, 26
  %54 = mul i64 %53, 5
  %55 = add i64 %51, %54
  store i64 %55, i64* %h0.addr, align 8
  %56 = load i64, i64* %h4.addr, align 8
  %57 = and i64 %56, 67108863
  store i64 %57, i64* %h4.addr, align 8
  br label %for.inc

for.inc:
  %58 = load i32, i32* %pass.addr, align 4
  %59 = add nsw i32 %58, 1
  store i32 %59, i32* %pass.addr, align 4
  br label %for.cond

for.end:
  %60 = load i64, i64* %h0.addr, align 8
  %61 = add i64 %60, 5
  store i64 %61, i64* %g0.addr, align 8
  %62 = load i64, i64* %h1.addr, align 8
  %63 = load i64, i64* %g0.addr, align 8
  %64 = lshr i64 %63, 26
  %65 = add i64 %62, %64
  store i64 %65, i64* %g1.addr, align 8
  %66 = load i64, i64* %h2.addr, align 8
  %67 = load i64, i64* %g1.addr, align 8
  %68 = lshr i64 %67, 26
  %69 = add i64 %66, %68
  store i64 %69, i64* %g2.addr, align 8
  %70 = load i64, i64* %h3.addr, align 8
  %71 = load i64, i64* %g2.addr, align 8
  %72 = lshr i64 %71, 26
  %73 = add i64 %70, %72
  store i64 %73, i64* %g3.addr, align 8
  %74 = load i64, i64* %h4.addr, align 8
  %75 = load i64, i64* %g3.addr, align 8
  %76 = lshr i64 %75, 26
  %77 = add i64 %74, %76
  %78 = sub i64 %77, 67108864
  store i64 %78, i64* %g4.addr, align 8
  %79 = load i64, i64* %g4.addr, align 8
  %80 = lshr i64 %79, 63
  %81 = sub i64 %80, 1
  store i64 %81, i64* %keep.addr, align 8
  %82 = load i64, i64* %keep.addr, align 8
  %83 = load i64, i64* %g0.addr, align 8
  %84 = and i64 %83, 67108863
  %85 = load i64, i64* %h0.addr, align 8
  %86 = call i64 asm "", "=r,0"(i64 %82) readnone nounwind
  %87 = and i64 %84, %86
  %88 = xor i64 %86, -1
  %89 = and i64 %85, %88
  %90 = or i64 %87, %89
  store i64 %90, i64* %h0.addr, align 8
  %91 = load i64, i64* %keep.addr, align 8
  %92 = load i64, i64* %g1.addr, align 8
  %93 = and i64 %92, 67108863
  %94 = load i64, i64* %h1.addr, align 8
  %95 = call i64 asm "", "=r,0"(i64 %91) readnone nounwind
  %96 = and i64 %93, %95
  %97 = xor i64 %95, -1
  %98 = and i64 %94, %97
  %99 = or i64 %96, %98
  store i64 %99, i64* %h1.addr, align 8
  %100 = load i64, i64* %keep.addr, align 8
  %101 = load i64, i64* %g2.addr, align 8
  %102 = and i64 %101, 67108863
  %103 = load i64, i64* %h2.addr, align 8
  %104 = call i64 asm "", "=r,0"(i64 %100) readnone nounwind
  %105 = and i64 %102, %104
  %106 = xor i64 %104, -1
  %107 = and i64 %103, %106
  %108 = or i64 %105, %107
  store i64 %108, i64* %h2.addr, align 8
  %109 = load i64, i64* %keep.addr, align 8
  %110 = load i64, i64* %g3.addr, align 8
  %111 = and i64 %110, 67108863
  %112 = load i64, i64* %h3.addr, align 8
  %113 = call i64 asm "", "=r,0"(i64 %109) readnone nounwind
  %114 = and i64 %111, %113
  %115 = xor i64 %113, -1
  %116 = and i64 %112, %115
  %117 = or i64 %114, %116
  store i64 %117, i64* %h3.addr, align 8
  %118 = load i64, i64* %keep.addr, align 8
  %119 = load i64, i64* %g4.addr, align 8
  %120 = and i64 %119, 67108863
  %121 = load i64, i64* %h4.addr, align 8
  %122 = call i64 asm "", "=r,0"(i64 %118) readnone nounwind
  %123 = and i64 %120, %122
  %124 = xor i64 %122, -1
  %125 = and i64 %121, %124
  %126 = or i64 %123, %125
  store i64 %126, i64* %h4.addr, align 8
  store i64 4294967295, i64* %word.addr, align 8
  %127 = load i64, i64* %h0.addr, align 8
  %128 = load i64, i64* %h1.addr, align 8
  %129 = shl i64 %128, 26
  %130 = or i64 %127, %129
  %131 = load i64, i64* %word.addr, align 8
  %132 = and i64 %130, %131
  %133 = call i32 @ctChacha20Word(%struct.nish_array* %key, i32 16)
  %134 = zext i32 %133 to i64
  %135 = add i64 %132, %134
  store i64 %135, i64* %f.addr, align 8
  %136 = load i64, i64* %f.addr, align 8
  %137 = trunc i64 %136 to i8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %139 = load i8*, i8** %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %140 = bitcast i8* %139 to i8*
  %141 = getelementptr inbounds i8, i8* %140, i64 0
  store i8 %137, i8* %141, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %142 = load i64, i64* %f.addr, align 8
  %143 = lshr i64 %142, 8
  %144 = trunc i64 %143 to i8
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %147 = bitcast i8* %146 to i8*
  %148 = getelementptr inbounds i8, i8* %147, i64 1
  store i8 %144, i8* %148, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %149 = load i64, i64* %f.addr, align 8
  %150 = lshr i64 %149, 16
  %151 = trunc i64 %150 to i8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %153 = load i8*, i8** %152, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %154 = bitcast i8* %153 to i8*
  %155 = getelementptr inbounds i8, i8* %154, i64 2
  store i8 %151, i8* %155, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %156 = load i64, i64* %f.addr, align 8
  %157 = lshr i64 %156, 24
  %158 = trunc i64 %157 to i8
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %160 = load i8*, i8** %159, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %161 = bitcast i8* %160 to i8*
  %162 = getelementptr inbounds i8, i8* %161, i64 3
  store i8 %158, i8* %162, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %163 = load i64, i64* %h1.addr, align 8
  %164 = lshr i64 %163, 6
  %165 = load i64, i64* %h2.addr, align 8
  %166 = shl i64 %165, 20
  %167 = or i64 %164, %166
  %168 = load i64, i64* %word.addr, align 8
  %169 = and i64 %167, %168
  %170 = call i32 @ctChacha20Word(%struct.nish_array* %key, i32 20)
  %171 = zext i32 %170 to i64
  %172 = add i64 %169, %171
  %173 = load i64, i64* %f.addr, align 8
  %174 = lshr i64 %173, 32
  %175 = add i64 %172, %174
  store i64 %175, i64* %f.addr, align 8
  %176 = load i64, i64* %f.addr, align 8
  %177 = trunc i64 %176 to i8
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %179 = load i8*, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %180 = bitcast i8* %179 to i8*
  %181 = getelementptr inbounds i8, i8* %180, i64 4
  store i8 %177, i8* %181, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %182 = load i64, i64* %f.addr, align 8
  %183 = lshr i64 %182, 8
  %184 = trunc i64 %183 to i8
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %187 = bitcast i8* %186 to i8*
  %188 = getelementptr inbounds i8, i8* %187, i64 5
  store i8 %184, i8* %188, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %189 = load i64, i64* %f.addr, align 8
  %190 = lshr i64 %189, 16
  %191 = trunc i64 %190 to i8
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %193 = load i8*, i8** %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %194 = bitcast i8* %193 to i8*
  %195 = getelementptr inbounds i8, i8* %194, i64 6
  store i8 %191, i8* %195, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %196 = load i64, i64* %f.addr, align 8
  %197 = lshr i64 %196, 24
  %198 = trunc i64 %197 to i8
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %200 = load i8*, i8** %199, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %201 = bitcast i8* %200 to i8*
  %202 = getelementptr inbounds i8, i8* %201, i64 7
  store i8 %198, i8* %202, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %203 = load i64, i64* %h2.addr, align 8
  %204 = lshr i64 %203, 12
  %205 = load i64, i64* %h3.addr, align 8
  %206 = shl i64 %205, 14
  %207 = or i64 %204, %206
  %208 = load i64, i64* %word.addr, align 8
  %209 = and i64 %207, %208
  %210 = call i32 @ctChacha20Word(%struct.nish_array* %key, i32 24)
  %211 = zext i32 %210 to i64
  %212 = add i64 %209, %211
  %213 = load i64, i64* %f.addr, align 8
  %214 = lshr i64 %213, 32
  %215 = add i64 %212, %214
  store i64 %215, i64* %f.addr, align 8
  %216 = load i64, i64* %f.addr, align 8
  %217 = trunc i64 %216 to i8
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %219 = load i8*, i8** %218, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %220 = bitcast i8* %219 to i8*
  %221 = getelementptr inbounds i8, i8* %220, i64 8
  store i8 %217, i8* %221, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %222 = load i64, i64* %f.addr, align 8
  %223 = lshr i64 %222, 8
  %224 = trunc i64 %223 to i8
  %225 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %226 = load i8*, i8** %225, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %227 = bitcast i8* %226 to i8*
  %228 = getelementptr inbounds i8, i8* %227, i64 9
  store i8 %224, i8* %228, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %229 = load i64, i64* %f.addr, align 8
  %230 = lshr i64 %229, 16
  %231 = trunc i64 %230 to i8
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %233 = load i8*, i8** %232, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %234 = bitcast i8* %233 to i8*
  %235 = getelementptr inbounds i8, i8* %234, i64 10
  store i8 %231, i8* %235, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %236 = load i64, i64* %f.addr, align 8
  %237 = lshr i64 %236, 24
  %238 = trunc i64 %237 to i8
  %239 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %240 = load i8*, i8** %239, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %241 = bitcast i8* %240 to i8*
  %242 = getelementptr inbounds i8, i8* %241, i64 11
  store i8 %238, i8* %242, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %243 = load i64, i64* %h3.addr, align 8
  %244 = lshr i64 %243, 18
  %245 = load i64, i64* %h4.addr, align 8
  %246 = shl i64 %245, 8
  %247 = or i64 %244, %246
  %248 = load i64, i64* %word.addr, align 8
  %249 = and i64 %247, %248
  %250 = call i32 @ctChacha20Word(%struct.nish_array* %key, i32 28)
  %251 = zext i32 %250 to i64
  %252 = add i64 %249, %251
  %253 = load i64, i64* %f.addr, align 8
  %254 = lshr i64 %253, 32
  %255 = add i64 %252, %254
  store i64 %255, i64* %f.addr, align 8
  %256 = load i64, i64* %f.addr, align 8
  %257 = trunc i64 %256 to i8
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %259 = load i8*, i8** %258, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %260 = bitcast i8* %259 to i8*
  %261 = getelementptr inbounds i8, i8* %260, i64 12
  store i8 %257, i8* %261, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %262 = load i64, i64* %f.addr, align 8
  %263 = lshr i64 %262, 8
  %264 = trunc i64 %263 to i8
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %266 = load i8*, i8** %265, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %267 = bitcast i8* %266 to i8*
  %268 = getelementptr inbounds i8, i8* %267, i64 13
  store i8 %264, i8* %268, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %269 = load i64, i64* %f.addr, align 8
  %270 = lshr i64 %269, 16
  %271 = trunc i64 %270 to i8
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %273 = load i8*, i8** %272, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %274 = bitcast i8* %273 to i8*
  %275 = getelementptr inbounds i8, i8* %274, i64 14
  store i8 %271, i8* %275, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %276 = load i64, i64* %f.addr, align 8
  %277 = lshr i64 %276, 24
  %278 = trunc i64 %277 to i8
  %279 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %280 = load i8*, i8** %279, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %281 = bitcast i8* %280 to i8*
  %282 = getelementptr inbounds i8, i8* %281, i64 15
  store i8 %278, i8* %282, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define noundef i32 @ctChacha20Poly1305TagMatch(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %tag, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %sealed, i32 noundef %at) #0 {
entry:
  %diff.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to i8*
  %3 = getelementptr inbounds i8, i8* %2, i64 0
  %4 = load i8, i8* %3, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %5 = sext i32 %at to i64
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = bitcast i8* %7 to i8*
  %9 = getelementptr inbounds i8, i8* %8, i64 %5
  %10 = load i8, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %11 = xor i8 %4, %10
  %12 = zext i8 %11 to i32
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 1
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %18 = add i32 %at, 1
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = bitcast i8* %21 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 %19
  %24 = load i8, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %25 = xor i8 %17, %24
  %26 = zext i8 %25 to i32
  %27 = or i32 %12, %26
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = bitcast i8* %29 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 2
  %32 = load i8, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %33 = add i32 %at, 2
  %34 = sext i32 %33 to i64
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = bitcast i8* %36 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 %34
  %39 = load i8, i8* %38, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %40 = xor i8 %32, %39
  %41 = zext i8 %40 to i32
  %42 = or i32 %27, %41
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = bitcast i8* %44 to i8*
  %46 = getelementptr inbounds i8, i8* %45, i64 3
  %47 = load i8, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %48 = add i32 %at, 3
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = bitcast i8* %51 to i8*
  %53 = getelementptr inbounds i8, i8* %52, i64 %49
  %54 = load i8, i8* %53, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %55 = xor i8 %47, %54
  %56 = zext i8 %55 to i32
  %57 = or i32 %42, %56
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = bitcast i8* %59 to i8*
  %61 = getelementptr inbounds i8, i8* %60, i64 4
  %62 = load i8, i8* %61, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %63 = add i32 %at, 4
  %64 = sext i32 %63 to i64
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = bitcast i8* %66 to i8*
  %68 = getelementptr inbounds i8, i8* %67, i64 %64
  %69 = load i8, i8* %68, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %70 = xor i8 %62, %69
  %71 = zext i8 %70 to i32
  %72 = or i32 %57, %71
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = bitcast i8* %74 to i8*
  %76 = getelementptr inbounds i8, i8* %75, i64 5
  %77 = load i8, i8* %76, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %78 = add i32 %at, 5
  %79 = sext i32 %78 to i64
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = bitcast i8* %81 to i8*
  %83 = getelementptr inbounds i8, i8* %82, i64 %79
  %84 = load i8, i8* %83, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %85 = xor i8 %77, %84
  %86 = zext i8 %85 to i32
  %87 = or i32 %72, %86
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = bitcast i8* %89 to i8*
  %91 = getelementptr inbounds i8, i8* %90, i64 6
  %92 = load i8, i8* %91, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %93 = add i32 %at, 6
  %94 = sext i32 %93 to i64
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %97 = bitcast i8* %96 to i8*
  %98 = getelementptr inbounds i8, i8* %97, i64 %94
  %99 = load i8, i8* %98, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %100 = xor i8 %92, %99
  %101 = zext i8 %100 to i32
  %102 = or i32 %87, %101
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = bitcast i8* %104 to i8*
  %106 = getelementptr inbounds i8, i8* %105, i64 7
  %107 = load i8, i8* %106, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %108 = add i32 %at, 7
  %109 = sext i32 %108 to i64
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %112 = bitcast i8* %111 to i8*
  %113 = getelementptr inbounds i8, i8* %112, i64 %109
  %114 = load i8, i8* %113, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %115 = xor i8 %107, %114
  %116 = zext i8 %115 to i32
  %117 = or i32 %102, %116
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = bitcast i8* %119 to i8*
  %121 = getelementptr inbounds i8, i8* %120, i64 8
  %122 = load i8, i8* %121, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %123 = add i32 %at, 8
  %124 = sext i32 %123 to i64
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = bitcast i8* %126 to i8*
  %128 = getelementptr inbounds i8, i8* %127, i64 %124
  %129 = load i8, i8* %128, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %130 = xor i8 %122, %129
  %131 = zext i8 %130 to i32
  %132 = or i32 %117, %131
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %134 = load i8*, i8** %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %135 = bitcast i8* %134 to i8*
  %136 = getelementptr inbounds i8, i8* %135, i64 9
  %137 = load i8, i8* %136, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %138 = add i32 %at, 9
  %139 = sext i32 %138 to i64
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %141 = load i8*, i8** %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %142 = bitcast i8* %141 to i8*
  %143 = getelementptr inbounds i8, i8* %142, i64 %139
  %144 = load i8, i8* %143, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %145 = xor i8 %137, %144
  %146 = zext i8 %145 to i32
  %147 = or i32 %132, %146
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %149 = load i8*, i8** %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = bitcast i8* %149 to i8*
  %151 = getelementptr inbounds i8, i8* %150, i64 10
  %152 = load i8, i8* %151, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %153 = add i32 %at, 10
  %154 = sext i32 %153 to i64
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = bitcast i8* %156 to i8*
  %158 = getelementptr inbounds i8, i8* %157, i64 %154
  %159 = load i8, i8* %158, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %160 = xor i8 %152, %159
  %161 = zext i8 %160 to i32
  %162 = or i32 %147, %161
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %164 = load i8*, i8** %163, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = bitcast i8* %164 to i8*
  %166 = getelementptr inbounds i8, i8* %165, i64 11
  %167 = load i8, i8* %166, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %168 = add i32 %at, 11
  %169 = sext i32 %168 to i64
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %171 = load i8*, i8** %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %172 = bitcast i8* %171 to i8*
  %173 = getelementptr inbounds i8, i8* %172, i64 %169
  %174 = load i8, i8* %173, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %175 = xor i8 %167, %174
  %176 = zext i8 %175 to i32
  %177 = or i32 %162, %176
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %179 = load i8*, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %180 = bitcast i8* %179 to i8*
  %181 = getelementptr inbounds i8, i8* %180, i64 12
  %182 = load i8, i8* %181, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %183 = add i32 %at, 12
  %184 = sext i32 %183 to i64
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %187 = bitcast i8* %186 to i8*
  %188 = getelementptr inbounds i8, i8* %187, i64 %184
  %189 = load i8, i8* %188, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %190 = xor i8 %182, %189
  %191 = zext i8 %190 to i32
  %192 = or i32 %177, %191
  %193 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %194 = load i8*, i8** %193, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %195 = bitcast i8* %194 to i8*
  %196 = getelementptr inbounds i8, i8* %195, i64 13
  %197 = load i8, i8* %196, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %198 = add i32 %at, 13
  %199 = sext i32 %198 to i64
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %202 = bitcast i8* %201 to i8*
  %203 = getelementptr inbounds i8, i8* %202, i64 %199
  %204 = load i8, i8* %203, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %205 = xor i8 %197, %204
  %206 = zext i8 %205 to i32
  %207 = or i32 %192, %206
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %209 = load i8*, i8** %208, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %210 = bitcast i8* %209 to i8*
  %211 = getelementptr inbounds i8, i8* %210, i64 14
  %212 = load i8, i8* %211, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %213 = add i32 %at, 14
  %214 = sext i32 %213 to i64
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %216 = load i8*, i8** %215, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %217 = bitcast i8* %216 to i8*
  %218 = getelementptr inbounds i8, i8* %217, i64 %214
  %219 = load i8, i8* %218, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %220 = xor i8 %212, %219
  %221 = zext i8 %220 to i32
  %222 = or i32 %207, %221
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %tag, i64 0, i32 2
  %224 = load i8*, i8** %223, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %225 = bitcast i8* %224 to i8*
  %226 = getelementptr inbounds i8, i8* %225, i64 15
  %227 = load i8, i8* %226, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %228 = add i32 %at, 15
  %229 = sext i32 %228 to i64
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sealed, i64 0, i32 2
  %231 = load i8*, i8** %230, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %232 = bitcast i8* %231 to i8*
  %233 = getelementptr inbounds i8, i8* %232, i64 %229
  %234 = load i8, i8* %233, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %235 = xor i8 %227, %234
  %236 = zext i8 %235 to i32
  %237 = or i32 %222, %236
  store i32 %237, i32* %diff.addr, align 4
  %238 = load i32, i32* %diff.addr, align 4
  %239 = xor i32 %238, 0
  %240 = sub i32 0, %239
  %241 = or i32 %239, %240
  %242 = lshr i32 %241, 31
  %243 = sub i32 %242, 1
  %244 = call i32 asm "", "=r,0"(i32 %243) readnone nounwind
  ret i32 %244
}

define internal noundef i32 @ctChacha20Rotl(i32 noundef %x, i32 noundef %n) #2 {
entry:
  %0 = and i32 %n, 31
  %1 = shl i32 %x, %0
  %2 = sub i32 32, %n
  %3 = and i32 %2, 31
  %4 = lshr i32 %x, %3
  %5 = or i32 %1, %4
  ret i32 %5
}

define void @ctChacha20Core(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %state, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #1 {
entry:
  %x0.addr = alloca i32, align 4
  %x1.addr = alloca i32, align 4
  %x2.addr = alloca i32, align 4
  %x3.addr = alloca i32, align 4
  %x4.addr = alloca i32, align 4
  %x5.addr = alloca i32, align 4
  %x6.addr = alloca i32, align 4
  %x7.addr = alloca i32, align 4
  %x8.addr = alloca i32, align 4
  %x9.addr = alloca i32, align 4
  %x10.addr = alloca i32, align 4
  %x11.addr = alloca i32, align 4
  %x12.addr = alloca i32, align 4
  %x13.addr = alloca i32, align 4
  %x14.addr = alloca i32, align 4
  %x15.addr = alloca i32, align 4
  %round.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %2 = trunc i64 %1 to i32
  %3 = icmp slt i32 %2, 16
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %6, 16
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 0
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %13, i32* %x0.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 1
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %18, i32* %x1.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 2
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %23, i32* %x2.addr, align 4
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 3
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %28, i32* %x3.addr, align 4
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 4
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %33, i32* %x4.addr, align 4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 5
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %38, i32* %x5.addr, align 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 6
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %43, i32* %x6.addr, align 4
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 7
  %48 = load i32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %48, i32* %x7.addr, align 4
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = bitcast i8* %50 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 8
  %53 = load i32, i32* %52, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %53, i32* %x8.addr, align 4
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 9
  %58 = load i32, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %58, i32* %x9.addr, align 4
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = bitcast i8* %60 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 10
  %63 = load i32, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %63, i32* %x10.addr, align 4
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = bitcast i8* %65 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 11
  %68 = load i32, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %68, i32* %x11.addr, align 4
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = bitcast i8* %70 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 12
  %73 = load i32, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %73, i32* %x12.addr, align 4
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 13
  %78 = load i32, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %78, i32* %x13.addr, align 4
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = bitcast i8* %80 to i32*
  %82 = getelementptr inbounds i32, i32* %81, i64 14
  %83 = load i32, i32* %82, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %83, i32* %x14.addr, align 4
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = bitcast i8* %85 to i32*
  %87 = getelementptr inbounds i32, i32* %86, i64 15
  %88 = load i32, i32* %87, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %88, i32* %x15.addr, align 4
  store i32 0, i32* %round.addr, align 4
  br label %for.cond

for.cond:
  %89 = load i32, i32* %round.addr, align 4
  %90 = icmp slt i32 %89, 10
  br i1 %90, label %for.body, label %for.end

for.body:
  %91 = load i32, i32* %x0.addr, align 4
  %92 = load i32, i32* %x4.addr, align 4
  %93 = add i32 %91, %92
  store i32 %93, i32* %x0.addr, align 4
  %94 = load i32, i32* %x12.addr, align 4
  %95 = load i32, i32* %x0.addr, align 4
  %96 = xor i32 %94, %95
  %97 = call i32 @ctChacha20Rotl(i32 %96, i32 16)
  store i32 %97, i32* %x12.addr, align 4
  %98 = load i32, i32* %x8.addr, align 4
  %99 = load i32, i32* %x12.addr, align 4
  %100 = add i32 %98, %99
  store i32 %100, i32* %x8.addr, align 4
  %101 = load i32, i32* %x4.addr, align 4
  %102 = load i32, i32* %x8.addr, align 4
  %103 = xor i32 %101, %102
  %104 = call i32 @ctChacha20Rotl(i32 %103, i32 12)
  store i32 %104, i32* %x4.addr, align 4
  %105 = load i32, i32* %x0.addr, align 4
  %106 = load i32, i32* %x4.addr, align 4
  %107 = add i32 %105, %106
  store i32 %107, i32* %x0.addr, align 4
  %108 = load i32, i32* %x12.addr, align 4
  %109 = load i32, i32* %x0.addr, align 4
  %110 = xor i32 %108, %109
  %111 = call i32 @ctChacha20Rotl(i32 %110, i32 8)
  store i32 %111, i32* %x12.addr, align 4
  %112 = load i32, i32* %x8.addr, align 4
  %113 = load i32, i32* %x12.addr, align 4
  %114 = add i32 %112, %113
  store i32 %114, i32* %x8.addr, align 4
  %115 = load i32, i32* %x4.addr, align 4
  %116 = load i32, i32* %x8.addr, align 4
  %117 = xor i32 %115, %116
  %118 = call i32 @ctChacha20Rotl(i32 %117, i32 7)
  store i32 %118, i32* %x4.addr, align 4
  %119 = load i32, i32* %x1.addr, align 4
  %120 = load i32, i32* %x5.addr, align 4
  %121 = add i32 %119, %120
  store i32 %121, i32* %x1.addr, align 4
  %122 = load i32, i32* %x13.addr, align 4
  %123 = load i32, i32* %x1.addr, align 4
  %124 = xor i32 %122, %123
  %125 = call i32 @ctChacha20Rotl(i32 %124, i32 16)
  store i32 %125, i32* %x13.addr, align 4
  %126 = load i32, i32* %x9.addr, align 4
  %127 = load i32, i32* %x13.addr, align 4
  %128 = add i32 %126, %127
  store i32 %128, i32* %x9.addr, align 4
  %129 = load i32, i32* %x5.addr, align 4
  %130 = load i32, i32* %x9.addr, align 4
  %131 = xor i32 %129, %130
  %132 = call i32 @ctChacha20Rotl(i32 %131, i32 12)
  store i32 %132, i32* %x5.addr, align 4
  %133 = load i32, i32* %x1.addr, align 4
  %134 = load i32, i32* %x5.addr, align 4
  %135 = add i32 %133, %134
  store i32 %135, i32* %x1.addr, align 4
  %136 = load i32, i32* %x13.addr, align 4
  %137 = load i32, i32* %x1.addr, align 4
  %138 = xor i32 %136, %137
  %139 = call i32 @ctChacha20Rotl(i32 %138, i32 8)
  store i32 %139, i32* %x13.addr, align 4
  %140 = load i32, i32* %x9.addr, align 4
  %141 = load i32, i32* %x13.addr, align 4
  %142 = add i32 %140, %141
  store i32 %142, i32* %x9.addr, align 4
  %143 = load i32, i32* %x5.addr, align 4
  %144 = load i32, i32* %x9.addr, align 4
  %145 = xor i32 %143, %144
  %146 = call i32 @ctChacha20Rotl(i32 %145, i32 7)
  store i32 %146, i32* %x5.addr, align 4
  %147 = load i32, i32* %x2.addr, align 4
  %148 = load i32, i32* %x6.addr, align 4
  %149 = add i32 %147, %148
  store i32 %149, i32* %x2.addr, align 4
  %150 = load i32, i32* %x14.addr, align 4
  %151 = load i32, i32* %x2.addr, align 4
  %152 = xor i32 %150, %151
  %153 = call i32 @ctChacha20Rotl(i32 %152, i32 16)
  store i32 %153, i32* %x14.addr, align 4
  %154 = load i32, i32* %x10.addr, align 4
  %155 = load i32, i32* %x14.addr, align 4
  %156 = add i32 %154, %155
  store i32 %156, i32* %x10.addr, align 4
  %157 = load i32, i32* %x6.addr, align 4
  %158 = load i32, i32* %x10.addr, align 4
  %159 = xor i32 %157, %158
  %160 = call i32 @ctChacha20Rotl(i32 %159, i32 12)
  store i32 %160, i32* %x6.addr, align 4
  %161 = load i32, i32* %x2.addr, align 4
  %162 = load i32, i32* %x6.addr, align 4
  %163 = add i32 %161, %162
  store i32 %163, i32* %x2.addr, align 4
  %164 = load i32, i32* %x14.addr, align 4
  %165 = load i32, i32* %x2.addr, align 4
  %166 = xor i32 %164, %165
  %167 = call i32 @ctChacha20Rotl(i32 %166, i32 8)
  store i32 %167, i32* %x14.addr, align 4
  %168 = load i32, i32* %x10.addr, align 4
  %169 = load i32, i32* %x14.addr, align 4
  %170 = add i32 %168, %169
  store i32 %170, i32* %x10.addr, align 4
  %171 = load i32, i32* %x6.addr, align 4
  %172 = load i32, i32* %x10.addr, align 4
  %173 = xor i32 %171, %172
  %174 = call i32 @ctChacha20Rotl(i32 %173, i32 7)
  store i32 %174, i32* %x6.addr, align 4
  %175 = load i32, i32* %x3.addr, align 4
  %176 = load i32, i32* %x7.addr, align 4
  %177 = add i32 %175, %176
  store i32 %177, i32* %x3.addr, align 4
  %178 = load i32, i32* %x15.addr, align 4
  %179 = load i32, i32* %x3.addr, align 4
  %180 = xor i32 %178, %179
  %181 = call i32 @ctChacha20Rotl(i32 %180, i32 16)
  store i32 %181, i32* %x15.addr, align 4
  %182 = load i32, i32* %x11.addr, align 4
  %183 = load i32, i32* %x15.addr, align 4
  %184 = add i32 %182, %183
  store i32 %184, i32* %x11.addr, align 4
  %185 = load i32, i32* %x7.addr, align 4
  %186 = load i32, i32* %x11.addr, align 4
  %187 = xor i32 %185, %186
  %188 = call i32 @ctChacha20Rotl(i32 %187, i32 12)
  store i32 %188, i32* %x7.addr, align 4
  %189 = load i32, i32* %x3.addr, align 4
  %190 = load i32, i32* %x7.addr, align 4
  %191 = add i32 %189, %190
  store i32 %191, i32* %x3.addr, align 4
  %192 = load i32, i32* %x15.addr, align 4
  %193 = load i32, i32* %x3.addr, align 4
  %194 = xor i32 %192, %193
  %195 = call i32 @ctChacha20Rotl(i32 %194, i32 8)
  store i32 %195, i32* %x15.addr, align 4
  %196 = load i32, i32* %x11.addr, align 4
  %197 = load i32, i32* %x15.addr, align 4
  %198 = add i32 %196, %197
  store i32 %198, i32* %x11.addr, align 4
  %199 = load i32, i32* %x7.addr, align 4
  %200 = load i32, i32* %x11.addr, align 4
  %201 = xor i32 %199, %200
  %202 = call i32 @ctChacha20Rotl(i32 %201, i32 7)
  store i32 %202, i32* %x7.addr, align 4
  %203 = load i32, i32* %x0.addr, align 4
  %204 = load i32, i32* %x5.addr, align 4
  %205 = add i32 %203, %204
  store i32 %205, i32* %x0.addr, align 4
  %206 = load i32, i32* %x15.addr, align 4
  %207 = load i32, i32* %x0.addr, align 4
  %208 = xor i32 %206, %207
  %209 = call i32 @ctChacha20Rotl(i32 %208, i32 16)
  store i32 %209, i32* %x15.addr, align 4
  %210 = load i32, i32* %x10.addr, align 4
  %211 = load i32, i32* %x15.addr, align 4
  %212 = add i32 %210, %211
  store i32 %212, i32* %x10.addr, align 4
  %213 = load i32, i32* %x5.addr, align 4
  %214 = load i32, i32* %x10.addr, align 4
  %215 = xor i32 %213, %214
  %216 = call i32 @ctChacha20Rotl(i32 %215, i32 12)
  store i32 %216, i32* %x5.addr, align 4
  %217 = load i32, i32* %x0.addr, align 4
  %218 = load i32, i32* %x5.addr, align 4
  %219 = add i32 %217, %218
  store i32 %219, i32* %x0.addr, align 4
  %220 = load i32, i32* %x15.addr, align 4
  %221 = load i32, i32* %x0.addr, align 4
  %222 = xor i32 %220, %221
  %223 = call i32 @ctChacha20Rotl(i32 %222, i32 8)
  store i32 %223, i32* %x15.addr, align 4
  %224 = load i32, i32* %x10.addr, align 4
  %225 = load i32, i32* %x15.addr, align 4
  %226 = add i32 %224, %225
  store i32 %226, i32* %x10.addr, align 4
  %227 = load i32, i32* %x5.addr, align 4
  %228 = load i32, i32* %x10.addr, align 4
  %229 = xor i32 %227, %228
  %230 = call i32 @ctChacha20Rotl(i32 %229, i32 7)
  store i32 %230, i32* %x5.addr, align 4
  %231 = load i32, i32* %x1.addr, align 4
  %232 = load i32, i32* %x6.addr, align 4
  %233 = add i32 %231, %232
  store i32 %233, i32* %x1.addr, align 4
  %234 = load i32, i32* %x12.addr, align 4
  %235 = load i32, i32* %x1.addr, align 4
  %236 = xor i32 %234, %235
  %237 = call i32 @ctChacha20Rotl(i32 %236, i32 16)
  store i32 %237, i32* %x12.addr, align 4
  %238 = load i32, i32* %x11.addr, align 4
  %239 = load i32, i32* %x12.addr, align 4
  %240 = add i32 %238, %239
  store i32 %240, i32* %x11.addr, align 4
  %241 = load i32, i32* %x6.addr, align 4
  %242 = load i32, i32* %x11.addr, align 4
  %243 = xor i32 %241, %242
  %244 = call i32 @ctChacha20Rotl(i32 %243, i32 12)
  store i32 %244, i32* %x6.addr, align 4
  %245 = load i32, i32* %x1.addr, align 4
  %246 = load i32, i32* %x6.addr, align 4
  %247 = add i32 %245, %246
  store i32 %247, i32* %x1.addr, align 4
  %248 = load i32, i32* %x12.addr, align 4
  %249 = load i32, i32* %x1.addr, align 4
  %250 = xor i32 %248, %249
  %251 = call i32 @ctChacha20Rotl(i32 %250, i32 8)
  store i32 %251, i32* %x12.addr, align 4
  %252 = load i32, i32* %x11.addr, align 4
  %253 = load i32, i32* %x12.addr, align 4
  %254 = add i32 %252, %253
  store i32 %254, i32* %x11.addr, align 4
  %255 = load i32, i32* %x6.addr, align 4
  %256 = load i32, i32* %x11.addr, align 4
  %257 = xor i32 %255, %256
  %258 = call i32 @ctChacha20Rotl(i32 %257, i32 7)
  store i32 %258, i32* %x6.addr, align 4
  %259 = load i32, i32* %x2.addr, align 4
  %260 = load i32, i32* %x7.addr, align 4
  %261 = add i32 %259, %260
  store i32 %261, i32* %x2.addr, align 4
  %262 = load i32, i32* %x13.addr, align 4
  %263 = load i32, i32* %x2.addr, align 4
  %264 = xor i32 %262, %263
  %265 = call i32 @ctChacha20Rotl(i32 %264, i32 16)
  store i32 %265, i32* %x13.addr, align 4
  %266 = load i32, i32* %x8.addr, align 4
  %267 = load i32, i32* %x13.addr, align 4
  %268 = add i32 %266, %267
  store i32 %268, i32* %x8.addr, align 4
  %269 = load i32, i32* %x7.addr, align 4
  %270 = load i32, i32* %x8.addr, align 4
  %271 = xor i32 %269, %270
  %272 = call i32 @ctChacha20Rotl(i32 %271, i32 12)
  store i32 %272, i32* %x7.addr, align 4
  %273 = load i32, i32* %x2.addr, align 4
  %274 = load i32, i32* %x7.addr, align 4
  %275 = add i32 %273, %274
  store i32 %275, i32* %x2.addr, align 4
  %276 = load i32, i32* %x13.addr, align 4
  %277 = load i32, i32* %x2.addr, align 4
  %278 = xor i32 %276, %277
  %279 = call i32 @ctChacha20Rotl(i32 %278, i32 8)
  store i32 %279, i32* %x13.addr, align 4
  %280 = load i32, i32* %x8.addr, align 4
  %281 = load i32, i32* %x13.addr, align 4
  %282 = add i32 %280, %281
  store i32 %282, i32* %x8.addr, align 4
  %283 = load i32, i32* %x7.addr, align 4
  %284 = load i32, i32* %x8.addr, align 4
  %285 = xor i32 %283, %284
  %286 = call i32 @ctChacha20Rotl(i32 %285, i32 7)
  store i32 %286, i32* %x7.addr, align 4
  %287 = load i32, i32* %x3.addr, align 4
  %288 = load i32, i32* %x4.addr, align 4
  %289 = add i32 %287, %288
  store i32 %289, i32* %x3.addr, align 4
  %290 = load i32, i32* %x14.addr, align 4
  %291 = load i32, i32* %x3.addr, align 4
  %292 = xor i32 %290, %291
  %293 = call i32 @ctChacha20Rotl(i32 %292, i32 16)
  store i32 %293, i32* %x14.addr, align 4
  %294 = load i32, i32* %x9.addr, align 4
  %295 = load i32, i32* %x14.addr, align 4
  %296 = add i32 %294, %295
  store i32 %296, i32* %x9.addr, align 4
  %297 = load i32, i32* %x4.addr, align 4
  %298 = load i32, i32* %x9.addr, align 4
  %299 = xor i32 %297, %298
  %300 = call i32 @ctChacha20Rotl(i32 %299, i32 12)
  store i32 %300, i32* %x4.addr, align 4
  %301 = load i32, i32* %x3.addr, align 4
  %302 = load i32, i32* %x4.addr, align 4
  %303 = add i32 %301, %302
  store i32 %303, i32* %x3.addr, align 4
  %304 = load i32, i32* %x14.addr, align 4
  %305 = load i32, i32* %x3.addr, align 4
  %306 = xor i32 %304, %305
  %307 = call i32 @ctChacha20Rotl(i32 %306, i32 8)
  store i32 %307, i32* %x14.addr, align 4
  %308 = load i32, i32* %x9.addr, align 4
  %309 = load i32, i32* %x14.addr, align 4
  %310 = add i32 %308, %309
  store i32 %310, i32* %x9.addr, align 4
  %311 = load i32, i32* %x4.addr, align 4
  %312 = load i32, i32* %x9.addr, align 4
  %313 = xor i32 %311, %312
  %314 = call i32 @ctChacha20Rotl(i32 %313, i32 7)
  store i32 %314, i32* %x4.addr, align 4
  br label %for.inc

for.inc:
  %315 = load i32, i32* %round.addr, align 4
  %316 = add nsw i32 %315, 1
  store i32 %316, i32* %round.addr, align 4
  br label %for.cond

for.end:
  %317 = load i32, i32* %x0.addr, align 4
  %318 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %319 = load i8*, i8** %318, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %320 = bitcast i8* %319 to i32*
  %321 = getelementptr inbounds i32, i32* %320, i64 0
  %322 = load i32, i32* %321, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %323 = add i32 %317, %322
  %324 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %325 = load i8*, i8** %324, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %326 = bitcast i8* %325 to i32*
  %327 = getelementptr inbounds i32, i32* %326, i64 0
  store i32 %323, i32* %327, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %328 = load i32, i32* %x1.addr, align 4
  %329 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %330 = load i8*, i8** %329, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %331 = bitcast i8* %330 to i32*
  %332 = getelementptr inbounds i32, i32* %331, i64 1
  %333 = load i32, i32* %332, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %334 = add i32 %328, %333
  %335 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %336 = load i8*, i8** %335, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %337 = bitcast i8* %336 to i32*
  %338 = getelementptr inbounds i32, i32* %337, i64 1
  store i32 %334, i32* %338, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %339 = load i32, i32* %x2.addr, align 4
  %340 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %341 = load i8*, i8** %340, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %342 = bitcast i8* %341 to i32*
  %343 = getelementptr inbounds i32, i32* %342, i64 2
  %344 = load i32, i32* %343, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %345 = add i32 %339, %344
  %346 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %347 = load i8*, i8** %346, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %348 = bitcast i8* %347 to i32*
  %349 = getelementptr inbounds i32, i32* %348, i64 2
  store i32 %345, i32* %349, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %350 = load i32, i32* %x3.addr, align 4
  %351 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %352 = load i8*, i8** %351, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %353 = bitcast i8* %352 to i32*
  %354 = getelementptr inbounds i32, i32* %353, i64 3
  %355 = load i32, i32* %354, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %356 = add i32 %350, %355
  %357 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %358 = load i8*, i8** %357, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %359 = bitcast i8* %358 to i32*
  %360 = getelementptr inbounds i32, i32* %359, i64 3
  store i32 %356, i32* %360, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %361 = load i32, i32* %x4.addr, align 4
  %362 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %363 = load i8*, i8** %362, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %364 = bitcast i8* %363 to i32*
  %365 = getelementptr inbounds i32, i32* %364, i64 4
  %366 = load i32, i32* %365, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %367 = add i32 %361, %366
  %368 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %369 = load i8*, i8** %368, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %370 = bitcast i8* %369 to i32*
  %371 = getelementptr inbounds i32, i32* %370, i64 4
  store i32 %367, i32* %371, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %372 = load i32, i32* %x5.addr, align 4
  %373 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %374 = load i8*, i8** %373, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %375 = bitcast i8* %374 to i32*
  %376 = getelementptr inbounds i32, i32* %375, i64 5
  %377 = load i32, i32* %376, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %378 = add i32 %372, %377
  %379 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %380 = load i8*, i8** %379, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %381 = bitcast i8* %380 to i32*
  %382 = getelementptr inbounds i32, i32* %381, i64 5
  store i32 %378, i32* %382, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %383 = load i32, i32* %x6.addr, align 4
  %384 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %385 = load i8*, i8** %384, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %386 = bitcast i8* %385 to i32*
  %387 = getelementptr inbounds i32, i32* %386, i64 6
  %388 = load i32, i32* %387, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %389 = add i32 %383, %388
  %390 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %391 = load i8*, i8** %390, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %392 = bitcast i8* %391 to i32*
  %393 = getelementptr inbounds i32, i32* %392, i64 6
  store i32 %389, i32* %393, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %394 = load i32, i32* %x7.addr, align 4
  %395 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %396 = load i8*, i8** %395, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %397 = bitcast i8* %396 to i32*
  %398 = getelementptr inbounds i32, i32* %397, i64 7
  %399 = load i32, i32* %398, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %400 = add i32 %394, %399
  %401 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %402 = load i8*, i8** %401, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %403 = bitcast i8* %402 to i32*
  %404 = getelementptr inbounds i32, i32* %403, i64 7
  store i32 %400, i32* %404, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %405 = load i32, i32* %x8.addr, align 4
  %406 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %407 = load i8*, i8** %406, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %408 = bitcast i8* %407 to i32*
  %409 = getelementptr inbounds i32, i32* %408, i64 8
  %410 = load i32, i32* %409, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %411 = add i32 %405, %410
  %412 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %413 = load i8*, i8** %412, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %414 = bitcast i8* %413 to i32*
  %415 = getelementptr inbounds i32, i32* %414, i64 8
  store i32 %411, i32* %415, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %416 = load i32, i32* %x9.addr, align 4
  %417 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %418 = load i8*, i8** %417, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %419 = bitcast i8* %418 to i32*
  %420 = getelementptr inbounds i32, i32* %419, i64 9
  %421 = load i32, i32* %420, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %422 = add i32 %416, %421
  %423 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %424 = load i8*, i8** %423, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %425 = bitcast i8* %424 to i32*
  %426 = getelementptr inbounds i32, i32* %425, i64 9
  store i32 %422, i32* %426, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %427 = load i32, i32* %x10.addr, align 4
  %428 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %429 = load i8*, i8** %428, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %430 = bitcast i8* %429 to i32*
  %431 = getelementptr inbounds i32, i32* %430, i64 10
  %432 = load i32, i32* %431, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %433 = add i32 %427, %432
  %434 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %435 = load i8*, i8** %434, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %436 = bitcast i8* %435 to i32*
  %437 = getelementptr inbounds i32, i32* %436, i64 10
  store i32 %433, i32* %437, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %438 = load i32, i32* %x11.addr, align 4
  %439 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %440 = load i8*, i8** %439, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %441 = bitcast i8* %440 to i32*
  %442 = getelementptr inbounds i32, i32* %441, i64 11
  %443 = load i32, i32* %442, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %444 = add i32 %438, %443
  %445 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %446 = load i8*, i8** %445, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %447 = bitcast i8* %446 to i32*
  %448 = getelementptr inbounds i32, i32* %447, i64 11
  store i32 %444, i32* %448, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %449 = load i32, i32* %x12.addr, align 4
  %450 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %451 = load i8*, i8** %450, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %452 = bitcast i8* %451 to i32*
  %453 = getelementptr inbounds i32, i32* %452, i64 12
  %454 = load i32, i32* %453, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %455 = add i32 %449, %454
  %456 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %457 = load i8*, i8** %456, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %458 = bitcast i8* %457 to i32*
  %459 = getelementptr inbounds i32, i32* %458, i64 12
  store i32 %455, i32* %459, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %460 = load i32, i32* %x13.addr, align 4
  %461 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %462 = load i8*, i8** %461, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %463 = bitcast i8* %462 to i32*
  %464 = getelementptr inbounds i32, i32* %463, i64 13
  %465 = load i32, i32* %464, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %466 = add i32 %460, %465
  %467 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %468 = load i8*, i8** %467, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %469 = bitcast i8* %468 to i32*
  %470 = getelementptr inbounds i32, i32* %469, i64 13
  store i32 %466, i32* %470, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %471 = load i32, i32* %x14.addr, align 4
  %472 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %473 = load i8*, i8** %472, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %474 = bitcast i8* %473 to i32*
  %475 = getelementptr inbounds i32, i32* %474, i64 14
  %476 = load i32, i32* %475, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %477 = add i32 %471, %476
  %478 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %479 = load i8*, i8** %478, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %480 = bitcast i8* %479 to i32*
  %481 = getelementptr inbounds i32, i32* %480, i64 14
  store i32 %477, i32* %481, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %482 = load i32, i32* %x15.addr, align 4
  %483 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %484 = load i8*, i8** %483, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %485 = bitcast i8* %484 to i32*
  %486 = getelementptr inbounds i32, i32* %485, i64 15
  %487 = load i32, i32* %486, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %488 = add i32 %482, %487
  %489 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %490 = load i8*, i8** %489, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %491 = bitcast i8* %490 to i32*
  %492 = getelementptr inbounds i32, i32* %491, i64 15
  store i32 %488, i32* %492, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  ret void
}

define void @ctChacha20XorInto(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %state, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %srcAt, i32 noundef %len, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %dstAt) #3 {
entry:
  %keystream.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %done.addr = alloca i32, align 4
  %take.addr = alloca i32, align 4
  %w.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !18
  %2 = mul i64 16, 4
  %3 = bitcast [16 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %keystream.addr, align 8
  store i32 0, i32* %done.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %state, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = load %struct.nish_array*, %struct.nish_array** %keystream.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %22 = load i32, i32* %done.addr, align 4
  %23 = icmp slt i32 %22, %len
  br i1 %23, label %while.body, label %while.end

while.body:
  %24 = load %struct.nish_array*, %struct.nish_array** %keystream.addr, align 8
  call void @ctChacha20Core(%struct.nish_array* %state, %struct.nish_array* %24)
  %25 = icmp ult i64 12, %6
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 12, i64 %6)
  unreachable

bounds.ok:
  %26 = bitcast i8* %8 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 12
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %29 = add i32 %28, 1
  %30 = bitcast i8* %8 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 12
  store i32 %29, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %32 = load i32, i32* %done.addr, align 4
  %33 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %len, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok

ovf.ok:
  %36 = icmp slt i32 %34, 64
  br i1 %36, label %cond.true, label %cond.false

cond.true:
  %37 = load i32, i32* %done.addr, align 4
  %38 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %len, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %41 = phi i32 [ %39, %ovf.ok.1 ], [ 64, %cond.false ]
  store i32 %41, i32* %take.addr, align 4
  store i32 0, i32* %w.addr, align 4
  %42 = load %struct.nish_array*, %struct.nish_array** %keystream.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %55 = load i32, i32* %w.addr, align 4
  %56 = icmp slt i32 %55, 16
  br i1 %56, label %land.rhs, label %land.end

land.rhs:
  %57 = load i32, i32* %w.addr, align 4
  %58 = trunc i64 %44 to i32
  %59 = icmp slt i32 %57, %58
  br label %land.end

land.end:
  %60 = phi i1 [ false, %for.cond ], [ %59, %land.rhs ]
  br i1 %60, label %for.body, label %for.end

for.body:
  %61 = load i32, i32* %w.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = bitcast i8* %46 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %62
  %65 = load i32, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %65, i32* %word.addr, align 4
  %66 = load i32, i32* %done.addr, align 4
  %67 = load i32, i32* %w.addr, align 4
  %68 = mul nsw i32 4, %67
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %70, i32* %at.addr, align 4
  %72 = load i32, i32* %at.addr, align 4
  %73 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %72, i32 4)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %76 = load i32, i32* %done.addr, align 4
  %77 = load i32, i32* %take.addr, align 4
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %76, i32 %77)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %81 = icmp sle i32 %74, %79
  br i1 %81, label %if.then, label %if.else

if.then:
  %82 = load i32, i32* %at.addr, align 4
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %dstAt, i32 %82)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %86 = sext i32 %84 to i64
  %87 = load i32, i32* %at.addr, align 4
  %88 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %srcAt, i32 %87)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %91 = sext i32 %89 to i64
  %92 = icmp ult i64 %91, %52
  br i1 %92, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %91, i64 %52)
  unreachable

bounds.ok.1:
  %93 = bitcast i8* %54 to i8*
  %94 = getelementptr inbounds i8, i8* %93, i64 %91
  %95 = load i8, i8* %94, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %96 = load i32, i32* %word.addr, align 4
  %97 = trunc i32 %96 to i8
  %98 = xor i8 %95, %97
  %99 = icmp ult i64 %86, %48
  br i1 %99, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %86, i64 %48)
  unreachable

bounds.ok.2:
  %100 = bitcast i8* %50 to i8*
  %101 = getelementptr inbounds i8, i8* %100, i64 %86
  store i8 %98, i8* %101, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %102 = load i32, i32* %at.addr, align 4
  %103 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %dstAt, i32 %102)
  %104 = extractvalue { i32, i1 } %103, 0
  %105 = extractvalue { i32, i1 } %103, 1
  br i1 %105, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %106 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %104, i32 1)
  %107 = extractvalue { i32, i1 } %106, 0
  %108 = extractvalue { i32, i1 } %106, 1
  br i1 %108, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %109 = sext i32 %107 to i64
  %110 = load i32, i32* %at.addr, align 4
  %111 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %srcAt, i32 %110)
  %112 = extractvalue { i32, i1 } %111, 0
  %113 = extractvalue { i32, i1 } %111, 1
  br i1 %113, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %114 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %112, i32 1)
  %115 = extractvalue { i32, i1 } %114, 0
  %116 = extractvalue { i32, i1 } %114, 1
  br i1 %116, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %117 = sext i32 %115 to i64
  %118 = icmp ult i64 %117, %52
  br i1 %118, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %117, i64 %52)
  unreachable

bounds.ok.3:
  %119 = bitcast i8* %54 to i8*
  %120 = getelementptr inbounds i8, i8* %119, i64 %117
  %121 = load i8, i8* %120, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %122 = load i32, i32* %word.addr, align 4
  %123 = lshr i32 %122, 8
  %124 = trunc i32 %123 to i8
  %125 = xor i8 %121, %124
  %126 = icmp ult i64 %109, %48
  br i1 %126, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %109, i64 %48)
  unreachable

bounds.ok.4:
  %127 = bitcast i8* %50 to i8*
  %128 = getelementptr inbounds i8, i8* %127, i64 %109
  store i8 %125, i8* %128, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %129 = load i32, i32* %at.addr, align 4
  %130 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %dstAt, i32 %129)
  %131 = extractvalue { i32, i1 } %130, 0
  %132 = extractvalue { i32, i1 } %130, 1
  br i1 %132, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  %133 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %131, i32 2)
  %134 = extractvalue { i32, i1 } %133, 0
  %135 = extractvalue { i32, i1 } %133, 1
  br i1 %135, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  %136 = sext i32 %134 to i64
  %137 = load i32, i32* %at.addr, align 4
  %138 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %srcAt, i32 %137)
  %139 = extractvalue { i32, i1 } %138, 0
  %140 = extractvalue { i32, i1 } %138, 1
  br i1 %140, label %ovf.fail, label %ovf.ok.13

ovf.ok.13:
  %141 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %139, i32 2)
  %142 = extractvalue { i32, i1 } %141, 0
  %143 = extractvalue { i32, i1 } %141, 1
  br i1 %143, label %ovf.fail, label %ovf.ok.14

ovf.ok.14:
  %144 = sext i32 %142 to i64
  %145 = icmp ult i64 %144, %52
  br i1 %145, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %144, i64 %52)
  unreachable

bounds.ok.5:
  %146 = bitcast i8* %54 to i8*
  %147 = getelementptr inbounds i8, i8* %146, i64 %144
  %148 = load i8, i8* %147, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %149 = load i32, i32* %word.addr, align 4
  %150 = lshr i32 %149, 16
  %151 = trunc i32 %150 to i8
  %152 = xor i8 %148, %151
  %153 = icmp ult i64 %136, %48
  br i1 %153, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %136, i64 %48)
  unreachable

bounds.ok.6:
  %154 = bitcast i8* %50 to i8*
  %155 = getelementptr inbounds i8, i8* %154, i64 %136
  store i8 %152, i8* %155, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %156 = load i32, i32* %at.addr, align 4
  %157 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %dstAt, i32 %156)
  %158 = extractvalue { i32, i1 } %157, 0
  %159 = extractvalue { i32, i1 } %157, 1
  br i1 %159, label %ovf.fail, label %ovf.ok.15

ovf.ok.15:
  %160 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %158, i32 3)
  %161 = extractvalue { i32, i1 } %160, 0
  %162 = extractvalue { i32, i1 } %160, 1
  br i1 %162, label %ovf.fail, label %ovf.ok.16

ovf.ok.16:
  %163 = sext i32 %161 to i64
  %164 = load i32, i32* %at.addr, align 4
  %165 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %srcAt, i32 %164)
  %166 = extractvalue { i32, i1 } %165, 0
  %167 = extractvalue { i32, i1 } %165, 1
  br i1 %167, label %ovf.fail, label %ovf.ok.17

ovf.ok.17:
  %168 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %166, i32 3)
  %169 = extractvalue { i32, i1 } %168, 0
  %170 = extractvalue { i32, i1 } %168, 1
  br i1 %170, label %ovf.fail, label %ovf.ok.18

ovf.ok.18:
  %171 = sext i32 %169 to i64
  %172 = icmp ult i64 %171, %52
  br i1 %172, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 %171, i64 %52)
  unreachable

bounds.ok.7:
  %173 = bitcast i8* %54 to i8*
  %174 = getelementptr inbounds i8, i8* %173, i64 %171
  %175 = load i8, i8* %174, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %176 = load i32, i32* %word.addr, align 4
  %177 = lshr i32 %176, 24
  %178 = trunc i32 %177 to i8
  %179 = xor i8 %175, %178
  %180 = icmp ult i64 %163, %48
  br i1 %180, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 %163, i64 %48)
  unreachable

bounds.ok.8:
  %181 = bitcast i8* %50 to i8*
  %182 = getelementptr inbounds i8, i8* %181, i64 %163
  store i8 %179, i8* %182, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  br label %if.end

if.else:
  store i32 0, i32* %k.addr, align 4
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %184 = load i64, i64* %183, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %188 = load i64, i64* %187, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %189 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %190 = load i8*, i8** %189, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond.1

for.cond.1:
  %191 = load i32, i32* %at.addr, align 4
  %192 = load i32, i32* %k.addr, align 4
  %193 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %191, i32 %192)
  %194 = extractvalue { i32, i1 } %193, 0
  %195 = extractvalue { i32, i1 } %193, 1
  br i1 %195, label %ovf.fail, label %ovf.ok.19

ovf.ok.19:
  %196 = load i32, i32* %done.addr, align 4
  %197 = load i32, i32* %take.addr, align 4
  %198 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %196, i32 %197)
  %199 = extractvalue { i32, i1 } %198, 0
  %200 = extractvalue { i32, i1 } %198, 1
  br i1 %200, label %ovf.fail, label %ovf.ok.20

ovf.ok.20:
  %201 = icmp slt i32 %194, %199
  br i1 %201, label %for.body.1, label %for.end.1

for.body.1:
  %202 = load i32, i32* %at.addr, align 4
  %203 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %dstAt, i32 %202)
  %204 = extractvalue { i32, i1 } %203, 0
  %205 = extractvalue { i32, i1 } %203, 1
  br i1 %205, label %ovf.fail, label %ovf.ok.21

ovf.ok.21:
  %206 = load i32, i32* %k.addr, align 4
  %207 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %204, i32 %206)
  %208 = extractvalue { i32, i1 } %207, 0
  %209 = extractvalue { i32, i1 } %207, 1
  br i1 %209, label %ovf.fail, label %ovf.ok.22

ovf.ok.22:
  %210 = sext i32 %208 to i64
  %211 = load i32, i32* %at.addr, align 4
  %212 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %srcAt, i32 %211)
  %213 = extractvalue { i32, i1 } %212, 0
  %214 = extractvalue { i32, i1 } %212, 1
  br i1 %214, label %ovf.fail, label %ovf.ok.23

ovf.ok.23:
  %215 = load i32, i32* %k.addr, align 4
  %216 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %213, i32 %215)
  %217 = extractvalue { i32, i1 } %216, 0
  %218 = extractvalue { i32, i1 } %216, 1
  br i1 %218, label %ovf.fail, label %ovf.ok.24

ovf.ok.24:
  %219 = sext i32 %217 to i64
  %220 = icmp ult i64 %219, %188
  br i1 %220, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 %219, i64 %188)
  unreachable

bounds.ok.9:
  %221 = bitcast i8* %190 to i8*
  %222 = getelementptr inbounds i8, i8* %221, i64 %219
  %223 = load i8, i8* %222, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %224 = load i32, i32* %word.addr, align 4
  %225 = load i32, i32* %k.addr, align 4
  %226 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 8, i32 %225)
  %227 = extractvalue { i32, i1 } %226, 0
  %228 = extractvalue { i32, i1 } %226, 1
  br i1 %228, label %ovf.fail, label %ovf.ok.25

ovf.ok.25:
  %229 = and i32 %227, 31
  %230 = lshr i32 %224, %229
  %231 = trunc i32 %230 to i8
  %232 = xor i8 %223, %231
  %233 = icmp ult i64 %210, %184
  br i1 %233, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 %210, i64 %184)
  unreachable

bounds.ok.10:
  %234 = bitcast i8* %186 to i8*
  %235 = getelementptr inbounds i8, i8* %234, i64 %210
  store i8 %232, i8* %235, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc.1

for.inc.1:
  %236 = load i32, i32* %k.addr, align 4
  %237 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %236, i32 1)
  %238 = extractvalue { i32, i1 } %237, 0
  %239 = extractvalue { i32, i1 } %237, 1
  br i1 %239, label %ovf.fail, label %ovf.ok.26

ovf.ok.26:
  store i32 %238, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %240 = load i32, i32* %w.addr, align 4
  %241 = add nsw i32 %240, 1
  store i32 %241, i32* %w.addr, align 4
  br label %for.cond

for.end:
  %242 = load i32, i32* %done.addr, align 4
  %243 = load i32, i32* %take.addr, align 4
  %244 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %242, i32 %243)
  %245 = extractvalue { i32, i1 } %244, 0
  %246 = extractvalue { i32, i1 } %244, 1
  br i1 %246, label %ovf.fail, label %ovf.ok.27

ovf.ok.27:
  store i32 %245, i32* %done.addr, align 4
  br label %while.cond

while.end:
  %247 = load %struct.nish_array*, %struct.nish_array** %keystream.addr, align 8
  call void @nish.wipe$arr.u32(%struct.nish_array* %247)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 1, %bounds.ok ], [ 1, %cond.true ], [ 0, %for.body ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 0, %if.then ], [ 0, %ovf.ok.5 ], [ 0, %bounds.ok.2 ], [ 0, %ovf.ok.7 ], [ 0, %ovf.ok.8 ], [ 0, %ovf.ok.9 ], [ 0, %bounds.ok.4 ], [ 0, %ovf.ok.11 ], [ 0, %ovf.ok.12 ], [ 0, %ovf.ok.13 ], [ 0, %bounds.ok.6 ], [ 0, %ovf.ok.15 ], [ 0, %ovf.ok.16 ], [ 0, %ovf.ok.17 ], [ 0, %for.cond.1 ], [ 0, %ovf.ok.19 ], [ 0, %for.body.1 ], [ 0, %ovf.ok.21 ], [ 0, %ovf.ok.22 ], [ 0, %ovf.ok.23 ], [ 2, %bounds.ok.9 ], [ 0, %for.inc.1 ], [ 0, %for.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @ctPoly1305AbsorbWhole(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %r, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %at, i32 noundef %len) #3 {
entry:
  %whole.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = ashr i32 %len, 4
  store i32 %0, i32* %whole.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = load i32, i32* %whole.addr, align 4
  %3 = icmp slt i32 %1, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %i.addr, align 4
  %5 = mul nsw i32 16, %4
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = sext i32 16777216 to i64
  call void @ctPoly1305Block(%struct.nish_array* %h, %struct.nish_array* %r, %struct.nish_array* %buf, i32 %7, i64 %9)
  br label %for.inc

for.inc:
  %10 = load i32, i32* %i.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @ctChacha20XorIntoToZero(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %keystream, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst) #3 {
entry:
  %w.addr = alloca i32, align 4
  store i32 0, i32* %w.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keystream, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %4 = load i32, i32* %w.addr, align 4
  %5 = icmp slt i32 %4, 16
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %w.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = bitcast i8* %1 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %7
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %11 = icmp ne i32 %10, 0
  br label %land.end

land.end:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %w.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = load i32, i32* %w.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %1 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %16
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %20 = trunc i32 %19 to i8
  %21 = bitcast i8* %3 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %14
  store i8 %20, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  br label %for.inc

for.inc:
  %23 = load i32, i32* %w.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %w.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @ctChacha20SboxStream(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %keystream, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst) #1 {
entry:
  %carry.addr = alloca i8, align 1
  %i.addr = alloca i32, align 4
  store i8 0, i8* %carry.addr, align 1
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keystream, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 16
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = load i8, i8* %carry.addr, align 1
  %11 = bitcast i8* %1 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %9
  store i8 %10, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %5 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %18 = zext i8 %17 to i32
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %3 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %19
  %22 = load i8, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  store i8 %22, i8* %carry.addr, align 1
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.wipe$arr.u32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %_target) #3 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 1
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 2
  %3 = load i8*, i8** %2, align 8
  %4 = mul i64 %1, 4
  call void @llvm.memset.p0i8.i64(i8* %3, i8 0, i64 %4, i1 true)
  ret void
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
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
!11 = !{!"element i8", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!"element i64", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!9, !7, i64 0}
!16 = !{!"element i32", !6, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!9, !7, i64 8}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
