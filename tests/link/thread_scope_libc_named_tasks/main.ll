%struct.Leaf = type { i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"same object: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"two objects: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"two entries: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"object and array: \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"map: \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2
declare void @nish.ThreadScope.spawn$$Leaf$i32$fn.5.read$(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Leaf* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$$Leaf$i32$fn.6.write$(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Leaf* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$arr.i32$i32$fn.5.free$(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.parallelMapInto$i32$i32$fn.6.close$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define hidden noundef i32 @read$(%struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %l) #0 {
entry:
  %0 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %l, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  ret i32 %1
}

define hidden noundef i32 @write$(%struct.Leaf* noundef nonnull readonly align 8 dereferenceable(4) nocapture %l) #1 {
entry:
  %0 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %l, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 10)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @free$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
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
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !16
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

define hidden noundef i32 @close$(i32 noundef %n) #1 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 %n)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %a.addr = alloca %struct.Leaf*, align 8
  %b.addr = alloca %struct.Leaf*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %same.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %two.addr = alloca %struct.nish_array*, align 8
  %s.addr.1 = alloca %struct.ThreadScope*, align 8
  %entries.addr = alloca %struct.nish_array*, align 8
  %s.addr.2 = alloca %struct.ThreadScope*, align 8
  %mixed.addr = alloca %struct.nish_array*, align 8
  %s.addr.3 = alloca %struct.ThreadScope*, align 8
  %ns.addr = alloca %struct.nish_array*, align 8
  %squares.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Leaf*
  %2 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  store %struct.Leaf* %1, %struct.Leaf** %a.addr, align 8
  %3 = load %struct.Leaf*, %struct.Leaf** %a.addr, align 8
  %4 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %3, i32 0, i32 0
  store i32 3, i32* %4, align 4, !tbaa !4
  %5 = call i8* @nish_alloc_struct(i64 4)
  %6 = bitcast i8* %5 to %struct.Leaf*
  %7 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %6, i32 0, i32 0
  store i32 0, i32* %7, align 4, !tbaa !4
  store %struct.Leaf* %6, %struct.Leaf** %b.addr, align 8
  %8 = load %struct.Leaf*, %struct.Leaf** %b.addr, align 8
  %9 = getelementptr inbounds %struct.Leaf, %struct.Leaf* %8, i32 0, i32 0
  store i32 4, i32* %9, align 4, !tbaa !4
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 3, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 3, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %14 = call i8* @nish_alloc_struct(i64 12)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 1, i32* %17, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 2, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %19 = getelementptr inbounds i32, i32* %16, i64 2
  store i32 3, i32* %19, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %11, %struct.nish_array** %xs.addr, align 8
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 2, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 2, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %24 = call i8* @nish_alloc_struct(i64 8)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %26 = bitcast i8* %24 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 0
  store i32 0, i32* %27, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %28 = getelementptr inbounds i32, i32* %26, i64 1
  store i32 0, i32* %28, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %21, %struct.nish_array** %same.addr, align 8
  %29 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %29, %struct.ThreadScope** %s.addr, align 8
  %30 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %31 = bitcast %struct.ThreadScope* %30 to i8*
  %32 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %33 = load %struct.Leaf*, %struct.Leaf** %a.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  call void @nish.ThreadScope.spawn$$Leaf$i32$fn.5.read$(%struct.ThreadScope* %32, %struct.Leaf* %33, %struct.nish_array* %34, i32 0)
  %35 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %36 = load %struct.Leaf*, %struct.Leaf** %a.addr, align 8
  %37 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  call void @nish.ThreadScope.spawn$$Leaf$i32$fn.5.read$(%struct.ThreadScope* %35, %struct.Leaf* %36, %struct.nish_array* %37, i32 1)
  call void @nish_scope_join(i8* %31)
  %38 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %41 = icmp ult i64 0, %40
  br i1 %41, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %40)
  unreachable

bounds.ok:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 0
  %46 = load i32, i32* %45, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i8* %47)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %50 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = icmp ult i64 1, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 1
  %58 = load i32, i32* %57, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %49, i8* %59)
  call void @nish_print(i8* %60)
  %61 = call i8* @nish_alloc_struct(i64 24)
  %62 = bitcast i8* %61 to %struct.nish_array*
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  store i64 2, i64* %63, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 1
  store i64 2, i64* %64, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %65 = call i8* @nish_alloc_struct(i64 8)
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %67 = bitcast i8* %65 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 0
  store i32 0, i32* %68, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %69 = getelementptr inbounds i32, i32* %67, i64 1
  store i32 0, i32* %69, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %62, %struct.nish_array** %two.addr, align 8
  %70 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %70, %struct.ThreadScope** %s.addr.1, align 8
  %71 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %72 = bitcast %struct.ThreadScope* %71 to i8*
  %73 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %74 = load %struct.Leaf*, %struct.Leaf** %a.addr, align 8
  %75 = load %struct.nish_array*, %struct.nish_array** %two.addr, align 8
  call void @nish.ThreadScope.spawn$$Leaf$i32$fn.5.read$(%struct.ThreadScope* %73, %struct.Leaf* %74, %struct.nish_array* %75, i32 0)
  %76 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %77 = load %struct.Leaf*, %struct.Leaf** %b.addr, align 8
  %78 = load %struct.nish_array*, %struct.nish_array** %two.addr, align 8
  call void @nish.ThreadScope.spawn$$Leaf$i32$fn.5.read$(%struct.ThreadScope* %76, %struct.Leaf* %77, %struct.nish_array* %78, i32 1)
  call void @nish_scope_join(i8* %72)
  %79 = load %struct.nish_array*, %struct.nish_array** %two.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %82 = icmp ult i64 0, %81
  br i1 %82, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %81)
  unreachable

bounds.ok.2:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %85 = bitcast i8* %84 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 0
  %87 = load i32, i32* %86, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %88 = call i8* @nish_str_from_i32(i32 %87)
  %89 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.2 to i8*), i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %91 = load %struct.nish_array*, %struct.nish_array** %two.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %94 = icmp ult i64 1, %93
  br i1 %94, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %93)
  unreachable

bounds.ok.3:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %97 = bitcast i8* %96 to i32*
  %98 = getelementptr inbounds i32, i32* %97, i64 1
  %99 = load i32, i32* %98, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %100 = call i8* @nish_str_from_i32(i32 %99)
  %101 = call i8* @nish_str_concat(i8* %90, i8* %100)
  call void @nish_print(i8* %101)
  %102 = call i8* @nish_alloc_struct(i64 24)
  %103 = bitcast i8* %102 to %struct.nish_array*
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  store i64 2, i64* %104, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 1
  store i64 2, i64* %105, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %106 = call i8* @nish_alloc_struct(i64 8)
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 2
  store i8* %106, i8** %107, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %108 = bitcast i8* %106 to i32*
  %109 = getelementptr inbounds i32, i32* %108, i64 0
  store i32 0, i32* %109, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %110 = getelementptr inbounds i32, i32* %108, i64 1
  store i32 0, i32* %110, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %103, %struct.nish_array** %entries.addr, align 8
  %111 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %111, %struct.ThreadScope** %s.addr.2, align 8
  %112 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.2, align 8
  %113 = bitcast %struct.ThreadScope* %112 to i8*
  %114 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.2, align 8
  %115 = load %struct.Leaf*, %struct.Leaf** %a.addr, align 8
  %116 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  call void @nish.ThreadScope.spawn$$Leaf$i32$fn.5.read$(%struct.ThreadScope* %114, %struct.Leaf* %115, %struct.nish_array* %116, i32 0)
  %117 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.2, align 8
  %118 = load %struct.Leaf*, %struct.Leaf** %b.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  call void @nish.ThreadScope.spawn$$Leaf$i32$fn.6.write$(%struct.ThreadScope* %117, %struct.Leaf* %118, %struct.nish_array* %119, i32 1)
  call void @nish_scope_join(i8* %113)
  %120 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %123 = icmp ult i64 0, %122
  br i1 %123, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %122)
  unreachable

bounds.ok.4:
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %126 = bitcast i8* %125 to i32*
  %127 = getelementptr inbounds i32, i32* %126, i64 0
  %128 = load i32, i32* %127, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %129 = call i8* @nish_str_from_i32(i32 %128)
  %130 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.3 to i8*), i8* %129)
  %131 = call i8* @nish_str_concat(i8* %130, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %132 = load %struct.nish_array*, %struct.nish_array** %entries.addr, align 8
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 0
  %134 = load i64, i64* %133, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %135 = icmp ult i64 1, %134
  br i1 %135, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 1, i64 %134)
  unreachable

bounds.ok.5:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %138 = bitcast i8* %137 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 1
  %140 = load i32, i32* %139, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %141 = call i8* @nish_str_from_i32(i32 %140)
  %142 = call i8* @nish_str_concat(i8* %131, i8* %141)
  call void @nish_print(i8* %142)
  %143 = call i8* @nish_alloc_struct(i64 24)
  %144 = bitcast i8* %143 to %struct.nish_array*
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %144, i64 0, i32 0
  store i64 2, i64* %145, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %144, i64 0, i32 1
  store i64 2, i64* %146, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %147 = call i8* @nish_alloc_struct(i64 8)
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %144, i64 0, i32 2
  store i8* %147, i8** %148, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %149 = bitcast i8* %147 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 0
  store i32 0, i32* %150, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %151 = getelementptr inbounds i32, i32* %149, i64 1
  store i32 0, i32* %151, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %144, %struct.nish_array** %mixed.addr, align 8
  %152 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %152, %struct.ThreadScope** %s.addr.3, align 8
  %153 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.3, align 8
  %154 = bitcast %struct.ThreadScope* %153 to i8*
  %155 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.3, align 8
  %156 = load %struct.Leaf*, %struct.Leaf** %a.addr, align 8
  %157 = load %struct.nish_array*, %struct.nish_array** %mixed.addr, align 8
  call void @nish.ThreadScope.spawn$$Leaf$i32$fn.6.write$(%struct.ThreadScope* %155, %struct.Leaf* %156, %struct.nish_array* %157, i32 0)
  %158 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.3, align 8
  %159 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %160 = load %struct.nish_array*, %struct.nish_array** %mixed.addr, align 8
  call void @nish.ThreadScope.spawn$arr.i32$i32$fn.5.free$(%struct.ThreadScope* %158, %struct.nish_array* %159, %struct.nish_array* %160, i32 1)
  call void @nish_scope_join(i8* %154)
  %161 = load %struct.nish_array*, %struct.nish_array** %mixed.addr, align 8
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 0
  %163 = load i64, i64* %162, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %164 = icmp ult i64 0, %163
  br i1 %164, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %163)
  unreachable

bounds.ok.6:
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 2
  %166 = load i8*, i8** %165, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %167 = bitcast i8* %166 to i32*
  %168 = getelementptr inbounds i32, i32* %167, i64 0
  %169 = load i32, i32* %168, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %170 = call i8* @nish_str_from_i32(i32 %169)
  %171 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.4 to i8*), i8* %170)
  %172 = call i8* @nish_str_concat(i8* %171, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %173 = load %struct.nish_array*, %struct.nish_array** %mixed.addr, align 8
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 0
  %175 = load i64, i64* %174, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %176 = icmp ult i64 1, %175
  br i1 %176, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 1, i64 %175)
  unreachable

bounds.ok.7:
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 2
  %178 = load i8*, i8** %177, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %179 = bitcast i8* %178 to i32*
  %180 = getelementptr inbounds i32, i32* %179, i64 1
  %181 = load i32, i32* %180, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %182 = call i8* @nish_str_from_i32(i32 %181)
  %183 = call i8* @nish_str_concat(i8* %172, i8* %182)
  call void @nish_print(i8* %183)
  %184 = call i8* @nish_alloc_struct(i64 24)
  %185 = bitcast i8* %184 to %struct.nish_array*
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %185, i64 0, i32 0
  store i64 4, i64* %186, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %185, i64 0, i32 1
  store i64 4, i64* %187, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %188 = call i8* @nish_alloc_struct(i64 16)
  %189 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %185, i64 0, i32 2
  store i8* %188, i8** %189, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %190 = bitcast i8* %188 to i32*
  %191 = getelementptr inbounds i32, i32* %190, i64 0
  store i32 1, i32* %191, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %192 = getelementptr inbounds i32, i32* %190, i64 1
  store i32 2, i32* %192, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %193 = getelementptr inbounds i32, i32* %190, i64 2
  store i32 3, i32* %193, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %194 = getelementptr inbounds i32, i32* %190, i64 3
  store i32 4, i32* %194, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %185, %struct.nish_array** %ns.addr, align 8
  %195 = call i8* @nish_alloc_struct(i64 24)
  %196 = bitcast i8* %195 to %struct.nish_array*
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 0
  store i64 4, i64* %197, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 1
  store i64 4, i64* %198, align 8, !alias.scope !8, !noalias !9, !tbaa !17
  %199 = call i8* @nish_alloc_struct(i64 16)
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 2
  store i8* %199, i8** %200, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %201 = bitcast i8* %199 to i32*
  %202 = getelementptr inbounds i32, i32* %201, i64 0
  store i32 0, i32* %202, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %203 = getelementptr inbounds i32, i32* %201, i64 1
  store i32 0, i32* %203, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %204 = getelementptr inbounds i32, i32* %201, i64 2
  store i32 0, i32* %204, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %205 = getelementptr inbounds i32, i32* %201, i64 3
  store i32 0, i32* %205, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  store %struct.nish_array* %196, %struct.nish_array** %squares.addr, align 8
  %206 = load %struct.nish_array*, %struct.nish_array** %ns.addr, align 8
  %207 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.6.close$(%struct.nish_array* %206, %struct.nish_array* %207)
  %208 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %208, i64 0, i32 0
  %210 = load i64, i64* %209, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %211 = icmp ult i64 0, %210
  br i1 %211, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 0, i64 %210)
  unreachable

bounds.ok.8:
  %212 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %208, i64 0, i32 2
  %213 = load i8*, i8** %212, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %214 = bitcast i8* %213 to i32*
  %215 = getelementptr inbounds i32, i32* %214, i64 0
  %216 = load i32, i32* %215, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %217 = call i8* @nish_str_from_i32(i32 %216)
  %218 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), i8* %217)
  %219 = call i8* @nish_str_concat(i8* %218, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %220 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %221 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 0
  %222 = load i64, i64* %221, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %223 = icmp ult i64 1, %222
  br i1 %223, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 1, i64 %222)
  unreachable

bounds.ok.9:
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 2
  %225 = load i8*, i8** %224, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %226 = bitcast i8* %225 to i32*
  %227 = getelementptr inbounds i32, i32* %226, i64 1
  %228 = load i32, i32* %227, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %229 = call i8* @nish_str_from_i32(i32 %228)
  %230 = call i8* @nish_str_concat(i8* %219, i8* %229)
  %231 = call i8* @nish_str_concat(i8* %230, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %232 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %233 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %232, i64 0, i32 0
  %234 = load i64, i64* %233, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %235 = icmp ult i64 2, %234
  br i1 %235, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 2, i64 %234)
  unreachable

bounds.ok.10:
  %236 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %232, i64 0, i32 2
  %237 = load i8*, i8** %236, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %238 = bitcast i8* %237 to i32*
  %239 = getelementptr inbounds i32, i32* %238, i64 2
  %240 = load i32, i32* %239, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %241 = call i8* @nish_str_from_i32(i32 %240)
  %242 = call i8* @nish_str_concat(i8* %231, i8* %241)
  %243 = call i8* @nish_str_concat(i8* %242, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %244 = load %struct.nish_array*, %struct.nish_array** %squares.addr, align 8
  %245 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %244, i64 0, i32 0
  %246 = load i64, i64* %245, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %247 = icmp ult i64 3, %246
  br i1 %247, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 3, i64 %246)
  unreachable

bounds.ok.11:
  %248 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %244, i64 0, i32 2
  %249 = load i8*, i8** %248, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %250 = bitcast i8* %249 to i32*
  %251 = getelementptr inbounds i32, i32* %250, i64 3
  %252 = load i32, i32* %251, align 4, !alias.scope !9, !noalias !8, !tbaa !16
  %253 = call i8* @nish_str_from_i32(i32 %252)
  %254 = call i8* @nish_str_concat(i8* %243, i8* %253)
  call void @nish_print(i8* %254)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Leaf", !2, i64 0}
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
!14 = !{!12, !11, i64 16}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!12, !10, i64 8}
