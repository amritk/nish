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
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
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
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
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
  %51 = add i64 %50, 9
  %52 = call i8* @nish_alloc_struct(i64 %51)
  %53 = bitcast i8* %52 to i64*
  store i64 %50, i64* %53, align 8
  %54 = getelementptr inbounds i8, i8* %52, i64 8
  store i8* %54, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %55 = load i64, i64* %join.at, align 8
  %56 = icmp ult i64 %55, %31
  br i1 %56, label %join.part, label %join.end

join.part:
  %57 = load i8*, i8** %join.p, align 8
  %58 = icmp eq i64 %55, 0
  %59 = select i1 %58, i64 0, i64 %33
  %60 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %57, i8* %60, i64 %59, i1 false)
  %61 = getelementptr inbounds i8, i8* %57, i64 %59
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = bitcast i8* %63 to i8**
  %65 = getelementptr inbounds i8*, i8** %64, i64 %55
  %66 = load i8*, i8** %65, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %67 = bitcast i8* %66 to i64*
  %68 = load i64, i64* %67, align 8
  %69 = getelementptr inbounds i8, i8* %66, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %61, i8* %69, i64 %68, i1 false)
  %70 = getelementptr inbounds i8, i8* %61, i64 %68
  store i8* %70, i8** %join.p, align 8
  %71 = add i64 %55, 1
  store i64 %71, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %72 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %72, align 1
  ret i8* %52
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
  %21 = call i8* @show(%struct.nish_array* %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %23 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4000000000000000)
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = icmp slt i64 %23, 0
  %27 = add i64 %25, %23
  %28 = call i64 @llvm.smax.i64(i64 %27, i64 0)
  %29 = call i64 @llvm.smin.i64(i64 %23, i64 %25)
  %30 = select i1 %26, i64 %28, i64 %29
  %31 = sub i64 %25, %30
  %32 = call i64 @llvm.smax.i64(i64 %31, i64 0)
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 %30
  call void @llvm.memset.p0i8.i64(i8* %36, i8 1, i64 %32, i1 false), !alias.scope !4, !noalias !3
  %37 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %38 = call i8* @show(%struct.nish_array* %37)
  call void @nish_print(i8* %38)
  %39 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %40 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %41 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4008000000000000)
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp slt i64 %40, 0
  %45 = add i64 %43, %40
  %46 = call i64 @llvm.smax.i64(i64 %45, i64 0)
  %47 = call i64 @llvm.smin.i64(i64 %40, i64 %43)
  %48 = select i1 %44, i64 %46, i64 %47
  %49 = icmp slt i64 %41, 0
  %50 = add i64 %43, %41
  %51 = call i64 @llvm.smax.i64(i64 %50, i64 0)
  %52 = call i64 @llvm.smin.i64(i64 %41, i64 %43)
  %53 = select i1 %49, i64 %51, i64 %52
  %54 = sub i64 %53, %48
  %55 = call i64 @llvm.smax.i64(i64 %54, i64 0)
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i8*
  %59 = getelementptr inbounds i8, i8* %58, i64 %48
  call void @llvm.memset.p0i8.i64(i8* %59, i8 2, i64 %55, i1 false), !alias.scope !4, !noalias !3
  %60 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %61 = call i8* @show(%struct.nish_array* %60)
  call void @nish_print(i8* %61)
  %62 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %63 = fneg double 0x4000000000000000
  %64 = call i64 @llvm.fptosi.sat.i64.f64(double %63)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = icmp slt i64 %64, 0
  %68 = add i64 %66, %64
  %69 = call i64 @llvm.smax.i64(i64 %68, i64 0)
  %70 = call i64 @llvm.smin.i64(i64 %64, i64 %66)
  %71 = select i1 %67, i64 %69, i64 %70
  %72 = sub i64 %66, %71
  %73 = call i64 @llvm.smax.i64(i64 %72, i64 0)
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i8*
  %77 = getelementptr inbounds i8, i8* %76, i64 %71
  call void @llvm.memset.p0i8.i64(i8* %77, i8 3, i64 %73, i1 false), !alias.scope !4, !noalias !3
  %78 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %79 = call i8* @show(%struct.nish_array* %78)
  call void @nish_print(i8* %79)
  %80 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %81 = fneg double 0x4059000000000000
  %82 = call i64 @llvm.fptosi.sat.i64.f64(double %81)
  %83 = fneg double 0x4010000000000000
  %84 = call i64 @llvm.fptosi.sat.i64.f64(double %83)
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %87 = icmp slt i64 %82, 0
  %88 = add i64 %86, %82
  %89 = call i64 @llvm.smax.i64(i64 %88, i64 0)
  %90 = call i64 @llvm.smin.i64(i64 %82, i64 %86)
  %91 = select i1 %87, i64 %89, i64 %90
  %92 = icmp slt i64 %84, 0
  %93 = add i64 %86, %84
  %94 = call i64 @llvm.smax.i64(i64 %93, i64 0)
  %95 = call i64 @llvm.smin.i64(i64 %84, i64 %86)
  %96 = select i1 %92, i64 %94, i64 %95
  %97 = sub i64 %96, %91
  %98 = call i64 @llvm.smax.i64(i64 %97, i64 0)
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %101 = bitcast i8* %100 to i8*
  %102 = getelementptr inbounds i8, i8* %101, i64 %91
  call void @llvm.memset.p0i8.i64(i8* %102, i8 4, i64 %98, i1 false), !alias.scope !4, !noalias !3
  %103 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %104 = call i8* @show(%struct.nish_array* %103)
  call void @nish_print(i8* %104)
  %105 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %106 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4010000000000000)
  %107 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = icmp slt i64 %106, 0
  %111 = add i64 %109, %106
  %112 = call i64 @llvm.smax.i64(i64 %111, i64 0)
  %113 = call i64 @llvm.smin.i64(i64 %106, i64 %109)
  %114 = select i1 %110, i64 %112, i64 %113
  %115 = icmp slt i64 %107, 0
  %116 = add i64 %109, %107
  %117 = call i64 @llvm.smax.i64(i64 %116, i64 0)
  %118 = call i64 @llvm.smin.i64(i64 %107, i64 %109)
  %119 = select i1 %115, i64 %117, i64 %118
  %120 = sub i64 %119, %114
  %121 = call i64 @llvm.smax.i64(i64 %120, i64 0)
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %124 = bitcast i8* %123 to i8*
  %125 = getelementptr inbounds i8, i8* %124, i64 %114
  call void @llvm.memset.p0i8.i64(i8* %125, i8 5, i64 %121, i1 false), !alias.scope !4, !noalias !3
  %126 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %127 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4024000000000000)
  %128 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4034000000000000)
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 0
  %130 = load i64, i64* %129, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %131 = icmp slt i64 %127, 0
  %132 = add i64 %130, %127
  %133 = call i64 @llvm.smax.i64(i64 %132, i64 0)
  %134 = call i64 @llvm.smin.i64(i64 %127, i64 %130)
  %135 = select i1 %131, i64 %133, i64 %134
  %136 = icmp slt i64 %128, 0
  %137 = add i64 %130, %128
  %138 = call i64 @llvm.smax.i64(i64 %137, i64 0)
  %139 = call i64 @llvm.smin.i64(i64 %128, i64 %130)
  %140 = select i1 %136, i64 %138, i64 %139
  %141 = sub i64 %140, %135
  %142 = call i64 @llvm.smax.i64(i64 %141, i64 0)
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %145 = bitcast i8* %144 to i8*
  %146 = getelementptr inbounds i8, i8* %145, i64 %135
  call void @llvm.memset.p0i8.i64(i8* %146, i8 5, i64 %142, i1 false), !alias.scope !4, !noalias !3
  %147 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %148 = call i8* @show(%struct.nish_array* %147)
  call void @nish_print(i8* %148)
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %151 = bitcast [4 x i32]* %arr.data.1 to i8*
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %151, i8** %152, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %153 = bitcast i8* %151 to i32*
  %154 = getelementptr inbounds i32, i32* %153, i64 0
  store i32 0, i32* %154, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %155 = getelementptr inbounds i32, i32* %153, i64 1
  store i32 0, i32* %155, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %156 = getelementptr inbounds i32, i32* %153, i64 2
  store i32 0, i32* %156, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %157 = getelementptr inbounds i32, i32* %153, i64 3
  store i32 0, i32* %157, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %wide.addr, align 8
  %158 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %159 = call i64 @llvm.fptosi.sat.i64.f64(double 0x3FF0000000000000)
  %160 = call i64 @llvm.fptosi.sat.i64.f64(double 0x4008000000000000)
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 0
  %162 = load i64, i64* %161, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %163 = icmp slt i64 %159, 0
  %164 = add i64 %162, %159
  %165 = call i64 @llvm.smax.i64(i64 %164, i64 0)
  %166 = call i64 @llvm.smin.i64(i64 %159, i64 %162)
  %167 = select i1 %163, i64 %165, i64 %166
  %168 = icmp slt i64 %160, 0
  %169 = add i64 %162, %160
  %170 = call i64 @llvm.smax.i64(i64 %169, i64 0)
  %171 = call i64 @llvm.smin.i64(i64 %160, i64 %162)
  %172 = select i1 %168, i64 %170, i64 %171
  store i64 %167, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %173 = load i64, i64* %fill.at, align 8
  %174 = icmp slt i64 %173, %172
  br i1 %174, label %fill.body, label %fill.end

fill.body:
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %158, i64 0, i32 2
  %176 = load i8*, i8** %175, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %177 = bitcast i8* %176 to i32*
  %178 = getelementptr inbounds i32, i32* %177, i64 %173
  store i32 -7, i32* %178, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %179 = add i64 %173, 1
  store i64 %179, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %180 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %181 = fptosi double 0x0000000000000000 to i64
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 0
  %183 = load i64, i64* %182, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %184 = icmp ult i64 %181, %183
  br i1 %184, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %181, i64 %183)
  unreachable

bounds.ok:
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %187 = bitcast i8* %186 to i32*
  %188 = getelementptr inbounds i32, i32* %187, i64 %181
  %189 = load i32, i32* %188, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %190 = call i8* @nish_str_from_i32(i32 %189)
  %191 = call i8* @nish_str_concat(i8* %190, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %192 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %193 = fptosi double 0x3FF0000000000000 to i64
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %192, i64 0, i32 0
  %195 = load i64, i64* %194, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %196 = icmp ult i64 %193, %195
  br i1 %196, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %193, i64 %195)
  unreachable

bounds.ok.1:
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %192, i64 0, i32 2
  %198 = load i8*, i8** %197, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %199 = bitcast i8* %198 to i32*
  %200 = getelementptr inbounds i32, i32* %199, i64 %193
  %201 = load i32, i32* %200, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %202 = call i8* @nish_str_from_i32(i32 %201)
  %203 = call i8* @nish_str_concat(i8* %191, i8* %202)
  %204 = call i8* @nish_str_concat(i8* %203, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %205 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %206 = fptosi double 0x4000000000000000 to i64
  %207 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %205, i64 0, i32 0
  %208 = load i64, i64* %207, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %209 = icmp ult i64 %206, %208
  br i1 %209, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %206, i64 %208)
  unreachable

bounds.ok.2:
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %205, i64 0, i32 2
  %211 = load i8*, i8** %210, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %212 = bitcast i8* %211 to i32*
  %213 = getelementptr inbounds i32, i32* %212, i64 %206
  %214 = load i32, i32* %213, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %215 = call i8* @nish_str_from_i32(i32 %214)
  %216 = call i8* @nish_str_concat(i8* %204, i8* %215)
  %217 = call i8* @nish_str_concat(i8* %216, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %218 = load %struct.nish_array*, %struct.nish_array** %wide.addr, align 8
  %219 = fptosi double 0x4008000000000000 to i64
  %220 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %218, i64 0, i32 0
  %221 = load i64, i64* %220, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %222 = icmp ult i64 %219, %221
  br i1 %222, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %219, i64 %221)
  unreachable

bounds.ok.3:
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %218, i64 0, i32 2
  %224 = load i8*, i8** %223, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %225 = bitcast i8* %224 to i32*
  %226 = getelementptr inbounds i32, i32* %225, i64 %219
  %227 = load i32, i32* %226, align 4, !alias.scope !4, !noalias !3, !tbaa !18
  %228 = call i8* @nish_str_from_i32(i32 %227)
  %229 = call i8* @nish_str_concat(i8* %217, i8* %228)
  call void @nish_print(i8* %229)
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %230, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %231, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %232 = bitcast [3 x double]* %arr.data.2 to i8*
  %233 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %232, i8** %233, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %234 = bitcast i8* %232 to double*
  %235 = getelementptr inbounds double, double* %234, i64 0
  store double 0x3FF0000000000000, double* %235, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %236 = getelementptr inbounds double, double* %234, i64 1
  store double 0x3FF0000000000000, double* %236, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %237 = getelementptr inbounds double, double* %234, i64 2
  store double 0x3FF0000000000000, double* %237, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %reals.addr, align 8
  %238 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %239 = fneg double 0x3FF0000000000000
  %240 = call i64 @llvm.fptosi.sat.i64.f64(double %239)
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %238, i64 0, i32 0
  %242 = load i64, i64* %241, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %243 = icmp slt i64 %240, 0
  %244 = add i64 %242, %240
  %245 = call i64 @llvm.smax.i64(i64 %244, i64 0)
  %246 = call i64 @llvm.smin.i64(i64 %240, i64 %242)
  %247 = select i1 %243, i64 %245, i64 %246
  store i64 %247, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.cond.1:
  %248 = load i64, i64* %fill.at.1, align 8
  %249 = icmp slt i64 %248, %242
  br i1 %249, label %fill.body.1, label %fill.end.1

fill.body.1:
  %250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %238, i64 0, i32 2
  %251 = load i8*, i8** %250, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %252 = bitcast i8* %251 to double*
  %253 = getelementptr inbounds double, double* %252, i64 %248
  store double 0x3FE0000000000000, double* %253, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %254 = add i64 %248, 1
  store i64 %254, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %255 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %256 = fptosi double 0x0000000000000000 to i64
  %257 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 0
  %258 = load i64, i64* %257, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %259 = icmp ult i64 %256, %258
  br i1 %259, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %256, i64 %258)
  unreachable

bounds.ok.4:
  %260 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 2
  %261 = load i8*, i8** %260, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %262 = bitcast i8* %261 to double*
  %263 = getelementptr inbounds double, double* %262, i64 %256
  %264 = load double, double* %263, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %265 = call i8* @nish_str_from_f64(double %264)
  %266 = call i8* @nish_str_concat(i8* %265, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %267 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %268 = fptosi double 0x3FF0000000000000 to i64
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 0
  %270 = load i64, i64* %269, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %271 = icmp ult i64 %268, %270
  br i1 %271, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %268, i64 %270)
  unreachable

bounds.ok.5:
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 2
  %273 = load i8*, i8** %272, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %274 = bitcast i8* %273 to double*
  %275 = getelementptr inbounds double, double* %274, i64 %268
  %276 = load double, double* %275, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %277 = call i8* @nish_str_from_f64(double %276)
  %278 = call i8* @nish_str_concat(i8* %266, i8* %277)
  %279 = call i8* @nish_str_concat(i8* %278, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %280 = load %struct.nish_array*, %struct.nish_array** %reals.addr, align 8
  %281 = fptosi double 0x4000000000000000 to i64
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 0
  %283 = load i64, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %284 = icmp ult i64 %281, %283
  br i1 %284, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %281, i64 %283)
  unreachable

bounds.ok.6:
  %285 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 2
  %286 = load i8*, i8** %285, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %287 = bitcast i8* %286 to double*
  %288 = getelementptr inbounds double, double* %287, i64 %281
  %289 = load double, double* %288, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %290 = call i8* @nish_str_from_f64(double %289)
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
!19 = !{!"element double", !6, i64 0}
!20 = !{!19, !19, i64 0}
