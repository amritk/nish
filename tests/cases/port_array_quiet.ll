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
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

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
  %15 = icmp ule i64 %14, 2147483647
  br i1 %15, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %14, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %14, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = mul i64 %14, 4
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !4, !noalias !3
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %17, %struct.nish_array** %named.addr, align 8
  %23 = sext i32 0 to i64
  %24 = icmp ule i64 %23, 2147483647
  br i1 %24, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.1:
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 %23, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 %23, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = mul i64 %23, 4
  %30 = call i8* @nish_alloc_struct(i64 %29)
  call void @llvm.memset.p0i8.i64(i8* align 8 %30, i8 0, i64 %29, i1 false), !alias.scope !4, !noalias !3
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %26, %struct.nish_array** %negative.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 0, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 0, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* null, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %grown.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %35 = load i32, i32* %i.addr, align 4
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp slt i32 %35, %36
  br i1 %37, label %for.body, label %for.end

for.body:
  %38 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %39 = load i32, i32* %i.addr, align 4
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 1
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %44 = icmp eq i64 %41, %43
  br i1 %44, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %38, i64 4)
  br label %push.store

push.store:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 %41
  store i32 %39, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = add i64 %41, 1
  store i64 %49, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = trunc i64 %49 to i32
  br label %for.inc

for.inc:
  %51 = load i32, i32* %i.addr, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %53 = load i32, i32* %n.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = icmp ule i64 %54, 2147483647
  br i1 %55, label %len.ok.2, label %len.fail.2

len.fail.2:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.2:
  %56 = call i8* @nish_alloc_struct(i64 24)
  %57 = bitcast i8* %56 to %struct.nish_array*
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  store i64 %54, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 1
  store i64 %54, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = mul i64 %54, 8
  %61 = call i8* @nish_alloc_struct(i64 %60)
  call void @llvm.memset.p0i8.i64(i8* align 8 %61, i8 0, i64 %60, i1 false), !alias.scope !4, !noalias !3
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  store i8* %61, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %57, %struct.nish_array** %floats.addr, align 8
  %63 = load i32, i32* %n.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = icmp ule i64 %64, 2147483647
  br i1 %65, label %len.ok.3, label %len.fail.3

len.fail.3:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok.3:
  %66 = call i8* @nish_alloc_struct(i64 24)
  %67 = bitcast i8* %66 to %struct.nish_array*
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  store i64 %64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 1
  store i64 %64, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = mul i64 %64, 8
  %71 = call i8* @nish_alloc_struct(i64 %70)
  call void @llvm.memset.p0i8.i64(i8* align 8 %71, i8 0, i64 %70, i1 false), !alias.scope !4, !noalias !3
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  store i8* %71, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %67, %struct.nish_array** %points.addr, align 8
  %73 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = trunc i64 %75 to i32
  %77 = load %struct.nish_array*, %struct.nish_array** %hex.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = trunc i64 %79 to i32
  %81 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %76, i32 %80)
  %82 = extractvalue { i32, i1 } %81, 0
  %83 = extractvalue { i32, i1 } %81, 1
  br i1 %83, label %ovf.fail, label %ovf.ok

ovf.ok:
  %84 = load %struct.nish_array*, %struct.nish_array** %separated.addr, align 8
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %87 = trunc i64 %86 to i32
  %88 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %82, i32 %87)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %91 = load %struct.nish_array*, %struct.nish_array** %named.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = trunc i64 %93 to i32
  %95 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %89, i32 %94)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %98 = load %struct.nish_array*, %struct.nish_array** %negative.addr, align 8
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = trunc i64 %100 to i32
  %102 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %96, i32 %101)
  %103 = extractvalue { i32, i1 } %102, 0
  %104 = extractvalue { i32, i1 } %102, 1
  br i1 %104, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %105 = load %struct.nish_array*, %struct.nish_array** %grown.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = icmp ult i64 2, %107
  br i1 %108, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %107)
  unreachable

bounds.ok:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %105, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %111 = bitcast i8* %110 to i32*
  %112 = getelementptr inbounds i32, i32* %111, i64 2
  %113 = load i32, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %114 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %103, i32 %113)
  %115 = extractvalue { i32, i1 } %114, 0
  %116 = extractvalue { i32, i1 } %114, 1
  br i1 %116, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %117 = load %struct.nish_array*, %struct.nish_array** %floats.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = trunc i64 %119 to i32
  %121 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %115, i32 %120)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %124 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  %126 = load i64, i64* %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %127 = trunc i64 %126 to i32
  %128 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %122, i32 %127)
  %129 = extractvalue { i32, i1 } %128, 0
  %130 = extractvalue { i32, i1 } %128, 1
  br i1 %130, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %131 = call i8* @nish_str_from_i32(i32 %129)
  call void @nish_print(i8* %131)
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
