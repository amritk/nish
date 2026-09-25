%struct.Holder = type { %struct.nish_array* }
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %v, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @Holder.rebind(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %i, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %fresh) #1 {
entry:
  %a.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store i32 %10, i32* %a.addr, align 4
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %fresh, %struct.nish_array** %11, align 8, !tbaa !4
  %12 = load i32, i32* %a.addr, align 4
  %13 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !4
  %15 = sext i32 %i to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %15, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !8, !noalias !9
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %15
  %23 = load i32, i32* %22, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %24 = add nsw i32 %12, %23
  ret i32 %24
}

define internal noundef i32 @Holder.rebindThrough(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i, %struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %other, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %fresh) #1 {
entry:
  %a.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store i32 %10, i32* %a.addr, align 4
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %other, i32 0, i32 0
  store %struct.nish_array* %fresh, %struct.nish_array** %11, align 8, !tbaa !4
  %12 = load i32, i32* %a.addr, align 4
  %13 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !4
  %15 = sext i32 %i to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %15, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !8, !noalias !9
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %15
  %23 = load i32, i32* %22, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %24 = add nsw i32 %12, %23
  ret i32 %24
}

define internal noundef i32 @Holder.elementStore(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i) #1 {
entry:
  %a.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store i32 %10, i32* %a.addr, align 4
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !4
  %13 = load i32, i32* %a.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9
  %16 = icmp ult i64 0, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !8, !noalias !9
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 %13, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %21 = load i32, i32* %a.addr, align 4
  %22 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !4
  %24 = sext i32 %i to i64
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !8, !noalias !9
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %24
  %29 = load i32, i32* %28, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %30 = add nsw i32 %21, %29
  ret i32 %30
}

define noundef i32 @test() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %r.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %1)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %10 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 3, i64* %13, align 8, !alias.scope !8, !noalias !9
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 3, i64* %14, align 8, !alias.scope !8, !noalias !9
  %15 = call i8* @nish_alloc_struct(i64 12)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !8, !noalias !9
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 4, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 5, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %20 = getelementptr inbounds i32, i32* %17, i64 2
  store i32 6, i32* %20, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %21 = call i32 @Holder.rebind(%struct.Holder* %10, i32 2, %struct.nish_array* %12)
  store i32 %21, i32* %r.addr, align 4
  %22 = load i32, i32* %r.addr, align 4
  %23 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %24 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 3, i64* %27, align 8, !alias.scope !8, !noalias !9
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 3, i64* %28, align 8, !alias.scope !8, !noalias !9
  %29 = call i8* @nish_alloc_struct(i64 12)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !8, !noalias !9
  %31 = bitcast i8* %29 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 0
  store i32 7, i32* %32, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %33 = getelementptr inbounds i32, i32* %31, i64 1
  store i32 8, i32* %33, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %34 = getelementptr inbounds i32, i32* %31, i64 2
  store i32 9, i32* %34, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %35 = call i32 @Holder.rebindThrough(%struct.Holder* %23, i32 1, %struct.Holder* %24, %struct.nish_array* %26)
  %36 = add nsw i32 %22, %35
  %37 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %38 = call i32 @Holder.elementStore(%struct.Holder* %37, i32 2)
  %39 = add nsw i32 %36, %38
  ret i32 %39
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
