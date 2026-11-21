%struct.Note = type { i8*, %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%frame.nish_main = type { i32, i32, %frame.nish_main.rest }
%frame.nish_main.rest = type { [0 x <2 x i64>], %struct.Note*, i64 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"lent\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.trap()
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_async_sleep(i32 noundef) #0
declare noundef i32 @nish_async_poll(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal noundef nonnull align 8 i8* @total(%struct.Note* noundef nonnull align 8 dereferenceable(24) nocapture %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Note, %struct.Note* %n, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !5
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %4 = trunc i64 %3 to i32
  %5 = getelementptr inbounds %struct.Note, %struct.Note* %n, i32 0, i32 2
  store i32 %4, i32* %5, align 4, !tbaa !15
  %6 = getelementptr inbounds %struct.Note, %struct.Note* %n, i32 0, i32 0
  %7 = load i8*, i8** %6, align 8, !tbaa !16
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = getelementptr inbounds %struct.Note, %struct.Note* %n, i32 0, i32 2
  %10 = load i32, i32* %9, align 4, !tbaa !15
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  ret i8* %12
}

define internal void @read$(%struct.Note* noundef nonnull align 8 dereferenceable(24) nocapture %note) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @total(%struct.Note* %note)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define i1 @nish_main.resume(i8* %async.raw) #0 {
async.entry:
  %async.frame = bitcast i8* %async.raw to %frame.nish_main*
  %async.state = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 0
  %async.answer = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 1
  %async.rest = getelementptr inbounds %frame.nish_main, %frame.nish_main* %async.frame, i32 0, i32 2
  %async.kids = bitcast %frame.nish_main.rest* %async.rest to i8*
  %note.addr = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 1
  %async.wait = getelementptr inbounds %frame.nish_main.rest, %frame.nish_main.rest* %async.rest, i32 0, i32 2
  %async.at = load i32, i32* %async.state
  switch i32 %async.at, label %async.bad [ i32 0, label %entry i32 -1, label %async.finished i32 1, label %wait.poll ]

entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Note*
  %2 = getelementptr inbounds %struct.Note, %struct.Note* %1, i32 0, i32 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8** %2, align 8, !tbaa !16
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !17
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %8 = getelementptr inbounds %struct.Note, %struct.Note* %1, i32 0, i32 1
  store %struct.nish_array* %4, %struct.nish_array** %8, align 8, !tbaa !5
  %9 = getelementptr inbounds %struct.Note, %struct.Note* %1, i32 0, i32 2
  store i32 0, i32* %9, align 4, !tbaa !15
  store %struct.Note* %1, %struct.Note** %note.addr, align 8
  %10 = load %struct.Note*, %struct.Note** %note.addr, align 8
  %11 = getelementptr inbounds %struct.Note, %struct.Note* %10, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !5
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !17
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 4)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  store i32 3, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %23 = trunc i64 %22 to i32
  %24 = load %struct.Note*, %struct.Note** %note.addr, align 8
  %25 = getelementptr inbounds %struct.Note, %struct.Note* %24, i32 0, i32 1
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !5
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  %30 = load i64, i64* %29, align 8, !alias.scope !9, !noalias !10, !tbaa !17
  %31 = icmp eq i64 %28, %30
  br i1 %31, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %26, i64 4)
  br label %push.store.1

push.store.1:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %28
  store i32 4, i32* %35, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %36 = add i64 %28, 1
  store i64 %36, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %37 = trunc i64 %36 to i32
  %38 = load %struct.Note*, %struct.Note** %note.addr, align 8
  call void @read$(%struct.Note* %38)
  %39 = call i64 @nish_async_sleep(i32 5)
  store i64 %39, i64* %async.wait
  br label %wait.poll

wait.poll:
  %40 = load i64, i64* %async.wait
  %41 = call i32 @nish_async_poll(i64 %40)
  %42 = icmp slt i32 %41, 0
  br i1 %42, label %wait.pending, label %wait.ready

wait.pending:
  store i32 1, i32* %async.state
  br label %async.suspend

wait.ready:
  %43 = icmp ne i32 %41, 0
  %44 = load %struct.Note*, %struct.Note** %note.addr, align 8
  %45 = getelementptr inbounds %struct.Note, %struct.Note* %44, i32 0, i32 2
  %46 = load i32, i32* %45, align 4, !tbaa !15
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
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
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Note", !2, i64 0, !2, i64 8, !3, i64 16}
!5 = !{!4, !2, i64 8}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!4, !3, i64 16}
!16 = !{!4, !2, i64 0}
!17 = !{!13, !11, i64 8}
!18 = !{!13, !12, i64 16}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}

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
