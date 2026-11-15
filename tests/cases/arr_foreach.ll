%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"v \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"push \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"store \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"pop \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define hidden void @show$(i32 noundef %x) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @twice(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @total(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %sum.addr, align 4
  %10 = load i32, i32* %x.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %12, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %sum.addr, align 4
  ret i32 %16

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %ro.addr = alloca %struct.nish_array*, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @nish.forEach$i32$fn.16.nish_main$arrow0(%struct.nish_array* %8)
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @nish.forEachIndexed$i32$fn.16.nish_main$arrow1(%struct.nish_array* %9)
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @nish.forEach$i32$fn.4.show(%struct.nish_array* %10)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  call void @nish.forEach$i32$fn.16.nish_main$arrow2(%struct.nish_array* %14, %struct.nish_array* %15)
  %16 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %22 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %23 = call i32 @total(%struct.nish_array* %22)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %21, i8* %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store %struct.nish_array* %26, %struct.nish_array** %ro.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %ro.addr, align 8
  call void @nish.forEach$i32$fn.16.nish_main$arrow3(%struct.nish_array* %27)
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @nish.forEach$i32$fn.16.nish_main$arrow4(%struct.nish_array* %28, %struct.nish_array* %29)
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @nish.forEachIndexed$i32$fn.16.nish_main$arrow5(%struct.nish_array* %35, %struct.nish_array* %36)
  %37 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @nish.forEach$i32$fn.16.nish_main$arrow6(%struct.nish_array* %37, %struct.nish_array* %38)
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %empty.addr, align 8
  %42 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  call void @nish.forEach$i32$fn.4.show(%struct.nish_array* %42)
  %43 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = trunc i64 %45 to i32
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define hidden void @nish_main$arrow0(i32 noundef %x) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %x)
  call void @nish_print(i8* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define hidden void @nish_main$arrow1(i32 noundef %x, i32 noundef %i) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %2 = call i8* @nish_str_from_i32(i32 %x)
  %3 = call i8* @nish_str_concat(i8* %1, i8* %2)
  call void @nish_print(i8* %3)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define hidden void @nish_main$arrow2(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ys) #0 {
entry:
  %0 = call i32 @twice(i32 %x)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 1
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %5 = icmp eq i64 %2, %4
  br i1 %5, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %ys, i64 4)
  br label %push.store

push.store:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  store i32 %0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = add i64 %2, 1
  store i64 %10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  ret void
}

define hidden void @nish_main$arrow3(i32 noundef %x) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 100)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %3)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden void @nish_main$arrow4(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %0 = icmp eq i32 %x, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %5 = icmp eq i64 %2, %4
  br i1 %5, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 4)
  br label %push.store

push.store:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  store i32 9, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = add i64 %2, 1
  store i64 %10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  br label %if.end

if.end:
  %12 = call i8* @nish_str_from_i32(i32 %x)
  %13 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* %12)
  call void @nish_print(i8* %13)
  ret void
}

define hidden void @nish_main$arrow5(i32 noundef %x, i32 noundef %i, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %1, %5
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = add nsw i32 %i, 1
  %8 = sext i32 %7 to i64
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 10)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 %8, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %8, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %8
  store i32 %10, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.end:
  %19 = call i8* @nish_str_from_i32(i32 %x)
  %20 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*), i8* %19)
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 2, %if.then ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden void @nish_main$arrow6(i32 noundef %x, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq i32 %x, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp eq i64 %2, 0
  br i1 %3, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %4 = sub i64 %2, 1
  store i64 %4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %4
  %9 = load i32, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp eq i64 %11, 0
  br i1 %12, label %pop.empty.1, label %pop.ok.1

pop.empty.1:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.1:
  %13 = sub i64 %11, 1
  store i64 %13, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %if.end

if.end:
  %19 = call i8* @nish_str_from_i32(i32 %x)
  %20 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* %19)
  call void @nish_print(i8* %20)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

define internal void @nish.forEach$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @nish_main$arrow0(i32 %18)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.forEachIndexed$i32$fn.16.nish_main$arrow1(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = load i32, i32* %i.addr, align 4
  call void @nish_main$arrow1(i32 %18, i32 %19)
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.forEach$i32$fn.4.show(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @show$(i32 %18)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.forEach$i32$fn.16.nish_main$arrow2(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %6, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs ]
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @nish_main$arrow2(i32 %18, %struct.nish_array* %cap.0)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.forEach$i32$fn.16.nish_main$arrow3(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @nish_main$arrow3(i32 %18)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.forEach$i32$fn.16.nish_main$arrow4(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %6, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs ]
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @nish_main$arrow4(i32 %18, %struct.nish_array* %cap.0)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.forEachIndexed$i32$fn.16.nish_main$arrow5(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %4 to i32
  %12 = icmp slt i32 %10, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %for.cond ], [ %12, %land.rhs ]
  br i1 %13, label %for.body, label %for.end

for.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %6 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = load i32, i32* %i.addr, align 4
  call void @nish_main$arrow5(i32 %18, i32 %19, %struct.nish_array* %cap.0)
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.forEach$i32$fn.16.nish_main$arrow6(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %cap.0) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  %10 = icmp slt i32 %6, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %for.cond ], [ %10, %land.rhs ]
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %13
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @nish_main$arrow6(i32 %18, %struct.nish_array* %cap.0)
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

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
