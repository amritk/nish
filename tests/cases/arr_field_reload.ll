%struct.Swap = type { i32, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
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
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %6 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !17
  ret void
}

define void @Swap.swap(%struct.Swap* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %j) #1 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  store i32 %10, i32* %tmp.addr, align 4
  %11 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !17
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !17
  %16 = sext i32 %j to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %16
  %24 = load i32, i32* %23, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %13
  store i32 %24, i32* %28, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %29 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 1
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !17
  %31 = sext i32 %j to i64
  %32 = load i32, i32* %tmp.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %31
  store i32 %32, i32* %36, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %37 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 0
  %38 = load i32, i32* %37, align 4, !tbaa !5
  %39 = add nsw i32 %38, 1
  %40 = getelementptr inbounds %struct.Swap, %struct.Swap* %this, i32 0, i32 0
  store i32 %39, i32* %40, align 4, !tbaa !5
  ret void
}

define noundef i32 @test() #1 {
entry:
  %s.addr = alloca %struct.Swap*, align 8
  %Swap.obj = alloca %struct.Swap, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Swap.constructor(%struct.Swap* %Swap.obj)
  store %struct.Swap* %Swap.obj, %struct.Swap** %s.addr, align 8
  %0 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 3, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = call i8* @nish_alloc_struct(i64 12)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 1, i32* %8, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 2, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %10 = getelementptr inbounds i32, i32* %7, i64 2
  store i32 3, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %11 = getelementptr inbounds %struct.Swap, %struct.Swap* %0, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %11, align 8, !tbaa !17
  %12 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  call void @Swap.swap(%struct.Swap* %12, i32 0, i32 2)
  %13 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  call void @Swap.swap(%struct.Swap* %13, i32 1, i32 2)
  %14 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %15 = getelementptr inbounds %struct.Swap, %struct.Swap* %14, i32 0, i32 1
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !17
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  %21 = load i32, i32* %20, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %22 = mul nsw i32 %21, 1000
  %23 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %24 = getelementptr inbounds %struct.Swap, %struct.Swap* %23, i32 0, i32 1
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !17
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 1
  %30 = load i32, i32* %29, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %31 = mul nsw i32 %30, 100
  %32 = add nsw i32 %22, %31
  %33 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %34 = getelementptr inbounds %struct.Swap, %struct.Swap* %33, i32 0, i32 1
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !17
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 2
  %40 = load i32, i32* %39, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %41 = mul nsw i32 %40, 10
  %42 = add nsw i32 %32, %41
  %43 = load %struct.Swap*, %struct.Swap** %s.addr, align 8
  %44 = getelementptr inbounds %struct.Swap, %struct.Swap* %43, i32 0, i32 0
  %45 = load i32, i32* %44, align 4, !tbaa !5
  %46 = add nsw i32 %42, %45
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %46
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
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!4, !3, i64 8}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
