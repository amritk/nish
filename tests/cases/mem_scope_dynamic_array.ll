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
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 31)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 7)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %23 = icmp eq i32 1000003, 0
  %24 = icmp eq i32 %21, -2147483648
  %25 = icmp eq i32 1000003, -1
  %26 = and i1 %24, %25
  %27 = or i1 %23, %26
  br i1 %27, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %23)
  unreachable

div.ok:
  %28 = srem i32 %21, 1000003
  store i32 %28, i32* %x.addr, align 4
  %29 = load i32, i32* %x.addr, align 4
  %30 = icmp eq i32 %n, 0
  %31 = icmp eq i32 %29, -2147483648
  %32 = icmp eq i32 %n, -1
  %33 = and i1 %31, %32
  %34 = or i1 %30, %33
  br i1 %34, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %30)
  unreachable

div.ok.1:
  %35 = srem i32 %29, %n
  %36 = sext i32 %35 to i64
  %37 = icmp ult i64 %36, %11
  br i1 %37, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %36, i64 %11)
  unreachable

bounds.ok:
  %38 = bitcast i8* %13 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %36
  %40 = load i32, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %41 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %40, i32 1)
  %42 = extractvalue { i32, i1 } %41, 0
  %43 = extractvalue { i32, i1 } %41, 1
  br i1 %43, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %42, i32* %39, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %44 = load i32, i32* %i.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %best.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %46 = load %struct.nish_array*, %struct.nish_array** %counts.addr, align 8
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %51 = load i32, i32* %i.addr.1, align 4
  %52 = icmp slt i32 %51, %n
  br i1 %52, label %for.body.1, label %for.end.1

for.body.1:
  %53 = load i32, i32* %i.addr.1, align 4
  %54 = sext i32 %53 to i64
  %55 = icmp ult i64 %54, %48
  br i1 %55, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %54, i64 %48)
  unreachable

bounds.ok.1:
  %56 = bitcast i8* %50 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 %54
  %58 = load i32, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = load i32, i32* %best.addr, align 4
  %60 = sext i32 %59 to i64
  %61 = icmp ult i64 %60, %48
  br i1 %61, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %60, i64 %48)
  unreachable

bounds.ok.2:
  %62 = bitcast i8* %50 to i32*
  %63 = getelementptr inbounds i32, i32* %62, i64 %60
  %64 = load i32, i32* %63, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = icmp sgt i32 %58, %64
  br i1 %65, label %if.then, label %if.end

if.then:
  %66 = load i32, i32* %i.addr.1, align 4
  store i32 %66, i32* %best.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %67 = load i32, i32* %i.addr.1, align 4
  %68 = add nsw i32 %67, 1
  store i32 %68, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %69 = load i32, i32* %best.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %69

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ], [ 0, %bounds.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
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
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = call i64 @nish_arena_used()
  store i64 %21, i64* %after.addr, align 8
  %22 = load i64, i64* %before.addr, align 8
  %23 = call i8* @nish_str_from_i64(i64 %22)
  call void @nish_print(i8* %23)
  %24 = load i32, i32* %acc.addr, align 4
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  %26 = load i64, i64* %after.addr, align 8
  %27 = call i8* @nish_str_from_i64(i64 %26)
  call void @nish_print(i8* %27)
  call void @nish_arena_release(i64 %arena.mark)
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
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
