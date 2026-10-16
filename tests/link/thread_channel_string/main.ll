%struct.Source = type { %struct.Channel$str*, i8*, i32 }
%struct.Stage = type { %struct.Channel$str*, %struct.Channel$str* }
%struct.Sink = type { %struct.Channel$str* }
%struct.Channel$str = type { %struct.nish_array*, i32, i64 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [50 x i8] } { i64 49, [50 x i8] c"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"end\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"<end>\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"<alp\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"alpha\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"beta\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"gamma\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$$Source$i32$fn.7.produce(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Source* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Stage$i32$fn.7.rewrite(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Stage* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Sink$str$fn.7.consume(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Sink* noundef nonnull align 8 dereferenceable(8), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.Channel$str.constructor(%struct.Channel$str* noundef nonnull noalias align 8 dereferenceable(24) nocapture) #1
declare void @nish.Channel$str.send(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noundef nonnull align 8 i8* @nish.Channel$str.take(%struct.Channel$str* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.Channel$str.ready(%struct.Channel$str* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare void @nish_scope_join(i8* noundef nonnull) #0
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #0
declare noundef i32 @nish_channel_receive(i64* noundef nonnull, i64* noundef nonnull) #0
declare i8* @nish_cross_in(i8* noundef, i64 noundef) #0
declare i64 @llvm.smin.i64(i64, i64) #6
declare i64 @llvm.smax.i64(i64, i64) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6

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
  %4 = icmp slt i32 %3, 4000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [50 x i8] }* @.str.0 to i8*), i8* %6)
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
  %39 = sub nsw i32 %37, 4000
  ret i32 %39

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Source.constructor(%struct.Source* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %struct.Channel$str* noundef nonnull align 8 dereferenceable(24) %out, i8* noundef nonnull noalias readonly align 8 %tag, i32 noundef %n) #1 {
entry:
  %0 = getelementptr inbounds %struct.Source, %struct.Source* %this, i32 0, i32 0
  store %struct.Channel$str* %out, %struct.Channel$str** %0, align 8, !tbaa !18
  %1 = getelementptr inbounds %struct.Source, %struct.Source* %this, i32 0, i32 1
  store i8* %tag, i8** %1, align 8, !tbaa !19
  %2 = getelementptr inbounds %struct.Source, %struct.Source* %this, i32 0, i32 2
  store i32 %n, i32* %2, align 4, !tbaa !20
  ret void
}

define internal void @Stage.constructor(%struct.Stage* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Channel$str* noundef nonnull align 8 dereferenceable(24) %inp, %struct.Channel$str* noundef nonnull align 8 dereferenceable(24) %out) #1 {
entry:
  %0 = getelementptr inbounds %struct.Stage, %struct.Stage* %this, i32 0, i32 0
  store %struct.Channel$str* %inp, %struct.Channel$str** %0, align 8, !tbaa !22
  %1 = getelementptr inbounds %struct.Stage, %struct.Stage* %this, i32 0, i32 1
  store %struct.Channel$str* %out, %struct.Channel$str** %1, align 8, !tbaa !23
  ret void
}

define internal void @Sink.constructor(%struct.Sink* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Channel$str* noundef nonnull align 8 dereferenceable(24) %inp) #1 {
entry:
  %0 = getelementptr inbounds %struct.Sink, %struct.Sink* %this, i32 0, i32 0
  store %struct.Channel$str* %inp, %struct.Channel$str** %0, align 8, !tbaa !25
  ret void
}

define hidden noundef i32 @produce$(%struct.Source* noundef nonnull readonly align 8 dereferenceable(24) nocapture %src) #0 {
entry:
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.Source, %struct.Source* %src, i32 0, i32 2
  %2 = load i32, i32* %1, align 4, !tbaa !20
  %3 = icmp slt i32 %0, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %5 = load i8*, i8** %4, align 8
  %6 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %7 = load i64, i64* %6, align 8
  %8 = getelementptr inbounds %struct.Source, %struct.Source* %src, i32 0, i32 0
  %9 = load %struct.Channel$str*, %struct.Channel$str** %8, align 8, !tbaa !18
  %10 = getelementptr inbounds %struct.Source, %struct.Source* %src, i32 0, i32 1
  %11 = load i8*, i8** %10, align 8, !tbaa !19
  %12 = load i32, i32* %i.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %13)
  %15 = call i8* @nish_str_concat(i8* %11, i8* %14)
  call void @nish.Channel$str.send(%struct.Channel$str* %9, i8* %15)
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %5
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %7, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %5 to i64
  %21 = add i64 %20, %7
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
  %24 = getelementptr inbounds %struct.Source, %struct.Source* %src, i32 0, i32 0
  %25 = load %struct.Channel$str*, %struct.Channel$str** %24, align 8, !tbaa !18
  call void @nish.Channel$str.send(%struct.Channel$str* %25, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %26 = getelementptr inbounds %struct.Source, %struct.Source* %src, i32 0, i32 2
  %27 = load i32, i32* %26, align 4, !tbaa !20
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %27
}

define hidden noundef i32 @rewrite$(%struct.Stage* noundef nonnull readonly align 8 dereferenceable(16) nocapture %st) #0 {
entry:
  %n.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %chan.slot = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %n.addr, align 4
  %0 = getelementptr inbounds %struct.Stage, %struct.Stage* %st, i32 0, i32 0
  %1 = load %struct.Channel$str*, %struct.Channel$str** %0, align 8, !tbaa !22
  %2 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %1, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %3 = call i32 @nish_channel_receive(i64* %2, i64* %chan.slot)
  %4 = icmp ne i32 %3, 0
  br i1 %4, label %chan.body, label %chan.end

chan.body:
  %5 = load i64, i64* %chan.slot, align 8
  %6 = inttoptr i64 %5 to i8*
  %7 = call i8* @nish_cross_in(i8* %6, i64 0)
  store i8* %7, i8** %s.addr, align 8
  %8 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %9 = load i8*, i8** %8, align 8
  %10 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %11 = load i64, i64* %10, align 8
  %12 = getelementptr inbounds %struct.Stage, %struct.Stage* %st, i32 0, i32 1
  %13 = load %struct.Channel$str*, %struct.Channel$str** %12, align 8, !tbaa !23
  %14 = load i8*, i8** %s.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = call i64 @llvm.smin.i64(i64 3, i64 %16)
  %18 = call i64 @llvm.smax.i64(i64 %17, i64 0)
  %19 = call i64 @llvm.smin.i64(i64 0, i64 %18)
  %20 = call i64 @llvm.smax.i64(i64 0, i64 %18)
  %21 = sub i64 %20, %19
  %22 = getelementptr inbounds i8, i8* %14, i64 8
  %23 = getelementptr inbounds i8, i8* %22, i64 %19
  %24 = call i8* @nish_str_new(i8* %23, i64 %21)
  %25 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %24)
  %26 = load i8*, i8** %s.addr, align 8
  %27 = bitcast i8* %26 to i64*
  %28 = load i64, i64* %27, align 8
  %29 = load i8*, i8** %s.addr, align 8
  %30 = bitcast i8* %29 to i64*
  %31 = load i64, i64* %30, align 8
  %32 = trunc i64 %31 to i32
  %33 = sext i32 %32 to i64
  %34 = icmp ule i64 3, %33
  %35 = icmp ule i64 %33, %28
  %36 = and i1 %34, %35
  br i1 %36, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 3, i64 %33, i64 %28)
  unreachable

slice.ok:
  %37 = sub i64 %33, 3
  %38 = getelementptr inbounds i8, i8* %26, i64 8
  %39 = getelementptr inbounds i8, i8* %38, i64 3
  %40 = call i8* @nish_str_new(i8* %39, i64 %37)
  %41 = call i8* @nish_str_concat(i8* %25, i8* %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  call void @nish.Channel$str.send(%struct.Channel$str* %13, i8* %42)
  %43 = load i32, i32* %n.addr, align 4
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %43, i32 1)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %45, i32* %n.addr, align 4
  %47 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %48 = load i8*, i8** %47, align 8
  %49 = icmp eq i8* %48, %9
  br i1 %49, label %pass.rewind, label %pass.free

pass.rewind:
  %50 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %11, i64* %50, align 8
  br label %pass.done

pass.free:
  %51 = ptrtoint i8* %9 to i64
  %52 = add i64 %51, %11
  call void @nish_arena_release(i64 %52)
  br label %pass.done

pass.done:
  br label %chan.recv

chan.end:
  %53 = load i32, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %53

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 i8* @consume$(%struct.Sink* noundef nonnull readonly align 8 dereferenceable(8) nocapture %sk) #0 {
entry:
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %total.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %chan.slot = alloca i64, align 8
  %ends.addr = alloca i32, align 4
  %alpha.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %s.addr.1 = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %kept.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %3 = getelementptr inbounds %struct.Sink, %struct.Sink* %sk, i32 0, i32 0
  %4 = load %struct.Channel$str*, %struct.Channel$str** %3, align 8, !tbaa !25
  %5 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %4, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %6 = call i32 @nish_channel_receive(i64* %5, i64* %chan.slot)
  %7 = icmp ne i32 %6, 0
  br i1 %7, label %chan.body, label %chan.end

chan.body:
  %8 = load i64, i64* %chan.slot, align 8
  %9 = inttoptr i64 %8 to i8*
  %10 = call i8* @nish_cross_in(i8* %9, i64 0)
  store i8* %10, i8** %s.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %12 = load i8*, i8** %s.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  store i8* %12, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = load i32, i32* %total.addr, align 4
  %25 = load i8*, i8** %s.addr, align 8
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %30, i32* %total.addr, align 4
  br label %chan.recv

chan.end:
  %32 = call i32 @churn()
  store i32 0, i32* %ends.addr, align 4
  store i32 0, i32* %alpha.addr, align 4
  store i32 0, i32* %sum.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %34 = load i64, i64* %forof.idx, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = icmp ult i64 %34, %36
  br i1 %37, label %forof.body, label %forof.end

forof.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to i8**
  %41 = getelementptr inbounds i8*, i8** %40, i64 %34
  %42 = load i8*, i8** %41, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %42, i8** %s.addr.1, align 8
  %43 = load i8*, i8** %s.addr.1, align 8
  %44 = call zeroext i1 @nish_str_eq(i8* %43, i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*))
  br i1 %44, label %if.then, label %if.end

if.then:
  %45 = load i32, i32* %ends.addr, align 4
  %46 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %45, i32 1)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %47, i32* %ends.addr, align 4
  br label %if.end

if.end:
  %49 = load i8*, i8** %s.addr.1, align 8
  %50 = call zeroext i1 @nish_str_at(i8* %49, i64 0, i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*))
  br i1 %50, label %land.rhs, label %land.end

land.rhs:
  %51 = load i8*, i8** %s.addr.1, align 8
  %52 = bitcast i8* %51 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %55 = load i64, i64* %54, align 8
  %56 = sub i64 %53, %55
  %57 = call zeroext i1 @nish_str_at(i8* %51, i64 %56, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  br label %land.end

land.end:
  %58 = phi i1 [ false, %if.end ], [ %57, %land.rhs ]
  br i1 %58, label %if.then.1, label %if.end.1

if.then.1:
  %59 = load i32, i32* %alpha.addr, align 4
  %60 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %59, i32 1)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %61, i32* %alpha.addr, align 4
  br label %if.end.1

if.end.1:
  %63 = load i32, i32* %sum.addr, align 4
  %64 = load i8*, i8** %s.addr.1, align 8
  %65 = load i8*, i8** %s.addr.1, align 8
  %66 = bitcast i8* %65 to i64*
  %67 = load i64, i64* %66, align 8
  %68 = trunc i64 %67 to i32
  %69 = sub nsw i32 %68, 2
  %70 = sext i32 %69 to i64
  %71 = bitcast i8* %64 to i64*
  %72 = load i64, i64* %71, align 8
  %73 = icmp ult i64 %70, %72
  br i1 %73, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %70, i64 %72)
  unreachable

bounds.ok:
  %74 = getelementptr inbounds i8, i8* %64, i64 8
  %75 = getelementptr inbounds i8, i8* %74, i64 %70
  %76 = load i8, i8* %75, align 1
  %77 = zext i8 %76 to i32
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %63, i32 %77)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %79, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %81 = load i64, i64* %forof.idx, align 8
  %82 = add i64 %81, 1
  store i64 %82, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %83 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = trunc i64 %85 to i32
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* %87, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %89 = load i32, i32* %total.addr, align 4
  %90 = call i8* @nish_str_from_i32(i32 %89)
  %91 = call i8* @nish_str_concat(i8* %88, i8* %90)
  %92 = call i8* @nish_str_concat(i8* %91, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %93 = load i32, i32* %ends.addr, align 4
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* %92, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %97 = load i32, i32* %alpha.addr, align 4
  %98 = call i8* @nish_str_from_i32(i32 %97)
  %99 = call i8* @nish_str_concat(i8* %96, i8* %98)
  %100 = call i8* @nish_str_concat(i8* %99, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %101 = load i32, i32* %sum.addr, align 4
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %100, i8* %102)
  ret i8* %103

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %counts.addr = alloca %struct.nish_array*, align 8
  %summary.addr = alloca %struct.nish_array*, align 8
  %raw.addr = alloca %struct.Channel$str*, align 8
  %cooked.addr = alloca %struct.Channel$str*, align 8
  %back.addr = alloca %struct.Channel$str*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %mine.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %s.addr.1 = alloca i8*, align 8
  %chan.slot = alloca i64, align 8
  %c.addr = alloca i32, align 4
  %gl.addr = alloca i32, align 4
  %s.addr.2 = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  store %struct.nish_array* %1, %struct.nish_array** %counts.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 1, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = call i8* @nish_alloc_struct(i64 8)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %15 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %12, %struct.nish_array** %summary.addr, align 8
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.Channel$str*
  call void @nish.Channel$str.constructor(%struct.Channel$str* %20)
  store %struct.Channel$str* %20, %struct.Channel$str** %raw.addr, align 8
  %21 = call i8* @nish_alloc_struct(i64 24)
  %22 = bitcast i8* %21 to %struct.Channel$str*
  call void @nish.Channel$str.constructor(%struct.Channel$str* %22)
  store %struct.Channel$str* %22, %struct.Channel$str** %cooked.addr, align 8
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.Channel$str*
  call void @nish.Channel$str.constructor(%struct.Channel$str* %24)
  store %struct.Channel$str* %24, %struct.Channel$str** %back.addr, align 8
  %25 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %25, %struct.ThreadScope** %s.addr, align 8
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %27 = bitcast %struct.ThreadScope* %26 to i8*
  %28 = load %struct.Channel$str*, %struct.Channel$str** %raw.addr, align 8
  %29 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %28, i32 0, i32 2
  %30 = load %struct.Channel$str*, %struct.Channel$str** %cooked.addr, align 8
  %31 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %30, i32 0, i32 2
  %32 = load %struct.Channel$str*, %struct.Channel$str** %back.addr, align 8
  %33 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %32, i32 0, i32 2
  %34 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %35 = call i8* @nish_alloc_struct(i64 24)
  %36 = bitcast i8* %35 to %struct.Source*
  %37 = load %struct.Channel$str*, %struct.Channel$str** %raw.addr, align 8
  call void @Source.constructor(%struct.Source* %36, %struct.Channel$str* %37, i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*), i32 3000)
  %38 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  call void @nish.ThreadScope.spawn$$Source$i32$fn.7.produce(%struct.ThreadScope* %34, %struct.Source* %36, %struct.nish_array* %38, i32 0)
  %39 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %40 = call i8* @nish_alloc_struct(i64 24)
  %41 = bitcast i8* %40 to %struct.Source*
  %42 = load %struct.Channel$str*, %struct.Channel$str** %raw.addr, align 8
  call void @Source.constructor(%struct.Source* %41, %struct.Channel$str* %42, i8* bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), i32 2000)
  %43 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  call void @nish.ThreadScope.spawn$$Source$i32$fn.7.produce(%struct.ThreadScope* %39, %struct.Source* %41, %struct.nish_array* %43, i32 1)
  %44 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %45 = call i8* @nish_alloc_struct(i64 24)
  %46 = bitcast i8* %45 to %struct.Source*
  %47 = load %struct.Channel$str*, %struct.Channel$str** %back.addr, align 8
  call void @Source.constructor(%struct.Source* %46, %struct.Channel$str* %47, i8* bitcast ({ i64, [6 x i8] }* @.str.11 to i8*), i32 500)
  %48 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  call void @nish.ThreadScope.spawn$$Source$i32$fn.7.produce(%struct.ThreadScope* %44, %struct.Source* %46, %struct.nish_array* %48, i32 3)
  %49 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %50 = call i8* @nish_alloc_struct(i64 16)
  %51 = bitcast i8* %50 to %struct.Stage*
  %52 = load %struct.Channel$str*, %struct.Channel$str** %raw.addr, align 8
  %53 = load %struct.Channel$str*, %struct.Channel$str** %cooked.addr, align 8
  call void @Stage.constructor(%struct.Stage* %51, %struct.Channel$str* %52, %struct.Channel$str* %53)
  %54 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  call void @nish.ThreadScope.spawn$$Stage$i32$fn.7.rewrite(%struct.ThreadScope* %49, %struct.Stage* %51, %struct.nish_array* %54, i32 2)
  %55 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %56 = call i8* @nish_alloc_struct(i64 8)
  %57 = bitcast i8* %56 to %struct.Sink*
  %58 = load %struct.Channel$str*, %struct.Channel$str** %cooked.addr, align 8
  call void @Sink.constructor(%struct.Sink* %57, %struct.Channel$str* %58)
  %59 = load %struct.nish_array*, %struct.nish_array** %summary.addr, align 8
  call void @nish.ThreadScope.spawn$$Sink$str$fn.7.consume(%struct.ThreadScope* %55, %struct.Sink* %57, %struct.nish_array* %59, i32 0)
  call void @nish_channel_count(i64* %29, i64 -1)
  call void @nish_channel_count(i64* %31, i64 -1)
  call void @nish_channel_count(i64* %33, i64 -1)
  call void @nish_scope_join(i8* %27)
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %mine.addr, align 8
  %63 = load %struct.Channel$str*, %struct.Channel$str** %back.addr, align 8
  %64 = getelementptr inbounds %struct.Channel$str, %struct.Channel$str* %63, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %65 = call i32 @nish_channel_receive(i64* %64, i64* %chan.slot)
  %66 = icmp ne i32 %65, 0
  br i1 %66, label %chan.body, label %chan.end

chan.body:
  %67 = load i64, i64* %chan.slot, align 8
  %68 = inttoptr i64 %67 to i8*
  %69 = call i8* @nish_cross_in(i8* %68, i64 0)
  store i8* %69, i8** %s.addr.1, align 8
  %70 = load %struct.nish_array*, %struct.nish_array** %mine.addr, align 8
  %71 = load i8*, i8** %s.addr.1, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 1
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %76 = icmp eq i64 %73, %75
  br i1 %76, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %70, i64 8)
  br label %push.store

push.store:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = bitcast i8* %78 to i8**
  %80 = getelementptr inbounds i8*, i8** %79, i64 %73
  store i8* %71, i8** %80, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = add i64 %73, 1
  store i64 %81, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = trunc i64 %81 to i32
  br label %chan.recv

chan.end:
  %83 = call i32 @churn()
  store i32 %83, i32* %c.addr, align 4
  store i32 0, i32* %gl.addr, align 4
  %84 = load %struct.nish_array*, %struct.nish_array** %mine.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %85 = load i64, i64* %forof.idx, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = icmp ult i64 %85, %87
  br i1 %88, label %forof.body, label %forof.end

forof.body:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i8**
  %92 = getelementptr inbounds i8*, i8** %91, i64 %85
  %93 = load i8*, i8** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %93, i8** %s.addr.2, align 8
  %94 = load i32, i32* %gl.addr, align 4
  %95 = load i8*, i8** %s.addr.2, align 8
  %96 = bitcast i8* %95 to i64*
  %97 = load i64, i64* %96, align 8
  %98 = trunc i64 %97 to i32
  %99 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %94, i32 %98)
  %100 = extractvalue { i32, i1 } %99, 0
  %101 = extractvalue { i32, i1 } %99, 1
  br i1 %101, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %100, i32* %gl.addr, align 4
  br label %forof.inc

forof.inc:
  %102 = load i64, i64* %forof.idx, align 8
  %103 = add i64 %102, 1
  store i64 %103, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %104 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = icmp ult i64 0, %106
  br i1 %107, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %106)
  unreachable

bounds.ok:
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %110 = bitcast i8* %109 to i32*
  %111 = getelementptr inbounds i32, i32* %110, i64 0
  %112 = load i32, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  %113 = call i8* @nish_str_from_i32(i32 %112)
  %114 = call i8* @nish_str_concat(i8* %113, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %115 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 0
  %117 = load i64, i64* %116, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %118 = icmp ult i64 1, %117
  br i1 %118, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %117)
  unreachable

bounds.ok.1:
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %115, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %121 = bitcast i8* %120 to i32*
  %122 = getelementptr inbounds i32, i32* %121, i64 1
  %123 = load i32, i32* %122, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  %124 = call i8* @nish_str_from_i32(i32 %123)
  %125 = call i8* @nish_str_concat(i8* %114, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %127 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 0
  %129 = load i64, i64* %128, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %130 = icmp ult i64 2, %129
  br i1 %130, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %129)
  unreachable

bounds.ok.2:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %133 = bitcast i8* %132 to i32*
  %134 = getelementptr inbounds i32, i32* %133, i64 2
  %135 = load i32, i32* %134, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  %136 = call i8* @nish_str_from_i32(i32 %135)
  %137 = call i8* @nish_str_concat(i8* %126, i8* %136)
  %138 = call i8* @nish_str_concat(i8* %137, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %139 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %142 = icmp ult i64 3, %141
  br i1 %142, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %141)
  unreachable

bounds.ok.3:
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %145 = bitcast i8* %144 to i32*
  %146 = getelementptr inbounds i32, i32* %145, i64 3
  %147 = load i32, i32* %146, align 4, !alias.scope !4, !noalias !3, !tbaa !27
  %148 = call i8* @nish_str_from_i32(i32 %147)
  %149 = call i8* @nish_str_concat(i8* %138, i8* %148)
  call void @nish_print(i8* %149)
  %150 = load %struct.nish_array*, %struct.nish_array** %summary.addr, align 8
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %150, i64 0, i32 0
  %152 = load i64, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %153 = icmp ult i64 0, %152
  br i1 %153, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %152)
  unreachable

bounds.ok.4:
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %150, i64 0, i32 2
  %155 = load i8*, i8** %154, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %156 = bitcast i8* %155 to i8**
  %157 = getelementptr inbounds i8*, i8** %156, i64 0
  %158 = load i8*, i8** %157, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_print(i8* %158)
  %159 = load %struct.nish_array*, %struct.nish_array** %mine.addr, align 8
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 0
  %161 = load i64, i64* %160, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %162 = trunc i64 %161 to i32
  %163 = call i8* @nish_str_from_i32(i32 %162)
  %164 = call i8* @nish_str_concat(i8* %163, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %165 = load i32, i32* %gl.addr, align 4
  %166 = call i8* @nish_str_from_i32(i32 %165)
  %167 = call i8* @nish_str_concat(i8* %164, i8* %166)
  %168 = call i8* @nish_str_concat(i8* %167, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %169 = load i32, i32* %c.addr, align 4
  %170 = call i8* @nish_str_from_i32(i32 %169)
  %171 = call i8* @nish_str_concat(i8* %168, i8* %170)
  call void @nish_print(i8* %171)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

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
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { nounwind willreturn readnone }
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"i32", !6, i64 0}
!17 = !{!"Source", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"Stage", !15, i64 0, !15, i64 8}
!22 = !{!21, !15, i64 0}
!23 = !{!21, !15, i64 8}
!24 = !{!"Sink", !15, i64 0}
!25 = !{!24, !15, i64 0}
!26 = !{!"element i32", !6, i64 0}
!27 = !{!26, !26, i64 0}
