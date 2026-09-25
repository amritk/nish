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

define internal noundef i32 @touch(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 8
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4
  %6 = icmp eq i64 %5, 0
  br i1 %6, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %7 = sub i64 %5, 1
  store i64 %7, i64* %4, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %7
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %if.end

if.end:
  ret i32 1
}

define internal noundef i32 @afterCall(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i) #0 {
entry:
  %a.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %8, i32* %a.addr, align 4
  %9 = call i32 @touch(%struct.nish_array* %xs)
  %10 = load i32, i32* %a.addr, align 4
  %11 = sext i32 %i to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok.1:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %11
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %20 = add nsw i32 %10, %19
  ret i32 %20
}

define internal noundef i32 @storeCall(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i, i32 noundef %j) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = sext i32 %j to i64
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
  %10 = call i32 @touch(%struct.nish_array* %xs)
  %11 = add nsw i32 %9, %10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4
  %14 = icmp ult i64 %0, %13
  br i1 %14, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %0, i64 %13)
  unreachable

bounds.ok.1:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %0
  store i32 %11, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %19 = sext i32 %j to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok.2:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %19
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  ret i32 %27
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8, !tbaa !11
  ret void
}

define internal noundef i32 @Box.replace(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 5, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 6, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 7, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 8, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8, !tbaa !11
  ret i32 10
}

define internal noundef i32 @Box.storeReplaced(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !11
  %2 = sext i32 %i to i64
  %3 = call i32 @Box.replace(%struct.Box* %this)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4
  %6 = icmp ult i64 %2, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %2
  store i32 %3, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !11
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %13
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  ret i32 %21
}

define noundef i32 @test() #0 {
entry:
  %b.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box.constructor(%struct.Box* %Box.obj)
  store %struct.Box* %Box.obj, %struct.Box** %b.addr, align 8
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
  %8 = call i32 @afterCall(%struct.nish_array* %arr.hdr, i32 2)
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
  %17 = call i32 @storeCall(%struct.nish_array* %arr.hdr.1, i32 0, i32 1)
  %18 = add nsw i32 %8, %17
  %19 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %20 = call i32 @Box.storeReplaced(%struct.Box* %19, i32 1)
  %21 = add nsw i32 %18, %20
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %21
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
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
!9 = !{!"ptr", !6, i64 0}
!10 = !{!"Box", !9, i64 0}
!11 = !{!10, !9, i64 0}
