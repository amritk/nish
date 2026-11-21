%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_const_0_CLASS.data = private unnamed_addr constant [256 x i8] c"\00\00\00\00\00\00\00\00\00\03\03\03\03\03\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\03\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\01\01\00\00\00\00\00\00\00\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\00\00\00\00\00\00\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\02\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00", align 16
@nish_const_0_CLASS = internal constant %struct.nish_array { i64 256, i64 256, i8* bitcast ([256 x i8]* @nish_const_0_CLASS.data to i8*) }, align 8
@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3

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

define internal noundef i8 @classOf(i8 noundef %c) #0 {
entry:
  %0 = zext i8 %c to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* @nish_const_0_CLASS, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !12
  ret i8 %5
}

define void @nish_main() #1 {
entry:
  %row.addr = alloca i32, align 4
  %cells.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %col.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  store i32 0, i32* %row.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %row.addr, align 4
  %1 = icmp slt i32 %0, 16
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %cells.addr, align 8
  store i32 0, i32* %col.addr, align 4
  br label %for.cond.1

for.cond.1:
  %9 = load i32, i32* %col.addr, align 4
  %10 = icmp slt i32 %9, 16
  br i1 %10, label %for.body.1, label %for.end.1

for.body.1:
  %11 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %12 = load i32, i32* %row.addr, align 4
  %13 = mul nsw i32 %12, 16
  %14 = load i32, i32* %col.addr, align 4
  %15 = add nsw i32 %13, %14
  %16 = trunc i32 %15 to i8
  %17 = call i8 @classOf(i8 %16)
  %18 = zext i8 %17 to i64
  %19 = call i8* @nish_str_from_u64(i64 %18)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 %21
  store i8* %19, i8** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %30 = trunc i64 %29 to i32
  br label %for.inc.1

for.inc.1:
  %31 = load i32, i32* %col.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %col.addr, align 4
  br label %for.cond.1

for.end.1:
  %33 = load i32, i32* %row.addr, align 4
  %34 = mul nsw i32 %33, 16
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  %37 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !13
  %40 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*) to i64*
  %41 = load i64, i64* %40, align 8
  %42 = sub i64 %39, 1
  %43 = mul i64 %41, %42
  %44 = icmp eq i64 %39, 0
  %45 = select i1 %44, i64 0, i64 %43
  store i64 %45, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %46 = load i64, i64* %join.at, align 8
  %47 = icmp ult i64 %46, %39
  br i1 %47, label %join.sum.body, label %join.copy

join.sum.body:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = bitcast i8* %49 to i8**
  %51 = getelementptr inbounds i8*, i8** %50, i64 %46
  %52 = load i8*, i8** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %53 = load i64, i64* %join.total, align 8
  %54 = bitcast i8* %52 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = add i64 %53, %55
  store i64 %56, i64* %join.total, align 8
  %57 = add i64 %46, 1
  store i64 %57, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %58 = load i64, i64* %join.total, align 8
  %59 = icmp ugt i64 %58, 2147483647
  %60 = add i64 %58, 9
  %61 = select i1 %59, i64 4611686018427387904, i64 %60
  %62 = call i8* @nish_alloc_struct(i64 %61)
  %63 = bitcast i8* %62 to i64*
  store i64 %58, i64* %63, align 8
  %64 = getelementptr inbounds i8, i8* %62, i64 8
  store i8* %64, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %65 = load i64, i64* %join.at, align 8
  %66 = icmp ult i64 %65, %39
  br i1 %66, label %join.part, label %join.end

join.part:
  %67 = load i8*, i8** %join.p, align 8
  %68 = icmp eq i64 %65, 0
  %69 = select i1 %68, i64 0, i64 %41
  %70 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %67, i8* %70, i64 %69, i1 false)
  %71 = getelementptr inbounds i8, i8* %67, i64 %69
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = bitcast i8* %73 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 %65
  %76 = load i8*, i8** %75, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %77 = bitcast i8* %76 to i64*
  %78 = load i64, i64* %77, align 8
  %79 = getelementptr inbounds i8, i8* %76, i64 8
  %80 = icmp eq i64 %78, 1
  br i1 %80, label %join.byte, label %join.bulk

join.byte:
  %81 = load i8, i8* %79, align 1
  store i8 %81, i8* %71, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %71, i8* %79, i64 %78, i1 false)
  br label %join.next

join.next:
  %82 = getelementptr inbounds i8, i8* %71, i64 %78
  store i8* %82, i8** %join.p, align 8
  %83 = add i64 %65, 1
  store i64 %83, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %84 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %84, align 1
  %85 = call i8* @nish_str_concat(i8* %36, i8* %62)
  call void @nish_print(i8* %85)
  %86 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %87 = load i8*, i8** %86, align 8
  %88 = icmp eq i8* %87, %3
  br i1 %88, label %pass.rewind, label %pass.free

pass.rewind:
  %89 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %89, align 8
  br label %pass.done

pass.free:
  %90 = ptrtoint i8* %3 to i64
  %91 = add i64 %90, %5
  call void @nish_arena_release(i64 %91)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %92 = load i32, i32* %row.addr, align 4
  %93 = add nsw i32 %92, 1
  store i32 %93, i32* %row.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i8", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!9, !7, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
