%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish.parallelMapInto$f64$f64$fn.6.square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare void @nish.parallelMapInto$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare void @nish.parallelMapInto$f64$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define hidden noundef double @square$(double noundef %x) #0 {
entry:
  %0 = fmul double %x, %x
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %src.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x double], align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [5 x double], align 8
  %ns.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %halves.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [3 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x double]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to double*
  %5 = getelementptr inbounds double, double* %4, i64 0
  store double 0x3FF0000000000000, double* %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds double, double* %4, i64 1
  store double 0x4000000000000000, double* %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds double, double* %4, i64 2
  store double 0x4008000000000000, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds double, double* %4, i64 3
  store double 0x4010000000000000, double* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %src.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 5, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 5, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast [5 x double]* %arr.data.1 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to double*
  %14 = getelementptr inbounds double, double* %13, i64 0
  store double 0x0000000000000000, double* %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds double, double* %13, i64 1
  store double 0x0000000000000000, double* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds double, double* %13, i64 2
  store double 0x0000000000000000, double* %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds double, double* %13, i64 3
  store double 0x0000000000000000, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds double, double* %13, i64 4
  store double 0x4022000000000000, double* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %dst.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$f64$f64$fn.6.square(%struct.nish_array* %19, %struct.nish_array* %20)
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = bitcast [3 x i32]* %arr.data.2 to i8*
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %23 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  store i32 1, i32* %26, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %27 = getelementptr inbounds i32, i32* %25, i64 1
  store i32 2, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = getelementptr inbounds i32, i32* %25, i64 2
  store i32 3, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %ns.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 3, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 3, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = bitcast [3 x double]* %arr.data.3 to i8*
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %31, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %31 to double*
  %34 = getelementptr inbounds double, double* %33, i64 0
  store double 0x0000000000000000, double* %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = getelementptr inbounds double, double* %33, i64 1
  store double 0x0000000000000000, double* %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = getelementptr inbounds double, double* %33, i64 2
  store double 0x0000000000000000, double* %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %halves.addr, align 8
  %37 = load %struct.nish_array*, %struct.nish_array** %ns.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  call void @nish.parallelMapInto$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* %37, %struct.nish_array* %38)
  %39 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %40 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$f64$f64$fn.16.nish_main$arrow1(%struct.nish_array* %39, %struct.nish_array* %40)
  %41 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp ult i64 0, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to double*
  %48 = getelementptr inbounds double, double* %47, i64 0
  %49 = load double, double* %48, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = call i8* @nish_str_from_f64(double %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 3, %54
  br i1 %55, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %54)
  unreachable

bounds.ok.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to double*
  %59 = getelementptr inbounds double, double* %58, i64 3
  %60 = load double, double* %59, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = call i8* @nish_str_from_f64(double %60)
  %62 = call i8* @nish_str_concat(i8* %51, i8* %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %64 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = icmp ult i64 4, %66
  br i1 %67, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 4, i64 %66)
  unreachable

bounds.ok.2:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %69 to double*
  %71 = getelementptr inbounds double, double* %70, i64 4
  %72 = load double, double* %71, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %73 = call i8* @nish_str_from_f64(double %72)
  %74 = call i8* @nish_str_concat(i8* %63, i8* %73)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %76 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = icmp ult i64 2, %78
  br i1 %79, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 2, i64 %78)
  unreachable

bounds.ok.3:
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = bitcast i8* %81 to double*
  %83 = getelementptr inbounds double, double* %82, i64 2
  %84 = load double, double* %83, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %85 = call i8* @nish_str_from_f64(double %84)
  %86 = call i8* @nish_str_concat(i8* %75, i8* %85)
  call void @nish_print(i8* %86)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef double @nish_main$arrow0(i32 noundef %n) #0 {
entry:
  %0 = sitofp i32 %n to double
  %1 = fdiv double %0, 0x4000000000000000
  ret double %1
}

define hidden noundef double @nish_main$arrow1(double noundef %x) #0 {
entry:
  %0 = fadd double %x, 0x3FF0000000000000
  ret double %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
