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
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 5000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [52 x i8] }* @.str.0 to i8*), i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %9 = load i8*, i8** %s.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = load i32, i32* %t.addr, align 4
  %22 = load i8*, i8** %s.addr, align 8
  %23 = bitcast i8* %22 to i64*
  %24 = load i64, i64* %23, align 8
  %25 = trunc i64 %24 to i32
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %27, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load i32, i32* %t.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %39 = sub nsw i32 %37, 5000
  ret i32 %39

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
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %prefix.addr = alloca i8*, align 8
  %named.addr = alloca %struct.nish_array*, align 8
  %same.addr = alloca %struct.nish_array*, align 8
  %cut.addr = alloca %struct.nish_array*, align 8
  %loud.addr = alloca %struct.nish_array*, align 8
  %rows.addr = alloca %struct.nish_array*, align 8
  %flags.addr = alloca %struct.nish_array*, align 8
  %into.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
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
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 5000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 4)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  store i32 %6, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  store i8* %26, i8** %prefix.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %28 = load i8*, i8** %prefix.addr, align 8
  %29 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow0(%struct.nish_array* %27, i8* %28)
  store %struct.nish_array* %29, %struct.nish_array** %named.addr, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = load i8*, i8** %prefix.addr, align 8
  %32 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow1(%struct.nish_array* %30, i8* %31)
  store %struct.nish_array* %32, %struct.nish_array** %same.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %34 = call %struct.nish_array* @nish.parallelMap$i32$str$fn.16.nish_main$arrow2(%struct.nish_array* %33)
  store %struct.nish_array* %34, %struct.nish_array** %cut.addr, align 8
  %35 = call %struct.nish_array* @nish.parallelFrom$str$fn.16.nish_main$arrow3(i32 3000)
  store %struct.nish_array* %35, %struct.nish_array** %loud.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %37 = call %struct.nish_array* @nish.parallelMap$i32$arr.i32$fn.16.nish_main$arrow4(%struct.nish_array* %36)
  store %struct.nish_array* %37, %struct.nish_array** %rows.addr, align 8
  %38 = call %struct.nish_array* @nish.parallelFrom$arr.bool$fn.16.nish_main$arrow5(i32 10)
  store %struct.nish_array* %38, %struct.nish_array** %flags.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %into.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %42 = load i32, i32* %i.addr.1, align 4
  %43 = icmp slt i32 %42, 5000
  br i1 %43, label %for.body.1, label %for.end.1

for.body.1:
  %44 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = icmp eq i64 %46, %48
  br i1 %49, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %44, i64 8)
  br label %push.store.1

push.store.1:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to i8**
  %53 = getelementptr inbounds i8*, i8** %52, i64 %46
  store i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*), i8** %53, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = add i64 %46, 1
  store i64 %54, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  br label %for.inc.1

for.inc.1:
  %56 = load i32, i32* %i.addr.1, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %58 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  call void @nish.parallelMapInto$i32$str$fn.16.nish_main$arrow6(%struct.nish_array* %58, %struct.nish_array* %59)
  %60 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %61 = call %struct.nish_array* @nish.parallelMap$str$i32$fn.16.nish_main$arrow7(%struct.nish_array* %60)
  %62 = call i32 @nish.parallelReduce$i32$fn.16.nish_main$arrow8(%struct.nish_array* %61, i32 0)
  store i32 %62, i32* %total.addr, align 4
  %63 = call i32 @churn()
  store i32 %63, i32* %c.addr, align 4
  store i32 0, i32* %lens.addr, align 4
  %64 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %65 = load i64, i64* %forof.idx, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = icmp ult i64 %65, %67
  br i1 %68, label %forof.body, label %forof.end

forof.body:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %71 = bitcast i8* %70 to i8**
  %72 = getelementptr inbounds i8*, i8** %71, i64 %65
  %73 = load i8*, i8** %72, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %73, i8** %s.addr, align 8
  %74 = load i32, i32* %lens.addr, align 4
  %75 = load i8*, i8** %s.addr, align 8
  %76 = bitcast i8* %75 to i64*
  %77 = load i64, i64* %76, align 8
  %78 = trunc i64 %77 to i32
  %79 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 %78)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %80, i32* %lens.addr, align 4
  br label %forof.inc

forof.inc:
  %82 = load i64, i64* %forof.idx, align 8
  %83 = add i64 %82, 1
  store i64 %83, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  store i32 0, i32* %odd.addr, align 4
  %84 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %85 = load i64, i64* %forof.idx.1, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = icmp ult i64 %85, %87
  br i1 %88, label %forof.body.1, label %forof.end.1

forof.body.1:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i8**
  %92 = getelementptr inbounds i8*, i8** %91, i64 %85
  %93 = load i8*, i8** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %93, i8** %s.addr.1, align 8
  %94 = load i8*, i8** %s.addr.1, align 8
  %95 = call zeroext i1 @nish_str_eq(i8* %94, i8* bitcast ({ i64, [4 x i8] }* @.str.6 to i8*))
  br i1 %95, label %if.then, label %if.end

if.then:
  %96 = load i32, i32* %odd.addr, align 4
  %97 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %96, i32 1)
  %98 = extractvalue { i32, i1 } %97, 0
  %99 = extractvalue { i32, i1 } %97, 1
  br i1 %99, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %98, i32* %odd.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc.1

forof.inc.1:
  %100 = load i64, i64* %forof.idx.1, align 8
  %101 = add i64 %100, 1
  store i64 %101, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  store i32 0, i32* %rowSum.addr, align 4
  %102 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %103 = load i64, i64* %forof.idx.2, align 8
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  %105 = load i64, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %106 = icmp ult i64 %103, %105
  br i1 %106, label %forof.body.2, label %forof.end.2

forof.body.2:
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  %108 = load i8*, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %109 = bitcast i8* %108 to %struct.nish_array**
  %110 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %109, i64 %103
  %111 = load %struct.nish_array*, %struct.nish_array** %110, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %111, %struct.nish_array** %r.addr, align 8
  %112 = load i32, i32* %rowSum.addr, align 4
  %113 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 0
  %115 = load i64, i64* %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %116 = icmp ult i64 0, %115
  br i1 %116, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %115)
  unreachable

bounds.ok:
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %113, i64 0, i32 2
  %118 = load i8*, i8** %117, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %119 = bitcast i8* %118 to i32*
  %120 = getelementptr inbounds i32, i32* %119, i64 0
  %121 = load i32, i32* %120, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %122 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %112, i32 %121)
  %123 = extractvalue { i32, i1 } %122, 0
  %124 = extractvalue { i32, i1 } %122, 1
  br i1 %124, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %125 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 0
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %128 = icmp ult i64 1, %127
  br i1 %128, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %127)
  unreachable

bounds.ok.1:
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %131 = bitcast i8* %130 to i32*
  %132 = getelementptr inbounds i32, i32* %131, i64 1
  %133 = load i32, i32* %132, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %134 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %123, i32 %133)
  %135 = extractvalue { i32, i1 } %134, 0
  %136 = extractvalue { i32, i1 } %134, 1
  br i1 %136, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %137 = load %struct.nish_array*, %struct.nish_array** %r.addr, align 8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 0
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %140 = icmp ult i64 2, %139
  br i1 %140, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %139)
  unreachable

bounds.ok.2:
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %137, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %143 = bitcast i8* %142 to i32*
  %144 = getelementptr inbounds i32, i32* %143, i64 2
  %145 = load i32, i32* %144, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %146 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %135, i32 %145)
  %147 = extractvalue { i32, i1 } %146, 0
  %148 = extractvalue { i32, i1 } %146, 1
  br i1 %148, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %147, i32* %rowSum.addr, align 4
  br label %forof.inc.2

forof.inc.2:
  %149 = load i64, i64* %forof.idx.2, align 8
  %150 = add i64 %149, 1
  store i64 %150, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.end.2:
  %151 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 0
  %153 = load i64, i64* %152, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %154 = icmp ult i64 0, %153
  br i1 %154, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %153)
  unreachable

bounds.ok.3:
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %157 = bitcast i8* %156 to i8**
  %158 = getelementptr inbounds i8*, i8** %157, i64 0
  %159 = load i8*, i8** %158, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %160 = call i8* @nish_str_concat(i8* %159, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %161 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 0
  %163 = load i64, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %164 = icmp ult i64 4999, %163
  br i1 %164, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 4999, i64 %163)
  unreachable

bounds.ok.4:
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 2
  %166 = load i8*, i8** %165, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %167 = bitcast i8* %166 to i8**
  %168 = getelementptr inbounds i8*, i8** %167, i64 4999
  %169 = load i8*, i8** %168, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %170 = call i8* @nish_str_concat(i8* %160, i8* %169)
  %171 = call i8* @nish_str_concat(i8* %170, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %172 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = trunc i64 %174 to i32
  %176 = call i8* @nish_str_from_i32(i32 %175)
  %177 = call i8* @nish_str_concat(i8* %171, i8* %176)
  %178 = call i8* @nish_str_concat(i8* %177, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %179 = load i32, i32* %lens.addr, align 4
  %180 = call i8* @nish_str_from_i32(i32 %179)
  %181 = call i8* @nish_str_concat(i8* %178, i8* %180)
  call void @nish_print(i8* %181)
  %182 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 0
  %184 = load i64, i64* %183, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %185 = icmp ult i64 0, %184
  br i1 %185, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 0, i64 %184)
  unreachable

bounds.ok.5:
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 2
  %187 = load i8*, i8** %186, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %188 = bitcast i8* %187 to i8**
  %189 = getelementptr inbounds i8*, i8** %188, i64 0
  %190 = load i8*, i8** %189, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %191 = call i8* @nish_str_concat(i8* %190, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %192 = load %struct.nish_array*, %struct.nish_array** %same.addr, align 8
  %193 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %192, i64 0, i32 0
  %194 = load i64, i64* %193, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %195 = icmp ult i64 1, %194
  br i1 %195, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 1, i64 %194)
  unreachable

bounds.ok.6:
  %196 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %192, i64 0, i32 2
  %197 = load i8*, i8** %196, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %198 = bitcast i8* %197 to i8**
  %199 = getelementptr inbounds i8*, i8** %198, i64 1
  %200 = load i8*, i8** %199, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %201 = call i8* @nish_str_concat(i8* %191, i8* %200)
  %202 = call i8* @nish_str_concat(i8* %201, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %203 = load i32, i32* %odd.addr, align 4
  %204 = call i8* @nish_str_from_i32(i32 %203)
  %205 = call i8* @nish_str_concat(i8* %202, i8* %204)
  call void @nish_print(i8* %205)
  %206 = load %struct.nish_array*, %struct.nish_array** %cut.addr, align 8
  %207 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %206, i64 0, i32 0
  %208 = load i64, i64* %207, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %209 = icmp ult i64 0, %208
  br i1 %209, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 0, i64 %208)
  unreachable

bounds.ok.7:
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %206, i64 0, i32 2
  %211 = load i8*, i8** %210, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %212 = bitcast i8* %211 to i8**
  %213 = getelementptr inbounds i8*, i8** %212, i64 0
  %214 = load i8*, i8** %213, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %215 = call i8* @nish_str_concat(i8* %214, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %216 = load %struct.nish_array*, %struct.nish_array** %cut.addr, align 8
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = icmp ult i64 42, %218
  br i1 %219, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 42, i64 %218)
  unreachable

bounds.ok.8:
  %220 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 2
  %221 = load i8*, i8** %220, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %222 = bitcast i8* %221 to i8**
  %223 = getelementptr inbounds i8*, i8** %222, i64 42
  %224 = load i8*, i8** %223, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %225 = call i8* @nish_str_concat(i8* %215, i8* %224)
  %226 = call i8* @nish_str_concat(i8* %225, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %227 = load %struct.nish_array*, %struct.nish_array** %cut.addr, align 8
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %227, i64 0, i32 0
  %229 = load i64, i64* %228, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %230 = icmp ult i64 4999, %229
  br i1 %230, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 4999, i64 %229)
  unreachable

bounds.ok.9:
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %227, i64 0, i32 2
  %232 = load i8*, i8** %231, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %233 = bitcast i8* %232 to i8**
  %234 = getelementptr inbounds i8*, i8** %233, i64 4999
  %235 = load i8*, i8** %234, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %236 = call i8* @nish_str_concat(i8* %226, i8* %235)
  call void @nish_print(i8* %236)
  %237 = load %struct.nish_array*, %struct.nish_array** %loud.addr, align 8
  %238 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %237, i64 0, i32 0
  %239 = load i64, i64* %238, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %240 = icmp ult i64 0, %239
  br i1 %240, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 0, i64 %239)
  unreachable

bounds.ok.10:
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %237, i64 0, i32 2
  %242 = load i8*, i8** %241, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %243 = bitcast i8* %242 to i8**
  %244 = getelementptr inbounds i8*, i8** %243, i64 0
  %245 = load i8*, i8** %244, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %246 = call i8* @nish_str_concat(i8* %245, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %247 = load %struct.nish_array*, %struct.nish_array** %loud.addr, align 8
  %248 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 0
  %249 = load i64, i64* %248, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %250 = icmp ult i64 2999, %249
  br i1 %250, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 2999, i64 %249)
  unreachable

bounds.ok.11:
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 2
  %252 = load i8*, i8** %251, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %253 = bitcast i8* %252 to i8**
  %254 = getelementptr inbounds i8*, i8** %253, i64 2999
  %255 = load i8*, i8** %254, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %256 = call i8* @nish_str_concat(i8* %246, i8* %255)
  %257 = call i8* @nish_str_concat(i8* %256, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %258 = load %struct.nish_array*, %struct.nish_array** %loud.addr, align 8
  %259 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %258, i64 0, i32 0
  %260 = load i64, i64* %259, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %261 = trunc i64 %260 to i32
  %262 = call i8* @nish_str_from_i32(i32 %261)
  %263 = call i8* @nish_str_concat(i8* %257, i8* %262)
  call void @nish_print(i8* %263)
  %264 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %264, i64 0, i32 0
  %266 = load i64, i64* %265, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %267 = icmp ult i64 7, %266
  br i1 %267, label %bounds.ok.12, label %bounds.fail.12

bounds.fail.12:
  call void @nish_panic_index(i64 7, i64 %266)
  unreachable

bounds.ok.12:
  %268 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %264, i64 0, i32 2
  %269 = load i8*, i8** %268, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %270 = bitcast i8* %269 to %struct.nish_array**
  %271 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %270, i64 7
  %272 = load %struct.nish_array*, %struct.nish_array** %271, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %273 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %272, i64 0, i32 0
  %274 = load i64, i64* %273, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %275 = icmp ult i64 2, %274
  br i1 %275, label %bounds.ok.13, label %bounds.fail.13

bounds.fail.13:
  call void @nish_panic_index(i64 2, i64 %274)
  unreachable

bounds.ok.13:
  %276 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %272, i64 0, i32 2
  %277 = load i8*, i8** %276, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %278 = bitcast i8* %277 to i32*
  %279 = getelementptr inbounds i32, i32* %278, i64 2
  %280 = load i32, i32* %279, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %281 = call i8* @nish_str_from_i32(i32 %280)
  %282 = call i8* @nish_str_concat(i8* %281, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %283 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %283, i64 0, i32 0
  %285 = load i64, i64* %284, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %286 = trunc i64 %285 to i32
  %287 = call i8* @nish_str_from_i32(i32 %286)
  %288 = call i8* @nish_str_concat(i8* %282, i8* %287)
  %289 = call i8* @nish_str_concat(i8* %288, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %290 = load i32, i32* %rowSum.addr, align 4
  %291 = call i8* @nish_str_from_i32(i32 %290)
  %292 = call i8* @nish_str_concat(i8* %289, i8* %291)
  call void @nish_print(i8* %292)
  %293 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %294 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 0
  %295 = load i64, i64* %294, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %296 = icmp ult i64 6, %295
  br i1 %296, label %bounds.ok.14, label %bounds.fail.14

bounds.fail.14:
  call void @nish_panic_index(i64 6, i64 %295)
  unreachable

bounds.ok.14:
  %297 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 2
  %298 = load i8*, i8** %297, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %299 = bitcast i8* %298 to %struct.nish_array**
  %300 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %299, i64 6
  %301 = load %struct.nish_array*, %struct.nish_array** %300, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %302 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %301, i64 0, i32 0
  %303 = load i64, i64* %302, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %304 = icmp ult i64 0, %303
  br i1 %304, label %bounds.ok.15, label %bounds.fail.15

bounds.fail.15:
  call void @nish_panic_index(i64 0, i64 %303)
  unreachable

bounds.ok.15:
  %305 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %301, i64 0, i32 2
  %306 = load i8*, i8** %305, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %307 = bitcast i8* %306 to i1*
  %308 = getelementptr inbounds i1, i1* %307, i64 0
  %309 = load i1, i1* %308, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %310 = select i1 %309, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %311 = call i8* @nish_str_concat(i8* %310, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %312 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %313 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %312, i64 0, i32 2
  %314 = load i8*, i8** %313, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %315 = bitcast i8* %314 to %struct.nish_array**
  %316 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %315, i64 6
  %317 = load %struct.nish_array*, %struct.nish_array** %316, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %318 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %317, i64 0, i32 0
  %319 = load i64, i64* %318, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %320 = icmp ult i64 1, %319
  br i1 %320, label %bounds.ok.16, label %bounds.fail.16

bounds.fail.16:
  call void @nish_panic_index(i64 1, i64 %319)
  unreachable

bounds.ok.16:
  %321 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %317, i64 0, i32 2
  %322 = load i8*, i8** %321, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %323 = bitcast i8* %322 to i1*
  %324 = getelementptr inbounds i1, i1* %323, i64 1
  %325 = load i1, i1* %324, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %326 = select i1 %325, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %327 = call i8* @nish_str_concat(i8* %311, i8* %326)
  %328 = call i8* @nish_str_concat(i8* %327, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %329 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %330 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %329, i64 0, i32 0
  %331 = load i64, i64* %330, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %332 = icmp ult i64 7, %331
  br i1 %332, label %bounds.ok.17, label %bounds.fail.17

bounds.fail.17:
  call void @nish_panic_index(i64 7, i64 %331)
  unreachable

bounds.ok.17:
  %333 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %329, i64 0, i32 2
  %334 = load i8*, i8** %333, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %335 = bitcast i8* %334 to %struct.nish_array**
  %336 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %335, i64 7
  %337 = load %struct.nish_array*, %struct.nish_array** %336, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %338 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %337, i64 0, i32 0
  %339 = load i64, i64* %338, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %340 = icmp ult i64 0, %339
  br i1 %340, label %bounds.ok.18, label %bounds.fail.18

bounds.fail.18:
  call void @nish_panic_index(i64 0, i64 %339)
  unreachable

bounds.ok.18:
  %341 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %337, i64 0, i32 2
  %342 = load i8*, i8** %341, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %343 = bitcast i8* %342 to i1*
  %344 = getelementptr inbounds i1, i1* %343, i64 0
  %345 = load i1, i1* %344, align 1, !alias.scope !4, !noalias !3, !tbaa !18
  %346 = select i1 %345, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %347 = call i8* @nish_str_concat(i8* %328, i8* %346)
  %348 = call i8* @nish_str_concat(i8* %347, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %349 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %350 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %349, i64 0, i32 0
  %351 = load i64, i64* %350, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %352 = trunc i64 %351 to i32
  %353 = call i8* @nish_str_from_i32(i32 %352)
  %354 = call i8* @nish_str_concat(i8* %348, i8* %353)
  call void @nish_print(i8* %354)
  %355 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %356 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %355, i64 0, i32 0
  %357 = load i64, i64* %356, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %358 = icmp ult i64 0, %357
  br i1 %358, label %bounds.ok.19, label %bounds.fail.19

bounds.fail.19:
  call void @nish_panic_index(i64 0, i64 %357)
  unreachable

bounds.ok.19:
  %359 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %355, i64 0, i32 2
  %360 = load i8*, i8** %359, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %361 = bitcast i8* %360 to i8**
  %362 = getelementptr inbounds i8*, i8** %361, i64 0
  %363 = load i8*, i8** %362, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %364 = call i8* @nish_str_concat(i8* %363, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %365 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %366 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %365, i64 0, i32 0
  %367 = load i64, i64* %366, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %368 = icmp ult i64 4999, %367
  br i1 %368, label %bounds.ok.20, label %bounds.fail.20

bounds.fail.20:
  call void @nish_panic_index(i64 4999, i64 %367)
  unreachable

bounds.ok.20:
  %369 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %365, i64 0, i32 2
  %370 = load i8*, i8** %369, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %371 = bitcast i8* %370 to i8**
  %372 = getelementptr inbounds i8*, i8** %371, i64 4999
  %373 = load i8*, i8** %372, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %374 = call i8* @nish_str_concat(i8* %364, i8* %373)
  %375 = call i8* @nish_str_concat(i8* %374, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %376 = load %struct.nish_array*, %struct.nish_array** %into.addr, align 8
  %377 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %376, i64 0, i32 0
  %378 = load i64, i64* %377, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %379 = trunc i64 %378 to i32
  %380 = call i8* @nish_str_from_i32(i32 %379)
  %381 = call i8* @nish_str_concat(i8* %375, i8* %380)
  %382 = call i8* @nish_str_concat(i8* %381, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %383 = load i32, i32* %total.addr, align 4
  %384 = call i8* @nish_str_from_i32(i32 %383)
  %385 = call i8* @nish_str_concat(i8* %382, i8* %384)
  %386 = call i8* @nish_str_concat(i8* %385, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %387 = load i32, i32* %c.addr, align 4
  %388 = call i8* @nish_str_from_i32(i32 %387)
  %389 = call i8* @nish_str_concat(i8* %386, i8* %388)
  call void @nish_print(i8* %389)
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
  store i32 %x, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 %1, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %15 = getelementptr inbounds i32, i32* %12, i64 2
  store i32 %4, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !16
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

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!17 = !{!"element i1", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{i32 8, !"cf-protection-branch", i32 1}
!20 = !{i32 8, !"cf-protection-return", i32 1}
!21 = !{i32 8, !"branch-target-enforcement", i32 1}
!22 = !{i32 8, !"sign-return-address", i32 1}
!23 = !{i32 4, !"probe-stack", !"inline-asm"}
