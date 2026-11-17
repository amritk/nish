%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @append(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %at, i32 noundef %n) #0 {
entry:
  %j.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  %0 = load i32, i32* %j.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %append.check, label %append.slow

append.check:
  %2 = sub nsw i32 %n, 1
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %0)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 %2)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  %9 = or i1 %5, %8
  br i1 %9, label %append.slow, label %append.range

append.range:
  %10 = sext i32 %4 to i64
  %11 = sext i32 %7 to i64
  %12 = icmp slt i64 %10, 0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp uge i64 %11, %14
  %16 = or i1 %12, %15
  br i1 %16, label %append.slow, label %append.room

append.room:
  %17 = sext i32 %n to i64
  %18 = sext i32 %0 to i64
  %19 = sub nsw i64 %17, %18
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = add i64 %21, %19
  %23 = icmp ugt i64 %22, 2147483647
  br i1 %23, label %append.slow, label %append.cap

append.cap:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = icmp ult i64 %25, %22
  br i1 %26, label %append.grow, label %append.copy

append.grow:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  store i64 %25, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  call void @nish_array_grow(%struct.nish_array* %dst, i64 1)
  br label %append.cap

append.copy:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %29 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 %21
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %33 to i8*
  %35 = getelementptr inbounds i8, i8* %34, i64 %10
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %31, i8* %35, i64 %19, i1 false), !alias.scope !4, !noalias !3
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  store i64 %22, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.end

append.slow:
  br label %for.cond

for.cond:
  %37 = load i32, i32* %j.addr, align 4
  %38 = icmp slt i32 %37, %n
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load i32, i32* %j.addr, align 4
  %40 = add nsw i32 %at, %39
  %41 = sext i32 %40 to i64
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp ult i64 %41, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %41, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 %41
  %49 = load i8, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 1
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = icmp eq i64 %51, %53
  br i1 %54, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %dst, i64 1)
  br label %push.store

push.store:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i8*
  %58 = getelementptr inbounds i8, i8* %57, i64 %51
  store i8 %49, i8* %58, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = add i64 %51, 1
  store i64 %59, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = trunc i64 %59 to i32
  br label %for.inc

for.inc:
  %61 = load i32, i32* %j.addr, align 4
  %62 = add nsw i32 %61, 1
  store i32 %62, i32* %j.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @test() #0 {
entry:
  %src.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8], align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8], align 8
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [8 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 3, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 4, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 5, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %4, i64 5
  store i8 6, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8, i8* %4, i64 6
  store i8 7, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8, i8* %4, i64 7
  store i8 8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %src.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast [1 x i8]* %arr.data.1 to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %15 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 0
  store i8 9, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %dst.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @append(%struct.nish_array* %19, %struct.nish_array* %20, i32 2, i32 5)
  %21 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  call void @append(%struct.nish_array* %21, %struct.nish_array* %22, i32 7, i32 0)
  %23 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @append(%struct.nish_array* %23, %struct.nish_array* %24, i32 1, i32 3)
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %25 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %30 = load i32, i32* %i.addr, align 4
  %31 = trunc i64 %27 to i32
  %32 = icmp slt i32 %30, %31
  br i1 %32, label %for.body, label %for.end

for.body:
  %33 = load i32, i32* %sum.addr, align 4
  %34 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %33, i32 3)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  %37 = load i32, i32* %i.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %29 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 %38
  %41 = load i8, i8* %40, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = zext i8 %41 to i32
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 %42)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %44, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %46 = load i32, i32* %i.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %48 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  %52 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %51, i32 100000)
  %53 = extractvalue { i32, i1 } %52, 0
  %54 = extractvalue { i32, i1 } %52, 1
  br i1 %54, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %55 = load i32, i32* %sum.addr, align 4
  %56 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %57

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ], [ 2, %for.end ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
