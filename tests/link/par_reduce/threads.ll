%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @add(i32 noundef, i32 noundef) #0
declare noundef i32 @nish_main$arrow0(i32 noundef, i32 noundef) #0
declare noundef double @nish_main$arrow1(double noundef, double noundef) #0
declare noundef double @nish_main$arrow2(double noundef, double noundef) #0
declare noundef i32 @nish_main$arrow3(i32 noundef, i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #1
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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
  %0 = sitofp i32 %n to double
  %1 = sitofp i32 1048576 to double
  %2 = fdiv double %0, %1
  %3 = call double @llvm.ceil.f64(double %2)
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  store i32 %4, i32* %wanted.addr, align 4
  %5 = load i32, i32* %wanted.addr, align 4
  %6 = icmp slt i32 %5, 64
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = load i32, i32* %wanted.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ %7, %cond.true ], [ 64, %cond.false ]
  ret i32 %8
}

define internal noundef i32 @nish.reduceBlockStart(i32 noundef %n, i32 noundef %blocks, i32 noundef %k) #0 {
entry:
  %0 = sitofp i32 %n to double
  %1 = sitofp i32 %k to double
  %2 = fmul double %0, %1
  %3 = sitofp i32 %blocks to double
  %4 = fdiv double %2, %3
  %5 = call double @llvm.floor.f64(double %4)
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  ret i32 %6
}

define internal void @nish.dstTooShort(i32 noundef %have, i32 noundef %want) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %have)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [23 x i8] }* @.str.1 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %want)
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  call void @nish_write(i8* %4, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.slotOutOfRange(i32 noundef %at, i32 noundef %length) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %at)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [34 x i8] }* @.str.3 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %length)
  %4 = call i8* @nish_str_concat(i8* %2, i8* %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  call void @nish_write(i8* %5, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.ThreadScope*
  %2 = getelementptr inbounds %struct.ThreadScope, %struct.ThreadScope* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  ret %struct.ThreadScope* %1
}

define internal void @nish.parallelReduce$i32$fn.3.add$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
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

define noundef i32 @nish.parallelReduce$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i32 noundef %identity) #1 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %acc.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = mul i64 %7, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %10, %struct.nish_array** %partials.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %17 = load i32, i32* %blocks.addr, align 4
  %18 = icmp sle i32 %17, 1
  br i1 %18, label %par.seq, label %par.region

par.seq:
  call void @nish.reduceBlocks$i32$fn.3.add(%struct.nish_array* %src, i32 %identity, %struct.nish_array* %16, i32 0, i32 %17)
  br label %par.done

par.region:
  %19 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %19
  %20 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store i32 %identity, i32* %20
  %21 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %16, %struct.nish_array** %21
  %22 = bitcast { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx to i8*
  %23 = sext i32 %17 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$i32$fn.3.add$chunk, i8* %22, i64 %23, i64 1)
  br label %par.done

par.done:
  %24 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  %32 = load i32, i32* %31, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %32, i32* %acc.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  br label %for.cond

for.cond:
  %38 = load i32, i32* %k.addr, align 4
  %39 = trunc i64 %35 to i32
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %for.body, label %for.end

for.body:
  %41 = load i32, i32* %acc.addr, align 4
  %42 = load i32, i32* %k.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = bitcast i8* %37 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %43
  %46 = load i32, i32* %45, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %47 = call i32 @add(i32 %41, i32 %46)
  store i32 %47, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %48 = load i32, i32* %k.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %50 = load i32, i32* %acc.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %50
}

define internal void @nish.parallelReduce$i32$fn.16.nish_main$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
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

define noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i32 noundef %identity) #1 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %acc.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = mul i64 %7, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %10, %struct.nish_array** %partials.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %17 = load i32, i32* %blocks.addr, align 4
  %18 = icmp sle i32 %17, 1
  br i1 %18, label %par.seq, label %par.region

par.seq:
  call void @nish.reduceBlocks$i32$fn.16.nish_main$arrow0(%struct.nish_array* %src, i32 %identity, %struct.nish_array* %16, i32 0, i32 %17)
  br label %par.done

par.region:
  %19 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %19
  %20 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store i32 %identity, i32* %20
  %21 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %16, %struct.nish_array** %21
  %22 = bitcast { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx to i8*
  %23 = sext i32 %17 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$i32$fn.16.nish_main$arrow0$chunk, i8* %22, i64 %23, i64 1)
  br label %par.done

par.done:
  %24 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  %32 = load i32, i32* %31, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %32, i32* %acc.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  br label %for.cond

for.cond:
  %38 = load i32, i32* %k.addr, align 4
  %39 = trunc i64 %35 to i32
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %for.body, label %for.end

for.body:
  %41 = load i32, i32* %acc.addr, align 4
  %42 = load i32, i32* %k.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = bitcast i8* %37 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %43
  %46 = load i32, i32* %45, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %47 = call i32 @nish_main$arrow0(i32 %41, i32 %46)
  store i32 %47, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %48 = load i32, i32* %k.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %50 = load i32, i32* %acc.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %50
}

define internal void @nish.parallelReduce$f64$fn.16.nish_main$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
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

define noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, double noundef %identity) #1 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, double, %struct.nish_array* }, align 8
  %acc.addr = alloca double, align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = mul i64 %7, 8
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %10, %struct.nish_array** %partials.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %17 = load i32, i32* %blocks.addr, align 4
  %18 = icmp sle i32 %17, 1
  br i1 %18, label %par.seq, label %par.region

par.seq:
  call void @nish.reduceBlocks$f64$fn.16.nish_main$arrow1(%struct.nish_array* %src, double %identity, %struct.nish_array* %16, i32 0, i32 %17)
  br label %par.done

par.region:
  %19 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %19
  %20 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store double %identity, double* %20
  %21 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %16, %struct.nish_array** %21
  %22 = bitcast { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx to i8*
  %23 = sext i32 %17 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$f64$fn.16.nish_main$arrow1$chunk, i8* %22, i64 %23, i64 1)
  br label %par.done

par.done:
  %24 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %30 = bitcast i8* %29 to double*
  %31 = getelementptr inbounds double, double* %30, i64 0
  %32 = load double, double* %31, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  store double %32, double* %acc.addr, align 8
  store i32 1, i32* %k.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  br label %for.cond

for.cond:
  %38 = load i32, i32* %k.addr, align 4
  %39 = trunc i64 %35 to i32
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %for.body, label %for.end

for.body:
  %41 = load double, double* %acc.addr, align 8
  %42 = load i32, i32* %k.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = bitcast i8* %37 to double*
  %45 = getelementptr inbounds double, double* %44, i64 %43
  %46 = load double, double* %45, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %47 = call double @nish_main$arrow1(double %41, double %46)
  store double %47, double* %acc.addr, align 8
  br label %for.inc

for.inc:
  %48 = load i32, i32* %k.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %50 = load double, double* %acc.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret double %50
}

define internal void @nish.parallelReduce$f64$fn.16.nish_main$arrow2$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
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

define noundef double @nish.parallelReduce$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, double noundef %identity) #1 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, double, %struct.nish_array* }, align 8
  %acc.addr = alloca double, align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = mul i64 %7, 8
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %10, %struct.nish_array** %partials.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %17 = load i32, i32* %blocks.addr, align 4
  %18 = icmp sle i32 %17, 1
  br i1 %18, label %par.seq, label %par.region

par.seq:
  call void @nish.reduceBlocks$f64$fn.16.nish_main$arrow2(%struct.nish_array* %src, double %identity, %struct.nish_array* %16, i32 0, i32 %17)
  br label %par.done

par.region:
  %19 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %19
  %20 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store double %identity, double* %20
  %21 = getelementptr inbounds { %struct.nish_array*, double, %struct.nish_array* }, { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %16, %struct.nish_array** %21
  %22 = bitcast { %struct.nish_array*, double, %struct.nish_array* }* %par.ctx to i8*
  %23 = sext i32 %17 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$f64$fn.16.nish_main$arrow2$chunk, i8* %22, i64 %23, i64 1)
  br label %par.done

par.done:
  %24 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %30 = bitcast i8* %29 to double*
  %31 = getelementptr inbounds double, double* %30, i64 0
  %32 = load double, double* %31, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  store double %32, double* %acc.addr, align 8
  store i32 1, i32* %k.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  br label %for.cond

for.cond:
  %38 = load i32, i32* %k.addr, align 4
  %39 = trunc i64 %35 to i32
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %for.body, label %for.end

for.body:
  %41 = load double, double* %acc.addr, align 8
  %42 = load i32, i32* %k.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = bitcast i8* %37 to double*
  %45 = getelementptr inbounds double, double* %44, i64 %43
  %46 = load double, double* %45, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %47 = call double @nish_main$arrow2(double %41, double %46)
  store double %47, double* %acc.addr, align 8
  br label %for.inc

for.inc:
  %48 = load i32, i32* %k.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %50 = load double, double* %acc.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret double %50
}

define internal void @nish.parallelReduce$i32$fn.16.nish_main$arrow3$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
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

define noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i32 noundef %identity) #1 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %acc.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
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
  %8 = icmp ule i64 %7, 2147483647
  br i1 %8, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = mul i64 %7, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !9, !noalias !8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %10, %struct.nish_array** %partials.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %17 = load i32, i32* %blocks.addr, align 4
  %18 = icmp sle i32 %17, 1
  br i1 %18, label %par.seq, label %par.region

par.seq:
  call void @nish.reduceBlocks$i32$fn.16.nish_main$arrow3(%struct.nish_array* %src, i32 %identity, %struct.nish_array* %16, i32 0, i32 %17)
  br label %par.done

par.region:
  %19 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %19
  %20 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store i32 %identity, i32* %20
  %21 = getelementptr inbounds { %struct.nish_array*, i32, %struct.nish_array* }, { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %16, %struct.nish_array** %21
  %22 = bitcast { %struct.nish_array*, i32, %struct.nish_array* }* %par.ctx to i8*
  %23 = sext i32 %17 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$i32$fn.16.nish_main$arrow3$chunk, i8* %22, i64 %23, i64 1)
  br label %par.done

par.done:
  %24 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  %32 = load i32, i32* %31, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %32, i32* %acc.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  br label %for.cond

for.cond:
  %38 = load i32, i32* %k.addr, align 4
  %39 = trunc i64 %35 to i32
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %for.body, label %for.end

for.body:
  %41 = load i32, i32* %acc.addr, align 4
  %42 = load i32, i32* %k.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = bitcast i8* %37 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %43
  %46 = load i32, i32* %45, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %47 = call i32 @nish_main$arrow3(i32 %41, i32 %46)
  store i32 %47, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %48 = load i32, i32* %k.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %50 = load i32, i32* %acc.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %50
}

define internal void @nish.reduceBlocks$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  store i32 %34, i32* %36, align 4, !alias.scope !9, !noalias !8, !tbaa !17
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

define internal void @nish.reduceBlocks$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  store i32 %34, i32* %36, align 4, !alias.scope !9, !noalias !8, !tbaa !17
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

define internal void @nish.reduceBlocks$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  store double %34, double* %36, align 8, !alias.scope !9, !noalias !8, !tbaa !19
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

define internal void @nish.reduceBlocks$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  store double %34, double* %36, align 8, !alias.scope !9, !noalias !8, !tbaa !19
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

define internal void @nish.reduceBlocks$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  store i32 %34, i32* %36, align 4, !alias.scope !9, !noalias !8, !tbaa !17
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

define internal noundef i32 @nish.reduceRange$i32$fn.3.add(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, i32 noundef %lo, i32 noundef %hi) #3 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %identity, i32* %acc.addr, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %18 = load i32, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !17
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

define internal noundef i32 @nish.reduceRange$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, i32 noundef %lo, i32 noundef %hi) #3 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %identity, i32* %acc.addr, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %18 = load i32, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !17
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

define internal noundef double @nish.reduceRange$f64$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, i32 noundef %lo, i32 noundef %hi) #3 {
entry:
  %acc.addr = alloca double, align 8
  %i.addr = alloca i32, align 4
  store double %identity, double* %acc.addr, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %18 = load double, double* %17, align 8, !alias.scope !9, !noalias !8, !tbaa !19
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

define internal noundef double @nish.reduceRange$f64$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, double noundef %identity, i32 noundef %lo, i32 noundef %hi) #3 {
entry:
  %acc.addr = alloca double, align 8
  %i.addr = alloca i32, align 4
  store double %identity, double* %acc.addr, align 8
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %18 = load double, double* %17, align 8, !alias.scope !9, !noalias !8, !tbaa !19
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

define internal noundef i32 @nish.reduceRange$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, i32 noundef %lo, i32 noundef %hi) #3 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %identity, i32* %acc.addr, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
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
  %18 = load i32, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !17
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

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ThreadScope", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!"element double", !1, i64 0}
!19 = !{!18, !18, i64 0}
