%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %g.addr = alloca %struct.Holder*, align 8
  %short.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %1)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %10 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  store %struct.Holder* %10, %struct.Holder** %g.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 1, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %15 = call i8* @nish_alloc_struct(i64 4)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 7, i32* %18, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store %struct.nish_array* %12, %struct.nish_array** %short.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %19 = load i32, i32* %i.addr, align 4
  %20 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %21 = getelementptr inbounds %struct.Holder, %struct.Holder* %20, i32 0, i32 0
  %22 = load %struct.nish_array*, %struct.nish_array** %21, align 8, !tbaa !4
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = trunc i64 %24 to i32
  %26 = icmp slt i32 %19, %25
  br i1 %26, label %while.body, label %while.end

while.body:
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %28 = load i8*, i8** %27, align 8
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %30 = load i64, i64* %29, align 8
  %31 = load i32, i32* %i.addr, align 4
  %32 = icmp eq i32 %31, 1
  br i1 %32, label %if.then, label %if.end

if.then:
  %33 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %short.addr, align 8
  %35 = getelementptr inbounds %struct.Holder, %struct.Holder* %33, i32 0, i32 0
  store %struct.nish_array* %34, %struct.nish_array** %35, align 8, !tbaa !4
  br label %if.end

if.end:
  %36 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %37 = getelementptr inbounds %struct.Holder, %struct.Holder* %36, i32 0, i32 0
  %38 = load %struct.nish_array*, %struct.nish_array** %37, align 8, !tbaa !4
  %39 = load i32, i32* %i.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %43 = icmp ult i64 %40, %42
  br i1 %43, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %40, i64 %42)
  unreachable

bounds.ok:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %40
  %48 = load i32, i32* %47, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %48, i32* %x.addr, align 4
  %49 = load i32, i32* %x.addr, align 4
  %50 = call i8* @nish_str_from_i32(i32 %49)
  call void @nish_print(i8* %50)
  %51 = load i32, i32* %i.addr, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr, align 4
  %53 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %54 = load i8*, i8** %53, align 8
  %55 = icmp eq i8* %54, %28
  br i1 %55, label %pass.rewind, label %pass.free

pass.rewind:
  %56 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %30, i64* %56, align 8
  br label %pass.done

pass.free:
  %57 = ptrtoint i8* %28 to i64
  %58 = add i64 %57, %30
  call void @nish_arena_release(i64 %58)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
