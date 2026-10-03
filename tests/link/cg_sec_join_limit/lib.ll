%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0

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

define noundef nonnull align 8 i8* @doubled(i8* noundef nonnull noalias readonly align 8 %s, i32 noundef %times) #0 {
entry:
  %out.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* %s, i8** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %times
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i8*, i8** %out.addr, align 8
  %3 = load i8*, i8** %out.addr, align 8
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  store i8* %4, i8** %out.addr, align 8
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %7 = load i8*, i8** %out.addr, align 8
  ret i8* %7
}

define noundef i32 @joinedLength(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %parts, i8* noundef nonnull noalias readonly align 8 nocapture %sep) #1 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %sep to i64*
  %3 = load i64, i64* %2, align 8
  %4 = sub i64 %1, 1
  %5 = mul i64 %3, %4
  %6 = icmp eq i64 %1, 0
  %7 = select i1 %6, i64 0, i64 %5
  store i64 %7, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %8 = load i64, i64* %join.at, align 8
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %join.sum.body, label %join.copy

join.sum.body:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %8
  %14 = load i8*, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = load i64, i64* %join.total, align 8
  %16 = bitcast i8* %14 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = add i64 %15, %17
  store i64 %18, i64* %join.total, align 8
  %19 = add i64 %8, 1
  store i64 %19, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %20 = load i64, i64* %join.total, align 8
  %21 = icmp ugt i64 %20, 2147483647
  %22 = add i64 %20, 9
  %23 = select i1 %21, i64 4611686018427387904, i64 %22
  %24 = call i8* @nish_alloc_struct(i64 %23)
  %25 = bitcast i8* %24 to i64*
  store i64 %20, i64* %25, align 8
  %26 = getelementptr inbounds i8, i8* %24, i64 8
  store i8* %26, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %27 = load i64, i64* %join.at, align 8
  %28 = icmp ult i64 %27, %1
  br i1 %28, label %join.part, label %join.end

join.part:
  %29 = load i8*, i8** %join.p, align 8
  %30 = icmp eq i64 %27, 0
  %31 = select i1 %30, i64 0, i64 %3
  %32 = getelementptr inbounds i8, i8* %sep, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %29, i8* %32, i64 %31, i1 false)
  %33 = getelementptr inbounds i8, i8* %29, i64 %31
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %parts, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %27
  %38 = load i8*, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %39 = bitcast i8* %38 to i64*
  %40 = load i64, i64* %39, align 8
  %41 = getelementptr inbounds i8, i8* %38, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %33, i8* %41, i64 %40, i1 false)
  %42 = getelementptr inbounds i8, i8* %33, i64 %40
  store i8* %42, i8** %join.p, align 8
  %43 = add i64 %27, 1
  store i64 %43, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %44 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %44, align 1
  %45 = bitcast i8* %24 to i64*
  %46 = load i64, i64* %45, align 8
  %47 = trunc i64 %46 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %47
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

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
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
