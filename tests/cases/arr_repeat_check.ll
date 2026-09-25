%struct.Perm = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
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

define internal void @Perm.constructor(%struct.Perm* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = mul i64 %0, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  store %struct.nish_array* %2, %struct.nish_array** %8, align 8, !tbaa !15
  ret void
}

define internal void @Perm.swap(%struct.Perm* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i, i32 noundef %j) #0 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 %2
  %7 = load i32, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  store i32 %7, i32* %tmp.addr, align 4
  %8 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !15
  %10 = sext i32 %i to i64
  %11 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !15
  %13 = sext i32 %j to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %10
  store i32 %18, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %23 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !15
  %25 = sext i32 %j to i64
  %26 = load i32, i32* %tmp.addr, align 4
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %25
  store i32 %26, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  ret void
}

define internal noundef i32 @Perm.double(%struct.Perm* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 %2
  %7 = load i32, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %8 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !15
  %10 = sext i32 %i to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %16 = add nsw i32 %7, %15
  store i32 %16, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %17 = getelementptr inbounds %struct.Perm, %struct.Perm* %this, i32 0, i32 0
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !15
  %19 = sext i32 %i to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %19
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  ret i32 %24
}

define noundef i32 @test() #1 {
entry:
  %p.addr = alloca %struct.Perm*, align 8
  %Perm.obj = alloca %struct.Perm, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Perm.constructor(%struct.Perm* %Perm.obj, i32 4)
  store %struct.Perm* %Perm.obj, %struct.Perm** %p.addr, align 8
  %0 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Perm, %struct.Perm* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !15
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 0, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 1, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %10 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %11 = getelementptr inbounds %struct.Perm, %struct.Perm* %10, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !15
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 3, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 3
  store i32 20, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %20 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  call void @Perm.swap(%struct.Perm* %20, i32 0, i32 3)
  %21 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %22 = call i32 @Perm.double(%struct.Perm* %21, i32 3)
  %23 = load %struct.Perm*, %struct.Perm** %p.addr, align 8
  %24 = getelementptr inbounds %struct.Perm, %struct.Perm* %23, i32 0, i32 0
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !15
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !17
  %31 = add nsw i32 %22, %30
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %31
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Perm", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"element i32", !6, i64 0}
!17 = !{!16, !16, i64 0}
