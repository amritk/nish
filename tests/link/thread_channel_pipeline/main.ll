%struct.Pipe = type { %struct.Channel$i32*, i32 }
%struct.Channel$i32 = type { %struct.nish_array*, i32, i64 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Pipe* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Pipe* noundef nonnull align 8 dereferenceable(16), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.Channel$i32.constructor(%struct.Channel$i32* noundef nonnull noalias align 8 dereferenceable(24) nocapture) #0
declare void @nish.Channel$i32.send(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #1
declare noundef i32 @nish.Channel$i32.take(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture) #1
declare noundef zeroext i1 @nish.Channel$i32.ready(%struct.Channel$i32* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #1
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #1
declare noundef i32 @nish_channel_receive(i64* noundef nonnull, i64* noundef nonnull) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal void @Pipe.constructor(%struct.Pipe* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) %ch, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 0
  store %struct.Channel$i32* %ch, %struct.Channel$i32** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 1
  store i32 %n, i32* %1, align 4, !tbaa !6
  ret void
}

define hidden noundef i32 @produce(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %p) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 1
  %2 = load i32, i32* %1, align 4, !tbaa !6
  %3 = icmp sle i32 %0, %2
  br i1 %3, label %for.body, label %for.end

for.body:
  %4 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 0
  %5 = load %struct.Channel$i32*, %struct.Channel$i32** %4, align 8, !tbaa !5
  %6 = load i32, i32* %i.addr, align 4
  call void @nish.Channel$i32.send(%struct.Channel$i32* %5, i32 %6)
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %11 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 1
  %12 = load i32, i32* %11, align 4, !tbaa !6
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @consume(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(16) nocapture %p) #1 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %chan.slot = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 0
  %1 = load %struct.Channel$i32*, %struct.Channel$i32** %0, align 8, !tbaa !5
  %2 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %1, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %3 = call i32 @nish_channel_receive(i64* %2, i64* %chan.slot)
  %4 = icmp ne i32 %3, 0
  br i1 %4, label %chan.body, label %chan.end

chan.body:
  %5 = load i64, i64* %chan.slot, align 8
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %x.addr, align 4
  %7 = load i32, i32* %sum.addr, align 4
  %8 = load i32, i32* %x.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %sum.addr, align 4
  br label %chan.recv

chan.end:
  %12 = load i32, i32* %sum.addr, align 4
  ret i32 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %sent.addr = alloca %struct.nish_array*, align 8
  %sums.addr = alloca %struct.nish_array*, align 8
  %ch.addr = alloca %struct.Channel$i32*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  store %struct.nish_array* %1, %struct.nish_array** %sent.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 1, i64* %10, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 1, i64* %11, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %12 = call i8* @nish_alloc_struct(i64 4)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %14 = bitcast i8* %12 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 0, i32* %15, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  store %struct.nish_array* %9, %struct.nish_array** %sums.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.Channel$i32*
  call void @nish.Channel$i32.constructor(%struct.Channel$i32* %17)
  store %struct.Channel$i32* %17, %struct.Channel$i32** %ch.addr, align 8
  %18 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %18, %struct.ThreadScope** %s.addr, align 8
  %19 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %20 = bitcast %struct.ThreadScope* %19 to i8*
  %21 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  %22 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %21, i32 0, i32 2
  %23 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %24 = call i8* @nish_alloc_struct(i64 16)
  %25 = bitcast i8* %24 to %struct.Pipe*
  %26 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %25, %struct.Channel$i32* %26, i32 50000)
  %27 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce(%struct.ThreadScope* %23, %struct.Pipe* %25, %struct.nish_array* %27, i32 0)
  %28 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %29 = call i8* @nish_alloc_struct(i64 16)
  %30 = bitcast i8* %29 to %struct.Pipe*
  %31 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %30, %struct.Channel$i32* %31, i32 0)
  %32 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume(%struct.ThreadScope* %28, %struct.Pipe* %30, %struct.nish_array* %32, i32 0)
  call void @nish_channel_count(i64* %22, i64 -1)
  call void @nish_scope_join(i8* %20)
  %33 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 0
  %41 = load i32, i32* %40, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %44 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 0
  %52 = load i32, i32* %51, align 4, !alias.scope !11, !noalias !10, !tbaa !19
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %43, i8* %53)
  call void @nish_print(i8* %54)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Pipe", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}
