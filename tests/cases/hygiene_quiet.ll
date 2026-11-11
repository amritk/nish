%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @nish_main() #0 {
entry:
  %_ignored.addr = alloca i32, align 4
  %turns.addr = alloca i32, align 4
  %_item.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %zero.addr = alloca double, align 8
  %nan.addr = alloca double, align 8
  %isNan.addr = alloca i1, align 1
  %finite.addr = alloca i1, align 1
  %big.addr = alloca i32, align 4
  %again.addr = alloca i32, align 4
  %small.addr = alloca i1, align 1
  %signed.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 7, i32* %_ignored.addr, align 4
  store i32 0, i32* %turns.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  %16 = load i32, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %16, i32* %_item.addr, align 4
  %17 = load i32, i32* %turns.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 1)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %turns.addr, align 4
  br label %forof.inc

forof.inc:
  %21 = load i64, i64* %forof.idx, align 8
  %22 = add i64 %21, 1
  store i64 %22, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store double 0x0000000000000000, double* %zero.addr, align 8
  %23 = load double, double* %zero.addr, align 8
  %24 = load double, double* %zero.addr, align 8
  %25 = fdiv double %23, %24
  store double %25, double* %nan.addr, align 8
  %26 = load double, double* %nan.addr, align 8
  %27 = load double, double* %nan.addr, align 8
  %28 = fcmp une double %26, %27
  store i1 %28, i1* %isNan.addr, align 1
  %29 = load double, double* %zero.addr, align 8
  %30 = load double, double* %zero.addr, align 8
  %31 = fsub double %29, %30
  %32 = load double, double* %zero.addr, align 8
  %33 = fcmp oeq double %31, %32
  store i1 %33, i1* %finite.addr, align 1
  store i32 4000000000, i32* %big.addr, align 4
  %34 = load i32, i32* %big.addr, align 4
  store i32 %34, i32* %again.addr, align 4
  %35 = load i32, i32* %big.addr, align 4
  %36 = icmp ugt i32 %35, 1
  store i1 %36, i1* %small.addr, align 1
  store i32 -1, i32* %signed.addr, align 4
  %37 = load i32, i32* %turns.addr, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %40 = load i1, i1* %isNan.addr, align 1
  %41 = select i1 %40, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %42 = call i8* @nish_str_concat(i8* %39, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = load i1, i1* %finite.addr, align 1
  %45 = select i1 %44, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %46 = call i8* @nish_str_concat(i8* %43, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %48 = load i32, i32* %big.addr, align 4
  %49 = load i32, i32* %again.addr, align 4
  %50 = icmp uge i32 %48, %49
  %51 = select i1 %50, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %52 = call i8* @nish_str_concat(i8* %47, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %54 = load i1, i1* %small.addr, align 1
  %55 = select i1 %54, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %56 = call i8* @nish_str_concat(i8* %53, i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %58 = load i32, i32* %signed.addr, align 4
  %59 = icmp slt i32 %58, 0
  %60 = select i1 %59, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %61 = call i8* @nish_str_concat(i8* %57, i8* %60)
  call void @nish_print(i8* %61)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
