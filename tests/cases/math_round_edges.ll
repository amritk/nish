%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-0\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"0\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"0.5\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"-0.5\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"1.5\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"-1.5\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"2.5\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"-2.5\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"0.49999999999999994\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"-0.49999999999999994\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"4503599627370495.5\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"-4503599627370495.5\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"4503599627370496\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"9007199254740993\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"-1e-300\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"1e-300\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"5e-324\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"-5e-324\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"2.225073858507201e-308\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"-2.225073858507201e-308\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c": floor \00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" ceil \00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" trunc \00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" round \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare double @nish_floor_f64(double) #2
declare double @nish_ceil_f64(double) #2
declare double @nish_trunc_f64(double) #2
declare double @llvm.copysign.f64(double, double) #3

define internal noundef nonnull align 8 i8* @show(double noundef %x) #0 {
entry:
  %0 = fcmp oeq double %x, 0x0000000000000000
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = fdiv double 0x3FF0000000000000, %x
  %2 = fcmp olt double %1, 0x0000000000000000
  br label %land.end

land.end:
  %3 = phi i1 [ false, %entry ], [ %2, %land.rhs ]
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %4 = call i8* @nish_str_from_f64(double %x)
  br label %cond.end

cond.end:
  %5 = phi i8* [ bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), %cond.true ], [ %4, %cond.false ]
  ret i8* %5
}

define noundef i32 @nish_main() #1 {
entry:
  %zero.addr = alloca double, align 8
  %inputs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [23 x double], align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i32 0)
  store double %0, double* %zero.addr, align 8
  %1 = load double, double* %zero.addr, align 8
  %2 = load double, double* %zero.addr, align 8
  %3 = fneg double %2
  %4 = call double @nish_parse_number(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i32 0)
  %5 = call double @nish_parse_number(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i32 0)
  %6 = call double @nish_parse_number(i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i32 0)
  %7 = call double @nish_parse_number(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i32 0)
  %8 = call double @nish_parse_number(i8* bitcast ({ i64, [4 x i8] }* @.str.6 to i8*), i32 0)
  %9 = call double @nish_parse_number(i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*), i32 0)
  %10 = call double @nish_parse_number(i8* bitcast ({ i64, [20 x i8] }* @.str.8 to i8*), i32 0)
  %11 = call double @nish_parse_number(i8* bitcast ({ i64, [21 x i8] }* @.str.9 to i8*), i32 0)
  %12 = call double @nish_parse_number(i8* bitcast ({ i64, [19 x i8] }* @.str.10 to i8*), i32 0)
  %13 = call double @nish_parse_number(i8* bitcast ({ i64, [20 x i8] }* @.str.11 to i8*), i32 0)
  %14 = call double @nish_parse_number(i8* bitcast ({ i64, [17 x i8] }* @.str.12 to i8*), i32 0)
  %15 = call double @nish_parse_number(i8* bitcast ({ i64, [17 x i8] }* @.str.13 to i8*), i32 0)
  %16 = call double @nish_parse_number(i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*), i32 0)
  %17 = call double @nish_parse_number(i8* bitcast ({ i64, [7 x i8] }* @.str.15 to i8*), i32 0)
  %18 = call double @nish_parse_number(i8* bitcast ({ i64, [7 x i8] }* @.str.16 to i8*), i32 0)
  %19 = call double @nish_parse_number(i8* bitcast ({ i64, [8 x i8] }* @.str.17 to i8*), i32 0)
  %20 = call double @nish_parse_number(i8* bitcast ({ i64, [23 x i8] }* @.str.18 to i8*), i32 0)
  %21 = call double @nish_parse_number(i8* bitcast ({ i64, [24 x i8] }* @.str.19 to i8*), i32 0)
  %22 = load double, double* %zero.addr, align 8
  %23 = fdiv double 0x3FF0000000000000, %22
  %24 = fneg double 0x3FF0000000000000
  %25 = load double, double* %zero.addr, align 8
  %26 = fdiv double %24, %25
  %27 = load double, double* %zero.addr, align 8
  %28 = load double, double* %zero.addr, align 8
  %29 = fdiv double %27, %28
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 23, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 23, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = bitcast [23 x double]* %arr.data to i8*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %32 to double*
  %35 = getelementptr inbounds double, double* %34, i64 0
  store double %1, double* %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = getelementptr inbounds double, double* %34, i64 1
  store double %3, double* %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = getelementptr inbounds double, double* %34, i64 2
  store double %4, double* %37, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = getelementptr inbounds double, double* %34, i64 3
  store double %5, double* %38, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %39 = getelementptr inbounds double, double* %34, i64 4
  store double %6, double* %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = getelementptr inbounds double, double* %34, i64 5
  store double %7, double* %40, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = getelementptr inbounds double, double* %34, i64 6
  store double %8, double* %41, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = getelementptr inbounds double, double* %34, i64 7
  store double %9, double* %42, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = getelementptr inbounds double, double* %34, i64 8
  store double %10, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = getelementptr inbounds double, double* %34, i64 9
  store double %11, double* %44, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = getelementptr inbounds double, double* %34, i64 10
  store double %12, double* %45, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %46 = getelementptr inbounds double, double* %34, i64 11
  store double %13, double* %46, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = getelementptr inbounds double, double* %34, i64 12
  store double %14, double* %47, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = getelementptr inbounds double, double* %34, i64 13
  store double %15, double* %48, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = getelementptr inbounds double, double* %34, i64 14
  store double %16, double* %49, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = getelementptr inbounds double, double* %34, i64 15
  store double %17, double* %50, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = getelementptr inbounds double, double* %34, i64 16
  store double %18, double* %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %52 = getelementptr inbounds double, double* %34, i64 17
  store double %19, double* %52, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = getelementptr inbounds double, double* %34, i64 18
  store double %20, double* %53, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = getelementptr inbounds double, double* %34, i64 19
  store double %21, double* %54, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %55 = getelementptr inbounds double, double* %34, i64 20
  store double %23, double* %55, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = getelementptr inbounds double, double* %34, i64 21
  store double %26, double* %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = getelementptr inbounds double, double* %34, i64 22
  store double %29, double* %57, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %inputs.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %inputs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %59 = load i64, i64* %forof.idx, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = icmp ult i64 %59, %61
  br i1 %62, label %forof.body, label %forof.end

forof.body:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to double*
  %66 = getelementptr inbounds double, double* %65, i64 %59
  %67 = load double, double* %66, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store double %67, double* %x.addr, align 8
  %68 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %69 = load i8*, i8** %68, align 8
  %70 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %71 = load i64, i64* %70, align 8
  %72 = load double, double* %x.addr, align 8
  %73 = call i64 @nish_arena_mark()
  %74 = call i8* @show(double %72)
  %75 = call i8* @nish_arena_keep(i64 %73, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [9 x i8] }* @.str.20 to i8*))
  %77 = load double, double* %x.addr, align 8
  %78 = call double @nish_floor_f64(double %77)
  %79 = call i64 @nish_arena_mark()
  %80 = call i8* @show(double %78)
  %81 = call i8* @nish_arena_keep(i64 %79, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %76, i8* %81)
  %83 = call i8* @nish_str_concat(i8* %82, i8* bitcast ({ i64, [7 x i8] }* @.str.21 to i8*))
  %84 = load double, double* %x.addr, align 8
  %85 = call double @nish_ceil_f64(double %84)
  %86 = call i64 @nish_arena_mark()
  %87 = call i8* @show(double %85)
  %88 = call i8* @nish_arena_keep(i64 %86, i8* %87)
  %89 = call i8* @nish_str_concat(i8* %83, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [8 x i8] }* @.str.22 to i8*))
  %91 = load double, double* %x.addr, align 8
  %92 = call double @nish_trunc_f64(double %91)
  %93 = call i64 @nish_arena_mark()
  %94 = call i8* @show(double %92)
  %95 = call i8* @nish_arena_keep(i64 %93, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %90, i8* %95)
  %97 = call i8* @nish_str_concat(i8* %96, i8* bitcast ({ i64, [8 x i8] }* @.str.23 to i8*))
  %98 = load double, double* %x.addr, align 8
  %99 = call double @nish_floor_f64(double %98)
  %100 = fsub double %98, %99
  %101 = fcmp oge double %100, 0x3FE0000000000000
  %102 = fadd double %99, 0x3FF0000000000000
  %103 = select i1 %101, double %102, double %99
  %104 = call double @llvm.copysign.f64(double %103, double %98)
  %105 = call i64 @nish_arena_mark()
  %106 = call i8* @show(double %104)
  %107 = call i8* @nish_arena_keep(i64 %105, i8* %106)
  %108 = call i8* @nish_str_concat(i8* %97, i8* %107)
  call void @nish_print(i8* %108)
  %109 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %110 = load i8*, i8** %109, align 8
  %111 = icmp eq i8* %110, %69
  br i1 %111, label %pass.rewind, label %pass.free

pass.rewind:
  %112 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %71, i64* %112, align 8
  br label %pass.done

pass.free:
  %113 = ptrtoint i8* %69 to i64
  %114 = add i64 %113, %71
  call void @nish_arena_release(i64 %114)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %115 = load i64, i64* %forof.idx, align 8
  %116 = add i64 %115, 1
  store i64 %116, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn memory(inaccessiblemem: readwrite) "probe-stack"="inline-asm" }
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
!13 = !{!"element double", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
