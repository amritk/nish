%struct.State = type { i1, i1, i1, i1, i1, i1, i1, i1, i32, i32 }
%struct.Holder = type { %struct.State*, %struct.State* }
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

define internal noundef i32 @guarded(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
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
  %7 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
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

define internal noundef i32 @whenReady(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
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
  %8 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
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

define internal noundef i32 @untilDone(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 2
  %1 = load i1, i1* %0, align 1, !tbaa !21
  br i1 %1, label %land.rhs, label %land.end

land.rhs:
  %2 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
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
  %11 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
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

define internal noundef i32 @capped(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 9
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
  %7 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 9
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
  %21 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 9
  %22 = load i32, i32* %21, align 4, !tbaa !22
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 1)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 9
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

define internal noundef i32 @mark(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
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
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 8
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

define internal noundef i32 @stamp(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
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
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 8
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

define internal noundef i32 @primed(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
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
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 8
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

define internal noundef nonnull align 8 i8* @primeVia(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
entry:
  %0 = call i32 @primed(%struct.State* %item)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  ret i8* %1
}

define internal noundef i32 @armedWork(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 4
  %1 = load i1, i1* %0, align 1, !tbaa !24
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 4
  store i1 true, i1* %2, align 1, !tbaa !24
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
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

define internal void @invalidate(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 4
  store i1 false, i1* %0, align 1, !tbaa !24
  ret void
}

define internal noundef i32 @loadedWork(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 5
  %1 = load i1, i1* %0, align 1, !tbaa !25
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 5
  store i1 true, i1* %2, align 1, !tbaa !25
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
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

define internal void @unload(%struct.State* noundef nonnull align 8 dereferenceable(16) %s) #0 {
entry:
  %t.addr = alloca %struct.State*, align 8
  store %struct.State* %s, %struct.State** %t.addr, align 8
  %0 = load %struct.State*, %struct.State** %t.addr, align 8
  %1 = getelementptr inbounds %struct.State, %struct.State* %0, i32 0, i32 5
  store i1 false, i1* %1, align 1, !tbaa !25
  ret void
}

define internal noundef i32 @early(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %tmp.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %tmp.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %4 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
  %5 = load i32, i32* %4, align 4, !tbaa !17
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 8)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %14 = bitcast i8* %13 to i8**
  %15 = getelementptr inbounds i8*, i8** %14, i64 %8
  store i8* %6, i8** %15, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %17 = trunc i64 %16 to i32
  %18 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 6
  %19 = load i1, i1* %18, align 1, !tbaa !26
  br i1 %19, label %if.then, label %if.end

if.then:
  %20 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %23 = trunc i64 %22 to i32
  ret i32 %23

if.end:
  %24 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 6
  store i1 true, i1* %24, align 1, !tbaa !26
  %25 = load %struct.nish_array*, %struct.nish_array** %tmp.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %28 = trunc i64 %27 to i32
  ret i32 %28
}

define internal noundef i32 @gated(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 7
  %1 = load i1, i1* %0, align 1, !tbaa !27
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 9
  %3 = load i32, i32* %2, align 4, !tbaa !22
  %4 = icmp slt i32 %3, 0
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 0

if.end.1:
  %5 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 7
  store i1 true, i1* %5, align 1, !tbaa !27
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.State, %struct.State* %s, i32 0, i32 8
  %11 = load i32, i32* %10, align 4, !tbaa !17
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %9, i64 8)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  store i8* %12, i8** %21, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %23 = trunc i64 %22 to i32
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %27 = trunc i64 %26 to i32
  ret i32 %27
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.State*
  %2 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 0
  store i1 false, i1* %2, align 1, !tbaa !5
  %3 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 1
  store i1 false, i1* %3, align 1, !tbaa !20
  %4 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 2
  store i1 false, i1* %4, align 1, !tbaa !21
  %5 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 3
  store i1 false, i1* %5, align 1, !tbaa !23
  %6 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 4
  store i1 false, i1* %6, align 1, !tbaa !24
  %7 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 5
  store i1 false, i1* %7, align 1, !tbaa !25
  %8 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 6
  store i1 false, i1* %8, align 1, !tbaa !26
  %9 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 7
  store i1 false, i1* %9, align 1, !tbaa !27
  %10 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 8
  store i32 0, i32* %10, align 4, !tbaa !17
  %11 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 9
  store i32 0, i32* %11, align 4, !tbaa !22
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.State* %1, %struct.State** %12, align 8, !tbaa !30
  %13 = call i8* @nish_alloc_struct(i64 16)
  %14 = bitcast i8* %13 to %struct.State*
  %15 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 0
  store i1 false, i1* %15, align 1, !tbaa !5
  %16 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 1
  store i1 false, i1* %16, align 1, !tbaa !20
  %17 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 2
  store i1 false, i1* %17, align 1, !tbaa !21
  %18 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 3
  store i1 false, i1* %18, align 1, !tbaa !23
  %19 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 4
  store i1 false, i1* %19, align 1, !tbaa !24
  %20 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 5
  store i1 false, i1* %20, align 1, !tbaa !25
  %21 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 6
  store i1 false, i1* %21, align 1, !tbaa !26
  %22 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 7
  store i1 false, i1* %22, align 1, !tbaa !27
  %23 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 8
  store i32 0, i32* %23, align 4, !tbaa !17
  %24 = getelementptr inbounds %struct.State, %struct.State* %14, i32 0, i32 9
  store i32 0, i32* %24, align 4, !tbaa !22
  %25 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.State* %14, %struct.State** %25, align 8, !tbaa !31
  ret void
}

define internal void @Holder.renew(%struct.Holder* noundef nonnull align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.State*
  %2 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 0
  store i1 false, i1* %2, align 1, !tbaa !5
  %3 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 1
  store i1 false, i1* %3, align 1, !tbaa !20
  %4 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 2
  store i1 false, i1* %4, align 1, !tbaa !21
  %5 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 3
  store i1 false, i1* %5, align 1, !tbaa !23
  %6 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 4
  store i1 false, i1* %6, align 1, !tbaa !24
  %7 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 5
  store i1 false, i1* %7, align 1, !tbaa !25
  %8 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 6
  store i1 false, i1* %8, align 1, !tbaa !26
  %9 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 7
  store i1 false, i1* %9, align 1, !tbaa !27
  %10 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 8
  store i32 0, i32* %10, align 4, !tbaa !17
  %11 = getelementptr inbounds %struct.State, %struct.State* %1, i32 0, i32 9
  store i32 0, i32* %11, align 4, !tbaa !22
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.State* %1, %struct.State** %12, align 8, !tbaa !31
  ret void
}

define internal noundef i32 @prep(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
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
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 8
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

define internal noundef i32 @prepNext(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
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
  %7 = getelementptr inbounds %struct.State, %struct.State* %item, i32 0, i32 8
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
  %t.addr = alloca %struct.State*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %i.addr.2 = alloca i32, align 4
  %i.addr.3 = alloca i32, align 4
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
  store i1 false, i1* %4, align 1, !tbaa !24
  %5 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 5
  store i1 false, i1* %5, align 1, !tbaa !25
  %6 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 6
  store i1 false, i1* %6, align 1, !tbaa !26
  %7 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 7
  store i1 false, i1* %7, align 1, !tbaa !27
  %8 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 8
  store i32 0, i32* %8, align 4, !tbaa !17
  %9 = getelementptr inbounds %struct.State, %struct.State* %State.obj, i32 0, i32 9
  store i32 0, i32* %9, align 4, !tbaa !22
  store %struct.State* %State.obj, %struct.State** %s.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %12, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %items.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = icmp slt i32 %13, 1000
  br i1 %14, label %for.body, label %for.end

for.body:
  %15 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 16)
  %17 = bitcast i8* %16 to %struct.State*
  %18 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 0
  store i1 false, i1* %18, align 1, !tbaa !5
  %19 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 1
  store i1 false, i1* %19, align 1, !tbaa !20
  %20 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 2
  store i1 false, i1* %20, align 1, !tbaa !21
  %21 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 3
  store i1 false, i1* %21, align 1, !tbaa !23
  %22 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 4
  store i1 false, i1* %22, align 1, !tbaa !24
  %23 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 5
  store i1 false, i1* %23, align 1, !tbaa !25
  %24 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 6
  store i1 false, i1* %24, align 1, !tbaa !26
  %25 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 7
  store i1 false, i1* %25, align 1, !tbaa !27
  %26 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 8
  store i32 0, i32* %26, align 4, !tbaa !17
  %27 = getelementptr inbounds %struct.State, %struct.State* %17, i32 0, i32 9
  store i32 0, i32* %27, align 4, !tbaa !22
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %31 = load i64, i64* %30, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %32 = icmp eq i64 %29, %31
  br i1 %32, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %15, i64 8)
  br label %push.store

push.store:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %35 = bitcast i8* %34 to %struct.State**
  %36 = getelementptr inbounds %struct.State*, %struct.State** %35, i64 %29
  store %struct.State* %17, %struct.State** %36, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %37 = add i64 %29, 1
  store i64 %37, i64* %28, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %38 = trunc i64 %37 to i32
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %41 = call i8* @nish_alloc_struct(i64 16)
  %42 = bitcast i8* %41 to %struct.State*
  %43 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 0
  store i1 false, i1* %43, align 1, !tbaa !5
  %44 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 1
  store i1 false, i1* %44, align 1, !tbaa !20
  %45 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 2
  store i1 false, i1* %45, align 1, !tbaa !21
  %46 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 3
  store i1 false, i1* %46, align 1, !tbaa !23
  %47 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 4
  store i1 false, i1* %47, align 1, !tbaa !24
  %48 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 5
  store i1 false, i1* %48, align 1, !tbaa !25
  %49 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 6
  store i1 false, i1* %49, align 1, !tbaa !26
  %50 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 7
  store i1 false, i1* %50, align 1, !tbaa !27
  %51 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 8
  store i32 0, i32* %51, align 4, !tbaa !17
  %52 = getelementptr inbounds %struct.State, %struct.State* %42, i32 0, i32 9
  store i32 0, i32* %52, align 4, !tbaa !22
  store %struct.State* %42, %struct.State** %cur.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %53, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %54, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %55, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %names.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %56 = load i32, i32* %i.addr.1, align 4
  %57 = icmp slt i32 %56, 1000
  br i1 %57, label %for.body.1, label %for.end.1

for.body.1:
  %58 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %59 = load %struct.State*, %struct.State** %s.addr, align 8
  %60 = call i32 @guarded(%struct.State* %59)
  %61 = load %struct.State*, %struct.State** %s.addr, align 8
  %62 = call i32 @whenReady(%struct.State* %61)
  %63 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 %62)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok

ovf.ok:
  %66 = load %struct.State*, %struct.State** %s.addr, align 8
  %67 = call i32 @untilDone(%struct.State* %66)
  %68 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %64, i32 %67)
  %69 = extractvalue { i32, i1 } %68, 0
  %70 = extractvalue { i32, i1 } %68, 1
  br i1 %70, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %71 = load %struct.State*, %struct.State** %s.addr, align 8
  %72 = call i32 @capped(%struct.State* %71)
  %73 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %69, i32 %72)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %76 = load %struct.State*, %struct.State** %cur.addr, align 8
  %77 = call i32 @stamp(%struct.State* %76)
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 %77)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %81 = call i8* @nish_str_from_i32(i32 %79)
  %82 = load %struct.State*, %struct.State** %cur.addr, align 8
  %83 = call i64 @nish_arena_mark()
  %84 = call i8* @primeVia(%struct.State* %82)
  %85 = call i8* @nish_arena_keep(i64 %83, i8* %84)
  %86 = call i8* @nish_str_concat(i8* %81, i8* %85)
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 1
  %90 = load i64, i64* %89, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %91 = icmp eq i64 %88, %90
  br i1 %91, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %58, i64 8)
  br label %push.store.1

push.store.1:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %94 = bitcast i8* %93 to i8**
  %95 = getelementptr inbounds i8*, i8** %94, i64 %88
  store i8* %86, i8** %95, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %96 = add i64 %88, 1
  store i64 %96, i64* %87, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %97 = trunc i64 %96 to i32
  %98 = call i8* @nish_alloc_struct(i64 16)
  %99 = bitcast i8* %98 to %struct.State*
  %100 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 0
  store i1 false, i1* %100, align 1, !tbaa !5
  %101 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 1
  store i1 false, i1* %101, align 1, !tbaa !20
  %102 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 2
  store i1 false, i1* %102, align 1, !tbaa !21
  %103 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 3
  store i1 false, i1* %103, align 1, !tbaa !23
  %104 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 4
  store i1 false, i1* %104, align 1, !tbaa !24
  %105 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 5
  store i1 false, i1* %105, align 1, !tbaa !25
  %106 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 6
  store i1 false, i1* %106, align 1, !tbaa !26
  %107 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 7
  store i1 false, i1* %107, align 1, !tbaa !27
  %108 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 8
  store i32 0, i32* %108, align 4, !tbaa !17
  %109 = getelementptr inbounds %struct.State, %struct.State* %99, i32 0, i32 9
  store i32 0, i32* %109, align 4, !tbaa !22
  store %struct.State* %99, %struct.State** %cur.addr, align 8
  br label %for.inc.1

for.inc.1:
  %110 = load i32, i32* %i.addr.1, align 4
  %111 = add nsw i32 %110, 1
  store i32 %111, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %112 = call i8* @nish_alloc_struct(i64 16)
  %113 = bitcast i8* %112 to %struct.State*
  %114 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 0
  store i1 false, i1* %114, align 1, !tbaa !5
  %115 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 1
  store i1 false, i1* %115, align 1, !tbaa !20
  %116 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 2
  store i1 false, i1* %116, align 1, !tbaa !21
  %117 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 3
  store i1 false, i1* %117, align 1, !tbaa !23
  %118 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 4
  store i1 false, i1* %118, align 1, !tbaa !24
  %119 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 5
  store i1 false, i1* %119, align 1, !tbaa !25
  %120 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 6
  store i1 false, i1* %120, align 1, !tbaa !26
  %121 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 7
  store i1 false, i1* %121, align 1, !tbaa !27
  %122 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 8
  store i32 0, i32* %122, align 4, !tbaa !17
  %123 = getelementptr inbounds %struct.State, %struct.State* %113, i32 0, i32 9
  store i32 0, i32* %123, align 4, !tbaa !22
  store %struct.State* %113, %struct.State** %t.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %124 = load i32, i32* %i.addr.2, align 4
  %125 = icmp slt i32 %124, 1000
  br i1 %125, label %for.body.2, label %for.end.2

for.body.2:
  %126 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %127 = load %struct.State*, %struct.State** %t.addr, align 8
  %128 = call i32 @armedWork(%struct.State* %127)
  %129 = load %struct.State*, %struct.State** %t.addr, align 8
  %130 = call i32 @loadedWork(%struct.State* %129)
  %131 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %128, i32 %130)
  %132 = extractvalue { i32, i1 } %131, 0
  %133 = extractvalue { i32, i1 } %131, 1
  br i1 %133, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %134 = load %struct.State*, %struct.State** %t.addr, align 8
  %135 = call i32 @early(%struct.State* %134)
  %136 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %132, i32 %135)
  %137 = extractvalue { i32, i1 } %136, 0
  %138 = extractvalue { i32, i1 } %136, 1
  br i1 %138, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %139 = load %struct.State*, %struct.State** %t.addr, align 8
  %140 = call i32 @gated(%struct.State* %139)
  %141 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %137, i32 %140)
  %142 = extractvalue { i32, i1 } %141, 0
  %143 = extractvalue { i32, i1 } %141, 1
  br i1 %143, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %144 = call i8* @nish_str_from_i32(i32 %142)
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 0
  %146 = load i64, i64* %145, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 1
  %148 = load i64, i64* %147, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %149 = icmp eq i64 %146, %148
  br i1 %149, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %126, i64 8)
  br label %push.store.2

push.store.2:
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %152 = bitcast i8* %151 to i8**
  %153 = getelementptr inbounds i8*, i8** %152, i64 %146
  store i8* %144, i8** %153, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %154 = add i64 %146, 1
  store i64 %154, i64* %145, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %155 = trunc i64 %154 to i32
  %156 = load %struct.State*, %struct.State** %t.addr, align 8
  call void @invalidate(%struct.State* %156)
  %157 = load %struct.State*, %struct.State** %t.addr, align 8
  call void @unload(%struct.State* %157)
  br label %for.inc.2

for.inc.2:
  %158 = load i32, i32* %i.addr.2, align 4
  %159 = add nsw i32 %158, 1
  store i32 %159, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %i.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %160 = load i32, i32* %i.addr.3, align 4
  %161 = icmp slt i32 %160, 1000
  br i1 %161, label %for.body.3, label %for.end.3

for.body.3:
  %162 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %163 = call i8* @nish_alloc_struct(i64 16)
  %164 = bitcast i8* %163 to %struct.State*
  %165 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 0
  store i1 false, i1* %165, align 1, !tbaa !5
  %166 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 1
  store i1 false, i1* %166, align 1, !tbaa !20
  %167 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 2
  store i1 false, i1* %167, align 1, !tbaa !21
  %168 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 3
  store i1 false, i1* %168, align 1, !tbaa !23
  %169 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 4
  store i1 false, i1* %169, align 1, !tbaa !24
  %170 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 5
  store i1 false, i1* %170, align 1, !tbaa !25
  %171 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 6
  store i1 false, i1* %171, align 1, !tbaa !26
  %172 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 7
  store i1 false, i1* %172, align 1, !tbaa !27
  %173 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 8
  store i32 0, i32* %173, align 4, !tbaa !17
  %174 = getelementptr inbounds %struct.State, %struct.State* %164, i32 0, i32 9
  store i32 0, i32* %174, align 4, !tbaa !22
  %175 = getelementptr inbounds %struct.Holder, %struct.Holder* %162, i32 0, i32 0
  store %struct.State* %164, %struct.State** %175, align 8, !tbaa !30
  %176 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %177 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %178 = getelementptr inbounds %struct.Holder, %struct.Holder* %177, i32 0, i32 0
  %179 = load %struct.State*, %struct.State** %178, align 8, !tbaa !30
  %180 = call i32 @prep(%struct.State* %179)
  %181 = call i8* @nish_str_from_i32(i32 %180)
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 0
  %183 = load i64, i64* %182, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 1
  %185 = load i64, i64* %184, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %186 = icmp eq i64 %183, %185
  br i1 %186, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %176, i64 8)
  br label %push.store.3

push.store.3:
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 2
  %188 = load i8*, i8** %187, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %189 = bitcast i8* %188 to i8**
  %190 = getelementptr inbounds i8*, i8** %189, i64 %183
  store i8* %181, i8** %190, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %191 = add i64 %183, 1
  store i64 %191, i64* %182, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %192 = trunc i64 %191 to i32
  %193 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  call void @Holder.renew(%struct.Holder* %193)
  %194 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %195 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %196 = getelementptr inbounds %struct.Holder, %struct.Holder* %195, i32 0, i32 1
  %197 = load %struct.State*, %struct.State** %196, align 8, !tbaa !31
  %198 = call i32 @prepNext(%struct.State* %197)
  %199 = call i8* @nish_str_from_i32(i32 %198)
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 0
  %201 = load i64, i64* %200, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 1
  %203 = load i64, i64* %202, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %204 = icmp eq i64 %201, %203
  br i1 %204, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %194, i64 8)
  br label %push.store.4

push.store.4:
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %194, i64 0, i32 2
  %206 = load i8*, i8** %205, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %207 = bitcast i8* %206 to i8**
  %208 = getelementptr inbounds i8*, i8** %207, i64 %201
  store i8* %199, i8** %208, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %209 = add i64 %201, 1
  store i64 %209, i64* %200, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %210 = trunc i64 %209 to i32
  br label %for.inc.3

for.inc.3:
  %211 = load i32, i32* %i.addr.3, align 4
  %212 = add nsw i32 %211, 1
  store i32 %212, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  store i32 0, i32* %marked.addr, align 4
  %213 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %214 = load i64, i64* %forof.idx, align 8
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %213, i64 0, i32 0
  %216 = load i64, i64* %215, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %217 = icmp ult i64 %214, %216
  br i1 %217, label %forof.body, label %forof.end

forof.body:
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %213, i64 0, i32 2
  %219 = load i8*, i8** %218, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %220 = bitcast i8* %219 to %struct.State**
  %221 = getelementptr inbounds %struct.State*, %struct.State** %220, i64 %214
  %222 = load %struct.State*, %struct.State** %221, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.State* %222, %struct.State** %item.addr, align 8
  %223 = load i32, i32* %marked.addr, align 4
  %224 = load %struct.State*, %struct.State** %item.addr, align 8
  %225 = call i32 @mark(%struct.State* %224)
  %226 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %223, i32 %225)
  %227 = extractvalue { i32, i1 } %226, 0
  %228 = extractvalue { i32, i1 } %226, 1
  br i1 %228, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %227, i32* %marked.addr, align 4
  %229 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %230 = load i32, i32* %marked.addr, align 4
  %231 = call i8* @nish_str_from_i32(i32 %230)
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %229, i64 0, i32 0
  %233 = load i64, i64* %232, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %234 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %229, i64 0, i32 1
  %235 = load i64, i64* %234, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %236 = icmp eq i64 %233, %235
  br i1 %236, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %229, i64 8)
  br label %push.store.5

push.store.5:
  %237 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %229, i64 0, i32 2
  %238 = load i8*, i8** %237, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %239 = bitcast i8* %238 to i8**
  %240 = getelementptr inbounds i8*, i8** %239, i64 %233
  store i8* %231, i8** %240, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %241 = add i64 %233, 1
  store i64 %241, i64* %232, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %242 = trunc i64 %241 to i32
  br label %forof.inc

forof.inc:
  %243 = load i64, i64* %forof.idx, align 8
  %244 = add i64 %243, 1
  store i64 %244, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %245 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %246 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %245, i64 0, i32 0
  %247 = load i64, i64* %246, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %248 = trunc i64 %247 to i32
  %249 = call i8* @nish_str_from_i32(i32 %248)
  %250 = call i8* @nish_str_concat(i8* %249, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %251 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %252 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %251, i64 0, i32 0
  %253 = load i64, i64* %252, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %254 = icmp ult i64 0, %253
  br i1 %254, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %253)
  unreachable

bounds.ok:
  %255 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %251, i64 0, i32 2
  %256 = load i8*, i8** %255, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %257 = bitcast i8* %256 to i8**
  %258 = getelementptr inbounds i8*, i8** %257, i64 0
  %259 = load i8*, i8** %258, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %260 = call i8* @nish_str_concat(i8* %250, i8* %259)
  %261 = call i8* @nish_str_concat(i8* %260, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %262 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %263 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %262, i64 0, i32 0
  %264 = load i64, i64* %263, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %265 = icmp ult i64 999, %264
  br i1 %265, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 999, i64 %264)
  unreachable

bounds.ok.1:
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %262, i64 0, i32 2
  %267 = load i8*, i8** %266, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %268 = bitcast i8* %267 to i8**
  %269 = getelementptr inbounds i8*, i8** %268, i64 999
  %270 = load i8*, i8** %269, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %271 = call i8* @nish_str_concat(i8* %261, i8* %270)
  %272 = call i8* @nish_str_concat(i8* %271, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %273 = load i32, i32* %marked.addr, align 4
  %274 = call i8* @nish_str_from_i32(i32 %273)
  %275 = call i8* @nish_str_concat(i8* %272, i8* %274)
  call void @nish_print(i8* %275)
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

!llvm.module.flags = !{!32, !33, !34, !35, !36}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i1", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"State", !2, i64 0, !2, i64 1, !2, i64 2, !2, i64 3, !2, i64 4, !2, i64 5, !2, i64 6, !2, i64 7, !3, i64 8, !3, i64 12}
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
!17 = !{!4, !3, i64 8}
!18 = !{!"element ptr", !1, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{!4, !2, i64 1}
!21 = !{!4, !2, i64 2}
!22 = !{!4, !3, i64 12}
!23 = !{!4, !2, i64 3}
!24 = !{!4, !2, i64 4}
!25 = !{!4, !2, i64 5}
!26 = !{!4, !2, i64 6}
!27 = !{!4, !2, i64 7}
!28 = !{!"ptr", !1, i64 0}
!29 = !{!"Holder", !28, i64 0, !28, i64 8}
!30 = !{!29, !28, i64 0}
!31 = !{!29, !28, i64 8}
!32 = !{i32 8, !"cf-protection-branch", i32 1}
!33 = !{i32 8, !"cf-protection-return", i32 1}
!34 = !{i32 8, !"branch-target-enforcement", i32 1}
!35 = !{i32 8, !"sign-return-address", i32 1}
!36 = !{i32 4, !"probe-stack", !"inline-asm"}
