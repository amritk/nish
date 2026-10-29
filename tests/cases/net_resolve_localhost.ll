%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"localhost\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"localhost: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"localhost v4: \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare noundef i32 @nish_net_resolve(%struct.nish_array* noundef nonnull align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
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

define internal noundef zeroext i1 @isLoopback(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %at) #0 {
entry:
  %mapped.addr = alloca i1, align 1
  %v6.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 10)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = sext i32 %1 to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %3, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %3
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = icmp eq i8 %11, 255
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = add nsw i32 %at, 11
  %14 = sext i32 %13 to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %14
  %22 = load i8, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = icmp eq i8 %22, 255
  br label %land.end.1

land.end.1:
  %24 = phi i1 [ false, %bounds.ok ], [ %23, %bounds.ok.1 ]
  br i1 %24, label %land.rhs, label %land.end

land.rhs:
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 12)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %28 = sext i32 %26 to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = icmp ult i64 %28, %30
  br i1 %31, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %28, i64 %30)
  unreachable

bounds.ok.2:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = bitcast i8* %33 to i8*
  %35 = getelementptr inbounds i8, i8* %34, i64 %28
  %36 = load i8, i8* %35, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = icmp eq i8 %36, 127
  br label %land.end

land.end:
  %38 = phi i1 [ false, %land.end.1 ], [ %37, %bounds.ok.2 ]
  store i1 %38, i1* %mapped.addr, align 1
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 15)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %42 = sext i32 %40 to i64
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = icmp ult i64 %42, %44
  br i1 %45, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %42, i64 %44)
  unreachable

bounds.ok.3:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = bitcast i8* %47 to i8*
  %49 = getelementptr inbounds i8, i8* %48, i64 %42
  %50 = load i8, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %51 = icmp eq i8 %50, 1
  store i1 %51, i1* %v6.addr, align 1
  store i32 0, i32* %i.addr, align 4
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %56 = load i32, i32* %i.addr, align 4
  %57 = icmp slt i32 %56, 10
  br i1 %57, label %for.body, label %for.end

for.body:
  %58 = load i32, i32* %i.addr, align 4
  %59 = add nsw i32 %at, %58
  %60 = sext i32 %59 to i64
  %61 = icmp ult i64 %60, %53
  br i1 %61, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %60, i64 %53)
  unreachable

bounds.ok.4:
  %62 = bitcast i8* %55 to i8*
  %63 = getelementptr inbounds i8, i8* %62, i64 %60
  %64 = load i8, i8* %63, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %65 = icmp ne i8 %64, 0
  br i1 %65, label %if.then, label %if.end

if.then:
  store i1 false, i1* %mapped.addr, align 1
  store i1 false, i1* %v6.addr, align 1
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %66 = load i32, i32* %i.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 10, i32* %i.addr.1, align 4
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %72 = load i32, i32* %i.addr.1, align 4
  %73 = icmp slt i32 %72, 15
  br i1 %73, label %for.body.1, label %for.end.1

for.body.1:
  %74 = load i32, i32* %i.addr.1, align 4
  %75 = add nsw i32 %at, %74
  %76 = sext i32 %75 to i64
  %77 = icmp ult i64 %76, %69
  br i1 %77, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %76, i64 %69)
  unreachable

bounds.ok.5:
  %78 = bitcast i8* %71 to i8*
  %79 = getelementptr inbounds i8, i8* %78, i64 %76
  %80 = load i8, i8* %79, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %81 = icmp ne i8 %80, 0
  br i1 %81, label %if.then.1, label %if.end.1

if.then.1:
  store i1 false, i1* %v6.addr, align 1
  br label %if.end.1

if.end.1:
  br label %for.inc.1

for.inc.1:
  %82 = load i32, i32* %i.addr.1, align 4
  %83 = add nsw i32 %82, 1
  store i32 %83, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %84 = load i1, i1* %mapped.addr, align 1
  br i1 %84, label %lor.end, label %lor.rhs

lor.rhs:
  %85 = load i1, i1* %v6.addr, align 1
  br label %lor.end

lor.end:
  %86 = phi i1 [ true, %for.end.1 ], [ %85, %lor.rhs ]
  ret i1 %86

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @portAt(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, i32 noundef %at) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %at, i32 16)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = sext i32 %1 to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %3, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %3
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %12 = zext i8 %11 to i32
  %13 = mul nsw i32 %12, 256
  %14 = add nsw i32 %at, 17
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %15, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast i8* %20 to i8*
  %22 = getelementptr inbounds i8, i8* %21, i64 %15
  %23 = load i8, i8* %22, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %24 = zext i8 %23 to i32
  %25 = add nsw i32 %13, %24
  ret i32 %25

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %loopback.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  %v4.addr = alloca i32, align 4
  %one.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [18 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = mul nsw i32 18, 8
  %1 = sext i32 %0 to i64
  %2 = icmp ule i64 %1, 2147483647
  br i1 %2, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 %1, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %7 = call i8* @nish_alloc_struct(i64 %1)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %1, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %4, %struct.nish_array** %out.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %10 = call i32 @nish_net_resolve(%struct.nish_array* %9, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 8080, i32 0)
  store i32 %10, i32* %n.addr, align 4
  %11 = load i32, i32* %n.addr, align 4
  %12 = icmp sge i32 %11, 1
  store i1 %12, i1* %loopback.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %n.addr, align 4
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i1, i1* %loopback.addr, align 1
  br i1 %16, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %18, i32 18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  %22 = call i1 @isLoopback(%struct.nish_array* %17, i32 %20)
  br label %land.end.1

land.end.1:
  %23 = phi i1 [ false, %for.body ], [ %22, %ovf.ok ]
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %25 = load i32, i32* %i.addr, align 4
  %26 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %25, i32 18)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %29 = call i32 @portAt(%struct.nish_array* %24, i32 %27)
  %30 = icmp eq i32 %29, 8080
  br label %land.end

land.end:
  %31 = phi i1 [ false, %land.end.1 ], [ %30, %ovf.ok.1 ]
  store i1 %31, i1* %loopback.addr, align 1
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %34 = load i1, i1* %loopback.addr, align 1
  %35 = select i1 %34, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %36 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.2 to i8*), i8* %35)
  call void @nish_print(i8* %36)
  %37 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %38 = call i32 @nish_net_resolve(%struct.nish_array* %37, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 443, i32 4)
  store i32 %38, i32* %v4.addr, align 4
  %39 = load i32, i32* %v4.addr, align 4
  %40 = icmp sge i32 %39, 1
  br i1 %40, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %41 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp ult i64 10, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 10, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 10
  %49 = load i8, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %50 = icmp eq i8 %49, 255
  br label %land.end.4

land.end.4:
  %51 = phi i1 [ false, %for.end ], [ %50, %bounds.ok ]
  br i1 %51, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %52 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 12, %54
  br i1 %55, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 12, i64 %54)
  unreachable

bounds.ok.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %58 = bitcast i8* %57 to i8*
  %59 = getelementptr inbounds i8, i8* %58, i64 12
  %60 = load i8, i8* %59, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %61 = icmp eq i8 %60, 127
  br label %land.end.3

land.end.3:
  %62 = phi i1 [ false, %land.end.4 ], [ %61, %bounds.ok.1 ]
  br i1 %62, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %63 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %64 = call i32 @portAt(%struct.nish_array* %63, i32 0)
  %65 = icmp eq i32 %64, 443
  br label %land.end.2

land.end.2:
  %66 = phi i1 [ false, %land.end.3 ], [ %65, %land.rhs.2 ]
  %67 = select i1 %66, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %68 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.5 to i8*), i8* %67)
  call void @nish_print(i8* %68)
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 18, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 18, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %71 = bitcast [18 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %71, i8 0, i64 18, i1 false), !alias.scope !4, !noalias !3
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %71, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %one.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %74 = call i32 @nish_net_resolve(%struct.nish_array* %73, i8* bitcast ({ i64, [10 x i8] }* @.str.6 to i8*), i32 65535, i32 0)
  %75 = call i8* @nish_str_from_i32(i32 %74)
  call void @nish_print(i8* %75)
  %76 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = icmp ult i64 10, %78
  br i1 %79, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 10, i64 %78)
  unreachable

bounds.ok.2:
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %82 = bitcast i8* %81 to i8*
  %83 = getelementptr inbounds i8, i8* %82, i64 10
  %84 = load i8, i8* %83, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %85 = zext i8 %84 to i64
  %86 = call i8* @nish_str_from_u64(i64 %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %88 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = icmp ult i64 11, %90
  br i1 %91, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 11, i64 %90)
  unreachable

bounds.ok.3:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %94 = bitcast i8* %93 to i8*
  %95 = getelementptr inbounds i8, i8* %94, i64 11
  %96 = load i8, i8* %95, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %97 = zext i8 %96 to i64
  %98 = call i8* @nish_str_from_u64(i64 %97)
  %99 = call i8* @nish_str_concat(i8* %87, i8* %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %101 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = icmp ult i64 12, %103
  br i1 %104, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 12, i64 %103)
  unreachable

bounds.ok.4:
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %106 = load i8*, i8** %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %107 = bitcast i8* %106 to i8*
  %108 = getelementptr inbounds i8, i8* %107, i64 12
  %109 = load i8, i8* %108, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %110 = zext i8 %109 to i64
  %111 = call i8* @nish_str_from_u64(i64 %110)
  %112 = call i8* @nish_str_concat(i8* %100, i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %114 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %117 = icmp ult i64 15, %116
  br i1 %117, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 15, i64 %116)
  unreachable

bounds.ok.5:
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %120 = bitcast i8* %119 to i8*
  %121 = getelementptr inbounds i8, i8* %120, i64 15
  %122 = load i8, i8* %121, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %123 = zext i8 %122 to i64
  %124 = call i8* @nish_str_from_u64(i64 %123)
  %125 = call i8* @nish_str_concat(i8* %113, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %127 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %128 = call i32 @portAt(%struct.nish_array* %127, i32 0)
  %129 = call i8* @nish_str_from_i32(i32 %128)
  %130 = call i8* @nish_str_concat(i8* %126, i8* %129)
  call void @nish_print(i8* %130)
  %131 = load %struct.nish_array*, %struct.nish_array** %one.addr, align 8
  %132 = call i32 @nish_net_resolve(%struct.nish_array* %131, i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i32 0, i32 0)
  %133 = call i8* @nish_str_from_i32(i32 %132)
  call void @nish_print(i8* %133)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
