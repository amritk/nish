%struct.Tally = type { i32 }
%struct.Rng = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" of \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish.Rng.constructor(%struct.Rng* noundef nonnull noalias align 8 dereferenceable(4) nocapture, i32 noundef) #2
declare noundef i32 @nish.Rng.nextI32(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture) #2
declare noundef double @nish.Rng.nextF64(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture) #2
declare noundef i32 @nish.Rng.nextInt(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Mutex$$Tally* noundef, i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow4(i32 noundef) #0
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #2
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

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

define internal noundef i32 @darts(i32 noundef %seed, i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.Rng*, align 8
  %Rng.obj = alloca %struct.Rng, align 8
  %hits.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %x.addr = alloca double, align 8
  %y.addr = alloca double, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj, i32 %seed)
  store %struct.Rng* %Rng.obj, %struct.Rng** %r.addr, align 8
  store i32 0, i32* %hits.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %3 = call double @nish.Rng.nextF64(%struct.Rng* %2)
  store double %3, double* %x.addr, align 8
  %4 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %5 = call double @nish.Rng.nextF64(%struct.Rng* %4)
  store double %5, double* %y.addr, align 8
  %6 = load double, double* %x.addr, align 8
  %7 = load double, double* %x.addr, align 8
  %8 = fmul double %6, %7
  %9 = load double, double* %y.addr, align 8
  %10 = load double, double* %y.addr, align 8
  %11 = fmul double %9, %10
  %12 = fadd double %8, %11
  %13 = fcmp olt double %12, 0x3FF0000000000000
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = load i32, i32* %hits.addr, align 4
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %hits.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = load i32, i32* %hits.addr, align 4
  ret i32 %20

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @throwInto(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %seed, i32 noundef %n) #0 {
entry:
  %hits.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %0 = call i32 @darts(i32 %seed, i32 %n)
  store i32 %0, i32* %hits.addr, align 4
  %1 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %tally)
  store %struct.MutexGuard$$Tally* %1, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %2, i32 0, i32 1
  %4 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %5 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %4, i32 0, i32 0
  %6 = load %struct.Tally*, %struct.Tally** %5, align 8, !tbaa !5
  %7 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %7, i32 0, i32 0
  %9 = load %struct.Tally*, %struct.Tally** %8, align 8, !tbaa !5
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !7
  %12 = load i32, i32* %hits.addr, align 4
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = getelementptr inbounds %struct.Tally, %struct.Tally* %6, i32 0, i32 0
  store i32 %14, i32* %16, align 4, !tbaa !7
  store atomic i32 0, i32* %3 release, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @inBounds(%struct.Rng* noundef nonnull align 8 dereferenceable(4) nocapture %r, i32 noundef %lo, i32 noundef %hi, i32 noundef %n) #0 {
entry:
  %ok.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  store i1 true, i1* %ok.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call i32 @nish.Rng.nextInt(%struct.Rng* %r, i32 %lo, i32 %hi)
  store i32 %2, i32* %x.addr, align 4
  %3 = load i32, i32* %x.addr, align 4
  %4 = icmp slt i32 %3, %lo
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = load i32, i32* %x.addr, align 4
  %6 = icmp sgt i32 %5, %hi
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %for.body ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  store i1 false, i1* %ok.addr, align 1
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i1, i1* %ok.addr, align 1
  ret i1 %10
}

define internal noundef zeroext i1 @even(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %counts, i32 noundef %want, i32 noundef %slack) #1 {
entry:
  %ok.addr = alloca i1, align 1
  %c.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i1 true, i1* %ok.addr, align 1
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %counts, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %counts, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  store i32 %8, i32* %c.addr, align 4
  %9 = load i32, i32* %c.addr, align 4
  %10 = sub nsw i32 %want, %slack
  %11 = icmp slt i32 %9, %10
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load i32, i32* %c.addr, align 4
  %13 = add nsw i32 %want, %slack
  %14 = icmp sgt i32 %12, %13
  br label %lor.end

lor.end:
  %15 = phi i1 [ true, %forof.body ], [ %14, %lor.rhs ]
  br i1 %15, label %if.then, label %if.end

if.then:
  store i1 false, i1* %ok.addr, align 1
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %16 = load i64, i64* %forof.idx, align 8
  %17 = add i64 %16, 1
  store i64 %17, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %18 = load i1, i1* %ok.addr, align 1
  ret i1 %18
}

define internal void @ranges() #0 {
entry:
  %d.addr = alloca %struct.Rng*, align 8
  %Rng.obj = alloca %struct.Rng, align 8
  %dice.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %one.addr = alloca %struct.Rng*, align 8
  %Rng.obj.1 = alloca %struct.Rng, align 8
  %twin.addr = alloca %struct.Rng*, align 8
  %Rng.obj.2 = alloca %struct.Rng, align 8
  %five.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %whole.addr = alloca %struct.Rng*, align 8
  %Rng.obj.3 = alloca %struct.Rng, align 8
  %whole2.addr = alloca %struct.Rng*, align 8
  %Rng.obj.4 = alloca %struct.Rng, align 8
  %same.addr = alloca i1, align 1
  %i.addr.1 = alloca i32, align 4
  %r.addr = alloca %struct.Rng*, align 8
  %Rng.obj.5 = alloca %struct.Rng, align 8
  %faces.addr = alloca %struct.Rng*, align 8
  %Rng.obj.6 = alloca %struct.Rng, align 8
  %counts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i32], align 8
  %i.addr.2 = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %wide.addr = alloca %struct.Rng*, align 8
  %Rng.obj.7 = alloca %struct.Rng, align 8
  %thirds.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %i.addr.3 = alloca i32, align 4
  %x.addr = alloca i32, align 4
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj, i32 42)
  store %struct.Rng* %Rng.obj, %struct.Rng** %d.addr, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dice.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 20
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %dice.addr, align 8
  %6 = load %struct.Rng*, %struct.Rng** %d.addr, align 8
  %7 = call i32 @nish.Rng.nextInt(%struct.Rng* %6, i32 1, i32 6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  store i8* %8, i8** %17, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.1, i32 9)
  store %struct.Rng* %Rng.obj.1, %struct.Rng** %one.addr, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.2, i32 9)
  store %struct.Rng* %Rng.obj.2, %struct.Rng** %twin.addr, align 8
  %22 = load %struct.Rng*, %struct.Rng** %one.addr, align 8
  %23 = call i32 @nish.Rng.nextInt(%struct.Rng* %22, i32 5, i32 5)
  store i32 %23, i32* %five.addr, align 4
  %24 = load %struct.Rng*, %struct.Rng** %twin.addr, align 8
  %25 = call i32 @nish.Rng.nextI32(%struct.Rng* %24)
  %26 = load %struct.nish_array*, %struct.nish_array** %dice.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %29 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %30 = load i64, i64* %29, align 8
  %31 = sub i64 %28, 1
  %32 = mul i64 %30, %31
  %33 = icmp eq i64 %28, 0
  %34 = select i1 %33, i64 0, i64 %32
  store i64 %34, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %35 = load i64, i64* %join.at, align 8
  %36 = icmp ult i64 %35, %28
  br i1 %36, label %join.sum.body, label %join.copy

join.sum.body:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %39 = bitcast i8* %38 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %35
  %41 = load i8*, i8** %40, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %42 = load i64, i64* %join.total, align 8
  %43 = bitcast i8* %41 to i64*
  %44 = load i64, i64* %43, align 8
  %45 = add i64 %42, %44
  store i64 %45, i64* %join.total, align 8
  %46 = add i64 %35, 1
  store i64 %46, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %47 = load i64, i64* %join.total, align 8
  %48 = icmp ugt i64 %47, 2147483647
  %49 = add i64 %47, 9
  %50 = select i1 %48, i64 4611686018427387904, i64 %49
  %51 = call i8* @nish_alloc_struct(i64 %50)
  %52 = bitcast i8* %51 to i64*
  store i64 %47, i64* %52, align 8
  %53 = getelementptr inbounds i8, i8* %51, i64 8
  store i8* %53, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %54 = load i64, i64* %join.at, align 8
  %55 = icmp ult i64 %54, %28
  br i1 %55, label %join.part, label %join.end

join.part:
  %56 = load i8*, i8** %join.p, align 8
  %57 = icmp eq i64 %54, 0
  %58 = select i1 %57, i64 0, i64 %30
  %59 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %56, i8* %59, i64 %58, i1 false)
  %60 = getelementptr inbounds i8, i8* %56, i64 %58
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %54
  %65 = load i8*, i8** %64, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %66 = bitcast i8* %65 to i64*
  %67 = load i64, i64* %66, align 8
  %68 = getelementptr inbounds i8, i8* %65, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %60, i8* %68, i64 %67, i1 false)
  %69 = getelementptr inbounds i8, i8* %60, i64 %67
  store i8* %69, i8** %join.p, align 8
  %70 = add i64 %54, 1
  store i64 %70, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %71 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %71, align 1
  %72 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %73 = load i32, i32* %five.addr, align 4
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %72, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %77 = load %struct.Rng*, %struct.Rng** %one.addr, align 8
  %78 = call i32 @nish.Rng.nextI32(%struct.Rng* %77)
  %79 = load %struct.Rng*, %struct.Rng** %twin.addr, align 8
  %80 = call i32 @nish.Rng.nextI32(%struct.Rng* %79)
  %81 = icmp eq i32 %78, %80
  %82 = select i1 %81, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %83 = call i8* @nish_str_concat(i8* %76, i8* %82)
  call void @nish_print(i8* %83)
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.3, i32 3)
  store %struct.Rng* %Rng.obj.3, %struct.Rng** %whole.addr, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.4, i32 3)
  store %struct.Rng* %Rng.obj.4, %struct.Rng** %whole2.addr, align 8
  store i1 true, i1* %same.addr, align 1
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %84 = load i32, i32* %i.addr.1, align 4
  %85 = icmp slt i32 %84, 1000
  br i1 %85, label %for.body.1, label %for.end.1

for.body.1:
  %86 = load %struct.Rng*, %struct.Rng** %whole.addr, align 8
  %87 = call i32 @nish.Rng.nextInt(%struct.Rng* %86, i32 -2147483648, i32 2147483647)
  %88 = load %struct.Rng*, %struct.Rng** %whole2.addr, align 8
  %89 = call i32 @nish.Rng.nextI32(%struct.Rng* %88)
  %90 = icmp ne i32 %87, %89
  br i1 %90, label %if.then, label %if.end

if.then:
  store i1 false, i1* %same.addr, align 1
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %91 = load i32, i32* %i.addr.1, align 4
  %92 = add nsw i32 %91, 1
  store i32 %92, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.5, i32 5)
  store %struct.Rng* %Rng.obj.5, %struct.Rng** %r.addr, align 8
  %93 = load i1, i1* %same.addr, align 1
  %94 = select i1 %93, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %96 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %97 = call i1 @inBounds(%struct.Rng* %96, i32 -3, i32 3, i32 1000)
  %98 = select i1 %97, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %99 = call i8* @nish_str_concat(i8* %95, i8* %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %101 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %102 = call i1 @inBounds(%struct.Rng* %101, i32 0, i32 2147483647, i32 1000)
  %103 = select i1 %102, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %104 = call i8* @nish_str_concat(i8* %100, i8* %103)
  %105 = call i8* @nish_str_concat(i8* %104, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %106 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %107 = call i1 @inBounds(%struct.Rng* %106, i32 -2147483648, i32 0, i32 1000)
  %108 = select i1 %107, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %109 = call i8* @nish_str_concat(i8* %105, i8* %108)
  %110 = call i8* @nish_str_concat(i8* %109, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %111 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %112 = call i1 @inBounds(%struct.Rng* %111, i32 7, i32 8, i32 1000)
  %113 = select i1 %112, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %114 = call i8* @nish_str_concat(i8* %110, i8* %113)
  call void @nish_print(i8* %114)
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.6, i32 11)
  store %struct.Rng* %Rng.obj.6, %struct.Rng** %faces.addr, align 8
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 6, i64* %115, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 6, i64* %116, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %117 = bitcast [6 x i32]* %arr.data to i8*
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %117, i8** %118, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %119 = bitcast i8* %117 to i32*
  %120 = getelementptr inbounds i32, i32* %119, i64 0
  store i32 0, i32* %120, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %121 = getelementptr inbounds i32, i32* %119, i64 1
  store i32 0, i32* %121, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %122 = getelementptr inbounds i32, i32* %119, i64 2
  store i32 0, i32* %122, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %123 = getelementptr inbounds i32, i32* %119, i64 3
  store i32 0, i32* %123, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %124 = getelementptr inbounds i32, i32* %119, i64 4
  store i32 0, i32* %124, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %125 = getelementptr inbounds i32, i32* %119, i64 5
  store i32 0, i32* %125, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %counts.addr, align 8
  store i32 0, i32* %i.addr.2, align 4
  %126 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 0
  %128 = load i64, i64* %127, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  br label %for.cond.2

for.cond.2:
  %131 = load i32, i32* %i.addr.2, align 4
  %132 = icmp slt i32 %131, 60000
  br i1 %132, label %for.body.2, label %for.end.2

for.body.2:
  %133 = load %struct.Rng*, %struct.Rng** %faces.addr, align 8
  %134 = call i32 @nish.Rng.nextInt(%struct.Rng* %133, i32 0, i32 5)
  store i32 %134, i32* %k.addr, align 4
  %135 = load i32, i32* %k.addr, align 4
  %136 = icmp sge i32 %135, 0
  br i1 %136, label %land.rhs, label %land.end

land.rhs:
  %137 = load i32, i32* %k.addr, align 4
  %138 = trunc i64 %128 to i32
  %139 = icmp slt i32 %137, %138
  br label %land.end

land.end:
  %140 = phi i1 [ false, %for.body.2 ], [ %139, %land.rhs ]
  br i1 %140, label %if.then.1, label %if.end.1

if.then.1:
  %141 = load i32, i32* %k.addr, align 4
  %142 = sext i32 %141 to i64
  %143 = load i32, i32* %k.addr, align 4
  %144 = sext i32 %143 to i64
  %145 = bitcast i8* %130 to i32*
  %146 = getelementptr inbounds i32, i32* %145, i64 %144
  %147 = load i32, i32* %146, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %148 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %147, i32 1)
  %149 = extractvalue { i32, i1 } %148, 0
  %150 = extractvalue { i32, i1 } %148, 1
  br i1 %150, label %ovf.fail, label %ovf.ok

ovf.ok:
  %151 = bitcast i8* %130 to i32*
  %152 = getelementptr inbounds i32, i32* %151, i64 %142
  store i32 %149, i32* %152, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  br label %if.end.1

if.end.1:
  br label %for.inc.2

for.inc.2:
  %153 = load i32, i32* %i.addr.2, align 4
  %154 = add nsw i32 %153, 1
  store i32 %154, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %155 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 2
  %157 = load i8*, i8** %156, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %158 = bitcast i8* %157 to i32*
  %159 = getelementptr inbounds i32, i32* %158, i64 0
  %160 = load i32, i32* %159, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %161 = call i8* @nish_str_from_i32(i32 %160)
  %162 = call i8* @nish_str_concat(i8* %161, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %163 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 2
  %165 = load i8*, i8** %164, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %166 = bitcast i8* %165 to i32*
  %167 = getelementptr inbounds i32, i32* %166, i64 1
  %168 = load i32, i32* %167, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %169 = call i8* @nish_str_from_i32(i32 %168)
  %170 = call i8* @nish_str_concat(i8* %162, i8* %169)
  %171 = call i8* @nish_str_concat(i8* %170, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %172 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 2
  %174 = load i8*, i8** %173, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %175 = bitcast i8* %174 to i32*
  %176 = getelementptr inbounds i32, i32* %175, i64 2
  %177 = load i32, i32* %176, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %178 = call i8* @nish_str_from_i32(i32 %177)
  %179 = call i8* @nish_str_concat(i8* %171, i8* %178)
  %180 = call i8* @nish_str_concat(i8* %179, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %181 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %181, i64 0, i32 2
  %183 = load i8*, i8** %182, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %184 = bitcast i8* %183 to i32*
  %185 = getelementptr inbounds i32, i32* %184, i64 3
  %186 = load i32, i32* %185, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %187 = call i8* @nish_str_from_i32(i32 %186)
  %188 = call i8* @nish_str_concat(i8* %180, i8* %187)
  %189 = call i8* @nish_str_concat(i8* %188, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %190 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 2
  %192 = load i8*, i8** %191, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %193 = bitcast i8* %192 to i32*
  %194 = getelementptr inbounds i32, i32* %193, i64 4
  %195 = load i32, i32* %194, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %196 = call i8* @nish_str_from_i32(i32 %195)
  %197 = call i8* @nish_str_concat(i8* %189, i8* %196)
  %198 = call i8* @nish_str_concat(i8* %197, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %199 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %199, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %202 = bitcast i8* %201 to i32*
  %203 = getelementptr inbounds i32, i32* %202, i64 5
  %204 = load i32, i32* %203, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %205 = call i8* @nish_str_from_i32(i32 %204)
  %206 = call i8* @nish_str_concat(i8* %198, i8* %205)
  %207 = call i8* @nish_str_concat(i8* %206, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %208 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %209 = call i1 @even(%struct.nish_array* %208, i32 10000, i32 400)
  %210 = select i1 %209, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %211 = call i8* @nish_str_concat(i8* %207, i8* %210)
  call void @nish_print(i8* %211)
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.7, i32 13)
  store %struct.Rng* %Rng.obj.7, %struct.Rng** %wide.addr, align 8
  %212 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %212, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %213, align 8, !alias.scope !11, !noalias !12, !tbaa !20
  %214 = bitcast [3 x i32]* %arr.data.1 to i8*
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %214, i8** %215, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %216 = bitcast i8* %214 to i32*
  %217 = getelementptr inbounds i32, i32* %216, i64 0
  store i32 0, i32* %217, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %218 = getelementptr inbounds i32, i32* %216, i64 1
  store i32 0, i32* %218, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %219 = getelementptr inbounds i32, i32* %216, i64 2
  store i32 0, i32* %219, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %thirds.addr, align 8
  store i32 0, i32* %i.addr.3, align 4
  %220 = load %struct.nish_array*, %struct.nish_array** %thirds.addr, align 8
  %221 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 2
  %222 = load i8*, i8** %221, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  br label %for.cond.3

for.cond.3:
  %223 = load i32, i32* %i.addr.3, align 4
  %224 = icmp slt i32 %223, 30000
  br i1 %224, label %for.body.3, label %for.end.3

for.body.3:
  %225 = load %struct.Rng*, %struct.Rng** %wide.addr, align 8
  %226 = call i32 @nish.Rng.nextInt(%struct.Rng* %225, i32 -2147483648, i32 1073741823)
  store i32 %226, i32* %x.addr, align 4
  %227 = load i32, i32* %x.addr, align 4
  %228 = icmp slt i32 %227, -1073741824
  br i1 %228, label %if.then.2, label %if.else

if.then.2:
  %229 = bitcast i8* %222 to i32*
  %230 = getelementptr inbounds i32, i32* %229, i64 0
  %231 = load i32, i32* %230, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %232 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %231, i32 1)
  %233 = extractvalue { i32, i1 } %232, 0
  %234 = extractvalue { i32, i1 } %232, 1
  br i1 %234, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %235 = bitcast i8* %222 to i32*
  %236 = getelementptr inbounds i32, i32* %235, i64 0
  store i32 %233, i32* %236, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  br label %if.end.2

if.else:
  %237 = load i32, i32* %x.addr, align 4
  %238 = icmp slt i32 %237, 0
  br i1 %238, label %if.then.3, label %if.else.1

if.then.3:
  %239 = bitcast i8* %222 to i32*
  %240 = getelementptr inbounds i32, i32* %239, i64 1
  %241 = load i32, i32* %240, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %242 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %241, i32 1)
  %243 = extractvalue { i32, i1 } %242, 0
  %244 = extractvalue { i32, i1 } %242, 1
  br i1 %244, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %245 = bitcast i8* %222 to i32*
  %246 = getelementptr inbounds i32, i32* %245, i64 1
  store i32 %243, i32* %246, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  br label %if.end.3

if.else.1:
  %247 = bitcast i8* %222 to i32*
  %248 = getelementptr inbounds i32, i32* %247, i64 2
  %249 = load i32, i32* %248, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %250 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %249, i32 1)
  %251 = extractvalue { i32, i1 } %250, 0
  %252 = extractvalue { i32, i1 } %250, 1
  br i1 %252, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %253 = bitcast i8* %222 to i32*
  %254 = getelementptr inbounds i32, i32* %253, i64 2
  store i32 %251, i32* %254, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.end.2:
  br label %for.inc.3

for.inc.3:
  %255 = load i32, i32* %i.addr.3, align 4
  %256 = add nsw i32 %255, 1
  store i32 %256, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  %257 = load %struct.nish_array*, %struct.nish_array** %thirds.addr, align 8
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %257, i64 0, i32 2
  %259 = load i8*, i8** %258, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %260 = bitcast i8* %259 to i32*
  %261 = getelementptr inbounds i32, i32* %260, i64 0
  %262 = load i32, i32* %261, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %263 = call i8* @nish_str_from_i32(i32 %262)
  %264 = call i8* @nish_str_concat(i8* %263, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %265 = load %struct.nish_array*, %struct.nish_array** %thirds.addr, align 8
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %265, i64 0, i32 2
  %267 = load i8*, i8** %266, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %268 = bitcast i8* %267 to i32*
  %269 = getelementptr inbounds i32, i32* %268, i64 1
  %270 = load i32, i32* %269, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %271 = call i8* @nish_str_from_i32(i32 %270)
  %272 = call i8* @nish_str_concat(i8* %264, i8* %271)
  %273 = call i8* @nish_str_concat(i8* %272, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %274 = load %struct.nish_array*, %struct.nish_array** %thirds.addr, align 8
  %275 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %274, i64 0, i32 2
  %276 = load i8*, i8** %275, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %277 = bitcast i8* %276 to i32*
  %278 = getelementptr inbounds i32, i32* %277, i64 2
  %279 = load i32, i32* %278, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %280 = call i8* @nish_str_from_i32(i32 %279)
  %281 = call i8* @nish_str_concat(i8* %273, i8* %280)
  %282 = call i8* @nish_str_concat(i8* %281, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %283 = load %struct.nish_array*, %struct.nish_array** %thirds.addr, align 8
  %284 = call i1 @even(%struct.nish_array* %283, i32 10000, i32 400)
  %285 = select i1 %284, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %286 = call i8* @nish_str_concat(i8* %282, i8* %285)
  call void @nish_print(i8* %286)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %r.addr = alloca %struct.Rng*, align 8
  %Rng.obj = alloca %struct.Rng, align 8
  %z.addr = alloca %struct.Rng*, align 8
  %Rng.obj.1 = alloca %struct.Rng, align 8
  %a.addr = alloca %struct.Rng*, align 8
  %Rng.obj.2 = alloca %struct.Rng, align 8
  %b.addr = alloca %struct.Rng*, align 8
  %Rng.obj.3 = alloca %struct.Rng, align 8
  %tally.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %n.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %draws.addr = alloca %struct.nish_array*, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj, i32 42)
  store %struct.Rng* %Rng.obj, %struct.Rng** %r.addr, align 8
  %0 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %1 = call i32 @nish.Rng.nextI32(%struct.Rng* %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %4 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %5 = call i32 @nish.Rng.nextI32(%struct.Rng* %4)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %9 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %10 = call i32 @nish.Rng.nextI32(%struct.Rng* %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %14 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %15 = call double @nish.Rng.nextF64(%struct.Rng* %14)
  %16 = call i8* @nish_str_from_f64(double %15)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  call void @nish_print(i8* %17)
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.1, i32 0)
  store %struct.Rng* %Rng.obj.1, %struct.Rng** %z.addr, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.2, i32 -7)
  store %struct.Rng* %Rng.obj.2, %struct.Rng** %a.addr, align 8
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj.3, i32 -7)
  store %struct.Rng* %Rng.obj.3, %struct.Rng** %b.addr, align 8
  %18 = load %struct.Rng*, %struct.Rng** %z.addr, align 8
  %19 = call i32 @nish.Rng.nextI32(%struct.Rng* %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %22 = load %struct.Rng*, %struct.Rng** %a.addr, align 8
  %23 = call i32 @nish.Rng.nextI32(%struct.Rng* %22)
  %24 = load %struct.Rng*, %struct.Rng** %b.addr, align 8
  %25 = call i32 @nish.Rng.nextI32(%struct.Rng* %24)
  %26 = icmp eq i32 %23, %25
  %27 = select i1 %26, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %28 = call i8* @nish_str_concat(i8* %21, i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %30 = load %struct.Rng*, %struct.Rng** %r.addr, align 8
  %31 = call i32 @nish.Rng.nextI32(%struct.Rng* %30)
  %32 = lshr i32 %31, 1
  %33 = srem i32 %32, 6
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %29, i8* %34)
  call void @nish_print(i8* %35)
  %36 = call i8* @nish_alloc_struct(i64 4)
  %37 = bitcast i8* %36 to %struct.Tally*
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %37, i32 0, i32 0
  store i32 0, i32* %38, align 4, !tbaa !7
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %37)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %tally.addr, align 8
  store i32 2000, i32* %n.addr, align 4
  %39 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %39, %struct.ThreadScope** %s.addr, align 8
  %40 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %41 = bitcast %struct.ThreadScope* %40 to i8*
  %42 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %43 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %44 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow0(%struct.ThreadScope* %42, %struct.Mutex$$Tally* %43, i32 %44)
  %45 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %46 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %47 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow1(%struct.ThreadScope* %45, %struct.Mutex$$Tally* %46, i32 %47)
  %48 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %49 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %50 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow2(%struct.ThreadScope* %48, %struct.Mutex$$Tally* %49, i32 %50)
  %51 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %52 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %53 = load i32, i32* %n.addr, align 4
  call void @nish.ThreadScope.spawnThunk$void$fn.16.nish_main$arrow3(%struct.ThreadScope* %51, %struct.Mutex$$Tally* %52, i32 %53)
  call void @nish_scope_join(i8* %41)
  %54 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow4(i32 6)
  store %struct.nish_array* %54, %struct.nish_array** %draws.addr, align 8
  %55 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %tally.addr, align 8
  %56 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %55)
  store %struct.MutexGuard$$Tally* %56, %struct.MutexGuard$$Tally** %g.addr, align 8
  %57 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %58 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %57, i32 0, i32 1
  %59 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %60 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %59, i32 0, i32 0
  %61 = load %struct.Tally*, %struct.Tally** %60, align 8, !tbaa !5
  %62 = getelementptr inbounds %struct.Tally, %struct.Tally* %61, i32 0, i32 0
  %63 = load i32, i32* %62, align 4, !tbaa !7
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*))
  %66 = load i32, i32* %n.addr, align 4
  %67 = mul nsw i32 4, %66
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %65, i8* %68)
  call void @nish_print(i8* %69)
  %70 = load %struct.nish_array*, %struct.nish_array** %draws.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %73 = icmp ult i64 0, %72
  br i1 %73, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %72)
  unreachable

bounds.ok:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 0
  %78 = load i32, i32* %77, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %81 = load %struct.nish_array*, %struct.nish_array** %draws.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %84 = icmp ult i64 1, %83
  br i1 %84, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %83)
  unreachable

bounds.ok.1:
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %87 = bitcast i8* %86 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 1
  %89 = load i32, i32* %88, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %90 = call i8* @nish_str_from_i32(i32 %89)
  %91 = call i8* @nish_str_concat(i8* %80, i8* %90)
  %92 = call i8* @nish_str_concat(i8* %91, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %93 = load %struct.nish_array*, %struct.nish_array** %draws.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %96 = icmp ult i64 5, %95
  br i1 %96, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 5, i64 %95)
  unreachable

bounds.ok.2:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %99 = bitcast i8* %98 to i32*
  %100 = getelementptr inbounds i32, i32* %99, i64 5
  %101 = load i32, i32* %100, align 4, !alias.scope !12, !noalias !11, !tbaa !19
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %92, i8* %102)
  call void @nish_print(i8* %103)
  call void @ranges()
  store atomic i32 0, i32* %58 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden void @nish_main$arrow0(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 1, i32 %n)
  ret void
}

define hidden void @nish_main$arrow1(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 2, i32 %n)
  ret void
}

define hidden void @nish_main$arrow2(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 3, i32 %n)
  ret void
}

define hidden void @nish_main$arrow3(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tally, i32 noundef %n) #0 {
entry:
  call void @throwInto(%struct.Mutex$$Tally* %tally, i32 4, i32 %n)
  ret void
}

define hidden noundef i32 @nish_main$arrow4(i32 noundef %i) #0 {
entry:
  %own.addr = alloca %struct.Rng*, align 8
  %Rng.obj = alloca %struct.Rng, align 8
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish.Rng.constructor(%struct.Rng* %Rng.obj, i32 %1)
  store %struct.Rng* %Rng.obj, %struct.Rng** %own.addr, align 8
  %3 = load %struct.Rng*, %struct.Rng** %own.addr, align 8
  %4 = call i32 @nish.Rng.nextI32(%struct.Rng* %3)
  %5 = lshr i32 %4, 8
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"MutexGuard$$Tally", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!"Tally", !3, i64 0}
!7 = !{!6, !3, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !14, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!15, !13, i64 8}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
