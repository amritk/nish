%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @insertionSort(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %i.addr = alloca i32, align 4
  %key.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 1, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %11, i32* %key.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = sub nsw i32 %12, 1
  store i32 %13, i32* %j.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %18 = load i32, i32* %j.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %j.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %17 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = load i32, i32* %key.addr, align 4
  %26 = icmp sgt i32 %24, %25
  br label %land.end

land.end:
  %27 = phi i1 [ false, %while.cond ], [ %26, %land.rhs ]
  br i1 %27, label %while.body, label %while.end

while.body:
  %28 = load i32, i32* %j.addr, align 4
  %29 = add nsw i32 %28, 1
  %30 = sext i32 %29 to i64
  %31 = load i32, i32* %j.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = bitcast i8* %17 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %32
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = icmp ult i64 %30, %15
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %30, i64 %15)
  unreachable

bounds.ok:
  %37 = bitcast i8* %17 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 %30
  store i32 %35, i32* %38, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %39 = load i32, i32* %j.addr, align 4
  %40 = sub nsw i32 %39, 1
  store i32 %40, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %41 = load i32, i32* %j.addr, align 4
  %42 = add nsw i32 %41, 1
  %43 = sext i32 %42 to i64
  %44 = load i32, i32* %key.addr, align 4
  %45 = icmp ult i64 %43, %1
  br i1 %45, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %43, i64 %1)
  unreachable

bounds.ok.1:
  %46 = bitcast i8* %3 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %43
  store i32 %44, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %48 = load i32, i32* %i.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [20 x i32], align 8
  %line.addr = alloca i8*, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = sub nsw i32 0, 4
  %1 = sub nsw i32 0, 12
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 20, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 20, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = bitcast [20 x i32]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 17, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 3, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 99, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 %0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 42, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 8, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = getelementptr inbounds i32, i32* %6, i64 6
  store i32 0, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = getelementptr inbounds i32, i32* %6, i64 7
  store i32 23, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = getelementptr inbounds i32, i32* %6, i64 8
  store i32 15, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = getelementptr inbounds i32, i32* %6, i64 9
  store i32 61, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = getelementptr inbounds i32, i32* %6, i64 10
  store i32 7, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = getelementptr inbounds i32, i32* %6, i64 11
  store i32 88, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = getelementptr inbounds i32, i32* %6, i64 12
  store i32 %1, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %20 = getelementptr inbounds i32, i32* %6, i64 13
  store i32 5, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = getelementptr inbounds i32, i32* %6, i64 14
  store i32 30, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %22 = getelementptr inbounds i32, i32* %6, i64 15
  store i32 2, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = getelementptr inbounds i32, i32* %6, i64 16
  store i32 71, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %24 = getelementptr inbounds i32, i32* %6, i64 17
  store i32 19, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %25 = getelementptr inbounds i32, i32* %6, i64 18
  store i32 44, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %26 = getelementptr inbounds i32, i32* %6, i64 19
  store i32 1, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @insertionSort(%struct.nish_array* %27)
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %line.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ult i64 %29, %31
  br i1 %32, label %forof.body, label %forof.end

forof.body:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %29
  %37 = load i32, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %37, i32* %x.addr, align 4
  %38 = load i8*, i8** %line.addr, align 8
  %39 = load i32, i32* %x.addr, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %38, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %42, i8** %line.addr, align 8
  br label %forof.inc

forof.inc:
  %43 = load i64, i64* %forof.idx, align 8
  %44 = add i64 %43, 1
  store i64 %44, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %45 = load i8*, i8** %line.addr, align 8
  call void @nish_print(i8* %45)
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
