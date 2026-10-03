%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @llvm.memmove.p0i8.p0i8.i64(i8* nocapture writeonly, i8* nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_exit(i32 noundef) #5
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @key() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 5, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 5, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 5)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 3, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 1, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 4, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 1, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8, i8* %6, i64 4
  store i8 5, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %1
}

define hidden noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
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
  %12 = load i8, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = zext i8 %12 to i32
  %14 = add nsw i32 %7, %13
  store i32 %14, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %total.addr, align 4
  ret i32 %17
}

define hidden noundef i32 @wipedSum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #2 {
entry:
  %copy.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = sext i32 %2 to i64
  %4 = icmp ule i64 %3, 2147483647
  br i1 %4, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 %3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = call i8* @nish_alloc_struct(i64 %3)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %3, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %copy.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %copy.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = add i64 0, %13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ule i64 0, %14
  %18 = icmp ule i64 %14, %16
  %19 = and i1 %17, %18
  br i1 %19, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 0, i64 %14, i64 %16)
  unreachable

set.ok:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %21 to i8*
  %23 = getelementptr inbounds i8, i8* %22, i64 0
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i8*
  %27 = getelementptr inbounds i8, i8* %26, i64 0
  call void @llvm.memmove.p0i8.p0i8.i64(i8* %23, i8* %27, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %28 = load %struct.nish_array*, %struct.nish_array** %copy.addr, align 8
  call void @nish.wipe$arr.u8(%struct.nish_array* %28)
  %29 = load %struct.nish_array*, %struct.nish_array** %copy.addr, align 8
  %30 = call i32 @sum(%struct.nish_array* %29)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %30
}

define noundef i32 @nish_main() #2 {
entry:
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @key()
  %1 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %0)
  store %struct.Secret$arr.u8* %1, %struct.Secret$arr.u8** %k.addr, align 8
  %2 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %3 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %2)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %6 = call i32 @nish.exposeWith$arr.u8$i32$i32$fn.16.nish_main$arrow0(%struct.Secret$arr.u8* %5, i32 10)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %9 = call i32 @nish.expose$arr.u8$i32$fn.8.wipedSum(%struct.Secret$arr.u8* %8)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %11)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define hidden noundef i32 @nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %v, i32 noundef %scale) #3 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %v, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = mul nsw i32 %2, %scale
  ret i32 %3
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !17
  ret void
}

define internal void @nish.wipe$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %_target) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 1
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %_target, i32 0, i32 2
  %3 = load i8*, i8** %2, align 8
  call void @llvm.memset.p0i8.i64(i8* %3, i8 0, i64 %1, i1 true)
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
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = call i32 @sum(%struct.nish_array* %1)
  ret i32 %2
}

define internal noundef i32 @nish.exposeWith$arr.u8$i32$i32$fn.16.nish_main$arrow0(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s, i32 noundef %arg) #3 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = call i32 @nish_main$arrow0(%struct.nish_array* %1, i32 %arg)
  ret i32 %2
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.8.wipedSum(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #2 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = call i32 @wipedSum(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #2 {
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
attributes #1 = { nounwind readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Secret$arr.u8", !15, i64 0}
!17 = !{!16, !15, i64 0}
