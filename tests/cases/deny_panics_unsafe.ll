%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1

define internal noundef i32 @get(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %5
}

define internal void @mark(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes, i32 noundef %i) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = trunc i32 7 to i8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %3 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  store i8 %1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret void
}

define internal noundef i32 @first(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = call i32 @get(%struct.nish_array* %xs, i32 0)
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 10, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 20, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 30, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %words.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %9 = call i32 @get(%struct.nish_array* %8, i32 2)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %12 = call i32 @first(%struct.nish_array* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !15
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %16 = bitcast [3 x i8]* %arr.data.1 to i8*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = bitcast i8* %16 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 0
  store i8 1, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds i8, i8* %18, i64 1
  store i8 2, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds i8, i8* %18, i64 2
  store i8 3, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %bytes.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  call void @mark(%struct.nish_array* %22, i32 1)
  %23 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = bitcast i8* %25 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 1
  %28 = load i8, i8* %27, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = zext i8 %28 to i64
  %30 = call i8* @nish_str_from_u64(i64 %29)
  call void @nish_print(i8* %30)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!9, !7, i64 0}
!16 = !{!9, !7, i64 8}
