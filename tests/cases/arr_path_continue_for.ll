%struct.H = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" i=\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal void @H.constructor(%struct.H* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.H*, align 8
  %H.obj = alloca %struct.H, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 8, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 8, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 32)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 10, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 20, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 30, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 40, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 50, i32* %11, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 60, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %13 = getelementptr inbounds i32, i32* %6, i64 6
  store i32 70, i32* %13, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %14 = getelementptr inbounds i32, i32* %6, i64 7
  store i32 80, i32* %14, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  call void @H.constructor(%struct.H* %H.obj, %struct.nish_array* %1)
  store %struct.H* %H.obj, %struct.H** %h.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp sge i32 %15, 0
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = load %struct.H*, %struct.H** %h.addr, align 8
  %19 = getelementptr inbounds %struct.H, %struct.H* %18, i32 0, i32 0
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = trunc i64 %22 to i32
  %24 = icmp slt i32 %17, %23
  br label %land.end

land.end:
  %25 = phi i1 [ false, %for.cond ], [ %24, %land.rhs ]
  br i1 %25, label %for.body, label %for.end

for.body:
  %26 = load i32, i32* %n.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 1)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %28, i32* %n.addr, align 4
  %30 = load i32, i32* %n.addr, align 4
  %31 = icmp eq i32 %30, 1
  br i1 %31, label %if.then, label %if.end

if.then:
  %32 = load %struct.H*, %struct.H** %h.addr, align 8
  %33 = call i8* @nish_alloc_struct(i64 24)
  %34 = bitcast i8* %33 to %struct.nish_array*
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  store i64 1, i64* %35, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  store i64 1, i64* %36, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %37 = call i8* @nish_alloc_struct(i64 4)
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %39 = bitcast i8* %37 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 0
  store i32 1, i32* %40, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %41 = getelementptr inbounds %struct.H, %struct.H* %32, i32 0, i32 0
  store %struct.nish_array* %34, %struct.nish_array** %41, align 8, !tbaa !4
  store i32 7, i32* %i.addr, align 4
  br label %for.inc

if.end:
  %42 = load i32, i32* %n.addr, align 4
  %43 = icmp sgt i32 %42, 3
  br i1 %43, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.end

if.end.1:
  br label %for.inc

for.inc:
  %44 = load %struct.H*, %struct.H** %h.addr, align 8
  %45 = getelementptr inbounds %struct.H, %struct.H* %44, i32 0, i32 0
  %46 = load %struct.nish_array*, %struct.nish_array** %45, align 8, !tbaa !4
  %47 = load i32, i32* %i.addr, align 4
  %48 = sext i32 %47 to i64
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %51 = icmp ult i64 %48, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %48, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 %48
  store i32 1000000, i32* %55, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  br label %for.cond

for.end:
  %56 = load i32, i32* %n.addr, align 4
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %60 = load i32, i32* %i.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %59, i8* %61)
  call void @nish_print(i8* %62)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
