%struct.Stepper = type { i32 }
%struct.nish_result.bool.i32 = type { i1, i1, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i64 @llvm.smax.i64(i64, i64) #4
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

define internal { i1, i32, i32 } @Stepper.step(%struct.Stepper* noundef nonnull align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stepper, %struct.Stepper* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %0, align 4
  %5 = getelementptr inbounds %struct.Stepper, %struct.Stepper* %this, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !4
  %7 = icmp sle i32 %6, 3
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = zext i1 true to i32
  %9 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %8, 1
  ret { i1, i32, i32 } %9

if.end:
  %10 = zext i1 false to i32
  %11 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %10, 1
  ret { i1, i32, i32 } %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %q.addr = alloca %struct.Stepper*, align 8
  %Stepper.obj = alloca %struct.Stepper, align 8
  %r.addr = alloca %struct.nish_result.bool.i32*, align 8
  %nish_result.bool.i32.obj = alloca %struct.nish_result.bool.i32, align 8
  %s.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [64 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Stepper, %struct.Stepper* %Stepper.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  store %struct.Stepper* %Stepper.obj, %struct.Stepper** %q.addr, align 8
  %1 = load %struct.Stepper*, %struct.Stepper** %q.addr, align 8
  %2 = call { i1, i32, i32 } @Stepper.step(%struct.Stepper* %1)
  %3 = extractvalue { i1, i32, i32 } %2, 0
  %4 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %nish_result.bool.i32.obj, i32 0, i32 0
  store i1 %3, i1* %4, align 1
  %5 = extractvalue { i1, i32, i32 } %2, 1
  %6 = trunc i32 %5 to i1
  %7 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %nish_result.bool.i32.obj, i32 0, i32 1
  store i1 %6, i1* %7, align 1
  %8 = extractvalue { i1, i32, i32 } %2, 2
  %9 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %nish_result.bool.i32.obj, i32 0, i32 2
  store i32 %8, i32* %9, align 4
  store %struct.nish_result.bool.i32* %nish_result.bool.i32.obj, %struct.nish_result.bool.i32** %r.addr, align 8
  br label %while.cond

while.cond:
  %10 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %11 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %10, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %13, i32 0, i32 1
  %15 = load i1, i1* %14, align 1
  br label %land.end

land.end:
  %16 = phi i1 [ false, %while.cond ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load %struct.Stepper*, %struct.Stepper** %q.addr, align 8
  %18 = call { i1, i32, i32 } @Stepper.step(%struct.Stepper* %17)
  %19 = call i8* @nish_alloc_struct(i64 8)
  %20 = bitcast i8* %19 to %struct.nish_result.bool.i32*
  %21 = extractvalue { i1, i32, i32 } %18, 0
  %22 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %20, i32 0, i32 0
  store i1 %21, i1* %22, align 1
  %23 = extractvalue { i1, i32, i32 } %18, 1
  %24 = trunc i32 %23 to i1
  %25 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %20, i32 0, i32 1
  store i1 %24, i1* %25, align 1
  %26 = extractvalue { i1, i32, i32 } %18, 2
  %27 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %20, i32 0, i32 2
  store i32 %26, i32* %27, align 4
  store %struct.nish_result.bool.i32* %20, %struct.nish_result.bool.i32** %r.addr, align 8
  br label %while.cond

while.end:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 64, i64* %28, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 64, i64* %29, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %30 = bitcast [64 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %30, i8 0, i64 64, i1 false), !alias.scope !9, !noalias !8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %s.addr, align 8
  %32 = load %struct.nish_array*, %struct.nish_array** %s.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %35 = sub i64 %34, 0
  %36 = call i64 @llvm.smax.i64(i64 %35, i64 0)
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %39 = bitcast i8* %38 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 0
  call void @llvm.memset.p0i8.i64(i8* %40, i8 255, i64 %36, i1 false), !alias.scope !9, !noalias !8
  %41 = load %struct.nish_array*, %struct.nish_array** %s.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %44 = trunc i64 %43 to i32
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %47 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %48 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %47, i32 0, i32 0
  %49 = load i1, i1* %48, align 1
  %50 = select i1 %49, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %51 = call i8* @nish_str_concat(i8* %46, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %53 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %54 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %53, i32 0, i32 0
  %55 = load i1, i1* %54, align 1
  %56 = xor i1 %55, true
  %57 = select i1 %56, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %58 = call i8* @nish_str_concat(i8* %52, i8* %57)
  call void @nish_print(i8* %58)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!16, !17, !18, !19, !20}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Stepper", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}
