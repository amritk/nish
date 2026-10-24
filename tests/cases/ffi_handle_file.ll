%struct.File = type { i8*, i32 }
%struct.nish_result.str.i32 = type { i1, i8*, i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [97 x i8] } { i64 96, [97 x i8] c"`counted_fopen`: argument 1 (path) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"data\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i8* @counted_fopen(i8*, i8*)
declare i32 @counted_fclose(i8*)
declare i32 @fgetc(i8*)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
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

define internal void @File.constructor(%struct.File* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %path) #0 {
entry:
  %0 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = call i64 @nish_str_index_of(i8* %path, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [97 x i8] }* @.str.1 to i8*))
  unreachable

ffi.ok:
  %3 = getelementptr inbounds i8, i8* %path, i64 8
  %4 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  %5 = call i8* @counted_fopen(i8* %3, i8* %4)
  %6 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 0
  store i8* %5, i8** %6, align 8, !tbaa !6
  ret void
}

define internal noundef i32 @File.read(%struct.File* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %p.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !6
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %4 = load i8*, i8** %p.addr, align 8
  %5 = call i32 @fgetc(i8* %4)
  ret i32 %5
}

define internal noundef i32 @twice(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
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
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %4, align 8
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

define noundef i32 @fallThrough() #0 {
entry:
  %c.addr = alloca i32, align 4
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  store i32 0, i32* %c.addr, align 4
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = load %struct.File*, %struct.File** %f.addr, align 8
  %2 = call i32 @File.read(%struct.File* %1)
  store i32 %2, i32* %c.addr, align 4
  %3 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !6
  %5 = icmp eq i8* %4, null
  br i1 %5, label %handle.closed, label %handle.close

handle.close:
  %6 = call i32 @counted_fclose(i8* %4)
  br label %handle.closed

handle.closed:
  %7 = load i32, i32* %c.addr, align 4
  ret i32 %7
}

define noundef i32 @early(i32 noundef %k) #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = icmp sgt i32 %k, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8, !tbaa !6
  %4 = icmp eq i8* %3, null
  br i1 %4, label %handle.closed, label %handle.close

handle.close:
  %5 = call i32 @counted_fclose(i8* %3)
  br label %handle.closed

handle.closed:
  ret i32 %k

if.end:
  %6 = load %struct.File*, %struct.File** %f.addr, align 8
  %7 = call i32 @File.read(%struct.File* %6)
  %8 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %9 = load i8*, i8** %8, align 8, !tbaa !6
  %10 = icmp eq i8* %9, null
  br i1 %10, label %handle.closed.1, label %handle.close.1

handle.close.1:
  %11 = call i32 @counted_fclose(i8* %9)
  br label %handle.closed.1

handle.closed.1:
  ret i32 %7
}

define noundef i32 @loop(i32 noundef %n) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %2 = load %struct.File*, %struct.File** %f.addr, align 8
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp eq i32 %3, 1
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = getelementptr inbounds %struct.File, %struct.File* %2, i32 0, i32 0
  %6 = load i8*, i8** %5, align 8, !tbaa !6
  %7 = icmp eq i8* %6, null
  br i1 %7, label %handle.closed, label %handle.close

handle.close:
  %8 = call i32 @counted_fclose(i8* %6)
  br label %handle.closed

handle.closed:
  br label %for.inc

if.end:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp eq i32 %9, 3
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = getelementptr inbounds %struct.File, %struct.File* %2, i32 0, i32 0
  %12 = load i8*, i8** %11, align 8, !tbaa !6
  %13 = icmp eq i8* %12, null
  br i1 %13, label %handle.closed.1, label %handle.close.1

handle.close.1:
  %14 = call i32 @counted_fclose(i8* %12)
  br label %handle.closed.1

handle.closed.1:
  br label %for.end

if.end.1:
  %15 = load i32, i32* %total.addr, align 4
  %16 = load %struct.File*, %struct.File** %f.addr, align 8
  %17 = call i32 @File.read(%struct.File* %16)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %total.addr, align 4
  %21 = getelementptr inbounds %struct.File, %struct.File* %2, i32 0, i32 0
  %22 = load i8*, i8** %21, align 8, !tbaa !6
  %23 = icmp eq i8* %22, null
  br i1 %23, label %handle.closed.2, label %handle.close.2

handle.close.2:
  %24 = call i32 @counted_fclose(i8* %22)
  br label %handle.closed.2

handle.closed.2:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load i32, i32* %total.addr, align 4
  ret i32 %27

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal { i1, i32, i32 } @pair(i32 noundef %fail) #0 {
entry:
  %a.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %b.addr = alloca %struct.File*, align 8
  %File.obj.1 = alloca %struct.File, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %a.addr, align 8
  %0 = load %struct.File*, %struct.File** %a.addr, align 8
  %1 = call %struct.nish_result.str.i32* @pathFor(i32 %fail)
  %2 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  br i1 %3, label %res.ok, label %res.propagate

res.propagate:
  %4 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %1, i32 0, i32 2
  %5 = load i32, i32* %4, align 4
  %6 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %5, 2
  %7 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %8 = load i8*, i8** %7, align 8, !tbaa !6
  %9 = icmp eq i8* %8, null
  br i1 %9, label %handle.closed, label %handle.close

handle.close:
  %10 = call i32 @counted_fclose(i8* %8)
  br label %handle.closed

handle.closed:
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %6

res.ok:
  %11 = getelementptr inbounds %struct.nish_result.str.i32, %struct.nish_result.str.i32* %1, i32 0, i32 1
  %12 = load i8*, i8** %11, align 8
  call void @File.constructor(%struct.File* %File.obj.1, i8* %12)
  store %struct.File* %File.obj.1, %struct.File** %b.addr, align 8
  %13 = load %struct.File*, %struct.File** %b.addr, align 8
  %14 = load %struct.File*, %struct.File** %a.addr, align 8
  %15 = call i32 @File.read(%struct.File* %14)
  %16 = load %struct.File*, %struct.File** %b.addr, align 8
  %17 = call i32 @File.read(%struct.File* %16)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %19, 1
  %22 = getelementptr inbounds %struct.File, %struct.File* %13, i32 0, i32 0
  %23 = load i8*, i8** %22, align 8, !tbaa !6
  %24 = icmp eq i8* %23, null
  br i1 %24, label %handle.closed.1, label %handle.close.1

handle.close.1:
  %25 = call i32 @counted_fclose(i8* %23)
  br label %handle.closed.1

handle.closed.1:
  %26 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %27 = load i8*, i8** %26, align 8, !tbaa !6
  %28 = icmp eq i8* %27, null
  br i1 %28, label %handle.closed.2, label %handle.close.2

handle.close.2:
  %29 = call i32 @counted_fclose(i8* %27)
  br label %handle.closed.2

handle.closed.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret { i1, i32, i32 } %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @pairOf(i32 noundef %fail) #0 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32, i32 } @pair(i32 %fail)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.alt

res.ok:
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %11 = phi i32 [ %10, %res.ok ], [ -1, %res.alt ]
  ret i32 %11
}

define noundef i32 @doubled(i32 noundef %n) #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = call i32 @twice(i32 %n)
  %2 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8, !tbaa !6
  %4 = icmp eq i8* %3, null
  br i1 %4, label %handle.closed, label %handle.close

handle.close:
  %5 = call i32 @counted_fclose(i8* %3)
  br label %handle.closed

handle.closed:
  ret i32 %1
}

define noundef i32 @doubledBare(i32 noundef %n) #0 {
entry:
  %0 = tail call i32 @twice(i32 %n)
  ret i32 %0
}

define internal noundef i32 @first(%struct.File* noundef nonnull readonly align 8 dereferenceable(16) nocapture %f) #0 {
entry:
  %0 = call i32 @File.read(%struct.File* %f)
  ret i32 %0
}

define internal noundef i32 @relay(%struct.File* noundef nonnull readonly align 8 dereferenceable(16) nocapture %f) #0 {
entry:
  %0 = call i32 @first(%struct.File* %f)
  %1 = call i32 @first(%struct.File* %f)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @lent() #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = load %struct.File*, %struct.File** %f.addr, align 8
  %2 = call i32 @relay(%struct.File* %1)
  %3 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !6
  %5 = icmp eq i8* %4, null
  br i1 %5, label %handle.closed, label %handle.close

handle.close:
  %6 = call i32 @counted_fclose(i8* %4)
  br label %handle.closed

handle.closed:
  ret i32 %2
}

define noundef i32 @counted() #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = load %struct.File*, %struct.File** %f.addr, align 8
  %2 = load %struct.File*, %struct.File** %f.addr, align 8
  %3 = getelementptr inbounds %struct.File, %struct.File* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  %5 = load %struct.File*, %struct.File** %f.addr, align 8
  %6 = call i32 @File.read(%struct.File* %5)
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  %10 = getelementptr inbounds %struct.File, %struct.File* %1, i32 0, i32 1
  store i32 %8, i32* %10, align 4, !tbaa !5
  %11 = load %struct.File*, %struct.File** %f.addr, align 8
  %12 = load %struct.File*, %struct.File** %f.addr, align 8
  %13 = getelementptr inbounds %struct.File, %struct.File* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !5
  %15 = load %struct.File*, %struct.File** %f.addr, align 8
  %16 = call i32 @File.read(%struct.File* %15)
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %20 = getelementptr inbounds %struct.File, %struct.File* %11, i32 0, i32 1
  store i32 %18, i32* %20, align 4, !tbaa !5
  %21 = load %struct.File*, %struct.File** %f.addr, align 8
  %22 = getelementptr inbounds %struct.File, %struct.File* %21, i32 0, i32 1
  %23 = load i32, i32* %22, align 4, !tbaa !5
  %24 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %25 = load i8*, i8** %24, align 8, !tbaa !6
  %26 = icmp eq i8* %25, null
  br i1 %26, label %handle.closed, label %handle.close

handle.close:
  %27 = call i32 @counted_fclose(i8* %25)
  br label %handle.closed

handle.closed:
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"File", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}
