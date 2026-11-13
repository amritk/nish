%struct.Entry = type { i32 }
%struct.Log = type { %struct.Entry*, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"request \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"k\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
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
  %reply.addr = alloca i8*, align 8
  store i32 0, i32* %served.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %served.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8* %2)
  store i8* %3, i8** %reply.addr, align 8
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %5 = load i32, i32* %4, align 4, !tbaa !8
  %6 = load i8*, i8** %reply.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %11, i32* %13, align 4, !tbaa !8
  %14 = call i8* @nish_alloc_struct(i64 4)
  %15 = bitcast i8* %14 to %struct.Entry*
  %16 = load i32, i32* %served.addr, align 4
  call void @Entry.constructor(%struct.Entry* %15, i32 %16)
  %17 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %15, %struct.Entry** %17, align 8, !tbaa !7
  %18 = load i32, i32* %served.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 1)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %20, i32* %served.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @rounds(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log, i32 noundef %n) #1 {
entry:
  %round.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %cell.addr = alloca i8*, align 8
  store i32 0, i32* %round.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = call i1 @more(%struct.Log* %log)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp slt i32 %2, %n
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = load i32, i32* %round.addr, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  store i8* %9, i8** %cell.addr, align 8
  %10 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !8
  %12 = load i8*, i8** %cell.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %17, i32* %19, align 4, !tbaa !8
  %20 = call i8* @nish_alloc_struct(i64 4)
  %21 = bitcast i8* %20 to %struct.Entry*
  %22 = load i32, i32* %i.addr, align 4
  call void @Entry.constructor(%struct.Entry* %21, i32 %22)
  %23 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %21, %struct.Entry** %23, align 8, !tbaa !7
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load i32, i32* %round.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 1)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %28, i32* %round.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @pair(%struct.Log* noundef nonnull align 8 dereferenceable(16) nocapture %log) #1 {
entry:
  %k.addr = alloca i32, align 4
  %name.addr = alloca i8*, align 8
  %label.addr = alloca i8*, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = call i1 @more(%struct.Log* %log)
  br i1 %0, label %while.body, label %while.end

while.body:
  %1 = load i32, i32* %k.addr, align 4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %2)
  store i8* %3, i8** %name.addr, align 8
  %4 = load i32, i32* %k.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  %8 = call i8* @nish_str_from_i32(i32 %6)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8* %8)
  store i8* %9, i8** %label.addr, align 8
  %10 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !8
  %12 = load i8*, i8** %name.addr, align 8
  %13 = bitcast i8* %12 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = trunc i64 %14 to i32
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %19 = load i8*, i8** %label.addr, align 8
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 1
  store i32 %24, i32* %26, align 4, !tbaa !8
  %27 = call i8* @nish_alloc_struct(i64 4)
  %28 = bitcast i8* %27 to %struct.Entry*
  %29 = load i32, i32* %k.addr, align 4
  call void @Entry.constructor(%struct.Entry* %28, i32 %29)
  %30 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store %struct.Entry* %28, %struct.Entry** %30, align 8, !tbaa !7
  %31 = load i32, i32* %k.addr, align 4
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 1)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %33, i32* %k.addr, align 4
  br label %while.cond

while.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %0 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %1 = getelementptr inbounds %struct.Log, %struct.Log* %0, i32 0, i32 2
  store i32 3, i32* %1, align 4, !tbaa !9
  %2 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @serve(%struct.Log* %2)
  %3 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %4 = getelementptr inbounds %struct.Log, %struct.Log* %3, i32 0, i32 2
  store i32 2, i32* %4, align 4, !tbaa !9
  %5 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @rounds(%struct.Log* %5, i32 3)
  %6 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %7 = getelementptr inbounds %struct.Log, %struct.Log* %6, i32 0, i32 2
  store i32 2, i32* %7, align 4, !tbaa !9
  %8 = load %struct.Log*, %struct.Log** %log.addr, align 8
  call void @pair(%struct.Log* %8)
  %9 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %10 = getelementptr inbounds %struct.Log, %struct.Log* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !8
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %14 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %15 = getelementptr inbounds %struct.Log, %struct.Log* %14, i32 0, i32 0
  %16 = load %struct.Entry*, %struct.Entry** %15, align 8, !tbaa !7
  %17 = getelementptr inbounds %struct.Entry, %struct.Entry* %16, i32 0, i32 0
  %18 = load i32, i32* %17, align 4, !tbaa !4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %13, i8* %19)
  call void @nish_print(i8* %20)
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
