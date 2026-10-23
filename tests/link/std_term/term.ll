%struct.Screen = type { %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32, i32, i32, i1 }
%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.KeyEvent = type { i32, i32 }
%struct.KeyDecoder = type { double, %struct.nish_array*, double }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\E2\96\80\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?1049h\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?1049l\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"\1B[?25l\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"\1B[?25h\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"\1B[H\1B[2J\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"\1B[0m\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"\1B[\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c";\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"H\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [51 x i8] } { i64 50, [51 x i8] c"nish/term: a byte count past the end of its buffer\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [51 x i8] } { i64 50, [51 x i8] c"nish/term: a Screen's buffers disagree on its size\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [61 x i8] } { i64 60, [61 x i8] c"nish/term: the key decoder used more bytes than it was given\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"nish/term: the key decoder stepped back\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare noundef i64 @nish_arena_mark() #3
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #3
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #5
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #5
declare void @nish_panic_div(i1 noundef zeroext) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i64 @llvm.smax.i64(i64, i64) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

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

define internal noundef zeroext i1 @nish.termNativeStrings() #0 {
entry:
  %0 = bitcast i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 3
  ret i1 %3
}

define internal noundef i32 @nish.termClamp(i32 noundef %v, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %0 = icmp slt i32 %v, %lo
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 %lo

if.end:
  %1 = icmp sgt i32 %v, %hi
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ %hi, %cond.true ], [ %v, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @nish.termLeadWidth(i32 noundef %c) #1 {
entry:
  %0 = icmp sge i32 %c, 240
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 4

if.end:
  %1 = icmp sge i32 %c, 224
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 3

if.end.1:
  %2 = icmp sge i32 %c, 192
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ 2, %cond.true ], [ 1, %cond.false ]
  ret i32 %3
}

define internal noundef i32 @nish.termLeadBits(i32 noundef %c, i32 noundef %width) #1 {
entry:
  %0 = icmp eq i32 %width, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = and i32 %c, 31
  ret i32 %1

if.end:
  %2 = icmp eq i32 %width, 3
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = and i32 %c, 15
  br label %cond.end

cond.false:
  %4 = and i32 %c, 7
  br label %cond.end

cond.end:
  %5 = phi i32 [ %3, %cond.true ], [ %4, %cond.false ]
  ret i32 %5
}

define noundef i32 @nish.rgb(i32 noundef %r, i32 noundef %g, i32 noundef %b) #1 {
entry:
  %0 = call i32 @nish.termClamp(i32 %r, i32 0, i32 255)
  %1 = shl i32 %0, 16
  %2 = call i32 @nish.termClamp(i32 %g, i32 0, i32 255)
  %3 = shl i32 %2, 8
  %4 = or i32 %1, %3
  %5 = call i32 @nish.termClamp(i32 %b, i32 0, i32 255)
  %6 = or i32 %4, %5
  ret i32 %6
}

define internal noundef i32 @nish.termCubeLevel(i32 noundef %v) #1 {
entry:
  %0 = icmp slt i32 %v, 48
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp slt i32 %v, 115
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 1

if.end.1:
  %2 = sub nsw i32 %v, 35
  %3 = sdiv i32 %2, 40
  %4 = or i32 %3, 0
  ret i32 %4
}

define internal noundef i32 @nish.termCubeValue(i32 noundef %q) #2 {
entry:
  %0 = icmp eq i32 %q, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %q, i32 40)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 55)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end

cond.end:
  %7 = phi i32 [ 0, %cond.true ], [ %5, %ovf.ok.1 ]
  ret i32 %7

ovf.fail:
  %ovf.op = phi i32 [ 2, %cond.false ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish.paletteIndex(i32 noundef %colour) #2 {
entry:
  %r.addr = alloca i32, align 4
  %g.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %qr.addr = alloca i32, align 4
  %qg.addr = alloca i32, align 4
  %qb.addr = alloca i32, align 4
  %cube.addr = alloca i32, align 4
  %dr.addr = alloca i32, align 4
  %dg.addr = alloca i32, align 4
  %db.addr = alloca i32, align 4
  %cubeDistance.addr = alloca i32, align 4
  %average.addr = alloca i32, align 4
  %step.addr = alloca i32, align 4
  %grey.addr = alloca i32, align 4
  %gr.addr = alloca i32, align 4
  %gg.addr = alloca i32, align 4
  %gb.addr = alloca i32, align 4
  %greyDistance.addr = alloca i32, align 4
  %0 = icmp slt i32 %colour, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %1 = ashr i32 %colour, 16
  %2 = and i32 %1, 255
  store i32 %2, i32* %r.addr, align 4
  %3 = ashr i32 %colour, 8
  %4 = and i32 %3, 255
  store i32 %4, i32* %g.addr, align 4
  %5 = and i32 %colour, 255
  store i32 %5, i32* %b.addr, align 4
  %6 = load i32, i32* %r.addr, align 4
  %7 = call i32 @nish.termCubeLevel(i32 %6)
  store i32 %7, i32* %qr.addr, align 4
  %8 = load i32, i32* %g.addr, align 4
  %9 = call i32 @nish.termCubeLevel(i32 %8)
  store i32 %9, i32* %qg.addr, align 4
  %10 = load i32, i32* %b.addr, align 4
  %11 = call i32 @nish.termCubeLevel(i32 %10)
  store i32 %11, i32* %qb.addr, align 4
  %12 = load i32, i32* %qr.addr, align 4
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %12, i32 36)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = load i32, i32* %qg.addr, align 4
  %17 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %16, i32 6)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %18)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %23 = load i32, i32* %qb.addr, align 4
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 16)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %28, i32* %cube.addr, align 4
  %30 = load i32, i32* %r.addr, align 4
  %31 = load i32, i32* %qr.addr, align 4
  %32 = call i32 @nish.termCubeValue(i32 %31)
  %33 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %30, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %34, i32* %dr.addr, align 4
  %36 = load i32, i32* %g.addr, align 4
  %37 = load i32, i32* %qg.addr, align 4
  %38 = call i32 @nish.termCubeValue(i32 %37)
  %39 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %36, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %40, i32* %dg.addr, align 4
  %42 = load i32, i32* %b.addr, align 4
  %43 = load i32, i32* %qb.addr, align 4
  %44 = call i32 @nish.termCubeValue(i32 %43)
  %45 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %42, i32 %44)
  %46 = extractvalue { i32, i1 } %45, 0
  %47 = extractvalue { i32, i1 } %45, 1
  br i1 %47, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %46, i32* %db.addr, align 4
  %48 = load i32, i32* %dr.addr, align 4
  %49 = load i32, i32* %dr.addr, align 4
  %50 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %48, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  %53 = load i32, i32* %dg.addr, align 4
  %54 = load i32, i32* %dg.addr, align 4
  %55 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %53, i32 %54)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.9

ovf.ok.9:
  %58 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %51, i32 %56)
  %59 = extractvalue { i32, i1 } %58, 0
  %60 = extractvalue { i32, i1 } %58, 1
  br i1 %60, label %ovf.fail, label %ovf.ok.10

ovf.ok.10:
  %61 = load i32, i32* %db.addr, align 4
  %62 = load i32, i32* %db.addr, align 4
  %63 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %61, i32 %62)
  %64 = extractvalue { i32, i1 } %63, 0
  %65 = extractvalue { i32, i1 } %63, 1
  br i1 %65, label %ovf.fail, label %ovf.ok.11

ovf.ok.11:
  %66 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %59, i32 %64)
  %67 = extractvalue { i32, i1 } %66, 0
  %68 = extractvalue { i32, i1 } %66, 1
  br i1 %68, label %ovf.fail, label %ovf.ok.12

ovf.ok.12:
  store i32 %67, i32* %cubeDistance.addr, align 4
  %69 = load i32, i32* %r.addr, align 4
  %70 = load i32, i32* %g.addr, align 4
  %71 = add nsw i32 %69, %70
  %72 = load i32, i32* %b.addr, align 4
  %73 = add nsw i32 %71, %72
  %74 = sdiv i32 %73, 3
  %75 = or i32 %74, 0
  store i32 %75, i32* %average.addr, align 4
  %76 = load i32, i32* %average.addr, align 4
  %77 = icmp sgt i32 %76, 238
  br i1 %77, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %78 = load i32, i32* %average.addr, align 4
  %79 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %78, i32 3)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok.13

ovf.ok.13:
  %82 = sdiv i32 %80, 10
  %83 = or i32 %82, 0
  %84 = call i32 @nish.termClamp(i32 %83, i32 0, i32 23)
  br label %cond.end

cond.end:
  %85 = phi i32 [ 23, %cond.true ], [ %84, %ovf.ok.13 ]
  store i32 %85, i32* %step.addr, align 4
  %86 = load i32, i32* %step.addr, align 4
  %87 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %86, i32 10)
  %88 = extractvalue { i32, i1 } %87, 0
  %89 = extractvalue { i32, i1 } %87, 1
  br i1 %89, label %ovf.fail, label %ovf.ok.14

ovf.ok.14:
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %88, i32 8)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.15

ovf.ok.15:
  store i32 %91, i32* %grey.addr, align 4
  %93 = load i32, i32* %r.addr, align 4
  %94 = load i32, i32* %grey.addr, align 4
  %95 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %93, i32 %94)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.16

ovf.ok.16:
  store i32 %96, i32* %gr.addr, align 4
  %98 = load i32, i32* %g.addr, align 4
  %99 = load i32, i32* %grey.addr, align 4
  %100 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %98, i32 %99)
  %101 = extractvalue { i32, i1 } %100, 0
  %102 = extractvalue { i32, i1 } %100, 1
  br i1 %102, label %ovf.fail, label %ovf.ok.17

ovf.ok.17:
  store i32 %101, i32* %gg.addr, align 4
  %103 = load i32, i32* %b.addr, align 4
  %104 = load i32, i32* %grey.addr, align 4
  %105 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %103, i32 %104)
  %106 = extractvalue { i32, i1 } %105, 0
  %107 = extractvalue { i32, i1 } %105, 1
  br i1 %107, label %ovf.fail, label %ovf.ok.18

ovf.ok.18:
  store i32 %106, i32* %gb.addr, align 4
  %108 = load i32, i32* %gr.addr, align 4
  %109 = load i32, i32* %gr.addr, align 4
  %110 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %108, i32 %109)
  %111 = extractvalue { i32, i1 } %110, 0
  %112 = extractvalue { i32, i1 } %110, 1
  br i1 %112, label %ovf.fail, label %ovf.ok.19

ovf.ok.19:
  %113 = load i32, i32* %gg.addr, align 4
  %114 = load i32, i32* %gg.addr, align 4
  %115 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %113, i32 %114)
  %116 = extractvalue { i32, i1 } %115, 0
  %117 = extractvalue { i32, i1 } %115, 1
  br i1 %117, label %ovf.fail, label %ovf.ok.20

ovf.ok.20:
  %118 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %111, i32 %116)
  %119 = extractvalue { i32, i1 } %118, 0
  %120 = extractvalue { i32, i1 } %118, 1
  br i1 %120, label %ovf.fail, label %ovf.ok.21

ovf.ok.21:
  %121 = load i32, i32* %gb.addr, align 4
  %122 = load i32, i32* %gb.addr, align 4
  %123 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %121, i32 %122)
  %124 = extractvalue { i32, i1 } %123, 0
  %125 = extractvalue { i32, i1 } %123, 1
  br i1 %125, label %ovf.fail, label %ovf.ok.22

ovf.ok.22:
  %126 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %119, i32 %124)
  %127 = extractvalue { i32, i1 } %126, 0
  %128 = extractvalue { i32, i1 } %126, 1
  br i1 %128, label %ovf.fail, label %ovf.ok.23

ovf.ok.23:
  store i32 %127, i32* %greyDistance.addr, align 4
  %129 = load i32, i32* %greyDistance.addr, align 4
  %130 = load i32, i32* %cubeDistance.addr, align 4
  %131 = icmp slt i32 %129, %130
  br i1 %131, label %cond.true.1, label %cond.false.1

cond.true.1:
  %132 = load i32, i32* %step.addr, align 4
  %133 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %132, i32 232)
  %134 = extractvalue { i32, i1 } %133, 0
  %135 = extractvalue { i32, i1 } %133, 1
  br i1 %135, label %ovf.fail, label %ovf.ok.24

ovf.ok.24:
  br label %cond.end.1

cond.false.1:
  %136 = load i32, i32* %cube.addr, align 4
  br label %cond.end.1

cond.end.1:
  %137 = phi i32 [ %134, %ovf.ok.24 ], [ %136, %cond.false.1 ]
  ret i32 %137

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.end ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ], [ 1, %ovf.ok.4 ], [ 1, %ovf.ok.5 ], [ 1, %ovf.ok.6 ], [ 2, %ovf.ok.7 ], [ 2, %ovf.ok.8 ], [ 0, %ovf.ok.9 ], [ 2, %ovf.ok.10 ], [ 0, %ovf.ok.11 ], [ 1, %cond.false ], [ 2, %cond.end ], [ 0, %ovf.ok.14 ], [ 1, %ovf.ok.15 ], [ 1, %ovf.ok.16 ], [ 1, %ovf.ok.17 ], [ 2, %ovf.ok.18 ], [ 2, %ovf.ok.19 ], [ 0, %ovf.ok.20 ], [ 2, %ovf.ok.21 ], [ 0, %ovf.ok.22 ], [ 0, %cond.true.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef nonnull align 8 i8* @nish.enterAltScreen() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.1 to i8*)
}

define noundef nonnull align 8 i8* @nish.leaveAltScreen() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*)
}

define noundef nonnull align 8 i8* @nish.hideCursor() #1 {
entry:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*)
}

define noundef nonnull align 8 i8* @nish.showCursor() #1 {
entry:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*)
}

define noundef nonnull align 8 i8* @nish.clearScreen() #1 {
entry:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.5 to i8*)
}

define noundef nonnull align 8 i8* @nish.resetStyle() #1 {
entry:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.6 to i8*)
}

define noundef nonnull align 8 i8* @nish.moveCursor(i32 noundef %x, i32 noundef %y) #2 {
entry:
  %0 = add nsw i32 %y, 1
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.7 to i8*), i8* %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %4 = add nsw i32 %x, 1
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %3, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  ret i8* %7
}

define internal noundef i32 @nish.termCodePointAt(i8* noundef nonnull noalias readonly align 8 %s, i32 noundef %i, i32 noundef %n) #2 {
entry:
  %c.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %width.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds i8, i8* %s, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  store i32 %7, i32* %c.addr, align 4
  %8 = call i1 @nish.termNativeStrings()
  %9 = xor i1 %8, true
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp sge i32 %10, 55296
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %c.addr, align 4
  %13 = icmp slt i32 %12, 56320
  br label %land.end.1

land.end.1:
  %14 = phi i1 [ false, %if.then ], [ %13, %land.rhs.1 ]
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = add nsw i32 %i, 1
  %16 = icmp slt i32 %15, %n
  br label %land.end

land.end:
  %17 = phi i1 [ false, %land.end.1 ], [ %16, %land.rhs ]
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  %18 = add nsw i32 %i, 1
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds i8, i8* %s, i64 8
  %21 = getelementptr inbounds i8, i8* %20, i64 %19
  %22 = load i8, i8* %21, align 1
  %23 = zext i8 %22 to i32
  store i32 %23, i32* %lo.addr, align 4
  %24 = load i32, i32* %lo.addr, align 4
  %25 = icmp sge i32 %24, 56320
  br i1 %25, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %26 = load i32, i32* %lo.addr, align 4
  %27 = icmp slt i32 %26, 57344
  br label %land.end.2

land.end.2:
  %28 = phi i1 [ false, %if.then.1 ], [ %27, %land.rhs.2 ]
  br i1 %28, label %if.then.2, label %if.end.2

if.then.2:
  %29 = load i32, i32* %c.addr, align 4
  %30 = sub nsw i32 %29, 55296
  %31 = shl i32 %30, 10
  %32 = load i32, i32* %lo.addr, align 4
  %33 = sub nsw i32 %32, 56320
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  %37 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 65536)
  %38 = extractvalue { i32, i1 } %37, 0
  %39 = extractvalue { i32, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %38

if.end.2:
  br label %if.end.1

if.end.1:
  %40 = load i32, i32* %c.addr, align 4
  ret i32 %40

if.end:
  %41 = call i32 @nish.termCodePointUnits(i8* %s, i32 %i, i32 %n)
  store i32 %41, i32* %width.addr, align 4
  %42 = load i32, i32* %c.addr, align 4
  %43 = icmp slt i32 %42, 128
  br i1 %43, label %if.then.3, label %if.end.3

if.then.3:
  %44 = load i32, i32* %c.addr, align 4
  ret i32 %44

if.end.3:
  %45 = load i32, i32* %width.addr, align 4
  %46 = icmp eq i32 %45, 1
  br i1 %46, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 65533

if.end.4:
  %47 = load i32, i32* %c.addr, align 4
  %48 = load i32, i32* %width.addr, align 4
  %49 = call i32 @nish.termLeadBits(i32 %47, i32 %48)
  store i32 %49, i32* %cp.addr, align 4
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %50 = load i32, i32* %k.addr, align 4
  %51 = load i32, i32* %width.addr, align 4
  %52 = icmp slt i32 %50, %51
  br i1 %52, label %for.body, label %for.end

for.body:
  %53 = load i32, i32* %cp.addr, align 4
  %54 = shl i32 %53, 6
  %55 = load i32, i32* %k.addr, align 4
  %56 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %59 = sext i32 %57 to i64
  %60 = bitcast i8* %s to i64*
  %61 = load i64, i64* %60, align 8
  %62 = icmp ult i64 %59, %61
  br i1 %62, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %59, i64 %61)
  unreachable

bounds.ok.1:
  %63 = getelementptr inbounds i8, i8* %s, i64 8
  %64 = getelementptr inbounds i8, i8* %63, i64 %59
  %65 = load i8, i8* %64, align 1
  %66 = zext i8 %65 to i32
  %67 = and i32 %66, 63
  %68 = or i32 %54, %67
  store i32 %68, i32* %cp.addr, align 4
  br label %for.inc

for.inc:
  %69 = load i32, i32* %k.addr, align 4
  %70 = add nsw i32 %69, 1
  store i32 %70, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %71 = load i32, i32* %cp.addr, align 4
  ret i32 %71

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.termCodePointUnits(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %i, i32 noundef %n) #2 {
entry:
  %c.addr = alloca i32, align 4
  %lo.addr = alloca i32, align 4
  %width.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %next.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds i8, i8* %s, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  store i32 %7, i32* %c.addr, align 4
  %8 = call i1 @nish.termNativeStrings()
  %9 = xor i1 %8, true
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp sge i32 %10, 55296
  br i1 %11, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %12 = load i32, i32* %c.addr, align 4
  %13 = icmp slt i32 %12, 56320
  br label %land.end.1

land.end.1:
  %14 = phi i1 [ false, %if.then ], [ %13, %land.rhs.1 ]
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = add nsw i32 %i, 1
  %16 = icmp slt i32 %15, %n
  br label %land.end

land.end:
  %17 = phi i1 [ false, %land.end.1 ], [ %16, %land.rhs ]
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  %18 = add nsw i32 %i, 1
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds i8, i8* %s, i64 8
  %21 = getelementptr inbounds i8, i8* %20, i64 %19
  %22 = load i8, i8* %21, align 1
  %23 = zext i8 %22 to i32
  store i32 %23, i32* %lo.addr, align 4
  %24 = load i32, i32* %lo.addr, align 4
  %25 = icmp sge i32 %24, 56320
  br i1 %25, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %26 = load i32, i32* %lo.addr, align 4
  %27 = icmp slt i32 %26, 57344
  br label %land.end.2

land.end.2:
  %28 = phi i1 [ false, %if.then.1 ], [ %27, %land.rhs.2 ]
  br i1 %28, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %29 = phi i32 [ 2, %cond.true ], [ 1, %cond.false ]
  ret i32 %29

if.end.1:
  ret i32 1

if.end:
  %30 = load i32, i32* %c.addr, align 4
  %31 = icmp sge i32 %30, 248
  br i1 %31, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %32 = load i32, i32* %c.addr, align 4
  %33 = call i32 @nish.termLeadWidth(i32 %32)
  br label %cond.end.1

cond.end.1:
  %34 = phi i32 [ 1, %cond.true.1 ], [ %33, %cond.false.1 ]
  store i32 %34, i32* %width.addr, align 4
  %35 = load i32, i32* %width.addr, align 4
  %36 = icmp eq i32 %35, 1
  br i1 %36, label %lor.end, label %lor.rhs

lor.rhs:
  %37 = load i32, i32* %width.addr, align 4
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok

ovf.ok:
  %41 = icmp sgt i32 %39, %n
  br label %lor.end

lor.end:
  %42 = phi i1 [ true, %cond.end.1 ], [ %41, %ovf.ok ]
  br i1 %42, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 1

if.end.2:
  store i32 1, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %43 = load i32, i32* %k.addr, align 4
  %44 = load i32, i32* %width.addr, align 4
  %45 = icmp slt i32 %43, %44
  br i1 %45, label %for.body, label %for.end

for.body:
  %46 = load i32, i32* %k.addr, align 4
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %50 = sext i32 %48 to i64
  %51 = bitcast i8* %s to i64*
  %52 = load i64, i64* %51, align 8
  %53 = icmp ult i64 %50, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %50, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds i8, i8* %s, i64 8
  %55 = getelementptr inbounds i8, i8* %54, i64 %50
  %56 = load i8, i8* %55, align 1
  %57 = zext i8 %56 to i32
  store i32 %57, i32* %next.addr, align 4
  %58 = load i32, i32* %next.addr, align 4
  %59 = icmp slt i32 %58, 128
  br i1 %59, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %60 = load i32, i32* %next.addr, align 4
  %61 = icmp sge i32 %60, 192
  br label %lor.end.1

lor.end.1:
  %62 = phi i1 [ true, %bounds.ok.1 ], [ %61, %lor.rhs.1 ]
  br i1 %62, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 1

if.end.3:
  br label %for.inc

for.inc:
  %63 = load i32, i32* %k.addr, align 4
  %64 = add nsw i32 %63, 1
  store i32 %64, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %65 = load i32, i32* %width.addr, align 4
  ret i32 %65

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @nish.termBytesText(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %n) #2 {
entry:
  %pieces.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %run.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %width.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %chr = alloca i8, align 1
  %chr.1 = alloca i8, align 1
  %chr.2 = alloca i8, align 1
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = call i1 @nish.termNativeStrings()
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sext i32 %n to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ule i64 0, %1
  %5 = icmp ule i64 %1, %3
  %6 = and i1 %4, %5
  br i1 %6, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %1, i64 %3)
  unreachable

bytes.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds i8, i8* %8, i64 0
  %10 = sub i64 %1, 0
  %11 = call i8* @nish_str_new(i8* %9, i64 %10)
  ret i8* %11

if.end:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %pieces.addr, align 8
  store i32 0, i32* %run.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp slt i32 %15, %n
  br i1 %16, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = icmp sge i32 %17, 0
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %i.addr, align 4
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  %23 = icmp slt i32 %19, %22
  br label %land.end

land.end:
  %24 = phi i1 [ false, %while.body ], [ %23, %land.rhs ]
  %25 = xor i1 %24, true
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [51 x i8] }* @.str.10 to i8*))
  unreachable

if.end.1:
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %29 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 %27
  %32 = load i8, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = zext i8 %32 to i32
  store i32 %33, i32* %c.addr, align 4
  %34 = load i32, i32* %c.addr, align 4
  %35 = icmp slt i32 %34, 128
  br i1 %35, label %if.then.2, label %if.end.2

if.then.2:
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %while.cond

if.end.2:
  %38 = load i32, i32* %run.addr, align 4
  %39 = load i32, i32* %i.addr, align 4
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %if.then.3, label %if.end.3

if.then.3:
  %41 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %42 = load i32, i32* %run.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = load i32, i32* %i.addr, align 4
  %45 = sext i32 %44 to i64
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = icmp ule i64 %43, %45
  %49 = icmp ule i64 %45, %47
  %50 = and i1 %48, %49
  br i1 %50, label %bytes.ok.1, label %bytes.fail.1

bytes.fail.1:
  call void @nish_panic_slice(i64 %43, i64 %45, i64 %47)
  unreachable

bytes.ok.1:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = getelementptr inbounds i8, i8* %52, i64 %43
  %54 = sub i64 %45, %43
  %55 = call i8* @nish_str_new(i8* %53, i64 %54)
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 1
  %59 = load i64, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = icmp eq i64 %57, %59
  br i1 %60, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %41, i64 8)
  br label %push.store

push.store:
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %57
  store i8* %55, i8** %64, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %65 = add i64 %57, 1
  store i64 %65, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = trunc i64 %65 to i32
  br label %if.end.3

if.end.3:
  %67 = load i32, i32* %c.addr, align 4
  %68 = call i32 @nish.termLeadWidth(i32 %67)
  store i32 %68, i32* %width.addr, align 4
  %69 = load i32, i32* %width.addr, align 4
  %70 = icmp eq i32 %69, 1
  br i1 %70, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %71 = load i32, i32* %c.addr, align 4
  %72 = load i32, i32* %width.addr, align 4
  %73 = call i32 @nish.termLeadBits(i32 %71, i32 %72)
  br label %cond.end

cond.end:
  %74 = phi i32 [ 65533, %cond.true ], [ %73, %cond.false ]
  store i32 %74, i32* %cp.addr, align 4
  store i32 1, i32* %k.addr, align 4
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %79 = load i32, i32* %k.addr, align 4
  %80 = load i32, i32* %width.addr, align 4
  %81 = icmp slt i32 %79, %80
  br i1 %81, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %82 = load i32, i32* %i.addr, align 4
  %83 = load i32, i32* %k.addr, align 4
  %84 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %82, i32 %83)
  %85 = extractvalue { i32, i1 } %84, 0
  %86 = extractvalue { i32, i1 } %84, 1
  br i1 %86, label %ovf.fail, label %ovf.ok

ovf.ok:
  %87 = icmp slt i32 %85, %n
  br label %land.end.1

land.end.1:
  %88 = phi i1 [ false, %for.cond ], [ %87, %ovf.ok ]
  br i1 %88, label %for.body, label %for.end

for.body:
  %89 = load i32, i32* %cp.addr, align 4
  %90 = shl i32 %89, 6
  %91 = load i32, i32* %i.addr, align 4
  %92 = load i32, i32* %k.addr, align 4
  %93 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %91, i32 %92)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %96 = sext i32 %94 to i64
  %97 = icmp ult i64 %96, %76
  br i1 %97, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %96, i64 %76)
  unreachable

bounds.ok:
  %98 = bitcast i8* %78 to i8*
  %99 = getelementptr inbounds i8, i8* %98, i64 %96
  %100 = load i8, i8* %99, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %101 = zext i8 %100 to i32
  %102 = and i32 %101, 63
  %103 = or i32 %90, %102
  store i32 %103, i32* %cp.addr, align 4
  br label %for.inc

for.inc:
  %104 = load i32, i32* %k.addr, align 4
  %105 = add nsw i32 %104, 1
  store i32 %105, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %106 = load i32, i32* %cp.addr, align 4
  %107 = icmp sge i32 %106, 65536
  br i1 %107, label %if.then.4, label %if.else

if.then.4:
  %108 = load i32, i32* %cp.addr, align 4
  %109 = sub nsw i32 %108, 65536
  store i32 %109, i32* %v.addr, align 4
  %110 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %111 = load i32, i32* %v.addr, align 4
  %112 = ashr i32 %111, 10
  %113 = add nsw i32 %112, 55296
  %114 = sext i32 %113 to i64
  %115 = trunc i64 %114 to i8
  store i8 %115, i8* %chr, align 1
  %116 = call i8* @nish_str_new(i8* %chr, i64 1)
  %117 = load i32, i32* %v.addr, align 4
  %118 = and i32 %117, 1023
  %119 = add nsw i32 %118, 56320
  %120 = sext i32 %119 to i64
  %121 = trunc i64 %120 to i8
  store i8 %121, i8* %chr.1, align 1
  %122 = call i8* @nish_str_new(i8* %chr.1, i64 1)
  %123 = call i8* @nish_str_concat(i8* %116, i8* %122)
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 1
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %128 = icmp eq i64 %125, %127
  br i1 %128, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %110, i64 8)
  br label %push.store.1

push.store.1:
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %131 = bitcast i8* %130 to i8**
  %132 = getelementptr inbounds i8*, i8** %131, i64 %125
  store i8* %123, i8** %132, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %133 = add i64 %125, 1
  store i64 %133, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = trunc i64 %133 to i32
  br label %if.end.4

if.else:
  %135 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %136 = load i32, i32* %cp.addr, align 4
  %137 = sext i32 %136 to i64
  %138 = trunc i64 %137 to i8
  store i8 %138, i8* %chr.2, align 1
  %139 = call i8* @nish_str_new(i8* %chr.2, i64 1)
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 1
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %144 = icmp eq i64 %141, %143
  br i1 %144, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %135, i64 8)
  br label %push.store.2

push.store.2:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %135, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %147 = bitcast i8* %146 to i8**
  %148 = getelementptr inbounds i8*, i8** %147, i64 %141
  store i8* %139, i8** %148, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %149 = add i64 %141, 1
  store i64 %149, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = trunc i64 %149 to i32
  br label %if.end.4

if.end.4:
  %151 = load i32, i32* %i.addr, align 4
  %152 = load i32, i32* %width.addr, align 4
  %153 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %151, i32 %152)
  %154 = extractvalue { i32, i1 } %153, 0
  %155 = extractvalue { i32, i1 } %153, 1
  br i1 %155, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %154, i32* %i.addr, align 4
  %156 = load i32, i32* %i.addr, align 4
  store i32 %156, i32* %run.addr, align 4
  br label %while.cond

while.end:
  %157 = load i32, i32* %run.addr, align 4
  %158 = icmp slt i32 %157, %n
  br i1 %158, label %if.then.5, label %if.end.5

if.then.5:
  %159 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %160 = load i32, i32* %run.addr, align 4
  %161 = sext i32 %160 to i64
  %162 = sext i32 %n to i64
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %164 = load i64, i64* %163, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = icmp ule i64 %161, %162
  %166 = icmp ule i64 %162, %164
  %167 = and i1 %165, %166
  br i1 %167, label %bytes.ok.2, label %bytes.fail.2

bytes.fail.2:
  call void @nish_panic_slice(i64 %161, i64 %162, i64 %164)
  unreachable

bytes.ok.2:
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %169 = load i8*, i8** %168, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %170 = getelementptr inbounds i8, i8* %169, i64 %161
  %171 = sub i64 %162, %161
  %172 = call i8* @nish_str_new(i8* %170, i64 %171)
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 1
  %176 = load i64, i64* %175, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %177 = icmp eq i64 %174, %176
  br i1 %177, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %159, i64 8)
  br label %push.store.3

push.store.3:
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 2
  %179 = load i8*, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %180 = bitcast i8* %179 to i8**
  %181 = getelementptr inbounds i8*, i8** %180, i64 %174
  store i8* %172, i8** %181, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %182 = add i64 %174, 1
  store i64 %182, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %183 = trunc i64 %182 to i32
  br label %if.end.5

if.end.5:
  %184 = load %struct.nish_array*, %struct.nish_array** %pieces.addr, align 8
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 0
  %186 = load i64, i64* %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %187 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.11 to i8*) to i64*
  %188 = load i64, i64* %187, align 8
  %189 = sub i64 %186, 1
  %190 = mul i64 %188, %189
  %191 = icmp eq i64 %186, 0
  %192 = select i1 %191, i64 0, i64 %190
  store i64 %192, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %193 = load i64, i64* %join.at, align 8
  %194 = icmp ult i64 %193, %186
  br i1 %194, label %join.sum.body, label %join.copy

join.sum.body:
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 2
  %196 = load i8*, i8** %195, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %197 = bitcast i8* %196 to i8**
  %198 = getelementptr inbounds i8*, i8** %197, i64 %193
  %199 = load i8*, i8** %198, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %200 = load i64, i64* %join.total, align 8
  %201 = bitcast i8* %199 to i64*
  %202 = load i64, i64* %201, align 8
  %203 = add i64 %200, %202
  store i64 %203, i64* %join.total, align 8
  %204 = add i64 %193, 1
  store i64 %204, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %205 = load i64, i64* %join.total, align 8
  %206 = icmp ugt i64 %205, 2147483647
  %207 = add i64 %205, 9
  %208 = select i1 %206, i64 4611686018427387904, i64 %207
  %209 = call i8* @nish_alloc_struct(i64 %208)
  %210 = bitcast i8* %209 to i64*
  store i64 %205, i64* %210, align 8
  %211 = getelementptr inbounds i8, i8* %209, i64 8
  store i8* %211, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %212 = load i64, i64* %join.at, align 8
  %213 = icmp ult i64 %212, %186
  br i1 %213, label %join.part, label %join.end

join.part:
  %214 = load i8*, i8** %join.p, align 8
  %215 = icmp eq i64 %212, 0
  %216 = select i1 %215, i64 0, i64 %188
  %217 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.11 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %214, i8* %217, i64 %216, i1 false)
  %218 = getelementptr inbounds i8, i8* %214, i64 %216
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 2
  %220 = load i8*, i8** %219, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %221 = bitcast i8* %220 to i8**
  %222 = getelementptr inbounds i8*, i8** %221, i64 %212
  %223 = load i8*, i8** %222, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %224 = bitcast i8* %223 to i64*
  %225 = load i64, i64* %224, align 8
  %226 = getelementptr inbounds i8, i8* %223, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %218, i8* %226, i64 %225, i1 false)
  %227 = getelementptr inbounds i8, i8* %218, i64 %225
  store i8* %227, i8** %join.p, align 8
  %228 = add i64 %212, 1
  store i64 %228, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %229 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %229, align 1
  ret i8* %209

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish.Screen.constructor(%struct.Screen* noundef nonnull noalias align 8 dereferenceable(88) nocapture %this, i32 noundef %width, i32 noundef %height, i1 noundef zeroext %palette256) #2 {
entry:
  %0 = icmp slt i32 %width, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 0, %cond.true ], [ %width, %cond.false ]
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  store i32 %1, i32* %2, align 4, !tbaa !21
  %3 = icmp slt i32 %height, 0
  br i1 %3, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %4 = phi i32 [ 0, %cond.true.1 ], [ %height, %cond.false.1 ]
  %5 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  store i32 %4, i32* %5, align 4, !tbaa !22
  %6 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 12
  store i1 %palette256, i1* %6, align 1, !tbaa !23
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* null, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  store %struct.nish_array* %8, %struct.nish_array** %12, align 8, !tbaa !24
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !25
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 0, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* null, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  store %struct.nish_array* %20, %struct.nish_array** %24, align 8, !tbaa !26
  %25 = call i8* @nish_alloc_struct(i64 24)
  %26 = bitcast i8* %25 to %struct.nish_array*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 1
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  store i8* null, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  store %struct.nish_array* %26, %struct.nish_array** %30, align 8, !tbaa !27
  %31 = call i8* @nish_alloc_struct(i64 24)
  %32 = bitcast i8* %31 to %struct.nish_array*
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  store i64 0, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  store i64 0, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  store i8* null, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  store %struct.nish_array* %32, %struct.nish_array** %36, align 8, !tbaa !28
  %37 = call i8* @nish_alloc_struct(i64 24)
  %38 = bitcast i8* %37 to %struct.nish_array*
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  store i64 0, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 1
  store i64 0, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  store i8* null, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  store %struct.nish_array* %38, %struct.nish_array** %42, align 8, !tbaa !29
  %43 = call i8* @nish_alloc_struct(i64 24)
  %44 = bitcast i8* %43 to %struct.nish_array*
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  store i64 0, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1
  store i64 0, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  store i8* null, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  store %struct.nish_array* %44, %struct.nish_array** %48, align 8, !tbaa !30
  %49 = call i8* @nish_alloc_struct(i64 24)
  %50 = bitcast i8* %49 to %struct.nish_array*
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  store i64 0, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 1
  store i64 0, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  store i8* null, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  store %struct.nish_array* %50, %struct.nish_array** %54, align 8, !tbaa !31
  %55 = call i8* @nish_alloc_struct(i64 24)
  %56 = bitcast i8* %55 to %struct.nish_array*
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  store i64 0, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 1
  store i64 0, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  store i8* null, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %60 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  store %struct.nish_array* %56, %struct.nish_array** %60, align 8, !tbaa !32
  %61 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %61, align 4, !tbaa !33
  %62 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %63 = load i32, i32* %62, align 4, !tbaa !21
  %64 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %65 = load i32, i32* %64, align 4, !tbaa !22
  call void @nish.Screen.resize(%struct.Screen* %this, i32 %63, i32 %65)
  ret void
}

define void @nish.Screen.resize(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %width, i32 noundef %height) #2 {
entry:
  %cells.addr = alloca i32, align 4
  %0 = icmp slt i32 %width, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 0, %cond.true ], [ %width, %cond.false ]
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  store i32 %1, i32* %2, align 4, !tbaa !21
  %3 = icmp slt i32 %height, 0
  br i1 %3, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %4 = phi i32 [ 0, %cond.true.1 ], [ %height, %cond.false.1 ]
  %5 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  store i32 %4, i32* %5, align 4, !tbaa !22
  %6 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %7 = load i32, i32* %6, align 4, !tbaa !21
  %8 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %9 = load i32, i32* %8, align 4, !tbaa !22
  %10 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %11, i32* %cells.addr, align 4
  %13 = load i32, i32* %cells.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = icmp ule i64 %14, 2147483647
  br i1 %15, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok:
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %14, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %14, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = mul i64 %14, 4
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !4, !noalias !3
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  store %struct.nish_array* %17, %struct.nish_array** %23, align 8, !tbaa !24
  %24 = load i32, i32* %cells.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = icmp ule i64 %25, 2147483647
  br i1 %26, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.1:
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 %25, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 %25, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = mul i64 %25, 4
  %32 = call i8* @nish_alloc_struct(i64 %31)
  call void @llvm.memset.p0i8.i64(i8* align 8 %32, i8 0, i64 %31, i1 false), !alias.scope !4, !noalias !3
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* %32, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  store %struct.nish_array* %28, %struct.nish_array** %34, align 8, !tbaa !25
  %35 = load i32, i32* %cells.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = icmp ule i64 %36, 2147483647
  br i1 %37, label %len.ok.2, label %len.fail.2

len.fail.2:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.2:
  %38 = call i8* @nish_alloc_struct(i64 24)
  %39 = bitcast i8* %38 to %struct.nish_array*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  store i64 %36, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  store i64 %36, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = mul i64 %36, 4
  %43 = call i8* @nish_alloc_struct(i64 %42)
  call void @llvm.memset.p0i8.i64(i8* align 8 %43, i8 0, i64 %42, i1 false), !alias.scope !4, !noalias !3
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %45 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  store %struct.nish_array* %39, %struct.nish_array** %45, align 8, !tbaa !26
  %46 = load i32, i32* %cells.addr, align 4
  %47 = sext i32 %46 to i64
  %48 = icmp ule i64 %47, 2147483647
  br i1 %48, label %len.ok.3, label %len.fail.3

len.fail.3:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.3:
  %49 = call i8* @nish_alloc_struct(i64 24)
  %50 = bitcast i8* %49 to %struct.nish_array*
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  store i64 %47, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 1
  store i64 %47, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %53 = mul i64 %47, 4
  %54 = call i8* @nish_alloc_struct(i64 %53)
  call void @llvm.memset.p0i8.i64(i8* align 8 %54, i8 0, i64 %53, i1 false), !alias.scope !4, !noalias !3
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  store i8* %54, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  store %struct.nish_array* %50, %struct.nish_array** %56, align 8, !tbaa !27
  %57 = load i32, i32* %cells.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = icmp ule i64 %58, 2147483647
  br i1 %59, label %len.ok.4, label %len.fail.4

len.fail.4:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.4:
  %60 = call i8* @nish_alloc_struct(i64 24)
  %61 = bitcast i8* %60 to %struct.nish_array*
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  store i64 %58, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 1
  store i64 %58, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = mul i64 %58, 4
  %65 = call i8* @nish_alloc_struct(i64 %64)
  call void @llvm.memset.p0i8.i64(i8* align 8 %65, i8 0, i64 %64, i1 false), !alias.scope !4, !noalias !3
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  store %struct.nish_array* %61, %struct.nish_array** %67, align 8, !tbaa !28
  %68 = load i32, i32* %cells.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = icmp ule i64 %69, 2147483647
  br i1 %70, label %len.ok.5, label %len.fail.5

len.fail.5:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.5:
  %71 = call i8* @nish_alloc_struct(i64 24)
  %72 = bitcast i8* %71 to %struct.nish_array*
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  store i64 %69, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 1
  store i64 %69, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = mul i64 %69, 4
  %76 = call i8* @nish_alloc_struct(i64 %75)
  call void @llvm.memset.p0i8.i64(i8* align 8 %76, i8 0, i64 %75, i1 false), !alias.scope !4, !noalias !3
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 2
  store i8* %76, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %78 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  store %struct.nish_array* %72, %struct.nish_array** %78, align 8, !tbaa !29
  %79 = load i32, i32* %cells.addr, align 4
  %80 = sext i32 %79 to i64
  %81 = icmp ule i64 %80, 2147483647
  br i1 %81, label %len.ok.6, label %len.fail.6

len.fail.6:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.6:
  %82 = call i8* @nish_alloc_struct(i64 24)
  %83 = bitcast i8* %82 to %struct.nish_array*
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  store i64 %80, i64* %84, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 1
  store i64 %80, i64* %85, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %86 = mul i64 %80, 4
  %87 = call i8* @nish_alloc_struct(i64 %86)
  call void @llvm.memset.p0i8.i64(i8* align 8 %87, i8 0, i64 %86, i1 false), !alias.scope !4, !noalias !3
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  store i8* %87, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %89 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  store %struct.nish_array* %83, %struct.nish_array** %89, align 8, !tbaa !30
  %90 = load i32, i32* %cells.addr, align 4
  %91 = sext i32 %90 to i64
  %92 = icmp ule i64 %91, 2147483647
  br i1 %92, label %len.ok.7, label %len.fail.7

len.fail.7:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.7:
  %93 = call i8* @nish_alloc_struct(i64 24)
  %94 = bitcast i8* %93 to %struct.nish_array*
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 0
  store i64 %91, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 1
  store i64 %91, i64* %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = mul i64 %91, 4
  %98 = call i8* @nish_alloc_struct(i64 %97)
  call void @llvm.memset.p0i8.i64(i8* align 8 %98, i8 0, i64 %97, i1 false), !alias.scope !4, !noalias !3
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %94, i64 0, i32 2
  store i8* %98, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %100 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  store %struct.nish_array* %94, %struct.nish_array** %100, align 8, !tbaa !31
  %101 = load i32, i32* %cells.addr, align 4
  %102 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %101, i32 64)
  %103 = extractvalue { i32, i1 } %102, 0
  %104 = extractvalue { i32, i1 } %102, 1
  br i1 %104, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %105 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %103, i32 64)
  %106 = extractvalue { i32, i1 } %105, 0
  %107 = extractvalue { i32, i1 } %105, 1
  br i1 %107, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %108 = sext i32 %106 to i64
  %109 = icmp ule i64 %108, 2147483647
  br i1 %109, label %len.ok.8, label %len.fail.8

len.fail.8:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok.8:
  %110 = call i8* @nish_alloc_struct(i64 24)
  %111 = bitcast i8* %110 to %struct.nish_array*
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  store i64 %108, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 1
  store i64 %108, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %114 = call i8* @nish_alloc_struct(i64 %108)
  call void @llvm.memset.p0i8.i64(i8* align 8 %114, i8 0, i64 %108, i1 false), !alias.scope !4, !noalias !3
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  store i8* %114, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  store %struct.nish_array* %111, %struct.nish_array** %116, align 8, !tbaa !32
  %117 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %118 = load %struct.nish_array*, %struct.nish_array** %117, align 8, !tbaa !32
  %119 = trunc i32 0 to i8
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = sub i64 %121, 0
  %123 = call i64 @llvm.smax.i64(i64 %122, i64 0)
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %126 = bitcast i8* %125 to i8*
  %127 = getelementptr inbounds i8, i8* %126, i64 0
  call void @llvm.memset.p0i8.i64(i8* %127, i8 %119, i64 %123, i1 false), !alias.scope !4, !noalias !3
  call void @nish.Screen.clear(%struct.Screen* %this, i32 -1)
  call void @nish.Screen.invalidate(%struct.Screen* %this)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %cond.end.1 ], [ 2, %len.ok.7 ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.Screen.clear(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %background) #3 {
entry:
  %fill.at = alloca i64, align 8
  %fill.at.1 = alloca i64, align 8
  %fill.at.2 = alloca i64, align 8
  %fill.at.3 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %4 = load i64, i64* %fill.at, align 8
  %5 = icmp slt i64 %4, %3
  br i1 %5, label %fill.body, label %fill.end

fill.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %4
  store i32 32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !25
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.cond.1:
  %15 = load i64, i64* %fill.at.1, align 8
  %16 = icmp slt i64 %15, %14
  br i1 %16, label %fill.body.1, label %fill.end.1

fill.body.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %15
  store i32 -1, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %21 = add i64 %15, 1
  store i64 %21, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !26
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.cond.2:
  %26 = load i64, i64* %fill.at.2, align 8
  %27 = icmp slt i64 %26, %25
  br i1 %27, label %fill.body.2, label %fill.end.2

fill.body.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %26
  store i32 %background, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %32 = add i64 %26, 1
  store i64 %32, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.end.2:
  %33 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !27
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.cond.3:
  %37 = load i64, i64* %fill.at.3, align 8
  %38 = icmp slt i64 %37, %36
  br i1 %38, label %fill.body.3, label %fill.end.3

fill.body.3:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %37
  store i32 0, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %43 = add i64 %37, 1
  store i64 %43, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.end.3:
  ret void
}

define void @nish.Screen.invalidate(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this) #3 {
entry:
  %fill.at = alloca i64, align 8
  %fill.at.1 = alloca i64, align 8
  %fill.at.2 = alloca i64, align 8
  %fill.at.3 = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !28
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %4 = load i64, i64* %fill.at, align 8
  %5 = icmp slt i64 %4, %3
  br i1 %5, label %fill.body, label %fill.end

fill.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %4
  store i32 -1, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !29
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.cond.1:
  %15 = load i64, i64* %fill.at.1, align 8
  %16 = icmp slt i64 %15, %14
  br i1 %16, label %fill.body.1, label %fill.end.1

fill.body.1:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %18 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %15
  store i32 -1, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %21 = add i64 %15, 1
  store i64 %21, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !30
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.cond.2:
  %26 = load i64, i64* %fill.at.2, align 8
  %27 = icmp slt i64 %26, %25
  br i1 %27, label %fill.body.2, label %fill.end.2

fill.body.2:
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %26
  store i32 -1, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %32 = add i64 %26, 1
  store i64 %32, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.end.2:
  %33 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !31
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.cond.3:
  %37 = load i64, i64* %fill.at.3, align 8
  %38 = icmp slt i64 %37, %36
  br i1 %38, label %fill.body.3, label %fill.end.3

fill.body.3:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %37
  store i32 0, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %43 = add i64 %37, 1
  store i64 %43, i64* %fill.at.3, align 8
  br label %fill.cond.3

fill.end.3:
  ret void
}

define void @nish.Screen.set(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %glyph, i32 noundef %fg, i32 noundef %bg, i32 noundef %attrs) #2 {
entry:
  %i.addr = alloca i32, align 4
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp slt i32 %y, 0
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %4 = load i32, i32* %3, align 4, !tbaa !21
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %8 = load i32, i32* %7, align 4, !tbaa !22
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %12 = load i32, i32* %11, align 4, !tbaa !21
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %y, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %x)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %17, i32* %i.addr, align 4
  %19 = load i32, i32* %i.addr, align 4
  %20 = icmp sge i32 %19, 0
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = load i32, i32* %i.addr, align 4
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !24
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = icmp slt i32 %21, %26
  br label %land.end

land.end:
  %28 = phi i1 [ false, %ovf.ok.1 ], [ %27, %land.rhs ]
  %29 = xor i1 %28, true
  br i1 %29, label %if.then.1, label %if.end.1

if.then.1:
  ret void

if.end.1:
  %30 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !24
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %33
  store i32 %glyph, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %38 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !tbaa !25
  %40 = load i32, i32* %i.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = icmp ult i64 %41, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %41, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = bitcast i8* %46 to i32*
  %48 = getelementptr inbounds i32, i32* %47, i64 %41
  store i32 %fg, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %49 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !26
  %51 = load i32, i32* %i.addr, align 4
  %52 = sext i32 %51 to i64
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 %52, %54
  br i1 %55, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %52, i64 %54)
  unreachable

bounds.ok.1:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %58 = bitcast i8* %57 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %52
  store i32 %bg, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %60 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %61 = load %struct.nish_array*, %struct.nish_array** %60, align 8, !tbaa !27
  %62 = load i32, i32* %i.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = icmp ult i64 %63, %65
  br i1 %66, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %63, i64 %65)
  unreachable

bounds.ok.2:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = bitcast i8* %68 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 %63
  store i32 %attrs, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.end ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish.Screen.text(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %x, i32 noundef %y, i8* noundef nonnull noalias readonly align 8 %s, i32 noundef %fg, i32 noundef %bg, i32 noundef %attrs) #2 {
entry:
  %n.addr = alloca i32, align 4
  %column.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 %x, i32* %column.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = load i32, i32* %column.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %n.addr, align 4
  %9 = call i32 @nish.termCodePointAt(i8* %s, i32 %7, i32 %8)
  call void @nish.Screen.set(%struct.Screen* %this, i32 %6, i32 %y, i32 %9, i32 %fg, i32 %bg, i32 %attrs)
  %10 = load i32, i32* %i.addr, align 4
  %11 = load i32, i32* %i.addr, align 4
  %12 = load i32, i32* %n.addr, align 4
  %13 = call i32 @nish.termCodePointUnits(i8* %s, i32 %11, i32 %12)
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %i.addr, align 4
  %17 = load i32, i32* %column.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 1)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %19, i32* %column.addr, align 4
  br label %while.cond

while.end:
  %21 = load i32, i32* %column.addr, align 4
  ret i32 %21

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish.Screen.glyphAt(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %x, i32 noundef %y) #2 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp slt i32 %y, 0
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %4 = load i32, i32* %3, align 4, !tbaa !21
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %8 = load i32, i32* %7, align 4, !tbaa !22
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !24
  %13 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %14 = load i32, i32* %13, align 4, !tbaa !21
  %15 = mul nsw i32 %y, %14
  %16 = add nsw i32 %15, %x
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = icmp ult i64 %17, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %17, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  ret i32 %25
}

define void @nish.Screen.put(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %b) #2 {
entry:
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !32
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %3 = load i32, i32* %2, align 4, !tbaa !33
  %4 = sext i32 %3 to i64
  %5 = trunc i32 %b to i8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %4, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %4, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8*
  %12 = getelementptr inbounds i8, i8* %11, i64 %4
  store i8 %5, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %14 = load i32, i32* %13, align 4, !tbaa !33
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 %16, i32* %18, align 4, !tbaa !33
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish.Screen.putDecimal(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %v) #2 {
entry:
  %0 = icmp sge i32 %v, 100
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = icmp sge i32 %v, 1000
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  %2 = sdiv i32 %v, 1000
  %3 = or i32 %2, 0
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %3)
  br label %if.end.1

if.end.1:
  %4 = sdiv i32 %v, 100
  %5 = or i32 %4, 0
  %6 = srem i32 %5, 10
  %7 = add nsw i32 %6, 48
  call void @nish.Screen.put(%struct.Screen* %this, i32 %7)
  br label %if.end

if.end:
  %8 = icmp sge i32 %v, 10
  br i1 %8, label %if.then.2, label %if.end.2

if.then.2:
  %9 = sdiv i32 %v, 10
  %10 = or i32 %9, 0
  %11 = srem i32 %10, 10
  %12 = add nsw i32 %11, 48
  call void @nish.Screen.put(%struct.Screen* %this, i32 %12)
  br label %if.end.2

if.end.2:
  %13 = srem i32 %v, 10
  %14 = add nsw i32 %13, 48
  call void @nish.Screen.put(%struct.Screen* %this, i32 %14)
  ret void
}

define void @nish.Screen.putGlyph(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %cp) #2 {
entry:
  %c.addr = alloca i32, align 4
  %0 = icmp sge i32 %cp, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp slt i32 %cp, 128
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.else

if.then:
  call void @nish.Screen.put(%struct.Screen* %this, i32 %cp)
  br label %if.end

if.else:
  %3 = icmp sge i32 %cp, 128
  br i1 %3, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %4 = icmp slt i32 %cp, 2048
  br label %land.end.1

land.end.1:
  %5 = phi i1 [ false, %if.else ], [ %4, %land.rhs.1 ]
  br i1 %5, label %if.then.1, label %if.else.1

if.then.1:
  %6 = ashr i32 %cp, 6
  %7 = or i32 %6, 192
  call void @nish.Screen.put(%struct.Screen* %this, i32 %7)
  %8 = and i32 %cp, 63
  %9 = or i32 %8, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %9)
  br label %if.end.1

if.else.1:
  %10 = icmp sge i32 %cp, 65536
  br i1 %10, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %11 = icmp slt i32 %cp, 1114112
  br label %land.end.2

land.end.2:
  %12 = phi i1 [ false, %if.else.1 ], [ %11, %land.rhs.2 ]
  br i1 %12, label %if.then.2, label %if.else.2

if.then.2:
  %13 = ashr i32 %cp, 18
  %14 = or i32 %13, 240
  call void @nish.Screen.put(%struct.Screen* %this, i32 %14)
  %15 = ashr i32 %cp, 12
  %16 = and i32 %15, 63
  %17 = or i32 %16, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %17)
  %18 = ashr i32 %cp, 6
  %19 = and i32 %18, 63
  %20 = or i32 %19, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %20)
  %21 = and i32 %cp, 63
  %22 = or i32 %21, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %22)
  br label %if.end.2

if.else.2:
  %23 = icmp sge i32 %cp, 2048
  br i1 %23, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %24 = icmp slt i32 %cp, 65536
  br label %land.end.3

land.end.3:
  %25 = phi i1 [ false, %if.else.2 ], [ %24, %land.rhs.3 ]
  br i1 %25, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %26 = phi i32 [ %cp, %cond.true ], [ 65533, %cond.false ]
  store i32 %26, i32* %c.addr, align 4
  %27 = load i32, i32* %c.addr, align 4
  %28 = ashr i32 %27, 12
  %29 = or i32 %28, 224
  call void @nish.Screen.put(%struct.Screen* %this, i32 %29)
  %30 = load i32, i32* %c.addr, align 4
  %31 = ashr i32 %30, 6
  %32 = and i32 %31, 63
  %33 = or i32 %32, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %33)
  %34 = load i32, i32* %c.addr, align 4
  %35 = and i32 %34, 63
  %36 = or i32 %35, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %36)
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  ret void
}

define void @nish.Screen.putColour(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %base, i32 noundef %key) #2 {
entry:
  %0 = icmp slt i32 %key, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 9)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %2)
  ret void

if.end:
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %base, i32 8)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %5)
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 12
  %8 = load i1, i1* %7, align 1, !tbaa !23
  br i1 %8, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %9 = add nsw i32 48, 5
  call void @nish.Screen.put(%struct.Screen* %this, i32 %9)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %key)
  ret void

if.end.1:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %10 = add nsw i32 48, 2
  call void @nish.Screen.put(%struct.Screen* %this, i32 %10)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %11 = ashr i32 %key, 16
  %12 = and i32 %11, 255
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %12)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %13 = ashr i32 %key, 8
  %14 = and i32 %13, 255
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %14)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %15 = and i32 %key, 255
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %15)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish.Screen.colourKey(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture %this, i32 noundef %colour) #2 {
entry:
  %0 = icmp slt i32 %colour, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %1 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 12
  %2 = load i1, i1* %1, align 1, !tbaa !23
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = call i32 @nish.paletteIndex(i32 %colour)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ %3, %cond.true ], [ %colour, %cond.false ]
  ret i32 %4
}

define noundef nonnull align 8 i8* @nish.Screen.flush(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this) #2 {
entry:
  %w.addr = alloca i32, align 4
  %cells.addr = alloca i32, align 4
  %glyphs.addr = alloca %struct.nish_array*, align 8
  %fgs.addr = alloca %struct.nish_array*, align 8
  %bgs.addr = alloca %struct.nish_array*, align 8
  %attrs.addr = alloca %struct.nish_array*, align 8
  %sentGlyphs.addr = alloca %struct.nish_array*, align 8
  %sentFgs.addr = alloca %struct.nish_array*, align 8
  %sentBgs.addr = alloca %struct.nish_array*, align 8
  %sentAttrs.addr = alloca %struct.nish_array*, align 8
  %styleFg.addr = alloca i32, align 4
  %styleBg.addr = alloca i32, align 4
  %styleAttrs.addr = alloca i32, align 4
  %cursorRow.addr = alloca i32, align 4
  %cursorCol.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %glyph.addr = alloca i32, align 4
  %fg.addr = alloca i32, align 4
  %bg.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %row.addr = alloca i32, align 4
  %col.addr = alloca i32, align 4
  %fgKey.addr = alloca i32, align 4
  %bgKey.addr = alloca i32, align 4
  %gap.addr = alloca i32, align 4
  %bridged.addr = alloca i1, align 1
  %k.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %first.addr = alloca i1, align 1
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %1 = load i32, i32* %0, align 4, !tbaa !21
  store i32 %1, i32* %w.addr, align 4
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !24
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %cells.addr, align 4
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %7, align 4, !tbaa !33
  %8 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !24
  store %struct.nish_array* %9, %struct.nish_array** %glyphs.addr, align 8
  %10 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !tbaa !25
  store %struct.nish_array* %11, %struct.nish_array** %fgs.addr, align 8
  %12 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !26
  store %struct.nish_array* %13, %struct.nish_array** %bgs.addr, align 8
  %14 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !27
  store %struct.nish_array* %15, %struct.nish_array** %attrs.addr, align 8
  %16 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !28
  store %struct.nish_array* %17, %struct.nish_array** %sentGlyphs.addr, align 8
  %18 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !29
  store %struct.nish_array* %19, %struct.nish_array** %sentFgs.addr, align 8
  %20 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !30
  store %struct.nish_array* %21, %struct.nish_array** %sentBgs.addr, align 8
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !31
  store %struct.nish_array* %23, %struct.nish_array** %sentAttrs.addr, align 8
  %24 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  %28 = load i32, i32* %cells.addr, align 4
  %29 = icmp eq i32 %27, %28
  br i1 %29, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %30 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = load i32, i32* %cells.addr, align 4
  %35 = icmp eq i32 %33, %34
  br label %land.end.6

land.end.6:
  %36 = phi i1 [ false, %entry ], [ %35, %land.rhs.6 ]
  br i1 %36, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %37 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = trunc i64 %39 to i32
  %41 = load i32, i32* %cells.addr, align 4
  %42 = icmp eq i32 %40, %41
  br label %land.end.5

land.end.5:
  %43 = phi i1 [ false, %land.end.6 ], [ %42, %land.rhs.5 ]
  br i1 %43, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %44 = load %struct.nish_array*, %struct.nish_array** %sentGlyphs.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  %48 = load i32, i32* %cells.addr, align 4
  %49 = icmp eq i32 %47, %48
  br label %land.end.4

land.end.4:
  %50 = phi i1 [ false, %land.end.5 ], [ %49, %land.rhs.4 ]
  br i1 %50, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %51 = load %struct.nish_array*, %struct.nish_array** %sentFgs.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = trunc i64 %53 to i32
  %55 = load i32, i32* %cells.addr, align 4
  %56 = icmp eq i32 %54, %55
  br label %land.end.3

land.end.3:
  %57 = phi i1 [ false, %land.end.4 ], [ %56, %land.rhs.3 ]
  br i1 %57, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %58 = load %struct.nish_array*, %struct.nish_array** %sentBgs.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = trunc i64 %60 to i32
  %62 = load i32, i32* %cells.addr, align 4
  %63 = icmp eq i32 %61, %62
  br label %land.end.2

land.end.2:
  %64 = phi i1 [ false, %land.end.3 ], [ %63, %land.rhs.2 ]
  br i1 %64, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %65 = load %struct.nish_array*, %struct.nish_array** %sentAttrs.addr, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = trunc i64 %67 to i32
  %69 = load i32, i32* %cells.addr, align 4
  %70 = icmp eq i32 %68, %69
  br label %land.end.1

land.end.1:
  %71 = phi i1 [ false, %land.end.2 ], [ %70, %land.rhs.1 ]
  br i1 %71, label %land.rhs, label %land.end

land.rhs:
  %72 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %73 = load %struct.nish_array*, %struct.nish_array** %72, align 8, !tbaa !32
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %73, i64 0, i32 0
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = trunc i64 %75 to i32
  %77 = load i32, i32* %cells.addr, align 4
  %78 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %77, i32 64)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok

ovf.ok:
  %81 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 64)
  %82 = extractvalue { i32, i1 } %81, 0
  %83 = extractvalue { i32, i1 } %81, 1
  br i1 %83, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %84 = icmp sge i32 %76, %82
  br label %land.end

land.end:
  %85 = phi i1 [ false, %land.end.1 ], [ %84, %ovf.ok.1 ]
  %86 = xor i1 %85, true
  br i1 %86, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [51 x i8] }* @.str.13 to i8*))
  unreachable

if.end:
  store i32 -2, i32* %styleFg.addr, align 4
  store i32 -2, i32* %styleBg.addr, align 4
  store i32 -2, i32* %styleAttrs.addr, align 4
  store i32 -1, i32* %cursorRow.addr, align 4
  store i32 -1, i32* %cursorCol.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %87 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %92 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %92, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %101 = load i8*, i8** %100, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %102 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 0
  %104 = load i64, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %102, i64 0, i32 2
  %106 = load i8*, i8** %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %107 = load %struct.nish_array*, %struct.nish_array** %sentGlyphs.addr, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %112 = load %struct.nish_array*, %struct.nish_array** %sentFgs.addr, align 8
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 0
  %114 = load i64, i64* %113, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %112, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %117 = load %struct.nish_array*, %struct.nish_array** %sentBgs.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %122 = load %struct.nish_array*, %struct.nish_array** %sentAttrs.addr, align 8
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 0
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %127 = load i32, i32* %i.addr, align 4
  %128 = load i32, i32* %cells.addr, align 4
  %129 = icmp slt i32 %127, %128
  br i1 %129, label %land.rhs.14, label %land.end.14

land.rhs.14:
  %130 = load i32, i32* %i.addr, align 4
  %131 = trunc i64 %89 to i32
  %132 = icmp slt i32 %130, %131
  br label %land.end.14

land.end.14:
  %133 = phi i1 [ false, %for.cond ], [ %132, %land.rhs.14 ]
  br i1 %133, label %land.rhs.13, label %land.end.13

land.rhs.13:
  %134 = load i32, i32* %i.addr, align 4
  %135 = trunc i64 %94 to i32
  %136 = icmp slt i32 %134, %135
  br label %land.end.13

land.end.13:
  %137 = phi i1 [ false, %land.end.14 ], [ %136, %land.rhs.13 ]
  br i1 %137, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %138 = load i32, i32* %i.addr, align 4
  %139 = trunc i64 %99 to i32
  %140 = icmp slt i32 %138, %139
  br label %land.end.12

land.end.12:
  %141 = phi i1 [ false, %land.end.13 ], [ %140, %land.rhs.12 ]
  br i1 %141, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %142 = load i32, i32* %i.addr, align 4
  %143 = trunc i64 %104 to i32
  %144 = icmp slt i32 %142, %143
  br label %land.end.11

land.end.11:
  %145 = phi i1 [ false, %land.end.12 ], [ %144, %land.rhs.11 ]
  br i1 %145, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %146 = load i32, i32* %i.addr, align 4
  %147 = trunc i64 %109 to i32
  %148 = icmp slt i32 %146, %147
  br label %land.end.10

land.end.10:
  %149 = phi i1 [ false, %land.end.11 ], [ %148, %land.rhs.10 ]
  br i1 %149, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %150 = load i32, i32* %i.addr, align 4
  %151 = trunc i64 %114 to i32
  %152 = icmp slt i32 %150, %151
  br label %land.end.9

land.end.9:
  %153 = phi i1 [ false, %land.end.10 ], [ %152, %land.rhs.9 ]
  br i1 %153, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %154 = load i32, i32* %i.addr, align 4
  %155 = trunc i64 %119 to i32
  %156 = icmp slt i32 %154, %155
  br label %land.end.8

land.end.8:
  %157 = phi i1 [ false, %land.end.9 ], [ %156, %land.rhs.8 ]
  br i1 %157, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %158 = load i32, i32* %i.addr, align 4
  %159 = trunc i64 %124 to i32
  %160 = icmp slt i32 %158, %159
  br label %land.end.7

land.end.7:
  %161 = phi i1 [ false, %land.end.8 ], [ %160, %land.rhs.7 ]
  br i1 %161, label %for.body, label %for.end

for.body:
  %162 = load i32, i32* %i.addr, align 4
  %163 = sext i32 %162 to i64
  %164 = bitcast i8* %91 to i32*
  %165 = getelementptr inbounds i32, i32* %164, i64 %163
  %166 = load i32, i32* %165, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  store i32 %166, i32* %glyph.addr, align 4
  %167 = load i32, i32* %i.addr, align 4
  %168 = sext i32 %167 to i64
  %169 = bitcast i8* %96 to i32*
  %170 = getelementptr inbounds i32, i32* %169, i64 %168
  %171 = load i32, i32* %170, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  store i32 %171, i32* %fg.addr, align 4
  %172 = load i32, i32* %i.addr, align 4
  %173 = sext i32 %172 to i64
  %174 = bitcast i8* %101 to i32*
  %175 = getelementptr inbounds i32, i32* %174, i64 %173
  %176 = load i32, i32* %175, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  store i32 %176, i32* %bg.addr, align 4
  %177 = load i32, i32* %i.addr, align 4
  %178 = sext i32 %177 to i64
  %179 = bitcast i8* %106 to i32*
  %180 = getelementptr inbounds i32, i32* %179, i64 %178
  %181 = load i32, i32* %180, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  store i32 %181, i32* %at.addr, align 4
  %182 = load i32, i32* %glyph.addr, align 4
  %183 = load i32, i32* %i.addr, align 4
  %184 = sext i32 %183 to i64
  %185 = bitcast i8* %111 to i32*
  %186 = getelementptr inbounds i32, i32* %185, i64 %184
  %187 = load i32, i32* %186, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %188 = icmp eq i32 %182, %187
  br i1 %188, label %land.rhs.17, label %land.end.17

land.rhs.17:
  %189 = load i32, i32* %fg.addr, align 4
  %190 = load i32, i32* %i.addr, align 4
  %191 = sext i32 %190 to i64
  %192 = bitcast i8* %116 to i32*
  %193 = getelementptr inbounds i32, i32* %192, i64 %191
  %194 = load i32, i32* %193, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %195 = icmp eq i32 %189, %194
  br label %land.end.17

land.end.17:
  %196 = phi i1 [ false, %for.body ], [ %195, %land.rhs.17 ]
  br i1 %196, label %land.rhs.16, label %land.end.16

land.rhs.16:
  %197 = load i32, i32* %bg.addr, align 4
  %198 = load i32, i32* %i.addr, align 4
  %199 = sext i32 %198 to i64
  %200 = bitcast i8* %121 to i32*
  %201 = getelementptr inbounds i32, i32* %200, i64 %199
  %202 = load i32, i32* %201, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %203 = icmp eq i32 %197, %202
  br label %land.end.16

land.end.16:
  %204 = phi i1 [ false, %land.end.17 ], [ %203, %land.rhs.16 ]
  br i1 %204, label %land.rhs.15, label %land.end.15

land.rhs.15:
  %205 = load i32, i32* %at.addr, align 4
  %206 = load i32, i32* %i.addr, align 4
  %207 = sext i32 %206 to i64
  %208 = bitcast i8* %126 to i32*
  %209 = getelementptr inbounds i32, i32* %208, i64 %207
  %210 = load i32, i32* %209, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %211 = icmp eq i32 %205, %210
  br label %land.end.15

land.end.15:
  %212 = phi i1 [ false, %land.end.16 ], [ %211, %land.rhs.15 ]
  br i1 %212, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.inc

if.end.1:
  %213 = load i32, i32* %i.addr, align 4
  %214 = load i32, i32* %w.addr, align 4
  %215 = icmp eq i32 %214, 0
  %216 = icmp eq i32 %213, -2147483648
  %217 = icmp eq i32 %214, -1
  %218 = and i1 %216, %217
  %219 = or i1 %215, %218
  br i1 %219, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %215)
  unreachable

div.ok:
  %220 = sdiv i32 %213, %214
  %221 = or i32 %220, 0
  store i32 %221, i32* %row.addr, align 4
  %222 = load i32, i32* %i.addr, align 4
  %223 = load i32, i32* %row.addr, align 4
  %224 = load i32, i32* %w.addr, align 4
  %225 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %223, i32 %224)
  %226 = extractvalue { i32, i1 } %225, 0
  %227 = extractvalue { i32, i1 } %225, 1
  br i1 %227, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %228 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %222, i32 %226)
  %229 = extractvalue { i32, i1 } %228, 0
  %230 = extractvalue { i32, i1 } %228, 1
  br i1 %230, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %229, i32* %col.addr, align 4
  %231 = load i32, i32* %fg.addr, align 4
  %232 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %231)
  store i32 %232, i32* %fgKey.addr, align 4
  %233 = load i32, i32* %bg.addr, align 4
  %234 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %233)
  store i32 %234, i32* %bgKey.addr, align 4
  %235 = load i32, i32* %cursorRow.addr, align 4
  %236 = load i32, i32* %row.addr, align 4
  %237 = icmp ne i32 %235, %236
  br i1 %237, label %lor.end, label %lor.rhs

lor.rhs:
  %238 = load i32, i32* %cursorCol.addr, align 4
  %239 = load i32, i32* %col.addr, align 4
  %240 = icmp ne i32 %238, %239
  br label %lor.end

lor.end:
  %241 = phi i1 [ true, %ovf.ok.3 ], [ %240, %lor.rhs ]
  br i1 %241, label %if.then.2, label %if.end.2

if.then.2:
  %242 = load i32, i32* %col.addr, align 4
  %243 = load i32, i32* %cursorCol.addr, align 4
  %244 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %242, i32 %243)
  %245 = extractvalue { i32, i1 } %244, 0
  %246 = extractvalue { i32, i1 } %244, 1
  br i1 %246, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %245, i32* %gap.addr, align 4
  store i1 false, i1* %bridged.addr, align 1
  %247 = load i32, i32* %cursorRow.addr, align 4
  %248 = load i32, i32* %row.addr, align 4
  %249 = icmp eq i32 %247, %248
  br i1 %249, label %land.rhs.19, label %land.end.19

land.rhs.19:
  %250 = load i32, i32* %gap.addr, align 4
  %251 = icmp sgt i32 %250, 0
  br label %land.end.19

land.end.19:
  %252 = phi i1 [ false, %ovf.ok.4 ], [ %251, %land.rhs.19 ]
  br i1 %252, label %land.rhs.18, label %land.end.18

land.rhs.18:
  %253 = load i32, i32* %gap.addr, align 4
  %254 = icmp sle i32 %253, 3
  br label %land.end.18

land.end.18:
  %255 = phi i1 [ false, %land.end.19 ], [ %254, %land.rhs.18 ]
  br i1 %255, label %if.then.3, label %if.end.3

if.then.3:
  store i1 true, i1* %bridged.addr, align 1
  %256 = load i32, i32* %i.addr, align 4
  %257 = load i32, i32* %gap.addr, align 4
  %258 = sub nsw i32 %256, %257
  store i32 %258, i32* %k.addr, align 4
  %259 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %260 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %259, i64 0, i32 2
  %261 = load i8*, i8** %260, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %262 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %263 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %262, i64 0, i32 2
  %264 = load i8*, i8** %263, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %265 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %266 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %265, i64 0, i32 2
  %267 = load i8*, i8** %266, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %268 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %268, i64 0, i32 2
  %270 = load i8*, i8** %269, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %271 = load i32, i32* %k.addr, align 4
  %272 = load i32, i32* %i.addr, align 4
  %273 = icmp slt i32 %271, %272
  br i1 %273, label %for.body.1, label %for.end.1

for.body.1:
  %274 = load i32, i32* %k.addr, align 4
  %275 = icmp sge i32 %274, 0
  %276 = xor i1 %275, true
  br i1 %276, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %277 = load i32, i32* %k.addr, align 4
  %278 = sext i32 %277 to i64
  %279 = bitcast i8* %261 to i32*
  %280 = getelementptr inbounds i32, i32* %279, i64 %278
  %281 = load i32, i32* %280, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %282 = icmp sge i32 %281, 128
  br label %lor.end.4

lor.end.4:
  %283 = phi i1 [ true, %for.body.1 ], [ %282, %lor.rhs.4 ]
  br i1 %283, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %284 = load i32, i32* %k.addr, align 4
  %285 = sext i32 %284 to i64
  %286 = bitcast i8* %264 to i32*
  %287 = getelementptr inbounds i32, i32* %286, i64 %285
  %288 = load i32, i32* %287, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %289 = load i32, i32* %styleAttrs.addr, align 4
  %290 = icmp ne i32 %288, %289
  br label %lor.end.3

lor.end.3:
  %291 = phi i1 [ true, %lor.end.4 ], [ %290, %lor.rhs.3 ]
  br i1 %291, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %292 = load i32, i32* %k.addr, align 4
  %293 = sext i32 %292 to i64
  %294 = bitcast i8* %267 to i32*
  %295 = getelementptr inbounds i32, i32* %294, i64 %293
  %296 = load i32, i32* %295, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %297 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %296)
  %298 = load i32, i32* %styleFg.addr, align 4
  %299 = icmp ne i32 %297, %298
  br label %lor.end.2

lor.end.2:
  %300 = phi i1 [ true, %lor.end.3 ], [ %299, %lor.rhs.2 ]
  br i1 %300, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %301 = load i32, i32* %k.addr, align 4
  %302 = sext i32 %301 to i64
  %303 = bitcast i8* %270 to i32*
  %304 = getelementptr inbounds i32, i32* %303, i64 %302
  %305 = load i32, i32* %304, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %306 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %305)
  %307 = load i32, i32* %styleBg.addr, align 4
  %308 = icmp ne i32 %306, %307
  br label %lor.end.1

lor.end.1:
  %309 = phi i1 [ true, %lor.end.2 ], [ %308, %lor.rhs.1 ]
  br i1 %309, label %if.then.4, label %if.end.4

if.then.4:
  store i1 false, i1* %bridged.addr, align 1
  br label %if.end.4

if.end.4:
  br label %for.inc.1

for.inc.1:
  %310 = load i32, i32* %k.addr, align 4
  %311 = add nsw i32 %310, 1
  store i32 %311, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %312 = load i1, i1* %bridged.addr, align 1
  br i1 %312, label %if.then.5, label %if.end.5

if.then.5:
  %313 = load i32, i32* %i.addr, align 4
  %314 = load i32, i32* %gap.addr, align 4
  %315 = sub nsw i32 %313, %314
  store i32 %315, i32* %k.addr.1, align 4
  %316 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %317 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %316, i64 0, i32 2
  %318 = load i8*, i8** %317, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %319 = load i32, i32* %k.addr.1, align 4
  %320 = load i32, i32* %i.addr, align 4
  %321 = icmp slt i32 %319, %320
  br i1 %321, label %for.body.2, label %for.end.2

for.body.2:
  %322 = load i32, i32* %k.addr.1, align 4
  %323 = icmp sge i32 %322, 0
  br i1 %323, label %if.then.6, label %if.end.6

if.then.6:
  %324 = load i32, i32* %k.addr.1, align 4
  %325 = sext i32 %324 to i64
  %326 = bitcast i8* %318 to i32*
  %327 = getelementptr inbounds i32, i32* %326, i64 %325
  %328 = load i32, i32* %327, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  call void @nish.Screen.put(%struct.Screen* %this, i32 %328)
  br label %if.end.6

if.end.6:
  br label %for.inc.2

for.inc.2:
  %329 = load i32, i32* %k.addr.1, align 4
  %330 = add nsw i32 %329, 1
  store i32 %330, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  br label %if.end.5

if.end.5:
  br label %if.end.3

if.end.3:
  %331 = load i1, i1* %bridged.addr, align 1
  %332 = xor i1 %331, true
  br i1 %332, label %if.then.7, label %if.end.7

if.then.7:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  %333 = load i32, i32* %cursorRow.addr, align 4
  %334 = load i32, i32* %row.addr, align 4
  %335 = icmp eq i32 %333, %334
  br i1 %335, label %land.rhs.20, label %land.end.20

land.rhs.20:
  %336 = load i32, i32* %gap.addr, align 4
  %337 = icmp sgt i32 %336, 0
  br label %land.end.20

land.end.20:
  %338 = phi i1 [ false, %if.then.7 ], [ %337, %land.rhs.20 ]
  br i1 %338, label %if.then.8, label %if.else

if.then.8:
  %339 = load i32, i32* %gap.addr, align 4
  %340 = icmp sgt i32 %339, 1
  br i1 %340, label %if.then.9, label %if.end.9

if.then.9:
  %341 = load i32, i32* %gap.addr, align 4
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %341)
  br label %if.end.9

if.end.9:
  call void @nish.Screen.put(%struct.Screen* %this, i32 67)
  br label %if.end.8

if.else:
  %342 = load i32, i32* %row.addr, align 4
  %343 = icmp eq i32 %342, 0
  br i1 %343, label %land.rhs.21, label %land.end.21

land.rhs.21:
  %344 = load i32, i32* %col.addr, align 4
  %345 = icmp eq i32 %344, 0
  br label %land.end.21

land.end.21:
  %346 = phi i1 [ false, %if.else ], [ %345, %land.rhs.21 ]
  br i1 %346, label %if.then.10, label %if.else.1

if.then.10:
  call void @nish.Screen.put(%struct.Screen* %this, i32 72)
  br label %if.end.10

if.else.1:
  %347 = load i32, i32* %row.addr, align 4
  %348 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %347, i32 1)
  %349 = extractvalue { i32, i1 } %348, 0
  %350 = extractvalue { i32, i1 } %348, 1
  br i1 %350, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %349)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %351 = load i32, i32* %col.addr, align 4
  %352 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %351, i32 1)
  %353 = extractvalue { i32, i1 } %352, 0
  %354 = extractvalue { i32, i1 } %352, 1
  br i1 %354, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %353)
  call void @nish.Screen.put(%struct.Screen* %this, i32 72)
  br label %if.end.10

if.end.10:
  br label %if.end.8

if.end.8:
  br label %if.end.7

if.end.7:
  br label %if.end.2

if.end.2:
  %355 = load i32, i32* %fgKey.addr, align 4
  %356 = load i32, i32* %styleFg.addr, align 4
  %357 = icmp ne i32 %355, %356
  br i1 %357, label %lor.end.6, label %lor.rhs.6

lor.rhs.6:
  %358 = load i32, i32* %bgKey.addr, align 4
  %359 = load i32, i32* %styleBg.addr, align 4
  %360 = icmp ne i32 %358, %359
  br label %lor.end.6

lor.end.6:
  %361 = phi i1 [ true, %if.end.2 ], [ %360, %lor.rhs.6 ]
  br i1 %361, label %lor.end.5, label %lor.rhs.5

lor.rhs.5:
  %362 = load i32, i32* %at.addr, align 4
  %363 = load i32, i32* %styleAttrs.addr, align 4
  %364 = icmp ne i32 %362, %363
  br label %lor.end.5

lor.end.5:
  %365 = phi i1 [ true, %lor.end.6 ], [ %364, %lor.rhs.5 ]
  br i1 %365, label %if.then.11, label %if.end.11

if.then.11:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  store i1 true, i1* %first.addr, align 1
  %366 = load i32, i32* %styleAttrs.addr, align 4
  %367 = icmp eq i32 %366, -2
  br i1 %367, label %lor.end.7, label %lor.rhs.7

lor.rhs.7:
  %368 = load i32, i32* %styleAttrs.addr, align 4
  %369 = load i32, i32* %at.addr, align 4
  %370 = xor i32 %369, -1
  %371 = and i32 %368, %370
  %372 = icmp ne i32 %371, 0
  br label %lor.end.7

lor.end.7:
  %373 = phi i1 [ true, %if.then.11 ], [ %372, %lor.rhs.7 ]
  br i1 %373, label %if.then.12, label %if.end.12

if.then.12:
  call void @nish.Screen.put(%struct.Screen* %this, i32 48)
  store i1 false, i1* %first.addr, align 1
  store i32 0, i32* %styleAttrs.addr, align 4
  store i32 -1, i32* %styleFg.addr, align 4
  store i32 -1, i32* %styleBg.addr, align 4
  br label %if.end.12

if.end.12:
  %374 = load i32, i32* %at.addr, align 4
  %375 = and i32 %374, 1
  %376 = icmp ne i32 %375, 0
  br i1 %376, label %land.rhs.22, label %land.end.22

land.rhs.22:
  %377 = load i32, i32* %styleAttrs.addr, align 4
  %378 = and i32 %377, 1
  %379 = icmp eq i32 %378, 0
  br label %land.end.22

land.end.22:
  %380 = phi i1 [ false, %if.end.12 ], [ %379, %land.rhs.22 ]
  br i1 %380, label %if.then.13, label %if.end.13

if.then.13:
  %381 = load i1, i1* %first.addr, align 1
  %382 = xor i1 %381, true
  br i1 %382, label %if.then.14, label %if.end.14

if.then.14:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.14

if.end.14:
  %383 = add nsw i32 48, 1
  call void @nish.Screen.put(%struct.Screen* %this, i32 %383)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.13

if.end.13:
  %384 = load i32, i32* %at.addr, align 4
  %385 = and i32 %384, 2
  %386 = icmp ne i32 %385, 0
  br i1 %386, label %land.rhs.23, label %land.end.23

land.rhs.23:
  %387 = load i32, i32* %styleAttrs.addr, align 4
  %388 = and i32 %387, 2
  %389 = icmp eq i32 %388, 0
  br label %land.end.23

land.end.23:
  %390 = phi i1 [ false, %if.end.13 ], [ %389, %land.rhs.23 ]
  br i1 %390, label %if.then.15, label %if.end.15

if.then.15:
  %391 = load i1, i1* %first.addr, align 1
  %392 = xor i1 %391, true
  br i1 %392, label %if.then.16, label %if.end.16

if.then.16:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.16

if.end.16:
  %393 = add nsw i32 48, 7
  call void @nish.Screen.put(%struct.Screen* %this, i32 %393)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.15

if.end.15:
  %394 = load i32, i32* %fgKey.addr, align 4
  %395 = load i32, i32* %styleFg.addr, align 4
  %396 = icmp ne i32 %394, %395
  br i1 %396, label %if.then.17, label %if.end.17

if.then.17:
  %397 = load i1, i1* %first.addr, align 1
  %398 = xor i1 %397, true
  br i1 %398, label %if.then.18, label %if.end.18

if.then.18:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.18

if.end.18:
  %399 = load i32, i32* %fgKey.addr, align 4
  call void @nish.Screen.putColour(%struct.Screen* %this, i32 30, i32 %399)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.17

if.end.17:
  %400 = load i32, i32* %bgKey.addr, align 4
  %401 = load i32, i32* %styleBg.addr, align 4
  %402 = icmp ne i32 %400, %401
  br i1 %402, label %if.then.19, label %if.end.19

if.then.19:
  %403 = load i1, i1* %first.addr, align 1
  %404 = xor i1 %403, true
  br i1 %404, label %if.then.20, label %if.end.20

if.then.20:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.20

if.end.20:
  %405 = load i32, i32* %bgKey.addr, align 4
  call void @nish.Screen.putColour(%struct.Screen* %this, i32 40, i32 %405)
  br label %if.end.19

if.end.19:
  call void @nish.Screen.put(%struct.Screen* %this, i32 109)
  %406 = load i32, i32* %fgKey.addr, align 4
  store i32 %406, i32* %styleFg.addr, align 4
  %407 = load i32, i32* %bgKey.addr, align 4
  store i32 %407, i32* %styleBg.addr, align 4
  %408 = load i32, i32* %at.addr, align 4
  store i32 %408, i32* %styleAttrs.addr, align 4
  br label %if.end.11

if.end.11:
  %409 = load i32, i32* %glyph.addr, align 4
  call void @nish.Screen.putGlyph(%struct.Screen* %this, i32 %409)
  %410 = load i32, i32* %i.addr, align 4
  %411 = sext i32 %410 to i64
  %412 = load i32, i32* %glyph.addr, align 4
  %413 = bitcast i8* %111 to i32*
  %414 = getelementptr inbounds i32, i32* %413, i64 %411
  store i32 %412, i32* %414, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %415 = load i32, i32* %i.addr, align 4
  %416 = sext i32 %415 to i64
  %417 = load i32, i32* %fg.addr, align 4
  %418 = bitcast i8* %116 to i32*
  %419 = getelementptr inbounds i32, i32* %418, i64 %416
  store i32 %417, i32* %419, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %420 = load i32, i32* %i.addr, align 4
  %421 = sext i32 %420 to i64
  %422 = load i32, i32* %bg.addr, align 4
  %423 = bitcast i8* %121 to i32*
  %424 = getelementptr inbounds i32, i32* %423, i64 %421
  store i32 %422, i32* %424, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %425 = load i32, i32* %i.addr, align 4
  %426 = sext i32 %425 to i64
  %427 = load i32, i32* %at.addr, align 4
  %428 = bitcast i8* %126 to i32*
  %429 = getelementptr inbounds i32, i32* %428, i64 %426
  store i32 %427, i32* %429, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %430 = load i32, i32* %row.addr, align 4
  store i32 %430, i32* %cursorRow.addr, align 4
  %431 = load i32, i32* %col.addr, align 4
  %432 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %431, i32 1)
  %433 = extractvalue { i32, i1 } %432, 0
  %434 = extractvalue { i32, i1 } %432, 1
  br i1 %434, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %433, i32* %cursorCol.addr, align 4
  %435 = load i32, i32* %cursorCol.addr, align 4
  %436 = load i32, i32* %w.addr, align 4
  %437 = icmp sge i32 %435, %436
  br i1 %437, label %if.then.21, label %if.end.21

if.then.21:
  store i32 -1, i32* %cursorRow.addr, align 4
  br label %if.end.21

if.end.21:
  br label %for.inc

for.inc:
  %438 = load i32, i32* %i.addr, align 4
  %439 = add nsw i32 %438, 1
  store i32 %439, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %440 = load i32, i32* %styleAttrs.addr, align 4
  %441 = icmp ne i32 %440, -2
  br i1 %441, label %land.rhs.24, label %land.end.24

land.rhs.24:
  %442 = load i32, i32* %styleAttrs.addr, align 4
  %443 = icmp ne i32 %442, 0
  br i1 %443, label %lor.end.9, label %lor.rhs.9

lor.rhs.9:
  %444 = load i32, i32* %styleFg.addr, align 4
  %445 = icmp ne i32 %444, -1
  br label %lor.end.9

lor.end.9:
  %446 = phi i1 [ true, %land.rhs.24 ], [ %445, %lor.rhs.9 ]
  br i1 %446, label %lor.end.8, label %lor.rhs.8

lor.rhs.8:
  %447 = load i32, i32* %styleBg.addr, align 4
  %448 = icmp ne i32 %447, -1
  br label %lor.end.8

lor.end.8:
  %449 = phi i1 [ true, %lor.end.9 ], [ %448, %lor.rhs.8 ]
  br label %land.end.24

land.end.24:
  %450 = phi i1 [ false, %for.end ], [ %449, %lor.end.8 ]
  br i1 %450, label %if.then.22, label %if.end.22

if.then.22:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  call void @nish.Screen.put(%struct.Screen* %this, i32 48)
  call void @nish.Screen.put(%struct.Screen* %this, i32 109)
  br label %if.end.22

if.end.22:
  %451 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %452 = load %struct.nish_array*, %struct.nish_array** %451, align 8, !tbaa !32
  %453 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %454 = load i32, i32* %453, align 4, !tbaa !33
  %455 = call i64 @nish_arena_mark()
  %456 = call i8* @nish.termBytesText(%struct.nish_array* %452, i32 %454)
  %457 = call i8* @nish_arena_keep(i64 %455, i8* %456)
  ret i8* %457

ovf.fail:
  %ovf.op = phi i32 [ 2, %land.rhs ], [ 0, %ovf.ok ], [ 2, %div.ok ], [ 1, %ovf.ok.2 ], [ 1, %if.then.2 ], [ 0, %if.else.1 ], [ 0, %ovf.ok.5 ], [ 0, %if.end.11 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.Canvas.constructor(%struct.Canvas* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %struct.Screen* noundef nonnull align 8 dereferenceable(88) %screen) #2 {
entry:
  %fill.at = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  store %struct.Screen* %screen, %struct.Screen** %0, align 8, !tbaa !37
  %1 = getelementptr inbounds %struct.Screen, %struct.Screen* %screen, i32 0, i32 9
  %2 = load i32, i32* %1, align 4, !tbaa !21
  %3 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  store i32 %2, i32* %3, align 4, !tbaa !38
  %4 = getelementptr inbounds %struct.Screen, %struct.Screen* %screen, i32 0, i32 10
  %5 = load i32, i32* %4, align 4, !tbaa !22
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %5, i32 2)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  store i32 %7, i32* %9, align 4, !tbaa !39
  %10 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !38
  %12 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %13 = load i32, i32* %12, align 4, !tbaa !39
  %14 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = sext i32 %15 to i64
  %18 = icmp ule i64 %17, 2147483647
  br i1 %18, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok:
  %19 = call i8* @nish_alloc_struct(i64 24)
  %20 = bitcast i8* %19 to %struct.nish_array*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  store i64 %17, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 1
  store i64 %17, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = mul i64 %17, 4
  %24 = call i8* @nish_alloc_struct(i64 %23)
  call void @llvm.memset.p0i8.i64(i8* align 8 %24, i8 0, i64 %23, i1 false), !alias.scope !4, !noalias !3
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  store i8* %24, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  store %struct.nish_array* %20, %struct.nish_array** %26, align 8, !tbaa !40
  %27 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !40
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %31 = load i64, i64* %fill.at, align 8
  %32 = icmp slt i64 %31, %30
  br i1 %32, label %fill.body, label %fill.end

fill.body:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %35 = bitcast i8* %34 to i32*
  %36 = getelementptr inbounds i32, i32* %35, i64 %31
  store i32 -1, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %37 = add i64 %31, 1
  store i64 %37, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define void @nish.Canvas.clear(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %colour) #2 {
entry:
  %fill.at = alloca i64, align 8
  %rows.addr = alloca i32, align 4
  %row.addr = alloca i32, align 4
  %col.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !40
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  store i64 0, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %4 = load i64, i64* %fill.at, align 8
  %5 = icmp slt i64 %4, %3
  br i1 %5, label %fill.body, label %fill.end

fill.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %4
  store i32 %colour, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %12 = load i32, i32* %11, align 4, !tbaa !39
  %13 = ashr i32 %12, 1
  store i32 %13, i32* %rows.addr, align 4
  store i32 0, i32* %row.addr, align 4
  br label %for.cond

for.cond:
  %14 = load i32, i32* %row.addr, align 4
  %15 = load i32, i32* %rows.addr, align 4
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  store i32 0, i32* %col.addr, align 4
  br label %for.cond.1

for.cond.1:
  %17 = load i32, i32* %col.addr, align 4
  %18 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !38
  %20 = icmp slt i32 %17, %19
  br i1 %20, label %for.body.1, label %for.end.1

for.body.1:
  %21 = load i32, i32* %col.addr, align 4
  %22 = load i32, i32* %row.addr, align 4
  call void @nish.Canvas.paintCell(%struct.Canvas* %this, i32 %21, i32 %22)
  br label %for.inc.1

for.inc.1:
  %23 = load i32, i32* %col.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %col.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %row.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %row.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @nish.Canvas.pixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x, i32 noundef %y) #2 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp slt i32 %y, 0
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !38
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %8 = load i32, i32* %7, align 4, !tbaa !39
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !40
  %13 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !38
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %y, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %x)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %21 = sext i32 %19 to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 %21, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %21, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %21
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  ret i32 %29

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.end ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.Canvas.setPixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %colour) #2 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %1 = icmp slt i32 %y, 0
  br label %lor.end.2

lor.end.2:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.2 ]
  br i1 %2, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %3 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !38
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %8 = load i32, i32* %7, align 4, !tbaa !39
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !40
  %13 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !38
  %15 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %y, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %x)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %21 = sext i32 %19 to i64
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 %21, %23
  br i1 %24, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %21, i64 %23)
  unreachable

bounds.ok:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast i8* %26 to i32*
  %28 = getelementptr inbounds i32, i32* %27, i64 %21
  store i32 %colour, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  %29 = ashr i32 %y, 1
  call void @nish.Canvas.paintCell(%struct.Canvas* %this, i32 %x, i32 %29)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.end ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.Canvas.fillRect(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x, i32 noundef %y, i32 noundef %w, i32 noundef %h, i32 noundef %colour) #2 {
entry:
  %left.addr = alloca i32, align 4
  %top.addr = alloca i32, align 4
  %right.addr = alloca i32, align 4
  %bottom.addr = alloca i32, align 4
  %py.addr = alloca i32, align 4
  %px.addr = alloca i32, align 4
  %row.addr = alloca i32, align 4
  %col.addr = alloca i32, align 4
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 0, %cond.true ], [ %x, %cond.false ]
  store i32 %1, i32* %left.addr, align 4
  %2 = icmp slt i32 %y, 0
  br i1 %2, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %3 = phi i32 [ 0, %cond.true.1 ], [ %y, %cond.false.1 ]
  store i32 %3, i32* %top.addr, align 4
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %w)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !38
  %9 = icmp sgt i32 %5, %8
  br i1 %9, label %cond.true.2, label %cond.false.2

cond.true.2:
  %10 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !38
  br label %cond.end.2

cond.false.2:
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 %w)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end.2

cond.end.2:
  %15 = phi i32 [ %11, %cond.true.2 ], [ %13, %ovf.ok.1 ]
  store i32 %15, i32* %right.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %y, i32 %h)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %19 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %20 = load i32, i32* %19, align 4, !tbaa !39
  %21 = icmp sgt i32 %17, %20
  br i1 %21, label %cond.true.3, label %cond.false.3

cond.true.3:
  %22 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %23 = load i32, i32* %22, align 4, !tbaa !39
  br label %cond.end.3

cond.false.3:
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %y, i32 %h)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  br label %cond.end.3

cond.end.3:
  %27 = phi i32 [ %23, %cond.true.3 ], [ %25, %ovf.ok.3 ]
  store i32 %27, i32* %bottom.addr, align 4
  %28 = load i32, i32* %top.addr, align 4
  store i32 %28, i32* %py.addr, align 4
  %29 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !40
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %35 = load i32, i32* %py.addr, align 4
  %36 = load i32, i32* %bottom.addr, align 4
  %37 = icmp slt i32 %35, %36
  br i1 %37, label %for.body, label %for.end

for.body:
  %38 = load i32, i32* %left.addr, align 4
  store i32 %38, i32* %px.addr, align 4
  %39 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !40
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %45 = load i32, i32* %px.addr, align 4
  %46 = load i32, i32* %right.addr, align 4
  %47 = icmp slt i32 %45, %46
  br i1 %47, label %for.body.1, label %for.end.1

for.body.1:
  %48 = load i32, i32* %py.addr, align 4
  %49 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %50 = load i32, i32* %49, align 4, !tbaa !38
  %51 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %48, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %54 = load i32, i32* %px.addr, align 4
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %52, i32 %54)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %58 = sext i32 %56 to i64
  %59 = icmp ult i64 %58, %42
  br i1 %59, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %58, i64 %42)
  unreachable

bounds.ok:
  %60 = bitcast i8* %44 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 %58
  store i32 %colour, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !35
  br label %for.inc.1

for.inc.1:
  %62 = load i32, i32* %px.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %px.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %64 = load i32, i32* %py.addr, align 4
  %65 = add nsw i32 %64, 1
  store i32 %65, i32* %py.addr, align 4
  br label %for.cond

for.end:
  %66 = load i32, i32* %top.addr, align 4
  %67 = ashr i32 %66, 1
  store i32 %67, i32* %row.addr, align 4
  br label %for.cond.2

for.cond.2:
  %68 = load i32, i32* %row.addr, align 4
  %69 = load i32, i32* %bottom.addr, align 4
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %69, i32 1)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %73 = ashr i32 %71, 1
  %74 = icmp slt i32 %68, %73
  br i1 %74, label %for.body.2, label %for.end.2

for.body.2:
  %75 = load i32, i32* %left.addr, align 4
  store i32 %75, i32* %col.addr, align 4
  br label %for.cond.3

for.cond.3:
  %76 = load i32, i32* %col.addr, align 4
  %77 = load i32, i32* %right.addr, align 4
  %78 = icmp slt i32 %76, %77
  br i1 %78, label %for.body.3, label %for.end.3

for.body.3:
  %79 = load i32, i32* %col.addr, align 4
  %80 = load i32, i32* %row.addr, align 4
  call void @nish.Canvas.paintCell(%struct.Canvas* %this, i32 %79, i32 %80)
  br label %for.inc.3

for.inc.3:
  %81 = load i32, i32* %col.addr, align 4
  %82 = add nsw i32 %81, 1
  store i32 %82, i32* %col.addr, align 4
  br label %for.cond.3

for.end.3:
  br label %for.inc.2

for.inc.2:
  %83 = load i32, i32* %row.addr, align 4
  %84 = add nsw i32 %83, 1
  store i32 %84, i32* %row.addr, align 4
  br label %for.cond.2

for.end.2:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 0, %cond.end.1 ], [ 0, %cond.false.2 ], [ 0, %cond.end.2 ], [ 0, %cond.false.3 ], [ 2, %for.body.1 ], [ 0, %ovf.ok.4 ], [ 0, %for.cond.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.Canvas.line(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %x0, i32 noundef %y0, i32 noundef %x1, i32 noundef %y1, i32 noundef %colour) #2 {
entry:
  %dx.addr = alloca i32, align 4
  %dy.addr = alloca i32, align 4
  %sx.addr = alloca i32, align 4
  %sy.addr = alloca i32, align 4
  %err.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %twice.addr = alloca i32, align 4
  %0 = icmp sgt i32 %x1, %x0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = sub nsw i32 %x1, %x0
  br label %cond.end

cond.false:
  %2 = sub nsw i32 %x0, %x1
  br label %cond.end

cond.end:
  %3 = phi i32 [ %1, %cond.true ], [ %2, %cond.false ]
  store i32 %3, i32* %dx.addr, align 4
  %4 = icmp sgt i32 %y1, %y0
  br i1 %4, label %cond.true.1, label %cond.false.1

cond.true.1:
  %5 = sub nsw i32 %y0, %y1
  br label %cond.end.1

cond.false.1:
  %6 = sub nsw i32 %y1, %y0
  br label %cond.end.1

cond.end.1:
  %7 = phi i32 [ %5, %cond.true.1 ], [ %6, %cond.false.1 ]
  store i32 %7, i32* %dy.addr, align 4
  %8 = icmp slt i32 %x0, %x1
  br i1 %8, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %9 = phi i32 [ 1, %cond.true.2 ], [ -1, %cond.false.2 ]
  store i32 %9, i32* %sx.addr, align 4
  %10 = icmp slt i32 %y0, %y1
  br i1 %10, label %cond.true.3, label %cond.false.3

cond.true.3:
  br label %cond.end.3

cond.false.3:
  br label %cond.end.3

cond.end.3:
  %11 = phi i32 [ 1, %cond.true.3 ], [ -1, %cond.false.3 ]
  store i32 %11, i32* %sy.addr, align 4
  %12 = load i32, i32* %dx.addr, align 4
  %13 = load i32, i32* %dy.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %err.addr, align 4
  store i32 %x0, i32* %x.addr, align 4
  store i32 %y0, i32* %y.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %17 = load i32, i32* %x.addr, align 4
  %18 = load i32, i32* %y.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %this, i32 %17, i32 %18, i32 %colour)
  %19 = load i32, i32* %x.addr, align 4
  %20 = icmp eq i32 %19, %x1
  br i1 %20, label %land.rhs, label %land.end

land.rhs:
  %21 = load i32, i32* %y.addr, align 4
  %22 = icmp eq i32 %21, %y1
  br label %land.end

land.end:
  %23 = phi i1 [ false, %while.body ], [ %22, %land.rhs ]
  br i1 %23, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %24 = load i32, i32* %err.addr, align 4
  %25 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 2, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %26, i32* %twice.addr, align 4
  %28 = load i32, i32* %twice.addr, align 4
  %29 = load i32, i32* %dy.addr, align 4
  %30 = icmp sge i32 %28, %29
  br i1 %30, label %if.then.1, label %if.end.1

if.then.1:
  %31 = load i32, i32* %err.addr, align 4
  %32 = load i32, i32* %dy.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %34, i32* %err.addr, align 4
  %36 = load i32, i32* %x.addr, align 4
  %37 = load i32, i32* %sx.addr, align 4
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %36, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %39, i32* %x.addr, align 4
  br label %if.end.1

if.end.1:
  %41 = load i32, i32* %twice.addr, align 4
  %42 = load i32, i32* %dx.addr, align 4
  %43 = icmp sle i32 %41, %42
  br i1 %43, label %if.then.2, label %if.end.2

if.then.2:
  %44 = load i32, i32* %err.addr, align 4
  %45 = load i32, i32* %dx.addr, align 4
  %46 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %45)
  %47 = extractvalue { i32, i1 } %46, 0
  %48 = extractvalue { i32, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %47, i32* %err.addr, align 4
  %49 = load i32, i32* %y.addr, align 4
  %50 = load i32, i32* %sy.addr, align 4
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 %50)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %52, i32* %y.addr, align 4
  br label %if.end.2

if.end.2:
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  %ovf.op = phi i32 [ 0, %cond.end.3 ], [ 2, %if.end ], [ 0, %if.then.1 ], [ 0, %ovf.ok.2 ], [ 0, %if.then.2 ], [ 0, %ovf.ok.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish.Canvas.text(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %col, i32 noundef %row, i8* noundef nonnull noalias readonly align 8 %s, i32 noundef %fg) #2 {
entry:
  %n.addr = alloca i32, align 4
  %column.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %top.addr = alloca i32, align 4
  %bg.addr = alloca i32, align 4
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 %col, i32* %column.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %3, %4
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = load i32, i32* %column.addr, align 4
  %7 = mul nsw i32 %row, 2
  %8 = call i32 @nish.Canvas.pixel(%struct.Canvas* %this, i32 %6, i32 %7)
  store i32 %8, i32* %top.addr, align 4
  %9 = load i32, i32* %top.addr, align 4
  %10 = icmp sge i32 %9, 0
  br i1 %10, label %cond.true, label %cond.false

cond.true:
  %11 = load i32, i32* %top.addr, align 4
  br label %cond.end

cond.false:
  %12 = load i32, i32* %column.addr, align 4
  %13 = mul nsw i32 %row, 2
  %14 = add nsw i32 %13, 1
  %15 = call i32 @nish.Canvas.pixel(%struct.Canvas* %this, i32 %12, i32 %14)
  br label %cond.end

cond.end:
  %16 = phi i32 [ %11, %cond.true ], [ %15, %cond.false ]
  store i32 %16, i32* %bg.addr, align 4
  %17 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %18 = load %struct.Screen*, %struct.Screen** %17, align 8, !tbaa !37
  %19 = load i32, i32* %column.addr, align 4
  %20 = load i32, i32* %i.addr, align 4
  %21 = load i32, i32* %n.addr, align 4
  %22 = call i32 @nish.termCodePointAt(i8* %s, i32 %20, i32 %21)
  %23 = load i32, i32* %bg.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %18, i32 %19, i32 %row, i32 %22, i32 %fg, i32 %23, i32 0)
  %24 = load i32, i32* %i.addr, align 4
  %25 = load i32, i32* %i.addr, align 4
  %26 = load i32, i32* %n.addr, align 4
  %27 = call i32 @nish.termCodePointUnits(i8* %s, i32 %25, i32 %26)
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %29, i32* %i.addr, align 4
  %31 = load i32, i32* %column.addr, align 4
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 1)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %33, i32* %column.addr, align 4
  br label %while.cond

while.end:
  %35 = load i32, i32* %column.addr, align 4
  ret i32 %35

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish.Canvas.paintCell(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this, i32 noundef %col, i32 noundef %row) #2 {
entry:
  %top.addr = alloca i32, align 4
  %bottom.addr = alloca i32, align 4
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %row, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i32 @nish.Canvas.pixel(%struct.Canvas* %this, i32 %col, i32 %1)
  store i32 %3, i32* %top.addr, align 4
  %4 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %row, i32 2)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %10 = call i32 @nish.Canvas.pixel(%struct.Canvas* %this, i32 %col, i32 %8)
  store i32 %10, i32* %bottom.addr, align 4
  %11 = load i32, i32* %top.addr, align 4
  %12 = icmp slt i32 %11, 0
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %bottom.addr, align 4
  %14 = icmp slt i32 %13, 0
  br label %land.end

land.end:
  %15 = phi i1 [ false, %ovf.ok.2 ], [ %14, %land.rhs ]
  br i1 %15, label %if.then, label %if.else

if.then:
  %16 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %17 = load %struct.Screen*, %struct.Screen** %16, align 8, !tbaa !37
  call void @nish.Screen.set(%struct.Screen* %17, i32 %col, i32 %row, i32 32, i32 -1, i32 -1, i32 0)
  br label %if.end

if.else:
  %18 = load i32, i32* %top.addr, align 4
  %19 = icmp slt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.else.1

if.then.1:
  %20 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %21 = load %struct.Screen*, %struct.Screen** %20, align 8, !tbaa !37
  %22 = load i32, i32* %bottom.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %21, i32 %col, i32 %row, i32 9604, i32 %22, i32 -1, i32 0)
  br label %if.end.1

if.else.1:
  %23 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %24 = load %struct.Screen*, %struct.Screen** %23, align 8, !tbaa !37
  %25 = load i32, i32* %top.addr, align 4
  %26 = load i32, i32* %bottom.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %24, i32 %col, i32 %row, i32 9600, i32 %25, i32 %26, i32 0)
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.KeyEvent.constructor(%struct.KeyEvent* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %kind, i32 noundef %code) #3 {
entry:
  %0 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %this, i32 0, i32 0
  store i32 %kind, i32* %0, align 4, !tbaa !42
  %1 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %this, i32 0, i32 1
  store i32 %code, i32* %1, align 4, !tbaa !43
  ret void
}

define void @nish.KeyDecoder.constructor(%struct.KeyDecoder* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, double noundef %escapeTimeoutMs) #3 {
entry:
  %0 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  store double %escapeTimeoutMs, double* %0, align 8, !tbaa !46
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !47
  %7 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  store double 0x0000000000000000, double* %7, align 8, !tbaa !48
  ret void
}

define noundef zeroext i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !47
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = icmp sgt i32 %4, 0
  ret i1 %5
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(24) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %count, double noundef %nowMs) #2 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %work.addr = alloca %struct.nish_array*, align 8
  %pending.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %rest.addr = alloca %struct.nish_array*, align 8
  %k.addr.2 = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %this, double %nowMs)
  store %struct.nish_array* %0, %struct.nish_array** %events.addr, align 8
  %1 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !47
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %held.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = call i32 @nish.termClamp(i32 %count, i32 0, i32 %8)
  store i32 %9, i32* %n.addr, align 4
  %10 = load i32, i32* %held.addr, align 4
  %11 = load i32, i32* %n.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  %15 = icmp eq i32 %13, 0
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %16

if.end:
  %17 = load i32, i32* %held.addr, align 4
  %18 = load i32, i32* %n.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %22 = sext i32 %20 to i64
  %23 = icmp ule i64 %22, 2147483647
  br i1 %23, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.12 to i8*))
  unreachable

len.ok:
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 %22, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 %22, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = call i8* @nish_alloc_struct(i64 %22)
  call void @llvm.memset.p0i8.i64(i8* align 8 %28, i8 0, i64 %22, i1 false), !alias.scope !4, !noalias !3
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %25, %struct.nish_array** %work.addr, align 8
  %30 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !47
  store %struct.nish_array* %31, %struct.nish_array** %pending.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %pending.addr, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %42 = load i32, i32* %k.addr, align 4
  %43 = trunc i64 %34 to i32
  %44 = icmp slt i32 %42, %43
  br i1 %44, label %land.rhs, label %land.end

land.rhs:
  %45 = load i32, i32* %k.addr, align 4
  %46 = trunc i64 %39 to i32
  %47 = icmp slt i32 %45, %46
  br label %land.end

land.end:
  %48 = phi i1 [ false, %for.cond ], [ %47, %land.rhs ]
  br i1 %48, label %for.body, label %for.end

for.body:
  %49 = load i32, i32* %k.addr, align 4
  %50 = sext i32 %49 to i64
  %51 = load i32, i32* %k.addr, align 4
  %52 = sext i32 %51 to i64
  %53 = bitcast i8* %36 to i8*
  %54 = getelementptr inbounds i8, i8* %53, i64 %52
  %55 = load i8, i8* %54, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = bitcast i8* %41 to i8*
  %57 = getelementptr inbounds i8, i8* %56, i64 %50
  store i8 %55, i8* %57, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %58 = load i32, i32* %k.addr, align 4
  %59 = add nsw i32 %58, 1
  store i32 %59, i32* %k.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %k.addr.1, align 4
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %64 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %69 = load i32, i32* %k.addr.1, align 4
  %70 = load i32, i32* %n.addr, align 4
  %71 = icmp slt i32 %69, %70
  br i1 %71, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %72 = load i32, i32* %k.addr.1, align 4
  %73 = trunc i64 %61 to i32
  %74 = icmp slt i32 %72, %73
  br label %land.end.1

land.end.1:
  %75 = phi i1 [ false, %for.cond.1 ], [ %74, %land.rhs.1 ]
  br i1 %75, label %for.body.1, label %for.end.1

for.body.1:
  %76 = load i32, i32* %held.addr, align 4
  %77 = load i32, i32* %k.addr.1, align 4
  %78 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %76, i32 %77)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %81 = sext i32 %79 to i64
  %82 = load i32, i32* %k.addr.1, align 4
  %83 = sext i32 %82 to i64
  %84 = bitcast i8* %63 to i8*
  %85 = getelementptr inbounds i8, i8* %84, i64 %83
  %86 = load i8, i8* %85, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %87 = icmp ult i64 %81, %66
  br i1 %87, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %81, i64 %66)
  unreachable

bounds.ok:
  %88 = bitcast i8* %68 to i8*
  %89 = getelementptr inbounds i8, i8* %88, i64 %81
  store i8 %86, i8* %89, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc.1

for.inc.1:
  %90 = load i32, i32* %k.addr.1, align 4
  %91 = add nsw i32 %90, 1
  store i32 %91, i32* %k.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %92 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %93 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %94 = call i32 @nish.termDecodeKeys(%struct.nish_array* %92, i1 false, %struct.nish_array* %93)
  store i32 %94, i32* %used.addr, align 4
  %95 = call i8* @nish_alloc_struct(i64 24)
  %96 = bitcast i8* %95 to %struct.nish_array*
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  store i64 0, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 1
  store i64 0, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  store i8* null, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %96, %struct.nish_array** %rest.addr, align 8
  %100 = load i32, i32* %used.addr, align 4
  store i32 %100, i32* %k.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %101 = load i32, i32* %k.addr.2, align 4
  %102 = load i32, i32* %held.addr, align 4
  %103 = load i32, i32* %n.addr, align 4
  %104 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %102, i32 %103)
  %105 = extractvalue { i32, i1 } %104, 0
  %106 = extractvalue { i32, i1 } %104, 1
  br i1 %106, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %107 = icmp slt i32 %101, %105
  br i1 %107, label %for.body.2, label %for.end.2

for.body.2:
  %108 = load i32, i32* %k.addr.2, align 4
  %109 = icmp sge i32 %108, 0
  br i1 %109, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %110 = load i32, i32* %k.addr.2, align 4
  %111 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = trunc i64 %113 to i32
  %115 = icmp slt i32 %110, %114
  br label %land.end.2

land.end.2:
  %116 = phi i1 [ false, %for.body.2 ], [ %115, %land.rhs.2 ]
  %117 = xor i1 %116, true
  br i1 %117, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_panic(i8* bitcast ({ i64, [61 x i8] }* @.str.14 to i8*))
  unreachable

if.end.1:
  %118 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %120 = load i32, i32* %k.addr.2, align 4
  %121 = sext i32 %120 to i64
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %119, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %124 = bitcast i8* %123 to i8*
  %125 = getelementptr inbounds i8, i8* %124, i64 %121
  %126 = load i8, i8* %125, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 0
  %128 = load i64, i64* %127, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 1
  %130 = load i64, i64* %129, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %131 = icmp eq i64 %128, %130
  br i1 %131, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %118, i64 1)
  br label %push.store

push.store:
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %134 = bitcast i8* %133 to i8*
  %135 = getelementptr inbounds i8, i8* %134, i64 %128
  store i8 %126, i8* %135, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %136 = add i64 %128, 1
  store i64 %136, i64* %127, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %137 = trunc i64 %136 to i32
  br label %for.inc.2

for.inc.2:
  %138 = load i32, i32* %k.addr.2, align 4
  %139 = add nsw i32 %138, 1
  store i32 %139, i32* %k.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %140 = load i32, i32* %held.addr, align 4
  %141 = icmp eq i32 %140, 0
  br i1 %141, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %142 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = trunc i64 %144 to i32
  %146 = icmp sgt i32 %145, 0
  br label %land.end.3

land.end.3:
  %147 = phi i1 [ false, %for.end.2 ], [ %146, %land.rhs.3 ]
  br i1 %147, label %if.then.2, label %if.end.2

if.then.2:
  %148 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  store double %nowMs, double* %148, align 8, !tbaa !48
  br label %if.end.2

if.end.2:
  %149 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %150 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %149, %struct.nish_array** %150, align 8, !tbaa !47
  %151 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %151

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(24) nocapture %this, double noundef %nowMs) #2 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %events.addr, align 8
  %5 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !47
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  store i32 %9, i32* %held.addr, align 4
  %10 = load i32, i32* %held.addr, align 4
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  %13 = load double, double* %12, align 8, !tbaa !48
  %14 = fsub double %nowMs, %13
  %15 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  %16 = load double, double* %15, align 8, !tbaa !46
  %17 = fcmp olt double %14, %16
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %entry ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %19

if.end:
  %20 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !47
  %22 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %23 = call i32 @nish.termDecodeKeys(%struct.nish_array* %21, i1 true, %struct.nish_array* %22)
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !47
  %30 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %30
}

define internal noundef i32 @nish.termArrowKind(i32 noundef %b) #1 {
entry:
  %0 = icmp eq i32 %b, 65
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 2

if.end:
  %1 = icmp eq i32 %b, 66
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 3

if.end.1:
  %2 = icmp eq i32 %b, 67
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 4

if.end.2:
  %3 = icmp eq i32 %b, 68
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %4 = phi i32 [ 5, %cond.true ], [ 13, %cond.false ]
  ret i32 %4
}

define internal noundef i32 @nish.termAsciiKind(i32 noundef %b) #1 {
entry:
  %0 = icmp eq i32 %b, 3
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 9

if.end:
  %1 = icmp eq i32 %b, 13
  br i1 %1, label %lor.end, label %lor.rhs

lor.rhs:
  %2 = icmp eq i32 %b, 10
  br label %lor.end

lor.end:
  %3 = phi i1 [ true, %if.end ], [ %2, %lor.rhs ]
  br i1 %3, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 6

if.end.1:
  %4 = icmp eq i32 %b, 32
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 7

if.end.2:
  %5 = icmp eq i32 %b, 9
  br i1 %5, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 10

if.end.3:
  %6 = icmp eq i32 %b, 127
  br i1 %6, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %7 = icmp eq i32 %b, 8
  br label %lor.end.1

lor.end.1:
  %8 = phi i1 [ true, %if.end.3 ], [ %7, %lor.rhs.1 ]
  br i1 %8, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 11

if.end.4:
  %9 = icmp slt i32 %b, 32
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ 12, %cond.true ], [ 1, %cond.false ]
  ret i32 %10
}

define internal noundef i32 @nish.termDecodeKeys(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #2 {
entry:
  %i.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %next.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %final.addr = alloca i32, align 4
  %final.addr.1 = alloca i32, align 4
  %width.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %good.addr = alloca i32, align 4
  %stopped.addr = alloca i1, align 1
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp sge i32 %5, 0
  %7 = xor i1 %6, true
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.15 to i8*))
  unreachable

if.end:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 %9
  %14 = load i8, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = zext i8 %14 to i32
  store i32 %15, i32* %b.addr, align 4
  %16 = load i32, i32* %b.addr, align 4
  %17 = icmp eq i32 %16, 27
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  %23 = icmp sge i32 %19, %22
  br i1 %23, label %if.then.2, label %if.end.2

if.then.2:
  %24 = xor i1 %last, true
  br i1 %24, label %if.then.3, label %if.end.3

if.then.3:
  %25 = load i32, i32* %i.addr, align 4
  ret i32 %25

if.end.3:
  %26 = call i8* @nish_alloc_struct(i64 8)
  %27 = bitcast i8* %26 to %struct.KeyEvent*
  %28 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %27, i32 8, i32 %28)
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = icmp eq i64 %30, %32
  br i1 %33, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to %struct.KeyEvent**
  %37 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %36, i64 %30
  store %struct.KeyEvent* %27, %struct.KeyEvent** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %38 = add i64 %30, 1
  store i64 %38, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = load i32, i32* %i.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %i.addr, align 4
  br label %while.cond

if.end.2:
  %42 = load i32, i32* %i.addr, align 4
  %43 = add nsw i32 %42, 1
  %44 = sext i32 %43 to i64
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %47 = bitcast i8* %46 to i8*
  %48 = getelementptr inbounds i8, i8* %47, i64 %44
  %49 = load i8, i8* %48, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = zext i8 %49 to i32
  store i32 %50, i32* %next.addr, align 4
  %51 = load i32, i32* %next.addr, align 4
  %52 = icmp eq i32 %51, 91
  br i1 %52, label %if.then.4, label %if.end.4

if.then.4:
  %53 = load i32, i32* %i.addr, align 4
  %54 = add nsw i32 %53, 2
  store i32 %54, i32* %j.addr, align 4
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %56 = load i64, i64* %55, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %59 = load i32, i32* %j.addr, align 4
  %60 = trunc i64 %56 to i32
  %61 = icmp slt i32 %59, %60
  br i1 %61, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %62 = load i32, i32* %j.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %58 to i8*
  %65 = getelementptr inbounds i8, i8* %64, i64 %63
  %66 = load i8, i8* %65, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %67 = zext i8 %66 to i32
  %68 = icmp sge i32 %67, 32
  br label %land.end.1

land.end.1:
  %69 = phi i1 [ false, %while.cond.1 ], [ %68, %land.rhs.1 ]
  br i1 %69, label %land.rhs, label %land.end

land.rhs:
  %70 = load i32, i32* %j.addr, align 4
  %71 = sext i32 %70 to i64
  %72 = bitcast i8* %58 to i8*
  %73 = getelementptr inbounds i8, i8* %72, i64 %71
  %74 = load i8, i8* %73, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = zext i8 %74 to i32
  %76 = icmp slt i32 %75, 64
  br label %land.end

land.end:
  %77 = phi i1 [ false, %land.end.1 ], [ %76, %land.rhs ]
  br i1 %77, label %while.body.1, label %while.end.1

while.body.1:
  %78 = load i32, i32* %j.addr, align 4
  %79 = add nsw i32 %78, 1
  store i32 %79, i32* %j.addr, align 4
  br label %while.cond.1

while.end.1:
  %80 = load i32, i32* %j.addr, align 4
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = trunc i64 %82 to i32
  %84 = icmp sge i32 %80, %83
  br i1 %84, label %if.then.5, label %if.end.5

if.then.5:
  %85 = xor i1 %last, true
  br i1 %85, label %if.then.6, label %if.end.6

if.then.6:
  %86 = load i32, i32* %i.addr, align 4
  ret i32 %86

if.end.6:
  %87 = call i8* @nish_alloc_struct(i64 8)
  %88 = bitcast i8* %87 to %struct.KeyEvent*
  %89 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %88, i32 8, i32 %89)
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %94 = icmp eq i64 %91, %93
  br i1 %94, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %96 = load i8*, i8** %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %97 = bitcast i8* %96 to %struct.KeyEvent**
  %98 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %97, i64 %91
  store %struct.KeyEvent* %88, %struct.KeyEvent** %98, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %99 = add i64 %91, 1
  store i64 %99, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = trunc i64 %99 to i32
  %101 = load i32, i32* %i.addr, align 4
  %102 = add nsw i32 %101, 1
  store i32 %102, i32* %i.addr, align 4
  br label %while.cond

if.end.5:
  %103 = load i32, i32* %j.addr, align 4
  %104 = sext i32 %103 to i64
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %106 = load i8*, i8** %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %107 = bitcast i8* %106 to i8*
  %108 = getelementptr inbounds i8, i8* %107, i64 %104
  %109 = load i8, i8* %108, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %110 = zext i8 %109 to i32
  store i32 %110, i32* %final.addr, align 4
  %111 = load i32, i32* %final.addr, align 4
  %112 = icmp sge i32 %111, 64
  br i1 %112, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %113 = load i32, i32* %final.addr, align 4
  %114 = icmp slt i32 %113, 127
  br label %land.end.2

land.end.2:
  %115 = phi i1 [ false, %if.end.5 ], [ %114, %land.rhs.2 ]
  br i1 %115, label %if.then.7, label %if.else

if.then.7:
  %116 = call i8* @nish_alloc_struct(i64 8)
  %117 = bitcast i8* %116 to %struct.KeyEvent*
  %118 = load i32, i32* %final.addr, align 4
  %119 = call i32 @nish.termArrowKind(i32 %118)
  %120 = load i32, i32* %final.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %117, i32 %119, i32 %120)
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %125 = icmp eq i64 %122, %124
  br i1 %125, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %127 = load i8*, i8** %126, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %128 = bitcast i8* %127 to %struct.KeyEvent**
  %129 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %128, i64 %122
  store %struct.KeyEvent* %117, %struct.KeyEvent** %129, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %130 = add i64 %122, 1
  store i64 %130, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %131 = trunc i64 %130 to i32
  %132 = load i32, i32* %j.addr, align 4
  %133 = add nsw i32 %132, 1
  store i32 %133, i32* %i.addr, align 4
  br label %if.end.7

if.else:
  %134 = call i8* @nish_alloc_struct(i64 8)
  %135 = bitcast i8* %134 to %struct.KeyEvent*
  %136 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %135, i32 8, i32 %136)
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %138 = load i64, i64* %137, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %140 = load i64, i64* %139, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %141 = icmp eq i64 %138, %140
  br i1 %141, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %143 = load i8*, i8** %142, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %144 = bitcast i8* %143 to %struct.KeyEvent**
  %145 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %144, i64 %138
  store %struct.KeyEvent* %135, %struct.KeyEvent** %145, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %146 = add i64 %138, 1
  store i64 %146, i64* %137, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %147 = trunc i64 %146 to i32
  %148 = load i32, i32* %i.addr, align 4
  %149 = add nsw i32 %148, 1
  store i32 %149, i32* %i.addr, align 4
  br label %if.end.7

if.end.7:
  br label %while.cond

if.end.4:
  %150 = load i32, i32* %next.addr, align 4
  %151 = icmp eq i32 %150, 79
  br i1 %151, label %if.then.8, label %if.end.8

if.then.8:
  %152 = load i32, i32* %i.addr, align 4
  %153 = add nsw i32 %152, 2
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %155 = load i64, i64* %154, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = trunc i64 %155 to i32
  %157 = icmp sge i32 %153, %156
  br i1 %157, label %if.then.9, label %if.end.9

if.then.9:
  %158 = xor i1 %last, true
  br i1 %158, label %if.then.10, label %if.end.10

if.then.10:
  %159 = load i32, i32* %i.addr, align 4
  ret i32 %159

if.end.10:
  %160 = call i8* @nish_alloc_struct(i64 8)
  %161 = bitcast i8* %160 to %struct.KeyEvent*
  %162 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %161, i32 8, i32 %162)
  %163 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %164 = load i64, i64* %163, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %166 = load i64, i64* %165, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %167 = icmp eq i64 %164, %166
  br i1 %167, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.4

push.store.4:
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %169 = load i8*, i8** %168, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %170 = bitcast i8* %169 to %struct.KeyEvent**
  %171 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %170, i64 %164
  store %struct.KeyEvent* %161, %struct.KeyEvent** %171, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %172 = add i64 %164, 1
  store i64 %172, i64* %163, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %173 = trunc i64 %172 to i32
  %174 = load i32, i32* %i.addr, align 4
  %175 = add nsw i32 %174, 1
  store i32 %175, i32* %i.addr, align 4
  br label %while.cond

if.end.9:
  %176 = load i32, i32* %i.addr, align 4
  %177 = add nsw i32 %176, 2
  %178 = sext i32 %177 to i64
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %181 = bitcast i8* %180 to i8*
  %182 = getelementptr inbounds i8, i8* %181, i64 %178
  %183 = load i8, i8* %182, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %184 = zext i8 %183 to i32
  store i32 %184, i32* %final.addr.1, align 4
  %185 = call i8* @nish_alloc_struct(i64 8)
  %186 = bitcast i8* %185 to %struct.KeyEvent*
  %187 = load i32, i32* %final.addr.1, align 4
  %188 = call i32 @nish.termArrowKind(i32 %187)
  %189 = load i32, i32* %final.addr.1, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %186, i32 %188, i32 %189)
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %191 = load i64, i64* %190, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %193 = load i64, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %194 = icmp eq i64 %191, %193
  br i1 %194, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.5

push.store.5:
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %196 = load i8*, i8** %195, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %197 = bitcast i8* %196 to %struct.KeyEvent**
  %198 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %197, i64 %191
  store %struct.KeyEvent* %186, %struct.KeyEvent** %198, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %199 = add i64 %191, 1
  store i64 %199, i64* %190, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %200 = trunc i64 %199 to i32
  %201 = load i32, i32* %i.addr, align 4
  %202 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %201, i32 3)
  %203 = extractvalue { i32, i1 } %202, 0
  %204 = extractvalue { i32, i1 } %202, 1
  br i1 %204, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %203, i32* %i.addr, align 4
  br label %while.cond

if.end.8:
  %205 = call i8* @nish_alloc_struct(i64 8)
  %206 = bitcast i8* %205 to %struct.KeyEvent*
  %207 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %206, i32 8, i32 %207)
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %209 = load i64, i64* %208, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %211 = load i64, i64* %210, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %212 = icmp eq i64 %209, %211
  br i1 %212, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.6

push.store.6:
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %214 = load i8*, i8** %213, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %215 = bitcast i8* %214 to %struct.KeyEvent**
  %216 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %215, i64 %209
  store %struct.KeyEvent* %206, %struct.KeyEvent** %216, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %217 = add i64 %209, 1
  store i64 %217, i64* %208, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %218 = trunc i64 %217 to i32
  %219 = load i32, i32* %i.addr, align 4
  %220 = add nsw i32 %219, 1
  store i32 %220, i32* %i.addr, align 4
  br label %while.cond

if.end.1:
  %221 = load i32, i32* %b.addr, align 4
  %222 = icmp slt i32 %221, 128
  br i1 %222, label %if.then.11, label %if.end.11

if.then.11:
  %223 = call i8* @nish_alloc_struct(i64 8)
  %224 = bitcast i8* %223 to %struct.KeyEvent*
  %225 = load i32, i32* %b.addr, align 4
  %226 = call i32 @nish.termAsciiKind(i32 %225)
  %227 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %224, i32 %226, i32 %227)
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %229 = load i64, i64* %228, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %230 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %231 = load i64, i64* %230, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %232 = icmp eq i64 %229, %231
  br i1 %232, label %push.grow.7, label %push.store.7

push.grow.7:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.7

push.store.7:
  %233 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %234 = load i8*, i8** %233, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %235 = bitcast i8* %234 to %struct.KeyEvent**
  %236 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %235, i64 %229
  store %struct.KeyEvent* %224, %struct.KeyEvent** %236, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %237 = add i64 %229, 1
  store i64 %237, i64* %228, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %238 = trunc i64 %237 to i32
  %239 = load i32, i32* %i.addr, align 4
  %240 = add nsw i32 %239, 1
  store i32 %240, i32* %i.addr, align 4
  br label %while.cond

if.end.11:
  %241 = load i32, i32* %b.addr, align 4
  %242 = icmp slt i32 %241, 194
  br i1 %242, label %lor.end, label %lor.rhs

lor.rhs:
  %243 = load i32, i32* %b.addr, align 4
  %244 = icmp sge i32 %243, 248
  br label %lor.end

lor.end:
  %245 = phi i1 [ true, %if.end.11 ], [ %244, %lor.rhs ]
  br i1 %245, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %246 = load i32, i32* %b.addr, align 4
  %247 = call i32 @nish.termLeadWidth(i32 %246)
  br label %cond.end

cond.end:
  %248 = phi i32 [ 1, %cond.true ], [ %247, %cond.false ]
  store i32 %248, i32* %width.addr, align 4
  %249 = load i32, i32* %width.addr, align 4
  %250 = icmp eq i32 %249, 1
  br i1 %250, label %if.then.12, label %if.end.12

if.then.12:
  %251 = call i8* @nish_alloc_struct(i64 8)
  %252 = bitcast i8* %251 to %struct.KeyEvent*
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %252, i32 1, i32 65533)
  %253 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %254 = load i64, i64* %253, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %255 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %256 = load i64, i64* %255, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %257 = icmp eq i64 %254, %256
  br i1 %257, label %push.grow.8, label %push.store.8

push.grow.8:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.8

push.store.8:
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %259 = load i8*, i8** %258, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %260 = bitcast i8* %259 to %struct.KeyEvent**
  %261 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %260, i64 %254
  store %struct.KeyEvent* %252, %struct.KeyEvent** %261, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %262 = add i64 %254, 1
  store i64 %262, i64* %253, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %263 = trunc i64 %262 to i32
  %264 = load i32, i32* %i.addr, align 4
  %265 = add nsw i32 %264, 1
  store i32 %265, i32* %i.addr, align 4
  br label %while.cond

if.end.12:
  %266 = load i32, i32* %b.addr, align 4
  %267 = load i32, i32* %width.addr, align 4
  %268 = call i32 @nish.termLeadBits(i32 %266, i32 %267)
  store i32 %268, i32* %cp.addr, align 4
  store i32 0, i32* %good.addr, align 4
  store i1 false, i1* %stopped.addr, align 1
  store i32 1, i32* %k.addr, align 4
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %270 = load i64, i64* %269, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %271 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %272 = load i8*, i8** %271, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %273 = load i32, i32* %k.addr, align 4
  %274 = load i32, i32* %width.addr, align 4
  %275 = icmp slt i32 %273, %274
  br i1 %275, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %276 = load i1, i1* %stopped.addr, align 1
  %277 = xor i1 %276, true
  br label %land.end.3

land.end.3:
  %278 = phi i1 [ false, %for.cond ], [ %277, %land.rhs.3 ]
  br i1 %278, label %for.body, label %for.end

for.body:
  %279 = load i32, i32* %i.addr, align 4
  %280 = load i32, i32* %k.addr, align 4
  %281 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %279, i32 %280)
  %282 = extractvalue { i32, i1 } %281, 0
  %283 = extractvalue { i32, i1 } %281, 1
  br i1 %283, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %284 = trunc i64 %270 to i32
  %285 = icmp sge i32 %282, %284
  br i1 %285, label %if.then.13, label %if.else.1

if.then.13:
  store i1 true, i1* %stopped.addr, align 1
  br label %if.end.13

if.else.1:
  %286 = load i32, i32* %i.addr, align 4
  %287 = load i32, i32* %k.addr, align 4
  %288 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %286, i32 %287)
  %289 = extractvalue { i32, i1 } %288, 0
  %290 = extractvalue { i32, i1 } %288, 1
  br i1 %290, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %291 = sext i32 %289 to i64
  %292 = icmp ult i64 %291, %270
  br i1 %292, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %291, i64 %270)
  unreachable

bounds.ok:
  %293 = bitcast i8* %272 to i8*
  %294 = getelementptr inbounds i8, i8* %293, i64 %291
  %295 = load i8, i8* %294, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %296 = zext i8 %295 to i32
  store i32 %296, i32* %c.addr, align 4
  %297 = load i32, i32* %c.addr, align 4
  %298 = icmp slt i32 %297, 128
  br i1 %298, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %299 = load i32, i32* %c.addr, align 4
  %300 = icmp sge i32 %299, 192
  br label %lor.end.1

lor.end.1:
  %301 = phi i1 [ true, %bounds.ok ], [ %300, %lor.rhs.1 ]
  br i1 %301, label %if.then.14, label %if.else.2

if.then.14:
  store i1 true, i1* %stopped.addr, align 1
  br label %if.end.14

if.else.2:
  %302 = load i32, i32* %cp.addr, align 4
  %303 = shl i32 %302, 6
  %304 = load i32, i32* %c.addr, align 4
  %305 = and i32 %304, 63
  %306 = or i32 %303, %305
  store i32 %306, i32* %cp.addr, align 4
  %307 = load i32, i32* %good.addr, align 4
  %308 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %307, i32 1)
  %309 = extractvalue { i32, i1 } %308, 0
  %310 = extractvalue { i32, i1 } %308, 1
  br i1 %310, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %309, i32* %good.addr, align 4
  br label %if.end.14

if.end.14:
  br label %if.end.13

if.end.13:
  br label %for.inc

for.inc:
  %311 = load i32, i32* %k.addr, align 4
  %312 = add nsw i32 %311, 1
  store i32 %312, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %313 = load i32, i32* %good.addr, align 4
  %314 = load i32, i32* %width.addr, align 4
  %315 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %314, i32 1)
  %316 = extractvalue { i32, i1 } %315, 0
  %317 = extractvalue { i32, i1 } %315, 1
  br i1 %317, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %318 = icmp slt i32 %313, %316
  br i1 %318, label %if.then.15, label %if.end.15

if.then.15:
  %319 = xor i1 %last, true
  br i1 %319, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %320 = load i32, i32* %i.addr, align 4
  %321 = add nsw i32 %320, 1
  %322 = load i32, i32* %good.addr, align 4
  %323 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %321, i32 %322)
  %324 = extractvalue { i32, i1 } %323, 0
  %325 = extractvalue { i32, i1 } %323, 1
  br i1 %325, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %326 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %327 = load i64, i64* %326, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %328 = trunc i64 %327 to i32
  %329 = icmp sge i32 %324, %328
  br label %land.end.4

land.end.4:
  %330 = phi i1 [ false, %if.then.15 ], [ %329, %ovf.ok.5 ]
  br i1 %330, label %if.then.16, label %if.end.16

if.then.16:
  %331 = load i32, i32* %i.addr, align 4
  ret i32 %331

if.end.16:
  %332 = call i8* @nish_alloc_struct(i64 8)
  %333 = bitcast i8* %332 to %struct.KeyEvent*
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %333, i32 1, i32 65533)
  %334 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %335 = load i64, i64* %334, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %336 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %337 = load i64, i64* %336, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %338 = icmp eq i64 %335, %337
  br i1 %338, label %push.grow.9, label %push.store.9

push.grow.9:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.9

push.store.9:
  %339 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %340 = load i8*, i8** %339, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %341 = bitcast i8* %340 to %struct.KeyEvent**
  %342 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %341, i64 %335
  store %struct.KeyEvent* %333, %struct.KeyEvent** %342, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %343 = add i64 %335, 1
  store i64 %343, i64* %334, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %344 = trunc i64 %343 to i32
  %345 = load i32, i32* %i.addr, align 4
  %346 = add nsw i32 %345, 1
  %347 = load i32, i32* %good.addr, align 4
  %348 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %346, i32 %347)
  %349 = extractvalue { i32, i1 } %348, 0
  %350 = extractvalue { i32, i1 } %348, 1
  br i1 %350, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %349, i32* %i.addr, align 4
  br label %while.cond

if.end.15:
  %351 = call i8* @nish_alloc_struct(i64 8)
  %352 = bitcast i8* %351 to %struct.KeyEvent*
  %353 = load i32, i32* %cp.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %352, i32 1, i32 %353)
  %354 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %355 = load i64, i64* %354, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %356 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %357 = load i64, i64* %356, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %358 = icmp eq i64 %355, %357
  br i1 %358, label %push.grow.10, label %push.store.10

push.grow.10:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.10

push.store.10:
  %359 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %360 = load i8*, i8** %359, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %361 = bitcast i8* %360 to %struct.KeyEvent**
  %362 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %361, i64 %355
  store %struct.KeyEvent* %352, %struct.KeyEvent** %362, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %363 = add i64 %355, 1
  store i64 %363, i64* %354, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %364 = trunc i64 %363 to i32
  %365 = load i32, i32* %i.addr, align 4
  %366 = load i32, i32* %width.addr, align 4
  %367 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %365, i32 %366)
  %368 = extractvalue { i32, i1 } %367, 0
  %369 = extractvalue { i32, i1 } %367, 1
  br i1 %369, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %368, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %370 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %371 = load i64, i64* %370, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %372 = trunc i64 %371 to i32
  ret i32 %372

ovf.fail:
  %ovf.op = phi i32 [ 0, %push.store.5 ], [ 0, %for.body ], [ 0, %if.else.1 ], [ 0, %if.else.2 ], [ 1, %for.end ], [ 0, %land.rhs.4 ], [ 0, %push.store.9 ], [ 0, %push.store.10 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
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
!11 = !{!9, !8, i64 16}
!12 = !{!9, !7, i64 8}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"ptr", !6, i64 0}
!18 = !{!"i32", !6, i64 0}
!19 = !{!"i1", !6, i64 0}
!20 = !{!"Screen", !17, i64 0, !17, i64 8, !17, i64 16, !17, i64 24, !17, i64 32, !17, i64 40, !17, i64 48, !17, i64 56, !17, i64 64, !18, i64 72, !18, i64 76, !18, i64 80, !19, i64 84}
!21 = !{!20, !18, i64 72}
!22 = !{!20, !18, i64 76}
!23 = !{!20, !19, i64 84}
!24 = !{!20, !17, i64 0}
!25 = !{!20, !17, i64 8}
!26 = !{!20, !17, i64 16}
!27 = !{!20, !17, i64 24}
!28 = !{!20, !17, i64 32}
!29 = !{!20, !17, i64 40}
!30 = !{!20, !17, i64 48}
!31 = !{!20, !17, i64 56}
!32 = !{!20, !17, i64 64}
!33 = !{!20, !18, i64 80}
!34 = !{!"element i32", !6, i64 0}
!35 = !{!34, !34, i64 0}
!36 = !{!"Canvas", !17, i64 0, !18, i64 8, !18, i64 12, !17, i64 16}
!37 = !{!36, !17, i64 0}
!38 = !{!36, !18, i64 8}
!39 = !{!36, !18, i64 12}
!40 = !{!36, !17, i64 16}
!41 = !{!"KeyEvent", !18, i64 0, !18, i64 4}
!42 = !{!41, !18, i64 0}
!43 = !{!41, !18, i64 4}
!44 = !{!"double", !6, i64 0}
!45 = !{!"KeyDecoder", !44, i64 0, !17, i64 8, !44, i64 16}
!46 = !{!45, !44, i64 0}
!47 = !{!45, !17, i64 8}
!48 = !{!45, !44, i64 16}
