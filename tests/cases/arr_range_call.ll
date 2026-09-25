%struct.Permute = type { i32, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

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

define internal void @Permute.constructor(%struct.Permute* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %6 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !17
  ret void
}

define internal noundef i32 @Permute.benchmark(%struct.Permute* noundef nonnull align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 6, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 6, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = mul i64 6, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !10, !noalias !9
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %8 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %8, align 8, !tbaa !17
  call void @Permute.permute(%struct.Permute* %this, i32 6)
  %9 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !5
  ret i32 %10
}

define internal void @Permute.permute(%struct.Permute* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %n) #0 {
entry:
  %n1.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = icmp ne i32 %n, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = sub nsw i32 %n, 1
  store i32 %4, i32* %n1.addr, align 4
  %5 = load i32, i32* %n1.addr, align 4
  call void @Permute.permute(%struct.Permute* %this, i32 %5)
  %6 = load i32, i32* %n1.addr, align 4
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %n1.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  call void @Permute.swap(%struct.Permute* %this, i32 %9, i32 %10)
  %11 = load i32, i32* %n1.addr, align 4
  call void @Permute.permute(%struct.Permute* %this, i32 %11)
  %12 = load i32, i32* %n1.addr, align 4
  %13 = load i32, i32* %i.addr, align 4
  call void @Permute.swap(%struct.Permute* %this, i32 %12, i32 %13)
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sub nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  br label %if.end

if.end:
  ret void
}

define internal void @Permute.swap(%struct.Permute* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %j) #0 {
entry:
  %tmp.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 %2
  %7 = load i32, i32* %6, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  store i32 %7, i32* %tmp.addr, align 4
  %8 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !17
  %10 = sext i32 %i to i64
  %11 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !17
  %13 = sext i32 %j to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %10
  store i32 %18, i32* %22, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %23 = getelementptr inbounds %struct.Permute, %struct.Permute* %this, i32 0, i32 1
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !17
  %25 = sext i32 %j to i64
  %26 = load i32, i32* %tmp.addr, align 4
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %25
  store i32 %26, i32* %30, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %p.addr = alloca %struct.Permute*, align 8
  %Permute.obj = alloca %struct.Permute, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Permute.constructor(%struct.Permute* %Permute.obj)
  store %struct.Permute* %Permute.obj, %struct.Permute** %p.addr, align 8
  %0 = load %struct.Permute*, %struct.Permute** %p.addr, align 8
  %1 = call i32 @Permute.benchmark(%struct.Permute* %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Permute", !2, i64 0, !3, i64 8}
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
