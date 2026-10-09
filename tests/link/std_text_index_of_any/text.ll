%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"indexOfAny: the set must hold 1 to 16 bytes\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [48 x i8] } { i64 47, [48 x i8] c"indexOfAny: every byte of the set must be ASCII\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #5
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #5
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #5
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare i64 @nish_str_index_of_any(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #7
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #5
declare void @nish_exit(i32 noundef) #8
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #9
declare extern_weak void @nish_panic_overflow(i32 noundef) #9
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #10 {
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

define internal noundef zeroext i1 @nish.isTextBlankByte(i32 noundef %code) #0 {
entry:
  %0 = icmp eq i32 %code, 32
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp eq i32 %code, 9
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = icmp eq i32 %code, 10
  br label %lor.end.1

lor.end.1:
  %4 = phi i1 [ true, %lor.end.2 ], [ %3, %lor.rhs.1 ]
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = icmp eq i32 %code, 13
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %lor.end.1 ], [ %5, %lor.rhs ]
  ret i1 %6
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.splitLines(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %length.addr = alloca i32, align 4
  %lines.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %4, %struct.nish_array** %lines.addr, align 8
  store i32 0, i32* %start.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %length.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds i8, i8* %text, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1
  %16 = zext i8 %15 to i32
  %17 = icmp eq i32 %16, 10
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %start.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %start.addr, align 4
  %21 = load i32, i32* %length.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %if.then ], [ %22, %land.rhs ]
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %25 = bitcast i8* %text to i64*
  %26 = load i64, i64* %25, align 8
  %27 = load i32, i32* %start.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = load i32, i32* %i.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = call i64 @llvm.smin.i64(i64 %28, i64 %30)
  %32 = call i64 @llvm.smax.i64(i64 %28, i64 %30)
  %33 = sub i64 %32, %31
  %34 = getelementptr inbounds i8, i8* %text, i64 8
  %35 = getelementptr inbounds i8, i8* %34, i64 %31
  %36 = call i8* @nish_str_new(i8* %35, i64 %33)
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = icmp eq i64 %38, %40
  br i1 %41, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %24, i64 8)
  br label %push.store

push.store:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i8**
  %45 = getelementptr inbounds i8*, i8** %44, i64 %38
  store i8* %36, i8** %45, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %46 = add i64 %38, 1
  store i64 %46, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  br label %if.end.1

if.end.1:
  %48 = load i32, i32* %i.addr, align 4
  %49 = add nsw i32 %48, 1
  store i32 %49, i32* %start.addr, align 4
  br label %if.end

if.end:
  %50 = load i32, i32* %i.addr, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %52 = load i32, i32* %start.addr, align 4
  %53 = load i32, i32* %length.addr, align 4
  %54 = icmp slt i32 %52, %53
  br i1 %54, label %if.then.2, label %if.end.2

if.then.2:
  %55 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %56 = bitcast i8* %text to i64*
  %57 = load i64, i64* %56, align 8
  %58 = load i32, i32* %start.addr, align 4
  %59 = sext i32 %58 to i64
  %60 = call i64 @llvm.smin.i64(i64 %59, i64 %57)
  %61 = call i64 @llvm.smax.i64(i64 %60, i64 0)
  %62 = load i32, i32* %length.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = call i64 @llvm.smin.i64(i64 %61, i64 %63)
  %65 = call i64 @llvm.smax.i64(i64 %61, i64 %63)
  %66 = sub i64 %65, %64
  %67 = getelementptr inbounds i8, i8* %text, i64 8
  %68 = getelementptr inbounds i8, i8* %67, i64 %64
  %69 = call i8* @nish_str_new(i8* %68, i64 %66)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 1
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %74 = icmp eq i64 %71, %73
  br i1 %74, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %55, i64 8)
  br label %push.store.1

push.store.1:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i8**
  %78 = getelementptr inbounds i8*, i8** %77, i64 %71
  store i8* %69, i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = add i64 %71, 1
  store i64 %79, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = trunc i64 %79 to i32
  br label %if.end.2

if.end.2:
  %81 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  ret %struct.nish_array* %81
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.splitWhitespace(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %length.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %4, %struct.nish_array** %parts.addr, align 8
  store i32 -1, i32* %start.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %length.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds i8, i8* %text, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1
  %16 = zext i8 %15 to i32
  %17 = call i1 @nish.isTextBlankByte(i32 %16)
  br i1 %17, label %if.then, label %if.else

if.then:
  %18 = load i32, i32* %start.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %start.addr, align 4
  %21 = load i32, i32* %length.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %if.then ], [ %22, %land.rhs ]
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %25 = bitcast i8* %text to i64*
  %26 = load i64, i64* %25, align 8
  %27 = load i32, i32* %start.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = load i32, i32* %i.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = call i64 @llvm.smin.i64(i64 %28, i64 %30)
  %32 = call i64 @llvm.smax.i64(i64 %28, i64 %30)
  %33 = sub i64 %32, %31
  %34 = getelementptr inbounds i8, i8* %text, i64 8
  %35 = getelementptr inbounds i8, i8* %34, i64 %31
  %36 = call i8* @nish_str_new(i8* %35, i64 %33)
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = icmp eq i64 %38, %40
  br i1 %41, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %24, i64 8)
  br label %push.store

push.store:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i8**
  %45 = getelementptr inbounds i8*, i8** %44, i64 %38
  store i8* %36, i8** %45, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %46 = add i64 %38, 1
  store i64 %46, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  store i32 -1, i32* %start.addr, align 4
  br label %if.end.1

if.end.1:
  br label %if.end

if.else:
  %48 = load i32, i32* %start.addr, align 4
  %49 = icmp slt i32 %48, 0
  br i1 %49, label %if.then.2, label %if.end.2

if.then.2:
  %50 = load i32, i32* %i.addr, align 4
  store i32 %50, i32* %start.addr, align 4
  br label %if.end.2

if.end.2:
  br label %if.end

if.end:
  %51 = load i32, i32* %i.addr, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %53 = load i32, i32* %start.addr, align 4
  %54 = icmp sge i32 %53, 0
  br i1 %54, label %if.then.3, label %if.end.3

if.then.3:
  %55 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %56 = bitcast i8* %text to i64*
  %57 = load i64, i64* %56, align 8
  %58 = load i32, i32* %start.addr, align 4
  %59 = sext i32 %58 to i64
  %60 = call i64 @llvm.smin.i64(i64 %59, i64 %57)
  %61 = call i64 @llvm.smax.i64(i64 %60, i64 0)
  %62 = load i32, i32* %length.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = call i64 @llvm.smin.i64(i64 %61, i64 %63)
  %65 = call i64 @llvm.smax.i64(i64 %61, i64 %63)
  %66 = sub i64 %65, %64
  %67 = getelementptr inbounds i8, i8* %text, i64 8
  %68 = getelementptr inbounds i8, i8* %67, i64 %64
  %69 = call i8* @nish_str_new(i8* %68, i64 %66)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 1
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %74 = icmp eq i64 %71, %73
  br i1 %74, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %55, i64 8)
  br label %push.store.1

push.store.1:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i8**
  %78 = getelementptr inbounds i8*, i8** %77, i64 %71
  store i8* %69, i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = add i64 %71, 1
  store i64 %79, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = trunc i64 %79 to i32
  br label %if.end.3

if.end.3:
  %81 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %81
}

define noundef nonnull align 8 i8* @nish.trimStart(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %length.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %length.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds i8, i8* %text, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = call i1 @nish.isTextBlankByte(i32 %11)
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %16 = bitcast i8* %text to i64*
  %17 = load i64, i64* %16, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = call i64 @llvm.smin.i64(i64 %19, i64 %17)
  %21 = call i64 @llvm.smax.i64(i64 %20, i64 0)
  %22 = load i32, i32* %length.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = call i64 @llvm.smin.i64(i64 %21, i64 %23)
  %25 = call i64 @llvm.smax.i64(i64 %21, i64 %23)
  %26 = sub i64 %25, %24
  %27 = getelementptr inbounds i8, i8* %text, i64 8
  %28 = getelementptr inbounds i8, i8* %27, i64 %24
  %29 = call i8* @nish_str_new(i8* %28, i64 %26)
  ret i8* %29
}

define noundef nonnull align 8 i8* @nish.trimEnd(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %end.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %end.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %end.addr, align 4
  %4 = icmp sgt i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %end.addr, align 4
  %6 = sub nsw i32 %5, 1
  %7 = sext i32 %6 to i64
  %8 = bitcast i8* %text to i64*
  %9 = load i64, i64* %8, align 8
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds i8, i8* %text, i64 8
  %12 = getelementptr inbounds i8, i8* %11, i64 %7
  %13 = load i8, i8* %12, align 1
  %14 = zext i8 %13 to i32
  %15 = call i1 @nish.isTextBlankByte(i32 %14)
  br label %land.end

land.end:
  %16 = phi i1 [ false, %while.cond ], [ %15, %bounds.ok ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %end.addr, align 4
  %18 = sub nsw i32 %17, 1
  store i32 %18, i32* %end.addr, align 4
  br label %while.cond

while.end:
  %19 = bitcast i8* %text to i64*
  %20 = load i64, i64* %19, align 8
  %21 = load i32, i32* %end.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = call i64 @llvm.smin.i64(i64 %22, i64 %20)
  %24 = call i64 @llvm.smax.i64(i64 %23, i64 0)
  %25 = call i64 @llvm.smin.i64(i64 0, i64 %24)
  %26 = call i64 @llvm.smax.i64(i64 0, i64 %24)
  %27 = sub i64 %26, %25
  %28 = getelementptr inbounds i8, i8* %text, i64 8
  %29 = getelementptr inbounds i8, i8* %28, i64 %25
  %30 = call i8* @nish_str_new(i8* %29, i64 %27)
  ret i8* %30
}

define noundef nonnull align 8 i8* @nish.trim(i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.trimStart(i8* %text)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @nish.trimEnd(i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5
}

define noundef zeroext i1 @nish.contains(i8* noundef nonnull noalias readonly align 8 nocapture %haystack, i8* noundef nonnull noalias readonly align 8 nocapture %needle) #2 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %haystack, i8* %needle)
  %1 = trunc i64 %0 to i32
  %2 = icmp sge i32 %1, 0
  ret i1 %2
}

define noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 nocapture %needle, i8* noundef nonnull noalias readonly align 8 nocapture %replacement) #1 {
entry:
  %needleLength.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %rest.addr = alloca i8*, align 8
  %at.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = bitcast i8* %needle to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %needleLength.addr, align 4
  %3 = load i32, i32* %needleLength.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  ret i8* %text

if.end:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i8* %text, i8** %rest.addr, align 8
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %8 = load i8*, i8** %rest.addr, align 8
  %9 = call i64 @nish_str_index_of(i8* %8, i8* %needle)
  %10 = trunc i64 %9 to i32
  store i32 %10, i32* %at.addr, align 4
  %11 = load i32, i32* %at.addr, align 4
  %12 = icmp slt i32 %11, 0
  br i1 %12, label %lor.end, label %lor.rhs

lor.rhs:
  %13 = load i32, i32* %at.addr, align 4
  %14 = load i8*, i8** %rest.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = icmp sgt i32 %13, %17
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %while.body ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %21 = load i8*, i8** %rest.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* %21, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = bitcast i8* %replacement to i64*
  %37 = load i64, i64* %36, align 8
  %38 = sub i64 %35, 1
  %39 = mul i64 %37, %38
  %40 = icmp eq i64 %35, 0
  %41 = select i1 %40, i64 0, i64 %39
  store i64 %41, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %42 = load i64, i64* %join.at, align 8
  %43 = icmp ult i64 %42, %35
  br i1 %43, label %join.sum.body, label %join.copy

join.sum.body:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i8**
  %47 = getelementptr inbounds i8*, i8** %46, i64 %42
  %48 = load i8*, i8** %47, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = load i64, i64* %join.total, align 8
  %50 = bitcast i8* %48 to i64*
  %51 = load i64, i64* %50, align 8
  %52 = add i64 %49, %51
  store i64 %52, i64* %join.total, align 8
  %53 = add i64 %42, 1
  store i64 %53, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %54 = load i64, i64* %join.total, align 8
  %55 = icmp ugt i64 %54, 2147483647
  %56 = add i64 %54, 9
  %57 = select i1 %55, i64 4611686018427387904, i64 %56
  %58 = call i8* @nish_alloc_struct(i64 %57)
  %59 = bitcast i8* %58 to i64*
  store i64 %54, i64* %59, align 8
  %60 = getelementptr inbounds i8, i8* %58, i64 8
  store i8* %60, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %61 = load i64, i64* %join.at, align 8
  %62 = icmp ult i64 %61, %35
  br i1 %62, label %join.part, label %join.end

join.part:
  %63 = load i8*, i8** %join.p, align 8
  %64 = icmp eq i64 %61, 0
  %65 = select i1 %64, i64 0, i64 %37
  %66 = getelementptr inbounds i8, i8* %replacement, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %63, i8* %66, i64 %65, i1 false)
  %67 = getelementptr inbounds i8, i8* %63, i64 %65
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %69 to i8**
  %71 = getelementptr inbounds i8*, i8** %70, i64 %61
  %72 = load i8*, i8** %71, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %73 = bitcast i8* %72 to i64*
  %74 = load i64, i64* %73, align 8
  %75 = getelementptr inbounds i8, i8* %72, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %67, i8* %75, i64 %74, i1 false)
  %76 = getelementptr inbounds i8, i8* %67, i64 %74
  store i8* %76, i8** %join.p, align 8
  %77 = add i64 %61, 1
  store i64 %77, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %78 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %78, align 1
  ret i8* %58

if.end.1:
  %79 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %80 = load i8*, i8** %rest.addr, align 8
  %81 = bitcast i8* %80 to i64*
  %82 = load i64, i64* %81, align 8
  %83 = load i32, i32* %at.addr, align 4
  %84 = sext i32 %83 to i64
  %85 = call i64 @llvm.smin.i64(i64 0, i64 %84)
  %86 = call i64 @llvm.smax.i64(i64 0, i64 %84)
  %87 = sub i64 %86, %85
  %88 = getelementptr inbounds i8, i8* %80, i64 8
  %89 = getelementptr inbounds i8, i8* %88, i64 %85
  %90 = call i8* @nish_str_new(i8* %89, i64 %87)
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 1
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %95 = icmp eq i64 %92, %94
  br i1 %95, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %79, i64 8)
  br label %push.store.1

push.store.1:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %97 to i8**
  %99 = getelementptr inbounds i8*, i8** %98, i64 %92
  store i8* %90, i8** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %100 = add i64 %92, 1
  store i64 %100, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = trunc i64 %100 to i32
  %102 = load i8*, i8** %rest.addr, align 8
  %103 = bitcast i8* %102 to i64*
  %104 = load i64, i64* %103, align 8
  %105 = load i32, i32* %at.addr, align 4
  %106 = load i32, i32* %needleLength.addr, align 4
  %107 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %105, i32 %106)
  %108 = extractvalue { i32, i1 } %107, 0
  %109 = extractvalue { i32, i1 } %107, 1
  br i1 %109, label %ovf.fail, label %ovf.ok

ovf.ok:
  %110 = sext i32 %108 to i64
  %111 = call i64 @llvm.smin.i64(i64 %110, i64 %104)
  %112 = call i64 @llvm.smax.i64(i64 %111, i64 0)
  %113 = load i8*, i8** %rest.addr, align 8
  %114 = bitcast i8* %113 to i64*
  %115 = load i64, i64* %114, align 8
  %116 = trunc i64 %115 to i32
  %117 = sext i32 %116 to i64
  %118 = call i64 @llvm.smin.i64(i64 %117, i64 %104)
  %119 = call i64 @llvm.smax.i64(i64 %118, i64 0)
  %120 = call i64 @llvm.smin.i64(i64 %112, i64 %119)
  %121 = call i64 @llvm.smax.i64(i64 %112, i64 %119)
  %122 = sub i64 %121, %120
  %123 = getelementptr inbounds i8, i8* %102, i64 8
  %124 = getelementptr inbounds i8, i8* %123, i64 %120
  %125 = call i8* @nish_str_new(i8* %124, i64 %122)
  store i8* %125, i8** %rest.addr, align 8
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish.firstDifference(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %left, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %right) #3 {
entry:
  %leftLength.addr = alloca i32, align 4
  %rightLength.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %left, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %leftLength.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %right, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %rightLength.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %left, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %right, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = load i32, i32* %leftLength.addr, align 4
  %12 = icmp slt i32 %10, %11
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %rightLength.addr, align 4
  %15 = icmp slt i32 %13, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %while.cond ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %7 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %18
  %21 = load i8*, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %9 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 %23
  %26 = load i8*, i8** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = call zeroext i1 @nish_str_eq(i8* %21, i8* %26)
  %28 = xor i1 %27, true
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load i32, i32* %i.addr, align 4
  ret i32 %29

if.end:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %leftLength.addr, align 4
  %33 = load i32, i32* %rightLength.addr, align 4
  %34 = icmp eq i32 %32, %33
  br i1 %34, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %35 = load i32, i32* %i.addr, align 4
  br label %cond.end

cond.end:
  %36 = phi i32 [ -1, %cond.true ], [ %35, %cond.false ]
  ret i32 %36
}

define noundef i32 @nish.indexOfAny(i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 %bytes, i32 noundef %from) #1 {
entry:
  %count.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %start.addr = alloca i32, align 4
  %0 = bitcast i8* %bytes to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %count.addr, align 4
  %3 = load i32, i32* %count.addr, align 4
  %4 = icmp slt i32 %3, 1
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = load i32, i32* %count.addr, align 4
  %6 = icmp sgt i32 %5, 16
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [44 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  store i32 0, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %8 = load i32, i32* %j.addr, align 4
  %9 = load i32, i32* %count.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %j.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds i8, i8* %bytes, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1
  %16 = zext i8 %15 to i32
  %17 = icmp sge i32 %16, 128
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [48 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  %18 = load i32, i32* %j.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %20 = bitcast i8* %text to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  store i32 %22, i32* %length.addr, align 4
  store i32 %from, i32* %start.addr, align 4
  %23 = load i32, i32* %start.addr, align 4
  %24 = icmp slt i32 %23, 0
  br i1 %24, label %if.then.2, label %if.end.2

if.then.2:
  store i32 0, i32* %start.addr, align 4
  br label %if.end.2

if.end.2:
  %25 = load i32, i32* %start.addr, align 4
  %26 = load i32, i32* %length.addr, align 4
  %27 = icmp sgt i32 %25, %26
  br i1 %27, label %if.then.3, label %if.end.3

if.then.3:
  %28 = load i32, i32* %length.addr, align 4
  store i32 %28, i32* %start.addr, align 4
  br label %if.end.3

if.end.3:
  %29 = load i32, i32* %start.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = call i64 @nish_str_index_of_any(i8* %text, i8* %bytes, i64 %30)
  %32 = trunc i64 %31 to i32
  ret i32 %32
}

define internal noundef i32 @nish.indexOfAnyFrom(i8* noundef nonnull noalias readonly align 8 nocapture %text, i8* noundef nonnull noalias readonly align 8 nocapture %bytes, i32 noundef %from) #3 {
entry:
  %length.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %code.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = bitcast i8* %bytes to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %count.addr, align 4
  store i32 %from, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %length.addr, align 4
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds i8, i8* %text, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %13
  %16 = load i8, i8* %15, align 1
  %17 = zext i8 %16 to i32
  store i32 %17, i32* %code.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  %18 = load i32, i32* %j.addr, align 4
  %19 = load i32, i32* %count.addr, align 4
  %20 = icmp slt i32 %18, %19
  br i1 %20, label %while.body.1, label %while.end.1

while.body.1:
  %21 = load i32, i32* %j.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds i8, i8* %bytes, i64 8
  %24 = getelementptr inbounds i8, i8* %23, i64 %22
  %25 = load i8, i8* %24, align 1
  %26 = zext i8 %25 to i32
  %27 = load i32, i32* %code.addr, align 4
  %28 = icmp eq i32 %26, %27
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load i32, i32* %i.addr, align 4
  ret i32 %29

if.end:
  %30 = load i32, i32* %j.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret i32 -1
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind willreturn }
attributes #6 = { nounwind willreturn memory(argmem: read) }
attributes #7 = { nounwind willreturn memory(argmem: read, inaccessiblemem: readwrite) }
attributes #8 = { noreturn nounwind }
attributes #9 = { nounwind noreturn cold }
attributes #10 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
