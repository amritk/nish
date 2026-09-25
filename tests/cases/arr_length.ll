%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i32 @len(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define internal noundef nonnull align 8 i8* @last(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i8**
  %11 = getelementptr inbounds i8*, i8** %10, i64 %4
  %12 = load i8*, i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8* %12
}

define noundef i32 @nish_main() #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i32], align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i8*], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [5 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 5, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %10 = call i32 @len(%struct.nish_array* %arr.hdr)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %empty.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %16 = call i32 @len(%struct.nish_array* %15)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %20 = bitcast [3 x i8*]* %arr.data.1 to i8*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = bitcast i8* %20 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %24 = getelementptr inbounds i8*, i8** %22, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = getelementptr inbounds i8*, i8** %22, i64 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %26 = call i8* @last(%struct.nish_array* %arr.hdr.2)
  call void @nish_print(i8* %26)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

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
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
