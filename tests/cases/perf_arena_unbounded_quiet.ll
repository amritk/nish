%struct.Entry = type { i32 }
%struct.Log = type { %struct.Entry*, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"request \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"cell \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"row \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4

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

define internal void @Entry.constructor(%struct.Entry* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Entry, %struct.Entry* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Entry*
  call void @Entry.constructor(%struct.Entry* %1, i32 0)
  %2 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store %struct.Entry* %1, %struct.Entry** %2, align 8, !tbaa !7
  %3 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 1
  store i32 0, i32* %3, align 4, !tbaa !8
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 2
  store i32 0, i32* %4, align 4, !tbaa !9
  ret void
}

define internal noundef zeroext i1 @more(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %1 = load i32, i32* %0, align 4, !tbaa !9
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  store i32 %3, i32* %5, align 4, !tbaa !9
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 2
  %7 = load i32, i32* %6, align 4, !tbaa !9
  %8 = icmp sge i32 %7, 0
  ret i1 %8

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal void @serve(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %served.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %reply.addr = alloca i8*, align 8
  store i32 0, i32* %served.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = call i64 @nish_arena_mark()
  store i64 %1, i64* %a.addr, align 8
  %2 = load i64, i64* %a.addr, align 8
  %3 = load i32, i32* %served.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8* %4)
  store i8* %5, i8** %reply.addr, align 8
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !8
  %8 = load i8*, i8** %reply.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  %15 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %13, i32* %15, align 4, !tbaa !8
  call void @nish_arena_release(i64 %2)
  %16 = call i8* @nish_alloc_struct(i64 4)
  %17 = bitcast i8* %16 to %struct.Entry*
  %18 = load i32, i32* %served.addr, align 4
  call void @Entry.constructor(%struct.Entry* %17, i32 %18)
  %19 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %17, %struct.Entry** %19, align 8, !tbaa !7
  %20 = load i32, i32* %served.addr, align 4
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 1)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %22, i32* %served.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @counted(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %cell.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %3)
  store i8* %4, i8** %cell.addr, align 8
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !8
  %7 = load i8*, i8** %cell.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %12, i32* %14, align 4, !tbaa !8
  %15 = call i8* @nish_alloc_struct(i64 4)
  %16 = bitcast i8* %15 to %struct.Entry*
  %17 = load i32, i32* %i.addr, align 4
  call void @Entry.constructor(%struct.Entry* %16, i32 %17)
  %18 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %16, %struct.Entry** %18, align 8, !tbaa !7
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @dropped(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %last.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %k.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* %2)
  store i8* %3, i8** %last.addr, align 8
  %4 = load i32, i32* %k.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %8 = load i8*, i8** %last.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @droppedSplit(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %last.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %k.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %2)
  store i8* %3, i8** %last.addr, align 8
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = bitcast i8* %4 to %struct.Entry*
  %6 = load i32, i32* %k.addr, align 4
  call void @Entry.constructor(%struct.Entry* %5, i32 %6)
  %7 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %5, %struct.Entry** %7, align 8, !tbaa !7
  %8 = load i32, i32* %k.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 1)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %12 = load i8*, i8** %last.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @scoped(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %total.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %2 = load i8*, i8** %1, align 8
  %3 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %4 = load i64, i64* %3, align 8
  %5 = load i32, i32* %k.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load i32, i32* %total.addr, align 4
  %9 = load i8*, i8** %s.addr, align 8
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %total.addr, align 4
  %16 = load i32, i32* %k.addr, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 1)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %18, i32* %k.addr, align 4
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = icmp eq i8* %21, %2
  br i1 %22, label %pass.rewind, label %pass.free

pass.rewind:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %4, i64* %23, align 8
  br label %pass.done

pass.free:
  %24 = ptrtoint i8* %2 to i64
  %25 = add i64 %24, %4
  call void @nish_arena_release(i64 %25)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  %26 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %26

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %d.addr = alloca i32, align 4
  %e.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %0 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %0, i32 0, i32 2
  store i32 3, i32* %1, align 4, !tbaa !9
  %2 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @serve(%struct.Log* %2)
  %3 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @counted(%struct.Log* %3, i32 3)
  %4 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %5 = getelementptr inbounds %struct.Log, %struct.Log* %4, i32 0, i32 2
  store i32 4, i32* %5, align 4, !tbaa !9
  %6 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %7 = call i32 @dropped(%struct.Log* %6)
  store i32 %7, i32* %d.addr, align 4
  %8 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %9 = getelementptr inbounds %struct.Log, %struct.Log* %8, i32 0, i32 2
  store i32 2, i32* %9, align 4, !tbaa !9
  %10 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %11 = call i32 @droppedSplit(%struct.Log* %10)
  store i32 %11, i32* %e.addr, align 4
  %12 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %13 = getelementptr inbounds %struct.Log, %struct.Log* %12, i32 0, i32 2
  store i32 5, i32* %13, align 4, !tbaa !9
  %14 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %15 = call i32 @scoped(%struct.Log* %14)
  store i32 %15, i32* %k.addr, align 4
  %16 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %17 = getelementptr inbounds %struct.Log, %struct.Log* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4, !tbaa !8
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %19, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %21 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %22 = getelementptr inbounds %struct.Log, %struct.Log* %21, i32 0, i32 0
  %23 = load %struct.Entry*, %struct.Entry** %22, align 8, !tbaa !7
  %24 = getelementptr inbounds %struct.Entry, %struct.Entry* %23, i32 0, i32 0
  %25 = load i32, i32* %24, align 4, !tbaa !4
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %20, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %29 = load i32, i32* %d.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %28, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %33 = load i32, i32* %e.addr, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %37 = load i32, i32* %k.addr, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %36, i8* %38)
  call void @nish_print(i8* %39)
  call void @nish_arena_release(i64 %arena.mark)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!10, !11, !12, !13, !14}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Entry", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Log", !5, i64 0, !2, i64 8, !2, i64 12}
!7 = !{!6, !5, i64 0}
!8 = !{!6, !2, i64 8}
!9 = !{!6, !2, i64 12}
!10 = !{i32 8, !"cf-protection-branch", i32 1}
!11 = !{i32 8, !"cf-protection-return", i32 1}
!12 = !{i32 8, !"branch-target-enforcement", i32 1}
!13 = !{i32 8, !"sign-return-address", i32 1}
!14 = !{i32 4, !"probe-stack", !"inline-asm"}
