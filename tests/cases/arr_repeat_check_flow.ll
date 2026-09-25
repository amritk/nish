%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i32 @inBranch(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i, i1 noundef zeroext %c) #0 {
entry:
  %a.addr = alloca i32, align 4
  store i32 0, i32* %a.addr, align 4
  br i1 %c, label %if.then, label %if.end

if.then:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store i32 %5, i32* %a.addr, align 4
  br label %if.end

if.end:
  %6 = load i32, i32* %a.addr, align 4
  %7 = sext i32 %i to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %7
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = add nsw i32 %6, %12
  ret i32 %13
}

define internal noundef i32 @shortCircuit(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i, i1 noundef zeroext %c) #0 {
entry:
  %a.addr = alloca i32, align 4
  store i32 0, i32* %a.addr, align 4
  br i1 %c, label %land.rhs, label %land.end

land.rhs:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = icmp sgt i32 %5, 0
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  store i32 1, i32* %a.addr, align 4
  br label %if.end

if.end:
  %8 = load i32, i32* %a.addr, align 4
  %9 = sext i32 %i to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %9
  %14 = load i32, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %15 = add nsw i32 %8, %14
  ret i32 %15
}

define internal noundef i32 @ternary(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i, i1 noundef zeroext %c) #0 {
entry:
  %a.addr = alloca i32, align 4
  br i1 %c, label %cond.true, label %cond.false

cond.true:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %6 = phi i32 [ %5, %cond.true ], [ 0, %cond.false ]
  store i32 %6, i32* %a.addr, align 4
  %7 = load i32, i32* %a.addr, align 4
  %8 = sext i32 %i to i64
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %8
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %14 = add nsw i32 %7, %13
  ret i32 %14
}

define internal noundef i32 @inLoop(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i, i32 noundef %n) #1 {
entry:
  %total.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.cond

for.cond:
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp slt i32 %2, %n
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %total.addr, align 4
  %5 = sext i32 %i to i64
  %6 = bitcast i8* %1 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %5
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %9 = add nsw i32 %4, %8
  store i32 %9, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %10 = load i32, i32* %k.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %12 = load i32, i32* %total.addr, align 4
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %19 = add nsw i32 %12, %18
  ret i32 %19
}

define internal noundef i32 @backEdge(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #2 {
entry:
  %total.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %while.cond

while.cond:
  %4 = load i32, i32* %total.addr, align 4
  %5 = icmp slt i32 %4, 5
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = load i32, i32* %total.addr, align 4
  %7 = load i32, i32* %k.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = icmp ult i64 %8, %1
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %1)
  unreachable

bounds.ok:
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %8
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %13 = add nsw i32 %6, %12
  store i32 %13, i32* %total.addr, align 4
  %14 = load i32, i32* %k.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %16 = load i32, i32* %total.addr, align 4
  ret i32 %16
}

define internal noundef i32 @inCondition(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = sext i32 %i to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %7
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %12

if.end:
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %19 = add nsw i32 %18, 1
  ret i32 %19
}

define noundef i32 @test() #2 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = call i32 @inBranch(%struct.nish_array* %8, i32 1, i1 false)
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %11 = call i32 @shortCircuit(%struct.nish_array* %10, i32 1, i1 false)
  %12 = add nsw i32 %9, %11
  %13 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %14 = call i32 @ternary(%struct.nish_array* %13, i32 1, i1 false)
  %15 = add nsw i32 %12, %14
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = call i32 @inLoop(%struct.nish_array* %16, i32 1, i32 0)
  %18 = add nsw i32 %15, %17
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = call i32 @backEdge(%struct.nish_array* %19)
  %21 = add nsw i32 %18, %20
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %23 = call i32 @inCondition(%struct.nish_array* %22, i32 2)
  %24 = add nsw i32 %21, %23
  ret i32 %24
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind }
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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
