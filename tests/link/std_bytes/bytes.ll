%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #1

define noundef i16 @nish.getU16LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = zext i8 %8 to i16
  %10 = add nsw i32 %off, 1
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok.1:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %16 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %11
  %19 = load i8, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = zext i8 %19 to i16
  %21 = shl i16 %20, 8
  %22 = or i16 %9, %21
  ret i16 %22
}

define noundef i16 @nish.getU16BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = zext i8 %8 to i16
  %10 = shl i16 %9, 8
  %11 = add nsw i32 %off, 1
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %12
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = zext i8 %20 to i16
  %22 = or i16 %10, %21
  ret i16 %22
}

define noundef i32 @nish.getU32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = zext i8 %8 to i32
  %10 = add nsw i32 %off, 1
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok.1:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %16 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %11
  %19 = load i8, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = zext i8 %19 to i32
  %21 = shl i32 %20, 8
  %22 = or i32 %9, %21
  %23 = add nsw i32 %off, 2
  %24 = sext i32 %23 to i64
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %24, i64 %26)
  unreachable

bounds.ok.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %29 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 %24
  %32 = load i8, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %33 = zext i8 %32 to i32
  %34 = shl i32 %33, 16
  %35 = or i32 %22, %34
  %36 = add nsw i32 %off, 3
  %37 = sext i32 %36 to i64
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = icmp ult i64 %37, %39
  br i1 %40, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %37, i64 %39)
  unreachable

bounds.ok.3:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = bitcast i8* %42 to i8*
  %44 = getelementptr inbounds i8, i8* %43, i64 %37
  %45 = load i8, i8* %44, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %46 = zext i8 %45 to i32
  %47 = mul i32 %46, 16777216
  %48 = add i32 %35, %47
  ret i32 %48
}

define noundef i32 @nish.getU32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = zext i8 %8 to i32
  %10 = mul i32 %9, 16777216
  %11 = add nsw i32 %off, 1
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %12
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = zext i8 %20 to i32
  %22 = shl i32 %21, 16
  %23 = add nsw i32 %off, 2
  %24 = sext i32 %23 to i64
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = icmp ult i64 %24, %26
  br i1 %27, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %24, i64 %26)
  unreachable

bounds.ok.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %29 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 %24
  %32 = load i8, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %33 = zext i8 %32 to i32
  %34 = shl i32 %33, 8
  %35 = or i32 %22, %34
  %36 = add nsw i32 %off, 3
  %37 = sext i32 %36 to i64
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = icmp ult i64 %37, %39
  br i1 %40, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %37, i64 %39)
  unreachable

bounds.ok.3:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = bitcast i8* %42 to i8*
  %44 = getelementptr inbounds i8, i8* %43, i64 %37
  %45 = load i8, i8* %44, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %46 = zext i8 %45 to i32
  %47 = or i32 %35, %46
  %48 = add i32 %10, %47
  ret i32 %48
}

define noundef i64 @nish.getU64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %v.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 0 to i64
  store i64 %0, i64* %v.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 8
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i64, i64* %v.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %off, %8
  %10 = sext i32 %9 to i64
  %11 = icmp ult i64 %10, %2
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %2)
  unreachable

bounds.ok:
  %12 = bitcast i8* %4 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 %10
  %14 = load i8, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = zext i8 %14 to i64
  %16 = load i32, i32* %i.addr, align 4
  %17 = mul nsw i32 %16, 8
  %18 = sext i32 %17 to i64
  %19 = and i64 %18, 63
  %20 = shl i64 %15, %19
  %21 = or i64 %7, %20
  store i64 %21, i64* %v.addr, align 8
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i64, i64* %v.addr, align 8
  ret i64 %24
}

define noundef i64 @nish.getU64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %v.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 0 to i64
  store i64 %0, i64* %v.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 8
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i64, i64* %v.addr, align 8
  %8 = sext i32 8 to i64
  %9 = and i64 %8, 63
  %10 = shl i64 %7, %9
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %off, %11
  %13 = sext i32 %12 to i64
  %14 = icmp ult i64 %13, %2
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %13, i64 %2)
  unreachable

bounds.ok:
  %15 = bitcast i8* %4 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %13
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = zext i8 %17 to i64
  %19 = or i64 %10, %18
  store i64 %19, i64* %v.addr, align 8
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i64, i64* %v.addr, align 8
  ret i64 %22
}

define noundef i32 @nish.getI32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = call i32 @nish.getU32LE(%struct.nish_array* %b, i32 %off)
  ret i32 %0
}

define noundef i32 @nish.getI32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = call i32 @nish.getU32BE(%struct.nish_array* %b, i32 %off)
  ret i32 %0
}

define noundef i64 @nish.getI64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = call i64 @nish.getU64LE(%struct.nish_array* %b, i32 %off)
  ret i64 %0
}

define noundef i64 @nish.getI64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = call i64 @nish.getU64BE(%struct.nish_array* %b, i32 %off)
  ret i64 %0
}

define noundef double @nish.getF64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = call i64 @nish.getU64LE(%struct.nish_array* %b, i32 %off)
  %1 = bitcast i64 %0 to double
  ret double %1
}

define noundef double @nish.getF64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = call i64 @nish.getU64BE(%struct.nish_array* %b, i32 %off)
  %1 = bitcast i64 %0 to double
  ret double %1
}

define void @nish.setU16LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i16 noundef %v) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = and i16 %v, 255
  %2 = trunc i16 %1 to i8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %0, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i8*
  %9 = getelementptr inbounds i8, i8* %8, i64 %0
  store i8 %2, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = add nsw i32 %off, 1
  %11 = sext i32 %10 to i64
  %12 = lshr i16 %v, 8
  %13 = and i16 %12, 255
  %14 = trunc i16 %13 to i8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %11, %16
  br i1 %17, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %11, i64 %16)
  unreachable

bounds.ok.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %11
  store i8 %14, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

define void @nish.setU16BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i16 noundef %v) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = lshr i16 %v, 8
  %2 = and i16 %1, 255
  %3 = trunc i16 %2 to i8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %0
  store i8 %3, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = add nsw i32 %off, 1
  %12 = sext i32 %11 to i64
  %13 = and i16 %v, 255
  %14 = trunc i16 %13 to i8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %12, %16
  br i1 %17, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %12, i64 %16)
  unreachable

bounds.ok.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %12
  store i8 %14, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

define void @nish.setU32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = and i32 %v, 255
  %2 = trunc i32 %1 to i8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %0, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i8*
  %9 = getelementptr inbounds i8, i8* %8, i64 %0
  store i8 %2, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = add nsw i32 %off, 1
  %11 = sext i32 %10 to i64
  %12 = lshr i32 %v, 8
  %13 = and i32 %12, 255
  %14 = trunc i32 %13 to i8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %11, %16
  br i1 %17, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %11, i64 %16)
  unreachable

bounds.ok.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %11
  store i8 %14, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = add nsw i32 %off, 2
  %23 = sext i32 %22 to i64
  %24 = lshr i32 %v, 16
  %25 = and i32 %24, 255
  %26 = trunc i32 %25 to i8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = icmp ult i64 %23, %28
  br i1 %29, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %23, i64 %28)
  unreachable

bounds.ok.2:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = bitcast i8* %31 to i8*
  %33 = getelementptr inbounds i8, i8* %32, i64 %23
  store i8 %26, i8* %33, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %34 = add nsw i32 %off, 3
  %35 = sext i32 %34 to i64
  %36 = lshr i32 %v, 24
  %37 = and i32 %36, 255
  %38 = trunc i32 %37 to i8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = icmp ult i64 %35, %40
  br i1 %41, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %35, i64 %40)
  unreachable

bounds.ok.3:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = bitcast i8* %43 to i8*
  %45 = getelementptr inbounds i8, i8* %44, i64 %35
  store i8 %38, i8* %45, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

define void @nish.setU32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %off to i64
  %1 = lshr i32 %v, 24
  %2 = and i32 %1, 255
  %3 = trunc i32 %2 to i8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %0
  store i8 %3, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = add nsw i32 %off, 1
  %12 = sext i32 %11 to i64
  %13 = lshr i32 %v, 16
  %14 = and i32 %13, 255
  %15 = trunc i32 %14 to i8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 %12, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %12, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %12
  store i8 %15, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = add nsw i32 %off, 2
  %24 = sext i32 %23 to i64
  %25 = lshr i32 %v, 8
  %26 = and i32 %25, 255
  %27 = trunc i32 %26 to i8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 %24, %29
  br i1 %30, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %24, i64 %29)
  unreachable

bounds.ok.2:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = bitcast i8* %32 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 %24
  store i8 %27, i8* %34, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %35 = add nsw i32 %off, 3
  %36 = sext i32 %35 to i64
  %37 = and i32 %v, 255
  %38 = trunc i32 %37 to i8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = icmp ult i64 %36, %40
  br i1 %41, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %36, i64 %40)
  unreachable

bounds.ok.3:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = bitcast i8* %43 to i8*
  %45 = getelementptr inbounds i8, i8* %44, i64 %36
  store i8 %38, i8* %45, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

define void @nish.setU64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i64 noundef %v) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 8
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %off, %6
  %8 = sext i32 %7 to i64
  %9 = load i32, i32* %i.addr, align 4
  %10 = mul nsw i32 %9, 8
  %11 = sext i32 %10 to i64
  %12 = and i64 %11, 63
  %13 = lshr i64 %v, %12
  %14 = sext i32 255 to i64
  %15 = and i64 %13, %14
  %16 = trunc i64 %15 to i8
  %17 = icmp ult i64 %8, %1
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %1)
  unreachable

bounds.ok:
  %18 = bitcast i8* %3 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %8
  store i8 %16, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @nish.setU64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i64 noundef %v) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, 8
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %off, %6
  %8 = sext i32 %7 to i64
  %9 = load i32, i32* %i.addr, align 4
  %10 = sub nsw i32 7, %9
  %11 = mul nsw i32 %10, 8
  %12 = sext i32 %11 to i64
  %13 = and i64 %12, 63
  %14 = lshr i64 %v, %13
  %15 = sext i32 255 to i64
  %16 = and i64 %14, %15
  %17 = trunc i64 %16 to i8
  %18 = icmp ult i64 %8, %1
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %1)
  unreachable

bounds.ok:
  %19 = bitcast i8* %3 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 %8
  store i8 %17, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @nish.setI32LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i32 noundef %v) #0 {
entry:
  call void @nish.setU32LE(%struct.nish_array* %b, i32 %off, i32 %v)
  ret void
}

define void @nish.setI32BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i32 noundef %v) #0 {
entry:
  call void @nish.setU32BE(%struct.nish_array* %b, i32 %off, i32 %v)
  ret void
}

define void @nish.setI64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i64 noundef %v) #0 {
entry:
  call void @nish.setU64LE(%struct.nish_array* %b, i32 %off, i64 %v)
  ret void
}

define void @nish.setI64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, i64 noundef %v) #0 {
entry:
  call void @nish.setU64BE(%struct.nish_array* %b, i32 %off, i64 %v)
  ret void
}

define void @nish.setF64LE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, double noundef %v) #0 {
entry:
  %0 = bitcast double %v to i64
  call void @nish.setU64LE(%struct.nish_array* %b, i32 %off, i64 %0)
  ret void
}

define void @nish.setF64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b, i32 noundef %off, double noundef %v) #0 {
entry:
  %0 = bitcast double %v to i64
  call void @nish.setU64BE(%struct.nish_array* %b, i32 %off, i64 %0)
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

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
