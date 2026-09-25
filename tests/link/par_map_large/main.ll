%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish.parallelMapInto$i32$i32$fn.3.mix(%struct.nish_array* noundef nonnull align 8 dereferenceable(24), %struct.nish_array* noundef nonnull align 8 dereferenceable(24)) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
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

define hidden noundef i32 @mix(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 31
  %1 = add nsw i32 %0, 7
  %2 = icmp eq i32 1000, 0
  %3 = icmp eq i32 %1, -2147483648
  %4 = icmp eq i32 1000, -1
  %5 = and i1 %3, %4
  %6 = or i1 %2, %5
  br i1 %6, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = srem i32 %1, 1000
  ret i32 %7
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %src.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %dst.addr = alloca %struct.nish_array*, align 8
  %sum.addr = alloca i64, align 8
  %i.addr.1 = alloca i32, align 4
  store i32 3000000, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8, !alias.scope !3, !noalias !4
  %6 = mul i64 %1, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %3, %struct.nish_array** %src.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = load i32, i32* %i.addr, align 4
  %20 = bitcast i8* %13 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %18
  store i32 %19, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %n.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 %25, i64* %28, align 8, !alias.scope !3, !noalias !4
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 %25, i64* %29, align 8, !alias.scope !3, !noalias !4
  %30 = mul i64 %25, 4
  %31 = call i8* @nish_alloc_struct(i64 %30)
  call void @llvm.memset.p0i8.i64(i8* align 8 %31, i8 0, i64 %30, i1 false), !alias.scope !4, !noalias !3
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* %31, i8** %32, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %27, %struct.nish_array** %dst.addr, align 8
  %33 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %34 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  call void @nish.parallelMapInto$i32$i32$fn.3.mix(%struct.nish_array* %33, %struct.nish_array* %34)
  store i64 0, i64* %sum.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  %35 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4
  br label %for.cond.1

for.cond.1:
  %40 = load i32, i32* %i.addr.1, align 4
  %41 = trunc i64 %37 to i32
  %42 = icmp slt i32 %40, %41
  br i1 %42, label %for.body.1, label %for.end.1

for.body.1:
  %43 = load i64, i64* %sum.addr, align 8
  %44 = load i32, i32* %i.addr.1, align 4
  %45 = sext i32 %44 to i64
  %46 = bitcast i8* %39 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %45
  %48 = load i32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %49 = sext i32 %48 to i64
  %50 = add nsw i64 %43, %49
  store i64 %50, i64* %sum.addr, align 8
  br label %for.inc.1

for.inc.1:
  %51 = load i32, i32* %i.addr.1, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %53 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4
  %56 = icmp ult i64 0, %55
  br i1 %56, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %55)
  unreachable

bounds.ok:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 0
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %62 = call i8* @nish_str_from_i32(i32 %61)
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %64 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4
  %67 = icmp ult i64 1048576, %66
  br i1 %67, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1048576, i64 %66)
  unreachable

bounds.ok.1:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 1048576
  %72 = load i32, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %73 = call i8* @nish_str_from_i32(i32 %72)
  %74 = call i8* @nish_str_concat(i8* %63, i8* %73)
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %76 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4
  %79 = icmp ult i64 2999999, %78
  br i1 %79, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2999999, i64 %78)
  unreachable

bounds.ok.2:
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %81 = load i8*, i8** %80, align 8, !alias.scope !3, !noalias !4
  %82 = bitcast i8* %81 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 2999999
  %84 = load i32, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %85 = call i8* @nish_str_from_i32(i32 %84)
  %86 = call i8* @nish_str_concat(i8* %75, i8* %85)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %88 = load i64, i64* %sum.addr, align 8
  %89 = call i8* @nish_str_from_i64(i64 %88)
  %90 = call i8* @nish_str_concat(i8* %87, i8* %89)
  call void @nish_print(i8* %90)
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
