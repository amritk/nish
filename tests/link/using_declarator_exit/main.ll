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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_result.str.i32* @builtPath(i32 noundef %k, i32 noundef %fail) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  %1 = icmp eq i32 %fail, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_result.str.i32*
  %4 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 0
  store i1 true, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %3, i32 0, i32 1
  store i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*), i8** %5, align 8
  br label %cond.end

cond.false:
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = trunc i64 %8 to i32
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %fail)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_result.str.i32*
  %15 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %14, i32 0, i32 0
  store i1 false, i1* %15, align 1
  %16 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %14, i32 0, i32 2
  store i32 %11, i32* %16, align 4
  br label %cond.end

cond.end:
  %17 = phi %struct.nish_result.str.i32* [ %3, %cond.true ], [ %14, %ovf.ok ]
  ret %struct.nish_result.str.i32* %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
  %2 = call %struct.nish_result.str.i32* @builtPath(i32 %k, i32 %fail)
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
  %failed.addr = alloca i64, align 8
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
  %54 = call i64 @nish_arena_used()
  store i64 %54, i64* %failed.addr, align 8
  %55 = call i32 @churn()
  store i32 %55, i32* %c.addr, align 4
  %56 = call { i1, i32, i32 } @arenaFirst(i32 1000, i32 0)
  %57 = extractvalue { i1, i32, i32 } %56, 0
  %58 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %57, i1* %58, align 1
  %59 = extractvalue { i1, i32, i32 } %56, 1
  %60 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %59, i32* %60, align 4
  %61 = extractvalue { i1, i32, i32 } %56, 2
  %62 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %61, i32* %62, align 4
  %63 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  %64 = load i1, i1* %63, align 1
  br i1 %64, label %res.ok.3, label %res.alt.3

res.ok.3:
  %65 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  %66 = load i32, i32* %65, align 4
  br label %res.end.3

res.alt.3:
  br label %res.end.3

res.end.3:
  %67 = phi i32 [ %66, %res.ok.3 ], [ -100, %res.alt.3 ]
  store i32 %67, i32* %a2.addr, align 4
  %68 = call i64 @nish_arena_used()
  store i64 %68, i64* %after.addr, align 8
  %69 = load i32, i32* %a1.addr, align 4
  %70 = call i8* @nish_str_from_i32(i32 %69)
  %71 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.7 to i8*), i8* %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %73 = load i32, i32* %a2.addr, align 4
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %72, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %77 = load i32, i32* %c.addr, align 4
  %78 = icmp sgt i32 %77, 0
  %79 = select i1 %78, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %80 = call i8* @nish_str_concat(i8* %76, i8* %79)
  %81 = call i8* @nish_str_concat(i8* %80, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %82 = load i64, i64* %failed.addr, align 8
  %83 = load i64, i64* %before.addr, align 8
  %84 = icmp eq i64 %82, %83
  br i1 %84, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %85 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.10 to i8*), %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.11 to i8*), %cond.false ]
  %86 = call i8* @nish_str_concat(i8* %81, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %88 = load i64, i64* %after.addr, align 8
  %89 = load i64, i64* %before.addr, align 8
  %90 = icmp eq i64 %88, %89
  br i1 %90, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %91 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.10 to i8*), %cond.true.1 ], [ bitcast ({ i64, [5 x i8] }* @.str.11 to i8*), %cond.false.1 ]
  %92 = call i8* @nish_str_concat(i8* %87, i8* %91)
  call void @nish_print(i8* %92)
  %93 = call { i1, i32, i32 } @scopeFirst(i32 6)
  %94 = extractvalue { i1, i32, i32 } %93, 0
  %95 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 0
  store i1 %94, i1* %95, align 1
  %96 = extractvalue { i1, i32, i32 } %93, 1
  %97 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 1
  store i32 %96, i32* %97, align 4
  %98 = extractvalue { i1, i32, i32 } %93, 2
  %99 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 2
  store i32 %98, i32* %99, align 4
  %100 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 0
  %101 = load i1, i1* %100, align 1
  br i1 %101, label %res.ok.4, label %res.alt.4

res.ok.4:
  %102 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.4, i32 0, i32 1
  %103 = load i32, i32* %102, align 4
  br label %res.end.4

res.alt.4:
  br label %res.end.4

res.end.4:
  %104 = phi i32 [ %103, %res.ok.4 ], [ -100, %res.alt.4 ]
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.12 to i8*), i8* %105)
  %107 = call i8* @nish_str_concat(i8* %106, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %108 = call { i1, i32, i32 } @scopeFirst(i32 0)
  %109 = extractvalue { i1, i32, i32 } %108, 0
  %110 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 0
  store i1 %109, i1* %110, align 1
  %111 = extractvalue { i1, i32, i32 } %108, 1
  %112 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 1
  store i32 %111, i32* %112, align 4
  %113 = extractvalue { i1, i32, i32 } %108, 2
  %114 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 2
  store i32 %113, i32* %114, align 4
  %115 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 0
  %116 = load i1, i1* %115, align 1
  br i1 %116, label %res.ok.5, label %res.alt.5

res.ok.5:
  %117 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.5, i32 0, i32 1
  %118 = load i32, i32* %117, align 4
  br label %res.end.5

res.alt.5:
  br label %res.end.5

res.end.5:
  %119 = phi i32 [ %118, %res.ok.5 ], [ -100, %res.alt.5 ]
  %120 = call i8* @nish_str_from_i32(i32 %119)
  %121 = call i8* @nish_str_concat(i8* %107, i8* %120)
  call void @nish_print(i8* %121)
  %122 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %123 = call { i1, i32, i32 } @three(%struct.Mutex$$Tally* %122, i32 7)
  %124 = extractvalue { i1, i32, i32 } %123, 0
  %125 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 0
  store i1 %124, i1* %125, align 1
  %126 = extractvalue { i1, i32, i32 } %123, 1
  %127 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 1
  store i32 %126, i32* %127, align 4
  %128 = extractvalue { i1, i32, i32 } %123, 2
  %129 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 2
  store i32 %128, i32* %129, align 4
  %130 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 0
  %131 = load i1, i1* %130, align 1
  br i1 %131, label %res.ok.6, label %res.alt.6

res.ok.6:
  %132 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.6, i32 0, i32 1
  %133 = load i32, i32* %132, align 4
  br label %res.end.6

res.alt.6:
  br label %res.end.6

res.end.6:
  %134 = phi i32 [ %133, %res.ok.6 ], [ -100, %res.alt.6 ]
  store i32 %134, i32* %t1.addr, align 4
  %135 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %136 = call { i1, i32, i32 } @three(%struct.Mutex$$Tally* %135, i32 0)
  %137 = extractvalue { i1, i32, i32 } %136, 0
  %138 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 0
  store i1 %137, i1* %138, align 1
  %139 = extractvalue { i1, i32, i32 } %136, 1
  %140 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 1
  store i32 %139, i32* %140, align 4
  %141 = extractvalue { i1, i32, i32 } %136, 2
  %142 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 2
  store i32 %141, i32* %142, align 4
  %143 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 0
  %144 = load i1, i1* %143, align 1
  br i1 %144, label %res.ok.7, label %res.alt.7

res.ok.7:
  %145 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.7, i32 0, i32 1
  %146 = load i32, i32* %145, align 4
  br label %res.end.7

res.alt.7:
  br label %res.end.7

res.end.7:
  %147 = phi i32 [ %146, %res.ok.7 ], [ -100, %res.alt.7 ]
  store i32 %147, i32* %t2.addr, align 4
  %148 = load i32, i32* %t1.addr, align 4
  %149 = call i8* @nish_str_from_i32(i32 %148)
  %150 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.13 to i8*), i8* %149)
  %151 = call i8* @nish_str_concat(i8* %150, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %152 = load i32, i32* %t2.addr, align 4
  %153 = call i8* @nish_str_from_i32(i32 %152)
  %154 = call i8* @nish_str_concat(i8* %151, i8* %153)
  %155 = call i8* @nish_str_concat(i8* %154, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %156 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %157 = call i32 @relock(%struct.Mutex$$Tally* %156)
  %158 = call i8* @nish_str_from_i32(i32 %157)
  %159 = call i8* @nish_str_concat(i8* %155, i8* %158)
  call void @nish_print(i8* %159)
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
