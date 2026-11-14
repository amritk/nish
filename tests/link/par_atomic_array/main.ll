%struct.AtomicI32Array = type { i32, %struct.nish_array* }
%struct.AtomicI64Array = type { i32, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"into\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" = \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"map \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.AtomicI32Array.constructor(%struct.AtomicI32Array* noundef nonnull noalias align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare void @nish.AtomicI32Array.store(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.add(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.sub(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.min(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.max(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.exchange(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.AtomicI32Array.compareExchange(%struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.AtomicI64Array.constructor(%struct.AtomicI64Array* noundef nonnull noalias align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare noundef i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef) #0
declare void @nish.AtomicI64Array.store(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.add(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.sub(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.min(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.max(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.exchange(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef) #0
declare noundef i64 @nish.AtomicI64Array.compareExchange(%struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture, i32 noundef, i64 noundef, i64 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 noundef) #0
declare void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.AtomicI32Array* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.AtomicI64Array* noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
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
  %xs.addr = alloca %struct.nish_array*, align 8
  %bins.addr = alloca %struct.AtomicI32Array*, align 8
  %AtomicI32Array.obj = alloca %struct.AtomicI32Array, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %fill.at = alloca i64, align 8
  %line.addr = alloca i8*, align 8
  %total.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %squares.addr = alloca %struct.AtomicI64Array*, align 8
  %AtomicI64Array.obj = alloca %struct.AtomicI64Array, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @nish.parallelFrom$i32$fn.16.nish_main$arrow0(i32 100000)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  call void @nish.AtomicI32Array.constructor(%struct.AtomicI32Array* %AtomicI32Array.obj, i32 16)
  store %struct.AtomicI32Array* %AtomicI32Array.obj, %struct.AtomicI32Array** %bins.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = sext i32 %4 to i64
  %6 = icmp ule i64 %5, 2147483647
  br i1 %6, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 %5, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 %5, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = mul i64 %5, 4
  %12 = call i8* @nish_alloc_struct(i64 %11)
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 %11, i1 false), !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %8, %struct.nish_array** %zs.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %17 = load i64, i64* %fill.at, align 8
  %18 = icmp slt i64 %17, %16
  br i1 %18, label %fill.body, label %fill.end

fill.body:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %17
  store i32 0, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = add i64 %17, 1
  store i64 %23, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %26 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %bins.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow1(%struct.nish_array* %24, %struct.nish_array* %25, %struct.AtomicI32Array* %26)
  store i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8** %line.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %b.addr, align 4
  br label %for.cond

for.cond:
  %27 = load i32, i32* %b.addr, align 4
  %28 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %bins.addr, align 8
  %29 = getelementptr inbounds %struct.AtomicI32Array, %struct.AtomicI32Array* %28, i32 0, i32 0
  %30 = load i32, i32* %29, align 4, !tbaa !18
  %31 = icmp slt i32 %27, %30
  br i1 %31, label %for.body, label %for.end

for.body:
  %32 = load i8*, i8** %line.addr, align 8
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %34 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %bins.addr, align 8
  %35 = load i32, i32* %b.addr, align 4
  %36 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %34, i32 %35)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %33, i8* %37)
  store i8* %38, i8** %line.addr, align 8
  %39 = load i32, i32* %total.addr, align 4
  %40 = load %struct.AtomicI32Array*, %struct.AtomicI32Array** %bins.addr, align 8
  %41 = load i32, i32* %b.addr, align 4
  %42 = call i32 @nish.AtomicI32Array.load(%struct.AtomicI32Array* %40, i32 %41)
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 %42)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %44, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %46 = load i32, i32* %b.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %b.addr, align 4
  br label %for.cond

for.end:
  %48 = load i8*, i8** %line.addr, align 8
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*))
  %50 = load i32, i32* %total.addr, align 4
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* %49, i8* %51)
  %53 = call i8* @nish_str_concat(i8* %52, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %54 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = icmp ult i64 5, %56
  br i1 %57, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 5, i64 %56)
  unreachable

bounds.ok:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 5
  %62 = load i32, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %53, i8* %63)
  call void @nish_print(i8* %64)
  call void @nish.AtomicI64Array.constructor(%struct.AtomicI64Array* %AtomicI64Array.obj, i32 4)
  store %struct.AtomicI64Array* %AtomicI64Array.obj, %struct.AtomicI64Array** %squares.addr, align 8
  %65 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %66 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %squares.addr, align 8
  %67 = call %struct.nish_array* @nish.parallelMap$i32$i32$fn.16.nish_main$arrow2(%struct.nish_array* %65, %struct.AtomicI64Array* %66)
  store %struct.nish_array* %67, %struct.nish_array** %ys.addr, align 8
  %68 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %squares.addr, align 8
  %69 = call i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* %68, i32 0)
  %70 = call i8* @nish_str_from_i64(i64 %69)
  %71 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* %70)
  %72 = call i8* @nish_str_concat(i8* %71, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %73 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %squares.addr, align 8
  %74 = call i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* %73, i32 1)
  %75 = call i8* @nish_str_from_i64(i64 %74)
  %76 = call i8* @nish_str_concat(i8* %72, i8* %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %78 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %squares.addr, align 8
  %79 = call i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* %78, i32 2)
  %80 = call i8* @nish_str_from_i64(i64 %79)
  %81 = call i8* @nish_str_concat(i8* %77, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %83 = load %struct.AtomicI64Array*, %struct.AtomicI64Array** %squares.addr, align 8
  %84 = call i64 @nish.AtomicI64Array.load(%struct.AtomicI64Array* %83, i32 3)
  %85 = call i8* @nish_str_from_i64(i64 %84)
  %86 = call i8* @nish_str_concat(i8* %82, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %88 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = icmp ult i64 5, %90
  br i1 %91, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 5, i64 %90)
  unreachable

bounds.ok.1:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %94 = bitcast i8* %93 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 5
  %96 = load i32, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* %87, i8* %97)
  call void @nish_print(i8* %98)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @nish_main$arrow0(i32 noundef %i) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %i, i32 7919)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = srem i32 %1, 1009
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef i32 @nish_main$arrow1(i32 noundef %x, %struct.AtomicI32Array* noundef nonnull align 8 dereferenceable(16) nocapture %bins) #0 {
entry:
  %0 = srem i32 %x, 16
  %1 = call i32 @nish.AtomicI32Array.add(%struct.AtomicI32Array* %bins, i32 %0, i32 1)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @nish_main$arrow2(i32 noundef %x, %struct.AtomicI64Array* noundef nonnull align 8 dereferenceable(16) nocapture %squares) #0 {
entry:
  %block.addr = alloca i64, align 8
  store i64 3000000000, i64* %block.addr, align 8
  %0 = srem i32 %x, 4
  %1 = load i64, i64* %block.addr, align 8
  %2 = call i64 @nish.AtomicI64Array.add(%struct.AtomicI64Array* %squares, i32 %0, i64 %1)
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"AtomicI32Array", !15, i64 0, !16, i64 8}
!18 = !{!17, !15, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
