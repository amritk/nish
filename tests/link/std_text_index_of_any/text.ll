%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"split: an empty separator\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [31 x i8] } { i64 30, [31 x i8] c"splitLimit: an empty separator\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"toFixed: digits must be 0 to 100\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"indexOfAny: the set must hold 1 to 16 bytes\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [48 x i8] } { i64 47, [48 x i8] c"indexOfAny: every byte of the set must be ASCII\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\C3\A9\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [39 x i8] } { i64 38, [39 x i8] c": every byte of the fill must be ASCII\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"padStart\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"padEnd\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #5
declare void @nish_arena_release(i64 noundef) #5
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #5
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #5
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare i64 @nish_str_index_of_any(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #7
declare i64 @nish_str_index_of_from(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #6
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #5
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #8
declare void @nish_panic_index(i64 noundef, i64 noundef) #8
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #8
declare extern_weak void @nish_panic_overflow(i32 noundef) #8
declare i32 @llvm.fptosi.sat.i32.f64(double) #0
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #9 {
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

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.split(i8* noundef nonnull noalias readonly align 8 nocapture %text, i8* noundef nonnull noalias readonly align 8 nocapture %sep) #1 {
entry:
  %sepLength.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %sep to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %sepLength.addr, align 4
  %3 = load i32, i32* %sepLength.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

if.end:
  %5 = bitcast i8* %text to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %length.addr, align 4
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* null, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %9, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %start.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %start.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %text to i64*
  %16 = load i64, i64* %15, align 8
  %17 = call i64 @llvm.smin.i64(i64 %14, i64 %16)
  %18 = call i64 @llvm.smax.i64(i64 %17, i64 0)
  %19 = call i64 @nish_str_index_of_from(i8* %text, i8* %sep, i64 %18)
  %20 = trunc i64 %19 to i32
  store i32 %20, i32* %at.addr, align 4
  %21 = load i32, i32* %at.addr, align 4
  %22 = icmp slt i32 %21, 0
  br i1 %22, label %if.then.1, label %if.end.1

if.then.1:
  %23 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %24 = load i32, i32* %start.addr, align 4
  %25 = icmp sge i32 %24, 0
  br i1 %25, label %land.rhs, label %land.end

land.rhs:
  %26 = load i32, i32* %start.addr, align 4
  %27 = load i32, i32* %length.addr, align 4
  %28 = icmp slt i32 %26, %27
  br label %land.end

land.end:
  %29 = phi i1 [ false, %if.then.1 ], [ %28, %land.rhs ]
  br i1 %29, label %cond.true, label %cond.false

cond.true:
  %30 = bitcast i8* %text to i64*
  %31 = load i64, i64* %30, align 8
  %32 = load i32, i32* %start.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = load i32, i32* %length.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = call i64 @llvm.smin.i64(i64 %33, i64 %35)
  %37 = call i64 @llvm.smax.i64(i64 %33, i64 %35)
  %38 = sub i64 %37, %36
  %39 = getelementptr inbounds i8, i8* %text, i64 8
  %40 = getelementptr inbounds i8, i8* %39, i64 %36
  %41 = call i8* @nish_str_new(i8* %40, i64 %38)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %42 = phi i8* [ %41, %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), %cond.false ]
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = icmp eq i64 %44, %46
  br i1 %47, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %23, i64 8)
  br label %push.store

push.store:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i8**
  %51 = getelementptr inbounds i8*, i8** %50, i64 %44
  store i8* %42, i8** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %52 = add i64 %44, 1
  store i64 %52, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = trunc i64 %52 to i32
  %54 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %54

if.end.1:
  %55 = load i32, i32* %start.addr, align 4
  %56 = icmp sge i32 %55, 0
  br i1 %56, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %57 = load i32, i32* %start.addr, align 4
  %58 = load i32, i32* %length.addr, align 4
  %59 = icmp slt i32 %57, %58
  br label %land.end.3

land.end.3:
  %60 = phi i1 [ false, %if.end.1 ], [ %59, %land.rhs.3 ]
  br i1 %60, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %61 = load i32, i32* %at.addr, align 4
  %62 = icmp sge i32 %61, 0
  br label %land.end.2

land.end.2:
  %63 = phi i1 [ false, %land.end.3 ], [ %62, %land.rhs.2 ]
  br i1 %63, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %64 = load i32, i32* %at.addr, align 4
  %65 = load i32, i32* %length.addr, align 4
  %66 = icmp slt i32 %64, %65
  br label %land.end.1

land.end.1:
  %67 = phi i1 [ false, %land.end.2 ], [ %66, %land.rhs.1 ]
  br i1 %67, label %if.then.2, label %if.end.2

if.then.2:
  %68 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %69 = bitcast i8* %text to i64*
  %70 = load i64, i64* %69, align 8
  %71 = load i32, i32* %start.addr, align 4
  %72 = sext i32 %71 to i64
  %73 = load i32, i32* %at.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = call i64 @llvm.smin.i64(i64 %72, i64 %74)
  %76 = call i64 @llvm.smax.i64(i64 %72, i64 %74)
  %77 = sub i64 %76, %75
  %78 = getelementptr inbounds i8, i8* %text, i64 8
  %79 = getelementptr inbounds i8, i8* %78, i64 %75
  %80 = call i8* @nish_str_new(i8* %79, i64 %77)
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 1
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %85 = icmp eq i64 %82, %84
  br i1 %85, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %68, i64 8)
  br label %push.store.1

push.store.1:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = bitcast i8* %87 to i8**
  %89 = getelementptr inbounds i8*, i8** %88, i64 %82
  store i8* %80, i8** %89, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %90 = add i64 %82, 1
  store i64 %90, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = trunc i64 %90 to i32
  br label %if.end.2

if.end.2:
  %92 = load i32, i32* %at.addr, align 4
  %93 = load i32, i32* %sepLength.addr, align 4
  %94 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %92, i32 %93)
  %95 = extractvalue { i32, i1 } %94, 0
  %96 = extractvalue { i32, i1 } %94, 1
  br i1 %96, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %95, i32* %start.addr, align 4
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.splitLimit(i8* noundef nonnull noalias readonly align 8 nocapture %text, i8* noundef nonnull noalias readonly align 8 nocapture %sep, i32 noundef %limit) #1 {
entry:
  %sepLength.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %sep to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %sepLength.addr, align 4
  %3 = load i32, i32* %sepLength.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [31 x i8] }* @.str.2 to i8*))
  unreachable

if.end:
  %5 = bitcast i8* %text to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %length.addr, align 4
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* null, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %9, %struct.nish_array** %parts.addr, align 8
  %13 = icmp eq i32 %limit, 0
  br i1 %13, label %if.then.1, label %if.end.1

if.then.1:
  %14 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %14

if.end.1:
  store i32 0, i32* %start.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %15 = load i32, i32* %start.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %text to i64*
  %18 = load i64, i64* %17, align 8
  %19 = call i64 @llvm.smin.i64(i64 %16, i64 %18)
  %20 = call i64 @llvm.smax.i64(i64 %19, i64 0)
  %21 = call i64 @nish_str_index_of_from(i8* %text, i8* %sep, i64 %20)
  %22 = trunc i64 %21 to i32
  store i32 %22, i32* %at.addr, align 4
  %23 = load i32, i32* %at.addr, align 4
  %24 = icmp slt i32 %23, 0
  br i1 %24, label %if.then.2, label %if.end.2

if.then.2:
  %25 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %26 = load i32, i32* %start.addr, align 4
  %27 = icmp sge i32 %26, 0
  br i1 %27, label %land.rhs, label %land.end

land.rhs:
  %28 = load i32, i32* %start.addr, align 4
  %29 = load i32, i32* %length.addr, align 4
  %30 = icmp slt i32 %28, %29
  br label %land.end

land.end:
  %31 = phi i1 [ false, %if.then.2 ], [ %30, %land.rhs ]
  br i1 %31, label %cond.true, label %cond.false

cond.true:
  %32 = bitcast i8* %text to i64*
  %33 = load i64, i64* %32, align 8
  %34 = load i32, i32* %start.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = load i32, i32* %length.addr, align 4
  %37 = sext i32 %36 to i64
  %38 = call i64 @llvm.smin.i64(i64 %35, i64 %37)
  %39 = call i64 @llvm.smax.i64(i64 %35, i64 %37)
  %40 = sub i64 %39, %38
  %41 = getelementptr inbounds i8, i8* %text, i64 8
  %42 = getelementptr inbounds i8, i8* %41, i64 %38
  %43 = call i8* @nish_str_new(i8* %42, i64 %40)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %44 = phi i8* [ %43, %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), %cond.false ]
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = icmp eq i64 %46, %48
  br i1 %49, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %25, i64 8)
  br label %push.store

push.store:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to i8**
  %53 = getelementptr inbounds i8*, i8** %52, i64 %46
  store i8* %44, i8** %53, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = add i64 %46, 1
  store i64 %54, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  %56 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %56

if.end.2:
  %57 = load i32, i32* %start.addr, align 4
  %58 = icmp sge i32 %57, 0
  br i1 %58, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %59 = load i32, i32* %start.addr, align 4
  %60 = load i32, i32* %length.addr, align 4
  %61 = icmp slt i32 %59, %60
  br label %land.end.3

land.end.3:
  %62 = phi i1 [ false, %if.end.2 ], [ %61, %land.rhs.3 ]
  br i1 %62, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %63 = load i32, i32* %at.addr, align 4
  %64 = icmp sge i32 %63, 0
  br label %land.end.2

land.end.2:
  %65 = phi i1 [ false, %land.end.3 ], [ %64, %land.rhs.2 ]
  br i1 %65, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %66 = load i32, i32* %at.addr, align 4
  %67 = load i32, i32* %length.addr, align 4
  %68 = icmp slt i32 %66, %67
  br label %land.end.1

land.end.1:
  %69 = phi i1 [ false, %land.end.2 ], [ %68, %land.rhs.1 ]
  br i1 %69, label %if.then.3, label %if.end.3

if.then.3:
  %70 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %71 = bitcast i8* %text to i64*
  %72 = load i64, i64* %71, align 8
  %73 = load i32, i32* %start.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = load i32, i32* %at.addr, align 4
  %76 = sext i32 %75 to i64
  %77 = call i64 @llvm.smin.i64(i64 %74, i64 %76)
  %78 = call i64 @llvm.smax.i64(i64 %74, i64 %76)
  %79 = sub i64 %78, %77
  %80 = getelementptr inbounds i8, i8* %text, i64 8
  %81 = getelementptr inbounds i8, i8* %80, i64 %77
  %82 = call i8* @nish_str_new(i8* %81, i64 %79)
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 1
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %87 = icmp eq i64 %84, %86
  br i1 %87, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %70, i64 8)
  br label %push.store.1

push.store.1:
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %90 = bitcast i8* %89 to i8**
  %91 = getelementptr inbounds i8*, i8** %90, i64 %84
  store i8* %82, i8** %91, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %92 = add i64 %84, 1
  store i64 %92, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = trunc i64 %92 to i32
  br label %if.end.3

if.end.3:
  %94 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 0
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %97 = trunc i64 %96 to i32
  %98 = icmp eq i32 %97, %limit
  br i1 %98, label %if.then.4, label %if.end.4

if.then.4:
  %99 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %99

if.end.4:
  %100 = load i32, i32* %at.addr, align 4
  %101 = load i32, i32* %sepLength.addr, align 4
  %102 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %100, i32 %101)
  %103 = extractvalue { i32, i1 } %102, 0
  %104 = extractvalue { i32, i1 } %102, 1
  br i1 %104, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %103, i32* %start.addr, align 4
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.fixedDigitsHalve(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %digits, i32 noundef %count) #1 {
entry:
  %carry.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  store i32 0, i32* %carry.addr, align 4
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %count, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %carry.addr, align 4
  %14 = mul nsw i32 %13, 10
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %6 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %16
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %21, i32* %value.addr, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %value.addr, align 4
  %26 = ashr i32 %25, 1
  %27 = bitcast i8* %6 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %24
  store i32 %26, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = load i32, i32* %value.addr, align 4
  %30 = and i32 %29, 1
  store i32 %30, i32* %carry.addr, align 4
  %31 = load i32, i32* %i.addr, align 4
  %32 = sub nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %33 = load i32, i32* %carry.addr, align 4
  ret i32 %33

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 0, %while.body ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @nish.fixedDigitsAdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %digits, i1 noundef zeroext %doubling, i32 noundef %amount) #1 {
entry:
  %carry.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  store i32 %amount, i32* %carry.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %length.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %while.body, label %while.end

while.body:
  br i1 %doubling, label %cond.true, label %cond.false

cond.true:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %12, i32 2)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %4 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 %17
  %20 = load i32, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %cond.end

cond.end:
  %21 = phi i32 [ %14, %ovf.ok ], [ %20, %cond.false ]
  %22 = load i32, i32* %carry.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %24, i32* %value.addr, align 4
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = load i32, i32* %value.addr, align 4
  %29 = icmp sge i32 %28, 10
  br i1 %29, label %cond.true.1, label %cond.false.1

cond.true.1:
  %30 = load i32, i32* %value.addr, align 4
  %31 = sub nsw i32 %30, 10
  br label %cond.end.1

cond.false.1:
  %32 = load i32, i32* %value.addr, align 4
  br label %cond.end.1

cond.end.1:
  %33 = phi i32 [ %31, %cond.true.1 ], [ %32, %cond.false.1 ]
  %34 = bitcast i8* %4 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %27
  store i32 %33, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %36 = load i32, i32* %value.addr, align 4
  %37 = icmp sge i32 %36, 10
  br i1 %37, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %38 = phi i32 [ 1, %cond.true.2 ], [ 0, %cond.false.2 ]
  store i32 %38, i32* %carry.addr, align 4
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %41 = load i32, i32* %carry.addr, align 4
  %42 = icmp sgt i32 %41, 0
  br i1 %42, label %if.then, label %if.end

if.then:
  %43 = load i32, i32* %carry.addr, align 4
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 1
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = icmp eq i64 %45, %47
  br i1 %48, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %digits, i64 4)
  br label %push.store

push.store:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 %45
  store i32 %43, i32* %52, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %53 = add i64 %45, 1
  store i64 %53, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = trunc i64 %53 to i32
  br label %if.end

if.end:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %cond.true ], [ 0, %cond.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef nonnull align 8 i8* @nish.toFixed(double noundef %x, i32 noundef %digits) #1 {
entry:
  %negative.addr = alloca i1, align 1
  %m.addr = alloca double, align 8
  %exponent.addr = alloca i32, align 4
  %decimal.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %last.addr = alloca double, align 8
  %count.addr = alloca i32, align 4
  %dropped.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %digit.addr = alloca i32, align 4
  %0 = icmp slt i32 %digits, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp sgt i32 %digits, 100
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [33 x i8] }* @.str.3 to i8*))
  unreachable

if.end:
  %3 = fcmp une double %x, %x
  br i1 %3, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %4 = fcmp oge double %x, 0x444B1AE4D6E2EF50
  br label %lor.end.2

lor.end.2:
  %5 = phi i1 [ true, %if.end ], [ %4, %lor.rhs.2 ]
  br i1 %5, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %6 = fneg double 0x444B1AE4D6E2EF50
  %7 = fcmp ole double %x, %6
  br label %lor.end.1

lor.end.1:
  %8 = phi i1 [ true, %lor.end.2 ], [ %7, %lor.rhs.1 ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = call i8* @nish_str_from_f64(double %x)
  ret i8* %9

if.end.1:
  %10 = fcmp olt double %x, 0x0000000000000000
  store i1 %10, i1* %negative.addr, align 1
  %11 = load i1, i1* %negative.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = fneg double %x
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %13 = phi double [ %12, %cond.true ], [ %x, %cond.false ]
  store double %13, double* %m.addr, align 8
  store i32 0, i32* %exponent.addr, align 4
  %14 = load double, double* %m.addr, align 8
  %15 = fcmp ogt double %14, 0x0000000000000000
  br i1 %15, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.cond

while.cond:
  %16 = load double, double* %m.addr, align 8
  %17 = fcmp olt double %16, 0x4330000000000000
  br i1 %17, label %while.body, label %while.end

while.body:
  %18 = load double, double* %m.addr, align 8
  %19 = fmul double %18, 0x4000000000000000
  store double %19, double* %m.addr, align 8
  %20 = load i32, i32* %exponent.addr, align 4
  %21 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %20, i32 1)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %22, i32* %exponent.addr, align 4
  br label %while.cond

while.end:
  br label %while.cond.1

while.cond.1:
  %24 = load double, double* %m.addr, align 8
  %25 = fcmp oge double %24, 0x4340000000000000
  br i1 %25, label %while.body.1, label %while.end.1

while.body.1:
  %26 = load double, double* %m.addr, align 8
  %27 = fdiv double %26, 0x4000000000000000
  store double %27, double* %m.addr, align 8
  %28 = load i32, i32* %exponent.addr, align 4
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 1)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %30, i32* %exponent.addr, align 4
  br label %while.cond.1

while.end.1:
  br label %if.end.2

if.end.2:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %decimal.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond.2

while.cond.2:
  %35 = load i32, i32* %i.addr, align 4
  %36 = icmp slt i32 %35, %digits
  br i1 %36, label %while.body.2, label %while.end.2

while.body.2:
  %37 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 1
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = icmp eq i64 %39, %41
  br i1 %42, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %37, i64 4)
  br label %push.store

push.store:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %39
  store i32 0, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %47 = add i64 %39, 1
  store i64 %47, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = trunc i64 %47 to i32
  %49 = load i32, i32* %i.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %i.addr, align 4
  br label %while.cond.2

while.end.2:
  br label %while.cond.3

while.cond.3:
  %51 = load double, double* %m.addr, align 8
  %52 = fcmp ogt double %51, 0x0000000000000000
  br i1 %52, label %while.body.3, label %while.end.3

while.body.3:
  %53 = load double, double* %m.addr, align 8
  %54 = frem double %53, 0x4024000000000000
  store double %54, double* %last.addr, align 8
  %55 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %56 = load double, double* %last.addr, align 8
  %57 = call i32 @llvm.fptosi.sat.i32.f64(double %56)
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 1
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %62 = icmp eq i64 %59, %61
  br i1 %62, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %55, i64 4)
  br label %push.store.1

push.store.1:
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %64 to i32*
  %66 = getelementptr inbounds i32, i32* %65, i64 %59
  store i32 %57, i32* %66, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %67 = add i64 %59, 1
  store i64 %67, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = trunc i64 %67 to i32
  %69 = load double, double* %m.addr, align 8
  %70 = load double, double* %last.addr, align 8
  %71 = fsub double %69, %70
  %72 = fdiv double %71, 0x4024000000000000
  store double %72, double* %m.addr, align 8
  br label %while.cond.3

while.end.3:
  br label %while.cond.4

while.cond.4:
  %73 = load i32, i32* %exponent.addr, align 4
  %74 = icmp sgt i32 %73, 0
  br i1 %74, label %while.body.4, label %while.end.4

while.body.4:
  %75 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  call void @nish.fixedDigitsAdd(%struct.nish_array* %75, i1 true, i32 0)
  %76 = load i32, i32* %exponent.addr, align 4
  %77 = sub nsw i32 %76, 1
  store i32 %77, i32* %exponent.addr, align 4
  br label %while.cond.4

while.end.4:
  %78 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = trunc i64 %80 to i32
  store i32 %81, i32* %count.addr, align 4
  store i32 0, i32* %dropped.addr, align 4
  %82 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 2
  %86 = load i8*, i8** %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.5

while.cond.5:
  %87 = load i32, i32* %exponent.addr, align 4
  %88 = icmp slt i32 %87, 0
  br i1 %88, label %land.rhs, label %land.end

land.rhs:
  %89 = load i32, i32* %count.addr, align 4
  %90 = icmp sgt i32 %89, 0
  br label %land.end

land.end:
  %91 = phi i1 [ false, %while.cond.5 ], [ %90, %land.rhs ]
  br i1 %91, label %while.body.5, label %while.end.5

while.body.5:
  %92 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %93 = load i32, i32* %count.addr, align 4
  %94 = call i32 @nish.fixedDigitsHalve(%struct.nish_array* %92, i32 %93)
  store i32 %94, i32* %dropped.addr, align 4
  %95 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.6

while.cond.6:
  %100 = load i32, i32* %count.addr, align 4
  %101 = icmp sgt i32 %100, 0
  br i1 %101, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %102 = load i32, i32* %count.addr, align 4
  %103 = trunc i64 %97 to i32
  %104 = icmp sle i32 %102, %103
  br label %land.end.2

land.end.2:
  %105 = phi i1 [ false, %while.cond.6 ], [ %104, %land.rhs.2 ]
  br i1 %105, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %106 = load i32, i32* %count.addr, align 4
  %107 = sub nsw i32 %106, 1
  %108 = sext i32 %107 to i64
  %109 = icmp ult i64 %108, %97
  br i1 %109, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %108, i64 %97)
  unreachable

bounds.ok:
  %110 = bitcast i8* %99 to i32*
  %111 = getelementptr inbounds i32, i32* %110, i64 %108
  %112 = load i32, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %113 = icmp eq i32 %112, 0
  br label %land.end.1

land.end.1:
  %114 = phi i1 [ false, %land.end.2 ], [ %113, %bounds.ok ]
  br i1 %114, label %while.body.6, label %while.end.6

while.body.6:
  %115 = load i32, i32* %count.addr, align 4
  %116 = sub nsw i32 %115, 1
  store i32 %116, i32* %count.addr, align 4
  br label %while.cond.6

while.end.6:
  %117 = load i32, i32* %exponent.addr, align 4
  %118 = add nsw i32 %117, 1
  store i32 %118, i32* %exponent.addr, align 4
  br label %while.cond.5

while.end.5:
  %119 = load i32, i32* %exponent.addr, align 4
  %120 = icmp eq i32 %119, 0
  br i1 %120, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %121 = load i32, i32* %dropped.addr, align 4
  %122 = icmp eq i32 %121, 1
  br label %land.end.3

land.end.3:
  %123 = phi i1 [ false, %while.end.5 ], [ %122, %land.rhs.3 ]
  br i1 %123, label %if.then.3, label %if.end.3

if.then.3:
  %124 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  call void @nish.fixedDigitsAdd(%struct.nish_array* %124, i1 false, i32 1)
  br label %if.end.3

if.end.3:
  br label %while.cond.7

while.cond.7:
  %125 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 0
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = trunc i64 %127 to i32
  %129 = icmp sle i32 %128, %digits
  br i1 %129, label %while.body.7, label %while.end.7

while.body.7:
  %130 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 0
  %132 = load i64, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 1
  %134 = load i64, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %135 = icmp eq i64 %132, %134
  br i1 %135, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %130, i64 4)
  br label %push.store.2

push.store.2:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %138 = bitcast i8* %137 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 %132
  store i32 0, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %140 = add i64 %132, 1
  store i64 %140, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %141 = trunc i64 %140 to i32
  br label %while.cond.7

while.end.7:
  %142 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = trunc i64 %144 to i32
  %146 = sub nsw i32 %145, 1
  store i32 %146, i32* %at.addr, align 4
  %147 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 0
  %149 = load i64, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.8

while.cond.8:
  %152 = load i32, i32* %at.addr, align 4
  %153 = icmp sgt i32 %152, %digits
  br i1 %153, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %154 = load i32, i32* %at.addr, align 4
  %155 = icmp sge i32 %154, 0
  br label %land.end.6

land.end.6:
  %156 = phi i1 [ false, %while.cond.8 ], [ %155, %land.rhs.6 ]
  br i1 %156, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %157 = load i32, i32* %at.addr, align 4
  %158 = trunc i64 %149 to i32
  %159 = icmp slt i32 %157, %158
  br label %land.end.5

land.end.5:
  %160 = phi i1 [ false, %land.end.6 ], [ %159, %land.rhs.5 ]
  br i1 %160, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %161 = load i32, i32* %at.addr, align 4
  %162 = sext i32 %161 to i64
  %163 = bitcast i8* %151 to i32*
  %164 = getelementptr inbounds i32, i32* %163, i64 %162
  %165 = load i32, i32* %164, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %166 = icmp eq i32 %165, 0
  br label %land.end.4

land.end.4:
  %167 = phi i1 [ false, %land.end.5 ], [ %166, %land.rhs.4 ]
  br i1 %167, label %while.body.8, label %while.end.8

while.body.8:
  %168 = load i32, i32* %at.addr, align 4
  %169 = sub nsw i32 %168, 1
  store i32 %169, i32* %at.addr, align 4
  br label %while.cond.8

while.end.8:
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %171, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %172, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %bytes.addr, align 8
  %173 = load i1, i1* %negative.addr, align 1
  br i1 %173, label %if.then.4, label %if.end.4

if.then.4:
  %174 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %175 = trunc i32 45 to i8
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %174, i64 0, i32 0
  %177 = load i64, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %174, i64 0, i32 1
  %179 = load i64, i64* %178, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %180 = icmp eq i64 %177, %179
  br i1 %180, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %174, i64 1)
  br label %push.store.3

push.store.3:
  %181 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %174, i64 0, i32 2
  %182 = load i8*, i8** %181, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %183 = bitcast i8* %182 to i8*
  %184 = getelementptr inbounds i8, i8* %183, i64 %177
  store i8 %175, i8* %184, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %185 = add i64 %177, 1
  store i64 %185, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %186 = trunc i64 %185 to i32
  br label %if.end.4

if.end.4:
  br label %while.cond.9

while.cond.9:
  %187 = load i32, i32* %at.addr, align 4
  %188 = icmp sge i32 %187, 0
  br i1 %188, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %189 = load i32, i32* %at.addr, align 4
  %190 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 0
  %192 = load i64, i64* %191, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %193 = trunc i64 %192 to i32
  %194 = icmp slt i32 %189, %193
  br label %land.end.7

land.end.7:
  %195 = phi i1 [ false, %while.cond.9 ], [ %194, %land.rhs.7 ]
  br i1 %195, label %while.body.9, label %while.end.9

while.body.9:
  %196 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %197 = load i32, i32* %at.addr, align 4
  %198 = sext i32 %197 to i64
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 2
  %200 = load i8*, i8** %199, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %201 = bitcast i8* %200 to i32*
  %202 = getelementptr inbounds i32, i32* %201, i64 %198
  %203 = load i32, i32* %202, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %203, i32* %digit.addr, align 4
  %204 = load i32, i32* %at.addr, align 4
  %205 = sub nsw i32 %digits, 1
  %206 = icmp eq i32 %204, %205
  br i1 %206, label %if.then.5, label %if.end.5

if.then.5:
  %207 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %208 = trunc i32 46 to i8
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 0
  %210 = load i64, i64* %209, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 1
  %212 = load i64, i64* %211, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %213 = icmp eq i64 %210, %212
  br i1 %213, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %207, i64 1)
  br label %push.store.4

push.store.4:
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %207, i64 0, i32 2
  %215 = load i8*, i8** %214, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %216 = bitcast i8* %215 to i8*
  %217 = getelementptr inbounds i8, i8* %216, i64 %210
  store i8 %208, i8* %217, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %218 = add i64 %210, 1
  store i64 %218, i64* %209, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = trunc i64 %218 to i32
  br label %if.end.5

if.end.5:
  %220 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %221 = load i32, i32* %digit.addr, align 4
  %222 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 48, i32 %221)
  %223 = extractvalue { i32, i1 } %222, 0
  %224 = extractvalue { i32, i1 } %222, 1
  br i1 %224, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %225 = trunc i32 %223 to i8
  %226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 0
  %227 = load i64, i64* %226, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 1
  %229 = load i64, i64* %228, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %230 = icmp eq i64 %227, %229
  br i1 %230, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %220, i64 1)
  br label %push.store.5

push.store.5:
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 2
  %232 = load i8*, i8** %231, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %233 = bitcast i8* %232 to i8*
  %234 = getelementptr inbounds i8, i8* %233, i64 %227
  store i8 %225, i8* %234, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %235 = add i64 %227, 1
  store i64 %235, i64* %226, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %236 = trunc i64 %235 to i32
  %237 = load i32, i32* %at.addr, align 4
  %238 = sub nsw i32 %237, 1
  store i32 %238, i32* %at.addr, align 4
  br label %while.cond.9

while.end.9:
  %239 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %240 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %240, i64 0, i32 0
  %242 = load i64, i64* %241, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %243 = trunc i64 %242 to i32
  %244 = sext i32 %243 to i64
  %245 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %239, i64 0, i32 0
  %246 = load i64, i64* %245, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %247 = icmp ule i64 0, %244
  %248 = icmp ule i64 %244, %246
  %249 = and i1 %247, %248
  br i1 %249, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %244, i64 %246)
  unreachable

bytes.ok:
  %250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %239, i64 0, i32 2
  %251 = load i8*, i8** %250, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %252 = getelementptr inbounds i8, i8* %251, i64 0
  %253 = sub i64 %244, 0
  %254 = call i8* @nish_str_new(i8* %252, i64 %253)
  ret i8* %254

ovf.fail:
  %ovf.op = phi i32 [ 1, %while.body ], [ 0, %while.body.1 ], [ 0, %if.end.5 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
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
  %76 = icmp eq i64 %74, 1
  br i1 %76, label %join.byte, label %join.bulk

join.byte:
  %77 = load i8, i8* %75, align 1
  store i8 %77, i8* %67, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %67, i8* %75, i64 %74, i1 false)
  br label %join.next

join.next:
  %78 = getelementptr inbounds i8, i8* %67, i64 %74
  store i8* %78, i8** %join.p, align 8
  %79 = add i64 %61, 1
  store i64 %79, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %80 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %80, align 1
  ret i8* %58

if.end.1:
  %81 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %82 = load i8*, i8** %rest.addr, align 8
  %83 = bitcast i8* %82 to i64*
  %84 = load i64, i64* %83, align 8
  %85 = load i32, i32* %at.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = call i64 @llvm.smin.i64(i64 0, i64 %86)
  %88 = call i64 @llvm.smax.i64(i64 0, i64 %86)
  %89 = sub i64 %88, %87
  %90 = getelementptr inbounds i8, i8* %82, i64 8
  %91 = getelementptr inbounds i8, i8* %90, i64 %87
  %92 = call i8* @nish_str_new(i8* %91, i64 %89)
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 1
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = icmp eq i64 %94, %96
  br i1 %97, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %81, i64 8)
  br label %push.store.1

push.store.1:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %100 = bitcast i8* %99 to i8**
  %101 = getelementptr inbounds i8*, i8** %100, i64 %94
  store i8* %92, i8** %101, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = add i64 %94, 1
  store i64 %102, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = trunc i64 %102 to i32
  %104 = load i8*, i8** %rest.addr, align 8
  %105 = bitcast i8* %104 to i64*
  %106 = load i64, i64* %105, align 8
  %107 = load i32, i32* %at.addr, align 4
  %108 = load i32, i32* %needleLength.addr, align 4
  %109 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %107, i32 %108)
  %110 = extractvalue { i32, i1 } %109, 0
  %111 = extractvalue { i32, i1 } %109, 1
  br i1 %111, label %ovf.fail, label %ovf.ok

ovf.ok:
  %112 = sext i32 %110 to i64
  %113 = call i64 @llvm.smin.i64(i64 %112, i64 %106)
  %114 = call i64 @llvm.smax.i64(i64 %113, i64 0)
  %115 = load i8*, i8** %rest.addr, align 8
  %116 = bitcast i8* %115 to i64*
  %117 = load i64, i64* %116, align 8
  %118 = trunc i64 %117 to i32
  %119 = sext i32 %118 to i64
  %120 = call i64 @llvm.smin.i64(i64 %119, i64 %106)
  %121 = call i64 @llvm.smax.i64(i64 %120, i64 0)
  %122 = call i64 @llvm.smin.i64(i64 %114, i64 %121)
  %123 = call i64 @llvm.smax.i64(i64 %114, i64 %121)
  %124 = sub i64 %123, %122
  %125 = getelementptr inbounds i8, i8* %104, i64 8
  %126 = getelementptr inbounds i8, i8* %125, i64 %122
  %127 = call i8* @nish_str_new(i8* %126, i64 %124)
  store i8* %127, i8** %rest.addr, align 8
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
  call void @nish_panic(i8* bitcast ({ i64, [44 x i8] }* @.str.4 to i8*))
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
  call void @nish_panic(i8* bitcast ({ i64, [48 x i8] }* @.str.5 to i8*))
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

define internal noundef zeroext i1 @nish.textUnitsAreBytes() #2 {
entry:
  %0 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.6 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 2
  ret i1 %3
}

define noundef i32 @nish.codePointLength(i8* noundef nonnull noalias readonly align 8 nocapture %text) #3 {
entry:
  %length.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %afterHigh.addr = alloca i1, align 1
  %unit.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = call i1 @nish.textUnitsAreBytes()
  br i1 %3, label %if.then, label %if.end

if.then:
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = load i32, i32* %length.addr, align 4
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %while.body, label %while.end

while.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds i8, i8* %text, i64 8
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1
  %12 = zext i8 %11 to i32
  %13 = and i32 %12, 192
  %14 = icmp ne i32 %13, 128
  br i1 %14, label %if.then.1, label %if.end.1

if.then.1:
  %15 = load i32, i32* %count.addr, align 4
  %16 = add i32 %15, 1
  store i32 %16, i32* %count.addr, align 4
  br label %if.end.1

if.end.1:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %19 = load i32, i32* %count.addr, align 4
  ret i32 %19

if.end:
  store i1 false, i1* %afterHigh.addr, align 1
  br label %while.cond.1

while.cond.1:
  %20 = load i32, i32* %i.addr, align 4
  %21 = load i32, i32* %length.addr, align 4
  %22 = icmp slt i32 %20, %21
  br i1 %22, label %while.body.1, label %while.end.1

while.body.1:
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = getelementptr inbounds i8, i8* %text, i64 8
  %26 = getelementptr inbounds i8, i8* %25, i64 %24
  %27 = load i8, i8* %26, align 1
  %28 = zext i8 %27 to i32
  store i32 %28, i32* %unit.addr, align 4
  %29 = load i1, i1* %afterHigh.addr, align 1
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load i32, i32* %unit.addr, align 4
  %31 = icmp sge i32 %30, 56320
  br label %land.end.1

land.end.1:
  %32 = phi i1 [ false, %while.body.1 ], [ %31, %land.rhs.1 ]
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %unit.addr, align 4
  %34 = icmp slt i32 %33, 57344
  br label %land.end

land.end:
  %35 = phi i1 [ false, %land.end.1 ], [ %34, %land.rhs ]
  %36 = xor i1 %35, true
  br i1 %36, label %if.then.2, label %if.end.2

if.then.2:
  %37 = load i32, i32* %count.addr, align 4
  %38 = add i32 %37, 1
  store i32 %38, i32* %count.addr, align 4
  br label %if.end.2

if.end.2:
  %39 = load i32, i32* %unit.addr, align 4
  %40 = icmp sge i32 %39, 55296
  br i1 %40, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %41 = load i32, i32* %unit.addr, align 4
  %42 = icmp slt i32 %41, 56320
  br label %land.end.2

land.end.2:
  %43 = phi i1 [ false, %if.end.2 ], [ %42, %land.rhs.2 ]
  store i1 %43, i1* %afterHigh.addr, align 1
  %44 = load i32, i32* %i.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %46 = load i32, i32* %count.addr, align 4
  ret i32 %46
}

define internal noundef nonnull align 8 i8* @nish.shiftTextAsciiRange(i8* noundef nonnull noalias readonly align 8 nocapture %text, i32 noundef %low, i32 noundef %high, i32 noundef %delta) #1 {
entry:
  %length.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %code.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %start.addr = alloca i32, align 4
  %code.addr.1 = alloca i32, align 4
  %chr = alloca i8, align 1
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = call i1 @nish.textUnitsAreBytes()
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  br label %while.cond

while.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %length.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %while.body, label %while.end

while.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds i8, i8* %text, i64 8
  %13 = getelementptr inbounds i8, i8* %12, i64 %11
  %14 = load i8, i8* %13, align 1
  %15 = zext i8 %14 to i32
  store i32 %15, i32* %code.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %17 = load i32, i32* %code.addr, align 4
  %18 = icmp sge i32 %17, %low
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %code.addr, align 4
  %20 = icmp sle i32 %19, %high
  br label %land.end

land.end:
  %21 = phi i1 [ false, %while.body ], [ %20, %land.rhs ]
  br i1 %21, label %cond.true, label %cond.false

cond.true:
  %22 = load i32, i32* %code.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 %delta)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %26 = load i32, i32* %code.addr, align 4
  br label %cond.end

cond.end:
  %27 = phi i32 [ %24, %ovf.ok ], [ %26, %cond.false ]
  %28 = trunc i32 %27 to i8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %16, i64 1)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = bitcast i8* %35 to i8*
  %37 = getelementptr inbounds i8, i8* %36, i64 %30
  store i8 %28, i8* %37, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %42 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %43 = load i32, i32* %length.addr, align 4
  %44 = sext i32 %43 to i64
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ule i64 0, %44
  %48 = icmp ule i64 %44, %46
  %49 = and i1 %47, %48
  br i1 %49, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %44, i64 %46)
  unreachable

bytes.ok:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = getelementptr inbounds i8, i8* %51, i64 0
  %53 = sub i64 %44, 0
  %54 = call i8* @nish_str_new(i8* %52, i64 %53)
  ret i8* %54

if.end:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %start.addr, align 4
  br label %while.cond.1

while.cond.1:
  %58 = load i32, i32* %i.addr, align 4
  %59 = load i32, i32* %length.addr, align 4
  %60 = icmp slt i32 %58, %59
  br i1 %60, label %while.body.1, label %while.end.1

while.body.1:
  %61 = load i32, i32* %i.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = getelementptr inbounds i8, i8* %text, i64 8
  %64 = getelementptr inbounds i8, i8* %63, i64 %62
  %65 = load i8, i8* %64, align 1
  %66 = zext i8 %65 to i32
  store i32 %66, i32* %code.addr.1, align 4
  %67 = load i32, i32* %code.addr.1, align 4
  %68 = icmp sge i32 %67, %low
  br i1 %68, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %69 = load i32, i32* %code.addr.1, align 4
  %70 = icmp sle i32 %69, %high
  br label %land.end.1

land.end.1:
  %71 = phi i1 [ false, %while.body.1 ], [ %70, %land.rhs.1 ]
  br i1 %71, label %if.then.1, label %if.end.1

if.then.1:
  %72 = load i32, i32* %start.addr, align 4
  %73 = icmp sge i32 %72, 0
  br i1 %73, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %74 = load i32, i32* %start.addr, align 4
  %75 = load i32, i32* %length.addr, align 4
  %76 = icmp slt i32 %74, %75
  br label %land.end.2

land.end.2:
  %77 = phi i1 [ false, %if.then.1 ], [ %76, %land.rhs.2 ]
  br i1 %77, label %if.then.2, label %if.end.2

if.then.2:
  %78 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %79 = bitcast i8* %text to i64*
  %80 = load i64, i64* %79, align 8
  %81 = load i32, i32* %start.addr, align 4
  %82 = sext i32 %81 to i64
  %83 = load i32, i32* %i.addr, align 4
  %84 = sext i32 %83 to i64
  %85 = call i64 @llvm.smin.i64(i64 %82, i64 %84)
  %86 = call i64 @llvm.smax.i64(i64 %82, i64 %84)
  %87 = sub i64 %86, %85
  %88 = getelementptr inbounds i8, i8* %text, i64 8
  %89 = getelementptr inbounds i8, i8* %88, i64 %85
  %90 = call i8* @nish_str_new(i8* %89, i64 %87)
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 1
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %95 = icmp eq i64 %92, %94
  br i1 %95, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %78, i64 8)
  br label %push.store.1

push.store.1:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %97 to i8**
  %99 = getelementptr inbounds i8*, i8** %98, i64 %92
  store i8* %90, i8** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %100 = add i64 %92, 1
  store i64 %100, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = trunc i64 %100 to i32
  br label %if.end.2

if.end.2:
  %102 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %103 = load i32, i32* %code.addr.1, align 4
  %104 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %103, i32 %delta)
  %105 = extractvalue { i32, i1 } %104, 0
  %106 = extractvalue { i32, i1 } %104, 1
  br i1 %106, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %107 = sext i32 %105 to i64
  %108 = trunc i64 %107 to i8
  store i8 %108, i8* %chr, align 1
  %109 = call i8* @nish_str_new(i8* %chr, i64 1)
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 1
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %114 = icmp eq i64 %111, %113
  br i1 %114, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %102, i64 8)
  br label %push.store.2

push.store.2:
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %117 = bitcast i8* %116 to i8**
  %118 = getelementptr inbounds i8*, i8** %117, i64 %111
  store i8* %109, i8** %118, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %119 = add i64 %111, 1
  store i64 %119, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = trunc i64 %119 to i32
  %121 = load i32, i32* %i.addr, align 4
  %122 = add nsw i32 %121, 1
  store i32 %122, i32* %start.addr, align 4
  br label %if.end.1

if.end.1:
  %123 = load i32, i32* %i.addr, align 4
  %124 = add nsw i32 %123, 1
  store i32 %124, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %125 = load i32, i32* %start.addr, align 4
  %126 = load i32, i32* %length.addr, align 4
  %127 = icmp slt i32 %125, %126
  br i1 %127, label %if.then.3, label %if.end.3

if.then.3:
  %128 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %129 = bitcast i8* %text to i64*
  %130 = load i64, i64* %129, align 8
  %131 = load i32, i32* %start.addr, align 4
  %132 = sext i32 %131 to i64
  %133 = call i64 @llvm.smin.i64(i64 %132, i64 %130)
  %134 = call i64 @llvm.smax.i64(i64 %133, i64 0)
  %135 = load i32, i32* %length.addr, align 4
  %136 = sext i32 %135 to i64
  %137 = call i64 @llvm.smin.i64(i64 %134, i64 %136)
  %138 = call i64 @llvm.smax.i64(i64 %134, i64 %136)
  %139 = sub i64 %138, %137
  %140 = getelementptr inbounds i8, i8* %text, i64 8
  %141 = getelementptr inbounds i8, i8* %140, i64 %137
  %142 = call i8* @nish_str_new(i8* %141, i64 %139)
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 1
  %146 = load i64, i64* %145, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %147 = icmp eq i64 %144, %146
  br i1 %147, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %128, i64 8)
  br label %push.store.3

push.store.3:
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 2
  %149 = load i8*, i8** %148, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %150 = bitcast i8* %149 to i8**
  %151 = getelementptr inbounds i8*, i8** %150, i64 %144
  store i8* %142, i8** %151, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %152 = add i64 %144, 1
  store i64 %152, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %153 = trunc i64 %152 to i32
  br label %if.end.3

if.end.3:
  %154 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 0
  %156 = load i64, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*) to i64*
  %158 = load i64, i64* %157, align 8
  %159 = sub i64 %156, 1
  %160 = mul i64 %158, %159
  %161 = icmp eq i64 %156, 0
  %162 = select i1 %161, i64 0, i64 %160
  store i64 %162, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %163 = load i64, i64* %join.at, align 8
  %164 = icmp ult i64 %163, %156
  br i1 %164, label %join.sum.body, label %join.copy

join.sum.body:
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 2
  %166 = load i8*, i8** %165, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %167 = bitcast i8* %166 to i8**
  %168 = getelementptr inbounds i8*, i8** %167, i64 %163
  %169 = load i8*, i8** %168, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %170 = load i64, i64* %join.total, align 8
  %171 = bitcast i8* %169 to i64*
  %172 = load i64, i64* %171, align 8
  %173 = add i64 %170, %172
  store i64 %173, i64* %join.total, align 8
  %174 = add i64 %163, 1
  store i64 %174, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %175 = load i64, i64* %join.total, align 8
  %176 = icmp ugt i64 %175, 2147483647
  %177 = add i64 %175, 9
  %178 = select i1 %176, i64 4611686018427387904, i64 %177
  %179 = call i8* @nish_alloc_struct(i64 %178)
  %180 = bitcast i8* %179 to i64*
  store i64 %175, i64* %180, align 8
  %181 = getelementptr inbounds i8, i8* %179, i64 8
  store i8* %181, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %182 = load i64, i64* %join.at, align 8
  %183 = icmp ult i64 %182, %156
  br i1 %183, label %join.part, label %join.end

join.part:
  %184 = load i8*, i8** %join.p, align 8
  %185 = icmp eq i64 %182, 0
  %186 = select i1 %185, i64 0, i64 %158
  %187 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %184, i8* %187, i64 %186, i1 false)
  %188 = getelementptr inbounds i8, i8* %184, i64 %186
  %189 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 2
  %190 = load i8*, i8** %189, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %191 = bitcast i8* %190 to i8**
  %192 = getelementptr inbounds i8*, i8** %191, i64 %182
  %193 = load i8*, i8** %192, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %194 = bitcast i8* %193 to i64*
  %195 = load i64, i64* %194, align 8
  %196 = getelementptr inbounds i8, i8* %193, i64 8
  %197 = icmp eq i64 %195, 1
  br i1 %197, label %join.byte, label %join.bulk

join.byte:
  %198 = load i8, i8* %196, align 1
  store i8 %198, i8* %188, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %188, i8* %196, i64 %195, i1 false)
  br label %join.next

join.next:
  %199 = getelementptr inbounds i8, i8* %188, i64 %195
  store i8* %199, i8** %join.p, align 8
  %200 = add i64 %182, 1
  store i64 %200, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %201 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %201, align 1
  ret i8* %179

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef nonnull align 8 i8* @nish.asciiUpper(i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = sub nsw i32 0, 32
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @nish.shiftTextAsciiRange(i8* %text, i32 97, i32 122, i32 %0)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  ret i8* %3
}

define noundef nonnull align 8 i8* @nish.asciiLower(i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.shiftTextAsciiRange(i8* %text, i32 65, i32 90, i32 32)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal noundef nonnull align 8 i8* @nish.textPadding(i8* noundef nonnull noalias readonly align 8 nocapture %text, i32 noundef %width, i8* noundef nonnull noalias readonly align 8 nocapture %fill, i8* noundef nonnull noalias readonly align 8 nocapture %caller) #1 {
entry:
  %fillLength.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %needed.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %left.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = bitcast i8* %fill to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %fillLength.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %j.addr, align 4
  %4 = load i32, i32* %fillLength.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %7 = load i8*, i8** %6, align 8
  %8 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %9 = load i64, i64* %8, align 8
  %10 = load i32, i32* %j.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds i8, i8* %fill, i64 8
  %13 = getelementptr inbounds i8, i8* %12, i64 %11
  %14 = load i8, i8* %13, align 1
  %15 = zext i8 %14 to i32
  %16 = icmp sge i32 %15, 128
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = call i8* @nish_str_concat(i8* %caller, i8* bitcast ({ i64, [39 x i8] }* @.str.7 to i8*))
  call void @nish_panic(i8* %17)
  unreachable

if.end:
  %18 = load i32, i32* %j.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %j.addr, align 4
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = icmp eq i8* %21, %7
  br i1 %22, label %pass.rewind, label %pass.free

pass.rewind:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %9, i64* %23, align 8
  br label %pass.done

pass.free:
  %24 = ptrtoint i8* %7 to i64
  %25 = add i64 %24, %9
  call void @nish_arena_release(i64 %25)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %26 = bitcast i8* %text to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %width, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %30, i32* %needed.addr, align 4
  %32 = load i32, i32* %needed.addr, align 4
  %33 = icmp sle i32 %32, 0
  br i1 %33, label %lor.end, label %lor.rhs

lor.rhs:
  %34 = load i32, i32* %fillLength.addr, align 4
  %35 = icmp eq i32 %34, 0
  br label %lor.end

lor.end:
  %36 = phi i1 [ true, %ovf.ok ], [ %35, %lor.rhs ]
  br i1 %36, label %if.then.1, label %if.end.1

if.then.1:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*)

if.end.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %40 = load i32, i32* %needed.addr, align 4
  store i32 %40, i32* %left.addr, align 4
  br label %while.cond.1

while.cond.1:
  %41 = load i32, i32* %left.addr, align 4
  %42 = load i32, i32* %fillLength.addr, align 4
  %43 = icmp sge i32 %41, %42
  br i1 %43, label %while.body.1, label %while.end.1

while.body.1:
  %44 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = icmp eq i64 %46, %48
  br i1 %49, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %44, i64 8)
  br label %push.store

push.store:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to i8**
  %53 = getelementptr inbounds i8*, i8** %52, i64 %46
  store i8* %fill, i8** %53, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = add i64 %46, 1
  store i64 %54, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  %56 = load i32, i32* %left.addr, align 4
  %57 = load i32, i32* %fillLength.addr, align 4
  %58 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %56, i32 %57)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %59, i32* %left.addr, align 4
  br label %while.cond.1

while.end.1:
  %61 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %62 = bitcast i8* %fill to i64*
  %63 = load i64, i64* %62, align 8
  %64 = load i32, i32* %left.addr, align 4
  %65 = sext i32 %64 to i64
  %66 = call i64 @llvm.smin.i64(i64 %65, i64 %63)
  %67 = call i64 @llvm.smax.i64(i64 %66, i64 0)
  %68 = call i64 @llvm.smin.i64(i64 0, i64 %67)
  %69 = call i64 @llvm.smax.i64(i64 0, i64 %67)
  %70 = sub i64 %69, %68
  %71 = getelementptr inbounds i8, i8* %fill, i64 8
  %72 = getelementptr inbounds i8, i8* %71, i64 %68
  %73 = call i8* @nish_str_new(i8* %72, i64 %70)
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 1
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = icmp eq i64 %75, %77
  br i1 %78, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %61, i64 8)
  br label %push.store.1

push.store.1:
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %81 = bitcast i8* %80 to i8**
  %82 = getelementptr inbounds i8*, i8** %81, i64 %75
  store i8* %73, i8** %82, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %83 = add i64 %75, 1
  store i64 %83, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = trunc i64 %83 to i32
  %85 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*) to i64*
  %89 = load i64, i64* %88, align 8
  %90 = sub i64 %87, 1
  %91 = mul i64 %89, %90
  %92 = icmp eq i64 %87, 0
  %93 = select i1 %92, i64 0, i64 %91
  store i64 %93, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %94 = load i64, i64* %join.at, align 8
  %95 = icmp ult i64 %94, %87
  br i1 %95, label %join.sum.body, label %join.copy

join.sum.body:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %97 to i8**
  %99 = getelementptr inbounds i8*, i8** %98, i64 %94
  %100 = load i8*, i8** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %101 = load i64, i64* %join.total, align 8
  %102 = bitcast i8* %100 to i64*
  %103 = load i64, i64* %102, align 8
  %104 = add i64 %101, %103
  store i64 %104, i64* %join.total, align 8
  %105 = add i64 %94, 1
  store i64 %105, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %106 = load i64, i64* %join.total, align 8
  %107 = icmp ugt i64 %106, 2147483647
  %108 = add i64 %106, 9
  %109 = select i1 %107, i64 4611686018427387904, i64 %108
  %110 = call i8* @nish_alloc_struct(i64 %109)
  %111 = bitcast i8* %110 to i64*
  store i64 %106, i64* %111, align 8
  %112 = getelementptr inbounds i8, i8* %110, i64 8
  store i8* %112, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %113 = load i64, i64* %join.at, align 8
  %114 = icmp ult i64 %113, %87
  br i1 %114, label %join.part, label %join.end

join.part:
  %115 = load i8*, i8** %join.p, align 8
  %116 = icmp eq i64 %113, 0
  %117 = select i1 %116, i64 0, i64 %89
  %118 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %115, i8* %118, i64 %117, i1 false)
  %119 = getelementptr inbounds i8, i8* %115, i64 %117
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %122 = bitcast i8* %121 to i8**
  %123 = getelementptr inbounds i8*, i8** %122, i64 %113
  %124 = load i8*, i8** %123, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %125 = bitcast i8* %124 to i64*
  %126 = load i64, i64* %125, align 8
  %127 = getelementptr inbounds i8, i8* %124, i64 8
  %128 = icmp eq i64 %126, 1
  br i1 %128, label %join.byte, label %join.bulk

join.byte:
  %129 = load i8, i8* %127, align 1
  store i8 %129, i8* %119, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %119, i8* %127, i64 %126, i1 false)
  br label %join.next

join.next:
  %130 = getelementptr inbounds i8, i8* %119, i64 %126
  store i8* %130, i8** %join.p, align 8
  %131 = add i64 %113, 1
  store i64 %131, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %132 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %132, align 1
  ret i8* %110

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef nonnull align 8 i8* @nish.padStart(i8* noundef nonnull noalias readonly align 8 %text, i32 noundef %width, i8* noundef nonnull noalias readonly align 8 %fill) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.textPadding(i8* %text, i32 %width, i8* %fill, i8* bitcast ({ i64, [9 x i8] }* @.str.8 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* %text)
  ret i8* %3
}

define noundef nonnull align 8 i8* @nish.padEnd(i8* noundef nonnull noalias readonly align 8 %text, i32 noundef %width, i8* noundef nonnull noalias readonly align 8 %fill) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.textPadding(i8* %text, i32 %width, i8* %fill, i8* bitcast ({ i64, [7 x i8] }* @.str.9 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i8* @nish_str_concat(i8* %text, i8* %2)
  ret i8* %3
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #6 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #7 = { nounwind willreturn memory(argmem: read, inaccessiblemem: readwrite) "probe-stack"="inline-asm" }
attributes #8 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #9 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!19, !20, !21, !22, !23}
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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element i8", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
