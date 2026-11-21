%struct.Leaf = type { i8*, i32, i32 }
%struct.Bag = type { %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Tree = type { %struct.nish_array*, %struct.Leaf*, %struct.Leaf*, %struct.Bag* }
%struct.Forest = type { %struct.nish_array*, %struct.Tree* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"leaf\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"right\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"only\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
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

define internal void @Leaf.constructor(%struct.Leaf* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value, i8* noundef nonnull noalias readonly align 8 %tag, i32 noundef %shade) #0 {
entry:
  %0 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %this, i32 0, i32 1
  store i32 %value, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %this, i32 0, i32 0
  store i8* %tag, i8** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %this, i32 0, i32 2
  store i32 %shade, i32* %2, align 4, !tbaa !7
  ret void
}

define internal void @Tree.constructor(%struct.Tree* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this, i32 noundef %first) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %5 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !20
  %6 = call i8* @nish_alloc_struct(i64 16)
  %7 = bitcast i8* %6 to %struct.Leaf*
  call void @Leaf.constructor(%struct.Leaf* %7, i32 7, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i32 0)
  %8 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 1
  store %struct.Leaf* %7, %struct.Leaf** %8, align 8, !tbaa !21
  %9 = call i8* @nish_alloc_struct(i64 16)
  %10 = bitcast i8* %9 to %struct.Leaf*
  call void @Leaf.constructor(%struct.Leaf* %10, i32 -3, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i32 1)
  %11 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 2
  store %struct.Leaf* %10, %struct.Leaf** %11, align 8, !tbaa !22
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.Bag*
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %19 = getelementptr inbounds %struct.Bag, %struct.Bag* %13, i32 0, i32 0
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !24
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %25 = getelementptr inbounds %struct.Bag, %struct.Bag* %13, i32 0, i32 1
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !25
  %26 = getelementptr inbounds %struct.Bag, %struct.Bag* %13, i32 0, i32 2
  store i32 0, i32* %26, align 4, !tbaa !26
  %27 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 3
  store %struct.Bag* %13, %struct.Bag** %27, align 8, !tbaa !27
  %28 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 0
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !20
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %29, i64 4)
  br label %push.store

push.store:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 %31
  store i32 %first, i32* %38, align 4, !alias.scope !12, !noalias !11, !tbaa !29
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %40 = trunc i64 %39 to i32
  %41 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 1
  %42 = load %struct.Leaf*, %struct.Leaf** %41, align 8, !tbaa !21
  %43 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 1
  %44 = load %struct.Leaf*, %struct.Leaf** %43, align 8, !tbaa !21
  %45 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %44, i32 0, i32 1
  %46 = load i32, i32* %45, align 4, !tbaa !5
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 %first)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok

ovf.ok:
  %50 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %42, i32 0, i32 1
  store i32 %48, i32* %50, align 4, !tbaa !5
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %a.addr = alloca %struct.Bag*, align 8
  %b.addr = alloca %struct.Bag*, align 8
  %t.addr = alloca %struct.Tree*, align 8
  %Tree.obj = alloca %struct.Tree, align 8
  %right.addr = alloca %struct.Leaf*, align 8
  %Tree.obj.1 = alloca %struct.Tree, align 8
  %f.addr = alloca %struct.Forest*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Bag*
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %7 = getelementptr inbounds %struct.Bag, %struct.Bag* %1, i32 0, i32 0
  store %struct.nish_array* %3, %struct.nish_array** %7, align 8, !tbaa !24
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* null, i8** %12, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %13 = getelementptr inbounds %struct.Bag, %struct.Bag* %1, i32 0, i32 1
  store %struct.nish_array* %9, %struct.nish_array** %13, align 8, !tbaa !25
  %14 = getelementptr inbounds %struct.Bag, %struct.Bag* %1, i32 0, i32 2
  store i32 0, i32* %14, align 4, !tbaa !26
  store %struct.Bag* %1, %struct.Bag** %a.addr, align 8
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.Bag*
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 0, i64* %19, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 0, i64* %20, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* null, i8** %21, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %22 = getelementptr inbounds %struct.Bag, %struct.Bag* %16, i32 0, i32 0
  store %struct.nish_array* %18, %struct.nish_array** %22, align 8, !tbaa !24
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 0, i64* %25, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 0, i64* %26, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* null, i8** %27, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %28 = getelementptr inbounds %struct.Bag, %struct.Bag* %16, i32 0, i32 1
  store %struct.nish_array* %24, %struct.nish_array** %28, align 8, !tbaa !25
  %29 = getelementptr inbounds %struct.Bag, %struct.Bag* %16, i32 0, i32 2
  store i32 0, i32* %29, align 4, !tbaa !26
  store %struct.Bag* %16, %struct.Bag** %b.addr, align 8
  %30 = load %struct.Bag*, %struct.Bag** %a.addr, align 8
  %31 = getelementptr inbounds %struct.Bag, %struct.Bag* %30, i32 0, i32 0
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !24
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  %36 = load i64, i64* %35, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %37 = icmp eq i64 %34, %36
  br i1 %37, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %32, i64 4)
  br label %push.store

push.store:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %34
  store i32 1, i32* %41, align 4, !alias.scope !12, !noalias !11, !tbaa !29
  %42 = add i64 %34, 1
  store i64 %42, i64* %33, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %43 = trunc i64 %42 to i32
  %44 = load %struct.Bag*, %struct.Bag** %a.addr, align 8
  %45 = getelementptr inbounds %struct.Bag, %struct.Bag* %44, i32 0, i32 0
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !24
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %50 = load i64, i64* %49, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %51 = icmp eq i64 %48, %50
  br i1 %51, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %46, i64 4)
  br label %push.store.1

push.store.1:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 %48
  store i32 2, i32* %55, align 4, !alias.scope !12, !noalias !11, !tbaa !29
  %56 = add i64 %48, 1
  store i64 %56, i64* %47, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %57 = trunc i64 %56 to i32
  %58 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %59 = getelementptr inbounds %struct.Bag, %struct.Bag* %58, i32 0, i32 1
  %60 = load %struct.nish_array*, %struct.nish_array** %59, align 8, !tbaa !25
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 1
  %64 = load i64, i64* %63, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %65 = icmp eq i64 %62, %64
  br i1 %65, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %60, i64 8)
  br label %push.store.2

push.store.2:
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %68 = bitcast i8* %67 to i8**
  %69 = getelementptr inbounds i8*, i8** %68, i64 %62
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %69, align 8, !alias.scope !12, !noalias !11, !tbaa !31
  %70 = add i64 %62, 1
  store i64 %70, i64* %61, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %71 = trunc i64 %70 to i32
  %72 = load %struct.Bag*, %struct.Bag** %a.addr, align 8
  %73 = getelementptr inbounds %struct.Bag, %struct.Bag* %72, i32 0, i32 0
  %74 = load %struct.nish_array*, %struct.nish_array** %73, align 8, !tbaa !24
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %77 = trunc i64 %76 to i32
  %78 = call i8* @nish_str_from_i32(i32 %77)
  call void @nish_print(i8* %78)
  %79 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %80 = getelementptr inbounds %struct.Bag, %struct.Bag* %79, i32 0, i32 0
  %81 = load %struct.nish_array*, %struct.nish_array** %80, align 8, !tbaa !24
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %84 = trunc i64 %83 to i32
  %85 = call i8* @nish_str_from_i32(i32 %84)
  call void @nish_print(i8* %85)
  %86 = load %struct.Bag*, %struct.Bag** %b.addr, align 8
  %87 = getelementptr inbounds %struct.Bag, %struct.Bag* %86, i32 0, i32 1
  %88 = load %struct.nish_array*, %struct.nish_array** %87, align 8, !tbaa !25
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %91 = icmp ult i64 0, %90
  br i1 %91, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %90)
  unreachable

bounds.ok:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %94 = bitcast i8* %93 to i8**
  %95 = getelementptr inbounds i8*, i8** %94, i64 0
  %96 = load i8*, i8** %95, align 8, !alias.scope !12, !noalias !11, !tbaa !31
  call void @nish_print(i8* %96)
  call void @Tree.constructor(%struct.Tree* %Tree.obj, i32 5)
  store %struct.Tree* %Tree.obj, %struct.Tree** %t.addr, align 8
  %97 = load %struct.Tree*, %struct.Tree** %t.addr, align 8
  %98 = getelementptr inbounds %struct.Tree, %struct.Tree* %97, i32 0, i32 0
  %99 = load %struct.nish_array*, %struct.nish_array** %98, align 8, !tbaa !20
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %102 = trunc i64 %101 to i32
  %103 = call i8* @nish_str_from_i32(i32 %102)
  call void @nish_print(i8* %103)
  %104 = load %struct.Tree*, %struct.Tree** %t.addr, align 8
  %105 = getelementptr inbounds %struct.Tree, %struct.Tree* %104, i32 0, i32 0
  %106 = load %struct.nish_array*, %struct.nish_array** %105, align 8, !tbaa !20
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  %108 = load i64, i64* %107, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %109 = icmp ult i64 0, %108
  br i1 %109, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %108)
  unreachable

bounds.ok.1:
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %112 = bitcast i8* %111 to i32*
  %113 = getelementptr inbounds i32, i32* %112, i64 0
  %114 = load i32, i32* %113, align 4, !alias.scope !12, !noalias !11, !tbaa !29
  %115 = call i8* @nish_str_from_i32(i32 %114)
  call void @nish_print(i8* %115)
  %116 = load %struct.Tree*, %struct.Tree** %t.addr, align 8
  %117 = getelementptr inbounds %struct.Tree, %struct.Tree* %116, i32 0, i32 1
  %118 = load %struct.Leaf*, %struct.Leaf** %117, align 8, !tbaa !21
  %119 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %118, i32 0, i32 1
  %120 = load i32, i32* %119, align 4, !tbaa !5
  %121 = call i8* @nish_str_from_i32(i32 %120)
  call void @nish_print(i8* %121)
  %122 = load %struct.Tree*, %struct.Tree** %t.addr, align 8
  %123 = getelementptr inbounds %struct.Tree, %struct.Tree* %122, i32 0, i32 1
  %124 = load %struct.Leaf*, %struct.Leaf** %123, align 8, !tbaa !21
  %125 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %124, i32 0, i32 0
  %126 = load i8*, i8** %125, align 8, !tbaa !6
  call void @nish_print(i8* %126)
  %127 = load %struct.Tree*, %struct.Tree** %t.addr, align 8
  %128 = getelementptr inbounds %struct.Tree, %struct.Tree* %127, i32 0, i32 2
  %129 = load %struct.Leaf*, %struct.Leaf** %128, align 8, !tbaa !22
  store %struct.Leaf* %129, %struct.Leaf** %right.addr, align 8
  %130 = load %struct.Leaf*, %struct.Leaf** %right.addr, align 8
  %131 = icmp ne %struct.Leaf* %130, null
  br i1 %131, label %if.then, label %if.end

if.then:
  %132 = load %struct.Leaf*, %struct.Leaf** %right.addr, align 8
  %133 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %132, i32 0, i32 1
  %134 = load i32, i32* %133, align 4, !tbaa !5
  %135 = call i8* @nish_str_from_i32(i32 %134)
  call void @nish_print(i8* %135)
  %136 = load %struct.Leaf*, %struct.Leaf** %right.addr, align 8
  %137 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %136, i32 0, i32 0
  %138 = load i8*, i8** %137, align 8, !tbaa !6
  call void @nish_print(i8* %138)
  %139 = load %struct.Leaf*, %struct.Leaf** %right.addr, align 8
  %140 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %139, i32 0, i32 2
  %141 = load i32, i32* %140, align 4, !tbaa !7
  %142 = icmp eq i32 %141, 1
  %143 = select i1 %142, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @nish_print(i8* %143)
  br label %if.end

if.end:
  %144 = load %struct.Tree*, %struct.Tree** %t.addr, align 8
  %145 = getelementptr inbounds %struct.Tree, %struct.Tree* %144, i32 0, i32 3
  %146 = load %struct.Bag*, %struct.Bag** %145, align 8, !tbaa !27
  %147 = getelementptr inbounds %struct.Bag, %struct.Bag* %146, i32 0, i32 0
  %148 = load %struct.nish_array*, %struct.nish_array** %147, align 8, !tbaa !24
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 0
  %150 = load i64, i64* %149, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 1
  %152 = load i64, i64* %151, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %153 = icmp eq i64 %150, %152
  br i1 %153, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %148, i64 4)
  br label %push.store.3

push.store.3:
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 2
  %155 = load i8*, i8** %154, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %156 = bitcast i8* %155 to i32*
  %157 = getelementptr inbounds i32, i32* %156, i64 %150
  store i32 9, i32* %157, align 4, !alias.scope !12, !noalias !11, !tbaa !29
  %158 = add i64 %150, 1
  store i64 %158, i64* %149, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %159 = trunc i64 %158 to i32
  call void @Tree.constructor(%struct.Tree* %Tree.obj.1, i32 2)
  %160 = getelementptr inbounds %struct.Tree, %struct.Tree* %Tree.obj.1, i32 0, i32 3
  %161 = load %struct.Bag*, %struct.Bag** %160, align 8, !tbaa !27
  %162 = getelementptr inbounds %struct.Bag, %struct.Bag* %161, i32 0, i32 0
  %163 = load %struct.nish_array*, %struct.nish_array** %162, align 8, !tbaa !24
  %164 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %163, i64 0, i32 0
  %165 = load i64, i64* %164, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %166 = trunc i64 %165 to i32
  %167 = call i8* @nish_str_from_i32(i32 %166)
  call void @nish_print(i8* %167)
  %168 = load %struct.Tree*, %struct.Tree** %t.addr, align 8
  %169 = getelementptr inbounds %struct.Tree, %struct.Tree* %168, i32 0, i32 3
  %170 = load %struct.Bag*, %struct.Bag** %169, align 8, !tbaa !27
  %171 = getelementptr inbounds %struct.Bag, %struct.Bag* %170, i32 0, i32 0
  %172 = load %struct.nish_array*, %struct.nish_array** %171, align 8, !tbaa !24
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %175 = trunc i64 %174 to i32
  %176 = call i8* @nish_str_from_i32(i32 %175)
  call void @nish_print(i8* %176)
  %177 = call i8* @nish_alloc_struct(i64 16)
  %178 = bitcast i8* %177 to %struct.Forest*
  %179 = call i8* @nish_alloc_struct(i64 24)
  %180 = bitcast i8* %179 to %struct.nish_array*
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 0
  store i64 0, i64* %181, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 1
  store i64 0, i64* %182, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %180, i64 0, i32 2
  store i8* null, i8** %183, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %184 = getelementptr inbounds %struct.Forest, %struct.Forest* %178, i32 0, i32 0
  store %struct.nish_array* %180, %struct.nish_array** %184, align 8, !tbaa !33
  %185 = call i8* @nish_alloc_struct(i64 32)
  %186 = bitcast i8* %185 to %struct.Tree*
  call void @Tree.constructor(%struct.Tree* %186, i32 1)
  %187 = getelementptr inbounds %struct.Forest, %struct.Forest* %178, i32 0, i32 1
  store %struct.Tree* %186, %struct.Tree** %187, align 8, !tbaa !34
  store %struct.Forest* %178, %struct.Forest** %f.addr, align 8
  %188 = load %struct.Forest*, %struct.Forest** %f.addr, align 8
  %189 = getelementptr inbounds %struct.Forest, %struct.Forest* %188, i32 0, i32 0
  %190 = load %struct.nish_array*, %struct.nish_array** %189, align 8, !tbaa !33
  %191 = load %struct.Forest*, %struct.Forest** %f.addr, align 8
  %192 = getelementptr inbounds %struct.Forest, %struct.Forest* %191, i32 0, i32 1
  %193 = load %struct.Tree*, %struct.Tree** %192, align 8, !tbaa !34
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 0
  %195 = load i64, i64* %194, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %196 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 1
  %197 = load i64, i64* %196, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %198 = icmp eq i64 %195, %197
  br i1 %198, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %190, i64 8)
  br label %push.store.4

push.store.4:
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 2
  %200 = load i8*, i8** %199, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %201 = bitcast i8* %200 to %struct.Tree**
  %202 = getelementptr inbounds %struct.Tree*, %struct.Tree** %201, i64 %195
  store %struct.Tree* %193, %struct.Tree** %202, align 8, !alias.scope !12, !noalias !11, !tbaa !31
  %203 = add i64 %195, 1
  store i64 %203, i64* %194, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %204 = trunc i64 %203 to i32
  %205 = load %struct.Forest*, %struct.Forest** %f.addr, align 8
  %206 = getelementptr inbounds %struct.Forest, %struct.Forest* %205, i32 0, i32 0
  %207 = load %struct.nish_array*, %struct.nish_array** %206, align 8, !tbaa !33
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 0
  %209 = load i64, i64* %208, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %210 = trunc i64 %209 to i32
  %211 = call i8* @nish_str_from_i32(i32 %210)
  call void @nish_print(i8* %211)
  %212 = load %struct.Forest*, %struct.Forest** %f.addr, align 8
  %213 = getelementptr inbounds %struct.Forest, %struct.Forest* %212, i32 0, i32 1
  %214 = load %struct.Tree*, %struct.Tree** %213, align 8, !tbaa !34
  %215 = getelementptr inbounds %struct.Tree, %struct.Tree* %214, i32 0, i32 1
  %216 = load %struct.Leaf*, %struct.Leaf** %215, align 8, !tbaa !21
  %217 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %216, i32 0, i32 1
  %218 = load i32, i32* %217, align 4, !tbaa !5
  %219 = call i8* @nish_str_from_i32(i32 %218)
  call void @nish_print(i8* %219)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!35, !36, !37, !38, !39}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Leaf", !2, i64 0, !3, i64 8, !3, i64 12}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{!4, !3, i64 12}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 8}
!18 = !{!15, !14, i64 16}
!19 = !{!"Tree", !2, i64 0, !2, i64 8, !2, i64 16, !2, i64 24}
!20 = !{!19, !2, i64 0}
!21 = !{!19, !2, i64 8}
!22 = !{!19, !2, i64 16}
!23 = !{!"Bag", !2, i64 0, !2, i64 8, !3, i64 16}
!24 = !{!23, !2, i64 0}
!25 = !{!23, !2, i64 8}
!26 = !{!23, !3, i64 16}
!27 = !{!19, !2, i64 24}
!28 = !{!"element i32", !1, i64 0}
!29 = !{!28, !28, i64 0}
!30 = !{!"element ptr", !1, i64 0}
!31 = !{!30, !30, i64 0}
!32 = !{!"Forest", !2, i64 0, !2, i64 8}
!33 = !{!32, !2, i64 0}
!34 = !{!32, !2, i64 8}
!35 = !{i32 8, !"cf-protection-branch", i32 1}
!36 = !{i32 8, !"cf-protection-return", i32 1}
!37 = !{i32 8, !"branch-target-enforcement", i32 1}
!38 = !{i32 8, !"sign-return-address", i32 1}
!39 = !{i32 4, !"probe-stack", !"inline-asm"}
