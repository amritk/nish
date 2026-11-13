%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal noundef i32 @relabel(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  store i8* %2, i8** %s.addr, align 8
  br label %if.end

if.end:
  %3 = load i8*, i8** %s.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

define internal noundef i32 @choose(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.nish_result.i32.str*
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 1
  store i32 %n, i32* %3, align 4
  store %struct.nish_result.i32.str* %1, %struct.nish_result.i32.str** %r.addr, align 8
  %4 = icmp sgt i32 %n, 5
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  br label %cond.end

cond.false:
  %6 = call i8* @nish_alloc_struct(i64 16)
  %7 = bitcast i8* %6 to %struct.nish_result.i32.str*
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %7, i32 0, i32 0
  store i1 true, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %7, i32 0, i32 1
  store i32 0, i32* %9, align 4
  br label %cond.end

cond.end:
  %10 = phi %struct.nish_result.i32.str* [ %5, %cond.true ], [ %7, %cond.false ]
  store %struct.nish_result.i32.str* %10, %struct.nish_result.i32.str** %r.addr, align 8
  %11 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %12 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %11, i32 0, i32 0
  %13 = load i1, i1* %12, align 1
  br i1 %13, label %res.ok, label %res.alt

res.ok:
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %11, i32 0, i32 1
  %15 = load i32, i32* %14, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %16 = phi i32 [ %15, %res.ok ], [ -1, %res.alt ]
  ret i32 %16
}

define internal noundef i32 @parts(i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %4 = call i8* @nish_str_from_i32(i32 %n)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 8)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %6
  store i8* %4, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = add i64 %6, 1
  store i64 %14, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  ret i32 %19
}

define internal noundef i32 @fixed(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i8* [ %2, %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %cond.false ]
  store i8* %3, i8** %s.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define internal noundef i32 @outer(i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @relabel(i32 %n)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %names.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 1000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i32 @relabel(i32 %6)
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i32 @outer(i32 %8)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @choose(i32 %13)
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %18 = load i32, i32* %i.addr, align 4
  %19 = call i32 @parts(i32 %18)
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %23 = load i32, i32* %i.addr, align 4
  %24 = call i32 @fixed(i32 %23)
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %28 = call i8* @nish_str_from_i32(i32 %26)
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i8**
  %37 = getelementptr inbounds i8*, i8** %36, i64 %30
  store i8* %28, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  br label %for.inc

for.inc:
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %42 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = trunc i64 %44 to i32
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %48 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = icmp ult i64 0, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %53 to i8**
  %55 = getelementptr inbounds i8*, i8** %54, i64 0
  %56 = load i8*, i8** %55, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = call i8* @nish_str_concat(i8* %47, i8* %56)
  %58 = call i8* @nish_str_concat(i8* %57, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %59 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = icmp ult i64 999, %61
  br i1 %62, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 999, i64 %61)
  unreachable

bounds.ok.1:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to i8**
  %66 = getelementptr inbounds i8*, i8** %65, i64 999
  %67 = load i8*, i8** %66, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %68 = call i8* @nish_str_concat(i8* %58, i8* %67)
  call void @nish_print(i8* %68)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
