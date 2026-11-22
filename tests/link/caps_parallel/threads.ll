%struct.ThreadScope = type { i32 }
%struct.AtomicI32 = type { i32 }
%struct.AtomicI64 = type { i64 }
%struct.AtomicI32Array = type { i32, %struct.nish_array* }
%struct.AtomicI64Array = type { i32, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.round.init, i8* null }]
@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"scopeWithStack: a stack of \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [32 x i8] } { i64 31, [32 x i8] c" bytes is below the minimum of \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare double @floor(double)
declare double @ceil(double)
declare double @trunc(double)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i32 @square$(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare double @nish_floor(double) #0
declare double @nish_ceil(double) #0
declare void @nish_round_init(double (double)*, double (double)*, double (double)*) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #1
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

define internal void @nish.round.init() nounwind {
entry:
  call void @nish_round_init(double (double)* @floor, double (double)* @ceil, double (double)* @trunc)
  ret void
}

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

define internal noundef i32 @nish.reduceBlockCount(i32 noundef %n) #0 {
entry:
  %wanted.addr = alloca i32, align 4
  %0 = sitofp i32 %n to double
  %1 = sitofp i32 1048576 to double
  %2 = fdiv double %0, %1
  %3 = call double @nish_ceil(double %2)
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
  %5 = call double @nish_floor(double %4)
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

define noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scopeWithStack(i32 noundef %bytes) #1 {
entry:
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = icmp slt i32 %bytes, 131072
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_from_i32(i32 %bytes)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [28 x i8] }* @.str.5 to i8*), i8* %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [32 x i8] }* @.str.6 to i8*))
  %4 = call i8* @nish_str_from_i32(i32 131072)
  %5 = call i8* @nish_str_concat(i8* %3, i8* %4)
  call void @nish_panic(i8* %5)
  unreachable

if.end:
  %6 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %6, %struct.ThreadScope** %s.addr, align 8
  %7 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %8 = getelementptr inbounds %struct.ThreadScope, %struct.ThreadScope* %7, i32 0, i32 0
  store i32 %bytes, i32* %8, align 4, !tbaa !4
  %9 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  ret %struct.ThreadScope* %9
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

define void @nish.AtomicI32Array.constructor(%struct.AtomicI32Array* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %length) #2 {
entry:
  %zero.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %fill.at = alloca i64, align 8
  %0 = icmp sge i32 %length, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %length, 65535
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = trunc i32 %length to i16
  %4 = zext i16 %3 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %9 = mul i64 %4, 4
  %10 = add i64 %9, 192
  %11 = call i8* @nish_alloc_struct(i64 %10)
  %12 = ptrtoint i8* %11 to i64
  %13 = sub i64 0, %12
  %14 = and i64 %13, 63
  %15 = add i64 %14, 64
  %16 = getelementptr inbounds i8, i8* %11, i64 %15
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 %9, i1 false), !alias.scope !14, !noalias !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %18 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %18, align 8, !tbaa !23
  br label %if.end

if.else:
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %24 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !23
  store i32 0, i32* %zero.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %25 = load i32, i32* %k.addr, align 4
  %26 = icmp slt i32 %25, %length
  br i1 %26, label %for.body, label %for.end

for.body:
  %27 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !23
  %29 = load i32, i32* %zero.addr, align 4
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store

push.store:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 %31
  store i32 %29, i32* %38, align 4, !alias.scope !14, !noalias !13, !tbaa !25
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %40 = trunc i64 %39 to i32
  br label %for.inc

for.inc:
  %41 = load i32, i32* %k.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %k.addr, align 4
  br label %for.cond

for.end:
  br label %if.end

if.end:
  %43 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !23
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %47 = load i64, i64* %fill.at, align 8
  %48 = icmp slt i64 %47, %46
  br i1 %48, label %fill.body, label %fill.end

fill.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %51 = bitcast i8* %50 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 %47
  store i32 0, i32* %52, align 4, !alias.scope !14, !noalias !13, !tbaa !25
  %53 = add i64 %47, 1
  store i64 %53, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %54 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %55 = load %struct.nish_array*, %struct.nish_array** %54, align 8, !tbaa !23
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 0
  store i32 %58, i32* %59, align 4, !tbaa !26
  ret void
}

define noundef i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load atomic i32, i32* %9 seq_cst, align 4
  ret i32 %10
}

define void @nish.AtomicI32Array.store(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  store atomic i32 %value, i32* %9 seq_cst, align 4
  ret void
}

define noundef i32 @nish.AtomicI32Array.add(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %delta) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = atomicrmw add i32* %9, i32 %delta seq_cst, align 4
  ret i32 %10
}

define noundef i32 @nish.AtomicI32Array.sub(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %delta) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = atomicrmw sub i32* %9, i32 %delta seq_cst, align 4
  ret i32 %10
}

define noundef i32 @nish.AtomicI32Array.min(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = atomicrmw min i32* %9, i32 %value seq_cst, align 4
  ret i32 %10
}

define noundef i32 @nish.AtomicI32Array.max(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = atomicrmw max i32* %9, i32 %value seq_cst, align 4
  ret i32 %10
}

define noundef i32 @nish.AtomicI32Array.exchange(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = atomicrmw xchg i32* %9, i32 %value seq_cst, align 4
  ret i32 %10
}

define noundef i32 @nish.AtomicI32Array.compareExchange(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %expected, i32 noundef %desired) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = cmpxchg i32* %9, i32 %expected, i32 %desired seq_cst seq_cst, align 4
  %11 = extractvalue { i32, i1 } %10, 0
  ret i32 %11
}

define void @nish.AtomicI64Array.constructor(%struct.AtomicI64Array* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %length) #2 {
entry:
  %k.addr = alloca i32, align 4
  %fill.at = alloca i64, align 8
  %0 = icmp sge i32 %length, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %length, 65535
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = trunc i32 %length to i16
  %4 = zext i16 %3 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %9 = mul i64 %4, 8
  %10 = add i64 %9, 192
  %11 = call i8* @nish_alloc_struct(i64 %10)
  %12 = ptrtoint i8* %11 to i64
  %13 = sub i64 0, %12
  %14 = and i64 %13, 63
  %15 = add i64 %14, 64
  %16 = getelementptr inbounds i8, i8* %11, i64 %15
  call void @llvm.memset.p0i8.i64(i8* align 8 %16, i8 0, i64 %9, i1 false), !alias.scope !14, !noalias !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %18 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %18, align 8, !tbaa !28
  br label %if.end

if.else:
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %24 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !28
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %25 = load i32, i32* %k.addr, align 4
  %26 = icmp slt i32 %25, %length
  br i1 %26, label %for.body, label %for.end

for.body:
  %27 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !28
  %29 = sext i32 0 to i64
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %28, i64 8)
  br label %push.store

push.store:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %37 = bitcast i8* %36 to i64*
  %38 = getelementptr inbounds i64, i64* %37, i64 %31
  store i64 %29, i64* %38, align 8, !alias.scope !14, !noalias !13, !tbaa !30
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %40 = trunc i64 %39 to i32
  br label %for.inc

for.inc:
  %41 = load i32, i32* %k.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %k.addr, align 4
  br label %for.cond

for.end:
  br label %if.end

if.end:
  %43 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !28
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %47 = load i64, i64* %fill.at, align 8
  %48 = icmp slt i64 %47, %46
  br i1 %48, label %fill.body, label %fill.end

fill.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %51 = bitcast i8* %50 to i64*
  %52 = getelementptr inbounds i64, i64* %51, i64 %47
  store i64 0, i64* %52, align 8, !alias.scope !14, !noalias !13, !tbaa !30
  %53 = add i64 %47, 1
  store i64 %53, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %54 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %55 = load %struct.nish_array*, %struct.nish_array** %54, align 8, !tbaa !28
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 0
  store i32 %58, i32* %59, align 4, !tbaa !31
  ret void
}

define noundef i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  %10 = load atomic i64, i64* %9 seq_cst, align 8
  ret i64 %10
}

define void @nish.AtomicI64Array.store(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i64 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  store atomic i64 %value, i64* %9 seq_cst, align 8
  ret void
}

define noundef i64 @nish.AtomicI64Array.add(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i64 noundef %delta) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  %10 = atomicrmw add i64* %9, i64 %delta seq_cst, align 8
  ret i64 %10
}

define noundef i64 @nish.AtomicI64Array.sub(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i64 noundef %delta) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  %10 = atomicrmw sub i64* %9, i64 %delta seq_cst, align 8
  ret i64 %10
}

define noundef i64 @nish.AtomicI64Array.min(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i64 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  %10 = atomicrmw min i64* %9, i64 %value seq_cst, align 8
  ret i64 %10
}

define noundef i64 @nish.AtomicI64Array.max(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i64 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  %10 = atomicrmw max i64* %9, i64 %value seq_cst, align 8
  ret i64 %10
}

define noundef i64 @nish.AtomicI64Array.exchange(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i64 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  %10 = atomicrmw xchg i64* %9, i64 %value seq_cst, align 8
  ret i64 %10
}

define noundef i64 @nish.AtomicI64Array.compareExchange(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i64 noundef %expected, i64 noundef %desired) #1 {
entry:
  %0 = getelementptr inbounds %struct.AtomicI64Array, %struct.AtomicI64Array* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i64*
  %9 = getelementptr inbounds i64, i64* %8, i64 %2
  %10 = cmpxchg i64* %9, i64 %expected, i64 %desired seq_cst seq_cst, align 8
  %11 = extractvalue { i64, i1 } %10, 0
  ret i64 %11
}

define internal void @nish.parallelMapInto$i32$i32$fn.6.square$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  call void @nish.mapRange$i32$i32$fn.6.square(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  ret void
}

define void @nish.parallelMapInto$i32$i32$fn.6.square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #1 {
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
  %13 = icmp sle i32 %12, 699050
  br i1 %13, label %par.seq, label %par.region

par.seq:
  call void @nish.mapRange$i32$i32$fn.6.square(%struct.nish_array* %src, %struct.nish_array* %dst, i32 0, i32 %12)
  br label %par.done

par.region:
  %14 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %14
  %15 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array*, %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %12 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$i32$fn.6.square$chunk, i8* %16, i64 %17, i64 699050)
  br label %par.done

par.done:
  ret void
}

define internal void @nish.mapRange$i32$i32$fn.6.square(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
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
  %25 = load i32, i32* %24, align 4, !alias.scope !14, !noalias !13, !tbaa !25
  %26 = call i32 @square$(i32 %25)
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
  store i32 %32, i32* %34, align 4, !alias.scope !14, !noalias !13, !tbaa !25
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

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!32, !33, !34, !35, !36}
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
!21 = !{!"ptr", !1, i64 0}
!22 = !{!"AtomicI32Array", !2, i64 0, !21, i64 8}
!23 = !{!22, !21, i64 8}
!24 = !{!"element i32", !1, i64 0}
!25 = !{!24, !24, i64 0}
!26 = !{!22, !2, i64 0}
!27 = !{!"AtomicI64Array", !2, i64 0, !21, i64 8}
!28 = !{!27, !21, i64 8}
!29 = !{!"element i64", !1, i64 0}
!30 = !{!29, !29, i64 0}
!31 = !{!27, !2, i64 0}
!32 = !{i32 8, !"cf-protection-branch", i32 1}
!33 = !{i32 8, !"cf-protection-return", i32 1}
!34 = !{i32 8, !"branch-target-enforcement", i32 1}
!35 = !{i32 8, !"sign-return-address", i32 1}
!36 = !{i32 4, !"probe-stack", !"inline-asm"}
