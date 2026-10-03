%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"one\0A\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"two\0A\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"build/test/panics_io_exit.txt\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_append_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_random_fill(%struct.nish_array* noundef nonnull align 8 nocapture) #1

define internal void @save(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  call void @nish_write_file(i8* %path, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  call void @nish_append_file(i8* %path, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  ret void
}

define internal noundef nonnull align 8 i8* @load(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %0 = call i8* @nish_read_file(i8* %path)
  ret i8* %0
}

define internal noundef nonnull align 8 i8* @tryLoad(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %text.addr = alloca i8*, align 8
  %0 = call i8* @nish_read_file_or_null(i8* %path)
  store i8* %0, i8** %text.addr, align 8
  %1 = load i8*, i8** %text.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*)

if.end:
  %3 = load i8*, i8** %text.addr, align 8
  ret i8* %3
}

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes) #1 {
entry:
  call void @nish_random_fill(%struct.nish_array* %bytes)
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %path.addr = alloca i8*, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [30 x i8] }* @.str.3 to i8*), i8** %path.addr, align 8
  %0 = load i8*, i8** %path.addr, align 8
  call void @save(i8* %0)
  %1 = load i8*, i8** %path.addr, align 8
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @load(i8* %1)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i8*, i8** %path.addr, align 8
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @tryLoad(i8* %9)
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast [4 x i8]* %arr.data to i8*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %19, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %19 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 0
  store i8 0, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = getelementptr inbounds i8, i8* %21, i64 1
  store i8 0, i8* %23, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %24 = getelementptr inbounds i8, i8* %21, i64 2
  store i8 0, i8* %24, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = getelementptr inbounds i8, i8* %21, i64 3
  store i8 0, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %26 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  call void @fill(%struct.nish_array* %26)
  %27 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  %31 = call i8* @nish_str_from_i32(i32 %30)
  call void @nish_print(i8* %31)
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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
