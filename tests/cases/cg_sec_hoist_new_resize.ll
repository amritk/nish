%struct.P = type { i32 }
%struct.Q = type { i32 }
%struct.R = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @P.constructor(%struct.P* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %k.addr, align 4
  %1 = icmp slt i32 %0, 100
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 4)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  store i32 7, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = load i32, i32* %k.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %15 = getelementptr inbounds %struct.P, %struct.P* %this, i32 0, i32 0
  store i32 1, i32* %15, align 4, !tbaa !17
  ret void
}

define internal void @Q.constructor(%struct.Q* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i32*
  %6 = getelementptr inbounds i32, i32* %5, i64 0
  %7 = load i32, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds %struct.Q, %struct.Q* %this, i32 0, i32 0
  store i32 %7, i32* %8, align 4, !tbaa !19
  ret void
}

define internal void @R.constructor(%struct.R* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %xs, i64 4)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  store i32 1, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.R, %struct.R* %this, i32 0, i32 0
  store i32 1, i32* %11, align 4, !tbaa !21
  ret void
}

define internal noundef i32 @whileLoop() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.P*, align 8
  %P.obj = alloca %struct.P, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %8, %12
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %s.addr, align 4
  %15 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %16 = load i32, i32* %i.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %17
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %24, i32* %s.addr, align 4
  %26 = load i32, i32* %i.addr, align 4
  %27 = icmp eq i32 %26, 0
  br i1 %27, label %if.then, label %if.end

if.then:
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @P.constructor(%struct.P* %P.obj, %struct.nish_array* %28)
  store %struct.P* %P.obj, %struct.P** %p.addr, align 8
  %29 = load i32, i32* %s.addr, align 4
  %30 = load %struct.P*, %struct.P** %p.addr, align 8
  %31 = getelementptr inbounds %struct.P, %struct.P* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4, !tbaa !17
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %36 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %34, i32 1)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %37, i32* %s.addr, align 4
  br label %if.end

if.end:
  %39 = load i32, i32* %i.addr, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %41 = load i32, i32* %s.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %41

ovf.fail:
  %ovf.op = phi i32 [ 0, %while.body ], [ 0, %if.then ], [ 1, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @forOfLoop() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %s.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %p.addr = alloca %struct.P*, align 8
  %P.obj = alloca %struct.P, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %s.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %forof.body, label %forof.end

forof.body:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %17, i32* %x.addr, align 4
  %18 = load i32, i32* %s.addr, align 4
  %19 = load i32, i32* %x.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %21, i32* %s.addr, align 4
  %23 = load i32, i32* %x.addr, align 4
  %24 = icmp eq i32 %23, 1
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @P.constructor(%struct.P* %P.obj, %struct.nish_array* %25)
  store %struct.P* %P.obj, %struct.P** %p.addr, align 8
  %26 = load i32, i32* %s.addr, align 4
  %27 = load %struct.P*, %struct.P** %p.addr, align 8
  %28 = getelementptr inbounds %struct.P, %struct.P* %27, i32 0, i32 0
  %29 = load i32, i32* %28, align 4, !tbaa !17
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %33 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %31, i32 1)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %34, i32* %s.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %36 = load i64, i64* %forof.idx, align 8
  %37 = add i64 %36, 1
  store i64 %37, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %38 = load i32, i32* %s.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38

ovf.fail:
  %ovf.op = phi i32 [ 0, %forof.body ], [ 0, %if.then ], [ 1, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @keepsHoist() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %q.addr = alloca %struct.Q*, align 8
  %Q.obj = alloca %struct.Q, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %10 to i32
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @Q.constructor(%struct.Q* %Q.obj, %struct.nish_array* %16)
  store %struct.Q* %Q.obj, %struct.Q** %q.addr, align 8
  %17 = load i32, i32* %s.addr, align 4
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %12 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = load %struct.Q*, %struct.Q** %q.addr, align 8
  %27 = getelementptr inbounds %struct.Q, %struct.Q* %26, i32 0, i32 0
  %28 = load i32, i32* %27, align 4, !tbaa !19
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %30, i32* %s.addr, align 4
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %34 = load i32, i32* %s.addr, align 4
  ret i32 %34

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @compoundNew() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %P.obj = alloca %struct.P, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [1 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 0
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @P.constructor(%struct.P* %P.obj, %struct.nish_array* %12)
  %13 = getelementptr inbounds %struct.P, %struct.P* %P.obj, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !17
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = icmp ult i64 0, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  store i32 %16, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ult i64 0, %27
  br i1 %28, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %27)
  unreachable

bounds.ok.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 0
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %33

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @compoundKeeps() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i32], align 8
  %Q.obj = alloca %struct.Q, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [1 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 4, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 0
  %11 = load i32, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @Q.constructor(%struct.Q* %Q.obj, %struct.nish_array* %12)
  %13 = getelementptr inbounds %struct.Q, %struct.Q* %Q.obj, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !19
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  %23 = load i32, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @forOfGrows(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs) #0 {
entry:
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %r.addr = alloca %struct.R*, align 8
  %R.obj = alloca %struct.R, align 8
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
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %8, i32* %x.addr, align 4
  call void @R.constructor(%struct.R* %R.obj, %struct.nish_array* %xs)
  store %struct.R* %R.obj, %struct.R** %r.addr, align 8
  br label %forof.inc

forof.inc:
  %9 = load i64, i64* %forof.idx, align 8
  %10 = add i64 %9, 1
  store i64 %10, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret i32 0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @whileLoop()
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 1000000)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call i32 @forOfLoop()
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 1000)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %6)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %11 = call i32 @keepsHoist()
  %12 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %11, i32 100)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %13)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %18 = call i32 @compoundNew()
  %19 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %18, i32 10)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %20)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %25 = call i32 @compoundKeeps()
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %23, i32 %25)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  ret i32 %27

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 2, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 2, %ovf.ok.4 ], [ 0, %ovf.ok.5 ], [ 0, %ovf.ok.6 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
!16 = !{!"P", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"Q", !15, i64 0}
!19 = !{!18, !15, i64 0}
!20 = !{!"R", !15, i64 0}
!21 = !{!20, !15, i64 0}
