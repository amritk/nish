%struct.Cell = type { i32 }
%struct.Grid = type { %struct.nish_array* }
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

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Grid.constructor(%struct.Grid* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %hs) #0 {
entry:
  %0 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  store %struct.nish_array* %hs, %struct.nish_array** %0, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @poke(%struct.Grid* noundef nonnull readonly align 8 dereferenceable(8) nocapture %g, i32 noundef %start) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 %start, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Grid, %struct.Grid* %g, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !11, !noalias !12
  %4 = trunc i64 %3 to i32
  %5 = icmp sge i32 %4, 1
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = getelementptr inbounds %struct.Grid, %struct.Grid* %g, i32 0, i32 0
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !7
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !11, !noalias !12
  %12 = icmp ult i64 %9, %11
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %9, i64 %11)
  unreachable

bounds.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !11, !noalias !12
  %15 = bitcast i8* %14 to %struct.Cell**
  %16 = getelementptr inbounds %struct.Cell*, %struct.Cell** %15, i64 %9
  %17 = load %struct.Cell*, %struct.Cell** %16, align 8, !alias.scope !12, !noalias !11, !tbaa !14
  store i32 0, i32* %i.addr, align 4
  %18 = getelementptr inbounds %struct.Cell, %struct.Cell* %17, i32 0, i32 0
  store i32 0, i32* %18, align 4, !tbaa !4
  br label %if.end

if.end:
  %19 = load i32, i32* %i.addr, align 4
  ret i32 %19
}

define noundef i32 @nish_main() #1 {
entry:
  %Grid.obj = alloca %struct.Grid, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %1, i32 1)
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %3, i32 2)
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 2, i64* %6, align 8, !alias.scope !11, !noalias !12
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 2, i64* %7, align 8, !alias.scope !11, !noalias !12
  %8 = call i8* @nish_alloc_struct(i64 16)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !11, !noalias !12
  %10 = bitcast i8* %8 to %struct.Cell**
  %11 = getelementptr inbounds %struct.Cell*, %struct.Cell** %10, i64 0
  store %struct.Cell* %1, %struct.Cell** %11, align 8, !alias.scope !12, !noalias !11, !tbaa !14
  %12 = getelementptr inbounds %struct.Cell*, %struct.Cell** %10, i64 1
  store %struct.Cell* %3, %struct.Cell** %12, align 8, !alias.scope !12, !noalias !11, !tbaa !14
  call void @Grid.constructor(%struct.Grid* %Grid.obj, %struct.nish_array* %5)
  %13 = call i32 @poke(%struct.Grid* %Grid.obj, i32 1000000)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
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
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Cell", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Grid", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"element ptr", !1, i64 0}
!14 = !{!13, !13, i64 0}
