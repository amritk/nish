%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" | \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #2

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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @piece(i32 noundef %i) #1 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @skipOdd(i32 noundef %rounds) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %1 = load i8*, i8** %0, align 8
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %i.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @piece(i32 %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  store i8* %11, i8** %s.addr, align 8
  %12 = load i32, i32* %i.addr, align 4
  %13 = srem i32 %12, 2
  %14 = icmp eq i32 %13, 1
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %16 = load i8*, i8** %15, align 8
  %17 = icmp eq i8* %16, %1
  br i1 %17, label %pass.rewind, label %pass.free

pass.rewind:
  %18 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %18, align 8
  br label %pass.done

pass.free:
  %19 = ptrtoint i8* %1 to i64
  %20 = add i64 %19, %3
  call void @nish_arena_release(i64 %20)
  br label %pass.done

pass.done:
  br label %while.cond

if.end:
  %21 = load i32, i32* %i.addr, align 4
  %22 = icmp sgt i32 %21, %rounds
  br i1 %22, label %if.then.1, label %if.end.1

if.then.1:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %24 = load i8*, i8** %23, align 8
  %25 = icmp eq i8* %24, %1
  br i1 %25, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %26, align 8
  br label %pass.done.1

pass.free.1:
  %27 = ptrtoint i8* %1 to i64
  %28 = add i64 %27, %3
  call void @nish_arena_release(i64 %28)
  br label %pass.done.1

pass.done.1:
  br label %while.end

if.end.1:
  %29 = load i32, i32* %total.addr, align 4
  %30 = load i8*, i8** %s.addr, align 8
  %31 = bitcast i8* %30 to i64*
  %32 = load i64, i64* %31, align 8
  %33 = trunc i64 %32 to i32
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %35, i32* %total.addr, align 4
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %38 = load i8*, i8** %37, align 8
  %39 = icmp eq i8* %38, %1
  br i1 %39, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %40, align 8
  br label %pass.done.2

pass.free.2:
  %41 = ptrtoint i8* %1 to i64
  %42 = add i64 %41, %3
  call void @nish_arena_release(i64 %42)
  br label %pass.done.2

pass.done.2:
  br label %while.cond

while.end:
  %43 = call i8* @nish_alloc_struct(i64 4)
  %44 = bitcast i8* %43 to %struct.Box*
  %45 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %44, i32 %45)
  ret %struct.Box* %44

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @grid(i32 noundef %n) #1 {
entry:
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %row.addr = alloca i8*, align 8
  %c.addr = alloca i32, align 4
  %cell.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %r.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @piece(i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  store i8* %9, i8** %row.addr, align 8
  store i32 0, i32* %c.addr, align 4
  br label %for.cond.1

for.cond.1:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp slt i32 %10, %n
  br i1 %11, label %for.body.1, label %for.end.1

for.body.1:
  %12 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %13 = load i8*, i8** %12, align 8
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %15 = load i64, i64* %14, align 8
  %16 = load i32, i32* %c.addr, align 4
  %17 = call i64 @nish_arena_mark()
  %18 = call i8* @piece(i32 %16)
  %19 = call i8* @nish_arena_keep(i64 %17, i8* %18)
  store i8* %19, i8** %cell.addr, align 8
  %20 = load i32, i32* %c.addr, align 4
  %21 = srem i32 %20, 3
  switch i32 %21, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %23 = load i8*, i8** %22, align 8
  %24 = icmp eq i8* %23, %13
  br i1 %24, label %pass.rewind, label %pass.free

pass.rewind:
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %25, align 8
  br label %pass.done

pass.free:
  %26 = ptrtoint i8* %13 to i64
  %27 = add i64 %26, %15
  call void @nish_arena_release(i64 %27)
  br label %pass.done

pass.done:
  br label %for.inc.1

sw.case.1:
  %28 = load i32, i32* %total.addr, align 4
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 1)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %30, i32* %total.addr, align 4
  br label %sw.end

sw.default:
  %32 = load i32, i32* %total.addr, align 4
  %33 = load i8*, i8** %cell.addr, align 8
  %34 = bitcast i8* %33 to i64*
  %35 = load i64, i64* %34, align 8
  %36 = trunc i64 %35 to i32
  %37 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %36)
  %38 = extractvalue { i32, i1 } %37, 0
  %39 = extractvalue { i32, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %38, i32* %total.addr, align 4
  br label %sw.end

sw.end:
  %40 = load i32, i32* %c.addr, align 4
  %41 = load i32, i32* %r.addr, align 4
  %42 = icmp sgt i32 %40, %41
  br i1 %42, label %if.then, label %if.end

if.then:
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %44 = load i8*, i8** %43, align 8
  %45 = icmp eq i8* %44, %13
  br i1 %45, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %46 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %46, align 8
  br label %pass.done.1

pass.free.1:
  %47 = ptrtoint i8* %13 to i64
  %48 = add i64 %47, %15
  call void @nish_arena_release(i64 %48)
  br label %pass.done.1

pass.done.1:
  br label %for.end.1

if.end:
  %49 = load i32, i32* %total.addr, align 4
  %50 = load i8*, i8** %row.addr, align 8
  %51 = bitcast i8* %50 to i64*
  %52 = load i64, i64* %51, align 8
  %53 = trunc i64 %52 to i32
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 %53)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %55, i32* %total.addr, align 4
  %57 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %58 = load i8*, i8** %57, align 8
  %59 = icmp eq i8* %58, %13
  br i1 %59, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %60 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %60, align 8
  br label %pass.done.2

pass.free.2:
  %61 = ptrtoint i8* %13 to i64
  %62 = add i64 %61, %15
  call void @nish_arena_release(i64 %62)
  br label %pass.done.2

pass.done.2:
  br label %for.inc.1

for.inc.1:
  %63 = load i32, i32* %c.addr, align 4
  %64 = add nsw i32 %63, 1
  store i32 %64, i32* %c.addr, align 4
  br label %for.cond.1

for.end.1:
  %65 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %66 = load i8*, i8** %65, align 8
  %67 = icmp eq i8* %66, %3
  br i1 %67, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %68 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %68, align 8
  br label %pass.done.3

pass.free.3:
  %69 = ptrtoint i8* %3 to i64
  %70 = add i64 %69, %5
  call void @nish_arena_release(i64 %70)
  br label %pass.done.3

pass.done.3:
  br label %for.inc

for.inc:
  %71 = load i32, i32* %r.addr, align 4
  %72 = add nsw i32 %71, 1
  store i32 %72, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %73 = call i8* @nish_alloc_struct(i64 4)
  %74 = bitcast i8* %73 to %struct.Box*
  %75 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %74, i32 %75)
  ret %struct.Box* %74

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @countDown(i32 noundef %rounds) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 %rounds, i32* %i.addr, align 4
  br label %do.body

do.body:
  %0 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %1 = load i8*, i8** %0, align 8
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @piece(i32 %4)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %8, i32 1)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %i.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = srem i32 %12, 3
  %14 = icmp eq i32 %13, 0
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %16 = load i8*, i8** %15, align 8
  %17 = icmp eq i8* %16, %1
  br i1 %17, label %pass.rewind, label %pass.free

pass.rewind:
  %18 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %18, align 8
  br label %pass.done

pass.free:
  %19 = ptrtoint i8* %1 to i64
  %20 = add i64 %19, %3
  call void @nish_arena_release(i64 %20)
  br label %pass.done

pass.done:
  br label %do.cond

if.end:
  %21 = load i32, i32* %total.addr, align 4
  %22 = load i8*, i8** %s.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %27, i32* %total.addr, align 4
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %30 = load i8*, i8** %29, align 8
  %31 = icmp eq i8* %30, %1
  br i1 %31, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %32 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %3, i64* %32, align 8
  br label %pass.done.1

pass.free.1:
  %33 = ptrtoint i8* %1 to i64
  %34 = add i64 %33, %3
  call void @nish_arena_release(i64 %34)
  br label %pass.done.1

pass.done.1:
  br label %do.cond

do.cond:
  %35 = load i32, i32* %i.addr, align 4
  %36 = icmp sgt i32 %35, 0
  br i1 %36, label %do.body, label %do.end

do.end:
  %37 = call i8* @nish_alloc_struct(i64 4)
  %38 = bitcast i8* %37 to %struct.Box*
  %39 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %38, i32 %39)
  ret %struct.Box* %38

ovf.fail:
  %ovf.op = phi i32 [ 1, %do.body ], [ 0, %if.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @find(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %boxes, i32 noundef %want) #1 {
entry:
  %r.addr = alloca i32, align 4
  %box.addr = alloca %struct.Box*, align 8
  %forof.idx = alloca i64, align 8
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %6 = load i64, i64* %forof.idx, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %forof.body, label %forof.end

forof.body:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %12 = bitcast i8* %11 to %struct.Box**
  %13 = getelementptr inbounds %struct.Box*, %struct.Box** %12, i64 %6
  %14 = load %struct.Box*, %struct.Box** %13, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.Box* %14, %struct.Box** %box.addr, align 8
  %15 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %16 = load i8*, i8** %15, align 8
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %18 = load i64, i64* %17, align 8
  %19 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %20 = getelementptr inbounds %struct.Box, %struct.Box* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !4
  %22 = load i32, i32* %r.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @piece(i32 %24)
  %28 = call i8* @nish_arena_keep(i64 %26, i8* %27)
  store i8* %28, i8** %s.addr, align 8
  %29 = load i8*, i8** %s.addr, align 8
  %30 = bitcast i8* %29 to i64*
  %31 = load i64, i64* %30, align 8
  %32 = trunc i64 %31 to i32
  %33 = icmp eq i32 %32, %want
  br i1 %33, label %if.then, label %if.end

if.then:
  %34 = load %struct.Box*, %struct.Box** %box.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.Box* %34

if.end:
  %35 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %36 = load i8*, i8** %35, align 8
  %37 = icmp eq i8* %36, %16
  br i1 %37, label %pass.rewind, label %pass.free

pass.rewind:
  %38 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %18, i64* %38, align 8
  br label %pass.done

pass.free:
  %39 = ptrtoint i8* %16 to i64
  %40 = add i64 %39, %18
  call void @nish_arena_release(i64 %40)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %41 = load i64, i64* %forof.idx, align 8
  %42 = add i64 %41, 1
  store i64 %42, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %44 = load i8*, i8** %43, align 8
  %45 = icmp eq i8* %44, %3
  br i1 %45, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %46 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %46, align 8
  br label %pass.done.1

pass.free.1:
  %47 = ptrtoint i8* %3 to i64
  %48 = add i64 %47, %5
  call void @nish_arena_release(i64 %48)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %r.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = icmp ult i64 0, %52
  br i1 %53, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %52)
  unreachable

bounds.ok:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %56 = bitcast i8* %55 to %struct.Box**
  %57 = getelementptr inbounds %struct.Box*, %struct.Box** %56, i64 0
  %58 = load %struct.Box*, %struct.Box** %57, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  call void @nish_arena_release(i64 %arena.mark)
  ret %struct.Box* %58

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @settle(i32 noundef %i) #2 {
entry:
  %0 = mul nsw i32 %i, 2
  ret i32 %0
}

define internal noundef i32 @firstWide(i32 noundef %rounds) #1 {
entry:
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @piece(i32 %6)
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  store i8* %9, i8** %s.addr, align 8
  %10 = load i8*, i8** %s.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = icmp sgt i32 %13, 3
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load i32, i32* %i.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  %16 = tail call i32 @settle(i32 %15)
  ret i32 %16

if.end:
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %18 = load i8*, i8** %17, align 8
  %19 = icmp eq i8* %18, %3
  br i1 %19, label %pass.rewind, label %pass.free

pass.rewind:
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %20, align 8
  br label %pass.done

pass.free:
  %21 = ptrtoint i8* %3 to i64
  %22 = add i64 %21, %5
  call void @nish_arena_release(i64 %22)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1
}

define internal noundef nonnull align 8 i8* @growth(i32 noundef %which, i32 noundef %rounds) #1 {
entry:
  %m.addr = alloca i64, align 8
  %before.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %grown.addr = alloca i64, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %m.addr, align 8
  %1 = call i64 @nish_arena_used()
  store i64 %1, i64* %before.addr, align 8
  store i32 0, i32* %n.addr, align 4
  %2 = icmp eq i32 %which, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = call %struct.Box* @skipOdd(i32 %rounds)
  %4 = getelementptr inbounds %struct.Box, %struct.Box* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  store i32 %5, i32* %n.addr, align 4
  br label %if.end

if.else:
  %6 = icmp eq i32 %which, 1
  br i1 %6, label %if.then.1, label %if.else.1

if.then.1:
  %7 = call %struct.Box* @grid(i32 %rounds)
  %8 = getelementptr inbounds %struct.Box, %struct.Box* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4, !tbaa !4
  store i32 %9, i32* %n.addr, align 4
  br label %if.end.1

if.else.1:
  %10 = call %struct.Box* @countDown(i32 %rounds)
  %11 = getelementptr inbounds %struct.Box, %struct.Box* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !4
  store i32 %12, i32* %n.addr, align 4
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %13 = call i64 @nish_arena_used()
  %14 = load i64, i64* %before.addr, align 8
  %15 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %13, i64 %14)
  %16 = extractvalue { i64, i1 } %15, 0
  %17 = extractvalue { i64, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %16, i64* %grown.addr, align 8
  %18 = load i64, i64* %m.addr, align 8
  call void @nish_arena_release(i64 %18)
  %19 = load i32, i32* %n.addr, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %22 = load i64, i64* %grown.addr, align 8
  %23 = call i8* @nish_str_from_i64(i64 %22)
  %24 = call i8* @nish_str_concat(i8* %21, i8* %23)
  ret i8* %24

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define void @nish_main() #1 {
entry:
  %boxes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @growth(i32 0, i32 5)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %2 = call i8* @growth(i32 0, i32 300)
  %3 = call i8* @nish_str_concat(i8* %1, i8* %2)
  call void @nish_print(i8* %3)
  %4 = call i8* @growth(i32 1, i32 5)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %6 = call i8* @growth(i32 1, i32 300)
  %7 = call i8* @nish_str_concat(i8* %5, i8* %6)
  call void @nish_print(i8* %7)
  %8 = call i8* @growth(i32 2, i32 5)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %10 = call i8* @growth(i32 2, i32 300)
  %11 = call i8* @nish_str_concat(i8* %9, i8* %10)
  call void @nish_print(i8* %11)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %boxes.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp slt i32 %15, 200
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %18 = call i8* @nish_alloc_struct(i64 4)
  %19 = bitcast i8* %18 to %struct.Box*
  %20 = load i32, i32* %i.addr, align 4
  call void @Box.constructor(%struct.Box* %19, i32 %20)
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %28 = bitcast i8* %27 to %struct.Box**
  %29 = getelementptr inbounds %struct.Box*, %struct.Box** %28, i64 %22
  store %struct.Box* %19, %struct.Box** %29, align 8, !alias.scope !9, !noalias !8, !tbaa !16
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %31 = trunc i64 %30 to i32
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %35 = call %struct.Box* @find(%struct.nish_array* %34, i32 4)
  %36 = getelementptr inbounds %struct.Box, %struct.Box* %35, i32 0, i32 0
  %37 = load i32, i32* %36, align 4, !tbaa !4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %40 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %41 = call %struct.Box* @find(%struct.nish_array* %40, i32 9)
  %42 = getelementptr inbounds %struct.Box, %struct.Box* %41, i32 0, i32 0
  %43 = load i32, i32* %42, align 4, !tbaa !4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* %39, i8* %44)
  call void @nish_print(i8* %45)
  %46 = call i32 @firstWide(i32 2000)
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
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
!14 = !{!12, !11, i64 16}
!15 = !{!"element ptr", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!12, !10, i64 8}
