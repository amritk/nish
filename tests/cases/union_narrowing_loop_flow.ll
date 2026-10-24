%struct.Ca = type { i32 }
%struct.Cb = type { i32 }
%struct.Cc = type { i32 }
%union.tagged = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

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

define internal noundef %union.tagged* @make(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.Ca*
  %3 = getelementptr inbounds %struct.Ca, %struct.Ca* %2, i32 0, i32 0
  store i32 0, i32* %3, align 4, !tbaa !4
  %4 = bitcast %struct.Ca* %2 to %union.tagged*
  ret %union.tagged* %4

if.end:
  %5 = icmp eq i32 %n, 1
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = bitcast i8* %6 to %struct.Cb*
  %8 = getelementptr inbounds %struct.Cb, %struct.Cb* %7, i32 0, i32 0
  store i32 1, i32* %8, align 4, !tbaa !6
  %9 = bitcast %struct.Cb* %7 to %union.tagged*
  ret %union.tagged* %9

if.end.1:
  %10 = call i8* @nish_alloc_struct(i64 4)
  %11 = bitcast i8* %10 to %struct.Cc*
  %12 = getelementptr inbounds %struct.Cc, %struct.Cc* %11, i32 0, i32 0
  store i32 2, i32* %12, align 4, !tbaa !8
  %13 = bitcast %struct.Cc* %11 to %union.tagged*
  ret %union.tagged* %13
}

define internal noundef zeroext i1 @untilDone(i32 noundef %n) #1 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %j.addr, align 4
  %1 = icmp ne i32 %0, 2
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp sgt i32 %2, %n
  br i1 %3, label %if.then, label %if.else

if.then:
  store i32 2, i32* %j.addr, align 4
  br label %if.end

if.else:
  store i32 1, i32* %j.addr, align 4
  br label %if.end

if.end:
  %4 = load i32, i32* %i.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %8 = load i32, i32* %j.addr, align 4
  %9 = icmp eq i32 %8, 2
  ret i1 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @breakOut(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  %4 = load i32, i32* %j.addr, align 4
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  store i32 1, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp eq i32 %6, 0
  ret i1 %7
}

define internal noundef zeroext i1 @continueOn(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp eq i32 %4, 2
  br i1 %5, label %if.then, label %if.end

if.then:
  store i32 2, i32* %j.addr, align 4
  br label %while.cond

if.end:
  store i32 1, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp eq i32 %6, 2
  ret i1 %7
}

define internal noundef zeroext i1 @switchArms(i32 noundef %k, i32 noundef %n) #3 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  switch i32 %k, label %sw.default [
    i32 0, label %sw.case
  ]

sw.case:
  store i32 2, i32* %j.addr, align 4
  br label %sw.end

sw.default:
  store i32 1, i32* %j.addr, align 4
  br label %sw.end

sw.end:
  br label %for.inc

for.inc:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %4 = load i32, i32* %j.addr, align 4
  %5 = icmp eq i32 %4, 2
  ret i1 %5
}

define internal noundef zeroext i1 @nested(i32 noundef %n) #2 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %m.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  store i32 0, i32* %m.addr, align 4
  br label %while.cond.1

while.cond.1:
  %4 = load i32, i32* %m.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %while.body.1, label %while.end.1

while.body.1:
  %6 = load i32, i32* %m.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %m.addr, align 4
  store i32 2, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  br label %while.cond

while.end:
  %8 = load i32, i32* %j.addr, align 4
  %9 = icmp eq i32 %8, 2
  ret i1 %9
}

define internal noundef zeroext i1 @doAlternate(i32 noundef %n) #1 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %do.body

do.body:
  %0 = load i32, i32* %i.addr, align 4
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %2, i32* %i.addr, align 4
  %4 = load i32, i32* %j.addr, align 4
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %if.then, label %if.else

if.then:
  store i32 1, i32* %j.addr, align 4
  br label %if.end

if.else:
  store i32 2, i32* %j.addr, align 4
  br label %if.end

if.end:
  br label %do.cond

do.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, %n
  br i1 %7, label %do.body, label %do.end

do.end:
  %8 = load i32, i32* %j.addr, align 4
  %9 = icmp eq i32 %8, 2
  ret i1 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @conditionStore(i32 noundef %k, i32 noundef %n) #1 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %k, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %j.addr, align 4
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %i.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp sgt i32 %6, %n
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  store i32 %8, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %9 = load i32, i32* %j.addr, align 4
  %10 = icmp eq i32 %9, 1
  ret i1 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @forOf(i32 noundef %n) #4 {
entry:
  %j.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  store i32 0, i32* %j.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %8 = load i64, i64* %forof.idx, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %11 = icmp ult i64 %8, %10
  br i1 %11, label %forof.body, label %forof.end

forof.body:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %8
  %16 = load i32, i32* %15, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  store i32 %16, i32* %x.addr, align 4
  %17 = load i32, i32* %x.addr, align 4
  %18 = icmp sgt i32 %17, %n
  br i1 %18, label %if.then, label %if.end

if.then:
  store i32 1, i32* %j.addr, align 4
  br label %if.end

if.end:
  br label %forof.inc

forof.inc:
  %19 = load i64, i64* %forof.idx, align 8
  %20 = add i64 %19, 1
  store i64 %20, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %21 = load i32, i32* %j.addr, align 4
  %22 = icmp eq i32 %21, 1
  ret i1 %22
}

define internal noundef zeroext i1 @forever(i32 noundef %n) #1 {
entry:
  %j.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %j.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = load i32, i32* %i.addr, align 4
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %2, i32* %i.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sgt i32 %4, %n
  br i1 %5, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  store i32 2, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp eq i32 %6, 2
  ret i1 %7

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @unionStore(i32 noundef %n) #1 {
entry:
  %u.addr = alloca %union.tagged*, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %union.tagged* @make(i32 0)
  store %union.tagged* %0, %union.tagged** %u.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, %n
  br i1 %2, label %while.body, label %while.end

while.body:
  %3 = call %union.tagged* @make(i32 1)
  store %union.tagged* %3, %union.tagged** %u.addr, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 2
  %6 = call %union.tagged* @make(i32 %5)
  store %union.tagged* %6, %union.tagged** %u.addr, align 8
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %9 = load %union.tagged*, %union.tagged** %u.addr, align 8
  %10 = getelementptr inbounds %union.tagged, %union.tagged* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  %12 = icmp eq i32 %11, 1
  call void @nish_arena_release(i64 %arena.mark)
  ret i1 %12
}

define void @nish_main() #1 {
entry:
  %0 = call i1 @untilDone(i32 3)
  %1 = select i1 %0, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %1)
  %2 = call i1 @breakOut(i32 3)
  %3 = select i1 %2, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %3)
  %4 = call i1 @continueOn(i32 3)
  %5 = select i1 %4, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %5)
  %6 = call i1 @switchArms(i32 0, i32 2)
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %7)
  %8 = call i1 @nested(i32 2)
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %9)
  %10 = call i1 @doAlternate(i32 3)
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %11)
  %12 = call i1 @conditionStore(i32 0, i32 2)
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %13)
  %14 = call i1 @forOf(i32 2)
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %15)
  %16 = call i1 @forever(i32 2)
  %17 = select i1 %16, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %17)
  %18 = call i1 @unionStore(i32 2)
  %19 = select i1 %18, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %19)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Ca", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Cb", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{!"Cc", !2, i64 0}
!8 = !{!7, !2, i64 0}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element i32", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}
