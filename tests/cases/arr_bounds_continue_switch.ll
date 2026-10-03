%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" i=\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
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

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 8, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 8, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 32)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 10, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 20, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 30, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 40, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 50, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 60, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i32, i32* %6, i64 6
  store i32 70, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i32, i32* %6, i64 7
  store i32 80, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
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
  %18 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = icmp slt i32 %17, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %for.cond ], [ %22, %land.rhs ]
  br i1 %23, label %for.body, label %for.end

for.body:
  %24 = load i32, i32* %n.addr, align 4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 1)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %26, i32* %n.addr, align 4
  %28 = load i32, i32* %n.addr, align 4
  switch i32 %28, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %29 = call i8* @nish_alloc_struct(i64 24)
  %30 = bitcast i8* %29 to %struct.nish_array*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  store i64 1, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 1
  store i64 1, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = call i8* @nish_alloc_struct(i64 4)
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %33 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 0
  store i32 1, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %30, %struct.nish_array** %xs.addr, align 8
  store i32 7, i32* %i.addr, align 4
  br label %for.inc

sw.default:
  br label %sw.end

sw.end:
  %37 = load i32, i32* %i.addr, align 4
  %38 = icmp slt i32 %37, 0
  br i1 %38, label %lor.end, label %lor.rhs

lor.rhs:
  %39 = load i32, i32* %i.addr, align 4
  %40 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = trunc i64 %42 to i32
  %44 = icmp sge i32 %39, %43
  br label %lor.end

lor.end:
  %45 = phi i1 [ true, %sw.end ], [ %44, %lor.rhs ]
  br i1 %45, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %46 = load i32, i32* %n.addr, align 4
  %47 = icmp sgt i32 %46, 3
  br i1 %47, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.end

if.end.1:
  br label %for.inc

for.inc:
  %48 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %49 = load i32, i32* %i.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 %50, %52
  br i1 %53, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %50, i64 %52)
  unreachable

bounds.ok:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %50
  store i32 1000000, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.cond

for.end:
  %58 = load i32, i32* %n.addr, align 4
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %62 = load i32, i32* %i.addr, align 4
  %63 = call i8* @nish_str_from_i32(i32 %62)
  %64 = call i8* @nish_str_concat(i8* %61, i8* %63)
  call void @nish_print(i8* %64)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
