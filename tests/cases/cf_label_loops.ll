%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef i32 @firstPair(i32 noundef %limit, i32 noundef %target) #0 {
entry:
  %found.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 -1, i32* %found.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %2 = load i32, i32* %j.addr, align 4
  %3 = icmp slt i32 %2, %limit
  br i1 %3, label %for.body.1, label %for.end.1

for.body.1:
  %4 = load i32, i32* %i.addr, align 4
  %5 = load i32, i32* %j.addr, align 4
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = icmp eq i32 %7, %target
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load i32, i32* %i.addr, align 4
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 100)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %14 = load i32, i32* %j.addr, align 4
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %16, i32* %found.addr, align 4
  br label %for.end

if.end:
  br label %for.inc.1

for.inc.1:
  %18 = load i32, i32* %j.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 1)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %20, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 1)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load i32, i32* %found.addr, align 4
  ret i32 %26

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body.1 ], [ 2, %if.then ], [ 0, %ovf.ok.1 ], [ 0, %for.inc.1 ], [ 0, %for.inc ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @skipRows(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %rows) #0 {
entry:
  %total.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %cell.addr = alloca i32, align 4
  %forof.idx.1 = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %rows, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to %struct.nish_array**
  %7 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %6, i64 %0
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %8, %struct.nish_array** %row.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %10 = load i64, i64* %forof.idx.1, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %forof.body.1, label %forof.end.1

forof.body.1:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  store i32 %18, i32* %cell.addr, align 4
  %19 = load i32, i32* %cell.addr, align 4
  %20 = icmp slt i32 %19, 0
  br i1 %20, label %if.then, label %if.end

if.then:
  br label %forof.inc

if.end:
  %21 = load i32, i32* %total.addr, align 4
  %22 = load i32, i32* %cell.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %24, i32* %total.addr, align 4
  br label %forof.inc.1

forof.inc.1:
  %26 = load i64, i64* %forof.idx.1, align 8
  %27 = add i64 %26, 1
  store i64 %27, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %28 = load i32, i32* %total.addr, align 4
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 1000)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %30, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %32 = load i64, i64* %forof.idx, align 8
  %33 = add i64 %32, 1
  store i64 %33, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %34 = load i32, i32* %total.addr, align 4
  ret i32 %34

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @countdown(i32 noundef %start) #0 {
entry:
  %steps.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  store i32 0, i32* %steps.addr, align 4
  store i32 %start, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %n.addr, align 4
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %n.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %do.body

do.body:
  %6 = load i32, i32* %k.addr, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %8, i32* %k.addr, align 4
  %10 = load i32, i32* %steps.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %12, i32* %steps.addr, align 4
  %14 = load i32, i32* %k.addr, align 4
  %15 = load i32, i32* %n.addr, align 4
  %16 = icmp eq i32 %14, %15
  br i1 %16, label %if.then, label %if.end

if.then:
  br label %while.cond

if.end:
  %17 = load i32, i32* %steps.addr, align 4
  %18 = icmp sgt i32 %17, 20
  br i1 %18, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end

if.end.1:
  br label %do.cond

do.cond:
  %19 = load i32, i32* %k.addr, align 4
  %20 = icmp slt i32 %19, 3
  br i1 %20, label %do.body, label %do.end

do.end:
  br label %while.cond

while.end:
  %21 = load i32, i32* %steps.addr, align 4
  ret i32 %21

ovf.fail:
  %ovf.op = phi i32 [ 1, %while.body ], [ 0, %do.body ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x %struct.nish_array*], align 8
  %0 = call i32 @firstPair(i32 10, i32 12)
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 2, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %5 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  store i32 1, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %9 = getelementptr inbounds i32, i32* %7, i64 1
  store i32 2, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 3, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 3, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %14 = call i8* @nish_alloc_struct(i64 12)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 3, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 -1, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 5, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 1, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 1, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %24 = call i8* @nish_alloc_struct(i64 4)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %24 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 0
  store i32 4, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !15
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !16
  %30 = bitcast [3 x %struct.nish_array*]* %arr.data to i8*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = bitcast i8* %30 to %struct.nish_array**
  %33 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %32, i64 0
  store %struct.nish_array* %2, %struct.nish_array** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %34 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %32, i64 1
  store %struct.nish_array* %11, %struct.nish_array** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %35 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %32, i64 2
  store %struct.nish_array* %21, %struct.nish_array** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = call i32 @skipRows(%struct.nish_array* %arr.hdr)
  %37 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %36)
  %38 = extractvalue { i32, i1 } %37, 0
  %39 = extractvalue { i32, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok

ovf.ok:
  %40 = call i32 @countdown(i32 6)
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 %40)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %42

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element i32", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!9, !7, i64 8}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
