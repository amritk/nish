%struct.Sim = type { double, i32, i1 }
%struct.nish_array = type { i64, i64, i8* }

@sim.data = internal global [4 x %struct.Sim] zeroinitializer, align 16
@sim = global %struct.nish_array { i64 4, i64 4, i8* bitcast ([4 x %struct.Sim]* @sim.data to i8*) }, align 8
@totals.data = internal global [8 x double] zeroinitializer, align 16
@totals = global %struct.nish_array { i64 8, i64 8, i8* bitcast ([8 x double]* @totals.data to i8*) }, align 8
@marks.data = internal global [3 x i8] zeroinitializer, align 16
@marks = global %struct.nish_array { i64 3, i64 3, i8* bitcast ([3 x i8]* @marks.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @step(i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to %struct.Sim*
  %7 = getelementptr inbounds %struct.Sim, %struct.Sim* %6, i64 %0
  %8 = getelementptr inbounds %struct.Sim, %struct.Sim* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %11, i32* %8, align 4
  %13 = sext i32 %i to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %18 to %struct.Sim*
  %20 = getelementptr inbounds %struct.Sim, %struct.Sim* %19, i64 %13
  %21 = sext i32 %i to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 %21, %23
  br i1 %24, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %21, i64 %23)
  unreachable

bounds.ok.2:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to %struct.Sim*
  %28 = getelementptr inbounds %struct.Sim, %struct.Sim* %27, i64 %21
  %29 = getelementptr inbounds %struct.Sim, %struct.Sim* %28, i32 0, i32 0
  %30 = load double, double* %29, align 8
  %31 = fadd double %30, 0x3FE0000000000000
  %32 = getelementptr inbounds %struct.Sim, %struct.Sim* %20, i32 0, i32 0
  store double %31, double* %32, align 8
  %33 = sext i32 %i to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 %33, %35
  br i1 %36, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %33, i64 %35)
  unreachable

bounds.ok.3:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast i8* %38 to %struct.Sim*
  %40 = getelementptr inbounds %struct.Sim, %struct.Sim* %39, i64 %33
  %41 = getelementptr inbounds %struct.Sim, %struct.Sim* %40, i32 0, i32 2
  store i1 true, i1* %41, align 1
  %42 = sext i32 %i to i64
  %43 = sext i32 %i to i64
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @totals, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = icmp ult i64 %43, %45
  br i1 %46, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %43, i64 %45)
  unreachable

bounds.ok.4:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @totals, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = bitcast i8* %48 to double*
  %50 = getelementptr inbounds double, double* %49, i64 %43
  %51 = load double, double* %50, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %52 = sext i32 %i to i64
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 %52, %54
  br i1 %55, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %52, i64 %54)
  unreachable

bounds.ok.5:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %58 = bitcast i8* %57 to %struct.Sim*
  %59 = getelementptr inbounds %struct.Sim, %struct.Sim* %58, i64 %52
  %60 = getelementptr inbounds %struct.Sim, %struct.Sim* %59, i32 0, i32 0
  %61 = load double, double* %60, align 8
  %62 = fadd double %51, %61
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @totals, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = icmp ult i64 %42, %64
  br i1 %65, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %42, i64 %64)
  unreachable

bounds.ok.6:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @totals, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %68 = bitcast i8* %67 to double*
  %69 = getelementptr inbounds double, double* %68, i64 %42
  store double %62, double* %69, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @tickOf(i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to %struct.Sim*
  %7 = getelementptr inbounds %struct.Sim, %struct.Sim* %6, i64 %0
  %8 = getelementptr inbounds %struct.Sim, %struct.Sim* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  ret i32 %9
}

define void @nish_main() #0 {
entry:
  %ticks.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @step(i32 1)
  call void @step(i32 1)
  call void @step(i32 2)
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 1, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast i8* %4 to %struct.Sim*
  %6 = getelementptr inbounds %struct.Sim, %struct.Sim* %5, i64 1
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = icmp ult i64 3, %8
  br i1 %9, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %8)
  unreachable

bounds.ok.1:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to %struct.Sim*
  %13 = getelementptr inbounds %struct.Sim, %struct.Sim* %12, i64 3
  %14 = bitcast %struct.Sim* %13 to i8*
  %15 = bitcast %struct.Sim* %6 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %14, i8* align 8 %15, i64 16, i1 false), !alias.scope !4, !noalias !3
  store i32 0, i32* %ticks.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %16 = load i32, i32* %i.addr, align 4
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = icmp slt i32 %16, %19
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %ticks.addr, align 4
  %22 = load i32, i32* %i.addr, align 4
  %23 = call i32 @tickOf(i32 %22)
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %25, i32* %ticks.addr, align 4
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @marks, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = icmp ult i64 2, %30
  br i1 %31, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %30)
  unreachable

bounds.ok.2:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @marks, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %33 to i8*
  %35 = getelementptr inbounds i8, i8* %34, i64 2
  store i8 255, i8* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !15
  %36 = load i32, i32* %ticks.addr, align 4
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = icmp ult i64 3, %40
  br i1 %41, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %40)
  unreachable

bounds.ok.3:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = bitcast i8* %43 to %struct.Sim*
  %45 = getelementptr inbounds %struct.Sim, %struct.Sim* %44, i64 3
  %46 = getelementptr inbounds %struct.Sim, %struct.Sim* %45, i32 0, i32 0
  %47 = load double, double* %46, align 8
  %48 = call i8* @nish_str_from_f64(double %47)
  %49 = call i8* @nish_str_concat(i8* %38, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 0, %52
  br i1 %53, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %52)
  unreachable

bounds.ok.4:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @sim, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = bitcast i8* %55 to %struct.Sim*
  %57 = getelementptr inbounds %struct.Sim, %struct.Sim* %56, i64 0
  %58 = getelementptr inbounds %struct.Sim, %struct.Sim* %57, i32 0, i32 2
  %59 = load i1, i1* %58, align 1
  %60 = select i1 %59, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %61 = call i8* @nish_str_concat(i8* %50, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @totals, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = icmp ult i64 1, %64
  br i1 %65, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %64)
  unreachable

bounds.ok.5:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @totals, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %68 = bitcast i8* %67 to double*
  %69 = getelementptr inbounds double, double* %68, i64 1
  %70 = load double, double* %69, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %71 = call i8* @nish_str_from_f64(double %70)
  %72 = call i8* @nish_str_concat(i8* %62, i8* %71)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @totals, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = trunc i64 %75 to i32
  %77 = call i8* @nish_str_from_i32(i32 %76)
  %78 = call i8* @nish_str_concat(i8* %73, i8* %77)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @marks, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = icmp ult i64 2, %81
  br i1 %82, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 2, i64 %81)
  unreachable

bounds.ok.6:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @marks, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %85 = bitcast i8* %84 to i8*
  %86 = getelementptr inbounds i8, i8* %85, i64 2
  %87 = load i8, i8* %86, align 1, !alias.scope !4, !noalias !3, !tbaa !15
  %88 = zext i8 %87 to i64
  %89 = call i8* @nish_str_from_u64(i64 %88)
  %90 = call i8* @nish_str_concat(i8* %79, i8* %89)
  call void @nish_print(i8* %90)
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
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 16}
!12 = !{!"element double", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"element i8", !6, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}
