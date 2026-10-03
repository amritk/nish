%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"plain\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"hello there\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"t\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c" starts with p\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8

declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  %sizes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %built.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %0 = load i8*, i8** %word.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = bitcast i8* bitcast ({ i64, [12 x i8] }* @.str.1 to i8*) to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = call i64 @nish_str_index_of(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %10 = trunc i64 %9 to i32
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 2)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %14)
  %15 = load i8*, i8** %word.addr, align 8
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = call i64 @nish_str_index_of(i8* bitcast ({ i64, [12 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %20 = trunc i64 %19 to i32
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = bitcast [2 x i32]* %arr.data to i8*
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %23 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  store i32 %18, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = getelementptr inbounds i32, i32* %25, i64 1
  store i32 %20, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %sizes.addr, align 8
  %28 = load i8*, i8** %word.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = icmp ult i64 0, %30
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %30)
  unreachable

bounds.ok:
  %32 = getelementptr inbounds i8, i8* %28, i64 8
  %33 = getelementptr inbounds i8, i8* %32, i64 0
  %34 = load i8, i8* %33, align 1
  %35 = zext i8 %34 to i32
  %36 = icmp eq i32 %35, 112
  br i1 %36, label %land.rhs, label %land.end

land.rhs:
  %37 = load %struct.nish_array*, %struct.nish_array** %sizes.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 0
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = icmp sgt i32 %42, 3
  br label %land.end

land.end:
  %44 = phi i1 [ false, %bounds.ok ], [ %43, %land.rhs ]
  br i1 %44, label %if.then, label %if.end

if.then:
  %45 = load i8*, i8** %word.addr, align 8
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [15 x i8] }* @.str.5 to i8*))
  call void @nish_print(i8* %46)
  br label %if.end

if.end:
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %built.addr, align 8
  %47 = load i8*, i8** %built.addr, align 8
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  store i8* %48, i8** %built.addr, align 8
  %49 = load i8*, i8** %built.addr, align 8
  %50 = bitcast i8* %49 to i64*
  %51 = load i64, i64* %50, align 8
  %52 = trunc i64 %51 to i32
  %53 = call i8* @nish_str_from_i32(i32 %52)
  call void @nish_print(i8* %53)
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
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

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
