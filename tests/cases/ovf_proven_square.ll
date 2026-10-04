%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @marks(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %composite, i32 noundef %n) #0 {
entry:
  %marked.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 0, i32* %marked.addr, align 4
  store i32 2, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %composite, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %composite, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = load i32, i32* %i.addr, align 4
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = icmp sle i32 %7, %n
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = load i32, i32* %i.addr, align 4
  %12 = mul nsw i32 %10, %11
  store i32 %12, i32* %j.addr, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %composite, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %composite, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %17 = load i32, i32* %j.addr, align 4
  %18 = icmp sle i32 %17, %n
  br i1 %18, label %for.body.1, label %for.end.1

for.body.1:
  %19 = load i32, i32* %j.addr, align 4
  %20 = icmp sge i32 %19, 0
  br i1 %20, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %21 = load i32, i32* %j.addr, align 4
  %22 = trunc i64 %14 to i32
  %23 = icmp slt i32 %21, %22
  br label %land.end.1

land.end.1:
  %24 = phi i1 [ false, %for.body.1 ], [ %23, %land.rhs.1 ]
  br i1 %24, label %land.rhs, label %land.end

land.rhs:
  %25 = load i32, i32* %j.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %16 to i1*
  %28 = getelementptr inbounds i1, i1* %27, i64 %26
  %29 = load i1, i1* %28, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %30 = xor i1 %29, true
  br label %land.end

land.end:
  %31 = phi i1 [ false, %land.end.1 ], [ %30, %land.rhs ]
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %j.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %16 to i1*
  %35 = getelementptr inbounds i1, i1* %34, i64 %33
  store i1 true, i1* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = load i32, i32* %marked.addr, align 4
  %37 = load i32, i32* %j.addr, align 4
  %38 = xor i32 %36, %37
  store i32 %38, i32* %marked.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %39 = load i32, i32* %j.addr, align 4
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %39, %40
  store i32 %41, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %42 = load i32, i32* %i.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %44 = load i32, i32* %marked.addr, align 4
  ret i32 %44

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1001 x i1], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1001, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1001, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [1001 x i1]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 1001, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i32 @marks(%struct.nish_array* %arr.hdr, i32 1000)
  ret i32 %4
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

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
!12 = !{!"element i1", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
