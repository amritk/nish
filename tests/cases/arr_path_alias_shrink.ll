%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
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
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp eq i32 %20, 1
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %23 = getelementptr inbounds %struct.Holder, %struct.Holder* %22, i32 0, i32 0
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !4
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = icmp eq i64 %26, 0
  br i1 %27, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %28 = sub i64 %26, 1
  store i64 %28, i64* %25, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %28
  %33 = load i32, i32* %32, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %34 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %35 = getelementptr inbounds %struct.Holder, %struct.Holder* %34, i32 0, i32 0
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8, !tbaa !4
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %39 = icmp eq i64 %38, 0
  br i1 %39, label %pop.empty.1, label %pop.ok.1

pop.empty.1:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.1:
  %40 = sub i64 %38, 1
  store i64 %40, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %40
  %45 = load i32, i32* %44, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  br label %if.end

if.end:
  %46 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %47 = getelementptr inbounds %struct.Holder, %struct.Holder* %46, i32 0, i32 0
  %48 = load %struct.nish_array*, %struct.nish_array** %47, align 8, !tbaa !4
  %49 = load i32, i32* %i.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = icmp ult i64 %50, %52
  br i1 %53, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %50, i64 %52)
  unreachable

bounds.ok:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %50
  %58 = load i32, i32* %57, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  store i32 %58, i32* %x.addr, align 4
  %59 = load i32, i32* %x.addr, align 4
  %60 = call i8* @nish_str_from_i32(i32 %59)
  call void @nish_print(i8* %60)
  %61 = load i32, i32* %i.addr, align 4
  %62 = add nsw i32 %61, 1
  store i32 %62, i32* %i.addr, align 4
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
