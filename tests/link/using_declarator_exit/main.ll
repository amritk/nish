%struct.File = type { i8* }
%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_result.str.i32 = type { i1, i8*, i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [89 x i8] } { i64 88, [89 x i8] c"`fopen`: argument 1 (path) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"/dev/null\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"lockFirst \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"arenaFirst \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"released\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"kept\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"scopeFirst \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"three \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare i8* @fopen(i8*, i8*)
declare i32 @fclose(i8*)
declare i32 @fgetc(i8*)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_arena_used() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define internal void @File.constructor(%struct.File* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %path) #0 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %path, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [89 x i8] }* @.str.1 to i8*))
  unreachable

ffi.ok:
  %2 = getelementptr inbounds i8, i8* %path, i64 8
  %3 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  %4 = call i8* @fopen(i8* %2, i8* %3)
  %5 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 0
  store i8* %4, i8** %5, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @File.read(%struct.File* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %p.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !4
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i32 -2

if.end:
  %4 = load i8*, i8** %p.addr, align 8
  %5 = call i32 @fgetc(i8* %4)
  ret i32 %5
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.str.i32* @pathFor(i32 noundef %fail) #1 {
entry:
  %0 = icmp eq i32 %fail, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_result.str.i32*
  %3 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %2, i32 0, i32 0
  store i1 true, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %2, i32 0, i32 1
  store i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i8** %4, align 8
  br label %cond.end

cond.false:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_result.str.i32*
  %7 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %6, i32 0, i32 0
  store i1 false, i1* %7, align 1
  %8 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %6, i32 0, i32 2
  store i32 %fail, i32* %8, align 4
  br label %cond.end

cond.end:
  %9 = phi %struct.nish_result.str.i32* [ %2, %cond.true ], [ %6, %cond.false ]
  ret %struct.nish_result.str.i32* %9
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fill(i32 noundef %k) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %k
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %22
}

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 64
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = mul nsw i32 %7, 31
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %11 = load i32, i32* %i.addr, align 4
  %12 = call %struct.nish_array* @fill(i32 %11)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = trunc i64 %14 to i32
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %10, i8* %16)
  %18 = bitcast i8* %17 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = trunc i64 %19 to i32
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %22, i32* %t.addr, align 4
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %25 = load i8*, i8** %24, align 8
  %26 = icmp eq i8* %25, %3
  br i1 %26, label %pass.rewind, label %pass.free

pass.rewind:
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %27, align 8
  br label %pass.done

pass.free:
  %28 = ptrtoint i8* %3 to i64
  %29 = add i64 %28, %5
  call void @nish_arena_release(i64 %29)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %32 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %32

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal { i1, i32, i32 } @lockFirst(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m, i32 noundef %fail) #0 {
entry:
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %0, %struct.MutexGuard$$Tally** %g.addr, align 8
  %1 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %1, i32 0, i32 1
  %3 = call %struct.nish_result.str.i32* @pathFor(i32 %fail)
  %4 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 0
  %5 = load i1, i1* %4, align 1
  br i1 %5, label %res.ok, label %res.propagate

res.propagate:
  %6 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 2
  %7 = load i32, i32* %6, align 4
  %8 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %7, 2
  store atomic i32 0, i32* %2 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %8

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 1
  %10 = load i8*, i8** %9, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* %10)
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %11 = load %struct.File*, %struct.File** %f.addr, align 8
  %12 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %13 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %12, i32 0, i32 0
  %14 = load %struct.Tally*, %struct.Tally** %13, align 8, !tbaa !20
  %15 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %16 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %15, i32 0, i32 0
  %17 = load %struct.Tally*, %struct.Tally** %16, align 8, !tbaa !20
  %18 = getelementptr inbounds %struct.Tally, %struct.Tally* %17, i32 0, i32 0
  %19 = load i32, i32* %18, align 4, !tbaa !22
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 1)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = getelementptr inbounds %struct.Tally, %struct.Tally* %14, i32 0, i32 0
  store i32 %21, i32* %23, align 4, !tbaa !22
  %24 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %25 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %24, i32 0, i32 0
  %26 = load %struct.Tally*, %struct.Tally** %25, align 8, !tbaa !20
  %27 = getelementptr inbounds %struct.Tally, %struct.Tally* %26, i32 0, i32 0
  %28 = load i32, i32* %27, align 4, !tbaa !22
  %29 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %28, i32 10)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %32 = load %struct.File*, %struct.File** %f.addr, align 8
  %33 = call i32 @File.read(%struct.File* %32)
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %37 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %35, 1
  %38 = getelementptr inbounds %struct.File, %struct.File* %11, i32 0, i32 0
  %39 = load i8*, i8** %38, align 8, !tbaa !4
  %40 = icmp eq i8* %39, null
  br i1 %40, label %handle.closed, label %handle.close

handle.close:
  %41 = call i32 @fclose(i8* %39)
  br label %handle.closed

handle.closed:
  store atomic i32 0, i32* %2 release, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %37

ovf.fail:
  %ovf.op = phi i32 [ 0, %res.ok ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal { i1, i32, i32 } @arenaFirst(i32 noundef %k, i32 noundef %fail) #0 {
entry:
  %a.addr = alloca i64, align 8
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_result.str.i32* @pathFor(i32 %fail)
  %3 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %2, i32 0, i32 0
  %4 = load i1, i1* %3, align 1
  br i1 %4, label %res.ok, label %res.propagate

res.propagate:
  %5 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %2, i32 0, i32 2
  %6 = load i32, i32* %5, align 4
  %7 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %6, 2
  call void @nish_arena_release(i64 %1)
  ret { i1, i32, i32 } %7

res.ok:
  %8 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %2, i32 0, i32 1
  %9 = load i8*, i8** %8, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* %9)
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %10 = load %struct.File*, %struct.File** %f.addr, align 8
  %11 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %11, %struct.nish_array** %xs.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = trunc i64 %14 to i32
  %16 = load %struct.File*, %struct.File** %f.addr, align 8
  %17 = call i32 @File.read(%struct.File* %16)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %19, 1
  %22 = getelementptr inbounds %struct.File, %struct.File* %10, i32 0, i32 0
  %23 = load i8*, i8** %22, align 8, !tbaa !4
  %24 = icmp eq i8* %23, null
  br i1 %24, label %handle.closed, label %handle.close

handle.close:
  %25 = call i32 @fclose(i8* %23)
  br label %handle.closed

handle.closed:
  call void @nish_arena_release(i64 %1)
  ret { i1, i32, i32 } %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal { i1, i32, i32 } @scopeFirst(i32 noundef %fail) #0 {
entry:
  %s.addr = alloca %struct.ThreadScope*, align 8
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %0, %struct.ThreadScope** %s.addr, align 8
  %1 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %2 = bitcast %struct.ThreadScope* %1 to i8*
  %3 = call %struct.nish_result.str.i32* @pathFor(i32 %fail)
  %4 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 0
  %5 = load i1, i1* %4, align 1
  br i1 %5, label %res.ok, label %res.propagate

res.propagate:
  %6 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 2
  %7 = load i32, i32* %6, align 4
  %8 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %7, 2
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %8

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 1
  %10 = load i8*, i8** %9, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* %10)
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %11 = load %struct.File*, %struct.File** %f.addr, align 8
  call void @nish_scope_join(i8* %2)
  %12 = load %struct.File*, %struct.File** %f.addr, align 8
  %13 = call i32 @File.read(%struct.File* %12)
  %14 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %13, 1
  %15 = getelementptr inbounds %struct.File, %struct.File* %11, i32 0, i32 0
  %16 = load i8*, i8** %15, align 8, !tbaa !4
  %17 = icmp eq i8* %16, null
  br i1 %17, label %handle.closed, label %handle.close

handle.close:
  %18 = call i32 @fclose(i8* %16)
  br label %handle.closed

handle.closed:
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %14
}

define internal { i1, i32, i32 } @three(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m, i32 noundef %fail) #0 {
entry:
  %a.addr = alloca i64, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %2, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %4 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %3, i32 0, i32 1
  %5 = call %struct.nish_result.str.i32* @pathFor(i32 %fail)
  %6 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  br i1 %7, label %res.ok, label %res.propagate

res.propagate:
  %8 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %5, i32 0, i32 2
  %9 = load i32, i32* %8, align 4
  %10 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %9, 2
  store atomic i32 0, i32* %4 release, align 4
  call void @nish_arena_release(i64 %1)
  ret { i1, i32, i32 } %10

res.ok:
  %11 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %5, i32 0, i32 1
  %12 = load i8*, i8** %11, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* %12)
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %13 = load %struct.File*, %struct.File** %f.addr, align 8
  %14 = call %struct.nish_array* @fill(i32 50)
  store %struct.nish_array* %14, %struct.nish_array** %xs.addr, align 8
  %15 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %16 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %15, i32 0, i32 0
  %17 = load %struct.Tally*, %struct.Tally** %16, align 8, !tbaa !20
  %18 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %19 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %18, i32 0, i32 0
  %20 = load %struct.Tally*, %struct.Tally** %19, align 8, !tbaa !20
  %21 = getelementptr inbounds %struct.Tally, %struct.Tally* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4, !tbaa !22
  %23 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %26 = trunc i64 %25 to i32
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok

ovf.ok:
  %30 = getelementptr inbounds %struct.Tally, %struct.Tally* %17, i32 0, i32 0
  store i32 %28, i32* %30, align 4, !tbaa !22
  %31 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %32 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %31, i32 0, i32 0
  %33 = load %struct.Tally*, %struct.Tally** %32, align 8, !tbaa !20
  %34 = getelementptr inbounds %struct.Tally, %struct.Tally* %33, i32 0, i32 0
  %35 = load i32, i32* %34, align 4, !tbaa !22
  %36 = load %struct.File*, %struct.File** %f.addr, align 8
  %37 = call i32 @File.read(%struct.File* %36)
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %41 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %39, 1
  %42 = getelementptr inbounds %struct.File, %struct.File* %13, i32 0, i32 0
  %43 = load i8*, i8** %42, align 8, !tbaa !4
  %44 = icmp eq i8* %43, null
  br i1 %44, label %handle.closed, label %handle.close

handle.close:
  %45 = call i32 @fclose(i8* %43)
  br label %handle.closed

handle.closed:
  store atomic i32 0, i32* %4 release, align 4
  call void @nish_arena_release(i64 %1)
  ret { i1, i32, i32 } %41

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @relock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m) #0 {
entry:
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %0 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %0, %struct.MutexGuard$$Tally** %g.addr, align 8
  %1 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %1, i32 0, i32 1
  %3 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %4 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %3, i32 0, i32 0
  %5 = load %struct.Tally*, %struct.Tally** %4, align 8, !tbaa !20
  %6 = getelementptr inbounds %struct.Tally, %struct.Tally* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !22
  store atomic i32 0, i32* %2 release, align 4
  ret i32 %7
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %l1.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %l2.addr = alloca i32, align 4
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %before.addr = alloca i64, align 8
  %a1.addr = alloca i32, align 4
  %nish_result.i32.i32.obj.2 = alloca %struct.nish_result.i32.i32, align 8
  %c.addr = alloca i32, align 4
  %a2.addr = alloca i32, align 4
  %nish_result.i32.i32.obj.3 = alloca %struct.nish_result.i32.i32, align 8
  %after.addr = alloca i64, align 8
  %nish_result.i32.i32.obj.4 = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.5 = alloca %struct.nish_result.i32.i32, align 8
  %t1.addr = alloca i32, align 4
  %nish_result.i32.i32.obj.6 = alloca %struct.nish_result.i32.i32, align 8
  %t2.addr = alloca i32, align 4
  %nish_result.i32.i32.obj.7 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Tally*
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !22
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %1)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %m.addr, align 8
  %3 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %4 = call { i1, i32, i32 } @lockFirst(%struct.Mutex$$Tally* %3, i32 4)
  %5 = extractvalue { i1, i32, i32 } %4, 0
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %5, i1* %6, align 1
  %7 = extractvalue { i1, i32, i32 } %4, 1
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %7, i32* %8, align 4
  %9 = extractvalue { i1, i32, i32 } %4, 2
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %9, i32* %10, align 4
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  br i1 %12, label %res.ok, label %res.alt

res.ok:
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %15 = phi i32 [ %14, %res.ok ], [ -100, %res.alt ]
  store i32 %15, i32* %l1.addr, align 4
  %16 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %17 = call { i1, i32, i32 } @lockFirst(%struct.Mutex$$Tally* %16, i32 0)
  %18 = extractvalue { i1, i32, i32 } %17, 0
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %18, i1* %19, align 1
  %20 = extractvalue { i1, i32, i32 } %17, 1
  %21 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %20, i32* %21, align 4
  %22 = extractvalue { i1, i32, i32 } %17, 2
  %23 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %22, i32* %23, align 4
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %25 = load i1, i1* %24, align 1
  br i1 %25, label %res.ok.1, label %res.alt.1

res.ok.1:
  %26 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %27 = load i32, i32* %26, align 4
  br label %res.end.1

res.alt.1:
  br label %res.end.1

res.end.1:
  %28 = phi i32 [ %27, %res.ok.1 ], [ -100, %res.alt.1 ]
  store i32 %28, i32* %l2.addr, align 4
  %29 = load i32, i32* %l1.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.5 to i8*), i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %33 = load i32, i32* %l2.addr, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %37 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %38 = call i32 @relock(%struct.Mutex$$Tally* %37)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %36, i8* %39)
  call void @nish_print(i8* %40)
  %41 = call i64 @nish_arena_used()
  store i64 %41, i64* %before.addr, align 8
  %42 = call { i1, i32, i32 } @arenaFirst(i32 1000, i32 5)
  %43 = extractvalue { i1, i32, i32 } %42, 0
  %44 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %43, i1* %44, align 1
  %45 = extractvalue { i1, i32, i32 } %42, 1
  %46 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %45, i32* %46, align 4
  %47 = extractvalue { i1, i32, i32 } %42, 2
  %48 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %47, i32* %48, align 4
  %49 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  %50 = load i1, i1* %49, align 1
  br i1 %50, label %res.ok.2, label %res.alt.2

res.ok.2:
  %51 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  %52 = load i32, i32* %51, align 4
  br label %res.end.2

res.alt.2:
  br label %res.end.2

res.end.2:
  %53 = phi i32 [ %52, %res.ok.2 ], [ -100, %res.alt.2 ]
  store i32 %53, i32* %a1.addr, align 4
  %54 = call i32 @churn()
  store i32 %54, i32* %c.addr, align 4
  %55 = call { i1, i32, i32 } @arenaFirst(i32 1000, i32 0)
  %56 = extractvalue { i1, i32, i32 } %55, 0
  %57 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %56, i1* %57, align 1
  %58 = extractvalue { i1, i32, i32 } %55, 1
  %59 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %58, i32* %59, align 4
  %60 = extractvalue { i1, i32, i32 } %55, 2
  %61 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %60, i32* %61, align 4
  %62 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  %63 = load i1, i1* %62, align 1
  br i1 %63, label %res.ok.3, label %res.alt.3

res.ok.3:
  %64 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  %65 = load i32, i32* %64, align 4
  br label %res.end.3

res.alt.3:
  br label %res.end.3

res.end.3:
  %66 = phi i32 [ %65, %res.ok.3 ], [ -100, %res.alt.3 ]
  store i32 %66, i32* %a2.addr, align 4
  %67 = call i64 @nish_arena_used()
  store i64 %67, i64* %after.addr, align 8
  %68 = load i32, i32* %a1.addr, align 4
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.7 to i8*), i8* %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %72 = load i32, i32* %a2.addr, align 4
  %73 = call i8* @nish_str_from_i32(i32 %72)
  %74 = call i8* @nish_str_concat(i8* %71, i8* %73)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %76 = load i32, i32* %c.addr, align 4
  %77 = icmp sgt i32 %76, 0
  %78 = select i1 %77, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %79 = call i8* @nish_str_concat(i8* %75, i8* %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %81 = load i64, i64* %after.addr, align 8
  %82 = load i64, i64* %before.addr, align 8
  %83 = icmp eq i64 %81, %82
  br i1 %83, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %84 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.10 to i8*), %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.11 to i8*), %cond.false ]
  %85 = call i8* @nish_str_concat(i8* %80, i8* %84)
  call void @nish_print(i8* %85)
  %86 = call { i1, i32, i32 } @scopeFirst(i32 6)
  %87 = extractvalue { i1, i32, i32 } %86, 0
  %88 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 0
  store i1 %87, i1* %88, align 1
  %89 = extractvalue { i1, i32, i32 } %86, 1
  %90 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 1
  store i32 %89, i32* %90, align 4
  %91 = extractvalue { i1, i32, i32 } %86, 2
  %92 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 2
  store i32 %91, i32* %92, align 4
  %93 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 0
  %94 = load i1, i1* %93, align 1
  br i1 %94, label %res.ok.4, label %res.alt.4

res.ok.4:
  %95 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 1
  %96 = load i32, i32* %95, align 4
  br label %res.end.4

res.alt.4:
  br label %res.end.4

res.end.4:
  %97 = phi i32 [ %96, %res.ok.4 ], [ -100, %res.alt.4 ]
  %98 = call i8* @nish_str_from_i32(i32 %97)
  %99 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.12 to i8*), i8* %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %101 = call { i1, i32, i32 } @scopeFirst(i32 0)
  %102 = extractvalue { i1, i32, i32 } %101, 0
  %103 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 0
  store i1 %102, i1* %103, align 1
  %104 = extractvalue { i1, i32, i32 } %101, 1
  %105 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 1
  store i32 %104, i32* %105, align 4
  %106 = extractvalue { i1, i32, i32 } %101, 2
  %107 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 2
  store i32 %106, i32* %107, align 4
  %108 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 0
  %109 = load i1, i1* %108, align 1
  br i1 %109, label %res.ok.5, label %res.alt.5

res.ok.5:
  %110 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 1
  %111 = load i32, i32* %110, align 4
  br label %res.end.5

res.alt.5:
  br label %res.end.5

res.end.5:
  %112 = phi i32 [ %111, %res.ok.5 ], [ -100, %res.alt.5 ]
  %113 = call i8* @nish_str_from_i32(i32 %112)
  %114 = call i8* @nish_str_concat(i8* %100, i8* %113)
  call void @nish_print(i8* %114)
  %115 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %116 = call { i1, i32, i32 } @three(%struct.Mutex$$Tally* %115, i32 7)
  %117 = extractvalue { i1, i32, i32 } %116, 0
  %118 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 0
  store i1 %117, i1* %118, align 1
  %119 = extractvalue { i1, i32, i32 } %116, 1
  %120 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 1
  store i32 %119, i32* %120, align 4
  %121 = extractvalue { i1, i32, i32 } %116, 2
  %122 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 2
  store i32 %121, i32* %122, align 4
  %123 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 0
  %124 = load i1, i1* %123, align 1
  br i1 %124, label %res.ok.6, label %res.alt.6

res.ok.6:
  %125 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 1
  %126 = load i32, i32* %125, align 4
  br label %res.end.6

res.alt.6:
  br label %res.end.6

res.end.6:
  %127 = phi i32 [ %126, %res.ok.6 ], [ -100, %res.alt.6 ]
  store i32 %127, i32* %t1.addr, align 4
  %128 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %129 = call { i1, i32, i32 } @three(%struct.Mutex$$Tally* %128, i32 0)
  %130 = extractvalue { i1, i32, i32 } %129, 0
  %131 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 0
  store i1 %130, i1* %131, align 1
  %132 = extractvalue { i1, i32, i32 } %129, 1
  %133 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 1
  store i32 %132, i32* %133, align 4
  %134 = extractvalue { i1, i32, i32 } %129, 2
  %135 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 2
  store i32 %134, i32* %135, align 4
  %136 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 0
  %137 = load i1, i1* %136, align 1
  br i1 %137, label %res.ok.7, label %res.alt.7

res.ok.7:
  %138 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 1
  %139 = load i32, i32* %138, align 4
  br label %res.end.7

res.alt.7:
  br label %res.end.7

res.end.7:
  %140 = phi i32 [ %139, %res.ok.7 ], [ -100, %res.alt.7 ]
  store i32 %140, i32* %t2.addr, align 4
  %141 = load i32, i32* %t1.addr, align 4
  %142 = call i8* @nish_str_from_i32(i32 %141)
  %143 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.13 to i8*), i8* %142)
  %144 = call i8* @nish_str_concat(i8* %143, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %145 = load i32, i32* %t2.addr, align 4
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* %144, i8* %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %149 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %150 = call i32 @relock(%struct.Mutex$$Tally* %149)
  %151 = call i8* @nish_str_from_i32(i32 %150)
  %152 = call i8* @nish_str_concat(i8* %148, i8* %151)
  call void @nish_print(i8* %152)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"File", !2, i64 0}
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
!18 = !{!"i32", !1, i64 0}
!19 = !{!"MutexGuard$$Tally", !2, i64 0, !18, i64 8}
!20 = !{!19, !2, i64 0}
!21 = !{!"Tally", !18, i64 0}
!22 = !{!21, !18, i64 0}
