%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
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
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 %26, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 %26, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = mul i64 %26, 8
  %32 = call i8* @nish_alloc_struct(i64 %31)
  call void @llvm.memset.p0i8.i64(i8* align 8 %32, i8 0, i64 %31, i1 false), !alias.scope !4, !noalias !3
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %28, %struct.nish_array** %xs.addr, align 8
  %34 = load i32, i32* %n.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = call i8* @nish_alloc_struct(i64 24)
  %37 = bitcast i8* %36 to %struct.nish_array*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  store i64 %35, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 1
  store i64 %35, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %40 = mul i64 %35, 4
  %41 = call i8* @nish_alloc_struct(i64 %40)
  call void @llvm.memset.p0i8.i64(i8* align 8 %41, i8 0, i64 %40, i1 false), !alias.scope !4, !noalias !3
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  store i8* %41, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %37, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %43 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %53 = load i32, i32* %i.addr, align 4
  %54 = trunc i64 %45 to i32
  %55 = icmp slt i32 %53, %54
  br i1 %55, label %land.rhs, label %land.end

land.rhs:
  %56 = load i32, i32* %i.addr, align 4
  %57 = trunc i64 %50 to i32
  %58 = icmp slt i32 %56, %57
  br label %land.end

land.end:
  %59 = phi i1 [ false, %for.cond ], [ %58, %land.rhs ]
  br i1 %59, label %for.body, label %for.end

for.body:
  %60 = load i32, i32* %i.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = load i32, i32* %i.addr, align 4
  %63 = srem i32 %62, 10
  %64 = bitcast i8* %52 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %61
  store i32 %63, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %66 = load i32, i32* %i.addr, align 4
  %67 = add nsw i32 %66, 1
  %68 = sitofp i32 %67 to double
  %69 = fdiv double 0x3FF0000000000000, %68
  store double %69, double* %x.addr, align 8
  %70 = load i32, i32* %i.addr, align 4
  %71 = trunc i64 %45 to i32
  %72 = icmp slt i32 %70, %71
  br i1 %72, label %if.then, label %if.end

if.then:
  %73 = load i32, i32* %i.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = load double, double* %x.addr, align 8
  %76 = bitcast i8* %47 to double*
  %77 = getelementptr inbounds double, double* %76, i64 %74
  store double %75, double* %77, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %78 = load i32, i32* %i.addr, align 4
  %79 = add nsw i32 %78, 1
  store i32 %79, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %80 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %81 = call double @nish.parallelReduce$f64$fn.16.nish_main$arrow1(%struct.nish_array* %80, double 0x0000000000000000)
  store double %81, double* %once.addr, align 8
  %82 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %83 = call double @nish.parallelReduce$f64$fn.16.nish_main$arrow2(%struct.nish_array* %82, double 0x0000000000000000)
  store double %83, double* %twice.addr, align 8
  %84 = load double, double* %once.addr, align 8
  %85 = bitcast double %84 to i64
  store i64 %85, i64* %bits.addr, align 8
  %86 = load i64, i64* %bits.addr, align 8
  %87 = call i8* @nish_str_from_i64(i64 %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %89 = load i64, i64* %bits.addr, align 8
  %90 = load double, double* %twice.addr, align 8
  %91 = bitcast double %90 to i64
  %92 = icmp eq i64 %89, %91
  %93 = select i1 %92, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %94 = call i8* @nish_str_concat(i8* %88, i8* %93)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %96 = load i64, i64* %bits.addr, align 8
  %97 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %98 = call double @blocked(%struct.nish_array* %97)
  %99 = bitcast double %98 to i64
  %100 = icmp eq i64 %96, %99
  %101 = select i1 %100, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %102 = call i8* @nish_str_concat(i8* %95, i8* %101)
  call void @nish_print(i8* %102)
  %103 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %104 = call i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* %103, i32 0)
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* %105, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %107 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %108 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* %107, i32 0)
  %109 = call i8* @nish_str_from_i32(i32 %108)
  %110 = call i8* @nish_str_concat(i8* %106, i8* %109)
  call void @nish_print(i8* %110)
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
