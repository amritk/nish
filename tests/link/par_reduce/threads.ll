%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @add(i32 noundef, i32 noundef) #2
declare noundef i32 @nish_main$arrow0(i32 noundef, i32 noundef) #2
declare noundef double @nish_main$arrow1(double noundef, double noundef) #2
declare noundef double @nish_main$arrow2(double noundef, double noundef) #2
declare noundef i32 @nish_main$arrow3(i32 noundef, i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_panic_div(i1 noundef zeroext) #5
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #0

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

define internal noundef i32 @nish.reduceBlockCount(i32 noundef %n) #0 {
entry:
  %wanted.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = sext i32 1048576 to i64
  %2 = add nsw i64 %0, %1
  %3 = sub nsw i64 %2, 1
  %4 = sext i32 1048576 to i64
  %5 = icmp eq i64 %4, 0
  %6 = icmp eq i64 %3, -9223372036854775808
  %7 = icmp eq i64 %4, -1
  %8 = and i1 %6, %7
  %9 = or i1 %5, %8
  br i1 %9, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %5)
  unreachable

div.ok:
  %10 = sdiv i64 %3, %4
  %11 = trunc i64 %10 to i32
  store i32 %11, i32* %wanted.addr, align 4
  %12 = load i32, i32* %wanted.addr, align 4
  %13 = icmp slt i32 %12, 64
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  %14 = load i32, i32* %wanted.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %15 = phi i32 [ %14, %cond.true ], [ 64, %cond.false ]
  ret i32 %15
}

define internal noundef i32 @nish.reduceBlockStart(i32 noundef %n, i32 noundef %blocks, i32 noundef %k) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = sext i32 %k to i64
  %2 = mul nsw i64 %0, %1
  %3 = sext i32 %blocks to i64
  %4 = icmp eq i64 %3, 0
  %5 = icmp eq i64 %2, -9223372036854775808
  %6 = icmp eq i64 %3, -1
  %7 = and i1 %5, %6
  %8 = or i1 %4, %7
  br i1 %8, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %4)
  unreachable

div.ok:
  %9 = sdiv i64 %2, %3
  %10 = trunc i64 %9 to i32
  ret i32 %10
}

define internal void @nish.parallelReduce$i32$fn.3.add$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #0 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 2
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = trunc i64 %lo to i32
  %8 = trunc i64 %hi to i32
  call void @nish.reduceBlocks$i32$fn.3.add(%struct.nish_array* %2, i32 %4, %struct.nish_array* %6, i32 %7, i32 %8)
  ret void
}

define noundef i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i32 noundef %identity) #0 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %acc.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = call i32 @nish.reduceBlockCount(i32 %2)
  store i32 %3, i32* %blocks.addr, align 4
  %4 = load i32, i32* %blocks.addr, align 4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %identity

if.end:
  %6 = load i32, i32* %blocks.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = mul i64 %7, 4
  %13 = call i8* @nish_alloc_struct(i64 %12)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %9, %struct.nish_array** %partials.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %17
  %18 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store i32 %identity, i32* %18
  %19 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %15, %struct.nish_array** %19
  %20 = bitcast { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx to i8*
  %21 = sext i32 %16 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$i32$fn.3.add$chunk, i8* %20, i64 %21, i64 1)
  %22 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %30, i32* %acc.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %36 = load i32, i32* %k.addr, align 4
  %37 = trunc i64 %33 to i32
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load i32, i32* %acc.addr, align 4
  %40 = load i32, i32* %k.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %35 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %41
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %45 = call i32 @add(i32 %39, i32 %44)
  store i32 %45, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %46 = load i32, i32* %k.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %48 = load i32, i32* %acc.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %48
}

define internal void @nish.parallelReduce$i32$fn.16.nish_main$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #0 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 2
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = trunc i64 %lo to i32
  %8 = trunc i64 %hi to i32
  call void @nish.reduceBlocks$i32$fn.16.nish_main$arrow0(%struct.nish_array* %2, i32 %4, %struct.nish_array* %6, i32 %7, i32 %8)
  ret void
}

define noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i32 noundef %identity) #0 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %acc.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = call i32 @nish.reduceBlockCount(i32 %2)
  store i32 %3, i32* %blocks.addr, align 4
  %4 = load i32, i32* %blocks.addr, align 4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %identity

if.end:
  %6 = load i32, i32* %blocks.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = mul i64 %7, 4
  %13 = call i8* @nish_alloc_struct(i64 %12)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %9, %struct.nish_array** %partials.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %17
  %18 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store i32 %identity, i32* %18
  %19 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %15, %struct.nish_array** %19
  %20 = bitcast { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx to i8*
  %21 = sext i32 %16 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$i32$fn.16.nish_main$arrow0$chunk, i8* %20, i64 %21, i64 1)
  %22 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %30, i32* %acc.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %36 = load i32, i32* %k.addr, align 4
  %37 = trunc i64 %33 to i32
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load i32, i32* %acc.addr, align 4
  %40 = load i32, i32* %k.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %35 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %41
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %45 = call i32 @nish_main$arrow0(i32 %39, i32 %44)
  store i32 %45, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %46 = load i32, i32* %k.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %48 = load i32, i32* %acc.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %48
}

define internal void @nish.parallelReduce$f64$fn.16.nish_main$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #0 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, double, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load double, double* %3
  %5 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %0, i32 0, i32 2
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = trunc i64 %lo to i32
  %8 = trunc i64 %hi to i32
  call void @nish.reduceBlocks$f64$fn.16.nish_main$arrow1(%struct.nish_array* %2, double %4, %struct.nish_array* %6, i32 %7, i32 %8)
  ret void
}

define noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, double noundef %identity) #0 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, double, %struct.nish_array* }, align 8
  %acc.addr = alloca double, align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = call i32 @nish.reduceBlockCount(i32 %2)
  store i32 %3, i32* %blocks.addr, align 4
  %4 = load i32, i32* %blocks.addr, align 4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret double %identity

if.end:
  %6 = load i32, i32* %blocks.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = mul i64 %7, 8
  %13 = call i8* @nish_alloc_struct(i64 %12)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %9, %struct.nish_array** %partials.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %17
  %18 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store double %identity, double* %18
  %19 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %15, %struct.nish_array** %19
  %20 = bitcast { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx to i8*
  %21 = sext i32 %16 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$f64$fn.16.nish_main$arrow1$chunk, i8* %20, i64 %21, i64 1)
  %22 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to double*
  %29 = getelementptr inbounds double, double* %28, i64 0
  %30 = load double, double* %29, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  store double %30, double* %acc.addr, align 8
  store i32 1, i32* %k.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %36 = load i32, i32* %k.addr, align 4
  %37 = trunc i64 %33 to i32
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load double, double* %acc.addr, align 8
  %40 = load i32, i32* %k.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %35 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %41
  %44 = load double, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  %45 = call double @nish_main$arrow1(double %39, double %44)
  store double %45, double* %acc.addr, align 8
  br label %for.inc

for.inc:
  %46 = load i32, i32* %k.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %48 = load double, double* %acc.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret double %48
}

define internal void @nish.parallelReduce$f64$fn.16.nish_main$arrow2$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #0 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, double, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load double, double* %3
  %5 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %0, i32 0, i32 2
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = trunc i64 %lo to i32
  %8 = trunc i64 %hi to i32
  call void @nish.reduceBlocks$f64$fn.16.nish_main$arrow2(%struct.nish_array* %2, double %4, %struct.nish_array* %6, i32 %7, i32 %8)
  ret void
}

define noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, double noundef %identity) #0 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, double, %struct.nish_array* }, align 8
  %acc.addr = alloca double, align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = call i32 @nish.reduceBlockCount(i32 %2)
  store i32 %3, i32* %blocks.addr, align 4
  %4 = load i32, i32* %blocks.addr, align 4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret double %identity

if.end:
  %6 = load i32, i32* %blocks.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = mul i64 %7, 8
  %13 = call i8* @nish_alloc_struct(i64 %12)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %9, %struct.nish_array** %partials.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %17
  %18 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store double %identity, double* %18
  %19 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %15, %struct.nish_array** %19
  %20 = bitcast { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx to i8*
  %21 = sext i32 %16 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$f64$fn.16.nish_main$arrow2$chunk, i8* %20, i64 %21, i64 1)
  %22 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to double*
  %29 = getelementptr inbounds double, double* %28, i64 0
  %30 = load double, double* %29, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  store double %30, double* %acc.addr, align 8
  store i32 1, i32* %k.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %36 = load i32, i32* %k.addr, align 4
  %37 = trunc i64 %33 to i32
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load double, double* %acc.addr, align 8
  %40 = load i32, i32* %k.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %35 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %41
  %44 = load double, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  %45 = call double @nish_main$arrow2(double %39, double %44)
  store double %45, double* %acc.addr, align 8
  br label %for.inc

for.inc:
  %46 = load i32, i32* %k.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %48 = load double, double* %acc.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret double %48
}

define internal void @nish.parallelReduce$i32$fn.16.nish_main$arrow3$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #0 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 2
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = trunc i64 %lo to i32
  %8 = trunc i64 %hi to i32
  call void @nish.reduceBlocks$i32$fn.16.nish_main$arrow3(%struct.nish_array* %2, i32 %4, %struct.nish_array* %6, i32 %7, i32 %8)
  ret void
}

define noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i32 noundef %identity) #0 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %acc.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  %3 = call i32 @nish.reduceBlockCount(i32 %2)
  store i32 %3, i32* %blocks.addr, align 4
  %4 = load i32, i32* %blocks.addr, align 4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %identity

if.end:
  %6 = load i32, i32* %blocks.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !3, !noalias !4
  %12 = mul i64 %7, 4
  %13 = call i8* @nish_alloc_struct(i64 %12)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %9, %struct.nish_array** %partials.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %17
  %18 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store i32 %identity, i32* %18
  %19 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %15, %struct.nish_array** %19
  %20 = bitcast { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx to i8*
  %21 = sext i32 %16 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$i32$fn.16.nish_main$arrow3$chunk, i8* %20, i64 %21, i64 1)
  %22 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  store i32 %30, i32* %acc.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %36 = load i32, i32* %k.addr, align 4
  %37 = trunc i64 %33 to i32
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load i32, i32* %acc.addr, align 4
  %40 = load i32, i32* %k.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %35 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %41
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %45 = call i32 @nish_main$arrow3(i32 %39, i32 %44)
  store i32 %45, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %46 = load i32, i32* %k.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %48 = load i32, i32* %acc.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %48
}

define internal void @nish.reduceBlocks$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp sge i32 %10, 0
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %k.addr, align 4
  %13 = icmp slt i32 %12, %hi
  br label %land.end.1

land.end.1:
  %14 = phi i1 [ false, %for.cond ], [ %13, %land.rhs.1 ]
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %k.addr, align 4
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = icmp slt i32 %15, %16
  br label %land.end

land.end:
  %18 = phi i1 [ false, %land.end.1 ], [ %17, %land.rhs ]
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load i32, i32* %n.addr, align 4
  %20 = load i32, i32* %blocks.addr, align 4
  %21 = load i32, i32* %k.addr, align 4
  %22 = call i32 @nish.reduceBlockStart(i32 %19, i32 %20, i32 %21)
  %23 = load i32, i32* %n.addr, align 4
  %24 = load i32, i32* %blocks.addr, align 4
  %25 = load i32, i32* %k.addr, align 4
  %26 = add nsw i32 %25, 1
  %27 = call i32 @nish.reduceBlockStart(i32 %23, i32 %24, i32 %26)
  %28 = call i32 @nish.reduceRange$i32$fn.3.add(%struct.nish_array* %src, i32 %identity, i32 %22, i32 %27)
  store i32 %28, i32* %partial.addr, align 4
  %29 = load i32, i32* %k.addr, align 4
  %30 = trunc i64 %7 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i32, i32* %partial.addr, align 4
  %35 = bitcast i8* %9 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %33
  store i32 %34, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %k.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.reduceBlocks$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp sge i32 %10, 0
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %k.addr, align 4
  %13 = icmp slt i32 %12, %hi
  br label %land.end.1

land.end.1:
  %14 = phi i1 [ false, %for.cond ], [ %13, %land.rhs.1 ]
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %k.addr, align 4
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = icmp slt i32 %15, %16
  br label %land.end

land.end:
  %18 = phi i1 [ false, %land.end.1 ], [ %17, %land.rhs ]
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load i32, i32* %n.addr, align 4
  %20 = load i32, i32* %blocks.addr, align 4
  %21 = load i32, i32* %k.addr, align 4
  %22 = call i32 @nish.reduceBlockStart(i32 %19, i32 %20, i32 %21)
  %23 = load i32, i32* %n.addr, align 4
  %24 = load i32, i32* %blocks.addr, align 4
  %25 = load i32, i32* %k.addr, align 4
  %26 = add nsw i32 %25, 1
  %27 = call i32 @nish.reduceBlockStart(i32 %23, i32 %24, i32 %26)
  %28 = call i32 @nish.reduceRange$i32$fn.16.nish_main$arrow0(%struct.nish_array* %src, i32 %identity, i32 %22, i32 %27)
  store i32 %28, i32* %partial.addr, align 4
  %29 = load i32, i32* %k.addr, align 4
  %30 = trunc i64 %7 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i32, i32* %partial.addr, align 4
  %35 = bitcast i8* %9 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %33
  store i32 %34, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %k.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.reduceBlocks$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp sge i32 %10, 0
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %k.addr, align 4
  %13 = icmp slt i32 %12, %hi
  br label %land.end.1

land.end.1:
  %14 = phi i1 [ false, %for.cond ], [ %13, %land.rhs.1 ]
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %k.addr, align 4
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = icmp slt i32 %15, %16
  br label %land.end

land.end:
  %18 = phi i1 [ false, %land.end.1 ], [ %17, %land.rhs ]
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load i32, i32* %n.addr, align 4
  %20 = load i32, i32* %blocks.addr, align 4
  %21 = load i32, i32* %k.addr, align 4
  %22 = call i32 @nish.reduceBlockStart(i32 %19, i32 %20, i32 %21)
  %23 = load i32, i32* %n.addr, align 4
  %24 = load i32, i32* %blocks.addr, align 4
  %25 = load i32, i32* %k.addr, align 4
  %26 = add nsw i32 %25, 1
  %27 = call i32 @nish.reduceBlockStart(i32 %23, i32 %24, i32 %26)
  %28 = call double @nish.reduceRange$f64$fn.16.nish_main$arrow1(%struct.nish_array* %src, double %identity, i32 %22, i32 %27)
  store double %28, double* %partial.addr, align 8
  %29 = load i32, i32* %k.addr, align 4
  %30 = trunc i64 %7 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load double, double* %partial.addr, align 8
  %35 = bitcast i8* %9 to double*
  %36 = getelementptr inbounds double, double* %35, i64 %33
  store double %34, double* %36, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %k.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.reduceBlocks$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp sge i32 %10, 0
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %k.addr, align 4
  %13 = icmp slt i32 %12, %hi
  br label %land.end.1

land.end.1:
  %14 = phi i1 [ false, %for.cond ], [ %13, %land.rhs.1 ]
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %k.addr, align 4
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = icmp slt i32 %15, %16
  br label %land.end

land.end:
  %18 = phi i1 [ false, %land.end.1 ], [ %17, %land.rhs ]
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load i32, i32* %n.addr, align 4
  %20 = load i32, i32* %blocks.addr, align 4
  %21 = load i32, i32* %k.addr, align 4
  %22 = call i32 @nish.reduceBlockStart(i32 %19, i32 %20, i32 %21)
  %23 = load i32, i32* %n.addr, align 4
  %24 = load i32, i32* %blocks.addr, align 4
  %25 = load i32, i32* %k.addr, align 4
  %26 = add nsw i32 %25, 1
  %27 = call i32 @nish.reduceBlockStart(i32 %23, i32 %24, i32 %26)
  %28 = call double @nish.reduceRange$f64$fn.16.nish_main$arrow2(%struct.nish_array* %src, double %identity, i32 %22, i32 %27)
  store double %28, double* %partial.addr, align 8
  %29 = load i32, i32* %k.addr, align 4
  %30 = trunc i64 %7 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load double, double* %partial.addr, align 8
  %35 = bitcast i8* %9 to double*
  %36 = getelementptr inbounds double, double* %35, i64 %33
  store double %34, double* %36, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %k.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.reduceBlocks$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp sge i32 %10, 0
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %k.addr, align 4
  %13 = icmp slt i32 %12, %hi
  br label %land.end.1

land.end.1:
  %14 = phi i1 [ false, %for.cond ], [ %13, %land.rhs.1 ]
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %k.addr, align 4
  %16 = load i32, i32* %blocks.addr, align 4
  %17 = icmp slt i32 %15, %16
  br label %land.end

land.end:
  %18 = phi i1 [ false, %land.end.1 ], [ %17, %land.rhs ]
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load i32, i32* %n.addr, align 4
  %20 = load i32, i32* %blocks.addr, align 4
  %21 = load i32, i32* %k.addr, align 4
  %22 = call i32 @nish.reduceBlockStart(i32 %19, i32 %20, i32 %21)
  %23 = load i32, i32* %n.addr, align 4
  %24 = load i32, i32* %blocks.addr, align 4
  %25 = load i32, i32* %k.addr, align 4
  %26 = add nsw i32 %25, 1
  %27 = call i32 @nish.reduceBlockStart(i32 %23, i32 %24, i32 %26)
  %28 = call i32 @nish.reduceRange$i32$fn.16.nish_main$arrow3(%struct.nish_array* %src, i32 %identity, i32 %22, i32 %27)
  store i32 %28, i32* %partial.addr, align 4
  %29 = load i32, i32* %k.addr, align 4
  %30 = trunc i64 %7 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i32, i32* %partial.addr, align 4
  %35 = bitcast i8* %9 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %33
  store i32 %34, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %k.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.reduceRange$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %identity, i32* %acc.addr, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %acc.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %19 = call i32 @add(i32 %13, i32 %18)
  store i32 %19, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %acc.addr, align 4
  ret i32 %22
}

define internal noundef i32 @nish.reduceRange$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %identity, i32* %acc.addr, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %acc.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %19 = call i32 @nish_main$arrow0(i32 %13, i32 %18)
  store i32 %19, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %acc.addr, align 4
  ret i32 %22
}

define internal noundef double @nish.reduceRange$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %acc.addr = alloca double, align 8
  %i.addr = alloca i32, align 4
  store double %identity, double* %acc.addr, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load double, double* %acc.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to double*
  %17 = getelementptr inbounds double, double* %16, i64 %15
  %18 = load double, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  %19 = call double @nish_main$arrow1(double %13, double %18)
  store double %19, double* %acc.addr, align 8
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load double, double* %acc.addr, align 8
  ret double %22
}

define internal noundef double @nish.reduceRange$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %acc.addr = alloca double, align 8
  %i.addr = alloca i32, align 4
  store double %identity, double* %acc.addr, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load double, double* %acc.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to double*
  %17 = getelementptr inbounds double, double* %16, i64 %15
  %18 = load double, double* %17, align 8, !alias.scope !4, !noalias !3, !tbaa !10
  %19 = call double @nish_main$arrow2(double %13, double %18)
  store double %19, double* %acc.addr, align 8
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load double, double* %acc.addr, align 8
  ret double %22
}

define internal noundef i32 @nish.reduceRange$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %identity, i32* %acc.addr, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %hi
  br label %land.end.1

land.end.1:
  %8 = phi i1 [ false, %for.cond ], [ %7, %land.rhs.1 ]
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %1 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %acc.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %19 = call i32 @nish_main$arrow3(i32 %13, i32 %18)
  store i32 %19, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %acc.addr, align 4
  ret i32 %22
}

attributes #0 = { nounwind }
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
!9 = !{!"element double", !6, i64 0}
!10 = !{!9, !9, i64 0}
