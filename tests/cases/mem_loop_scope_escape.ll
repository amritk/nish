%struct.Log = type { i8*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"word-\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !4
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !16
  ret void
}

define internal noundef nonnull align 8 i8* @word(i32 noundef %i) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef nonnull align 8 i8* @keepLast(i32 noundef %rounds) #0 {
entry:
  %last.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %w.addr, align 8
  %6 = load i8*, i8** %w.addr, align 8
  store i8* %6, i8** %last.addr, align 8
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i8*, i8** %last.addr, align 8
  ret i8* %9
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @keepAll(i32 noundef %rounds) #0 {
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
  %6 = icmp slt i32 %5, %rounds
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @word(i32 %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %13
  store i8* %11, i8** %20, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %22 = trunc i64 %21 to i32
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %25
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @growAll(i32 noundef %rounds) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
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
  %6 = icmp slt i32 %5, %rounds
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i64 @nish_arena_mark()
  %9 = call i8* @word(i32 %7)
  %10 = call i8* @nish_arena_keep(i64 %8, i8* %9)
  store i8* %10, i8** %w.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %12 = load i8*, i8** %w.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 4)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  store i32 %15, i32* %24, align 4, !alias.scope !9, !noalias !8, !tbaa !20
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %26 = trunc i64 %25 to i32
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %29
}

define internal void @keepField(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %rounds) #0 {
entry:
  %i.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %w.addr, align 8
  %6 = load i8*, i8** %w.addr, align 8
  %7 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store i8* %6, i8** %7, align 8, !tbaa !4
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @remember(%struct.Log* noundef nonnull readonly align 8 dereferenceable(16) nocapture %log, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 %3
  store i8* %s, i8** %10, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = trunc i64 %11 to i32
  ret void
}

define internal noundef i32 @keepThroughCallee(%struct.Log* noundef nonnull readonly align 8 dereferenceable(16) nocapture %log, i32 noundef %rounds) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @remember(%struct.Log* %log, i8* %5)
  %6 = load i32, i32* %n.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i32, i32* %n.addr, align 4
  ret i32 %10
}

define internal void @note(%struct.Log* noundef nonnull readonly align 8 dereferenceable(16) nocapture %log, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !16
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @word(i32 %i)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %6
  store i8* %4, i8** %13, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %14 = add i64 %6, 1
  store i64 %14, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = trunc i64 %14 to i32
  ret void
}

define internal noundef i32 @keepInCallee(%struct.Log* noundef nonnull readonly align 8 dereferenceable(16) nocapture %log, i32 noundef %rounds) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  call void @note(%struct.Log* %log, i32 %2)
  %3 = load i32, i32* %n.addr, align 4
  %4 = add nsw i32 %3, 1
  store i32 %4, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i32, i32* %n.addr, align 4
  ret i32 %7
}

define internal noundef nonnull align 8 i8* @joined(i32 noundef %rounds) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i8*, i8** %s.addr, align 8
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @word(i32 %3)
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %2, i8* %6)
  store i8* %7, i8** %s.addr, align 8
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i8*, i8** %s.addr, align 8
  ret i8* %10
}

define internal noundef nonnull align 8 i8* @firstLong(i32 noundef %rounds, i32 noundef %want) #0 {
entry:
  %i.addr = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @word(i32 %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %w.addr, align 8
  %6 = load i8*, i8** %w.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = icmp sge i32 %9, %want
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i8*, i8** %w.addr, align 8
  ret i8* %11

if.end:
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)
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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.2 to i8*), i8* %8)
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
  %last.addr = alloca i8*, align 8
  %all.addr = alloca %struct.nish_array*, align 8
  %grown.addr = alloca %struct.nish_array*, align 8
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %n.addr = alloca i32, align 4
  %noted.addr = alloca %struct.Log*, align 8
  %Log.obj.1 = alloca %struct.Log, align 8
  %m.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %long.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @keepLast(i32 50)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %last.addr, align 8
  %3 = call %struct.nish_array* @keepAll(i32 50)
  store %struct.nish_array* %3, %struct.nish_array** %all.addr, align 8
  %4 = call %struct.nish_array* @growAll(i32 50)
  store %struct.nish_array* %4, %struct.nish_array** %grown.addr, align 8
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %5 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @keepField(%struct.Log* %5, i32 50)
  %6 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %7 = call i32 @keepThroughCallee(%struct.Log* %6, i32 50)
  store i32 %7, i32* %n.addr, align 4
  call void @Log.constructor(%struct.Log* %Log.obj.1)
  store %struct.Log* %Log.obj.1, %struct.Log** %noted.addr, align 8
  %8 = load %struct.Log*, %struct.Log** %noted.addr, align 8
  %9 = call i32 @keepInCallee(%struct.Log* %8, i32 50)
  store i32 %9, i32* %m.addr, align 4
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @joined(i32 12)
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  store i8* %12, i8** %s.addr, align 8
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @firstLong(i32 500, i32 8)
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  store i8* %15, i8** %long.addr, align 8
  %16 = call i32 @churn()
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  %18 = load i8*, i8** %last.addr, align 8
  call void @nish_print(i8* %18)
  %19 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %22 = trunc i64 %21 to i32
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %25 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = icmp ult i64 0, %27
  br i1 %28, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %27)
  unreachable

bounds.ok:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 0
  %33 = load i8*, i8** %32, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %34 = call i8* @nish_str_concat(i8* %24, i8* %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %36 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %39 = icmp ult i64 49, %38
  br i1 %39, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 49, i64 %38)
  unreachable

bounds.ok.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 49
  %44 = load i8*, i8** %43, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %45 = call i8* @nish_str_concat(i8* %35, i8* %44)
  call void @nish_print(i8* %45)
  %46 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %49 = trunc i64 %48 to i32
  %50 = call i8* @nish_str_from_i32(i32 %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %52 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %55 = icmp ult i64 0, %54
  br i1 %55, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %54)
  unreachable

bounds.ok.2:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 0
  %60 = load i32, i32* %59, align 4, !alias.scope !9, !noalias !8, !tbaa !20
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %51, i8* %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %64 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %67 = icmp ult i64 49, %66
  br i1 %67, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 49, i64 %66)
  unreachable

bounds.ok.3:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 49
  %72 = load i32, i32* %71, align 4, !alias.scope !9, !noalias !8, !tbaa !20
  %73 = call i8* @nish_str_from_i32(i32 %72)
  %74 = call i8* @nish_str_concat(i8* %63, i8* %73)
  call void @nish_print(i8* %74)
  %75 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %76 = getelementptr inbounds %struct.Log, %struct.Log* %75, i32 0, i32 0
  %77 = load i8*, i8** %76, align 8, !tbaa !4
  call void @nish_print(i8* %77)
  %78 = load i32, i32* %n.addr, align 4
  %79 = call i8* @nish_str_from_i32(i32 %78)
  %80 = call i8* @nish_str_concat(i8* %79, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %81 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %82 = getelementptr inbounds %struct.Log, %struct.Log* %81, i32 0, i32 1
  %83 = load %struct.nish_array*, %struct.nish_array** %82, align 8, !tbaa !16
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %86 = icmp ult i64 0, %85
  br i1 %86, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %85)
  unreachable

bounds.ok.4:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %89 = bitcast i8* %88 to i8**
  %90 = getelementptr inbounds i8*, i8** %89, i64 0
  %91 = load i8*, i8** %90, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %92 = call i8* @nish_str_concat(i8* %80, i8* %91)
  %93 = call i8* @nish_str_concat(i8* %92, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %94 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %95 = getelementptr inbounds %struct.Log, %struct.Log* %94, i32 0, i32 1
  %96 = load %struct.nish_array*, %struct.nish_array** %95, align 8, !tbaa !16
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %99 = icmp ult i64 49, %98
  br i1 %99, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 49, i64 %98)
  unreachable

bounds.ok.5:
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %101 = load i8*, i8** %100, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %102 = bitcast i8* %101 to i8**
  %103 = getelementptr inbounds i8*, i8** %102, i64 49
  %104 = load i8*, i8** %103, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %105 = call i8* @nish_str_concat(i8* %93, i8* %104)
  call void @nish_print(i8* %105)
  %106 = load i32, i32* %m.addr, align 4
  %107 = call i8* @nish_str_from_i32(i32 %106)
  %108 = call i8* @nish_str_concat(i8* %107, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %109 = load %struct.Log*, %struct.Log** %noted.addr, align 8
  %110 = getelementptr inbounds %struct.Log, %struct.Log* %109, i32 0, i32 1
  %111 = load %struct.nish_array*, %struct.nish_array** %110, align 8, !tbaa !16
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %114 = icmp ult i64 0, %113
  br i1 %114, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %113)
  unreachable

bounds.ok.6:
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %117 = bitcast i8* %116 to i8**
  %118 = getelementptr inbounds i8*, i8** %117, i64 0
  %119 = load i8*, i8** %118, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %120 = call i8* @nish_str_concat(i8* %108, i8* %119)
  %121 = call i8* @nish_str_concat(i8* %120, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %122 = load %struct.Log*, %struct.Log** %noted.addr, align 8
  %123 = getelementptr inbounds %struct.Log, %struct.Log* %122, i32 0, i32 1
  %124 = load %struct.nish_array*, %struct.nish_array** %123, align 8, !tbaa !16
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  %126 = load i64, i64* %125, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %127 = icmp ult i64 49, %126
  br i1 %127, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 49, i64 %126)
  unreachable

bounds.ok.7:
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %130 = bitcast i8* %129 to i8**
  %131 = getelementptr inbounds i8*, i8** %130, i64 49
  %132 = load i8*, i8** %131, align 8, !alias.scope !9, !noalias !8, !tbaa !18
  %133 = call i8* @nish_str_concat(i8* %121, i8* %132)
  call void @nish_print(i8* %133)
  %134 = load i8*, i8** %s.addr, align 8
  call void @nish_print(i8* %134)
  %135 = load i8*, i8** %long.addr, align 8
  call void @nish_print(i8* %135)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Log", !2, i64 0, !2, i64 8}
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
!16 = !{!3, !2, i64 8}
!17 = !{!"element ptr", !1, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
