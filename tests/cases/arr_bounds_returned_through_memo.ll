%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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

define internal void @drain(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ys, i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sub nsw i32 %n, 1
  call void @pass(%struct.nish_array* %ys, i32 %1)
  br label %if.end

if.end:
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp eq i64 %3, 0
  br i1 %4, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %5 = sub i64 %3, 1
  store i64 %5, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %5
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret void
}

define internal void @pass(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ys, i32 noundef %n) #0 {
entry:
  call void @drain(%struct.nish_array* %ys, i32 %n)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @first() #0 {
entry:
  %arr.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = mul i64 4, 4
  %5 = call i8* @nish_alloc_struct(i64 %4)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %arr.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  call void @drain(%struct.nish_array* %7, i32 1)
  %8 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  ret %struct.nish_array* %8
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @second() #0 {
entry:
  %arr.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = mul i64 4, 4
  %5 = call i8* @nish_alloc_struct(i64 %4)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %arr.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  call void @pass(%struct.nish_array* %7, i32 1)
  %8 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  ret %struct.nish_array* %8
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @first()
  store %struct.nish_array* %0, %struct.nish_array** %a.addr, align 8
  %1 = call %struct.nish_array* @second()
  store %struct.nish_array* %1, %struct.nish_array** %b.addr, align 8
  %2 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  %7 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ult i64 3, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 3
  %15 = load i32, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
