%struct.Log = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"word \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"next \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
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

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @words(i32 noundef %i) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %i)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %18 = trunc i64 %17 to i32
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = call i8* @nish_str_from_i32(i32 %i)
  %21 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8* %20)
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store.1

push.store.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* %21, i8** %30, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %32 = trunc i64 %31 to i32
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %33
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @rows(i32 noundef %i) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %6 = call %struct.nish_array* @words(i32 %i)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %14 = bitcast i8* %13 to %struct.nish_array**
  %15 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %14, i64 %8
  store %struct.nish_array* %6, %struct.nish_array** %15, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = trunc i64 %16 to i32
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %18
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @wrapped(i32 noundef %i) #1 {
entry:
  %0 = tail call %struct.nish_array* @words(i32 %i)
  ret %struct.nish_array* %0
}

define internal noundef nonnull align 8 i8* @firstOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = bitcast i8* %4 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  ret i8* %7
}

define internal noundef nonnull align 8 i8* @firstWord(i32 noundef %i) #1 {
entry:
  %ws.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @words(i32 %i)
  store %struct.nish_array* %0, %struct.nish_array** %ws.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %7 = bitcast i8* %6 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 0
  %9 = load i8*, i8** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  ret i8* %9
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %kept.addr = alloca i8*, align 8
  %viaCall.addr = alloca i8*, align 8
  %popped.addr = alloca i8*, align 8
  %nested.addr = alloca i8*, align 8
  %walked.addr = alloca i8*, align 8
  %wrap.addr = alloca i8*, align 8
  %returned.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %i.addr.3 = alloca i32, align 4
  %ws.addr = alloca %struct.nish_array*, align 8
  %i.addr.4 = alloca i32, align 4
  %i.addr.5 = alloca i32, align 4
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %i.addr.6 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %kept.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %viaCall.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %popped.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %nested.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %walked.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %wrap.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %returned.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 1000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call %struct.nish_array* @words(i32 %2)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %6 = icmp ult i64 0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 0
  %11 = load i8*, i8** %10, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %11, i8** %kept.addr, align 8
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %14 = load i32, i32* %i.addr.1, align 4
  %15 = icmp slt i32 %14, 1000
  br i1 %15, label %for.body.1, label %for.end.1

for.body.1:
  %16 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %17 = load i32, i32* %i.addr.1, align 4
  %18 = call %struct.nish_array* @words(i32 %17)
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = icmp ult i64 1, %20
  br i1 %21, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %20)
  unreachable

bounds.ok.1:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %24 = bitcast i8* %23 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 1
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %27 = getelementptr inbounds %struct.Log, %struct.Log* %16, i32 0, i32 0
  store i8* %26, i8** %27, align 8, !tbaa !4
  br label %for.inc.1

for.inc.1:
  %28 = load i32, i32* %i.addr.1, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %30 = load i32, i32* %i.addr.2, align 4
  %31 = icmp slt i32 %30, 1000
  br i1 %31, label %for.body.2, label %for.end.2

for.body.2:
  %32 = load i32, i32* %i.addr.2, align 4
  %33 = call %struct.nish_array* @words(i32 %32)
  %34 = call i8* @firstOf(%struct.nish_array* %33)
  store i8* %34, i8** %viaCall.addr, align 8
  br label %for.inc.2

for.inc.2:
  %35 = load i32, i32* %i.addr.2, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %i.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %37 = load i32, i32* %i.addr.3, align 4
  %38 = icmp slt i32 %37, 1000
  br i1 %38, label %for.body.3, label %for.end.3

for.body.3:
  %39 = load i32, i32* %i.addr.3, align 4
  %40 = call %struct.nish_array* @words(i32 %39)
  store %struct.nish_array* %40, %struct.nish_array** %ws.addr, align 8
  %41 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %44 = icmp eq i64 %43, 0
  br i1 %44, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %45 = sub i64 %43, 1
  store i64 %45, i64* %42, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %48 = bitcast i8* %47 to i8**
  %49 = getelementptr inbounds i8*, i8** %48, i64 %45
  %50 = load i8*, i8** %49, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %50, i8** %popped.addr, align 8
  br label %for.inc.3

for.inc.3:
  %51 = load i32, i32* %i.addr.3, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  store i32 0, i32* %i.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %53 = load i32, i32* %i.addr.4, align 4
  %54 = icmp slt i32 %53, 1000
  br i1 %54, label %for.body.4, label %for.end.4

for.body.4:
  %55 = load i32, i32* %i.addr.4, align 4
  %56 = call %struct.nish_array* @rows(i32 %55)
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %59 = icmp ult i64 0, %58
  br i1 %59, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %58)
  unreachable

bounds.ok.2:
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %62 = bitcast i8* %61 to %struct.nish_array**
  %63 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %62, i64 0
  %64 = load %struct.nish_array*, %struct.nish_array** %63, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %67 = icmp ult i64 1, %66
  br i1 %67, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %66)
  unreachable

bounds.ok.3:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %70 = bitcast i8* %69 to i8**
  %71 = getelementptr inbounds i8*, i8** %70, i64 1
  %72 = load i8*, i8** %71, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %72, i8** %nested.addr, align 8
  br label %for.inc.4

for.inc.4:
  %73 = load i32, i32* %i.addr.4, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %i.addr.4, align 4
  br label %for.cond.4

for.end.4:
  store i32 0, i32* %i.addr.5, align 4
  br label %for.cond.5

for.cond.5:
  %75 = load i32, i32* %i.addr.5, align 4
  %76 = icmp slt i32 %75, 1000
  br i1 %76, label %for.body.5, label %for.end.5

for.body.5:
  %77 = load i32, i32* %i.addr.5, align 4
  %78 = call %struct.nish_array* @words(i32 %77)
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %79 = load i64, i64* %forof.idx, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %82 = icmp ult i64 %79, %81
  br i1 %82, label %forof.body, label %forof.end

forof.body:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %85 = bitcast i8* %84 to i8**
  %86 = getelementptr inbounds i8*, i8** %85, i64 %79
  %87 = load i8*, i8** %86, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %87, i8** %w.addr, align 8
  %88 = load i8*, i8** %w.addr, align 8
  store i8* %88, i8** %walked.addr, align 8
  br label %forof.inc

forof.inc:
  %89 = load i64, i64* %forof.idx, align 8
  %90 = add i64 %89, 1
  store i64 %90, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %for.inc.5

for.inc.5:
  %91 = load i32, i32* %i.addr.5, align 4
  %92 = add nsw i32 %91, 1
  store i32 %92, i32* %i.addr.5, align 4
  br label %for.cond.5

for.end.5:
  store i32 0, i32* %i.addr.6, align 4
  br label %for.cond.6

for.cond.6:
  %93 = load i32, i32* %i.addr.6, align 4
  %94 = icmp slt i32 %93, 1000
  br i1 %94, label %for.body.6, label %for.end.6

for.body.6:
  %95 = load i32, i32* %i.addr.6, align 4
  %96 = call %struct.nish_array* @wrapped(i32 %95)
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %99 = icmp ult i64 0, %98
  br i1 %99, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %98)
  unreachable

bounds.ok.4:
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %101 = load i8*, i8** %100, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %102 = bitcast i8* %101 to i8**
  %103 = getelementptr inbounds i8*, i8** %102, i64 0
  %104 = load i8*, i8** %103, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store i8* %104, i8** %wrap.addr, align 8
  br label %for.inc.6

for.inc.6:
  %105 = load i32, i32* %i.addr.6, align 4
  %106 = add nsw i32 %105, 1
  store i32 %106, i32* %i.addr.6, align 4
  br label %for.cond.6

for.end.6:
  %107 = call i64 @nish_arena_mark()
  %108 = call i8* @firstWord(i32 999)
  %109 = call i8* @nish_arena_keep(i64 %107, i8* %108)
  store i8* %109, i8** %returned.addr, align 8
  %110 = call i32 @churn()
  %111 = call i8* @nish_str_from_i32(i32 %110)
  call void @nish_print(i8* %111)
  %112 = load i8*, i8** %kept.addr, align 8
  call void @nish_print(i8* %112)
  %113 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %114 = getelementptr inbounds %struct.Log, %struct.Log* %113, i32 0, i32 0
  %115 = load i8*, i8** %114, align 8, !tbaa !4
  call void @nish_print(i8* %115)
  %116 = load i8*, i8** %viaCall.addr, align 8
  call void @nish_print(i8* %116)
  %117 = load i8*, i8** %popped.addr, align 8
  call void @nish_print(i8* %117)
  %118 = load i8*, i8** %nested.addr, align 8
  call void @nish_print(i8* %118)
  %119 = load i8*, i8** %walked.addr, align 8
  call void @nish_print(i8* %119)
  %120 = load i8*, i8** %wrap.addr, align 8
  call void @nish_print(i8* %120)
  %121 = load i8*, i8** %returned.addr, align 8
  call void @nish_print(i8* %121)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.3 to i8*), i8* %8)
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Log", !2, i64 0}
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
