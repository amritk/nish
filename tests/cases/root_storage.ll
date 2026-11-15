%struct.Ball = type { i32, i8* }
%struct.World = type { %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_storage_0_world.data = global [1 x %struct.World*] zeroinitializer, align 16
@nish_storage_0_world = internal global %struct.nish_array { i64 1, i64 1, i8* bitcast ([1 x %struct.World*]* @nish_storage_0_world.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"ball \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"slice out of range: [\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c") of length \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
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

define internal void @Ball.constructor(%struct.Ball* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Ball, %struct.Ball* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !5
  %1 = call i8* @nish_str_from_i32(i32 %id)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %1)
  %3 = getelementptr inbounds %struct.Ball, %struct.Ball* %this, i32 0, i32 1
  store i8* %2, i8** %3, align 8, !tbaa !6
  ret void
}

define internal void @World.constructor(%struct.World* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.World, %struct.World* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !8
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %6 = getelementptr inbounds %struct.World, %struct.World* %this, i32 0, i32 0
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !20
  ret void
}

define internal void @step() #0 {
entry:
  %w.addr = alloca %struct.World*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %5 = bitcast i8* %4 to %struct.World**
  %6 = getelementptr inbounds %struct.World*, %struct.World** %5, i64 0
  %7 = load %struct.World*, %struct.World** %6, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  store %struct.World* %7, %struct.World** %w.addr, align 8
  %8 = load %struct.World*, %struct.World** %w.addr, align 8
  %9 = icmp eq %struct.World* %8, null
  br i1 %9, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %10 = load %struct.World*, %struct.World** %w.addr, align 8
  %11 = load %struct.World*, %struct.World** %w.addr, align 8
  %12 = getelementptr inbounds %struct.World, %struct.World* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4, !tbaa !8
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.World, %struct.World* %10, i32 0, i32 1
  store i32 %15, i32* %17, align 4, !tbaa !8
  %18 = load %struct.World*, %struct.World** %w.addr, align 8
  %19 = getelementptr inbounds %struct.World, %struct.World* %18, i32 0, i32 0
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !20
  %21 = call i8* @nish_alloc_struct(i64 16)
  %22 = bitcast i8* %21 to %struct.Ball*
  %23 = load %struct.World*, %struct.World** %w.addr, align 8
  %24 = getelementptr inbounds %struct.World, %struct.World* %23, i32 0, i32 1
  %25 = load i32, i32* %24, align 4, !tbaa !8
  call void @Ball.constructor(%struct.Ball* %22, i32 %25)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %29 = load i64, i64* %28, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %30 = icmp eq i64 %27, %29
  br i1 %30, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %33 = bitcast i8* %32 to %struct.Ball**
  %34 = getelementptr inbounds %struct.Ball*, %struct.Ball** %33, i64 %27
  store %struct.Ball* %22, %struct.Ball** %34, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  %35 = add i64 %27, 1
  store i64 %35, i64* %26, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %36 = trunc i64 %35 to i32
  %37 = load %struct.World*, %struct.World** %w.addr, align 8
  %38 = getelementptr inbounds %struct.World, %struct.World* %37, i32 0, i32 0
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !tbaa !20
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %42 = trunc i64 %41 to i32
  %43 = icmp sgt i32 %42, 3
  br i1 %43, label %if.then.1, label %if.end.1

if.then.1:
  %44 = load %struct.World*, %struct.World** %w.addr, align 8
  %45 = load %struct.World*, %struct.World** %w.addr, align 8
  %46 = getelementptr inbounds %struct.World, %struct.World* %45, i32 0, i32 0
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !20
  %48 = call %struct.nish_array* @nish.sliceFrom$$Ball(%struct.nish_array* %47, i32 1)
  %49 = getelementptr inbounds %struct.World, %struct.World* %44, i32 0, i32 0
  store %struct.nish_array* %48, %struct.nish_array** %49, align 8, !tbaa !20
  br label %if.end.1

if.end.1:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @draw() #0 {
entry:
  %w.addr = alloca %struct.World*, align 8
  %sum.addr = alloca i32, align 4
  %b.addr = alloca %struct.Ball*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %5 = bitcast i8* %4 to %struct.World**
  %6 = getelementptr inbounds %struct.World*, %struct.World** %5, i64 0
  %7 = load %struct.World*, %struct.World** %6, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  store %struct.World* %7, %struct.World** %w.addr, align 8
  %8 = load %struct.World*, %struct.World** %w.addr, align 8
  %9 = icmp eq %struct.World* %8, null
  br i1 %9, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  store i32 0, i32* %sum.addr, align 4
  %10 = load %struct.World*, %struct.World** %w.addr, align 8
  %11 = getelementptr inbounds %struct.World, %struct.World* %10, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !20
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %13 = load i64, i64* %forof.idx, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %forof.body, label %forof.end

forof.body:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %19 = bitcast i8* %18 to %struct.Ball**
  %20 = getelementptr inbounds %struct.Ball*, %struct.Ball** %19, i64 %13
  %21 = load %struct.Ball*, %struct.Ball** %20, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  store %struct.Ball* %21, %struct.Ball** %b.addr, align 8
  %22 = load i32, i32* %sum.addr, align 4
  %23 = load %struct.Ball*, %struct.Ball** %b.addr, align 8
  %24 = getelementptr inbounds %struct.Ball, %struct.Ball* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4, !tbaa !5
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  %29 = load %struct.Ball*, %struct.Ball** %b.addr, align 8
  %30 = getelementptr inbounds %struct.Ball, %struct.Ball* %29, i32 0, i32 1
  %31 = load i8*, i8** %30, align 8, !tbaa !6
  %32 = bitcast i8* %31 to i64*
  %33 = load i64, i64* %32, align 8
  %34 = trunc i64 %33 to i32
  %35 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %34)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %36, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %38 = load i64, i64* %forof.idx, align 8
  %39 = add i64 %38, 1
  store i64 %39, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %40 = load i32, i32* %sum.addr, align 4
  ret i32 %40

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %i.addr = alloca i32, align 4
  %0 = call i32 @draw()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.World*
  call void @World.constructor(%struct.World* %3)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %6 = icmp ult i64 0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %9 = bitcast i8* %8 to %struct.World**
  %10 = getelementptr inbounds %struct.World*, %struct.World** %9, i64 0
  store %struct.World* %3, %struct.World** %10, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %11 = load i32, i32* %i.addr, align 4
  %12 = icmp slt i32 %11, 5
  br i1 %12, label %for.body, label %for.end

for.body:
  call void @step()
  %13 = call i32 @draw()
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %19 = icmp ult i64 0, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_storage_0_world, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %22 = bitcast i8* %21 to %struct.World**
  %23 = getelementptr inbounds %struct.World*, %struct.World** %22, i64 0
  store %struct.World* null, %struct.World** %23, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  %24 = call i32 @draw()
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.sliceFrom$$Ball(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %start) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = trunc i64 %1 to i32
  %3 = call %struct.nish_array* @nish.slice$$Ball(%struct.nish_array* %xs, i32 %start, i32 %2)
  ret %struct.nish_array* %3
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.slice$$Ball(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %start, i32 noundef %end) #0 {
entry:
  %from.addr = alloca i64, align 8
  %to.addr = alloca i64, align 8
  %len.addr = alloca i64, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %start to i64
  store i64 %0, i64* %from.addr, align 8
  %1 = sext i32 %end to i64
  store i64 %1, i64* %to.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %4 = trunc i64 %3 to i32
  %5 = sext i32 %4 to i64
  store i64 %5, i64* %len.addr, align 8
  %6 = load i64, i64* %from.addr, align 8
  %7 = icmp slt i64 %6, 0
  br i1 %7, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %8 = load i64, i64* %from.addr, align 8
  %9 = load i64, i64* %to.addr, align 8
  %10 = icmp sgt i64 %8, %9
  br label %lor.end.1

lor.end.1:
  %11 = phi i1 [ true, %entry ], [ %10, %lor.rhs.1 ]
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load i64, i64* %to.addr, align 8
  %13 = load i64, i64* %len.addr, align 8
  %14 = icmp sgt i64 %12, %13
  br label %lor.end

lor.end:
  %15 = phi i1 [ true, %lor.end.1 ], [ %14, %lor.rhs ]
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i64, i64* %from.addr, align 8
  %17 = call i8* @nish_str_from_i64(i64 %16)
  %18 = call i8* @nish_str_concat(i8* bitcast ({ i64, [22 x i8] }* @.str.1 to i8*), i8* %17)
  %19 = call i8* @nish_str_concat(i8* %18, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %20 = load i64, i64* %to.addr, align 8
  %21 = call i8* @nish_str_from_i64(i64 %20)
  %22 = call i8* @nish_str_concat(i8* %19, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [13 x i8] }* @.str.3 to i8*))
  %24 = load i64, i64* %len.addr, align 8
  %25 = call i8* @nish_str_from_i64(i64 %24)
  %26 = call i8* @nish_str_concat(i8* %23, i8* %25)
  call void @nish_panic(i8* %26)
  unreachable

if.end:
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 0, i64* %29, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 0, i64* %30, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* null, i8** %31, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  store %struct.nish_array* %28, %struct.nish_array** %out.addr, align 8
  %32 = load i64, i64* %from.addr, align 8
  %33 = trunc i64 %32 to i32
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %34 = load i32, i32* %i.addr, align 4
  %35 = icmp sge i32 %34, 0
  br i1 %35, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %36 = load i32, i32* %i.addr, align 4
  %37 = load i64, i64* %to.addr, align 8
  %38 = trunc i64 %37 to i32
  %39 = icmp slt i32 %36, %38
  br label %land.end.1

land.end.1:
  %40 = phi i1 [ false, %for.cond ], [ %39, %land.rhs.1 ]
  br i1 %40, label %land.rhs, label %land.end

land.rhs:
  %41 = load i32, i32* %i.addr, align 4
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %44 = trunc i64 %43 to i32
  %45 = icmp slt i32 %41, %44
  br label %land.end

land.end:
  %46 = phi i1 [ false, %land.end.1 ], [ %45, %land.rhs ]
  br i1 %46, label %for.body, label %for.end

for.body:
  %47 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %48 = load i32, i32* %i.addr, align 4
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %52 = bitcast i8* %51 to %struct.Ball**
  %53 = getelementptr inbounds %struct.Ball*, %struct.Ball** %52, i64 %49
  %54 = load %struct.Ball*, %struct.Ball** %53, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %58 = load i64, i64* %57, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %59 = icmp eq i64 %56, %58
  br i1 %59, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %47, i64 8)
  br label %push.store

push.store:
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %62 = bitcast i8* %61 to %struct.Ball**
  %63 = getelementptr inbounds %struct.Ball*, %struct.Ball** %62, i64 %56
  store %struct.Ball* %54, %struct.Ball** %63, align 8, !alias.scope !13, !noalias !12, !tbaa !22
  %64 = add i64 %56, 1
  store i64 %64, i64* %55, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %65 = trunc i64 %64 to i32
  br label %for.inc

for.inc:
  %66 = load i32, i32* %i.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %68 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %68
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!23, !24, !25, !26, !27}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Ball", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"World", !3, i64 0, !2, i64 8}
!8 = !{!7, !2, i64 8}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!7, !3, i64 0}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{i32 8, !"cf-protection-branch", i32 1}
!24 = !{i32 8, !"cf-protection-return", i32 1}
!25 = !{i32 8, !"branch-target-enforcement", i32 1}
!26 = !{i32 8, !"sign-return-address", i32 1}
!27 = !{i32 4, !"probe-stack", !"inline-asm"}
