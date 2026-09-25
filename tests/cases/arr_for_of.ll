%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8

declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  %10 = icmp slt i32 %9, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  br label %forof.inc

if.end:
  %11 = load i32, i32* %x.addr, align 4
  %12 = icmp sgt i32 %11, 100
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  br label %forof.end

if.end.1:
  %13 = load i32, i32* %sum.addr, align 4
  %14 = load i32, i32* %x.addr, align 4
  %15 = add nsw i32 %13, %14
  store i32 %15, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %18 = load i32, i32* %sum.addr, align 4
  ret i32 %18
}

define noundef i32 @nish_main() #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [5 x i32], align 8
  %word.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8*], align 8
  %0 = sub nsw i32 0, 2
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 5, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 5, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = bitcast [5 x i32]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4
  %5 = bitcast i8* %3 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %7 = getelementptr inbounds i32, i32* %5, i64 1
  store i32 %0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %8 = getelementptr inbounds i32, i32* %5, i64 2
  store i32 3, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %9 = getelementptr inbounds i32, i32* %5, i64 3
  store i32 500, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %10 = getelementptr inbounds i32, i32* %5, i64 4
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %11 = call i32 @total(%struct.nish_array* %arr.hdr)
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %13, align 8, !alias.scope !3, !noalias !4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %14, align 8, !alias.scope !3, !noalias !4
  %15 = bitcast [2 x i8*]* %arr.data.1 to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %15 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  %19 = getelementptr inbounds i8*, i8** %17, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %20 = load i64, i64* %forof.idx, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %forof.body, label %forof.end

forof.body:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4
  %26 = bitcast i8* %25 to i8**
  %27 = getelementptr inbounds i8*, i8** %26, i64 %20
  %28 = load i8*, i8** %27, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  store i8* %28, i8** %word.addr, align 8
  %29 = load i8*, i8** %word.addr, align 8
  %30 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store i8* %31, i8** %word.addr, align 8
  %32 = load i8*, i8** %word.addr, align 8
  call void @nish_print(i8* %32)
  br label %forof.inc

forof.inc:
  %33 = load i64, i64* %forof.idx, align 8
  %34 = add i64 %33, 1
  store i64 %34, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
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
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
!9 = !{!"element ptr", !6, i64 0}
!10 = !{!9, !9, i64 0}
