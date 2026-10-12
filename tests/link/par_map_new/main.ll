%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$f64$f64$fn.6.square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

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

define hidden noundef double @square$(double noundef %x) #0 {
entry:
  %0 = fmul double %x, %x
  ret double %0
}

define noundef i32 @nish_main() #1 {
entry:
  %src.addr = alloca %struct.nish_array*, align 8
  %squares.addr = alloca %struct.nish_array*, align 8
  %ns.addr = alloca %struct.nish_array*, align 8
  %halves.addr = alloca %struct.nish_array*, align 8
  %none.addr = alloca %struct.nish_array*, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 32)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to double*
  %7 = getelementptr inbounds double, double* %6, i64 0
  store double 0x3FF0000000000000, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds double, double* %6, i64 1
  store double 0x4000000000000000, double* %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds double, double* %6, i64 2
  store double 0x4008000000000000, double* %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds double, double* %6, i64 3
  store double 0x4010000000000000, double* %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %src.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %12 = call %struct.nish_array* @nish.parallelMap$f64$f64$fn.6.square(%struct.nish_array* %11)
  store %struct.nish_array* %12, %struct.nish_array** %squares.addr, align 8
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 3, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 3, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = call i8* @nish_alloc_struct(i64 12)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %17 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 1, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %21 = getelementptr inbounds i32, i32* %19, i64 1
  store i32 2, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %22 = getelementptr inbounds i32, i32* %19, i64 2
  store i32 3, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %14, %struct.nish_array** %ns.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %ns.addr, align 8
  %24 = call %struct.nish_array* @nish.parallelMap$i32$f64$fn.16.nish_main$arrow0(%struct.nish_array* %23)
  store %struct.nish_array* %24, %struct.nish_array** %halves.addr, align 8
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %26, %struct.nish_array** %none.addr, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %31 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %30)
  store %struct.nish_array* %31, %struct.nish_array** %empty.addr, align 8
  %32 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = icmp ult i64 3, %40
  br i1 %41, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %40)
  unreachable

bounds.ok:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to double*
  %45 = getelementptr inbounds double, double* %44, i64 3
  %46 = load double, double* %45, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = call i8* @nish_str_from_f64(double %46)
  %48 = call i8* @nish_str_concat(i8* %37, i8* %47)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %50 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 2, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to double*
  %57 = getelementptr inbounds double, double* %56, i64 2
  %58 = load double, double* %57, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = call i8* @nish_str_from_f64(double %58)
  %60 = call i8* @nish_str_concat(i8* %49, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %62 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = trunc i64 %64 to i32
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %61, i8* %66)
  call void @nish_print(i8* %67)
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
