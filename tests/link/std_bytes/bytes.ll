%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"copyBytes: the range lies outside an array\00" }, align 8

declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare i64 @nish_bytes_skip_blank(i8* noundef readonly nocapture, i64 noundef, i64 noundef) #4
declare i64 @nish_bytes_skip_digits(i8* noundef readonly nocapture, i64 noundef, i64 noundef) #4
declare i64 @nish_bytes_skip_json_text(i8* noundef readonly nocapture, i64 noundef, i64 noundef) #4
declare i64 @nish_bytes_skip_json_plain(i8* noundef readonly nocapture, i64 noundef, i64 noundef) #4
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

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

define internal noundef i64 @nish.getU64BEByByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
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

define noundef i64 @nish.getU64BE(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %off) #0 {
entry:
  %0 = icmp sge i32 %off, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %off, 2147483640
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = add nsw i32 %off, 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  %7 = icmp sle i32 %3, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %land.end.1 ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = sext i32 %off to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 %9
  %14 = load i8, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = zext i8 %14 to i64
  %16 = sext i32 56 to i64
  %17 = and i64 %16, 63
  %18 = shl i64 %15, %17
  %19 = add nsw i32 %off, 1
  %20 = sext i32 %19 to i64
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = bitcast i8* %22 to i8*
  %24 = getelementptr inbounds i8, i8* %23, i64 %20
  %25 = load i8, i8* %24, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %26 = zext i8 %25 to i64
  %27 = sext i32 48 to i64
  %28 = and i64 %27, 63
  %29 = shl i64 %26, %28
  %30 = or i64 %18, %29
  %31 = add nsw i32 %off, 2
  %32 = sext i32 %31 to i64
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 %32
  %37 = load i8, i8* %36, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %38 = zext i8 %37 to i64
  %39 = sext i32 40 to i64
  %40 = and i64 %39, 63
  %41 = shl i64 %38, %40
  %42 = add nsw i32 %off, 3
  %43 = sext i32 %42 to i64
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = bitcast i8* %45 to i8*
  %47 = getelementptr inbounds i8, i8* %46, i64 %43
  %48 = load i8, i8* %47, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %49 = zext i8 %48 to i64
  %50 = sext i32 32 to i64
  %51 = and i64 %50, 63
  %52 = shl i64 %49, %51
  %53 = or i64 %41, %52
  %54 = or i64 %30, %53
  %55 = add nsw i32 %off, 4
  %56 = sext i32 %55 to i64
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast i8* %58 to i8*
  %60 = getelementptr inbounds i8, i8* %59, i64 %56
  %61 = load i8, i8* %60, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %62 = zext i8 %61 to i64
  %63 = sext i32 24 to i64
  %64 = and i64 %63, 63
  %65 = shl i64 %62, %64
  %66 = add nsw i32 %off, 5
  %67 = sext i32 %66 to i64
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = bitcast i8* %69 to i8*
  %71 = getelementptr inbounds i8, i8* %70, i64 %67
  %72 = load i8, i8* %71, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %73 = zext i8 %72 to i64
  %74 = sext i32 16 to i64
  %75 = and i64 %74, 63
  %76 = shl i64 %73, %75
  %77 = or i64 %65, %76
  %78 = add nsw i32 %off, 6
  %79 = sext i32 %78 to i64
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %82 = bitcast i8* %81 to i8*
  %83 = getelementptr inbounds i8, i8* %82, i64 %79
  %84 = load i8, i8* %83, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %85 = zext i8 %84 to i64
  %86 = sext i32 8 to i64
  %87 = and i64 %86, 63
  %88 = shl i64 %85, %87
  %89 = add nsw i32 %off, 7
  %90 = sext i32 %89 to i64
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %93 = bitcast i8* %92 to i8*
  %94 = getelementptr inbounds i8, i8* %93, i64 %90
  %95 = load i8, i8* %94, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %96 = zext i8 %95 to i64
  %97 = or i64 %88, %96
  %98 = or i64 %77, %97
  %99 = or i64 %54, %98
  ret i64 %99

if.end:
  %100 = call i64 @nish.getU64BEByByte(%struct.nish_array* %b, i32 %off)
  ret i64 %100
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

define noundef i32 @nish.skipJsonPlain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #3 {
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
  %8 = call i64 @nish_bytes_skip_json_plain(i8* %5, i64 %6, i64 %7)
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define void @nish.copyBytes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %from, i32 noundef %count) #0 {
entry:
  %0 = call i1 @nish.tryCopyBytes(%struct.nish_array* %dst, i32 %at, %struct.nish_array* %src, i32 %from, i32 %count)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*))
  unreachable

if.end:
  ret void
}

define noundef zeroext i1 @nish.tryCopyBytes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %from, i32 noundef %count) #0 {
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
  ret i1 false

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
  ret i1 true
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

define internal noundef i32 @nish.bytesUtf8End(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %i, i32 noundef %to) #0 {
entry:
  %lead.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %high.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %lowest.addr = alloca i32, align 4
  %highest.addr = alloca i32, align 4
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
  ret i32 %i

if.end.4:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %33 = icmp slt i32 %i, 0
  br i1 %33, label %lor.end, label %lor.rhs

lor.rhs:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  %37 = icmp sge i32 %i, %36
  br label %lor.end

lor.end:
  %38 = phi i1 [ true, %if.end ], [ %37, %lor.rhs ]
  br i1 %38, label %if.then.7, label %if.end.7

if.then.7:
  ret i32 %i

if.end.7:
  %39 = add nsw i32 %i, 1
  store i32 %39, i32* %j.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %44 = load i32, i32* %k.addr, align 4
  %45 = load i32, i32* %n.addr, align 4
  %46 = icmp slt i32 %44, %45
  br i1 %46, label %while.body, label %while.end

while.body:
  %47 = load i32, i32* %j.addr, align 4
  %48 = icmp sge i32 %47, %to
  br i1 %48, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %49 = load i32, i32* %j.addr, align 4
  %50 = trunc i64 %41 to i32
  %51 = icmp sge i32 %49, %50
  br label %lor.end.1

lor.end.1:
  %52 = phi i1 [ true, %while.body ], [ %51, %lor.rhs.1 ]
  br i1 %52, label %if.then.8, label %if.end.8

if.then.8:
  ret i32 %i

if.end.8:
  %53 = load i32, i32* %j.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = bitcast i8* %43 to i8*
  %56 = getelementptr inbounds i8, i8* %55, i64 %54
  %57 = load i8, i8* %56, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %58 = zext i8 %57 to i32
  store i32 %58, i32* %c.addr, align 4
  %59 = load i32, i32* %k.addr, align 4
  %60 = icmp eq i32 %59, 1
  br i1 %60, label %cond.true, label %cond.false

cond.true:
  %61 = load i32, i32* %low.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %62 = phi i32 [ %61, %cond.true ], [ 128, %cond.false ]
  store i32 %62, i32* %lowest.addr, align 4
  %63 = load i32, i32* %k.addr, align 4
  %64 = icmp eq i32 %63, 1
  br i1 %64, label %cond.true.1, label %cond.false.1

cond.true.1:
  %65 = load i32, i32* %high.addr, align 4
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %66 = phi i32 [ %65, %cond.true.1 ], [ 191, %cond.false.1 ]
  store i32 %66, i32* %highest.addr, align 4
  %67 = load i32, i32* %c.addr, align 4
  %68 = load i32, i32* %lowest.addr, align 4
  %69 = icmp slt i32 %67, %68
  br i1 %69, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %70 = load i32, i32* %c.addr, align 4
  %71 = load i32, i32* %highest.addr, align 4
  %72 = icmp sgt i32 %70, %71
  br label %lor.end.2

lor.end.2:
  %73 = phi i1 [ true, %cond.end.1 ], [ %72, %lor.rhs.2 ]
  br i1 %73, label %if.then.9, label %if.end.9

if.then.9:
  ret i32 %i

if.end.9:
  %74 = load i32, i32* %j.addr, align 4
  %75 = add nsw i32 %74, 1
  store i32 %75, i32* %j.addr, align 4
  %76 = load i32, i32* %k.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %78 = load i32, i32* %j.addr, align 4
  ret i32 %78
}

define internal noundef i32 @nish.skipJsonTextWalk(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #0 {
entry:
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
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
  %22 = call i32 @nish.bytesUtf8End(%struct.nish_array* %b, i32 %21, i32 %to)
  store i32 %22, i32* %end.addr, align 4
  %23 = load i32, i32* %end.addr, align 4
  %24 = load i32, i32* %i.addr, align 4
  %25 = icmp eq i32 %23, %24
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  %26 = load i32, i32* %i.addr, align 4
  ret i32 %26

if.end.1:
  %27 = load i32, i32* %end.addr, align 4
  store i32 %27, i32* %i.addr, align 4
  br label %while.cond

if.end:
  %28 = load i32, i32* %c.addr, align 4
  %29 = icmp slt i32 %28, 32
  br i1 %29, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %30 = load i32, i32* %c.addr, align 4
  %31 = icmp eq i32 %30, 34
  br label %lor.end.1

lor.end.1:
  %32 = phi i1 [ true, %if.end ], [ %31, %lor.rhs.1 ]
  br i1 %32, label %lor.end, label %lor.rhs

lor.rhs:
  %33 = load i32, i32* %c.addr, align 4
  %34 = icmp eq i32 %33, 92
  br label %lor.end

lor.end:
  %35 = phi i1 [ true, %lor.end.1 ], [ %34, %lor.rhs ]
  br i1 %35, label %if.then.2, label %if.end.2

if.then.2:
  %36 = load i32, i32* %i.addr, align 4
  ret i32 %36

if.end.2:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %39 = load i32, i32* %i.addr, align 4
  ret i32 %39
}

define internal noundef i32 @nish.skipJsonPlainWalk(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, i32 noundef %from, i32 noundef %to) #3 {
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
  %20 = icmp slt i32 %19, 32
  br i1 %20, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %21 = load i32, i32* %c.addr, align 4
  %22 = icmp eq i32 %21, 34
  br label %lor.end.1

lor.end.1:
  %23 = phi i1 [ true, %while.body ], [ %22, %lor.rhs.1 ]
  br i1 %23, label %lor.end, label %lor.rhs

lor.rhs:
  %24 = load i32, i32* %c.addr, align 4
  %25 = icmp eq i32 %24, 92
  br label %lor.end

lor.end:
  %26 = phi i1 [ true, %lor.end.1 ], [ %25, %lor.rhs ]
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load i32, i32* %i.addr, align 4
  ret i32 %27

if.end:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %30 = load i32, i32* %i.addr, align 4
  ret i32 %30
}

define internal void @nish.copyBytesWalk(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %from, i32 noundef %count) #0 {
entry:
  %dstLength.addr = alloca i32, align 4
  %srcLength.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %s.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %d.addr.1 = alloca i32, align 4
  %s.addr.1 = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %dstLength.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %srcLength.addr, align 4
  %6 = icmp sle i32 %at, %from
  br i1 %6, label %if.then, label %if.end

if.then:
  store i32 %at, i32* %d.addr, align 4
  store i32 %from, i32* %s.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %11 = load i32, i32* %k.addr, align 4
  %12 = icmp slt i32 %11, %count
  br i1 %12, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %13 = load i32, i32* %d.addr, align 4
  %14 = icmp sge i32 %13, 0
  br label %land.end.3

land.end.3:
  %15 = phi i1 [ false, %while.cond ], [ %14, %land.rhs.3 ]
  br i1 %15, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %16 = load i32, i32* %d.addr, align 4
  %17 = load i32, i32* %dstLength.addr, align 4
  %18 = icmp slt i32 %16, %17
  br label %land.end.2

land.end.2:
  %19 = phi i1 [ false, %land.end.3 ], [ %18, %land.rhs.2 ]
  br i1 %19, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %20 = load i32, i32* %s.addr, align 4
  %21 = icmp sge i32 %20, 0
  br label %land.end.1

land.end.1:
  %22 = phi i1 [ false, %land.end.2 ], [ %21, %land.rhs.1 ]
  br i1 %22, label %land.rhs, label %land.end

land.rhs:
  %23 = load i32, i32* %s.addr, align 4
  %24 = load i32, i32* %srcLength.addr, align 4
  %25 = icmp slt i32 %23, %24
  br label %land.end

land.end:
  %26 = phi i1 [ false, %land.end.1 ], [ %25, %land.rhs ]
  br i1 %26, label %while.body, label %while.end

while.body:
  %27 = load i32, i32* %d.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = load i32, i32* %s.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = bitcast i8* %10 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %30
  %33 = load i8, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %34 = bitcast i8* %8 to i8*
  %35 = getelementptr inbounds i8, i8* %34, i64 %28
  store i8 %33, i8* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = load i32, i32* %d.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %d.addr, align 4
  %38 = load i32, i32* %s.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %s.addr, align 4
  %40 = load i32, i32* %k.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %k.addr, align 4
  br label %while.cond

while.end:
  ret void

if.end:
  %42 = sext i32 %at to i64
  %43 = sext i32 %count to i64
  %44 = add nsw i64 %42, %43
  %45 = sext i32 1 to i64
  %46 = sub nsw i64 %44, %45
  %47 = trunc i64 %46 to i32
  store i32 %47, i32* %d.addr.1, align 4
  %48 = sext i32 %from to i64
  %49 = sext i32 %count to i64
  %50 = add nsw i64 %48, %49
  %51 = sext i32 1 to i64
  %52 = sub nsw i64 %50, %51
  %53 = trunc i64 %52 to i32
  store i32 %53, i32* %s.addr.1, align 4
  store i32 %count, i32* %k.addr.1, align 4
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %58 = load i32, i32* %k.addr.1, align 4
  %59 = icmp sgt i32 %58, 0
  br i1 %59, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %60 = load i32, i32* %d.addr.1, align 4
  %61 = icmp sge i32 %60, 0
  br label %land.end.7

land.end.7:
  %62 = phi i1 [ false, %while.cond.1 ], [ %61, %land.rhs.7 ]
  br i1 %62, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %63 = load i32, i32* %d.addr.1, align 4
  %64 = load i32, i32* %dstLength.addr, align 4
  %65 = icmp slt i32 %63, %64
  br label %land.end.6

land.end.6:
  %66 = phi i1 [ false, %land.end.7 ], [ %65, %land.rhs.6 ]
  br i1 %66, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %67 = load i32, i32* %s.addr.1, align 4
  %68 = icmp sge i32 %67, 0
  br label %land.end.5

land.end.5:
  %69 = phi i1 [ false, %land.end.6 ], [ %68, %land.rhs.5 ]
  br i1 %69, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %70 = load i32, i32* %s.addr.1, align 4
  %71 = load i32, i32* %srcLength.addr, align 4
  %72 = icmp slt i32 %70, %71
  br label %land.end.4

land.end.4:
  %73 = phi i1 [ false, %land.end.5 ], [ %72, %land.rhs.4 ]
  br i1 %73, label %while.body.1, label %while.end.1

while.body.1:
  %74 = load i32, i32* %d.addr.1, align 4
  %75 = sext i32 %74 to i64
  %76 = load i32, i32* %s.addr.1, align 4
  %77 = sext i32 %76 to i64
  %78 = bitcast i8* %57 to i8*
  %79 = getelementptr inbounds i8, i8* %78, i64 %77
  %80 = load i8, i8* %79, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %81 = bitcast i8* %55 to i8*
  %82 = getelementptr inbounds i8, i8* %81, i64 %75
  store i8 %80, i8* %82, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %83 = load i32, i32* %d.addr.1, align 4
  %84 = sub nsw i32 %83, 1
  store i32 %84, i32* %d.addr.1, align 4
  %85 = load i32, i32* %s.addr.1, align 4
  %86 = sub nsw i32 %85, 1
  store i32 %86, i32* %s.addr.1, align 4
  %87 = load i32, i32* %k.addr.1, align 4
  %88 = sub nsw i32 %87, 1
  store i32 %88, i32* %k.addr.1, align 4
  br label %while.cond.1

while.end.1:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn memory(argmem: read, inaccessiblemem: readwrite) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!14, !15, !16, !17, !18}
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
!14 = !{i32 8, !"cf-protection-branch", i32 1}
!15 = !{i32 8, !"cf-protection-return", i32 1}
!16 = !{i32 8, !"branch-target-enforcement", i32 1}
!17 = !{i32 8, !"sign-return-address", i32 1}
!18 = !{i32 4, !"probe-stack", !"inline-asm"}
