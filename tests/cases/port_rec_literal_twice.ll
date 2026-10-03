%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
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
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %ps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point], align 8
  %o.addr = alloca %struct.Point*, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %qs.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 2, i32* %1, align 4
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %2 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %3 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [2 x %struct.Point]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to %struct.Point*
  %9 = getelementptr inbounds %struct.Point, %struct.Point* %8, i64 0
  %10 = bitcast %struct.Point* %9 to i8*
  %11 = bitcast %struct.Point* %2 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %10, i8* align 4 %11, i64 8, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.Point, %struct.Point* %8, i64 1
  %13 = bitcast %struct.Point* %12 to i8*
  %14 = bitcast %struct.Point* %3 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %13, i8* align 4 %14, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to %struct.Point*
  %19 = getelementptr inbounds %struct.Point, %struct.Point* %18, i64 0
  %20 = getelementptr inbounds %struct.Point, %struct.Point* %19, i32 0, i32 0
  store i32 5, i32* %20, align 4
  %21 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to %struct.Point*
  %25 = getelementptr inbounds %struct.Point, %struct.Point* %24, i64 1
  %26 = getelementptr inbounds %struct.Point, %struct.Point* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  %29 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 1, i32* %29, align 4
  %30 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 2, i32* %30, align 4
  store %struct.Point* %Point.obj.1, %struct.Point** %o.addr, align 8
  %31 = call i8* @nish_alloc_struct(i64 24)
  %32 = bitcast i8* %31 to %struct.nish_array*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  store i64 0, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  store i64 0, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  store i8* null, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %32, %struct.nish_array** %qs.addr, align 8
  %36 = load %struct.Point*, %struct.Point** %o.addr, align 8
  %37 = call i8* @nish_alloc_struct(i64 24)
  %38 = bitcast i8* %37 to %struct.nish_array*
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  store i64 1, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 1
  store i64 1, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = call i8* @nish_alloc_struct(i64 8)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  store i8* %41, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %41 to %struct.Point*
  %44 = getelementptr inbounds %struct.Point, %struct.Point* %43, i64 0
  %45 = bitcast %struct.Point* %44 to i8*
  %46 = bitcast %struct.Point* %36 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %45, i8* align 4 %46, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %38, %struct.nish_array** %qs.addr, align 8
  %47 = load %struct.Point*, %struct.Point** %o.addr, align 8
  %48 = getelementptr inbounds %struct.Point, %struct.Point* %47, i32 0, i32 1
  store i32 3, i32* %48, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %qs.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to %struct.Point*
  %53 = getelementptr inbounds %struct.Point, %struct.Point* %52, i64 0
  %54 = getelementptr inbounds %struct.Point, %struct.Point* %53, i32 0, i32 1
  %55 = load i32, i32* %54, align 4
  %56 = call i8* @nish_str_from_i32(i32 %55)
  call void @nish_print(i8* %56)
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
