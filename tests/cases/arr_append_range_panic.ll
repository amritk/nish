%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal noundef i32 @append(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, i32 noundef %at, i32 noundef %n) #0 {
entry:
  %j.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  %0 = load i32, i32* %j.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %append.check, label %append.slow

append.check:
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %at, i32 2)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = sub nsw i32 %n, 1
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %0)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  %12 = or i1 %8, %11
  br i1 %12, label %append.slow, label %append.range

append.range:
  %13 = sext i32 %7 to i64
  %14 = sext i32 %10 to i64
  %15 = icmp slt i64 %13, 0
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp uge i64 %14, %17
  %19 = or i1 %15, %18
  br i1 %19, label %append.slow, label %append.room

append.room:
  %20 = sext i32 %n to i64
  %21 = sext i32 %0 to i64
  %22 = sub nsw i64 %20, %21
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = add i64 %24, %22
  %26 = icmp ugt i64 %25, 2147483647
  br i1 %26, label %append.slow, label %append.cap

append.cap:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 1
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = icmp ult i64 %28, %25
  br i1 %29, label %append.grow, label %append.copy

append.grow:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  store i64 %28, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  call void @nish_array_grow(%struct.nish_array* %dst, i64 1)
  br label %append.cap

append.copy:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 %24
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 %13
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %34, i8* %38, i64 %22, i1 false), !alias.scope !4, !noalias !3
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  store i64 %25, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %for.end

append.slow:
  br label %for.cond

for.cond:
  %40 = load i32, i32* %j.addr, align 4
  %41 = icmp slt i32 %40, %n
  br i1 %41, label %for.body, label %for.end

for.body:
  %42 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %at, i32 2)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %45 = load i32, i32* %j.addr, align 4
  %46 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 %45)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %49 = sext i32 %47 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %49, i64 %51)
  unreachable

bounds.ok:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i8*
  %56 = getelementptr inbounds i8, i8* %55, i64 %49
  %57 = load i8, i8* %56, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 1
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %62 = icmp eq i64 %59, %61
  br i1 %62, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %dst, i64 1)
  br label %push.store

push.store:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to i8*
  %66 = getelementptr inbounds i8, i8* %65, i64 %59
  store i8 %57, i8* %66, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %67 = add i64 %59, 1
  store i64 %67, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = trunc i64 %67 to i32
  br label %for.inc

for.inc:
  %69 = load i32, i32* %j.addr, align 4
  %70 = add nsw i32 %69, 1
  store i32 %70, i32* %j.addr, align 4
  br label %for.cond

for.end:
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = trunc i64 %72 to i32
  ret i32 %73

ovf.fail:
  %ovf.op = phi i32 [ 2, %append.check ], [ 2, %for.body ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @four() #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 1, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 2, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 3, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 4, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %1
}

define noundef i32 @pastEnd() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %3 = call %struct.nish_array* @four()
  %4 = call i32 @append(%struct.nish_array* %arr.hdr, %struct.nish_array* %3, i32 1, i32 3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4
}

define noundef i32 @wraps() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %3 = call %struct.nish_array* @four()
  %4 = call i32 @append(%struct.nish_array* %arr.hdr, %struct.nish_array* %3, i32 1073741824, i32 1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %3 = call %struct.nish_array* @four()
  %4 = call i32 @append(%struct.nish_array* %arr.hdr, %struct.nish_array* %3, i32 0, i32 3)
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 10)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = call %struct.nish_array* @four()
  %12 = call i32 @append(%struct.nish_array* %arr.hdr.1, %struct.nish_array* %11, i32 1073741824, i32 0)
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %14

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
