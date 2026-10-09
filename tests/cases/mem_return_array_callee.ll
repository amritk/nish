%struct.Log = type { %struct.nish_array*, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"stored \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"passed \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"read \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"aliased \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"either \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
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

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !15
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %6, align 8, !tbaa !16
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @stored(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %i) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %i)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.nish_array* %19, %struct.nish_array** %20, align 8, !tbaa !15
  %21 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %21
}

define internal void @keepFirst(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  %7 = load i8*, i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %8 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i8* %7, i8** %8, align 8, !tbaa !16
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @passed(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %i) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %i)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*), i8* %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @keepFirst(%struct.Log* %log, %struct.nish_array* %19)
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %20
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @readBack(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %i) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = call i8* @nish_str_from_i32(i32 %i)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* %9)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 0
  store i8* %10, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 0
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %21 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i8* %20, i8** %21, align 8, !tbaa !16
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %22
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @aliased(i32 noundef %i) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %i)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.4 to i8*), i8* %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store %struct.nish_array* %19, %struct.nish_array** %ys.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  ret %struct.nish_array* %20
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @either(i32 noundef %i, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %other) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %i)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i8* %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = icmp sge i32 %i, 0
  br i1 %19, label %cond.true, label %cond.false

cond.true:
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %21 = phi %struct.nish_array* [ %20, %cond.true ], [ %other, %cond.false ]
  ret %struct.nish_array* %21
}

define void @nish_main() #1 {
entry:
  %a.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %b.addr = alloca %struct.Log*, align 8
  %Log.obj.1 = alloca %struct.Log, align 8
  %c.addr = alloca %struct.Log*, align 8
  %Log.obj.2 = alloca %struct.Log, align 8
  %total.addr = alloca i32, align 4
  %viaAlias.addr = alloca %struct.nish_array*, align 8
  %viaChoice.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %i.addr.3 = alloca i32, align 4
  %i.addr.4 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %a.addr, align 8
  call void @Log.constructor(%struct.Log* %Log.obj.1)
  store %struct.Log* %Log.obj.1, %struct.Log** %b.addr, align 8
  call void @Log.constructor(%struct.Log* %Log.obj.2)
  store %struct.Log* %Log.obj.2, %struct.Log** %c.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %viaAlias.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %viaChoice.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 1000
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %total.addr, align 4
  %13 = load %struct.Log*, %struct.Log** %a.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = call %struct.nish_array* @stored(%struct.Log* %13, i32 %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %20, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %24 = load i32, i32* %i.addr.1, align 4
  %25 = icmp slt i32 %24, 1000
  br i1 %25, label %for.body.1, label %for.end.1

for.body.1:
  %26 = load i32, i32* %total.addr, align 4
  %27 = load %struct.Log*, %struct.Log** %b.addr, align 8
  %28 = load i32, i32* %i.addr.1, align 4
  %29 = call %struct.nish_array* @passed(%struct.Log* %27, i32 %28)
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %34, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %36 = load i32, i32* %i.addr.1, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %38 = load i32, i32* %i.addr.2, align 4
  %39 = icmp slt i32 %38, 1000
  br i1 %39, label %for.body.2, label %for.end.2

for.body.2:
  %40 = load i32, i32* %total.addr, align 4
  %41 = load %struct.Log*, %struct.Log** %c.addr, align 8
  %42 = load i32, i32* %i.addr.2, align 4
  %43 = call %struct.nish_array* @readBack(%struct.Log* %41, i32 %42)
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = trunc i64 %45 to i32
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %40, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %48, i32* %total.addr, align 4
  br label %for.inc.2

for.inc.2:
  %50 = load i32, i32* %i.addr.2, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %i.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %52 = load i32, i32* %i.addr.3, align 4
  %53 = icmp slt i32 %52, 1000
  br i1 %53, label %for.body.3, label %for.end.3

for.body.3:
  %54 = load i32, i32* %i.addr.3, align 4
  %55 = call %struct.nish_array* @aliased(i32 %54)
  store %struct.nish_array* %55, %struct.nish_array** %viaAlias.addr, align 8
  br label %for.inc.3

for.inc.3:
  %56 = load i32, i32* %i.addr.3, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  store i32 0, i32* %i.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %58 = load i32, i32* %i.addr.4, align 4
  %59 = icmp slt i32 %58, 1000
  br i1 %59, label %for.body.4, label %for.end.4

for.body.4:
  %60 = load i32, i32* %i.addr.4, align 4
  %61 = call i8* @nish_alloc_struct(i64 24)
  %62 = bitcast i8* %61 to %struct.nish_array*
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  store i64 0, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 1
  store i64 0, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  store i8* null, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = call %struct.nish_array* @either(i32 %60, %struct.nish_array* %62)
  store %struct.nish_array* %66, %struct.nish_array** %viaChoice.addr, align 8
  br label %for.inc.4

for.inc.4:
  %67 = load i32, i32* %i.addr.4, align 4
  %68 = add nsw i32 %67, 1
  store i32 %68, i32* %i.addr.4, align 4
  br label %for.cond.4

for.end.4:
  %69 = call i32 @churn()
  %70 = call i8* @nish_str_from_i32(i32 %69)
  call void @nish_print(i8* %70)
  %71 = load i32, i32* %total.addr, align 4
  %72 = call i8* @nish_str_from_i32(i32 %71)
  call void @nish_print(i8* %72)
  %73 = load %struct.Log*, %struct.Log** %a.addr, align 8
  %74 = getelementptr inbounds %struct.Log, %struct.Log* %73, i32 0, i32 0
  %75 = load %struct.nish_array*, %struct.nish_array** %74, align 8, !tbaa !15
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = icmp ult i64 0, %77
  br i1 %78, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %77)
  unreachable

bounds.ok:
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %81 = bitcast i8* %80 to i8**
  %82 = getelementptr inbounds i8*, i8** %81, i64 0
  %83 = load i8*, i8** %82, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  call void @nish_print(i8* %83)
  %84 = load %struct.Log*, %struct.Log** %b.addr, align 8
  %85 = getelementptr inbounds %struct.Log, %struct.Log* %84, i32 0, i32 1
  %86 = load i8*, i8** %85, align 8, !tbaa !16
  call void @nish_print(i8* %86)
  %87 = load %struct.Log*, %struct.Log** %c.addr, align 8
  %88 = getelementptr inbounds %struct.Log, %struct.Log* %87, i32 0, i32 1
  %89 = load i8*, i8** %88, align 8, !tbaa !16
  call void @nish_print(i8* %89)
  %90 = load %struct.nish_array*, %struct.nish_array** %viaAlias.addr, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = icmp ult i64 0, %92
  br i1 %93, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %92)
  unreachable

bounds.ok.1:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %96 = bitcast i8* %95 to i8**
  %97 = getelementptr inbounds i8*, i8** %96, i64 0
  %98 = load i8*, i8** %97, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  call void @nish_print(i8* %98)
  %99 = load %struct.nish_array*, %struct.nish_array** %viaChoice.addr, align 8
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = icmp ult i64 0, %101
  br i1 %102, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %101)
  unreachable

bounds.ok.2:
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %105 = bitcast i8* %104 to i8**
  %106 = getelementptr inbounds i8*, i8** %105, i64 0
  %107 = load i8*, i8** %106, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  call void @nish_print(i8* %107)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @churn() #1 {
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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.6 to i8*), i8* %8)
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %3
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %3 to i64
  %21 = add i64 %20, %5
  call void @nish_arena_release(i64 %21)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Log", !13, i64 0, !13, i64 8}
!15 = !{!14, !13, i64 0}
!16 = !{!14, !13, i64 8}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
