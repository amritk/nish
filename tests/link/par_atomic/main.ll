%struct.AtomicI32 = type { i32 }
%struct.AtomicI64 = type { i64 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"from \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"map \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"into \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"reduce \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.AtomicI32.constructor(%struct.AtomicI32* noundef nonnull noalias align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.load(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture) #1
declare void @nish.AtomicI32.store(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.add(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.sub(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.min(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.max(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.exchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @nish.AtomicI32.compareExchange(%struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture, i32 noundef, i32 noundef) #1
declare void @nish.AtomicI64.constructor(%struct.AtomicI64* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i64 noundef) #1
declare noundef i64 @nish.AtomicI64.load(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture) #1
declare void @nish.AtomicI64.store(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #1
declare noundef i64 @nish.AtomicI64.add(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #1
declare noundef i64 @nish.AtomicI64.sub(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #1
declare noundef i64 @nish.AtomicI64.min(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #1
declare noundef i64 @nish.AtomicI64.max(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #1
declare noundef i64 @nish.AtomicI64.exchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef) #1
declare noundef i64 @nish.AtomicI64.compareExchange(%struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture, i64 noundef, i64 noundef) #1
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 noundef, %struct.AtomicI32* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.AtomicI64* noundef, i64 noundef, %struct.AtomicI32* noundef) #0
declare void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.AtomicI32* noundef, %struct.AtomicI32* noundef) #0
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef, %struct.AtomicI32* noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
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

define noundef i32 @nish_main() #0 {
entry:
  %made.addr = alloca %struct.AtomicI32*, align 8
  %AtomicI32.obj = alloca %struct.AtomicI32, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %total.addr = alloca %struct.AtomicI64*, align 8
  %AtomicI64.obj = alloca %struct.AtomicI64, align 8
  %step.addr = alloca i64, align 8
  %top.addr = alloca %struct.AtomicI32*, align 8
  %AtomicI32.obj.1 = alloca %struct.AtomicI32, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %fill.at = alloca i64, align 8
  %bottom.addr = alloca %struct.AtomicI32*, align 8
  %AtomicI32.obj.2 = alloca %struct.AtomicI32, align 8
  %evens.addr = alloca %struct.AtomicI32*, align 8
  %AtomicI32.obj.3 = alloca %struct.AtomicI32, align 8
  %least.addr = alloca %struct.AtomicI32*, align 8
  %AtomicI32.obj.4 = alloca %struct.AtomicI32, align 8
  %sum.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %AtomicI32.obj, i32 0)
  store %struct.AtomicI32* %AtomicI32.obj, %struct.AtomicI32** %made.addr, align 8
  %0 = load %struct.AtomicI32*, %struct.AtomicI32** %made.addr, align 8
  %1 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 100000, %struct.AtomicI32* %0)
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %2 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %9 = load %struct.AtomicI32*, %struct.AtomicI32** %made.addr, align 8
  %10 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  call void @nish_print(i8* %12)
  call void @nish.AtomicI64.constructor(%struct.AtomicI64* %AtomicI64.obj, i64 0)
  store %struct.AtomicI64* %AtomicI64.obj, %struct.AtomicI64** %total.addr, align 8
  store i64 3000000000, i64* %step.addr, align 8
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %AtomicI32.obj.1, i32 -1)
  store %struct.AtomicI32* %AtomicI32.obj.1, %struct.AtomicI32** %top.addr, align 8
  %13 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %14 = load %struct.AtomicI64*, %struct.AtomicI64** %total.addr, align 8
  %15 = load i64, i64* %step.addr, align 8
  %16 = load %struct.AtomicI32*, %struct.AtomicI32** %top.addr, align 8
  %17 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %13, %struct.AtomicI64* %14, i64 %15, %struct.AtomicI32* %16)
  store %struct.nish_array* %17, %struct.nish_array** %ys.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = icmp ult i64 5, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 5, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 5
  %26 = load i32, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %30 = load %struct.AtomicI64*, %struct.AtomicI64** %total.addr, align 8
  %31 = call i64 @nish.AtomicI64.load(%struct.AtomicI64* %30)
  %32 = call i8* @nish_str_from_i64(i64 %31)
  %33 = call i8* @nish_str_concat(i8* %29, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %35 = load %struct.AtomicI32*, %struct.AtomicI32** %top.addr, align 8
  %36 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %35)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %34, i8* %37)
  call void @nish_print(i8* %38)
  %39 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = trunc i64 %41 to i32
  %43 = sext i32 %42 to i64
  %44 = icmp ule i64 %43, 2147483647
  br i1 %44, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.3 to i8*))
  unreachable

len.ok:
  %45 = call i8* @nish_alloc_struct(i64 24)
  %46 = bitcast i8* %45 to %struct.nish_array*
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  store i64 %43, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  store i64 %43, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %49 = mul i64 %43, 4
  %50 = call i8* @nish_alloc_struct(i64 %49)
  call void @llvm.memset.p0i8.i64(i8* align 8 %50, i8 0, i64 %49, i1 false), !alias.scope !4, !noalias !3
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  store i8* %50, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %46, %struct.nish_array** %zs.addr, align 8
  %52 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %55 = load i64, i64* %fill.at, align 8
  %56 = icmp slt i64 %55, %54
  br i1 %56, label %fill.body, label %fill.end

fill.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 %55
  store i32 0, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %61 = add i64 %55, 1
  store i64 %61, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %AtomicI32.obj.2, i32 1000000)
  store %struct.AtomicI32* %AtomicI32.obj.2, %struct.AtomicI32** %bottom.addr, align 8
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %AtomicI32.obj.3, i32 0)
  store %struct.AtomicI32* %AtomicI32.obj.3, %struct.AtomicI32** %evens.addr, align 8
  %62 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %64 = load %struct.AtomicI32*, %struct.AtomicI32** %bottom.addr, align 8
  %65 = load %struct.AtomicI32*, %struct.AtomicI32** %evens.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow2(%struct.nish_array* %62, %struct.nish_array* %63, %struct.AtomicI32* %64, %struct.AtomicI32* %65)
  %66 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = icmp ult i64 5, %68
  br i1 %69, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 5, i64 %68)
  unreachable

bounds.ok.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = bitcast i8* %71 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 5
  %74 = load i32, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*), i8* %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %78 = load %struct.AtomicI32*, %struct.AtomicI32** %bottom.addr, align 8
  %79 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %78)
  %80 = call i8* @nish_str_from_i32(i32 %79)
  %81 = call i8* @nish_str_concat(i8* %77, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %83 = load %struct.AtomicI32*, %struct.AtomicI32** %evens.addr, align 8
  %84 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %83)
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %82, i8* %85)
  call void @nish_print(i8* %86)
  call void @nish.AtomicI32.constructor(%struct.AtomicI32* %AtomicI32.obj.4, i32 1000000)
  store %struct.AtomicI32* %AtomicI32.obj.4, %struct.AtomicI32** %least.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %88 = load %struct.AtomicI32*, %struct.AtomicI32** %least.addr, align 8
  %89 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow3(%struct.nish_array* %87, i32 0, %struct.AtomicI32* %88)
  store i32 %89, i32* %sum.addr, align 4
  %90 = load i32, i32* %sum.addr, align 4
  %91 = call i8* @nish_str_from_i32(i32 %90)
  %92 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*), i8* %91)
  %93 = call i8* @nish_str_concat(i8* %92, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %94 = load %struct.AtomicI32*, %struct.AtomicI32** %least.addr, align 8
  %95 = call i32 @nish.AtomicI32.load(%struct.AtomicI32* %94)
  %96 = call i8* @nish_str_from_i32(i32 %95)
  %97 = call i8* @nish_str_concat(i8* %93, i8* %96)
  call void @nish_print(i8* %97)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %i, %struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %made) #0 {
entry:
  %0 = call i32 @nish.AtomicI32.add(%struct.AtomicI32* %made, i32 1)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 7919)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = srem i32 %2, 1009
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %x, %struct.AtomicI64* noundef nonnull align 8 dereferenceable(8) nocapture %total, i64 noundef %step, %struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %top) #0 {
entry:
  %0 = call i64 @nish.AtomicI64.add(%struct.AtomicI64* %total, i64 %step)
  %1 = call i32 @nish.AtomicI32.max(%struct.AtomicI32* %top, i32 %x)
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow2(i32 noundef %x, %struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %bottom, %struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %evens) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i32 @nish.AtomicI32.min(%struct.AtomicI32* %bottom, i32 %1)
  %4 = srem i32 %x, 2
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then, label %if.else

if.then:
  %6 = call i32 @nish.AtomicI32.add(%struct.AtomicI32* %evens, i32 1)
  br label %if.end

if.else:
  %7 = call i32 @nish.AtomicI32.sub(%struct.AtomicI32* %evens, i32 0)
  br label %if.end

if.end:
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @nish_main$arrow3(i32 noundef %a, i32 noundef %b, %struct.AtomicI32* noundef nonnull align 8 dereferenceable(4) nocapture %least) #0 {
entry:
  %0 = call i32 @nish.AtomicI32.min(%struct.AtomicI32* %least, i32 %b)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
