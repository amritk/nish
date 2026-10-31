%struct.nish_array = type { i64, i64, i8* }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @classify(i32 noundef %n) #0 {
entry:
  %kind.addr = alloca i32, align 4
  store i32 0, i32* %kind.addr, align 4
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  store i32 1, i32* %kind.addr, align 4
  br label %label.end

if.end:
  %1 = icmp eq i32 %n, 0
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  store i32 2, i32* %kind.addr, align 4
  br label %label.end

if.end.1:
  store i32 3, i32* %kind.addr, align 4
  br label %label.end

label.end:
  %2 = load i32, i32* %kind.addr, align 4
  %3 = mul nsw i32 %2, 10
  ret i32 %3
}

define internal noundef i32 @scan(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %hits.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %hits.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  %10 = srem i32 %9, 2
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  br label %label.end

if.end:
  %12 = load i32, i32* %hits.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %hits.addr, align 4
  br label %label.end

label.end:
  %17 = load i32, i32* %hits.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 100)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %19, i32* %hits.addr, align 4
  br label %forof.inc

forof.inc:
  %21 = load i64, i64* %forof.idx, align 8
  %22 = add i64 %21, 1
  store i64 %22, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %23 = load i32, i32* %hits.addr, align 4
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %0 = call i32 @classify(i32 -4)
  %1 = call i32 @classify(i32 0)
  %2 = add nsw i32 %0, %1
  %3 = call i32 @classify(i32 9)
  %4 = add nsw i32 %2, %3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = bitcast [4 x i32]* %arr.data to i8*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %7 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 0
  store i32 1, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds i32, i32* %9, i64 1
  store i32 2, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = getelementptr inbounds i32, i32* %9, i64 2
  store i32 3, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %13 = getelementptr inbounds i32, i32* %9, i64 3
  store i32 4, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = call i32 @scan(%struct.nish_array* %arr.hdr)
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
