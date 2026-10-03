%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare i64 @llvm.fptosi.sat.i64.f64(double) #4
declare i64 @llvm.fptosi.sat.i64.f32(float) #4

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

define internal noundef nonnull align 8 i8* @show(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %x.addr = alloca i8, align 1
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
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %3
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store i8 %11, i8* %x.addr, align 1
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = load i8, i8* %x.addr, align 1
  %14 = zext i8 %13 to i64
  %15 = call i8* @nish_str_from_u64(i64 %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %17
  store i8* %15, i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = sitofp i64 %25 to double
  br label %forof.inc

forof.inc:
  %27 = load i64, i64* %forof.idx, align 8
  %28 = add i64 %27, 1
  store i64 %28, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %29 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*) to i64*
  %33 = load i64, i64* %32, align 8
  %34 = sub i64 %31, 1
  %35 = mul i64 %33, %34
  %36 = icmp eq i64 %31, 0
  %37 = select i1 %36, i64 0, i64 %35
  store i64 %37, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %38 = load i64, i64* %join.at, align 8
  %39 = icmp ult i64 %38, %31
  br i1 %39, label %join.sum.body, label %join.copy

join.sum.body:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %38
  %44 = load i8*, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %45 = load i64, i64* %join.total, align 8
  %46 = bitcast i8* %44 to i64*
  %47 = load i64, i64* %46, align 8
  %48 = add i64 %45, %47
  store i64 %48, i64* %join.total, align 8
  %49 = add i64 %38, 1
  store i64 %49, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %50 = load i64, i64* %join.total, align 8
  %51 = icmp ugt i64 %50, 2147483647
  %52 = add i64 %50, 9
  %53 = select i1 %51, i64 4611686018427387904, i64 %52
  %54 = call i8* @nish_alloc_struct(i64 %53)
  %55 = bitcast i8* %54 to i64*
  store i64 %50, i64* %55, align 8
  %56 = getelementptr inbounds i8, i8* %54, i64 8
  store i8* %56, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %57 = load i64, i64* %join.at, align 8
  %58 = icmp ult i64 %57, %31
  br i1 %58, label %join.part, label %join.end

join.part:
  %59 = load i8*, i8** %join.p, align 8
  %60 = icmp eq i64 %57, 0
  %61 = select i1 %60, i64 0, i64 %33
  %62 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %59, i8* %62, i64 %61, i1 false)
  %63 = getelementptr inbounds i8, i8* %59, i64 %61
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i8**
  %67 = getelementptr inbounds i8*, i8** %66, i64 %57
  %68 = load i8*, i8** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = bitcast i8* %68 to i64*
  %70 = load i64, i64* %69, align 8
  %71 = getelementptr inbounds i8, i8* %68, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %63, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %63, i64 %70
  store i8* %72, i8** %join.p, align 8
  %73 = add i64 %57, 1
  store i64 %73, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %74 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %74, align 1
  ret i8* %54
}

define noundef i32 @nish_main() #0 {
entry:
  %nan.addr = alloca double, align 8
  %inf.addr = alloca double, align 8
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i8], align 8
  %half.addr = alloca float, align 4
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8], align 8
  %wide.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %fill.at = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = fdiv double 0x0000000000000000, 0x0000000000000000
  store double %0, double* %nan.addr, align 8
  %1 = fdiv double 0x3FF0000000000000, 0x0000000000000000
  store double %1, double* %inf.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast [6 x i8]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 0, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 0, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 0, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 0, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8, i8* %6, i64 4
  store i8 0, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8, i8* %6, i64 5
  store i8 0, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %14 = load double, double* %nan.addr, align 8
  %15 = call i64 @llvm.fptosi.sat.i64.f64(double %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp slt i64 %15, 0
  %19 = add i64 %17, %15
  %20 = call i64 @llvm.smax.i64(i64 %19, i64 0)
  %21 = call i64 @llvm.smin.i64(i64 %15, i64 %17)
  %22 = select i1 %18, i64 %20, i64 %21
  %23 = sub i64 %17, %22
  %24 = call i64 @llvm.smax.i64(i64 %23, i64 0)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 %22
  call void @llvm.memset.p0i8.i64(i8* %28, i8 1, i64 %24, i1 false), !alias.scope !4, !noalias !3
  %29 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %30 = call i8* @show(%struct.nish_array* %29)
  call void @nish_print(i8* %30)
  %31 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %32 = call i64 @llvm.fptosi.sat.i64.f64(double 0x0000000000000000)
  %33 = load double, double* %inf.addr, align 8
  %34 = call i64 @llvm.fptosi.sat.i64.f64(double %33)
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = icmp slt i64 %32, 0
  %38 = add i64 %36, %32
  %39 = call i64 @llvm.smax.i64(i64 %38, i64 0)
  %40 = call i64 @llvm.smin.i64(i64 %32, i64 %36)
  %41 = select i1 %37, i64 %39, i64 %40
  %42 = icmp slt i64 %34, 0
  %43 = add i64 %36, %34
  %44 = call i64 @llvm.smax.i64(i64 %43, i64 0)
  %45 = call i64 @llvm.smin.i64(i64 %34, i64 %36)
  %46 = select i1 %42, i64 %44, i64 %45
  %47 = sub i64 %46, %41
  %48 = call i64 @llvm.smax.i64(i64 %47, i64 0)
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i8*
  %52 = getelementptr inbounds i8, i8* %51, i64 %41
  call void @llvm.memset.p0i8.i64(i8* %52, i8 2, i64 %48, i1 false), !alias.scope !4, !noalias !3
  %53 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %54 = call i8* @show(%struct.nish_array* %53)
  call void @nish_print(i8* %54)
  %55 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %56 = load double, double* %inf.addr, align 8
  %57 = fneg double %56
  %58 = call i64 @llvm.fptosi.sat.i64.f64(double %57)
  %59 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF8000000000000)
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = icmp slt i64 %58, 0
  %63 = add i64 %61, %58
  %64 = call i64 @llvm.smax.i64(i64 %63, i64 0)
  %65 = call i64 @llvm.smin.i64(i64 %58, i64 %61)
  %66 = select i1 %62, i64 %64, i64 %65
  %67 = icmp slt i64 %59, 0
  %68 = add i64 %61, %59
  %69 = call i64 @llvm.smax.i64(i64 %68, i64 0)
  %70 = call i64 @llvm.smin.i64(i64 %59, i64 %61)
  %71 = select i1 %67, i64 %69, i64 %70
  %72 = sub i64 %71, %66
  %73 = call i64 @llvm.smax.i64(i64 %72, i64 0)
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i8*
  %77 = getelementptr inbounds i8, i8* %76, i64 %66
  call void @llvm.memset.p0i8.i64(i8* %77, i8 3, i64 %73, i1 false), !alias.scope !4, !noalias !3
  %78 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %79 = call i8* @show(%struct.nish_array* %78)
  call void @nish_print(i8* %79)
  %80 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %81 = call i64 @llvm.fptosi.sat.i64.f64(double 0x7E37E43C8800759C)
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = icmp slt i64 %81, 0
  %85 = add i64 %83, %81
  %86 = call i64 @llvm.smax.i64(i64 %85, i64 0)
  %87 = call i64 @llvm.smin.i64(i64 %81, i64 %83)
  %88 = select i1 %84, i64 %86, i64 %87
  %89 = sub i64 %83, %88
  %90 = call i64 @llvm.smax.i64(i64 %89, i64 0)
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %93 = bitcast i8* %92 to i8*
  %94 = getelementptr inbounds i8, i8* %93, i64 %88
  call void @llvm.memset.p0i8.i64(i8* %94, i8 4, i64 %90, i1 false), !alias.scope !4, !noalias !3
  %95 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %96 = fneg double 0x7E37E43C8800759C
  %97 = call i64 @llvm.fptosi.sat.i64.f64(double %96)
  %98 = fneg double 0x401399999999999A
  %99 = call i64 @llvm.fptosi.sat.i64.f64(double %98)
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = icmp slt i64 %97, 0
  %103 = add i64 %101, %97
  %104 = call i64 @llvm.smax.i64(i64 %103, i64 0)
  %105 = call i64 @llvm.smin.i64(i64 %97, i64 %101)
  %106 = select i1 %102, i64 %104, i64 %105
  %107 = icmp slt i64 %99, 0
  %108 = add i64 %101, %99
  %109 = call i64 @llvm.smax.i64(i64 %108, i64 0)
  %110 = call i64 @llvm.smin.i64(i64 %99, i64 %101)
  %111 = select i1 %107, i64 %109, i64 %110
  %112 = sub i64 %111, %106
  %113 = call i64 @llvm.smax.i64(i64 %112, i64 0)
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %116 = bitcast i8* %115 to i8*
  %117 = getelementptr inbounds i8, i8* %116, i64 %106
  call void @llvm.memset.p0i8.i64(i8* %117, i8 4, i64 %113, i1 false), !alias.scope !4, !noalias !3
  %118 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %119 = call i8* @show(%struct.nish_array* %118)
  call void @nish_print(i8* %119)
  store float 0x4012000000000000, float* %half.addr, align 4
  %120 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %121 = load float, float* %half.addr, align 4
  %122 = call i64 @llvm.fptosi.sat.i64.f32(float %121)
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = icmp slt i64 %122, 0
  %126 = add i64 %124, %122
  %127 = call i64 @llvm.smax.i64(i64 %126, i64 0)
  %128 = call i64 @llvm.smin.i64(i64 %122, i64 %124)
  %129 = select i1 %125, i64 %127, i64 %128
  %130 = sub i64 %124, %129
  %131 = call i64 @llvm.smax.i64(i64 %130, i64 0)
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %134 = bitcast i8* %133 to i8*
  %135 = getelementptr inbounds i8, i8* %134, i64 %129
  call void @llvm.memset.p0i8.i64(i8* %135, i8 5, i64 %131, i1 false), !alias.scope !4, !noalias !3
  %136 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %137 = call i8* @show(%struct.nish_array* %136)
  call void @nish_print(i8* %137)
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %139, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %140 = bitcast [2 x i8]* %arr.data.1 to i8*
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %140, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %142 = bitcast i8* %140 to i8*
  %143 = getelementptr inbounds i8, i8* %142, i64 0
  store i8 9, i8* %143, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %144 = getelementptr inbounds i8, i8* %142, i64 1
  store i8 8, i8* %144, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %145 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %146 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %147 = load double, double* %nan.addr, align 8
  %148 = call i64 @llvm.fptosi.sat.i64.f64(double %147)
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %146, i64 0, i32 0
  %150 = load i64, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %151 = add i64 %148, %150
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 0
  %153 = load i64, i64* %152, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %154 = icmp ule i64 %148, %151
  %155 = icmp ule i64 %151, %153
  %156 = and i1 %154, %155
  br i1 %156, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %148, i64 %151, i64 %153)
  unreachable

set.ok:
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 2
  %158 = load i8*, i8** %157, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %159 = bitcast i8* %158 to i8*
  %160 = getelementptr inbounds i8, i8* %159, i64 %148
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %146, i64 0, i32 2
  %162 = load i8*, i8** %161, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %163 = bitcast i8* %162 to i8*
  %164 = getelementptr inbounds i8, i8* %163, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %160, i8* %164, i64 %150, i1 false), !alias.scope !4, !noalias !3
  %165 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %166 = call i8* @show(%struct.nish_array* %165)
  call void @nish_print(i8* %166)
  %167 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %168 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %169 = call i64 @llvm.fptosi.sat.i64.f64(double 0x400FEB851EB851EC)
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 0
  %171 = load i64, i64* %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %172 = add i64 %169, %171
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %167, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = icmp ule i64 %169, %172
  %176 = icmp ule i64 %172, %174
  %177 = and i1 %175, %176
  br i1 %177, label %set.ok.1, label %set.fail.1

set.fail.1:
  call void @nish_panic_slice(i64 %169, i64 %172, i64 %174)
  unreachable

set.ok.1:
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %167, i64 0, i32 2
  %179 = load i8*, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %180 = bitcast i8* %179 to i8*
  %181 = getelementptr inbounds i8, i8* %180, i64 %169
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 2
  %183 = load i8*, i8** %182, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %184 = bitcast i8* %183 to i8*
  %185 = getelementptr inbounds i8, i8* %184, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %181, i8* %185, i64 %171, i1 false), !alias.scope !4, !noalias !3
  %186 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %187 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %188 = fneg double 0x3FE0000000000000
  %189 = call i64 @llvm.fptosi.sat.i64.f64(double %188)
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 0
  %191 = load i64, i64* %190, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %192 = add i64 %189, %191
  %193 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %186, i64 0, i32 0
  %194 = load i64, i64* %193, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %195 = icmp ule i64 %189, %192
  %196 = icmp ule i64 %192, %194
  %197 = and i1 %195, %196
  br i1 %197, label %set.ok.2, label %set.fail.2

set.fail.2:
  call void @nish_panic_slice(i64 %189, i64 %192, i64 %194)
  unreachable

set.ok.2:
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %186, i64 0, i32 2
  %199 = load i8*, i8** %198, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %200 = bitcast i8* %199 to i8*
  %201 = getelementptr inbounds i8, i8* %200, i64 %189
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 2
  %203 = load i8*, i8** %202, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %204 = bitcast i8* %203 to i8*
  %205 = getelementptr inbounds i8, i8* %204, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %201, i8* %205, i64 %191, i1 false), !alias.scope !4, !noalias !3
  %206 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %207 = call i8* @show(%struct.nish_array* %206)
  call void @nish_print(i8* %207)
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %208, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %209, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %210 = bitcast [3 x i32]* %arr.data.2 to i8*
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %210, i8** %211, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %212 = bitcast i8* %210 to i32*
  %213 = getelementptr inbounds i32, i32* %212, i64 0
  store i32 0, i32* %213, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %214 = getelementptr inbounds i32, i32* %212, i64 1
  store i32 0, i32* %214, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %215 = getelementptr inbounds i32, i32* %212, i64 2
  store i32 0, i32* %215, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %wide.addr, align 8
  %216 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %217 = load double, double* %inf.addr, align 8
  %218 = fneg double %217
  %219 = call i64 @llvm.fptosi.sat.i64.f64(double %218)
  %220 = load double, double* %inf.addr, align 8
  %221 = call i64 @llvm.fptosi.sat.i64.f64(double %220)
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 0
  %223 = load i64, i64* %222, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %224 = icmp slt i64 %219, 0
  %225 = add i64 %223, %219
  %226 = call i64 @llvm.smax.i64(i64 %225, i64 0)
  %227 = call i64 @llvm.smin.i64(i64 %219, i64 %223)
  %228 = select i1 %224, i64 %226, i64 %227
  %229 = icmp slt i64 %221, 0
  %230 = add i64 %223, %221
  %231 = call i64 @llvm.smax.i64(i64 %230, i64 0)
  %232 = call i64 @llvm.smin.i64(i64 %221, i64 %223)
  %233 = select i1 %229, i64 %231, i64 %232
  store i64 %228, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %234 = load i64, i64* %fill.at, align 8
  %235 = icmp slt i64 %234, %233
  br i1 %235, label %fill.body, label %fill.end

fill.body:
  %236 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 2
  %237 = load i8*, i8** %236, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %238 = bitcast i8* %237 to i32*
  %239 = getelementptr inbounds i32, i32* %238, i64 %234
  store i32 -1, i32* %239, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %240 = add i64 %234, 1
  store i64 %240, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %241 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %242 = fptosi double 0x0000000000000000 to i64
  %243 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 0
  %244 = load i64, i64* %243, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %245 = icmp ult i64 %242, %244
  br i1 %245, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %242, i64 %244)
  unreachable

bounds.ok:
  %246 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 2
  %247 = load i8*, i8** %246, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %248 = bitcast i8* %247 to i32*
  %249 = getelementptr inbounds i32, i32* %248, i64 %242
  %250 = load i32, i32* %249, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %251 = call i8* @nish_str_from_i32(i32 %250)
  %252 = call i8* @nish_str_concat(i8* %251, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %253 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %254 = fptosi double 0x3FF0000000000000 to i64
  %255 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %253, i64 0, i32 0
  %256 = load i64, i64* %255, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %257 = icmp ult i64 %254, %256
  br i1 %257, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %254, i64 %256)
  unreachable

bounds.ok.1:
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %253, i64 0, i32 2
  %259 = load i8*, i8** %258, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %260 = bitcast i8* %259 to i32*
  %261 = getelementptr inbounds i32, i32* %260, i64 %254
  %262 = load i32, i32* %261, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %263 = call i8* @nish_str_from_i32(i32 %262)
  %264 = call i8* @nish_str_concat(i8* %252, i8* %263)
  %265 = call i8* @nish_str_concat(i8* %264, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %266 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %267 = fptosi double 0x4000000000000000 to i64
  %268 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %266, i64 0, i32 0
  %269 = load i64, i64* %268, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %270 = icmp ult i64 %267, %269
  br i1 %270, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %267, i64 %269)
  unreachable

bounds.ok.2:
  %271 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %266, i64 0, i32 2
  %272 = load i8*, i8** %271, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %273 = bitcast i8* %272 to i32*
  %274 = getelementptr inbounds i32, i32* %273, i64 %267
  %275 = load i32, i32* %274, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %276 = call i8* @nish_str_from_i32(i32 %275)
  %277 = call i8* @nish_str_concat(i8* %265, i8* %276)
  call void @nish_print(i8* %277)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element i32", !6, i64 0}
!18 = !{!17, !17, i64 0}
