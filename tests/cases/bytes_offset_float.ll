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
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
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
  %30 = call i64 @nish_arena_mark()
  %31 = call i8* @show(%struct.nish_array* %29)
  %32 = call i8* @nish_arena_keep(i64 %30, i8* %31)
  call void @nish_print(i8* %32)
  %33 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %34 = call i64 @llvm.fptosi.sat.i64.f64(double 0x0000000000000000)
  %35 = load double, double* %inf.addr, align 8
  %36 = call i64 @llvm.fptosi.sat.i64.f64(double %35)
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp slt i64 %34, 0
  %40 = add i64 %38, %34
  %41 = call i64 @llvm.smax.i64(i64 %40, i64 0)
  %42 = call i64 @llvm.smin.i64(i64 %34, i64 %38)
  %43 = select i1 %39, i64 %41, i64 %42
  %44 = icmp slt i64 %36, 0
  %45 = add i64 %38, %36
  %46 = call i64 @llvm.smax.i64(i64 %45, i64 0)
  %47 = call i64 @llvm.smin.i64(i64 %36, i64 %38)
  %48 = select i1 %44, i64 %46, i64 %47
  %49 = sub i64 %48, %43
  %50 = call i64 @llvm.smax.i64(i64 %49, i64 0)
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %53 = bitcast i8* %52 to i8*
  %54 = getelementptr inbounds i8, i8* %53, i64 %43
  call void @llvm.memset.p0i8.i64(i8* %54, i8 2, i64 %50, i1 false), !alias.scope !4, !noalias !3
  %55 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @show(%struct.nish_array* %55)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  call void @nish_print(i8* %58)
  %59 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %60 = load double, double* %inf.addr, align 8
  %61 = fneg double %60
  %62 = call i64 @llvm.fptosi.sat.i64.f64(double %61)
  %63 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF8000000000000)
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = icmp slt i64 %62, 0
  %67 = add i64 %65, %62
  %68 = call i64 @llvm.smax.i64(i64 %67, i64 0)
  %69 = call i64 @llvm.smin.i64(i64 %62, i64 %65)
  %70 = select i1 %66, i64 %68, i64 %69
  %71 = icmp slt i64 %63, 0
  %72 = add i64 %65, %63
  %73 = call i64 @llvm.smax.i64(i64 %72, i64 0)
  %74 = call i64 @llvm.smin.i64(i64 %63, i64 %65)
  %75 = select i1 %71, i64 %73, i64 %74
  %76 = sub i64 %75, %70
  %77 = call i64 @llvm.smax.i64(i64 %76, i64 0)
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %80 = bitcast i8* %79 to i8*
  %81 = getelementptr inbounds i8, i8* %80, i64 %70
  call void @llvm.memset.p0i8.i64(i8* %81, i8 3, i64 %77, i1 false), !alias.scope !4, !noalias !3
  %82 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %83 = call i64 @nish_arena_mark()
  %84 = call i8* @show(%struct.nish_array* %82)
  %85 = call i8* @nish_arena_keep(i64 %83, i8* %84)
  call void @nish_print(i8* %85)
  %86 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %87 = call i64 @llvm.fptosi.sat.i64.f64(double 0x7E37E43C8800759C)
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = icmp slt i64 %87, 0
  %91 = add i64 %89, %87
  %92 = call i64 @llvm.smax.i64(i64 %91, i64 0)
  %93 = call i64 @llvm.smin.i64(i64 %87, i64 %89)
  %94 = select i1 %90, i64 %92, i64 %93
  %95 = sub i64 %89, %94
  %96 = call i64 @llvm.smax.i64(i64 %95, i64 0)
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = bitcast i8* %98 to i8*
  %100 = getelementptr inbounds i8, i8* %99, i64 %94
  call void @llvm.memset.p0i8.i64(i8* %100, i8 4, i64 %96, i1 false), !alias.scope !4, !noalias !3
  %101 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %102 = fneg double 0x7E37E43C8800759C
  %103 = call i64 @llvm.fptosi.sat.i64.f64(double %102)
  %104 = fneg double 0x401399999999999A
  %105 = call i64 @llvm.fptosi.sat.i64.f64(double %104)
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = icmp slt i64 %103, 0
  %109 = add i64 %107, %103
  %110 = call i64 @llvm.smax.i64(i64 %109, i64 0)
  %111 = call i64 @llvm.smin.i64(i64 %103, i64 %107)
  %112 = select i1 %108, i64 %110, i64 %111
  %113 = icmp slt i64 %105, 0
  %114 = add i64 %107, %105
  %115 = call i64 @llvm.smax.i64(i64 %114, i64 0)
  %116 = call i64 @llvm.smin.i64(i64 %105, i64 %107)
  %117 = select i1 %113, i64 %115, i64 %116
  %118 = sub i64 %117, %112
  %119 = call i64 @llvm.smax.i64(i64 %118, i64 0)
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %122 = bitcast i8* %121 to i8*
  %123 = getelementptr inbounds i8, i8* %122, i64 %112
  call void @llvm.memset.p0i8.i64(i8* %123, i8 4, i64 %119, i1 false), !alias.scope !4, !noalias !3
  %124 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %125 = call i64 @nish_arena_mark()
  %126 = call i8* @show(%struct.nish_array* %124)
  %127 = call i8* @nish_arena_keep(i64 %125, i8* %126)
  call void @nish_print(i8* %127)
  store float 0x4012000000000000, float* %half.addr, align 4
  %128 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %129 = load float, float* %half.addr, align 4
  %130 = call i64 @llvm.fptosi.sat.i64.f32(float %129)
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 0
  %132 = load i64, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = icmp slt i64 %130, 0
  %134 = add i64 %132, %130
  %135 = call i64 @llvm.smax.i64(i64 %134, i64 0)
  %136 = call i64 @llvm.smin.i64(i64 %130, i64 %132)
  %137 = select i1 %133, i64 %135, i64 %136
  %138 = sub i64 %132, %137
  %139 = call i64 @llvm.smax.i64(i64 %138, i64 0)
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 2
  %141 = load i8*, i8** %140, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %142 = bitcast i8* %141 to i8*
  %143 = getelementptr inbounds i8, i8* %142, i64 %137
  call void @llvm.memset.p0i8.i64(i8* %143, i8 5, i64 %139, i1 false), !alias.scope !4, !noalias !3
  %144 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %145 = call i64 @nish_arena_mark()
  %146 = call i8* @show(%struct.nish_array* %144)
  %147 = call i8* @nish_arena_keep(i64 %145, i8* %146)
  call void @nish_print(i8* %147)
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %150 = bitcast [2 x i8]* %arr.data.1 to i8*
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %150, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %152 = bitcast i8* %150 to i8*
  %153 = getelementptr inbounds i8, i8* %152, i64 0
  store i8 9, i8* %153, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %154 = getelementptr inbounds i8, i8* %152, i64 1
  store i8 8, i8* %154, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %155 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %156 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %157 = load double, double* %nan.addr, align 8
  %158 = call i64 @llvm.fptosi.sat.i64.f64(double %157)
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %156, i64 0, i32 0
  %160 = load i64, i64* %159, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %161 = add i64 %158, %160
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 0
  %163 = load i64, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %164 = icmp ule i64 %158, %161
  %165 = icmp ule i64 %161, %163
  %166 = and i1 %164, %165
  br i1 %166, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %158, i64 %161, i64 %163)
  unreachable

set.ok:
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 2
  %168 = load i8*, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %169 = bitcast i8* %168 to i8*
  %170 = getelementptr inbounds i8, i8* %169, i64 %158
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %156, i64 0, i32 2
  %172 = load i8*, i8** %171, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %173 = bitcast i8* %172 to i8*
  %174 = getelementptr inbounds i8, i8* %173, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %170, i8* %174, i64 %160, i1 false), !alias.scope !4, !noalias !3
  %175 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %176 = call i64 @nish_arena_mark()
  %177 = call i8* @show(%struct.nish_array* %175)
  %178 = call i8* @nish_arena_keep(i64 %176, i8* %177)
  call void @nish_print(i8* %178)
  %179 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %180 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %181 = call i64 @llvm.fptosi.sat.i64.f64(double 0x400FEB851EB851EC)
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 0
  %183 = load i64, i64* %182, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %184 = add i64 %181, %183
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %179, i64 0, i32 0
  %186 = load i64, i64* %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %187 = icmp ule i64 %181, %184
  %188 = icmp ule i64 %184, %186
  %189 = and i1 %187, %188
  br i1 %189, label %set.ok.1, label %set.fail.1

set.fail.1:
  call void @nish_panic_slice(i64 %181, i64 %184, i64 %186)
  unreachable

set.ok.1:
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %179, i64 0, i32 2
  %191 = load i8*, i8** %190, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %192 = bitcast i8* %191 to i8*
  %193 = getelementptr inbounds i8, i8* %192, i64 %181
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %196 = bitcast i8* %195 to i8*
  %197 = getelementptr inbounds i8, i8* %196, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %193, i8* %197, i64 %183, i1 false), !alias.scope !4, !noalias !3
  %198 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %199 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %200 = fneg double 0x3FE0000000000000
  %201 = call i64 @llvm.fptosi.sat.i64.f64(double %200)
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %199, i64 0, i32 0
  %203 = load i64, i64* %202, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %204 = add i64 %201, %203
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %198, i64 0, i32 0
  %206 = load i64, i64* %205, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %207 = icmp ule i64 %201, %204
  %208 = icmp ule i64 %204, %206
  %209 = and i1 %207, %208
  br i1 %209, label %set.ok.2, label %set.fail.2

set.fail.2:
  call void @nish_panic_slice(i64 %201, i64 %204, i64 %206)
  unreachable

set.ok.2:
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %198, i64 0, i32 2
  %211 = load i8*, i8** %210, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %212 = bitcast i8* %211 to i8*
  %213 = getelementptr inbounds i8, i8* %212, i64 %201
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %199, i64 0, i32 2
  %215 = load i8*, i8** %214, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %216 = bitcast i8* %215 to i8*
  %217 = getelementptr inbounds i8, i8* %216, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %213, i8* %217, i64 %203, i1 false), !alias.scope !4, !noalias !3
  %218 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %219 = call i64 @nish_arena_mark()
  %220 = call i8* @show(%struct.nish_array* %218)
  %221 = call i8* @nish_arena_keep(i64 %219, i8* %220)
  call void @nish_print(i8* %221)
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %222, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %223, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %224 = bitcast [3 x i32]* %arr.data.2 to i8*
  %225 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %224, i8** %225, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %226 = bitcast i8* %224 to i32*
  %227 = getelementptr inbounds i32, i32* %226, i64 0
  store i32 0, i32* %227, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %228 = getelementptr inbounds i32, i32* %226, i64 1
  store i32 0, i32* %228, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %229 = getelementptr inbounds i32, i32* %226, i64 2
  store i32 0, i32* %229, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %wide.addr, align 8
  %230 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %231 = load double, double* %inf.addr, align 8
  %232 = fneg double %231
  %233 = call i64 @llvm.fptosi.sat.i64.f64(double %232)
  %234 = load double, double* %inf.addr, align 8
  %235 = call i64 @llvm.fptosi.sat.i64.f64(double %234)
  %236 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %230, i64 0, i32 0
  %237 = load i64, i64* %236, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %238 = icmp slt i64 %233, 0
  %239 = add i64 %237, %233
  %240 = call i64 @llvm.smax.i64(i64 %239, i64 0)
  %241 = call i64 @llvm.smin.i64(i64 %233, i64 %237)
  %242 = select i1 %238, i64 %240, i64 %241
  %243 = icmp slt i64 %235, 0
  %244 = add i64 %237, %235
  %245 = call i64 @llvm.smax.i64(i64 %244, i64 0)
  %246 = call i64 @llvm.smin.i64(i64 %235, i64 %237)
  %247 = select i1 %243, i64 %245, i64 %246
  store i64 %242, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %248 = load i64, i64* %fill.at, align 8
  %249 = icmp slt i64 %248, %247
  br i1 %249, label %fill.body, label %fill.end

fill.body:
  %250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %230, i64 0, i32 2
  %251 = load i8*, i8** %250, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %252 = bitcast i8* %251 to i32*
  %253 = getelementptr inbounds i32, i32* %252, i64 %248
  store i32 -1, i32* %253, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %254 = add i64 %248, 1
  store i64 %254, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %255 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %256 = fptosi double 0x0000000000000000 to i64
  %257 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 0
  %258 = load i64, i64* %257, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %259 = icmp ult i64 %256, %258
  br i1 %259, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %256, i64 %258)
  unreachable

bounds.ok:
  %260 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 2
  %261 = load i8*, i8** %260, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %262 = bitcast i8* %261 to i32*
  %263 = getelementptr inbounds i32, i32* %262, i64 %256
  %264 = load i32, i32* %263, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %265 = call i8* @nish_str_from_i32(i32 %264)
  %266 = call i8* @nish_str_concat(i8* %265, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %267 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %268 = fptosi double 0x3FF0000000000000 to i64
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 0
  %270 = load i64, i64* %269, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %271 = icmp ult i64 %268, %270
  br i1 %271, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %268, i64 %270)
  unreachable

bounds.ok.1:
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 2
  %273 = load i8*, i8** %272, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %274 = bitcast i8* %273 to i32*
  %275 = getelementptr inbounds i32, i32* %274, i64 %268
  %276 = load i32, i32* %275, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %277 = call i8* @nish_str_from_i32(i32 %276)
  %278 = call i8* @nish_str_concat(i8* %266, i8* %277)
  %279 = call i8* @nish_str_concat(i8* %278, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %280 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %281 = fptosi double 0x4000000000000000 to i64
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 0
  %283 = load i64, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %284 = icmp ult i64 %281, %283
  br i1 %284, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %281, i64 %283)
  unreachable

bounds.ok.2:
  %285 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 2
  %286 = load i8*, i8** %285, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %287 = bitcast i8* %286 to i32*
  %288 = getelementptr inbounds i32, i32* %287, i64 %281
  %289 = load i32, i32* %288, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %290 = call i8* @nish_str_from_i32(i32 %289)
  %291 = call i8* @nish_str_concat(i8* %279, i8* %290)
  call void @nish_print(i8* %291)
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
