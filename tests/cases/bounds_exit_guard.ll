%struct.nish_array = type { i64, i64, i8* }

declare void @nish_exit(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @sumAt(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %at) #0 {
entry:
  %total.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %at, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %at, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %8 = load i32, i32* %k.addr, align 4
  %9 = trunc i64 %1 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %k.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %3 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %15, i32* %i.addr, align 4
  %16 = load i32, i32* %i.addr, align 4
  %17 = icmp slt i32 %16, 0
  br i1 %17, label %lor.end, label %lor.rhs

lor.rhs:
  %18 = load i32, i32* %i.addr, align 4
  %19 = trunc i64 %5 to i32
  %20 = icmp sge i32 %18, %19
  br label %lor.end

lor.end:
  %21 = phi i1 [ true, %for.body ], [ %20, %lor.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  call void @nish_exit(i32 3)
  unreachable

if.end:
  %22 = load i32, i32* %total.addr, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = bitcast i8* %7 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %24
  %27 = load i32, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %29, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %31 = load i32, i32* %k.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %33 = load i32, i32* %total.addr, align 4
  ret i32 %33

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 10, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 20, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 30, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %10 = bitcast [4 x i32]* %arr.data.1 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 2, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 0, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %15 = getelementptr inbounds i32, i32* %12, i64 2
  store i32 1, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = getelementptr inbounds i32, i32* %12, i64 3
  store i32 2, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = call i32 @sumAt(%struct.nish_array* %arr.hdr, %struct.nish_array* %arr.hdr.1)
  ret i32 %17
}

attributes #0 = { nounwind }
attributes #1 = { noreturn nounwind }
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
