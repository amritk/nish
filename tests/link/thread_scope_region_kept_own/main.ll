%struct.Inner = type { i32 }
%struct.Holder = type { %struct.Inner* }
%struct.Grid = type { %struct.nish_array*, i32 }
%struct.Keep = type { %struct.nish_array* }
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

define internal void @Grid.constructor(%struct.Grid* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %size, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %cells) #0 {
entry:
  %0 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 1
  store i32 %size, i32* %0, align 4, !tbaa !9
  %1 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  store %struct.nish_array* %cells, %struct.nish_array** %1, align 8, !tbaa !10
  ret void
}

define internal void @Keep.constructor(%struct.Keep* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %5 = getelementptr inbounds %struct.Keep, %struct.Keep* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !23
  %6 = getelementptr inbounds %struct.Keep, %struct.Keep* %this, i32 0, i32 0
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !23
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %9 = load %struct.Inner*, %struct.Inner** %8, align 8, !tbaa !7
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %17 = bitcast i8* %16 to %struct.Inner**
  %18 = getelementptr inbounds %struct.Inner*, %struct.Inner** %17, i64 %11
  store %struct.Inner* %9, %struct.Inner** %18, align 8, !alias.scope !15, !noalias !14, !tbaa !25
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %20 = trunc i64 %19 to i32
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
  %arr.addr = alloca %struct.nish_array*, align 8
  %g.addr = alloca %struct.Grid*, align 8
  %Grid.obj = alloca %struct.Grid, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 0, i32* %10, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  store %struct.nish_array* %1, %struct.nish_array** %arr.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  call void @Grid.constructor(%struct.Grid* %Grid.obj, i32 4, %struct.nish_array* %11)
  store %struct.Grid* %Grid.obj, %struct.Grid** %g.addr, align 8
  %12 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %13 = getelementptr inbounds %struct.Grid, %struct.Grid* %12, i32 0, i32 0
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  store i32 1, i32* %21, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  %22 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %23 = getelementptr inbounds %struct.Grid, %struct.Grid* %22, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 0
  %29 = load i32, i32* %28, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  %30 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  %35 = load i32, i32* %34, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok

ovf.ok:
  %39 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %40 = getelementptr inbounds %struct.Grid, %struct.Grid* %39, i32 0, i32 1
  %41 = load i32, i32* %40, align 4, !tbaa !9
  %42 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 %41)
  %43 = extractvalue { i32, i1 } %42, 0
  %44 = extractvalue { i32, i1 } %42, 1
  br i1 %44, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %43

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #2 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %done.addr = alloca %struct.nish_array*, align 8
  %total.addr = alloca i32, align 4
  %kept.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %k.addr = alloca %struct.Keep*, align 8
  %Keep.obj = alloca %struct.Keep, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Holder*
  call void @Holder.constructor(%struct.Holder* %1, i32 6)
  store %struct.Holder* %1, %struct.Holder** %h.addr, align 8
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !14, !noalias !15, !tbaa !20
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 0, i32* %9, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  store %struct.nish_array* %3, %struct.nish_array** %done.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %kept.addr, align 4
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
  %18 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  call void @Keep.constructor(%struct.Keep* %Keep.obj, %struct.Holder* %18)
  store %struct.Keep* %Keep.obj, %struct.Keep** %k.addr, align 8
  %19 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %20 = getelementptr inbounds %struct.Keep, %struct.Keep* %19, i32 0, i32 0
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !23
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %24 = trunc i64 %23 to i32
  %25 = load %struct.Keep*, %struct.Keep** %k.addr, align 8
  %26 = getelementptr inbounds %struct.Keep, %struct.Keep* %25, i32 0, i32 0
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !23
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %30 = icmp ult i64 0, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %33 = bitcast i8* %32 to %struct.Inner**
  %34 = getelementptr inbounds %struct.Inner*, %struct.Inner** %33, i64 0
  %35 = load %struct.Inner*, %struct.Inner** %34, align 8, !alias.scope !15, !noalias !14, !tbaa !25
  %36 = getelementptr inbounds %struct.Inner, %struct.Inner* %35, i32 0, i32 0
  %37 = load i32, i32* %36, align 4, !tbaa !4
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %39, i32* %kept.addr, align 4
  call void @nish_scope_join(i8* %12)
  %41 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !14, !noalias !15, !tbaa !19
  %44 = icmp ult i64 0, %43
  br i1 %44, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %43)
  unreachable

bounds.ok.1:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !14, !noalias !15, !tbaa !21
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 0
  %49 = load i32, i32* %48, align 4, !alias.scope !15, !noalias !14, !tbaa !27
  %50 = call i8* @nish_str_from_i32(i32 %49)
  %51 = call i8* @nish_str_concat(i8* %50, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %52 = load i32, i32* %total.addr, align 4
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %51, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %56 = load i32, i32* %kept.addr, align 4
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %55, i8* %57)
  call void @nish_print(i8* %58)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
!8 = !{!"Grid", !5, i64 0, !2, i64 8}
!9 = !{!8, !2, i64 8}
!10 = !{!8, !5, i64 0}
!11 = !{!"nish array"}
!12 = !{!"header", !11}
!13 = !{!"elements", !11}
!14 = !{!12}
!15 = !{!13}
!16 = !{!"header i64", !1, i64 0}
!17 = !{!"header ptr", !1, i64 0}
!18 = !{!"array header", !16, i64 0, !16, i64 8, !17, i64 16}
!19 = !{!18, !16, i64 0}
!20 = !{!18, !16, i64 8}
!21 = !{!18, !17, i64 16}
!22 = !{!"Keep", !5, i64 0}
!23 = !{!22, !5, i64 0}
!24 = !{!"element ptr", !1, i64 0}
!25 = !{!24, !24, i64 0}
!26 = !{!"element i32", !1, i64 0}
!27 = !{!26, !26, i64 0}
