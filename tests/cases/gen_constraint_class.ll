%struct.Shape = type { i32 }
%struct.Circle = type { i32, i32 }
%struct.Holder$$Circle = type { %struct.Circle* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %radius) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %radius)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 %radius)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %6 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 %4, i32* %6, align 4
  %7 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %radius, i32* %7, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %held.addr = alloca %struct.Holder$$Circle*, align 8
  %Holder$$Circle.obj = alloca %struct.Holder$$Circle, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Circle*
  call void @Circle.constructor(%struct.Circle* %1, i32 2)
  call void @Holder$$Circle.constructor(%struct.Holder$$Circle* %Holder$$Circle.obj, %struct.Circle* %1)
  store %struct.Holder$$Circle* %Holder$$Circle.obj, %struct.Holder$$Circle** %held.addr, align 8
  %2 = load %struct.Holder$$Circle*, %struct.Holder$$Circle** %held.addr, align 8
  %3 = call i32 @Holder$$Circle.area(%struct.Holder$$Circle* %2)
  ret i32 %3
}

define internal void @Holder$$Circle.constructor(%struct.Holder$$Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Circle* noundef nonnull align 8 dereferenceable(8) %item) #1 {
entry:
  %0 = getelementptr inbounds %struct.Holder$$Circle, %struct.Holder$$Circle* %this, i32 0, i32 0
  store %struct.Circle* %item, %struct.Circle** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @Holder$$Circle.area(%struct.Holder$$Circle* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Holder$$Circle, %struct.Holder$$Circle* %this, i32 0, i32 0
  %1 = load %struct.Circle*, %struct.Circle** %0, align 8, !tbaa !4
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  ret i32 %3
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Holder$$Circle", !2, i64 0}
!4 = !{!3, !2, i64 0}
