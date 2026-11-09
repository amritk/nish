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
  %s.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [64 x i8], align 8
  %0 = getelementptr inbounds %struct.Stepper, %struct.Stepper* %Stepper.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  store %struct.Stepper* %Stepper.obj, %struct.Stepper** %q.addr, align 8
  %1 = load %struct.Stepper*, %struct.Stepper** %q.addr, align 8
  %2 = call { i1, i32, i32 } @Stepper.step(%struct.Stepper* %1)
  %3 = call i8* @nish_alloc_struct(i64 8)
  %4 = bitcast i8* %3 to %struct.nish_result.bool.i32*
  %5 = extractvalue { i1, i32, i32 } %2, 0
  %6 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %4, i32 0, i32 0
  store i1 %5, i1* %6, align 1
  %7 = extractvalue { i1, i32, i32 } %2, 1
  %8 = trunc i32 %7 to i1
  %9 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %4, i32 0, i32 1
  store i1 %8, i1* %9, align 1
  %10 = extractvalue { i1, i32, i32 } %2, 2
  %11 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %4, i32 0, i32 2
  store i32 %10, i32* %11, align 4
  store %struct.nish_result.bool.i32* %4, %struct.nish_result.bool.i32** %r.addr, align 8
  br label %while.cond

while.cond:
  %12 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %13 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %12, i32 0, i32 0
  %14 = load i1, i1* %13, align 1
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %16 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %15, i32 0, i32 1
  %17 = load i1, i1* %16, align 1
  br label %land.end

land.end:
  %18 = phi i1 [ false, %while.cond ], [ %17, %land.rhs ]
  br i1 %18, label %while.body, label %while.end

while.body:
  %19 = load %struct.Stepper*, %struct.Stepper** %q.addr, align 8
  %20 = call { i1, i32, i32 } @Stepper.step(%struct.Stepper* %19)
  %21 = call i8* @nish_alloc_struct(i64 8)
  %22 = bitcast i8* %21 to %struct.nish_result.bool.i32*
  %23 = extractvalue { i1, i32, i32 } %20, 0
  %24 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %22, i32 0, i32 0
  store i1 %23, i1* %24, align 1
  %25 = extractvalue { i1, i32, i32 } %20, 1
  %26 = trunc i32 %25 to i1
  %27 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %22, i32 0, i32 1
  store i1 %26, i1* %27, align 1
  %28 = extractvalue { i1, i32, i32 } %20, 2
  %29 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %22, i32 0, i32 2
  store i32 %28, i32* %29, align 4
  store %struct.nish_result.bool.i32* %22, %struct.nish_result.bool.i32** %r.addr, align 8
  br label %while.cond

while.end:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 64, i64* %30, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 64, i64* %31, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %32 = bitcast [64 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %32, i8 0, i64 64, i1 false), !alias.scope !9, !noalias !8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %s.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %s.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %37 = sub i64 %36, 0
  %38 = call i64 @llvm.smax.i64(i64 %37, i64 0)
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %41 = bitcast i8* %40 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 0
  call void @llvm.memset.p0i8.i64(i8* %42, i8 255, i64 %38, i1 false), !alias.scope !9, !noalias !8
  %43 = load %struct.nish_array*, %struct.nish_array** %s.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %46 = trunc i64 %45 to i32
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %49 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %50 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %49, i32 0, i32 0
  %51 = load i1, i1* %50, align 1
  %52 = select i1 %51, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %53 = call i8* @nish_str_concat(i8* %48, i8* %52)
  %54 = call i8* @nish_str_concat(i8* %53, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %55 = load %struct.nish_result.bool.i32*, %struct.nish_result.bool.i32** %r.addr, align 8
  %56 = getelementptr inbounds %struct.nish_result.bool.i32, %struct.nish_result.bool.i32* %55, i32 0, i32 0
  %57 = load i1, i1* %56, align 1
  %58 = xor i1 %57, true
  %59 = select i1 %58, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %60 = call i8* @nish_str_concat(i8* %54, i8* %59)
  call void @nish_print(i8* %60)
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
