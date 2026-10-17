%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Holder = type { %union.tagged*, { %struct.nish_array, [2 x %union.tagged*] } }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"garbage \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this, %union.tagged* noundef %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %union.tagged* %s, %union.tagged** %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1, i32 0
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  ret void
}

define internal noundef %union.tagged* @pick(i1 noundef zeroext %round) #0 {
entry:
  br i1 %round, label %cond.true, label %cond.false

cond.true:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !16
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 1
  store i32 3, i32* %3, align 4, !tbaa !17
  %4 = bitcast %struct.Circle* %1 to %union.tagged*
  br label %cond.end

cond.false:
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Square*
  %7 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 0
  store i32 1, i32* %7, align 4, !tbaa !19
  %8 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 1
  store i32 4, i32* %8, align 4, !tbaa !20
  %9 = bitcast %struct.Square* %6 to %union.tagged*
  br label %cond.end

cond.end:
  %10 = phi %union.tagged* [ %4, %cond.true ], [ %9, %cond.false ]
  ret %union.tagged* %10
}

define internal noundef i32 @viaNew(%struct.Holder* noundef nonnull align 8 dereferenceable(48) nocapture %h, i32 noundef %n) #1 {
entry:
  %label.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %label.addr, align 8
  %2 = icmp sgt i32 %n, 0
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = call i8* @nish_alloc_struct(i64 8)
  %4 = bitcast i8* %3 to %struct.Circle*
  %5 = getelementptr inbounds %struct.Circle, %struct.Circle* %4, i32 0, i32 0
  store i32 0, i32* %5, align 4, !tbaa !16
  %6 = getelementptr inbounds %struct.Circle, %struct.Circle* %4, i32 0, i32 1
  store i32 3, i32* %6, align 4, !tbaa !17
  %7 = bitcast %struct.Circle* %4 to %union.tagged*
  br label %cond.end

cond.false:
  %8 = call i8* @nish_alloc_struct(i64 8)
  %9 = bitcast i8* %8 to %struct.Square*
  %10 = getelementptr inbounds %struct.Square, %struct.Square* %9, i32 0, i32 0
  store i32 1, i32* %10, align 4, !tbaa !19
  %11 = getelementptr inbounds %struct.Square, %struct.Square* %9, i32 0, i32 1
  store i32 4, i32* %11, align 4, !tbaa !20
  %12 = bitcast %struct.Square* %9 to %union.tagged*
  br label %cond.end

cond.end:
  %13 = phi %union.tagged* [ %7, %cond.true ], [ %12, %cond.false ]
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %union.tagged* %13, %union.tagged** %14, align 8, !tbaa !4
  %15 = load i8*, i8** %label.addr, align 8
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  ret i32 %18
}

define internal noundef i32 @viaCall(%struct.Holder* noundef nonnull align 8 dereferenceable(48) nocapture %h, i32 noundef %n) #1 {
entry:
  %label.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %label.addr, align 8
  %2 = icmp sgt i32 %n, 0
  %3 = call %union.tagged* @pick(i1 %2)
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %union.tagged* %3, %union.tagged** %4, align 8, !tbaa !4
  %5 = load i8*, i8** %label.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  ret i32 %8
}

define internal noundef i32 @viaLocals(%struct.Holder* noundef nonnull align 8 dereferenceable(48) nocapture %h, i32 noundef %n) #1 {
entry:
  %label.addr = alloca i8*, align 8
  %c.addr = alloca %struct.Circle*, align 8
  %q.addr = alloca %struct.Square*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %label.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !16
  %5 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  store i32 3, i32* %5, align 4, !tbaa !17
  store %struct.Circle* %3, %struct.Circle** %c.addr, align 8
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.Square*
  %8 = getelementptr inbounds %struct.Square, %struct.Square* %7, i32 0, i32 0
  store i32 1, i32* %8, align 4, !tbaa !19
  %9 = getelementptr inbounds %struct.Square, %struct.Square* %7, i32 0, i32 1
  store i32 4, i32* %9, align 4, !tbaa !20
  store %struct.Square* %7, %struct.Square** %q.addr, align 8
  %10 = icmp sgt i32 %n, 0
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load %struct.Circle*, %struct.Circle** %c.addr, align 8
  %12 = bitcast %struct.Circle* %11 to %union.tagged*
  br label %cond.end

cond.false:
  %13 = load %struct.Square*, %struct.Square** %q.addr, align 8
  %14 = bitcast %struct.Square* %13 to %union.tagged*
  br label %cond.end

cond.end:
  %15 = phi %union.tagged* [ %12, %cond.true ], [ %14, %cond.false ]
  %16 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %union.tagged* %15, %union.tagged** %16, align 8, !tbaa !4
  %17 = load i8*, i8** %label.addr, align 8
  %18 = bitcast i8* %17 to i64*
  %19 = load i64, i64* %18, align 8
  %20 = trunc i64 %19 to i32
  ret i32 %20
}

define internal noundef i32 @viaArray(%struct.Holder* noundef nonnull align 8 dereferenceable(48) nocapture %h, i32 noundef %n) #1 {
entry:
  %label.addr = alloca i8*, align 8
  %c.addr = alloca %struct.Circle*, align 8
  %q.addr = alloca %struct.Square*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %label.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !16
  %5 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  store i32 3, i32* %5, align 4, !tbaa !17
  store %struct.Circle* %3, %struct.Circle** %c.addr, align 8
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.Square*
  %8 = getelementptr inbounds %struct.Square, %struct.Square* %7, i32 0, i32 0
  store i32 1, i32* %8, align 4, !tbaa !19
  %9 = getelementptr inbounds %struct.Square, %struct.Square* %7, i32 0, i32 1
  store i32 4, i32* %9, align 4, !tbaa !20
  store %struct.Square* %7, %struct.Square** %q.addr, align 8
  %10 = load %struct.Circle*, %struct.Circle** %c.addr, align 8
  %11 = bitcast %struct.Circle* %10 to %union.tagged*
  %12 = load %struct.Square*, %struct.Square** %q.addr, align 8
  %13 = bitcast %struct.Square* %12 to %union.tagged*
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 0
  %15 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1, i32 1, i64 0
  %16 = bitcast %union.tagged** %15 to i8*
  %17 = bitcast i8* %16 to %union.tagged**
  %18 = getelementptr inbounds %union.tagged*, %union.tagged** %17, i64 0
  store %union.tagged* %11, %union.tagged** %18, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %19 = getelementptr inbounds %union.tagged*, %union.tagged** %17, i64 1
  store %union.tagged* %13, %union.tagged** %19, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 2, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = load i8*, i8** %label.addr, align 8
  %22 = bitcast i8* %21 to i64*
  %23 = load i64, i64* %22, align 8
  %24 = trunc i64 %23 to i32
  ret i32 %24
}

define internal noundef i32 @viaPush(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %n) #1 {
entry:
  %label.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %label.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Circle*
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 0
  store i32 0, i32* %4, align 4, !tbaa !16
  %5 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1
  store i32 3, i32* %5, align 4, !tbaa !17
  %6 = bitcast %struct.Circle* %3 to %union.tagged*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 8)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %14 = bitcast i8* %13 to %union.tagged**
  %15 = getelementptr inbounds %union.tagged*, %union.tagged** %14, i64 %8
  store %union.tagged* %6, %union.tagged** %15, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = trunc i64 %16 to i32
  %18 = load i8*, i8** %label.addr, align 8
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = trunc i64 %20 to i32
  ret i32 %21
}

define internal noundef i32 @churn() #1 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca %struct.Square*, align 8
  %p.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x %struct.Square*], align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 100
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Square*
  %4 = getelementptr inbounds %struct.Square, %struct.Square* %3, i32 0, i32 0
  store i32 1, i32* %4, align 4, !tbaa !19
  %5 = getelementptr inbounds %struct.Square, %struct.Square* %3, i32 0, i32 1
  store i32 4, i32* %5, align 4, !tbaa !20
  store %struct.Square* %3, %struct.Square** %s.addr, align 8
  %6 = load %struct.Square*, %struct.Square** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Square, %struct.Square* %6, i32 0, i32 1
  store i32 7, i32* %7, align 4, !tbaa !20
  %8 = load %struct.Square*, %struct.Square** %s.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %11 = bitcast [1 x %struct.Square*]* %arr.data to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %13 = bitcast i8* %11 to %struct.Square**
  %14 = getelementptr inbounds %struct.Square*, %struct.Square** %13, i64 0
  store %struct.Square* %8, %struct.Square** %14, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %p.addr, align 8
  %15 = load i32, i32* %t.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %p.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %19 = bitcast i8* %18 to %struct.Square**
  %20 = getelementptr inbounds %struct.Square*, %struct.Square** %19, i64 0
  %21 = load %struct.Square*, %struct.Square** %20, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %22 = getelementptr inbounds %struct.Square, %struct.Square* %21, i32 0, i32 1
  %23 = load i32, i32* %22, align 4, !tbaa !20
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %25, i32* %t.addr, align 4
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %29 = load i32, i32* %t.addr, align 4
  ret i32 %29

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %h1.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %h2.addr = alloca %struct.Holder*, align 8
  %Holder.obj.1 = alloca %struct.Holder, align 8
  %h3.addr = alloca %struct.Holder*, align 8
  %Holder.obj.2 = alloca %struct.Holder, align 8
  %h4.addr = alloca %struct.Holder*, align 8
  %Holder.obj.3 = alloca %struct.Holder, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %big.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 1, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 1
  store i64 2, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 1, i32 1, i64 0
  %4 = bitcast %union.tagged** %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %6 = call i8* @nish_alloc_struct(i64 8)
  %7 = bitcast i8* %6 to %struct.Square*
  %8 = getelementptr inbounds %struct.Square, %struct.Square* %7, i32 0, i32 0
  store i32 1, i32* %8, align 4, !tbaa !19
  %9 = getelementptr inbounds %struct.Square, %struct.Square* %7, i32 0, i32 1
  store i32 4, i32* %9, align 4, !tbaa !20
  %10 = bitcast %struct.Square* %7 to %union.tagged*
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %union.tagged* %10)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h1.addr, align 8
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.1, i32 0, i32 1, i32 0
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 2, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.1, i32 0, i32 1, i32 1, i64 0
  %15 = bitcast %union.tagged** %14 to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %17 = call i8* @nish_alloc_struct(i64 8)
  %18 = bitcast i8* %17 to %struct.Square*
  %19 = getelementptr inbounds %struct.Square, %struct.Square* %18, i32 0, i32 0
  store i32 1, i32* %19, align 4, !tbaa !19
  %20 = getelementptr inbounds %struct.Square, %struct.Square* %18, i32 0, i32 1
  store i32 4, i32* %20, align 4, !tbaa !20
  %21 = bitcast %struct.Square* %18 to %union.tagged*
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1, %union.tagged* %21)
  store %struct.Holder* %Holder.obj.1, %struct.Holder** %h2.addr, align 8
  %22 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.2, i32 0, i32 1, i32 0
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  store i64 0, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  store i64 2, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %25 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.2, i32 0, i32 1, i32 1, i64 0
  %26 = bitcast %union.tagged** %25 to i8*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %28 = call i8* @nish_alloc_struct(i64 8)
  %29 = bitcast i8* %28 to %struct.Square*
  %30 = getelementptr inbounds %struct.Square, %struct.Square* %29, i32 0, i32 0
  store i32 1, i32* %30, align 4, !tbaa !19
  %31 = getelementptr inbounds %struct.Square, %struct.Square* %29, i32 0, i32 1
  store i32 4, i32* %31, align 4, !tbaa !20
  %32 = bitcast %struct.Square* %29 to %union.tagged*
  call void @Holder.constructor(%struct.Holder* %Holder.obj.2, %union.tagged* %32)
  store %struct.Holder* %Holder.obj.2, %struct.Holder** %h3.addr, align 8
  %33 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.3, i32 0, i32 1, i32 0
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  store i64 0, i64* %34, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  store i64 2, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %36 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.3, i32 0, i32 1, i32 1, i64 0
  %37 = bitcast %union.tagged** %36 to i8*
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %39 = call i8* @nish_alloc_struct(i64 8)
  %40 = bitcast i8* %39 to %struct.Square*
  %41 = getelementptr inbounds %struct.Square, %struct.Square* %40, i32 0, i32 0
  store i32 1, i32* %41, align 4, !tbaa !19
  %42 = getelementptr inbounds %struct.Square, %struct.Square* %40, i32 0, i32 1
  store i32 4, i32* %42, align 4, !tbaa !20
  %43 = bitcast %struct.Square* %40 to %union.tagged*
  call void @Holder.constructor(%struct.Holder* %Holder.obj.3, %union.tagged* %43)
  store %struct.Holder* %Holder.obj.3, %struct.Holder** %h4.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %44, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %45, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %46, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %47 = load %struct.Holder*, %struct.Holder** %h1.addr, align 8
  %48 = call i32 @viaNew(%struct.Holder* %47, i32 5)
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %51 = load %struct.Holder*, %struct.Holder** %h2.addr, align 8
  %52 = call i32 @viaCall(%struct.Holder* %51, i32 5)
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %50, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %56 = load %struct.Holder*, %struct.Holder** %h3.addr, align 8
  %57 = call i32 @viaLocals(%struct.Holder* %56, i32 5)
  %58 = call i8* @nish_str_from_i32(i32 %57)
  %59 = call i8* @nish_str_concat(i8* %55, i8* %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %61 = load %struct.Holder*, %struct.Holder** %h4.addr, align 8
  %62 = call i32 @viaArray(%struct.Holder* %61, i32 5)
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %60, i8* %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %66 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %67 = call i32 @viaPush(%struct.nish_array* %66, i32 5)
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %65, i8* %68)
  call void @nish_print(i8* %69)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %70, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %71, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %72, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %big.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %73 = load i32, i32* %i.addr, align 4
  %74 = icmp slt i32 %73, 100
  br i1 %74, label %while.body, label %while.end

while.body:
  %75 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %76 = load i32, i32* %i.addr, align 4
  %77 = call i8* @nish_str_from_i32(i32 %76)
  %78 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*), i8* %77)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %80 = load i32, i32* %i.addr, align 4
  %81 = mul nsw i32 %80, 7
  %82 = call i8* @nish_str_from_i32(i32 %81)
  %83 = call i8* @nish_str_concat(i8* %79, i8* %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %85 = load i32, i32* %i.addr, align 4
  %86 = mul nsw i32 %85, 13
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* %84, i8* %87)
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 1
  %92 = load i64, i64* %91, align 8, !alias.scope !8, !noalias !9, !tbaa !23
  %93 = icmp eq i64 %90, %92
  br i1 %93, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %75, i64 8)
  br label %push.store

push.store:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %96 = bitcast i8* %95 to i8**
  %97 = getelementptr inbounds i8*, i8** %96, i64 %90
  store i8* %88, i8** %97, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %98 = add i64 %90, 1
  store i64 %98, i64* %89, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %99 = trunc i64 %98 to i32
  %100 = load i32, i32* %i.addr, align 4
  %101 = add nsw i32 %100, 1
  store i32 %101, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %102 = call i32 @churn()
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = call i8* @nish_str_concat(i8* %103, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %105 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %108 = trunc i64 %107 to i32
  %109 = call i8* @nish_str_from_i32(i32 %108)
  %110 = call i8* @nish_str_concat(i8* %104, i8* %109)
  call void @nish_print(i8* %110)
  %111 = load %struct.Holder*, %struct.Holder** %h1.addr, align 8
  %112 = getelementptr inbounds %struct.Holder, %struct.Holder* %111, i32 0, i32 0
  %113 = load %union.tagged*, %union.tagged** %112, align 8, !tbaa !4
  %114 = getelementptr inbounds %union.tagged, %union.tagged* %113, i32 0, i32 0
  %115 = load i32, i32* %114, align 4
  %116 = icmp eq i32 %115, 0
  %117 = select i1 %116, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %118 = call i8* @nish_str_concat(i8* %117, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %119 = load %struct.Holder*, %struct.Holder** %h2.addr, align 8
  %120 = getelementptr inbounds %struct.Holder, %struct.Holder* %119, i32 0, i32 0
  %121 = load %union.tagged*, %union.tagged** %120, align 8, !tbaa !4
  %122 = getelementptr inbounds %union.tagged, %union.tagged* %121, i32 0, i32 0
  %123 = load i32, i32* %122, align 4
  %124 = icmp eq i32 %123, 0
  %125 = select i1 %124, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %126 = call i8* @nish_str_concat(i8* %118, i8* %125)
  %127 = call i8* @nish_str_concat(i8* %126, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %128 = load %struct.Holder*, %struct.Holder** %h3.addr, align 8
  %129 = getelementptr inbounds %struct.Holder, %struct.Holder* %128, i32 0, i32 0
  %130 = load %union.tagged*, %union.tagged** %129, align 8, !tbaa !4
  %131 = getelementptr inbounds %union.tagged, %union.tagged* %130, i32 0, i32 0
  %132 = load i32, i32* %131, align 4
  %133 = icmp eq i32 %132, 0
  %134 = select i1 %133, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %135 = call i8* @nish_str_concat(i8* %127, i8* %134)
  call void @nish_print(i8* %135)
  %136 = load %struct.Holder*, %struct.Holder** %h4.addr, align 8
  %137 = getelementptr inbounds %struct.Holder, %struct.Holder* %136, i32 0, i32 1, i32 0
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 0
  %139 = load i64, i64* %138, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %140 = icmp ult i64 0, %139
  br i1 %140, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %139)
  unreachable

bounds.ok:
  %141 = getelementptr inbounds %struct.Holder, %struct.Holder* %136, i32 0, i32 1, i32 1, i64 0
  %142 = bitcast %union.tagged** %141 to i8*
  %143 = bitcast i8* %142 to %union.tagged**
  %144 = getelementptr inbounds %union.tagged*, %union.tagged** %143, i64 0
  %145 = load %union.tagged*, %union.tagged** %144, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %146 = getelementptr inbounds %union.tagged, %union.tagged* %145, i32 0, i32 0
  %147 = load i32, i32* %146, align 4
  %148 = icmp eq i32 %147, 0
  %149 = select i1 %148, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %150 = call i8* @nish_str_concat(i8* %149, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %151 = load %struct.Holder*, %struct.Holder** %h4.addr, align 8
  %152 = getelementptr inbounds %struct.Holder, %struct.Holder* %151, i32 0, i32 1, i32 0
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %152, i64 0, i32 0
  %154 = load i64, i64* %153, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %155 = icmp ult i64 1, %154
  br i1 %155, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %154)
  unreachable

bounds.ok.1:
  %156 = getelementptr inbounds %struct.Holder, %struct.Holder* %151, i32 0, i32 1, i32 1, i64 0
  %157 = bitcast %union.tagged** %156 to i8*
  %158 = bitcast i8* %157 to %union.tagged**
  %159 = getelementptr inbounds %union.tagged*, %union.tagged** %158, i64 1
  %160 = load %union.tagged*, %union.tagged** %159, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %161 = getelementptr inbounds %union.tagged, %union.tagged* %160, i32 0, i32 0
  %162 = load i32, i32* %161, align 4
  %163 = icmp eq i32 %162, 1
  %164 = select i1 %163, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %165 = call i8* @nish_str_concat(i8* %150, i8* %164)
  %166 = call i8* @nish_str_concat(i8* %165, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %167 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %167, i64 0, i32 0
  %169 = load i64, i64* %168, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %170 = icmp ult i64 0, %169
  br i1 %170, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %169)
  unreachable

bounds.ok.2:
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %167, i64 0, i32 2
  %172 = load i8*, i8** %171, align 8, !alias.scope !8, !noalias !9, !tbaa !24
  %173 = bitcast i8* %172 to %union.tagged**
  %174 = getelementptr inbounds %union.tagged*, %union.tagged** %173, i64 0
  %175 = load %union.tagged*, %union.tagged** %174, align 8, !alias.scope !9, !noalias !8, !tbaa !22
  %176 = getelementptr inbounds %union.tagged, %union.tagged* %175, i32 0, i32 0
  %177 = load i32, i32* %176, align 4
  %178 = icmp eq i32 %177, 0
  %179 = select i1 %178, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %180 = call i8* @nish_str_concat(i8* %166, i8* %179)
  call void @nish_print(i8* %180)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
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
!14 = !{!"i32", !1, i64 0}
!15 = !{!"Circle", !14, i64 0, !14, i64 4}
!16 = !{!15, !14, i64 0}
!17 = !{!15, !14, i64 4}
!18 = !{!"Square", !14, i64 0, !14, i64 4}
!19 = !{!18, !14, i64 0}
!20 = !{!18, !14, i64 4}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!12, !10, i64 8}
!24 = !{!12, !11, i64 16}
