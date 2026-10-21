%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

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

define internal void @Circle.constructor(%struct.Circle* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Circle, %struct.Circle* %this, i32 0, i32 1
  store i32 %r, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @Square.constructor(%struct.Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %side) #0 {
entry:
  %0 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !7
  %1 = getelementptr inbounds %struct.Square, %struct.Square* %this, i32 0, i32 1
  store i32 %side, i32* %1, align 4, !tbaa !8
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @key() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 5, i64* %2, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 5, i64* %3, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %4 = call i8* @nish_alloc_struct(i64 5)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 3, i8* %7, align 1, !alias.scope !13, !noalias !12, !tbaa !21
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 1, i8* %8, align 1, !alias.scope !13, !noalias !12, !tbaa !21
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 4, i8* %9, align 1, !alias.scope !13, !noalias !12, !tbaa !21
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 1, i8* %10, align 1, !alias.scope !13, !noalias !12, !tbaa !21
  %11 = getelementptr inbounds i8, i8* %6, i64 4
  store i8 5, i8* %11, align 1, !alias.scope !13, !noalias !12, !tbaa !21
  ret %struct.nish_array* %1
}

define hidden noundef i32 @sum$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %total.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i8*
  %11 = getelementptr inbounds i8, i8* %10, i64 %9
  %12 = load i8, i8* %11, align 1, !alias.scope !13, !noalias !12, !tbaa !21
  %13 = zext i8 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load i32, i32* %total.addr, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @weigh(%union.tagged* noundef %s) #1 {
entry:
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %out.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @key()
  %1 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %0)
  store %struct.Secret$arr.u8* %1, %struct.Secret$arr.u8** %k.addr, align 8
  store i32 0, i32* %out.addr, align 4
  %2 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  switch i32 %3, label %sw.unreachable [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %4 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %5 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %4)
  %6 = bitcast %union.tagged* %s to %struct.Circle*
  %7 = getelementptr inbounds %struct.Circle, %struct.Circle* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !5
  %9 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %5, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %out.addr, align 4
  %12 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %12)
  br label %sw.end

sw.case.1:
  %13 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %14 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %13)
  %15 = bitcast %union.tagged* %s to %struct.Square*
  %16 = getelementptr inbounds %struct.Square, %struct.Square* %15, i32 0, i32 1
  %17 = load i32, i32* %16, align 4, !tbaa !8
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %19, i32* %out.addr, align 4
  %21 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %21)
  br label %sw.end

sw.unreachable:
  unreachable

sw.end:
  %22 = load i32, i32* %out.addr, align 4
  ret i32 %22

ovf.fail:
  %ovf.op = phi i32 [ 2, %sw.case ], [ 0, %sw.case.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %Circle.obj = alloca %struct.Circle, align 8
  %Square.obj = alloca %struct.Square, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Circle.constructor(%struct.Circle* %Circle.obj, i32 2)
  %0 = bitcast %struct.Circle* %Circle.obj to %union.tagged*
  %1 = call i32 @weigh(%union.tagged* %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  call void @Square.constructor(%struct.Square* %Square.obj, i32 5)
  %3 = bitcast %struct.Square* %Square.obj to %union.tagged*
  %4 = call i32 @weigh(%union.tagged* %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !24
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u8*
  call void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u8* %1
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = call i32 @sum$(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %3, i1 true)
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Circle", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"Square", !2, i64 0, !2, i64 4}
!7 = !{!6, !2, i64 0}
!8 = !{!6, !2, i64 4}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element i8", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{!"ptr", !1, i64 0}
!23 = !{!"Secret$arr.u8", !22, i64 0}
!24 = !{!23, !22, i64 0}
