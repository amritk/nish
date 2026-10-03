%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1

define noundef i32 @nish_main() #0 {
entry:
  %low.addr = alloca i32, align 4
  %kept.addr = alloca i32, align 4
  %widened.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %wide.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 7, i32* %low.addr, align 4
  %0 = load i32, i32* %low.addr, align 4
  store i32 %0, i32* %kept.addr, align 4
  %1 = load i32, i32* %low.addr, align 4
  store i32 %1, i32* %widened.addr, align 4
  %2 = load i32, i32* %widened.addr, align 4
  %3 = add nsw i32 %2, 100
  store i32 %3, i32* %widened.addr, align 4
  %4 = load i32, i32* %low.addr, align 4
  %5 = load i32, i32* %kept.addr, align 4
  %6 = add nsw i32 %4, %5
  store i32 %6, i32* %sum.addr, align 4
  %7 = load i32, i32* %low.addr, align 4
  %8 = sext i32 %7 to i64
  store i64 %8, i64* %wide.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast [8 x i32]* %arr.data to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 0
  store i32 5, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i32, i32* %13, i64 1
  store i32 6, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds i32, i32* %13, i64 2
  store i32 7, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds i32, i32* %13, i64 3
  store i32 8, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i32, i32* %13, i64 4
  store i32 9, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds i32, i32* %13, i64 5
  store i32 10, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds i32, i32* %13, i64 6
  store i32 11, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds i32, i32* %13, i64 7
  store i32 12, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %22 = load i32, i32* %kept.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = load i32, i32* %widened.addr, align 4
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %24, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %29 = load i32, i32* %sum.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %28, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load i64, i64* %wide.addr, align 8
  %34 = call i8* @nish_str_from_i64(i64 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %37 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %38 = load i32, i32* %low.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %36, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %48 = load i32, i32* %low.addr, align 4
  %49 = icmp slt i32 %48, 9
  %50 = select i1 %49, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %51 = call i8* @nish_str_concat(i8* %47, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %53 = load i32, i32* %low.addr, align 4
  %54 = sub nsw i32 0, %53
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %52, i8* %55)
  call void @nish_print(i8* %56)
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
