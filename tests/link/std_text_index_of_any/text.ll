%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"toFixed: digits must be 0 to 100\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\C3\A9\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #5
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #5
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #5
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #6
declare i64 @nish_str_index_of_any(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #7
declare i64 @nish_str_index_of_from(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #6
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #5
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #8
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #8
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0
declare i8 @llvm.fptoui.sat.i8.f64(double) #0
declare i32 @llvm.ctlz.i32(i32, i1) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #9 {
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

define internal noundef zeroext i1 @nish.isTextBlankByte(i32 noundef %code) #0 {
entry:
  %0 = icmp eq i32 %code, 32
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp eq i32 %code, 9
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = icmp eq i32 %code, 10
  br label %lor.end.1

lor.end.1:
  %4 = phi i1 [ true, %lor.end.2 ], [ %3, %lor.rhs.1 ]
  br i1 %4, label %lor.end, label %lor.rhs

lor.rhs:
  %5 = icmp eq i32 %code, 13
  br label %lor.end

lor.end:
  %6 = phi i1 [ true, %lor.end.1 ], [ %5, %lor.rhs ]
  ret i1 %6
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.splitLines(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %length.addr = alloca i32, align 4
  %lines.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %base.addr = alloca i32, align 4
  %flags.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4096 x i8], align 8
  %one.addr = alloca <16 x i8>, align 8
  %n.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %bits.addr = alloca i32, align 4
  %zeros.addr = alloca i32, align 4
  %lane.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %at.addr.1 = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %4, %struct.nish_array** %lines.addr, align 8
  store i32 0, i32* %start.addr, align 4
  store i32 0, i32* %base.addr, align 4
  %8 = load i32, i32* %length.addr, align 4
  %9 = icmp sge i32 %8, 16
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4096, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4096, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast [4096 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %12, i8 0, i64 4096, i1 false), !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %flags.addr, align 8
  %14 = insertelement <16 x i8> undef, i8 1, i32 0
  %15 = shufflevector <16 x i8> %14, <16 x i8> undef, <16 x i32> zeroinitializer
  store <16 x i8> %15, <16 x i8>* %one.addr, align 8
  br label %while.cond

while.cond:
  %16 = load i32, i32* %base.addr, align 4
  %17 = icmp sge i32 %16, 0
  br i1 %17, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %18 = load i32, i32* %base.addr, align 4
  %19 = load i32, i32* %length.addr, align 4
  %20 = icmp slt i32 %18, %19
  br label %land.end.1

land.end.1:
  %21 = phi i1 [ false, %while.cond ], [ %20, %land.rhs.1 ]
  br i1 %21, label %land.rhs, label %land.end

land.rhs:
  %22 = load i32, i32* %base.addr, align 4
  %23 = icmp sle i32 %22, 2147479551
  br label %land.end

land.end:
  %24 = phi i1 [ false, %land.end.1 ], [ %23, %land.rhs ]
  br i1 %24, label %while.body, label %while.end

while.body:
  store i32 0, i32* %n.addr, align 4
  %25 = load i32, i32* %base.addr, align 4
  store i32 %25, i32* %end.addr, align 4
  %26 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %31 = load i32, i32* %end.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %33 = load i32, i32* %end.addr, align 4
  %34 = load i32, i32* %length.addr, align 4
  %35 = icmp slt i32 %33, %34
  br label %land.end.4

land.end.4:
  %36 = phi i1 [ false, %while.cond.1 ], [ %35, %land.rhs.4 ]
  br i1 %36, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %37 = load i32, i32* %n.addr, align 4
  %38 = icmp sge i32 %37, 0
  br label %land.end.3

land.end.3:
  %39 = phi i1 [ false, %land.end.4 ], [ %38, %land.rhs.3 ]
  br i1 %39, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %40 = load i32, i32* %n.addr, align 4
  %41 = trunc i64 %28 to i32
  %42 = icmp slt i32 %40, %41
  br label %land.end.2

land.end.2:
  %43 = phi i1 [ false, %land.end.3 ], [ %42, %land.rhs.2 ]
  br i1 %43, label %while.body.1, label %while.end.1

while.body.1:
  %44 = load i32, i32* %n.addr, align 4
  %45 = sext i32 %44 to i64
  %46 = load i32, i32* %end.addr, align 4
  %47 = sext i32 %46 to i64
  %48 = getelementptr inbounds i8, i8* %text, i64 8
  %49 = getelementptr inbounds i8, i8* %48, i64 %47
  %50 = load i8, i8* %49, align 1
  %51 = zext i8 %50 to i32
  %52 = icmp eq i32 %51, 10
  br i1 %52, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %53 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %54 = trunc i32 %53 to i8
  %55 = bitcast i8* %30 to i8*
  %56 = getelementptr inbounds i8, i8* %55, i64 %45
  store i8 %54, i8* %56, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = load i32, i32* %end.addr, align 4
  %58 = add nsw i32 %57, 1
  store i32 %58, i32* %end.addr, align 4
  %59 = load i32, i32* %n.addr, align 4
  %60 = add nsw i32 %59, 1
  store i32 %60, i32* %n.addr, align 4
  br label %while.cond.1

while.end.1:
  store i32 0, i32* %i.addr, align 4
  br label %while.cond.2

while.cond.2:
  %61 = load i32, i32* %i.addr, align 4
  %62 = icmp sge i32 %61, 0
  br i1 %62, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %63 = load i32, i32* %i.addr, align 4
  %64 = icmp sle i32 %63, 4080
  br label %land.end.6

land.end.6:
  %65 = phi i1 [ false, %while.cond.2 ], [ %64, %land.rhs.6 ]
  br i1 %65, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %66 = load i32, i32* %i.addr, align 4
  %67 = load i32, i32* %n.addr, align 4
  %68 = sub nsw i32 %67, 16
  %69 = icmp sle i32 %66, %68
  br label %land.end.5

land.end.5:
  %70 = phi i1 [ false, %land.end.6 ], [ %69, %land.rhs.5 ]
  br i1 %70, label %while.body.2, label %while.end.2

while.body.2:
  store i32 0, i32* %bits.addr, align 4
  %71 = load i32, i32* %i.addr, align 4
  %72 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  %76 = sub nsw i32 %75, 16
  %77 = icmp sle i32 %71, %76
  br i1 %77, label %if.then.1, label %if.end.1

if.then.1:
  %78 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %79 = load i32, i32* %i.addr, align 4
  %80 = sext i32 %79 to i64
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %78, i64 0, i32 2
  %82 = load i8*, i8** %81, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %83 = bitcast i8* %82 to i8*
  %84 = getelementptr inbounds i8, i8* %83, i64 %80
  %85 = bitcast i8* %84 to <16 x i8>*
  %86 = load <16 x i8>, <16 x i8>* %85, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %87 = load <16 x i8>, <16 x i8>* %one.addr, align 8
  %88 = icmp eq <16 x i8> %86, %87
  %89 = bitcast <16 x i1> %88 to i16
  %90 = zext i16 %89 to i32
  %91 = and i32 %90, 65535
  store i32 %91, i32* %bits.addr, align 4
  br label %if.end.1

if.end.1:
  br label %while.cond.3

while.cond.3:
  %92 = load i32, i32* %bits.addr, align 4
  %93 = icmp ne i32 %92, 0
  br i1 %93, label %while.body.3, label %while.end.3

while.body.3:
  %94 = load i32, i32* %bits.addr, align 4
  %95 = load i32, i32* %bits.addr, align 4
  %96 = sub nsw i32 0, %95
  %97 = and i32 %94, %96
  %98 = call i32 @llvm.ctlz.i32(i32 %97, i1 false)
  %99 = and i32 %98, 31
  store i32 %99, i32* %zeros.addr, align 4
  %100 = load i32, i32* %zeros.addr, align 4
  %101 = sub nsw i32 31, %100
  %102 = and i32 %101, 15
  store i32 %102, i32* %lane.addr, align 4
  %103 = load i32, i32* %base.addr, align 4
  %104 = load i32, i32* %i.addr, align 4
  %105 = add nsw i32 %103, %104
  %106 = load i32, i32* %lane.addr, align 4
  %107 = add nsw i32 %105, %106
  store i32 %107, i32* %at.addr, align 4
  %108 = load i32, i32* %start.addr, align 4
  %109 = icmp sge i32 %108, 0
  br i1 %109, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %110 = load i32, i32* %start.addr, align 4
  %111 = load i32, i32* %length.addr, align 4
  %112 = icmp slt i32 %110, %111
  br label %land.end.9

land.end.9:
  %113 = phi i1 [ false, %while.body.3 ], [ %112, %land.rhs.9 ]
  br i1 %113, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %114 = load i32, i32* %at.addr, align 4
  %115 = icmp sge i32 %114, 0
  br label %land.end.8

land.end.8:
  %116 = phi i1 [ false, %land.end.9 ], [ %115, %land.rhs.8 ]
  br i1 %116, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %117 = load i32, i32* %at.addr, align 4
  %118 = load i32, i32* %length.addr, align 4
  %119 = icmp slt i32 %117, %118
  br label %land.end.7

land.end.7:
  %120 = phi i1 [ false, %land.end.8 ], [ %119, %land.rhs.7 ]
  br i1 %120, label %if.then.2, label %if.end.2

if.then.2:
  %121 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %122 = bitcast i8* %text to i64*
  %123 = load i64, i64* %122, align 8
  %124 = load i32, i32* %start.addr, align 4
  %125 = sext i32 %124 to i64
  %126 = load i32, i32* %at.addr, align 4
  %127 = sext i32 %126 to i64
  %128 = call i64 @llvm.smin.i64(i64 %125, i64 %127)
  %129 = call i64 @llvm.smax.i64(i64 %125, i64 %127)
  %130 = sub i64 %129, %128
  %131 = getelementptr inbounds i8, i8* %text, i64 8
  %132 = getelementptr inbounds i8, i8* %131, i64 %128
  %133 = call i8* @nish_str_new(i8* %132, i64 %130)
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %135 = load i64, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 1
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = icmp eq i64 %135, %137
  br i1 %138, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %121, i64 8)
  br label %push.store

push.store:
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %141 = bitcast i8* %140 to i8**
  %142 = getelementptr inbounds i8*, i8** %141, i64 %135
  store i8* %133, i8** %142, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %143 = add i64 %135, 1
  store i64 %143, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = trunc i64 %143 to i32
  %145 = load i32, i32* %at.addr, align 4
  %146 = add nsw i32 %145, 1
  store i32 %146, i32* %start.addr, align 4
  br label %if.end.2

if.end.2:
  %147 = load i32, i32* %bits.addr, align 4
  %148 = load i32, i32* %bits.addr, align 4
  %149 = sub nsw i32 %148, 1
  %150 = and i32 %147, %149
  %151 = and i32 %150, 65535
  store i32 %151, i32* %bits.addr, align 4
  br label %while.cond.3

while.end.3:
  %152 = load i32, i32* %i.addr, align 4
  %153 = add nsw i32 %152, 16
  store i32 %153, i32* %i.addr, align 4
  br label %while.cond.2

while.end.2:
  br label %while.cond.4

while.cond.4:
  %154 = load i32, i32* %i.addr, align 4
  %155 = icmp sge i32 %154, 0
  br i1 %155, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %156 = load i32, i32* %i.addr, align 4
  %157 = icmp slt i32 %156, 4096
  br label %land.end.12

land.end.12:
  %158 = phi i1 [ false, %while.cond.4 ], [ %157, %land.rhs.12 ]
  br i1 %158, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %159 = load i32, i32* %i.addr, align 4
  %160 = load i32, i32* %n.addr, align 4
  %161 = icmp slt i32 %159, %160
  br label %land.end.11

land.end.11:
  %162 = phi i1 [ false, %land.end.12 ], [ %161, %land.rhs.11 ]
  br i1 %162, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %163 = load i32, i32* %i.addr, align 4
  %164 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 0
  %166 = load i64, i64* %165, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %167 = trunc i64 %166 to i32
  %168 = icmp slt i32 %163, %167
  br label %land.end.10

land.end.10:
  %169 = phi i1 [ false, %land.end.11 ], [ %168, %land.rhs.10 ]
  br i1 %169, label %while.body.4, label %while.end.4

while.body.4:
  %170 = load %struct.nish_array*, %struct.nish_array** %flags.addr, align 8
  %171 = load i32, i32* %i.addr, align 4
  %172 = sext i32 %171 to i64
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %170, i64 0, i32 2
  %174 = load i8*, i8** %173, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %175 = bitcast i8* %174 to i8*
  %176 = getelementptr inbounds i8, i8* %175, i64 %172
  %177 = load i8, i8* %176, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %178 = trunc i32 1 to i8
  %179 = icmp eq i8 %177, %178
  br i1 %179, label %if.then.3, label %if.end.3

if.then.3:
  %180 = load i32, i32* %base.addr, align 4
  %181 = load i32, i32* %i.addr, align 4
  %182 = add nsw i32 %180, %181
  store i32 %182, i32* %at.addr.1, align 4
  %183 = load i32, i32* %start.addr, align 4
  %184 = icmp sge i32 %183, 0
  br i1 %184, label %land.rhs.15, label %land.end.15

land.rhs.15:
  %185 = load i32, i32* %start.addr, align 4
  %186 = load i32, i32* %length.addr, align 4
  %187 = icmp slt i32 %185, %186
  br label %land.end.15

land.end.15:
  %188 = phi i1 [ false, %if.then.3 ], [ %187, %land.rhs.15 ]
  br i1 %188, label %land.rhs.14, label %land.end.14

land.rhs.14:
  %189 = load i32, i32* %at.addr.1, align 4
  %190 = icmp sge i32 %189, 0
  br label %land.end.14

land.end.14:
  %191 = phi i1 [ false, %land.end.15 ], [ %190, %land.rhs.14 ]
  br i1 %191, label %land.rhs.13, label %land.end.13

land.rhs.13:
  %192 = load i32, i32* %at.addr.1, align 4
  %193 = load i32, i32* %length.addr, align 4
  %194 = icmp slt i32 %192, %193
  br label %land.end.13

land.end.13:
  %195 = phi i1 [ false, %land.end.14 ], [ %194, %land.rhs.13 ]
  br i1 %195, label %if.then.4, label %if.end.4

if.then.4:
  %196 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %197 = bitcast i8* %text to i64*
  %198 = load i64, i64* %197, align 8
  %199 = load i32, i32* %start.addr, align 4
  %200 = sext i32 %199 to i64
  %201 = load i32, i32* %at.addr.1, align 4
  %202 = sext i32 %201 to i64
  %203 = call i64 @llvm.smin.i64(i64 %200, i64 %202)
  %204 = call i64 @llvm.smax.i64(i64 %200, i64 %202)
  %205 = sub i64 %204, %203
  %206 = getelementptr inbounds i8, i8* %text, i64 8
  %207 = getelementptr inbounds i8, i8* %206, i64 %203
  %208 = call i8* @nish_str_new(i8* %207, i64 %205)
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 0
  %210 = load i64, i64* %209, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 1
  %212 = load i64, i64* %211, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %213 = icmp eq i64 %210, %212
  br i1 %213, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %196, i64 8)
  br label %push.store.1

push.store.1:
  %214 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 2
  %215 = load i8*, i8** %214, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %216 = bitcast i8* %215 to i8**
  %217 = getelementptr inbounds i8*, i8** %216, i64 %210
  store i8* %208, i8** %217, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %218 = add i64 %210, 1
  store i64 %218, i64* %209, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = trunc i64 %218 to i32
  %220 = load i32, i32* %at.addr.1, align 4
  %221 = add nsw i32 %220, 1
  store i32 %221, i32* %start.addr, align 4
  br label %if.end.4

if.end.4:
  br label %if.end.3

if.end.3:
  %222 = load i32, i32* %i.addr, align 4
  %223 = add nsw i32 %222, 1
  store i32 %223, i32* %i.addr, align 4
  br label %while.cond.4

while.end.4:
  %224 = load i32, i32* %n.addr, align 4
  %225 = icmp sle i32 %224, 0
  br i1 %225, label %if.then.5, label %if.end.5

if.then.5:
  br label %while.end

if.end.5:
  %226 = load i32, i32* %end.addr, align 4
  store i32 %226, i32* %base.addr, align 4
  br label %while.cond

while.end:
  br label %if.end

if.end:
  br label %while.cond.5

while.cond.5:
  %227 = load i32, i32* %base.addr, align 4
  %228 = icmp sge i32 %227, 0
  br i1 %228, label %land.rhs.16, label %land.end.16

land.rhs.16:
  %229 = load i32, i32* %base.addr, align 4
  %230 = load i32, i32* %length.addr, align 4
  %231 = icmp slt i32 %229, %230
  br label %land.end.16

land.end.16:
  %232 = phi i1 [ false, %while.cond.5 ], [ %231, %land.rhs.16 ]
  br i1 %232, label %while.body.5, label %while.end.5

while.body.5:
  %233 = load i32, i32* %base.addr, align 4
  %234 = sext i32 %233 to i64
  %235 = getelementptr inbounds i8, i8* %text, i64 8
  %236 = getelementptr inbounds i8, i8* %235, i64 %234
  %237 = load i8, i8* %236, align 1
  %238 = zext i8 %237 to i32
  %239 = icmp eq i32 %238, 10
  br i1 %239, label %if.then.6, label %if.end.6

if.then.6:
  %240 = load i32, i32* %start.addr, align 4
  %241 = icmp sge i32 %240, 0
  br i1 %241, label %land.rhs.17, label %land.end.17

land.rhs.17:
  %242 = load i32, i32* %start.addr, align 4
  %243 = load i32, i32* %length.addr, align 4
  %244 = icmp slt i32 %242, %243
  br label %land.end.17

land.end.17:
  %245 = phi i1 [ false, %if.then.6 ], [ %244, %land.rhs.17 ]
  br i1 %245, label %if.then.7, label %if.end.7

if.then.7:
  %246 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %247 = bitcast i8* %text to i64*
  %248 = load i64, i64* %247, align 8
  %249 = load i32, i32* %start.addr, align 4
  %250 = sext i32 %249 to i64
  %251 = load i32, i32* %base.addr, align 4
  %252 = sext i32 %251 to i64
  %253 = call i64 @llvm.smin.i64(i64 %250, i64 %252)
  %254 = call i64 @llvm.smax.i64(i64 %250, i64 %252)
  %255 = sub i64 %254, %253
  %256 = getelementptr inbounds i8, i8* %text, i64 8
  %257 = getelementptr inbounds i8, i8* %256, i64 %253
  %258 = call i8* @nish_str_new(i8* %257, i64 %255)
  %259 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 0
  %260 = load i64, i64* %259, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %261 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 1
  %262 = load i64, i64* %261, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %263 = icmp eq i64 %260, %262
  br i1 %263, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %246, i64 8)
  br label %push.store.2

push.store.2:
  %264 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %246, i64 0, i32 2
  %265 = load i8*, i8** %264, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %266 = bitcast i8* %265 to i8**
  %267 = getelementptr inbounds i8*, i8** %266, i64 %260
  store i8* %258, i8** %267, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %268 = add i64 %260, 1
  store i64 %268, i64* %259, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %269 = trunc i64 %268 to i32
  br label %if.end.7

if.end.7:
  %270 = load i32, i32* %base.addr, align 4
  %271 = add nsw i32 %270, 1
  store i32 %271, i32* %start.addr, align 4
  br label %if.end.6

if.end.6:
  %272 = load i32, i32* %base.addr, align 4
  %273 = add nsw i32 %272, 1
  store i32 %273, i32* %base.addr, align 4
  br label %while.cond.5

while.end.5:
  %274 = load i32, i32* %start.addr, align 4
  %275 = icmp sge i32 %274, 0
  br i1 %275, label %land.rhs.18, label %land.end.18

land.rhs.18:
  %276 = load i32, i32* %start.addr, align 4
  %277 = load i32, i32* %length.addr, align 4
  %278 = icmp slt i32 %276, %277
  br label %land.end.18

land.end.18:
  %279 = phi i1 [ false, %while.end.5 ], [ %278, %land.rhs.18 ]
  br i1 %279, label %if.then.8, label %if.end.8

if.then.8:
  %280 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  %281 = bitcast i8* %text to i64*
  %282 = load i64, i64* %281, align 8
  %283 = load i32, i32* %start.addr, align 4
  %284 = sext i32 %283 to i64
  %285 = load i32, i32* %length.addr, align 4
  %286 = sext i32 %285 to i64
  %287 = call i64 @llvm.smin.i64(i64 %284, i64 %286)
  %288 = call i64 @llvm.smax.i64(i64 %284, i64 %286)
  %289 = sub i64 %288, %287
  %290 = getelementptr inbounds i8, i8* %text, i64 8
  %291 = getelementptr inbounds i8, i8* %290, i64 %287
  %292 = call i8* @nish_str_new(i8* %291, i64 %289)
  %293 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 0
  %294 = load i64, i64* %293, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %295 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 1
  %296 = load i64, i64* %295, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %297 = icmp eq i64 %294, %296
  br i1 %297, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %280, i64 8)
  br label %push.store.3

push.store.3:
  %298 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 2
  %299 = load i8*, i8** %298, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %300 = bitcast i8* %299 to i8**
  %301 = getelementptr inbounds i8*, i8** %300, i64 %294
  store i8* %292, i8** %301, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %302 = add i64 %294, 1
  store i64 %302, i64* %293, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %303 = trunc i64 %302 to i32
  br label %if.end.8

if.end.8:
  %304 = load %struct.nish_array*, %struct.nish_array** %lines.addr, align 8
  ret %struct.nish_array* %304
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.splitWhitespace(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %length.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = call i8* @nish_alloc_struct(i64 24)
  %4 = bitcast i8* %3 to %struct.nish_array*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %4, %struct.nish_array** %parts.addr, align 8
  store i32 -1, i32* %start.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %length.addr, align 4
  %10 = icmp slt i32 %8, %9
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %i.addr, align 4
  %12 = sext i32 %11 to i64
  %13 = getelementptr inbounds i8, i8* %text, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 %12
  %15 = load i8, i8* %14, align 1
  %16 = zext i8 %15 to i32
  %17 = call i1 @nish.isTextBlankByte(i32 %16)
  br i1 %17, label %if.then, label %if.else

if.then:
  %18 = load i32, i32* %start.addr, align 4
  %19 = icmp sge i32 %18, 0
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %start.addr, align 4
  %21 = load i32, i32* %length.addr, align 4
  %22 = icmp slt i32 %20, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %if.then ], [ %22, %land.rhs ]
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %25 = bitcast i8* %text to i64*
  %26 = load i64, i64* %25, align 8
  %27 = load i32, i32* %start.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = load i32, i32* %i.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = call i64 @llvm.smin.i64(i64 %28, i64 %30)
  %32 = call i64 @llvm.smax.i64(i64 %28, i64 %30)
  %33 = sub i64 %32, %31
  %34 = getelementptr inbounds i8, i8* %text, i64 8
  %35 = getelementptr inbounds i8, i8* %34, i64 %31
  %36 = call i8* @nish_str_new(i8* %35, i64 %33)
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = icmp eq i64 %38, %40
  br i1 %41, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %24, i64 8)
  br label %push.store

push.store:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i8**
  %45 = getelementptr inbounds i8*, i8** %44, i64 %38
  store i8* %36, i8** %45, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %46 = add i64 %38, 1
  store i64 %46, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  store i32 -1, i32* %start.addr, align 4
  br label %if.end.1

if.end.1:
  br label %if.end

if.else:
  %48 = load i32, i32* %start.addr, align 4
  %49 = icmp slt i32 %48, 0
  br i1 %49, label %if.then.2, label %if.end.2

if.then.2:
  %50 = load i32, i32* %i.addr, align 4
  store i32 %50, i32* %start.addr, align 4
  br label %if.end.2

if.end.2:
  br label %if.end

if.end:
  %51 = load i32, i32* %i.addr, align 4
  %52 = add nsw i32 %51, 1
  store i32 %52, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %53 = load i32, i32* %start.addr, align 4
  %54 = icmp sge i32 %53, 0
  br i1 %54, label %if.then.3, label %if.end.3

if.then.3:
  %55 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %56 = bitcast i8* %text to i64*
  %57 = load i64, i64* %56, align 8
  %58 = load i32, i32* %start.addr, align 4
  %59 = sext i32 %58 to i64
  %60 = call i64 @llvm.smin.i64(i64 %59, i64 %57)
  %61 = call i64 @llvm.smax.i64(i64 %60, i64 0)
  %62 = load i32, i32* %length.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = call i64 @llvm.smin.i64(i64 %61, i64 %63)
  %65 = call i64 @llvm.smax.i64(i64 %61, i64 %63)
  %66 = sub i64 %65, %64
  %67 = getelementptr inbounds i8, i8* %text, i64 8
  %68 = getelementptr inbounds i8, i8* %67, i64 %64
  %69 = call i8* @nish_str_new(i8* %68, i64 %66)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 1
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %74 = icmp eq i64 %71, %73
  br i1 %74, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %55, i64 8)
  br label %push.store.1

push.store.1:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %77 = bitcast i8* %76 to i8**
  %78 = getelementptr inbounds i8*, i8** %77, i64 %71
  store i8* %69, i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %79 = add i64 %71, 1
  store i64 %79, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = trunc i64 %79 to i32
  br label %if.end.3

if.end.3:
  %81 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %81
}

define noundef nonnull align 8 i8* @nish.trimStart(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %length.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %length.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds i8, i8* %text, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = call i1 @nish.isTextBlankByte(i32 %11)
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %16 = bitcast i8* %text to i64*
  %17 = load i64, i64* %16, align 8
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = call i64 @llvm.smin.i64(i64 %19, i64 %17)
  %21 = call i64 @llvm.smax.i64(i64 %20, i64 0)
  %22 = load i32, i32* %length.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = call i64 @llvm.smin.i64(i64 %21, i64 %23)
  %25 = call i64 @llvm.smax.i64(i64 %21, i64 %23)
  %26 = sub i64 %25, %24
  %27 = getelementptr inbounds i8, i8* %text, i64 8
  %28 = getelementptr inbounds i8, i8* %27, i64 %24
  %29 = call i8* @nish_str_new(i8* %28, i64 %26)
  ret i8* %29
}

define noundef nonnull align 8 i8* @nish.trimEnd(i8* noundef nonnull noalias readonly align 8 nocapture %text) #1 {
entry:
  %end.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %end.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %end.addr, align 4
  %4 = icmp sgt i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %end.addr, align 4
  %6 = sub nsw i32 %5, 1
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds i8, i8* %text, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = call i1 @nish.isTextBlankByte(i32 %11)
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %end.addr, align 4
  %15 = sub nsw i32 %14, 1
  store i32 %15, i32* %end.addr, align 4
  br label %while.cond

while.end:
  %16 = bitcast i8* %text to i64*
  %17 = load i64, i64* %16, align 8
  %18 = load i32, i32* %end.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = call i64 @llvm.smin.i64(i64 %19, i64 %17)
  %21 = call i64 @llvm.smax.i64(i64 %20, i64 0)
  %22 = call i64 @llvm.smin.i64(i64 0, i64 %21)
  %23 = call i64 @llvm.smax.i64(i64 0, i64 %21)
  %24 = sub i64 %23, %22
  %25 = getelementptr inbounds i8, i8* %text, i64 8
  %26 = getelementptr inbounds i8, i8* %25, i64 %22
  %27 = call i8* @nish_str_new(i8* %26, i64 %24)
  ret i8* %27
}

define noundef nonnull align 8 i8* @nish.trim(i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.trimStart(i8* %text)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @nish.trimEnd(i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  ret i8* %5
}

define noundef zeroext i1 @nish.contains(i8* noundef nonnull noalias readonly align 8 nocapture %haystack, i8* noundef nonnull noalias readonly align 8 nocapture %needle) #2 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %haystack, i8* %needle)
  %1 = trunc i64 %0 to i32
  %2 = icmp sge i32 %1, 0
  ret i1 %2
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.split(i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 nocapture %sep) #1 {
entry:
  %sepLength.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %sep to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %sepLength.addr, align 4
  %3 = load i32, i32* %sepLength.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = call %struct.nish_array* @nish.splitCodePoints(i8* %text, i32 -1)
  ret %struct.nish_array* %5

if.end:
  %6 = bitcast i8* %text to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %length.addr, align 4
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* null, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %10, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %start.addr, align 4
  br label %while.cond

while.cond:
  %14 = load i32, i32* %start.addr, align 4
  %15 = icmp sge i32 %14, 0
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %start.addr, align 4
  %17 = sext i32 %16 to i64
  %18 = bitcast i8* %text to i64*
  %19 = load i64, i64* %18, align 8
  %20 = call i64 @llvm.smin.i64(i64 %17, i64 %19)
  %21 = call i64 @llvm.smax.i64(i64 %20, i64 0)
  %22 = call i64 @nish_str_index_of_from(i8* %text, i8* %sep, i64 %21)
  %23 = trunc i64 %22 to i32
  store i32 %23, i32* %at.addr, align 4
  %24 = load i32, i32* %at.addr, align 4
  %25 = icmp slt i32 %24, 0
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  %26 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %27 = load i32, i32* %start.addr, align 4
  %28 = icmp sge i32 %27, 0
  br i1 %28, label %land.rhs, label %land.end

land.rhs:
  %29 = load i32, i32* %start.addr, align 4
  %30 = load i32, i32* %length.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end

land.end:
  %32 = phi i1 [ false, %if.then.1 ], [ %31, %land.rhs ]
  br i1 %32, label %cond.true, label %cond.false

cond.true:
  %33 = bitcast i8* %text to i64*
  %34 = load i64, i64* %33, align 8
  %35 = load i32, i32* %start.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = load i32, i32* %length.addr, align 4
  %38 = sext i32 %37 to i64
  %39 = call i64 @llvm.smin.i64(i64 %36, i64 %38)
  %40 = call i64 @llvm.smax.i64(i64 %36, i64 %38)
  %41 = sub i64 %40, %39
  %42 = getelementptr inbounds i8, i8* %text, i64 8
  %43 = getelementptr inbounds i8, i8* %42, i64 %39
  %44 = call i8* @nish_str_new(i8* %43, i64 %41)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %45 = phi i8* [ %44, %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), %cond.false ]
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %50 = icmp eq i64 %47, %49
  br i1 %50, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %26, i64 8)
  br label %push.store

push.store:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %53 = bitcast i8* %52 to i8**
  %54 = getelementptr inbounds i8*, i8** %53, i64 %47
  store i8* %45, i8** %54, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %55 = add i64 %47, 1
  store i64 %55, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = trunc i64 %55 to i32
  %57 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %57

if.end.1:
  %58 = load i32, i32* %start.addr, align 4
  %59 = icmp sge i32 %58, 0
  br i1 %59, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %60 = load i32, i32* %start.addr, align 4
  %61 = load i32, i32* %length.addr, align 4
  %62 = icmp slt i32 %60, %61
  br label %land.end.3

land.end.3:
  %63 = phi i1 [ false, %if.end.1 ], [ %62, %land.rhs.3 ]
  br i1 %63, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %64 = load i32, i32* %at.addr, align 4
  %65 = icmp sge i32 %64, 0
  br label %land.end.2

land.end.2:
  %66 = phi i1 [ false, %land.end.3 ], [ %65, %land.rhs.2 ]
  br i1 %66, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %67 = load i32, i32* %at.addr, align 4
  %68 = load i32, i32* %length.addr, align 4
  %69 = icmp slt i32 %67, %68
  br label %land.end.1

land.end.1:
  %70 = phi i1 [ false, %land.end.2 ], [ %69, %land.rhs.1 ]
  br i1 %70, label %if.then.2, label %if.end.2

if.then.2:
  %71 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %72 = bitcast i8* %text to i64*
  %73 = load i64, i64* %72, align 8
  %74 = load i32, i32* %start.addr, align 4
  %75 = sext i32 %74 to i64
  %76 = load i32, i32* %at.addr, align 4
  %77 = sext i32 %76 to i64
  %78 = call i64 @llvm.smin.i64(i64 %75, i64 %77)
  %79 = call i64 @llvm.smax.i64(i64 %75, i64 %77)
  %80 = sub i64 %79, %78
  %81 = getelementptr inbounds i8, i8* %text, i64 8
  %82 = getelementptr inbounds i8, i8* %81, i64 %78
  %83 = call i8* @nish_str_new(i8* %82, i64 %80)
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 1
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %88 = icmp eq i64 %85, %87
  br i1 %88, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %71, i64 8)
  br label %push.store.1

push.store.1:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %91 = bitcast i8* %90 to i8**
  %92 = getelementptr inbounds i8*, i8** %91, i64 %85
  store i8* %83, i8** %92, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %93 = add i64 %85, 1
  store i64 %93, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = trunc i64 %93 to i32
  br label %if.end.2

if.end.2:
  %95 = load i32, i32* %length.addr, align 4
  %96 = load i32, i32* %at.addr, align 4
  %97 = load i32, i32* %sepLength.addr, align 4
  %98 = call i32 @nish.textSpanEnd(i32 %95, i32 %96, i32 %97)
  store i32 %98, i32* %start.addr, align 4
  br label %while.cond

while.end:
  %99 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %99
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.splitLimit(i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 nocapture %sep, i32 noundef %limit) #1 {
entry:
  %sepLength.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = icmp eq i32 %limit, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %2

if.end:
  %6 = bitcast i8* %sep to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %sepLength.addr, align 4
  %9 = load i32, i32* %sepLength.addr, align 4
  %10 = icmp eq i32 %9, 0
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  %11 = call %struct.nish_array* @nish.splitCodePoints(i8* %text, i32 %limit)
  ret %struct.nish_array* %11

if.end.1:
  %12 = bitcast i8* %text to i64*
  %13 = load i64, i64* %12, align 8
  %14 = trunc i64 %13 to i32
  store i32 %14, i32* %length.addr, align 4
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 0, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* null, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %16, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %start.addr, align 4
  br label %while.cond

while.cond:
  %20 = load i32, i32* %start.addr, align 4
  %21 = icmp sge i32 %20, 0
  br i1 %21, label %while.body, label %while.end

while.body:
  %22 = load i32, i32* %start.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %text to i64*
  %25 = load i64, i64* %24, align 8
  %26 = call i64 @llvm.smin.i64(i64 %23, i64 %25)
  %27 = call i64 @llvm.smax.i64(i64 %26, i64 0)
  %28 = call i64 @nish_str_index_of_from(i8* %text, i8* %sep, i64 %27)
  %29 = trunc i64 %28 to i32
  store i32 %29, i32* %at.addr, align 4
  %30 = load i32, i32* %at.addr, align 4
  %31 = icmp slt i32 %30, 0
  br i1 %31, label %if.then.2, label %if.end.2

if.then.2:
  %32 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %33 = load i32, i32* %start.addr, align 4
  %34 = icmp sge i32 %33, 0
  br i1 %34, label %land.rhs, label %land.end

land.rhs:
  %35 = load i32, i32* %start.addr, align 4
  %36 = load i32, i32* %length.addr, align 4
  %37 = icmp slt i32 %35, %36
  br label %land.end

land.end:
  %38 = phi i1 [ false, %if.then.2 ], [ %37, %land.rhs ]
  br i1 %38, label %cond.true, label %cond.false

cond.true:
  %39 = bitcast i8* %text to i64*
  %40 = load i64, i64* %39, align 8
  %41 = load i32, i32* %start.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = load i32, i32* %length.addr, align 4
  %44 = sext i32 %43 to i64
  %45 = call i64 @llvm.smin.i64(i64 %42, i64 %44)
  %46 = call i64 @llvm.smax.i64(i64 %42, i64 %44)
  %47 = sub i64 %46, %45
  %48 = getelementptr inbounds i8, i8* %text, i64 8
  %49 = getelementptr inbounds i8, i8* %48, i64 %45
  %50 = call i8* @nish_str_new(i8* %49, i64 %47)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %51 = phi i8* [ %50, %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), %cond.false ]
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = icmp eq i64 %53, %55
  br i1 %56, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %32, i64 8)
  br label %push.store

push.store:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8**
  %60 = getelementptr inbounds i8*, i8** %59, i64 %53
  store i8* %51, i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %61 = add i64 %53, 1
  store i64 %61, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = trunc i64 %61 to i32
  %63 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %63

if.end.2:
  %64 = load i32, i32* %start.addr, align 4
  %65 = icmp sge i32 %64, 0
  br i1 %65, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %66 = load i32, i32* %start.addr, align 4
  %67 = load i32, i32* %length.addr, align 4
  %68 = icmp slt i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %if.end.2 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = icmp sge i32 %70, 0
  br label %land.end.2

land.end.2:
  %72 = phi i1 [ false, %land.end.3 ], [ %71, %land.rhs.2 ]
  br i1 %72, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %73 = load i32, i32* %at.addr, align 4
  %74 = load i32, i32* %length.addr, align 4
  %75 = icmp slt i32 %73, %74
  br label %land.end.1

land.end.1:
  %76 = phi i1 [ false, %land.end.2 ], [ %75, %land.rhs.1 ]
  br i1 %76, label %if.then.3, label %if.end.3

if.then.3:
  %77 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %78 = bitcast i8* %text to i64*
  %79 = load i64, i64* %78, align 8
  %80 = load i32, i32* %start.addr, align 4
  %81 = sext i32 %80 to i64
  %82 = load i32, i32* %at.addr, align 4
  %83 = sext i32 %82 to i64
  %84 = call i64 @llvm.smin.i64(i64 %81, i64 %83)
  %85 = call i64 @llvm.smax.i64(i64 %81, i64 %83)
  %86 = sub i64 %85, %84
  %87 = getelementptr inbounds i8, i8* %text, i64 8
  %88 = getelementptr inbounds i8, i8* %87, i64 %84
  %89 = call i8* @nish_str_new(i8* %88, i64 %86)
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 1
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %94 = icmp eq i64 %91, %93
  br i1 %94, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %77, i64 8)
  br label %push.store.1

push.store.1:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = bitcast i8* %96 to i8**
  %98 = getelementptr inbounds i8*, i8** %97, i64 %91
  store i8* %89, i8** %98, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %99 = add i64 %91, 1
  store i64 %99, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = trunc i64 %99 to i32
  br label %if.end.3

if.end.3:
  %101 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = trunc i64 %103 to i32
  %105 = icmp eq i32 %104, %limit
  br i1 %105, label %if.then.4, label %if.end.4

if.then.4:
  %106 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %106

if.end.4:
  %107 = load i32, i32* %length.addr, align 4
  %108 = load i32, i32* %at.addr, align 4
  %109 = load i32, i32* %sepLength.addr, align 4
  %110 = call i32 @nish.textSpanEnd(i32 %107, i32 %108, i32 %109)
  store i32 %110, i32* %start.addr, align 4
  br label %while.cond

while.end:
  %111 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %111
}

define internal noundef i32 @nish.fixedDigitsHalve(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %digits, i32 noundef %count) #1 {
entry:
  %carry.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  store i32 0, i32* %carry.addr, align 4
  store i32 %count, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp sgt i32 %4, 0
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp sle i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %while.cond ], [ %8, %land.rhs ]
  br i1 %9, label %while.body, label %while.end

while.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sub nsw i32 %10, 1
  store i32 %11, i32* %at.addr, align 4
  %12 = load i32, i32* %at.addr, align 4
  %13 = icmp sge i32 %12, 0
  br i1 %13, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %14 = load i32, i32* %at.addr, align 4
  %15 = trunc i64 %1 to i32
  %16 = icmp slt i32 %14, %15
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %while.body ], [ %16, %land.rhs.1 ]
  br i1 %17, label %if.then, label %if.end

if.then:
  %18 = load i32, i32* %carry.addr, align 4
  %19 = and i32 %18, 1
  %20 = mul nsw i32 %19, 10
  %21 = load i32, i32* %at.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %3 to i8*
  %24 = getelementptr inbounds i8, i8* %23, i64 %22
  %25 = load i8, i8* %24, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %26 = zext i8 %25 to i32
  %27 = add nsw i32 %20, %26
  store i32 %27, i32* %value.addr, align 4
  %28 = load i32, i32* %at.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = load i32, i32* %value.addr, align 4
  %31 = ashr i32 %30, 1
  %32 = trunc i32 %31 to i8
  %33 = bitcast i8* %3 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 %29
  store i8 %32, i8* %34, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = load i32, i32* %value.addr, align 4
  %36 = and i32 %35, 1
  store i32 %36, i32* %carry.addr, align 4
  br label %if.end

if.end:
  %37 = load i32, i32* %at.addr, align 4
  store i32 %37, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %38 = load i32, i32* %carry.addr, align 4
  ret i32 %38
}

define internal void @nish.fixedDigitsAdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %digits, i1 noundef zeroext %doubling, i32 noundef %amount) #1 {
entry:
  %carry.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %digit.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  %0 = and i32 %amount, 1
  store i32 %0, i32* %carry.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %length.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %length.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %while.body, label %while.end

while.body:
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %10
  %13 = load i8, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = zext i8 %13 to i32
  store i32 %14, i32* %digit.addr, align 4
  %15 = load i32, i32* %digit.addr, align 4
  %16 = load i32, i32* %carry.addr, align 4
  %17 = and i32 %16, 1
  %18 = add nsw i32 %15, %17
  store i32 %18, i32* %value.addr, align 4
  br i1 %doubling, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %value.addr, align 4
  %20 = load i32, i32* %digit.addr, align 4
  %21 = add nsw i32 %19, %20
  store i32 %21, i32* %value.addr, align 4
  br label %if.end

if.end:
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = load i32, i32* %value.addr, align 4
  %25 = icmp sge i32 %24, 10
  br i1 %25, label %cond.true, label %cond.false

cond.true:
  %26 = load i32, i32* %value.addr, align 4
  %27 = sub nsw i32 %26, 10
  br label %cond.end

cond.false:
  %28 = load i32, i32* %value.addr, align 4
  br label %cond.end

cond.end:
  %29 = phi i32 [ %27, %cond.true ], [ %28, %cond.false ]
  %30 = trunc i32 %29 to i8
  %31 = bitcast i8* %5 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 %23
  store i8 %30, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = load i32, i32* %value.addr, align 4
  %34 = icmp sge i32 %33, 10
  br i1 %34, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %35 = phi i32 [ 1, %cond.true.1 ], [ 0, %cond.false.1 ]
  store i32 %35, i32* %carry.addr, align 4
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %38 = load i32, i32* %carry.addr, align 4
  %39 = icmp sgt i32 %38, 0
  br i1 %39, label %if.then.1, label %if.end.1

if.then.1:
  %40 = load i32, i32* %carry.addr, align 4
  %41 = trunc i32 %40 to i8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 1
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = icmp eq i64 %43, %45
  br i1 %46, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %digits, i64 1)
  br label %push.store

push.store:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %digits, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to i8*
  %50 = getelementptr inbounds i8, i8* %49, i64 %43
  store i8 %41, i8* %50, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = add i64 %43, 1
  store i64 %51, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = trunc i64 %51 to i32
  br label %if.end.1

if.end.1:
  ret void
}

define noundef nonnull align 8 i8* @nish.toFixed(double noundef %x, i32 noundef %digits) #1 {
entry:
  %negative.addr = alloca i1, align 1
  %m.addr = alloca double, align 8
  %exponent.addr = alloca double, align 8
  %places.addr = alloca i32, align 4
  %decimal.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %last.addr = alloca double, align 8
  %count.addr = alloca i32, align 4
  %dropped.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %digit.addr = alloca i32, align 4
  %0 = icmp slt i32 %digits, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp sgt i32 %digits, 100
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [33 x i8] }* @.str.1 to i8*))
  unreachable

if.end:
  %3 = fcmp une double %x, %x
  br i1 %3, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %4 = fcmp oge double %x, 0x444B1AE4D6E2EF50
  br label %lor.end.2

lor.end.2:
  %5 = phi i1 [ true, %if.end ], [ %4, %lor.rhs.2 ]
  br i1 %5, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %6 = fneg double 0x444B1AE4D6E2EF50
  %7 = fcmp ole double %x, %6
  br label %lor.end.1

lor.end.1:
  %8 = phi i1 [ true, %lor.end.2 ], [ %7, %lor.rhs.1 ]
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  %9 = call i8* @nish_str_from_f64(double %x)
  ret i8* %9

if.end.1:
  %10 = fcmp olt double %x, 0x0000000000000000
  store i1 %10, i1* %negative.addr, align 1
  %11 = load i1, i1* %negative.addr, align 1
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = fneg double %x
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %13 = phi double [ %12, %cond.true ], [ %x, %cond.false ]
  store double %13, double* %m.addr, align 8
  store double 0x0000000000000000, double* %exponent.addr, align 8
  %14 = load double, double* %m.addr, align 8
  %15 = fcmp ogt double %14, 0x0000000000000000
  br i1 %15, label %if.then.2, label %if.end.2

if.then.2:
  br label %while.cond

while.cond:
  %16 = load double, double* %m.addr, align 8
  %17 = fcmp olt double %16, 0x4330000000000000
  br i1 %17, label %while.body, label %while.end

while.body:
  %18 = load double, double* %m.addr, align 8
  %19 = fmul double %18, 0x4000000000000000
  store double %19, double* %m.addr, align 8
  %20 = load double, double* %exponent.addr, align 8
  %21 = fsub double %20, 0x3FF0000000000000
  store double %21, double* %exponent.addr, align 8
  br label %while.cond

while.end:
  br label %while.cond.1

while.cond.1:
  %22 = load double, double* %m.addr, align 8
  %23 = fcmp oge double %22, 0x4340000000000000
  br i1 %23, label %while.body.1, label %while.end.1

while.body.1:
  %24 = load double, double* %m.addr, align 8
  %25 = fdiv double %24, 0x4000000000000000
  store double %25, double* %m.addr, align 8
  %26 = load double, double* %exponent.addr, align 8
  %27 = fadd double %26, 0x3FF0000000000000
  store double %27, double* %exponent.addr, align 8
  br label %while.cond.1

while.end.1:
  br label %if.end.2

if.end.2:
  store i32 %digits, i32* %places.addr, align 4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %decimal.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond.2

while.cond.2:
  %31 = load i32, i32* %i.addr, align 4
  %32 = load i32, i32* %places.addr, align 4
  %33 = icmp slt i32 %31, %32
  br i1 %33, label %while.body.2, label %while.end.2

while.body.2:
  %34 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %35 = trunc i32 0 to i8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %34, i64 1)
  br label %push.store

push.store:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %42 to i8*
  %44 = getelementptr inbounds i8, i8* %43, i64 %37
  store i8 %35, i8* %44, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = trunc i64 %45 to i32
  %47 = load i32, i32* %i.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr, align 4
  br label %while.cond.2

while.end.2:
  br label %while.cond.3

while.cond.3:
  %49 = load double, double* %m.addr, align 8
  %50 = fcmp ogt double %49, 0x0000000000000000
  br i1 %50, label %while.body.3, label %while.end.3

while.body.3:
  %51 = load double, double* %m.addr, align 8
  %52 = frem double %51, 0x4024000000000000
  store double %52, double* %last.addr, align 8
  %53 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %54 = load double, double* %last.addr, align 8
  %55 = call i8 @llvm.fptoui.sat.i8.f64(double %54)
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 1
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = icmp eq i64 %57, %59
  br i1 %60, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %53, i64 1)
  br label %push.store.1

push.store.1:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i8*
  %64 = getelementptr inbounds i8, i8* %63, i64 %57
  store i8 %55, i8* %64, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %65 = add i64 %57, 1
  store i64 %65, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = trunc i64 %65 to i32
  %67 = load double, double* %m.addr, align 8
  %68 = load double, double* %last.addr, align 8
  %69 = fsub double %67, %68
  %70 = fdiv double %69, 0x4024000000000000
  store double %70, double* %m.addr, align 8
  br label %while.cond.3

while.end.3:
  br label %while.cond.4

while.cond.4:
  %71 = load double, double* %exponent.addr, align 8
  %72 = fcmp ogt double %71, 0x0000000000000000
  br i1 %72, label %while.body.4, label %while.end.4

while.body.4:
  %73 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  call void @nish.fixedDigitsAdd(%struct.nish_array* %73, i1 true, i32 0)
  %74 = load double, double* %exponent.addr, align 8
  %75 = fsub double %74, 0x3FF0000000000000
  store double %75, double* %exponent.addr, align 8
  br label %while.cond.4

while.end.4:
  %76 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = trunc i64 %78 to i32
  store i32 %79, i32* %count.addr, align 4
  store i32 0, i32* %dropped.addr, align 4
  %80 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.5

while.cond.5:
  %85 = load double, double* %exponent.addr, align 8
  %86 = fcmp olt double %85, 0x0000000000000000
  br i1 %86, label %land.rhs, label %land.end

land.rhs:
  %87 = load i32, i32* %count.addr, align 4
  %88 = icmp sgt i32 %87, 0
  br label %land.end

land.end:
  %89 = phi i1 [ false, %while.cond.5 ], [ %88, %land.rhs ]
  br i1 %89, label %while.body.5, label %while.end.5

while.body.5:
  %90 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %91 = load i32, i32* %count.addr, align 4
  %92 = call i32 @nish.fixedDigitsHalve(%struct.nish_array* %90, i32 %91)
  store i32 %92, i32* %dropped.addr, align 4
  %93 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.6

while.cond.6:
  %98 = load i32, i32* %count.addr, align 4
  %99 = icmp sgt i32 %98, 0
  br i1 %99, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %100 = load i32, i32* %count.addr, align 4
  %101 = trunc i64 %95 to i32
  %102 = icmp sle i32 %100, %101
  br label %land.end.2

land.end.2:
  %103 = phi i1 [ false, %while.cond.6 ], [ %102, %land.rhs.2 ]
  br i1 %103, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %104 = load i32, i32* %count.addr, align 4
  %105 = sub nsw i32 %104, 1
  %106 = sext i32 %105 to i64
  %107 = bitcast i8* %97 to i8*
  %108 = getelementptr inbounds i8, i8* %107, i64 %106
  %109 = load i8, i8* %108, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %110 = trunc i32 0 to i8
  %111 = icmp eq i8 %109, %110
  br label %land.end.1

land.end.1:
  %112 = phi i1 [ false, %land.end.2 ], [ %111, %land.rhs.1 ]
  br i1 %112, label %while.body.6, label %while.end.6

while.body.6:
  %113 = load i32, i32* %count.addr, align 4
  %114 = sub nsw i32 %113, 1
  store i32 %114, i32* %count.addr, align 4
  br label %while.cond.6

while.end.6:
  %115 = load double, double* %exponent.addr, align 8
  %116 = fadd double %115, 0x3FF0000000000000
  store double %116, double* %exponent.addr, align 8
  br label %while.cond.5

while.end.5:
  %117 = load double, double* %exponent.addr, align 8
  %118 = fcmp oeq double %117, 0x0000000000000000
  br i1 %118, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %119 = load i32, i32* %dropped.addr, align 4
  %120 = icmp eq i32 %119, 1
  br label %land.end.3

land.end.3:
  %121 = phi i1 [ false, %while.end.5 ], [ %120, %land.rhs.3 ]
  br i1 %121, label %if.then.3, label %if.end.3

if.then.3:
  %122 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  call void @nish.fixedDigitsAdd(%struct.nish_array* %122, i1 false, i32 1)
  br label %if.end.3

if.end.3:
  br label %while.cond.7

while.cond.7:
  %123 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = trunc i64 %125 to i32
  %127 = load i32, i32* %places.addr, align 4
  %128 = icmp sle i32 %126, %127
  br i1 %128, label %while.body.7, label %while.end.7

while.body.7:
  %129 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %130 = trunc i32 0 to i8
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 0
  %132 = load i64, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 1
  %134 = load i64, i64* %133, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %135 = icmp eq i64 %132, %134
  br i1 %135, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %129, i64 1)
  br label %push.store.2

push.store.2:
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %138 = bitcast i8* %137 to i8*
  %139 = getelementptr inbounds i8, i8* %138, i64 %132
  store i8 %130, i8* %139, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %140 = add i64 %132, 1
  store i64 %140, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %141 = trunc i64 %140 to i32
  br label %while.cond.7

while.end.7:
  %142 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = trunc i64 %144 to i32
  %146 = sub nsw i32 %145, 1
  store i32 %146, i32* %at.addr, align 4
  %147 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 0
  %149 = load i64, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %147, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.8

while.cond.8:
  %152 = load i32, i32* %at.addr, align 4
  %153 = load i32, i32* %places.addr, align 4
  %154 = icmp sgt i32 %152, %153
  br i1 %154, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %155 = load i32, i32* %at.addr, align 4
  %156 = icmp sge i32 %155, 0
  br label %land.end.6

land.end.6:
  %157 = phi i1 [ false, %while.cond.8 ], [ %156, %land.rhs.6 ]
  br i1 %157, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %158 = load i32, i32* %at.addr, align 4
  %159 = trunc i64 %149 to i32
  %160 = icmp slt i32 %158, %159
  br label %land.end.5

land.end.5:
  %161 = phi i1 [ false, %land.end.6 ], [ %160, %land.rhs.5 ]
  br i1 %161, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %162 = load i32, i32* %at.addr, align 4
  %163 = sext i32 %162 to i64
  %164 = bitcast i8* %151 to i8*
  %165 = getelementptr inbounds i8, i8* %164, i64 %163
  %166 = load i8, i8* %165, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %167 = trunc i32 0 to i8
  %168 = icmp eq i8 %166, %167
  br label %land.end.4

land.end.4:
  %169 = phi i1 [ false, %land.end.5 ], [ %168, %land.rhs.4 ]
  br i1 %169, label %while.body.8, label %while.end.8

while.body.8:
  %170 = load i32, i32* %at.addr, align 4
  %171 = sub nsw i32 %170, 1
  store i32 %171, i32* %at.addr, align 4
  br label %while.cond.8

while.end.8:
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %172, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %174, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %bytes.addr, align 8
  %175 = load i1, i1* %negative.addr, align 1
  br i1 %175, label %if.then.4, label %if.end.4

if.then.4:
  %176 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %177 = trunc i32 45 to i8
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 0
  %179 = load i64, i64* %178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 1
  %181 = load i64, i64* %180, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %182 = icmp eq i64 %179, %181
  br i1 %182, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %176, i64 1)
  br label %push.store.3

push.store.3:
  %183 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %176, i64 0, i32 2
  %184 = load i8*, i8** %183, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %185 = bitcast i8* %184 to i8*
  %186 = getelementptr inbounds i8, i8* %185, i64 %179
  store i8 %177, i8* %186, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %187 = add i64 %179, 1
  store i64 %187, i64* %178, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %188 = trunc i64 %187 to i32
  br label %if.end.4

if.end.4:
  br label %while.cond.9

while.cond.9:
  %189 = load i32, i32* %at.addr, align 4
  %190 = icmp sge i32 %189, 0
  br i1 %190, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %191 = load i32, i32* %at.addr, align 4
  %192 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %193 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %192, i64 0, i32 0
  %194 = load i64, i64* %193, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %195 = trunc i64 %194 to i32
  %196 = icmp slt i32 %191, %195
  br label %land.end.7

land.end.7:
  %197 = phi i1 [ false, %while.cond.9 ], [ %196, %land.rhs.7 ]
  br i1 %197, label %while.body.9, label %while.end.9

while.body.9:
  %198 = load %struct.nish_array*, %struct.nish_array** %decimal.addr, align 8
  %199 = load i32, i32* %at.addr, align 4
  %200 = sext i32 %199 to i64
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %198, i64 0, i32 2
  %202 = load i8*, i8** %201, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %203 = bitcast i8* %202 to i8*
  %204 = getelementptr inbounds i8, i8* %203, i64 %200
  %205 = load i8, i8* %204, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %206 = zext i8 %205 to i32
  store i32 %206, i32* %digit.addr, align 4
  %207 = load i32, i32* %at.addr, align 4
  %208 = add nsw i32 %207, 1
  %209 = load i32, i32* %places.addr, align 4
  %210 = icmp eq i32 %208, %209
  br i1 %210, label %if.then.5, label %if.end.5

if.then.5:
  %211 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %212 = trunc i32 46 to i8
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 0
  %214 = load i64, i64* %213, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 1
  %216 = load i64, i64* %215, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %217 = icmp eq i64 %214, %216
  br i1 %217, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %211, i64 1)
  br label %push.store.4

push.store.4:
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %211, i64 0, i32 2
  %219 = load i8*, i8** %218, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %220 = bitcast i8* %219 to i8*
  %221 = getelementptr inbounds i8, i8* %220, i64 %214
  store i8 %212, i8* %221, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %222 = add i64 %214, 1
  store i64 %222, i64* %213, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %223 = trunc i64 %222 to i32
  br label %if.end.5

if.end.5:
  %224 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %225 = load i32, i32* %digit.addr, align 4
  %226 = add nsw i32 48, %225
  %227 = trunc i32 %226 to i8
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %224, i64 0, i32 0
  %229 = load i64, i64* %228, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %224, i64 0, i32 1
  %231 = load i64, i64* %230, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %232 = icmp eq i64 %229, %231
  br i1 %232, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %224, i64 1)
  br label %push.store.5

push.store.5:
  %233 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %224, i64 0, i32 2
  %234 = load i8*, i8** %233, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %235 = bitcast i8* %234 to i8*
  %236 = getelementptr inbounds i8, i8* %235, i64 %229
  store i8 %227, i8* %236, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %237 = add i64 %229, 1
  store i64 %237, i64* %228, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %238 = trunc i64 %237 to i32
  %239 = load i32, i32* %at.addr, align 4
  %240 = sub nsw i32 %239, 1
  store i32 %240, i32* %at.addr, align 4
  br label %while.cond.9

while.end.9:
  %241 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %242 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %243 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %242, i64 0, i32 0
  %244 = load i64, i64* %243, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %245 = trunc i64 %244 to i32
  %246 = sext i32 %245 to i64
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 2
  %248 = load i8*, i8** %247, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %249 = getelementptr inbounds i8, i8* %248, i64 0
  %250 = sub i64 %246, 0
  %251 = call i8* @nish_str_new(i8* %249, i64 %250)
  ret i8* %251
}

define internal noundef i32 @nish.textSpanEnd(i32 noundef %length, i32 noundef %at, i32 noundef %count) #0 {
entry:
  %room.addr = alloca i32, align 4
  %gap.addr = alloca i32, align 4
  %0 = icmp slt i32 %length, 0
  br i1 %0, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %1 = icmp slt i32 %at, 0
  br label %lor.end.1

lor.end.1:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.1 ]
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = icmp slt i32 %count, 0
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %lor.end.1 ], [ %3, %lor.rhs ]
  br i1 %4, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %5 = sub nsw i32 %length, %at
  store i32 %5, i32* %room.addr, align 4
  %6 = load i32, i32* %room.addr, align 4
  %7 = icmp slt i32 %6, 0
  br i1 %7, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -1

if.end.1:
  %8 = load i32, i32* %room.addr, align 4
  %9 = sub nsw i32 %8, %count
  store i32 %9, i32* %gap.addr, align 4
  %10 = load i32, i32* %gap.addr, align 4
  %11 = icmp slt i32 %10, 0
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %12 = load i32, i32* %gap.addr, align 4
  %13 = sub nsw i32 %length, %12
  br label %cond.end

cond.end:
  %14 = phi i32 [ -1, %cond.true ], [ %13, %cond.false ]
  ret i32 %14
}

define noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 nocapture %needle, i8* noundef nonnull noalias readonly align 8 nocapture %replacement) #1 {
entry:
  %needleLength.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %rest.addr = alloca i8*, align 8
  %at.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %after.addr = alloca i32, align 4
  %join.total.1 = alloca i64, align 8
  %join.at.1 = alloca i64, align 8
  %join.p.1 = alloca i8*, align 8
  %0 = bitcast i8* %needle to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %needleLength.addr, align 4
  %3 = load i32, i32* %needleLength.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  ret i8* %text

if.end:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i8* %text, i8** %rest.addr, align 8
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %8 = load i8*, i8** %rest.addr, align 8
  %9 = call i64 @nish_str_index_of(i8* %8, i8* %needle)
  %10 = trunc i64 %9 to i32
  store i32 %10, i32* %at.addr, align 4
  %11 = load i32, i32* %at.addr, align 4
  %12 = icmp slt i32 %11, 0
  br i1 %12, label %lor.end, label %lor.rhs

lor.rhs:
  %13 = load i32, i32* %at.addr, align 4
  %14 = load i8*, i8** %rest.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = icmp sgt i32 %13, %17
  br label %lor.end

lor.end:
  %19 = phi i1 [ true, %while.body ], [ %18, %lor.rhs ]
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %21 = load i8*, i8** %rest.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* %21, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = bitcast i8* %replacement to i64*
  %37 = load i64, i64* %36, align 8
  %38 = sub i64 %35, 1
  %39 = mul i64 %37, %38
  %40 = icmp eq i64 %35, 0
  %41 = select i1 %40, i64 0, i64 %39
  store i64 %41, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %42 = load i64, i64* %join.at, align 8
  %43 = icmp ult i64 %42, %35
  br i1 %43, label %join.sum.body, label %join.copy

join.sum.body:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i8**
  %47 = getelementptr inbounds i8*, i8** %46, i64 %42
  %48 = load i8*, i8** %47, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %49 = load i64, i64* %join.total, align 8
  %50 = bitcast i8* %48 to i64*
  %51 = load i64, i64* %50, align 8
  %52 = add i64 %49, %51
  store i64 %52, i64* %join.total, align 8
  %53 = add i64 %42, 1
  store i64 %53, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %54 = load i64, i64* %join.total, align 8
  %55 = icmp ugt i64 %54, 2147483647
  %56 = add i64 %54, 9
  %57 = select i1 %55, i64 4611686018427387904, i64 %56
  %58 = call i8* @nish_alloc_struct(i64 %57)
  %59 = bitcast i8* %58 to i64*
  store i64 %54, i64* %59, align 8
  %60 = getelementptr inbounds i8, i8* %58, i64 8
  store i8* %60, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %61 = load i64, i64* %join.at, align 8
  %62 = icmp ult i64 %61, %35
  br i1 %62, label %join.part, label %join.end

join.part:
  %63 = load i8*, i8** %join.p, align 8
  %64 = icmp eq i64 %61, 0
  %65 = select i1 %64, i64 0, i64 %37
  %66 = getelementptr inbounds i8, i8* %replacement, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %63, i8* %66, i64 %65, i1 false)
  %67 = getelementptr inbounds i8, i8* %63, i64 %65
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %69 to i8**
  %71 = getelementptr inbounds i8*, i8** %70, i64 %61
  %72 = load i8*, i8** %71, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %73 = bitcast i8* %72 to i64*
  %74 = load i64, i64* %73, align 8
  %75 = getelementptr inbounds i8, i8* %72, i64 8
  %76 = icmp eq i64 %74, 1
  br i1 %76, label %join.byte, label %join.bulk

join.byte:
  %77 = load i8, i8* %75, align 1
  store i8 %77, i8* %67, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %67, i8* %75, i64 %74, i1 false)
  br label %join.next

join.next:
  %78 = getelementptr inbounds i8, i8* %67, i64 %74
  store i8* %78, i8** %join.p, align 8
  %79 = add i64 %61, 1
  store i64 %79, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %80 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %80, align 1
  ret i8* %58

if.end.1:
  %81 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %82 = load i8*, i8** %rest.addr, align 8
  %83 = bitcast i8* %82 to i64*
  %84 = load i64, i64* %83, align 8
  %85 = load i32, i32* %at.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = call i64 @llvm.smin.i64(i64 0, i64 %86)
  %88 = call i64 @llvm.smax.i64(i64 0, i64 %86)
  %89 = sub i64 %88, %87
  %90 = getelementptr inbounds i8, i8* %82, i64 8
  %91 = getelementptr inbounds i8, i8* %90, i64 %87
  %92 = call i8* @nish_str_new(i8* %91, i64 %89)
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 1
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = icmp eq i64 %94, %96
  br i1 %97, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %81, i64 8)
  br label %push.store.1

push.store.1:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %100 = bitcast i8* %99 to i8**
  %101 = getelementptr inbounds i8*, i8** %100, i64 %94
  store i8* %92, i8** %101, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %102 = add i64 %94, 1
  store i64 %102, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = trunc i64 %102 to i32
  %104 = load i8*, i8** %rest.addr, align 8
  %105 = bitcast i8* %104 to i64*
  %106 = load i64, i64* %105, align 8
  %107 = trunc i64 %106 to i32
  %108 = load i32, i32* %at.addr, align 4
  %109 = load i32, i32* %needleLength.addr, align 4
  %110 = call i32 @nish.textSpanEnd(i32 %107, i32 %108, i32 %109)
  store i32 %110, i32* %after.addr, align 4
  %111 = load i32, i32* %after.addr, align 4
  %112 = icmp slt i32 %111, 0
  br i1 %112, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %113 = load i32, i32* %after.addr, align 4
  %114 = load i8*, i8** %rest.addr, align 8
  %115 = bitcast i8* %114 to i64*
  %116 = load i64, i64* %115, align 8
  %117 = trunc i64 %116 to i32
  %118 = icmp sgt i32 %113, %117
  br label %lor.end.1

lor.end.1:
  %119 = phi i1 [ true, %push.store.1 ], [ %118, %lor.rhs.1 ]
  br i1 %119, label %if.then.2, label %if.end.2

if.then.2:
  %120 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = bitcast i8* %replacement to i64*
  %124 = load i64, i64* %123, align 8
  %125 = sub i64 %122, 1
  %126 = mul i64 %124, %125
  %127 = icmp eq i64 %122, 0
  %128 = select i1 %127, i64 0, i64 %126
  store i64 %128, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %129 = load i64, i64* %join.at.1, align 8
  %130 = icmp ult i64 %129, %122
  br i1 %130, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %133 = bitcast i8* %132 to i8**
  %134 = getelementptr inbounds i8*, i8** %133, i64 %129
  %135 = load i8*, i8** %134, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %136 = load i64, i64* %join.total.1, align 8
  %137 = bitcast i8* %135 to i64*
  %138 = load i64, i64* %137, align 8
  %139 = add i64 %136, %138
  store i64 %139, i64* %join.total.1, align 8
  %140 = add i64 %129, 1
  store i64 %140, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %141 = load i64, i64* %join.total.1, align 8
  %142 = icmp ugt i64 %141, 2147483647
  %143 = add i64 %141, 9
  %144 = select i1 %142, i64 4611686018427387904, i64 %143
  %145 = call i8* @nish_alloc_struct(i64 %144)
  %146 = bitcast i8* %145 to i64*
  store i64 %141, i64* %146, align 8
  %147 = getelementptr inbounds i8, i8* %145, i64 8
  store i8* %147, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %148 = load i64, i64* %join.at.1, align 8
  %149 = icmp ult i64 %148, %122
  br i1 %149, label %join.part.1, label %join.end.1

join.part.1:
  %150 = load i8*, i8** %join.p.1, align 8
  %151 = icmp eq i64 %148, 0
  %152 = select i1 %151, i64 0, i64 %124
  %153 = getelementptr inbounds i8, i8* %replacement, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %150, i8* %153, i64 %152, i1 false)
  %154 = getelementptr inbounds i8, i8* %150, i64 %152
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %157 = bitcast i8* %156 to i8**
  %158 = getelementptr inbounds i8*, i8** %157, i64 %148
  %159 = load i8*, i8** %158, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %160 = bitcast i8* %159 to i64*
  %161 = load i64, i64* %160, align 8
  %162 = getelementptr inbounds i8, i8* %159, i64 8
  %163 = icmp eq i64 %161, 1
  br i1 %163, label %join.byte.1, label %join.bulk.1

join.byte.1:
  %164 = load i8, i8* %162, align 1
  store i8 %164, i8* %154, align 1
  br label %join.next.1

join.bulk.1:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %154, i8* %162, i64 %161, i1 false)
  br label %join.next.1

join.next.1:
  %165 = getelementptr inbounds i8, i8* %154, i64 %161
  store i8* %165, i8** %join.p.1, align 8
  %166 = add i64 %148, 1
  store i64 %166, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %167 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %167, align 1
  ret i8* %145

if.end.2:
  %168 = load i8*, i8** %rest.addr, align 8
  %169 = bitcast i8* %168 to i64*
  %170 = load i64, i64* %169, align 8
  %171 = load i32, i32* %after.addr, align 4
  %172 = sext i32 %171 to i64
  %173 = load i8*, i8** %rest.addr, align 8
  %174 = bitcast i8* %173 to i64*
  %175 = load i64, i64* %174, align 8
  %176 = trunc i64 %175 to i32
  %177 = sext i32 %176 to i64
  %178 = call i64 @llvm.smin.i64(i64 %177, i64 %170)
  %179 = call i64 @llvm.smax.i64(i64 %178, i64 0)
  %180 = call i64 @llvm.smin.i64(i64 %172, i64 %179)
  %181 = call i64 @llvm.smax.i64(i64 %172, i64 %179)
  %182 = sub i64 %181, %180
  %183 = getelementptr inbounds i8, i8* %168, i64 8
  %184 = getelementptr inbounds i8, i8* %183, i64 %180
  %185 = call i8* @nish_str_new(i8* %184, i64 %182)
  store i8* %185, i8** %rest.addr, align 8
  br label %while.cond

while.end:
  unreachable
}

define noundef i32 @nish.firstDifference(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %left, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %right) #3 {
entry:
  %leftLength.addr = alloca i32, align 4
  %rightLength.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %left, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %leftLength.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %right, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %rightLength.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %left, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %right, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = load i32, i32* %leftLength.addr, align 4
  %12 = icmp slt i32 %10, %11
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %i.addr, align 4
  %14 = load i32, i32* %rightLength.addr, align 4
  %15 = icmp slt i32 %13, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %while.cond ], [ %15, %land.rhs ]
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %7 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %18
  %21 = load i8*, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %9 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 %23
  %26 = load i8*, i8** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %27 = call zeroext i1 @nish_str_eq(i8* %21, i8* %26)
  %28 = xor i1 %27, true
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load i32, i32* %i.addr, align 4
  ret i32 %29

if.end:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %32 = load i32, i32* %leftLength.addr, align 4
  %33 = load i32, i32* %rightLength.addr, align 4
  %34 = icmp eq i32 %32, %33
  br i1 %34, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %35 = load i32, i32* %i.addr, align 4
  br label %cond.end

cond.end:
  %36 = phi i32 [ -1, %cond.true ], [ %35, %cond.false ]
  ret i32 %36
}

define noundef i32 @nish.indexOfAny(i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 %bytes, i32 noundef %from) #3 {
entry:
  %count.addr = alloca i32, align 4
  %length.addr = alloca i32, align 4
  %start.addr = alloca i32, align 4
  %0 = bitcast i8* %bytes to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %count.addr, align 4
  %3 = load i32, i32* %count.addr, align 4
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %5 = bitcast i8* %text to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %length.addr, align 4
  store i32 %from, i32* %start.addr, align 4
  %8 = load i32, i32* %start.addr, align 4
  %9 = icmp slt i32 %8, 0
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  store i32 0, i32* %start.addr, align 4
  br label %if.end.1

if.end.1:
  %10 = load i32, i32* %start.addr, align 4
  %11 = load i32, i32* %length.addr, align 4
  %12 = icmp sgt i32 %10, %11
  br i1 %12, label %if.then.2, label %if.end.2

if.then.2:
  %13 = load i32, i32* %length.addr, align 4
  store i32 %13, i32* %start.addr, align 4
  br label %if.end.2

if.end.2:
  %14 = load i32, i32* %count.addr, align 4
  %15 = icmp sgt i32 %14, 16
  br i1 %15, label %if.then.3, label %if.end.3

if.then.3:
  %16 = load i32, i32* %start.addr, align 4
  %17 = call i32 @nish.indexOfAnyScan(i8* %text, i8* %bytes, i32 %16)
  ret i32 %17

if.end.3:
  %18 = load i32, i32* %start.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = call i64 @nish_str_index_of_any(i8* %text, i8* %bytes, i64 %19)
  %21 = trunc i64 %20 to i32
  ret i32 %21
}

define internal noundef i32 @nish.indexOfAnyFrom(i8* noundef nonnull noalias readonly align 8 %text, i8* noundef nonnull noalias readonly align 8 %bytes, i32 noundef %from) #3 {
entry:
  %0 = call i32 @nish.indexOfAnyScan(i8* %text, i8* %bytes, i32 %from)
  ret i32 %0
}

define internal noundef i32 @nish.indexOfAnyScan(i8* noundef nonnull noalias readonly align 8 nocapture %text, i8* noundef nonnull noalias readonly align 8 nocapture %bytes, i32 noundef %from) #3 {
entry:
  %length.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %code.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = bitcast i8* %bytes to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %count.addr, align 4
  store i32 %from, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %i.addr, align 4
  %9 = load i32, i32* %length.addr, align 4
  %10 = icmp slt i32 %8, %9
  br label %land.end

land.end:
  %11 = phi i1 [ false, %while.cond ], [ %10, %land.rhs ]
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds i8, i8* %text, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %13
  %16 = load i8, i8* %15, align 1
  %17 = zext i8 %16 to i32
  store i32 %17, i32* %code.addr, align 4
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  %18 = load i32, i32* %j.addr, align 4
  %19 = load i32, i32* %count.addr, align 4
  %20 = icmp slt i32 %18, %19
  br i1 %20, label %while.body.1, label %while.end.1

while.body.1:
  %21 = load i32, i32* %j.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds i8, i8* %bytes, i64 8
  %24 = getelementptr inbounds i8, i8* %23, i64 %22
  %25 = load i8, i8* %24, align 1
  %26 = zext i8 %25 to i32
  %27 = load i32, i32* %code.addr, align 4
  %28 = icmp eq i32 %26, %27
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load i32, i32* %i.addr, align 4
  ret i32 %29

if.end:
  %30 = load i32, i32* %j.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret i32 -1
}

define internal noundef zeroext i1 @nish.textUnitsAreBytes() #2 {
entry:
  %0 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 2
  ret i1 %3
}

define noundef i32 @nish.codePointLength(i8* noundef nonnull noalias readonly align 8 nocapture %text) #3 {
entry:
  %length.addr = alloca i32, align 4
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %afterHigh.addr = alloca i1, align 1
  %unit.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = call i1 @nish.textUnitsAreBytes()
  br i1 %3, label %if.then, label %if.end

if.then:
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = load i32, i32* %length.addr, align 4
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %while.body, label %while.end

while.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = getelementptr inbounds i8, i8* %text, i64 8
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = load i8, i8* %10, align 1
  %12 = zext i8 %11 to i32
  %13 = and i32 %12, 192
  %14 = icmp ne i32 %13, 128
  br i1 %14, label %if.then.1, label %if.end.1

if.then.1:
  %15 = load i32, i32* %count.addr, align 4
  %16 = add i32 %15, 1
  store i32 %16, i32* %count.addr, align 4
  br label %if.end.1

if.end.1:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %19 = load i32, i32* %count.addr, align 4
  ret i32 %19

if.end:
  store i1 false, i1* %afterHigh.addr, align 1
  br label %while.cond.1

while.cond.1:
  %20 = load i32, i32* %i.addr, align 4
  %21 = load i32, i32* %length.addr, align 4
  %22 = icmp slt i32 %20, %21
  br i1 %22, label %while.body.1, label %while.end.1

while.body.1:
  %23 = load i32, i32* %i.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = getelementptr inbounds i8, i8* %text, i64 8
  %26 = getelementptr inbounds i8, i8* %25, i64 %24
  %27 = load i8, i8* %26, align 1
  %28 = zext i8 %27 to i32
  store i32 %28, i32* %unit.addr, align 4
  %29 = load i1, i1* %afterHigh.addr, align 1
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load i32, i32* %unit.addr, align 4
  %31 = icmp sge i32 %30, 56320
  br label %land.end.1

land.end.1:
  %32 = phi i1 [ false, %while.body.1 ], [ %31, %land.rhs.1 ]
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %unit.addr, align 4
  %34 = icmp slt i32 %33, 57344
  br label %land.end

land.end:
  %35 = phi i1 [ false, %land.end.1 ], [ %34, %land.rhs ]
  %36 = xor i1 %35, true
  br i1 %36, label %if.then.2, label %if.end.2

if.then.2:
  %37 = load i32, i32* %count.addr, align 4
  %38 = add i32 %37, 1
  store i32 %38, i32* %count.addr, align 4
  br label %if.end.2

if.end.2:
  %39 = load i32, i32* %unit.addr, align 4
  %40 = icmp sge i32 %39, 55296
  br i1 %40, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %41 = load i32, i32* %unit.addr, align 4
  %42 = icmp slt i32 %41, 56320
  br label %land.end.2

land.end.2:
  %43 = phi i1 [ false, %if.end.2 ], [ %42, %land.rhs.2 ]
  store i1 %43, i1* %afterHigh.addr, align 1
  %44 = load i32, i32* %i.addr, align 4
  %45 = add nsw i32 %44, 1
  store i32 %45, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %46 = load i32, i32* %count.addr, align 4
  ret i32 %46
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.splitCodePoints(i8* noundef nonnull noalias readonly align 8 nocapture %text, i32 noundef %limit) #1 {
entry:
  %length.addr = alloca i32, align 4
  %bytes.addr = alloca i1, align 1
  %parts.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %afterHigh.addr = alloca i1, align 1
  %i.addr = alloca i32, align 4
  %unit.addr = alloca i32, align 4
  %starts.addr = alloca i1, align 1
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  %3 = call i1 @nish.textUnitsAreBytes()
  store i1 %3, i1* %bytes.addr, align 1
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %5, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %start.addr, align 4
  store i1 false, i1* %afterHigh.addr, align 1
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = load i32, i32* %length.addr, align 4
  %11 = icmp slt i32 %9, %10
  br i1 %11, label %while.body, label %while.end

while.body:
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds i8, i8* %text, i64 8
  %15 = getelementptr inbounds i8, i8* %14, i64 %13
  %16 = load i8, i8* %15, align 1
  %17 = zext i8 %16 to i32
  store i32 %17, i32* %unit.addr, align 4
  %18 = load i1, i1* %bytes.addr, align 1
  br i1 %18, label %cond.true, label %cond.false

cond.true:
  %19 = load i32, i32* %unit.addr, align 4
  %20 = and i32 %19, 192
  %21 = icmp ne i32 %20, 128
  br label %cond.end

cond.false:
  %22 = load i1, i1* %afterHigh.addr, align 1
  br i1 %22, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %23 = load i32, i32* %unit.addr, align 4
  %24 = icmp sge i32 %23, 56320
  br label %land.end.1

land.end.1:
  %25 = phi i1 [ false, %cond.false ], [ %24, %land.rhs.1 ]
  br i1 %25, label %land.rhs, label %land.end

land.rhs:
  %26 = load i32, i32* %unit.addr, align 4
  %27 = icmp slt i32 %26, 57344
  br label %land.end

land.end:
  %28 = phi i1 [ false, %land.end.1 ], [ %27, %land.rhs ]
  %29 = xor i1 %28, true
  br label %cond.end

cond.end:
  %30 = phi i1 [ %21, %cond.true ], [ %29, %land.end ]
  store i1 %30, i1* %starts.addr, align 1
  %31 = load i32, i32* %unit.addr, align 4
  %32 = icmp sge i32 %31, 55296
  br i1 %32, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %33 = load i32, i32* %unit.addr, align 4
  %34 = icmp slt i32 %33, 56320
  br label %land.end.2

land.end.2:
  %35 = phi i1 [ false, %cond.end ], [ %34, %land.rhs.2 ]
  store i1 %35, i1* %afterHigh.addr, align 1
  %36 = load i1, i1* %starts.addr, align 1
  br i1 %36, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %37 = load i32, i32* %i.addr, align 4
  %38 = icmp sgt i32 %37, 0
  br label %land.end.3

land.end.3:
  %39 = phi i1 [ false, %land.end.2 ], [ %38, %land.rhs.3 ]
  br i1 %39, label %if.then, label %if.end

if.then:
  %40 = load i32, i32* %start.addr, align 4
  %41 = icmp sge i32 %40, 0
  br i1 %41, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %42 = load i32, i32* %start.addr, align 4
  %43 = load i32, i32* %length.addr, align 4
  %44 = icmp slt i32 %42, %43
  br label %land.end.4

land.end.4:
  %45 = phi i1 [ false, %if.then ], [ %44, %land.rhs.4 ]
  br i1 %45, label %if.then.1, label %if.end.1

if.then.1:
  %46 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %47 = bitcast i8* %text to i64*
  %48 = load i64, i64* %47, align 8
  %49 = load i32, i32* %start.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = load i32, i32* %i.addr, align 4
  %52 = sext i32 %51 to i64
  %53 = call i64 @llvm.smin.i64(i64 %50, i64 %52)
  %54 = call i64 @llvm.smax.i64(i64 %50, i64 %52)
  %55 = sub i64 %54, %53
  %56 = getelementptr inbounds i8, i8* %text, i64 8
  %57 = getelementptr inbounds i8, i8* %56, i64 %53
  %58 = call i8* @nish_str_new(i8* %57, i64 %55)
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = icmp eq i64 %60, %62
  br i1 %63, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %46, i64 8)
  br label %push.store

push.store:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to i8**
  %67 = getelementptr inbounds i8*, i8** %66, i64 %60
  store i8* %58, i8** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %68 = add i64 %60, 1
  store i64 %68, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = trunc i64 %68 to i32
  br label %if.end.1

if.end.1:
  %70 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = trunc i64 %72 to i32
  %74 = icmp eq i32 %73, %limit
  br i1 %74, label %if.then.2, label %if.end.2

if.then.2:
  %75 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %75

if.end.2:
  %76 = load i32, i32* %i.addr, align 4
  store i32 %76, i32* %start.addr, align 4
  br label %if.end

if.end:
  %77 = load i32, i32* %i.addr, align 4
  %78 = add nsw i32 %77, 1
  store i32 %78, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %79 = load i32, i32* %length.addr, align 4
  %80 = icmp sgt i32 %79, 0
  br i1 %80, label %if.then.3, label %if.end.3

if.then.3:
  %81 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %82 = bitcast i8* %text to i64*
  %83 = load i64, i64* %82, align 8
  %84 = load i32, i32* %start.addr, align 4
  %85 = sext i32 %84 to i64
  %86 = call i64 @llvm.smin.i64(i64 %85, i64 %83)
  %87 = call i64 @llvm.smax.i64(i64 %86, i64 0)
  %88 = load i32, i32* %length.addr, align 4
  %89 = sext i32 %88 to i64
  %90 = call i64 @llvm.smin.i64(i64 %87, i64 %89)
  %91 = call i64 @llvm.smax.i64(i64 %87, i64 %89)
  %92 = sub i64 %91, %90
  %93 = getelementptr inbounds i8, i8* %text, i64 8
  %94 = getelementptr inbounds i8, i8* %93, i64 %90
  %95 = call i8* @nish_str_new(i8* %94, i64 %92)
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %97 = load i64, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 1
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %100 = icmp eq i64 %97, %99
  br i1 %100, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %81, i64 8)
  br label %push.store.1

push.store.1:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %103 = bitcast i8* %102 to i8**
  %104 = getelementptr inbounds i8*, i8** %103, i64 %97
  store i8* %95, i8** %104, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %105 = add i64 %97, 1
  store i64 %105, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %106 = trunc i64 %105 to i32
  br label %if.end.3

if.end.3:
  %107 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %107
}

define internal noundef nonnull align 8 i8* @nish.shiftTextAsciiRange(i8* noundef nonnull noalias readonly align 8 nocapture %text, i32 noundef %low, i32 noundef %high, i1 noundef zeroext %toUpper) #1 {
entry:
  %length.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %code.addr = alloca i32, align 4
  %moved.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %start.addr = alloca i32, align 4
  %code.addr.1 = alloca i32, align 4
  %chr = alloca i8, align 1
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %length.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %3 = call i1 @nish.textUnitsAreBytes()
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  br label %while.cond

while.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %length.addr, align 4
  %9 = icmp slt i32 %7, %8
  br i1 %9, label %while.body, label %while.end

while.body:
  %10 = load i32, i32* %i.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds i8, i8* %text, i64 8
  %13 = getelementptr inbounds i8, i8* %12, i64 %11
  %14 = load i8, i8* %13, align 1
  %15 = zext i8 %14 to i32
  store i32 %15, i32* %code.addr, align 4
  br i1 %toUpper, label %cond.true, label %cond.false

cond.true:
  %16 = load i32, i32* %code.addr, align 4
  %17 = sub nsw i32 %16, 32
  br label %cond.end

cond.false:
  %18 = load i32, i32* %code.addr, align 4
  %19 = add nsw i32 %18, 32
  br label %cond.end

cond.end:
  %20 = phi i32 [ %17, %cond.true ], [ %19, %cond.false ]
  store i32 %20, i32* %moved.addr, align 4
  %21 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %22 = load i32, i32* %code.addr, align 4
  %23 = icmp sge i32 %22, %low
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i32, i32* %code.addr, align 4
  %25 = icmp sle i32 %24, %high
  br label %land.end

land.end:
  %26 = phi i1 [ false, %cond.end ], [ %25, %land.rhs ]
  br i1 %26, label %cond.true.1, label %cond.false.1

cond.true.1:
  %27 = load i32, i32* %moved.addr, align 4
  br label %cond.end.1

cond.false.1:
  %28 = load i32, i32* %code.addr, align 4
  br label %cond.end.1

cond.end.1:
  %29 = phi i32 [ %27, %cond.true.1 ], [ %28, %cond.false.1 ]
  %30 = trunc i32 %29 to i8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = icmp eq i64 %32, %34
  br i1 %35, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %21, i64 1)
  br label %push.store

push.store:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %38 = bitcast i8* %37 to i8*
  %39 = getelementptr inbounds i8, i8* %38, i64 %32
  store i8 %30, i8* %39, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = add i64 %32, 1
  store i64 %40, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = trunc i64 %40 to i32
  %42 = load i32, i32* %i.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %44 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %45 = load i32, i32* %length.addr, align 4
  %46 = sext i32 %45 to i64
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = icmp ule i64 0, %46
  %50 = icmp ule i64 %46, %48
  %51 = and i1 %49, %50
  br i1 %51, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %46, i64 %48)
  unreachable

bytes.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = getelementptr inbounds i8, i8* %53, i64 0
  %55 = sub i64 %46, 0
  %56 = call i8* @nish_str_new(i8* %54, i64 %55)
  ret i8* %56

if.end:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %start.addr, align 4
  br label %while.cond.1

while.cond.1:
  %60 = load i32, i32* %i.addr, align 4
  %61 = load i32, i32* %length.addr, align 4
  %62 = icmp slt i32 %60, %61
  br i1 %62, label %while.body.1, label %while.end.1

while.body.1:
  %63 = load i32, i32* %i.addr, align 4
  %64 = sext i32 %63 to i64
  %65 = getelementptr inbounds i8, i8* %text, i64 8
  %66 = getelementptr inbounds i8, i8* %65, i64 %64
  %67 = load i8, i8* %66, align 1
  %68 = zext i8 %67 to i32
  store i32 %68, i32* %code.addr.1, align 4
  %69 = load i32, i32* %code.addr.1, align 4
  %70 = icmp sge i32 %69, %low
  br i1 %70, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %71 = load i32, i32* %code.addr.1, align 4
  %72 = icmp sle i32 %71, %high
  br label %land.end.1

land.end.1:
  %73 = phi i1 [ false, %while.body.1 ], [ %72, %land.rhs.1 ]
  br i1 %73, label %if.then.1, label %if.end.1

if.then.1:
  %74 = load i32, i32* %start.addr, align 4
  %75 = icmp sge i32 %74, 0
  br i1 %75, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %76 = load i32, i32* %start.addr, align 4
  %77 = load i32, i32* %length.addr, align 4
  %78 = icmp slt i32 %76, %77
  br label %land.end.2

land.end.2:
  %79 = phi i1 [ false, %if.then.1 ], [ %78, %land.rhs.2 ]
  br i1 %79, label %if.then.2, label %if.end.2

if.then.2:
  %80 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %81 = bitcast i8* %text to i64*
  %82 = load i64, i64* %81, align 8
  %83 = load i32, i32* %start.addr, align 4
  %84 = sext i32 %83 to i64
  %85 = load i32, i32* %i.addr, align 4
  %86 = sext i32 %85 to i64
  %87 = call i64 @llvm.smin.i64(i64 %84, i64 %86)
  %88 = call i64 @llvm.smax.i64(i64 %84, i64 %86)
  %89 = sub i64 %88, %87
  %90 = getelementptr inbounds i8, i8* %text, i64 8
  %91 = getelementptr inbounds i8, i8* %90, i64 %87
  %92 = call i8* @nish_str_new(i8* %91, i64 %89)
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 1
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = icmp eq i64 %94, %96
  br i1 %97, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %80, i64 8)
  br label %push.store.1

push.store.1:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %100 = bitcast i8* %99 to i8**
  %101 = getelementptr inbounds i8*, i8** %100, i64 %94
  store i8* %92, i8** %101, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %102 = add i64 %94, 1
  store i64 %102, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = trunc i64 %102 to i32
  br label %if.end.2

if.end.2:
  %104 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  br i1 %toUpper, label %cond.true.2, label %cond.false.2

cond.true.2:
  %105 = load i32, i32* %code.addr.1, align 4
  %106 = sub nsw i32 %105, 32
  br label %cond.end.2

cond.false.2:
  %107 = load i32, i32* %code.addr.1, align 4
  %108 = add nsw i32 %107, 32
  br label %cond.end.2

cond.end.2:
  %109 = phi i32 [ %106, %cond.true.2 ], [ %108, %cond.false.2 ]
  %110 = sext i32 %109 to i64
  %111 = trunc i64 %110 to i8
  store i8 %111, i8* %chr, align 1
  %112 = call i8* @nish_str_new(i8* %chr, i64 1)
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 1
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %117 = icmp eq i64 %114, %116
  br i1 %117, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %104, i64 8)
  br label %push.store.2

push.store.2:
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %120 = bitcast i8* %119 to i8**
  %121 = getelementptr inbounds i8*, i8** %120, i64 %114
  store i8* %112, i8** %121, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %122 = add i64 %114, 1
  store i64 %122, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = trunc i64 %122 to i32
  %124 = load i32, i32* %i.addr, align 4
  %125 = add nsw i32 %124, 1
  store i32 %125, i32* %start.addr, align 4
  br label %if.end.1

if.end.1:
  %126 = load i32, i32* %i.addr, align 4
  %127 = add nsw i32 %126, 1
  store i32 %127, i32* %i.addr, align 4
  br label %while.cond.1

while.end.1:
  %128 = load i32, i32* %start.addr, align 4
  %129 = load i32, i32* %length.addr, align 4
  %130 = icmp slt i32 %128, %129
  br i1 %130, label %if.then.3, label %if.end.3

if.then.3:
  %131 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %132 = bitcast i8* %text to i64*
  %133 = load i64, i64* %132, align 8
  %134 = load i32, i32* %start.addr, align 4
  %135 = sext i32 %134 to i64
  %136 = call i64 @llvm.smin.i64(i64 %135, i64 %133)
  %137 = call i64 @llvm.smax.i64(i64 %136, i64 0)
  %138 = load i32, i32* %length.addr, align 4
  %139 = sext i32 %138 to i64
  %140 = call i64 @llvm.smin.i64(i64 %137, i64 %139)
  %141 = call i64 @llvm.smax.i64(i64 %137, i64 %139)
  %142 = sub i64 %141, %140
  %143 = getelementptr inbounds i8, i8* %text, i64 8
  %144 = getelementptr inbounds i8, i8* %143, i64 %140
  %145 = call i8* @nish_str_new(i8* %144, i64 %142)
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 0
  %147 = load i64, i64* %146, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 1
  %149 = load i64, i64* %148, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %150 = icmp eq i64 %147, %149
  br i1 %150, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %131, i64 8)
  br label %push.store.3

push.store.3:
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %152 = load i8*, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %153 = bitcast i8* %152 to i8**
  %154 = getelementptr inbounds i8*, i8** %153, i64 %147
  store i8* %145, i8** %154, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %155 = add i64 %147, 1
  store i64 %155, i64* %146, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = trunc i64 %155 to i32
  br label %if.end.3

if.end.3:
  %157 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 0
  %159 = load i64, i64* %158, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %160 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %161 = load i64, i64* %160, align 8
  %162 = sub i64 %159, 1
  %163 = mul i64 %161, %162
  %164 = icmp eq i64 %159, 0
  %165 = select i1 %164, i64 0, i64 %163
  store i64 %165, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %166 = load i64, i64* %join.at, align 8
  %167 = icmp ult i64 %166, %159
  br i1 %167, label %join.sum.body, label %join.copy

join.sum.body:
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 2
  %169 = load i8*, i8** %168, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %170 = bitcast i8* %169 to i8**
  %171 = getelementptr inbounds i8*, i8** %170, i64 %166
  %172 = load i8*, i8** %171, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %173 = load i64, i64* %join.total, align 8
  %174 = bitcast i8* %172 to i64*
  %175 = load i64, i64* %174, align 8
  %176 = add i64 %173, %175
  store i64 %176, i64* %join.total, align 8
  %177 = add i64 %166, 1
  store i64 %177, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %178 = load i64, i64* %join.total, align 8
  %179 = icmp ugt i64 %178, 2147483647
  %180 = add i64 %178, 9
  %181 = select i1 %179, i64 4611686018427387904, i64 %180
  %182 = call i8* @nish_alloc_struct(i64 %181)
  %183 = bitcast i8* %182 to i64*
  store i64 %178, i64* %183, align 8
  %184 = getelementptr inbounds i8, i8* %182, i64 8
  store i8* %184, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %185 = load i64, i64* %join.at, align 8
  %186 = icmp ult i64 %185, %159
  br i1 %186, label %join.part, label %join.end

join.part:
  %187 = load i8*, i8** %join.p, align 8
  %188 = icmp eq i64 %185, 0
  %189 = select i1 %188, i64 0, i64 %161
  %190 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %187, i8* %190, i64 %189, i1 false)
  %191 = getelementptr inbounds i8, i8* %187, i64 %189
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 2
  %193 = load i8*, i8** %192, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %194 = bitcast i8* %193 to i8**
  %195 = getelementptr inbounds i8*, i8** %194, i64 %185
  %196 = load i8*, i8** %195, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %197 = bitcast i8* %196 to i64*
  %198 = load i64, i64* %197, align 8
  %199 = getelementptr inbounds i8, i8* %196, i64 8
  %200 = icmp eq i64 %198, 1
  br i1 %200, label %join.byte, label %join.bulk

join.byte:
  %201 = load i8, i8* %199, align 1
  store i8 %201, i8* %191, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %191, i8* %199, i64 %198, i1 false)
  br label %join.next

join.next:
  %202 = getelementptr inbounds i8, i8* %191, i64 %198
  store i8* %202, i8** %join.p, align 8
  %203 = add i64 %185, 1
  store i64 %203, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %204 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %204, align 1
  ret i8* %182
}

define noundef nonnull align 8 i8* @nish.asciiUpper(i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.shiftTextAsciiRange(i8* %text, i32 97, i32 122, i1 true)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef nonnull align 8 i8* @nish.asciiLower(i8* noundef nonnull noalias readonly align 8 %text) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.shiftTextAsciiRange(i8* %text, i32 65, i32 90, i1 false)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal noundef nonnull align 8 i8* @nish.textPadding(i8* noundef nonnull noalias readonly align 8 nocapture %text, i32 noundef %width, i8* noundef nonnull noalias readonly align 8 nocapture %fill) #1 {
entry:
  %textLength.addr = alloca i32, align 4
  %fillLength.addr = alloca i32, align 4
  %left.addr = alloca i32, align 4
  %step.addr = alloca i32, align 4
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %cut.addr = alloca i32, align 4
  %bytes.addr = alloca i1, align 1
  %unit.addr = alloca i32, align 4
  %before.addr = alloca i32, align 4
  %inside.addr = alloca i1, align 1
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %textLength.addr, align 4
  %3 = bitcast i8* %fill to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %fillLength.addr, align 4
  %6 = load i32, i32* %textLength.addr, align 4
  %7 = icmp sle i32 %width, %6
  br i1 %7, label %lor.end, label %lor.rhs

lor.rhs:
  %8 = load i32, i32* %fillLength.addr, align 4
  %9 = icmp eq i32 %8, 0
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %entry ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  %11 = load i32, i32* %textLength.addr, align 4
  %12 = sub i32 %width, %11
  store i32 %12, i32* %left.addr, align 4
  %13 = load i32, i32* %fillLength.addr, align 4
  store i32 %13, i32* %step.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  br label %while.cond

while.cond:
  %17 = load i32, i32* %left.addr, align 4
  %18 = load i32, i32* %step.addr, align 4
  %19 = icmp uge i32 %17, %18
  br i1 %19, label %while.body, label %while.end

while.body:
  %20 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %20, i64 8)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i8**
  %29 = getelementptr inbounds i8*, i8** %28, i64 %22
  store i8* %fill, i8** %29, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  %32 = load i32, i32* %left.addr, align 4
  %33 = load i32, i32* %step.addr, align 4
  %34 = sub i32 %32, %33
  store i32 %34, i32* %left.addr, align 4
  br label %while.cond

while.end:
  %35 = load i32, i32* %left.addr, align 4
  store i32 %35, i32* %cut.addr, align 4
  %36 = call i1 @nish.textUnitsAreBytes()
  store i1 %36, i1* %bytes.addr, align 1
  br label %while.cond.1

while.cond.1:
  %37 = load i32, i32* %cut.addr, align 4
  %38 = icmp sgt i32 %37, 0
  br i1 %38, label %land.rhs, label %land.end

land.rhs:
  %39 = load i32, i32* %cut.addr, align 4
  %40 = load i32, i32* %fillLength.addr, align 4
  %41 = icmp slt i32 %39, %40
  br label %land.end

land.end:
  %42 = phi i1 [ false, %while.cond.1 ], [ %41, %land.rhs ]
  br i1 %42, label %while.body.1, label %while.end.1

while.body.1:
  %43 = load i32, i32* %cut.addr, align 4
  %44 = sext i32 %43 to i64
  %45 = getelementptr inbounds i8, i8* %fill, i64 8
  %46 = getelementptr inbounds i8, i8* %45, i64 %44
  %47 = load i8, i8* %46, align 1
  %48 = zext i8 %47 to i32
  store i32 %48, i32* %unit.addr, align 4
  %49 = load i32, i32* %cut.addr, align 4
  %50 = sub nsw i32 %49, 1
  %51 = sext i32 %50 to i64
  %52 = getelementptr inbounds i8, i8* %fill, i64 8
  %53 = getelementptr inbounds i8, i8* %52, i64 %51
  %54 = load i8, i8* %53, align 1
  %55 = zext i8 %54 to i32
  store i32 %55, i32* %before.addr, align 4
  %56 = load i1, i1* %bytes.addr, align 1
  br i1 %56, label %cond.true, label %cond.false

cond.true:
  %57 = load i32, i32* %unit.addr, align 4
  %58 = and i32 %57, 192
  %59 = icmp eq i32 %58, 128
  br label %cond.end

cond.false:
  %60 = load i32, i32* %unit.addr, align 4
  %61 = icmp sge i32 %60, 56320
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %unit.addr, align 4
  %63 = icmp slt i32 %62, 57344
  br label %land.end.3

land.end.3:
  %64 = phi i1 [ false, %cond.false ], [ %63, %land.rhs.3 ]
  br i1 %64, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %65 = load i32, i32* %before.addr, align 4
  %66 = icmp sge i32 %65, 55296
  br label %land.end.2

land.end.2:
  %67 = phi i1 [ false, %land.end.3 ], [ %66, %land.rhs.2 ]
  br i1 %67, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %68 = load i32, i32* %before.addr, align 4
  %69 = icmp slt i32 %68, 56320
  br label %land.end.1

land.end.1:
  %70 = phi i1 [ false, %land.end.2 ], [ %69, %land.rhs.1 ]
  br label %cond.end

cond.end:
  %71 = phi i1 [ %59, %cond.true ], [ %70, %land.end.1 ]
  store i1 %71, i1* %inside.addr, align 1
  %72 = load i1, i1* %inside.addr, align 1
  %73 = xor i1 %72, true
  br i1 %73, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end.1

if.end.1:
  %74 = load i32, i32* %cut.addr, align 4
  %75 = sub nsw i32 %74, 1
  store i32 %75, i32* %cut.addr, align 4
  br label %while.cond.1

while.end.1:
  %76 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %77 = bitcast i8* %fill to i64*
  %78 = load i64, i64* %77, align 8
  %79 = load i32, i32* %cut.addr, align 4
  %80 = sext i32 %79 to i64
  %81 = call i64 @llvm.smin.i64(i64 %80, i64 %78)
  %82 = call i64 @llvm.smax.i64(i64 %81, i64 0)
  %83 = call i64 @llvm.smin.i64(i64 0, i64 %82)
  %84 = call i64 @llvm.smax.i64(i64 0, i64 %82)
  %85 = sub i64 %84, %83
  %86 = getelementptr inbounds i8, i8* %fill, i64 8
  %87 = getelementptr inbounds i8, i8* %86, i64 %83
  %88 = call i8* @nish_str_new(i8* %87, i64 %85)
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 1
  %92 = load i64, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %93 = icmp eq i64 %90, %92
  br i1 %93, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %76, i64 8)
  br label %push.store.1

push.store.1:
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %96 = bitcast i8* %95 to i8**
  %97 = getelementptr inbounds i8*, i8** %96, i64 %90
  store i8* %88, i8** %97, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %98 = add i64 %90, 1
  store i64 %98, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = trunc i64 %98 to i32
  %100 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 0
  %102 = load i64, i64* %101, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %104 = load i64, i64* %103, align 8
  %105 = sub i64 %102, 1
  %106 = mul i64 %104, %105
  %107 = icmp eq i64 %102, 0
  %108 = select i1 %107, i64 0, i64 %106
  store i64 %108, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %109 = load i64, i64* %join.at, align 8
  %110 = icmp ult i64 %109, %102
  br i1 %110, label %join.sum.body, label %join.copy

join.sum.body:
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = bitcast i8* %112 to i8**
  %114 = getelementptr inbounds i8*, i8** %113, i64 %109
  %115 = load i8*, i8** %114, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %116 = load i64, i64* %join.total, align 8
  %117 = bitcast i8* %115 to i64*
  %118 = load i64, i64* %117, align 8
  %119 = add i64 %116, %118
  store i64 %119, i64* %join.total, align 8
  %120 = add i64 %109, 1
  store i64 %120, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %121 = load i64, i64* %join.total, align 8
  %122 = icmp ugt i64 %121, 2147483647
  %123 = add i64 %121, 9
  %124 = select i1 %122, i64 4611686018427387904, i64 %123
  %125 = call i8* @nish_alloc_struct(i64 %124)
  %126 = bitcast i8* %125 to i64*
  store i64 %121, i64* %126, align 8
  %127 = getelementptr inbounds i8, i8* %125, i64 8
  store i8* %127, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %128 = load i64, i64* %join.at, align 8
  %129 = icmp ult i64 %128, %102
  br i1 %129, label %join.part, label %join.end

join.part:
  %130 = load i8*, i8** %join.p, align 8
  %131 = icmp eq i64 %128, 0
  %132 = select i1 %131, i64 0, i64 %104
  %133 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %130, i8* %133, i64 %132, i1 false)
  %134 = getelementptr inbounds i8, i8* %130, i64 %132
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %100, i64 0, i32 2
  %136 = load i8*, i8** %135, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %137 = bitcast i8* %136 to i8**
  %138 = getelementptr inbounds i8*, i8** %137, i64 %128
  %139 = load i8*, i8** %138, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %140 = bitcast i8* %139 to i64*
  %141 = load i64, i64* %140, align 8
  %142 = getelementptr inbounds i8, i8* %139, i64 8
  %143 = icmp eq i64 %141, 1
  br i1 %143, label %join.byte, label %join.bulk

join.byte:
  %144 = load i8, i8* %142, align 1
  store i8 %144, i8* %134, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %134, i8* %142, i64 %141, i1 false)
  br label %join.next

join.next:
  %145 = getelementptr inbounds i8, i8* %134, i64 %141
  store i8* %145, i8** %join.p, align 8
  %146 = add i64 %128, 1
  store i64 %146, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %147 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %147, align 1
  ret i8* %125
}

define noundef nonnull align 8 i8* @nish.padStart(i8* noundef nonnull noalias readonly align 8 %text, i32 noundef %width, i8* noundef nonnull noalias readonly align 8 %fill) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.textPadding(i8* %text, i32 %width, i8* %fill)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* %text)
  ret i8* %3
}

define noundef nonnull align 8 i8* @nish.padEnd(i8* noundef nonnull noalias readonly align 8 %text, i32 noundef %width, i8* noundef nonnull noalias readonly align 8 %fill) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.textPadding(i8* %text, i32 %width, i8* %fill)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = call i8* @nish_str_concat(i8* %text, i8* %2)
  ret i8* %3
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #6 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #7 = { nounwind willreturn memory(argmem: read, inaccessiblemem: readwrite) "probe-stack"="inline-asm" }
attributes #8 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #9 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}
