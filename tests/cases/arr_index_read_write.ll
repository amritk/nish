%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @set(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %a, i32 noundef %i, i32 noundef %v) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  store i32 %v, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define internal noundef i32 @get(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %i) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %5
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @set(%struct.nish_array* %8, i32 1, i32 42)
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %15 = add nsw i32 %14, 5
  store i32 %15, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 2
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %22 = mul nsw i32 %21, 10
  store i32 %22, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %23 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %24 = call i32 @get(%struct.nish_array* %23, i32 0)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 1
  %31 = load i32, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 2
  %38 = load i32, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }

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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
