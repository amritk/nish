%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @sumOdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %s.addr = alloca i32, align 4
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %last.addr, align 4
  store i32 -1, i32* %i.addr, align 4
  store i32 0, i32* %n.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 100
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %n.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %n.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 0
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load i32, i32* %i.addr, align 4
  %13 = trunc i64 %1 to i32
  %14 = icmp sge i32 %12, %13
  br label %lor.end

lor.end:
  %15 = phi i1 [ true, %for.body ], [ %14, %lor.rhs ]
  br i1 %15, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %3 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %21 = srem i32 %20, 2
  %22 = icmp eq i32 %21, 0
  br i1 %22, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.inc

if.end.1:
  %23 = load i32, i32* %s.addr, align 4
  %24 = load i32, i32* %i.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = bitcast i8* %3 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %25
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %29 = add nsw i32 %23, %28
  store i32 %29, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = bitcast i8* %3 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 %31
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %34, i32* %last.addr, align 4
  br label %for.cond

for.end:
  %35 = load i32, i32* %s.addr, align 4
  %36 = load i32, i32* %last.addr, align 4
  %37 = mul nsw i32 %36, 0
  %38 = add nsw i32 %35, %37
  ret i32 %38
}

define internal noundef i32 @countOdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %odd.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %odd.addr, align 4
  store i32 -1, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %do.body

do.body:
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 0
  br i1 %7, label %lor.end, label %lor.rhs

lor.rhs:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %1 to i32
  %10 = icmp sge i32 %8, %9
  br label %lor.end

lor.end:
  %11 = phi i1 [ true, %do.body ], [ %10, %lor.rhs ]
  br i1 %11, label %if.then, label %if.end

if.then:
  br label %do.end

if.end:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %3 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = srem i32 %16, 2
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  br label %do.cond

if.end.1:
  %19 = load i32, i32* %odd.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %odd.addr, align 4
  br label %do.cond

do.cond:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %26 = icmp sgt i32 %25, 0
  br i1 %26, label %do.body, label %do.end

do.end:
  %27 = load i32, i32* %odd.addr, align 4
  ret i32 %27
}

define noundef i32 @nish_main() #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [7 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 4, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 1, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 5, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds i32, i32* %4, i64 6
  store i32 9, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = call i32 @sumOdd(%struct.nish_array* %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = call i32 @countOdd(%struct.nish_array* %16)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %15, i8* %18)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }

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
