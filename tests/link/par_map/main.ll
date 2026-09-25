%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @nish.parallelMapInto$f64$f64$fn.6.square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare void @nish.parallelMapInto$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare void @nish.parallelMapInto$f64$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

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

define hidden noundef double @square(double noundef %x) #0 {
entry:
  %0 = fmul double %x, %x
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %src.addr = alloca %struct.nish_array*, align 8
  %dst.addr = alloca %struct.nish_array*, align 8
  %ns.addr = alloca %struct.nish_array*, align 8
  %halves.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = call i8* @nish_alloc_struct(i64 32)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to double*
  %7 = getelementptr inbounds double, double* %6, i64 0
  store double 0x3FF0000000000000, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %8 = getelementptr inbounds double, double* %6, i64 1
  store double 0x4000000000000000, double* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %9 = getelementptr inbounds double, double* %6, i64 2
  store double 0x4008000000000000, double* %9, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %10 = getelementptr inbounds double, double* %6, i64 3
  store double 0x4010000000000000, double* %10, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  store %struct.nish_array* %1, %struct.nish_array** %src.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 5, i64* %13, align 8, !alias.scope !3, !noalias !4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 5, i64* %14, align 8, !alias.scope !3, !noalias !4
  %15 = call i8* @nish_alloc_struct(i64 40)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %15 to double*
  %18 = getelementptr inbounds double, double* %17, i64 0
  store double 0x0000000000000000, double* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %19 = getelementptr inbounds double, double* %17, i64 1
  store double 0x0000000000000000, double* %19, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %20 = getelementptr inbounds double, double* %17, i64 2
  store double 0x0000000000000000, double* %20, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %21 = getelementptr inbounds double, double* %17, i64 3
  store double 0x0000000000000000, double* %21, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %22 = getelementptr inbounds double, double* %17, i64 4
  store double 0x4022000000000000, double* %22, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  store %struct.nish_array* %12, %struct.nish_array** %dst.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$f64$f64$fn.6.square(%struct.nish_array* %23, %struct.nish_array* %24)
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 3, i64* %27, align 8, !alias.scope !3, !noalias !4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 3, i64* %28, align 8, !alias.scope !3, !noalias !4
  %29 = call i8* @nish_alloc_struct(i64 12)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4
  %31 = bitcast i8* %29 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 0
  store i32 1, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !10
  %33 = getelementptr inbounds i32, i32* %31, i64 1
  store i32 2, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !10
  %34 = getelementptr inbounds i32, i32* %31, i64 2
  store i32 3, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !10
  store %struct.nish_array* %26, %struct.nish_array** %ns.addr, align 8
  %35 = call i8* @nish_alloc_struct(i64 24)
  %36 = bitcast i8* %35 to %struct.nish_array*
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  store i64 3, i64* %37, align 8, !alias.scope !3, !noalias !4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  store i64 3, i64* %38, align 8, !alias.scope !3, !noalias !4
  %39 = call i8* @nish_alloc_struct(i64 24)
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !3, !noalias !4
  %41 = bitcast i8* %39 to double*
  %42 = getelementptr inbounds double, double* %41, i64 0
  store double 0x0000000000000000, double* %42, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %43 = getelementptr inbounds double, double* %41, i64 1
  store double 0x0000000000000000, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %44 = getelementptr inbounds double, double* %41, i64 2
  store double 0x0000000000000000, double* %44, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  store %struct.nish_array* %36, %struct.nish_array** %halves.addr, align 8
  %45 = load %struct.nish_array*, %struct.nish_array** %ns.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  call void @nish.parallelMapInto$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* %45, %struct.nish_array* %46)
  %47 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$f64$f64$fn.16.nish_main$arrow1(%struct.nish_array* %47, %struct.nish_array* %48)
  %49 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4
  %52 = icmp ult i64 0, %51
  br i1 %52, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %51)
  unreachable

bounds.ok:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4
  %55 = bitcast i8* %54 to double*
  %56 = getelementptr inbounds double, double* %55, i64 0
  %57 = load double, double* %56, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %58 = call i8* @nish_str_from_f64(double %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %60 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4
  %63 = icmp ult i64 3, %62
  br i1 %63, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %62)
  unreachable

bounds.ok.1:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4
  %66 = bitcast i8* %65 to double*
  %67 = getelementptr inbounds double, double* %66, i64 3
  %68 = load double, double* %67, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %69 = call i8* @nish_str_from_f64(double %68)
  %70 = call i8* @nish_str_concat(i8* %59, i8* %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %72 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4
  %75 = icmp ult i64 4, %74
  br i1 %75, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 4, i64 %74)
  unreachable

bounds.ok.2:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4
  %78 = bitcast i8* %77 to double*
  %79 = getelementptr inbounds double, double* %78, i64 4
  %80 = load double, double* %79, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %81 = call i8* @nish_str_from_f64(double %80)
  %82 = call i8* @nish_str_concat(i8* %71, i8* %81)
  %83 = call i8* @nish_str_concat(i8* %82, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %84 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4
  %87 = icmp ult i64 2, %86
  br i1 %87, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 2, i64 %86)
  unreachable

bounds.ok.3:
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4
  %90 = bitcast i8* %89 to double*
  %91 = getelementptr inbounds double, double* %90, i64 2
  %92 = load double, double* %91, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %93 = call i8* @nish_str_from_f64(double %92)
  %94 = call i8* @nish_str_concat(i8* %83, i8* %93)
  call void @nish_print(i8* %94)
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

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element double", !6, i64 0}
!8 = !{!7, !7, i64 0}
!9 = !{!"element i32", !6, i64 0}
!10 = !{!9, !9, i64 0}
