%struct.State = type { i1, i1, i1, i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
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

define internal noundef i32 @guarded(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %s) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !5
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 0
  store i1 true, i1* %2, align 1, !tbaa !5
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 4
  %8 = load i32, i32* %7, align 4, !tbaa !17
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = trunc i64 %19 to i32
  %21 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 0
  store i1 false, i1* %21, align 1, !tbaa !5
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = trunc i64 %24 to i32
  ret i32 %25
}

define internal noundef i32 @whenReady(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %s) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 1
  %1 = load i1, i1* %0, align 1, !tbaa !20
  %2 = xor i1 %1, true
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 1
  store i1 true, i1* %3, align 1, !tbaa !20
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 4
  %9 = load i32, i32* %8, align 4, !tbaa !17
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  store i8* %10, i8** %19, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %21 = trunc i64 %20 to i32
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %25 = trunc i64 %24 to i32
  ret i32 %25
}

define internal noundef i32 @untilDone(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %s) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 2
  %1 = load i1, i1* %0, align 1, !tbaa !21
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 4
  %3 = load i32, i32* %2, align 4, !tbaa !17
  %4 = icmp sgt i32 %3, 5
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %6 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 2
  store i1 true, i1* %6, align 1, !tbaa !21
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %11 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 4
  %12 = load i32, i32* %11, align 4, !tbaa !17
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  %17 = load i64, i64* %16, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %18 = icmp eq i64 %15, %17
  br i1 %18, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %10, i64 8)
  br label %push.store

push.store:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %21 = bitcast i8* %20 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 %15
  store i8* %13, i8** %22, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %23 = add i64 %15, 1
  store i64 %23, i64* %14, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = trunc i64 %23 to i32
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = trunc i64 %27 to i32
  ret i32 %28
}

define internal noundef i32 @capped(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %s) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 5
  %1 = load i32, i32* %0, align 4, !tbaa !22
  %2 = icmp sgt i32 %1, 100
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 5
  %8 = load i32, i32* %7, align 4, !tbaa !22
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = trunc i64 %19 to i32
  %21 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 5
  %22 = load i32, i32* %21, align 4, !tbaa !22
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 1)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 5
  store i32 %24, i32* %26, align 4, !tbaa !22
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = trunc i64 %29 to i32
  ret i32 %30

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @mark(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %item) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 3
  %1 = load i1, i1* %0, align 1, !tbaa !23
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 3
  store i1 true, i1* %2, align 1, !tbaa !23
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 4
  %8 = load i32, i32* %7, align 4, !tbaa !17
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = trunc i64 %19 to i32
  %21 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = trunc i64 %23 to i32
  ret i32 %24
}

define internal noundef i32 @stamp(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %item) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 3
  %1 = load i1, i1* %0, align 1, !tbaa !23
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 3
  store i1 true, i1* %2, align 1, !tbaa !23
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 4
  %8 = load i32, i32* %7, align 4, !tbaa !17
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = trunc i64 %19 to i32
  %21 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = trunc i64 %23 to i32
  ret i32 %24
}

define internal noundef i32 @primed(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %item) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 3
  %1 = load i1, i1* %0, align 1, !tbaa !23
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 3
  store i1 true, i1* %2, align 1, !tbaa !23
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 4
  %8 = load i32, i32* %7, align 4, !tbaa !17
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %20 = trunc i64 %19 to i32
  %21 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %24 = trunc i64 %23 to i32
  ret i32 %24
}

define internal noundef nonnull align 8 i8* @primeVia(%struct.State* noundef nonnull align 8 dereferenceable(12) nocapture %item) #0 {
entry:
  %0 = call i32 @primed(%struct.State* %item)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  ret i8* %1
}

define void @nish_main() #1 {
entry:
  %s.addr = alloca %struct.State*, align 8
  %State.obj = alloca %struct.State, align 8
  %items.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %cur.addr = alloca %struct.State*, align 8
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %i.addr.1 = alloca i32, align 4
  %marked.addr = alloca i32, align 4
  %item.addr = alloca %struct.State*, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !5
  %1 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 1
  store i1 false, i1* %1, align 1, !tbaa !20
  %2 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 2
  store i1 false, i1* %2, align 1, !tbaa !21
  %3 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 3
  store i1 false, i1* %3, align 1, !tbaa !23
  %4 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 4
  store i32 0, i32* %4, align 4, !tbaa !17
  %5 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 5
  store i32 0, i32* %5, align 4, !tbaa !22
  store %struct.State* %State.obj, %struct.State** %s.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %items.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 1000
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %12 = call i8* @nish_alloc_struct(i64 12)
  %13 = bitcast i8* %12 to %struct.State*
  %14 = getelementptr inbounds %struct.State, %struct.State* %13, i32 0, i32 0
  store i1 false, i1* %14, align 1, !tbaa !5
  %15 = getelementptr inbounds %struct.State, %struct.State* %13, i32 0, i32 1
  store i1 false, i1* %15, align 1, !tbaa !20
  %16 = getelementptr inbounds %struct.State, %struct.State* %13, i32 0, i32 2
  store i1 false, i1* %16, align 1, !tbaa !21
  %17 = getelementptr inbounds %struct.State, %struct.State* %13, i32 0, i32 3
  store i1 false, i1* %17, align 1, !tbaa !23
  %18 = getelementptr inbounds %struct.State, %struct.State* %13, i32 0, i32 4
  store i32 0, i32* %18, align 4, !tbaa !17
  %19 = getelementptr inbounds %struct.State, %struct.State* %13, i32 0, i32 5
  store i32 0, i32* %19, align 4, !tbaa !22
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %27 = bitcast i8* %26 to %struct.State**
  %28 = getelementptr inbounds %struct.State*, %struct.State** %27, i64 %21
  store %struct.State* %13, %struct.State** %28, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = trunc i64 %29 to i32
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %33 = call i8* @nish_alloc_struct(i64 12)
  %34 = bitcast i8* %33 to %struct.State*
  %35 = getelementptr inbounds %struct.State, %struct.State* %34, i32 0, i32 0
  store i1 false, i1* %35, align 1, !tbaa !5
  %36 = getelementptr inbounds %struct.State, %struct.State* %34, i32 0, i32 1
  store i1 false, i1* %36, align 1, !tbaa !20
  %37 = getelementptr inbounds %struct.State, %struct.State* %34, i32 0, i32 2
  store i1 false, i1* %37, align 1, !tbaa !21
  %38 = getelementptr inbounds %struct.State, %struct.State* %34, i32 0, i32 3
  store i1 false, i1* %38, align 1, !tbaa !23
  %39 = getelementptr inbounds %struct.State, %struct.State* %34, i32 0, i32 4
  store i32 0, i32* %39, align 4, !tbaa !17
  %40 = getelementptr inbounds %struct.State, %struct.State* %34, i32 0, i32 5
  store i32 0, i32* %40, align 4, !tbaa !22
  store %struct.State* %34, %struct.State** %cur.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %41, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %42, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %43, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %names.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %44 = load i32, i32* %i.addr.1, align 4
  %45 = icmp slt i32 %44, 1000
  br i1 %45, label %for.body.1, label %for.end.1

for.body.1:
  %46 = load %struct.State*, %struct.State** %s.addr, align 8
  %47 = load i32, i32* %i.addr.1, align 4
  %48 = getelementptr inbounds %struct.State, %struct.State* %46, i32 0, i32 4
  store i32 %47, i32* %48, align 4, !tbaa !17
  %49 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %50 = load %struct.State*, %struct.State** %s.addr, align 8
  %51 = call i32 @guarded(%struct.State* %50)
  %52 = load %struct.State*, %struct.State** %s.addr, align 8
  %53 = call i32 @whenReady(%struct.State* %52)
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %53)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok

ovf.ok:
  %57 = load %struct.State*, %struct.State** %s.addr, align 8
  %58 = call i32 @untilDone(%struct.State* %57)
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %55, i32 %58)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %62 = load %struct.State*, %struct.State** %s.addr, align 8
  %63 = call i32 @capped(%struct.State* %62)
  %64 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 %63)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %67 = load %struct.State*, %struct.State** %cur.addr, align 8
  %68 = call i32 @stamp(%struct.State* %67)
  %69 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %65, i32 %68)
  %70 = extractvalue { i32, i1 } %69, 0
  %71 = extractvalue { i32, i1 } %69, 1
  br i1 %71, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %72 = call i8* @nish_str_from_i32(i32 %70)
  %73 = load %struct.State*, %struct.State** %cur.addr, align 8
  %74 = call i64 @nish_arena_mark()
  %75 = call i8* @primeVia(%struct.State* %73)
  %76 = call i8* @nish_arena_keep(i64 %74, i8* %75)
  %77 = call i8* @nish_str_concat(i8* %72, i8* %76)
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 1
  %81 = load i64, i64* %80, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %82 = icmp eq i64 %79, %81
  br i1 %82, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %49, i64 8)
  br label %push.store.1

push.store.1:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %85 = bitcast i8* %84 to i8**
  %86 = getelementptr inbounds i8*, i8** %85, i64 %79
  store i8* %77, i8** %86, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %87 = add i64 %79, 1
  store i64 %87, i64* %78, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %88 = trunc i64 %87 to i32
  %89 = call i8* @nish_alloc_struct(i64 12)
  %90 = bitcast i8* %89 to %struct.State*
  %91 = getelementptr inbounds %struct.State, %struct.State* %90, i32 0, i32 0
  store i1 false, i1* %91, align 1, !tbaa !5
  %92 = getelementptr inbounds %struct.State, %struct.State* %90, i32 0, i32 1
  store i1 false, i1* %92, align 1, !tbaa !20
  %93 = getelementptr inbounds %struct.State, %struct.State* %90, i32 0, i32 2
  store i1 false, i1* %93, align 1, !tbaa !21
  %94 = getelementptr inbounds %struct.State, %struct.State* %90, i32 0, i32 3
  store i1 false, i1* %94, align 1, !tbaa !23
  %95 = getelementptr inbounds %struct.State, %struct.State* %90, i32 0, i32 4
  store i32 0, i32* %95, align 4, !tbaa !17
  %96 = getelementptr inbounds %struct.State, %struct.State* %90, i32 0, i32 5
  store i32 0, i32* %96, align 4, !tbaa !22
  store %struct.State* %90, %struct.State** %cur.addr, align 8
  br label %for.inc.1

for.inc.1:
  %97 = load i32, i32* %i.addr.1, align 4
  %98 = add nsw i32 %97, 1
  store i32 %98, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %marked.addr, align 4
  %99 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %100 = load i64, i64* %forof.idx, align 8
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %102 = load i64, i64* %101, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %103 = icmp ult i64 %100, %102
  br i1 %103, label %forof.body, label %forof.end

forof.body:
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  %105 = load i8*, i8** %104, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %106 = bitcast i8* %105 to %struct.State**
  %107 = getelementptr inbounds %struct.State*, %struct.State** %106, i64 %100
  %108 = load %struct.State*, %struct.State** %107, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.State* %108, %struct.State** %item.addr, align 8
  %109 = load i32, i32* %marked.addr, align 4
  %110 = load %struct.State*, %struct.State** %item.addr, align 8
  %111 = call i32 @mark(%struct.State* %110)
  %112 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %109, i32 %111)
  %113 = extractvalue { i32, i1 } %112, 0
  %114 = extractvalue { i32, i1 } %112, 1
  br i1 %114, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %113, i32* %marked.addr, align 4
  %115 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %116 = load i32, i32* %marked.addr, align 4
  %117 = call i8* @nish_str_from_i32(i32 %116)
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 1
  %121 = load i64, i64* %120, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %122 = icmp eq i64 %119, %121
  br i1 %122, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %115, i64 8)
  br label %push.store.2

push.store.2:
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 2
  %124 = load i8*, i8** %123, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %125 = bitcast i8* %124 to i8**
  %126 = getelementptr inbounds i8*, i8** %125, i64 %119
  store i8* %117, i8** %126, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %127 = add i64 %119, 1
  store i64 %127, i64* %118, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %128 = trunc i64 %127 to i32
  br label %forof.inc

forof.inc:
  %129 = load i64, i64* %forof.idx, align 8
  %130 = add i64 %129, 1
  store i64 %130, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %131 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 0
  %133 = load i64, i64* %132, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %134 = trunc i64 %133 to i32
  %135 = call i8* @nish_str_from_i32(i32 %134)
  %136 = call i8* @nish_str_concat(i8* %135, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %137 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 0
  %139 = load i64, i64* %138, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %140 = icmp ult i64 0, %139
  br i1 %140, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %139)
  unreachable

bounds.ok:
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %143 = bitcast i8* %142 to i8**
  %144 = getelementptr inbounds i8*, i8** %143, i64 0
  %145 = load i8*, i8** %144, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %146 = call i8* @nish_str_concat(i8* %136, i8* %145)
  %147 = call i8* @nish_str_concat(i8* %146, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %148 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 0
  %150 = load i64, i64* %149, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %151 = icmp ult i64 999, %150
  br i1 %151, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 999, i64 %150)
  unreachable

bounds.ok.1:
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %148, i64 0, i32 2
  %153 = load i8*, i8** %152, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %154 = bitcast i8* %153 to i8**
  %155 = getelementptr inbounds i8*, i8** %154, i64 999
  %156 = load i8*, i8** %155, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %157 = call i8* @nish_str_concat(i8* %147, i8* %156)
  %158 = call i8* @nish_str_concat(i8* %157, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %159 = load i32, i32* %marked.addr, align 4
  %160 = call i8* @nish_str_from_i32(i32 %159)
  %161 = call i8* @nish_str_concat(i8* %158, i8* %160)
  call void @nish_print(i8* %161)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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

!llvm.module.flags = !{!24, !25, !26, !27, !28}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"State", !2, i64 0, !2, i64 1, !2, i64 2, !2, i64 3, !3, i64 4, !3, i64 8}
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
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!4, !3, i64 4}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!4, !2, i64 1}
!21 = !{!4, !2, i64 2}
!22 = !{!4, !3, i64 8}
!23 = !{!4, !2, i64 3}
!24 = !{i32 8, !"cf-protection-branch", i32 1}
!25 = !{i32 8, !"cf-protection-return", i32 1}
!26 = !{i32 8, !"branch-target-enforcement", i32 1}
!27 = !{i32 8, !"sign-return-address", i32 1}
!28 = !{i32 4, !"probe-stack", !"inline-asm"}
