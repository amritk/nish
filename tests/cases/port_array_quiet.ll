%struct.Point = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %none.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [0 x double], align 8
  %hex.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [0 x double], align 8
  %separated.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [0 x i1], align 8
  %named.addr = alloca %struct.nish_array*, align 8
  %negative.addr = alloca %struct.nish_array*, align 8
  %grown.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %floats.addr = alloca %struct.nish_array*, align 8
  %points.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %n.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 0, 8
  %3 = bitcast [0 x double]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %none.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = mul i64 0, 8
  %8 = bitcast [0 x double]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %hex.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast [0 x i1]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 0, i1 false), !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %separated.addr, align 8
  %14 = sext i32 0 to i64
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 %14, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 %14, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = mul i64 %14, 4
  %20 = call i8* @nish_alloc_struct(i64 %19)
  call void @llvm.memset.p0i8.i64(i8* align 8 %20, i8 0, i64 %19, i1 false), !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %16, %struct.nish_array** %named.addr, align 8
  %22 = sext i32 0 to i64
  %23 = icmp ule i64 %22, 2147483647
  br i1 %23, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 %22, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 %22, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = mul i64 %22, 4
  %29 = call i8* @nish_alloc_struct(i64 %28)
  call void @llvm.memset.p0i8.i64(i8* align 8 %29, i8 0, i64 %28, i1 false), !alias.scope !4, !noalias !3
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* %29, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %25, %struct.nish_array** %negative.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %grown.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %34 = load i32, i32* %i.addr, align 4
  %35 = load i32, i32* %n.addr, align 4
  %36 = icmp slt i32 %34, %35
  br i1 %36, label %for.body, label %for.end

for.body:
  %37 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %38 = load i32, i32* %i.addr, align 4
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 1
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = icmp eq i64 %40, %42
  br i1 %43, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %37, i64 4)
  br label %push.store

push.store:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 %40
  store i32 %38, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = add i64 %40, 1
  store i64 %48, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = trunc i64 %48 to i32
  br label %for.inc

for.inc:
  %50 = load i32, i32* %i.addr, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %52 = load i32, i32* %n.addr, align 4
  %53 = sext i32 %52 to i64
  %54 = icmp ule i64 %53, 2147483647
  br i1 %54, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok.1:
  %55 = call i8* @nish_alloc_struct(i64 24)
  %56 = bitcast i8* %55 to %struct.nish_array*
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  store i64 %53, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 1
  store i64 %53, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = mul i64 %53, 8
  %60 = call i8* @nish_alloc_struct(i64 %59)
  call void @llvm.memset.p0i8.i64(i8* align 8 %60, i8 0, i64 %59, i1 false), !alias.scope !4, !noalias !3
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  store i8* %60, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %56, %struct.nish_array** %floats.addr, align 8
  %62 = load i32, i32* %n.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = icmp ule i64 %63, 2147483647
  br i1 %64, label %len.ok.2, label %len.fail.2

len.fail.2:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok.2:
  %65 = call i8* @nish_alloc_struct(i64 24)
  %66 = bitcast i8* %65 to %struct.nish_array*
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  store i64 %63, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 1
  store i64 %63, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = mul i64 %63, 8
  %70 = call i8* @nish_alloc_struct(i64 %69)
  call void @llvm.memset.p0i8.i64(i8* align 8 %70, i8 0, i64 %69, i1 false), !alias.scope !4, !noalias !3
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  store i8* %70, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %66, %struct.nish_array** %points.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  %76 = load %struct.nish_array*, %struct.nish_array** %hex.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = trunc i64 %78 to i32
  %80 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %75, i32 %79)
  %81 = extractvalue { i32, i1 } %80, 0
  %82 = extractvalue { i32, i1 } %80, 1
  br i1 %82, label %ovf.fail, label %ovf.ok

ovf.ok:
  %83 = load %struct.nish_array*, %struct.nish_array** %separated.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = trunc i64 %85 to i32
  %87 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %81, i32 %86)
  %88 = extractvalue { i32, i1 } %87, 0
  %89 = extractvalue { i32, i1 } %87, 1
  br i1 %89, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %90 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %93 = trunc i64 %92 to i32
  %94 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %88, i32 %93)
  %95 = extractvalue { i32, i1 } %94, 0
  %96 = extractvalue { i32, i1 } %94, 1
  br i1 %96, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %97 = load %struct.nish_array*, %struct.nish_array** %negative.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = trunc i64 %99 to i32
  %101 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %95, i32 %100)
  %102 = extractvalue { i32, i1 } %101, 0
  %103 = extractvalue { i32, i1 } %101, 1
  br i1 %103, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %104 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = icmp ult i64 2, %106
  br i1 %107, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %106)
  unreachable

bounds.ok:
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %110 = bitcast i8* %109 to i32*
  %111 = getelementptr inbounds i32, i32* %110, i64 2
  %112 = load i32, i32* %111, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %113 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %102, i32 %112)
  %114 = extractvalue { i32, i1 } %113, 0
  %115 = extractvalue { i32, i1 } %113, 1
  br i1 %115, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %116 = load %struct.nish_array*, %struct.nish_array** %floats.addr, align 8
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 0
  %118 = load i64, i64* %117, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %119 = trunc i64 %118 to i32
  %120 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %114, i32 %119)
  %121 = extractvalue { i32, i1 } %120, 0
  %122 = extractvalue { i32, i1 } %120, 1
  br i1 %122, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %123 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = trunc i64 %125 to i32
  %127 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %121, i32 %126)
  %128 = extractvalue { i32, i1 } %127, 0
  %129 = extractvalue { i32, i1 } %127, 1
  br i1 %129, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %130 = call i8* @nish_str_from_i32(i32 %128)
  call void @nish_print(i8* %130)
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

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}
