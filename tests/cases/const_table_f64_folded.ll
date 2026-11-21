%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_const_0_WEIGHTS.data = private unnamed_addr constant [7 x double] [double 0x3FE0000000000000, double 0x3FE5555555555555, double 0xC000000000000000, double 0x4012000000000000, double 0x0000000000000000, double 0x3FEAAAAAAAAAAAAA, double 0x8000000000000000], align 16
@nish_const_0_WEIGHTS = internal constant %struct.nish_array { i64 7, i64 7, i8* bitcast ([7 x double]* @nish_const_0_WEIGHTS.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define void @nish_main() #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %w.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to double*
  %10 = getelementptr inbounds double, double* %9, i64 %3
  %11 = load double, double* %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store double %11, double* %w.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = load double, double* %w.addr, align 8
  %14 = call i8* @nish_str_from_f64(double %13)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = icmp eq i64 %16, %18
  br i1 %19, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  store i8* %14, i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %24 = add i64 %16, 1
  store i64 %24, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  br label %forof.inc

forof.inc:
  %26 = load i64, i64* %forof.idx, align 8
  %27 = add i64 %26, 1
  store i64 %27, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = trunc i64 %29 to i32
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  %33 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*) to i64*
  %37 = load i64, i64* %36, align 8
  %38 = sub i64 %35, 1
  %39 = mul i64 %37, %38
  %40 = icmp eq i64 %35, 0
  %41 = select i1 %40, i64 0, i64 %39
  store i64 %41, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %42 = load i64, i64* %join.at, align 8
  %43 = icmp ult i64 %42, %35
  br i1 %43, label %join.sum.body, label %join.copy

join.sum.body:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i8**
  %47 = getelementptr inbounds i8*, i8** %46, i64 %42
  %48 = load i8*, i8** %47, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %49 = load i64, i64* %join.total, align 8
  %50 = bitcast i8* %48 to i64*
  %51 = load i64, i64* %50, align 8
  %52 = add i64 %49, %51
  store i64 %52, i64* %join.total, align 8
  %53 = add i64 %42, 1
  store i64 %53, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %54 = load i64, i64* %join.total, align 8
  %55 = icmp ugt i64 %54, 2147483647
  %56 = add i64 %54, 9
  %57 = select i1 %55, i64 4611686018427387904, i64 %56
  %58 = call i8* @nish_alloc_struct(i64 %57)
  %59 = bitcast i8* %58 to i64*
  store i64 %54, i64* %59, align 8
  %60 = getelementptr inbounds i8, i8* %58, i64 8
  store i8* %60, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %61 = load i64, i64* %join.at, align 8
  %62 = icmp ult i64 %61, %35
  br i1 %62, label %join.part, label %join.end

join.part:
  %63 = load i8*, i8** %join.p, align 8
  %64 = icmp eq i64 %61, 0
  %65 = select i1 %64, i64 0, i64 %37
  %66 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %63, i8* %66, i64 %65, i1 false)
  %67 = getelementptr inbounds i8, i8* %63, i64 %65
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %69 to i8**
  %71 = getelementptr inbounds i8*, i8** %70, i64 %61
  %72 = load i8*, i8** %71, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %73 = bitcast i8* %72 to i64*
  %74 = load i64, i64* %73, align 8
  %75 = getelementptr inbounds i8, i8* %72, i64 8
  %76 = icmp eq i64 %74, 1
  br i1 %76, label %join.byte, label %join.bulk

join.byte:
  %77 = load i8, i8* %75, align 1
  store i8 %77, i8* %67, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %67, i8* %75, i64 %74, i1 false)
  br label %join.next

join.next:
  %78 = getelementptr inbounds i8, i8* %67, i64 %74
  store i8* %78, i8** %join.p, align 8
  %79 = add i64 %61, 1
  store i64 %79, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %80 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %80, align 1
  %81 = call i8* @nish_str_concat(i8* %32, i8* %58)
  call void @nish_print(i8* %81)
  %82 = sext i32 3 to i64
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %85 = bitcast i8* %84 to double*
  %86 = getelementptr inbounds double, double* %85, i64 %82
  %87 = load double, double* %86, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %90 = bitcast i8* %89 to double*
  %91 = getelementptr inbounds double, double* %90, i64 0
  %92 = load double, double* %91, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %93 = fsub double %87, %92
  %94 = call i8* @nish_str_from_f64(double %93)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_WEIGHTS, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %97 to double*
  %99 = getelementptr inbounds double, double* %98, i64 6
  %100 = load double, double* %99, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %101 = fdiv double 0x3FF0000000000000, %100
  %102 = call i8* @nish_str_from_f64(double %101)
  %103 = call i8* @nish_str_concat(i8* %95, i8* %102)
  call void @nish_print(i8* %103)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
