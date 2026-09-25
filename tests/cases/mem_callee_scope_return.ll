%struct.Cell = type { i32 }
%struct.Pair = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

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

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Pair.constructor(%struct.Pair* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %this, i32 0, i32 0
  store i32 %a, i32* %0, align 4, !tbaa !6
  %1 = getelementptr inbounds %struct.Pair, %struct.Pair* %this, i32 0, i32 1
  store i32 %b, i32* %1, align 4, !tbaa !7
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @count(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !11, !noalias !12
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !11, !noalias !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !11, !noalias !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 4)
  %9 = bitcast i8* %8 to %struct.Cell*
  %10 = load i32, i32* %i.addr, align 4
  call void @Cell.constructor(%struct.Cell* %9, i32 %10)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !11, !noalias !12
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !11, !noalias !12
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !11, !noalias !12
  %18 = bitcast i8* %17 to %struct.Cell**
  %19 = getelementptr inbounds %struct.Cell*, %struct.Cell** %18, i64 %12
  store %struct.Cell* %9, %struct.Cell** %19, align 8, !alias.scope !12, !noalias !11, !tbaa !14
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !11, !noalias !12
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %24
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Pair* @summary(i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = call %struct.nish_array* @count(i32 %n)
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !11, !noalias !12
  %5 = trunc i64 %4 to i32
  call void @Pair.constructor(%struct.Pair* %1, i32 %5, i32 %n)
  ret %struct.Pair* %1
}

define noundef i32 @nish_main() #0 {
entry:
  %p.addr = alloca %struct.Pair*, align 8
  %junk.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Pair* @summary(i32 7)
  store %struct.Pair* %0, %struct.Pair** %p.addr, align 8
  %1 = call %struct.nish_array* @count(i32 64)
  store %struct.nish_array* %1, %struct.nish_array** %junk.addr, align 8
  %2 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %3 = getelementptr inbounds %struct.Pair, %struct.Pair* %2, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !6
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !7
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !11, !noalias !12
  %13 = trunc i64 %12 to i32
  %14 = sub nsw i32 %13, 64
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %14
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
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Cell", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Pair", !2, i64 0, !2, i64 4}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !2, i64 4}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"element ptr", !1, i64 0}
!14 = !{!13, !13, i64 0}
