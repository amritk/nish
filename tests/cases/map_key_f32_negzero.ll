%struct.Map$f32$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.Set$f32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"map \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"set \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Set: no entry at this index\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #3
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define noundef i32 @nish_main() #0 {
entry:
  %zero.addr = alloca float, align 4
  %one.addr = alloca float, align 4
  %m.addr = alloca %struct.Map$f32$i32*, align 8
  %k.addr = alloca float, align 4
  %walk.idx = alloca i32, align 4
  %s.addr = alloca %struct.Set$f32*, align 8
  %v.addr = alloca float, align 4
  %walk.idx.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store float 0x0000000000000000, float* %zero.addr, align 4
  store float 0x3FF0000000000000, float* %one.addr, align 4
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$f32$i32*
  call void @nish.Map$f32$i32.constructor(%struct.Map$f32$i32* %1)
  store %struct.Map$f32$i32* %1, %struct.Map$f32$i32** %m.addr, align 8
  %2 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %m.addr, align 8
  %3 = load float, float* %zero.addr, align 4
  %4 = fneg float %3
  %5 = call %struct.Map$f32$i32* @nish.Map$f32$i32.set(%struct.Map$f32$i32* %2, float %4, i32 1)
  %6 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %m.addr, align 8
  call void @nish.Map$f32$i32.walkOpen(%struct.Map$f32$i32* %6)
  %7 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %6, i32 0)
  store i32 %7, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %8 = load i32, i32* %walk.idx, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %walk.body, label %walk.end

walk.body:
  %10 = call float @nish.Map$f32$i32.keyAt(%struct.Map$f32$i32* %6, i32 %8)
  store float %10, float* %k.addr, align 4
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %12 = load i8*, i8** %11, align 8
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = load float, float* %k.addr, align 4
  %16 = fpext float %15 to double
  %17 = call i8* @nish_str_from_f64(double %16)
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %20 = load float, float* %one.addr, align 4
  %21 = load float, float* %k.addr, align 4
  %22 = fdiv float %20, %21
  %23 = fpext float %22 to double
  %24 = call i8* @nish_str_from_f64(double %23)
  %25 = call i8* @nish_str_concat(i8* %19, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %27 = load %struct.Map$f32$i32*, %struct.Map$f32$i32** %m.addr, align 8
  %28 = load float, float* %zero.addr, align 4
  %29 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %27, float %28)
  %30 = icmp sge i64 %29, 0
  br i1 %30, label %nullish.value, label %nullish.default

nullish.value:
  %31 = trunc i64 %29 to i32
  %32 = call i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* %27, i32 %31)
  br label %nullish.end

nullish.default:
  %33 = sub nsw i32 0, 1
  br label %nullish.end

nullish.end:
  %34 = phi i32 [ %32, %nullish.value ], [ %33, %nullish.default ]
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %26, i8* %35)
  call void @nish_print(i8* %36)
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %38 = load i8*, i8** %37, align 8
  %39 = icmp eq i8* %38, %12
  br i1 %39, label %pass.rewind, label %pass.free

pass.rewind:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %14, i64* %40, align 8
  br label %pass.done

pass.free:
  %41 = ptrtoint i8* %12 to i64
  %42 = add i64 %41, %14
  call void @nish_arena_release(i64 %42)
  br label %pass.done

pass.done:
  br label %walk.inc

walk.inc:
  %43 = add i32 %8, 1
  %44 = call i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* %6, i32 %43)
  store i32 %44, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$f32$i32.walkClose(%struct.Map$f32$i32* %6)
  %45 = call i8* @nish_alloc_struct(i64 48)
  %46 = bitcast i8* %45 to %struct.Set$f32*
  call void @nish.Set$f32.constructor(%struct.Set$f32* %46)
  store %struct.Set$f32* %46, %struct.Set$f32** %s.addr, align 8
  %47 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  %48 = load float, float* %zero.addr, align 4
  %49 = fneg float %48
  %50 = call %struct.Set$f32* @nish.Set$f32.add(%struct.Set$f32* %47, float %49)
  %51 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  %52 = load float, float* %zero.addr, align 4
  %53 = call %struct.Set$f32* @nish.Set$f32.add(%struct.Set$f32* %51, float %52)
  %54 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  call void @nish.Set$f32.walkOpen(%struct.Set$f32* %54)
  %55 = call i32 @nish.Set$f32.walkNext(%struct.Set$f32* %54, i32 0)
  store i32 %55, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.cond.1:
  %56 = load i32, i32* %walk.idx.1, align 4
  %57 = icmp sge i32 %56, 0
  br i1 %57, label %walk.body.1, label %walk.end.1

walk.body.1:
  %58 = call float @nish.Set$f32.keyAt(%struct.Set$f32* %54, i32 %56)
  store float %58, float* %v.addr, align 4
  %59 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %60 = load i8*, i8** %59, align 8
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %62 = load i64, i64* %61, align 8
  %63 = load float, float* %v.addr, align 4
  %64 = fpext float %63 to double
  %65 = call i8* @nish_str_from_f64(double %64)
  %66 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %65)
  %67 = call i8* @nish_str_concat(i8* %66, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %68 = load float, float* %one.addr, align 4
  %69 = load float, float* %v.addr, align 4
  %70 = fdiv float %68, %69
  %71 = fpext float %70 to double
  %72 = call i8* @nish_str_from_f64(double %71)
  %73 = call i8* @nish_str_concat(i8* %67, i8* %72)
  %74 = call i8* @nish_str_concat(i8* %73, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %75 = load %struct.Set$f32*, %struct.Set$f32** %s.addr, align 8
  %76 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %75, i32 0, i32 0
  %77 = load i32, i32* %76, align 4, !tbaa !5
  %78 = call i8* @nish_str_from_i32(i32 %77)
  %79 = call i8* @nish_str_concat(i8* %74, i8* %78)
  call void @nish_print(i8* %79)
  %80 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %81 = load i8*, i8** %80, align 8
  %82 = icmp eq i8* %81, %60
  br i1 %82, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %83 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %62, i64* %83, align 8
  br label %pass.done.1

pass.free.1:
  %84 = ptrtoint i8* %60 to i64
  %85 = add i64 %84, %62
  call void @nish_arena_release(i64 %85)
  br label %pass.done.1

pass.done.1:
  br label %walk.inc.1

walk.inc.1:
  %86 = add i32 %56, 1
  %87 = call i32 @nish.Set$f32.walkNext(%struct.Set$f32* %54, i32 %86)
  store i32 %87, i32* %walk.idx.1, align 4
  br label %walk.cond.1

walk.end.1:
  call void @nish.Set$f32.walkClose(%struct.Set$f32* %54)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = add nsw i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = sub nsw i32 0, 1
  %1 = sext i32 %0 to i64
  %2 = sext i32 %bucket to i64
  %3 = shl i64 %2, 32
  %4 = zext i32 %h to i64
  %5 = or i64 %3, %4
  %6 = sub nsw i64 %1, %5
  ret i64 %6
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = trunc i64 %3 to i32
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %bucket.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %5 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %17 = icmp eq i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %bucket.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %word.addr, align 4
  %21 = bitcast i8* %5 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  ret void

if.end:
  %23 = load i32, i32* %bucket.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = and i32 %24, %mask
  store i32 %25, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %38 = icmp eq i64 %37, 0
  br i1 %38, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %39 = sub i64 %37, 1
  store i64 %39, i64* %36, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  %44 = load i32, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = mul nsw i32 %live, 2
  %4 = icmp slt i32 %3, %used
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %5 = load i32, i32* %n.addr, align 4
  %6 = mul nsw i32 %5, 2
  %7 = sext i32 %6 to i64
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 %7, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 %7, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %12 = mul i64 %7, 4
  %13 = call i8* @nish_alloc_struct(i64 %12)
  call void @llvm.memset.p0i8.i64(i8* align 8 %13, i8 0, i64 %12, i1 false), !alias.scope !10, !noalias !9
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  ret %struct.nish_array* %9
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #2 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp slt i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ]
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %i.addr, align 4
  ret i32 %16

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = sub nsw i32 0, 1
  ret i32 %19
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %bucket, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = sext i32 %bucket to i64
  %7 = sub nsw i32 %used, 1
  %8 = call i32 @nish.slotWord(i32 %h, i32 %7)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %6
  store i32 %8, i32* %12, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end

if.else:
  %13 = sub nsw i32 %used, 1
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %13)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f32$i32.constructor(%struct.Map$f32$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !20
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !21
  %2 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !22
  %3 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !23
  %4 = sext i32 8 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !10, !noalias !9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !24
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !25
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !26
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %30 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !27
  ret void
}

define internal noundef i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, float noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !21
  %4 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !27
  %6 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !25
  %8 = call i64 @nish.probeTable$f32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, float %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(56) %struct.Map$f32$i32* @nish.Map$f32$i32.set(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) %this, float noundef %key, i32 noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$f32$i32.probe(%struct.Map$f32$i32* %this, float %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$f32$i32.setValueAt(%struct.Map$f32$i32* %this, i32 %4, i32 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* %this, i64 %5, float %key, i32 %value)
  br label %if.end

if.end:
  ret %struct.Map$f32$i32* %this
}

define internal void @nish.Map$f32$i32.walkOpen(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = add nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !23
  ret void
}

define internal noundef i32 @nish.Map$f32$i32.walkNext(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !27
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$f32$i32.walkClose(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !23
  %2 = sub nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !23
  ret void
}

define internal noundef float @nish.Map$f32$i32.keyAt(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !25
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %16 = bitcast i8* %15 to float*
  %17 = getelementptr inbounds float, float* %16, i64 %10
  %18 = load float, float* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  ret float %18
}

define internal noundef i32 @nish.Map$f32$i32.valueAt(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !26
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  %18 = load i32, i32* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  ret i32 %18
}

define internal void @nish.Map$f32$i32.setValueAt(%struct.Map$f32$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #3 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !26
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$f32$i32.insertAt(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, float noundef %key, i32 noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 0, 1
  %1 = sub nsw i64 %0, %absent
  store i64 %1, i64* %packed.addr, align 8
  %2 = load i64, i64* %packed.addr, align 8
  %3 = ashr i64 %2, 32
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %bucket.addr, align 4
  %5 = load i64, i64* %packed.addr, align 8
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %h.addr, align 4
  %7 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !25
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = trunc i64 %10 to i32
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !22
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %17 = load i32, i32* %16, align 4, !tbaa !23
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$f32$i32.rebuild(%struct.Map$f32$i32* %this)
  %20 = sub nsw i32 0, 1
  store i32 %20, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %21 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !25
  %23 = fadd float %key, 0.000000e+00
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 4)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %31 = bitcast i8* %30 to float*
  %32 = getelementptr inbounds float, float* %31, i64 %25
  store float %23, float* %32, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %34 = trunc i64 %33 to i32
  %35 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !26
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %40 = load i64, i64* %39, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %41 = icmp eq i64 %38, %40
  br i1 %41, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %36, i64 4)
  br label %push.store.1

push.store.1:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %38
  store i32 %value, i32* %45, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %46 = add i64 %38, 1
  store i64 %46, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %47 = trunc i64 %46 to i32
  %48 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %49 = load %struct.nish_array*, %struct.nish_array** %48, align 8, !tbaa !27
  %50 = load i32, i32* %h.addr, align 4
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %55 = icmp eq i64 %52, %54
  br i1 %55, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %49, i64 4)
  br label %push.store.2

push.store.2:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %52
  store i32 %50, i32* %59, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %60 = add i64 %52, 1
  store i64 %60, i64* %51, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %61 = trunc i64 %60 to i32
  %62 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %63 = load i32, i32* %62, align 4, !tbaa !22
  %64 = add nsw i32 %63, 1
  %65 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  store i32 %64, i32* %65, align 4, !tbaa !22
  %66 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 0
  %67 = load i32, i32* %66, align 4, !tbaa !20
  %68 = add nsw i32 %67, 1
  %69 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 0
  store i32 %68, i32* %69, align 4, !tbaa !20
  %70 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %71 = load %struct.nish_array*, %struct.nish_array** %70, align 8, !tbaa !25
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %74 = trunc i64 %73 to i32
  store i32 %74, i32* %used.addr, align 4
  %75 = load i32, i32* %used.addr, align 4
  %76 = mul nsw i32 %75, 4
  %77 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %78 = load %struct.nish_array*, %struct.nish_array** %77, align 8, !tbaa !24
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %81 = trunc i64 %80 to i32
  %82 = mul nsw i32 %81, 3
  %83 = icmp sgt i32 %76, %82
  br i1 %83, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$f32$i32.rebuild(%struct.Map$f32$i32* %this)
  br label %if.end.2

if.else:
  %84 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %85 = load %struct.nish_array*, %struct.nish_array** %84, align 8, !tbaa !24
  %86 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  %87 = load i32, i32* %86, align 4, !tbaa !21
  %88 = load i32, i32* %bucket.addr, align 4
  %89 = load i32, i32* %h.addr, align 4
  %90 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %85, i32 %87, i32 %88, i32 %89, i32 %90)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Map$f32$i32.rebuild(%struct.Map$f32$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !23
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !22
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !22
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !25
  %26 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !27
  call void @nish.compactEntries$f32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !26
  %30 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !27
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !27
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !24
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !21
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$f32$i32, %struct.Map$f32$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !27
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal void @nish.Set$f32.constructor(%struct.Set$f32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !30
  %2 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !31
  %3 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  store i32 0, i32* %3, align 4, !tbaa !32
  %4 = sext i32 8 to i64
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %4, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %4, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %9 = mul i64 %4, 4
  %10 = call i8* @nish_alloc_struct(i64 %9)
  call void @llvm.memset.p0i8.i64(i8* align 8 %10, i8 0, i64 %9, i1 false), !alias.scope !10, !noalias !9
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  store %struct.nish_array* %6, %struct.nish_array** %12, align 8, !tbaa !33
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !34
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !35
  ret void
}

define internal noundef i64 @nish.Set$f32.probe(%struct.Set$f32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, float noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !33
  %2 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !30
  %4 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !35
  %6 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !34
  %8 = call i64 @nish.probeTable$f32(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, float %key)
  ret i64 %8
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Set$f32* @nish.Set$f32.add(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) %this, float noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$f32.probe(%struct.Set$f32* %this, float %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$f32.insertAt(%struct.Set$f32* %this, i64 %3, float %key)
  br label %if.end

if.end:
  ret %struct.Set$f32* %this
}

define internal void @nish.Set$f32.walkOpen(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = add nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !32
  ret void
}

define internal noundef i32 @nish.Set$f32.walkNext(%struct.Set$f32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %from) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !35
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Set$f32.walkClose(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %1 = load i32, i32* %0, align 4, !tbaa !32
  %2 = sub nsw i32 %1, 1
  %3 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  store i32 %2, i32* %3, align 4, !tbaa !32
  ret void
}

define internal noundef float @nish.Set$f32.keyAt(%struct.Set$f32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !34
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp sge i32 %index, %5
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.5 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %8 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !34
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %10, i64 %12)
  unreachable

bounds.ok:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %16 = bitcast i8* %15 to float*
  %17 = getelementptr inbounds float, float* %16, i64 %10
  %18 = load float, float* %17, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  ret float %18
}

define internal void @nish.Set$f32.insertAt(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, float noundef %key) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 0, 1
  %1 = sub nsw i64 %0, %absent
  store i64 %1, i64* %packed.addr, align 8
  %2 = load i64, i64* %packed.addr, align 8
  %3 = ashr i64 %2, 32
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %bucket.addr, align 4
  %5 = load i64, i64* %packed.addr, align 8
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %h.addr, align 4
  %7 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !34
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = trunc i64 %10 to i32
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !31
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %lor.end, label %lor.rhs

lor.rhs:
  %16 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %17 = load i32, i32* %16, align 4, !tbaa !32
  %18 = icmp sgt i32 %17, 0
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %if.then ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Set$f32.rebuild(%struct.Set$f32* %this)
  %20 = sub nsw i32 0, 1
  store i32 %20, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %21 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !34
  %23 = fadd float %key, 0.000000e+00
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %22, i64 4)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %31 = bitcast i8* %30 to float*
  %32 = getelementptr inbounds float, float* %31, i64 %25
  store float %23, float* %32, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %34 = trunc i64 %33 to i32
  %35 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !35
  %37 = load i32, i32* %h.addr, align 4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %41 = load i64, i64* %40, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %42 = icmp eq i64 %39, %41
  br i1 %42, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %36, i64 4)
  br label %push.store.1

push.store.1:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %39
  store i32 %37, i32* %46, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %47 = add i64 %39, 1
  store i64 %47, i64* %38, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %50 = load i32, i32* %49, align 4, !tbaa !31
  %51 = add nsw i32 %50, 1
  %52 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  store i32 %51, i32* %52, align 4, !tbaa !31
  %53 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 0
  %54 = load i32, i32* %53, align 4, !tbaa !5
  %55 = add nsw i32 %54, 1
  %56 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 0
  store i32 %55, i32* %56, align 4, !tbaa !5
  %57 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %58 = load %struct.nish_array*, %struct.nish_array** %57, align 8, !tbaa !34
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %61 = trunc i64 %60 to i32
  store i32 %61, i32* %used.addr, align 4
  %62 = load i32, i32* %used.addr, align 4
  %63 = mul nsw i32 %62, 4
  %64 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %65 = load %struct.nish_array*, %struct.nish_array** %64, align 8, !tbaa !33
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %68 = trunc i64 %67 to i32
  %69 = mul nsw i32 %68, 3
  %70 = icmp sgt i32 %63, %69
  br i1 %70, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Set$f32.rebuild(%struct.Set$f32* %this)
  br label %if.end.2

if.else:
  %71 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %72 = load %struct.nish_array*, %struct.nish_array** %71, align 8, !tbaa !33
  %73 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  %74 = load i32, i32* %73, align 4, !tbaa !30
  %75 = load i32, i32* %bucket.addr, align 4
  %76 = load i32, i32* %h.addr, align 4
  %77 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %72, i32 %74, i32 %75, i32 %76, i32 %77)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Set$f32.rebuild(%struct.Set$f32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !34
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 6
  %6 = load i32, i32* %5, align 4, !tbaa !32
  %7 = icmp sgt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !33
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !31
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !31
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !34
  %26 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !35
  call void @nish.compactEntries$f32(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !35
  call void @nish.compactHashes(%struct.nish_array* %29)
  br label %if.end

if.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %31 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 1
  store %struct.nish_array* %30, %struct.nish_array** %31, align 8, !tbaa !33
  %32 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %35 = trunc i64 %34 to i32
  %36 = sub nsw i32 %35, 1
  %37 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 2
  store i32 %36, i32* %37, align 4, !tbaa !30
  %38 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %39 = getelementptr inbounds %struct.Set$f32, %struct.Set$f32* %this, i32 0, i32 5
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !35
  call void @nish.refile(%struct.nish_array* %38, %struct.nish_array* %40)
  ret void
}

define internal noundef i64 @nish.probeTable$f32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, float noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = fpext float %key to double
  %1 = fadd double %0, 0.000000e+00
  %2 = fcmp uno double %1, %1
  %3 = bitcast double %1 to i64
  %4 = select i1 %2, i64 9221120237041090560, i64 %3
  %5 = lshr i64 %4, 33
  %6 = xor i64 %4, %5
  %7 = mul i64 %6, -49064778989728563
  %8 = lshr i64 %7, 33
  %9 = xor i64 %7, %8
  %10 = mul i64 %9, -4265267296055464877
  %11 = lshr i64 %10, 33
  %12 = xor i64 %10, %11
  %13 = trunc i64 %12 to i32
  %14 = lshr i64 %12, 32
  %15 = trunc i64 %14 to i32
  %16 = xor i32 %13, %15
  %17 = icmp eq i32 %16, 0
  %18 = select i1 %17, i32 1, i32 %16
  store i32 %18, i32* %h.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = lshr i32 %19, 24
  store i32 %20, i32* %fingerprint.addr, align 4
  %21 = load i32, i32* %h.addr, align 4
  %22 = call i32 @nish.homeBucket(i32 %21, i32 %mask)
  store i32 %22, i32* %bucket.addr, align 4
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %35 = load i32, i32* %bucket.addr, align 4
  %36 = icmp sge i32 %35, 0
  br i1 %36, label %land.rhs, label %land.end

land.rhs:
  %37 = load i32, i32* %bucket.addr, align 4
  %38 = trunc i64 %24 to i32
  %39 = icmp slt i32 %37, %38
  br label %land.end

land.end:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = load i32, i32* %bucket.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = bitcast i8* %26 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %42
  %45 = load i32, i32* %44, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %45, i32* %word.addr, align 4
  %46 = load i32, i32* %word.addr, align 4
  %47 = icmp eq i32 %46, 0
  br i1 %47, label %if.then, label %if.end

if.then:
  %48 = load i32, i32* %bucket.addr, align 4
  %49 = load i32, i32* %h.addr, align 4
  %50 = tail call i64 @nish.absentAt(i32 %48, i32 %49)
  ret i64 %50

if.end:
  %51 = load i32, i32* %word.addr, align 4
  %52 = lshr i32 %51, 24
  %53 = load i32, i32* %fingerprint.addr, align 4
  %54 = icmp eq i32 %52, %53
  br i1 %54, label %if.then.1, label %if.end.1

if.then.1:
  %55 = load i32, i32* %word.addr, align 4
  %56 = and i32 %55, 16777215
  %57 = sub nsw i32 %56, 1
  store i32 %57, i32* %at.addr, align 4
  %58 = load i32, i32* %at.addr, align 4
  %59 = icmp sge i32 %58, 0
  br i1 %59, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %60 = load i32, i32* %at.addr, align 4
  %61 = trunc i64 %28 to i32
  %62 = icmp slt i32 %60, %61
  br label %land.end.4

land.end.4:
  %63 = phi i1 [ false, %if.then.1 ], [ %62, %land.rhs.4 ]
  br i1 %63, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %64 = load i32, i32* %at.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = bitcast i8* %30 to i32*
  %67 = getelementptr inbounds i32, i32* %66, i64 %65
  %68 = load i32, i32* %67, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %69 = load i32, i32* %h.addr, align 4
  %70 = icmp eq i32 %68, %69
  br label %land.end.3

land.end.3:
  %71 = phi i1 [ false, %land.end.4 ], [ %70, %land.rhs.3 ]
  br i1 %71, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %72 = load i32, i32* %at.addr, align 4
  %73 = trunc i64 %32 to i32
  %74 = icmp slt i32 %72, %73
  br label %land.end.2

land.end.2:
  %75 = phi i1 [ false, %land.end.3 ], [ %74, %land.rhs.2 ]
  br i1 %75, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %76 = load i32, i32* %at.addr, align 4
  %77 = sext i32 %76 to i64
  %78 = bitcast i8* %34 to float*
  %79 = getelementptr inbounds float, float* %78, i64 %77
  %80 = load float, float* %79, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %81 = fcmp oeq float %80, %key
  %82 = fcmp uno float %80, %80
  %83 = fcmp uno float %key, %key
  %84 = and i1 %82, %83
  %85 = or i1 %81, %84
  br label %land.end.1

land.end.1:
  %86 = phi i1 [ false, %land.end.2 ], [ %85, %land.rhs.1 ]
  br i1 %86, label %if.then.2, label %if.end.2

if.then.2:
  %87 = load i32, i32* %bucket.addr, align 4
  %88 = load i32, i32* %at.addr, align 4
  %89 = tail call i64 @nish.foundAt(i32 %87, i32 %88)
  ret i64 %89

if.end.2:
  br label %if.end.1

if.end.1:
  %90 = load i32, i32* %bucket.addr, align 4
  %91 = add nsw i32 %90, 1
  %92 = and i32 %91, %mask
  store i32 %92, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.compactEntries$f32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to float*
  %40 = getelementptr inbounds float, float* %39, i64 %38
  %41 = load float, float* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %42 = bitcast i8* %10 to float*
  %43 = getelementptr inbounds float, float* %42, i64 %36
  store float %41, float* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %58 to float*
  %60 = getelementptr inbounds float, float* %59, i64 %56
  %61 = load float, float* %60, align 4, !alias.scope !10, !noalias !9, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %55 = icmp eq i64 %54, 0
  br i1 %55, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %56 = sub i64 %54, 1
  store i64 %56, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %56
  %61 = load i32, i32* %60, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Set$f32", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32, !2, i64 40}
!5 = !{!4, !2, i64 0}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !12, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{!"Map$f32$i32", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32, !3, i64 40, !2, i64 48}
!20 = !{!19, !2, i64 0}
!21 = !{!19, !2, i64 16}
!22 = !{!19, !2, i64 20}
!23 = !{!19, !2, i64 48}
!24 = !{!19, !3, i64 8}
!25 = !{!19, !3, i64 24}
!26 = !{!19, !3, i64 32}
!27 = !{!19, !3, i64 40}
!28 = !{!"element float", !1, i64 0}
!29 = !{!28, !28, i64 0}
!30 = !{!4, !2, i64 16}
!31 = !{!4, !2, i64 20}
!32 = !{!4, !2, i64 40}
!33 = !{!4, !3, i64 8}
!34 = !{!4, !3, i64 24}
!35 = !{!4, !3, i64 32}
