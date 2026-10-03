%struct.Sample = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
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

define noundef nonnull align 8 dereferenceable(4) %struct.Sample* @reading(i32 noundef %value) #0 {
entry:
  %s.addr = alloca %struct.Sample*, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Sample*
  %2 = getelementptr inbounds %struct.Sample, %struct.Sample* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !4
  store %struct.Sample* %1, %struct.Sample** %s.addr, align 8
  %3 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  %4 = getelementptr inbounds %struct.Sample, %struct.Sample* %3, i32 0, i32 0
  store i32 %value, i32* %4, align 4, !tbaa !4
  %5 = load %struct.Sample*, %struct.Sample** %s.addr, align 8
  ret %struct.Sample* %5
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Sample", !2, i64 0}
!4 = !{!3, !2, i64 0}
