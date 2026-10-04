%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

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
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %28, i32* %codes.addr, align 4
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %32 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 0
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %37, i32* %bound.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %j.addr, align 4
  %38 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %43 = load i32, i32* %j.addr, align 4
  %44 = load i32, i32* %bound.addr, align 4
  %45 = icmp slt i32 %43, %44
  br i1 %45, label %while.body.1, label %while.end.1

while.body.1:
  %46 = load i32, i32* %total.addr, align 4
  %47 = load i32, i32* %j.addr, align 4
  %48 = sext i32 %47 to i64
  %49 = icmp ult i64 %48, %40
  br i1 %49, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %48, i64 %40)
  unreachable

bounds.ok.1:
  %50 = bitcast i8* %42 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 %48
  %52 = load i32, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 %52)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %54, i32* %total.addr, align 4
  %56 = load i32, i32* %j.addr, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %58 = load i32, i32* %codes.addr, align 4
  %59 = call i8* @nish_str_from_i32(i32 %58)
  call void @nish_print(i8* %59)
  %60 = load i32, i32* %total.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  call void @nish_print(i8* %61)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #3 = { nounwind willreturn readnone }

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
