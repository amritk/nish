%struct.Cell32 = type { i32 }
%struct.Cell64 = type { i64 }
%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"after: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #3
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #3
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #3

define internal void @Cell32.constructor(%struct.Cell32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Cell64.constructor(%struct.Cell64* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i64 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %this, i32 0, i32 0
  store i64 %v, i64* %0, align 8, !tbaa !7
  ret void
}

define internal noundef i64 @max64() #1 {
entry:
  %half.addr = alloca i64, align 8
  %0 = sext i32 1 to i64
  %1 = sext i32 62 to i64
  %2 = and i64 %1, 63
  %3 = shl i64 %0, %2
  store i64 %3, i64* %half.addr, align 8
  %4 = load i64, i64* %half.addr, align 8
  %5 = sext i32 1 to i64
  %6 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %4, i64 %5)
  %7 = extractvalue { i64, i1 } %6, 0
  %8 = extractvalue { i64, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = load i64, i64* %half.addr, align 8
  %10 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %7, i64 %9)
  %11 = extractvalue { i64, i1 } %10, 0
  %12 = extractvalue { i64, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i64 %11

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @checked32(i32 noundef %op, i32 noundef %bump) #1 {
entry:
  %top.addr = alloca i32, align 4
  %bottom.addr = alloca i32, align 4
  %half.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %cell.addr = alloca %struct.Cell32*, align 8
  %Cell32.obj = alloca %struct.Cell32, align 8
  %low.addr = alloca %struct.Cell32*, align 8
  %Cell32.obj.1 = alloca %struct.Cell32, align 8
  %big.addr = alloca %struct.Cell32*, align 8
  %Cell32.obj.2 = alloca %struct.Cell32, align 8
  %i.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %s.addr = alloca i32, align 4
  %s.addr.1 = alloca i32, align 4
  %s.addr.2 = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 2147483646, i32 %bump)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %top.addr, align 4
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 -2147483647, i32 %bump)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %4, i32* %bottom.addr, align 4
  %6 = sub nsw i32 1073741824, 1
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %bump)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %8, i32* %half.addr, align 4
  %10 = load i32, i32* %top.addr, align 4
  %11 = load i32, i32* %bottom.addr, align 4
  %12 = load i32, i32* %half.addr, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %13, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %14, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %15 = bitcast [3 x i32]* %arr.data to i8*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %15, i8** %16, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %17 = bitcast i8* %15 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 0
  store i32 %10, i32* %18, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %19 = getelementptr inbounds i32, i32* %17, i64 1
  store i32 %11, i32* %19, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %20 = getelementptr inbounds i32, i32* %17, i64 2
  store i32 %12, i32* %20, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %21 = load i32, i32* %top.addr, align 4
  call void @Cell32.constructor(%struct.Cell32* %Cell32.obj, i32 %21)
  store %struct.Cell32* %Cell32.obj, %struct.Cell32** %cell.addr, align 8
  %22 = load i32, i32* %bottom.addr, align 4
  call void @Cell32.constructor(%struct.Cell32* %Cell32.obj.1, i32 %22)
  store %struct.Cell32* %Cell32.obj.1, %struct.Cell32** %low.addr, align 8
  %23 = load i32, i32* %half.addr, align 4
  call void @Cell32.constructor(%struct.Cell32* %Cell32.obj.2, i32 %23)
  store %struct.Cell32* %Cell32.obj.2, %struct.Cell32** %big.addr, align 8
  switch i32 %op, label %sw.end [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
    i32 3, label %sw.case.3
    i32 4, label %sw.case.4
    i32 5, label %sw.case.5
    i32 6, label %sw.case.6
    i32 7, label %sw.case.7
    i32 8, label %sw.case.8
    i32 9, label %sw.case.9
    i32 10, label %sw.case.10
    i32 11, label %sw.case.11
    i32 12, label %sw.case.12
    i32 13, label %sw.case.13
    i32 14, label %sw.case.14
    i32 15, label %sw.case.15
    i32 16, label %sw.case.16
    i32 17, label %sw.case.17
    i32 18, label %sw.case.18
    i32 19, label %sw.case.19
    i32 20, label %sw.case.20
    i32 21, label %sw.case.21
    i32 22, label %sw.case.22
  ]

sw.case:
  %24 = load i32, i32* %top.addr, align 4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 1)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %26

sw.case.1:
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 0
  %33 = load i32, i32* %32, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 1)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %35

sw.case.2:
  %37 = load %struct.Cell32*, %struct.Cell32** %cell.addr, align 8
  %38 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !4
  %40 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 1)
  %41 = extractvalue { i32, i1 } %40, 0
  %42 = extractvalue { i32, i1 } %40, 1
  br i1 %42, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  ret i32 %41

sw.case.3:
  %43 = load i32, i32* %bottom.addr, align 4
  %44 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %43, i32 1)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  ret i32 %45

sw.case.4:
  %47 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 1
  %52 = load i32, i32* %51, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %53 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %52, i32 1)
  %54 = extractvalue { i32, i1 } %53, 0
  %55 = extractvalue { i32, i1 } %53, 1
  br i1 %55, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  ret i32 %54

sw.case.5:
  %56 = load %struct.Cell32*, %struct.Cell32** %low.addr, align 8
  %57 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %56, i32 0, i32 0
  %58 = load i32, i32* %57, align 4, !tbaa !4
  %59 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %58, i32 1)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  ret i32 %60

sw.case.6:
  %62 = load i32, i32* %half.addr, align 4
  %63 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %62, i32 2)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  ret i32 %64

sw.case.7:
  %66 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %69 = bitcast i8* %68 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 2
  %71 = load i32, i32* %70, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %72 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %71, i32 2)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  ret i32 %73

sw.case.8:
  %75 = load %struct.Cell32*, %struct.Cell32** %big.addr, align 8
  %76 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %75, i32 0, i32 0
  %77 = load i32, i32* %76, align 4, !tbaa !4
  %78 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %77, i32 2)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  ret i32 %79

sw.case.9:
  %81 = load i32, i32* %bottom.addr, align 4
  %82 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %81)
  %83 = extractvalue { i32, i1 } %82, 0
  %84 = extractvalue { i32, i1 } %82, 1
  br i1 %84, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  %85 = sub nsw i32 %83, 1
  ret i32 %85

sw.case.10:
  %86 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %86, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %89 = bitcast i8* %88 to i32*
  %90 = getelementptr inbounds i32, i32* %89, i64 1
  %91 = load i32, i32* %90, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %92 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %91)
  %93 = extractvalue { i32, i1 } %92, 0
  %94 = extractvalue { i32, i1 } %92, 1
  br i1 %94, label %ovf.fail, label %ovf.ok.13

ovf.ok.13:
  %95 = sub nsw i32 %93, 1
  ret i32 %95

sw.case.11:
  %96 = load %struct.Cell32*, %struct.Cell32** %low.addr, align 8
  %97 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %96, i32 0, i32 0
  %98 = load i32, i32* %97, align 4, !tbaa !4
  %99 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 0, i32 %98)
  %100 = extractvalue { i32, i1 } %99, 0
  %101 = extractvalue { i32, i1 } %99, 1
  br i1 %101, label %ovf.fail, label %ovf.ok.14

ovf.ok.14:
  %102 = sub nsw i32 %100, 1
  ret i32 %102

sw.case.12:
  %103 = load i32, i32* %top.addr, align 4
  store i32 %103, i32* %i.addr, align 4
  %104 = load i32, i32* %i.addr, align 4
  %105 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %104, i32 1)
  %106 = extractvalue { i32, i1 } %105, 0
  %107 = extractvalue { i32, i1 } %105, 1
  br i1 %107, label %ovf.fail, label %ovf.ok.15

ovf.ok.15:
  store i32 %106, i32* %i.addr, align 4
  %108 = load i32, i32* %i.addr, align 4
  ret i32 %108

sw.case.13:
  %109 = load i32, i32* %bottom.addr, align 4
  store i32 %109, i32* %i.addr.1, align 4
  %110 = load i32, i32* %i.addr.1, align 4
  %111 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %110, i32 1)
  %112 = extractvalue { i32, i1 } %111, 0
  %113 = extractvalue { i32, i1 } %111, 1
  br i1 %113, label %ovf.fail, label %ovf.ok.16

ovf.ok.16:
  store i32 %112, i32* %i.addr.1, align 4
  %114 = load i32, i32* %i.addr.1, align 4
  ret i32 %114

sw.case.14:
  %115 = load i32, i32* %top.addr, align 4
  store i32 %115, i32* %s.addr, align 4
  %116 = load i32, i32* %s.addr, align 4
  %117 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %116, i32 1)
  %118 = extractvalue { i32, i1 } %117, 0
  %119 = extractvalue { i32, i1 } %117, 1
  br i1 %119, label %ovf.fail, label %ovf.ok.17

ovf.ok.17:
  store i32 %118, i32* %s.addr, align 4
  %120 = load i32, i32* %s.addr, align 4
  ret i32 %120

sw.case.15:
  %121 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %124 = bitcast i8* %123 to i32*
  %125 = getelementptr inbounds i32, i32* %124, i64 0
  %126 = load i32, i32* %125, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %127 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %126, i32 1)
  %128 = extractvalue { i32, i1 } %127, 0
  %129 = extractvalue { i32, i1 } %127, 1
  br i1 %129, label %ovf.fail, label %ovf.ok.18

ovf.ok.18:
  store i32 %128, i32* %125, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %130 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 2
  %132 = load i8*, i8** %131, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %133 = bitcast i8* %132 to i32*
  %134 = getelementptr inbounds i32, i32* %133, i64 0
  %135 = load i32, i32* %134, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  ret i32 %135

sw.case.16:
  %136 = load %struct.Cell32*, %struct.Cell32** %cell.addr, align 8
  %137 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %136, i32 0, i32 0
  %138 = load i32, i32* %137, align 4
  %139 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %138, i32 1)
  %140 = extractvalue { i32, i1 } %139, 0
  %141 = extractvalue { i32, i1 } %139, 1
  br i1 %141, label %ovf.fail, label %ovf.ok.19

ovf.ok.19:
  store i32 %140, i32* %137, align 4
  %142 = load %struct.Cell32*, %struct.Cell32** %cell.addr, align 8
  %143 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %142, i32 0, i32 0
  %144 = load i32, i32* %143, align 4, !tbaa !4
  ret i32 %144

sw.case.17:
  %145 = load i32, i32* %bottom.addr, align 4
  store i32 %145, i32* %s.addr.1, align 4
  %146 = load i32, i32* %s.addr.1, align 4
  %147 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %146, i32 1)
  %148 = extractvalue { i32, i1 } %147, 0
  %149 = extractvalue { i32, i1 } %147, 1
  br i1 %149, label %ovf.fail, label %ovf.ok.20

ovf.ok.20:
  store i32 %148, i32* %s.addr.1, align 4
  %150 = load i32, i32* %s.addr.1, align 4
  ret i32 %150

sw.case.18:
  %151 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 2
  %153 = load i8*, i8** %152, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %154 = bitcast i8* %153 to i32*
  %155 = getelementptr inbounds i32, i32* %154, i64 1
  %156 = load i32, i32* %155, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %157 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %156, i32 1)
  %158 = extractvalue { i32, i1 } %157, 0
  %159 = extractvalue { i32, i1 } %157, 1
  br i1 %159, label %ovf.fail, label %ovf.ok.21

ovf.ok.21:
  store i32 %158, i32* %155, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %160 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %160, i64 0, i32 2
  %162 = load i8*, i8** %161, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %163 = bitcast i8* %162 to i32*
  %164 = getelementptr inbounds i32, i32* %163, i64 1
  %165 = load i32, i32* %164, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  ret i32 %165

sw.case.19:
  %166 = load %struct.Cell32*, %struct.Cell32** %low.addr, align 8
  %167 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %166, i32 0, i32 0
  %168 = load i32, i32* %167, align 4
  %169 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %168, i32 1)
  %170 = extractvalue { i32, i1 } %169, 0
  %171 = extractvalue { i32, i1 } %169, 1
  br i1 %171, label %ovf.fail, label %ovf.ok.22

ovf.ok.22:
  store i32 %170, i32* %167, align 4
  %172 = load %struct.Cell32*, %struct.Cell32** %low.addr, align 8
  %173 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %172, i32 0, i32 0
  %174 = load i32, i32* %173, align 4, !tbaa !4
  ret i32 %174

sw.case.20:
  %175 = load i32, i32* %half.addr, align 4
  store i32 %175, i32* %s.addr.2, align 4
  %176 = load i32, i32* %s.addr.2, align 4
  %177 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %176, i32 2)
  %178 = extractvalue { i32, i1 } %177, 0
  %179 = extractvalue { i32, i1 } %177, 1
  br i1 %179, label %ovf.fail, label %ovf.ok.23

ovf.ok.23:
  store i32 %178, i32* %s.addr.2, align 4
  %180 = load i32, i32* %s.addr.2, align 4
  ret i32 %180

sw.case.21:
  %181 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %181, i64 0, i32 2
  %183 = load i8*, i8** %182, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %184 = bitcast i8* %183 to i32*
  %185 = getelementptr inbounds i32, i32* %184, i64 2
  %186 = load i32, i32* %185, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %187 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %186, i32 2)
  %188 = extractvalue { i32, i1 } %187, 0
  %189 = extractvalue { i32, i1 } %187, 1
  br i1 %189, label %ovf.fail, label %ovf.ok.24

ovf.ok.24:
  store i32 %188, i32* %185, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  %190 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 2
  %192 = load i8*, i8** %191, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %193 = bitcast i8* %192 to i32*
  %194 = getelementptr inbounds i32, i32* %193, i64 2
  %195 = load i32, i32* %194, align 4, !alias.scope !12, !noalias !11, !tbaa !20
  ret i32 %195

sw.case.22:
  %196 = load %struct.Cell32*, %struct.Cell32** %big.addr, align 8
  %197 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %196, i32 0, i32 0
  %198 = load i32, i32* %197, align 4
  %199 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %198, i32 2)
  %200 = extractvalue { i32, i1 } %199, 0
  %201 = extractvalue { i32, i1 } %199, 1
  br i1 %201, label %ovf.fail, label %ovf.ok.25

ovf.ok.25:
  store i32 %200, i32* %197, align 4
  %202 = load %struct.Cell32*, %struct.Cell32** %big.addr, align 8
  %203 = getelementptr inbounds %struct.Cell32, %struct.Cell32* %202, i32 0, i32 0
  %204 = load i32, i32* %203, align 4, !tbaa !4
  ret i32 %204

sw.end:
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 1, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %sw.case ], [ 0, %sw.case.1 ], [ 0, %sw.case.2 ], [ 1, %sw.case.3 ], [ 1, %sw.case.4 ], [ 1, %sw.case.5 ], [ 2, %sw.case.6 ], [ 2, %sw.case.7 ], [ 2, %sw.case.8 ], [ 3, %sw.case.9 ], [ 3, %sw.case.10 ], [ 3, %sw.case.11 ], [ 0, %sw.case.12 ], [ 1, %sw.case.13 ], [ 0, %sw.case.14 ], [ 0, %sw.case.15 ], [ 0, %sw.case.16 ], [ 1, %sw.case.17 ], [ 1, %sw.case.18 ], [ 1, %sw.case.19 ], [ 2, %sw.case.20 ], [ 2, %sw.case.21 ], [ 2, %sw.case.22 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i64 @checked64(i32 noundef %op, i32 noundef %bump) #1 {
entry:
  %b.addr = alloca i64, align 8
  %top.addr = alloca i64, align 8
  %bottom.addr = alloca i64, align 8
  %half.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i64], align 8
  %cell.addr = alloca %struct.Cell64*, align 8
  %Cell64.obj = alloca %struct.Cell64, align 8
  %low.addr = alloca %struct.Cell64*, align 8
  %Cell64.obj.1 = alloca %struct.Cell64, align 8
  %big.addr = alloca %struct.Cell64*, align 8
  %Cell64.obj.2 = alloca %struct.Cell64, align 8
  %one.addr = alloca i64, align 8
  %two.addr = alloca i64, align 8
  %i.addr = alloca i64, align 8
  %i.addr.1 = alloca i64, align 8
  %s.addr = alloca i64, align 8
  %s.addr.1 = alloca i64, align 8
  %s.addr.2 = alloca i64, align 8
  %0 = sext i32 %bump to i64
  store i64 %0, i64* %b.addr, align 8
  %1 = call i64 @max64()
  %2 = sext i32 1 to i64
  %3 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %1, i64 %2)
  %4 = extractvalue { i64, i1 } %3, 0
  %5 = extractvalue { i64, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = load i64, i64* %b.addr, align 8
  %7 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %4, i64 %6)
  %8 = extractvalue { i64, i1 } %7, 0
  %9 = extractvalue { i64, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i64 %8, i64* %top.addr, align 8
  %10 = call i64 @max64()
  %11 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %10)
  %12 = extractvalue { i64, i1 } %11, 0
  %13 = extractvalue { i64, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %14 = load i64, i64* %b.addr, align 8
  %15 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %12, i64 %14)
  %16 = extractvalue { i64, i1 } %15, 0
  %17 = extractvalue { i64, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i64 %16, i64* %bottom.addr, align 8
  %18 = sext i32 1 to i64
  %19 = sext i32 62 to i64
  %20 = and i64 %19, 63
  %21 = shl i64 %18, %20
  %22 = sext i32 1 to i64
  %23 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %21, i64 %22)
  %24 = extractvalue { i64, i1 } %23, 0
  %25 = extractvalue { i64, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %26 = load i64, i64* %b.addr, align 8
  %27 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %24, i64 %26)
  %28 = extractvalue { i64, i1 } %27, 0
  %29 = extractvalue { i64, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i64 %28, i64* %half.addr, align 8
  %30 = load i64, i64* %top.addr, align 8
  %31 = load i64, i64* %bottom.addr, align 8
  %32 = load i64, i64* %half.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %33, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %34, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %35 = bitcast [3 x i64]* %arr.data to i8*
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %35, i8** %36, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %37 = bitcast i8* %35 to i64*
  %38 = getelementptr inbounds i64, i64* %37, i64 0
  store i64 %30, i64* %38, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %39 = getelementptr inbounds i64, i64* %37, i64 1
  store i64 %31, i64* %39, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %40 = getelementptr inbounds i64, i64* %37, i64 2
  store i64 %32, i64* %40, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %41 = load i64, i64* %top.addr, align 8
  call void @Cell64.constructor(%struct.Cell64* %Cell64.obj, i64 %41)
  store %struct.Cell64* %Cell64.obj, %struct.Cell64** %cell.addr, align 8
  %42 = load i64, i64* %bottom.addr, align 8
  call void @Cell64.constructor(%struct.Cell64* %Cell64.obj.1, i64 %42)
  store %struct.Cell64* %Cell64.obj.1, %struct.Cell64** %low.addr, align 8
  %43 = load i64, i64* %half.addr, align 8
  call void @Cell64.constructor(%struct.Cell64* %Cell64.obj.2, i64 %43)
  store %struct.Cell64* %Cell64.obj.2, %struct.Cell64** %big.addr, align 8
  store i64 1, i64* %one.addr, align 8
  store i64 2, i64* %two.addr, align 8
  switch i32 %op, label %sw.end [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
    i32 2, label %sw.case.2
    i32 3, label %sw.case.3
    i32 4, label %sw.case.4
    i32 5, label %sw.case.5
    i32 6, label %sw.case.6
    i32 7, label %sw.case.7
    i32 8, label %sw.case.8
    i32 9, label %sw.case.9
    i32 10, label %sw.case.10
    i32 11, label %sw.case.11
    i32 12, label %sw.case.12
    i32 13, label %sw.case.13
    i32 14, label %sw.case.14
    i32 15, label %sw.case.15
    i32 16, label %sw.case.16
    i32 17, label %sw.case.17
    i32 18, label %sw.case.18
    i32 19, label %sw.case.19
    i32 20, label %sw.case.20
    i32 21, label %sw.case.21
    i32 22, label %sw.case.22
  ]

sw.case:
  %44 = load i64, i64* %top.addr, align 8
  %45 = load i64, i64* %one.addr, align 8
  %46 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %44, i64 %45)
  %47 = extractvalue { i64, i1 } %46, 0
  %48 = extractvalue { i64, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  ret i64 %47

sw.case.1:
  %49 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %52 = bitcast i8* %51 to i64*
  %53 = getelementptr inbounds i64, i64* %52, i64 0
  %54 = load i64, i64* %53, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %55 = load i64, i64* %one.addr, align 8
  %56 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %54, i64 %55)
  %57 = extractvalue { i64, i1 } %56, 0
  %58 = extractvalue { i64, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  ret i64 %57

sw.case.2:
  %59 = load %struct.Cell64*, %struct.Cell64** %cell.addr, align 8
  %60 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %59, i32 0, i32 0
  %61 = load i64, i64* %60, align 8, !tbaa !7
  %62 = load i64, i64* %one.addr, align 8
  %63 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %61, i64 %62)
  %64 = extractvalue { i64, i1 } %63, 0
  %65 = extractvalue { i64, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  ret i64 %64

sw.case.3:
  %66 = load i64, i64* %bottom.addr, align 8
  %67 = load i64, i64* %one.addr, align 8
  %68 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %66, i64 %67)
  %69 = extractvalue { i64, i1 } %68, 0
  %70 = extractvalue { i64, i1 } %68, 1
  br i1 %70, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  ret i64 %69

sw.case.4:
  %71 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %74 = bitcast i8* %73 to i64*
  %75 = getelementptr inbounds i64, i64* %74, i64 1
  %76 = load i64, i64* %75, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %77 = load i64, i64* %one.addr, align 8
  %78 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %76, i64 %77)
  %79 = extractvalue { i64, i1 } %78, 0
  %80 = extractvalue { i64, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  ret i64 %79

sw.case.5:
  %81 = load %struct.Cell64*, %struct.Cell64** %low.addr, align 8
  %82 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %81, i32 0, i32 0
  %83 = load i64, i64* %82, align 8, !tbaa !7
  %84 = load i64, i64* %one.addr, align 8
  %85 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %83, i64 %84)
  %86 = extractvalue { i64, i1 } %85, 0
  %87 = extractvalue { i64, i1 } %85, 1
  br i1 %87, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  ret i64 %86

sw.case.6:
  %88 = load i64, i64* %half.addr, align 8
  %89 = load i64, i64* %two.addr, align 8
  %90 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %88, i64 %89)
  %91 = extractvalue { i64, i1 } %90, 0
  %92 = extractvalue { i64, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  ret i64 %91

sw.case.7:
  %93 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %96 = bitcast i8* %95 to i64*
  %97 = getelementptr inbounds i64, i64* %96, i64 2
  %98 = load i64, i64* %97, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %99 = load i64, i64* %two.addr, align 8
  %100 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %98, i64 %99)
  %101 = extractvalue { i64, i1 } %100, 0
  %102 = extractvalue { i64, i1 } %100, 1
  br i1 %102, label %ovf.fail, label %ovf.ok.13

ovf.ok.13:
  ret i64 %101

sw.case.8:
  %103 = load %struct.Cell64*, %struct.Cell64** %big.addr, align 8
  %104 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %103, i32 0, i32 0
  %105 = load i64, i64* %104, align 8, !tbaa !7
  %106 = load i64, i64* %two.addr, align 8
  %107 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %105, i64 %106)
  %108 = extractvalue { i64, i1 } %107, 0
  %109 = extractvalue { i64, i1 } %107, 1
  br i1 %109, label %ovf.fail, label %ovf.ok.14

ovf.ok.14:
  ret i64 %108

sw.case.9:
  %110 = load i64, i64* %bottom.addr, align 8
  %111 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %110)
  %112 = extractvalue { i64, i1 } %111, 0
  %113 = extractvalue { i64, i1 } %111, 1
  br i1 %113, label %ovf.fail, label %ovf.ok.15

ovf.ok.15:
  %114 = load i64, i64* %one.addr, align 8
  %115 = sub nsw i64 %112, %114
  ret i64 %115

sw.case.10:
  %116 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 2
  %118 = load i8*, i8** %117, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %119 = bitcast i8* %118 to i64*
  %120 = getelementptr inbounds i64, i64* %119, i64 1
  %121 = load i64, i64* %120, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %122 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %121)
  %123 = extractvalue { i64, i1 } %122, 0
  %124 = extractvalue { i64, i1 } %122, 1
  br i1 %124, label %ovf.fail, label %ovf.ok.16

ovf.ok.16:
  %125 = load i64, i64* %one.addr, align 8
  %126 = sub nsw i64 %123, %125
  ret i64 %126

sw.case.11:
  %127 = load %struct.Cell64*, %struct.Cell64** %low.addr, align 8
  %128 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %127, i32 0, i32 0
  %129 = load i64, i64* %128, align 8, !tbaa !7
  %130 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %129)
  %131 = extractvalue { i64, i1 } %130, 0
  %132 = extractvalue { i64, i1 } %130, 1
  br i1 %132, label %ovf.fail, label %ovf.ok.17

ovf.ok.17:
  %133 = load i64, i64* %one.addr, align 8
  %134 = sub nsw i64 %131, %133
  ret i64 %134

sw.case.12:
  %135 = load i64, i64* %top.addr, align 8
  store i64 %135, i64* %i.addr, align 8
  %136 = load i64, i64* %i.addr, align 8
  %137 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %136, i64 1)
  %138 = extractvalue { i64, i1 } %137, 0
  %139 = extractvalue { i64, i1 } %137, 1
  br i1 %139, label %ovf.fail, label %ovf.ok.18

ovf.ok.18:
  store i64 %138, i64* %i.addr, align 8
  %140 = load i64, i64* %i.addr, align 8
  ret i64 %140

sw.case.13:
  %141 = load i64, i64* %bottom.addr, align 8
  store i64 %141, i64* %i.addr.1, align 8
  %142 = load i64, i64* %i.addr.1, align 8
  %143 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %142, i64 1)
  %144 = extractvalue { i64, i1 } %143, 0
  %145 = extractvalue { i64, i1 } %143, 1
  br i1 %145, label %ovf.fail, label %ovf.ok.19

ovf.ok.19:
  store i64 %144, i64* %i.addr.1, align 8
  %146 = load i64, i64* %i.addr.1, align 8
  ret i64 %146

sw.case.14:
  %147 = load i64, i64* %top.addr, align 8
  store i64 %147, i64* %s.addr, align 8
  %148 = load i64, i64* %s.addr, align 8
  %149 = load i64, i64* %one.addr, align 8
  %150 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %148, i64 %149)
  %151 = extractvalue { i64, i1 } %150, 0
  %152 = extractvalue { i64, i1 } %150, 1
  br i1 %152, label %ovf.fail, label %ovf.ok.20

ovf.ok.20:
  store i64 %151, i64* %s.addr, align 8
  %153 = load i64, i64* %s.addr, align 8
  ret i64 %153

sw.case.15:
  %154 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %157 = bitcast i8* %156 to i64*
  %158 = getelementptr inbounds i64, i64* %157, i64 0
  %159 = load i64, i64* %158, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %160 = load i64, i64* %one.addr, align 8
  %161 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %159, i64 %160)
  %162 = extractvalue { i64, i1 } %161, 0
  %163 = extractvalue { i64, i1 } %161, 1
  br i1 %163, label %ovf.fail, label %ovf.ok.21

ovf.ok.21:
  store i64 %162, i64* %158, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %164 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 2
  %166 = load i8*, i8** %165, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %167 = bitcast i8* %166 to i64*
  %168 = getelementptr inbounds i64, i64* %167, i64 0
  %169 = load i64, i64* %168, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  ret i64 %169

sw.case.16:
  %170 = load %struct.Cell64*, %struct.Cell64** %cell.addr, align 8
  %171 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %170, i32 0, i32 0
  %172 = load i64, i64* %171, align 8
  %173 = load i64, i64* %one.addr, align 8
  %174 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %172, i64 %173)
  %175 = extractvalue { i64, i1 } %174, 0
  %176 = extractvalue { i64, i1 } %174, 1
  br i1 %176, label %ovf.fail, label %ovf.ok.22

ovf.ok.22:
  store i64 %175, i64* %171, align 8
  %177 = load %struct.Cell64*, %struct.Cell64** %cell.addr, align 8
  %178 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %177, i32 0, i32 0
  %179 = load i64, i64* %178, align 8, !tbaa !7
  ret i64 %179

sw.case.17:
  %180 = load i64, i64* %bottom.addr, align 8
  store i64 %180, i64* %s.addr.1, align 8
  %181 = load i64, i64* %s.addr.1, align 8
  %182 = load i64, i64* %one.addr, align 8
  %183 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %181, i64 %182)
  %184 = extractvalue { i64, i1 } %183, 0
  %185 = extractvalue { i64, i1 } %183, 1
  br i1 %185, label %ovf.fail, label %ovf.ok.23

ovf.ok.23:
  store i64 %184, i64* %s.addr.1, align 8
  %186 = load i64, i64* %s.addr.1, align 8
  ret i64 %186

sw.case.18:
  %187 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %188 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %187, i64 0, i32 2
  %189 = load i8*, i8** %188, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %190 = bitcast i8* %189 to i64*
  %191 = getelementptr inbounds i64, i64* %190, i64 1
  %192 = load i64, i64* %191, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %193 = load i64, i64* %one.addr, align 8
  %194 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %192, i64 %193)
  %195 = extractvalue { i64, i1 } %194, 0
  %196 = extractvalue { i64, i1 } %194, 1
  br i1 %196, label %ovf.fail, label %ovf.ok.24

ovf.ok.24:
  store i64 %195, i64* %191, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %197 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %197, i64 0, i32 2
  %199 = load i8*, i8** %198, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %200 = bitcast i8* %199 to i64*
  %201 = getelementptr inbounds i64, i64* %200, i64 1
  %202 = load i64, i64* %201, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  ret i64 %202

sw.case.19:
  %203 = load %struct.Cell64*, %struct.Cell64** %low.addr, align 8
  %204 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %203, i32 0, i32 0
  %205 = load i64, i64* %204, align 8
  %206 = load i64, i64* %one.addr, align 8
  %207 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %205, i64 %206)
  %208 = extractvalue { i64, i1 } %207, 0
  %209 = extractvalue { i64, i1 } %207, 1
  br i1 %209, label %ovf.fail, label %ovf.ok.25

ovf.ok.25:
  store i64 %208, i64* %204, align 8
  %210 = load %struct.Cell64*, %struct.Cell64** %low.addr, align 8
  %211 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %210, i32 0, i32 0
  %212 = load i64, i64* %211, align 8, !tbaa !7
  ret i64 %212

sw.case.20:
  %213 = load i64, i64* %half.addr, align 8
  store i64 %213, i64* %s.addr.2, align 8
  %214 = load i64, i64* %s.addr.2, align 8
  %215 = load i64, i64* %two.addr, align 8
  %216 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %214, i64 %215)
  %217 = extractvalue { i64, i1 } %216, 0
  %218 = extractvalue { i64, i1 } %216, 1
  br i1 %218, label %ovf.fail, label %ovf.ok.26

ovf.ok.26:
  store i64 %217, i64* %s.addr.2, align 8
  %219 = load i64, i64* %s.addr.2, align 8
  ret i64 %219

sw.case.21:
  %220 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %221 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %220, i64 0, i32 2
  %222 = load i8*, i8** %221, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %223 = bitcast i8* %222 to i64*
  %224 = getelementptr inbounds i64, i64* %223, i64 2
  %225 = load i64, i64* %224, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %226 = load i64, i64* %two.addr, align 8
  %227 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %225, i64 %226)
  %228 = extractvalue { i64, i1 } %227, 0
  %229 = extractvalue { i64, i1 } %227, 1
  br i1 %229, label %ovf.fail, label %ovf.ok.27

ovf.ok.27:
  store i64 %228, i64* %224, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  %230 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %230, i64 0, i32 2
  %232 = load i8*, i8** %231, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %233 = bitcast i8* %232 to i64*
  %234 = getelementptr inbounds i64, i64* %233, i64 2
  %235 = load i64, i64* %234, align 8, !alias.scope !12, !noalias !11, !tbaa !22
  ret i64 %235

sw.case.22:
  %236 = load %struct.Cell64*, %struct.Cell64** %big.addr, align 8
  %237 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %236, i32 0, i32 0
  %238 = load i64, i64* %237, align 8
  %239 = load i64, i64* %two.addr, align 8
  %240 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %238, i64 %239)
  %241 = extractvalue { i64, i1 } %240, 0
  %242 = extractvalue { i64, i1 } %240, 1
  br i1 %242, label %ovf.fail, label %ovf.ok.28

ovf.ok.28:
  store i64 %241, i64* %237, align 8
  %243 = load %struct.Cell64*, %struct.Cell64** %big.addr, align 8
  %244 = getelementptr inbounds %struct.Cell64, %struct.Cell64* %243, i32 0, i32 0
  %245 = load i64, i64* %244, align 8, !tbaa !7
  ret i64 %245

sw.end:
  %246 = sext i32 0 to i64
  ret i64 %246

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 0, %ovf.ok ], [ 3, %ovf.ok.1 ], [ 1, %ovf.ok.2 ], [ 1, %ovf.ok.3 ], [ 0, %ovf.ok.4 ], [ 0, %sw.case ], [ 0, %sw.case.1 ], [ 0, %sw.case.2 ], [ 1, %sw.case.3 ], [ 1, %sw.case.4 ], [ 1, %sw.case.5 ], [ 2, %sw.case.6 ], [ 2, %sw.case.7 ], [ 2, %sw.case.8 ], [ 3, %sw.case.9 ], [ 3, %sw.case.10 ], [ 3, %sw.case.11 ], [ 0, %sw.case.12 ], [ 1, %sw.case.13 ], [ 0, %sw.case.14 ], [ 0, %sw.case.15 ], [ 0, %sw.case.16 ], [ 1, %sw.case.17 ], [ 1, %sw.case.18 ], [ 1, %sw.case.19 ], [ 2, %sw.case.20 ], [ 2, %sw.case.21 ], [ 2, %sw.case.22 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %pick.addr = alloca i32, align 4
  %sum32.addr = alloca i32, align 4
  %sum64.addr = alloca i64, align 8
  %op.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !12, !noalias !11, !tbaa !24
  %14 = call double @nish_parse_number(i8* %13, i32 2)
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %16 = phi i32 [ %15, %bounds.ok ], [ -1, %cond.false ]
  store i32 %16, i32* %pick.addr, align 4
  store i32 0, i32* %sum32.addr, align 4
  store i64 0, i64* %sum64.addr, align 8
  store i32 0, i32* %op.addr, align 4
  br label %for.cond

for.cond:
  %17 = load i32, i32* %op.addr, align 4
  %18 = icmp slt i32 %17, 23
  br i1 %18, label %for.body, label %for.end

for.body:
  %19 = load i32, i32* %sum32.addr, align 4
  %20 = load i32, i32* %op.addr, align 4
  %21 = load i32, i32* %op.addr, align 4
  %22 = load i32, i32* %pick.addr, align 4
  %23 = icmp eq i32 %21, %22
  br i1 %23, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %24 = phi i32 [ 1, %cond.true.1 ], [ 0, %cond.false.1 ]
  %25 = call i32 @checked32(i32 %20, i32 %24)
  %26 = xor i32 %19, %25
  store i32 %26, i32* %sum32.addr, align 4
  %27 = load i64, i64* %sum64.addr, align 8
  %28 = load i32, i32* %op.addr, align 4
  %29 = load i32, i32* %op.addr, align 4
  %30 = add nsw i32 %29, 23
  %31 = load i32, i32* %pick.addr, align 4
  %32 = icmp eq i32 %30, %31
  br i1 %32, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %33 = phi i32 [ 1, %cond.true.2 ], [ 0, %cond.false.2 ]
  %34 = call i64 @checked64(i32 %28, i32 %33)
  %35 = xor i64 %27, %34
  store i64 %35, i64* %sum64.addr, align 8
  br label %for.inc

for.inc:
  %36 = load i32, i32* %op.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %op.addr, align 4
  br label %for.cond

for.end:
  %38 = load i32, i32* %sum32.addr, align 4
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %42 = load i64, i64* %sum64.addr, align 8
  %43 = call i8* @nish_str_from_i64(i64 %42)
  %44 = call i8* @nish_str_concat(i8* %41, i8* %43)
  call void @nish_print(i8* %44)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Cell32", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"i64", !1, i64 0}
!6 = !{!"Cell64", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 8}
!18 = !{!15, !14, i64 16}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"element i64", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"element ptr", !1, i64 0}
!24 = !{!23, !23, i64 0}
