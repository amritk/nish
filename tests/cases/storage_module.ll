%struct.Sim = type { double, i32, i1 }
%struct.nish_array = type { i64, i64, i8* }

@nish_storage_0_sim.data = global [4 x %struct.Sim] zeroinitializer, align 16
@nish_storage_0_sim = internal global %struct.nish_array { i64 4, i64 4, i8* bitcast ([4 x %struct.Sim]* @nish_storage_0_sim.data to i8*) }, align 8
@nish_storage_0_totals.data = global [8 x double] zeroinitializer, align 16
@nish_storage_0_totals = internal global %struct.nish_array { i64 8, i64 8, i8* bitcast ([8 x double]* @nish_storage_0_totals.data to i8*) }, align 8
@nish_storage_0_marks.data = global [3 x i8] zeroinitializer, align 16
@nish_storage_0_marks = internal global %struct.nish_array { i64 3, i64 3, i8* bitcast ([3 x i8]* @nish_storage_0_marks.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal void @step(i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to %struct.Sim*
  %4 = getelementptr inbounds %struct.Sim, %struct.Sim* %3, i64 %0
  %5 = getelementptr inbounds %struct.Sim, %struct.Sim* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %8, i32* %5, align 4
  %10 = sext i32 %i to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = bitcast i8* %12 to %struct.Sim*
  %14 = getelementptr inbounds %struct.Sim, %struct.Sim* %13, i64 %10
  %15 = sext i32 %i to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = bitcast i8* %17 to %struct.Sim*
  %19 = getelementptr inbounds %struct.Sim, %struct.Sim* %18, i64 %15
  %20 = getelementptr inbounds %struct.Sim, %struct.Sim* %19, i32 0, i32 0
  %21 = load double, double* %20, align 8
  %22 = fadd double %21, 0x3FE0000000000000
  %23 = getelementptr inbounds %struct.Sim, %struct.Sim* %14, i32 0, i32 0
  store double %22, double* %23, align 8
  %24 = sext i32 %i to i64
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = bitcast i8* %26 to %struct.Sim*
  %28 = getelementptr inbounds %struct.Sim, %struct.Sim* %27, i64 %24
  %29 = getelementptr inbounds %struct.Sim, %struct.Sim* %28, i32 0, i32 2
  store i1 true, i1* %29, align 1
  %30 = sext i32 %i to i64
  %31 = sext i32 %i to i64
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_totals, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = bitcast i8* %33 to double*
  %35 = getelementptr inbounds double, double* %34, i64 %31
  %36 = load double, double* %35, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %37 = sext i32 %i to i64
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = bitcast i8* %39 to %struct.Sim*
  %41 = getelementptr inbounds %struct.Sim, %struct.Sim* %40, i64 %37
  %42 = getelementptr inbounds %struct.Sim, %struct.Sim* %41, i32 0, i32 0
  %43 = load double, double* %42, align 8
  %44 = fadd double %36, %43
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_totals, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = bitcast i8* %46 to double*
  %48 = getelementptr inbounds double, double* %47, i64 %30
  store double %44, double* %48, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @tickOf(i32 noundef %i) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to %struct.Sim*
  %4 = getelementptr inbounds %struct.Sim, %struct.Sim* %3, i64 %0
  %5 = getelementptr inbounds %struct.Sim, %struct.Sim* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4
  ret i32 %6
}

define void @nish_main() #0 {
entry:
  %ticks.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @step(i32 1)
  call void @step(i32 1)
  call void @step(i32 2)
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %1 = load i8*, i8** %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = bitcast i8* %1 to %struct.Sim*
  %3 = getelementptr inbounds %struct.Sim, %struct.Sim* %2, i64 1
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = bitcast i8* %5 to %struct.Sim*
  %7 = getelementptr inbounds %struct.Sim, %struct.Sim* %6, i64 3
  %8 = bitcast %struct.Sim* %7 to i8*
  %9 = bitcast %struct.Sim* %3 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %8, i8* align 8 %9, i64 16, i1 false), !alias.scope !4, !noalias !3
  store i32 0, i32* %ticks.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %13 = trunc i64 %12 to i32
  %14 = icmp slt i32 %10, %13
  br i1 %14, label %for.body, label %for.end

for.body:
  %15 = load i32, i32* %ticks.addr, align 4
  %16 = load i32, i32* %i.addr, align 4
  %17 = call i32 @tickOf(i32 %16)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %ticks.addr, align 4
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_marks, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = bitcast i8* %24 to i8*
  %26 = getelementptr inbounds i8, i8* %25, i64 2
  store i8 255, i8* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !15
  %27 = load i32, i32* %ticks.addr, align 4
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* %31 to %struct.Sim*
  %33 = getelementptr inbounds %struct.Sim, %struct.Sim* %32, i64 3
  %34 = getelementptr inbounds %struct.Sim, %struct.Sim* %33, i32 0, i32 0
  %35 = load double, double* %34, align 8
  %36 = call i8* @nish_str_from_f64(double %35)
  %37 = call i8* @nish_str_concat(i8* %29, i8* %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_sim, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* %40 to %struct.Sim*
  %42 = getelementptr inbounds %struct.Sim, %struct.Sim* %41, i64 0
  %43 = getelementptr inbounds %struct.Sim, %struct.Sim* %42, i32 0, i32 2
  %44 = load i1, i1* %43, align 1
  %45 = select i1 %44, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %46 = call i8* @nish_str_concat(i8* %38, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_totals, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = bitcast i8* %49 to double*
  %51 = getelementptr inbounds double, double* %50, i64 1
  %52 = load double, double* %51, align 8, !alias.scope !4, !noalias !3, !tbaa !12
  %53 = call i8* @nish_str_from_f64(double %52)
  %54 = call i8* @nish_str_concat(i8* %47, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_totals, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %58 = trunc i64 %57 to i32
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %55, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_marks, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = bitcast i8* %63 to i8*
  %65 = getelementptr inbounds i8, i8* %64, i64 2
  %66 = load i8, i8* %65, align 1, !alias.scope !4, !noalias !3, !tbaa !15
  %67 = zext i8 %66 to i64
  %68 = call i8* @nish_str_from_u64(i64 %67)
  %69 = call i8* @nish_str_concat(i8* %61, i8* %68)
  call void @nish_print(i8* %69)
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
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!16, !17, !18, !19, !20}
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
!10 = !{!9, !8, i64 16}
!11 = !{!"element double", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!"element i8", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}
