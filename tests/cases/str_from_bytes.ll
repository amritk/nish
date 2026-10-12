%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"[\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"] \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define internal noundef nonnull align 8 i8* @word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %start, i32 noundef %end) #0 {
entry:
  %0 = sext i32 %start to i64
  %1 = sext i32 %end to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ule i64 %0, %1
  %5 = icmp ule i64 %1, %3
  %6 = and i1 %4, %5
  br i1 %6, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 %0, i64 %1, i64 %3)
  unreachable

bytes.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %0
  %10 = sub i64 %1, %0
  %11 = call i8* @nish_str_new(i8* %9, i64 %10)
  ret i8* %11
}

define internal noundef nonnull align 8 i8* @fixed(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ule i64 0, 2
  %3 = icmp ule i64 2, %1
  %4 = and i1 %2, %3
  br i1 %4, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 2, i64 %1)
  unreachable

bytes.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  %8 = sub i64 2, 0
  %9 = call i8* @nish_str_new(i8* %7, i64 %8)
  ret i8* %9
}

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %empty.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 104, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 101, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 108, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 108, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 111, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %4, i64 5
  store i8 32, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8, i8* %4, i64 6
  store i8 195, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8, i8* %4, i64 7
  store i8 169, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @word(%struct.nish_array* %13, i32 0, i32 5)
  %16 = call i8* @nish_arena_keep(i64 %14, i8* %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %18 = call i64 @nish_arena_mark()
  %19 = call i8* @word(%struct.nish_array* %17, i32 6, i32 8)
  %20 = call i8* @nish_arena_keep(i64 %18, i8* %19)
  call void @nish_print(i8* %20)
  %21 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @word(%struct.nish_array* %21, i32 3, i32 3)
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  store i8* %24, i8** %empty.addr, align 8
  %25 = load i8*, i8** %empty.addr, align 8
  %26 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %28 = load i8*, i8** %empty.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = trunc i64 %30 to i32
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %27, i8* %32)
  call void @nish_print(i8* %33)
  %34 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = trunc i64 %37 to i32
  %39 = call i64 @nish_arena_mark()
  %40 = call i8* @word(%struct.nish_array* %34, i32 0, i32 %38)
  %41 = call i8* @nish_arena_keep(i64 %39, i8* %40)
  %42 = bitcast i8* %41 to i64*
  %43 = load i64, i64* %42, align 8
  %44 = trunc i64 %43 to i32
  %45 = call i8* @nish_str_from_i32(i32 %44)
  call void @nish_print(i8* %45)
  %46 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %47 = call i64 @nish_arena_mark()
  %48 = call i8* @fixed(%struct.nish_array* %46)
  %49 = call i8* @nish_arena_keep(i64 %47, i8* %48)
  call void @nish_print(i8* %49)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

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
