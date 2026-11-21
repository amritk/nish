%struct.Word = type { i8* }
%struct.Words = type { { %struct.nish_array, [3 x %struct.Word*] } }
%struct.Tally = type { %struct.Map$$Word$i32* }
%struct.Map$$Word$i32 = type { i32, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"alpha\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"beta\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"gamma\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_region_new() #0
declare noundef i64 @nish_region_child_new() #0
declare i8* @nish_region_enter(i64 noundef) #0
declare void @nish_region_leave(i64 noundef, i8*) #0
declare void @nish_region_free(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

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

define internal void @Word.constructor(%struct.Word* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = getelementptr inbounds %struct.Word, %struct.Word* %this, i32 0, i32 0
  store i8* %text, i8** %0, align 8, !tbaa !4
  ret void
}

define internal void @Words.constructor(%struct.Words* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Word*
  call void @Word.constructor(%struct.Word* %1, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Word*
  call void @Word.constructor(%struct.Word* %3, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = bitcast i8* %4 to %struct.Word*
  call void @Word.constructor(%struct.Word* %5, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %6 = getelementptr inbounds %struct.Words, %struct.Words* %this, i32 0, i32 0, i32 0
  %7 = getelementptr inbounds %struct.Words, %struct.Words* %this, i32 0, i32 0, i32 1, i64 0
  %8 = bitcast %struct.Word** %7 to i8*
  %9 = bitcast i8* %8 to %struct.Word**
  %10 = getelementptr inbounds %struct.Word*, %struct.Word** %9, i64 0
  store %struct.Word* %1, %struct.Word** %10, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %11 = getelementptr inbounds %struct.Word*, %struct.Word** %9, i64 1
  store %struct.Word* %3, %struct.Word** %11, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %12 = getelementptr inbounds %struct.Word*, %struct.Word** %9, i64 2
  store %struct.Word* %5, %struct.Word** %12, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 3, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  ret void
}

define internal void @Tally.constructor(%struct.Tally* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Words* noundef nonnull readonly align 8 dereferenceable(48) nocapture %words) #1 {
entry:
  %pass.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %word.addr = alloca %struct.Word*, align 8
  %0 = call i8* @nish_alloc_struct(i64 56)
  %1 = bitcast i8* %0 to %struct.Map$$Word$i32*
  call void @nish.Map$$Word$i32.constructor(%struct.Map$$Word$i32* %1)
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %this, i32 0, i32 0
  store %struct.Map$$Word$i32* %1, %struct.Map$$Word$i32** %2, align 8, !tbaa !17
  store i32 0, i32* %pass.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %pass.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  store i32 0, i32* %k.addr, align 4
  br label %for.cond.1

for.cond.1:
  %5 = load i32, i32* %k.addr, align 4
  %6 = load i32, i32* %pass.addr, align 4
  %7 = icmp sle i32 %5, %6
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %k.addr, align 4
  %9 = getelementptr inbounds %struct.Words, %struct.Words* %words, i32 0, i32 0, i32 0
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %12 = trunc i64 %11 to i32
  %13 = icmp slt i32 %8, %12
  br label %land.end

land.end:
  %14 = phi i1 [ false, %for.cond.1 ], [ %13, %land.rhs ]
  br i1 %14, label %for.body.1, label %for.end.1

for.body.1:
  %15 = getelementptr inbounds %struct.Words, %struct.Words* %words, i32 0, i32 0, i32 0
  %16 = load i32, i32* %k.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.Words, %struct.Words* %words, i32 0, i32 0, i32 1, i64 0
  %19 = bitcast %struct.Word** %18 to i8*
  %20 = bitcast i8* %19 to %struct.Word**
  %21 = getelementptr inbounds %struct.Word*, %struct.Word** %20, i64 %17
  %22 = load %struct.Word*, %struct.Word** %21, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  store %struct.Word* %22, %struct.Word** %word.addr, align 8
  %23 = getelementptr inbounds %struct.Tally, %struct.Tally* %this, i32 0, i32 0
  %24 = load %struct.Map$$Word$i32*, %struct.Map$$Word$i32** %23, align 8, !tbaa !17
  %25 = load %struct.Word*, %struct.Word** %word.addr, align 8
  %26 = call i64 @nish.Map$$Word$i32.probe(%struct.Map$$Word$i32* %24, %struct.Word* %25)
  %27 = icmp sge i64 %26, 0
  br i1 %27, label %nullish.value, label %nullish.default

nullish.value:
  %28 = trunc i64 %26 to i32
  %29 = call i32 @nish.Map$$Word$i32.valueAt(%struct.Map$$Word$i32* %24, i32 %28, i32 zeroinitializer)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %30 = phi i32 [ %29, %nullish.value ], [ 0, %nullish.default ]
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 1)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok

ovf.ok:
  br i1 %27, label %set.found, label %set.insert

set.found:
  %34 = trunc i64 %26 to i32
  call void @nish.Map$$Word$i32.setValueAt(%struct.Map$$Word$i32* %24, i32 %34, i32 %32)
  br label %set.end

set.insert:
  call void @nish.Map$$Word$i32.insertAt(%struct.Map$$Word$i32* %24, i64 %26, %struct.Word* %25, i32 %32)
  br label %set.end

set.end:
  br label %for.inc.1

for.inc.1:
  %35 = load i32, i32* %k.addr, align 4
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %37 = load i32, i32* %pass.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %pass.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef nonnull align 8 dereferenceable(48) %struct.Words* @load$() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Words*
  %2 = getelementptr inbounds %struct.Words, %struct.Words* %1, i32 0, i32 0, i32 0
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 3, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %5 = getelementptr inbounds %struct.Words, %struct.Words* %1, i32 0, i32 0, i32 1, i64 0
  %6 = bitcast %struct.Word** %5 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  call void @Words.constructor(%struct.Words* %1)
  ret %struct.Words* %1
}

define hidden noundef nonnull align 8 dereferenceable(8) %struct.Tally* @count$(%struct.Words* noundef nonnull readonly align 8 dereferenceable(48) nocapture %words) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Tally*
  call void @Tally.constructor(%struct.Tally* %1, %struct.Words* %words)
  ret %struct.Tally* %1
}

define hidden noundef i64 @tally$(%struct.Words* noundef nonnull readonly align 8 dereferenceable(48) nocapture %words) #1 {
entry:
  %0 = call i64 @nish.childWith$$Words$$Tally$fn.5.count(%struct.Words* %words)
  ret i64 %0
}

define hidden noundef i32 @report$(%struct.Tally* noundef nonnull readonly align 8 dereferenceable(8) nocapture %t) #1 {
entry:
  %total.addr = alloca i32, align 4
  %word.addr = alloca %struct.Word*, align 8
  %walk.idx = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  %0 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %1 = load %struct.Map$$Word$i32*, %struct.Map$$Word$i32** %0, align 8, !tbaa !17
  call void @nish.Map$$Word$i32.walkOpen(%struct.Map$$Word$i32* %1)
  %2 = call i32 @nish.Map$$Word$i32.walkNext(%struct.Map$$Word$i32* %1, i32 0)
  store i32 %2, i32* %walk.idx, align 4
  br label %walk.cond

walk.cond:
  %3 = load i32, i32* %walk.idx, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %walk.body, label %walk.end

walk.body:
  %5 = call %struct.Word* @nish.Map$$Word$i32.keyAt(%struct.Map$$Word$i32* %1, i32 %3, %struct.Word* zeroinitializer)
  store %struct.Word* %5, %struct.Word** %word.addr, align 8
  %6 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %7 = load i8*, i8** %6, align 8
  %8 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %9 = load i64, i64* %8, align 8
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %11 = load %struct.Map$$Word$i32*, %struct.Map$$Word$i32** %10, align 8, !tbaa !17
  %12 = load %struct.Word*, %struct.Word** %word.addr, align 8
  %13 = call i64 @nish.Map$$Word$i32.probe(%struct.Map$$Word$i32* %11, %struct.Word* %12)
  %14 = icmp sge i64 %13, 0
  br i1 %14, label %nullish.value, label %nullish.default

nullish.value:
  %15 = trunc i64 %13 to i32
  %16 = call i32 @nish.Map$$Word$i32.valueAt(%struct.Map$$Word$i32* %11, i32 %15, i32 zeroinitializer)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %17 = phi i32 [ %16, %nullish.value ], [ 0, %nullish.default ]
  store i32 %17, i32* %n.addr, align 4
  %18 = load %struct.Word*, %struct.Word** %word.addr, align 8
  %19 = getelementptr inbounds %struct.Word, %struct.Word* %18, i32 0, i32 0
  %20 = load i8*, i8** %19, align 8, !tbaa !4
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %22 = load i32, i32* %n.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %21, i8* %23)
  call void @nish_print(i8* %24)
  %25 = load i32, i32* %total.addr, align 4
  %26 = load i32, i32* %n.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %28, i32* %total.addr, align 4
  %30 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %31 = load i8*, i8** %30, align 8
  %32 = icmp eq i8* %31, %7
  br i1 %32, label %pass.rewind, label %pass.free

pass.rewind:
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %9, i64* %33, align 8
  br label %pass.done

pass.free:
  %34 = ptrtoint i8* %7 to i64
  %35 = add i64 %34, %9
  call void @nish_arena_release(i64 %35)
  br label %pass.done

pass.done:
  br label %walk.inc

walk.inc:
  %36 = add i32 %3, 1
  %37 = call i32 @nish.Map$$Word$i32.walkNext(%struct.Map$$Word$i32* %1, i32 %36)
  store i32 %37, i32* %walk.idx, align 4
  br label %walk.cond

walk.end:
  call void @nish.Map$$Word$i32.walkClose(%struct.Map$$Word$i32* %1)
  %38 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %38

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %parent.addr = alloca i64, align 8
  %child.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish.region$$Words$fn.4.load()
  store i64 %0, i64* %parent.addr, align 8
  %1 = load i64, i64* %parent.addr, align 8
  %2 = call i64 @nish.enter$$Words$rgn.$Tally$fn.5.tally(i64 %1)
  store i64 %2, i64* %child.addr, align 8
  %3 = load i64, i64* %child.addr, align 8
  %4 = call i32 @nish.enter$$Tally$i32$fn.6.report(i64 %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load i64, i64* %parent.addr, align 8
  call void @nish.free$$Words(i64 %6)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i64 @nish.handleNew() #1 {
entry:
  %0 = call i64 @nish_region_new()
  ret i64 %0
}

define internal void @nish.open(i64 noundef %h) #1 {
entry:
  call i8* @nish_region_enter(i64 %h)
  ret void
}

define internal noundef i64 @nish.childNew() #1 {
entry:
  %0 = call i64 @nish_region_child_new()
  ret i64 %0
}

define internal noundef i64 @nish.childWith$$Words$$Tally$fn.5.count(%struct.Words* noundef nonnull readonly align 8 dereferenceable(48) nocapture %arg) #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.childNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Tally* @count$(%struct.Words* %arg)
  %4 = call i64 @nish.close$$Tally(i64 %2, %struct.Tally* %3)
  ret i64 %4
}

define internal noundef i64 @nish.region$$Words$fn.4.load() #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Words* @load$()
  %4 = call i64 @nish.close$$Words(i64 %2, %struct.Words* %3)
  ret i64 %4
}

define internal noundef i64 @nish.enter$$Words$rgn.$Tally$fn.5.tally(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Words*, align 8
  %result.addr = alloca i64, align 8
  %0 = call %struct.Words* @nish.reopen$$Words(i64 %r)
  store %struct.Words* %0, %struct.Words** %root.addr, align 8
  %1 = load %struct.Words*, %struct.Words** %root.addr, align 8
  %2 = call i64 @tally$(%struct.Words* %1)
  store i64 %2, i64* %result.addr, align 8
  %3 = load %struct.Words*, %struct.Words** %root.addr, align 8
  call void @nish.leave$$Words(i64 %r, %struct.Words* %3)
  %4 = load i64, i64* %result.addr, align 8
  ret i64 %4
}

define internal noundef i32 @nish.enter$$Tally$i32$fn.6.report(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Tally*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Tally* @nish.reopen$$Tally(i64 %r)
  store %struct.Tally* %0, %struct.Tally** %root.addr, align 8
  %1 = load %struct.Tally*, %struct.Tally** %root.addr, align 8
  %2 = call i32 @report$(%struct.Tally* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Tally*, %struct.Tally** %root.addr, align 8
  call void @nish.leave$$Tally(i64 %r, %struct.Tally* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$$Words(i64 noundef %_r) #1 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.close$$Tally(i64 noundef %h, %struct.Tally* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Tally* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef i64 @nish.close$$Words(i64 noundef %h, %struct.Words* noundef nonnull align 8 dereferenceable(48) %root) #1 {
entry:
  %0 = bitcast %struct.Words* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Words* @nish.reopen$$Words(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Words*
  ret %struct.Words* %1
}

define internal void @nish.leave$$Words(i64 noundef %r, %struct.Words* noundef nonnull align 8 dereferenceable(48) %root) #1 {
entry:
  %0 = bitcast %struct.Words* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Tally* @nish.reopen$$Tally(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Tally*
  ret %struct.Tally* %1
}

define internal void @nish.leave$$Tally(i64 noundef %r, %struct.Tally* noundef nonnull align 8 dereferenceable(8) %root) #1 {
entry:
  %0 = bitcast %struct.Tally* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #2 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %mask, i32 noundef %index) #2 {
entry:
  %0 = xor i32 %mask, -1
  %1 = and i32 %h, %0
  %2 = add i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #2 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #2 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = zext i32 %h to i64
  %3 = or i64 %1, %2
  %4 = xor i64 %3, -1
  ret i64 %4
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #1 {
entry:
  %word.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %mask, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = load i32, i32* %bucket.addr, align 4
  store i32 %2, i32* %b.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %while.cond

while.cond:
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = trunc i64 %4 to i32
  %11 = icmp slt i32 %9, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %b.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %6 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %b.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %6 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add i32 %24, 1
  %26 = load i32, i32* %low.addr, align 4
  %27 = and i32 %25, %26
  store i32 %27, i32* %bucket.addr, align 4
  %28 = load i32, i32* %bucket.addr, align 4
  store i32 %28, i32* %b.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %for.cond

for.cond:
  %5 = load i32, i32* %from.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %from.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  store i32 %12, i32* %h.addr, align 4
  %13 = load i32, i32* %h.addr, align 4
  %14 = icmp ne i32 %13, 0
  br i1 %14, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %15 = load i32, i32* %to.addr, align 4
  %16 = icmp sge i32 %15, 0
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %for.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %to.addr, align 4
  %19 = load i32, i32* %used.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %land.end.1 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load i32, i32* %to.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %h.addr, align 4
  %25 = bitcast i8* %4 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 %23
  store i32 %24, i32* %26, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %27 = load i32, i32* %to.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %from.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %to.addr, align 4
  %35 = icmp sgt i32 %33, %34
  br i1 %35, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %38 = trunc i64 %37 to i32
  %39 = icmp sgt i32 %38, 0
  br label %land.end.2

land.end.2:
  %40 = phi i1 [ false, %while.cond ], [ %39, %land.rhs.2 ]
  br i1 %40, label %while.body, label %while.end

while.body:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %43 = sub i64 %42, 1
  store i64 %43, i64* %41, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %43
  %48 = load i32, i32* %47, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #1 {
entry:
  %n.addr = alloca i32, align 4
  %0 = sext i32 %live to i64
  %1 = mul nsw i64 %0, 2
  %2 = sext i32 %used to i64
  %3 = icmp slt i64 %1, %2
  br i1 %3, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %n.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = icmp sge i32 %7, 0
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %n.addr, align 4
  %10 = icmp slt i32 %9, 32768
  br label %land.end

land.end:
  %11 = phi i1 [ false, %if.end ], [ %10, %land.rhs ]
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = load i32, i32* %n.addr, align 4
  %13 = mul nsw i32 %12, 2
  %14 = trunc i32 %13 to i16
  %15 = zext i16 %14 to i64
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %15, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %15, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %20 = mul i64 %15, 4
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !9, !noalias !8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  ret %struct.nish_array* %17

if.end.1:
  call void @nish.widenSlots(%struct.nish_array* %slots, i32 2)
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots
}

define internal void @nish.widenSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %times) #0 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, %times
  br i1 %4, label %for.body, label %for.end

for.body:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %slots, i64 4)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %15 = bitcast i8* %14 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %9
  store i32 0, i32* %16, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = trunc i64 %17 to i32
  br label %for.inc.1

for.inc.1:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = trunc i64 %1 to i32
  %3 = sub nsw i32 %2, 1
  store i32 %3, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %5 to i32
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = bitcast i8* %7 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %12
  %15 = load i32, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  store i32 %15, i32* %h.addr, align 4
  %16 = load i32, i32* %h.addr, align 4
  %17 = icmp ne i32 %16, 0
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %mask.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %18, i32 %19, i32 %20)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %8
  store i32 0, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @nish.nextLive(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, i32 noundef %from) #3 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %from, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sge i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp slt i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ]
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = bitcast i8* %3 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %11
  %14 = load i32, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %i.addr, align 4
  ret i32 %16

if.end:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define internal noundef zeroext i1 @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %size.addr, align 4
  %6 = load i32, i32* %used.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = mul nsw i64 %7, 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = mul nsw i64 %10, 3
  %12 = icmp sgt i64 %8, %11
  br i1 %12, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %13 = icmp slt i32 %bucket, 0
  br label %lor.end.1

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ]
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = load i32, i32* %size.addr, align 4
  %16 = icmp sge i32 %bucket, %15
  br label %lor.end

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %18 = load i32, i32* %used.addr, align 4
  %19 = icmp sgt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = sext i32 %bucket to i64
  %21 = load i32, i32* %used.addr, align 4
  %22 = sub nsw i32 %21, 1
  %23 = sext i32 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %23
  %28 = load i32, i32* %27, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %29 = load i32, i32* %used.addr, align 4
  %30 = sub nsw i32 %29, 1
  %31 = call i32 @nish.slotWord(i32 %28, i32 %mask, i32 %30)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %20
  store i32 %31, i32* %35, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  br label %if.end.1

if.end.1:
  ret i1 true
}

define internal void @nish.Map$$Word$i32.constructor(%struct.Map$$Word$i32* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !24
  %1 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !25
  %2 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !26
  %3 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 7
  store i32 0, i32* %3, align 4, !tbaa !27
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 8, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 8, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %8 = mul i64 8, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !9, !noalias !8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %11 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !28
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %17 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !29
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %23 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !30
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %29 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !31
  ret void
}

define internal noundef i64 @nish.Map$$Word$i32.probe(%struct.Map$$Word$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, %struct.Word* noundef nonnull readonly align 8 dereferenceable(8) nocapture %key) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !25
  %4 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !31
  %6 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !29
  %8 = call i64 @nish.probeTable$$Word(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, %struct.Word* %key)
  ret i64 %8
}

define internal void @nish.Map$$Word$i32.walkOpen(%struct.Map$$Word$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !27
  %2 = add i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !27
  ret void
}

define internal noundef i32 @nish.Map$$Word$i32.walkNext(%struct.Map$$Word$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %from) #3 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !31
  %2 = call i32 @nish.nextLive(%struct.nish_array* %1, i32 %from)
  ret i32 %2
}

define internal void @nish.Map$$Word$i32.walkClose(%struct.Map$$Word$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 7
  %1 = load i32, i32* %0, align 4, !tbaa !27
  %2 = sub i32 %1, 1
  %3 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 7
  store i32 %2, i32* %3, align 4, !tbaa !27
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Word* @nish.Map$$Word$i32.keyAt(%struct.Map$$Word$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, %struct.Word* noundef nonnull align 8 dereferenceable(8) %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !29
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 4
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !29
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %13 = bitcast i8* %12 to %struct.Word**
  %14 = getelementptr inbounds %struct.Word*, %struct.Word** %13, i64 %10
  %15 = load %struct.Word*, %struct.Word** %14, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  ret %struct.Word* %15

if.end:
  ret %struct.Word* %none
}

define internal noundef i32 @nish.Map$$Word$i32.valueAt(%struct.Map$$Word$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %none) #4 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !30
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !30
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  %15 = load i32, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  ret i32 %15

if.end:
  ret i32 %none
}

define internal void @nish.Map$$Word$i32.setValueAt(%struct.Map$$Word$i32* noundef nonnull readonly align 8 dereferenceable(56) nocapture %this, i32 noundef %index, i32 noundef %value) #0 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !30
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %index, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 5
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !30
  %10 = sext i32 %index to i64
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %10
  store i32 %value, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$$Word$i32.insertAt(%struct.Map$$Word$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this, i64 noundef %absent, %struct.Word* noundef nonnull align 8 dereferenceable(8) %key, i32 noundef %value) #1 {
entry:
  %packed.addr = alloca i64, align 8
  %0 = sub nsw i64 -1, %absent
  store i64 %0, i64* %packed.addr, align 8
  %1 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 4
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !29
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  %6 = load i64, i64* %5, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %7 = icmp eq i64 %4, %6
  br i1 %7, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %2, i64 8)
  br label %push.store

push.store:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %10 = bitcast i8* %9 to %struct.Word**
  %11 = getelementptr inbounds %struct.Word*, %struct.Word** %10, i64 %4
  store %struct.Word* %key, %struct.Word** %11, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %12 = add i64 %4, 1
  store i64 %12, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %13 = trunc i64 %12 to i32
  %14 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 5
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !30
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %15, i64 4)
  br label %push.store.1

push.store.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  store i32 %value, i32* %24, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !31
  %29 = load i64, i64* %packed.addr, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %28, i64 4)
  br label %push.store.2

push.store.2:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %32
  store i32 %30, i32* %39, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %41 = trunc i64 %40 to i32
  call void @nish.Map$$Word$i32.addOne(%struct.Map$$Word$i32* %this)
  %42 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 1
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !28
  %44 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 2
  %45 = load i32, i32* %44, align 4, !tbaa !25
  %46 = load i64, i64* %packed.addr, align 8
  %47 = ashr i64 %46, 32
  %48 = trunc i64 %47 to i32
  %49 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !31
  %51 = call i1 @nish.fileAppended(%struct.nish_array* %43, i32 %45, i32 %48, %struct.nish_array* %50)
  %52 = xor i1 %51, true
  br i1 %52, label %if.then, label %if.end

if.then:
  call void @nish.Map$$Word$i32.rebuild(%struct.Map$$Word$i32* %this)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$$Word$i32.addOne(%struct.Map$$Word$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %live.addr = alloca i32, align 4
  %size.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !26
  store i32 %1, i32* %live.addr, align 4
  %2 = load i32, i32* %live.addr, align 4
  %3 = icmp slt i32 %2, 2147483647
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %live.addr, align 4
  %5 = add nsw i32 %4, 1
  %6 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 3
  store i32 %5, i32* %6, align 4, !tbaa !26
  br label %if.end

if.end:
  %7 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 0
  %8 = load i32, i32* %7, align 4, !tbaa !24
  store i32 %8, i32* %size.addr, align 4
  %9 = load i32, i32* %size.addr, align 4
  %10 = icmp slt i32 %9, 2147483647
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = load i32, i32* %size.addr, align 4
  %12 = add nsw i32 %11, 1
  %13 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 0
  store i32 %12, i32* %13, align 4, !tbaa !24
  br label %if.end.1

if.end.1:
  ret void
}

define internal void @nish.Map$$Word$i32.rebuild(%struct.Map$$Word$i32* noundef nonnull align 8 dereferenceable(56) nocapture %this) #1 {
entry:
  %used.addr = alloca i32, align 4
  %walking.addr = alloca i1, align 1
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !29
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %used.addr, align 4
  %5 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 7
  %6 = load i32, i32* %5, align 4, !tbaa !27
  %7 = icmp ugt i32 %6, 0
  store i1 %7, i1* %walking.addr, align 1
  %8 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 1
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !28
  %10 = load i1, i1* %walking.addr, align 1
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %used.addr, align 4
  br label %cond.end

cond.false:
  %12 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !26
  br label %cond.end

cond.end:
  %14 = phi i32 [ %11, %cond.true ], [ %13, %cond.false ]
  %15 = load i32, i32* %used.addr, align 4
  %16 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %9, i32 %14, i32 %15)
  store %struct.nish_array* %16, %struct.nish_array** %slots.addr, align 8
  %17 = load i1, i1* %walking.addr, align 1
  %18 = xor i1 %17, true
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 3
  %20 = load i32, i32* %19, align 4, !tbaa !26
  %21 = load i32, i32* %used.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %cond.end ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  %24 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 4
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !29
  %26 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !31
  call void @nish.compactEntries$$Word(%struct.nish_array* %25, %struct.nish_array* %27)
  %28 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 5
  %29 = load %struct.nish_array*, %struct.nish_array** %28, align 8, !tbaa !30
  %30 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !31
  call void @nish.compactEntries$i32(%struct.nish_array* %29, %struct.nish_array* %31)
  %32 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !31
  call void @nish.compactHashes(%struct.nish_array* %33)
  br label %if.end

if.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %35 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 1
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !28
  %36 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %39 = trunc i64 %38 to i32
  %40 = sub nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 2
  store i32 %40, i32* %41, align 4, !tbaa !25
  %42 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %43 = getelementptr inbounds %struct.Map$$Word$i32, %struct.Map$$Word$i32* %this, i32 0, i32 6
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !31
  call void @nish.refile(%struct.nish_array* %42, %struct.nish_array* %44)
  ret void
}

define internal noundef i64 @nish.probeTable$$Word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, %struct.Word* noundef nonnull readonly align 8 dereferenceable(8) nocapture %key) #3 {
entry:
  %h.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = ptrtoint %struct.Word* %key to i64
  %1 = lshr i64 %0, 33
  %2 = xor i64 %0, %1
  %3 = mul i64 %2, -49064778989728563
  %4 = lshr i64 %3, 33
  %5 = xor i64 %3, %4
  %6 = mul i64 %5, -4265267296055464877
  %7 = lshr i64 %6, 33
  %8 = xor i64 %6, %7
  %9 = trunc i64 %8 to i32
  %10 = lshr i64 %8, 32
  %11 = trunc i64 %10 to i32
  %12 = xor i32 %9, %11
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  store i32 %mask, i32* %low.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = load i32, i32* %low.addr, align 4
  %17 = xor i32 %16, -1
  %18 = and i32 %15, %17
  store i32 %18, i32* %fingerprint.addr, align 4
  %19 = load i32, i32* %h.addr, align 4
  %20 = call i32 @nish.homeBucket(i32 %19, i32 %mask)
  store i32 %20, i32* %bucket.addr, align 4
  %21 = load i32, i32* %bucket.addr, align 4
  store i32 %21, i32* %b.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %while.cond

while.cond:
  %34 = load i32, i32* %b.addr, align 4
  %35 = icmp sge i32 %34, 0
  br i1 %35, label %land.rhs, label %land.end

land.rhs:
  %36 = load i32, i32* %b.addr, align 4
  %37 = trunc i64 %23 to i32
  %38 = icmp slt i32 %36, %37
  br label %land.end

land.end:
  %39 = phi i1 [ false, %while.cond ], [ %38, %land.rhs ]
  br i1 %39, label %while.body, label %while.end

while.body:
  %40 = load i32, i32* %b.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %25 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %41
  %44 = load i32, i32* %43, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  store i32 %44, i32* %word.addr, align 4
  %45 = load i32, i32* %word.addr, align 4
  %46 = icmp eq i32 %45, 0
  br i1 %46, label %if.then, label %if.end

if.then:
  %47 = load i32, i32* %b.addr, align 4
  %48 = load i32, i32* %h.addr, align 4
  %49 = tail call i64 @nish.absentAt(i32 %47, i32 %48)
  ret i64 %49

if.end:
  %50 = load i32, i32* %word.addr, align 4
  %51 = load i32, i32* %low.addr, align 4
  %52 = xor i32 %51, -1
  %53 = and i32 %50, %52
  %54 = load i32, i32* %fingerprint.addr, align 4
  %55 = icmp eq i32 %53, %54
  br i1 %55, label %if.then.1, label %if.end.1

if.then.1:
  %56 = load i32, i32* %word.addr, align 4
  %57 = load i32, i32* %low.addr, align 4
  %58 = and i32 %56, %57
  %59 = sub i32 %58, 1
  store i32 %59, i32* %at.addr, align 4
  %60 = load i32, i32* %at.addr, align 4
  %61 = icmp sge i32 %60, 0
  br i1 %61, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %62 = load i32, i32* %at.addr, align 4
  %63 = trunc i64 %27 to i32
  %64 = icmp slt i32 %62, %63
  br label %land.end.4

land.end.4:
  %65 = phi i1 [ false, %if.then.1 ], [ %64, %land.rhs.4 ]
  br i1 %65, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %66 = load i32, i32* %at.addr, align 4
  %67 = sext i32 %66 to i64
  %68 = bitcast i8* %29 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 %67
  %70 = load i32, i32* %69, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %71 = load i32, i32* %h.addr, align 4
  %72 = icmp eq i32 %70, %71
  br label %land.end.3

land.end.3:
  %73 = phi i1 [ false, %land.end.4 ], [ %72, %land.rhs.3 ]
  br i1 %73, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %74 = load i32, i32* %at.addr, align 4
  %75 = trunc i64 %31 to i32
  %76 = icmp slt i32 %74, %75
  br label %land.end.2

land.end.2:
  %77 = phi i1 [ false, %land.end.3 ], [ %76, %land.rhs.2 ]
  br i1 %77, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %78 = load i32, i32* %at.addr, align 4
  %79 = sext i32 %78 to i64
  %80 = bitcast i8* %33 to %struct.Word**
  %81 = getelementptr inbounds %struct.Word*, %struct.Word** %80, i64 %79
  %82 = load %struct.Word*, %struct.Word** %81, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %83 = icmp eq %struct.Word* %82, %key
  br label %land.end.1

land.end.1:
  %84 = phi i1 [ false, %land.end.2 ], [ %83, %land.rhs.1 ]
  br i1 %84, label %if.then.2, label %if.end.2

if.then.2:
  %85 = load i32, i32* %b.addr, align 4
  %86 = load i32, i32* %at.addr, align 4
  %87 = tail call i64 @nish.foundAt(i32 %85, i32 %86)
  ret i64 %87

if.end.2:
  br label %if.end.1

if.end.1:
  %88 = load i32, i32* %bucket.addr, align 4
  %89 = add i32 %88, 1
  %90 = load i32, i32* %low.addr, align 4
  %91 = and i32 %89, %90
  store i32 %91, i32* %bucket.addr, align 4
  %92 = load i32, i32* %bucket.addr, align 4
  store i32 %92, i32* %b.addr, align 4
  br label %while.cond

while.end:
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %95 = trunc i64 %94 to i32
  %96 = load i32, i32* %h.addr, align 4
  %97 = tail call i64 @nish.absentAt(i32 %95, i32 %96)
  ret i64 %97
}

define internal void @nish.compactEntries$$Word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to %struct.Word**
  %40 = getelementptr inbounds %struct.Word*, %struct.Word** %39, i64 %38
  %41 = load %struct.Word*, %struct.Word** %40, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %42 = bitcast i8* %10 to %struct.Word**
  %43 = getelementptr inbounds %struct.Word*, %struct.Word** %42, i64 %36
  store %struct.Word* %41, %struct.Word** %43, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %63 = bitcast i8* %62 to %struct.Word**
  %64 = getelementptr inbounds %struct.Word*, %struct.Word** %63, i64 %60
  %65 = load %struct.Word*, %struct.Word** %64, align 8, !alias.scope !9, !noalias !8, !tbaa !11
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #1 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  br label %for.cond

for.cond:
  %11 = load i32, i32* %from.addr, align 4
  %12 = load i32, i32* %used.addr, align 4
  %13 = icmp slt i32 %11, %12
  br i1 %13, label %land.rhs, label %land.end

land.rhs:
  %14 = load i32, i32* %from.addr, align 4
  %15 = trunc i64 %4 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end

land.end:
  %17 = phi i1 [ false, %for.cond ], [ %16, %land.rhs ]
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %from.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %6 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %23 = icmp ne i32 %22, 0
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = load i32, i32* %to.addr, align 4
  %25 = icmp sge i32 %24, 0
  br label %land.end.3

land.end.3:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs.3 ]
  br i1 %26, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %27 = load i32, i32* %to.addr, align 4
  %28 = load i32, i32* %used.addr, align 4
  %29 = icmp slt i32 %27, %28
  br label %land.end.2

land.end.2:
  %30 = phi i1 [ false, %land.end.3 ], [ %29, %land.rhs.2 ]
  br i1 %30, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %31 = load i32, i32* %from.addr, align 4
  %32 = trunc i64 %8 to i32
  %33 = icmp slt i32 %31, %32
  br label %land.end.1

land.end.1:
  %34 = phi i1 [ false, %land.end.2 ], [ %33, %land.rhs.1 ]
  br i1 %34, label %if.then, label %if.end

if.then:
  %35 = load i32, i32* %to.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %from.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = bitcast i8* %10 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %38
  %41 = load i32, i32* %40, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %42 = bitcast i8* %10 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 %36
  store i32 %41, i32* %43, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  %44 = load i32, i32* %to.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %46 = load i32, i32* %from.addr, align 4
  %47 = add nsw i32 %46, 1
  store i32 %47, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %50 = trunc i64 %49 to i32
  %51 = load i32, i32* %to.addr, align 4
  %52 = icmp sgt i32 %50, %51
  br i1 %52, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %55 = trunc i64 %54 to i32
  %56 = icmp sgt i32 %55, 0
  br label %land.end.4

land.end.4:
  %57 = phi i1 [ false, %while.cond ], [ %56, %land.rhs.4 ]
  br i1 %57, label %while.body, label %while.end

while.body:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %59 = load i64, i64* %58, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %60 = sub i64 %59, 1
  store i64 %60, i64* %58, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %63 = bitcast i8* %62 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %60
  %65 = load i32, i32* %64, align 4, !alias.scope !9, !noalias !8, !tbaa !21
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #6 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!32, !33, !34, !35, !36}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Word", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element ptr", !1, i64 0}
!11 = !{!10, !10, i64 0}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!"Tally", !2, i64 0}
!17 = !{!16, !2, i64 0}
!18 = !{!14, !12, i64 8}
!19 = !{!14, !13, i64 16}
!20 = !{!"element i32", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{!"i32", !1, i64 0}
!23 = !{!"Map$$Word$i32", !22, i64 0, !2, i64 8, !22, i64 16, !22, i64 20, !2, i64 24, !2, i64 32, !2, i64 40, !22, i64 48}
!24 = !{!23, !22, i64 0}
!25 = !{!23, !22, i64 16}
!26 = !{!23, !22, i64 20}
!27 = !{!23, !22, i64 48}
!28 = !{!23, !2, i64 8}
!29 = !{!23, !2, i64 24}
!30 = !{!23, !2, i64 32}
!31 = !{!23, !2, i64 40}
!32 = !{i32 8, !"cf-protection-branch", i32 1}
!33 = !{i32 8, !"cf-protection-return", i32 1}
!34 = !{i32 8, !"branch-target-enforcement", i32 1}
!35 = !{i32 8, !"sign-return-address", i32 1}
!36 = !{i32 4, !"probe-stack", !"inline-asm"}
