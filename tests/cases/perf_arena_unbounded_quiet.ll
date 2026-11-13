%struct.Entry = type { i32 }
%struct.Log = type { %struct.Entry*, i32, i32 }
%struct.Batch = type { %struct.nish_array* }
%struct.Board = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"request \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"cell \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"row \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"a \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"b \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"c \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mark \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"tag \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"found \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"gone \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"post \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"peek \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
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
  %a.addr = alloca i64, align 8
  %reply.addr = alloca i8*, align 8
  store i32 0, i32* %served.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = call i64 @nish_arena_mark()
  store i64 %1, i64* %a.addr, align 8
  %2 = load i64, i64* %a.addr, align 8
  %3 = load i32, i32* %served.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8* %4)
  store i8* %5, i8** %reply.addr, align 8
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !8
  %8 = load i8*, i8** %reply.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  %15 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %13, i32* %15, align 4, !tbaa !8
  call void @nish_arena_release(i64 %2)
  %16 = call i8* @nish_alloc_struct(i64 4)
  %17 = bitcast i8* %16 to %struct.Entry*
  %18 = load i32, i32* %served.addr, align 4
  call void @Entry.constructor(%struct.Entry* %17, i32 %18)
  %19 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %17, %struct.Entry** %19, align 8, !tbaa !7
  %20 = load i32, i32* %served.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 1)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %22, i32* %served.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @counted(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %cell.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %3)
  store i8* %4, i8** %cell.addr, align 8
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !8
  %7 = load i8*, i8** %cell.addr, align 8
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
  %17 = load i32, i32* %i.addr, align 4
  call void @Entry.constructor(%struct.Entry* %16, i32 %17)
  %18 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %16, %struct.Entry** %18, align 8, !tbaa !7
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @dropped(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %last.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %k.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* %2)
  store i8* %3, i8** %last.addr, align 8
  %4 = load i32, i32* %k.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %8 = load i8*, i8** %last.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @droppedSplit(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %last.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %k.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %2)
  store i8* %3, i8** %last.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = bitcast i8* %4 to %struct.Entry*
  %6 = load i32, i32* %k.addr, align 4
  call void @Entry.constructor(%struct.Entry* %5, i32 %6)
  %7 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %5, %struct.Entry** %7, align 8, !tbaa !7
  %8 = load i32, i32* %k.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 1)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %12 = load i8*, i8** %last.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @scans(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %a.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  %b.addr = alloca i8*, align 8
  %j.addr = alloca i32, align 4
  %c.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i8* %3)
  store i8* %4, i8** %a.addr, align 8
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !8
  %7 = load i8*, i8** %a.addr, align 8
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
  %17 = load i32, i32* %i.addr, align 4
  call void @Entry.constructor(%struct.Entry* %16, i32 %17)
  %18 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %16, %struct.Entry** %18, align 8, !tbaa !7
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %while.cond

while.end:
  store i32 0, i32* %k.addr, align 4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  br label %for.cond

for.cond:
  %23 = load i32, i32* %k.addr, align 4
  %24 = trunc i64 %22 to i32
  %25 = icmp slt i32 %23, %24
  br i1 %25, label %for.body, label %for.end

for.body:
  %26 = load i32, i32* %k.addr, align 4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i8* %27)
  store i8* %28, i8** %b.addr, align 8
  %29 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %30 = load i32, i32* %29, align 4, !tbaa !8
  %31 = load i8*, i8** %b.addr, align 8
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = trunc i64 %33 to i32
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %38 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %36, i32* %38, align 4, !tbaa !8
  %39 = call i8* @nish_alloc_struct(i64 4)
  %40 = bitcast i8* %39 to %struct.Entry*
  %41 = load i32, i32* %k.addr, align 4
  call void @Entry.constructor(%struct.Entry* %40, i32 %41)
  %42 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %40, %struct.Entry** %42, align 8, !tbaa !7
  br label %for.inc

for.inc:
  %43 = load i32, i32* %k.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %45 = sub nsw i32 %n, 1
  store i32 %45, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  %46 = load i32, i32* %j.addr, align 4
  %47 = icmp sge i32 %46, 0
  br i1 %47, label %land.rhs, label %land.end

land.rhs:
  %48 = load i32, i32* %j.addr, align 4
  %49 = icmp slt i32 %48, %n
  br label %land.end

land.end:
  %50 = phi i1 [ false, %while.cond.1 ], [ %49, %land.rhs ]
  br i1 %50, label %while.body.1, label %while.end.1

while.body.1:
  %51 = load i32, i32* %j.addr, align 4
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.6 to i8*), i8* %52)
  store i8* %53, i8** %c.addr, align 8
  %54 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %55 = load i32, i32* %54, align 4, !tbaa !8
  %56 = load i8*, i8** %c.addr, align 8
  %57 = bitcast i8* %56 to i64*
  %58 = load i64, i64* %57, align 8
  %59 = trunc i64 %58 to i32
  %60 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %55, i32 %59)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %63 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %61, i32* %63, align 4, !tbaa !8
  %64 = call i8* @nish_alloc_struct(i64 4)
  %65 = bitcast i8* %64 to %struct.Entry*
  %66 = load i32, i32* %j.addr, align 4
  call void @Entry.constructor(%struct.Entry* %65, i32 %66)
  %67 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %65, %struct.Entry** %67, align 8, !tbaa !7
  %68 = load i32, i32* %j.addr, align 4
  %69 = sub nsw i32 %68, 1
  store i32 %69, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @grow(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %2 = trunc i64 %1 to i32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 4)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  store i32 %2, i32* %11, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %13 = trunc i64 %12 to i32
  ret void
}

define internal void @owned(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %other) #1 {
entry:
  %ids.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %id.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %mark.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ids.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %ids.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  %16 = load i32, i32* %15, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store i32 %16, i32* %id.addr, align 4
  %17 = load i32, i32* %id.addr, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), i8* %18)
  store i8* %19, i8** %mark.addr, align 8
  %20 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %21 = load i32, i32* %20, align 4, !tbaa !8
  %22 = load i8*, i8** %mark.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  %29 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %27, i32* %29, align 4, !tbaa !8
  %30 = call i8* @nish_alloc_struct(i64 4)
  %31 = bitcast i8* %30 to %struct.Entry*
  %32 = load i32, i32* %id.addr, align 4
  call void @Entry.constructor(%struct.Entry* %31, i32 %32)
  %33 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %31, %struct.Entry** %33, align 8, !tbaa !7
  call void @grow(%struct.nish_array* %other)
  br label %forof.inc

forof.inc:
  %34 = load i64, i64* %forof.idx, align 8
  %35 = add i64 %34, 1
  store i64 %35, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Batch.constructor(%struct.Batch* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 3, i32* %7, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 4, i32* %8, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %9 = getelementptr inbounds %struct.Batch, %struct.Batch* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %9, align 8, !tbaa !24
  ret void
}

define internal void @fielded(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, %struct.Batch* noundef nonnull readonly align 8 dereferenceable(8) nocapture %batch, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %other) #1 {
entry:
  %id.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %tag.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.Batch, %struct.Batch* %batch, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store i32 %10, i32* %id.addr, align 4
  %11 = load i32, i32* %id.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* %12)
  store i8* %13, i8** %tag.addr, align 8
  %14 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %15 = load i32, i32* %14, align 4, !tbaa !8
  %16 = load i8*, i8** %tag.addr, align 8
  %17 = bitcast i8* %16 to i64*
  %18 = load i64, i64* %17, align 8
  %19 = trunc i64 %18 to i32
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  %23 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %21, i32* %23, align 4, !tbaa !8
  %24 = call i8* @nish_alloc_struct(i64 4)
  %25 = bitcast i8* %24 to %struct.Entry*
  %26 = load i32, i32* %id.addr, align 4
  call void @Entry.constructor(%struct.Entry* %25, i32 %26)
  %27 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %25, %struct.Entry** %27, align 8, !tbaa !7
  call void @grow(%struct.nish_array* %other)
  br label %forof.inc

forof.inc:
  %28 = load i64, i64* %forof.idx, align 8
  %29 = add i64 %28, 1
  store i64 %29, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @scoped(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %total.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %2 = load i8*, i8** %1, align 8
  %3 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %4 = load i64, i64* %3, align 8
  %5 = load i32, i32* %k.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*), i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load i32, i32* %total.addr, align 4
  %9 = load i8*, i8** %s.addr, align 8
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %total.addr, align 4
  %16 = load i32, i32* %k.addr, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 1)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %18, i32* %k.addr, align 4
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = icmp eq i8* %21, %2
  br i1 %22, label %pass.rewind, label %pass.free

pass.rewind:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %4, i64* %23, align 8
  br label %pass.done

pass.free:
  %24 = ptrtoint i8* %2 to i64
  %25 = add i64 %24, %4
  call void @nish_arena_release(i64 %25)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %26 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %26

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @finds(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %k.addr = alloca i32, align 4
  %found.addr = alloca i8*, align 8
  %gone.addr = alloca i8*, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.Entry*
  %3 = load i32, i32* %k.addr, align 4
  call void @Entry.constructor(%struct.Entry* %2, i32 %3)
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %2, %struct.Entry** %4, align 8, !tbaa !7
  %5 = load i32, i32* %k.addr, align 4
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 1)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %k.addr, align 4
  %9 = load i32, i32* %k.addr, align 4
  %10 = icmp eq i32 %9, 2
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %k.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*), i8* %12)
  store i8* %13, i8** %found.addr, align 8
  %14 = load i8*, i8** %found.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  ret i32 %17

if.end:
  %18 = load i32, i32* %k.addr, align 4
  %19 = icmp eq i32 %18, 9
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = load i32, i32* %k.addr, align 4
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*), i8* %21)
  store i8* %22, i8** %gone.addr, align 8
  %23 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %24 = load i32, i32* %23, align 4, !tbaa !8
  %25 = load i8*, i8** %gone.addr, align 8
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %32 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %30, i32* %32, align 4, !tbaa !8
  br label %while.end

if.end.1:
  br label %while.cond

while.end:
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Board.constructor(%struct.Board* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %0, align 8, !tbaa !26
  ret void
}

define internal void @pin(%struct.Board* noundef nonnull align 8 dereferenceable(8) nocapture %board, i8* noundef nonnull noalias readonly align 8 %title) #0 {
entry:
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %board, i32 0, i32 0
  store i8* %title, i8** %0, align 8, !tbaa !26
  ret void
}

define internal void @posts(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, %struct.Board* noundef nonnull align 8 dereferenceable(8) nocapture %board) #1 {
entry:
  %k.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %k.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.12 to i8*), i8* %2)
  call void @pin(%struct.Board* %board, i8* %3)
  %4 = load i32, i32* %k.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %k.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %t.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %t.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %t.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @reads(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %ids.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %id.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %peek.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 5, i32* %5, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 6, i32* %6, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ids.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %ids.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  %16 = load i32, i32* %15, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  store i32 %16, i32* %id.addr, align 4
  %17 = load i32, i32* %id.addr, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.13 to i8*), i8* %18)
  store i8* %19, i8** %peek.addr, align 8
  %20 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %21 = load i32, i32* %20, align 4, !tbaa !8
  %22 = load i8*, i8** %peek.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  %29 = load %struct.nish_array*, %struct.nish_array** %ids.addr, align 8
  %30 = call i32 @sum(%struct.nish_array* %29)
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %30)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %34 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %32, i32* %34, align 4, !tbaa !8
  %35 = call i8* @nish_alloc_struct(i64 4)
  %36 = bitcast i8* %35 to %struct.Entry*
  %37 = load i32, i32* %id.addr, align 4
  call void @Entry.constructor(%struct.Entry* %36, i32 %37)
  %38 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %36, %struct.Entry** %38, align 8, !tbaa !7
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %d.addr = alloca i32, align 4
  %e.addr = alloca i32, align 4
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %Batch.obj = alloca %struct.Batch, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [1 x i32], align 8
  %k.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %board.addr = alloca %struct.Board*, align 8
  %Board.obj = alloca %struct.Board, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %0 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %0, i32 0, i32 2
  store i32 3, i32* %1, align 4, !tbaa !9
  %2 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @serve(%struct.Log* %2)
  %3 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @counted(%struct.Log* %3, i32 3)
  %4 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %4, i32 0, i32 2
  store i32 4, i32* %5, align 4, !tbaa !9
  %6 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %7 = call i32 @dropped(%struct.Log* %6)
  store i32 %7, i32* %d.addr, align 4
  %8 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %9 = getelementptr inbounds %struct.Log, %struct.Log* %8, i32 0, i32 2
  store i32 2, i32* %9, align 4, !tbaa !9
  %10 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %11 = call i32 @droppedSplit(%struct.Log* %10)
  store i32 %11, i32* %e.addr, align 4
  %12 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %13, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %14, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %15 = bitcast [2 x i32]* %arr.data to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 1, i32* %18, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 2, i32* %19, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  call void @scans(%struct.Log* %12, %struct.nish_array* %arr.hdr, i32 2)
  %20 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %21, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %22, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %23 = bitcast [1 x i32]* %arr.data.1 to i8*
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %23, i8** %24, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %25 = bitcast i8* %23 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 0
  store i32 0, i32* %26, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  call void @owned(%struct.Log* %20, %struct.nish_array* %arr.hdr.1)
  %27 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @Batch.constructor(%struct.Batch* %Batch.obj)
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 1, i64* %28, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 1, i64* %29, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %30 = bitcast [1 x i32]* %arr.data.2 to i8*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %32 = bitcast i8* %30 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 0
  store i32 0, i32* %33, align 4, !alias.scope !14, !noalias !13, !tbaa !22
  call void @fielded(%struct.Log* %27, %struct.Batch* %Batch.obj, %struct.nish_array* %arr.hdr.2)
  %34 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %35 = getelementptr inbounds %struct.Log, %struct.Log* %34, i32 0, i32 2
  store i32 5, i32* %35, align 4, !tbaa !9
  %36 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %37 = call i32 @scoped(%struct.Log* %36)
  store i32 %37, i32* %k.addr, align 4
  %38 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %39 = getelementptr inbounds %struct.Log, %struct.Log* %38, i32 0, i32 2
  store i32 5, i32* %39, align 4, !tbaa !9
  %40 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %41 = call i32 @finds(%struct.Log* %40)
  store i32 %41, i32* %f.addr, align 4
  call void @Board.constructor(%struct.Board* %Board.obj)
  store %struct.Board* %Board.obj, %struct.Board** %board.addr, align 8
  %42 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %43 = getelementptr inbounds %struct.Log, %struct.Log* %42, i32 0, i32 2
  store i32 2, i32* %43, align 4, !tbaa !9
  %44 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %45 = load %struct.Board*, %struct.Board** %board.addr, align 8
  call void @posts(%struct.Log* %44, %struct.Board* %45)
  %46 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @reads(%struct.Log* %46)
  %47 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %48 = getelementptr inbounds %struct.Log, %struct.Log* %47, i32 0, i32 1
  %49 = load i32, i32* %48, align 4, !tbaa !8
  %50 = call i8* @nish_str_from_i32(i32 %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %52 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %53 = getelementptr inbounds %struct.Log, %struct.Log* %52, i32 0, i32 0
  %54 = load %struct.Entry*, %struct.Entry** %53, align 8, !tbaa !7
  %55 = getelementptr inbounds %struct.Entry, %struct.Entry* %54, i32 0, i32 0
  %56 = load i32, i32* %55, align 4, !tbaa !4
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %51, i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %60 = load i32, i32* %d.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %59, i8* %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %64 = load i32, i32* %e.addr, align 4
  %65 = call i8* @nish_str_from_i32(i32 %64)
  %66 = call i8* @nish_str_concat(i8* %63, i8* %65)
  %67 = call i8* @nish_str_concat(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %68 = load i32, i32* %k.addr, align 4
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = call i8* @nish_str_concat(i8* %67, i8* %69)
  %71 = call i8* @nish_str_concat(i8* %70, i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %72 = load i32, i32* %f.addr, align 4
  %73 = call i8* @nish_str_from_i32(i32 %72)
  %74 = call i8* @nish_str_concat(i8* %71, i8* %73)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.14 to i8*))
  %76 = load %struct.Board*, %struct.Board** %board.addr, align 8
  %77 = getelementptr inbounds %struct.Board, %struct.Board* %76, i32 0, i32 0
  %78 = load i8*, i8** %77, align 8, !tbaa !26
  %79 = call i8* @nish_str_concat(i8* %75, i8* %78)
  call void @nish_print(i8* %79)
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

!llvm.module.flags = !{!27, !28, !29, !30, !31}
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
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"Batch", !5, i64 0}
!24 = !{!23, !5, i64 0}
!25 = !{!"Board", !5, i64 0}
!26 = !{!25, !5, i64 0}
!27 = !{i32 8, !"cf-protection-branch", i32 1}
!28 = !{i32 8, !"cf-protection-return", i32 1}
!29 = !{i32 8, !"branch-target-enforcement", i32 1}
!30 = !{i32 8, !"sign-return-address", i32 1}
!31 = !{i32 4, !"probe-stack", !"inline-asm"}
