%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), double noundef) #1
declare noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), double noundef) #1
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #3
declare void @nish_exit(i32 noundef) #4

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

define hidden noundef i32 @add(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add nsw i32 %a, %b
  ret i32 %0
}

define internal noundef double @blocked(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %partials.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x double], align 8
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x double]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to double*
  %5 = getelementptr inbounds double, double* %4, i64 0
  store double 0x0000000000000000, double* %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds double, double* %4, i64 1
  store double 0x0000000000000000, double* %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds double, double* %4, i64 2
  store double 0x0000000000000000, double* %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %partials.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %15 = load i32, i32* %k.addr, align 4
  %16 = icmp slt i32 %15, 3
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %k.addr, align 4
  %18 = mul nsw i32 %17, 1000000
  store i32 %18, i32* %i.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %26 = load i32, i32* %i.addr, align 4
  %27 = load i32, i32* %k.addr, align 4
  %28 = add nsw i32 %27, 1
  %29 = mul nsw i32 %28, 1000000
  %30 = icmp slt i32 %26, %29
  br i1 %30, label %land.rhs, label %land.end

land.rhs:
  %31 = load i32, i32* %i.addr, align 4
  %32 = trunc i64 %20 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end

land.end:
  %34 = phi i1 [ false, %for.cond.1 ], [ %33, %land.rhs ]
  br i1 %34, label %for.body.1, label %for.end.1

for.body.1:
  %35 = load i32, i32* %i.addr, align 4
  %36 = icmp sge i32 %35, 0
  br i1 %36, label %if.then, label %if.end

if.then:
  %37 = load i32, i32* %k.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = load i32, i32* %k.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = bitcast i8* %25 to double*
  %42 = getelementptr inbounds double, double* %41, i64 %40
  %43 = load double, double* %42, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = load i32, i32* %i.addr, align 4
  %45 = sext i32 %44 to i64
  %46 = bitcast i8* %22 to double*
  %47 = getelementptr inbounds double, double* %46, i64 %45
  %48 = load double, double* %47, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = fadd double %43, %48
  %50 = bitcast i8* %25 to double*
  %51 = getelementptr inbounds double, double* %50, i64 %38
  store double %49, double* %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %52 = load i32, i32* %i.addr, align 4
  %53 = add nsw i32 %52, 1
  store i32 %53, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %54 = load i32, i32* %k.addr, align 4
  %55 = add nsw i32 %54, 1
  store i32 %55, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %56 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to double*
  %60 = getelementptr inbounds double, double* %59, i64 0
  %61 = load double, double* %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %62 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to double*
  %66 = getelementptr inbounds double, double* %65, i64 1
  %67 = load double, double* %66, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %68 = fadd double %61, %67
  %69 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to double*
  %73 = getelementptr inbounds double, double* %72, i64 2
  %74 = load double, double* %73, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = fadd double %68, %74
  ret double %75
}

define noundef i32 @nish_main() #1 {
entry:
  %small.addr = alloca %struct.nish_array*, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %x.addr = alloca double, align 8
  %once.addr = alloca double, align 8
  %twice.addr = alloca double, align 8
  %bits.addr = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %1, %struct.nish_array** %small.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* null, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %12, %struct.nish_array** %empty.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %small.addr, align 8
  %17 = call i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* %16, i32 0)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %20 = load %struct.nish_array*, %struct.nish_array** %small.addr, align 8
  %21 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow0(%struct.nish_array* %20, i32 1)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %19, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %26 = call i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* %25, i32 0)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %24, i8* %27)
  call void @nish_print(i8* %28)
  store i32 3000000, i32* %n.addr, align 4
  %29 = load i32, i32* %n.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = icmp ule i64 %30, 2147483647
  br i1 %31, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %32 = call i8* @nish_alloc_struct(i64 24)
  %33 = bitcast i8* %32 to %struct.nish_array*
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  store i64 %30, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  store i64 %30, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = mul i64 %30, 8
  %37 = call i8* @nish_alloc_struct(i64 %36)
  call void @llvm.memset.p0i8.i64(i8* align 8 %37, i8 0, i64 %36, i1 false), !alias.scope !4, !noalias !3
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %33, %struct.nish_array** %xs.addr, align 8
  %39 = load i32, i32* %n.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = icmp ule i64 %40, 2147483647
  br i1 %41, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.1:
  %42 = call i8* @nish_alloc_struct(i64 24)
  %43 = bitcast i8* %42 to %struct.nish_array*
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  store i64 %40, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 1
  store i64 %40, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = mul i64 %40, 4
  %47 = call i8* @nish_alloc_struct(i64 %46)
  call void @llvm.memset.p0i8.i64(i8* align 8 %47, i8 0, i64 %46, i1 false), !alias.scope !4, !noalias !3
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  store i8* %47, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %43, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %49 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %59 = load i32, i32* %i.addr, align 4
  %60 = trunc i64 %51 to i32
  %61 = icmp slt i32 %59, %60
  br i1 %61, label %land.rhs, label %land.end

land.rhs:
  %62 = load i32, i32* %i.addr, align 4
  %63 = trunc i64 %56 to i32
  %64 = icmp slt i32 %62, %63
  br label %land.end

land.end:
  %65 = phi i1 [ false, %for.cond ], [ %64, %land.rhs ]
  br i1 %65, label %for.body, label %for.end

for.body:
  %66 = load i32, i32* %i.addr, align 4
  %67 = sext i32 %66 to i64
  %68 = load i32, i32* %i.addr, align 4
  %69 = srem i32 %68, 10
  %70 = bitcast i8* %58 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 %67
  store i32 %69, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %72 = load i32, i32* %i.addr, align 4
  %73 = add nsw i32 %72, 1
  %74 = sitofp i32 %73 to double
  %75 = fdiv double 0x3FF0000000000000, %74
  store double %75, double* %x.addr, align 8
  %76 = load i32, i32* %i.addr, align 4
  %77 = trunc i64 %51 to i32
  %78 = icmp slt i32 %76, %77
  br i1 %78, label %if.then, label %if.end

if.then:
  %79 = load i32, i32* %i.addr, align 4
  %80 = sext i32 %79 to i64
  %81 = load double, double* %x.addr, align 8
  %82 = bitcast i8* %53 to double*
  %83 = getelementptr inbounds double, double* %82, i64 %80
  store double %81, double* %83, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %84 = load i32, i32* %i.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %86 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %87 = call double @nish.parallelReduce$f64$fn.16.nish_main$arrow1(%struct.nish_array* %86, double 0x0000000000000000)
  store double %87, double* %once.addr, align 8
  %88 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %89 = call double @nish.parallelReduce$f64$fn.16.nish_main$arrow2(%struct.nish_array* %88, double 0x0000000000000000)
  store double %89, double* %twice.addr, align 8
  %90 = load double, double* %once.addr, align 8
  %91 = bitcast double %90 to i64
  store i64 %91, i64* %bits.addr, align 8
  %92 = load i64, i64* %bits.addr, align 8
  %93 = call i8* @nish_str_from_i64(i64 %92)
  %94 = call i8* @nish_str_concat(i8* %93, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %95 = load i64, i64* %bits.addr, align 8
  %96 = load double, double* %twice.addr, align 8
  %97 = bitcast double %96 to i64
  %98 = icmp eq i64 %95, %97
  %99 = select i1 %98, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %100 = call i8* @nish_str_concat(i8* %94, i8* %99)
  %101 = call i8* @nish_str_concat(i8* %100, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %102 = load i64, i64* %bits.addr, align 8
  %103 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %104 = call double @blocked(%struct.nish_array* %103)
  %105 = bitcast double %104 to i64
  %106 = icmp eq i64 %102, %105
  %107 = select i1 %106, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %108 = call i8* @nish_str_concat(i8* %101, i8* %107)
  call void @nish_print(i8* %108)
  %109 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %110 = call i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* %109, i32 0)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* %111, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %113 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %114 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* %113, i32 0)
  %115 = call i8* @nish_str_from_i32(i32 %114)
  %116 = call i8* @nish_str_concat(i8* %112, i8* %115)
  call void @nish_print(i8* %116)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = mul nsw i32 %a, %b
  ret i32 %0
}

define hidden noundef double @nish_main$arrow1(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fadd double %a, %b
  ret double %0
}

define hidden noundef double @nish_main$arrow2(double noundef %a, double noundef %b) #0 {
entry:
  %0 = fadd double %a, %b
  ret double %0
}

define hidden noundef i32 @nish_main$arrow3(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = or i32 %a, %b
  ret i32 %0
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
attributes #4 = { noreturn nounwind }
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
