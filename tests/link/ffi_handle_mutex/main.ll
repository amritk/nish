%struct.File = type { i8* }
%struct.Tally = type { i32 }
%struct.Mutex$$Tally = type { %struct.MutexGuard$$Tally* }
%struct.MutexGuard$$Tally = type { %struct.Tally*, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [89 x i8] } { i64 88, [89 x i8] c"`fopen`: argument 1 (path) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"/dev/null\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare i8* @fopen(i8*, i8*)
declare i32 @fclose(i8*)
declare i32 @fgetc(i8*)
declare void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noundef nonnull align 8 dereferenceable(16) %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #0
declare void @nish.MutexGuard$$Tally.constructor(%struct.MutexGuard$$Tally* noundef nonnull noalias align 8 dereferenceable(16) nocapture, %struct.Tally* noundef nonnull align 8 dereferenceable(4)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #5
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

define internal noundef i32 @lockThenFile(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m, i32 noundef %k) #0 {
entry:
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  %0 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %0, %struct.MutexGuard$$Tally** %g.addr, align 8
  %1 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %1, i32 0, i32 1
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %3 = load %struct.File*, %struct.File** %f.addr, align 8
  %4 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %5 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %4, i32 0, i32 0
  %6 = load %struct.Tally*, %struct.Tally** %5, align 8, !tbaa !7
  %7 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %7, i32 0, i32 0
  %9 = load %struct.Tally*, %struct.Tally** %8, align 8, !tbaa !7
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !9
  %12 = load %struct.File*, %struct.File** %f.addr, align 8
  %13 = call i32 @File.read(%struct.File* %12)
  %14 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Tally, %struct.Tally* %6, i32 0, i32 0
  store i32 %15, i32* %17, align 4, !tbaa !9
  %18 = icmp sgt i32 %k, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %20 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %19, i32 0, i32 0
  %21 = load %struct.Tally*, %struct.Tally** %20, align 8, !tbaa !7
  %22 = getelementptr inbounds %struct.Tally, %struct.Tally* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !9
  %24 = getelementptr inbounds %struct.File, %struct.File* %3, i32 0, i32 0
  %25 = load i8*, i8** %24, align 8, !tbaa !4
  %26 = icmp eq i8* %25, null
  br i1 %26, label %handle.closed, label %handle.close

handle.close:
  %27 = call i32 @fclose(i8* %25)
  br label %handle.closed

handle.closed:
  store atomic i32 0, i32* %2 release, align 4
  ret i32 %23

if.end:
  %28 = getelementptr inbounds %struct.File, %struct.File* %3, i32 0, i32 0
  %29 = load i8*, i8** %28, align 8, !tbaa !4
  %30 = icmp eq i8* %29, null
  br i1 %30, label %handle.closed.1, label %handle.close.1

handle.close.1:
  %31 = call i32 @fclose(i8* %29)
  br label %handle.closed.1

handle.closed.1:
  store atomic i32 0, i32* %2 release, align 4
  %32 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %32, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %33 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %34 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %33, i32 0, i32 1
  %35 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %36 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %35, i32 0, i32 0
  %37 = load %struct.Tally*, %struct.Tally** %36, align 8, !tbaa !7
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !9
  %40 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %39, i32 10)
  %41 = extractvalue { i32, i1 } %40, 0
  %42 = extractvalue { i32, i1 } %40, 1
  br i1 %42, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store atomic i32 0, i32* %34 release, align 4
  ret i32 %41

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 2, %handle.closed.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @fileThenLock(%struct.Mutex$$Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %m, i32 noundef %k) #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %g.addr.1 = alloca %struct.MutexGuard$$Tally*, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [10 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %1, %struct.MutexGuard$$Tally** %g.addr, align 8
  %2 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %3 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %2, i32 0, i32 1
  %4 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %5 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %4, i32 0, i32 0
  %6 = load %struct.Tally*, %struct.Tally** %5, align 8, !tbaa !7
  %7 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %8 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %7, i32 0, i32 0
  %9 = load %struct.Tally*, %struct.Tally** %8, align 8, !tbaa !7
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !9
  %12 = load %struct.File*, %struct.File** %f.addr, align 8
  %13 = call i32 @File.read(%struct.File* %12)
  %14 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Tally, %struct.Tally* %6, i32 0, i32 0
  store i32 %15, i32* %17, align 4, !tbaa !9
  %18 = icmp sgt i32 %k, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %20 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %19, i32 0, i32 0
  %21 = load %struct.Tally*, %struct.Tally** %20, align 8, !tbaa !7
  %22 = getelementptr inbounds %struct.Tally, %struct.Tally* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !9
  store atomic i32 0, i32* %3 release, align 4
  %24 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %25 = load i8*, i8** %24, align 8, !tbaa !4
  %26 = icmp eq i8* %25, null
  br i1 %26, label %handle.closed, label %handle.close

handle.close:
  %27 = call i32 @fclose(i8* %25)
  br label %handle.closed

handle.closed:
  ret i32 %23

if.end:
  store atomic i32 0, i32* %3 release, align 4
  %28 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %29 = load i8*, i8** %28, align 8, !tbaa !4
  %30 = icmp eq i8* %29, null
  br i1 %30, label %handle.closed.1, label %handle.close.1

handle.close.1:
  %31 = call i32 @fclose(i8* %29)
  br label %handle.closed.1

handle.closed.1:
  %32 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %m)
  store %struct.MutexGuard$$Tally* %32, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %33 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %34 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %33, i32 0, i32 1
  %35 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr.1, align 8
  %36 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %35, i32 0, i32 0
  %37 = load %struct.Tally*, %struct.Tally** %36, align 8, !tbaa !7
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !9
  %40 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %39, i32 10)
  %41 = extractvalue { i32, i1 } %40, 0
  %42 = extractvalue { i32, i1 } %40, 1
  br i1 %42, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store atomic i32 0, i32* %34 release, align 4
  ret i32 %41

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 2, %handle.closed.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Mutex$$Tally*, align 8
  %Mutex$$Tally.obj = alloca %struct.Mutex$$Tally, align 8
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %g.addr = alloca %struct.MutexGuard$$Tally*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Tally*
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !9
  call void @nish.Mutex$$Tally.constructor(%struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Tally* %1)
  store %struct.Mutex$$Tally* %Mutex$$Tally.obj, %struct.Mutex$$Tally** %m.addr, align 8
  %3 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %4 = call i32 @lockThenFile(%struct.Mutex$$Tally* %3, i32 1)
  store i32 %4, i32* %a.addr, align 4
  %5 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %6 = call i32 @lockThenFile(%struct.Mutex$$Tally* %5, i32 0)
  store i32 %6, i32* %b.addr, align 4
  %7 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %8 = call i32 @fileThenLock(%struct.Mutex$$Tally* %7, i32 1)
  store i32 %8, i32* %c.addr, align 4
  %9 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %10 = call i32 @fileThenLock(%struct.Mutex$$Tally* %9, i32 0)
  store i32 %10, i32* %d.addr, align 4
  %11 = load %struct.Mutex$$Tally*, %struct.Mutex$$Tally** %m.addr, align 8
  %12 = call %struct.MutexGuard$$Tally* @nish.Mutex$$Tally.lock(%struct.Mutex$$Tally* %11)
  store %struct.MutexGuard$$Tally* %12, %struct.MutexGuard$$Tally** %g.addr, align 8
  %13 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %14 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %13, i32 0, i32 1
  %15 = load i32, i32* %a.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %18 = load i32, i32* %b.addr, align 4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %17, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %22 = load i32, i32* %c.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %21, i8* %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %26 = load i32, i32* %d.addr, align 4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %25, i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %30 = load %struct.MutexGuard$$Tally*, %struct.MutexGuard$$Tally** %g.addr, align 8
  %31 = getelementptr inbounds %struct.MutexGuard$$Tally, %struct.MutexGuard$$Tally* %30, i32 0, i32 0
  %32 = load %struct.Tally*, %struct.Tally** %31, align 8, !tbaa !7
  %33 = getelementptr inbounds %struct.Tally, %struct.Tally* %32, i32 0, i32 0
  %34 = load i32, i32* %33, align 4, !tbaa !9
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %29, i8* %35)
  call void @nish_print(i8* %36)
  store atomic i32 0, i32* %14 release, align 4
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
!5 = !{!"i32", !1, i64 0}
!6 = !{!"MutexGuard$$Tally", !2, i64 0, !5, i64 8}
!7 = !{!6, !2, i64 0}
!8 = !{!"Tally", !5, i64 0}
!9 = !{!8, !5, i64 0}
