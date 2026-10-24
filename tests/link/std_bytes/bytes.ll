%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"copyBytes: the range lies outside an array\00" }, align 8

declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare i64 @nish_bytes_skip_blank(i8* noundef readonly nocapture, i64 noundef, i64 noundef) #4
declare i64 @nish_bytes_skip_digits(i8* noundef readonly nocapture, i64 noundef, i64 noundef) #4
declare i64 @nish_bytes_skip_json_text(i8* noundef readonly nocapture, i64 noundef, i64 noundef) #4
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2

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

define internal noundef i32 @nish.bytesRunEnd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %to) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = icmp slt i32 %to, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %to, %4
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %6 = load i32, i32* %n.addr, align 4
  br label %cond.end

cond.end:
  %7 = phi i32 [ %to, %cond.true ], [ %6, %cond.false ]
  ret i32 %7
}

define internal noundef i32 @nish.bytesRunStart(i32 noundef %from, i32 noundef %end) #2 {
entry:
  %0 = icmp slt i32 %from, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp slt i32 %from, %end
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %from, %cond.true ], [ %end, %cond.false ]
  ret i32 %2
}

define noundef i32 @nish.skipBlank(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #3 {
entry:
  %end.addr = alloca i32, align 4
  %0 = call i32 @nish.bytesRunEnd(%struct.nish_array* %b, i32 %to)
  store i32 %0, i32* %end.addr, align 4
  %1 = load i32, i32* %end.addr, align 4
  %2 = call i32 @nish.bytesRunStart(i32 %from, i32 %1)
  %3 = load i32, i32* %end.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = sext i32 %2 to i64
  %7 = sext i32 %3 to i64
  %8 = call i64 @nish_bytes_skip_blank(i8* %5, i64 %6, i64 %7)
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define noundef i32 @nish.skipDigits(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #3 {
entry:
  %end.addr = alloca i32, align 4
  %0 = call i32 @nish.bytesRunEnd(%struct.nish_array* %b, i32 %to)
  store i32 %0, i32* %end.addr, align 4
  %1 = load i32, i32* %end.addr, align 4
  %2 = call i32 @nish.bytesRunStart(i32 %from, i32 %1)
  %3 = load i32, i32* %end.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = sext i32 %2 to i64
  %7 = sext i32 %3 to i64
  %8 = call i64 @nish_bytes_skip_digits(i8* %5, i64 %6, i64 %7)
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define noundef i32 @nish.skipJsonText(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #0 {
entry:
  %end.addr = alloca i32, align 4
  %0 = call i32 @nish.bytesRunEnd(%struct.nish_array* %b, i32 %to)
  store i32 %0, i32* %end.addr, align 4
  %1 = load i32, i32* %end.addr, align 4
  %2 = call i32 @nish.bytesRunStart(i32 %from, i32 %1)
  %3 = load i32, i32* %end.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = sext i32 %2 to i64
  %7 = sext i32 %3 to i64
  %8 = call i64 @nish_bytes_skip_json_text(i8* %5, i64 %6, i64 %7)
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define void @nish.copyBytes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %from, i32 noundef %count) #0 {
entry:
  %0 = icmp slt i32 %count, 0
  br i1 %0, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %1 = icmp slt i32 %at, 0
  br label %lor.end.3

lor.end.3:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.3 ]
  br i1 %2, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %3 = icmp slt i32 %from, 0
  br label %lor.end.2

lor.end.2:
  %4 = phi i1 [ true, %lor.end.3 ], [ %3, %lor.rhs.2 ]
  br i1 %4, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  %8 = sub nsw i32 %7, %count
  %9 = icmp sgt i32 %at, %8
  br label %lor.end.1

lor.end.1:
  %10 = phi i1 [ true, %lor.end.2 ], [ %9, %lor.rhs.1 ]
  br i1 %10, label %lor.end, label %lor.rhs

lor.rhs:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = trunc i64 %12 to i32
  %14 = sub nsw i32 %13, %count
  %15 = icmp sgt i32 %from, %14
  br label %lor.end

lor.end:
  %16 = phi i1 [ true, %lor.end.1 ], [ %15, %lor.rhs ]
  br i1 %16, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*))
  unreachable

if.end:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = sext i32 %at to i64
  %20 = getelementptr inbounds i8, i8* %18, i64 %19
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = sext i32 %from to i64
  %24 = getelementptr inbounds i8, i8* %22, i64 %23
  %25 = sext i32 %count to i64
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %20, i8* %24, i64 %25, i1 false), !alias.scope !4, !noalias !3
  ret void
}

define internal noundef i32 @nish.skipBlankWalk(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #3 {
entry:
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %to
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %while.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %3 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = zext i8 %17 to i32
  store i32 %18, i32* %c.addr, align 4
  %19 = load i32, i32* %c.addr, align 4
  %20 = icmp ne i32 %19, 32
  br i1 %20, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %21 = load i32, i32* %c.addr, align 4
  %22 = icmp ne i32 %21, 9
  br label %land.end.4

land.end.4:
  %23 = phi i1 [ false, %while.body ], [ %22, %land.rhs.4 ]
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %c.addr, align 4
  %25 = icmp ne i32 %24, 10
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %land.end.4 ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %c.addr, align 4
  %28 = icmp ne i32 %27, 13
  br label %land.end.2

land.end.2:
  %29 = phi i1 [ false, %land.end.3 ], [ %28, %land.rhs.2 ]
  br i1 %29, label %if.then, label %if.end

if.then:
  %30 = load i32, i32* %i.addr, align 4
  ret i32 %30

if.end:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %33 = load i32, i32* %i.addr, align 4
  ret i32 %33
}

define internal noundef i32 @nish.skipDigitsWalk(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #3 {
entry:
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %to
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %while.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %3 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = zext i8 %17 to i32
  store i32 %18, i32* %c.addr, align 4
  %19 = load i32, i32* %c.addr, align 4
  %20 = icmp slt i32 %19, 48
  br i1 %20, label %lor.end, label %lor.rhs

lor.rhs:
  %21 = load i32, i32* %c.addr, align 4
  %22 = icmp sgt i32 %21, 57
  br label %lor.end

lor.end:
  %23 = phi i1 [ true, %while.body ], [ %22, %lor.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = load i32, i32* %i.addr, align 4
  ret i32 %24

if.end:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %27 = load i32, i32* %i.addr, align 4
  ret i32 %27
}

define internal noundef i32 @nish.bytesUtf8Length(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %i, i32 noundef %to) #0 {
entry:
  %lead.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %high.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %second.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
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
  store i32 %9, i32* %lead.addr, align 4
  store i32 128, i32* %low.addr, align 4
  store i32 191, i32* %high.addr, align 4
  store i32 0, i32* %n.addr, align 4
  %10 = load i32, i32* %lead.addr, align 4
  %11 = icmp sge i32 %10, 194
  br i1 %11, label %land.rhs, label %land.end

land.rhs:
  %12 = load i32, i32* %lead.addr, align 4
  %13 = icmp sle i32 %12, 223
  br label %land.end

land.end:
  %14 = phi i1 [ false, %bounds.ok ], [ %13, %land.rhs ]
  br i1 %14, label %if.then, label %if.else

if.then:
  store i32 2, i32* %n.addr, align 4
  br label %if.end

if.else:
  %15 = load i32, i32* %lead.addr, align 4
  %16 = icmp sge i32 %15, 224
  br i1 %16, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %17 = load i32, i32* %lead.addr, align 4
  %18 = icmp sle i32 %17, 239
  br label %land.end.1

land.end.1:
  %19 = phi i1 [ false, %if.else ], [ %18, %land.rhs.1 ]
  br i1 %19, label %if.then.1, label %if.else.1

if.then.1:
  store i32 3, i32* %n.addr, align 4
  %20 = load i32, i32* %lead.addr, align 4
  %21 = icmp eq i32 %20, 224
  br i1 %21, label %if.then.2, label %if.end.2

if.then.2:
  store i32 160, i32* %low.addr, align 4
  br label %if.end.2

if.end.2:
  %22 = load i32, i32* %lead.addr, align 4
  %23 = icmp eq i32 %22, 237
  br i1 %23, label %if.then.3, label %if.end.3

if.then.3:
  store i32 159, i32* %high.addr, align 4
  br label %if.end.3

if.end.3:
  br label %if.end.1

if.else.1:
  %24 = load i32, i32* %lead.addr, align 4
  %25 = icmp sge i32 %24, 240
  br i1 %25, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %26 = load i32, i32* %lead.addr, align 4
  %27 = icmp sle i32 %26, 244
  br label %land.end.2

land.end.2:
  %28 = phi i1 [ false, %if.else.1 ], [ %27, %land.rhs.2 ]
  br i1 %28, label %if.then.4, label %if.else.2

if.then.4:
  store i32 4, i32* %n.addr, align 4
  %29 = load i32, i32* %lead.addr, align 4
  %30 = icmp eq i32 %29, 240
  br i1 %30, label %if.then.5, label %if.end.5

if.then.5:
  store i32 144, i32* %low.addr, align 4
  br label %if.end.5

if.end.5:
  %31 = load i32, i32* %lead.addr, align 4
  %32 = icmp eq i32 %31, 244
  br i1 %32, label %if.then.6, label %if.end.6

if.then.6:
  store i32 143, i32* %high.addr, align 4
  br label %if.end.6

if.end.6:
  br label %if.end.4

if.else.2:
  ret i32 0

if.end.4:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %33 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %to, i32 %i)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok

ovf.ok:
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp slt i32 %34, %36
  br i1 %37, label %if.then.7, label %if.end.7

if.then.7:
  ret i32 0

if.end.7:
  %38 = add nsw i32 %i, 1
  %39 = sext i32 %38 to i64
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 %39, %41
  br i1 %42, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %39, i64 %41)
  unreachable

bounds.ok.1:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = bitcast i8* %44 to i8*
  %46 = getelementptr inbounds i8, i8* %45, i64 %39
  %47 = load i8, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %48 = zext i8 %47 to i32
  store i32 %48, i32* %second.addr, align 4
  %49 = load i32, i32* %second.addr, align 4
  %50 = load i32, i32* %low.addr, align 4
  %51 = icmp slt i32 %49, %50
  br i1 %51, label %lor.end, label %lor.rhs

lor.rhs:
  %52 = load i32, i32* %second.addr, align 4
  %53 = load i32, i32* %high.addr, align 4
  %54 = icmp sgt i32 %52, %53
  br label %lor.end

lor.end:
  %55 = phi i1 [ true, %bounds.ok.1 ], [ %54, %lor.rhs ]
  br i1 %55, label %if.then.8, label %if.end.8

if.then.8:
  ret i32 0

if.end.8:
  store i32 2, i32* %k.addr, align 4
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %60 = load i32, i32* %k.addr, align 4
  %61 = load i32, i32* %n.addr, align 4
  %62 = icmp slt i32 %60, %61
  br i1 %62, label %while.body, label %while.end

while.body:
  %63 = load i32, i32* %k.addr, align 4
  %64 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 %63)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %67 = sext i32 %65 to i64
  %68 = icmp ult i64 %67, %57
  br i1 %68, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %67, i64 %57)
  unreachable

bounds.ok.2:
  %69 = bitcast i8* %59 to i8*
  %70 = getelementptr inbounds i8, i8* %69, i64 %67
  %71 = load i8, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %72 = zext i8 %71 to i32
  store i32 %72, i32* %c.addr, align 4
  %73 = load i32, i32* %c.addr, align 4
  %74 = icmp slt i32 %73, 128
  br i1 %74, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %75 = load i32, i32* %c.addr, align 4
  %76 = icmp sgt i32 %75, 191
  br label %lor.end.1

lor.end.1:
  %77 = phi i1 [ true, %bounds.ok.2 ], [ %76, %lor.rhs.1 ]
  br i1 %77, label %if.then.9, label %if.end.9

if.then.9:
  ret i32 0

if.end.9:
  %78 = load i32, i32* %k.addr, align 4
  %79 = add nsw i32 %78, 1
  store i32 %79, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %80 = load i32, i32* %n.addr, align 4
  ret i32 %80

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.end ], [ 0, %while.body ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @nish.skipJsonTextWalk(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #0 {
entry:
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %to
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %while.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %3 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %14
  %17 = load i8, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = zext i8 %17 to i32
  store i32 %18, i32* %c.addr, align 4
  %19 = load i32, i32* %c.addr, align 4
  %20 = icmp sge i32 %19, 128
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load i32, i32* %i.addr, align 4
  %22 = call i32 @nish.bytesUtf8Length(%struct.nish_array* %b, i32 %21, i32 %to)
  store i32 %22, i32* %n.addr, align 4
  %23 = load i32, i32* %n.addr, align 4
  %24 = icmp eq i32 %23, 0
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = load i32, i32* %i.addr, align 4
  ret i32 %25

if.end.1:
  %26 = load i32, i32* %i.addr, align 4
  %27 = load i32, i32* %n.addr, align 4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %29, i32* %i.addr, align 4
  br label %while.cond

if.end:
  %31 = load i32, i32* %c.addr, align 4
  %32 = icmp slt i32 %31, 32
  br i1 %32, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %33 = load i32, i32* %c.addr, align 4
  %34 = icmp eq i32 %33, 34
  br label %lor.end.1

lor.end.1:
  %35 = phi i1 [ true, %if.end ], [ %34, %lor.rhs.1 ]
  br i1 %35, label %lor.end, label %lor.rhs

lor.rhs:
  %36 = load i32, i32* %c.addr, align 4
  %37 = icmp eq i32 %36, 92
  br label %lor.end

lor.end:
  %38 = phi i1 [ true, %lor.end.1 ], [ %37, %lor.rhs ]
  br i1 %38, label %if.then.2, label %if.end.2

if.then.2:
  %39 = load i32, i32* %i.addr, align 4
  ret i32 %39

if.end.2:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %42 = load i32, i32* %i.addr, align 4
  ret i32 %42

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @nish.copyBytesWalk(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %from, i32 noundef %count) #0 {
entry:
  %k.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = icmp sle i32 %at, %from
  br i1 %0, label %if.then, label %if.end

if.then:
  store i32 0, i32* %k.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %9 = load i32, i32* %k.addr, align 4
  %10 = icmp slt i32 %9, %count
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %k.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  %15 = sext i32 %13 to i64
  %16 = load i32, i32* %k.addr, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %from, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %20 = sext i32 %18 to i64
  %21 = icmp ult i64 %20, %6
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %20, i64 %6)
  unreachable

bounds.ok:
  %22 = bitcast i8* %8 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 %20
  %24 = load i8, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = icmp ult i64 %15, %2
  br i1 %25, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %15, i64 %2)
  unreachable

bounds.ok.1:
  %26 = bitcast i8* %4 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 %15
  store i8 %24, i8* %27, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = load i32, i32* %k.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %k.addr, align 4
  br label %while.cond

while.end:
  ret void

if.end:
  %30 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %count, i32 1)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %31, i32* %k.addr.1, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %41 = load i32, i32* %k.addr.1, align 4
  %42 = icmp sge i32 %41, 0
  br i1 %42, label %while.body.1, label %while.end.1

while.body.1:
  %43 = load i32, i32* %k.addr.1, align 4
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %43)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %47 = sext i32 %45 to i64
  %48 = load i32, i32* %k.addr.1, align 4
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %from, i32 %48)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %52 = sext i32 %50 to i64
  %53 = icmp ult i64 %52, %38
  br i1 %53, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %52, i64 %38)
  unreachable

bounds.ok.2:
  %54 = bitcast i8* %40 to i8*
  %55 = getelementptr inbounds i8, i8* %54, i64 %52
  %56 = load i8, i8* %55, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %57 = icmp ult i64 %47, %34
  br i1 %57, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %47, i64 %34)
  unreachable

bounds.ok.3:
  %58 = bitcast i8* %36 to i8*
  %59 = getelementptr inbounds i8, i8* %58, i64 %47
  store i8 %56, i8* %59, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %60 = load i32, i32* %k.addr.1, align 4
  %61 = sub nsw i32 %60, 1
  store i32 %61, i32* %k.addr.1, align 4
  br label %while.cond.1

while.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %while.body ], [ 0, %ovf.ok ], [ 1, %if.end ], [ 0, %while.body.1 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn memory(argmem: read, inaccessiblemem: readwrite) }
attributes #5 = { nounwind noreturn cold }

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
