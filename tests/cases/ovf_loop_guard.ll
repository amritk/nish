%frame.tick = type { i32, i32, %frame.tick.rest }
%frame.tick.rest = type { [0 x <2 x i64>], i32 }
%frame.later = type { i32, i32, i32, i32, %frame.later.rest }
%frame.later.rest = type { [2 x <2 x i64>], i32, i32, i1 }
%struct.nish_array = type { i64, i64, i8* }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [4 x <2 x i64>], i32, i8*, i32, i32, i32, i64 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"abcabcabd\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"2147483644\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #1

define internal void @show(i32 noundef %base, i32 noundef %from, i32 noundef %to) #0 {
entry:
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 %from, i32* %i.addr, align 4
  %0 = load i32, i32* %i.addr, align 4
  %1 = sub i32 %to, 1
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %0)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  %8 = or i1 %4, %7
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %to
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %12 = load i8*, i8** %11, align 8
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = load i32, i32* %i.addr, align 4
  br i1 %8, label %add.checked, label %add.nsw

add.nsw:
  %16 = add nsw i32 %base, %15
  br label %add.join

add.checked:
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %15)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %add.join

add.join:
  %20 = phi i32 [ %16, %add.nsw ], [ %18, %ovf.ok ]
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %23 = load i8*, i8** %22, align 8
  %24 = icmp eq i8* %23, %12
  br i1 %24, label %pass.rewind, label %pass.free

pass.rewind:
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %14, i64* %25, align 8
  br label %pass.done

pass.free:
  %26 = ptrtoint i8* %12 to i64
  %27 = add i64 %26, %14
  call void @nish_arena_release(i64 %27)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @show64(i64 noundef %base, i64 noundef %from, i64 noundef %to) #0 {
entry:
  %i.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %from, i64* %i.addr, align 8
  %0 = load i64, i64* %i.addr, align 8
  %1 = sub i64 %to, 1
  %2 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %base, i64 %0)
  %3 = extractvalue { i64, i1 } %2, 0
  %4 = extractvalue { i64, i1 } %2, 1
  %5 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %base, i64 %1)
  %6 = extractvalue { i64, i1 } %5, 0
  %7 = extractvalue { i64, i1 } %5, 1
  %8 = or i1 %4, %7
  br label %for.cond

for.cond:
  %9 = load i64, i64* %i.addr, align 8
  %10 = icmp slt i64 %9, %to
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %12 = load i8*, i8** %11, align 8
  %13 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = load i64, i64* %i.addr, align 8
  br i1 %8, label %add.checked, label %add.nsw

add.nsw:
  %16 = add nsw i64 %15, %base
  br label %add.join

add.checked:
  %17 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %15, i64 %base)
  %18 = extractvalue { i64, i1 } %17, 0
  %19 = extractvalue { i64, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %add.join

add.join:
  %20 = phi i64 [ %16, %add.nsw ], [ %18, %ovf.ok ]
  %21 = call i8* @nish_str_from_i64(i64 %20)
  call void @nish_print(i8* %21)
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %23 = load i8*, i8** %22, align 8
  %24 = icmp eq i8* %23, %12
  br i1 %24, label %pass.rewind, label %pass.free

pass.rewind:
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %14, i64* %25, align 8
  br label %pass.done

pass.free:
  %26 = ptrtoint i8* %12 to i64
  %27 = add i64 %26, %14
  call void @nish_arena_release(i64 %27)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %28 = load i64, i64* %i.addr, align 8
  %29 = add nsw i64 %28, 1
  store i64 %29, i64* %i.addr, align 8
  br label %for.cond

for.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @fold(i32 noundef %base, i32 noundef %to, i32 noundef %stop) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = load i32, i32* %i.addr, align 4
  %1 = sub i32 %to, 1
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %0)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  %8 = or i1 %4, %7
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %to
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  br i1 %8, label %add.checked, label %add.nsw

add.nsw:
  %12 = add nsw i32 %base, %11
  br label %add.join

add.checked:
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %11)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %add.join

add.join:
  %16 = phi i32 [ %12, %add.nsw ], [ %14, %ovf.ok ]
  store i32 %16, i32* %v.addr, align 4
  %17 = load i32, i32* %v.addr, align 4
  %18 = icmp eq i32 %17, %stop
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %total.addr, align 4
  ret i32 %19

if.end:
  %20 = load i32, i32* %total.addr, align 4
  %21 = load i32, i32* %v.addr, align 4
  %22 = xor i32 %20, %21
  store i32 %22, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load i32, i32* %total.addr, align 4
  ret i32 %25

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef zeroext i1 @same(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %a, i32 noundef %b, i32 noundef %n) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %a, %2
  %4 = sext i32 %3 to i64
  %5 = bitcast i8* %s to i64*
  %6 = load i64, i64* %5, align 8
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %4
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %b, %12
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %s to i64*
  %16 = load i64, i64* %15, align 8
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok.1:
  %18 = getelementptr inbounds i8, i8* %s, i64 8
  %19 = getelementptr inbounds i8, i8* %18, i64 %14
  %20 = load i8, i8* %19, align 1
  %21 = zext i8 %20 to i32
  %22 = icmp ne i32 %11, %21
  br i1 %22, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

define internal noundef i32 @moving(i32 noundef %start, i32 noundef %n) #0 {
entry:
  %x.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %start, i32* %x.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load i32, i32* %x.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = xor i32 %2, %6
  store i32 %8, i32* %total.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  %10 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %11, i32* %x.addr, align 4
  br label %for.inc

for.inc:
  %13 = load i32, i32* %i.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %15 = load i32, i32* %total.addr, align 4
  ret i32 %15

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 1, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @shrinking(i32 noundef %x, i32 noundef %n) #0 {
entry:
  %to.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 %n, i32* %to.addr, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = load i32, i32* %to.addr, align 4
  %2 = icmp slt i32 %0, %1
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load i32, i32* %total.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = xor i32 %3, %6
  store i32 %8, i32* %total.addr, align 4
  %9 = load i32, i32* %to.addr, align 4
  %10 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %11, i32* %to.addr, align 4
  br label %for.inc

for.inc:
  %13 = load i32, i32* %i.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %15 = load i32, i32* %total.addr, align 4
  ret i32 %15

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 1, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @leaf() #1 {
entry:
  ret i32 0
}

define internal i1 @tick.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.tick*
  %async.state = getelementptr inbounds %frame.tick, %frame.tick* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.tick, %frame.tick* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.tick, %frame.tick* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.tick.rest* %async.rest to i8*
  %v.addr = getelementptr inbounds %frame.tick.rest, %frame.tick.rest* %async.rest, i32 0, i32 1
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished ]

entry:
  %0 = call i32 @leaf()
  store i32 %0, i32* %v.addr, align 4
  %1 = load i32, i32* %v.addr, align 4
  store i32 %1, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false
}

define internal i1 @later.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.later*
  %async.state = getelementptr inbounds %frame.later, %frame.later* %async.frame, i32 0, i32 0
  %base.at = getelementptr inbounds %frame.later, %frame.later* %async.frame, i32 0, i32 1
  %base = load i32, i32* %base.at
  %n.at = getelementptr inbounds %frame.later, %frame.later* %async.frame, i32 0, i32 2
  %n = load i32, i32* %n.at
  %async.answer = getelementptr inbounds %frame.later, %frame.later* %async.frame, i32 0, i32 3
  %async.rest = getelementptr inbounds %frame.later, %frame.later* %async.frame, i32 0, i32 4
  %async.kids = bitcast %frame.later.rest* %async.rest to i8*
  %total.addr = getelementptr inbounds %frame.later.rest, %frame.later.rest* %async.rest, i32 0, i32 1
  %i.addr = getelementptr inbounds %frame.later.rest, %frame.later.rest* %async.rest, i32 0, i32 2
  %async.spill.0 = getelementptr inbounds %frame.later.rest, %frame.later.rest* %async.rest, i32 0, i32 3
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll ]

entry:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = load i32, i32* %i.addr, align 4
  %1 = sub i32 %n, 1
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %0)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  %8 = or i1 %4, %7
  store i1 %8, i1* %async.spill.0
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, %n
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %total.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %async.reload.0 = load i1, i1* %async.spill.0
  br i1 %async.reload.0, label %add.checked, label %add.nsw

add.nsw:
  %13 = add nsw i32 %base, %12
  br label %add.join

add.checked:
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 %12)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %add.join

add.join:
  %17 = phi i32 [ %13, %add.nsw ], [ %15, %ovf.ok ]
  %18 = xor i32 %11, %17
  store i32 %18, i32* %total.addr, align 4
  %19 = bitcast i8* %async.kids to { i32, i32 }*
  %20 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %19, i32 0, i32 0
  store i32 0, i32* %20
  br label %await.poll

await.poll:
  %21 = call i1 @tick.resume(i8* %async.kids)
  br i1 %21, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %22 = bitcast i8* %async.kids to { i32, i32 }*
  %23 = getelementptr inbounds { i32, i32 }, { i32, i32 }* %22, i32 0, i32 1
  %24 = load i32, i32* %23
  br label %for.inc

for.inc:
  %25 = load i32, i32* %i.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %27 = load i32, i32* %total.addr, align 4
  store i32 %27, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define i1 @nish_main.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %pick.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %s.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %waited.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 3
  %parsed.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 4
  %guarded.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 5
  %async.spill.0 = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 6
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %await.poll i32 2, label %await.poll.1 ]

entry:
  %arena.mark = call i64 @nish_arena_mark()
  store i64 %arena.mark, i64* %async.spill.0
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = call double @nish_parse_number(i8* %13, i32 2)
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %16 = phi i32 [ %15, %bounds.ok ], [ -1, %cond.false ]
  store i32 %16, i32* %pick.addr, align 4
  %17 = load i32, i32* %pick.addr, align 4
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.else

if.then:
  %19 = sub nsw i32 2147483647, 2
  call void @show(i32 %19, i32 0, i32 5)
  br label %if.end

if.else:
  %20 = load i32, i32* %pick.addr, align 4
  %21 = icmp eq i32 %20, 1
  br i1 %21, label %if.then.1, label %if.else.1

if.then.1:
  %22 = sub nsw i64 9223372036854775807, 1
  call void @show64(i64 %22, i64 0, i64 3)
  br label %if.end.1

if.else.1:
  %23 = load i32, i32* %pick.addr, align 4
  %24 = icmp eq i32 %23, 2
  br i1 %24, label %if.then.2, label %if.end.2

if.then.2:
  %25 = sub nsw i32 0, 2147483647
  %26 = sub nsw i32 %25, 1
  call void @show(i32 %26, i32 -2, i32 1)
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %27 = sub nsw i32 2147483647, 2
  call void @show(i32 %27, i32 0, i32 3)
  %28 = sub nsw i64 9223372036854775807, 1
  call void @show64(i64 %28, i64 -1, i64 2)
  %29 = sub nsw i32 2147483647, 2
  %30 = call i32 @fold(i32 %29, i32 4, i32 2147483647)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = call i32 @fold(i32 10, i32 1000, i32 -1)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %37 = sub nsw i32 0, 2147483647
  %38 = call i32 @fold(i32 %37, i32 5, i32 0)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %36, i8* %39)
  call void @nish_print(i8* %40)
  store i8* bitcast ({ i64, [10 x i8] }* @.str.1 to i8*), i8** %s.addr, align 8
  %41 = load i8*, i8** %s.addr, align 8
  %42 = call i1 @same(i8* %41, i32 0, i32 3, i32 3)
  %43 = select i1 %42, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %44 = call i8* @nish_str_concat(i8* %43, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %45 = load i8*, i8** %s.addr, align 8
  %46 = call i1 @same(i8* %45, i32 0, i32 6, i32 3)
  %47 = select i1 %46, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %48 = call i8* @nish_str_concat(i8* %44, i8* %47)
  %49 = call i8* @nish_str_concat(i8* %48, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %50 = load i8*, i8** %s.addr, align 8
  %51 = call i1 @same(i8* %50, i32 2, i32 2, i32 0)
  %52 = select i1 %51, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %53 = call i8* @nish_str_concat(i8* %49, i8* %52)
  call void @nish_print(i8* %53)
  %54 = call i32 @moving(i32 2147483647, i32 3)
  %55 = call i8* @nish_str_from_i32(i32 %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %57 = sub nsw i32 2147483647, 3
  %58 = call i32 @shrinking(i32 %57, i32 8)
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %56, i8* %59)
  call void @nish_print(i8* %60)
  %61 = sub nsw i32 2147483647, 3
  %62 = bitcast i8* %async.kids to { i32, i32, i32, i32 }*
  %63 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %62, i32 0, i32 0
  store i32 0, i32* %63
  %64 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %62, i32 0, i32 1
  store i32 %61, i32* %64
  %65 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %62, i32 0, i32 2
  store i32 4, i32* %65
  br label %await.poll

await.poll:
  %66 = call i1 @later.resume(i8* %async.kids)
  br i1 %66, label %await.ready, label %await.pending

await.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

await.ready:
  %67 = bitcast i8* %async.kids to { i32, i32, i32, i32 }*
  %68 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %67, i32 0, i32 3
  %69 = load i32, i32* %68
  store i32 %69, i32* %waited.addr, align 4
  %70 = call double @nish_parse_number(i8* bitcast ({ i64, [11 x i8] }* @.str.4 to i8*), i32 2)
  %71 = call i32 @llvm.fptosi.sat.i32.f64(double %70)
  store i32 %71, i32* %parsed.addr, align 4
  %72 = load i32, i32* %parsed.addr, align 4
  %73 = bitcast i8* %async.kids to { i32, i32, i32, i32 }*
  %74 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %73, i32 0, i32 0
  store i32 0, i32* %74
  %75 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %73, i32 0, i32 1
  store i32 %72, i32* %75
  %76 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %73, i32 0, i32 2
  store i32 4, i32* %76
  br label %await.poll.1

await.poll.1:
  %77 = call i1 @later.resume(i8* %async.kids)
  br i1 %77, label %await.ready.1, label %await.pending.1

await.pending.1:
  store i32 2, i32* %async.state
  br label %async.suspend

await.ready.1:
  %78 = bitcast i8* %async.kids to { i32, i32, i32, i32 }*
  %79 = getelementptr inbounds { i32, i32, i32, i32 }, { i32, i32, i32, i32 }* %78, i32 0, i32 3
  %80 = load i32, i32* %79
  store i32 %80, i32* %guarded.addr, align 4
  %81 = load i32, i32* %waited.addr, align 4
  %82 = call i8* @nish_str_from_i32(i32 %81)
  %83 = call i8* @nish_str_concat(i8* %82, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %84 = load i32, i32* %guarded.addr, align 4
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %83, i8* %85)
  call void @nish_print(i8* %86)
  %async.reload.0 = load i64, i64* %async.spill.0
  call void @nish_arena_release(i64 %async.reload.0)
  store i32 0, i32* %async.answer
  store i32 -1, i32* %async.state
  ret i1 true

async.bad:
  unreachable

async.finished:
  ret i1 true

async.suspend:
  ret i1 false
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %async.main = alloca %frame.nish_main, align 16
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.main, i32 0, i32 0
  store i32 0, i32* %0
  %1 = bitcast %frame.nish_main* %async.main to i8*
  br label %async.poll

async.poll:
  %2 = call i1 @nish_main.resume(i8* %1)
  br i1 %2, label %async.done, label %async.wait

async.wait:
  %3 = call i1 @nish.async.run()
  br i1 %3, label %async.poll, label %async.stuck

async.stuck:
  call void @llvm.trap()
  unreachable

async.done:
  call void @nish.async.drain()
  %4 = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.main, i32 0, i32 1
  %5 = load i32, i32* %4
  call void @nish_free_arena()
  ret i32 %5
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!14, !15, !16, !17, !18}
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
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{i32 8, !"cf-protection-branch", i32 1}
!15 = !{i32 8, !"cf-protection-return", i32 1}
!16 = !{i32 8, !"branch-target-enforcement", i32 1}
!17 = !{i32 8, !"sign-return-address", i32 1}
!18 = !{i32 4, !"probe-stack", !"inline-asm"}

declare i8* @nish_async_next()
declare i8* @nish_async_enter(i8* nonnull)
declare void @nish_async_leave(i8* nonnull, i8*)
declare void @nish_async_done(i8* nonnull)

define hidden i1 @nish.async.run() nounwind "probe-stack"="inline-asm" {
entry:
  br label %loop

loop:
  %node = call i8* @nish_async_next()
  %idle = icmp eq i8* %node, null
  br i1 %idle, label %idle.out, label %got

idle.out:
  ret i1 false

got:
  %kind.at = getelementptr inbounds i8, i8* %node, i64 8
  %kind.ptr = bitcast i8* %kind.at to i32*
  %kind = load i32, i32* %kind.ptr, align 8
  %main = icmp slt i32 %kind, 0
  br i1 %main, label %main.out, label %task

main.out:
  ret i1 true

task:
  %prev = call i8* @nish_async_enter(i8* %node)
  %frame = getelementptr inbounds i8, i8* %node, i64 32
  %finished = call i1 @nish.async.resume(i32 %kind, i8* %frame)
  call void @nish_async_leave(i8* %node, i8* %prev)
  br i1 %finished, label %release, label %loop

release:
  call void @nish_async_done(i8* %node)
  br label %loop
}

define hidden void @nish.async.drain() nounwind "probe-stack"="inline-asm" {
entry:
  br label %loop

loop:
  %woke = call i1 @nish.async.run()
  br i1 %woke, label %loop, label %done

done:
  ret void
}

define internal i1 @nish.async.resume(i32 %kind, i8* %frame) nounwind "probe-stack"="inline-asm" {
entry:
  switch i32 %kind, label %bad [  ]

bad:
  call void @llvm.trap()
  unreachable
}
