%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal noundef i32 @stepped(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %k.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  store i32 %i, i32* %k.addr, align 4
  %0 = load i32, i32* %k.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %9, i32* %a.addr, align 4
  %10 = load i32, i32* %k.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %k.addr, align 4
  %12 = load i32, i32* %a.addr, align 4
  %13 = load i32, i32* %k.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %23 = add nsw i32 %12, %22
  ret i32 %23
}

define internal noundef i32 @replaced(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i, i32 noundef %j) #0 {
entry:
  %k.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  store i32 %i, i32* %k.addr, align 4
  %0 = load i32, i32* %k.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %9, i32* %a.addr, align 4
  store i32 %j, i32* %k.addr, align 4
  %10 = load i32, i32* %a.addr, align 4
  %11 = load i32, i32* %k.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %21 = add nsw i32 %10, %20
  ret i32 %21
}

define internal noundef i32 @rebound(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %zs, i32 noundef %i) #0 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca i32, align 4
  store %struct.nish_array* %xs, %struct.nish_array** %ys.addr, align 8
  %0 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %9, i32* %a.addr, align 4
  store %struct.nish_array* %zs, %struct.nish_array** %ys.addr, align 8
  %10 = load i32, i32* %a.addr, align 4
  %11 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %12 = sext i32 %i to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %21 = add nsw i32 %10, %20
  ret i32 %21
}

define internal noundef i32 @rewritten(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i, i32 noundef %j) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 %i, i32* %k.addr, align 4
  %0 = load i32, i32* %k.addr, align 4
  %1 = sext i32 %0 to i64
  store i32 %j, i32* %k.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  store i32 %j, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %9 = load i32, i32* %k.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok.1:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  ret i32 %18
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %8 = call i32 @stepped(%struct.nish_array* %arr.hdr, i32 0)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = bitcast [3 x i32]* %arr.data.1 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 1, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %15 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 2, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %16 = getelementptr inbounds i32, i32* %13, i64 2
  store i32 3, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %17 = call i32 @replaced(%struct.nish_array* %arr.hdr.1, i32 0, i32 2)
  %18 = add nsw i32 %8, %17
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 2, i64* %21, align 8, !alias.scope !3, !noalias !4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 2, i64* %22, align 8, !alias.scope !3, !noalias !4
  %23 = call i8* @nish_alloc_struct(i64 8)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4
  %25 = bitcast i8* %23 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  store i32 1, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %27 = getelementptr inbounds i32, i32* %25, i64 1
  store i32 2, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 3, i64* %30, align 8, !alias.scope !3, !noalias !4
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 3, i64* %31, align 8, !alias.scope !3, !noalias !4
  %32 = call i8* @nish_alloc_struct(i64 12)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4
  %34 = bitcast i8* %32 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  store i32 3, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %36 = getelementptr inbounds i32, i32* %34, i64 1
  store i32 4, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %37 = getelementptr inbounds i32, i32* %34, i64 2
  store i32 5, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %38 = call i32 @rebound(%struct.nish_array* %20, %struct.nish_array* %29, i32 1)
  %39 = add nsw i32 %18, %38
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %40, align 8, !alias.scope !3, !noalias !4
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %41, align 8, !alias.scope !3, !noalias !4
  %42 = bitcast [3 x i32]* %arr.data.2 to i8*
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !3, !noalias !4
  %44 = bitcast i8* %42 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 0
  store i32 1, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %46 = getelementptr inbounds i32, i32* %44, i64 1
  store i32 2, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %47 = getelementptr inbounds i32, i32* %44, i64 2
  store i32 3, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %48 = call i32 @rewritten(%struct.nish_array* %arr.hdr.2, i32 0, i32 1)
  %49 = add nsw i32 %39, %48
  ret i32 %49
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
