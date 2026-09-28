%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal void @copyInto(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %src, double noundef %at) #0 {
entry:
  %0 = fptosi double %at to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = add i64 %0, %2
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ule i64 %0, %3
  %7 = icmp ule i64 %3, %5
  %8 = and i1 %6, %7
  br i1 %8, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %0, i64 %3, i64 %5)
  unreachable

set.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %12, i8* %16, i64 %2, i1 false), !alias.scope !4, !noalias !3
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 3, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 4, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = add i64 0, %12
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ule i64 0, %13
  %17 = icmp ule i64 %13, %15
  %18 = and i1 %16, %17
  br i1 %18, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 0, i64 %13, i64 %15)
  unreachable

set.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 0
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = bitcast i8* %24 to i8*
  %26 = getelementptr inbounds i8, i8* %25, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %22, i8* %26, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %27 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %29 = fptosi double 0x0000000000000000 to i64
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = add i64 %29, %31
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = icmp ule i64 %29, %32
  %36 = icmp ule i64 %32, %34
  %37 = and i1 %35, %36
  br i1 %37, label %set.ok.1, label %set.fail.1

set.fail.1:
  call void @nish_panic_slice(i64 %29, i64 %32, i64 %34)
  unreachable

set.ok.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i8*
  %41 = getelementptr inbounds i8, i8* %40, i64 %29
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i8*
  %45 = getelementptr inbounds i8, i8* %44, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %41, i8* %45, i64 %31, i1 false), !alias.scope !4, !noalias !3
  %46 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %47 = call i8* @show(%struct.nish_array* %46)
  call void @nish_print(i8* %47)
  %48 = call i8* @nish_alloc_struct(i64 24)
  %49 = bitcast i8* %48 to %struct.nish_array*
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  store i64 2, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  store i64 2, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = call i8* @nish_alloc_struct(i64 2)
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  store i8* %52, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %52 to i8*
  %55 = getelementptr inbounds i8, i8* %54, i64 0
  store i8 9, i8* %55, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = getelementptr inbounds i8, i8* %54, i64 1
  store i8 8, i8* %56, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %49, %struct.nish_array** %b.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @copyInto(%struct.nish_array* %57, %struct.nish_array* %58, double 0x3FF0000000000000)
  %59 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %60 = call i8* @show(%struct.nish_array* %59)
  call void @nish_print(i8* %60)
  %61 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %62 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  call void @copyInto(%struct.nish_array* %61, %struct.nish_array* %62, double 0x0000000000000000)
  %63 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %64 = call i8* @show(%struct.nish_array* %63)
  call void @nish_print(i8* %64)
  %65 = call i8* @nish_alloc_struct(i64 24)
  %66 = bitcast i8* %65 to %struct.nish_array*
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  store i64 1, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 1
  store i64 1, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = call i8* @nish_alloc_struct(i64 1)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  store i8* %69, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %71 = bitcast i8* %69 to i8*
  %72 = getelementptr inbounds i8, i8* %71, i64 0
  store i8 5, i8* %72, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %66, %struct.nish_array** %c.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  store %struct.nish_array* %73, %struct.nish_array** %c.addr, align 8
  %74 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %c.addr, align 8
  %76 = fptosi double 0x4000000000000000 to i64
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = add i64 %76, %78
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = icmp ule i64 %76, %79
  %83 = icmp ule i64 %79, %81
  %84 = and i1 %82, %83
  br i1 %84, label %set.ok.2, label %set.fail.2

set.fail.2:
  call void @nish_panic_slice(i64 %76, i64 %79, i64 %81)
  unreachable

set.ok.2:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %87 = bitcast i8* %86 to i8*
  %88 = getelementptr inbounds i8, i8* %87, i64 %76
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i8*
  %92 = getelementptr inbounds i8, i8* %91, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %88, i8* %92, i64 %78, i1 false), !alias.scope !4, !noalias !3
  %93 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %94 = call i8* @show(%struct.nish_array* %93)
  call void @nish_print(i8* %94)
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
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
