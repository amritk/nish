%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Tri = type { i32, i32 }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %r, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4, !tbaa !8
  ret void
}

define internal noundef %union.tagged* @pick(i32 noundef %n) #0 {
entry:
  %t.addr = alloca %struct.Tri*, align 8
  %0 = srem i32 %n, 3
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %3, i32 %n)
  %4 = bitcast %struct.Circle* %3 to %union.tagged*
  ret %union.tagged* %4

if.end:
  %5 = srem i32 %n, 3
  %6 = icmp eq i32 %5, 1
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.Square*
  call void @Square.constructor(%struct.Square* %8, i32 %n)
  %9 = bitcast %struct.Square* %8 to %union.tagged*
  ret %union.tagged* %9

if.end.1:
  %10 = call i8* @nish_alloc_struct(i64 8)
  %11 = bitcast i8* %10 to %struct.Tri*
  %12 = getelementptr inbounds %struct.Tri, %struct.Tri* %11, i32 0, i32 0
  store i32 2, i32* %12, align 4
  %13 = getelementptr inbounds %struct.Tri, %struct.Tri* %11, i32 0, i32 1
  store i32 %n, i32* %13, align 4
  store %struct.Tri* %11, %struct.Tri** %t.addr, align 8
  %14 = load %struct.Tri*, %struct.Tri** %t.addr, align 8
  %15 = bitcast %struct.Tri* %14 to %union.tagged*
  ret %union.tagged* %15
}

define internal noundef i32 @chain(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  ret i32 1

if.else:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 2

if.end.1:
  br label %if.end

if.end:
  %6 = bitcast %union.tagged* %s to %struct.Tri*
  %7 = getelementptr inbounds %struct.Tri, %struct.Tri* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  ret i32 %8
}

define internal noundef i32 @side(%union.tagged* noundef %s, i32 noundef %k) #1 {
entry:
  %0 = icmp eq i32 %k, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  %3 = icmp eq i32 %2, %k
  br i1 %3, label %if.then.1, label %if.end.1

if.then.1:
  %4 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %if.then.2, label %if.end.2

if.then.2:
  %7 = bitcast %union.tagged* %s to %struct.Circle*
  %8 = getelementptr inbounds %struct.Circle, %struct.Circle* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4, !tbaa !5
  ret i32 %9

if.end.2:
  %10 = bitcast %union.tagged* %s to %struct.Square*
  %11 = getelementptr inbounds %struct.Square, %struct.Square* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4, !tbaa !8
  ret i32 %12

if.end.1:
  ret i32 -1
}

define internal noundef i32 @join(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 2
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = bitcast %union.tagged* %s to %struct.Tri*
  %4 = getelementptr inbounds %struct.Tri, %struct.Tri* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = icmp ne i32 %5, 2
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = bitcast %union.tagged* %s to %struct.Tri*
  %8 = getelementptr inbounds %struct.Tri, %struct.Tri* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  %10 = icmp sgt i32 %9, 1
  br label %lor.end

lor.end:
  %11 = phi i1 [ true, %if.end ], [ %10, %lor.rhs ]
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = bitcast %union.tagged* %s to %struct.Tri*
  %13 = getelementptr inbounds %struct.Tri, %struct.Tri* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  ret i32 %14

if.end.1:
  ret i32 -1
}

define internal noundef i32 @held(i32 noundef %n) #2 {
entry:
  %k.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %0 = icmp sgt i32 %n, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  store i32 %1, i32* %k.addr, align 4
  store i32 0, i32* %total.addr, align 4
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %if.then, label %if.else

if.then:
  %4 = load i32, i32* %total.addr, align 4
  %5 = add nsw i32 %4, 10
  store i32 %5, i32* %total.addr, align 4
  br label %if.end

if.else:
  %6 = load i32, i32* %total.addr, align 4
  %7 = add nsw i32 %6, 20
  store i32 %7, i32* %total.addr, align 4
  br label %if.end

if.end:
  store i32 2, i32* %k.addr, align 4
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp eq i32 %8, 2
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  %10 = load i32, i32* %total.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %total.addr, align 4
  br label %if.end.1

if.end.1:
  %14 = load i32, i32* %total.addr, align 4
  ret i32 %14

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @same(i32 noundef %j, i32 noundef %n) #3 {
entry:
  %k.addr = alloca i32, align 4
  %0 = icmp sgt i32 %n, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  store i32 %1, i32* %k.addr, align 4
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp eq i32 %j, %2
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = icmp eq i32 %j, 0
  br i1 %4, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %5 = phi i32 [ 1, %cond.true.1 ], [ 2, %cond.false.1 ]
  ret i32 %5

if.end:
  ret i32 0
}

define internal noundef i32 @stored(i32 noundef %n) #2 {
entry:
  %k.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %total.addr, align 4
  %0 = icmp sgt i32 %n, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  store i32 1, i32* %k.addr, align 4
  br label %if.end

if.end:
  %1 = load i32, i32* %total.addr, align 4
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp eq i32 %2, 1
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %5 = add nsw i32 %1, %4
  store i32 %5, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %n
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp eq i32 %8, 1
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  %10 = load i32, i32* %total.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %total.addr, align 4
  br label %if.end.1

if.end.1:
  store i32 1, i32* %k.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %while.cond

while.end:
  store i32 0, i32* %k.addr, align 4
  switch i32 %n, label %sw.default [
    i32 3, label %sw.case
  ]

sw.case:
  store i32 1, i32* %k.addr, align 4
  br label %sw.end

sw.default:
  br label %sw.end

sw.end:
  %16 = load i32, i32* %total.addr, align 4
  %17 = load i32, i32* %k.addr, align 4
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %19 = phi i32 [ 100, %cond.true.1 ], [ 200, %cond.false.1 ]
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @inBlock(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !5
  ret i32 %5
}

define void @nish_main() #2 {
entry:
  %i.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  store i32 0, i32* %sum.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 6
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call %union.tagged* @pick(i32 %6)
  store %union.tagged* %7, %union.tagged** %s.addr, align 8
  %8 = load i32, i32* %sum.addr, align 4
  %9 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %10 = call i32 @chain(%union.tagged* %9)
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 1000)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %12)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = srem i32 %18, 2
  %20 = icmp eq i32 %19, 0
  br i1 %20, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %21 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  %22 = call i32 @side(%union.tagged* %17, i32 %21)
  %23 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %22, i32 100)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %24)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %29 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %30 = call i32 @join(%union.tagged* %29)
  %31 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %30, i32 10)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %32)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %35, i32* %sum.addr, align 4
  %37 = load i32, i32* %sum.addr, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  call void @nish_print(i8* %38)
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  %41 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %42 = load i8*, i8** %41, align 8
  %43 = icmp eq i8* %42, %3
  br i1 %43, label %pass.rewind, label %pass.free

pass.rewind:
  %44 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %44, align 8
  br label %pass.done

pass.free:
  %45 = ptrtoint i8* %3 to i64
  %46 = add i64 %45, %5
  call void @nish_arena_release(i64 %46)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %47 = call i32 @held(i32 0)
  %48 = call i8* @nish_str_from_i32(i32 %47)
  call void @nish_print(i8* %48)
  %49 = call i32 @held(i32 2)
  %50 = call i8* @nish_str_from_i32(i32 %49)
  call void @nish_print(i8* %50)
  %51 = call i32 @same(i32 0, i32 2)
  %52 = call i8* @nish_str_from_i32(i32 %51)
  call void @nish_print(i8* %52)
  %53 = call i32 @same(i32 1, i32 0)
  %54 = call i8* @nish_str_from_i32(i32 %53)
  call void @nish_print(i8* %54)
  %55 = call i32 @same(i32 2, i32 0)
  %56 = call i8* @nish_str_from_i32(i32 %55)
  call void @nish_print(i8* %56)
  %57 = call i32 @stored(i32 0)
  %58 = call i8* @nish_str_from_i32(i32 %57)
  call void @nish_print(i8* %58)
  %59 = call i32 @stored(i32 3)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  call void @nish_print(i8* %60)
  %61 = call %union.tagged* @pick(i32 6)
  %62 = call i32 @inBlock(%union.tagged* %61)
  %63 = call i8* @nish_str_from_i32(i32 %62)
  call void @nish_print(i8* %63)
  %64 = call %union.tagged* @pick(i32 7)
  %65 = call i32 @inBlock(%union.tagged* %64)
  %66 = call i8* @nish_str_from_i32(i32 %65)
  call void @nish_print(i8* %66)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %while.body ], [ 0, %ovf.ok ], [ 2, %cond.end ], [ 0, %ovf.ok.2 ], [ 2, %ovf.ok.3 ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!9, !10, !11, !12, !13}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Square", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{i32 8, !"cf-protection-branch", i32 1}
!10 = !{i32 8, !"cf-protection-return", i32 1}
!11 = !{i32 8, !"branch-target-enforcement", i32 1}
!12 = !{i32 8, !"sign-return-address", i32 1}
!13 = !{i32 4, !"probe-stack", !"inline-asm"}
