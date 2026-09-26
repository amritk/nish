%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #2
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #1

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

define hidden noundef i32 @triple(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 3
  ret i32 %0
}

define internal noundef i32 @firstTriple(i32 noundef %k, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %out) #1 {
entry:
  %s.addr = alloca %struct.ThreadScope*, align 8
  %0 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %0, %struct.ThreadScope** %s.addr, align 8
  %1 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %2 = bitcast %struct.ThreadScope* %1 to i8*
  %3 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %3, i32 %k, %struct.nish_array* %out, i32 0)
  %4 = icmp sgt i32 %k, 1
  br i1 %4, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %2)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 0, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %12

if.end:
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = add nsw i32 %k, 1
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %13, i32 %14, %struct.nish_array* %out, i32 1)
  call void @nish_scope_join(i8* %2)
  %15 = sub nsw i32 0, 1
  ret i32 %15
}

define noundef i32 @nish_main() #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %n.addr = alloca i32, align 4
  %s.addr.1 = alloca %struct.ThreadScope*, align 8
  %j.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, 3
  br i1 %11, label %for.body, label %for.end

for.body:
  %12 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %12, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = bitcast %struct.ThreadScope* %13 to i8*
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 10, %16
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %19 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %15, i32 %17, %struct.nish_array* %18, i32 %19)
  %20 = load i32, i32* %i.addr, align 4
  %21 = icmp eq i32 %20, 0
  br i1 %21, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %14)
  br label %for.inc

if.end:
  %22 = load i32, i32* %i.addr, align 4
  %23 = icmp eq i32 %22, 1
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_scope_join(i8* %14)
  br label %for.end

if.end.1:
  call void @nish_scope_join(i8* %14)
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = icmp ult i64 0, %28
  br i1 %29, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %28)
  unreachable

bounds.ok:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = bitcast i8* %31 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 0
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %37 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = icmp ult i64 1, %39
  br i1 %40, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %39)
  unreachable

bounds.ok.1:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = bitcast i8* %42 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 1
  %45 = load i32, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %36, i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %49 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 2, %51
  br i1 %52, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %51)
  unreachable

bounds.ok.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 2
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %58 = call i8* @nish_str_from_i32(i32 %57)
  %59 = call i8* @nish_str_concat(i8* %48, i8* %58)
  call void @nish_print(i8* %59)
  store i32 0, i32* %n.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %60 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %60, %struct.ThreadScope** %s.addr.1, align 8
  %61 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %62 = bitcast %struct.ThreadScope* %61 to i8*
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %63 = load i32, i32* %j.addr, align 4
  %64 = icmp slt i32 %63, 2
  br i1 %64, label %for.body.1, label %for.end.1

for.body.1:
  %65 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr.1, align 8
  %66 = load i32, i32* %j.addr, align 4
  %67 = load i32, i32* %n.addr, align 4
  %68 = add nsw i32 %66, %67
  %69 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %70 = load i32, i32* %j.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %65, i32 %68, %struct.nish_array* %69, i32 %70)
  %71 = load i32, i32* %j.addr, align 4
  %72 = icmp eq i32 %71, 0
  br i1 %72, label %if.then.2, label %if.end.2

if.then.2:
  br label %for.inc.1

if.end.2:
  br label %for.inc.1

for.inc.1:
  %73 = load i32, i32* %j.addr, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %75 = load i32, i32* %n.addr, align 4
  %76 = add nsw i32 %75, 1
  store i32 %76, i32* %n.addr, align 4
  %77 = load i32, i32* %n.addr, align 4
  %78 = icmp eq i32 %77, 2
  br i1 %78, label %if.then.3, label %if.end.3

if.then.3:
  call void @nish_scope_join(i8* %62)
  br label %while.end

if.end.3:
  call void @nish_scope_join(i8* %62)
  br label %while.cond

while.end:
  %79 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = icmp ult i64 0, %81
  br i1 %82, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %81)
  unreachable

bounds.ok.3:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %85 = bitcast i8* %84 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 0
  %87 = load i32, i32* %86, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %88 = call i8* @nish_str_from_i32(i32 %87)
  %89 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %90 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = icmp ult i64 1, %92
  br i1 %93, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 1, i64 %92)
  unreachable

bounds.ok.4:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %96 = bitcast i8* %95 to i32*
  %97 = getelementptr inbounds i32, i32* %96, i64 1
  %98 = load i32, i32* %97, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %99 = call i8* @nish_str_from_i32(i32 %98)
  %100 = call i8* @nish_str_concat(i8* %89, i8* %99)
  call void @nish_print(i8* %100)
  %101 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %102 = call i32 @firstTriple(i32 5, %struct.nish_array* %101)
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = call i8* @nish_str_concat(i8* %103, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %105 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = icmp ult i64 0, %107
  br i1 %108, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 0, i64 %107)
  unreachable

bounds.ok.5:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %111 = bitcast i8* %110 to i32*
  %112 = getelementptr inbounds i32, i32* %111, i64 0
  %113 = load i32, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %114 = call i8* @nish_str_from_i32(i32 %113)
  %115 = call i8* @nish_str_concat(i8* %104, i8* %114)
  call void @nish_print(i8* %115)
  %116 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %117 = call i32 @firstTriple(i32 0, %struct.nish_array* %116)
  %118 = call i8* @nish_str_from_i32(i32 %117)
  %119 = call i8* @nish_str_concat(i8* %118, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %120 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = icmp ult i64 0, %122
  br i1 %123, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %122)
  unreachable

bounds.ok.6:
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %126 = bitcast i8* %125 to i32*
  %127 = getelementptr inbounds i32, i32* %126, i64 0
  %128 = load i32, i32* %127, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %129 = call i8* @nish_str_from_i32(i32 %128)
  %130 = call i8* @nish_str_concat(i8* %119, i8* %129)
  %131 = call i8* @nish_str_concat(i8* %130, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %132 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 0
  %134 = load i64, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %135 = icmp ult i64 1, %134
  br i1 %135, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 1, i64 %134)
  unreachable

bounds.ok.7:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %132, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = bitcast i8* %137 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 1
  %140 = load i32, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %141 = call i8* @nish_str_from_i32(i32 %140)
  %142 = call i8* @nish_str_concat(i8* %131, i8* %141)
  call void @nish_print(i8* %142)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
