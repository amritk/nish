%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"admin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"guest\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.enumstr.Role = private unnamed_addr constant [3 x i8*] [i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*)], align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

define internal noundef i32 @rank(i32 noundef %r) #0 {
entry:
  switch i32 %r, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  ret i32 3

sw.case.1:
  ret i32 1

sw.default:
  ret i32 0
}

define noundef i32 @test() #1 {
entry:
  %roles.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 0, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 2, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %roles.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %roles.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %17, i32* %r.addr, align 4
  %18 = load i32, i32* %r.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds [3 x i8*], [3 x i8*]* @.enumstr.Role, i64 0, i64 %19
  %21 = load i8*, i8** %20, align 8
  call void @nish_print(i8* %21)
  %22 = load i32, i32* %total.addr, align 4
  %23 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %22, i32 10)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = load i32, i32* %r.addr, align 4
  %27 = call i32 @rank(i32 %26)
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %29, i32* %total.addr, align 4
  %31 = load i32, i32* %r.addr, align 4
  %32 = icmp ne i32 %31, 1
  br i1 %32, label %if.then, label %if.end

if.then:
  %33 = load i32, i32* %total.addr, align 4
  %34 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %33, i32 10)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %35, i32* %total.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %37 = load i64, i64* %forof.idx, align 8
  %38 = add i64 %37, 1
  store i64 %38, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %39 = load i32, i32* %total.addr, align 4
  ret i32 %39

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 0, %ovf.ok ], [ 2, %if.then ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
