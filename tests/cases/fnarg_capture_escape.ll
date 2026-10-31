%struct.Box = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"q\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
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

define internal void @fill(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %keep, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %boxes, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %b.addr = alloca %struct.Box*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %3)
  store i8* %4, i8** %s.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 8)
  %6 = bitcast i8* %5 to %struct.Box*
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %8)
  call void @Box.constructor(%struct.Box* %6, i8* %9)
  store %struct.Box* %6, %struct.Box** %b.addr, align 8
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
  %17 = load i8*, i8** %s.addr, align 8
  %18 = load %struct.Box*, %struct.Box** %b.addr, align 8
  call void @each$fn.11.fill$arrow0(%struct.nish_array* %arr.hdr, %struct.nish_array* %keep, i8* %17, %struct.nish_array* %boxes, %struct.Box* %18)
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
  %keep.addr = alloca %struct.nish_array*, align 8
  %boxes.addr = alloca %struct.nish_array*, align 8
  %local.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %1, %struct.nish_array** %keep.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %6, %struct.nish_array** %boxes.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  call void @fill(%struct.nish_array* %10, %struct.nish_array* %11, i32 300)
  %12 = call i32 @churn()
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 0
  %22 = load i8*, i8** %21, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %24 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp ult i64 1, %26
  br i1 %27, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %26)
  unreachable

bounds.ok.1:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %30 = bitcast i8* %29 to i8**
  %31 = getelementptr inbounds i8*, i8** %30, i64 1
  %32 = load i8*, i8** %31, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %33 = call i8* @nish_str_concat(i8* %23, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %35 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %38 = icmp ult i64 598, %37
  br i1 %38, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 598, i64 %37)
  unreachable

bounds.ok.2:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %41 = bitcast i8* %40 to i8**
  %42 = getelementptr inbounds i8*, i8** %41, i64 598
  %43 = load i8*, i8** %42, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %44 = call i8* @nish_str_concat(i8* %34, i8* %43)
  %45 = call i8* @nish_str_concat(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %46 = load %struct.nish_array*, %struct.nish_array** %keep.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %49 = icmp ult i64 599, %48
  br i1 %49, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 599, i64 %48)
  unreachable

bounds.ok.3:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %52 = bitcast i8* %51 to i8**
  %53 = getelementptr inbounds i8*, i8** %52, i64 599
  %54 = load i8*, i8** %53, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %55 = call i8* @nish_str_concat(i8* %45, i8* %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %57 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %60 = icmp ult i64 0, %59
  br i1 %60, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %59)
  unreachable

bounds.ok.4:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %63 = bitcast i8* %62 to %struct.Box**
  %64 = getelementptr inbounds %struct.Box*, %struct.Box** %63, i64 0
  %65 = load %struct.Box*, %struct.Box** %64, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %66 = getelementptr inbounds %struct.Box, %struct.Box* %65, i32 0, i32 0
  %67 = load i8*, i8** %66, align 8, !tbaa !4
  %68 = call i8* @nish_str_concat(i8* %56, i8* %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %70 = load %struct.nish_array*, %struct.nish_array** %boxes.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %73 = icmp ult i64 299, %72
  br i1 %73, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 299, i64 %72)
  unreachable

bounds.ok.5:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %76 = bitcast i8* %75 to %struct.Box**
  %77 = getelementptr inbounds %struct.Box*, %struct.Box** %76, i64 299
  %78 = load %struct.Box*, %struct.Box** %77, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %79 = getelementptr inbounds %struct.Box, %struct.Box* %78, i32 0, i32 0
  %80 = load i8*, i8** %79, align 8, !tbaa !4
  %81 = call i8* @nish_str_concat(i8* %69, i8* %80)
  call void @nish_print(i8* %81)
  %82 = call i8* @nish_alloc_struct(i64 24)
  %83 = bitcast i8* %82 to %struct.nish_array*
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  store i64 0, i64* %84, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 1
  store i64 0, i64* %85, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  store i8* null, i8** %86, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %83, %struct.nish_array** %local.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %87 = load i32, i32* %i.addr, align 4
  %88 = icmp slt i32 %87, 5
  br i1 %88, label %for.body, label %for.end

for.body:
  %89 = load i32, i32* %i.addr, align 4
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %90, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %91, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %92 = bitcast [1 x i32]* %arr.data to i8*
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %92, i8** %93, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %94 = bitcast i8* %92 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 0
  store i32 %89, i32* %95, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %96 = load %struct.nish_array*, %struct.nish_array** %local.addr, align 8
  call void @each$fn.16.nish_main$arrow0(%struct.nish_array* %arr.hdr, %struct.nish_array* %96)
  br label %for.inc

for.inc:
  %97 = load i32, i32* %i.addr, align 4
  %98 = add nsw i32 %97, 1
  store i32 %98, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %99 = call i32 @churn()
  %100 = call i8* @nish_str_from_i32(i32 %99)
  call void @nish_print(i8* %100)
  %101 = load %struct.nish_array*, %struct.nish_array** %local.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %104 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %105 = load i64, i64* %104, align 8
  %106 = sub i64 %103, 1
  %107 = mul i64 %105, %106
  %108 = icmp eq i64 %103, 0
  %109 = select i1 %108, i64 0, i64 %107
  store i64 %109, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %110 = load i64, i64* %join.at, align 8
  %111 = icmp ult i64 %110, %103
  br i1 %111, label %join.sum.body, label %join.copy

join.sum.body:
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %114 = bitcast i8* %113 to i8**
  %115 = getelementptr inbounds i8*, i8** %114, i64 %110
  %116 = load i8*, i8** %115, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %117 = load i64, i64* %join.total, align 8
  %118 = bitcast i8* %116 to i64*
  %119 = load i64, i64* %118, align 8
  %120 = add i64 %117, %119
  store i64 %120, i64* %join.total, align 8
  %121 = add i64 %110, 1
  store i64 %121, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %122 = load i64, i64* %join.total, align 8
  %123 = icmp ugt i64 %122, 2147483647
  %124 = add i64 %122, 9
  %125 = select i1 %123, i64 4611686018427387904, i64 %124
  %126 = call i8* @nish_alloc_struct(i64 %125)
  %127 = bitcast i8* %126 to i64*
  store i64 %122, i64* %127, align 8
  %128 = getelementptr inbounds i8, i8* %126, i64 8
  store i8* %128, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %129 = load i64, i64* %join.at, align 8
  %130 = icmp ult i64 %129, %103
  br i1 %130, label %join.part, label %join.end

join.part:
  %131 = load i8*, i8** %join.p, align 8
  %132 = icmp eq i64 %129, 0
  %133 = select i1 %132, i64 0, i64 %105
  %134 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %131, i8* %134, i64 %133, i1 false)
  %135 = getelementptr inbounds i8, i8* %131, i64 %133
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %138 = bitcast i8* %137 to i8**
  %139 = getelementptr inbounds i8*, i8** %138, i64 %129
  %140 = load i8*, i8** %139, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %141 = bitcast i8* %140 to i64*
  %142 = load i64, i64* %141, align 8
  %143 = getelementptr inbounds i8, i8* %140, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %135, i8* %143, i64 %142, i1 false)
  %144 = getelementptr inbounds i8, i8* %135, i64 %142
  store i8* %144, i8** %join.p, align 8
  %145 = add i64 %129, 1
  store i64 %145, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %146 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %146, align 1
  call void @nish_print(i8* %126)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @fill$arrow0(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keep, i8* noundef nonnull noalias readonly align 8 %s, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %boxes, %struct.Box* noundef nonnull align 8 dereferenceable(8) %b) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %keep, i64 8)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %7 = bitcast i8* %6 to i8**
  %8 = getelementptr inbounds i8*, i8** %7, i64 %1
  store i8* %s, i8** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = trunc i64 %9 to i32
  %11 = call i8* @nish_str_from_i32(i32 %x)
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i8* %11)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %keep, i64 8)
  br label %push.store.1

push.store.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keep, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  store i8* %12, i8** %21, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = trunc i64 %22 to i32
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %boxes, i64 8)
  br label %push.store.2

push.store.2:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %boxes, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %31 = bitcast i8* %30 to %struct.Box**
  %32 = getelementptr inbounds %struct.Box*, %struct.Box** %31, i64 %25
  store %struct.Box* %b, %struct.Box** %32, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %34 = trunc i64 %33 to i32
  ret void
}

define internal void @nish_main$arrow0(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %local) #1 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* %0)
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %local, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %local, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %local, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %local, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = bitcast i8* %8 to i8**
  %10 = getelementptr inbounds i8*, i8** %9, i64 %3
  store i8* %1, i8** %10, align 8, !alias.scope !9, !noalias !8, !tbaa !19
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = trunc i64 %11 to i32
  ret void
}

define internal void @each$fn.11.fill$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef %cap.0, i8* noundef %cap.1, %struct.nish_array* noundef %cap.2, %struct.Box* noundef %cap.3) #1 {
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
  call void @fill$arrow0(i32 %9, %struct.nish_array* %cap.0, i8* %cap.1, %struct.nish_array* %cap.2, %struct.Box* %cap.3)
  br label %forof.inc

forof.inc:
  %10 = load i64, i64* %forof.idx, align 8
  %11 = add i64 %10, 1
  store i64 %11, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret void
}

define internal void @each$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, %struct.nish_array* noundef %cap.0) #1 {
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
  call void @nish_main$arrow0(i32 %9, %struct.nish_array* %cap.0)
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
