%struct.Entry = type { i32 }
%struct.Log = type { %struct.Entry*, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"request \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"k\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"sent \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"id \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"left \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"peer \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define internal void @Entry.constructor(%struct.Entry* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Entry, %struct.Entry* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Entry*
  call void @Entry.constructor(%struct.Entry* %1, i32 0)
  %2 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store %struct.Entry* %1, %struct.Entry** %2, align 8, !tbaa !7
  %3 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1
  store i32 0, i32* %3, align 4, !tbaa !8
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 2
  store i32 0, i32* %4, align 4, !tbaa !9
  ret void
}

define internal noundef zeroext i1 @more(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %1 = load i32, i32* %0, align 4, !tbaa !9
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  store i32 %3, i32* %5, align 4, !tbaa !9
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %7 = load i32, i32* %6, align 4, !tbaa !9
  %8 = icmp sge i32 %7, 0
  ret i1 %8

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @serve(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %served.addr = alloca i32, align 4
  %reply.addr = alloca i8*, align 8
  store i32 0, i32* %served.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %served.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8* %2)
  store i8* %3, i8** %reply.addr, align 8
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !8
  %6 = load i8*, i8** %reply.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %11, i32* %13, align 4, !tbaa !8
  %14 = call i8* @nish_alloc_struct(i64 4)
  %15 = bitcast i8* %14 to %struct.Entry*
  %16 = load i32, i32* %served.addr, align 4
  call void @Entry.constructor(%struct.Entry* %15, i32 %16)
  %17 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %15, %struct.Entry** %17, align 8, !tbaa !7
  %18 = load i32, i32* %served.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 1)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %20, i32* %served.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @rounds(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %n) #1 {
entry:
  %round.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %cell.addr = alloca i8*, align 8
  store i32 0, i32* %round.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = call i1 @more(%struct.Log* %log)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, %n
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %round.addr, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  store i8* %9, i8** %cell.addr, align 8
  %10 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !8
  %12 = load i8*, i8** %cell.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %17, i32* %19, align 4, !tbaa !8
  %20 = call i8* @nish_alloc_struct(i64 4)
  %21 = bitcast i8* %20 to %struct.Entry*
  %22 = load i32, i32* %i.addr, align 4
  call void @Entry.constructor(%struct.Entry* %21, i32 %22)
  %23 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %21, %struct.Entry** %23, align 8, !tbaa !7
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load i32, i32* %round.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 1)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %28, i32* %round.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @pair(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %k.addr = alloca i32, align 4
  %name.addr = alloca i8*, align 8
  %label.addr = alloca i8*, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %k.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %2)
  store i8* %3, i8** %name.addr, align 8
  %4 = load i32, i32* %k.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = call i8* @nish_str_from_i32(i32 %6)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %8)
  store i8* %9, i8** %label.addr, align 8
  %10 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !8
  %12 = load i8*, i8** %name.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = load i8*, i8** %label.addr, align 8
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %24, i32* %26, align 4, !tbaa !8
  %27 = call i8* @nish_alloc_struct(i64 4)
  %28 = bitcast i8* %27 to %struct.Entry*
  %29 = load i32, i32* %k.addr, align 4
  call void @Entry.constructor(%struct.Entry* %28, i32 %29)
  %30 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %28, %struct.Entry** %30, align 8, !tbaa !7
  %31 = load i32, i32* %k.addr, align 4
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 1)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %33, i32* %k.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @drain(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %total) #1 {
entry:
  %sent.addr = alloca i32, align 4
  %line.addr = alloca i8*, align 8
  store i32 0, i32* %sent.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %sent.addr, align 4
  %1 = icmp slt i32 %0, %total
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = call i1 @more(%struct.Log* %log)
  br label %land.end

land.end:
  %3 = phi i1 [ false, %while.cond ], [ %2, %land.rhs ]
  br i1 %3, label %while.body, label %while.end

while.body:
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !8
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), i8* %6)
  store i8* %7, i8** %line.addr, align 8
  %8 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %9 = load i32, i32* %8, align 4, !tbaa !8
  %10 = load i8*, i8** %line.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %15, i32* %17, align 4, !tbaa !8
  %18 = call i8* @nish_alloc_struct(i64 4)
  %19 = bitcast i8* %18 to %struct.Entry*
  %20 = load i32, i32* %sent.addr, align 4
  call void @Entry.constructor(%struct.Entry* %19, i32 %20)
  %21 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %19, %struct.Entry** %21, align 8, !tbaa !7
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @walk(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %queue) #1 {
entry:
  %id.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %tag.addr = alloca i8*, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %queue, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %queue, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  store i32 %8, i32* %id.addr, align 4
  %9 = load i32, i32* %id.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*), i8* %10)
  store i8* %11, i8** %tag.addr, align 8
  %12 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %13 = load i32, i32* %12, align 4, !tbaa !8
  %14 = load i8*, i8** %tag.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %19, i32* %21, align 4, !tbaa !8
  %22 = call i8* @nish_alloc_struct(i64 4)
  %23 = bitcast i8* %22 to %struct.Entry*
  %24 = load i32, i32* %id.addr, align 4
  call void @Entry.constructor(%struct.Entry* %23, i32 %24)
  %25 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %23, %struct.Entry** %25, align 8, !tbaa !7
  %26 = call i1 @more(%struct.Log* %log)
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load i32, i32* %id.addr, align 4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 1)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %queue, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %queue, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !13, !noalias !14, !tbaa !22
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %queue, i64 4)
  br label %push.store

push.store:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %queue, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %29, i32* %39, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %41 = trunc i64 %40 to i32
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %42 = load i64, i64* %forof.idx, align 8
  %43 = add i64 %42, 1
  store i64 %43, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @probe(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  br label %while.cond

while.cond:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %1 = load i32, i32* %0, align 4, !tbaa !9
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp sgt i32 %5, 0
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = call i1 @more(%struct.Log* %log)
  br label %land.end

land.end:
  %8 = phi i1 [ false, %while.cond ], [ %7, %land.rhs ]
  br i1 %8, label %while.body, label %while.end

while.body:
  %9 = call i8* @nish_alloc_struct(i64 4)
  %10 = bitcast i8* %9 to %struct.Entry*
  %11 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %12 = load i32, i32* %11, align 4, !tbaa !9
  call void @Entry.constructor(%struct.Entry* %10, i32 %12)
  %13 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %10, %struct.Entry** %13, align 8, !tbaa !7
  br label %while.cond

while.end:
  ret void
}

define internal void @flag(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %running.addr = alloca i1, align 1
  %note.addr = alloca i8*, align 8
  store i1 true, i1* %running.addr, align 1
  br label %while.cond

while.cond:
  %0 = load i1, i1* %running.addr, align 1
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %2 = load i32, i32* %1, align 4, !tbaa !9
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), i8* %3)
  store i8* %4, i8** %note.addr, align 8
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !8
  %7 = load i8*, i8** %note.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %12, i32* %14, align 4, !tbaa !8
  %15 = call i8* @nish_alloc_struct(i64 4)
  %16 = bitcast i8* %15 to %struct.Entry*
  %17 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %18 = load i32, i32* %17, align 4, !tbaa !9
  call void @Entry.constructor(%struct.Entry* %16, i32 %18)
  %19 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %16, %struct.Entry** %19, align 8, !tbaa !7
  %20 = call i1 @more(%struct.Log* %log)
  store i1 %20, i1* %running.addr, align 1
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @accept$(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %next.addr = alloca i32, align 4
  %peer.addr = alloca i8*, align 8
  store i32 0, i32* %next.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %next.addr, align 4
  %1 = icmp sge i32 %0, 0
  br i1 %1, label %lor.end, label %lor.rhs

lor.rhs:
  %2 = load i32, i32* %next.addr, align 4
  %3 = icmp eq i32 %2, -2
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %while.cond ], [ %3, %lor.rhs ]
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %next.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %6)
  store i8* %7, i8** %peer.addr, align 8
  %8 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %9 = load i32, i32* %8, align 4, !tbaa !8
  %10 = load i8*, i8** %peer.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %15, i32* %17, align 4, !tbaa !8
  %18 = call i8* @nish_alloc_struct(i64 4)
  %19 = bitcast i8* %18 to %struct.Entry*
  %20 = load i32, i32* %next.addr, align 4
  call void @Entry.constructor(%struct.Entry* %19, i32 %20)
  %21 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %19, %struct.Entry** %21, align 8, !tbaa !7
  %22 = call i1 @more(%struct.Log* %log)
  br i1 %22, label %cond.true, label %cond.false

cond.true:
  %23 = load i32, i32* %next.addr, align 4
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 1)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %27 = phi i32 [ %25, %ovf.ok.1 ], [ -1, %cond.false ]
  store i32 %27, i32* %next.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %0 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %0, i32 0, i32 2
  store i32 3, i32* %1, align 4, !tbaa !9
  %2 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @serve(%struct.Log* %2)
  %3 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %3, i32 0, i32 2
  store i32 2, i32* %4, align 4, !tbaa !9
  %5 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @rounds(%struct.Log* %5, i32 3)
  %6 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %7 = getelementptr inbounds %struct.Log, %struct.Log* %6, i32 0, i32 2
  store i32 2, i32* %7, align 4, !tbaa !9
  %8 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @pair(%struct.Log* %8)
  %9 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %10 = getelementptr inbounds %struct.Log, %struct.Log* %9, i32 0, i32 2
  store i32 2, i32* %10, align 4, !tbaa !9
  %11 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @drain(%struct.Log* %11, i32 5)
  %12 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %13 = getelementptr inbounds %struct.Log, %struct.Log* %12, i32 0, i32 2
  store i32 2, i32* %13, align 4, !tbaa !9
  %14 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %15, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %16, align 8, !alias.scope !13, !noalias !14, !tbaa !22
  %17 = bitcast [1 x i32]* %arr.data to i8*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %19 = bitcast i8* %17 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 7, i32* %20, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  call void @walk(%struct.Log* %14, %struct.nish_array* %arr.hdr)
  %21 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %22 = getelementptr inbounds %struct.Log, %struct.Log* %21, i32 0, i32 2
  store i32 2, i32* %22, align 4, !tbaa !9
  %23 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @probe(%struct.Log* %23)
  %24 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %25 = getelementptr inbounds %struct.Log, %struct.Log* %24, i32 0, i32 2
  store i32 2, i32* %25, align 4, !tbaa !9
  %26 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @flag(%struct.Log* %26)
  %27 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %28 = getelementptr inbounds %struct.Log, %struct.Log* %27, i32 0, i32 2
  store i32 2, i32* %28, align 4, !tbaa !9
  %29 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @accept$(%struct.Log* %29)
  %30 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %31 = getelementptr inbounds %struct.Log, %struct.Log* %30, i32 0, i32 1
  %32 = load i32, i32* %31, align 4, !tbaa !8
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %35 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %36 = getelementptr inbounds %struct.Log, %struct.Log* %35, i32 0, i32 0
  %37 = load %struct.Entry*, %struct.Entry** %36, align 8, !tbaa !7
  %38 = getelementptr inbounds %struct.Entry, %struct.Entry* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %34, i8* %40)
  call void @nish_print(i8* %41)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
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

!llvm.module.flags = !{!23, !24, !25, !26, !27}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Entry", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Log", !5, i64 0, !2, i64 8, !2, i64 12}
!7 = !{!6, !5, i64 0}
!8 = !{!6, !2, i64 8}
!9 = !{!6, !2, i64 12}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !16, i64 16}
!20 = !{!"element i32", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{!17, !15, i64 8}
!23 = !{i32 8, !"cf-protection-branch", i32 1}
!24 = !{i32 8, !"cf-protection-return", i32 1}
!25 = !{i32 8, !"branch-target-enforcement", i32 1}
!26 = !{i32 8, !"sign-return-address", i32 1}
!27 = !{i32 4, !"probe-stack", !"inline-asm"}
