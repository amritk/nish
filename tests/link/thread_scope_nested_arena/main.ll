%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"row \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c" of \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"inner \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$str$i32$fn.6.digits(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i8* noundef nonnull noalias readonly align 8, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define hidden noundef i32 @digits(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds i8, i8* %s, i64 8
  %8 = getelementptr inbounds i8, i8* %7, i64 %6
  %9 = load i8, i8* %8, align 1
  %10 = zext i8 %9 to i32
  store i32 %10, i32* %c.addr, align 4
  %11 = load i32, i32* %c.addr, align 4
  %12 = icmp sge i32 %11, 48
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %c.addr, align 4
  %14 = icmp sle i32 %13, 57
  br label %land.end

land.end:
  %15 = phi i1 [ false, %for.body ], [ %14, %land.rhs ]
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load i32, i32* %n.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %n.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = load i32, i32* %n.addr, align 4
  ret i32 %20
}

define internal noundef nonnull align 8 i8* @label(i32 noundef %k) #1 {
entry:
  %0 = mul nsw i32 %k, %k
  %1 = mul nsw i32 %0, %k
  %2 = mul nsw i32 %1, 999
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  %6 = call i8* @nish_str_from_i32(i32 %k)
  %7 = call i8* @nish_str_concat(i8* %5, i8* %6)
  ret i8* %7
}

define internal noundef i32 @counts() #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %inner.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %t.addr = alloca %struct.ThreadScope*, align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 1, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = call i8* @nish_alloc_struct(i64 4)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 0, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %12, %struct.nish_array** %inner.addr, align 8
  %19 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %19, %struct.ThreadScope** %s.addr, align 8
  %20 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %21 = bitcast %struct.ThreadScope* %20 to i8*
  %22 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %22, %struct.ThreadScope** %t.addr, align 8
  %23 = load %struct.ThreadScope*, %struct.ThreadScope** %t.addr, align 8
  %24 = bitcast %struct.ThreadScope* %23 to i8*
  %25 = load %struct.ThreadScope*, %struct.ThreadScope** %t.addr, align 8
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @label(i32 9)
  %28 = call i8* @nish_arena_keep(i64 %26, i8* %27)
  %29 = load %struct.nish_array*, %struct.nish_array** %inner.addr, align 8
  call void @nish.ThreadScope.spawn$str$i32$fn.6.digits(%struct.ThreadScope* %25, i8* %28, %struct.nish_array* %29, i32 0)
  call void @nish_scope_join(i8* %24)
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %30 = load i32, i32* %k.addr, align 4
  %31 = icmp slt i32 %30, 4
  br i1 %31, label %for.body, label %for.end

for.body:
  %32 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %33 = load i32, i32* %k.addr, align 4
  %34 = add nsw i32 %33, 1
  %35 = call i64 @nish_arena_mark()
  %36 = call i8* @label(i32 %34)
  %37 = call i8* @nish_arena_keep(i64 %35, i8* %36)
  %38 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %39 = load i32, i32* %k.addr, align 4
  call void @nish.ThreadScope.spawn$str$i32$fn.6.digits(%struct.ThreadScope* %32, i8* %37, %struct.nish_array* %38, i32 %39)
  br label %for.inc

for.inc:
  %40 = load i32, i32* %k.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %k.addr, align 4
  br label %for.cond

for.end:
  call void @nish_scope_join(i8* %21)
  %42 = load %struct.nish_array*, %struct.nish_array** %inner.addr, align 8
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = icmp ult i64 0, %44
  br i1 %45, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %44)
  unreachable

bounds.ok:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %42, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 0
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.2 to i8*), i8* %51)
  call void @nish_print(i8* %52)
  %53 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = icmp ult i64 0, %55
  br i1 %56, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %55)
  unreachable

bounds.ok.1:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 0
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %64 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = icmp ult i64 1, %66
  br i1 %67, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %66)
  unreachable

bounds.ok.2:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 1
  %72 = load i32, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %73 = call i8* @nish_str_from_i32(i32 %72)
  %74 = call i8* @nish_str_concat(i8* %63, i8* %73)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %76 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = icmp ult i64 2, %78
  br i1 %79, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 2, i64 %78)
  unreachable

bounds.ok.3:
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = bitcast i8* %81 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 2
  %84 = load i32, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %75, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %88 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = icmp ult i64 3, %90
  br i1 %91, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 3, i64 %90)
  unreachable

bounds.ok.4:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %94 = bitcast i8* %93 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 3
  %96 = load i32, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* %87, i8* %97)
  call void @nish_print(i8* %98)
  %99 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  %101 = load i8*, i8** %100, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %102 = bitcast i8* %101 to i32*
  %103 = getelementptr inbounds i32, i32* %102, i64 3
  %104 = load i32, i32* %103, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %105 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %107 = load i8*, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %108 = bitcast i8* %107 to i32*
  %109 = getelementptr inbounds i32, i32* %108, i64 0
  %110 = load i32, i32* %109, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %111 = sub nsw i32 %104, %110
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %111
}

define noundef i32 @nish_main() #2 {
entry:
  %last.addr = alloca i32, align 4
  %round.addr = alloca i32, align 4
  store i32 0, i32* %last.addr, align 4
  store i32 0, i32* %round.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %round.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call i32 @counts()
  store i32 %2, i32* %last.addr, align 4
  br label %for.inc

for.inc:
  %3 = load i32, i32* %round.addr, align 4
  %4 = add nsw i32 %3, 1
  store i32 %4, i32* %round.addr, align 4
  br label %for.cond

for.end:
  %5 = load i32, i32* %last.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
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
