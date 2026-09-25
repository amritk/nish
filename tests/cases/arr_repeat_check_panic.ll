%struct.Box = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
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

define internal noundef i32 @afterPop(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i) #0 {
entry:
  %a.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %a.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp eq i64 %10, 0
  br i1 %11, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %12 = sub i64 %10, 1
  store i64 %12, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %12
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = load i32, i32* %a.addr, align 4
  %19 = sext i32 %i to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %19
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = add nsw i32 %18, %27
  ret i32 %28
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8, !tbaa !17
  ret void
}

define internal noundef i32 @Box.shrink(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 5, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %8, align 8, !tbaa !17
  ret i32 0
}

define internal noundef i32 @Box.afterCallStore(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = sext i32 %i to i64
  %3 = call i32 @Box.shrink(%struct.Box* %this)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %2, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %2
  store i32 %3, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !17
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %13
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %21
}

define internal noundef i32 @Box.afterFieldStore(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %i) #0 {
entry:
  %a.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %10, i32* %a.addr, align 4
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 1, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %15 = call i8* @nish_alloc_struct(i64 4)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 6, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %12, %struct.nish_array** %19, align 8, !tbaa !17
  %20 = load i32, i32* %a.addr, align 4
  %21 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !17
  %23 = sext i32 %i to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = icmp ult i64 %23, %25
  br i1 %26, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %23, i64 %25)
  unreachable

bounds.ok.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  %31 = load i32, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %32 = add nsw i32 %20, %31
  ret i32 %32
}

define noundef i32 @popPastEnd() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = call i32 @afterPop(%struct.nish_array* %arr.hdr, i32 2)
  ret i32 %8
}

define noundef i32 @callStorePastEnd() #0 {
entry:
  %Box.obj = alloca %struct.Box, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box.constructor(%struct.Box* %Box.obj)
  %0 = call i32 @Box.afterCallStore(%struct.Box* %Box.obj, i32 3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %0
}

define noundef i32 @fieldStorePastEnd() #0 {
entry:
  %Box.obj = alloca %struct.Box, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box.constructor(%struct.Box* %Box.obj)
  %0 = call i32 @Box.afterFieldStore(%struct.Box* %Box.obj, i32 3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %Box.obj = alloca %struct.Box, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = call i32 @afterPop(%struct.nish_array* %arr.hdr, i32 1)
  call void @Box.constructor(%struct.Box* %Box.obj)
  %9 = call i32 @Box.afterFieldStore(%struct.Box* %Box.obj, i32 0)
  %10 = add nsw i32 %8, %9
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %10
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Box", !15, i64 0}
!17 = !{!16, !15, i64 0}
