%struct.S = type { i32, i32 }
%struct.T = type { i32, i32 }
%struct.V = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"A\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"B\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"C\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #4
declare noundef i64 @nish_arena_mark() #4
declare void @nish_arena_release(i64 noundef) #4
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #4
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
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

define internal noundef zeroext i1 @copyWhile(i32 noundef %n, i32 noundef %j) #0 {
entry:
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = icmp eq i32 %j, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, %n
  br i1 %2, label %while.body, label %while.end

while.body:
  store i32 %j, i32* %k.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %3, 1
  store i32 %4, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %5 = load i32, i32* %k.addr, align 4
  %6 = icmp eq i32 %5, 0
  ret i1 %6
}

define internal noundef nonnull align 8 i8* @ternaryFor(i32 noundef %n) #1 {
entry:
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp sgt i32 %2, 1
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ]
  store i32 %4, i32* %k.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i32, i32* %k.addr, align 4
  %8 = icmp eq i32 %7, 0
  br i1 %8, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)

if.end:
  %9 = load i32, i32* %k.addr, align 4
  %10 = icmp eq i32 %9, 1
  br i1 %10, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %11 = phi i8* [ bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), %cond.true.1 ], [ bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), %cond.false.1 ]
  ret i8* %11
}

define internal noundef zeroext i1 @tagCopyFor(%union.tagged* noundef %u, i32 noundef %n) #2 {
entry:
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %u, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = getelementptr inbounds %union.tagged, %union.tagged* %u, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  store i32 %6, i32* %k.addr, align 4
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i32, i32* %k.addr, align 4
  %10 = icmp eq i32 %9, 0
  ret i1 %10
}

define internal noundef i32 @testedDo(i32 noundef %k, i32 noundef %n) #3 {
entry:
  %i.addr = alloca i32, align 4
  %seen.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  store i32 0, i32* %seen.addr, align 4
  br label %do.body

do.body:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %1 = icmp eq i32 %k, 1
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  %2 = load i32, i32* %seen.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %seen.addr, align 4
  br label %if.end.1

if.end.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %8, i32* %i.addr, align 4
  br label %do.cond

do.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %n
  br i1 %11, label %do.body, label %do.end

do.end:
  %12 = load i32, i32* %seen.addr, align 4
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @testedForOf(i32 noundef %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #3 {
entry:
  %total.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %total.addr, align 4
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
  %9 = icmp eq i32 %k, 0
  br i1 %9, label %lor.end, label %lor.rhs

lor.rhs:
  %10 = load i32, i32* %x.addr, align 4
  %11 = icmp slt i32 %10, 0
  br label %lor.end

lor.end:
  %12 = phi i1 [ true, %forof.body ], [ %11, %lor.rhs ]
  br i1 %12, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %13 = load i32, i32* %total.addr, align 4
  %14 = icmp eq i32 %k, 2
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  %15 = load i32, i32* %x.addr, align 4
  %16 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %15, i32 10)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.false:
  %19 = load i32, i32* %x.addr, align 4
  br label %cond.end

cond.end:
  %20 = phi i32 [ %17, %ovf.ok ], [ %19, %cond.false ]
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %22, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %24 = load i64, i64* %forof.idx, align 8
  %25 = add i64 %24, 1
  store i64 %25, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %26 = load i32, i32* %total.addr, align 4
  ret i32 %26

ovf.fail:
  %ovf.op = phi i32 [ 2, %cond.true ], [ 0, %cond.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef zeroext i1 @testedNestedBreak(i32 noundef %k, i32 noundef %n) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %if.then, label %if.else

if.then:
  %4 = icmp eq i32 %k, 0
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 true

if.end.1:
  br label %if.end

if.else:
  %5 = icmp eq i32 %k, 0
  br i1 %5, label %if.then.2, label %if.end.2

if.then.2:
  ret i1 false

if.end.2:
  br label %if.end

if.end:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sgt i32 %8, 3
  br i1 %9, label %if.then.3, label %if.end.3

if.then.3:
  br label %while.end

if.end.3:
  br label %while.cond

while.end:
  %10 = icmp eq i32 %k, 1
  ret i1 %10
}

define internal noundef nonnull align 8 i8* @switchSwap(i32 noundef %n) #0 {
entry:
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 1, i32* %k.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %k.addr, align 4
  switch i32 %2, label %sw.default [
    i32 1, label %sw.case
    i32 2, label %sw.case.1
  ]

sw.case:
  store i32 2, i32* %k.addr, align 4
  br label %sw.end

sw.case.1:
  store i32 1, i32* %k.addr, align 4
  br label %sw.end

sw.default:
  ret i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)

sw.end:
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %3, 1
  store i32 %4, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %5 = load i32, i32* %k.addr, align 4
  %6 = icmp eq i32 %5, 1
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %7 = phi i8* [ bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), %cond.true ], [ bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), %cond.false ]
  ret i8* %7
}

define internal noundef i32 @unionTestedWhile(%union.tagged* noundef %u, i32 noundef %n) #3 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %u, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = load i32, i32* %i.addr, align 4
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %5, i32* %i.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp sgt i32 %7, %n
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = bitcast %union.tagged* %u to %struct.S*
  %10 = getelementptr inbounds %struct.S, %struct.S* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !16
  ret i32 %11

if.end:
  br label %while.cond

while.end:
  %12 = getelementptr inbounds %union.tagged, %union.tagged* %u, i32 0, i32 0
  %13 = load i32, i32* %12, align 4
  %14 = icmp eq i32 %13, 1
  br i1 %14, label %if.then.1, label %if.end.1

if.then.1:
  %15 = bitcast %union.tagged* %u to %struct.T*
  %16 = getelementptr inbounds %struct.T, %struct.T* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4, !tbaa !18
  ret i32 %17

if.end.1:
  %18 = bitcast %union.tagged* %u to %struct.V*
  %19 = getelementptr inbounds %struct.V, %struct.V* %18, i32 0, i32 1
  %20 = load i32, i32* %19, align 4, !tbaa !20
  ret i32 %20

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef %union.tagged* @pick(i32 noundef %i) #4 {
entry:
  %0 = icmp eq i32 %i, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.S*
  %3 = getelementptr inbounds %struct.S, %struct.S* %2, i32 0, i32 0
  store i32 0, i32* %3, align 4, !tbaa !21
  %4 = getelementptr inbounds %struct.S, %struct.S* %2, i32 0, i32 1
  store i32 1, i32* %4, align 4, !tbaa !16
  %5 = bitcast %struct.S* %2 to %union.tagged*
  ret %union.tagged* %5

if.end:
  %6 = icmp eq i32 %i, 1
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = call i8* @nish_alloc_struct(i64 8)
  %8 = bitcast i8* %7 to %struct.T*
  %9 = getelementptr inbounds %struct.T, %struct.T* %8, i32 0, i32 0
  store i32 1, i32* %9, align 4, !tbaa !22
  %10 = getelementptr inbounds %struct.T, %struct.T* %8, i32 0, i32 1
  store i32 20, i32* %10, align 4, !tbaa !18
  %11 = bitcast %struct.T* %8 to %union.tagged*
  br label %cond.end

cond.false:
  %12 = call i8* @nish_alloc_struct(i64 8)
  %13 = bitcast i8* %12 to %struct.V*
  %14 = getelementptr inbounds %struct.V, %struct.V* %13, i32 0, i32 0
  store i32 2, i32* %14, align 4, !tbaa !23
  %15 = getelementptr inbounds %struct.V, %struct.V* %13, i32 0, i32 1
  store i32 300, i32* %15, align 4, !tbaa !20
  %16 = bitcast %struct.V* %13 to %union.tagged*
  br label %cond.end

cond.end:
  %17 = phi %union.tagged* [ %11, %cond.true ], [ %16, %cond.false ]
  ret %union.tagged* %17
}

define void @nish_main() #3 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i1 @copyWhile(i32 2, i32 1)
  %1 = select i1 %0, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %3 = call i1 @copyWhile(i32 0, i32 2)
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %7 = call i1 @copyWhile(i32 1, i32 0)
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  call void @nish_print(i8* %9)
  %10 = call i8* @ternaryFor(i32 0)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %12 = call i8* @ternaryFor(i32 2)
  %13 = call i8* @nish_str_concat(i8* %11, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %15 = call i8* @ternaryFor(i32 3)
  %16 = call i8* @nish_str_concat(i8* %14, i8* %15)
  call void @nish_print(i8* %16)
  %17 = call %union.tagged* @pick(i32 1)
  %18 = call i1 @tagCopyFor(%union.tagged* %17, i32 2)
  %19 = select i1 %18, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %21 = call %union.tagged* @pick(i32 2)
  %22 = call i1 @tagCopyFor(%union.tagged* %21, i32 0)
  %23 = select i1 %22, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %24 = call i8* @nish_str_concat(i8* %20, i8* %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %26 = call %union.tagged* @pick(i32 0)
  %27 = call i1 @tagCopyFor(%union.tagged* %26, i32 1)
  %28 = select i1 %27, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %29 = call i8* @nish_str_concat(i8* %25, i8* %28)
  call void @nish_print(i8* %29)
  %30 = call i32 @testedDo(i32 1, i32 3)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %33 = call i32 @testedDo(i32 2, i32 3)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %37 = call i32 @testedDo(i32 0, i32 3)
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %36, i8* %38)
  call void @nish_print(i8* %39)
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !24
  %42 = bitcast [3 x i32]* %arr.data to i8*
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %42, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = bitcast i8* %42 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 0
  store i32 1, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %46 = getelementptr inbounds i32, i32* %44, i64 1
  store i32 2, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %47 = getelementptr inbounds i32, i32* %44, i64 2
  store i32 3, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %48 = call i32 @testedForOf(i32 1, %struct.nish_array* %arr.hdr)
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !24
  %53 = bitcast [3 x i32]* %arr.data.1 to i8*
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %53, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast i8* %53 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 0
  store i32 1, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %57 = getelementptr inbounds i32, i32* %55, i64 1
  store i32 2, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %58 = getelementptr inbounds i32, i32* %55, i64 2
  store i32 3, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %59 = call i32 @testedForOf(i32 2, %struct.nish_array* %arr.hdr.1)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %50, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !24
  %65 = bitcast [2 x i32]* %arr.data.2 to i8*
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = bitcast i8* %65 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 0
  store i32 1, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %69 = getelementptr inbounds i32, i32* %67, i64 1
  store i32 -2, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %70 = call i32 @testedForOf(i32 2, %struct.nish_array* %arr.hdr.2)
  %71 = call i8* @nish_str_from_i32(i32 %70)
  %72 = call i8* @nish_str_concat(i8* %62, i8* %71)
  call void @nish_print(i8* %72)
  %73 = call i1 @testedNestedBreak(i32 1, i32 9)
  %74 = select i1 %73, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %76 = call i1 @testedNestedBreak(i32 2, i32 2)
  %77 = select i1 %76, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %78 = call i8* @nish_str_concat(i8* %75, i8* %77)
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %80 = call i1 @testedNestedBreak(i32 0, i32 2)
  %81 = select i1 %80, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %82 = call i8* @nish_str_concat(i8* %79, i8* %81)
  call void @nish_print(i8* %82)
  %83 = call i8* @switchSwap(i32 0)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %85 = call i8* @switchSwap(i32 1)
  %86 = call i8* @nish_str_concat(i8* %84, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %88 = call i8* @switchSwap(i32 4)
  %89 = call i8* @nish_str_concat(i8* %87, i8* %88)
  call void @nish_print(i8* %89)
  %90 = call %union.tagged* @pick(i32 0)
  %91 = call i32 @unionTestedWhile(%union.tagged* %90, i32 2)
  %92 = call i8* @nish_str_from_i32(i32 %91)
  %93 = call i8* @nish_str_concat(i8* %92, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %94 = call %union.tagged* @pick(i32 1)
  %95 = call i32 @unionTestedWhile(%union.tagged* %94, i32 2)
  %96 = call i8* @nish_str_from_i32(i32 %95)
  %97 = call i8* @nish_str_concat(i8* %93, i8* %96)
  %98 = call i8* @nish_str_concat(i8* %97, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %99 = call %union.tagged* @pick(i32 2)
  %100 = call i32 @unionTestedWhile(%union.tagged* %99, i32 2)
  %101 = call i8* @nish_str_from_i32(i32 %100)
  %102 = call i8* @nish_str_concat(i8* %98, i8* %101)
  call void @nish_print(i8* %102)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #3 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!25, !26, !27, !28, !29}
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
!14 = !{!"i32", !6, i64 0}
!15 = !{!"S", !14, i64 0, !14, i64 4}
!16 = !{!15, !14, i64 4}
!17 = !{!"T", !14, i64 0, !14, i64 4}
!18 = !{!17, !14, i64 4}
!19 = !{!"V", !14, i64 0, !14, i64 4}
!20 = !{!19, !14, i64 4}
!21 = !{!15, !14, i64 0}
!22 = !{!17, !14, i64 0}
!23 = !{!19, !14, i64 0}
!24 = !{!9, !7, i64 8}
!25 = !{i32 8, !"cf-protection-branch", i32 1}
!26 = !{i32 8, !"cf-protection-return", i32 1}
!27 = !{i32 8, !"branch-target-enforcement", i32 1}
!28 = !{i32 8, !"sign-return-address", i32 1}
!29 = !{i32 4, !"probe-stack", !"inline-asm"}
