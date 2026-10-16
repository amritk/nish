%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [52 x i8] } { i64 51, [52 x i8] c"qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"W\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"old\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"xyz\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i8* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i8* noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$str$fn.16.nish_main$arrow3(i32 noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$i32$arr.i32$fn.16.nish_main$arrow4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelFrom$arr.bool$fn.16.nish_main$arrow5(i32 noundef) #0
declare void @nish.parallelMapInto$i32$str$fn.16.nish_main$arrow6(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.parallelMap$str$i32$fn.16.nish_main$arrow7(%struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noundef i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare i64 @llvm.smin.i64(i64, i64) #1
declare i64 @llvm.smax.i64(i64, i64) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 5000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [52 x i8] }* @.str.0 to i8*), i8* %8)
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %3
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %3 to i64
  %21 = add i64 %20, %5
  call void @nish_arena_release(i64 %21)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @shout(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  ret i8* %2
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %prefix.addr = alloca i8*, align 8
  %named.addr = alloca %struct.nish_array*, align 8
  %same.addr = alloca %struct.nish_array*, align 8
  %cut.addr = alloca %struct.nish_array*, align 8
  %loud.addr = alloca %struct.nish_array*, align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %flags.addr = alloca %struct.nish_array*, align 8
  %into.addr = alloca %struct.nish_array*, align 8
  %i.addr.1 = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %lens.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %odd.addr = alloca i32, align 4
  %s.addr.1 = alloca i8*, align 8
  %forof.idx.1 = alloca i64, align 8
  %rowSum.addr = alloca i32, align 4
  %r.addr = alloca %struct.nish_array*, align 8
  %forof.idx.2 = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 5000
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %28, i8** %prefix.addr, align 8
  %29 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %30 = load i8*, i8** %prefix.addr, align 8
  %31 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow0(%struct.nish_array* %29, i8* %30)
  store %struct.nish_array* %31, %struct.nish_array** %named.addr, align 8
  %32 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %33 = load i8*, i8** %prefix.addr, align 8
  %34 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow1(%struct.nish_array* %32, i8* %33)
  store %struct.nish_array* %34, %struct.nish_array** %same.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %36 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow2(%struct.nish_array* %35)
  store %struct.nish_array* %36, %struct.nish_array** %cut.addr, align 8
  %37 = call %struct.nish_array* @nish.parallelFrom$str$fn.16.nish_main$arrow3(i32 3000)
  store %struct.nish_array* %37, %struct.nish_array** %loud.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %39 = call %struct.nish_array* @nish.parallelMap$i32$arr.i32$fn.16.nish_main$arrow4(%struct.nish_array* %38)
  store %struct.nish_array* %39, %struct.nish_array** %rows.addr, align 8
  %40 = call %struct.nish_array* @nish.parallelFrom$arr.bool$fn.16.nish_main$arrow5(i32 10)
  store %struct.nish_array* %40, %struct.nish_array** %flags.addr, align 8
  %41 = call i8* @nish_alloc_struct(i64 24)
  %42 = bitcast i8* %41 to %struct.nish_array*
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  store i64 0, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 1
  store i64 0, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  store i8* null, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %42, %struct.nish_array** %into.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %46 = load i32, i32* %i.addr.1, align 4
  %47 = icmp slt i32 %46, 5000
  br i1 %47, label %for.body.1, label %for.end.1

for.body.1:
  %48 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = icmp eq i64 %50, %52
  br i1 %53, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %48, i64 8)
  br label %push.store.1

push.store.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i8**
  %57 = getelementptr inbounds i8*, i8** %56, i64 %50
  store i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*), i8** %57, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %58 = add i64 %50, 1
  store i64 %58, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = trunc i64 %58 to i32
  br label %for.inc.1

for.inc.1:
  %60 = load i32, i32* %i.addr.1, align 4
  %61 = add nsw i32 %60, 1
  store i32 %61, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %62 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %63 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.16.nish_main$arrow6(%struct.nish_array* %62, %struct.nish_array* %63)
  %64 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %65 = call %struct.nish_array* @nish.parallelMap$str$i32$fn.16.nish_main$arrow7(%struct.nish_array* %64)
  %66 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow8(%struct.nish_array* %65, i32 0)
  store i32 %66, i32* %total.addr, align 4
  %67 = call i32 @churn()
  store i32 %67, i32* %c.addr, align 4
  store i32 0, i32* %lens.addr, align 4
  %68 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %69 = load i64, i64* %forof.idx, align 8
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = icmp ult i64 %69, %71
  br i1 %72, label %forof.body, label %forof.end

forof.body:
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %68, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %69
  %77 = load i8*, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i8* %77, i8** %s.addr, align 8
  %78 = load i32, i32* %lens.addr, align 4
  %79 = load i8*, i8** %s.addr, align 8
  %80 = bitcast i8* %79 to i64*
  %81 = load i64, i64* %80, align 8
  %82 = trunc i64 %81 to i32
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %78, i32 %82)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %84, i32* %lens.addr, align 4
  br label %forof.inc

forof.inc:
  %86 = load i64, i64* %forof.idx, align 8
  %87 = add i64 %86, 1
  store i64 %87, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %odd.addr, align 4
  %88 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %89 = load i64, i64* %forof.idx.1, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = icmp ult i64 %89, %91
  br i1 %92, label %forof.body.1, label %forof.end.1

forof.body.1:
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %94 = load i8*, i8** %93, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %95 = bitcast i8* %94 to i8**
  %96 = getelementptr inbounds i8*, i8** %95, i64 %89
  %97 = load i8*, i8** %96, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store i8* %97, i8** %s.addr.1, align 8
  %98 = load i8*, i8** %s.addr.1, align 8
  %99 = call zeroext i1 @nish_str_eq(i8* %98, i8* bitcast ({ i64, [4 x i8] }* @.str.6 to i8*))
  br i1 %99, label %if.then, label %if.end

if.then:
  %100 = load i32, i32* %odd.addr, align 4
  %101 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %100, i32 1)
  %102 = extractvalue { i32, i1 } %101, 0
  %103 = extractvalue { i32, i1 } %101, 1
  br i1 %103, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %102, i32* %odd.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc.1

forof.inc.1:
  %104 = load i64, i64* %forof.idx.1, align 8
  %105 = add i64 %104, 1
  store i64 %105, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  store i32 0, i32* %rowSum.addr, align 4
  %106 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %107 = load i64, i64* %forof.idx.2, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = icmp ult i64 %107, %109
  br i1 %110, label %forof.body.2, label %forof.end.2

forof.body.2:
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = bitcast i8* %112 to %struct.nish_array**
  %114 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %113, i64 %107
  %115 = load %struct.nish_array*, %struct.nish_array** %114, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %115, %struct.nish_array** %r.addr, align 8
  %116 = load i32, i32* %rowSum.addr, align 4
  %117 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = icmp ult i64 0, %119
  br i1 %120, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %119)
  unreachable

bounds.ok:
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %122 = load i8*, i8** %121, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %123 = bitcast i8* %122 to i32*
  %124 = getelementptr inbounds i32, i32* %123, i64 0
  %125 = load i32, i32* %124, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %126 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %116, i32 %125)
  %127 = extractvalue { i32, i1 } %126, 0
  %128 = extractvalue { i32, i1 } %126, 1
  br i1 %128, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %129 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 0
  %131 = load i64, i64* %130, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %132 = icmp ult i64 1, %131
  br i1 %132, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %131)
  unreachable

bounds.ok.1:
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 2
  %134 = load i8*, i8** %133, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %135 = bitcast i8* %134 to i32*
  %136 = getelementptr inbounds i32, i32* %135, i64 1
  %137 = load i32, i32* %136, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %138 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %127, i32 %137)
  %139 = extractvalue { i32, i1 } %138, 0
  %140 = extractvalue { i32, i1 } %138, 1
  br i1 %140, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %141 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 0
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = icmp ult i64 2, %143
  br i1 %144, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %143)
  unreachable

bounds.ok.2:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %147 = bitcast i8* %146 to i32*
  %148 = getelementptr inbounds i32, i32* %147, i64 2
  %149 = load i32, i32* %148, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %150 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %139, i32 %149)
  %151 = extractvalue { i32, i1 } %150, 0
  %152 = extractvalue { i32, i1 } %150, 1
  br i1 %152, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %151, i32* %rowSum.addr, align 4
  br label %forof.inc.2

forof.inc.2:
  %153 = load i64, i64* %forof.idx.2, align 8
  %154 = add i64 %153, 1
  store i64 %154, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.end.2:
  %155 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 0
  %157 = load i64, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %158 = icmp ult i64 0, %157
  br i1 %158, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %157)
  unreachable

bounds.ok.3:
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %155, i64 0, i32 2
  %160 = load i8*, i8** %159, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %161 = bitcast i8* %160 to i8**
  %162 = getelementptr inbounds i8*, i8** %161, i64 0
  %163 = load i8*, i8** %162, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %164 = call i8* @nish_str_concat(i8* %163, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %165 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %165, i64 0, i32 0
  %167 = load i64, i64* %166, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %168 = icmp ult i64 4999, %167
  br i1 %168, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 4999, i64 %167)
  unreachable

bounds.ok.4:
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %165, i64 0, i32 2
  %170 = load i8*, i8** %169, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %171 = bitcast i8* %170 to i8**
  %172 = getelementptr inbounds i8*, i8** %171, i64 4999
  %173 = load i8*, i8** %172, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %174 = call i8* @nish_str_concat(i8* %164, i8* %173)
  %175 = call i8* @nish_str_concat(i8* %174, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %176 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 0
  %178 = load i64, i64* %177, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %179 = trunc i64 %178 to i32
  %180 = call i8* @nish_str_from_i32(i32 %179)
  %181 = call i8* @nish_str_concat(i8* %175, i8* %180)
  %182 = call i8* @nish_str_concat(i8* %181, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %183 = load i32, i32* %lens.addr, align 4
  %184 = call i8* @nish_str_from_i32(i32 %183)
  %185 = call i8* @nish_str_concat(i8* %182, i8* %184)
  call void @nish_print(i8* %185)
  %186 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %186, i64 0, i32 0
  %188 = load i64, i64* %187, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %189 = icmp ult i64 0, %188
  br i1 %189, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 0, i64 %188)
  unreachable

bounds.ok.5:
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %186, i64 0, i32 2
  %191 = load i8*, i8** %190, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %192 = bitcast i8* %191 to i8**
  %193 = getelementptr inbounds i8*, i8** %192, i64 0
  %194 = load i8*, i8** %193, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %195 = call i8* @nish_str_concat(i8* %194, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %196 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 0
  %198 = load i64, i64* %197, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %199 = icmp ult i64 1, %198
  br i1 %199, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 1, i64 %198)
  unreachable

bounds.ok.6:
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %202 = bitcast i8* %201 to i8**
  %203 = getelementptr inbounds i8*, i8** %202, i64 1
  %204 = load i8*, i8** %203, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %205 = call i8* @nish_str_concat(i8* %195, i8* %204)
  %206 = call i8* @nish_str_concat(i8* %205, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %207 = load i32, i32* %odd.addr, align 4
  %208 = call i8* @nish_str_from_i32(i32 %207)
  %209 = call i8* @nish_str_concat(i8* %206, i8* %208)
  call void @nish_print(i8* %209)
  %210 = load %struct.nish_array*, %struct.nish_array** %cut.addr, align 8
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %210, i64 0, i32 0
  %212 = load i64, i64* %211, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %213 = icmp ult i64 0, %212
  br i1 %213, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 0, i64 %212)
  unreachable

bounds.ok.7:
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %210, i64 0, i32 2
  %215 = load i8*, i8** %214, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %216 = bitcast i8* %215 to i8**
  %217 = getelementptr inbounds i8*, i8** %216, i64 0
  %218 = load i8*, i8** %217, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %219 = call i8* @nish_str_concat(i8* %218, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %220 = load %struct.nish_array*, %struct.nish_array** %cut.addr, align 8
  %221 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 0
  %222 = load i64, i64* %221, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %223 = icmp ult i64 42, %222
  br i1 %223, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 42, i64 %222)
  unreachable

bounds.ok.8:
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 2
  %225 = load i8*, i8** %224, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %226 = bitcast i8* %225 to i8**
  %227 = getelementptr inbounds i8*, i8** %226, i64 42
  %228 = load i8*, i8** %227, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %229 = call i8* @nish_str_concat(i8* %219, i8* %228)
  %230 = call i8* @nish_str_concat(i8* %229, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %231 = load %struct.nish_array*, %struct.nish_array** %cut.addr, align 8
  %232 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %231, i64 0, i32 0
  %233 = load i64, i64* %232, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %234 = icmp ult i64 4999, %233
  br i1 %234, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 4999, i64 %233)
  unreachable

bounds.ok.9:
  %235 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %231, i64 0, i32 2
  %236 = load i8*, i8** %235, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %237 = bitcast i8* %236 to i8**
  %238 = getelementptr inbounds i8*, i8** %237, i64 4999
  %239 = load i8*, i8** %238, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %240 = call i8* @nish_str_concat(i8* %230, i8* %239)
  call void @nish_print(i8* %240)
  %241 = load %struct.nish_array*, %struct.nish_array** %loud.addr, align 8
  %242 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 0
  %243 = load i64, i64* %242, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %244 = icmp ult i64 0, %243
  br i1 %244, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 0, i64 %243)
  unreachable

bounds.ok.10:
  %245 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 2
  %246 = load i8*, i8** %245, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %247 = bitcast i8* %246 to i8**
  %248 = getelementptr inbounds i8*, i8** %247, i64 0
  %249 = load i8*, i8** %248, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %250 = call i8* @nish_str_concat(i8* %249, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %251 = load %struct.nish_array*, %struct.nish_array** %loud.addr, align 8
  %252 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %251, i64 0, i32 0
  %253 = load i64, i64* %252, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %254 = icmp ult i64 2999, %253
  br i1 %254, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 2999, i64 %253)
  unreachable

bounds.ok.11:
  %255 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %251, i64 0, i32 2
  %256 = load i8*, i8** %255, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %257 = bitcast i8* %256 to i8**
  %258 = getelementptr inbounds i8*, i8** %257, i64 2999
  %259 = load i8*, i8** %258, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %260 = call i8* @nish_str_concat(i8* %250, i8* %259)
  %261 = call i8* @nish_str_concat(i8* %260, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %262 = load %struct.nish_array*, %struct.nish_array** %loud.addr, align 8
  %263 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %262, i64 0, i32 0
  %264 = load i64, i64* %263, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %265 = trunc i64 %264 to i32
  %266 = call i8* @nish_str_from_i32(i32 %265)
  %267 = call i8* @nish_str_concat(i8* %261, i8* %266)
  call void @nish_print(i8* %267)
  %268 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %268, i64 0, i32 0
  %270 = load i64, i64* %269, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %271 = icmp ult i64 7, %270
  br i1 %271, label %bounds.ok.12, label %bounds.fail.12

bounds.fail.12:
  call void @nish_panic_index(i64 7, i64 %270)
  unreachable

bounds.ok.12:
  %272 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %268, i64 0, i32 2
  %273 = load i8*, i8** %272, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %274 = bitcast i8* %273 to %struct.nish_array**
  %275 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %274, i64 7
  %276 = load %struct.nish_array*, %struct.nish_array** %275, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %277 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %276, i64 0, i32 0
  %278 = load i64, i64* %277, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %279 = icmp ult i64 2, %278
  br i1 %279, label %bounds.ok.13, label %bounds.fail.13

bounds.fail.13:
  call void @nish_panic_index(i64 2, i64 %278)
  unreachable

bounds.ok.13:
  %280 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %276, i64 0, i32 2
  %281 = load i8*, i8** %280, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %282 = bitcast i8* %281 to i32*
  %283 = getelementptr inbounds i32, i32* %282, i64 2
  %284 = load i32, i32* %283, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %285 = call i8* @nish_str_from_i32(i32 %284)
  %286 = call i8* @nish_str_concat(i8* %285, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %287 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %288 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %287, i64 0, i32 0
  %289 = load i64, i64* %288, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %290 = trunc i64 %289 to i32
  %291 = call i8* @nish_str_from_i32(i32 %290)
  %292 = call i8* @nish_str_concat(i8* %286, i8* %291)
  %293 = call i8* @nish_str_concat(i8* %292, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %294 = load i32, i32* %rowSum.addr, align 4
  %295 = call i8* @nish_str_from_i32(i32 %294)
  %296 = call i8* @nish_str_concat(i8* %293, i8* %295)
  call void @nish_print(i8* %296)
  %297 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %298 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %297, i64 0, i32 0
  %299 = load i64, i64* %298, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %300 = icmp ult i64 6, %299
  br i1 %300, label %bounds.ok.14, label %bounds.fail.14

bounds.fail.14:
  call void @nish_panic_index(i64 6, i64 %299)
  unreachable

bounds.ok.14:
  %301 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %297, i64 0, i32 2
  %302 = load i8*, i8** %301, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %303 = bitcast i8* %302 to %struct.nish_array**
  %304 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %303, i64 6
  %305 = load %struct.nish_array*, %struct.nish_array** %304, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %306 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %305, i64 0, i32 0
  %307 = load i64, i64* %306, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %308 = icmp ult i64 0, %307
  br i1 %308, label %bounds.ok.15, label %bounds.fail.15

bounds.fail.15:
  call void @nish_panic_index(i64 0, i64 %307)
  unreachable

bounds.ok.15:
  %309 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %305, i64 0, i32 2
  %310 = load i8*, i8** %309, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %311 = bitcast i8* %310 to i1*
  %312 = getelementptr inbounds i1, i1* %311, i64 0
  %313 = load i1, i1* %312, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %314 = select i1 %313, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %315 = call i8* @nish_str_concat(i8* %314, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %316 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %317 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %316, i64 0, i32 2
  %318 = load i8*, i8** %317, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %319 = bitcast i8* %318 to %struct.nish_array**
  %320 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %319, i64 6
  %321 = load %struct.nish_array*, %struct.nish_array** %320, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %322 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %321, i64 0, i32 0
  %323 = load i64, i64* %322, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %324 = icmp ult i64 1, %323
  br i1 %324, label %bounds.ok.16, label %bounds.fail.16

bounds.fail.16:
  call void @nish_panic_index(i64 1, i64 %323)
  unreachable

bounds.ok.16:
  %325 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %321, i64 0, i32 2
  %326 = load i8*, i8** %325, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %327 = bitcast i8* %326 to i1*
  %328 = getelementptr inbounds i1, i1* %327, i64 1
  %329 = load i1, i1* %328, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %330 = select i1 %329, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %331 = call i8* @nish_str_concat(i8* %315, i8* %330)
  %332 = call i8* @nish_str_concat(i8* %331, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %333 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %334 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %333, i64 0, i32 0
  %335 = load i64, i64* %334, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %336 = icmp ult i64 7, %335
  br i1 %336, label %bounds.ok.17, label %bounds.fail.17

bounds.fail.17:
  call void @nish_panic_index(i64 7, i64 %335)
  unreachable

bounds.ok.17:
  %337 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %333, i64 0, i32 2
  %338 = load i8*, i8** %337, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %339 = bitcast i8* %338 to %struct.nish_array**
  %340 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %339, i64 7
  %341 = load %struct.nish_array*, %struct.nish_array** %340, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %342 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %341, i64 0, i32 0
  %343 = load i64, i64* %342, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %344 = icmp ult i64 0, %343
  br i1 %344, label %bounds.ok.18, label %bounds.fail.18

bounds.fail.18:
  call void @nish_panic_index(i64 0, i64 %343)
  unreachable

bounds.ok.18:
  %345 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %341, i64 0, i32 2
  %346 = load i8*, i8** %345, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %347 = bitcast i8* %346 to i1*
  %348 = getelementptr inbounds i1, i1* %347, i64 0
  %349 = load i1, i1* %348, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %350 = select i1 %349, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %351 = call i8* @nish_str_concat(i8* %332, i8* %350)
  %352 = call i8* @nish_str_concat(i8* %351, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %353 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %354 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %353, i64 0, i32 0
  %355 = load i64, i64* %354, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %356 = trunc i64 %355 to i32
  %357 = call i8* @nish_str_from_i32(i32 %356)
  %358 = call i8* @nish_str_concat(i8* %352, i8* %357)
  call void @nish_print(i8* %358)
  %359 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %360 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %359, i64 0, i32 0
  %361 = load i64, i64* %360, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %362 = icmp ult i64 0, %361
  br i1 %362, label %bounds.ok.19, label %bounds.fail.19

bounds.fail.19:
  call void @nish_panic_index(i64 0, i64 %361)
  unreachable

bounds.ok.19:
  %363 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %359, i64 0, i32 2
  %364 = load i8*, i8** %363, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %365 = bitcast i8* %364 to i8**
  %366 = getelementptr inbounds i8*, i8** %365, i64 0
  %367 = load i8*, i8** %366, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %368 = call i8* @nish_str_concat(i8* %367, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %369 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %370 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %369, i64 0, i32 0
  %371 = load i64, i64* %370, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %372 = icmp ult i64 4999, %371
  br i1 %372, label %bounds.ok.20, label %bounds.fail.20

bounds.fail.20:
  call void @nish_panic_index(i64 4999, i64 %371)
  unreachable

bounds.ok.20:
  %373 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %369, i64 0, i32 2
  %374 = load i8*, i8** %373, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %375 = bitcast i8* %374 to i8**
  %376 = getelementptr inbounds i8*, i8** %375, i64 4999
  %377 = load i8*, i8** %376, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %378 = call i8* @nish_str_concat(i8* %368, i8* %377)
  %379 = call i8* @nish_str_concat(i8* %378, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %380 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %381 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %380, i64 0, i32 0
  %382 = load i64, i64* %381, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %383 = trunc i64 %382 to i32
  %384 = call i8* @nish_str_from_i32(i32 %383)
  %385 = call i8* @nish_str_concat(i8* %379, i8* %384)
  %386 = call i8* @nish_str_concat(i8* %385, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %387 = load i32, i32* %total.addr, align 4
  %388 = call i8* @nish_str_from_i32(i32 %387)
  %389 = call i8* @nish_str_concat(i8* %386, i8* %388)
  %390 = call i8* @nish_str_concat(i8* %389, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %391 = load i32, i32* %c.addr, align 4
  %392 = call i8* @nish_str_from_i32(i32 %391)
  %393 = call i8* @nish_str_concat(i8* %390, i8* %392)
  call void @nish_print(i8* %393)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @nish_main$arrow0(i32 noundef %x, i8* noundef nonnull noalias readonly align 8 nocapture %prefix) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 3)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i8* @nish_str_from_i32(i32 %1)
  %4 = call i8* @nish_str_concat(i8* %prefix, i8* %3)
  ret i8* %4

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 i8* @nish_main$arrow1(i32 noundef %x, i8* noundef nonnull noalias readonly align 8 %prefix) #1 {
entry:
  %0 = srem i32 %x, 2
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ %prefix, %cond.true ], [ bitcast ({ i64, [4 x i8] }* @.str.6 to i8*), %cond.false ]
  ret i8* %2
}

define hidden noundef nonnull align 8 i8* @nish_main$arrow2(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*), i8* %0)
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = call i64 @llvm.smin.i64(i64 1, i64 %3)
  %5 = call i64 @llvm.smax.i64(i64 %4, i64 0)
  %6 = call i64 @llvm.smin.i64(i64 4, i64 %3)
  %7 = call i64 @llvm.smax.i64(i64 %6, i64 0)
  %8 = call i64 @llvm.smin.i64(i64 %5, i64 %7)
  %9 = call i64 @llvm.smax.i64(i64 %5, i64 %7)
  %10 = sub i64 %9, %8
  %11 = getelementptr inbounds i8, i8* %1, i64 8
  %12 = getelementptr inbounds i8, i8* %11, i64 %8
  %13 = call i8* @nish_str_new(i8* %12, i64 %10)
  %14 = call i8* @nish_str_from_i32(i32 %x)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [4 x i8] }* @.str.11 to i8*))
  %16 = bitcast i8* %15 to i64*
  %17 = load i64, i64* %16, align 8
  %18 = icmp ule i64 0, 2
  %19 = icmp ule i64 2, %17
  %20 = and i1 %18, %19
  br i1 %20, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 0, i64 2, i64 %17)
  unreachable

slice.ok:
  %21 = sub i64 2, 0
  %22 = getelementptr inbounds i8, i8* %15, i64 8
  %23 = getelementptr inbounds i8, i8* %22, i64 0
  %24 = call i8* @nish_str_new(i8* %23, i64 %21)
  %25 = call i8* @nish_str_concat(i8* %13, i8* %24)
  ret i8* %25
}

define hidden noundef nonnull align 8 i8* @nish_main$arrow3(i32 noundef %i) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @shout(i32 %i)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish_main$arrow4(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 3)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = call i8* @nish_alloc_struct(i64 24)
  %7 = bitcast i8* %6 to %struct.nish_array*
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  store i64 3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = call i8* @nish_alloc_struct(i64 12)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 %x, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 %1, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i32, i32* %12, i64 2
  store i32 %4, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %7

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish_main$arrow5(i32 noundef %i) #2 {
entry:
  %0 = srem i32 %i, 2
  %1 = icmp eq i32 %0, 0
  %2 = srem i32 %i, 3
  %3 = icmp eq i32 %2, 0
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 2, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 2, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = call i8* @nish_alloc_struct(i64 2)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %8 to i1*
  %11 = getelementptr inbounds i1, i1* %10, i64 0
  store i1 %1, i1* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %12 = getelementptr inbounds i1, i1* %10, i64 1
  store i1 %3, i1* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  ret %struct.nish_array* %5
}

define hidden noundef nonnull align 8 i8* @nish_main$arrow6(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*), i8* %0)
  ret i8* %1
}

define hidden noundef i32 @nish_main$arrow7(i8* noundef nonnull noalias readonly align 8 nocapture %s) #3 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define hidden noundef i32 @nish_main$arrow8(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %a, i32 %b)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind willreturn memory(argmem: read) }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element i1", !6, i64 0}
!18 = !{!17, !17, i64 0}
