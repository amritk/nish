%struct.Swap = type { i32, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define void @Swap.constructor(%struct.Swap* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10
  %6 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !11
  ret void
}

define void @Swap.swap(%struct.Swap* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %j) #1 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !11
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  store i32 %10, i32* %tmp.addr, align 4
  %11 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !11
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !11
  %16 = sext i32 %j to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !9, !noalias !10
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !9, !noalias !10
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !9, !noalias !10
  %27 = icmp ult i64 %13, %26
  br i1 %27, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %13, i64 %26)
  unreachable

bounds.ok.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !9, !noalias !10
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %13
  store i32 %24, i32* %31, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %32 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !11
  %34 = sext i32 %j to i64
  %35 = load i32, i32* %tmp.addr, align 4
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !9, !noalias !10
  %38 = icmp ult i64 %34, %37
  br i1 %38, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %34, i64 %37)
  unreachable

bounds.ok.3:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !9, !noalias !10
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %34
  store i32 %35, i32* %42, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %43 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 0
  %44 = load i32, i32* %43, align 4, !tbaa !5
  %45 = add nsw i32 %44, 1
  %46 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 0
  store i32 %45, i32* %46, align 4, !tbaa !5
  ret void
}

define noundef i32 @test() #1 {
entry:
  %s.addr = alloca %struct.Swap*, align 8
  %Swap.obj = alloca %struct.Swap, align 8
  call void @Swap.constructor(%struct.Swap* %Swap.obj)
  store %struct.Swap* %Swap.obj, %struct.Swap** %s.addr, align 8
  %0 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 3, i64* %3, align 8, !alias.scope !9, !noalias !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !9, !noalias !10
  %5 = call i8* @nish_alloc_struct(i64 12)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !9, !noalias !10
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 1, i32* %8, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 2, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %7, i64 2
  store i32 3, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %11 = getelementptr inbounds %struct.Swap, %struct.Swap* %0, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %11, align 8, !tbaa !11
  %12 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  call void @Swap.swap(%struct.Swap* %12, i32 0, i32 2)
  %13 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  call void @Swap.swap(%struct.Swap* %13, i32 1, i32 2)
  %14 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %15 = getelementptr inbounds %struct.Swap, %struct.Swap* %14, i32 0, i32 1
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !11
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !9, !noalias !10
  %19 = icmp ult i64 0, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !9, !noalias !10
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 0
  %24 = load i32, i32* %23, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %25 = mul nsw i32 %24, 1000
  %26 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %27 = getelementptr inbounds %struct.Swap, %struct.Swap* %26, i32 0, i32 1
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !11
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !9, !noalias !10
  %31 = icmp ult i64 1, %30
  br i1 %31, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %30)
  unreachable

bounds.ok.1:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !9, !noalias !10
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 1
  %36 = load i32, i32* %35, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %37 = mul nsw i32 %36, 100
  %38 = add nsw i32 %25, %37
  %39 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %40 = getelementptr inbounds %struct.Swap, %struct.Swap* %39, i32 0, i32 1
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8, !tbaa !11
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !9, !noalias !10
  %44 = icmp ult i64 2, %43
  br i1 %44, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %43)
  unreachable

bounds.ok.2:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !9, !noalias !10
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 2
  %49 = load i32, i32* %48, align 4, !alias.scope !10, !noalias !9, !tbaa !13
  %50 = mul nsw i32 %49, 10
  %51 = add nsw i32 %38, %50
  %52 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %53 = getelementptr inbounds %struct.Swap, %struct.Swap* %52, i32 0, i32 0
  %54 = load i32, i32* %53, align 4, !tbaa !5
  %55 = add nsw i32 %51, %54
  ret i32 %55
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Swap", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!4, !3, i64 8}
!12 = !{!"element i32", !1, i64 0}
!13 = !{!12, !12, i64 0}
