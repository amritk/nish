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

define internal noundef i32 @size(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp eq i32 %4, 1
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %entry ], [ %5, %lor.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %8 = load i32, i32* %7, align 4
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  %10 = bitcast %union.tagged* %s to %struct.Circle*
  %11 = getelementptr inbounds %struct.Circle, %struct.Circle* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4, !tbaa !5
  br label %cond.end

cond.false:
  %13 = bitcast %union.tagged* %s to %struct.Square*
  %14 = getelementptr inbounds %struct.Square, %struct.Square* %13, i32 0, i32 1
  %15 = load i32, i32* %14, align 4, !tbaa !8
  br label %cond.end

cond.end:
  %16 = phi i32 [ %12, %cond.true ], [ %15, %cond.false ]
  ret i32 %16

if.end:
  %17 = bitcast %union.tagged* %s to %struct.Tri*
  %18 = getelementptr inbounds %struct.Tri, %struct.Tri* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4
  ret i32 %19
}

define internal noundef i32 @edge(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 1
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = icmp ne i32 %4, 2
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %7 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %8 = load i32, i32* %7, align 4
  %9 = icmp eq i32 %8, 1
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  %10 = bitcast %union.tagged* %s to %struct.Square*
  %11 = getelementptr inbounds %struct.Square, %struct.Square* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4, !tbaa !8
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %12, i32 4)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %16 = bitcast %union.tagged* %s to %struct.Tri*
  %17 = getelementptr inbounds %struct.Tri, %struct.Tri* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4
  %19 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %18, i32 3)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.end:
  %22 = phi i32 [ %14, %ovf.ok ], [ %20, %ovf.ok.1 ]
  ret i32 %22

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @level(i32 noundef %n) #3 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = icmp eq i32 %n, 1
  br i1 %1, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %2 = icmp eq i32 %n, 2
  br i1 %2, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %3 = phi i32 [ 2, %cond.true.2 ], [ 3, %cond.false.2 ]
  br label %cond.end.1

cond.end.1:
  %4 = phi i32 [ 1, %cond.true.1 ], [ %3, %cond.end.2 ]
  br label %cond.end

cond.end:
  %5 = phi i32 [ 0, %cond.true ], [ %4, %cond.end.1 ]
  ret i32 %5
}

define internal noundef i32 @rank(i32 noundef %l) #3 {
entry:
  %0 = icmp eq i32 %l, 0
  br i1 %0, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %1 = icmp eq i32 %l, 1
  br label %lor.end.1

lor.end.1:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.1 ]
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = icmp eq i32 %l, 2
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %lor.end.1 ], [ %3, %lor.rhs ]
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = icmp eq i32 %l, 0
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %6 = icmp eq i32 %l, 1
  br i1 %6, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %7 = phi i32 [ 2, %cond.true.1 ], [ 3, %cond.false.1 ]
  br label %cond.end

cond.end:
  %8 = phi i32 [ 1, %cond.true ], [ %7, %cond.end.1 ]
  ret i32 %8

if.end:
  ret i32 4
}

define internal noundef i32 @lift(i32 noundef %l) #3 {
entry:
  %0 = icmp eq i32 %l, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp ne i32 %l, 1
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = icmp eq i32 %l, 3
  br i1 %3, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %4 = phi i32 [ 9, %cond.true.1 ], [ 5, %cond.false.1 ]
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ %4, %cond.end.1 ], [ 0, %cond.false ]
  ret i32 %5
}

define internal noundef i32 @fresh(i32 noundef %n) #0 {
entry:
  %t.addr = alloca %union.tagged*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %union.tagged* @pick(i32 %n)
  store %union.tagged* %0, %union.tagged** %t.addr, align 8
  %1 = add nsw i32 %n, 1
  %2 = call %union.tagged* @pick(i32 %1)
  store %union.tagged* %2, %union.tagged** %t.addr, align 8
  %3 = getelementptr inbounds %union.tagged, %union.tagged* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  switch i32 %4, label %sw.default [
    i32 0, label %sw.case
  ]

sw.case:
  %5 = load %union.tagged*, %union.tagged** %t.addr, align 8
  %6 = bitcast %union.tagged* %5 to %struct.Circle*
  %7 = getelementptr inbounds %struct.Circle, %struct.Circle* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !5
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %8

sw.default:
  br label %sw.end

sw.end:
  %9 = add nsw i32 %n, 3
  %10 = call %union.tagged* @pick(i32 %9)
  store %union.tagged* %10, %union.tagged** %t.addr, align 8
  %11 = getelementptr inbounds %union.tagged, %union.tagged* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4
  %13 = icmp ne i32 %12, 1
  br i1 %13, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

if.end:
  %14 = load %union.tagged*, %union.tagged** %t.addr, align 8
  %15 = bitcast %union.tagged* %14 to %struct.Square*
  %16 = getelementptr inbounds %struct.Square, %struct.Square* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4, !tbaa !8
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %17
}

define void @nish_main() #2 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
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
  %7 = add nsw i32 %6, 2
  %8 = call %union.tagged* @pick(i32 %7)
  store %union.tagged* %8, %union.tagged** %s.addr, align 8
  %9 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %10 = call i32 @size(%union.tagged* %9)
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 100)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %15 = call i32 @edge(%union.tagged* %14)
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %19)
  %20 = load i32, i32* %total.addr, align 4
  %21 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %22 = call i32 @size(%union.tagged* %21)
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %27 = call i32 @edge(%union.tagged* %26)
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %29, i32* %total.addr, align 4
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %34 = load i8*, i8** %33, align 8
  %35 = icmp eq i8* %34, %3
  br i1 %35, label %pass.rewind, label %pass.free

pass.rewind:
  %36 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %36, align 8
  br label %pass.done

pass.free:
  %37 = ptrtoint i8* %3 to i64
  %38 = add i64 %37, %5
  call void @nish_arena_release(i64 %38)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  store i32 0, i32* %n.addr, align 4
  br label %while.cond.1

while.cond.1:
  %39 = load i32, i32* %n.addr, align 4
  %40 = icmp slt i32 %39, 4
  br i1 %40, label %while.body.1, label %while.end.1

while.body.1:
  %41 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %42 = load i8*, i8** %41, align 8
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %44 = load i64, i64* %43, align 8
  %45 = load i32, i32* %n.addr, align 4
  %46 = call i32 @level(i32 %45)
  %47 = call i32 @rank(i32 %46)
  %48 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %47, i32 10)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %51 = load i32, i32* %n.addr, align 4
  %52 = call i32 @level(i32 %51)
  %53 = call i32 @lift(i32 %52)
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 %53)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %57 = call i8* @nish_str_from_i32(i32 %55)
  call void @nish_print(i8* %57)
  %58 = load i32, i32* %n.addr, align 4
  %59 = add nsw i32 %58, 1
  store i32 %59, i32* %n.addr, align 4
  %60 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %61 = load i8*, i8** %60, align 8
  %62 = icmp eq i8* %61, %42
  br i1 %62, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %63 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %44, i64* %63, align 8
  br label %pass.done.1

pass.free.1:
  %64 = ptrtoint i8* %42 to i64
  %65 = add i64 %64, %44
  call void @nish_arena_release(i64 %65)
  br label %pass.done.1

pass.done.1:
  br label %while.cond.1

while.end.1:
  %66 = load i32, i32* %total.addr, align 4
  %67 = call i32 @fresh(i32 0)
  %68 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %67, i32 1000)
  %69 = extractvalue { i32, i1 } %68, 0
  %70 = extractvalue { i32, i1 } %68, 1
  br i1 %70, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %71 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %66, i32 %69)
  %72 = extractvalue { i32, i1 } %71, 0
  %73 = extractvalue { i32, i1 } %71, 1
  br i1 %73, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %74 = call i32 @fresh(i32 1)
  %75 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %74, i32 10000)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %72, i32 %76)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %81 = call i32 @fresh(i32 2)
  %82 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %81, i32 100000)
  %83 = extractvalue { i32, i1 } %82, 0
  %84 = extractvalue { i32, i1 } %82, 1
  br i1 %84, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %85 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 %83)
  %86 = extractvalue { i32, i1 } %85, 0
  %87 = extractvalue { i32, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  %88 = call i8* @nish_str_from_i32(i32 %86)
  call void @nish_print(i8* %88)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %while.body ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 2, %while.body.1 ], [ 0, %ovf.ok.4 ], [ 2, %while.end.1 ], [ 0, %ovf.ok.6 ], [ 2, %ovf.ok.7 ], [ 0, %ovf.ok.8 ], [ 2, %ovf.ok.9 ], [ 0, %ovf.ok.10 ]
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
