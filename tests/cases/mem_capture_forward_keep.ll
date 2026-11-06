%struct.Box = type { i8* }
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

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %boxes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %names, i32 noundef %n) #1 {
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
  store i32 %10, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %17 = load %struct.Box*, %struct.Box** %b.addr, align 8
  %18 = load i8*, i8** %name.addr, align 8
  call void @twice$fn.11.fill$arrow0(%struct.nish_array* %arr.hdr, %struct.nish_array* %boxes, %struct.Box* %17, %struct.nish_array* %names, i8* %18)
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
  %boxes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %boxes.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %names.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  call void @fill(%struct.nish_array* %6, %struct.nish_array* %7, i32 300)
  %8 = call i32 @churn()
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = trunc i64 %12 to i32
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %16 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = icmp ult i64 0, %18
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %18)
  unreachable

bounds.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %22 = bitcast i8* %21 to %struct.Box**
  %23 = getelementptr inbounds %struct.Box*, %struct.Box** %22, i64 0
  %24 = load %struct.Box*, %struct.Box** %23, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %25 = getelementptr inbounds %struct.Box, %struct.Box* %24, i32 0, i32 0
  %26 = load i8*, i8** %25, align 8, !tbaa !4
  %27 = call i8* @nish_str_concat(i8* %15, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %29 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %32 = icmp ult i64 599, %31
  br i1 %32, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 599, i64 %31)
  unreachable

bounds.ok.1:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %35 = bitcast i8* %34 to %struct.Box**
  %36 = getelementptr inbounds %struct.Box*, %struct.Box** %35, i64 599
  %37 = load %struct.Box*, %struct.Box** %36, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %38 = getelementptr inbounds %struct.Box, %struct.Box* %37, i32 0, i32 0
  %39 = load i8*, i8** %38, align 8, !tbaa !4
  %40 = call i8* @nish_str_concat(i8* %28, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %42 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %45 = icmp ult i64 1, %44
  br i1 %45, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %44)
  unreachable

bounds.ok.2:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %48 = bitcast i8* %47 to i8**
  %49 = getelementptr inbounds i8*, i8** %48, i64 1
  %50 = load i8*, i8** %49, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %51 = call i8* @nish_str_concat(i8* %41, i8* %50)
  %52 = call i8* @nish_str_concat(i8* %51, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %53 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %56 = icmp ult i64 598, %55
  br i1 %56, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 598, i64 %55)
  unreachable

bounds.ok.3:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 598
  %61 = load i8*, i8** %60, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %62 = call i8* @nish_str_concat(i8* %52, i8* %61)
  call void @nish_print(i8* %62)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @fill$arrow0(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %boxes, %struct.Box* noundef nonnull align 8 dereferenceable(8) %b, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %names, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %boxes, i64 8)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %7 = bitcast i8* %6 to %struct.Box**
  %8 = getelementptr inbounds %struct.Box*, %struct.Box** %7, i64 %1
  store %struct.Box* %b, %struct.Box** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %names, i64 8)
  br label %push.store.1

push.store.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %names, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  store i8* %name, i8** %19, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %21 = trunc i64 %20 to i32
  ret void
}

define internal void @twice$fn.11.fill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0, %struct.Box* noundef nonnull align 8 dereferenceable(8) %cap.1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.2, i8* noundef nonnull noalias readonly align 8 %cap.3) #1 {
entry:
  call void @each$fn.11.fill$arrow0(%struct.nish_array* %xs, %struct.nish_array* %cap.0, %struct.Box* %cap.1, %struct.nish_array* %cap.2, i8* %cap.3)
  call void @each$fn.11.fill$arrow0(%struct.nish_array* %xs, %struct.nish_array* %cap.0, %struct.Box* %cap.1, %struct.nish_array* %cap.2, i8* %cap.3)
  ret void
}

define internal void @each$fn.11.fill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0, %struct.Box* noundef nonnull align 8 dereferenceable(8) %cap.1, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.2, i8* noundef nonnull noalias readonly align 8 %cap.3) #1 {
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
  %8 = load i32, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  call void @fill$arrow0(i32 %9, %struct.nish_array* %cap.0, %struct.Box* %cap.1, %struct.nish_array* %cap.2, i8* %cap.3)
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

!llvm.module.flags = !{!20, !21, !22, !23, !24}
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
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{i32 8, !"cf-protection-branch", i32 1}
!21 = !{i32 8, !"cf-protection-return", i32 1}
!22 = !{i32 8, !"branch-target-enforcement", i32 1}
!23 = !{i32 8, !"sign-return-address", i32 1}
!24 = !{i32 4, !"probe-stack", !"inline-asm"}
