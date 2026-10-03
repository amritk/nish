%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define hidden noundef i32 @triple(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 3
  ret i32 %0
}

define internal noundef i32 @firstTriple(i32 noundef %k) #1 {
entry:
  %res.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %res.addr, align 8
  %9 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %9, %struct.ThreadScope** %s.addr, align 8
  %10 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %11 = bitcast %struct.ThreadScope* %10 to i8*
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %12, i32 %k, %struct.nish_array* %13, i32 0)
  %14 = icmp sgt i32 %k, 1
  br i1 %14, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %11)
  %15 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 0, %17
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %17)
  unreachable

bounds.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %23

if.end:
  %24 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %25 = add nsw i32 %k, 1
  %26 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %24, i32 %25, %struct.nish_array* %26, i32 1)
  call void @nish_scope_join(i8* %11)
  %27 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 0, %29
  br i1 %30, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %29)
  unreachable

bounds.ok.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = mul nsw i32 %35, 100
  %37 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = icmp ult i64 1, %39
  br i1 %40, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %39)
  unreachable

bounds.ok.2:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 1
  %45 = load i32, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %46 = add nsw i32 %36, %45
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %46
}

define noundef i32 @nish_main() #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %pair.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %s.addr.1 = alloca %struct.ThreadScope*, align 8
  %j.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 3
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %12, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = bitcast %struct.ThreadScope* %13 to i8*
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 10, %16
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %19 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %15, i32 %17, %struct.nish_array* %18, i32 %19)
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp eq i32 %20, 0
  br i1 %21, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %14)
  br label %for.inc

if.end:
  %22 = load i32, i32* %i.addr, align 4
  %23 = icmp eq i32 %22, 1
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_scope_join(i8* %14)
  br label %for.end

if.end.1:
  call void @nish_scope_join(i8* %14)
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = icmp ult i64 0, %28
  br i1 %29, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %28)
  unreachable

bounds.ok:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 0
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %37 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = icmp ult i64 1, %39
  br i1 %40, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %39)
  unreachable

bounds.ok.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 1
  %45 = load i32, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %36, i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %49 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 2, %51
  br i1 %52, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %51)
  unreachable

bounds.ok.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 2
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = call i8* @nish_str_from_i32(i32 %57)
  %59 = call i8* @nish_str_concat(i8* %48, i8* %58)
  call void @nish_print(i8* %59)
  %60 = call i8* @nish_alloc_struct(i64 24)
  %61 = bitcast i8* %60 to %struct.nish_array*
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  store i64 2, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 1
  store i64 2, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %64 = call i8* @nish_alloc_struct(i64 8)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  store i8* %64, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %64 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 0
  store i32 0, i32* %67, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %68 = getelementptr inbounds i32, i32* %66, i64 1
  store i32 0, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %61, %struct.nish_array** %pair.addr, align 8
  store i32 0, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %69 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %69, %struct.ThreadScope** %s.addr.1, align 8
  %70 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %71 = bitcast %struct.ThreadScope* %70 to i8*
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %72 = load i32, i32* %j.addr, align 4
  %73 = icmp slt i32 %72, 2
  br i1 %73, label %for.body.1, label %for.end.1

for.body.1:
  %74 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %75 = load i32, i32* %j.addr, align 4
  %76 = load i32, i32* %n.addr, align 4
  %77 = add nsw i32 %75, %76
  %78 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %79 = load i32, i32* %j.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %74, i32 %77, %struct.nish_array* %78, i32 %79)
  %80 = load i32, i32* %j.addr, align 4
  %81 = icmp eq i32 %80, 0
  br i1 %81, label %if.then.2, label %if.end.2

if.then.2:
  br label %for.inc.1

if.end.2:
  br label %for.inc.1

for.inc.1:
  %82 = load i32, i32* %j.addr, align 4
  %83 = add nsw i32 %82, 1
  store i32 %83, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %84 = load i32, i32* %n.addr, align 4
  %85 = add nsw i32 %84, 1
  store i32 %85, i32* %n.addr, align 4
  %86 = load i32, i32* %n.addr, align 4
  %87 = icmp eq i32 %86, 2
  br i1 %87, label %if.then.3, label %if.end.3

if.then.3:
  call void @nish_scope_join(i8* %71)
  br label %while.end

if.end.3:
  call void @nish_scope_join(i8* %71)
  br label %while.cond

while.end:
  %88 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = icmp ult i64 0, %90
  br i1 %91, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %90)
  unreachable

bounds.ok.3:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %94 = bitcast i8* %93 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 0
  %96 = load i32, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %99 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = icmp ult i64 1, %101
  br i1 %102, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %101)
  unreachable

bounds.ok.4:
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %105 = bitcast i8* %104 to i32*
  %106 = getelementptr inbounds i32, i32* %105, i64 1
  %107 = load i32, i32* %106, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = call i8* @nish_str_concat(i8* %98, i8* %108)
  call void @nish_print(i8* %109)
  %110 = call i32 @firstTriple(i32 5)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  call void @nish_print(i8* %111)
  %112 = call i32 @firstTriple(i32 0)
  %113 = call i8* @nish_str_from_i32(i32 %112)
  call void @nish_print(i8* %113)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
