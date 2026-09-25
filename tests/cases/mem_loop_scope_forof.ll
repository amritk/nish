%struct.Box = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [39 x i8] } { i64 38, [39 x i8] c"yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"grows\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_div(i1 noundef zeroext) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @words(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %9)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  store i8* %10, i8** %19, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %24
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @squares(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = mul nsw i32 %8, %9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = bitcast i8* %17 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %12
  store i32 %10, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %24
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box* @letters(i32 noundef %rounds) #1 {
entry:
  %total.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %r.addr, align 4
  %7 = icmp eq i32 5, 0
  %8 = icmp eq i32 %6, -2147483648
  %9 = icmp eq i32 5, -1
  %10 = and i1 %8, %9
  %11 = or i1 %7, %10
  br i1 %11, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %7)
  unreachable

div.ok:
  %12 = srem i32 %6, 5
  %13 = call %struct.nish_array* @squares(i32 %12)
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %forof.body, label %forof.end

forof.body:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  %22 = load i32, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !19
  store i32 %22, i32* %x.addr, align 4
  %23 = load i32, i32* %total.addr, align 4
  %24 = load i32, i32* %x.addr, align 4
  %25 = add nsw i32 %23, %24
  store i32 %25, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %26 = load i64, i64* %forof.idx, align 8
  %27 = add i64 %26, 1
  store i64 %27, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %29 = load i8*, i8** %28, align 8
  %30 = icmp eq i8* %29, %3
  br i1 %30, label %pass.rewind, label %pass.free

pass.rewind:
  %31 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %31, align 8
  br label %pass.done

pass.free:
  %32 = ptrtoint i8* %3 to i64
  %33 = add i64 %32, %5
  call void @nish_arena_release(i64 %33)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %34 = load i32, i32* %r.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %36 = call i8* @nish_alloc_struct(i64 4)
  %37 = bitcast i8* %36 to %struct.Box*
  %38 = load i32, i32* %total.addr, align 4
  call void @Box.constructor(%struct.Box* %37, i32 %38)
  ret %struct.Box* %37
}

define internal noundef nonnull align 8 i8* @longest(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %ws) #0 {
entry:
  %best.addr = alloca i8*, align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %shout.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %best.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ws, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %8, i8** %w.addr, align 8
  %9 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %10 = load i8*, i8** %9, align 8
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %12 = load i64, i64* %11, align 8
  %13 = load i8*, i8** %w.addr, align 8
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %14, i8** %shout.addr, align 8
  %15 = load i8*, i8** %shout.addr, align 8
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = load i8*, i8** %best.addr, align 8
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = add nsw i32 %22, 1
  %24 = icmp sgt i32 %18, %23
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = load i8*, i8** %w.addr, align 8
  store i8* %25, i8** %best.addr, align 8
  br label %if.end

if.end:
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %27 = load i8*, i8** %26, align 8
  %28 = icmp eq i8* %27, %10
  br i1 %28, label %pass.rewind, label %pass.free

pass.rewind:
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %12, i64* %29, align 8
  br label %pass.done

pass.free:
  %30 = ptrtoint i8* %10 to i64
  %31 = add i64 %30, %12
  call void @nish_arena_release(i64 %31)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %32 = load i64, i64* %forof.idx, align 8
  %33 = add i64 %32, 1
  store i64 %33, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %34 = load i8*, i8** %best.addr, align 8
  call void @nish_arena_release(i64 %arena.mark)
  ret i8* %34
}

define internal noundef nonnull align 8 i8* @lastWord(i32 noundef %rounds) #0 {
entry:
  %last.addr = alloca i8*, align 8
  %r.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %r.addr, align 4
  %3 = add nsw i32 %2, 1
  %4 = call %struct.nish_array* @words(i32 %3)
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %5 = load i64, i64* %forof.idx, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %forof.body, label %forof.end

forof.body:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 %5
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %13, i8** %w.addr, align 8
  %14 = load i8*, i8** %w.addr, align 8
  store i8* %14, i8** %last.addr, align 8
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %r.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %19 = load i8*, i8** %last.addr, align 8
  ret i8* %19
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
  %1 = icmp slt i32 %0, 2000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [39 x i8] }* @.str.3 to i8*), i8* %8)
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = add nsw i32 %6, %12
  store i32 %13, i32* %t.addr, align 4
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %15 = load i8*, i8** %14, align 8
  %16 = icmp eq i8* %15, %3
  br i1 %16, label %pass.rewind, label %pass.free

pass.rewind:
  %17 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %17, align 8
  br label %pass.done

pass.free:
  %18 = ptrtoint i8* %3 to i64
  %19 = add i64 %18, %5
  call void @nish_arena_release(i64 %19)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %22
}

define void @nish_main() #1 {
entry:
  %m.addr = alloca i64, align 8
  %before.addr = alloca i64, align 8
  %a.addr = alloca i32, align 4
  %small.addr = alloca i64, align 8
  %m2.addr = alloca i64, align 8
  %before2.addr = alloca i64, align 8
  %b.addr = alloca i32, align 4
  %large.addr = alloca i64, align 8
  %ws.addr = alloca %struct.nish_array*, align 8
  %best.addr = alloca i8*, align 8
  %last.addr = alloca i8*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %m.addr, align 8
  %1 = call i64 @nish_arena_used()
  store i64 %1, i64* %before.addr, align 8
  %2 = call %struct.Box* @letters(i32 5)
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !4
  store i32 %4, i32* %a.addr, align 4
  %5 = call i64 @nish_arena_used()
  %6 = load i64, i64* %before.addr, align 8
  %7 = sub nsw i64 %5, %6
  store i64 %7, i64* %small.addr, align 8
  %8 = load i64, i64* %m.addr, align 8
  call void @nish_arena_release(i64 %8)
  %9 = call i64 @nish_arena_mark()
  store i64 %9, i64* %m2.addr, align 8
  %10 = call i64 @nish_arena_used()
  store i64 %10, i64* %before2.addr, align 8
  %11 = call %struct.Box* @letters(i32 500)
  %12 = getelementptr inbounds %struct.Box, %struct.Box* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !4
  store i32 %13, i32* %b.addr, align 4
  %14 = call i64 @nish_arena_used()
  %15 = load i64, i64* %before2.addr, align 8
  %16 = sub nsw i64 %14, %15
  store i64 %16, i64* %large.addr, align 8
  %17 = load i64, i64* %m2.addr, align 8
  call void @nish_arena_release(i64 %17)
  %18 = load i32, i32* %a.addr, align 4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %21 = load i32, i32* %b.addr, align 4
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %20, i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %25 = load i64, i64* %small.addr, align 8
  %26 = load i64, i64* %large.addr, align 8
  %27 = icmp eq i64 %25, %26
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %28 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), %cond.false ]
  %29 = call i8* @nish_str_concat(i8* %24, i8* %28)
  call void @nish_print(i8* %29)
  %30 = call %struct.nish_array* @words(i32 40)
  store %struct.nish_array* %30, %struct.nish_array** %ws.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %32 = call i64 @nish_arena_mark()
  %33 = call i8* @longest(%struct.nish_array* %31)
  %34 = call i8* @nish_arena_keep(i64 %32, i8* %33)
  store i8* %34, i8** %best.addr, align 8
  %35 = call i8* @lastWord(i32 30)
  store i8* %35, i8** %last.addr, align 8
  %36 = call i32 @churn()
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  %38 = load i8*, i8** %best.addr, align 8
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %40 = load i8*, i8** %last.addr, align 8
  %41 = call i8* @nish_str_concat(i8* %39, i8* %40)
  call void @nish_print(i8* %41)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element ptr", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
