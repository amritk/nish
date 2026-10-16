%struct.ThreadScope = type { i32 }
%struct.AtomicI32 = type { i32 }
%struct.AtomicI64 = type { i64 }
%struct.Log = type { i8*, i32 }
%struct.Mutex$$Log = type { %struct.MutexGuard$$Log* }
%struct.MutexGuard$$Log = type { %struct.Log*, i32 }
%struct.Text = type { i8* }
%struct.Job = type { %struct.Mutex$$Log*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"spawn: destination index \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c" is out of range for an array of \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" elements\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 i8* @label$(i32 noundef) #1
declare noundef nonnull align 8 i8* @nameOf$(i32 noundef) #1
declare noundef nonnull align 8 i8* @echo$(%struct.Text* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #3
declare noundef nonnull align 8 i8* @middle$(i32 noundef) #1
declare noundef nonnull align 8 i8* @tail$(i32 noundef) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @squares$(i32 noundef) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @halves$(i32 noundef) #2
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @evens$(i32 noundef) #1
declare noundef i32 @first$(i32 noundef) #1
declare noundef nonnull align 8 i8* @record$(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_scope_spawn(i8* noundef nonnull, void (i8*)* noundef nonnull, void (i8*)* noundef nonnull, i8* noundef nonnull, i64 noundef) #1
declare void @nish_mutex_wait(i32* noundef nonnull) #1
declare i8* @nish_cross_out(i8* noundef, i64 noundef, i64 noundef) #1
declare i8* @nish_cross_in(i8* noundef, i64 noundef) #1
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

define void @nish.MutexGuard$$Log.constructor(%struct.MutexGuard$$Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Log* noundef nonnull align 8 dereferenceable(16) %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !12
  %1 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %this, i32 0, i32 0
  store %struct.Log* %value, %struct.Log** %1, align 8, !tbaa !13
  ret void
}

define void @nish.Mutex$$Log.constructor(%struct.Mutex$$Log* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Log* noundef nonnull align 8 dereferenceable(16) %init) #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.MutexGuard$$Log*
  call void @nish.MutexGuard$$Log.constructor(%struct.MutexGuard$$Log* %1, %struct.Log* %init)
  %2 = getelementptr inbounds %struct.Mutex$$Log, %struct.Mutex$$Log* %this, i32 0, i32 0
  store %struct.MutexGuard$$Log* %1, %struct.MutexGuard$$Log** %2, align 8, !tbaa !15
  ret void
}

define noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Log* @nish.Mutex$$Log.lock(%struct.Mutex$$Log* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Mutex$$Log, %struct.Mutex$$Log* %this, i32 0, i32 0
  %1 = load %struct.MutexGuard$$Log*, %struct.MutexGuard$$Log** %0, align 8, !tbaa !15
  %2 = getelementptr inbounds %struct.MutexGuard$$Log, %struct.MutexGuard$$Log* %1, i32 0, i32 1
  %3 = cmpxchg i32* %2, i32 0, i32 1 acquire monotonic
  %4 = extractvalue { i32, i1 } %3, 1
  br i1 %4, label %lock.held, label %lock.wait

lock.wait:
  call void @nish_mutex_wait(i32* %2)
  br label %lock.held

lock.held:
  ret %struct.MutexGuard$$Log* %1
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.5.label$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @label$(i32 %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.5.label$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$i32$str$fn.5.label(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @label$(i32 %arg)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  ret void

if.end:
  %5 = icmp slt i32 %at, 0
  br i1 %5, label %lor.end, label %lor.rhs

lor.rhs:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %8 = trunc i64 %7 to i32
  %9 = icmp sge i32 %at, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %if.end ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end.1

if.end.1:
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %14
  %15 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %16
  %17 = bitcast { i32, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %18 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %18, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.5.label$run, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.5.label$finish, i8* %17, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i8* }* getelementptr ({ i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.6.nameOf$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @nameOf$(i32 %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.6.nameOf$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$i32$str$fn.6.nameOf(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @nameOf$(i32 %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %12
  %13 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { i32, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.6.nameOf$run, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.6.nameOf$finish, i8* %15, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i8* }* getelementptr ({ i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$$Text$str$fn.4.echo$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Text*, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load %struct.Text*, %struct.Text** %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @echo$(%struct.Text* %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$$Text$str$fn.4.echo$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Text*, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$$Text$str$fn.4.echo(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Text* noundef nonnull align 8 dereferenceable(8) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.Text*, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @echo$(%struct.Text* %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store %struct.Text* %arg, %struct.Text** %12
  %13 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { %struct.Text*, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$$Text$str$fn.4.echo$run, void (i8*)* @nish.ThreadScope.spawn$$Text$str$fn.4.echo$finish, i8* %15, i64 ptrtoint ({ %struct.Text*, %struct.nish_array*, i32, i8* }* getelementptr ({ %struct.Text*, %struct.nish_array*, i32, i8* }, { %struct.Text*, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.6.middle$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @middle$(i32 %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.6.middle$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$i32$str$fn.6.middle(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @middle$(i32 %arg)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  ret void

if.end:
  %5 = icmp slt i32 %at, 0
  br i1 %5, label %lor.end, label %lor.rhs

lor.rhs:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %8 = trunc i64 %7 to i32
  %9 = icmp sge i32 %at, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %if.end ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end.1

if.end.1:
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %14
  %15 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %16
  %17 = bitcast { i32, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %18 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %18, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.6.middle$run, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.6.middle$finish, i8* %17, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i8* }* getelementptr ({ i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.4.tail$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @tail$(i32 %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$str$fn.4.tail$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$i32$str$fn.4.tail(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @tail$(i32 %arg)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  ret void

if.end:
  %5 = icmp slt i32 %at, 0
  br i1 %5, label %lor.end, label %lor.rhs

lor.rhs:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %8 = trunc i64 %7 to i32
  %9 = icmp sge i32 %at, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %if.end ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end.1

if.end.1:
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %14
  %15 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %15
  %16 = getelementptr inbounds { i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %16
  %17 = bitcast { i32, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %18 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %18, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.4.tail$run, void (i8*)* @nish.ThreadScope.spawn$i32$str$fn.4.tail$finish, i8* %17, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i8* }* getelementptr ({ i32, %struct.nish_array*, i32, i8* }, { i32, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call %struct.nish_array* @squares$(i32 %2)
  %5 = bitcast %struct.nish_array* %4 to i8*
  %6 = call i8* @nish_cross_out(i8* %5, i64 4, i64 %3)
  %7 = bitcast i8* %6 to %struct.nish_array*
  call void @nish_arena_release(i64 %3)
  %8 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 3
  store %struct.nish_array* %7, %struct.nish_array** %8
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 3
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = bitcast %struct.nish_array* %6 to i8*
  %8 = call i8* @nish_cross_in(i8* %7, i64 4)
  %9 = bitcast i8* %8 to %struct.nish_array*
  call void @nish.storeResult$arr.i32(%struct.nish_array* %2, i32 %4, %struct.nish_array* %9)
  ret void
}

define void @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call %struct.nish_array* @squares$(i32 %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %12
  %13 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares$run, void (i8*)* @nish.ThreadScope.spawn$i32$arr.i32$fn.7.squares$finish, i8* %15, i64 ptrtoint ({ i32, %struct.nish_array*, i32, %struct.nish_array* }* getelementptr ({ i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$arr.f64$fn.6.halves$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call %struct.nish_array* @halves$(i32 %2)
  %5 = bitcast %struct.nish_array* %4 to i8*
  %6 = call i8* @nish_cross_out(i8* %5, i64 8, i64 %3)
  %7 = bitcast i8* %6 to %struct.nish_array*
  call void @nish_arena_release(i64 %3)
  %8 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 3
  store %struct.nish_array* %7, %struct.nish_array** %8
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$arr.f64$fn.6.halves$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 3
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = bitcast %struct.nish_array* %6 to i8*
  %8 = call i8* @nish_cross_in(i8* %7, i64 8)
  %9 = bitcast i8* %8 to %struct.nish_array*
  call void @nish.storeResult$arr.f64(%struct.nish_array* %2, i32 %4, %struct.nish_array* %9)
  ret void
}

define void @nish.ThreadScope.spawn$i32$arr.f64$fn.6.halves(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call %struct.nish_array* @halves$(i32 %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %12
  %13 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$i32$arr.f64$fn.6.halves$run, void (i8*)* @nish.ThreadScope.spawn$i32$arr.f64$fn.6.halves$finish, i8* %15, i64 ptrtoint ({ i32, %struct.nish_array*, i32, %struct.nish_array* }* getelementptr ({ i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$arr.bool$fn.5.evens$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i64 @nish_arena_mark()
  %4 = call %struct.nish_array* @evens$(i32 %2)
  %5 = bitcast %struct.nish_array* %4 to i8*
  %6 = call i8* @nish_cross_out(i8* %5, i64 1, i64 %3)
  %7 = bitcast i8* %6 to %struct.nish_array*
  call void @nish_arena_release(i64 %3)
  %8 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 3
  store %struct.nish_array* %7, %struct.nish_array** %8
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$arr.bool$fn.5.evens$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, %struct.nish_array* }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %0, i32 0, i32 3
  %6 = load %struct.nish_array*, %struct.nish_array** %5
  %7 = bitcast %struct.nish_array* %6 to i8*
  %8 = call i8* @nish_cross_in(i8* %7, i64 1)
  %9 = bitcast i8* %8 to %struct.nish_array*
  call void @nish.storeResult$arr.bool(%struct.nish_array* %2, i32 %4, %struct.nish_array* %9)
  ret void
}

define void @nish.ThreadScope.spawn$i32$arr.bool$fn.5.evens(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, %struct.nish_array* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call %struct.nish_array* @evens$(i32 %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %12
  %13 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { i32, %struct.nish_array*, i32, %struct.nish_array* }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$i32$arr.bool$fn.5.evens$run, void (i8*)* @nish.ThreadScope.spawn$i32$arr.bool$fn.5.evens$finish, i8* %15, i64 ptrtoint ({ i32, %struct.nish_array*, i32, %struct.nish_array* }* getelementptr ({ i32, %struct.nish_array*, i32, %struct.nish_array* }, { i32, %struct.nish_array*, i32, %struct.nish_array* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$i32$fn.5.first$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 0
  %2 = load i32, i32* %1
  %3 = call i32 @first$(i32 %2)
  %4 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  store i32 %3, i32* %4
  ret void
}

define internal void @nish.ThreadScope.spawn$i32$i32$fn.5.first$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { i32, %struct.nish_array*, i32, i32 }*
  %1 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %0, i32 0, i32 3
  %6 = load i32, i32* %5
  call void @nish.storeResult$i32(%struct.nish_array* %2, i32 %4, i32 %6)
  ret void
}

define void @nish.ThreadScope.spawn$i32$i32$fn.5.first(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { i32, %struct.nish_array*, i32, i32 }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i32 @first$(i32 %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 0
  store i32 %arg, i32* %12
  %13 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { i32, %struct.nish_array*, i32, i32 }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$i32$i32$fn.5.first$run, void (i8*)* @nish.ThreadScope.spawn$i32$i32$fn.5.first$finish, i8* %15, i64 ptrtoint ({ i32, %struct.nish_array*, i32, i32 }* getelementptr ({ i32, %struct.nish_array*, i32, i32 }, { i32, %struct.nish_array*, i32, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawn$$Job$str$fn.6.record$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Job*, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 0
  %2 = load %struct.Job*, %struct.Job** %1
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @record$(%struct.Job* %2)
  %5 = call i8* @nish_cross_out(i8* %4, i64 0, i64 %3)
  call void @nish_arena_release(i64 %3)
  %6 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  store i8* %5, i8** %6
  ret void
}

define internal void @nish.ThreadScope.spawn$$Job$str$fn.6.record$finish(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Job*, %struct.nish_array*, i32, i8* }*
  %1 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 2
  %4 = load i32, i32* %3
  %5 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %0, i32 0, i32 3
  %6 = load i8*, i8** %5
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  call void @nish.storeResult$str(%struct.nish_array* %2, i32 %4, i8* %7)
  ret void
}

define void @nish.ThreadScope.spawn$$Job$str$fn.6.record(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Job* noundef nonnull align 8 dereferenceable(16) %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst, i32 noundef %at) #1 {
entry:
  %task.payload = alloca { %struct.Job*, %struct.nish_array*, i32, i8* }, align 8
  %0 = call i1 @nish.slotWritten(i32 %at)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @record$(%struct.Job* %arg)
  ret void

if.end:
  %3 = icmp slt i32 %at, 0
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %6 = trunc i64 %5 to i32
  %7 = icmp sge i32 %at, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %if.end ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %11 = trunc i64 %10 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %11)
  br label %if.end.1

if.end.1:
  %12 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 0
  store %struct.Job* %arg, %struct.Job** %12
  %13 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %13
  %14 = getelementptr inbounds { %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* %task.payload, i32 0, i32 2
  store i32 %at, i32* %14
  %15 = bitcast { %struct.Job*, %struct.nish_array*, i32, i8* }* %task.payload to i8*
  %16 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %16, void (i8*)* @nish.ThreadScope.spawn$$Job$str$fn.6.record$run, void (i8*)* @nish.ThreadScope.spawn$$Job$str$fn.6.record$finish, i8* %15, i64 ptrtoint ({ %struct.Job*, %struct.nish_array*, i32, i8* }* getelementptr ({ %struct.Job*, %struct.nish_array*, i32, i8* }, { %struct.Job*, %struct.nish_array*, i32, i8* }* null, i32 1) to i64))
  ret void
}

define internal void @nish.runTask$i32$str$fn.5.label(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @label$(i32 %arg)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %2)
  ret void
}

define internal void @nish.runTask$i32$str$fn.6.nameOf(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i8* @nameOf$(i32 %arg)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %0)
  ret void
}

define internal void @nish.runTask$$Text$str$fn.4.echo(%struct.Text* noundef nonnull readonly align 8 dereferenceable(8) nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i8* @echo$(%struct.Text* %arg)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %0)
  ret void
}

define internal void @nish.runTask$i32$str$fn.6.middle(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @middle$(i32 %arg)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %2)
  ret void
}

define internal void @nish.runTask$i32$str$fn.4.tail(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @tail$(i32 %arg)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %2)
  ret void
}

define internal void @nish.runTask$i32$arr.i32$fn.7.squares(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call %struct.nish_array* @squares$(i32 %arg)
  call void @nish.storeResult$arr.i32(%struct.nish_array* %dst, i32 %at, %struct.nish_array* %0)
  ret void
}

define internal void @nish.runTask$i32$arr.f64$fn.6.halves(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call %struct.nish_array* @halves$(i32 %arg)
  call void @nish.storeResult$arr.f64(%struct.nish_array* %dst, i32 %at, %struct.nish_array* %0)
  ret void
}

define internal void @nish.runTask$i32$arr.bool$fn.5.evens(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call %struct.nish_array* @evens$(i32 %arg)
  call void @nish.storeResult$arr.bool(%struct.nish_array* %dst, i32 %at, %struct.nish_array* %0)
  ret void
}

define internal void @nish.runTask$i32$i32$fn.5.first(i32 noundef %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i32 @first$(i32 %arg)
  call void @nish.storeResult$i32(%struct.nish_array* %dst, i32 %at, i32 %0)
  ret void
}

define internal void @nish.runTask$$Job$str$fn.6.record(%struct.Job* noundef nonnull readonly align 8 dereferenceable(16) nocapture %arg, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at) #1 {
entry:
  %0 = call i8* @record$(%struct.Job* %arg)
  call void @nish.storeResult$str(%struct.nish_array* %dst, i32 %at, i8* %0)
  ret void
}

define internal void @nish.storeResult$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, i8* noundef nonnull noalias readonly align 8 %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !19, !noalias !20, !tbaa !25
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 %6
  store i8* %r, i8** %10, align 8, !alias.scope !20, !noalias !19, !tbaa !27
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.storeResult$arr.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !19, !noalias !20, !tbaa !25
  %9 = bitcast i8* %8 to %struct.nish_array**
  %10 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %9, i64 %6
  store %struct.nish_array* %r, %struct.nish_array** %10, align 8, !alias.scope !20, !noalias !19, !tbaa !27
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.storeResult$arr.f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !19, !noalias !20, !tbaa !25
  %9 = bitcast i8* %8 to %struct.nish_array**
  %10 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %9, i64 %6
  store %struct.nish_array* %r, %struct.nish_array** %10, align 8, !alias.scope !20, !noalias !19, !tbaa !27
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.storeResult$arr.bool(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !19, !noalias !20, !tbaa !25
  %9 = bitcast i8* %8 to %struct.nish_array**
  %10 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %9, i64 %6
  store %struct.nish_array* %r, %struct.nish_array** %10, align 8, !alias.scope !20, !noalias !19, !tbaa !27
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.storeResult$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %at, i32 noundef %r) #1 {
entry:
  %0 = icmp sge i32 %at, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %at, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %at to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !19, !noalias !20, !tbaa !25
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %6
  store i32 %r, i32* %10, align 4, !alias.scope !20, !noalias !19, !tbaa !29
  br label %if.end

if.else:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  call void @nish.slotOutOfRange(i32 %at, i32 %13)
  br label %if.end

if.end:
  ret void
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!10 = !{!"ptr", !1, i64 0}
!11 = !{!"MutexGuard$$Log", !10, i64 0, !2, i64 8}
!12 = !{!11, !2, i64 8}
!13 = !{!11, !10, i64 0}
!14 = !{!"Mutex$$Log", !10, i64 0}
!15 = !{!14, !10, i64 0}
!16 = !{!"nish array"}
!17 = !{!"header", !16}
!18 = !{!"elements", !16}
!19 = !{!17}
!20 = !{!18}
!21 = !{!"header i64", !1, i64 0}
!22 = !{!"header ptr", !1, i64 0}
!23 = !{!"array header", !21, i64 0, !21, i64 8, !22, i64 16}
!24 = !{!23, !21, i64 0}
!25 = !{!23, !22, i64 16}
!26 = !{!"element ptr", !1, i64 0}
!27 = !{!26, !26, i64 0}
!28 = !{!"element i32", !1, i64 0}
!29 = !{!28, !28, i64 0}
