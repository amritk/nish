%struct.State = type { i1, i1, i1, i1, i1, i1, i1, i1, i32, i32 }
%struct.Holder = type { %struct.State*, %struct.State* }
%struct.Once = type { i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
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

define internal void @renewG(%struct.Holder* noundef nonnull align 8 dereferenceable(16) nocapture %g) #0 {
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
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %g, i32 0, i32 0
  store %struct.State* %1, %struct.State** %12, align 8, !tbaa !30
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

define internal noundef i32 @prepG(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
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

define internal noundef i32 @prepAlias(%struct.State* noundef nonnull align 8 dereferenceable(16) nocapture %item) #0 {
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

define internal noundef i32 @warmOnce(%struct.Once* noundef nonnull align 8 dereferenceable(1) nocapture %o) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.Once, %struct.Once* %o, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !33
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.Once, %struct.Once* %o, i32 0, i32 0
  store i1 true, i1* %2, align 1, !tbaa !33
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.Once, %struct.Once* %o, i32 0, i32 0
  %8 = load i1, i1* %7, align 1, !tbaa !33
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
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
  %g.addr = alloca %struct.Holder*, align 8
  %Holder.obj.1 = alloca %struct.Holder, align 8
  %i.addr.4 = alloca i32, align 4
  %hh.addr = alloca %struct.Holder*, align 8
  %Holder.obj.2 = alloca %struct.Holder, align 8
  %alias.addr = alloca %struct.Holder*, align 8
  %i.addr.5 = alloca i32, align 4
  %once.addr = alloca %struct.Once*, align 8
  %Once.obj = alloca %struct.Once, align 8
  %i.addr.6 = alloca i32, align 4
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
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 1
  %85 = load i64, i64* %84, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %86 = icmp eq i64 %83, %85
  br i1 %86, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %58, i64 8)
  br label %push.store.1

push.store.1:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %89 = bitcast i8* %88 to i8**
  %90 = getelementptr inbounds i8*, i8** %89, i64 %83
  store i8* %81, i8** %90, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %91 = add i64 %83, 1
  store i64 %91, i64* %82, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %92 = trunc i64 %91 to i32
  %93 = call i8* @nish_alloc_struct(i64 16)
  %94 = bitcast i8* %93 to %struct.State*
  %95 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 0
  store i1 false, i1* %95, align 1, !tbaa !5
  %96 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 1
  store i1 false, i1* %96, align 1, !tbaa !20
  %97 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 2
  store i1 false, i1* %97, align 1, !tbaa !21
  %98 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 3
  store i1 false, i1* %98, align 1, !tbaa !23
  %99 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 4
  store i1 false, i1* %99, align 1, !tbaa !24
  %100 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 5
  store i1 false, i1* %100, align 1, !tbaa !25
  %101 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 6
  store i1 false, i1* %101, align 1, !tbaa !26
  %102 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 7
  store i1 false, i1* %102, align 1, !tbaa !27
  %103 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 8
  store i32 0, i32* %103, align 4, !tbaa !17
  %104 = getelementptr inbounds %struct.State, %struct.State* %94, i32 0, i32 9
  store i32 0, i32* %104, align 4, !tbaa !22
  store %struct.State* %94, %struct.State** %cur.addr, align 8
  br label %for.inc.1

for.inc.1:
  %105 = load i32, i32* %i.addr.1, align 4
  %106 = add nsw i32 %105, 1
  store i32 %106, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %107 = call i8* @nish_alloc_struct(i64 16)
  %108 = bitcast i8* %107 to %struct.State*
  %109 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 0
  store i1 false, i1* %109, align 1, !tbaa !5
  %110 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 1
  store i1 false, i1* %110, align 1, !tbaa !20
  %111 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 2
  store i1 false, i1* %111, align 1, !tbaa !21
  %112 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 3
  store i1 false, i1* %112, align 1, !tbaa !23
  %113 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 4
  store i1 false, i1* %113, align 1, !tbaa !24
  %114 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 5
  store i1 false, i1* %114, align 1, !tbaa !25
  %115 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 6
  store i1 false, i1* %115, align 1, !tbaa !26
  %116 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 7
  store i1 false, i1* %116, align 1, !tbaa !27
  %117 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 8
  store i32 0, i32* %117, align 4, !tbaa !17
  %118 = getelementptr inbounds %struct.State, %struct.State* %108, i32 0, i32 9
  store i32 0, i32* %118, align 4, !tbaa !22
  store %struct.State* %108, %struct.State** %t.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %119 = load i32, i32* %i.addr.2, align 4
  %120 = icmp slt i32 %119, 1000
  br i1 %120, label %for.body.2, label %for.end.2

for.body.2:
  %121 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %122 = load %struct.State*, %struct.State** %t.addr, align 8
  %123 = call i32 @armedWork(%struct.State* %122)
  %124 = load %struct.State*, %struct.State** %t.addr, align 8
  %125 = call i32 @loadedWork(%struct.State* %124)
  %126 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %123, i32 %125)
  %127 = extractvalue { i32, i1 } %126, 0
  %128 = extractvalue { i32, i1 } %126, 1
  br i1 %128, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %129 = load %struct.State*, %struct.State** %t.addr, align 8
  %130 = call i32 @early(%struct.State* %129)
  %131 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %127, i32 %130)
  %132 = extractvalue { i32, i1 } %131, 0
  %133 = extractvalue { i32, i1 } %131, 1
  br i1 %133, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %134 = load %struct.State*, %struct.State** %t.addr, align 8
  %135 = call i32 @gated(%struct.State* %134)
  %136 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %132, i32 %135)
  %137 = extractvalue { i32, i1 } %136, 0
  %138 = extractvalue { i32, i1 } %136, 1
  br i1 %138, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %139 = call i8* @nish_str_from_i32(i32 %137)
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 1
  %143 = load i64, i64* %142, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %144 = icmp eq i64 %141, %143
  br i1 %144, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %121, i64 8)
  br label %push.store.2

push.store.2:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %147 = bitcast i8* %146 to i8**
  %148 = getelementptr inbounds i8*, i8** %147, i64 %141
  store i8* %139, i8** %148, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %149 = add i64 %141, 1
  store i64 %149, i64* %140, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %150 = trunc i64 %149 to i32
  %151 = load %struct.State*, %struct.State** %t.addr, align 8
  call void @invalidate(%struct.State* %151)
  %152 = load %struct.State*, %struct.State** %t.addr, align 8
  call void @unload(%struct.State* %152)
  br label %for.inc.2

for.inc.2:
  %153 = load i32, i32* %i.addr.2, align 4
  %154 = add nsw i32 %153, 1
  store i32 %154, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %i.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %155 = load i32, i32* %i.addr.3, align 4
  %156 = icmp slt i32 %155, 1000
  br i1 %156, label %for.body.3, label %for.end.3

for.body.3:
  %157 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %158 = call i8* @nish_alloc_struct(i64 16)
  %159 = bitcast i8* %158 to %struct.State*
  %160 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 0
  store i1 false, i1* %160, align 1, !tbaa !5
  %161 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 1
  store i1 false, i1* %161, align 1, !tbaa !20
  %162 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 2
  store i1 false, i1* %162, align 1, !tbaa !21
  %163 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 3
  store i1 false, i1* %163, align 1, !tbaa !23
  %164 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 4
  store i1 false, i1* %164, align 1, !tbaa !24
  %165 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 5
  store i1 false, i1* %165, align 1, !tbaa !25
  %166 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 6
  store i1 false, i1* %166, align 1, !tbaa !26
  %167 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 7
  store i1 false, i1* %167, align 1, !tbaa !27
  %168 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 8
  store i32 0, i32* %168, align 4, !tbaa !17
  %169 = getelementptr inbounds %struct.State, %struct.State* %159, i32 0, i32 9
  store i32 0, i32* %169, align 4, !tbaa !22
  %170 = getelementptr inbounds %struct.Holder, %struct.Holder* %157, i32 0, i32 0
  store %struct.State* %159, %struct.State** %170, align 8, !tbaa !30
  %171 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %172 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %173 = getelementptr inbounds %struct.Holder, %struct.Holder* %172, i32 0, i32 0
  %174 = load %struct.State*, %struct.State** %173, align 8, !tbaa !30
  %175 = call i32 @prep(%struct.State* %174)
  %176 = call i8* @nish_str_from_i32(i32 %175)
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 0
  %178 = load i64, i64* %177, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 1
  %180 = load i64, i64* %179, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %181 = icmp eq i64 %178, %180
  br i1 %181, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %171, i64 8)
  br label %push.store.3

push.store.3:
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %171, i64 0, i32 2
  %183 = load i8*, i8** %182, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %184 = bitcast i8* %183 to i8**
  %185 = getelementptr inbounds i8*, i8** %184, i64 %178
  store i8* %176, i8** %185, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %186 = add i64 %178, 1
  store i64 %186, i64* %177, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %187 = trunc i64 %186 to i32
  %188 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  call void @Holder.renew(%struct.Holder* %188)
  %189 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %190 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %191 = getelementptr inbounds %struct.Holder, %struct.Holder* %190, i32 0, i32 1
  %192 = load %struct.State*, %struct.State** %191, align 8, !tbaa !31
  %193 = call i32 @prepNext(%struct.State* %192)
  %194 = call i8* @nish_str_from_i32(i32 %193)
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %189, i64 0, i32 0
  %196 = load i64, i64* %195, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %189, i64 0, i32 1
  %198 = load i64, i64* %197, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %199 = icmp eq i64 %196, %198
  br i1 %199, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %189, i64 8)
  br label %push.store.4

push.store.4:
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %189, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %202 = bitcast i8* %201 to i8**
  %203 = getelementptr inbounds i8*, i8** %202, i64 %196
  store i8* %194, i8** %203, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %204 = add i64 %196, 1
  store i64 %204, i64* %195, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %205 = trunc i64 %204 to i32
  br label %for.inc.3

for.inc.3:
  %206 = load i32, i32* %i.addr.3, align 4
  %207 = add nsw i32 %206, 1
  store i32 %207, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1)
  store %struct.Holder* %Holder.obj.1, %struct.Holder** %g.addr, align 8
  store i32 0, i32* %i.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %208 = load i32, i32* %i.addr.4, align 4
  %209 = icmp slt i32 %208, 1000
  br i1 %209, label %for.body.4, label %for.end.4

for.body.4:
  %210 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  call void @renewG(%struct.Holder* %210)
  %211 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %212 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %213 = getelementptr inbounds %struct.Holder, %struct.Holder* %212, i32 0, i32 0
  %214 = load %struct.State*, %struct.State** %213, align 8, !tbaa !30
  %215 = call i32 @prepG(%struct.State* %214)
  %216 = call i8* @nish_str_from_i32(i32 %215)
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 1
  %220 = load i64, i64* %219, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %221 = icmp eq i64 %218, %220
  br i1 %221, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %211, i64 8)
  br label %push.store.5

push.store.5:
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 2
  %223 = load i8*, i8** %222, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %224 = bitcast i8* %223 to i8**
  %225 = getelementptr inbounds i8*, i8** %224, i64 %218
  store i8* %216, i8** %225, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %226 = add i64 %218, 1
  store i64 %226, i64* %217, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %227 = trunc i64 %226 to i32
  br label %for.inc.4

for.inc.4:
  %228 = load i32, i32* %i.addr.4, align 4
  %229 = add nsw i32 %228, 1
  store i32 %229, i32* %i.addr.4, align 4
  br label %for.cond.4

for.end.4:
  call void @Holder.constructor(%struct.Holder* %Holder.obj.2)
  store %struct.Holder* %Holder.obj.2, %struct.Holder** %hh.addr, align 8
  %230 = load %struct.Holder*, %struct.Holder** %hh.addr, align 8
  store %struct.Holder* %230, %struct.Holder** %alias.addr, align 8
  store i32 0, i32* %i.addr.5, align 4
  br label %for.cond.5

for.cond.5:
  %231 = load i32, i32* %i.addr.5, align 4
  %232 = icmp slt i32 %231, 1000
  br i1 %232, label %for.body.5, label %for.end.5

for.body.5:
  %233 = load %struct.Holder*, %struct.Holder** %alias.addr, align 8
  %234 = call i8* @nish_alloc_struct(i64 16)
  %235 = bitcast i8* %234 to %struct.State*
  %236 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 0
  store i1 false, i1* %236, align 1, !tbaa !5
  %237 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 1
  store i1 false, i1* %237, align 1, !tbaa !20
  %238 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 2
  store i1 false, i1* %238, align 1, !tbaa !21
  %239 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 3
  store i1 false, i1* %239, align 1, !tbaa !23
  %240 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 4
  store i1 false, i1* %240, align 1, !tbaa !24
  %241 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 5
  store i1 false, i1* %241, align 1, !tbaa !25
  %242 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 6
  store i1 false, i1* %242, align 1, !tbaa !26
  %243 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 7
  store i1 false, i1* %243, align 1, !tbaa !27
  %244 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 8
  store i32 0, i32* %244, align 4, !tbaa !17
  %245 = getelementptr inbounds %struct.State, %struct.State* %235, i32 0, i32 9
  store i32 0, i32* %245, align 4, !tbaa !22
  %246 = getelementptr inbounds %struct.Holder, %struct.Holder* %233, i32 0, i32 0
  store %struct.State* %235, %struct.State** %246, align 8, !tbaa !30
  %247 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %248 = load %struct.Holder*, %struct.Holder** %hh.addr, align 8
  %249 = getelementptr inbounds %struct.Holder, %struct.Holder* %248, i32 0, i32 0
  %250 = load %struct.State*, %struct.State** %249, align 8, !tbaa !30
  %251 = call i32 @prepAlias(%struct.State* %250)
  %252 = call i8* @nish_str_from_i32(i32 %251)
  %253 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 0
  %254 = load i64, i64* %253, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %255 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 1
  %256 = load i64, i64* %255, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %257 = icmp eq i64 %254, %256
  br i1 %257, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %247, i64 8)
  br label %push.store.6

push.store.6:
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 2
  %259 = load i8*, i8** %258, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %260 = bitcast i8* %259 to i8**
  %261 = getelementptr inbounds i8*, i8** %260, i64 %254
  store i8* %252, i8** %261, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %262 = add i64 %254, 1
  store i64 %262, i64* %253, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %263 = trunc i64 %262 to i32
  br label %for.inc.5

for.inc.5:
  %264 = load i32, i32* %i.addr.5, align 4
  %265 = add nsw i32 %264, 1
  store i32 %265, i32* %i.addr.5, align 4
  br label %for.cond.5

for.end.5:
  %266 = getelementptr inbounds %struct.Once, %struct.Once* %Once.obj, i32 0, i32 0
  store i1 false, i1* %266, align 1, !tbaa !33
  store %struct.Once* %Once.obj, %struct.Once** %once.addr, align 8
  store i32 0, i32* %i.addr.6, align 4
  br label %for.cond.6

for.cond.6:
  %267 = load i32, i32* %i.addr.6, align 4
  %268 = icmp slt i32 %267, 1000
  br i1 %268, label %for.body.6, label %for.end.6

for.body.6:
  %269 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %270 = load %struct.Once*, %struct.Once** %once.addr, align 8
  %271 = call i32 @warmOnce(%struct.Once* %270)
  %272 = call i8* @nish_str_from_i32(i32 %271)
  %273 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %269, i64 0, i32 0
  %274 = load i64, i64* %273, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %275 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %269, i64 0, i32 1
  %276 = load i64, i64* %275, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %277 = icmp eq i64 %274, %276
  br i1 %277, label %push.grow.7, label %push.store.7

push.grow.7:
  call void @nish_array_grow(%struct.nish_array* %269, i64 8)
  br label %push.store.7

push.store.7:
  %278 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %269, i64 0, i32 2
  %279 = load i8*, i8** %278, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %280 = bitcast i8* %279 to i8**
  %281 = getelementptr inbounds i8*, i8** %280, i64 %274
  store i8* %272, i8** %281, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %282 = add i64 %274, 1
  store i64 %282, i64* %273, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %283 = trunc i64 %282 to i32
  br label %for.inc.6

for.inc.6:
  %284 = load i32, i32* %i.addr.6, align 4
  %285 = add nsw i32 %284, 1
  store i32 %285, i32* %i.addr.6, align 4
  br label %for.cond.6

for.end.6:
  store i32 0, i32* %marked.addr, align 4
  %286 = load %struct.nish_array*, %struct.nish_array** %items.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %287 = load i64, i64* %forof.idx, align 8
  %288 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %286, i64 0, i32 0
  %289 = load i64, i64* %288, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %290 = icmp ult i64 %287, %289
  br i1 %290, label %forof.body, label %forof.end

forof.body:
  %291 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %286, i64 0, i32 2
  %292 = load i8*, i8** %291, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %293 = bitcast i8* %292 to %struct.State**
  %294 = getelementptr inbounds %struct.State*, %struct.State** %293, i64 %287
  %295 = load %struct.State*, %struct.State** %294, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  store %struct.State* %295, %struct.State** %item.addr, align 8
  %296 = load i32, i32* %marked.addr, align 4
  %297 = load %struct.State*, %struct.State** %item.addr, align 8
  %298 = call i32 @mark(%struct.State* %297)
  %299 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %296, i32 %298)
  %300 = extractvalue { i32, i1 } %299, 0
  %301 = extractvalue { i32, i1 } %299, 1
  br i1 %301, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %300, i32* %marked.addr, align 4
  %302 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %303 = load i32, i32* %marked.addr, align 4
  %304 = call i8* @nish_str_from_i32(i32 %303)
  %305 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 0
  %306 = load i64, i64* %305, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %307 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 1
  %308 = load i64, i64* %307, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %309 = icmp eq i64 %306, %308
  br i1 %309, label %push.grow.8, label %push.store.8

push.grow.8:
  call void @nish_array_grow(%struct.nish_array* %302, i64 8)
  br label %push.store.8

push.store.8:
  %310 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 2
  %311 = load i8*, i8** %310, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %312 = bitcast i8* %311 to i8**
  %313 = getelementptr inbounds i8*, i8** %312, i64 %306
  store i8* %304, i8** %313, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %314 = add i64 %306, 1
  store i64 %314, i64* %305, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %315 = trunc i64 %314 to i32
  br label %forof.inc

forof.inc:
  %316 = load i64, i64* %forof.idx, align 8
  %317 = add i64 %316, 1
  store i64 %317, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %318 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %319 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %318, i64 0, i32 0
  %320 = load i64, i64* %319, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %321 = trunc i64 %320 to i32
  %322 = call i8* @nish_str_from_i32(i32 %321)
  %323 = call i8* @nish_str_concat(i8* %322, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %324 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %325 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %324, i64 0, i32 0
  %326 = load i64, i64* %325, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %327 = icmp ult i64 0, %326
  br i1 %327, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %326)
  unreachable

bounds.ok:
  %328 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %324, i64 0, i32 2
  %329 = load i8*, i8** %328, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %330 = bitcast i8* %329 to i8**
  %331 = getelementptr inbounds i8*, i8** %330, i64 0
  %332 = load i8*, i8** %331, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %333 = call i8* @nish_str_concat(i8* %323, i8* %332)
  %334 = call i8* @nish_str_concat(i8* %333, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %335 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %336 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %335, i64 0, i32 0
  %337 = load i64, i64* %336, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %338 = icmp ult i64 999, %337
  br i1 %338, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 999, i64 %337)
  unreachable

bounds.ok.1:
  %339 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %335, i64 0, i32 2
  %340 = load i8*, i8** %339, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %341 = bitcast i8* %340 to i8**
  %342 = getelementptr inbounds i8*, i8** %341, i64 999
  %343 = load i8*, i8** %342, align 8, !alias.scope !10, !noalias !9, !tbaa !19
  %344 = call i8* @nish_str_concat(i8* %334, i8* %343)
  %345 = call i8* @nish_str_concat(i8* %344, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %346 = load i32, i32* %marked.addr, align 4
  %347 = call i8* @nish_str_from_i32(i32 %346)
  %348 = call i8* @nish_str_concat(i8* %345, i8* %347)
  call void @nish_print(i8* %348)
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

!llvm.module.flags = !{!34, !35, !36, !37, !38}
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
!32 = !{!"Once", !2, i64 0}
!33 = !{!32, !2, i64 0}
!34 = !{i32 8, !"cf-protection-branch", i32 1}
!35 = !{i32 8, !"cf-protection-return", i32 1}
!36 = !{i32 8, !"branch-target-enforcement", i32 1}
!37 = !{i32 8, !"sign-return-address", i32 1}
!38 = !{i32 4, !"probe-stack", !"inline-asm"}
