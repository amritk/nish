%struct.nish_array = type { i64, i64, i8* }

@nish_const_0_STEPS.data = private unnamed_addr constant [6 x i32] [i32 -1000, i32 -1, i32 0, i32 7, i32 2000, i32 2147483647], align 16
@nish_const_0_STEPS = internal constant %struct.nish_array { i64 6, i64 6, i8* bitcast ([6 x i32]* @nish_const_0_STEPS.data to i8*) }, align 8
@nish_const_0_BIG.data = private unnamed_addr constant [3 x i64] [i64 1099511627776, i64 -9, i64 0], align 16
@nish_const_0_BIG = internal constant %struct.nish_array { i64 3, i64 3, i8* bitcast ([3 x i64]* @nish_const_0_BIG.data to i8*) }, align 8
@nish_const_0_WEIGHTS.data = private unnamed_addr constant [4 x double] [double 0x3FE0000000000000, double 0x3FF4000000000000, double 0xC008000000000000, double 0x54B249AD2594C37D], align 16
@nish_const_0_WEIGHTS = internal constant %struct.nish_array { i64 4, i64 4, i8* bitcast ([4 x double]* @nish_const_0_WEIGHTS.data to i8*) }, align 8
@nish_const_0_WIDE.data = private unnamed_addr constant [3 x i16] [i16 0, i16 65535, i16 300], align 16
@nish_const_0_WIDE = internal constant %struct.nish_array { i64 3, i64 3, i8* bitcast ([3 x i16]* @nish_const_0_WIDE.data to i8*) }, align 8
@nish_const_0_MASKS.data = private unnamed_addr constant [3 x i32] [i32 0, i32 255, i32 4294967295], align 16
@nish_const_0_MASKS = internal constant %struct.nish_array { i64 3, i64 3, i8* bitcast ([3 x i32]* @nish_const_0_MASKS.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #3

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %s.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %s.addr, align 4
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
  %9 = load i32, i32* %s.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = srem i32 %10, 1000
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %s.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %s.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %w.addr = alloca double, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_STEPS, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_STEPS, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 0
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %4, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_STEPS, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 5
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %12, i8* %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %21 = call i32 @total(%struct.nish_array* @nish_const_0_STEPS)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %20, i8* %22)
  call void @nish_print(i8* %23)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_BIG, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to i64*
  %27 = getelementptr inbounds i64, i64* %26, i64 0
  %28 = load i64, i64* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %29 = call i8* @nish_str_from_i64(i64 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_BIG, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = bitcast i8* %32 to i64*
  %34 = getelementptr inbounds i64, i64* %33, i64 1
  %35 = load i64, i64* %34, align 8, !alias.scope !4, !noalias !3, !tbaa !15
  %36 = sext i32 2 to i64
  %37 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %35, i64 %36)
  %38 = extractvalue { i64, i1 } %37, 0
  %39 = extractvalue { i64, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok

ovf.ok:
  %40 = call i8* @nish_str_from_i64(i64 %38)
  %41 = call i8* @nish_str_concat(i8* %30, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_BIG, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = trunc i64 %44 to i32
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %42, i8* %46)
  call void @nish_print(i8* %47)
  store double 0x0000000000000000, double* %w.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %48 = load i32, i32* %i.addr, align 4
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  %52 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %51, i32 1)
  %53 = extractvalue { i32, i1 } %52, 0
  %54 = extractvalue { i32, i1 } %52, 1
  br i1 %54, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %55 = icmp slt i32 %48, %53
  br i1 %55, label %for.body, label %for.end

for.body:
  %56 = load double, double* %w.addr, align 8
  %57 = load i32, i32* %i.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = icmp ult i64 %58, %60
  br i1 %61, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %58, i64 %60)
  unreachable

bounds.ok:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %64 = bitcast i8* %63 to double*
  %65 = getelementptr inbounds double, double* %64, i64 %58
  %66 = load double, double* %65, align 8, !alias.scope !4, !noalias !3, !tbaa !17
  %67 = fadd double %56, %66
  store double %67, double* %w.addr, align 8
  br label %for.inc

for.inc:
  %68 = load i32, i32* %i.addr, align 4
  %69 = add nsw i32 %68, 1
  store i32 %69, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %70 = load double, double* %w.addr, align 8
  %71 = call i8* @nish_str_from_f64(double %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %75 = bitcast i8* %74 to double*
  %76 = getelementptr inbounds double, double* %75, i64 3
  %77 = load double, double* %76, align 8, !alias.scope !4, !noalias !3, !tbaa !17
  %78 = call i8* @nish_str_from_f64(double %77)
  %79 = call i8* @nish_str_concat(i8* %72, i8* %78)
  call void @nish_print(i8* %79)
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WIDE, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %82 = bitcast i8* %81 to i16*
  %83 = getelementptr inbounds i16, i16* %82, i64 1
  %84 = load i16, i16* %83, align 2, !alias.scope !4, !noalias !3, !tbaa !19
  %85 = zext i16 %84 to i64
  %86 = call i8* @nish_str_from_u64(i64 %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WIDE, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %90 = bitcast i8* %89 to i16*
  %91 = getelementptr inbounds i16, i16* %90, i64 2
  %92 = load i16, i16* %91, align 2, !alias.scope !4, !noalias !3, !tbaa !19
  %93 = zext i16 %92 to i64
  %94 = call i8* @nish_str_from_u64(i64 %93)
  %95 = call i8* @nish_str_concat(i8* %87, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_MASKS, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 2
  %101 = load i32, i32* %100, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %102 = zext i32 %101 to i64
  %103 = call i8* @nish_str_from_u64(i64 %102)
  %104 = call i8* @nish_str_concat(i8* %96, i8* %103)
  %105 = call i8* @nish_str_concat(i8* %104, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_MASKS, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = trunc i64 %107 to i32
  %109 = call i8* @nish_str_from_i32(i32 %108)
  %110 = call i8* @nish_str_concat(i8* %105, i8* %109)
  call void @nish_print(i8* %110)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 1, %for.cond ]
  call void @nish_panic_overflow(i32 %ovf.op)
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
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!20, !21, !22, !23, !24}
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
!14 = !{!"element i64", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!"element double", !6, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!"element i16", !6, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{i32 8, !"cf-protection-branch", i32 1}
!21 = !{i32 8, !"cf-protection-return", i32 1}
!22 = !{i32 8, !"branch-target-enforcement", i32 1}
!23 = !{i32 8, !"sign-return-address", i32 1}
!24 = !{i32 4, !"probe-stack", !"inline-asm"}
