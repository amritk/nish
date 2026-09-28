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
  %24 = sub nsw i32 0, 1
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %27 = bitcast [4 x i32]* %arr.data.1 to i8*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %27, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %27 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 0
  store i32 5, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %31 = getelementptr inbounds i32, i32* %29, i64 1
  store i32 150, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %32 = getelementptr inbounds i32, i32* %29, i64 2
  store i32 99, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %33 = getelementptr inbounds i32, i32* %29, i64 3
  store i32 %24, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %34 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %39 = load i32, i32* %k.addr, align 4
  %40 = trunc i64 %36 to i32
  %41 = icmp slt i32 %39, %40
  br i1 %41, label %for.body.1, label %for.end.1

for.body.1:
  %42 = load i32, i32* %k.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = bitcast i8* %38 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %43
  %46 = load i32, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %46, i32* %v.addr, align 4
  %47 = load i32, i32* %v.addr, align 4
  %48 = icmp sge i32 %47, 0
  br i1 %48, label %land.rhs, label %land.end

land.rhs:
  %49 = load i32, i32* %v.addr, align 4
  %50 = icmp sle i32 %49, 99
  br label %land.end

land.end:
  %51 = phi i1 [ false, %for.body.1 ], [ %50, %land.rhs ]
  br i1 %51, label %if.then, label %if.end

if.then:
  %52 = load i32, i32* %v.addr, align 4
  store i32 %52, i32* %r.addr, align 4
  %53 = load i32, i32* %total.addr, align 4
  %54 = load i32, i32* %r.addr, align 4
  %55 = add nsw i32 %53, %54
  store i32 %55, i32* %total.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %56 = load i32, i32* %k.addr, align 4
  %57 = add nsw i32 %56, 1
  store i32 %57, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %k.addr.1, align 4
  %58 = load %struct.nish_array*, %struct.nish_array** %table.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %63 = load i32, i32* %k.addr.1, align 4
  %64 = trunc i64 %60 to i32
  %65 = icmp slt i32 %63, %64
  br i1 %65, label %for.body.2, label %for.end.2

for.body.2:
  %66 = load i32, i32* %k.addr.1, align 4
  %67 = sext i32 %66 to i64
  %68 = bitcast i8* %62 to i8*
  %69 = getelementptr inbounds i8, i8* %68, i64 %67
  %70 = load i8, i8* %69, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %71 = zext i8 %70 to i32
  store i32 %71, i32* %byte.addr, align 4
  %72 = load i32, i32* %byte.addr, align 4
  store i32 %72, i32* %wide.addr, align 4
  %73 = load i32, i32* %wide.addr, align 4
  %74 = icmp slt i32 %73, 128
  br i1 %74, label %if.then.1, label %if.end.1

if.then.1:
  %75 = load i32, i32* %wide.addr, align 4
  store i32 %75, i32* %low.addr, align 4
  %76 = load i32, i32* %total.addr, align 4
  %77 = load i32, i32* %low.addr, align 4
  %78 = add nsw i32 %76, %77
  store i32 %78, i32* %total.addr, align 4
  br label %if.end.1

if.end.1:
  br label %for.inc.2

for.inc.2:
  %79 = load i32, i32* %k.addr.1, align 4
  %80 = add nsw i32 %79, 16
  store i32 %80, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %k.addr.2, align 4
  %81 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %83 = load i64, i64* %82, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.3

for.cond.3:
  %86 = load i32, i32* %k.addr.2, align 4
  %87 = trunc i64 %83 to i32
  %88 = icmp slt i32 %86, %87
  br i1 %88, label %for.body.3, label %for.end.3

for.body.3:
  %89 = load i32, i32* %k.addr.2, align 4
  %90 = sext i32 %89 to i64
  %91 = bitcast i8* %85 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 %90
  %93 = load i32, i32* %92, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %93, i32* %v.addr.1, align 4
  %94 = load i32, i32* %v.addr.1, align 4
  %95 = icmp sle i32 %94, 9
  br i1 %95, label %if.then.2, label %if.end.2

if.then.2:
  %96 = load i32, i32* %v.addr.1, align 4
  store i32 %96, i32* %top.addr, align 4
  %97 = load i32, i32* %total.addr, align 4
  %98 = load i32, i32* %top.addr, align 4
  %99 = add nsw i32 %97, %98
  store i32 %99, i32* %total.addr, align 4
  br label %if.end.2

if.end.2:
  br label %for.inc.3

for.inc.3:
  %100 = load i32, i32* %k.addr.2, align 4
  %101 = add nsw i32 %100, 1
  store i32 %101, i32* %k.addr.2, align 4
  br label %for.cond.3

for.end.3:
  %102 = load i32, i32* %total.addr, align 4
  %103 = load i32, i32* %total.addr, align 4
  %104 = call i32 @clampByte(i32 %103)
  %105 = add nsw i32 %102, %104
  %106 = sub nsw i32 0, 7
  %107 = call i32 @clampByte(i32 %106)
  %108 = add nsw i32 %105, %107
  store i32 %108, i32* %total.addr, align 4
  %109 = load i32, i32* %total.addr, align 4
  %110 = icmp ult i32 %109, 100000
  br i1 %110, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [47 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  store i32 %109, i32* %once.addr, align 4
  %111 = load i32, i32* %once.addr, align 4
  %112 = call i8* @nish_str_from_i32(i32 %111)
  call void @nish_print(i8* %112)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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
