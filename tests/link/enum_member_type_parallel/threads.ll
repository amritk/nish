%struct.ThreadScope = type { i32 }
%struct.AtomicI32 = type { i32 }
%struct.AtomicI64 = type { i64 }
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
declare noundef i32 @nish_main$arrow0(i32 noundef) #0
declare noundef i32 @nish_main$arrow1(i32 noundef) #0
declare noundef i32 @pick$(i32 noundef, i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #1
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

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
  call void @nish_panic(i8* %4)
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
  call void @nish_panic(i8* %5)
  unreachable
}

define internal noundef zeroext i1 @nish.slotWritten(i32 noundef %at) #0 {
entry:
  %0 = icmp slt i32 %at, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp sge i32 %at, 0
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  ret i1 %2
}

define noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.ThreadScope*
  %2 = getelementptr inbounds %struct.ThreadScope, %struct.ThreadScope* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  ret %struct.ThreadScope* %1
}

define void @nish.AtomicI32.constructor(%struct.AtomicI32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !6
  ret void
}

define noundef i32 @nish.AtomicI32.load(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = load atomic i32, i32* %0 seq_cst, align 4
  ret i32 %1
}

define void @nish.AtomicI32.store(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  store atomic i32 %value, i32* %0 seq_cst, align 4
  ret void
}

define noundef i32 @nish.AtomicI32.add(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw add i32* %0, i32 %delta seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.sub(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw sub i32* %0, i32 %delta seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.min(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw min i32* %0, i32 %value seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.max(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw max i32* %0, i32 %value seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.exchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = atomicrmw xchg i32* %0, i32 %value seq_cst, align 4
  ret i32 %1
}

define noundef i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %expected, i32 noundef %desired) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32, %struct.AtomicI32* %this, i32 0, i32 0
  %1 = cmpxchg i32* %0, i32 %expected, i32 %desired seq_cst seq_cst, align 4
  %2 = extractvalue { i32, i1 } %1, 0
  ret i32 %2
}

define void @nish.AtomicI64.constructor(%struct.AtomicI64* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  store i64 %value, i64* %0, align 8, !tbaa !9
  ret void
}

define noundef i64 @nish.AtomicI64.load(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = load atomic i64, i64* %0 seq_cst, align 8
  ret i64 %1
}

define void @nish.AtomicI64.store(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  store atomic i64 %value, i64* %0 seq_cst, align 8
  ret void
}

define noundef i64 @nish.AtomicI64.add(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw add i64* %0, i64 %delta seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.sub(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %delta) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw sub i64* %0, i64 %delta seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.min(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw min i64* %0, i64 %value seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.max(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw max i64* %0, i64 %value seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.exchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = atomicrmw xchg i64* %0, i64 %value seq_cst, align 8
  ret i64 %1
}

define noundef i64 @nish.AtomicI64.compareExchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %this, i64 noundef %expected, i64 noundef %desired) #2 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64, %struct.AtomicI64* %this, i32 0, i32 0
  %1 = cmpxchg i64* %0, i64 %expected, i64 %desired seq_cst seq_cst, align 8
  %2 = extractvalue { i64, i1 } %1, 0
  ret i64 %2
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %9 = mul i64 %3, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !14, !noalias !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  store %struct.nish_array* %6, %struct.nish_array** %dst.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* %src, %struct.nish_array* %12)
  %13 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %13
}

define internal void @nish.parallelFrom$em.p0.en$Kind$fn.16.nish_main$arrow1$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  call void @nish.fromRange$em.p0.en$Kind$fn.16.nish_main$arrow1(%struct.nish_array* %2, i32 %3, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$em.p0.en$Kind$fn.16.nish_main$arrow1(i32 noundef %n) #1 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array* }, align 8
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !14, !noalias !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 1048576
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$em.p0.en$Kind$fn.16.nish_main$arrow1(%struct.nish_array* %9, i32 0, i32 %13)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$em.p0.en$Kind$fn.16.nish_main$arrow1$chunk, i8* %16, i64 %17, i64 1048576)
  br label %par.done

par.done:
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %18
}

define internal void @nish.parallelReduce$em.p0.en$Kind$fn.4.pick$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
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
  call void @nish.reduceBlocks$em.p0.en$Kind$fn.4.pick(%struct.nish_array* %2, i32 %4, %struct.nish_array* %6, i32 %7, i32 %8)
  ret void
}

define noundef i32 @nish.parallelReduce$em.p0.en$Kind$fn.4.pick(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, i32 noundef %identity) #1 {
entry:
  %blocks.addr = alloca i32, align 4
  %partials.addr = alloca %struct.nish_array*, align 8
  %par.ctx = alloca { %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %acc.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
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
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.5 to i8*))
  unreachable

len.ok:
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %7, i64* %11, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %7, i64* %12, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %13 = mul i64 %7, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !14, !noalias !13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  store %struct.nish_array* %10, %struct.nish_array** %partials.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %17 = load i32, i32* %blocks.addr, align 4
  %18 = icmp sle i32 %17, 1
  br i1 %18, label %par.seq, label %par.region

par.seq:
  call void @nish.reduceBlocks$em.p0.en$Kind$fn.4.pick(%struct.nish_array* %src, i32 %identity, %struct.nish_array* %16, i32 0, i32 %17)
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
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelReduce$em.p0.en$Kind$fn.4.pick$chunk, i8* %22, i64 %23, i64 1)
  br label %par.done

par.done:
  %24 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %27 = icmp ult i64 0, %26
  br i1 %27, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %26)
  unreachable

bounds.ok:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  %32 = load i32, i32* %31, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store i32 %32, i32* %acc.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %partials.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !13, !noalias !14, !tbaa !20
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
  %46 = load i32, i32* %45, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %47 = call i32 @pick$(i32 %41, i32 %46)
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

define internal void @nish.parallelMapInto$i32$em.p0.en$Kind$fn.16.nish_main$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  call void @nish.mapRange$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  ret void
}

define void @nish.parallelMapInto$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array* }, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %10 = trunc i64 %9 to i32
  %11 = load i32, i32* %n.addr, align 4
  call void @nish.dstTooShort(i32 %10, i32 %11)
  br label %if.end

if.end:
  %12 = load i32, i32* %n.addr, align 4
  %13 = icmp sle i32 %12, 1048576
  br i1 %13, label %par.seq, label %par.region

par.seq:
  call void @nish.mapRange$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  br label %par.done

par.region:
  %14 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %14
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array*, %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$em.p0.en$Kind$fn.16.nish_main$arrow0$chunk, i8* %16, i64 %17, i64 1048576)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.fromRange$em.p0.en$Kind$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !13, !noalias !14, !tbaa !20
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
  %13 = load i32, i32* %i.addr, align 4
  %14 = call i32 @nish_main$arrow1(i32 %13)
  store i32 %14, i32* %y.addr, align 4
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %1 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %y.addr, align 4
  %21 = bitcast i8* %3 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.reduceBlocks$em.p0.en$Kind$fn.4.pick(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %partials, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %n.addr = alloca i32, align 4
  %blocks.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %blocks.addr, align 4
  store i32 %lo, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %partials, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
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
  %28 = call i32 @nish.reduceRange$em.p0.en$Kind$fn.4.pick(%struct.nish_array* %src, i32 %identity, i32 %22, i32 %27)
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
  store i32 %34, i32* %36, align 4, !alias.scope !14, !noalias !13, !tbaa !22
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

define internal void @nish.mapRange$i32$em.p0.en$Kind$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.2 ]
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end.1

land.end.1:
  %16 = phi i1 [ false, %land.end.2 ], [ %15, %land.rhs.1 ]
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %5 to i32
  %19 = icmp slt i32 %17, %18
  br label %land.end

land.end:
  %20 = phi i1 [ false, %land.end.1 ], [ %19, %land.rhs ]
  br i1 %20, label %for.body, label %for.end

for.body:
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %26 = call i32 @nish_main$arrow0(i32 %25)
  store i32 %26, i32* %y.addr, align 4
  %27 = load i32, i32* %i.addr, align 4
  %28 = trunc i64 %5 to i32
  %29 = icmp slt i32 %27, %28
  br i1 %29, label %if.then, label %if.end

if.then:
  %30 = load i32, i32* %i.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = load i32, i32* %y.addr, align 4
  %33 = bitcast i8* %7 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %31
  store i32 %32, i32* %34, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %35 = load i32, i32* %i.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.reduceRange$em.p0.en$Kind$fn.4.pick(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, i32 noundef %identity, i32 noundef %lo, i32 noundef %hi) #3 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %identity, i32* %acc.addr, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !13, !noalias !14, !tbaa !20
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
  %18 = load i32, i32* %17, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %19 = call i32 @pick$(i32 %13, i32 %18)
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

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!23, !24, !25, !26, !27}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ThreadScope", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"AtomicI32", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{!"i64", !1, i64 0}
!8 = !{!"AtomicI64", !7, i64 0}
!9 = !{!8, !7, i64 0}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{i32 8, !"cf-protection-branch", i32 1}
!24 = !{i32 8, !"cf-protection-return", i32 1}
!25 = !{i32 8, !"branch-target-enforcement", i32 1}
!26 = !{i32 8, !"sign-return-address", i32 1}
!27 = !{i32 4, !"probe-stack", !"inline-asm"}
