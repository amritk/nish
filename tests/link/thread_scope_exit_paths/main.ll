%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define hidden noundef i32 @triple$(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 3)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @firstTriple(i32 noundef %k) #0 {
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
  %36 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %35, i32 100)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok

ovf.ok:
  %39 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ult i64 1, %41
  br i1 %42, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %41)
  unreachable

bounds.ok.2:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 1
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 %47)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %49

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok.1 ], [ 0, %bounds.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
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
  %12 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %13 = load i8*, i8** %12, align 8
  %14 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %15 = load i64, i64* %14, align 8
  %16 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %16, %struct.ThreadScope** %s.addr, align 8
  %17 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %18 = bitcast %struct.ThreadScope* %17 to i8*
  %19 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 10, %20
  %22 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %23 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %19, i32 %21, %struct.nish_array* %22, i32 %23)
  %24 = load i32, i32* %i.addr, align 4
  %25 = icmp eq i32 %24, 0
  br i1 %25, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %18)
  %26 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %27 = load i8*, i8** %26, align 8
  %28 = icmp eq i8* %27, %13
  br i1 %28, label %pass.rewind, label %pass.free

pass.rewind:
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %29, align 8
  br label %pass.done

pass.free:
  %30 = ptrtoint i8* %13 to i64
  %31 = add i64 %30, %15
  call void @nish_arena_release(i64 %31)
  br label %pass.done

pass.done:
  br label %for.inc

if.end:
  %32 = load i32, i32* %i.addr, align 4
  %33 = icmp eq i32 %32, 1
  br i1 %33, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_scope_join(i8* %18)
  %34 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %35 = load i8*, i8** %34, align 8
  %36 = icmp eq i8* %35, %13
  br i1 %36, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %37, align 8
  br label %pass.done.1

pass.free.1:
  %38 = ptrtoint i8* %13 to i64
  %39 = add i64 %38, %15
  call void @nish_arena_release(i64 %39)
  br label %pass.done.1

pass.done.1:
  br label %for.end

if.end.1:
  call void @nish_scope_join(i8* %18)
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %41 = load i8*, i8** %40, align 8
  %42 = icmp eq i8* %41, %13
  br i1 %42, label %pass.rewind.2, label %pass.free.2

pass.rewind.2:
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %15, i64* %43, align 8
  br label %pass.done.2

pass.free.2:
  %44 = ptrtoint i8* %13 to i64
  %45 = add i64 %44, %15
  call void @nish_arena_release(i64 %45)
  br label %pass.done.2

pass.done.2:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %i.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %48 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = icmp ult i64 0, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 0
  %56 = load i32, i32* %55, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %57, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %59 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = icmp ult i64 1, %61
  br i1 %62, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %61)
  unreachable

bounds.ok.1:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to i32*
  %66 = getelementptr inbounds i32, i32* %65, i64 1
  %67 = load i32, i32* %66, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %58, i8* %68)
  %70 = call i8* @nish_str_concat(i8* %69, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %71 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = icmp ult i64 2, %73
  br i1 %74, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %73)
  unreachable

bounds.ok.2:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i32*
  %78 = getelementptr inbounds i32, i32* %77, i64 2
  %79 = load i32, i32* %78, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* %70, i8* %80)
  call void @nish_print(i8* %81)
  %82 = call i8* @nish_alloc_struct(i64 24)
  %83 = bitcast i8* %82 to %struct.nish_array*
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  store i64 2, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 1
  store i64 2, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %86 = call i8* @nish_alloc_struct(i64 8)
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  store i8* %86, i8** %87, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = bitcast i8* %86 to i32*
  %89 = getelementptr inbounds i32, i32* %88, i64 0
  store i32 0, i32* %89, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %90 = getelementptr inbounds i32, i32* %88, i64 1
  store i32 0, i32* %90, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %83, %struct.nish_array** %pair.addr, align 8
  store i32 0, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %91 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %92 = load i8*, i8** %91, align 8
  %93 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %94 = load i64, i64* %93, align 8
  %95 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %95, %struct.ThreadScope** %s.addr.1, align 8
  %96 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %97 = bitcast %struct.ThreadScope* %96 to i8*
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %98 = load i32, i32* %j.addr, align 4
  %99 = icmp slt i32 %98, 2
  br i1 %99, label %for.body.1, label %for.end.1

for.body.1:
  %100 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %101 = load i32, i32* %j.addr, align 4
  %102 = load i32, i32* %n.addr, align 4
  %103 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %101, i32 %102)
  %104 = extractvalue { i32, i1 } %103, 0
  %105 = extractvalue { i32, i1 } %103, 1
  br i1 %105, label %ovf.fail, label %ovf.ok

ovf.ok:
  %106 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %107 = load i32, i32* %j.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %100, i32 %104, %struct.nish_array* %106, i32 %107)
  %108 = load i32, i32* %j.addr, align 4
  %109 = icmp eq i32 %108, 0
  br i1 %109, label %if.then.2, label %if.end.2

if.then.2:
  br label %for.inc.1

if.end.2:
  br label %for.inc.1

for.inc.1:
  %110 = load i32, i32* %j.addr, align 4
  %111 = add nsw i32 %110, 1
  store i32 %111, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %112 = load i32, i32* %n.addr, align 4
  %113 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %112, i32 1)
  %114 = extractvalue { i32, i1 } %113, 0
  %115 = extractvalue { i32, i1 } %113, 1
  br i1 %115, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %114, i32* %n.addr, align 4
  %116 = load i32, i32* %n.addr, align 4
  %117 = icmp eq i32 %116, 2
  br i1 %117, label %if.then.3, label %if.end.3

if.then.3:
  call void @nish_scope_join(i8* %97)
  %118 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %119 = load i8*, i8** %118, align 8
  %120 = icmp eq i8* %119, %92
  br i1 %120, label %pass.rewind.3, label %pass.free.3

pass.rewind.3:
  %121 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %94, i64* %121, align 8
  br label %pass.done.3

pass.free.3:
  %122 = ptrtoint i8* %92 to i64
  %123 = add i64 %122, %94
  call void @nish_arena_release(i64 %123)
  br label %pass.done.3

pass.done.3:
  br label %while.end

if.end.3:
  call void @nish_scope_join(i8* %97)
  %124 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %125 = load i8*, i8** %124, align 8
  %126 = icmp eq i8* %125, %92
  br i1 %126, label %pass.rewind.4, label %pass.free.4

pass.rewind.4:
  %127 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %94, i64* %127, align 8
  br label %pass.done.4

pass.free.4:
  %128 = ptrtoint i8* %92 to i64
  %129 = add i64 %128, %94
  call void @nish_arena_release(i64 %129)
  br label %pass.done.4

pass.done.4:
  br label %while.cond

while.end:
  %130 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 0
  %132 = load i64, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = icmp ult i64 0, %132
  br i1 %133, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %132)
  unreachable

bounds.ok.3:
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 2
  %135 = load i8*, i8** %134, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %136 = bitcast i8* %135 to i32*
  %137 = getelementptr inbounds i32, i32* %136, i64 0
  %138 = load i32, i32* %137, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %139 = call i8* @nish_str_from_i32(i32 %138)
  %140 = call i8* @nish_str_concat(i8* %139, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %141 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 0
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = icmp ult i64 1, %143
  br i1 %144, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %143)
  unreachable

bounds.ok.4:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %147 = bitcast i8* %146 to i32*
  %148 = getelementptr inbounds i32, i32* %147, i64 1
  %149 = load i32, i32* %148, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %150 = call i8* @nish_str_from_i32(i32 %149)
  %151 = call i8* @nish_str_concat(i8* %140, i8* %150)
  call void @nish_print(i8* %151)
  %152 = call i32 @firstTriple(i32 5)
  %153 = call i8* @nish_str_from_i32(i32 %152)
  call void @nish_print(i8* %153)
  %154 = call i32 @firstTriple(i32 0)
  %155 = call i8* @nish_str_from_i32(i32 %154)
  call void @nish_print(i8* %155)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
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
