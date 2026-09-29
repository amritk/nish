%struct.nish_array = type { i64, i64, i8* }

define internal noundef i32 @ctChacha20Word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %at) #0 {
entry:
  %0 = sext i32 %at to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = zext i8 %5 to i32
  %7 = add nsw i32 %at, 1
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %8
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = zext i8 %13 to i32
  %15 = shl i32 %14, 8
  %16 = or i32 %6, %15
  %17 = add nsw i32 %at, 2
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %18
  %23 = load i8, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %24 = zext i8 %23 to i32
  %25 = shl i32 %24, 16
  %26 = or i32 %16, %25
  %27 = add nsw i32 %at, 3
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
  %7 = add nsw i32 %at, 1
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %8
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = zext i8 %13 to i64
  %15 = shl i64 %14, 8
  %16 = or i64 %6, %15
  %17 = add nsw i32 %at, 2
  %18 = sext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %18
  %23 = load i8, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %24 = zext i8 %23 to i64
  %25 = shl i64 %24, 16
  %26 = or i64 %16, %25
  %27 = add nsw i32 %at, 3
  %28 = sext i32 %27 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = bitcast i8* %30 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %28
  %33 = load i8, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %34 = zext i8 %33 to i64
  %35 = shl i64 %34, 24
  %36 = or i64 %26, %35
  %37 = add nsw i32 %at, 4
  %38 = sext i32 %37 to i64
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 %38
  %43 = load i8, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %44 = zext i8 %43 to i64
  %45 = shl i64 %44, 32
  %46 = or i64 %36, %45
  %47 = add nsw i32 %at, 5
  %48 = sext i32 %47 to i64
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = bitcast i8* %50 to i8*
  %52 = getelementptr inbounds i8, i8* %51, i64 %48
  %53 = load i8, i8* %52, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %54 = zext i8 %53 to i64
  %55 = shl i64 %54, 40
  %56 = or i64 %46, %55
  %57 = add nsw i32 %at, 6
  %58 = sext i32 %57 to i64
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = bitcast i8* %60 to i8*
  %62 = getelementptr inbounds i8, i8* %61, i64 %58
  %63 = load i8, i8* %62, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  %64 = zext i8 %63 to i64
  %65 = shl i64 %64, 48
  %66 = or i64 %56, %65
  %67 = add nsw i32 %at, 7
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
  %1 = add nsw i32 %at, 8
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
  %18 = add nsw i32 %at, 1
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
  %33 = add nsw i32 %at, 2
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
  %48 = add nsw i32 %at, 3
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
  %63 = add nsw i32 %at, 4
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
  %78 = add nsw i32 %at, 5
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
  %93 = add nsw i32 %at, 6
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
  %108 = add nsw i32 %at, 7
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
  %123 = add nsw i32 %at, 8
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
  %138 = add nsw i32 %at, 9
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
  %153 = add nsw i32 %at, 10
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
  %168 = add nsw i32 %at, 11
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
  %183 = add nsw i32 %at, 12
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
  %198 = add nsw i32 %at, 13
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
  %213 = add nsw i32 %at, 14
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
  %228 = add nsw i32 %at, 15
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

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }

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
