%struct.Box = type { i8* }
%struct.Shelf = type { %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
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

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* %s, i8** %0, align 8, !tbaa !4
  ret void
}

define internal void @Shelf.constructor(%struct.Shelf* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !17
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 0, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 0, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* null, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %11 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %this, i32 0, i32 1
  store %struct.nish_array* %7, %struct.nish_array** %11, align 8, !tbaa !18
  ret void
}

define internal void @stash(%struct.Shelf* noundef nonnull readonly align 8 dereferenceable(16) nocapture %shelf, %struct.Box* noundef nonnull align 8 dereferenceable(8) %b, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %shelf, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
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
  %9 = bitcast i8* %8 to %struct.Box**
  %10 = getelementptr inbounds %struct.Box*, %struct.Box** %9, i64 %3
  store %struct.Box* %b, %struct.Box** %10, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = trunc i64 %11 to i32
  %13 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %shelf, i32 0, i32 1
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !18
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %19 = icmp eq i64 %16, %18
  br i1 %19, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %14, i64 8)
  br label %push.store.1

push.store.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %22 = bitcast i8* %21 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 %16
  store i8* %name, i8** %23, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %24 = add i64 %16, 1
  store i64 %24, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = trunc i64 %24 to i32
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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.0 to i8*), i8* %8)
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

define internal void @fill(%struct.Shelf* noundef nonnull readonly align 8 dereferenceable(16) nocapture %shelf, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %b.addr = alloca %struct.Box*, align 8
  %name.addr = alloca i8*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Box*
  %4 = load i32, i32* %i.addr, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %5)
  call void @Box.constructor(%struct.Box* %3, i8* %6)
  store %struct.Box* %3, %struct.Box** %b.addr, align 8
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %8)
  store i8* %9, i8** %name.addr, align 8
  %10 = load i32, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = bitcast [1 x i32]* %arr.data to i8*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %15 = bitcast i8* %13 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 0
  store i32 %10, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !22
  %17 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %18 = load i8*, i8** %name.addr, align 8
  call void @each$fn.11.fill$arrow0(%struct.nish_array* %arr.hdr, %struct.Shelf* %shelf, %struct.Box* %17, i8* %18)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define void @nish_main() #1 {
entry:
  %shelf.addr = alloca %struct.Shelf*, align 8
  %Shelf.obj = alloca %struct.Shelf, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Shelf.constructor(%struct.Shelf* %Shelf.obj)
  store %struct.Shelf* %Shelf.obj, %struct.Shelf** %shelf.addr, align 8
  %0 = load %struct.Shelf*, %struct.Shelf** %shelf.addr, align 8
  call void @fill(%struct.Shelf* %0, i32 300)
  %1 = call i32 @churn()
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load %struct.Shelf*, %struct.Shelf** %shelf.addr, align 8
  %4 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %3, i32 0, i32 0
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !17
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = icmp ult i64 0, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %11 = bitcast i8* %10 to %struct.Box**
  %12 = getelementptr inbounds %struct.Box*, %struct.Box** %11, i64 0
  %13 = load %struct.Box*, %struct.Box** %12, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %14 = getelementptr inbounds %struct.Box, %struct.Box* %13, i32 0, i32 0
  %15 = load i8*, i8** %14, align 8, !tbaa !4
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %17 = load %struct.Shelf*, %struct.Shelf** %shelf.addr, align 8
  %18 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %17, i32 0, i32 0
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !17
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %22 = icmp ult i64 299, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 299, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %25 = bitcast i8* %24 to %struct.Box**
  %26 = getelementptr inbounds %struct.Box*, %struct.Box** %25, i64 299
  %27 = load %struct.Box*, %struct.Box** %26, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %28 = getelementptr inbounds %struct.Box, %struct.Box* %27, i32 0, i32 0
  %29 = load i8*, i8** %28, align 8, !tbaa !4
  %30 = call i8* @nish_str_concat(i8* %16, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %32 = load %struct.Shelf*, %struct.Shelf** %shelf.addr, align 8
  %33 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %32, i32 0, i32 1
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !18
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %37 = icmp ult i64 0, %36
  br i1 %37, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %36)
  unreachable

bounds.ok.2:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %40 = bitcast i8* %39 to i8**
  %41 = getelementptr inbounds i8*, i8** %40, i64 0
  %42 = load i8*, i8** %41, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %43 = call i8* @nish_str_concat(i8* %31, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %45 = load %struct.Shelf*, %struct.Shelf** %shelf.addr, align 8
  %46 = getelementptr inbounds %struct.Shelf, %struct.Shelf* %45, i32 0, i32 1
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !18
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %50 = icmp ult i64 299, %49
  br i1 %50, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 299, i64 %49)
  unreachable

bounds.ok.3:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %53 = bitcast i8* %52 to i8**
  %54 = getelementptr inbounds i8*, i8** %53, i64 299
  %55 = load i8*, i8** %54, align 8, !alias.scope !9, !noalias !8, !tbaa !20
  %56 = call i8* @nish_str_concat(i8* %44, i8* %55)
  call void @nish_print(i8* %56)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @fill$arrow0(i32 noundef %x, %struct.Shelf* noundef nonnull readonly align 8 dereferenceable(16) nocapture %shelf, %struct.Box* noundef nonnull align 8 dereferenceable(8) %b, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  call void @stash(%struct.Shelf* %shelf, %struct.Box* %b, i8* %name)
  ret void
}

define internal void @each$fn.11.fill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.Shelf* noundef nonnull readonly align 8 dereferenceable(16) nocapture %cap.0, %struct.Box* noundef nonnull align 8 dereferenceable(8) %cap.1, i8* noundef nonnull noalias readonly align 8 %cap.2) #1 {
entry:
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !22
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  call void @fill$arrow0(i32 %9, %struct.Shelf* %cap.0, %struct.Box* %cap.1, i8* %cap.2)
  br label %forof.inc

forof.inc:
  %10 = load i64, i64* %forof.idx, align 8
  %11 = add i64 %10, 1
  store i64 %11, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
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
!2 = !{!"ptr", !1, i64 0}
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
!16 = !{!"Shelf", !2, i64 0, !2, i64 8}
!17 = !{!16, !2, i64 0}
!18 = !{!16, !2, i64 8}
!19 = !{!"element ptr", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{i32 8, !"cf-protection-branch", i32 1}
!24 = !{i32 8, !"cf-protection-return", i32 1}
!25 = !{i32 8, !"branch-target-enforcement", i32 1}
!26 = !{i32 8, !"sign-return-address", i32 1}
!27 = !{i32 4, !"probe-stack", !"inline-asm"}
