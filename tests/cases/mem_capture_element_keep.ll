%struct.Log = type { i8*, i8*, %struct.Box* }
%struct.Box = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"[\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"{\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"}\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
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
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4

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

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %1, align 8, !tbaa !5
  %2 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 2
  store %struct.Box* null, %struct.Box** %2, align 8, !tbaa !6
  ret void
}

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* %s, i8** %0, align 8, !tbaa !8
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @build(%struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = call i8* @nish_str_from_i32(i32 %n)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %11 = load i32, i32* %i.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %18 = load i64, i64* %17, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %19 = icmp eq i64 %16, %18
  br i1 %19, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  store i8* %14, i8** %23, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %24 = add i64 %16, 1
  store i64 %24, i64* %15, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %25 = trunc i64 %24 to i32
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %31 = trunc i64 %30 to i32
  %32 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @atLast$fn.12.build$arrow0(i32 %31, %struct.Log* %log, %struct.nish_array* %32)
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %33
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @listing(i32 noundef %n) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = call i8* @nish_str_from_i32(i32 %n)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %11 = load i32, i32* %i.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %18 = load i64, i64* %17, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %19 = icmp eq i64 %16, %18
  br i1 %19, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  store i8* %14, i8** %23, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %24 = add i64 %16, 1
  store i64 %24, i64* %15, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %25 = trunc i64 %24 to i32
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %28
}

define internal noundef i32 @pick(%struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @listing(i32 %n)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = trunc i64 %3 to i32
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @atLast$fn.11.pick$arrow0(i32 %4, %struct.Log* %log, %struct.nish_array* %5)
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define internal noundef i32 @hold(%struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, i32 noundef %n) #1 {
entry:
  %bs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Box*], align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Box*
  %2 = call i8* @nish_str_from_i32(i32 %n)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* %2)
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  call void @Box.constructor(%struct.Box* %1, i8* %4)
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Box*
  %7 = add nsw i32 %n, 1
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  call void @Box.constructor(%struct.Box* %6, i8* %10)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %11, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %12, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %13 = bitcast [2 x %struct.Box*]* %arr.data to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %15 = bitcast i8* %13 to %struct.Box**
  %16 = getelementptr inbounds %struct.Box*, %struct.Box** %15, i64 0
  store %struct.Box* %1, %struct.Box** %16, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %17 = getelementptr inbounds %struct.Box*, %struct.Box** %15, i64 1
  store %struct.Box* %6, %struct.Box** %17, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bs.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %21 = trunc i64 %20 to i32
  %22 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  call void @atLast$fn.11.hold$arrow0(i32 %21, %struct.Log* %log, %struct.nish_array* %22)
  %23 = load %struct.nish_array*, %struct.nish_array** %bs.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %26 = trunc i64 %25 to i32
  ret i32 %26
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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.8 to i8*), i8* %8)
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

define internal noundef i32 @buildLength(%struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, i32 noundef %n) #1 {
entry:
  %0 = call %struct.nish_array* @build(%struct.Log* %log, i32 %n)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = trunc i64 %2 to i32
  ret i32 %3
}

define internal noundef i32 @pickLength(%struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, i32 noundef %n) #1 {
entry:
  %0 = call i32 @pick(%struct.Log* %log, i32 %n)
  ret i32 %0
}

define internal noundef i32 @holdLength(%struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, i32 noundef %n) #1 {
entry:
  %0 = call i32 @hold(%struct.Log* %log, i32 %n)
  ret i32 %0
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %box.addr = alloca %struct.Box*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 1000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = srem i32 %4, 9
  %6 = add nsw i32 1, %5
  %7 = call i32 @buildLength(%struct.Log* %3, i32 %6)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %12 = load i32, i32* %i.addr, align 4
  %13 = srem i32 %12, 7
  %14 = add nsw i32 1, %13
  %15 = call i32 @pickLength(%struct.Log* %11, i32 %14)
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %20 = load i32, i32* %i.addr, align 4
  %21 = call i32 @holdLength(%struct.Log* %19, i32 %20)
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %23, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = call i32 @churn()
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  %29 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %30 = getelementptr inbounds %struct.Log, %struct.Log* %29, i32 0, i32 2
  %31 = load %struct.Box*, %struct.Box** %30, align 8, !tbaa !6
  store %struct.Box* %31, %struct.Box** %box.addr, align 8
  %32 = load i32, i32* %total.addr, align 4
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %35 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %36 = getelementptr inbounds %struct.Log, %struct.Log* %35, i32 0, i32 0
  %37 = load i8*, i8** %36, align 8, !tbaa !4
  %38 = call i8* @nish_str_concat(i8* %34, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %40 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %41 = getelementptr inbounds %struct.Log, %struct.Log* %40, i32 0, i32 1
  %42 = load i8*, i8** %41, align 8, !tbaa !5
  %43 = call i8* @nish_str_concat(i8* %39, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %45 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %46 = icmp eq %struct.Box* %45, null
  br i1 %46, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %47 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %48 = getelementptr inbounds %struct.Box, %struct.Box* %47, i32 0, i32 0
  %49 = load i8*, i8** %48, align 8, !tbaa !8
  br label %cond.end

cond.end:
  %50 = phi i8* [ bitcast ({ i64, [2 x i8] }* @.str.10 to i8*), %cond.true ], [ %49, %cond.false ]
  %51 = call i8* @nish_str_concat(i8* %44, i8* %50)
  call void @nish_print(i8* %51)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @build$arrow0(i32 noundef %i, %struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %9 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store i8* %8, i8** %9, align 8, !tbaa !4
  ret void
}

define internal void @pick$arrow0(i32 noundef %i, %struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 %0
  %8 = load i8*, i8** %7, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %9 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i8* %8, i8** %9, align 8, !tbaa !5
  ret void
}

define internal void @hold$arrow0(i32 noundef %i, %struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %log, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bs) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %6 = bitcast i8* %5 to %struct.Box**
  %7 = getelementptr inbounds %struct.Box*, %struct.Box** %6, i64 %0
  %8 = load %struct.Box*, %struct.Box** %7, align 8, !alias.scope !13, !noalias !12, !tbaa !21
  %9 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  store %struct.Box* %8, %struct.Box** %9, align 8, !tbaa !6
  ret void
}

define internal void @atLast$fn.12.build$arrow0(i32 noundef %n, %struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %cap.1) #1 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @build$arrow0(i32 %1, %struct.Log* %cap.0, %struct.nish_array* %cap.1)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @atLast$fn.11.pick$arrow0(i32 noundef %n, %struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %cap.1) #1 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @pick$arrow0(i32 %1, %struct.Log* %cap.0, %struct.nish_array* %cap.1)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @atLast$fn.11.hold$arrow0(i32 noundef %n, %struct.Log* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %cap.1) #1 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @hold$arrow0(i32 %1, %struct.Log* %cap.0, %struct.nish_array* %cap.1)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Log", !2, i64 0, !2, i64 8, !2, i64 16}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 8}
!6 = !{!3, !2, i64 16}
!7 = !{!"Box", !2, i64 0}
!8 = !{!7, !2, i64 0}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element ptr", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
