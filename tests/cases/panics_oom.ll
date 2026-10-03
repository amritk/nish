%struct.Point = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Point* @make(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  %2 = add nsw i32 %x, 1
  call void @Point.constructor(%struct.Point* %1, i32 %x, i32 %2)
  ret %struct.Point* %1
}

define internal noundef i32 @caller(i32 noundef %x) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Point* @make(i32 %x)
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %0, i32 0, i32 1
  %2 = load i32, i32* %1, align 4, !tbaa !5
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @caller(i32 4)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
