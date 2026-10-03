%struct.E = type { i32 }
%struct.Link = type { %struct.E* }
%struct.Holder = type { %struct.E* }
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
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define internal void @show(%struct.E* noundef readonly align 4 nocapture %e) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp ne %struct.E* %e, null
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = getelementptr inbounds %struct.E, %struct.E* %e, i32 0, i32 0
  %2 = load i32, i32* %1, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define void @nish_main() #0 {
entry:
  %E.obj = alloca %struct.E, align 8
  %l.addr = alloca %struct.Link*, align 8
  %Link.obj = alloca %struct.Link, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %0 = getelementptr inbounds %struct.E, %struct.E* %E.obj, i32 0, i32 0
  store i32 1, i32* %0, align 4
  call void @show(%struct.E* %E.obj)
  %1 = call i8* @nish_alloc_struct(i64 4)
  %2 = bitcast i8* %1 to %struct.E*
  %3 = getelementptr inbounds %struct.E, %struct.E* %2, i32 0, i32 0
  store i32 2, i32* %3, align 4
  %4 = getelementptr inbounds %struct.Link, %struct.Link* %Link.obj, i32 0, i32 0
  store %struct.E* %2, %struct.E** %4, align 8
  store %struct.Link* %Link.obj, %struct.Link** %l.addr, align 8
  %5 = load %struct.Link*, %struct.Link** %l.addr, align 8
  %6 = getelementptr inbounds %struct.Link, %struct.Link* %5, i32 0, i32 0
  %7 = load %struct.E*, %struct.E** %6, align 8
  call void @show(%struct.E* %7)
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 0
  store %struct.E* null, %struct.E** %8, align 8, !tbaa !4
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %9 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 4)
  %11 = bitcast i8* %10 to %struct.E*
  %12 = getelementptr inbounds %struct.E, %struct.E* %11, i32 0, i32 0
  store i32 3, i32* %12, align 4
  %13 = getelementptr inbounds %struct.Holder, %struct.Holder* %9, i32 0, i32 0
  store %struct.E* %11, %struct.E** %13, align 8, !tbaa !4
  %14 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %15 = getelementptr inbounds %struct.Holder, %struct.Holder* %14, i32 0, i32 0
  %16 = load %struct.E*, %struct.E** %15, align 8, !tbaa !4
  call void @show(%struct.E* %16)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder", !2, i64 0}
!4 = !{!3, !2, i64 0}
