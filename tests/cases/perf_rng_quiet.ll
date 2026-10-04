%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [47 x i8] } { i64 46, [47 x i8] c"value out of range: expected integer<0, 99999>\00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_exit(i32 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noundef i8 @getByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %i) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp slt i32 %2, 256
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8 0

if.end:
  %4 = sext i32 %i to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = bitcast i8* %6 to i8*
  %8 = getelementptr inbounds i8, i8* %7, i64 %4
  %9 = load i8, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  ret i8 %9
}

define internal noundef i32 @clampByte(i32 noundef %v) #1 {
entry:
  %0 = icmp slt i32 %v, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp sgt i32 %v, 255
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 255

if.end.1:
  ret i32 %v
}

define noundef i32 @nish_main() #2 {
entry:
  %table.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [256 x i8], align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %k.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %byte.addr = alloca i32, align 4
  %wide.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %k.addr.2 = alloca i32, align 4
  %v.addr.1 = alloca i32, align 4
  %top.addr = alloca i32, align 4
  %once.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 256, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 256, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [256 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 256, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %table.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %4 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp slt i32 %7, 256
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %i.addr, align 4
  store i32 %9, i32* %b.addr, align 4
  %10 = load i32, i32* %b.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = load i32, i32* %b.addr, align 4
  %13 = trunc i32 %12 to i8
  %14 = bitcast i8* %6 to i8*
  %15 = getelementptr inbounds i8, i8* %14, i64 %11
  store i8 %13, i8* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %16 = load i32, i32* %total.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = call i8 @getByte(%struct.nish_array* %17, i32 %18)
  %20 = zext i8 %19 to i32
  %21 = add nsw i32 %16, %20
  store i32 %21, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %26 = bitcast [4 x i32]* %arr.data.1 to i8*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %26 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 0
  store i32 5, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = getelementptr inbounds i32, i32* %28, i64 1
  store i32 150, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %31 = getelementptr inbounds i32, i32* %28, i64 2
  store i32 99, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %32 = getelementptr inbounds i32, i32* %28, i64 3
  store i32 -1, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %38 = load i32, i32* %k.addr, align 4
  %39 = trunc i64 %35 to i32
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %for.body.1, label %for.end.1

for.body.1:
  %41 = load i32, i32* %k.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = bitcast i8* %37 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %42
  %45 = load i32, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %45, i32* %v.addr, align 4
  %46 = load i32, i32* %v.addr, align 4
  %47 = icmp sge i32 %46, 0
  br i1 %47, label %land.rhs, label %land.end

land.rhs:
  %48 = load i32, i32* %v.addr, align 4
  %49 = icmp sle i32 %48, 99
  br label %land.end

land.end:
  %50 = phi i1 [ false, %for.body.1 ], [ %49, %land.rhs ]
  br i1 %50, label %if.then, label %if.end

if.then:
  %51 = load i32, i32* %v.addr, align 4
  store i32 %51, i32* %r.addr, align 4
  %52 = load i32, i32* %total.addr, align 4
  %53 = load i32, i32* %r.addr, align 4
  %54 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 %53)
  %55 = extractvalue { i32, i1 } %54, 0
  %56 = extractvalue { i32, i1 } %54, 1
  br i1 %56, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %55, i32* %total.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %57 = load i32, i32* %k.addr, align 4
  %58 = add nsw i32 %57, 1
  store i32 %58, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %k.addr.1, align 4
  %59 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %64 = load i32, i32* %k.addr.1, align 4
  %65 = trunc i64 %61 to i32
  %66 = icmp slt i32 %64, %65
  br i1 %66, label %for.body.2, label %for.end.2

for.body.2:
  %67 = load i32, i32* %k.addr.1, align 4
  %68 = sext i32 %67 to i64
  %69 = bitcast i8* %63 to i8*
  %70 = getelementptr inbounds i8, i8* %69, i64 %68
  %71 = load i8, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %72 = zext i8 %71 to i32
  store i32 %72, i32* %byte.addr, align 4
  %73 = load i32, i32* %byte.addr, align 4
  store i32 %73, i32* %wide.addr, align 4
  %74 = load i32, i32* %wide.addr, align 4
  %75 = icmp slt i32 %74, 128
  br i1 %75, label %if.then.1, label %if.end.1

if.then.1:
  %76 = load i32, i32* %wide.addr, align 4
  store i32 %76, i32* %low.addr, align 4
  %77 = load i32, i32* %total.addr, align 4
  %78 = load i32, i32* %low.addr, align 4
  %79 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %77, i32 %78)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %80, i32* %total.addr, align 4
  br label %if.end.1

if.end.1:
  br label %for.inc.2

for.inc.2:
  %82 = load i32, i32* %k.addr.1, align 4
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %82, i32 16)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %84, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %k.addr.2, align 4
  %86 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.3

for.cond.3:
  %91 = load i32, i32* %k.addr.2, align 4
  %92 = trunc i64 %88 to i32
  %93 = icmp slt i32 %91, %92
  br i1 %93, label %for.body.3, label %for.end.3

for.body.3:
  %94 = load i32, i32* %k.addr.2, align 4
  %95 = sext i32 %94 to i64
  %96 = bitcast i8* %90 to i32*
  %97 = getelementptr inbounds i32, i32* %96, i64 %95
  %98 = load i32, i32* %97, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %98, i32* %v.addr.1, align 4
  %99 = load i32, i32* %v.addr.1, align 4
  %100 = icmp sle i32 %99, 9
  br i1 %100, label %if.then.2, label %if.end.2

if.then.2:
  %101 = load i32, i32* %v.addr.1, align 4
  store i32 %101, i32* %top.addr, align 4
  %102 = load i32, i32* %total.addr, align 4
  %103 = load i32, i32* %top.addr, align 4
  %104 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %102, i32 %103)
  %105 = extractvalue { i32, i1 } %104, 0
  %106 = extractvalue { i32, i1 } %104, 1
  br i1 %106, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %105, i32* %total.addr, align 4
  br label %if.end.2

if.end.2:
  br label %for.inc.3

for.inc.3:
  %107 = load i32, i32* %k.addr.2, align 4
  %108 = add nsw i32 %107, 1
  store i32 %108, i32* %k.addr.2, align 4
  br label %for.cond.3

for.end.3:
  %109 = load i32, i32* %total.addr, align 4
  %110 = load i32, i32* %total.addr, align 4
  %111 = call i32 @clampByte(i32 %110)
  %112 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %109, i32 %111)
  %113 = extractvalue { i32, i1 } %112, 0
  %114 = extractvalue { i32, i1 } %112, 1
  br i1 %114, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %115 = call i32 @clampByte(i32 -7)
  %116 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %113, i32 %115)
  %117 = extractvalue { i32, i1 } %116, 0
  %118 = extractvalue { i32, i1 } %116, 1
  br i1 %118, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %117, i32* %total.addr, align 4
  %119 = load i32, i32* %total.addr, align 4
  %120 = icmp ult i32 %119, 100000
  br i1 %120, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [47 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %119, i32* %once.addr, align 4
  %121 = load i32, i32* %once.addr, align 4
  %122 = call i8* @nish_str_from_i32(i32 %121)
  call void @nish_print(i8* %122)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
