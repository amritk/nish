%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)

define noundef i32 @sumBytes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp slt i32 %2, 256
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 256
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %sum.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %10
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = zext i8 %13 to i32
  %15 = add nsw i32 %8, %14
  store i32 %15, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %18 = load i32, i32* %sum.addr, align 4
  ret i32 %18
}

define internal noundef i32 @countEven(i32 noundef %n) #1 {
entry:
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sle i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = and i32 %2, 1
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load i32, i32* %count.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %count.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i32, i32* %count.addr, align 4
  ret i32 %9
}

define noundef i32 @test() #2 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [256 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 256, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 256, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [256 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 256, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i32 @sumBytes(%struct.nish_array* %arr.hdr)
  %5 = call i32 @countEven(i32 1000)
  %6 = add nsw i32 %4, %5
  ret i32 %6
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind readnone }
attributes #2 = { nounwind readonly }

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
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
