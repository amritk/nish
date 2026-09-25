%struct.Holder = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

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

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %items) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store %struct.nish_array* %items, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @Holder.total(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %2 = load i64, i64* %forof.idx, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !8, !noalias !9
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %forof.body, label %forof.end

forof.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !8, !noalias !9
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store i32 %10, i32* %x.addr, align 4
  %11 = load i32, i32* %sum.addr, align 4
  %12 = load i32, i32* %x.addr, align 4
  %13 = add nsw i32 %11, %12
  store i32 %13, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %16 = load i32, i32* %sum.addr, align 4
  ret i32 %16
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @labels() #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %7, align 8, !alias.scope !9, !noalias !8, !tbaa !13
  %8 = getelementptr inbounds i8*, i8** %6, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8** %8, align 8, !alias.scope !9, !noalias !8, !tbaa !13
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %9
}

define noundef i32 @nish_main() #2 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 4, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 5, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 6, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  call void @Holder.constructor(%struct.Holder* %Holder.obj, %struct.nish_array* %10)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %11 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %12 = call i32 @Holder.total(%struct.Holder* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = call %struct.nish_array* @labels()
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9
  %17 = trunc i64 %16 to i32
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !8, !noalias !9
  %22 = icmp ult i64 2, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !8, !noalias !9
  %25 = bitcast i8* %24 to i32*
  %26 = getelementptr inbounds i32, i32* %25, i64 2
  %27 = load i32, i32* %26, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
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
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}
!12 = !{!"element ptr", !1, i64 0}
!13 = !{!12, !12, i64 0}
