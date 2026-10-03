%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i8 @nish.parallelReduce$u8$fn.4.step(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), i8 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #3
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
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = call i8* @nish_alloc_struct(i64 %1)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %1, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %xs.addr, align 8
  store i32 1, i32* %k.addr, align 4
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %13 = load i32, i32* %k.addr, align 4
  %14 = icmp sle i32 %13, 64
  br i1 %14, label %for.body, label %for.end

for.body:
  %15 = load i32, i32* %n.addr, align 4
  %16 = load i32, i32* %k.addr, align 4
  %17 = call i32 @start(i32 %15, i32 %16)
  %18 = sub nsw i32 %17, 1
  store i32 %18, i32* %last.addr, align 4
  %19 = load i32, i32* %last.addr, align 4
  %20 = icmp sge i32 %19, 0
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = load i32, i32* %last.addr, align 4
  %22 = trunc i64 %10 to i32
  %23 = icmp slt i32 %21, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %for.body ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  %25 = load i32, i32* %last.addr, align 4
  %26 = sext i32 %25 to i64
  %27 = bitcast i8* %12 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 %26
  store i8 1, i8* %28, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %k.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %32 = call i8 @nish.parallelReduce$u8$fn.4.step(%struct.nish_array* %31, i8 0)
  %33 = zext i8 %32 to i64
  %34 = call i8* @nish_str_from_u64(i64 %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %36 = load i32, i32* %n.addr, align 4
  %37 = call i32 @start(i32 %36, i32 63)
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* %35, i8* %38)
  %40 = call i8* @nish_str_concat(i8* %39, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %41 = load i32, i32* %n.addr, align 4
  %42 = call i32 @start(i32 %41, i32 64)
  %43 = call i8* @nish_str_from_i32(i32 %42)
  %44 = call i8* @nish_str_concat(i8* %40, i8* %43)
  call void @nish_print(i8* %44)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
