%struct.Inner = type { i32 }
%struct.Holder = type { %struct.Inner* }
%struct.Grid = type { %struct.nish_array*, i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$$Holder$i32$fn.4.read(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Holder* noundef nonnull align 8 dereferenceable(8), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #2
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Inner*
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.Inner* %1, %struct.Inner** %3, align 8, !tbaa !7
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %5 = load %struct.Inner*, %struct.Inner** %4, align 8, !tbaa !7
  %6 = getelementptr inbounds %struct.Inner, %struct.Inner* %5, i32 0, i32 0
  store i32 %x, i32* %6, align 4, !tbaa !4
  ret void
}

define internal void @Grid.constructor(%struct.Grid* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %size) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 0, i32* %10, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %11 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8, !tbaa !22
  %12 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 1
  store i32 %size, i32* %12, align 4, !tbaa !23
  ret void
}

define hidden noundef i32 @read$(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.Inner*, %struct.Inner** %0, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.Inner, %struct.Inner* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  ret i32 %3
}

define internal noundef i32 @sum(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #2 {
entry:
  %r.addr = alloca %struct.Grid*, align 8
  %Grid.obj = alloca %struct.Grid, align 8
  %t.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  call void @Grid.constructor(%struct.Grid* %Grid.obj, i32 4)
  store %struct.Grid* %Grid.obj, %struct.Grid** %r.addr, align 8
  %0 = load %struct.Grid*, %struct.Grid** %r.addr, align 8
  %1 = getelementptr inbounds %struct.Grid, %struct.Grid* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !22
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %4 = load %struct.Inner*, %struct.Inner** %3, align 8, !tbaa !7
  %5 = getelementptr inbounds %struct.Inner, %struct.Inner* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %9 = icmp ult i64 0, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 %6, i32* %13, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %14 = load %struct.Grid*, %struct.Grid** %r.addr, align 8
  %15 = getelementptr inbounds %struct.Grid, %struct.Grid* %14, i32 0, i32 0
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !22
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %19 = icmp ult i64 1, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 1
  store i32 4, i32* %23, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %24 = load %struct.Grid*, %struct.Grid** %r.addr, align 8
  %25 = getelementptr inbounds %struct.Grid, %struct.Grid* %24, i32 0, i32 0
  %26 = load %struct.nish_array*, %struct.nish_array** %25, align 8, !tbaa !22
  %27 = load %struct.Grid*, %struct.Grid** %r.addr, align 8
  %28 = getelementptr inbounds %struct.Grid, %struct.Grid* %27, i32 0, i32 1
  %29 = load i32, i32* %28, align 4, !tbaa !23
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %26, i64 4)
  br label %push.store

push.store:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %37 = bitcast i8* %36 to i32*
  %38 = getelementptr inbounds i32, i32* %37, i64 %31
  store i32 %29, i32* %38, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %40 = trunc i64 %39 to i32
  store i32 0, i32* %t.addr, align 4
  %41 = load %struct.Grid*, %struct.Grid** %r.addr, align 8
  %42 = getelementptr inbounds %struct.Grid, %struct.Grid* %41, i32 0, i32 0
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !22
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %44 = load i64, i64* %forof.idx, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %47 = icmp ult i64 %44, %46
  br i1 %47, label %forof.body, label %forof.end

forof.body:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 %44
  %52 = load i32, i32* %51, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  store i32 %52, i32* %c.addr, align 4
  %53 = load i32, i32* %t.addr, align 4
  %54 = load i32, i32* %c.addr, align 4
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 %54)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %56, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %58 = load i64, i64* %forof.idx, align 8
  %59 = add i64 %58, 1
  store i64 %59, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %60 = load i32, i32* %t.addr, align 4
  ret i32 %60

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #2 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %total.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Holder*
  call void @Holder.constructor(%struct.Holder* %1, i32 7)
  store %struct.Holder* %1, %struct.Holder** %h.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  store %struct.nish_array* %3, %struct.nish_array** %done.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %10 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %10, %struct.ThreadScope** %s.addr, align 8
  %11 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %12 = bitcast %struct.ThreadScope* %11 to i8*
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  call void @nish.ThreadScope.spawn$$Holder$i32$fn.4.read(%struct.ThreadScope* %13, %struct.Holder* %14, %struct.nish_array* %15, i32 0)
  %16 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %17 = call i32 @sum(%struct.Holder* %16)
  store i32 %17, i32* %total.addr, align 4
  call void @nish_scope_join(i8* %12)
  %18 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %21 = icmp ult i64 0, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %24 = bitcast i8* %23 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 0
  %26 = load i32, i32* %25, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %29 = load i32, i32* %total.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %28, i8* %30)
  call void @nish_print(i8* %31)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Inner", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Holder", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 8}
!18 = !{!15, !14, i64 16}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"Grid", !5, i64 0, !2, i64 8}
!22 = !{!21, !5, i64 0}
!23 = !{!21, !2, i64 8}
