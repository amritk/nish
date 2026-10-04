%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i8 @nish.parallelReduce$u8$fn.4.step(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i8 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #3
declare void @nish_exit(i32 noundef) #4
declare void @nish_panic_div(i1 noundef zeroext) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0

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

define hidden noundef i8 @step(i8 noundef %acc, i8 noundef %x) #0 {
entry:
  %0 = mul i8 %acc, 2
  %1 = add i8 %0, %x
  ret i8 %1
}

define internal noundef i32 @start(i32 noundef %n, i32 noundef %k) #1 {
entry:
  %0 = sext i32 %n to i64
  %1 = sext i32 %k to i64
  %2 = mul nsw i64 %0, %1
  %3 = sext i32 64 to i64
  %4 = icmp eq i64 %3, 0
  %5 = icmp eq i64 %2, -9223372036854775808
  %6 = icmp eq i64 %3, -1
  %7 = and i1 %5, %6
  %8 = or i1 %4, %7
  br i1 %8, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %4)
  unreachable

div.ok:
  %9 = sdiv i64 %2, %3
  %10 = trunc i64 %9 to i32
  ret i32 %10
}

define noundef i32 @nish_main() #1 {
entry:
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %last.addr = alloca i32, align 4
  store i32 70000001, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = icmp ule i64 %1, 2147483647
  br i1 %2, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 %1, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = call i8* @nish_alloc_struct(i64 %1)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %1, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %4, %struct.nish_array** %xs.addr, align 8
  store i32 1, i32* %k.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %14 = load i32, i32* %k.addr, align 4
  %15 = icmp sle i32 %14, 64
  br i1 %15, label %for.body, label %for.end

for.body:
  %16 = load i32, i32* %n.addr, align 4
  %17 = load i32, i32* %k.addr, align 4
  %18 = call i32 @start(i32 %16, i32 %17)
  %19 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %18, i32 1)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %20, i32* %last.addr, align 4
  %22 = load i32, i32* %last.addr, align 4
  %23 = icmp sge i32 %22, 0
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %last.addr, align 4
  %25 = trunc i64 %11 to i32
  %26 = icmp slt i32 %24, %25
  br label %land.end

land.end:
  %27 = phi i1 [ false, %ovf.ok ], [ %26, %land.rhs ]
  br i1 %27, label %if.then, label %if.end

if.then:
  %28 = load i32, i32* %last.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = bitcast i8* %13 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 %29
  store i8 1, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %32 = load i32, i32* %k.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %35 = call i8 @nish.parallelReduce$u8$fn.4.step(%struct.nish_array* %34, i8 0)
  %36 = zext i8 %35 to i64
  %37 = call i8* @nish_str_from_u64(i64 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %39 = load i32, i32* %n.addr, align 4
  %40 = call i32 @start(i32 %39, i32 63)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %38, i8* %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %44 = load i32, i32* %n.addr, align 4
  %45 = call i32 @start(i32 %44, i32 64)
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* %43, i8* %46)
  call void @nish_print(i8* %47)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
