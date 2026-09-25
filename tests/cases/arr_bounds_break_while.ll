%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  br label %while.cond

while.cond:
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 6, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 6, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %12 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 1, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds i32, i32* %14, i64 1
  store i32 2, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds i32, i32* %14, i64 2
  store i32 3, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i32, i32* %14, i64 3
  store i32 4, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds i32, i32* %14, i64 4
  store i32 5, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds i32, i32* %14, i64 5
  store i32 6, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %9, %struct.nish_array** %xs.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = icmp sgt i32 %23, 0
  br i1 %24, label %while.body, label %while.end

while.body:
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 1, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 1, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = call i8* @nish_alloc_struct(i64 4)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %29 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 0
  store i32 1, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %26, %struct.nish_array** %xs.addr, align 8
  br label %while.end

while.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 5, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 5, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 5
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
