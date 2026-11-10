%struct.Item = type { i8* }
%struct.Tree = type { %struct.nish_array* }
%struct.Seen = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_region_new() #0
declare noundef i64 @nish_region_child_new() #0
declare i8* @nish_region_enter(i64 noundef) #0
declare void @nish_region_leave(i64 noundef, i8*) #0
declare void @nish_region_free(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
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

define internal void @Item.constructor(%struct.Item* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 0
  store i8* %name, i8** %0, align 8, !tbaa !4
  ret void
}

define internal void @Tree.constructor(%struct.Tree* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Item*
  call void @Item.constructor(%struct.Item* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Item*
  call void @Item.constructor(%struct.Item* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Item*
  call void @Item.constructor(%struct.Item* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 3, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 3, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %12 = bitcast i8* %10 to %struct.Item**
  %13 = getelementptr inbounds %struct.Item*, %struct.Item** %12, i64 0
  store %struct.Item* %1, %struct.Item** %13, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %14 = getelementptr inbounds %struct.Item*, %struct.Item** %12, i64 1
  store %struct.Item* %3, %struct.Item** %14, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %15 = getelementptr inbounds %struct.Item*, %struct.Item** %12, i64 2
  store %struct.Item* %5, %struct.Item** %15, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %16 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 0
  store %struct.nish_array* %7, %struct.nish_array** %16, align 8, !tbaa !19
  ret void
}

define internal void @Seen.constructor(%struct.Seen* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = getelementptr inbounds %struct.Seen, %struct.Seen* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !21
  ret void
}

define hidden noundef nonnull align 8 dereferenceable(8) %struct.Seen* @collect$(%struct.Tree* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tree) #1 {
entry:
  %s.addr = alloca %struct.Seen*, align 8
  %item.addr = alloca %struct.Item*, align 8
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Seen*
  call void @Seen.constructor(%struct.Seen* %1)
  store %struct.Seen* %1, %struct.Seen** %s.addr, align 8
  %2 = getelementptr inbounds %struct.Tree, %struct.Tree* %tree, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !19
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %forof.body, label %forof.end

forof.body:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %10 = bitcast i8* %9 to %struct.Item**
  %11 = getelementptr inbounds %struct.Item*, %struct.Item** %10, i64 %4
  %12 = load %struct.Item*, %struct.Item** %11, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.Item* %12, %struct.Item** %item.addr, align 8
  %13 = load %struct.Seen*, %struct.Seen** %s.addr, align 8
  %14 = getelementptr inbounds %struct.Seen, %struct.Seen* %13, i32 0, i32 0
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !21
  %16 = load %struct.Item*, %struct.Item** %item.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %24 = bitcast i8* %23 to %struct.Item**
  %25 = getelementptr inbounds %struct.Item*, %struct.Item** %24, i64 %18
  store %struct.Item* %16, %struct.Item** %25, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = trunc i64 %26 to i32
  br label %forof.inc

forof.inc:
  %28 = load i64, i64* %forof.idx, align 8
  %29 = add i64 %28, 1
  store i64 %29, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %30 = load %struct.Seen*, %struct.Seen** %s.addr, align 8
  %31 = getelementptr inbounds %struct.Seen, %struct.Seen* %30, i32 0, i32 0
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !21
  %33 = getelementptr inbounds %struct.Tree, %struct.Tree* %tree, i32 0, i32 0
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !19
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %37 = icmp ult i64 0, %36
  br i1 %37, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %36)
  unreachable

bounds.ok:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %40 = bitcast i8* %39 to %struct.Item**
  %41 = getelementptr inbounds %struct.Item*, %struct.Item** %40, i64 0
  %42 = load %struct.Item*, %struct.Item** %41, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  %46 = load i64, i64* %45, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %47 = icmp eq i64 %44, %46
  br i1 %47, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %32, i64 8)
  br label %push.store.1

push.store.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %50 = bitcast i8* %49 to %struct.Item**
  %51 = getelementptr inbounds %struct.Item*, %struct.Item** %50, i64 %44
  store %struct.Item* %42, %struct.Item** %51, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %52 = add i64 %44, 1
  store i64 %52, i64* %43, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = trunc i64 %52 to i32
  %54 = load %struct.Seen*, %struct.Seen** %s.addr, align 8
  ret %struct.Seen* %54
}

define hidden noundef i32 @report$(%struct.Seen* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %item.addr = alloca %struct.Item*, align 8
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %names.addr, align 8
  %3 = getelementptr inbounds %struct.Seen, %struct.Seen* %s, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !21
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
  %11 = bitcast i8* %10 to %struct.Item**
  %12 = getelementptr inbounds %struct.Item*, %struct.Item** %11, i64 %5
  %13 = load %struct.Item*, %struct.Item** %12, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.Item* %13, %struct.Item** %item.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %15 = load %struct.Item*, %struct.Item** %item.addr, align 8
  %16 = getelementptr inbounds %struct.Item, %struct.Item* %15, i32 0, i32 0
  %17 = load i8*, i8** %16, align 8, !tbaa !4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %22 = icmp eq i64 %19, %21
  br i1 %22, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 8)
  br label %push.store

push.store:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %25 = bitcast i8* %24 to i8**
  %26 = getelementptr inbounds i8*, i8** %25, i64 %19
  store i8* %17, i8** %26, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %27 = add i64 %19, 1
  store i64 %27, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %28 = trunc i64 %27 to i32
  br label %forof.inc

forof.inc:
  %29 = load i64, i64* %forof.idx, align 8
  %30 = add i64 %29, 1
  store i64 %30, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %34 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*) to i64*
  %35 = load i64, i64* %34, align 8
  %36 = sub i64 %33, 1
  %37 = mul i64 %35, %36
  %38 = icmp eq i64 %33, 0
  %39 = select i1 %38, i64 0, i64 %37
  store i64 %39, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %40 = load i64, i64* %join.at, align 8
  %41 = icmp ult i64 %40, %33
  br i1 %41, label %join.sum.body, label %join.copy

join.sum.body:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %44 = bitcast i8* %43 to i8**
  %45 = getelementptr inbounds i8*, i8** %44, i64 %40
  %46 = load i8*, i8** %45, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %47 = load i64, i64* %join.total, align 8
  %48 = bitcast i8* %46 to i64*
  %49 = load i64, i64* %48, align 8
  %50 = add i64 %47, %49
  store i64 %50, i64* %join.total, align 8
  %51 = add i64 %40, 1
  store i64 %51, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %52 = load i64, i64* %join.total, align 8
  %53 = icmp ugt i64 %52, 2147483647
  %54 = add i64 %52, 9
  %55 = select i1 %53, i64 4611686018427387904, i64 %54
  %56 = call i8* @nish_alloc_struct(i64 %55)
  %57 = bitcast i8* %56 to i64*
  store i64 %52, i64* %57, align 8
  %58 = getelementptr inbounds i8, i8* %56, i64 8
  store i8* %58, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %59 = load i64, i64* %join.at, align 8
  %60 = icmp ult i64 %59, %33
  br i1 %60, label %join.part, label %join.end

join.part:
  %61 = load i8*, i8** %join.p, align 8
  %62 = icmp eq i64 %59, 0
  %63 = select i1 %62, i64 0, i64 %35
  %64 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %61, i8* %64, i64 %63, i1 false)
  %65 = getelementptr inbounds i8, i8* %61, i64 %63
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %68 = bitcast i8* %67 to i8**
  %69 = getelementptr inbounds i8*, i8** %68, i64 %59
  %70 = load i8*, i8** %69, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %71 = bitcast i8* %70 to i64*
  %72 = load i64, i64* %71, align 8
  %73 = getelementptr inbounds i8, i8* %70, i64 8
  %74 = icmp eq i64 %72, 1
  br i1 %74, label %join.byte, label %join.bulk

join.byte:
  %75 = load i8, i8* %73, align 1
  store i8 %75, i8* %65, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %65, i8* %73, i64 %72, i1 false)
  br label %join.next

join.next:
  %76 = getelementptr inbounds i8, i8* %65, i64 %72
  store i8* %76, i8** %join.p, align 8
  %77 = add i64 %59, 1
  store i64 %77, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %78 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %78, align 1
  %79 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %80 = getelementptr inbounds %struct.Seen, %struct.Seen* %s, i32 0, i32 0
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !21
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %84 = trunc i64 %83 to i32
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %79, i8* %85)
  call void @nish_print(i8* %86)
  %87 = getelementptr inbounds %struct.Seen, %struct.Seen* %s, i32 0, i32 0
  %88 = load %struct.nish_array*, %struct.nish_array** %87, align 8, !tbaa !21
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %91 = trunc i64 %90 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %91
}

define hidden noundef i64 @make$(%struct.Tree* noundef nonnull readonly align 8 dereferenceable(8) nocapture %tree) #1 {
entry:
  %0 = call i64 @nish.childWith$$Tree$$Seen$fn.7.collect(%struct.Tree* %tree)
  ret i64 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %p.addr = alloca i64, align 8
  %c.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish.region$$Tree$fn.16.nish_main$arrow0()
  store i64 %0, i64* %p.addr, align 8
  %1 = load i64, i64* %p.addr, align 8
  %2 = call i64 @nish.enter$$Tree$rgn.$Seen$fn.4.make(i64 %1)
  store i64 %2, i64* %c.addr, align 8
  %3 = load i64, i64* %c.addr, align 8
  %4 = call i32 @nish.enter$$Seen$i32$fn.6.report(i64 %3)
  store i32 %4, i32* %n.addr, align 4
  %5 = load i64, i64* %c.addr, align 8
  call void @nish.free$$Seen(i64 %5)
  %6 = load i64, i64* %p.addr, align 8
  call void @nish.free$$Tree(i64 %6)
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp eq i32 %7, 4
  br i1 %8, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9
}

define hidden noundef nonnull align 8 dereferenceable(8) %struct.Tree* @nish_main$arrow0() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Tree*
  call void @Tree.constructor(%struct.Tree* %1)
  ret %struct.Tree* %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i64 @nish.handleNew() #1 {
entry:
  %0 = call i64 @nish_region_new()
  ret i64 %0
}

define internal void @nish.open(i64 noundef %h) #1 {
entry:
  call i8* @nish_region_enter(i64 %h)
  ret void
}

define internal noundef i64 @nish.childNew() #1 {
entry:
  %0 = call i64 @nish_region_child_new()
  ret i64 %0
}

define internal noundef i64 @nish.childWith$$Tree$$Seen$fn.7.collect(%struct.Tree* noundef nonnull readonly align 8 dereferenceable(8) nocapture %arg) #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.childNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Seen* @collect$(%struct.Tree* %arg)
  %4 = call i64 @nish.close$$Seen(i64 %2, %struct.Seen* %3)
  ret i64 %4
}

define internal noundef i64 @nish.region$$Tree$fn.16.nish_main$arrow0() #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Tree* @nish_main$arrow0()
  %4 = call i64 @nish.close$$Tree(i64 %2, %struct.Tree* %3)
  ret i64 %4
}

define internal noundef i64 @nish.enter$$Tree$rgn.$Seen$fn.4.make(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Tree*, align 8
  %result.addr = alloca i64, align 8
  %0 = call %struct.Tree* @nish.reopen$$Tree(i64 %r)
  store %struct.Tree* %0, %struct.Tree** %root.addr, align 8
  %1 = load %struct.Tree*, %struct.Tree** %root.addr, align 8
  %2 = call i64 @make$(%struct.Tree* %1)
  store i64 %2, i64* %result.addr, align 8
  %3 = load %struct.Tree*, %struct.Tree** %root.addr, align 8
  call void @nish.leave$$Tree(i64 %r, %struct.Tree* %3)
  %4 = load i64, i64* %result.addr, align 8
  ret i64 %4
}

define internal noundef i32 @nish.enter$$Seen$i32$fn.6.report(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Seen*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Seen* @nish.reopen$$Seen(i64 %r)
  store %struct.Seen* %0, %struct.Seen** %root.addr, align 8
  %1 = load %struct.Seen*, %struct.Seen** %root.addr, align 8
  %2 = call i32 @report$(%struct.Seen* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Seen*, %struct.Seen** %root.addr, align 8
  call void @nish.leave$$Seen(i64 %r, %struct.Seen* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$$Seen(i64 noundef %_r) #1 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal void @nish.free$$Tree(i64 noundef %_r) #1 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.close$$Seen(i64 noundef %h, %struct.Seen* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Seen* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef i64 @nish.close$$Tree(i64 noundef %h, %struct.Tree* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Tree* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Tree* @nish.reopen$$Tree(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Tree*
  ret %struct.Tree* %1
}

define internal void @nish.leave$$Tree(i64 noundef %r, %struct.Tree* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Tree* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Seen* @nish.reopen$$Seen(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Seen*
  ret %struct.Seen* %1
}

define internal void @nish.leave$$Seen(i64 noundef %r, %struct.Seen* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Seen* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Item", !2, i64 0}
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
!18 = !{!"Tree", !2, i64 0}
!19 = !{!18, !2, i64 0}
!20 = !{!"Seen", !2, i64 0}
!21 = !{!20, !2, i64 0}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
