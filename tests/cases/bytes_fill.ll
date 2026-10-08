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
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare i64 @llvm.fptosi.sat.i64.f64(double) #4

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
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i8], align 8
  %wide.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %fill.at = alloca i64, align 8
  %reals.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x double], align 8
  %fill.at.1 = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [6 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 0, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 0, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 0, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 0, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 0, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %4, i64 5
  store i8 0, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = sub i64 %13, 0
  %15 = call i64 @llvm.smax.i64(i64 %14, i64 0)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 0
  call void @llvm.memset.p0i8.i64(i8* %19, i8 255, i64 %15, i1 false), !alias.scope !4, !noalias !3
  %20 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %21 = call i64 @nish_arena_mark()
  %22 = call i8* @show(%struct.nish_array* %20)
  %23 = call i8* @nish_arena_keep(i64 %21, i8* %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %25 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4000000000000000)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp slt i64 %25, 0
  %29 = add i64 %27, %25
  %30 = call i64 @llvm.smax.i64(i64 %29, i64 0)
  %31 = call i64 @llvm.smin.i64(i64 %25, i64 %27)
  %32 = select i1 %28, i64 %30, i64 %31
  %33 = sub i64 %27, %32
  %34 = call i64 @llvm.smax.i64(i64 %33, i64 0)
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 %32
  call void @llvm.memset.p0i8.i64(i8* %38, i8 1, i64 %34, i1 false), !alias.scope !4, !noalias !3
  %39 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %40 = call i64 @nish_arena_mark()
  %41 = call i8* @show(%struct.nish_array* %39)
  %42 = call i8* @nish_arena_keep(i64 %40, i8* %41)
  call void @nish_print(i8* %42)
  %43 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %44 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %45 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4008000000000000)
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = icmp slt i64 %44, 0
  %49 = add i64 %47, %44
  %50 = call i64 @llvm.smax.i64(i64 %49, i64 0)
  %51 = call i64 @llvm.smin.i64(i64 %44, i64 %47)
  %52 = select i1 %48, i64 %50, i64 %51
  %53 = icmp slt i64 %45, 0
  %54 = add i64 %47, %45
  %55 = call i64 @llvm.smax.i64(i64 %54, i64 0)
  %56 = call i64 @llvm.smin.i64(i64 %45, i64 %47)
  %57 = select i1 %53, i64 %55, i64 %56
  %58 = sub i64 %57, %52
  %59 = call i64 @llvm.smax.i64(i64 %58, i64 0)
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %62 = bitcast i8* %61 to i8*
  %63 = getelementptr inbounds i8, i8* %62, i64 %52
  call void @llvm.memset.p0i8.i64(i8* %63, i8 2, i64 %59, i1 false), !alias.scope !4, !noalias !3
  %64 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %65 = call i64 @nish_arena_mark()
  %66 = call i8* @show(%struct.nish_array* %64)
  %67 = call i8* @nish_arena_keep(i64 %65, i8* %66)
  call void @nish_print(i8* %67)
  %68 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %69 = fneg double 0x4000000000000000
  %70 = call i64 @llvm.fptosi.sat.i64.f64(double %69)
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = icmp slt i64 %70, 0
  %74 = add i64 %72, %70
  %75 = call i64 @llvm.smax.i64(i64 %74, i64 0)
  %76 = call i64 @llvm.smin.i64(i64 %70, i64 %72)
  %77 = select i1 %73, i64 %75, i64 %76
  %78 = sub i64 %72, %77
  %79 = call i64 @llvm.smax.i64(i64 %78, i64 0)
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = bitcast i8* %81 to i8*
  %83 = getelementptr inbounds i8, i8* %82, i64 %77
  call void @llvm.memset.p0i8.i64(i8* %83, i8 3, i64 %79, i1 false), !alias.scope !4, !noalias !3
  %84 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %85 = call i64 @nish_arena_mark()
  %86 = call i8* @show(%struct.nish_array* %84)
  %87 = call i8* @nish_arena_keep(i64 %85, i8* %86)
  call void @nish_print(i8* %87)
  %88 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %89 = fneg double 0x4059000000000000
  %90 = call i64 @llvm.fptosi.sat.i64.f64(double %89)
  %91 = fneg double 0x4010000000000000
  %92 = call i64 @llvm.fptosi.sat.i64.f64(double %91)
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = icmp slt i64 %90, 0
  %96 = add i64 %94, %90
  %97 = call i64 @llvm.smax.i64(i64 %96, i64 0)
  %98 = call i64 @llvm.smin.i64(i64 %90, i64 %94)
  %99 = select i1 %95, i64 %97, i64 %98
  %100 = icmp slt i64 %92, 0
  %101 = add i64 %94, %92
  %102 = call i64 @llvm.smax.i64(i64 %101, i64 0)
  %103 = call i64 @llvm.smin.i64(i64 %92, i64 %94)
  %104 = select i1 %100, i64 %102, i64 %103
  %105 = sub i64 %104, %99
  %106 = call i64 @llvm.smax.i64(i64 %105, i64 0)
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %108 = load i8*, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %109 = bitcast i8* %108 to i8*
  %110 = getelementptr inbounds i8, i8* %109, i64 %99
  call void @llvm.memset.p0i8.i64(i8* %110, i8 4, i64 %106, i1 false), !alias.scope !4, !noalias !3
  %111 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %112 = call i64 @nish_arena_mark()
  %113 = call i8* @show(%struct.nish_array* %111)
  %114 = call i8* @nish_arena_keep(i64 %112, i8* %113)
  call void @nish_print(i8* %114)
  %115 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %116 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4010000000000000)
  %117 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = icmp slt i64 %116, 0
  %121 = add i64 %119, %116
  %122 = call i64 @llvm.smax.i64(i64 %121, i64 0)
  %123 = call i64 @llvm.smin.i64(i64 %116, i64 %119)
  %124 = select i1 %120, i64 %122, i64 %123
  %125 = icmp slt i64 %117, 0
  %126 = add i64 %119, %117
  %127 = call i64 @llvm.smax.i64(i64 %126, i64 0)
  %128 = call i64 @llvm.smin.i64(i64 %117, i64 %119)
  %129 = select i1 %125, i64 %127, i64 %128
  %130 = sub i64 %129, %124
  %131 = call i64 @llvm.smax.i64(i64 %130, i64 0)
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %134 = bitcast i8* %133 to i8*
  %135 = getelementptr inbounds i8, i8* %134, i64 %124
  call void @llvm.memset.p0i8.i64(i8* %135, i8 5, i64 %131, i1 false), !alias.scope !4, !noalias !3
  %136 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %137 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4024000000000000)
  %138 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4034000000000000)
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 0
  %140 = load i64, i64* %139, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %141 = icmp slt i64 %137, 0
  %142 = add i64 %140, %137
  %143 = call i64 @llvm.smax.i64(i64 %142, i64 0)
  %144 = call i64 @llvm.smin.i64(i64 %137, i64 %140)
  %145 = select i1 %141, i64 %143, i64 %144
  %146 = icmp slt i64 %138, 0
  %147 = add i64 %140, %138
  %148 = call i64 @llvm.smax.i64(i64 %147, i64 0)
  %149 = call i64 @llvm.smin.i64(i64 %138, i64 %140)
  %150 = select i1 %146, i64 %148, i64 %149
  %151 = sub i64 %150, %145
  %152 = call i64 @llvm.smax.i64(i64 %151, i64 0)
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 2
  %154 = load i8*, i8** %153, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %155 = bitcast i8* %154 to i8*
  %156 = getelementptr inbounds i8, i8* %155, i64 %145
  call void @llvm.memset.p0i8.i64(i8* %156, i8 5, i64 %152, i1 false), !alias.scope !4, !noalias !3
  %157 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %158 = call i64 @nish_arena_mark()
  %159 = call i8* @show(%struct.nish_array* %157)
  %160 = call i8* @nish_arena_keep(i64 %158, i8* %159)
  call void @nish_print(i8* %160)
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %161, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %163 = bitcast [4 x i32]* %arr.data.1 to i8*
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %163, i8** %164, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %165 = bitcast i8* %163 to i32*
  %166 = getelementptr inbounds i32, i32* %165, i64 0
  store i32 0, i32* %166, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %167 = getelementptr inbounds i32, i32* %165, i64 1
  store i32 0, i32* %167, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %168 = getelementptr inbounds i32, i32* %165, i64 2
  store i32 0, i32* %168, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %169 = getelementptr inbounds i32, i32* %165, i64 3
  store i32 0, i32* %169, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %wide.addr, align 8
  %170 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %171 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %172 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4008000000000000)
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = icmp slt i64 %171, 0
  %176 = add i64 %174, %171
  %177 = call i64 @llvm.smax.i64(i64 %176, i64 0)
  %178 = call i64 @llvm.smin.i64(i64 %171, i64 %174)
  %179 = select i1 %175, i64 %177, i64 %178
  %180 = icmp slt i64 %172, 0
  %181 = add i64 %174, %172
  %182 = call i64 @llvm.smax.i64(i64 %181, i64 0)
  %183 = call i64 @llvm.smin.i64(i64 %172, i64 %174)
  %184 = select i1 %180, i64 %182, i64 %183
  store i64 %179, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %185 = load i64, i64* %fill.at, align 8
  %186 = icmp slt i64 %185, %184
  br i1 %186, label %fill.body, label %fill.end

fill.body:
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 2
  %188 = load i8*, i8** %187, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %189 = bitcast i8* %188 to i32*
  %190 = getelementptr inbounds i32, i32* %189, i64 %185
  store i32 -7, i32* %190, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %191 = add i64 %185, 1
  store i64 %191, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %192 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %193 = fptosi double 0x0000000000000000 to i64
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %192, i64 0, i32 0
  %195 = load i64, i64* %194, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %196 = icmp ult i64 %193, %195
  br i1 %196, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %193, i64 %195)
  unreachable

bounds.ok:
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %192, i64 0, i32 2
  %198 = load i8*, i8** %197, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %199 = bitcast i8* %198 to i32*
  %200 = getelementptr inbounds i32, i32* %199, i64 %193
  %201 = load i32, i32* %200, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %202 = call i8* @nish_str_from_i32(i32 %201)
  %203 = call i8* @nish_str_concat(i8* %202, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %204 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %205 = fptosi double 0x3FF0000000000000 to i64
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 0
  %207 = load i64, i64* %206, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %208 = icmp ult i64 %205, %207
  br i1 %208, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %205, i64 %207)
  unreachable

bounds.ok.1:
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %204, i64 0, i32 2
  %210 = load i8*, i8** %209, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %211 = bitcast i8* %210 to i32*
  %212 = getelementptr inbounds i32, i32* %211, i64 %205
  %213 = load i32, i32* %212, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %214 = call i8* @nish_str_from_i32(i32 %213)
  %215 = call i8* @nish_str_concat(i8* %203, i8* %214)
  %216 = call i8* @nish_str_concat(i8* %215, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %217 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %218 = fptosi double 0x4000000000000000 to i64
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %217, i64 0, i32 0
  %220 = load i64, i64* %219, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %221 = icmp ult i64 %218, %220
  br i1 %221, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %218, i64 %220)
  unreachable

bounds.ok.2:
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %217, i64 0, i32 2
  %223 = load i8*, i8** %222, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %224 = bitcast i8* %223 to i32*
  %225 = getelementptr inbounds i32, i32* %224, i64 %218
  %226 = load i32, i32* %225, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %227 = call i8* @nish_str_from_i32(i32 %226)
  %228 = call i8* @nish_str_concat(i8* %216, i8* %227)
  %229 = call i8* @nish_str_concat(i8* %228, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %230 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %231 = fptosi double 0x4008000000000000 to i64
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %230, i64 0, i32 0
  %233 = load i64, i64* %232, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %234 = icmp ult i64 %231, %233
  br i1 %234, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %231, i64 %233)
  unreachable

bounds.ok.3:
  %235 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %230, i64 0, i32 2
  %236 = load i8*, i8** %235, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %237 = bitcast i8* %236 to i32*
  %238 = getelementptr inbounds i32, i32* %237, i64 %231
  %239 = load i32, i32* %238, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %240 = call i8* @nish_str_from_i32(i32 %239)
  %241 = call i8* @nish_str_concat(i8* %229, i8* %240)
  call void @nish_print(i8* %241)
  %242 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %242, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %243 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %243, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %244 = bitcast [3 x double]* %arr.data.2 to i8*
  %245 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %244, i8** %245, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %246 = bitcast i8* %244 to double*
  %247 = getelementptr inbounds double, double* %246, i64 0
  store double 0x3FF0000000000000, double* %247, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %248 = getelementptr inbounds double, double* %246, i64 1
  store double 0x3FF0000000000000, double* %248, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %249 = getelementptr inbounds double, double* %246, i64 2
  store double 0x3FF0000000000000, double* %249, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %reals.addr, align 8
  %250 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %251 = fneg double 0x3FF0000000000000
  %252 = call i64 @llvm.fptosi.sat.i64.f64(double %251)
  %253 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %250, i64 0, i32 0
  %254 = load i64, i64* %253, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %255 = icmp slt i64 %252, 0
  %256 = add i64 %254, %252
  %257 = call i64 @llvm.smax.i64(i64 %256, i64 0)
  %258 = call i64 @llvm.smin.i64(i64 %252, i64 %254)
  %259 = select i1 %255, i64 %257, i64 %258
  store i64 %259, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.cond.1:
  %260 = load i64, i64* %fill.at.1, align 8
  %261 = icmp slt i64 %260, %254
  br i1 %261, label %fill.body.1, label %fill.end.1

fill.body.1:
  %262 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %250, i64 0, i32 2
  %263 = load i8*, i8** %262, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %264 = bitcast i8* %263 to double*
  %265 = getelementptr inbounds double, double* %264, i64 %260
  store double 0x3FE0000000000000, double* %265, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %266 = add i64 %260, 1
  store i64 %266, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %267 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %268 = fptosi double 0x0000000000000000 to i64
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 0
  %270 = load i64, i64* %269, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %271 = icmp ult i64 %268, %270
  br i1 %271, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %268, i64 %270)
  unreachable

bounds.ok.4:
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 2
  %273 = load i8*, i8** %272, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %274 = bitcast i8* %273 to double*
  %275 = getelementptr inbounds double, double* %274, i64 %268
  %276 = load double, double* %275, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %277 = call i8* @nish_str_from_f64(double %276)
  %278 = call i8* @nish_str_concat(i8* %277, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %279 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %280 = fptosi double 0x3FF0000000000000 to i64
  %281 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %279, i64 0, i32 0
  %282 = load i64, i64* %281, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %283 = icmp ult i64 %280, %282
  br i1 %283, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %280, i64 %282)
  unreachable

bounds.ok.5:
  %284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %279, i64 0, i32 2
  %285 = load i8*, i8** %284, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %286 = bitcast i8* %285 to double*
  %287 = getelementptr inbounds double, double* %286, i64 %280
  %288 = load double, double* %287, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %289 = call i8* @nish_str_from_f64(double %288)
  %290 = call i8* @nish_str_concat(i8* %278, i8* %289)
  %291 = call i8* @nish_str_concat(i8* %290, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %292 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %293 = fptosi double 0x4000000000000000 to i64
  %294 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 0
  %295 = load i64, i64* %294, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %296 = icmp ult i64 %293, %295
  br i1 %296, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %293, i64 %295)
  unreachable

bounds.ok.6:
  %297 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 2
  %298 = load i8*, i8** %297, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %299 = bitcast i8* %298 to double*
  %300 = getelementptr inbounds double, double* %299, i64 %293
  %301 = load double, double* %300, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %302 = call i8* @nish_str_from_f64(double %301)
  %303 = call i8* @nish_str_concat(i8* %291, i8* %302)
  call void @nish_print(i8* %303)
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
!19 = !{!"element double", !6, i64 0}
!20 = !{!19, !19, i64 0}
