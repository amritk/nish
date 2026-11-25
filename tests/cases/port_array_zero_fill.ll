%struct.Grid = type { { i64, i8* } }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal void @Grid.constructor(%struct.Grid* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %side, i32 %side)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = sext i32 %1 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %5 = mul i64 %3, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  %8 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %7, i32 0, i32 0
  store i64 %3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %7, i32 0, i32 1
  store i8* %6, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef double @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %sum.addr = alloca double, align 8
  %x.addr = alloca double, align 8
  %forof.idx = alloca i64, align 8
  store double 0x0000000000000000, double* %sum.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %6 = bitcast i8* %5 to double*
  %7 = getelementptr inbounds double, double* %6, i64 %0
  %8 = load double, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store double %8, double* %x.addr, align 8
  %9 = load double, double* %sum.addr, align 8
  %10 = load double, double* %x.addr, align 8
  %11 = fadd double %9, %10
  store double %11, double* %sum.addr, align 8
  br label %forof.inc

forof.inc:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = add i64 %12, 1
  store i64 %13, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %14 = load double, double* %sum.addr, align 8
  ret double %14
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %weights.addr = alloca %struct.nish_array*, align 8
  %seen.addr = alloca %struct.nish_array*, align 8
  %counts.addr = alloca %struct.nish_array*, align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %grid.addr = alloca %struct.Grid*, align 8
  %Grid.obj = alloca %struct.Grid, align 8
  %half.addr = alloca double, align 8
  %floats.addr = alloca %struct.nish_array*, align 8
  %ints.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %6 = mul i64 %1, 8
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  store %struct.nish_array* %3, %struct.nish_array** %weights.addr, align 8
  %9 = load i32, i32* %n.addr, align 4
  %10 = add nsw i32 %9, 1
  %11 = sext i32 %10 to i64
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 %11, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 %11, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %16 = call i8* @nish_alloc_struct(i64 %11)
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 %11, i1 false), !alias.scope !4, !noalias !3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  store %struct.nish_array* %13, %struct.nish_array** %seen.addr, align 8
  %18 = load i32, i32* %n.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 %19, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 %19, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %24 = mul i64 %19, 4
  %25 = call i8* @nish_alloc_struct(i64 %24)
  call void @llvm.memset.p0i8.i64(i8* align 8 %25, i8 0, i64 %24, i1 false), !alias.scope !4, !noalias !3
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  store %struct.nish_array* %21, %struct.nish_array** %counts.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %29 = bitcast [4 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %29, i8 0, i64 4, i1 false), !alias.scope !4, !noalias !3
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %31 = getelementptr inbounds %struct.Grid, %struct.Grid* %Grid.obj, i32 0, i32 0
  %32 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %31, i32 0, i32 0
  store i64 0, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %31, i32 0, i32 1
  store i8* null, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  call void @Grid.constructor(%struct.Grid* %Grid.obj, i32 2)
  store %struct.Grid* %Grid.obj, %struct.Grid** %grid.addr, align 8
  store double 0x3FE0000000000000, double* %half.addr, align 8
  %34 = load i32, i32* %n.addr, align 4
  %35 = load double, double* %half.addr, align 8
  %36 = call %struct.nish_array* @startingWith$f64(i32 %34, double %35)
  store %struct.nish_array* %36, %struct.nish_array** %floats.addr, align 8
  %37 = load i32, i32* %n.addr, align 4
  %38 = call %struct.nish_array* @startingWith$i32(i32 %37, i32 1)
  store %struct.nish_array* %38, %struct.nish_array** %ints.addr, align 8
  %39 = load %struct.nish_array*, %struct.nish_array** %weights.addr, align 8
  %40 = call double @total(%struct.nish_array* %39)
  %41 = call i8* @nish_str_from_f64(double %40)
  call void @nish_print(i8* %41)
  %42 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %45 = icmp ult i64 0, %44
  br i1 %45, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %44)
  unreachable

bounds.ok:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %48 = bitcast i8* %47 to i1*
  %49 = getelementptr inbounds i1, i1* %48, i64 0
  %50 = load i1, i1* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !19
  br i1 %50, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %51 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %52 = call i8* @nish_str_from_i32(i32 %51)
  call void @nish_print(i8* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %56 = icmp ult i64 1, %55
  br i1 %56, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %55)
  unreachable

bounds.ok.1:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 1
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !21
  %62 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %65 = icmp ult i64 2, %64
  br i1 %65, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %64)
  unreachable

bounds.ok.2:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %68 = bitcast i8* %67 to i8*
  %69 = getelementptr inbounds i8, i8* %68, i64 2
  %70 = load i8, i8* %69, align 1, !alias.scope !4, !noalias !3, !tbaa !23
  %71 = zext i8 %70 to i32
  %72 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %71)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok

ovf.ok:
  %75 = load %struct.Grid*, %struct.Grid** %grid.addr, align 8
  %76 = getelementptr inbounds %struct.Grid, %struct.Grid* %75, i32 0, i32 0
  %77 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %76, i32 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = icmp ult i64 3, %78
  br i1 %79, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %78)
  unreachable

bounds.ok.3:
  %80 = getelementptr inbounds { i64, i8* }, { i64, i8* }* %76, i32 0, i32 1
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %82 = bitcast i8* %81 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 3
  %84 = load i32, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !21
  %85 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %73, i32 %84)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %88 = load %struct.nish_array*, %struct.nish_array** %ints.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %91 = icmp ult i64 0, %90
  br i1 %91, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %90)
  unreachable

bounds.ok.4:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %94 = bitcast i8* %93 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 0
  %96 = load i32, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !21
  %97 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %86, i32 %96)
  %98 = extractvalue { i32, i1 } %97, 0
  %99 = extractvalue { i32, i1 } %97, 1
  br i1 %99, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %100 = call i8* @nish_str_from_i32(i32 %98)
  call void @nish_print(i8* %100)
  %101 = load %struct.nish_array*, %struct.nish_array** %floats.addr, align 8
  %102 = call double @total(%struct.nish_array* %101)
  %103 = call i8* @nish_str_from_f64(double %102)
  call void @nish_print(i8* %103)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @startingWith$f64(i32 noundef %n, double noundef %first) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %6 = mul i64 %0, 8
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  store %struct.nish_array* %3, %struct.nish_array** %out.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %15 = bitcast i8* %14 to double*
  %16 = getelementptr inbounds double, double* %15, i64 0
  store double %first, double* %16, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %17
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @startingWith$i32(i32 noundef %n, i32 noundef %first) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  store %struct.nish_array* %3, %struct.nish_array** %out.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %12 = icmp ult i64 0, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 %first, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !21
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %17
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!24, !25, !26, !27, !28}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array slice", !7, i64 0, !8, i64 8}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !8, i64 8}
!12 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!13 = !{!12, !7, i64 0}
!14 = !{!12, !8, i64 16}
!15 = !{!"element double", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!12, !7, i64 8}
!18 = !{!"element i1", !6, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!"element i32", !6, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{!"element i8", !6, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{i32 8, !"cf-protection-branch", i32 1}
!25 = !{i32 8, !"cf-protection-return", i32 1}
!26 = !{i32 8, !"branch-target-enforcement", i32 1}
!27 = !{i32 8, !"sign-return-address", i32 1}
!28 = !{i32 4, !"probe-stack", !"inline-asm"}
