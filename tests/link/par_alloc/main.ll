%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"small\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"fizz \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.parallelMapInto$i32$i32$fn.5.label(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_div(i1 noundef zeroext) #4

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

define hidden noundef i32 @label(i32 noundef %x) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = icmp eq i32 3, 0
  %1 = icmp eq i32 %x, -2147483648
  %2 = icmp eq i32 3, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %x, 3
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = call i8* @nish_str_from_i32(i32 %x)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %7)
  store i8* %8, i8** %s.addr, align 8
  br label %if.end

if.end:
  %9 = load i8*, i8** %s.addr, align 8
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %12
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %src.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %dst.addr = alloca %struct.nish_array*, align 8
  %sum.addr = alloca i64, align 8
  %i.addr.1 = alloca i32, align 4
  store i32 1000000, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = icmp ule i64 %1, 2147483647
  br i1 %2, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 %1, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = mul i64 %1, 4
  %8 = call i8* @nish_alloc_struct(i64 %7)
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %4, %struct.nish_array** %src.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %12 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %for.body, label %for.end

for.body:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %i.addr, align 4
  %21 = bitcast i8* %14 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 %19
  store i32 %20, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load i32, i32* %n.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = icmp ule i64 %26, 2147483647
  br i1 %27, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.2 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.1:
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 %26, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 %26, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = mul i64 %26, 4
  %33 = call i8* @nish_alloc_struct(i64 %32)
  call void @llvm.memset.p0i8.i64(i8* align 8 %33, i8 0, i64 %32, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* %33, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %29, %struct.nish_array** %dst.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.5.label(%struct.nish_array* %35, %struct.nish_array* %36)
  store i64 0, i64* %sum.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  %37 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %42 = load i32, i32* %i.addr.1, align 4
  %43 = trunc i64 %39 to i32
  %44 = icmp slt i32 %42, %43
  br i1 %44, label %for.body.1, label %for.end.1

for.body.1:
  %45 = load i64, i64* %sum.addr, align 8
  %46 = load i32, i32* %i.addr.1, align 4
  %47 = sext i32 %46 to i64
  %48 = bitcast i8* %41 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %47
  %50 = load i32, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = sext i32 %50 to i64
  %52 = add nsw i64 %45, %51
  store i64 %52, i64* %sum.addr, align 8
  br label %for.inc.1

for.inc.1:
  %53 = load i32, i32* %i.addr.1, align 4
  %54 = add nsw i32 %53, 1
  store i32 %54, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %55 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = icmp ult i64 0, %57
  br i1 %58, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %57)
  unreachable

bounds.ok:
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %61 = bitcast i8* %60 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 0
  %63 = load i32, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %64 = call i8* @nish_str_from_i32(i32 %63)
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %66 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = icmp ult i64 1, %68
  br i1 %69, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %68)
  unreachable

bounds.ok.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %72 = bitcast i8* %71 to i32*
  %73 = getelementptr inbounds i32, i32* %72, i64 1
  %74 = load i32, i32* %73, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = call i8* @nish_str_from_i32(i32 %74)
  %76 = call i8* @nish_str_concat(i8* %65, i8* %75)
  %77 = call i8* @nish_str_concat(i8* %76, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %78 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = icmp ult i64 999999, %80
  br i1 %81, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 999999, i64 %80)
  unreachable

bounds.ok.2:
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %83 = load i8*, i8** %82, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %84 = bitcast i8* %83 to i32*
  %85 = getelementptr inbounds i32, i32* %84, i64 999999
  %86 = load i32, i32* %85, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* %77, i8* %87)
  %89 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %90 = load i64, i64* %sum.addr, align 8
  %91 = call i8* @nish_str_from_i64(i64 %90)
  %92 = call i8* @nish_str_concat(i8* %89, i8* %91)
  call void @nish_print(i8* %92)
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
attributes #3 = { noreturn nounwind }
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
