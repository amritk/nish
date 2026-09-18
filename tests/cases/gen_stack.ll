%struct.Box$str = type { i8* }
%struct.Box$i32 = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"kept\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
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

define internal noundef i32 @sumOf(i32 noundef %v) #0 {
entry:
  %local.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 %v)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %local.addr, align 8
  %0 = load %struct.Box$i32*, %struct.Box$i32** %local.addr, align 8
  %1 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  ret i32 %2
}

define internal void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %v, i8** %0, align 8, !tbaa !7
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Box$str* @escaping(i8* noundef nonnull noalias readonly align 8 %v) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Box$str*
  call void @Box$str.constructor(%struct.Box$str* %1, i8* %v)
  ret %struct.Box$str* %1
}

define noundef i32 @test() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Box$str* @escaping(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %0, i32 0, i32 0
  %2 = load i8*, i8** %1, align 8, !tbaa !7
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  %3 = call i32 @sumOf(i32 7)
  ret i32 %3
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box$i32", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Box$str", !5, i64 0}
!7 = !{!6, !5, i64 0}
