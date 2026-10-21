%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Tri = type { i32, i32 }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %r, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef i32 @Circle.diameter(%struct.Circle* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !5
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 2)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
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

define internal noundef i32 @viaIf(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !5
  ret i32 %5

if.else:
  %6 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = icmp eq i32 %7, 1
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = bitcast %union.tagged* %s to %struct.Square*
  %10 = getelementptr inbounds %struct.Square, %struct.Square* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !8
  %12 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %11, i32 10)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %13

if.end.1:
  %15 = bitcast %union.tagged* %s to %struct.Tri*
  %16 = getelementptr inbounds %struct.Tri, %struct.Tri* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4
  %18 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %17, i32 100)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @viaTernary(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !5
  br label %cond.end

cond.false:
  %6 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = icmp eq i32 %7, 1
  br i1 %8, label %cond.true.1, label %cond.false.1

cond.true.1:
  %9 = bitcast %union.tagged* %s to %struct.Square*
  %10 = getelementptr inbounds %struct.Square, %struct.Square* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !8
  br label %cond.end.1

cond.false.1:
  %12 = bitcast %union.tagged* %s to %struct.Tri*
  %13 = getelementptr inbounds %struct.Tri, %struct.Tri* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  br label %cond.end.1

cond.end.1:
  %15 = phi i32 [ %11, %cond.true.1 ], [ %14, %cond.false.1 ]
  br label %cond.end

cond.end:
  %16 = phi i32 [ %5, %cond.true ], [ %15, %cond.end.1 ]
  ret i32 %16
}

define internal noundef zeroext i1 @viaAnd(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !5
  %6 = icmp sgt i32 %5, 3
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  ret i1 %7
}

define internal noundef zeroext i1 @viaOr(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 1
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = bitcast %union.tagged* %s to %struct.Square*
  %4 = getelementptr inbounds %struct.Square, %struct.Square* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !8
  %6 = icmp sgt i32 %5, 3
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  ret i1 %7
}

define internal noundef i32 @viaEarly(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 2
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = bitcast %union.tagged* %s to %struct.Tri*
  %4 = getelementptr inbounds %struct.Tri, %struct.Tri* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4
  ret i32 %5
}

define internal noundef i32 @viaReversed(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 1, %1
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = bitcast %union.tagged* %s to %struct.Square*
  %4 = getelementptr inbounds %struct.Square, %struct.Square* %3, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !8
  ret i32 %5

if.end:
  ret i32 -1
}

define internal noundef i32 @viaNull(%union.tagged* noundef align 8 nocapture %s) #2 {
entry:
  %0 = icmp ne %union.tagged* %s, null
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  %3 = icmp eq i32 %2, 0
  br label %land.end

land.end:
  %4 = phi i1 [ false, %entry ], [ %3, %land.rhs ]
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = bitcast %union.tagged* %s to %struct.Circle*
  %6 = getelementptr inbounds %struct.Circle, %struct.Circle* %5, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !5
  ret i32 %7

if.end:
  %8 = icmp eq %union.tagged* %s, null
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -2

if.end.1:
  %9 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %10 = load i32, i32* %9, align 4
  %11 = icmp eq i32 %10, 2
  br i1 %11, label %if.then.2, label %if.end.2

if.then.2:
  %12 = bitcast %union.tagged* %s to %struct.Tri*
  %13 = getelementptr inbounds %struct.Tri, %struct.Tri* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  ret i32 %14

if.end.2:
  ret i32 -3
}

define internal noundef i32 @viaLocal(i32 noundef %n) #0 {
entry:
  %s.addr = alloca %union.tagged*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %union.tagged* @pick(i32 %n)
  store %union.tagged* %0, %union.tagged** %s.addr, align 8
  %1 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %2 = getelementptr inbounds %union.tagged, %union.tagged* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = icmp eq i32 %3, 1
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %6 = bitcast %union.tagged* %5 to %struct.Square*
  %7 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !8
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %8

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 7
}

define internal noundef i32 @viaSwitch(%union.tagged* noundef %s) #2 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  switch i32 %1, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %2 = bitcast %union.tagged* %s to %struct.Circle*
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %2, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !5
  ret i32 %4

sw.case.1:
  %5 = bitcast %union.tagged* %s to %struct.Square*
  %6 = getelementptr inbounds %struct.Square, %struct.Square* %5, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !8
  ret i32 %7

sw.default:
  %8 = bitcast %union.tagged* %s to %struct.Tri*
  %9 = getelementptr inbounds %struct.Tri, %struct.Tri* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  ret i32 %10
}

define internal noundef i32 @viaElse(%union.tagged* noundef %s) #1 {
entry:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp ne i32 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  ret i32 0

if.else:
  %3 = bitcast %union.tagged* %s to %struct.Circle*
  %4 = call i32 @Circle.diameter(%struct.Circle* %3)
  ret i32 %4
}

define internal noundef i32 @viaReassign(i32 noundef %n) #0 {
entry:
  %s.addr = alloca %union.tagged*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %union.tagged* @pick(i32 %n)
  store %union.tagged* %0, %union.tagged** %s.addr, align 8
  %1 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %2 = getelementptr inbounds %union.tagged, %union.tagged* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = add nsw i32 %n, 1
  %6 = call %union.tagged* @pick(i32 %5)
  store %union.tagged* %6, %union.tagged** %s.addr, align 8
  %7 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %8 = getelementptr inbounds %union.tagged, %union.tagged* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  %10 = icmp eq i32 %9, 1
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %12 = bitcast %union.tagged* %11 to %struct.Square*
  %13 = getelementptr inbounds %struct.Square, %struct.Square* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !8
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %14

if.end.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -1

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 -2
}

define internal noundef zeroext i1 @viaTag(%union.tagged* noundef %s) #2 {
entry:
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  store i32 %1, i32* %k.addr, align 4
  %2 = load i32, i32* %k.addr, align 4
  %3 = icmp eq i32 %2, 0
  ret i1 %3
}

define void @nish_main() #1 {
entry:
  %i.addr = alloca i32, align 4
  %s.addr = alloca %union.tagged*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 6
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call %union.tagged* @pick(i32 %2)
  store %union.tagged* %3, %union.tagged** %s.addr, align 8
  %4 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %5 = call i32 @viaIf(%union.tagged* %4)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %8 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %9 = call i32 @viaTernary(%union.tagged* %8)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %7, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %13 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %14 = call i1 @viaAnd(%union.tagged* %13)
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %16 = call i8* @nish_str_concat(i8* %12, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %19 = call i1 @viaOr(%union.tagged* %18)
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %24 = call i32 @viaEarly(%union.tagged* %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %29 = call i32 @viaReversed(%union.tagged* %28)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %27, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %34 = call i32 @viaNull(%union.tagged* %33)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %32, i8* %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %38 = load i32, i32* %i.addr, align 4
  %39 = call i32 @viaLocal(i32 %38)
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %37, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %43 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %44 = call i32 @viaSwitch(%union.tagged* %43)
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %42, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %48 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %49 = call i32 @viaElse(%union.tagged* %48)
  %50 = call i8* @nish_str_from_i32(i32 %49)
  %51 = call i8* @nish_str_concat(i8* %47, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %53 = load i32, i32* %i.addr, align 4
  %54 = call i32 @viaReassign(i32 %53)
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %52, i8* %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %58 = load %union.tagged*, %union.tagged** %s.addr, align 8
  %59 = call i1 @viaTag(%union.tagged* %58)
  %60 = select i1 %59, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %61 = call i8* @nish_str_concat(i8* %57, i8* %60)
  call void @nish_print(i8* %61)
  %62 = load i32, i32* %i.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %64 = call i32 @viaNull(%union.tagged* null)
  %65 = call i8* @nish_str_from_i32(i32 %64)
  call void @nish_print(i8* %65)
  call void @nish_arena_release(i64 %arena.mark)
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
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Square", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
