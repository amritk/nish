%struct.nish_array = type { i64, i64, i8* }

declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define void @rsaSignReduce(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %t, i32 noundef %top, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %n, i32 noundef %count) #0 {
entry:
  %borrow.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %d.addr = alloca i64, align 8
  %keep.addr = alloca i32, align 4
  %take.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %0 = icmp slt i32 %count, 1
  br i1 %0, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %1 = icmp sgt i32 %count, 128
  br label %lor.end.3

lor.end.3:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.3 ]
  br i1 %2, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %5, 128
  br label %lor.end.2

lor.end.2:
  %7 = phi i1 [ true, %lor.end.3 ], [ %6, %lor.rhs.2 ]
  br i1 %7, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp slt i32 %10, 128
  br label %lor.end.1

lor.end.1:
  %12 = phi i1 [ true, %lor.end.2 ], [ %11, %lor.rhs.1 ]
  br i1 %12, label %lor.end, label %lor.rhs

lor.rhs:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %n, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %15, 128
  br label %lor.end

lor.end:
  %17 = phi i1 [ true, %lor.end.1 ], [ %16, %lor.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  ret void

if.end:
  store i64 0, i64* %borrow.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %n, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %24 = load i32, i32* %i.addr, align 4
  %25 = icmp slt i32 %24, %count
  br i1 %25, label %for.body, label %for.end

for.body:
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = bitcast i8* %19 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %27
  %30 = load i32, i32* %29, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %31 = zext i32 %30 to i64
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %21 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %33
  %36 = load i32, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %37 = zext i32 %36 to i64
  %38 = sub i64 %31, %37
  %39 = load i64, i64* %borrow.addr, align 8
  %40 = sub i64 %38, %39
  store i64 %40, i64* %d.addr, align 8
  %41 = load i32, i32* %i.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = load i64, i64* %d.addr, align 8
  %44 = trunc i64 %43 to i32
  %45 = bitcast i8* %23 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %42
  store i32 %44, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %47 = load i64, i64* %d.addr, align 8
  %48 = lshr i64 %47, 32
  %49 = and i64 %48, 1
  store i64 %49, i64* %borrow.addr, align 8
  br label %for.inc

for.inc:
  %50 = load i32, i32* %i.addr, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %52 = load i64, i64* %borrow.addr, align 8
  %53 = trunc i64 %52 to i32
  %54 = xor i32 %top, 1
  %55 = and i32 %53, %54
  store i32 %55, i32* %keep.addr, align 4
  %56 = load i32, i32* %keep.addr, align 4
  %57 = xor i32 %56, 0
  %58 = sub i32 0, %57
  %59 = or i32 %57, %58
  %60 = lshr i32 %59, 31
  %61 = sub i32 %60, 1
  %62 = call i32 asm "", "=r,0"(i32 %61) readnone nounwind
  store i32 %62, i32* %take.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %67 = load i32, i32* %i.addr.1, align 4
  %68 = icmp slt i32 %67, %count
  br i1 %68, label %for.body.1, label %for.end.1

for.body.1:
  %69 = load i32, i32* %i.addr.1, align 4
  %70 = sext i32 %69 to i64
  %71 = load i32, i32* %take.addr, align 4
  %72 = load i32, i32* %i.addr.1, align 4
  %73 = sext i32 %72 to i64
  %74 = bitcast i8* %64 to i32*
  %75 = getelementptr inbounds i32, i32* %74, i64 %73
  %76 = load i32, i32* %75, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %77 = load i32, i32* %i.addr.1, align 4
  %78 = sext i32 %77 to i64
  %79 = bitcast i8* %66 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 %78
  %81 = load i32, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %82 = call i32 asm "", "=r,0"(i32 %71) readnone nounwind
  %83 = and i32 %76, %82
  %84 = xor i32 %82, -1
  %85 = and i32 %81, %84
  %86 = or i32 %83, %85
  %87 = bitcast i8* %64 to i32*
  %88 = getelementptr inbounds i32, i32* %87, i64 %70
  store i32 %86, i32* %88, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc.1

for.inc.1:
  %89 = load i32, i32* %i.addr.1, align 4
  %90 = add nsw i32 %89, 1
  store i32 %90, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  ret void
}

define internal void @rsaSignMontMul(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %n, i32 noundef %n0inv, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %t, i32 noundef %count) #0 {
entry:
  %i.addr = alloca i32, align 4
  %live.addr = alloca i64, align 8
  %bi.addr = alloca i64, align 8
  %carry.addr = alloca i64, align 8
  %j.addr = alloca i32, align 4
  %s.addr = alloca i64, align 8
  %top.addr = alloca i64, align 8
  %m.addr = alloca i64, align 8
  %c.addr = alloca i64, align 8
  %j.addr.1 = alloca i32, align 4
  %s.addr.1 = alloca i64, align 8
  %last.addr = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp slt i32 %2, 128
  br i1 %3, label %lor.end.5, label %lor.rhs.5

lor.rhs.5:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %6, 128
  br label %lor.end.5

lor.end.5:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs.5 ]
  br i1 %8, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %9 = icmp sgt i32 %count, 128
  br label %lor.end.4

lor.end.4:
  %10 = phi i1 [ true, %lor.end.5 ], [ %9, %lor.rhs.4 ]
  br i1 %10, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %11 = icmp slt i32 %count, 1
  br label %lor.end.3

lor.end.3:
  %12 = phi i1 [ true, %lor.end.4 ], [ %11, %lor.rhs.3 ]
  br i1 %12, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = icmp slt i32 %15, 130
  br label %lor.end.2

lor.end.2:
  %17 = phi i1 [ true, %lor.end.3 ], [ %16, %lor.rhs.2 ]
  br i1 %17, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = icmp slt i32 %20, 128
  br label %lor.end.1

lor.end.1:
  %22 = phi i1 [ true, %lor.end.2 ], [ %21, %lor.rhs.1 ]
  br i1 %22, label %lor.end, label %lor.rhs

lor.rhs:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %n, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = trunc i64 %24 to i32
  %26 = icmp slt i32 %25, 128
  br label %lor.end

lor.end:
  %27 = phi i1 [ true, %lor.end.1 ], [ %26, %lor.rhs ]
  br i1 %27, label %if.then, label %if.end

if.then:
  ret void

if.end:
  store i32 0, i32* %i.addr, align 4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %n, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %36 = load i32, i32* %i.addr, align 4
  %37 = icmp slt i32 %36, %count
  br i1 %37, label %for.body, label %for.end

for.body:
  %38 = load i32, i32* %i.addr, align 4
  %39 = icmp eq i32 %38, 0
  br i1 %39, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %40 = phi i64 [ 0, %cond.true ], [ 4294967295, %cond.false ]
  store i64 %40, i64* %live.addr, align 8
  %41 = load i32, i32* %i.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = bitcast i8* %29 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 %42
  %45 = load i32, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %46 = zext i32 %45 to i64
  store i64 %46, i64* %bi.addr, align 8
  store i64 0, i64* %carry.addr, align 8
  store i32 0, i32* %j.addr, align 4
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %51 = load i32, i32* %j.addr, align 4
  %52 = icmp slt i32 %51, %count
  br i1 %52, label %for.body.1, label %for.end.1

for.body.1:
  %53 = load i32, i32* %j.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = bitcast i8* %48 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %54
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %58 = zext i32 %57 to i64
  %59 = load i64, i64* %live.addr, align 8
  %60 = and i64 %58, %59
  %61 = load i32, i32* %j.addr, align 4
  %62 = sext i32 %61 to i64
  %63 = bitcast i8* %50 to i32*
  %64 = getelementptr inbounds i32, i32* %63, i64 %62
  %65 = load i32, i32* %64, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %66 = zext i32 %65 to i64
  %67 = load i64, i64* %bi.addr, align 8
  %68 = mul i64 %66, %67
  %69 = add i64 %60, %68
  %70 = load i64, i64* %carry.addr, align 8
  %71 = add i64 %69, %70
  store i64 %71, i64* %s.addr, align 8
  %72 = load i32, i32* %j.addr, align 4
  %73 = sext i32 %72 to i64
  %74 = load i64, i64* %s.addr, align 8
  %75 = trunc i64 %74 to i32
  %76 = bitcast i8* %48 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 %73
  store i32 %75, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %78 = load i64, i64* %s.addr, align 8
  %79 = lshr i64 %78, 32
  store i64 %79, i64* %carry.addr, align 8
  br label %for.inc.1

for.inc.1:
  %80 = load i32, i32* %j.addr, align 4
  %81 = add nsw i32 %80, 1
  store i32 %81, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %82 = sext i32 %count to i64
  %83 = bitcast i8* %31 to i32*
  %84 = getelementptr inbounds i32, i32* %83, i64 %82
  %85 = load i32, i32* %84, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %86 = zext i32 %85 to i64
  %87 = load i64, i64* %live.addr, align 8
  %88 = and i64 %86, %87
  %89 = load i64, i64* %carry.addr, align 8
  %90 = add i64 %88, %89
  store i64 %90, i64* %top.addr, align 8
  %91 = sext i32 %count to i64
  %92 = load i64, i64* %top.addr, align 8
  %93 = trunc i64 %92 to i32
  %94 = bitcast i8* %31 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 %91
  store i32 %93, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %96 = add nsw i32 %count, 1
  %97 = sext i32 %96 to i64
  %98 = load i64, i64* %top.addr, align 8
  %99 = lshr i64 %98, 32
  %100 = trunc i64 %99 to i32
  %101 = bitcast i8* %31 to i32*
  %102 = getelementptr inbounds i32, i32* %101, i64 %97
  store i32 %100, i32* %102, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %103 = bitcast i8* %31 to i32*
  %104 = getelementptr inbounds i32, i32* %103, i64 0
  %105 = load i32, i32* %104, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %106 = zext i32 %105 to i64
  %107 = zext i32 %n0inv to i64
  %108 = mul i64 %106, %107
  %109 = trunc i64 %108 to i32
  %110 = zext i32 %109 to i64
  store i64 %110, i64* %m.addr, align 8
  %111 = bitcast i8* %31 to i32*
  %112 = getelementptr inbounds i32, i32* %111, i64 0
  %113 = load i32, i32* %112, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %114 = zext i32 %113 to i64
  %115 = load i64, i64* %m.addr, align 8
  %116 = bitcast i8* %35 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 0
  %118 = load i32, i32* %117, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %119 = zext i32 %118 to i64
  %120 = mul i64 %115, %119
  %121 = add i64 %114, %120
  %122 = lshr i64 %121, 32
  store i64 %122, i64* %c.addr, align 8
  store i32 1, i32* %j.addr.1, align 4
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %124 = load i8*, i8** %123, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %n, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %127 = load i32, i32* %j.addr.1, align 4
  %128 = icmp slt i32 %127, %count
  br i1 %128, label %for.body.2, label %for.end.2

for.body.2:
  %129 = load i32, i32* %j.addr.1, align 4
  %130 = sext i32 %129 to i64
  %131 = bitcast i8* %124 to i32*
  %132 = getelementptr inbounds i32, i32* %131, i64 %130
  %133 = load i32, i32* %132, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %134 = zext i32 %133 to i64
  %135 = load i64, i64* %m.addr, align 8
  %136 = load i32, i32* %j.addr.1, align 4
  %137 = sext i32 %136 to i64
  %138 = bitcast i8* %126 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 %137
  %140 = load i32, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %141 = zext i32 %140 to i64
  %142 = mul i64 %135, %141
  %143 = add i64 %134, %142
  %144 = load i64, i64* %c.addr, align 8
  %145 = add i64 %143, %144
  store i64 %145, i64* %s.addr.1, align 8
  %146 = load i32, i32* %j.addr.1, align 4
  %147 = sub nsw i32 %146, 1
  %148 = sext i32 %147 to i64
  %149 = load i64, i64* %s.addr.1, align 8
  %150 = trunc i64 %149 to i32
  %151 = bitcast i8* %124 to i32*
  %152 = getelementptr inbounds i32, i32* %151, i64 %148
  store i32 %150, i32* %152, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %153 = load i64, i64* %s.addr.1, align 8
  %154 = lshr i64 %153, 32
  store i64 %154, i64* %c.addr, align 8
  br label %for.inc.2

for.inc.2:
  %155 = load i32, i32* %j.addr.1, align 4
  %156 = add nsw i32 %155, 1
  store i32 %156, i32* %j.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %157 = sext i32 %count to i64
  %158 = bitcast i8* %31 to i32*
  %159 = getelementptr inbounds i32, i32* %158, i64 %157
  %160 = load i32, i32* %159, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %161 = zext i32 %160 to i64
  %162 = load i64, i64* %c.addr, align 8
  %163 = add i64 %161, %162
  store i64 %163, i64* %last.addr, align 8
  %164 = sub nsw i32 %count, 1
  %165 = sext i32 %164 to i64
  %166 = load i64, i64* %last.addr, align 8
  %167 = trunc i64 %166 to i32
  %168 = bitcast i8* %31 to i32*
  %169 = getelementptr inbounds i32, i32* %168, i64 %165
  store i32 %167, i32* %169, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %170 = sext i32 %count to i64
  %171 = add nsw i32 %count, 1
  %172 = sext i32 %171 to i64
  %173 = bitcast i8* %31 to i32*
  %174 = getelementptr inbounds i32, i32* %173, i64 %172
  %175 = load i32, i32* %174, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %176 = load i64, i64* %last.addr, align 8
  %177 = lshr i64 %176, 32
  %178 = trunc i64 %177 to i32
  %179 = add i32 %175, %178
  %180 = bitcast i8* %31 to i32*
  %181 = getelementptr inbounds i32, i32* %180, i64 %170
  store i32 %179, i32* %181, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %182 = load i32, i32* %i.addr, align 4
  %183 = add nsw i32 %182, 1
  store i32 %183, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %184 = sext i32 %count to i64
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %t, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %187 = bitcast i8* %186 to i32*
  %188 = getelementptr inbounds i32, i32* %187, i64 %184
  %189 = load i32, i32* %188, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  call void @rsaSignReduce(%struct.nish_array* %out, %struct.nish_array* %t, i32 %189, %struct.nish_array* %n, i32 %count)
  ret void
}

define internal void @rsaSignWindowStep(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %acc, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %sel, i32 noundef %nibble, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %n, i32 noundef %n0inv, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %t, i32 noundef %count) #1 {
entry:
  %s.addr = alloca i32, align 4
  %l.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %mask.addr = alloca i32, align 4
  %l.addr.1 = alloca i32, align 4
  %0 = icmp slt i32 %count, 1
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp sgt i32 %count, 128
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = mul nsw i32 16, %count
  %7 = icmp slt i32 %5, %6
  br label %lor.end.1

lor.end.1:
  %8 = phi i1 [ true, %lor.end.2 ], [ %7, %lor.rhs.1 ]
  br i1 %8, label %lor.end, label %lor.rhs

lor.rhs:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sel, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = icmp slt i32 %11, 128
  br label %lor.end

lor.end:
  %13 = phi i1 [ true, %lor.end.1 ], [ %12, %lor.rhs ]
  br i1 %13, label %if.then, label %if.end

if.then:
  ret void

if.end:
  store i32 0, i32* %s.addr, align 4
  br label %for.cond

for.cond:
  %14 = load i32, i32* %s.addr, align 4
  %15 = icmp slt i32 %14, 4
  br i1 %15, label %for.body, label %for.end

for.body:
  call void @rsaSignMontMul(%struct.nish_array* %acc, %struct.nish_array* %acc, %struct.nish_array* %acc, %struct.nish_array* %n, i32 %n0inv, %struct.nish_array* %t, i32 %count)
  br label %for.inc

for.inc:
  %16 = load i32, i32* %s.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %s.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %l.addr, align 4
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sel, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %20 = load i32, i32* %l.addr, align 4
  %21 = icmp slt i32 %20, %count
  br i1 %21, label %for.body.1, label %for.end.1

for.body.1:
  %22 = load i32, i32* %l.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %19 to i32*
  %25 = getelementptr inbounds i32, i32* %24, i64 %23
  store i32 0, i32* %25, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc.1

for.inc.1:
  %26 = load i32, i32* %l.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %l.addr, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %j.addr, align 4
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sel, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %34 = load i32, i32* %j.addr, align 4
  %35 = icmp slt i32 %34, 16
  br i1 %35, label %for.body.2, label %for.end.2

for.body.2:
  %36 = load i32, i32* %j.addr, align 4
  %37 = xor i32 %36, %nibble
  %38 = sub i32 0, %37
  %39 = or i32 %37, %38
  %40 = lshr i32 %39, 31
  %41 = sub i32 %40, 1
  %42 = call i32 asm "", "=r,0"(i32 %41) readnone nounwind
  store i32 %42, i32* %mask.addr, align 4
  store i32 0, i32* %l.addr.1, align 4
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sel, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.3

for.cond.3:
  %49 = load i32, i32* %l.addr.1, align 4
  %50 = icmp slt i32 %49, %count
  br i1 %50, label %for.body.3, label %for.end.3

for.body.3:
  %51 = load i32, i32* %l.addr.1, align 4
  %52 = sext i32 %51 to i64
  %53 = load i32, i32* %l.addr.1, align 4
  %54 = sext i32 %53 to i64
  %55 = bitcast i8* %44 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %54
  %57 = load i32, i32* %56, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %58 = load i32, i32* %j.addr, align 4
  %59 = mul nsw i32 %58, %count
  %60 = load i32, i32* %l.addr.1, align 4
  %61 = add nsw i32 %59, %60
  %62 = sext i32 %61 to i64
  %63 = icmp ult i64 %62, %46
  br i1 %63, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %62, i64 %46)
  unreachable

bounds.ok:
  %64 = bitcast i8* %48 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %62
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %67 = load i32, i32* %mask.addr, align 4
  %68 = and i32 %66, %67
  %69 = or i32 %57, %68
  %70 = bitcast i8* %44 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 %52
  store i32 %69, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc.3

for.inc.3:
  %72 = load i32, i32* %l.addr.1, align 4
  %73 = add nsw i32 %72, 1
  store i32 %73, i32* %l.addr.1, align 4
  br label %for.cond.3

for.end.3:
  br label %for.inc.2

for.inc.2:
  %74 = load i32, i32* %j.addr, align 4
  %75 = add nsw i32 %74, 1
  store i32 %75, i32* %j.addr, align 4
  br label %for.cond.2

for.end.2:
  call void @rsaSignMontMul(%struct.nish_array* %acc, %struct.nish_array* %acc, %struct.nish_array* %sel, %struct.nish_array* %n, i32 %n0inv, %struct.nish_array* %t, i32 %count)
  ret void
}

define void @rsaSignMontMulAt(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %t, i32 noundef %count) #0 {
entry:
  call void @rsaSignMontMul(%struct.nish_array* %out, %struct.nish_array* %a, %struct.nish_array* %b, %struct.nish_array* %n, i32 1866257063, %struct.nish_array* %t, i32 %count)
  ret void
}

define void @rsaSignWindowStepAt(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %acc, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %sel, i32 noundef %nibble, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %t) #1 {
entry:
  call void @rsaSignWindowStep(%struct.nish_array* %acc, %struct.nish_array* %table, %struct.nish_array* %sel, i32 %nibble, %struct.nish_array* %n, i32 1866257063, %struct.nish_array* %t, i32 64)
  ret void
}

define void @rsaSignTableLoad(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %acc, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %table, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %sel, i32 noundef %nibble, i32 noundef %count) #1 {
entry:
  %l.addr = alloca i32, align 4
  %0 = icmp slt i32 %count, 1
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp sgt i32 %count, 128
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = mul nsw i32 16, %count
  %7 = icmp slt i32 %5, %6
  br label %lor.end.1

lor.end.1:
  %8 = phi i1 [ true, %lor.end.2 ], [ %7, %lor.rhs.1 ]
  br i1 %8, label %lor.end, label %lor.rhs

lor.rhs:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sel, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = icmp slt i32 %11, 128
  br label %lor.end

lor.end:
  %13 = phi i1 [ true, %lor.end.1 ], [ %12, %lor.rhs ]
  br i1 %13, label %if.then, label %if.end

if.then:
  ret void

if.end:
  store i32 0, i32* %l.addr, align 4
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %sel, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %table, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %20 = load i32, i32* %l.addr, align 4
  %21 = icmp slt i32 %20, %count
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = load i32, i32* %l.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %nibble, i32 %count)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  %27 = load i32, i32* %l.addr, align 4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %31 = sext i32 %29 to i64
  %32 = icmp ult i64 %31, %17
  br i1 %32, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %31, i64 %17)
  unreachable

bounds.ok:
  %33 = bitcast i8* %19 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %31
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = bitcast i8* %15 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %23
  store i32 %35, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %38 = load i32, i32* %l.addr, align 4
  %39 = add nsw i32 %38, 1
  store i32 %39, i32* %l.addr, align 4
  br label %for.cond

for.end:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!14, !15, !16, !17, !18}
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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{i32 8, !"cf-protection-branch", i32 1}
!15 = !{i32 8, !"cf-protection-return", i32 1}
!16 = !{i32 8, !"branch-target-enforcement", i32 1}
!17 = !{i32 8, !"sign-return-address", i32 1}
!18 = !{i32 4, !"probe-stack", !"inline-asm"}
