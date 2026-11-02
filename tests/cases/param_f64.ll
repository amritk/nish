%struct.Gauge = type { double }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2

define internal noundef double @mix(double noundef %a, double noundef %t, double noundef %b) #0 {
entry:
  %0 = fsub double %b, %a
  %1 = fmul double %0, %t
  %2 = fadd double %a, %1
  ret double %2
}

define internal noundef double @mean(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %sum.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = fcmp oeq double %2, 0x0000000000000000
  br i1 %3, label %if.then, label %if.end

if.then:
  ret double 0x0000000000000000

if.end:
  store double 0x0000000000000000, double* %sum.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %forof.body, label %forof.end

forof.body:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to double*
  %11 = getelementptr inbounds double, double* %10, i64 %4
  %12 = load double, double* %11, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  store double %12, double* %x.addr, align 8
  %13 = load double, double* %sum.addr, align 8
  %14 = load double, double* %x.addr, align 8
  %15 = fadd double %13, %14
  store double %15, double* %sum.addr, align 8
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %18 = load double, double* %sum.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = sitofp i64 %20 to double
  %22 = fdiv double %18, %21
  ret double %22
}

define internal void @Gauge.constructor(%struct.Gauge* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, double noundef %level) #2 {
entry:
  %0 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 0
  store double %level, double* %0, align 8, !tbaa !16
  ret void
}

define internal noundef double @Gauge.raise(%struct.Gauge* noundef nonnull align 8 dereferenceable(8) nocapture %this, double noundef %by) #2 {
entry:
  %0 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 0
  %1 = load double, double* %0, align 8, !tbaa !16
  %2 = fadd double %1, %by
  %3 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 0
  store double %2, double* %3, align 8, !tbaa !16
  %4 = getelementptr inbounds %struct.Gauge, %struct.Gauge* %this, i32 0, i32 0
  %5 = load double, double* %4, align 8, !tbaa !16
  ret double %5
}

define void @nish_main() #2 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x double], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x double], align 8
  %g.addr = alloca %struct.Gauge*, align 8
  %Gauge.obj = alloca %struct.Gauge, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @mix(double 0x4000000000000000, double 0x3FD0000000000000, double 0x4000000000000000)
  %1 = call i8* @nish_str_from_f64(double %0)
  call void @nish_print(i8* %1)
  %2 = call double @mix(double 0x4000000000000000, double 0x3FE0000000000000, double 0x4018000000000000)
  %3 = call i8* @nish_str_from_f64(double %2)
  call void @nish_print(i8* %3)
  %4 = call double @mix(double 0x4000000000000000, double 0x3FE8000000000000, double 0x4000000000000000)
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = call double @mean(%struct.nish_array* %arr.hdr)
  %10 = call i8* @nish_str_from_f64(double %9)
  call void @nish_print(i8* %10)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %13 = bitcast [2 x double]* %arr.data to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = bitcast i8* %13 to double*
  %16 = getelementptr inbounds double, double* %15, i64 0
  store double 0x3FF0000000000000, double* %16, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %17 = getelementptr inbounds double, double* %15, i64 1
  store double 0x4000000000000000, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %18 = call double @mean(%struct.nish_array* %arr.hdr.1)
  %19 = call i8* @nish_str_from_f64(double %18)
  call void @nish_print(i8* %19)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %22 = bitcast [3 x double]* %arr.data.1 to i8*
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = bitcast i8* %22 to double*
  %25 = getelementptr inbounds double, double* %24, i64 0
  store double 0x3FB999999999999A, double* %25, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %26 = getelementptr inbounds double, double* %24, i64 1
  store double 0x3FC999999999999A, double* %26, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = getelementptr inbounds double, double* %24, i64 2
  store double 0x3FD3333333333333, double* %27, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %28 = call double @mean(%struct.nish_array* %arr.hdr.2)
  %29 = call i8* @nish_str_from_f64(double %28)
  call void @nish_print(i8* %29)
  call void @Gauge.constructor(%struct.Gauge* %Gauge.obj, double 0x3FF8000000000000)
  store %struct.Gauge* %Gauge.obj, %struct.Gauge** %g.addr, align 8
  %30 = load %struct.Gauge*, %struct.Gauge** %g.addr, align 8
  %31 = call double @Gauge.raise(%struct.Gauge* %30, double 0x3FE0000000000000)
  %32 = call i8* @nish_str_from_f64(double %31)
  call void @nish_print(i8* %32)
  %33 = load %struct.Gauge*, %struct.Gauge** %g.addr, align 8
  %34 = call double @Gauge.raise(%struct.Gauge* %33, double 0x4002000000000000)
  %35 = call i8* @nish_str_from_f64(double %34)
  call void @nish_print(i8* %35)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
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
!14 = !{!"double", !6, i64 0}
!15 = !{!"Gauge", !14, i64 0}
!16 = !{!15, !14, i64 0}
!17 = !{!9, !7, i64 8}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}
