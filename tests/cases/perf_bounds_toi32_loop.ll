%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %lastIndex.addr = alloca i32, align 4
  %codes.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %bound.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 2, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %8 = load i8*, i8** %s.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = sub nsw i32 %11, 1
  store i32 %12, i32* %lastIndex.addr, align 4
  store i32 0, i32* %codes.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %lastIndex.addr, align 4
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %codes.addr, align 4
  %17 = load i8*, i8** %s.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %17 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds i8, i8* %17, i64 8
  %24 = getelementptr inbounds i8, i8* %23, i64 %19
  %25 = load i8, i8* %24, align 1
  %26 = zext i8 %25 to i32
  %27 = add nsw i32 %16, %26
  store i32 %27, i32* %codes.addr, align 4
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %35, i32* %bound.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %j.addr, align 4
  %36 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %41 = load i32, i32* %j.addr, align 4
  %42 = load i32, i32* %bound.addr, align 4
  %43 = icmp slt i32 %41, %42
  br i1 %43, label %while.body.1, label %while.end.1

while.body.1:
  %44 = load i32, i32* %total.addr, align 4
  %45 = load i32, i32* %j.addr, align 4
  %46 = sext i32 %45 to i64
  %47 = icmp ult i64 %46, %38
  br i1 %47, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %46, i64 %38)
  unreachable

bounds.ok.1:
  %48 = bitcast i8* %40 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %46
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = add nsw i32 %44, %50
  store i32 %51, i32* %total.addr, align 4
  %52 = load i32, i32* %j.addr, align 4
  %53 = add nsw i32 %52, 1
  store i32 %53, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %54 = load i32, i32* %codes.addr, align 4
  %55 = call i8* @nish_str_from_i32(i32 %54)
  call void @nish_print(i8* %55)
  %56 = load i32, i32* %total.addr, align 4
  %57 = call i8* @nish_str_from_i32(i32 %56)
  call void @nish_print(i8* %57)
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
