%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i8 @step(i8 noundef, i8 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
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

define internal void @nish.parallelReduce$u8$fn.4.step$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, i8, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, i8, %struct.nish_array* }, { %struct.nish_array*, i8, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, i8, %struct.nish_array* }, { %struct.nish_array*, i8, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load i8, i8* %3
  %5 = getelementptr inbounds { %struct.nish_array*, i8, %struct.nish_array* }, { %struct.nish_array*, i8, %struct.nish_array* }* %0, i32 0, i32 2
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = trunc i64 %lo to i32
  %8 = trunc i64 %hi to i32
  call void @nish.reduceBlocks$u8$fn.4.step(%struct.nish_array* %2, i8 %4, %struct.nish_array* %6, i32 %7, i32 %8)
  ret void
}

define noundef i8 @nish.parallelReduce$u8$fn.4.step(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i8 noundef %identity) #1 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i8, %struct.nish_array* }, align 8
  %acc.addr = alloca i8, align 1
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
  ret i8 %identity

if.end:
  %6 = load i32, i32* %blocks.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %12 = call i8* @nish_alloc_struct(i64 %7)
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 %7, i1 false), !alias.scope !9, !noalias !8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %9, %struct.nish_array** %partials.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %15 = load i32, i32* %blocks.addr, align 4
  %16 = icmp sle i32 %15, 1
  br i1 %16, label %par.seq, label %par.region

par.seq:
  call void @nish.reduceBlocks$u8$fn.4.step(%struct.nish_array* %src, i8 %identity, %struct.nish_array* %14, i32 0, i32 %15)
  br label %par.done

par.region:
  %17 = getelementptr inbounds { %struct.nish_array*, i8, %struct.nish_array* }, { %struct.nish_array*, i8, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %17
  %18 = getelementptr inbounds { %struct.nish_array*, i8, %struct.nish_array* }, { %struct.nish_array*, i8, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store i8 %identity, i8* %18
  %19 = getelementptr inbounds { %struct.nish_array*, i8, %struct.nish_array* }, { %struct.nish_array*, i8, %struct.nish_array* }* %par.ctx, i32 0, i32 2
  store %struct.nish_array* %14, %struct.nish_array** %19
  %20 = bitcast { %struct.nish_array*, i8, %struct.nish_array* }* %par.ctx to i8*
  %21 = sext i32 %15 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$u8$fn.4.step$chunk, i8* %20, i64 %21, i64 1)
  br label %par.done

par.done:
  %22 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %28 = bitcast i8* %27 to i8*
  %29 = getelementptr inbounds i8, i8* %28, i64 0
  %30 = load i8, i8* %29, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  store i8 %30, i8* %acc.addr, align 1
  store i32 1, i32* %k.addr, align 4
  %31 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  br label %for.cond

for.cond:
  %36 = load i32, i32* %k.addr, align 4
  %37 = trunc i64 %33 to i32
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load i8, i8* %acc.addr, align 1
  %40 = load i32, i32* %k.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %35 to i8*
  %43 = getelementptr inbounds i8, i8* %42, i64 %41
  %44 = load i8, i8* %43, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %45 = call i8 @step(i8 %39, i8 %44)
  store i8 %45, i8* %acc.addr, align 1
  br label %for.inc

for.inc:
  %46 = load i32, i32* %k.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %48 = load i8, i8* %acc.addr, align 1
  call void @nish_arena_release(i64 %arena.mark)
  ret i8 %48
}

define internal void @nish.reduceBlocks$u8$fn.4.step(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i8 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i8, align 1
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
  %28 = call i8 @nish.reduceRange$u8$fn.4.step(%struct.nish_array* %src, i8 %identity, i32 %22, i32 %27)
  store i8 %28, i8* %partial.addr, align 1
  %29 = load i32, i32* %k.addr, align 4
  %30 = trunc i64 %7 to i32
  %31 = icmp slt i32 %29, %30
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load i32, i32* %k.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i8, i8* %partial.addr, align 1
  %35 = bitcast i8* %9 to i8*
  %36 = getelementptr inbounds i8, i8* %35, i64 %33
  store i8 %34, i8* %36, align 1, !alias.scope !9, !noalias !8, !tbaa !17
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

define internal noundef i8 @nish.reduceRange$u8$fn.4.step(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i8 noundef %identity, i32 noundef %lo, i32 noundef %hi) #3 {
entry:
  %acc.addr = alloca i8, align 1
  %i.addr = alloca i32, align 4
  store i8 %identity, i8* %acc.addr, align 1
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
  %13 = load i8, i8* %acc.addr, align 1
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %15
  %18 = load i8, i8* %17, align 1, !alias.scope !9, !noalias !8, !tbaa !17
  %19 = call i8 @step(i8 %13, i8 %18)
  store i8 %19, i8* %acc.addr, align 1
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i8, i8* %acc.addr, align 1
  ret i8 %22
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
!16 = !{!"element i8", !1, i64 0}
!17 = !{!16, !16, i64 0}
