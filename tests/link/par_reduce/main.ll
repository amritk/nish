%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), double noundef) #0
declare noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), double noundef) #0
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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

define hidden noundef i32 @add$(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef double @blocked(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
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

define noundef i32 @nish_main() #0 {
entry:
  %small.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %x.addr = alloca double, align 8
  %once.addr = alloca double, align 8
  %twice.addr = alloca double, align 8
  %bits.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 4, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %small.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %empty.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %small.addr, align 8
  %13 = call i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* %12, i32 0)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %16 = load %struct.nish_array*, %struct.nish_array** %small.addr, align 8
  %17 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow0(%struct.nish_array* %16, i32 1)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %15, i8* %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %21 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %22 = call i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* %21, i32 0)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %20, i8* %23)
  call void @nish_print(i8* %24)
  store i32 3000000, i32* %n.addr, align 4
  %25 = load i32, i32* %n.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = icmp ule i64 %26, 2147483647
  br i1 %27, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*))
  unreachable

len.ok:
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 %26, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 %26, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = mul i64 %26, 8
  %33 = call i8* @nish_alloc_struct(i64 %32)
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 %32, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %29, %struct.nish_array** %xs.addr, align 8
  %35 = load i32, i32* %n.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = icmp ule i64 %36, 2147483647
  br i1 %37, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.1 to i8*))
  unreachable

len.ok.1:
  %38 = call i8* @nish_alloc_struct(i64 24)
  %39 = bitcast i8* %38 to %struct.nish_array*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  store i64 %36, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  store i64 %36, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = mul i64 %36, 4
  %43 = call i8* @nish_alloc_struct(i64 %42)
  call void @llvm.memset.p0i8.i64(i8* align 8 %43, i8 0, i64 %42, i1 false), !alias.scope !4, !noalias !3
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %39, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %45 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %55 = load i32, i32* %i.addr, align 4
  %56 = trunc i64 %47 to i32
  %57 = icmp slt i32 %55, %56
  br i1 %57, label %land.rhs, label %land.end

land.rhs:
  %58 = load i32, i32* %i.addr, align 4
  %59 = trunc i64 %52 to i32
  %60 = icmp slt i32 %58, %59
  br label %land.end

land.end:
  %61 = phi i1 [ false, %for.cond ], [ %60, %land.rhs ]
  br i1 %61, label %for.body, label %for.end

for.body:
  %62 = load i32, i32* %i.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = load i32, i32* %i.addr, align 4
  %65 = srem i32 %64, 10
  %66 = bitcast i8* %54 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %63
  store i32 %65, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %68 = load i32, i32* %i.addr, align 4
  %69 = add nsw i32 %68, 1
  %70 = sitofp i32 %69 to double
  %71 = fdiv double 0x3FF0000000000000, %70
  store double %71, double* %x.addr, align 8
  %72 = load i32, i32* %i.addr, align 4
  %73 = trunc i64 %47 to i32
  %74 = icmp slt i32 %72, %73
  br i1 %74, label %if.then, label %if.end

if.then:
  %75 = load i32, i32* %i.addr, align 4
  %76 = sext i32 %75 to i64
  %77 = load double, double* %x.addr, align 8
  %78 = bitcast i8* %49 to double*
  %79 = getelementptr inbounds double, double* %78, i64 %76
  store double %77, double* %79, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %80 = load i32, i32* %i.addr, align 4
  %81 = add nsw i32 %80, 1
  store i32 %81, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %82 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %83 = call double @nish.parallelReduce$f64$fn.16.nish_main$arrow1(%struct.nish_array* %82, double 0x0000000000000000)
  store double %83, double* %once.addr, align 8
  %84 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %85 = call double @nish.parallelReduce$f64$fn.16.nish_main$arrow2(%struct.nish_array* %84, double 0x0000000000000000)
  store double %85, double* %twice.addr, align 8
  %86 = load double, double* %once.addr, align 8
  %87 = bitcast double %86 to i64
  store i64 %87, i64* %bits.addr, align 8
  %88 = load i64, i64* %bits.addr, align 8
  %89 = call i8* @nish_str_from_i64(i64 %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %91 = load i64, i64* %bits.addr, align 8
  %92 = load double, double* %twice.addr, align 8
  %93 = bitcast double %92 to i64
  %94 = icmp eq i64 %91, %93
  %95 = select i1 %94, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %96 = call i8* @nish_str_concat(i8* %90, i8* %95)
  %97 = call i8* @nish_str_concat(i8* %96, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %98 = load i64, i64* %bits.addr, align 8
  %99 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %100 = call double @blocked(%struct.nish_array* %99)
  %101 = bitcast double %100 to i64
  %102 = icmp eq i64 %98, %101
  %103 = select i1 %102, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %104 = call i8* @nish_str_concat(i8* %97, i8* %103)
  call void @nish_print(i8* %104)
  %105 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %106 = call i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* %105, i32 0)
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* %107, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %109 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %110 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* %109, i32 0)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* %108, i8* %111)
  call void @nish_print(i8* %112)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef double @nish_main$arrow1(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fadd double %a, %b
  ret double %0
}

define hidden noundef double @nish_main$arrow2(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fadd double %a, %b
  ret double %0
}

define hidden noundef i32 @nish_main$arrow3(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %0 = or i32 %a, %b
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
