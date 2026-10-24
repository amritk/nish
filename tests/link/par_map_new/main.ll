%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$f64$f64$fn.6.square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

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
  %squares.addr = alloca %struct.nish_array*, align 8
  %ns.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %halves.addr = alloca %struct.nish_array*, align 8
  %none.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
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
  %9 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %10 = call %struct.nish_array* @nish.parallelMap$f64$f64$fn.6.square(%struct.nish_array* %9)
  store %struct.nish_array* %10, %struct.nish_array** %squares.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast [3 x i32]* %arr.data.1 to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 1, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %17 = getelementptr inbounds i32, i32* %15, i64 1
  store i32 2, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = getelementptr inbounds i32, i32* %15, i64 2
  store i32 3, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ns.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %ns.addr, align 8
  %20 = call %struct.nish_array* @nish.parallelMap$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* %19)
  store %struct.nish_array* %20, %struct.nish_array** %halves.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %none.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %25 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %24)
  store %struct.nish_array* %25, %struct.nish_array** %empty.addr, align 8
  %26 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = icmp ult i64 3, %34
  br i1 %35, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %34)
  unreachable

bounds.ok:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to double*
  %39 = getelementptr inbounds double, double* %38, i64 3
  %40 = load double, double* %39, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = call i8* @nish_str_from_f64(double %40)
  %42 = call i8* @nish_str_concat(i8* %31, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 2, %46
  br i1 %47, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %46)
  unreachable

bounds.ok.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to double*
  %51 = getelementptr inbounds double, double* %50, i64 2
  %52 = load double, double* %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = call i8* @nish_str_from_f64(double %52)
  %54 = call i8* @nish_str_concat(i8* %43, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %56 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = trunc i64 %58 to i32
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %55, i8* %60)
  call void @nish_print(i8* %61)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef double @nish_main$arrow0(i32 noundef %n) #0 {
entry:
  %0 = sitofp i32 %n to double
  %1 = fdiv double %0, 0x4000000000000000
  ret double %1
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %n) #1 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
