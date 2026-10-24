%struct.ThreadScope = type { i32 }
%struct.AtomicI32 = type { i32 }
%struct.AtomicI64 = type { i64 }
%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
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
declare void @nish_main$arrow0(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture, i32 noundef) #1
declare void @nish_main$arrow1(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture, i32 noundef) #1
declare void @nish_main$arrow2(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture, i32 noundef) #1
declare void @nish_main$arrow3(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture, i32 noundef) #1
declare noundef i32 @nish_main$arrow4(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #1
declare void @nish_scope_spawn(i8* noundef nonnull, void (i8*)* noundef nonnull, void (i8*)* noundef nonnull, i8* noundef nonnull, i64 noundef) #1
declare void @nish_mutex_wait(i32* noundef nonnull) #1
declare double @llvm.floor.f64(double) #0
declare double @llvm.ceil.f64(double) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #0

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

define void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %value) #2 {
entry:
  %0 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !12
  %1 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %this, i32 0, i32 0
  store %struct.Tally* %value, %struct.Tally** %1, align 8, !tbaa !13
  ret void
}

define void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %init) #2 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.MutexGuard$$Tally*
  call void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* %1, %struct.Tally* %init)
  %2 = getelementptr inbounds %struct.Mutex$$Tally, %struct.Mutex$$Tally* %this, i32 0, i32 0
  store %struct.MutexGuard$$Tally* %1, %struct.MutexGuard$$Tally** %2, align 8, !tbaa !15
  ret void
}

define noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Mutex$$Tally, %struct.Mutex$$Tally* %this, i32 0, i32 0
  %1 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %0, align 8, !tbaa !15
  %2 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %1, i32 0, i32 1
  %3 = cmpxchg i32* %2, i32 0, i32 1 acquire monotonic
  %4 = extractvalue { i32, i1 } %3, 1
  br i1 %4, label %lock.held, label %lock.wait

lock.wait:
  call void @nish_mutex_wait(i32* %2)
  br label %lock.held

lock.held:
  ret %struct.MutexGuard$$Tally* %1
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Mutex$$Tally*, i32 }*
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %1
  %3 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = call i64 @nish_arena_mark()
  call void @nish_main$arrow0(%struct.Mutex$$Tally* %2, i32 %4)
  call void @nish_arena_release(i64 %5)
  ret void
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0$finish(i8* noundef %p) #1 {
entry:
  ret void
}

define void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  %task.payload = alloca { %struct.Mutex$$Tally*, i32 }, align 8
  %0 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 0
  store %struct.Mutex$$Tally* %cap.0, %struct.Mutex$$Tally** %0
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 1
  store i32 %cap.1, i32* %1
  %2 = bitcast { %struct.Mutex$$Tally*, i32 }* %task.payload to i8*
  %3 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %3, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0$run, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0$finish, i8* %2, i64 ptrtoint ({ %struct.Mutex$$Tally*, i32 }* getelementptr ({ %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Mutex$$Tally*, i32 }*
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %1
  %3 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = call i64 @nish_arena_mark()
  call void @nish_main$arrow1(%struct.Mutex$$Tally* %2, i32 %4)
  call void @nish_arena_release(i64 %5)
  ret void
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1$finish(i8* noundef %p) #1 {
entry:
  ret void
}

define void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  %task.payload = alloca { %struct.Mutex$$Tally*, i32 }, align 8
  %0 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 0
  store %struct.Mutex$$Tally* %cap.0, %struct.Mutex$$Tally** %0
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 1
  store i32 %cap.1, i32* %1
  %2 = bitcast { %struct.Mutex$$Tally*, i32 }* %task.payload to i8*
  %3 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %3, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1$run, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1$finish, i8* %2, i64 ptrtoint ({ %struct.Mutex$$Tally*, i32 }* getelementptr ({ %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Mutex$$Tally*, i32 }*
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %1
  %3 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = call i64 @nish_arena_mark()
  call void @nish_main$arrow2(%struct.Mutex$$Tally* %2, i32 %4)
  call void @nish_arena_release(i64 %5)
  ret void
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2$finish(i8* noundef %p) #1 {
entry:
  ret void
}

define void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  %task.payload = alloca { %struct.Mutex$$Tally*, i32 }, align 8
  %0 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 0
  store %struct.Mutex$$Tally* %cap.0, %struct.Mutex$$Tally** %0
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 1
  store i32 %cap.1, i32* %1
  %2 = bitcast { %struct.Mutex$$Tally*, i32 }* %task.payload to i8*
  %3 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %3, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2$run, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2$finish, i8* %2, i64 ptrtoint ({ %struct.Mutex$$Tally*, i32 }* getelementptr ({ %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3$run(i8* noundef %p) #1 {
entry:
  %0 = bitcast i8* %p to { %struct.Mutex$$Tally*, i32 }*
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 0
  %2 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %1
  %3 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %0, i32 0, i32 1
  %4 = load i32, i32* %3
  %5 = call i64 @nish_arena_mark()
  call void @nish_main$arrow3(%struct.Mutex$$Tally* %2, i32 %4)
  call void @nish_arena_release(i64 %5)
  ret void
}

define internal void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3$finish(i8* noundef %p) #1 {
entry:
  ret void
}

define void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4) %this, %struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  %task.payload = alloca { %struct.Mutex$$Tally*, i32 }, align 8
  %0 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 0
  store %struct.Mutex$$Tally* %cap.0, %struct.Mutex$$Tally** %0
  %1 = getelementptr inbounds { %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* %task.payload, i32 0, i32 1
  store i32 %cap.1, i32* %1
  %2 = bitcast { %struct.Mutex$$Tally*, i32 }* %task.payload to i8*
  %3 = bitcast %struct.ThreadScope* %this to i8*
  call void @nish_scope_spawn(i8* %3, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3$run, void (i8*)* @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3$finish, i8* %2, i64 ptrtoint ({ %struct.Mutex$$Tally*, i32 }* getelementptr ({ %struct.Mutex$$Tally*, i32 }, { %struct.Mutex$$Tally*, i32 }* null, i32 1) to i64))
  ret void
}

define internal void @nish.parallelFrom$i32$fn.16.nish_main$arrow4$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #1 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = trunc i64 %lo to i32
  %4 = trunc i64 %hi to i32
  call void @nish.fromRange$i32$fn.16.nish_main$arrow4(%struct.nish_array* %2, i32 %3, i32 %4)
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow4(i32 noundef %n) #1 {
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
  store i64 %0, i64* %4, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !19, !noalias !20, !tbaa !25
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !20, !noalias !19
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  store %struct.nish_array* %3, %struct.nish_array** %dst.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %13 = trunc i64 %12 to i32
  %14 = icmp sle i32 %13, 38836
  br i1 %14, label %par.seq, label %par.region

par.seq:
  call void @nish.fromRange$i32$fn.16.nish_main$arrow4(%struct.nish_array* %9, i32 0, i32 %13)
  br label %par.done

par.region:
  %15 = getelementptr inbounds { %struct.nish_array* }, { %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %15
  %16 = bitcast { %struct.nish_array* }* %par.ctx to i8*
  %17 = sext i32 %13 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelFrom$i32$fn.16.nish_main$arrow4$chunk, i8* %16, i64 %17, i64 38836)
  br label %par.done

par.done:
  %18 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  ret %struct.nish_array* %18
}

define internal void @nish.runThunk$void$fn.16.nish_main$arrow0(%struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  call void @nish_main$arrow0(%struct.Mutex$$Tally* %cap.0, i32 %cap.1)
  ret void
}

define internal void @nish.runThunk$void$fn.16.nish_main$arrow1(%struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  call void @nish_main$arrow1(%struct.Mutex$$Tally* %cap.0, i32 %cap.1)
  ret void
}

define internal void @nish.runThunk$void$fn.16.nish_main$arrow2(%struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  call void @nish_main$arrow2(%struct.Mutex$$Tally* %cap.0, i32 %cap.1)
  ret void
}

define internal void @nish.runThunk$void$fn.16.nish_main$arrow3(%struct.Mutex$$Tally* noundef %cap.0, i32 noundef %cap.1) #1 {
entry:
  call void @nish_main$arrow3(%struct.Mutex$$Tally* %cap.0, i32 %cap.1)
  ret void
}

define internal void @nish.fromRange$i32$fn.16.nish_main$arrow4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !19, !noalias !20, !tbaa !24
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !19, !noalias !20, !tbaa !26
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
  %14 = call i32 @nish_main$arrow4(i32 %13)
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
  store i32 %20, i32* %22, align 4, !alias.scope !20, !noalias !19, !tbaa !28
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

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!29, !30, !31, !32, !33}
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
!11 = !{!"MutexGuard$$Tally", !10, i64 0, !2, i64 8}
!12 = !{!11, !2, i64 8}
!13 = !{!11, !10, i64 0}
!14 = !{!"Mutex$$Tally", !10, i64 0}
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
!25 = !{!23, !21, i64 8}
!26 = !{!23, !22, i64 16}
!27 = !{!"element i32", !1, i64 0}
!28 = !{!27, !27, i64 0}
!29 = !{i32 8, !"cf-protection-branch", i32 1}
!30 = !{i32 8, !"cf-protection-return", i32 1}
!31 = !{i32 8, !"branch-target-enforcement", i32 1}
!32 = !{i32 8, !"sign-return-address", i32 1}
!33 = !{i32 4, !"probe-stack", !"inline-asm"}
