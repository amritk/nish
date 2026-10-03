%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_arena_used() #2
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

define internal noundef i32 @histogram(i32 noundef %n, i32 noundef %seed) #0 {
entry:
  %counts.addr = alloca %struct.nish_array*, align 8
  %x.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %best.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %counts.addr, align 8
  store i32 %seed, i32* %x.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp slt i32 %14, 1000
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %x.addr, align 4
  %17 = mul nsw i32 %16, 31
  %18 = add nsw i32 %17, 7
  %19 = srem i32 %18, 1000003
  store i32 %19, i32* %x.addr, align 4
  %20 = load i32, i32* %x.addr, align 4
  %21 = icmp eq i32 %n, 0
  %22 = icmp eq i32 %20, -2147483648
  %23 = icmp eq i32 %n, -1
  %24 = and i1 %22, %23
  %25 = or i1 %21, %24
  br i1 %25, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %21)
  unreachable

div.ok:
  %26 = srem i32 %20, %n
  %27 = sext i32 %26 to i64
  %28 = icmp ult i64 %27, %11
  br i1 %28, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %27, i64 %11)
  unreachable

bounds.ok:
  %29 = bitcast i8* %13 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %27
  %31 = load i32, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %best.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %35 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %40 = load i32, i32* %i.addr.1, align 4
  %41 = icmp slt i32 %40, %n
  br i1 %41, label %for.body.1, label %for.end.1

for.body.1:
  %42 = load i32, i32* %i.addr.1, align 4
  %43 = sext i32 %42 to i64
  %44 = icmp ult i64 %43, %37
  br i1 %44, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %43, i64 %37)
  unreachable

bounds.ok.1:
  %45 = bitcast i8* %39 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %43
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = load i32, i32* %best.addr, align 4
  %49 = sext i32 %48 to i64
  %50 = icmp ult i64 %49, %37
  br i1 %50, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %49, i64 %37)
  unreachable

bounds.ok.2:
  %51 = bitcast i8* %39 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 %49
  %53 = load i32, i32* %52, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = icmp sgt i32 %47, %53
  br i1 %54, label %if.then, label %if.end

if.then:
  %55 = load i32, i32* %i.addr.1, align 4
  store i32 %55, i32* %best.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %56 = load i32, i32* %i.addr.1, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %58 = load i32, i32* %best.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %58
}

define noundef i32 @nish_main() #0 {
entry:
  %before.addr = alloca i64, align 8
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %after.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @histogram(i32 16, i32 1)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i64 @nish_arena_used()
  store i64 %2, i64* %before.addr, align 8
  store i32 0, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 100000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %acc.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = srem i32 %6, 5
  %8 = add nsw i32 16, %7
  %9 = load i32, i32* %i.addr, align 4
  %10 = call i32 @histogram(i32 %8, i32 %9)
  %11 = add nsw i32 %5, %10
  store i32 %11, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %14 = call i64 @nish_arena_used()
  store i64 %14, i64* %after.addr, align 8
  %15 = load i64, i64* %before.addr, align 8
  %16 = call i8* @nish_str_from_i64(i64 %15)
  call void @nish_print(i8* %16)
  %17 = load i32, i32* %acc.addr, align 4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = load i64, i64* %after.addr, align 8
  %20 = call i8* @nish_str_from_i64(i64 %19)
  call void @nish_print(i8* %20)
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
