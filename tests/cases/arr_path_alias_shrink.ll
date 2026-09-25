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
  %shared.addr = alloca %struct.nish_array*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %g.addr = alloca %struct.Holder*, align 8
  %Holder.obj.1 = alloca %struct.Holder, align 8
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
  store %struct.nish_array* %1, %struct.nish_array** %shared.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %shared.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %10)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %shared.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj.1, %struct.nish_array* %11)
  store %struct.Holder* %Holder.obj.1, %struct.Holder** %g.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %12 = load i32, i32* %i.addr, align 4
  %13 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %13, i32 0, i32 0
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !4
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %18 = trunc i64 %17 to i32
  %19 = icmp slt i32 %12, %18
  br i1 %19, label %while.body, label %while.end

while.body:
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %23 = load i64, i64* %22, align 8
  %24 = load i32, i32* %i.addr, align 4
  %25 = icmp eq i32 %24, 1
  br i1 %25, label %if.then, label %if.end

if.then:
  %26 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %27 = getelementptr inbounds %struct.Holder, %struct.Holder* %26, i32 0, i32 0
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !4
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %31 = icmp eq i64 %30, 0
  br i1 %31, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %32 = sub i64 %30, 1
  store i64 %32, i64* %29, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %32
  %37 = load i32, i32* %36, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %38 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %39 = getelementptr inbounds %struct.Holder, %struct.Holder* %38, i32 0, i32 0
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !4
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %43 = icmp eq i64 %42, 0
  br i1 %43, label %pop.empty.1, label %pop.ok.1

pop.empty.1:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.1:
  %44 = sub i64 %42, 1
  store i64 %44, i64* %41, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 %44
  %49 = load i32, i32* %48, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  br label %if.end

if.end:
  %50 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %51 = getelementptr inbounds %struct.Holder, %struct.Holder* %50, i32 0, i32 0
  %52 = load %struct.nish_array*, %struct.nish_array** %51, align 8, !tbaa !4
  %53 = load i32, i32* %i.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %57 = icmp ult i64 %54, %56
  br i1 %57, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %54, i64 %56)
  unreachable

bounds.ok:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 %54
  %62 = load i32, i32* %61, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %62, i32* %x.addr, align 4
  %63 = load i32, i32* %x.addr, align 4
  %64 = call i8* @nish_str_from_i32(i32 %63)
  call void @nish_print(i8* %64)
  %65 = load i32, i32* %i.addr, align 4
  %66 = add nsw i32 %65, 1
  store i32 %66, i32* %i.addr, align 4
  %67 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %68 = load i8*, i8** %67, align 8
  %69 = icmp eq i8* %68, %21
  br i1 %69, label %pass.rewind, label %pass.free

pass.rewind:
  %70 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %23, i64* %70, align 8
  br label %pass.done

pass.free:
  %71 = ptrtoint i8* %21 to i64
  %72 = add i64 %71, %23
  call void @nish_arena_release(i64 %72)
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
