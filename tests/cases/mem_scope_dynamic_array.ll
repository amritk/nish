%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_arena_used() #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3

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

define internal noundef i32 @histogram(i32 noundef %n, i32 noundef %seed) #0 {
entry:
  %counts.addr = alloca %struct.nish_array*, align 8
  %x.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %best.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 %n to i64
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = mul i64 %0, 4
  %6 = call i8* @nish_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %2, %struct.nish_array** %counts.addr, align 8
  store i32 %seed, i32* %x.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %13 = load i32, i32* %i.addr, align 4
  %14 = icmp slt i32 %13, 1000
  br i1 %14, label %for.body, label %for.end

for.body:
  %15 = load i32, i32* %x.addr, align 4
  %16 = mul nsw i32 %15, 31
  %17 = add nsw i32 %16, 7
  %18 = icmp eq i32 1000003, 0
  %19 = icmp eq i32 %17, -2147483648
  %20 = icmp eq i32 1000003, -1
  %21 = and i1 %19, %20
  %22 = or i1 %18, %21
  br i1 %22, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %18)
  unreachable

div.ok:
  %23 = srem i32 %17, 1000003
  store i32 %23, i32* %x.addr, align 4
  %24 = load i32, i32* %x.addr, align 4
  %25 = icmp eq i32 %n, 0
  %26 = icmp eq i32 %24, -2147483648
  %27 = icmp eq i32 %n, -1
  %28 = and i1 %26, %27
  %29 = or i1 %25, %28
  br i1 %29, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %25)
  unreachable

div.ok.1:
  %30 = srem i32 %24, %n
  %31 = sext i32 %30 to i64
  %32 = icmp ult i64 %31, %10
  br i1 %32, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %31, i64 %10)
  unreachable

bounds.ok:
  %33 = bitcast i8* %12 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %31
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %36 = add nsw i32 %35, 1
  store i32 %36, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %best.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %39 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4
  br label %for.cond.1

for.cond.1:
  %44 = load i32, i32* %i.addr.1, align 4
  %45 = icmp slt i32 %44, %n
  br i1 %45, label %for.body.1, label %for.end.1

for.body.1:
  %46 = load i32, i32* %i.addr.1, align 4
  %47 = sext i32 %46 to i64
  %48 = icmp ult i64 %47, %41
  br i1 %48, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %47, i64 %41)
  unreachable

bounds.ok.1:
  %49 = bitcast i8* %43 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 %47
  %51 = load i32, i32* %50, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %52 = load i32, i32* %best.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = icmp ult i64 %53, %41
  br i1 %54, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %53, i64 %41)
  unreachable

bounds.ok.2:
  %55 = bitcast i8* %43 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %53
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %58 = icmp sgt i32 %51, %57
  br i1 %58, label %if.then, label %if.end

if.then:
  %59 = load i32, i32* %i.addr.1, align 4
  store i32 %59, i32* %best.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %60 = load i32, i32* %i.addr.1, align 4
  %61 = add nsw i32 %60, 1
  store i32 %61, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %62 = load i32, i32* %best.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %62
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
  %7 = icmp eq i32 5, 0
  %8 = icmp eq i32 %6, -2147483648
  %9 = icmp eq i32 5, -1
  %10 = and i1 %8, %9
  %11 = or i1 %7, %10
  br i1 %11, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %7)
  unreachable

div.ok:
  %12 = srem i32 %6, 5
  %13 = add nsw i32 16, %12
  %14 = load i32, i32* %i.addr, align 4
  %15 = call i32 @histogram(i32 %13, i32 %14)
  %16 = add nsw i32 %5, %15
  store i32 %16, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = call i64 @nish_arena_used()
  store i64 %19, i64* %after.addr, align 8
  %20 = load i64, i64* %before.addr, align 8
  %21 = call i8* @nish_str_from_i64(i64 %20)
  call void @nish_print(i8* %21)
  %22 = load i32, i32* %acc.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load i64, i64* %after.addr, align 8
  %25 = call i8* @nish_str_from_i64(i64 %24)
  call void @nish_print(i8* %25)
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
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}
