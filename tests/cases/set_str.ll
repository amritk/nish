%struct.Set$str = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"red\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"green\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"blue\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Set maximum size exceeded\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [32 x i8] } { i64 31, [32 x i8] c"Map: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
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
  %s.addr = alloca %struct.Set$str*, align 8
  %had.addr = alloca i1, align 1
  %gone.addr = alloca i1, align 1
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 40)
  %1 = bitcast i8* %0 to %struct.Set$str*
  call void @nish.Set$str.constructor(%struct.Set$str* %1)
  store %struct.Set$str* %1, %struct.Set$str** %s.addr, align 8
  %2 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %3 = call %struct.Set$str* @nish.Set$str.add(%struct.Set$str* %2, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %4 = call %struct.Set$str* @nish.Set$str.add(%struct.Set$str* %3, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %5 = call %struct.Set$str* @nish.Set$str.add(%struct.Set$str* %4, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %6 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %7 = call i1 @nish.Set$str.has(%struct.Set$str* %6, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %9 = call i1 @nish.Set$str.has(%struct.Set$str* %8, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*))
  %10 = xor i1 %9, true
  br label %land.end

land.end:
  %11 = phi i1 [ false, %entry ], [ %10, %land.rhs ]
  store i1 %11, i1* %had.addr, align 1
  %12 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %13 = call i1 @nish.Set$str.delete(%struct.Set$str* %12, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  store i1 %13, i1* %gone.addr, align 1
  %14 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %15 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %14, i32 0, i32 0
  %16 = load i32, i32* %15, align 4, !tbaa !5
  %17 = call i8* @nish_str_from_i32(i32 %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %19 = load i1, i1* %had.addr, align 1
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %23 = load i1, i1* %gone.addr, align 1
  %24 = select i1 %23, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %25 = call i8* @nish_str_concat(i8* %22, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %27 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %28 = call i1 @nish.Set$str.delete(%struct.Set$str* %27, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %29 = select i1 %28, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %30 = call i8* @nish_str_concat(i8* %26, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %32 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %33 = call i1 @nish.Set$str.has(%struct.Set$str* %32, i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %34 = select i1 %33, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %35 = call i8* @nish_str_concat(i8* %31, i8* %34)
  call void @nish_print(i8* %35)
  %36 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  call void @nish.Set$str.clear(%struct.Set$str* %36)
  %37 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %38 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !5
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %42 = load %struct.Set$str*, %struct.Set$str** %s.addr, align 8
  %43 = call i1 @nish.Set$str.has(%struct.Set$str* %42, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  %44 = select i1 %43, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %45 = call i8* @nish_str_concat(i8* %41, i8* %44)
  call void @nish_print(i8* %45)
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

define internal noundef i32 @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
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
  %45 = load i32, i32* %to.addr, align 4
  ret i32 %45
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #2 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = mul nsw i32 %live, 2
  %4 = icmp slt i32 %3, %used
  br i1 %4, label %if.then, label %if.end

if.then:
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %6 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  store i32 0, i32* %13, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret %struct.nish_array* %slots

if.end:
  %16 = load i32, i32* %n.addr, align 4
  %17 = mul nsw i32 %16, 2
  %18 = sext i32 %17 to i64
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 %18, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 %18, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %23 = mul i64 %18, 4
  %24 = call i8* @nish_alloc_struct(i64 %23)
  call void @llvm.memset.p0i8.i64(i8* align 8 %24, i8 0, i64 %23, i1 false), !alias.scope !10, !noalias !9
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  ret %struct.nish_array* %20
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

define internal void @nish.Set$str.constructor(%struct.Set$str* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !19
  %2 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
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
  %11 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !21
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %17 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !22
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %23 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !23
  ret void
}

define internal noundef i64 @nish.Set$str.probe(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  %2 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !19
  %4 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !23
  %6 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !22
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Set$str.has(%struct.Set$str* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = call i64 @nish.Set$str.probe(%struct.Set$str* %this, i8* %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(40) %struct.Set$str* @nish.Set$str.add(%struct.Set$str* noundef nonnull align 8 dereferenceable(40) %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Set$str.probe(%struct.Set$str* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load i64, i64* %found.addr, align 8
  call void @nish.Set$str.insertAt(%struct.Set$str* %this, i64 %3, i8* %key)
  br label %if.end

if.end:
  ret %struct.Set$str* %this
}

define internal noundef zeroext i1 @nish.Set$str.delete(%struct.Set$str* noundef nonnull align 8 dereferenceable(40) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %found.addr = alloca i64, align 8
  %at.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i64 @nish.Set$str.probe(%struct.Set$str* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp slt i64 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %at.addr, align 4
  %5 = load i64, i64* %found.addr, align 8
  %6 = ashr i64 %5, 32
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %bucket.addr, align 4
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %bucket.addr, align 4
  %11 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !21
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %10, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %if.end ], [ %16, %land.rhs ]
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  %18 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !21
  %20 = load i32, i32* %bucket.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %21
  store i32 16777216, i32* %25, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end.1

if.end.1:
  %26 = load i32, i32* %at.addr, align 4
  %27 = icmp sge i32 %26, 0
  br i1 %27, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %28 = load i32, i32* %at.addr, align 4
  %29 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !23
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = trunc i64 %32 to i32
  %34 = icmp slt i32 %28, %33
  br label %land.end.1

land.end.1:
  %35 = phi i1 [ false, %if.end.1 ], [ %34, %land.rhs.1 ]
  br i1 %35, label %if.then.2, label %if.end.2

if.then.2:
  %36 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !23
  %38 = load i32, i32* %at.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %39
  store i32 0, i32* %43, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end.2

if.end.2:
  %44 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %45 = load i32, i32* %44, align 4, !tbaa !20
  %46 = sub nsw i32 %45, 1
  %47 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 %46, i32* %47, align 4, !tbaa !20
  %48 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  %49 = load i32, i32* %48, align 4, !tbaa !5
  %50 = sub nsw i32 %49, 1
  %51 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store i32 %50, i32* %51, align 4, !tbaa !5
  ret i1 true
}

define internal void @nish.Set$str.clear(%struct.Set$str* noundef nonnull align 8 dereferenceable(40) nocapture %this) #0 {
entry:
  %slots.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !21
  store %struct.nish_array* %1, %struct.nish_array** %slots.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %2 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = trunc i64 %4 to i32
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %6 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  store i32 0, i32* %13, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %16 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !22
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = trunc i64 %19 to i32
  %21 = icmp sgt i32 %20, 0
  br i1 %21, label %while.body, label %while.end

while.body:
  %22 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !22
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %26 = icmp eq i64 %25, 0
  br i1 %26, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %27 = sub i64 %25, 1
  store i64 %27, i64* %24, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %30 = bitcast i8* %29 to i8**
  %31 = getelementptr inbounds i8*, i8** %30, i64 %27
  %32 = load i8*, i8** %31, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  br label %while.cond

while.end:
  br label %while.cond.1

while.cond.1:
  %33 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !23
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %37 = trunc i64 %36 to i32
  %38 = icmp sgt i32 %37, 0
  br i1 %38, label %while.body.1, label %while.end.1

while.body.1:
  %39 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !23
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %43 = icmp eq i64 %42, 0
  br i1 %43, label %pop.empty.1, label %pop.ok.1

pop.empty.1:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.1:
  %44 = sub i64 %42, 1
  store i64 %44, i64* %41, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 %44
  %49 = load i32, i32* %48, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %while.cond.1

while.end.1:
  %50 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 0, i32* %50, align 4, !tbaa !20
  %51 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store i32 0, i32* %51, align 4, !tbaa !5
  ret void
}

define internal void @nish.Set$str.insertAt(%struct.Set$str* noundef nonnull align 8 dereferenceable(40) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key) #0 {
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
  %7 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !22
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = trunc i64 %10 to i32
  %12 = icmp sge i32 %11, 16777215
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %14 = load i32, i32* %13, align 4, !tbaa !20
  %15 = icmp sge i32 %14, 16777215
  br i1 %15, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.6 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  %16 = sub nsw i32 0, 1
  store i32 %16, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %17 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
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
  %26 = bitcast i8* %25 to i8**
  %27 = getelementptr inbounds i8*, i8** %26, i64 %20
  store i8* %key, i8** %27, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = trunc i64 %28 to i32
  %30 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !23
  %32 = load i32, i32* %h.addr, align 4
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 1
  %36 = load i64, i64* %35, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %37 = icmp eq i64 %34, %36
  br i1 %37, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %31, i64 4)
  br label %push.store.1

push.store.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %40 = bitcast i8* %39 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %34
  store i32 %32, i32* %41, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %42 = add i64 %34, 1
  store i64 %42, i64* %33, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %43 = trunc i64 %42 to i32
  %44 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %45 = load i32, i32* %44, align 4, !tbaa !20
  %46 = add nsw i32 %45, 1
  %47 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  store i32 %46, i32* %47, align 4, !tbaa !20
  %48 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  %49 = load i32, i32* %48, align 4, !tbaa !5
  %50 = add nsw i32 %49, 1
  %51 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 0
  store i32 %50, i32* %51, align 4, !tbaa !5
  %52 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %53 = load %struct.nish_array*, %struct.nish_array** %52, align 8, !tbaa !22
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %56 = trunc i64 %55 to i32
  store i32 %56, i32* %used.addr, align 4
  %57 = load i32, i32* %bucket.addr, align 4
  %58 = icmp sge i32 %57, 0
  br i1 %58, label %land.rhs, label %land.end

land.rhs:
  %59 = load i32, i32* %bucket.addr, align 4
  %60 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %61 = load %struct.nish_array*, %struct.nish_array** %60, align 8, !tbaa !21
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %64 = trunc i64 %63 to i32
  %65 = icmp slt i32 %59, %64
  br label %land.end

land.end:
  %66 = phi i1 [ false, %push.store.1 ], [ %65, %land.rhs ]
  br i1 %66, label %if.then.2, label %if.else

if.then.2:
  %67 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %68 = load %struct.nish_array*, %struct.nish_array** %67, align 8, !tbaa !21
  %69 = load i32, i32* %bucket.addr, align 4
  %70 = sext i32 %69 to i64
  %71 = load i32, i32* %h.addr, align 4
  %72 = load i32, i32* %used.addr, align 4
  %73 = sub nsw i32 %72, 1
  %74 = call i32 @nish.slotWord(i32 %71, i32 %73)
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %77 = icmp ult i64 %70, %76
  br i1 %77, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %70, i64 %76)
  unreachable

bounds.ok:
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %80 = bitcast i8* %79 to i32*
  %81 = getelementptr inbounds i32, i32* %80, i64 %70
  store i32 %74, i32* %81, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  br label %if.end.2

if.else:
  %82 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %83 = load %struct.nish_array*, %struct.nish_array** %82, align 8, !tbaa !21
  %84 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  %85 = load i32, i32* %84, align 4, !tbaa !19
  %86 = load i32, i32* %h.addr, align 4
  %87 = load i32, i32* %used.addr, align 4
  %88 = sub nsw i32 %87, 1
  call void @nish.fileEntry(%struct.nish_array* %83, i32 %85, i32 %86, i32 %88)
  br label %if.end.2

if.end.2:
  %89 = load i32, i32* %used.addr, align 4
  %90 = mul nsw i32 %89, 4
  %91 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %92 = load %struct.nish_array*, %struct.nish_array** %91, align 8, !tbaa !21
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %95 = trunc i64 %94 to i32
  %96 = mul nsw i32 %95, 3
  %97 = icmp sgt i32 %90, %96
  br i1 %97, label %if.then.3, label %if.end.3

if.then.3:
  call void @nish.Set$str.rebuild(%struct.Set$str* %this)
  br label %if.end.3

if.end.3:
  ret void
}

define internal void @nish.Set$str.rebuild(%struct.Set$str* noundef nonnull align 8 dereferenceable(40) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !21
  %7 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %8 = load i32, i32* %7, align 4, !tbaa !20
  %9 = load i32, i32* %used.addr, align 4
  %10 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %6, i32 %8, i32 %9)
  store %struct.nish_array* %10, %struct.nish_array** %slots.addr, align 8
  %11 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 3
  %12 = load i32, i32* %11, align 4, !tbaa !20
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 4
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !22
  %17 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %18 = load %struct.nish_array*, %struct.nish_array** %17, align 8, !tbaa !23
  call void @nish.compactEntries$str(%struct.nish_array* %16, %struct.nish_array* %18)
  %19 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !23
  %21 = call i32 @nish.compactHashes(%struct.nish_array* %20)
  br label %if.end

if.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %23 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 1
  store %struct.nish_array* %22, %struct.nish_array** %23, align 8, !tbaa !21
  %24 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %27 = trunc i64 %26 to i32
  %28 = sub nsw i32 %27, 1
  %29 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 2
  store i32 %28, i32* %29, align 4, !tbaa !19
  %30 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %31 = getelementptr inbounds %struct.Set$str, %struct.Set$str* %this, i32 0, i32 5
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !23
  call void @nish.refile(%struct.nish_array* %30, %struct.nish_array* %32)
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = trunc i64 %20 to i32
  %35 = icmp slt i32 %33, %34
  br label %land.end

land.end:
  %36 = phi i1 [ false, %while.cond ], [ %35, %land.rhs ]
  br i1 %36, label %while.body, label %while.end

while.body:
  %37 = load i32, i32* %bucket.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %22 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  store i32 %41, i32* %word.addr, align 4
  %42 = load i32, i32* %word.addr, align 4
  %43 = icmp eq i32 %42, 0
  br i1 %43, label %if.then, label %if.end

if.then:
  %44 = load i32, i32* %bucket.addr, align 4
  %45 = load i32, i32* %h.addr, align 4
  %46 = tail call i64 @nish.absentAt(i32 %44, i32 %45)
  ret i64 %46

if.end:
  %47 = load i32, i32* %word.addr, align 4
  %48 = lshr i32 %47, 24
  %49 = load i32, i32* %fingerprint.addr, align 4
  %50 = icmp eq i32 %48, %49
  br i1 %50, label %if.then.1, label %if.end.1

if.then.1:
  %51 = load i32, i32* %word.addr, align 4
  %52 = and i32 %51, 16777215
  %53 = sub nsw i32 %52, 1
  store i32 %53, i32* %at.addr, align 4
  %54 = load i32, i32* %at.addr, align 4
  %55 = icmp sge i32 %54, 0
  br i1 %55, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %56 = load i32, i32* %at.addr, align 4
  %57 = trunc i64 %24 to i32
  %58 = icmp slt i32 %56, %57
  br label %land.end.4

land.end.4:
  %59 = phi i1 [ false, %if.then.1 ], [ %58, %land.rhs.4 ]
  br i1 %59, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %60 = load i32, i32* %at.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = bitcast i8* %26 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 %61
  %64 = load i32, i32* %63, align 4, !alias.scope !10, !noalias !9, !tbaa !17
  %65 = load i32, i32* %h.addr, align 4
  %66 = icmp eq i32 %64, %65
  br label %land.end.3

land.end.3:
  %67 = phi i1 [ false, %land.end.4 ], [ %66, %land.rhs.3 ]
  br i1 %67, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %68 = load i32, i32* %at.addr, align 4
  %69 = trunc i64 %28 to i32
  %70 = icmp slt i32 %68, %69
  br label %land.end.2

land.end.2:
  %71 = phi i1 [ false, %land.end.3 ], [ %70, %land.rhs.2 ]
  br i1 %71, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %72 = load i32, i32* %at.addr, align 4
  %73 = sext i32 %72 to i64
  %74 = bitcast i8* %30 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 %73
  %76 = load i8*, i8** %75, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  %77 = call zeroext i1 @nish_str_eq(i8* %76, i8* %key)
  br label %land.end.1

land.end.1:
  %78 = phi i1 [ false, %land.end.2 ], [ %77, %land.rhs.1 ]
  br i1 %78, label %if.then.2, label %if.end.2

if.then.2:
  %79 = load i32, i32* %bucket.addr, align 4
  %80 = load i32, i32* %at.addr, align 4
  %81 = tail call i64 @nish.foundAt(i32 %79, i32 %80)
  ret i64 %81

if.end.2:
  br label %if.end.1

if.end.1:
  %82 = load i32, i32* %bucket.addr, align 4
  %83 = add nsw i32 %82, 1
  %84 = and i32 %83, %mask
  store i32 %84, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [32 x i8] }* @.str.7 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
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
  %39 = bitcast i8* %10 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 %38
  %41 = load i8*, i8** %40, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  %42 = bitcast i8* %10 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  store i8* %41, i8** %43, align 8, !alias.scope !10, !noalias !9, !tbaa !25
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
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %56
  %61 = load i8*, i8** %60, align 8, !alias.scope !10, !noalias !9, !tbaa !25
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Set$str", !2, i64 0, !3, i64 8, !2, i64 16, !2, i64 20, !3, i64 24, !3, i64 32}
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
!24 = !{!"element ptr", !1, i64 0}
!25 = !{!24, !24, i64 0}
