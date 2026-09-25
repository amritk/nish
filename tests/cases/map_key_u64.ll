%struct.Map$u64$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

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

define noundef i32 @nish_main() #0 {
entry:
  %k0.addr = alloca i64, align 8
  %k1.addr = alloca i64, align 8
  %k2.addr = alloca i64, align 8
  %k3.addr = alloca i64, align 8
  %k4.addr = alloca i64, align 8
  %m.addr = alloca %struct.Map$u64$i32*, align 8
  %found.addr = alloca i32, align 4
  %gone.addr = alloca i1, align 1
  %again.addr = alloca i1, align 1
  %arena.mark = call i64 @nish_arena_mark()
  store i64 0, i64* %k0.addr, align 8
  store i64 1, i64* %k1.addr, align 8
  %0 = sext i32 0 to i64
  %1 = sext i32 1 to i64
  %2 = sub i64 %0, %1
  store i64 %2, i64* %k2.addr, align 8
  %3 = sext i32 1 to i64
  %4 = sext i32 63 to i64
  %5 = and i64 %4, 63
  %6 = shl i64 %3, %5
  store i64 %6, i64* %k3.addr, align 8
  store i64 4294967296, i64* %k4.addr, align 8
  %7 = call i8* @nish_alloc_struct(i64 48)
  %8 = bitcast i8* %7 to %struct.Map$u64$i32*
  call void @nish.Map$u64$i32.constructor(%struct.Map$u64$i32* %8)
  store %struct.Map$u64$i32* %8, %struct.Map$u64$i32** %m.addr, align 8
  %9 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %10 = load i64, i64* %k0.addr, align 8
  %11 = call %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* %9, i64 %10, i32 1)
  %12 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %13 = load i64, i64* %k1.addr, align 8
  %14 = call %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* %12, i64 %13, i32 2)
  %15 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %16 = load i64, i64* %k2.addr, align 8
  %17 = call %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* %15, i64 %16, i32 3)
  %18 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %19 = load i64, i64* %k3.addr, align 8
  %20 = call %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* %18, i64 %19, i32 4)
  %21 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %22 = load i64, i64* %k4.addr, align 8
  %23 = call %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* %21, i64 %22, i32 5)
  store i32 0, i32* %found.addr, align 4
  %24 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %25 = load i64, i64* %k0.addr, align 8
  %26 = call i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* %24, i64 %25)
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load i32, i32* %found.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %found.addr, align 4
  br label %if.end

if.end:
  %29 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %30 = load i64, i64* %k1.addr, align 8
  %31 = call i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* %29, i64 %30)
  br i1 %31, label %if.then.1, label %if.end.1

if.then.1:
  %32 = load i32, i32* %found.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %found.addr, align 4
  br label %if.end.1

if.end.1:
  %34 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %35 = load i64, i64* %k2.addr, align 8
  %36 = call i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* %34, i64 %35)
  br i1 %36, label %if.then.2, label %if.end.2

if.then.2:
  %37 = load i32, i32* %found.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %found.addr, align 4
  br label %if.end.2

if.end.2:
  %39 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %40 = load i64, i64* %k3.addr, align 8
  %41 = call i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* %39, i64 %40)
  br i1 %41, label %if.then.3, label %if.end.3

if.then.3:
  %42 = load i32, i32* %found.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %found.addr, align 4
  br label %if.end.3

if.end.3:
  %44 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %45 = load i64, i64* %k4.addr, align 8
  %46 = call i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* %44, i64 %45)
  br i1 %46, label %if.then.4, label %if.end.4

if.then.4:
  %47 = load i32, i32* %found.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %found.addr, align 4
  br label %if.end.4

if.end.4:
  %49 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %50 = load i64, i64* %k0.addr, align 8
  %51 = call %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* %49, i64 %50, i32 10)
  %52 = load i64, i64* %k1.addr, align 8
  %53 = call %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* %51, i64 %52, i32 20)
  %54 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %55 = load i64, i64* %k2.addr, align 8
  %56 = call i1 @nish.Map$u64$i32.delete(%struct.Map$u64$i32* %54, i64 %55)
  store i1 %56, i1* %gone.addr, align 1
  %57 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %58 = load i64, i64* %k2.addr, align 8
  %59 = call i1 @nish.Map$u64$i32.delete(%struct.Map$u64$i32* %57, i64 %58)
  store i1 %59, i1* %again.addr, align 1
  %60 = load i32, i32* %found.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %63 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %64 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %63, i32 0, i32 0
  %65 = load i32, i32* %64, align 4, !tbaa !5
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %62, i8* %66)
  %68 = call i8* @nish_str_concat(i8* %67, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %69 = load i1, i1* %gone.addr, align 1
  %70 = select i1 %69, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %71 = call i8* @nish_str_concat(i8* %68, i8* %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %73 = load i1, i1* %again.addr, align 1
  %74 = select i1 %73, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %75 = call i8* @nish_str_concat(i8* %72, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %77 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %78 = load i64, i64* %k2.addr, align 8
  %79 = call i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* %77, i64 %78)
  %80 = select i1 %79, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %81 = call i8* @nish_str_concat(i8* %76, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %83 = load %struct.Map$u64$i32*, %struct.Map$u64$i32** %m.addr, align 8
  %84 = load i64, i64* %k3.addr, align 8
  %85 = call i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* %83, i64 %84)
  %86 = select i1 %85, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %87 = call i8* @nish_str_concat(i8* %82, i8* %86)
  call void @nish_print(i8* %87)
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

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
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
  %11 = load i32, i32* %mask.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %7 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %13
  %16 = load i32, i32* %15, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %17 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %11, i32 %16, i32 %17)
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.killEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes, i64 noundef %found) #2 {
entry:
  %at.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = trunc i64 %found to i32
  store i32 %0, i32* %at.addr, align 4
  %1 = ashr i64 %found, 32
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %bucket.addr, align 4
  %3 = load i32, i32* %bucket.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %bucket.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %entry ], [ %9, %land.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %bucket.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %12
  store i32 16777216, i32* %16, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end

if.end:
  %17 = load i32, i32* %at.addr, align 4
  %18 = icmp sge i32 %17, 0
  br i1 %18, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %19 = load i32, i32* %at.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = trunc i64 %21 to i32
  %23 = icmp slt i32 %19, %22
  br label %land.end.1

land.end.1:
  %24 = phi i1 [ false, %if.end ], [ %23, %land.rhs.1 ]
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = load i32, i32* %at.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %26
  store i32 0, i32* %30, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end.1

if.end.1:
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
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = icmp ult i64 %6, %10
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %10)
  unreachable

bounds.ok:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %6
  store i32 %8, i32* %15, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end

if.else:
  %16 = sub nsw i32 %used, 1
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %16)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$u64$i32.constructor(%struct.Map$u64$i32* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !19
  %2 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !20
  %3 = sext i32 8 to i64
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 %3, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 %3, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %8 = mul i64 %3, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !10, !noalias !9
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %11 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !21
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %17 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !22
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %23 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !23
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %29 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !24
  ret void
}

define internal noundef i64 @nish.Map$u64$i32.probe(%struct.Map$u64$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i64 noundef %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !19
  %4 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !24
  %6 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !22
  %8 = call i64 @nish.probeTable$u64(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i64 %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Map$u64$i32.has(%struct.Map$u64$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i64 noundef %key) #0 {
entry:
  %0 = call i64 @nish.Map$u64$i32.probe(%struct.Map$u64$i32* %this, i64 %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Map$u64$i32* @nish.Map$u64$i32.set(%struct.Map$u64$i32* noundef nonnull align 8 dereferenceable(48) %this, i64 noundef %key, i32 noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$u64$i32.probe(%struct.Map$u64$i32* %this, i64 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$u64$i32.setValueAt(%struct.Map$u64$i32* %this, i32 %4, i32 %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$u64$i32.insertAt(%struct.Map$u64$i32* %this, i64 %5, i64 %key, i32 %value)
  br label %if.end

if.end:
  ret %struct.Map$u64$i32* %this
}

define internal noundef zeroext i1 @nish.Map$u64$i32.delete(%struct.Map$u64$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$u64$i32.probe(%struct.Map$u64$i32* %this, i64 %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !21
  %5 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !24
  %7 = load i64, i64* %found.addr, align 8
  call void @nish.killEntry(%struct.nish_array* %4, %struct.nish_array* %6, i64 %7)
  %8 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !20
  %10 = sub nsw i32 %9, 1
  %11 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  store i32 %10, i32* %11, align 4, !tbaa !20
  %12 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !5
  %14 = sub nsw i32 %13, 1
  %15 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 0
  store i32 %14, i32* %15, align 4, !tbaa !5
  ret i1 true
}

define internal void @nish.Map$u64$i32.setValueAt(%struct.Map$u64$i32* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, i32 noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !23
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !23
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

define internal void @nish.Map$u64$i32.insertAt(%struct.Map$u64$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i64 noundef %key, i32 noundef %value) #0 {
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
  %7 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !22
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = trunc i64 %10 to i32
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !20
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$u64$i32.rebuild(%struct.Map$u64$i32* %this)
  %16 = sub nsw i32 0, 1
  store i32 %16, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %17 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 4
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !22
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %18, i64 8)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %26 = bitcast i8* %25 to i64*
  %27 = getelementptr inbounds i64, i64* %26, i64 %20
  store i64 %key, i64* %27, align 8, !alias.scope !10, !noalias !9, !tbaa !26
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = trunc i64 %28 to i32
  %30 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 5
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !23
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 1
  %35 = load i64, i64* %34, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %36 = icmp eq i64 %33, %35
  br i1 %36, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %31, i64 4)
  br label %push.store.1

push.store.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  store i32 %value, i32* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %41 = add i64 %33, 1
  store i64 %41, i64* %32, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %42 = trunc i64 %41 to i32
  %43 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !24
  %45 = load i32, i32* %h.addr, align 4
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1
  %49 = load i64, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %50 = icmp eq i64 %47, %49
  br i1 %50, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %44, i64 4)
  br label %push.store.2

push.store.2:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %53 = bitcast i8* %52 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 %47
  store i32 %45, i32* %54, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %55 = add i64 %47, 1
  store i64 %55, i64* %46, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %56 = trunc i64 %55 to i32
  %57 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  %58 = load i32, i32* %57, align 4, !tbaa !20
  %59 = add nsw i32 %58, 1
  %60 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  store i32 %59, i32* %60, align 4, !tbaa !20
  %61 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 0
  %62 = load i32, i32* %61, align 4, !tbaa !5
  %63 = add nsw i32 %62, 1
  %64 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 0
  store i32 %63, i32* %64, align 4, !tbaa !5
  %65 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 4
  %66 = load %struct.nish_array*, %struct.nish_array** %65, align 8, !tbaa !22
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %69 = trunc i64 %68 to i32
  store i32 %69, i32* %used.addr, align 4
  %70 = load i32, i32* %used.addr, align 4
  %71 = mul nsw i32 %70, 4
  %72 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 1
  %73 = load %struct.nish_array*, %struct.nish_array** %72, align 8, !tbaa !21
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %76 = trunc i64 %75 to i32
  %77 = mul nsw i32 %76, 3
  %78 = icmp sgt i32 %71, %77
  br i1 %78, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$u64$i32.rebuild(%struct.Map$u64$i32* %this)
  br label %if.end.2

if.else:
  %79 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 1
  %80 = load %struct.nish_array*, %struct.nish_array** %79, align 8, !tbaa !21
  %81 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 2
  %82 = load i32, i32* %81, align 4, !tbaa !19
  %83 = load i32, i32* %bucket.addr, align 4
  %84 = load i32, i32* %h.addr, align 4
  %85 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %80, i32 %82, i32 %83, i32 %84, i32 %85)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Map$u64$i32.rebuild(%struct.Map$u64$i32* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !21
  %7 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  %8 = load i32, i32* %7, align 4, !tbaa !20
  %9 = load i32, i32* %used.addr, align 4
  %10 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %6, i32 %8, i32 %9)
  store %struct.nish_array* %10, %struct.nish_array** %slots.addr, align 8
  %11 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 3
  %12 = load i32, i32* %11, align 4, !tbaa !20
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 4
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !22
  %17 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !24
  call void @nish.compactEntries$u64(%struct.nish_array* %16, %struct.nish_array* %18)
  %19 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 5
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !23
  %21 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !24
  call void @nish.compactEntries$i32(%struct.nish_array* %20, %struct.nish_array* %22)
  %23 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !24
  call void @nish.compactHashes(%struct.nish_array* %24)
  br label %if.end

if.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %26 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 1
  store %struct.nish_array* %25, %struct.nish_array** %26, align 8, !tbaa !21
  %27 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = trunc i64 %29 to i32
  %31 = sub nsw i32 %30, 1
  %32 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 2
  store i32 %31, i32* %32, align 4, !tbaa !19
  %33 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %34 = getelementptr inbounds %struct.Map$u64$i32, %struct.Map$u64$i32* %this, i32 0, i32 6
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !tbaa !24
  call void @nish.refile(%struct.nish_array* %33, %struct.nish_array* %35)
  ret void
}

define internal noundef i64 @nish.probeTable$u64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i64 noundef %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = lshr i64 %key, 33
  %1 = xor i64 %key, %0
  %2 = mul i64 %1, -49064778989728563
  %3 = lshr i64 %2, 33
  %4 = xor i64 %2, %3
  %5 = mul i64 %4, -4265267296055464877
  %6 = lshr i64 %5, 33
  %7 = xor i64 %5, %6
  %8 = trunc i64 %7 to i32
  %9 = lshr i64 %7, 32
  %10 = trunc i64 %9 to i32
  %11 = xor i32 %8, %10
  %12 = icmp eq i32 %11, 0
  %13 = select i1 %12, i32 1, i32 %11
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = lshr i32 %14, 24
  store i32 %15, i32* %fingerprint.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = call i32 @nish.homeBucket(i32 %16, i32 %mask)
  store i32 %17, i32* %bucket.addr, align 4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %30 = load i32, i32* %bucket.addr, align 4
  %31 = icmp sge i32 %30, 0
  br i1 %31, label %land.rhs, label %land.end

land.rhs:
  %32 = load i32, i32* %bucket.addr, align 4
  %33 = trunc i64 %19 to i32
  %34 = icmp slt i32 %32, %33
  br label %land.end

land.end:
  %35 = phi i1 [ false, %while.cond ], [ %34, %land.rhs ]
  br i1 %35, label %while.body, label %while.end

while.body:
  %36 = load i32, i32* %bucket.addr, align 4
  %37 = sext i32 %36 to i64
  %38 = bitcast i8* %21 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %37
  %40 = load i32, i32* %39, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %40, i32* %word.addr, align 4
  %41 = load i32, i32* %word.addr, align 4
  %42 = icmp eq i32 %41, 0
  br i1 %42, label %if.then, label %if.end

if.then:
  %43 = load i32, i32* %bucket.addr, align 4
  %44 = load i32, i32* %h.addr, align 4
  %45 = tail call i64 @nish.absentAt(i32 %43, i32 %44)
  ret i64 %45

if.end:
  %46 = load i32, i32* %word.addr, align 4
  %47 = lshr i32 %46, 24
  %48 = load i32, i32* %fingerprint.addr, align 4
  %49 = icmp eq i32 %47, %48
  br i1 %49, label %if.then.1, label %if.end.1

if.then.1:
  %50 = load i32, i32* %word.addr, align 4
  %51 = and i32 %50, 16777215
  %52 = sub nsw i32 %51, 1
  store i32 %52, i32* %at.addr, align 4
  %53 = load i32, i32* %at.addr, align 4
  %54 = icmp sge i32 %53, 0
  br i1 %54, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %55 = load i32, i32* %at.addr, align 4
  %56 = trunc i64 %23 to i32
  %57 = icmp slt i32 %55, %56
  br label %land.end.4

land.end.4:
  %58 = phi i1 [ false, %if.then.1 ], [ %57, %land.rhs.4 ]
  br i1 %58, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %59 = load i32, i32* %at.addr, align 4
  %60 = sext i32 %59 to i64
  %61 = bitcast i8* %25 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %60
  %63 = load i32, i32* %62, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %64 = load i32, i32* %h.addr, align 4
  %65 = icmp eq i32 %63, %64
  br label %land.end.3

land.end.3:
  %66 = phi i1 [ false, %land.end.4 ], [ %65, %land.rhs.3 ]
  br i1 %66, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %67 = load i32, i32* %at.addr, align 4
  %68 = trunc i64 %27 to i32
  %69 = icmp slt i32 %67, %68
  br label %land.end.2

land.end.2:
  %70 = phi i1 [ false, %land.end.3 ], [ %69, %land.rhs.2 ]
  br i1 %70, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %71 = load i32, i32* %at.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = bitcast i8* %29 to i64*
  %74 = getelementptr inbounds i64, i64* %73, i64 %72
  %75 = load i64, i64* %74, align 8, !alias.scope !10, !noalias !9, !tbaa !26
  %76 = icmp eq i64 %75, %key
  br label %land.end.1

land.end.1:
  %77 = phi i1 [ false, %land.end.2 ], [ %76, %land.rhs.1 ]
  br i1 %77, label %if.then.2, label %if.end.2

if.then.2:
  %78 = load i32, i32* %bucket.addr, align 4
  %79 = load i32, i32* %at.addr, align 4
  %80 = tail call i64 @nish.foundAt(i32 %78, i32 %79)
  ret i64 %80

if.end.2:
  br label %if.end.1

if.end.1:
  %81 = load i32, i32* %bucket.addr, align 4
  %82 = add nsw i32 %81, 1
  %83 = and i32 %82, %mask
  store i32 %83, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.4 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.compactEntries$u64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
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
  %39 = bitcast i8* %10 to i64*
  %40 = getelementptr inbounds i64, i64* %39, i64 %38
  %41 = load i64, i64* %40, align 8, !alias.scope !10, !noalias !9, !tbaa !26
  %42 = bitcast i8* %10 to i64*
  %43 = getelementptr inbounds i64, i64* %42, i64 %36
  store i64 %41, i64* %43, align 8, !alias.scope !10, !noalias !9, !tbaa !26
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
  %59 = bitcast i8* %58 to i64*
  %60 = getelementptr inbounds i64, i64* %59, i64 %56
  %61 = load i64, i64* %60, align 8, !alias.scope !10, !noalias !9, !tbaa !26
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
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Map$u64$i32", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32, !3, i64 40}
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
!19 = !{!4, !2, i64 16}
!20 = !{!4, !2, i64 20}
!21 = !{!4, !3, i64 8}
!22 = !{!4, !3, i64 24}
!23 = !{!4, !3, i64 32}
!24 = !{!4, !3, i64 40}
!25 = !{!"element i64", !1, i64 0}
!26 = !{!25, !25, i64 0}
