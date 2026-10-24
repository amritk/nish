%struct.Screen = type { %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32, i32, i32, i1, i1 }
%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.KeyEvent = type { i32, i32 }
%struct.TermEvent = type { i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i8*, i32, i32, i32, i32, %struct.nish_array*, i1 }
%struct.KeyDecoder = type { double, %struct.nish_array*, double, %struct.nish_array*, i32, i32, i32, i1, i1 }
%struct.KeyState = type { double, double, double, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i1, i1 }
%struct.FixedStep = type { double, double, double, i32, i1 }
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
@.str.10 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?2026h\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"\1B[?2026l\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [51 x i8] } { i64 50, [51 x i8] c"nish/term: a byte count past the end of its buffer\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [51 x i8] } { i64 50, [51 x i8] c"nish/term: a Screen's buffers disagree on its size\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [61 x i8] } { i64 60, [61 x i8] c"nish/term: the key decoder used more bytes than it was given\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"nish/term: the key decoder stepped back\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [42 x i8] } { i64 41, [42 x i8] c"nish/term: the event decoder stepped back\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #5
declare noundef i64 @nish_arena_mark() #3
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #3
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #6
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #6
declare void @nish_panic_div(i1 noundef zeroext) #6
declare extern_weak void @nish_panic_overflow(i32 noundef) #6
declare double @llvm.floor.f64(double) #1
declare double @llvm.fabs.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define noundef nonnull align 8 i8* @nish.beginSync() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.10 to i8*)
}

define noundef nonnull align 8 i8* @nish.endSync() #1 {
entry:
  ret i8* bitcast ({ i64, [9 x i8] }* @.str.11 to i8*)
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
  call void @nish_panic(i8* bitcast ({ i64, [51 x i8] }* @.str.12 to i8*))
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
  %187 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.13 to i8*) to i64*
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
  %217 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.13 to i8*), i64 8
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
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 13
  store i1 false, i1* %7, align 1, !tbaa !24
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* null, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  store %struct.nish_array* %9, %struct.nish_array** %13, align 8, !tbaa !25
  %14 = call i8* @nish_alloc_struct(i64 24)
  %15 = bitcast i8* %14 to %struct.nish_array*
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 1
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  store i8* null, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  store %struct.nish_array* %15, %struct.nish_array** %19, align 8, !tbaa !26
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 0, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 0, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* null, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  store %struct.nish_array* %21, %struct.nish_array** %25, align 8, !tbaa !27
  %26 = call i8* @nish_alloc_struct(i64 24)
  %27 = bitcast i8* %26 to %struct.nish_array*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  store i64 0, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 1
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  store i8* null, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %31 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  store %struct.nish_array* %27, %struct.nish_array** %31, align 8, !tbaa !28
  %32 = call i8* @nish_alloc_struct(i64 24)
  %33 = bitcast i8* %32 to %struct.nish_array*
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  store i64 0, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  store i64 0, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  store i8* null, i8** %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  store %struct.nish_array* %33, %struct.nish_array** %37, align 8, !tbaa !29
  %38 = call i8* @nish_alloc_struct(i64 24)
  %39 = bitcast i8* %38 to %struct.nish_array*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  store i64 0, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  store i64 0, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  store i8* null, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  store %struct.nish_array* %39, %struct.nish_array** %43, align 8, !tbaa !30
  %44 = call i8* @nish_alloc_struct(i64 24)
  %45 = bitcast i8* %44 to %struct.nish_array*
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  store i64 0, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 1
  store i64 0, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  store i8* null, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  store %struct.nish_array* %45, %struct.nish_array** %49, align 8, !tbaa !31
  %50 = call i8* @nish_alloc_struct(i64 24)
  %51 = bitcast i8* %50 to %struct.nish_array*
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  store i64 0, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 1
  store i64 0, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  store i8* null, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  store %struct.nish_array* %51, %struct.nish_array** %55, align 8, !tbaa !32
  %56 = call i8* @nish_alloc_struct(i64 24)
  %57 = bitcast i8* %56 to %struct.nish_array*
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  store i64 0, i64* %58, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 1
  store i64 0, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  store i8* null, i8** %60, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %61 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  store %struct.nish_array* %57, %struct.nish_array** %61, align 8, !tbaa !33
  %62 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %62, align 4, !tbaa !34
  %63 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 9
  %64 = load i32, i32* %63, align 4, !tbaa !21
  %65 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 10
  %66 = load i32, i32* %65, align 4, !tbaa !22
  call void @nish.Screen.resize(%struct.Screen* %this, i32 %64, i32 %66)
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
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %17, %struct.nish_array** %23, align 8, !tbaa !25
  %24 = load i32, i32* %cells.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = icmp ule i64 %25, 2147483647
  br i1 %26, label %len.ok.1, label %len.fail.1

len.fail.1:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %28, %struct.nish_array** %34, align 8, !tbaa !26
  %35 = load i32, i32* %cells.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = icmp ule i64 %36, 2147483647
  br i1 %37, label %len.ok.2, label %len.fail.2

len.fail.2:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %39, %struct.nish_array** %45, align 8, !tbaa !27
  %46 = load i32, i32* %cells.addr, align 4
  %47 = sext i32 %46 to i64
  %48 = icmp ule i64 %47, 2147483647
  br i1 %48, label %len.ok.3, label %len.fail.3

len.fail.3:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %50, %struct.nish_array** %56, align 8, !tbaa !28
  %57 = load i32, i32* %cells.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = icmp ule i64 %58, 2147483647
  br i1 %59, label %len.ok.4, label %len.fail.4

len.fail.4:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %61, %struct.nish_array** %67, align 8, !tbaa !29
  %68 = load i32, i32* %cells.addr, align 4
  %69 = sext i32 %68 to i64
  %70 = icmp ule i64 %69, 2147483647
  br i1 %70, label %len.ok.5, label %len.fail.5

len.fail.5:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %72, %struct.nish_array** %78, align 8, !tbaa !30
  %79 = load i32, i32* %cells.addr, align 4
  %80 = sext i32 %79 to i64
  %81 = icmp ule i64 %80, 2147483647
  br i1 %81, label %len.ok.6, label %len.fail.6

len.fail.6:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %83, %struct.nish_array** %89, align 8, !tbaa !31
  %90 = load i32, i32* %cells.addr, align 4
  %91 = sext i32 %90 to i64
  %92 = icmp ule i64 %91, 2147483647
  br i1 %92, label %len.ok.7, label %len.fail.7

len.fail.7:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %94, %struct.nish_array** %100, align 8, !tbaa !32
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
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %111, %struct.nish_array** %116, align 8, !tbaa !33
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
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
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
  store i32 32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !26
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
  store i32 -1, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %21 = add i64 %15, 1
  store i64 %21, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !27
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
  store i32 %background, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %32 = add i64 %26, 1
  store i64 %32, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.end.2:
  %33 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !28
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
  store i32 0, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !36
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
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !29
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
  store i32 -1, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !30
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
  store i32 -1, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %21 = add i64 %15, 1
  store i64 %21, i64* %fill.at.1, align 8
  br label %fill.cond.1

fill.end.1:
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !31
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
  store i32 -1, i32* %31, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %32 = add i64 %26, 1
  store i64 %32, i64* %fill.at.2, align 8
  br label %fill.cond.2

fill.end.2:
  %33 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !32
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
  store i32 0, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !36
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
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !25
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
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !25
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 %33
  store i32 %glyph, i32* %37, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %38 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !tbaa !26
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
  store i32 %fg, i32* %48, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %49 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %50 = load %struct.nish_array*, %struct.nish_array** %49, align 8, !tbaa !27
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
  store i32 %bg, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %60 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %61 = load %struct.nish_array*, %struct.nish_array** %60, align 8, !tbaa !28
  %62 = load i32, i32* %i.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = or i32 1, 2
  %65 = and i32 %attrs, %64
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = icmp ult i64 %63, %67
  br i1 %68, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %63, i64 %67)
  unreachable

bounds.ok.2:
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %71 = bitcast i8* %70 to i32*
  %72 = getelementptr inbounds i32, i32* %71, i64 %63
  store i32 %65, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !36
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
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !25
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
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  ret i32 %25
}

define void @nish.Screen.put(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %b) #2 {
entry:
  %0 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !33
  %2 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %3 = load i32, i32* %2, align 4, !tbaa !34
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
  %14 = load i32, i32* %13, align 4, !tbaa !34
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  %18 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 %16, i32* %18, align 4, !tbaa !34
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

define void @nish.Screen.putSyncMode(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %final) #2 {
entry:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  call void @nish.Screen.put(%struct.Screen* %this, i32 63)
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 2026)
  call void @nish.Screen.put(%struct.Screen* %this, i32 %final)
  ret void
}

define void @nish.Screen.putGlyph(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture %this, i32 noundef %cp) #2 {
entry:
  %c.addr = alloca i32, align 4
  %0 = icmp sge i32 %cp, 32
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp slt i32 %cp, 127
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.else

if.then:
  call void @nish.Screen.put(%struct.Screen* %this, i32 %cp)
  br label %if.end

if.else:
  %3 = icmp sge i32 %cp, 160
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
  br i1 %23, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %24 = icmp slt i32 %cp, 65536
  br label %land.end.4

land.end.4:
  %25 = phi i1 [ false, %if.else.2 ], [ %24, %land.rhs.4 ]
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = icmp sge i32 %cp, 55296
  br i1 %26, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %27 = icmp slt i32 %cp, 57344
  br label %land.end.5

land.end.5:
  %28 = phi i1 [ false, %land.rhs.3 ], [ %27, %land.rhs.5 ]
  %29 = xor i1 %28, true
  br label %land.end.3

land.end.3:
  %30 = phi i1 [ false, %land.end.4 ], [ %29, %land.end.5 ]
  br i1 %30, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %31 = phi i32 [ %cp, %cond.true ], [ 65533, %cond.false ]
  store i32 %31, i32* %c.addr, align 4
  %32 = load i32, i32* %c.addr, align 4
  %33 = ashr i32 %32, 12
  %34 = or i32 %33, 224
  call void @nish.Screen.put(%struct.Screen* %this, i32 %34)
  %35 = load i32, i32* %c.addr, align 4
  %36 = ashr i32 %35, 6
  %37 = and i32 %36, 63
  %38 = or i32 %37, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %38)
  %39 = load i32, i32* %c.addr, align 4
  %40 = and i32 %39, 63
  %41 = or i32 %40, 128
  call void @nish.Screen.put(%struct.Screen* %this, i32 %41)
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
  %opened.addr = alloca i32, align 4
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
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !25
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %cells.addr, align 4
  %7 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %7, align 4, !tbaa !34
  %8 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 0
  %9 = load %struct.nish_array*, %struct.nish_array** %8, align 8, !tbaa !25
  store %struct.nish_array* %9, %struct.nish_array** %glyphs.addr, align 8
  %10 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 1
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !tbaa !26
  store %struct.nish_array* %11, %struct.nish_array** %fgs.addr, align 8
  %12 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 2
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !27
  store %struct.nish_array* %13, %struct.nish_array** %bgs.addr, align 8
  %14 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 3
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !28
  store %struct.nish_array* %15, %struct.nish_array** %attrs.addr, align 8
  %16 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 4
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !29
  store %struct.nish_array* %17, %struct.nish_array** %sentGlyphs.addr, align 8
  %18 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 5
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !30
  store %struct.nish_array* %19, %struct.nish_array** %sentFgs.addr, align 8
  %20 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 6
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !31
  store %struct.nish_array* %21, %struct.nish_array** %sentBgs.addr, align 8
  %22 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 7
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !32
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
  %73 = load %struct.nish_array*, %struct.nish_array** %72, align 8, !tbaa !33
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
  call void @nish_panic(i8* bitcast ({ i64, [51 x i8] }* @.str.15 to i8*))
  unreachable

if.end:
  %87 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 13
  %88 = load i1, i1* %87, align 1, !tbaa !24
  br i1 %88, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish.Screen.putSyncMode(%struct.Screen* %this, i32 104)
  br label %if.end.1

if.end.1:
  %89 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %90 = load i32, i32* %89, align 4, !tbaa !34
  store i32 %90, i32* %opened.addr, align 4
  store i32 -2, i32* %styleFg.addr, align 4
  store i32 -2, i32* %styleBg.addr, align 4
  store i32 -2, i32* %styleAttrs.addr, align 4
  store i32 -1, i32* %cursorRow.addr, align 4
  store i32 -1, i32* %cursorCol.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %91 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %91, i64 0, i32 2
  %95 = load i8*, i8** %94, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %96 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 2
  %100 = load i8*, i8** %99, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %101 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %105 = load i8*, i8** %104, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %106 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  %108 = load i64, i64* %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %111 = load %struct.nish_array*, %struct.nish_array** %sentGlyphs.addr, align 8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = load %struct.nish_array*, %struct.nish_array** %sentFgs.addr, align 8
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 0
  %118 = load i64, i64* %117, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %116, i64 0, i32 2
  %120 = load i8*, i8** %119, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %121 = load %struct.nish_array*, %struct.nish_array** %sentBgs.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %126 = load %struct.nish_array*, %struct.nish_array** %sentAttrs.addr, align 8
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 0
  %128 = load i64, i64* %127, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %126, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %131 = load i32, i32* %i.addr, align 4
  %132 = load i32, i32* %cells.addr, align 4
  %133 = icmp slt i32 %131, %132
  br i1 %133, label %land.rhs.14, label %land.end.14

land.rhs.14:
  %134 = load i32, i32* %i.addr, align 4
  %135 = trunc i64 %93 to i32
  %136 = icmp slt i32 %134, %135
  br label %land.end.14

land.end.14:
  %137 = phi i1 [ false, %for.cond ], [ %136, %land.rhs.14 ]
  br i1 %137, label %land.rhs.13, label %land.end.13

land.rhs.13:
  %138 = load i32, i32* %i.addr, align 4
  %139 = trunc i64 %98 to i32
  %140 = icmp slt i32 %138, %139
  br label %land.end.13

land.end.13:
  %141 = phi i1 [ false, %land.end.14 ], [ %140, %land.rhs.13 ]
  br i1 %141, label %land.rhs.12, label %land.end.12

land.rhs.12:
  %142 = load i32, i32* %i.addr, align 4
  %143 = trunc i64 %103 to i32
  %144 = icmp slt i32 %142, %143
  br label %land.end.12

land.end.12:
  %145 = phi i1 [ false, %land.end.13 ], [ %144, %land.rhs.12 ]
  br i1 %145, label %land.rhs.11, label %land.end.11

land.rhs.11:
  %146 = load i32, i32* %i.addr, align 4
  %147 = trunc i64 %108 to i32
  %148 = icmp slt i32 %146, %147
  br label %land.end.11

land.end.11:
  %149 = phi i1 [ false, %land.end.12 ], [ %148, %land.rhs.11 ]
  br i1 %149, label %land.rhs.10, label %land.end.10

land.rhs.10:
  %150 = load i32, i32* %i.addr, align 4
  %151 = trunc i64 %113 to i32
  %152 = icmp slt i32 %150, %151
  br label %land.end.10

land.end.10:
  %153 = phi i1 [ false, %land.end.11 ], [ %152, %land.rhs.10 ]
  br i1 %153, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %154 = load i32, i32* %i.addr, align 4
  %155 = trunc i64 %118 to i32
  %156 = icmp slt i32 %154, %155
  br label %land.end.9

land.end.9:
  %157 = phi i1 [ false, %land.end.10 ], [ %156, %land.rhs.9 ]
  br i1 %157, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %158 = load i32, i32* %i.addr, align 4
  %159 = trunc i64 %123 to i32
  %160 = icmp slt i32 %158, %159
  br label %land.end.8

land.end.8:
  %161 = phi i1 [ false, %land.end.9 ], [ %160, %land.rhs.8 ]
  br i1 %161, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %162 = load i32, i32* %i.addr, align 4
  %163 = trunc i64 %128 to i32
  %164 = icmp slt i32 %162, %163
  br label %land.end.7

land.end.7:
  %165 = phi i1 [ false, %land.end.8 ], [ %164, %land.rhs.7 ]
  br i1 %165, label %for.body, label %for.end

for.body:
  %166 = load i32, i32* %i.addr, align 4
  %167 = sext i32 %166 to i64
  %168 = bitcast i8* %95 to i32*
  %169 = getelementptr inbounds i32, i32* %168, i64 %167
  %170 = load i32, i32* %169, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  store i32 %170, i32* %glyph.addr, align 4
  %171 = load i32, i32* %i.addr, align 4
  %172 = sext i32 %171 to i64
  %173 = bitcast i8* %100 to i32*
  %174 = getelementptr inbounds i32, i32* %173, i64 %172
  %175 = load i32, i32* %174, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  store i32 %175, i32* %fg.addr, align 4
  %176 = load i32, i32* %i.addr, align 4
  %177 = sext i32 %176 to i64
  %178 = bitcast i8* %105 to i32*
  %179 = getelementptr inbounds i32, i32* %178, i64 %177
  %180 = load i32, i32* %179, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  store i32 %180, i32* %bg.addr, align 4
  %181 = load i32, i32* %i.addr, align 4
  %182 = sext i32 %181 to i64
  %183 = bitcast i8* %110 to i32*
  %184 = getelementptr inbounds i32, i32* %183, i64 %182
  %185 = load i32, i32* %184, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  store i32 %185, i32* %at.addr, align 4
  %186 = load i32, i32* %glyph.addr, align 4
  %187 = load i32, i32* %i.addr, align 4
  %188 = sext i32 %187 to i64
  %189 = bitcast i8* %115 to i32*
  %190 = getelementptr inbounds i32, i32* %189, i64 %188
  %191 = load i32, i32* %190, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %192 = icmp eq i32 %186, %191
  br i1 %192, label %land.rhs.17, label %land.end.17

land.rhs.17:
  %193 = load i32, i32* %fg.addr, align 4
  %194 = load i32, i32* %i.addr, align 4
  %195 = sext i32 %194 to i64
  %196 = bitcast i8* %120 to i32*
  %197 = getelementptr inbounds i32, i32* %196, i64 %195
  %198 = load i32, i32* %197, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %199 = icmp eq i32 %193, %198
  br label %land.end.17

land.end.17:
  %200 = phi i1 [ false, %for.body ], [ %199, %land.rhs.17 ]
  br i1 %200, label %land.rhs.16, label %land.end.16

land.rhs.16:
  %201 = load i32, i32* %bg.addr, align 4
  %202 = load i32, i32* %i.addr, align 4
  %203 = sext i32 %202 to i64
  %204 = bitcast i8* %125 to i32*
  %205 = getelementptr inbounds i32, i32* %204, i64 %203
  %206 = load i32, i32* %205, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %207 = icmp eq i32 %201, %206
  br label %land.end.16

land.end.16:
  %208 = phi i1 [ false, %land.end.17 ], [ %207, %land.rhs.16 ]
  br i1 %208, label %land.rhs.15, label %land.end.15

land.rhs.15:
  %209 = load i32, i32* %at.addr, align 4
  %210 = load i32, i32* %i.addr, align 4
  %211 = sext i32 %210 to i64
  %212 = bitcast i8* %130 to i32*
  %213 = getelementptr inbounds i32, i32* %212, i64 %211
  %214 = load i32, i32* %213, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %215 = icmp eq i32 %209, %214
  br label %land.end.15

land.end.15:
  %216 = phi i1 [ false, %land.end.16 ], [ %215, %land.rhs.15 ]
  br i1 %216, label %if.then.2, label %if.end.2

if.then.2:
  br label %for.inc

if.end.2:
  %217 = load i32, i32* %i.addr, align 4
  %218 = load i32, i32* %w.addr, align 4
  %219 = icmp eq i32 %218, 0
  %220 = icmp eq i32 %217, -2147483648
  %221 = icmp eq i32 %218, -1
  %222 = and i1 %220, %221
  %223 = or i1 %219, %222
  br i1 %223, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %219)
  unreachable

div.ok:
  %224 = sdiv i32 %217, %218
  %225 = or i32 %224, 0
  store i32 %225, i32* %row.addr, align 4
  %226 = load i32, i32* %i.addr, align 4
  %227 = load i32, i32* %row.addr, align 4
  %228 = load i32, i32* %w.addr, align 4
  %229 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %227, i32 %228)
  %230 = extractvalue { i32, i1 } %229, 0
  %231 = extractvalue { i32, i1 } %229, 1
  br i1 %231, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %232 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %226, i32 %230)
  %233 = extractvalue { i32, i1 } %232, 0
  %234 = extractvalue { i32, i1 } %232, 1
  br i1 %234, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %233, i32* %col.addr, align 4
  %235 = load i32, i32* %fg.addr, align 4
  %236 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %235)
  store i32 %236, i32* %fgKey.addr, align 4
  %237 = load i32, i32* %bg.addr, align 4
  %238 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %237)
  store i32 %238, i32* %bgKey.addr, align 4
  %239 = load i32, i32* %cursorRow.addr, align 4
  %240 = load i32, i32* %row.addr, align 4
  %241 = icmp ne i32 %239, %240
  br i1 %241, label %lor.end, label %lor.rhs

lor.rhs:
  %242 = load i32, i32* %cursorCol.addr, align 4
  %243 = load i32, i32* %col.addr, align 4
  %244 = icmp ne i32 %242, %243
  br label %lor.end

lor.end:
  %245 = phi i1 [ true, %ovf.ok.3 ], [ %244, %lor.rhs ]
  br i1 %245, label %if.then.3, label %if.end.3

if.then.3:
  %246 = load i32, i32* %col.addr, align 4
  %247 = load i32, i32* %cursorCol.addr, align 4
  %248 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %246, i32 %247)
  %249 = extractvalue { i32, i1 } %248, 0
  %250 = extractvalue { i32, i1 } %248, 1
  br i1 %250, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %249, i32* %gap.addr, align 4
  store i1 false, i1* %bridged.addr, align 1
  %251 = load i32, i32* %cursorRow.addr, align 4
  %252 = load i32, i32* %row.addr, align 4
  %253 = icmp eq i32 %251, %252
  br i1 %253, label %land.rhs.19, label %land.end.19

land.rhs.19:
  %254 = load i32, i32* %gap.addr, align 4
  %255 = icmp sgt i32 %254, 0
  br label %land.end.19

land.end.19:
  %256 = phi i1 [ false, %ovf.ok.4 ], [ %255, %land.rhs.19 ]
  br i1 %256, label %land.rhs.18, label %land.end.18

land.rhs.18:
  %257 = load i32, i32* %gap.addr, align 4
  %258 = icmp sle i32 %257, 3
  br label %land.end.18

land.end.18:
  %259 = phi i1 [ false, %land.end.19 ], [ %258, %land.rhs.18 ]
  br i1 %259, label %if.then.4, label %if.end.4

if.then.4:
  store i1 true, i1* %bridged.addr, align 1
  %260 = load i32, i32* %i.addr, align 4
  %261 = load i32, i32* %gap.addr, align 4
  %262 = sub nsw i32 %260, %261
  store i32 %262, i32* %k.addr, align 4
  %263 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %264 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %263, i64 0, i32 2
  %265 = load i8*, i8** %264, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %266 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %267 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %266, i64 0, i32 2
  %268 = load i8*, i8** %267, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %269 = load %struct.nish_array*, %struct.nish_array** %fgs.addr, align 8
  %270 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %269, i64 0, i32 2
  %271 = load i8*, i8** %270, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %272 = load %struct.nish_array*, %struct.nish_array** %bgs.addr, align 8
  %273 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %272, i64 0, i32 2
  %274 = load i8*, i8** %273, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %275 = load i32, i32* %k.addr, align 4
  %276 = load i32, i32* %i.addr, align 4
  %277 = icmp slt i32 %275, %276
  br i1 %277, label %for.body.1, label %for.end.1

for.body.1:
  %278 = load i32, i32* %k.addr, align 4
  %279 = icmp sge i32 %278, 0
  %280 = xor i1 %279, true
  br i1 %280, label %lor.end.5, label %lor.rhs.5

lor.rhs.5:
  %281 = load i32, i32* %k.addr, align 4
  %282 = sext i32 %281 to i64
  %283 = bitcast i8* %265 to i32*
  %284 = getelementptr inbounds i32, i32* %283, i64 %282
  %285 = load i32, i32* %284, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %286 = icmp slt i32 %285, 32
  br label %lor.end.5

lor.end.5:
  %287 = phi i1 [ true, %for.body.1 ], [ %286, %lor.rhs.5 ]
  br i1 %287, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %288 = load i32, i32* %k.addr, align 4
  %289 = sext i32 %288 to i64
  %290 = bitcast i8* %265 to i32*
  %291 = getelementptr inbounds i32, i32* %290, i64 %289
  %292 = load i32, i32* %291, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %293 = icmp sge i32 %292, 127
  br label %lor.end.4

lor.end.4:
  %294 = phi i1 [ true, %lor.end.5 ], [ %293, %lor.rhs.4 ]
  br i1 %294, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %295 = load i32, i32* %k.addr, align 4
  %296 = sext i32 %295 to i64
  %297 = bitcast i8* %268 to i32*
  %298 = getelementptr inbounds i32, i32* %297, i64 %296
  %299 = load i32, i32* %298, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %300 = load i32, i32* %styleAttrs.addr, align 4
  %301 = icmp ne i32 %299, %300
  br label %lor.end.3

lor.end.3:
  %302 = phi i1 [ true, %lor.end.4 ], [ %301, %lor.rhs.3 ]
  br i1 %302, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %303 = load i32, i32* %k.addr, align 4
  %304 = sext i32 %303 to i64
  %305 = bitcast i8* %271 to i32*
  %306 = getelementptr inbounds i32, i32* %305, i64 %304
  %307 = load i32, i32* %306, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %308 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %307)
  %309 = load i32, i32* %styleFg.addr, align 4
  %310 = icmp ne i32 %308, %309
  br label %lor.end.2

lor.end.2:
  %311 = phi i1 [ true, %lor.end.3 ], [ %310, %lor.rhs.2 ]
  br i1 %311, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %312 = load i32, i32* %k.addr, align 4
  %313 = sext i32 %312 to i64
  %314 = bitcast i8* %274 to i32*
  %315 = getelementptr inbounds i32, i32* %314, i64 %313
  %316 = load i32, i32* %315, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %317 = call i32 @nish.Screen.colourKey(%struct.Screen* %this, i32 %316)
  %318 = load i32, i32* %styleBg.addr, align 4
  %319 = icmp ne i32 %317, %318
  br label %lor.end.1

lor.end.1:
  %320 = phi i1 [ true, %lor.end.2 ], [ %319, %lor.rhs.1 ]
  br i1 %320, label %if.then.5, label %if.end.5

if.then.5:
  store i1 false, i1* %bridged.addr, align 1
  br label %if.end.5

if.end.5:
  br label %for.inc.1

for.inc.1:
  %321 = load i32, i32* %k.addr, align 4
  %322 = add nsw i32 %321, 1
  store i32 %322, i32* %k.addr, align 4
  br label %for.cond.1

for.end.1:
  %323 = load i1, i1* %bridged.addr, align 1
  br i1 %323, label %if.then.6, label %if.end.6

if.then.6:
  %324 = load i32, i32* %i.addr, align 4
  %325 = load i32, i32* %gap.addr, align 4
  %326 = sub nsw i32 %324, %325
  store i32 %326, i32* %k.addr.1, align 4
  %327 = load %struct.nish_array*, %struct.nish_array** %glyphs.addr, align 8
  %328 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %327, i64 0, i32 2
  %329 = load i8*, i8** %328, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.2

for.cond.2:
  %330 = load i32, i32* %k.addr.1, align 4
  %331 = load i32, i32* %i.addr, align 4
  %332 = icmp slt i32 %330, %331
  br i1 %332, label %for.body.2, label %for.end.2

for.body.2:
  %333 = load i32, i32* %k.addr.1, align 4
  %334 = icmp sge i32 %333, 0
  br i1 %334, label %if.then.7, label %if.end.7

if.then.7:
  %335 = load i32, i32* %k.addr.1, align 4
  %336 = sext i32 %335 to i64
  %337 = bitcast i8* %329 to i32*
  %338 = getelementptr inbounds i32, i32* %337, i64 %336
  %339 = load i32, i32* %338, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  call void @nish.Screen.put(%struct.Screen* %this, i32 %339)
  br label %if.end.7

if.end.7:
  br label %for.inc.2

for.inc.2:
  %340 = load i32, i32* %k.addr.1, align 4
  %341 = add nsw i32 %340, 1
  store i32 %341, i32* %k.addr.1, align 4
  br label %for.cond.2

for.end.2:
  br label %if.end.6

if.end.6:
  br label %if.end.4

if.end.4:
  %342 = load i1, i1* %bridged.addr, align 1
  %343 = xor i1 %342, true
  br i1 %343, label %if.then.8, label %if.end.8

if.then.8:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  %344 = load i32, i32* %cursorRow.addr, align 4
  %345 = load i32, i32* %row.addr, align 4
  %346 = icmp eq i32 %344, %345
  br i1 %346, label %land.rhs.20, label %land.end.20

land.rhs.20:
  %347 = load i32, i32* %gap.addr, align 4
  %348 = icmp sgt i32 %347, 0
  br label %land.end.20

land.end.20:
  %349 = phi i1 [ false, %if.then.8 ], [ %348, %land.rhs.20 ]
  br i1 %349, label %if.then.9, label %if.else

if.then.9:
  %350 = load i32, i32* %gap.addr, align 4
  %351 = icmp sgt i32 %350, 1
  br i1 %351, label %if.then.10, label %if.end.10

if.then.10:
  %352 = load i32, i32* %gap.addr, align 4
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %352)
  br label %if.end.10

if.end.10:
  call void @nish.Screen.put(%struct.Screen* %this, i32 67)
  br label %if.end.9

if.else:
  %353 = load i32, i32* %row.addr, align 4
  %354 = icmp eq i32 %353, 0
  br i1 %354, label %land.rhs.21, label %land.end.21

land.rhs.21:
  %355 = load i32, i32* %col.addr, align 4
  %356 = icmp eq i32 %355, 0
  br label %land.end.21

land.end.21:
  %357 = phi i1 [ false, %if.else ], [ %356, %land.rhs.21 ]
  br i1 %357, label %if.then.11, label %if.else.1

if.then.11:
  call void @nish.Screen.put(%struct.Screen* %this, i32 72)
  br label %if.end.11

if.else.1:
  %358 = load i32, i32* %row.addr, align 4
  %359 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %358, i32 1)
  %360 = extractvalue { i32, i1 } %359, 0
  %361 = extractvalue { i32, i1 } %359, 1
  br i1 %361, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %360)
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  %362 = load i32, i32* %col.addr, align 4
  %363 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %362, i32 1)
  %364 = extractvalue { i32, i1 } %363, 0
  %365 = extractvalue { i32, i1 } %363, 1
  br i1 %365, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  call void @nish.Screen.putDecimal(%struct.Screen* %this, i32 %364)
  call void @nish.Screen.put(%struct.Screen* %this, i32 72)
  br label %if.end.11

if.end.11:
  br label %if.end.9

if.end.9:
  br label %if.end.8

if.end.8:
  br label %if.end.3

if.end.3:
  %366 = load i32, i32* %fgKey.addr, align 4
  %367 = load i32, i32* %styleFg.addr, align 4
  %368 = icmp ne i32 %366, %367
  br i1 %368, label %lor.end.7, label %lor.rhs.7

lor.rhs.7:
  %369 = load i32, i32* %bgKey.addr, align 4
  %370 = load i32, i32* %styleBg.addr, align 4
  %371 = icmp ne i32 %369, %370
  br label %lor.end.7

lor.end.7:
  %372 = phi i1 [ true, %if.end.3 ], [ %371, %lor.rhs.7 ]
  br i1 %372, label %lor.end.6, label %lor.rhs.6

lor.rhs.6:
  %373 = load i32, i32* %at.addr, align 4
  %374 = load i32, i32* %styleAttrs.addr, align 4
  %375 = icmp ne i32 %373, %374
  br label %lor.end.6

lor.end.6:
  %376 = phi i1 [ true, %lor.end.7 ], [ %375, %lor.rhs.6 ]
  br i1 %376, label %if.then.12, label %if.end.12

if.then.12:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  store i1 true, i1* %first.addr, align 1
  %377 = load i32, i32* %styleAttrs.addr, align 4
  %378 = icmp eq i32 %377, -2
  br i1 %378, label %lor.end.8, label %lor.rhs.8

lor.rhs.8:
  %379 = load i32, i32* %styleAttrs.addr, align 4
  %380 = load i32, i32* %at.addr, align 4
  %381 = xor i32 %380, -1
  %382 = and i32 %379, %381
  %383 = icmp ne i32 %382, 0
  br label %lor.end.8

lor.end.8:
  %384 = phi i1 [ true, %if.then.12 ], [ %383, %lor.rhs.8 ]
  br i1 %384, label %if.then.13, label %if.end.13

if.then.13:
  call void @nish.Screen.put(%struct.Screen* %this, i32 48)
  store i1 false, i1* %first.addr, align 1
  store i32 0, i32* %styleAttrs.addr, align 4
  store i32 -1, i32* %styleFg.addr, align 4
  store i32 -1, i32* %styleBg.addr, align 4
  br label %if.end.13

if.end.13:
  %385 = load i32, i32* %at.addr, align 4
  %386 = and i32 %385, 1
  %387 = icmp ne i32 %386, 0
  br i1 %387, label %land.rhs.22, label %land.end.22

land.rhs.22:
  %388 = load i32, i32* %styleAttrs.addr, align 4
  %389 = and i32 %388, 1
  %390 = icmp eq i32 %389, 0
  br label %land.end.22

land.end.22:
  %391 = phi i1 [ false, %if.end.13 ], [ %390, %land.rhs.22 ]
  br i1 %391, label %if.then.14, label %if.end.14

if.then.14:
  %392 = load i1, i1* %first.addr, align 1
  %393 = xor i1 %392, true
  br i1 %393, label %if.then.15, label %if.end.15

if.then.15:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.15

if.end.15:
  %394 = add nsw i32 48, 1
  call void @nish.Screen.put(%struct.Screen* %this, i32 %394)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.14

if.end.14:
  %395 = load i32, i32* %at.addr, align 4
  %396 = and i32 %395, 2
  %397 = icmp ne i32 %396, 0
  br i1 %397, label %land.rhs.23, label %land.end.23

land.rhs.23:
  %398 = load i32, i32* %styleAttrs.addr, align 4
  %399 = and i32 %398, 2
  %400 = icmp eq i32 %399, 0
  br label %land.end.23

land.end.23:
  %401 = phi i1 [ false, %if.end.14 ], [ %400, %land.rhs.23 ]
  br i1 %401, label %if.then.16, label %if.end.16

if.then.16:
  %402 = load i1, i1* %first.addr, align 1
  %403 = xor i1 %402, true
  br i1 %403, label %if.then.17, label %if.end.17

if.then.17:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.17

if.end.17:
  %404 = add nsw i32 48, 7
  call void @nish.Screen.put(%struct.Screen* %this, i32 %404)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.16

if.end.16:
  %405 = load i32, i32* %fgKey.addr, align 4
  %406 = load i32, i32* %styleFg.addr, align 4
  %407 = icmp ne i32 %405, %406
  br i1 %407, label %if.then.18, label %if.end.18

if.then.18:
  %408 = load i1, i1* %first.addr, align 1
  %409 = xor i1 %408, true
  br i1 %409, label %if.then.19, label %if.end.19

if.then.19:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.19

if.end.19:
  %410 = load i32, i32* %fgKey.addr, align 4
  call void @nish.Screen.putColour(%struct.Screen* %this, i32 30, i32 %410)
  store i1 false, i1* %first.addr, align 1
  br label %if.end.18

if.end.18:
  %411 = load i32, i32* %bgKey.addr, align 4
  %412 = load i32, i32* %styleBg.addr, align 4
  %413 = icmp ne i32 %411, %412
  br i1 %413, label %if.then.20, label %if.end.20

if.then.20:
  %414 = load i1, i1* %first.addr, align 1
  %415 = xor i1 %414, true
  br i1 %415, label %if.then.21, label %if.end.21

if.then.21:
  call void @nish.Screen.put(%struct.Screen* %this, i32 59)
  br label %if.end.21

if.end.21:
  %416 = load i32, i32* %bgKey.addr, align 4
  call void @nish.Screen.putColour(%struct.Screen* %this, i32 40, i32 %416)
  br label %if.end.20

if.end.20:
  call void @nish.Screen.put(%struct.Screen* %this, i32 109)
  %417 = load i32, i32* %fgKey.addr, align 4
  store i32 %417, i32* %styleFg.addr, align 4
  %418 = load i32, i32* %bgKey.addr, align 4
  store i32 %418, i32* %styleBg.addr, align 4
  %419 = load i32, i32* %at.addr, align 4
  store i32 %419, i32* %styleAttrs.addr, align 4
  br label %if.end.12

if.end.12:
  %420 = load i32, i32* %glyph.addr, align 4
  call void @nish.Screen.putGlyph(%struct.Screen* %this, i32 %420)
  %421 = load i32, i32* %i.addr, align 4
  %422 = sext i32 %421 to i64
  %423 = load i32, i32* %glyph.addr, align 4
  %424 = bitcast i8* %115 to i32*
  %425 = getelementptr inbounds i32, i32* %424, i64 %422
  store i32 %423, i32* %425, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %426 = load i32, i32* %i.addr, align 4
  %427 = sext i32 %426 to i64
  %428 = load i32, i32* %fg.addr, align 4
  %429 = bitcast i8* %120 to i32*
  %430 = getelementptr inbounds i32, i32* %429, i64 %427
  store i32 %428, i32* %430, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %431 = load i32, i32* %i.addr, align 4
  %432 = sext i32 %431 to i64
  %433 = load i32, i32* %bg.addr, align 4
  %434 = bitcast i8* %125 to i32*
  %435 = getelementptr inbounds i32, i32* %434, i64 %432
  store i32 %433, i32* %435, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %436 = load i32, i32* %i.addr, align 4
  %437 = sext i32 %436 to i64
  %438 = load i32, i32* %at.addr, align 4
  %439 = bitcast i8* %130 to i32*
  %440 = getelementptr inbounds i32, i32* %439, i64 %437
  store i32 %438, i32* %440, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %441 = load i32, i32* %row.addr, align 4
  store i32 %441, i32* %cursorRow.addr, align 4
  %442 = load i32, i32* %col.addr, align 4
  %443 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %442, i32 1)
  %444 = extractvalue { i32, i1 } %443, 0
  %445 = extractvalue { i32, i1 } %443, 1
  br i1 %445, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  store i32 %444, i32* %cursorCol.addr, align 4
  %446 = load i32, i32* %cursorCol.addr, align 4
  %447 = load i32, i32* %w.addr, align 4
  %448 = icmp sge i32 %446, %447
  br i1 %448, label %if.then.22, label %if.end.22

if.then.22:
  store i32 -1, i32* %cursorRow.addr, align 4
  br label %if.end.22

if.end.22:
  br label %for.inc

for.inc:
  %449 = load i32, i32* %i.addr, align 4
  %450 = add nsw i32 %449, 1
  store i32 %450, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %451 = load i32, i32* %styleAttrs.addr, align 4
  %452 = icmp ne i32 %451, -2
  br i1 %452, label %land.rhs.24, label %land.end.24

land.rhs.24:
  %453 = load i32, i32* %styleAttrs.addr, align 4
  %454 = icmp ne i32 %453, 0
  br i1 %454, label %lor.end.10, label %lor.rhs.10

lor.rhs.10:
  %455 = load i32, i32* %styleFg.addr, align 4
  %456 = icmp ne i32 %455, -1
  br label %lor.end.10

lor.end.10:
  %457 = phi i1 [ true, %land.rhs.24 ], [ %456, %lor.rhs.10 ]
  br i1 %457, label %lor.end.9, label %lor.rhs.9

lor.rhs.9:
  %458 = load i32, i32* %styleBg.addr, align 4
  %459 = icmp ne i32 %458, -1
  br label %lor.end.9

lor.end.9:
  %460 = phi i1 [ true, %lor.end.10 ], [ %459, %lor.rhs.9 ]
  br label %land.end.24

land.end.24:
  %461 = phi i1 [ false, %for.end ], [ %460, %lor.end.9 ]
  br i1 %461, label %if.then.23, label %if.end.23

if.then.23:
  call void @nish.Screen.put(%struct.Screen* %this, i32 27)
  call void @nish.Screen.put(%struct.Screen* %this, i32 91)
  call void @nish.Screen.put(%struct.Screen* %this, i32 48)
  call void @nish.Screen.put(%struct.Screen* %this, i32 109)
  br label %if.end.23

if.end.23:
  %462 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %463 = load i32, i32* %462, align 4, !tbaa !34
  %464 = load i32, i32* %opened.addr, align 4
  %465 = icmp eq i32 %463, %464
  br i1 %465, label %if.then.24, label %if.else.2

if.then.24:
  %466 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  store i32 0, i32* %466, align 4, !tbaa !34
  br label %if.end.24

if.else.2:
  %467 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 13
  %468 = load i1, i1* %467, align 1, !tbaa !24
  br i1 %468, label %if.then.25, label %if.end.25

if.then.25:
  call void @nish.Screen.putSyncMode(%struct.Screen* %this, i32 108)
  br label %if.end.25

if.end.25:
  br label %if.end.24

if.end.24:
  %469 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 8
  %470 = load %struct.nish_array*, %struct.nish_array** %469, align 8, !tbaa !33
  %471 = getelementptr inbounds %struct.Screen, %struct.Screen* %this, i32 0, i32 11
  %472 = load i32, i32* %471, align 4, !tbaa !34
  %473 = call i64 @nish_arena_mark()
  %474 = call i8* @nish.termBytesText(%struct.nish_array* %470, i32 %472)
  %475 = call i8* @nish_arena_keep(i64 %473, i8* %474)
  ret i8* %475

ovf.fail:
  %ovf.op = phi i32 [ 2, %land.rhs ], [ 0, %ovf.ok ], [ 2, %div.ok ], [ 1, %ovf.ok.2 ], [ 1, %if.then.3 ], [ 0, %if.else.1 ], [ 0, %ovf.ok.5 ], [ 0, %if.end.12 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define void @nish.Canvas.constructor(%struct.Canvas* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %struct.Screen* noundef nonnull align 8 dereferenceable(88) %screen) #2 {
entry:
  %fill.at = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  store %struct.Screen* %screen, %struct.Screen** %0, align 8, !tbaa !38
  %1 = getelementptr inbounds %struct.Screen, %struct.Screen* %screen, i32 0, i32 9
  %2 = load i32, i32* %1, align 4, !tbaa !21
  %3 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  store i32 %2, i32* %3, align 4, !tbaa !39
  %4 = getelementptr inbounds %struct.Screen, %struct.Screen* %screen, i32 0, i32 10
  %5 = load i32, i32* %4, align 4, !tbaa !22
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %5, i32 2)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  store i32 %7, i32* %9, align 4, !tbaa !40
  %10 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !39
  %12 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %13 = load i32, i32* %12, align 4, !tbaa !40
  %14 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = sext i32 %15 to i64
  %18 = icmp ule i64 %17, 2147483647
  br i1 %18, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
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
  store %struct.nish_array* %20, %struct.nish_array** %26, align 8, !tbaa !41
  %27 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %28 = load %struct.nish_array*, %struct.nish_array** %27, align 8, !tbaa !41
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
  store i32 -1, i32* %36, align 4, !alias.scope !4, !noalias !3, !tbaa !36
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
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !41
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
  store i32 %colour, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %12 = load i32, i32* %11, align 4, !tbaa !40
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
  %19 = load i32, i32* %18, align 4, !tbaa !39
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
  %4 = load i32, i32* %3, align 4, !tbaa !39
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %8 = load i32, i32* %7, align 4, !tbaa !40
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !41
  %13 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !39
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
  %29 = load i32, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !36
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
  %4 = load i32, i32* %3, align 4, !tbaa !39
  %5 = icmp sge i32 %x, %4
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %8 = load i32, i32* %7, align 4, !tbaa !40
  %9 = icmp sge i32 %y, %8
  br label %lor.end

lor.end:
  %10 = phi i1 [ true, %lor.end.1 ], [ %9, %lor.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %11 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 3
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !41
  %13 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !39
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
  store i32 %colour, i32* %28, align 4, !alias.scope !4, !noalias !3, !tbaa !36
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
  %8 = load i32, i32* %7, align 4, !tbaa !39
  %9 = icmp sgt i32 %5, %8
  br i1 %9, label %cond.true.2, label %cond.false.2

cond.true.2:
  %10 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !39
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
  %20 = load i32, i32* %19, align 4, !tbaa !40
  %21 = icmp sgt i32 %17, %20
  br i1 %21, label %cond.true.3, label %cond.false.3

cond.true.3:
  %22 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %23 = load i32, i32* %22, align 4, !tbaa !40
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
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !41
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
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !41
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
  %50 = load i32, i32* %49, align 4, !tbaa !39
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
  store i32 %colour, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !36
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
  %dx.addr = alloca double, align 8
  %dy.addr = alloca double, align 8
  %sx.addr = alloca i32, align 4
  %sy.addr = alloca i32, align 4
  %err.addr = alloca double, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %twice.addr = alloca double, align 8
  %0 = sitofp i32 %x1 to double
  %1 = sitofp i32 %x0 to double
  %2 = fsub double %0, %1
  %3 = call double @llvm.fabs.f64(double %2)
  store double %3, double* %dx.addr, align 8
  %4 = sitofp i32 %y1 to double
  %5 = sitofp i32 %y0 to double
  %6 = fsub double %4, %5
  %7 = call double @llvm.fabs.f64(double %6)
  %8 = fneg double %7
  store double %8, double* %dy.addr, align 8
  %9 = icmp slt i32 %x0, %x1
  br i1 %9, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %10 = phi i32 [ 1, %cond.true ], [ -1, %cond.false ]
  store i32 %10, i32* %sx.addr, align 4
  %11 = icmp slt i32 %y0, %y1
  br i1 %11, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %12 = phi i32 [ 1, %cond.true.1 ], [ -1, %cond.false.1 ]
  store i32 %12, i32* %sy.addr, align 4
  %13 = load double, double* %dx.addr, align 8
  %14 = load double, double* %dy.addr, align 8
  %15 = fadd double %13, %14
  store double %15, double* %err.addr, align 8
  store i32 %x0, i32* %x.addr, align 4
  store i32 %y0, i32* %y.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %16 = load i32, i32* %x.addr, align 4
  %17 = load i32, i32* %y.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %this, i32 %16, i32 %17, i32 %colour)
  %18 = load i32, i32* %x.addr, align 4
  %19 = icmp eq i32 %18, %x1
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %y.addr, align 4
  %21 = icmp eq i32 %20, %y1
  br label %land.end

land.end:
  %22 = phi i1 [ false, %while.body ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %23 = load double, double* %err.addr, align 8
  %24 = fmul double 0x4000000000000000, %23
  store double %24, double* %twice.addr, align 8
  %25 = load double, double* %twice.addr, align 8
  %26 = load double, double* %dy.addr, align 8
  %27 = fcmp oge double %25, %26
  br i1 %27, label %if.then.1, label %if.end.1

if.then.1:
  %28 = load double, double* %err.addr, align 8
  %29 = load double, double* %dy.addr, align 8
  %30 = fadd double %28, %29
  store double %30, double* %err.addr, align 8
  %31 = load i32, i32* %x.addr, align 4
  %32 = load i32, i32* %sx.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %34, i32* %x.addr, align 4
  br label %if.end.1

if.end.1:
  %36 = load double, double* %twice.addr, align 8
  %37 = load double, double* %dx.addr, align 8
  %38 = fcmp ole double %36, %37
  br i1 %38, label %if.then.2, label %if.end.2

if.then.2:
  %39 = load double, double* %err.addr, align 8
  %40 = load double, double* %dx.addr, align 8
  %41 = fadd double %39, %40
  store double %41, double* %err.addr, align 8
  %42 = load i32, i32* %y.addr, align 4
  %43 = load i32, i32* %sy.addr, align 4
  %44 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 %43)
  %45 = extractvalue { i32, i1 } %44, 0
  %46 = extractvalue { i32, i1 } %44, 1
  br i1 %46, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %45, i32* %y.addr, align 4
  br label %if.end.2

if.end.2:
  %47 = load i32, i32* %sx.addr, align 4
  %48 = icmp sgt i32 %47, 0
  br i1 %48, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %49 = load i32, i32* %x.addr, align 4
  %50 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 1
  %51 = load i32, i32* %50, align 4, !tbaa !39
  %52 = icmp sge i32 %49, %51
  br label %land.end.1

land.end.1:
  %53 = phi i1 [ false, %if.end.2 ], [ %52, %land.rhs.1 ]
  br i1 %53, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %54 = load i32, i32* %sx.addr, align 4
  %55 = icmp slt i32 %54, 0
  br i1 %55, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %56 = load i32, i32* %x.addr, align 4
  %57 = icmp slt i32 %56, 0
  br label %land.end.2

land.end.2:
  %58 = phi i1 [ false, %lor.rhs.2 ], [ %57, %land.rhs.2 ]
  br label %lor.end.2

lor.end.2:
  %59 = phi i1 [ true, %land.end.1 ], [ %58, %land.end.2 ]
  br i1 %59, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %60 = load i32, i32* %sy.addr, align 4
  %61 = icmp sgt i32 %60, 0
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %y.addr, align 4
  %63 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 2
  %64 = load i32, i32* %63, align 4, !tbaa !40
  %65 = icmp sge i32 %62, %64
  br label %land.end.3

land.end.3:
  %66 = phi i1 [ false, %lor.rhs.1 ], [ %65, %land.rhs.3 ]
  br label %lor.end.1

lor.end.1:
  %67 = phi i1 [ true, %lor.end.2 ], [ %66, %land.end.3 ]
  br i1 %67, label %lor.end, label %lor.rhs

lor.rhs:
  %68 = load i32, i32* %sy.addr, align 4
  %69 = icmp slt i32 %68, 0
  br i1 %69, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %70 = load i32, i32* %y.addr, align 4
  %71 = icmp slt i32 %70, 0
  br label %land.end.4

land.end.4:
  %72 = phi i1 [ false, %lor.rhs ], [ %71, %land.rhs.4 ]
  br label %lor.end

lor.end:
  %73 = phi i1 [ true, %lor.end.1 ], [ %72, %land.end.4 ]
  br i1 %73, label %if.then.3, label %if.end.3

if.then.3:
  ret void

if.end.3:
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 0)
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
  %18 = load %struct.Screen*, %struct.Screen** %17, align 8, !tbaa !38
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
  %17 = load %struct.Screen*, %struct.Screen** %16, align 8, !tbaa !38
  call void @nish.Screen.set(%struct.Screen* %17, i32 %col, i32 %row, i32 32, i32 -1, i32 -1, i32 0)
  br label %if.end

if.else:
  %18 = load i32, i32* %top.addr, align 4
  %19 = icmp slt i32 %18, 0
  br i1 %19, label %if.then.1, label %if.else.1

if.then.1:
  %20 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %21 = load %struct.Screen*, %struct.Screen** %20, align 8, !tbaa !38
  %22 = load i32, i32* %bottom.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %21, i32 %col, i32 %row, i32 9604, i32 %22, i32 -1, i32 0)
  br label %if.end.1

if.else.1:
  %23 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %this, i32 0, i32 0
  %24 = load %struct.Screen*, %struct.Screen** %23, align 8, !tbaa !38
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
  store i32 %kind, i32* %0, align 4, !tbaa !43
  %1 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %this, i32 0, i32 1
  store i32 %code, i32* %1, align 4, !tbaa !44
  ret void
}

define void @nish.TermEvent.constructor(%struct.TermEvent* noundef nonnull noalias align 8 dereferenceable(80) nocapture %this, i32 noundef %type) #3 {
entry:
  %0 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 0
  store i32 %type, i32* %0, align 4, !tbaa !46
  %1 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !47
  %2 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 2
  store i32 0, i32* %2, align 4, !tbaa !48
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 3
  store i32 0, i32* %3, align 4, !tbaa !49
  %4 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 4
  store i32 0, i32* %4, align 4, !tbaa !50
  %5 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 5
  store i32 0, i32* %5, align 4, !tbaa !51
  %6 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 6
  store i32 0, i32* %6, align 4, !tbaa !52
  %7 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 7
  store i32 0, i32* %7, align 4, !tbaa !53
  %8 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 8
  store i32 -1, i32* %8, align 4, !tbaa !54
  %9 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 9
  store i32 -1, i32* %9, align 4, !tbaa !55
  %10 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 10
  store i8* bitcast ({ i64, [1 x i8] }* @.str.13 to i8*), i8** %10, align 8, !tbaa !56
  %11 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 11
  store i32 0, i32* %11, align 4, !tbaa !57
  %12 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 12
  store i32 0, i32* %12, align 4, !tbaa !58
  %13 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 13
  store i32 0, i32* %13, align 4, !tbaa !59
  %14 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 14
  store i32 0, i32* %14, align 4, !tbaa !60
  %15 = call i8* @nish_alloc_struct(i64 24)
  %16 = bitcast i8* %15 to %struct.nish_array*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 0, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* null, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 15
  store %struct.nish_array* %16, %struct.nish_array** %20, align 8, !tbaa !61
  %21 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %this, i32 0, i32 16
  store i1 false, i1* %21, align 1, !tbaa !62
  ret void
}

define void @nish.KeyDecoder.constructor(%struct.KeyDecoder* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this, double noundef %escapeTimeoutMs) #3 {
entry:
  %0 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  store double %escapeTimeoutMs, double* %0, align 8, !tbaa !65
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !66
  %7 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  store double 0x0000000000000000, double* %7, align 8, !tbaa !67
  %8 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 4
  store i32 0, i32* %8, align 4, !tbaa !68
  %9 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 7
  store i1 false, i1* %9, align 1, !tbaa !69
  %10 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 5
  store i32 0, i32* %10, align 4, !tbaa !70
  %11 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 6
  store i32 0, i32* %11, align 4, !tbaa !71
  %12 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 8
  store i1 false, i1* %12, align 1, !tbaa !72
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 0, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* null, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 3
  store %struct.nish_array* %14, %struct.nish_array** %18, align 8, !tbaa !73
  ret void
}

define noundef zeroext i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !66
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = icmp sgt i32 %4, 0
  ret i1 %5
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %count, double noundef %nowMs) #2 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %work.addr = alloca %struct.nish_array*, align 8
  %used.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %this, double %nowMs)
  store %struct.nish_array* %0, %struct.nish_array** %events.addr, align 8
  %1 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !66
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %held.addr, align 4
  %6 = call %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* %this, %struct.nish_array* %bytes, i32 %count)
  store %struct.nish_array* %6, %struct.nish_array** %work.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %12

if.end:
  %13 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %15 = call i32 @nish.termDecodeKeys(%struct.nish_array* %13, i1 false, %struct.nish_array* %14)
  store i32 %15, i32* %used.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %17 = load i32, i32* %used.addr, align 4
  %18 = load i32, i32* %used.addr, align 4
  %19 = load i32, i32* %held.addr, align 4
  %20 = icmp sge i32 %18, %19
  call void @nish.KeyDecoder.keep(%struct.KeyDecoder* %this, %struct.nish_array* %16, i32 %17, i1 %20, double %nowMs)
  %21 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %21
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %nowMs) #2 {
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
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !66
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  store i32 %9, i32* %held.addr, align 4
  %10 = load i32, i32* %held.addr, align 4
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  %13 = load double, double* %12, align 8, !tbaa !67
  %14 = fsub double %nowMs, %13
  %15 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  %16 = load double, double* %15, align 8, !tbaa !65
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
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !66
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
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !66
  %30 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %30
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feedEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %count, double noundef %nowMs) #2 {
entry:
  %events.addr = alloca %struct.nish_array*, align 8
  %held.addr = alloca i32, align 4
  %work.addr = alloca %struct.nish_array*, align 8
  %used.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.KeyDecoder.pollEvents(%struct.KeyDecoder* %this, double %nowMs)
  store %struct.nish_array* %0, %struct.nish_array** %events.addr, align 8
  %1 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !66
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %held.addr, align 4
  %6 = call %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* %this, %struct.nish_array* %bytes, i32 %count)
  store %struct.nish_array* %6, %struct.nish_array** %work.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = icmp eq i32 %10, 0
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %12

if.end:
  %13 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %15 = call i32 @nish.termDecodeEvents(%struct.KeyDecoder* %this, %struct.nish_array* %13, i1 false, %struct.nish_array* %14)
  store i32 %15, i32* %used.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %17 = load i32, i32* %used.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = load i32, i32* %held.addr, align 4
  %23 = icmp sgt i32 %21, %22
  call void @nish.KeyDecoder.keep(%struct.KeyDecoder* %this, %struct.nish_array* %16, i32 %17, i1 %23, double %nowMs)
  %24 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %24
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.pollEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, double noundef %nowMs) #2 {
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
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !66
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = trunc i64 %8 to i32
  store i32 %9, i32* %held.addr, align 4
  %10 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 8
  %11 = load i1, i1* %10, align 1, !tbaa !72
  br i1 %11, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %12 = load i32, i32* %held.addr, align 4
  %13 = icmp eq i32 %12, 0
  br label %lor.end.1

lor.end.1:
  %14 = phi i1 [ true, %entry ], [ %13, %lor.rhs.1 ]
  br i1 %14, label %lor.end, label %lor.rhs

lor.rhs:
  %15 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  %16 = load double, double* %15, align 8, !tbaa !67
  %17 = fsub double %nowMs, %16
  %18 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 0
  %19 = load double, double* %18, align 8, !tbaa !65
  %20 = fcmp olt double %17, %19
  br label %lor.end

lor.end:
  %21 = phi i1 [ true, %lor.end.1 ], [ %20, %lor.rhs ]
  br i1 %21, label %if.then, label %if.end

if.then:
  %22 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %22

if.end:
  %23 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %24 = load %struct.nish_array*, %struct.nish_array** %23, align 8, !tbaa !66
  %25 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  %26 = call i32 @nish.termDecodeEvents(%struct.KeyDecoder* %this, %struct.nish_array* %24, i1 true, %struct.nish_array* %25)
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 0, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* null, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %32 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %28, %struct.nish_array** %32, align 8, !tbaa !66
  %33 = load %struct.nish_array*, %struct.nish_array** %events.addr, align 8
  ret %struct.nish_array* %33
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %count) #2 {
entry:
  %held.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %work.addr = alloca %struct.nish_array*, align 8
  %pending.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %k.addr.1 = alloca i32, align 4
  %0 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !66
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %held.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = trunc i64 %6 to i32
  %8 = call i32 @nish.termClamp(i32 %count, i32 0, i32 %7)
  store i32 %8, i32* %n.addr, align 4
  %9 = load i32, i32* %held.addr, align 4
  %10 = load i32, i32* %n.addr, align 4
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = sext i32 %12 to i64
  %15 = icmp ule i64 %14, 2147483647
  br i1 %15, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.14 to i8*))
  unreachable

len.ok:
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %14, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %14, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = call i8* @nish_alloc_struct(i64 %14)
  call void @llvm.memset.p0i8.i64(i8* align 8 %20, i8 0, i64 %14, i1 false), !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %17, %struct.nish_array** %work.addr, align 8
  %22 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !66
  store %struct.nish_array* %23, %struct.nish_array** %pending.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %24 = load %struct.nish_array*, %struct.nish_array** %pending.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %34 = load i32, i32* %k.addr, align 4
  %35 = trunc i64 %26 to i32
  %36 = icmp slt i32 %34, %35
  br i1 %36, label %land.rhs, label %land.end

land.rhs:
  %37 = load i32, i32* %k.addr, align 4
  %38 = trunc i64 %31 to i32
  %39 = icmp slt i32 %37, %38
  br label %land.end

land.end:
  %40 = phi i1 [ false, %for.cond ], [ %39, %land.rhs ]
  br i1 %40, label %for.body, label %for.end

for.body:
  %41 = load i32, i32* %k.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = load i32, i32* %k.addr, align 4
  %44 = sext i32 %43 to i64
  %45 = bitcast i8* %28 to i8*
  %46 = getelementptr inbounds i8, i8* %45, i64 %44
  %47 = load i8, i8* %46, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = bitcast i8* %33 to i8*
  %49 = getelementptr inbounds i8, i8* %48, i64 %42
  store i8 %47, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc

for.inc:
  %50 = load i32, i32* %k.addr, align 4
  %51 = add nsw i32 %50, 1
  store i32 %51, i32* %k.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %k.addr.1, align 4
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %56 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.1

for.cond.1:
  %61 = load i32, i32* %k.addr.1, align 4
  %62 = load i32, i32* %n.addr, align 4
  %63 = icmp slt i32 %61, %62
  br i1 %63, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %64 = load i32, i32* %k.addr.1, align 4
  %65 = trunc i64 %53 to i32
  %66 = icmp slt i32 %64, %65
  br label %land.end.1

land.end.1:
  %67 = phi i1 [ false, %for.cond.1 ], [ %66, %land.rhs.1 ]
  br i1 %67, label %for.body.1, label %for.end.1

for.body.1:
  %68 = load i32, i32* %held.addr, align 4
  %69 = load i32, i32* %k.addr.1, align 4
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %68, i32 %69)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %73 = sext i32 %71 to i64
  %74 = load i32, i32* %k.addr.1, align 4
  %75 = sext i32 %74 to i64
  %76 = bitcast i8* %55 to i8*
  %77 = getelementptr inbounds i8, i8* %76, i64 %75
  %78 = load i8, i8* %77, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = icmp ult i64 %73, %58
  br i1 %79, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %73, i64 %58)
  unreachable

bounds.ok:
  %80 = bitcast i8* %60 to i8*
  %81 = getelementptr inbounds i8, i8* %80, i64 %73
  store i8 %78, i8* %81, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc.1

for.inc.1:
  %82 = load i32, i32* %k.addr.1, align 4
  %83 = add nsw i32 %82, 1
  store i32 %83, i32* %k.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %84 = load %struct.nish_array*, %struct.nish_array** %work.addr, align 8
  ret %struct.nish_array* %84

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish.KeyDecoder.keep(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %work, i32 noundef %used, i1 noundef zeroext %restart, double noundef %nowMs) #2 {
entry:
  %rest.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %rest.addr, align 8
  store i32 %used, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %work, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %k.addr, align 4
  %11 = icmp sge i32 %10, 0
  %12 = xor i1 %11, true
  br i1 %12, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [61 x i8] }* @.str.16 to i8*))
  unreachable

if.end:
  %13 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %14 = load i32, i32* %k.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %work, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %15
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %25 = icmp eq i64 %22, %24
  br i1 %25, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %13, i64 1)
  br label %push.store

push.store:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i8*
  %29 = getelementptr inbounds i8, i8* %28, i64 %22
  store i8 %20, i8* %29, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %30 = add i64 %22, 1
  store i64 %30, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = trunc i64 %30 to i32
  br label %for.inc

for.inc:
  %32 = load i32, i32* %k.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %34 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = trunc i64 %36 to i32
  %38 = icmp sgt i32 %37, 0
  br i1 %38, label %land.rhs, label %land.end

land.rhs:
  br label %land.end

land.end:
  %39 = phi i1 [ false, %for.end ], [ %restart, %land.rhs ]
  br i1 %39, label %if.then.1, label %if.end.1

if.then.1:
  %40 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 2
  store double %nowMs, double* %40, align 8, !tbaa !67
  br label %if.end.1

if.end.1:
  %41 = load %struct.nish_array*, %struct.nish_array** %rest.addr, align 8
  %42 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %this, i32 0, i32 1
  store %struct.nish_array* %41, %struct.nish_array** %42, align 8, !tbaa !66
  ret void
}

define void @nish.KeyState.constructor(%struct.KeyState* noundef nonnull noalias align 8 dereferenceable(72) nocapture %this) #3 {
entry:
  %0 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 8
  store i1 true, i1* %0, align 1, !tbaa !75
  %1 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 0
  store double 0x4059000000000000, double* %1, align 8, !tbaa !76
  %2 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 1
  store double 0x4085E00000000000, double* %2, align 8, !tbaa !77
  %3 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  store double 0x4062C00000000000, double* %3, align 8, !tbaa !78
  %4 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 9
  store i1 true, i1* %4, align 1, !tbaa !79
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  store %struct.nish_array* %6, %struct.nish_array** %10, align 8, !tbaa !80
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.nish_array*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* null, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  store %struct.nish_array* %12, %struct.nish_array** %16, align 8, !tbaa !81
  %17 = call i8* @nish_alloc_struct(i64 24)
  %18 = bitcast i8* %17 to %struct.nish_array*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 0, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 0, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* null, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  store %struct.nish_array* %18, %struct.nish_array** %22, align 8, !tbaa !82
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 0, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 0, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* null, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  store %struct.nish_array* %24, %struct.nish_array** %28, align 8, !tbaa !83
  %29 = call i8* @nish_alloc_struct(i64 24)
  %30 = bitcast i8* %29 to %struct.nish_array*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  store i64 0, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 1
  store i64 0, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  store i8* null, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  store %struct.nish_array* %30, %struct.nish_array** %34, align 8, !tbaa !84
  ret void
}

define noundef zeroext i1 @nish.KeyState.isDown(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(72) nocapture %this, i32 noundef %key, i32 noundef %code) #4 {
entry:
  %0 = call i32 @nish.termKeyId(i32 %key, i32 %code)
  %1 = call i32 @nish.KeyState.find(%struct.KeyState* %this, i32 %0)
  %2 = icmp sge i32 %1, 0
  ret i1 %2
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyState.apply(%struct.KeyState* noundef nonnull align 8 dereferenceable(72) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %events, double noundef %nowMs) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %first.addr = alloca i32, align 4
  %0 = call %struct.nish_array* @nish.KeyState.releaseDue(%struct.KeyState* %this, double %nowMs, %struct.nish_array* %events)
  store %struct.nish_array* %0, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %k.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = icmp slt i32 %1, %4
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %k.addr, align 4
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast i8* %9 to %struct.TermEvent**
  %11 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %10, i64 %7
  %12 = load %struct.TermEvent*, %struct.TermEvent** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.TermEvent* %12, %struct.TermEvent** %e.addr, align 8
  %13 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %14 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !46
  %16 = icmp eq i32 %15, 4
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %18 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %17, i32 0, i32 16
  %19 = load i1, i1* %18, align 1, !tbaa !62
  %20 = xor i1 %19, true
  br label %land.end

land.end:
  %21 = phi i1 [ false, %for.body ], [ %20, %land.rhs ]
  br i1 %21, label %if.then, label %if.else

if.then:
  store i32 0, i32* %first.addr, align 4
  br label %while.cond

while.cond:
  %22 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !80
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = icmp sgt i32 %26, 0
  br i1 %27, label %while.body, label %while.end

while.body:
  %28 = load i32, i32* %first.addr, align 4
  %29 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.KeyState.release(%struct.KeyState* %this, i32 %28, %struct.nish_array* %29)
  br label %while.cond

while.end:
  br label %if.end

if.else:
  %30 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %31 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %30, i32 0, i32 0
  %32 = load i32, i32* %31, align 4, !tbaa !46
  %33 = icmp eq i32 %32, 1
  br i1 %33, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %34 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 9
  %35 = load i1, i1* %34, align 1, !tbaa !79
  br label %land.end.2

land.end.2:
  %36 = phi i1 [ false, %if.else ], [ %35, %land.rhs.2 ]
  br i1 %36, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %37 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %38 = call i1 @nish.termIsCtrlC(%struct.TermEvent* %37)
  br label %land.end.1

land.end.1:
  %39 = phi i1 [ false, %land.end.2 ], [ %38, %land.rhs.1 ]
  br i1 %39, label %if.then.1, label %if.else.1

if.then.1:
  %40 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %41 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %40, i32 0, i32 4
  %42 = load i32, i32* %41, align 4, !tbaa !50
  %43 = icmp eq i32 %42, 1
  br i1 %43, label %if.then.2, label %if.end.2

if.then.2:
  %44 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %45 = call i8* @nish_alloc_struct(i64 80)
  %46 = bitcast i8* %45 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %46, i32 7)
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 1
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = icmp eq i64 %48, %50
  br i1 %51, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %44, i64 8)
  br label %push.store

push.store:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = bitcast i8* %53 to %struct.TermEvent**
  %55 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %54, i64 %48
  store %struct.TermEvent* %46, %struct.TermEvent** %55, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %56 = add i64 %48, 1
  store i64 %56, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = trunc i64 %56 to i32
  br label %if.end.2

if.end.2:
  br label %for.inc

if.else.1:
  %58 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %59 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %58, i32 0, i32 0
  %60 = load i32, i32* %59, align 4, !tbaa !46
  %61 = icmp eq i32 %60, 1
  br i1 %61, label %if.then.3, label %if.end.3

if.then.3:
  %62 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  call void @nish.KeyState.press(%struct.KeyState* %this, %struct.TermEvent* %62, double %nowMs)
  br label %if.end.3

if.end.3:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %63 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %64 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = icmp eq i64 %66, %68
  br i1 %69, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %63, i64 8)
  br label %push.store.1

push.store.1:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = bitcast i8* %71 to %struct.TermEvent**
  %73 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %72, i64 %66
  store %struct.TermEvent* %64, %struct.TermEvent** %73, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %74 = add i64 %66, 1
  store i64 %74, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  br label %for.inc

for.inc:
  %76 = load i32, i32* %k.addr, align 4
  %77 = add nsw i32 %76, 1
  store i32 %77, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %78 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %78
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyState.tick(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(72) nocapture %this, double noundef %nowMs) #2 {
entry:
  %none.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %none.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %4 = call %struct.nish_array* @nish.KeyState.releaseDue(%struct.KeyState* %this, double %nowMs, %struct.nish_array* %3)
  ret %struct.nish_array* %4
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyState.releaseDue(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(72) nocapture %this, double noundef %nowMs, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %batch) #2 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %gap.addr = alloca double, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 8
  %6 = load i1, i1* %5, align 1, !tbaa !75
  %7 = xor i1 %6, true
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %8

if.end:
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %9 = load i32, i32* %k.addr, align 4
  %10 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !tbaa !80
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = icmp slt i32 %9, %14
  br i1 %15, label %while.body, label %while.end

while.body:
  %16 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !82
  %18 = load i32, i32* %k.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 %19, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %19, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %25 = bitcast i8* %24 to i1*
  %26 = getelementptr inbounds i1, i1* %25, i64 %19
  %27 = load i1, i1* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !86
  br i1 %27, label %cond.true, label %cond.false

cond.true:
  %28 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 0
  %29 = load double, double* %28, align 8, !tbaa !76
  %30 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %31 = load double, double* %30, align 8, !tbaa !78
  %32 = fmul double 0x4000000000000000, %31
  %33 = call double @nish.termMaxF64(double %29, double %32)
  br label %cond.end

cond.false:
  %34 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 1
  %35 = load double, double* %34, align 8, !tbaa !77
  %36 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %37 = load double, double* %36, align 8, !tbaa !78
  %38 = fadd double %35, %37
  br label %cond.end

cond.end:
  %39 = phi double [ %33, %cond.true ], [ %38, %cond.false ]
  store double %39, double* %gap.addr, align 8
  %40 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %41 = load %struct.nish_array*, %struct.nish_array** %40, align 8, !tbaa !81
  %42 = load i32, i32* %k.addr, align 4
  %43 = sext i32 %42 to i64
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = icmp ult i64 %43, %45
  br i1 %46, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %43, i64 %45)
  unreachable

bounds.ok.1:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = bitcast i8* %48 to double*
  %50 = getelementptr inbounds double, double* %49, i64 %43
  %51 = load double, double* %50, align 8, !alias.scope !4, !noalias !3, !tbaa !88
  %52 = fsub double %nowMs, %51
  %53 = load double, double* %gap.addr, align 8
  %54 = fcmp oge double %52, %53
  br i1 %54, label %land.rhs, label %land.end

land.rhs:
  %55 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %56 = load %struct.nish_array*, %struct.nish_array** %55, align 8, !tbaa !80
  %57 = load i32, i32* %k.addr, align 4
  %58 = sext i32 %57 to i64
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %56, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %61 = bitcast i8* %60 to i32*
  %62 = getelementptr inbounds i32, i32* %61, i64 %58
  %63 = load i32, i32* %62, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %64 = call i1 @nish.termNamesKey(%struct.nish_array* %batch, i32 %63)
  %65 = xor i1 %64, true
  br label %land.end

land.end:
  %66 = phi i1 [ false, %bounds.ok.1 ], [ %65, %land.rhs ]
  br i1 %66, label %if.then.1, label %if.else

if.then.1:
  %67 = load i32, i32* %k.addr, align 4
  %68 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.KeyState.release(%struct.KeyState* %this, i32 %67, %struct.nish_array* %68)
  br label %if.end.1

if.else:
  %69 = load i32, i32* %k.addr, align 4
  %70 = add nsw i32 %69, 1
  store i32 %70, i32* %k.addr, align 4
  br label %if.end.1

if.end.1:
  br label %while.cond

while.end:
  %71 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %71
}

define void @nish.KeyState.press(%struct.KeyState* noundef nonnull align 8 dereferenceable(72) nocapture %this, %struct.TermEvent* noundef nonnull align 8 dereferenceable(80) nocapture %e, double noundef %nowMs) #2 {
entry:
  %at.addr = alloca i32, align 4
  %since.addr = alloca double, align 8
  %0 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !47
  %2 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !48
  %4 = call i32 @nish.termKeyId(i32 %1, i32 %3)
  %5 = call i32 @nish.KeyState.find(%struct.KeyState* %this, i32 %4)
  store i32 %5, i32* %at.addr, align 4
  %6 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 4
  %7 = load i32, i32* %6, align 4, !tbaa !50
  %8 = icmp eq i32 %7, 3
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 8
  store i1 false, i1* %9, align 1, !tbaa !75
  %10 = load i32, i32* %at.addr, align 4
  %11 = icmp sge i32 %10, 0
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  %12 = load i32, i32* %at.addr, align 4
  call void @nish.KeyState.remove(%struct.KeyState* %this, i32 %12)
  br label %if.end.1

if.end.1:
  ret void

if.end:
  %13 = load i32, i32* %at.addr, align 4
  %14 = icmp slt i32 %13, 0
  br i1 %14, label %if.then.2, label %if.end.2

if.then.2:
  %15 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !80
  %17 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 1
  %18 = load i32, i32* %17, align 4, !tbaa !47
  %19 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %20 = load i32, i32* %19, align 4, !tbaa !48
  %21 = call i32 @nish.termKeyId(i32 %18, i32 %20)
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %16, i64 4)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  store i32 %21, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %34 = load %struct.nish_array*, %struct.nish_array** %33, align 8, !tbaa !81
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = icmp eq i64 %36, %38
  br i1 %39, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %34, i64 8)
  br label %push.store.1

push.store.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %36
  store double %nowMs, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !88
  %44 = add i64 %36, 1
  store i64 %44, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = trunc i64 %44 to i32
  %46 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %47 = load %struct.nish_array*, %struct.nish_array** %46, align 8, !tbaa !82
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %47, i64 1)
  br label %push.store.2

push.store.2:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast i8* %54 to i1*
  %56 = getelementptr inbounds i1, i1* %55, i64 %49
  store i1 false, i1* %56, align 1, !alias.scope !4, !noalias !3, !tbaa !86
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %60 = load %struct.nish_array*, %struct.nish_array** %59, align 8, !tbaa !83
  %61 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %62 = load i32, i32* %61, align 4, !tbaa !48
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 1
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = icmp eq i64 %64, %66
  br i1 %67, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %60, i64 4)
  br label %push.store.3

push.store.3:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = bitcast i8* %69 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 %64
  store i32 %62, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %72 = add i64 %64, 1
  store i64 %72, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = trunc i64 %72 to i32
  %74 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  %75 = load %struct.nish_array*, %struct.nish_array** %74, align 8, !tbaa !84
  %76 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 3
  %77 = load i32, i32* %76, align 4, !tbaa !49
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 1
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = icmp eq i64 %79, %81
  br i1 %82, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %75, i64 4)
  br label %push.store.4

push.store.4:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %85 = bitcast i8* %84 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 %79
  store i32 %77, i32* %86, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %87 = add i64 %79, 1
  store i64 %87, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = trunc i64 %87 to i32
  ret void

if.end.2:
  %89 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %90 = load %struct.nish_array*, %struct.nish_array** %89, align 8, !tbaa !81
  %91 = load i32, i32* %at.addr, align 4
  %92 = sext i32 %91 to i64
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = icmp ult i64 %92, %94
  br i1 %95, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %92, i64 %94)
  unreachable

bounds.ok:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %98 = bitcast i8* %97 to double*
  %99 = getelementptr inbounds double, double* %98, i64 %92
  %100 = load double, double* %99, align 8, !alias.scope !4, !noalias !3, !tbaa !88
  %101 = fsub double %nowMs, %100
  store double %101, double* %since.addr, align 8
  %102 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %103 = load %struct.nish_array*, %struct.nish_array** %102, align 8, !tbaa !82
  %104 = load i32, i32* %at.addr, align 4
  %105 = sext i32 %104 to i64
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = icmp ult i64 %105, %107
  br i1 %108, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %105, i64 %107)
  unreachable

bounds.ok.1:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %111 = bitcast i8* %110 to i1*
  %112 = getelementptr inbounds i1, i1* %111, i64 %105
  %113 = load i1, i1* %112, align 1, !alias.scope !4, !noalias !3, !tbaa !86
  br i1 %113, label %land.rhs, label %land.end

land.rhs:
  %114 = load double, double* %since.addr, align 8
  %115 = fcmp ogt double %114, 0x0000000000000000
  br label %land.end

land.end:
  %116 = phi i1 [ false, %bounds.ok.1 ], [ %115, %land.rhs ]
  br i1 %116, label %if.then.3, label %if.end.3

if.then.3:
  %117 = load double, double* %since.addr, align 8
  %118 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %119 = load double, double* %118, align 8, !tbaa !78
  %120 = fcmp ogt double %117, %119
  br i1 %120, label %cond.true, label %cond.false

cond.true:
  %121 = load double, double* %since.addr, align 8
  br label %cond.end

cond.false:
  %122 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %123 = load double, double* %122, align 8, !tbaa !78
  %124 = load double, double* %since.addr, align 8
  %125 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  %126 = load double, double* %125, align 8, !tbaa !78
  %127 = fsub double %124, %126
  %128 = fdiv double %127, 0x4020000000000000
  %129 = fadd double %123, %128
  br label %cond.end

cond.end:
  %130 = phi double [ %121, %cond.true ], [ %129, %cond.false ]
  %131 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 2
  store double %130, double* %131, align 8, !tbaa !78
  br label %if.end.3

if.end.3:
  %132 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %133 = load %struct.nish_array*, %struct.nish_array** %132, align 8, !tbaa !81
  %134 = load i32, i32* %at.addr, align 4
  %135 = sext i32 %134 to i64
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %133, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = bitcast i8* %137 to double*
  %139 = getelementptr inbounds double, double* %138, i64 %135
  store double %nowMs, double* %139, align 8, !alias.scope !4, !noalias !3, !tbaa !88
  %140 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %141 = load %struct.nish_array*, %struct.nish_array** %140, align 8, !tbaa !82
  %142 = load i32, i32* %at.addr, align 4
  %143 = sext i32 %142 to i64
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %145 = load i8*, i8** %144, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %146 = bitcast i8* %145 to i1*
  %147 = getelementptr inbounds i1, i1* %146, i64 %143
  store i1 true, i1* %147, align 1, !alias.scope !4, !noalias !3, !tbaa !86
  %148 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %149 = load %struct.nish_array*, %struct.nish_array** %148, align 8, !tbaa !83
  %150 = load i32, i32* %at.addr, align 4
  %151 = sext i32 %150 to i64
  %152 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %153 = load i32, i32* %152, align 4, !tbaa !48
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 0
  %155 = load i64, i64* %154, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = icmp ult i64 %151, %155
  br i1 %156, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %151, i64 %155)
  unreachable

bounds.ok.2:
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 2
  %158 = load i8*, i8** %157, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %159 = bitcast i8* %158 to i32*
  %160 = getelementptr inbounds i32, i32* %159, i64 %151
  store i32 %153, i32* %160, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %161 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  %162 = load %struct.nish_array*, %struct.nish_array** %161, align 8, !tbaa !84
  %163 = load i32, i32* %at.addr, align 4
  %164 = sext i32 %163 to i64
  %165 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 3
  %166 = load i32, i32* %165, align 4, !tbaa !49
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 0
  %168 = load i64, i64* %167, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %169 = icmp ult i64 %164, %168
  br i1 %169, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %164, i64 %168)
  unreachable

bounds.ok.3:
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %162, i64 0, i32 2
  %171 = load i8*, i8** %170, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %172 = bitcast i8* %171 to i32*
  %173 = getelementptr inbounds i32, i32* %172, i64 %164
  store i32 %166, i32* %173, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %174 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 8
  %175 = load i1, i1* %174, align 1, !tbaa !75
  br i1 %175, label %if.then.4, label %if.end.4

if.then.4:
  %176 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 4
  store i32 2, i32* %176, align 4, !tbaa !50
  br label %if.end.4

if.end.4:
  ret void
}

define void @nish.KeyState.release(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(72) nocapture %this, i32 noundef %at, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out) #2 {
entry:
  %id.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !80
  %2 = sext i32 %at to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %2
  %10 = load i32, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  store i32 %10, i32* %id.addr, align 4
  %11 = call i8* @nish_alloc_struct(i64 80)
  %12 = bitcast i8* %11 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %12, i32 1)
  store %struct.TermEvent* %12, %struct.TermEvent** %e.addr, align 8
  %13 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %14 = load i32, i32* %id.addr, align 4
  %15 = ashr i32 %14, 21
  %16 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %13, i32 0, i32 1
  store i32 %15, i32* %16, align 4, !tbaa !47
  %17 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %18 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !83
  %20 = sext i32 %at to i64
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = icmp ult i64 %20, %22
  br i1 %23, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %20, i64 %22)
  unreachable

bounds.ok.1:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = bitcast i8* %25 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %20
  %28 = load i32, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %29 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %17, i32 0, i32 2
  store i32 %28, i32* %29, align 4, !tbaa !48
  %30 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %31 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !84
  %33 = sext i32 %at to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ult i64 %33, %35
  br i1 %36, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %33, i64 %35)
  unreachable

bounds.ok.2:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  %41 = load i32, i32* %40, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %42 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %30, i32 0, i32 3
  store i32 %41, i32* %42, align 4, !tbaa !49
  %43 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %44 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %43, i32 0, i32 4
  store i32 3, i32* %44, align 4, !tbaa !50
  %45 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = icmp eq i64 %47, %49
  br i1 %50, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %out, i64 8)
  br label %push.store

push.store:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %52 = load i8*, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %53 = bitcast i8* %52 to %struct.TermEvent**
  %54 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %53, i64 %47
  store %struct.TermEvent* %45, %struct.TermEvent** %54, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %55 = add i64 %47, 1
  store i64 %55, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = trunc i64 %55 to i32
  call void @nish.KeyState.remove(%struct.KeyState* %this, i32 %at)
  ret void
}

define noundef i32 @nish.KeyState.find(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(72) nocapture %this, i32 noundef %id) #4 {
entry:
  %k.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !80
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %6 = load i32, i32* %k.addr, align 4
  %7 = trunc i64 %3 to i32
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %k.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %14 = icmp eq i32 %13, %id
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load i32, i32* %k.addr, align 4
  ret i32 %15

if.end:
  br label %for.inc

for.inc:
  %16 = load i32, i32* %k.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret i32 -1
}

define void @nish.KeyState.remove(%struct.KeyState* noundef nonnull readonly align 8 dereferenceable(72) nocapture %this, i32 noundef %at) #2 {
entry:
  %last.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !80
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = trunc i64 %3 to i32
  %5 = sub nsw i32 %4, 1
  store i32 %5, i32* %last.addr, align 4
  store i32 %at, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !80
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %13 = load %struct.nish_array*, %struct.nish_array** %12, align 8, !tbaa !81
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !82
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !83
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !84
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %36 = load i32, i32* %k.addr, align 4
  %37 = load i32, i32* %last.addr, align 4
  %38 = icmp slt i32 %36, %37
  br i1 %38, label %for.body, label %for.end

for.body:
  %39 = load i32, i32* %k.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = load i32, i32* %k.addr, align 4
  %42 = add nsw i32 %41, 1
  %43 = sext i32 %42 to i64
  %44 = icmp ult i64 %43, %9
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %43, i64 %9)
  unreachable

bounds.ok:
  %45 = bitcast i8* %11 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %43
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %48 = icmp ult i64 %40, %9
  br i1 %48, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %40, i64 %9)
  unreachable

bounds.ok.1:
  %49 = bitcast i8* %11 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 %40
  store i32 %47, i32* %50, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %51 = load i32, i32* %k.addr, align 4
  %52 = sext i32 %51 to i64
  %53 = load i32, i32* %k.addr, align 4
  %54 = add nsw i32 %53, 1
  %55 = sext i32 %54 to i64
  %56 = icmp ult i64 %55, %15
  br i1 %56, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %55, i64 %15)
  unreachable

bounds.ok.2:
  %57 = bitcast i8* %17 to double*
  %58 = getelementptr inbounds double, double* %57, i64 %55
  %59 = load double, double* %58, align 8, !alias.scope !4, !noalias !3, !tbaa !88
  %60 = bitcast i8* %17 to double*
  %61 = getelementptr inbounds double, double* %60, i64 %52
  store double %59, double* %61, align 8, !alias.scope !4, !noalias !3, !tbaa !88
  %62 = load i32, i32* %k.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = load i32, i32* %k.addr, align 4
  %65 = add nsw i32 %64, 1
  %66 = sext i32 %65 to i64
  %67 = icmp ult i64 %66, %21
  br i1 %67, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %66, i64 %21)
  unreachable

bounds.ok.3:
  %68 = bitcast i8* %23 to i1*
  %69 = getelementptr inbounds i1, i1* %68, i64 %66
  %70 = load i1, i1* %69, align 1, !alias.scope !4, !noalias !3, !tbaa !86
  %71 = bitcast i8* %23 to i1*
  %72 = getelementptr inbounds i1, i1* %71, i64 %63
  store i1 %70, i1* %72, align 1, !alias.scope !4, !noalias !3, !tbaa !86
  %73 = load i32, i32* %k.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = load i32, i32* %k.addr, align 4
  %76 = add nsw i32 %75, 1
  %77 = sext i32 %76 to i64
  %78 = icmp ult i64 %77, %27
  br i1 %78, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %77, i64 %27)
  unreachable

bounds.ok.4:
  %79 = bitcast i8* %29 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 %77
  %81 = load i32, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %82 = bitcast i8* %29 to i32*
  %83 = getelementptr inbounds i32, i32* %82, i64 %74
  store i32 %81, i32* %83, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %84 = load i32, i32* %k.addr, align 4
  %85 = sext i32 %84 to i64
  %86 = load i32, i32* %k.addr, align 4
  %87 = add nsw i32 %86, 1
  %88 = sext i32 %87 to i64
  %89 = icmp ult i64 %88, %33
  br i1 %89, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %88, i64 %33)
  unreachable

bounds.ok.5:
  %90 = bitcast i8* %35 to i32*
  %91 = getelementptr inbounds i32, i32* %90, i64 %88
  %92 = load i32, i32* %91, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %93 = bitcast i8* %35 to i32*
  %94 = getelementptr inbounds i32, i32* %93, i64 %85
  store i32 %92, i32* %94, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  br label %for.inc

for.inc:
  %95 = load i32, i32* %k.addr, align 4
  %96 = add nsw i32 %95, 1
  store i32 %96, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %97 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 3
  %98 = load %struct.nish_array*, %struct.nish_array** %97, align 8, !tbaa !80
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = icmp eq i64 %100, 0
  br i1 %101, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %102 = sub i64 %100, 1
  store i64 %102, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %105 = bitcast i8* %104 to i32*
  %106 = getelementptr inbounds i32, i32* %105, i64 %102
  %107 = load i32, i32* %106, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %108 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 4
  %109 = load %struct.nish_array*, %struct.nish_array** %108, align 8, !tbaa !81
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 0
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %112 = icmp eq i64 %111, 0
  br i1 %112, label %pop.empty.1, label %pop.ok.1

pop.empty.1:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.1:
  %113 = sub i64 %111, 1
  store i64 %113, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %109, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = bitcast i8* %115 to double*
  %117 = getelementptr inbounds double, double* %116, i64 %113
  %118 = load double, double* %117, align 8, !alias.scope !4, !noalias !3, !tbaa !88
  %119 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 5
  %120 = load %struct.nish_array*, %struct.nish_array** %119, align 8, !tbaa !82
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 0
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %123 = icmp eq i64 %122, 0
  br i1 %123, label %pop.empty.2, label %pop.ok.2

pop.empty.2:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.2:
  %124 = sub i64 %122, 1
  store i64 %124, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %120, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %127 = bitcast i8* %126 to i1*
  %128 = getelementptr inbounds i1, i1* %127, i64 %124
  %129 = load i1, i1* %128, align 1, !alias.scope !4, !noalias !3, !tbaa !86
  %130 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 6
  %131 = load %struct.nish_array*, %struct.nish_array** %130, align 8, !tbaa !83
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 0
  %133 = load i64, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = icmp eq i64 %133, 0
  br i1 %134, label %pop.empty.3, label %pop.ok.3

pop.empty.3:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.3:
  %135 = sub i64 %133, 1
  store i64 %135, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %137 = load i8*, i8** %136, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %138 = bitcast i8* %137 to i32*
  %139 = getelementptr inbounds i32, i32* %138, i64 %135
  %140 = load i32, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %141 = getelementptr inbounds %struct.KeyState, %struct.KeyState* %this, i32 0, i32 7
  %142 = load %struct.nish_array*, %struct.nish_array** %141, align 8, !tbaa !84
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = icmp eq i64 %144, 0
  br i1 %145, label %pop.empty.4, label %pop.ok.4

pop.empty.4:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok.4:
  %146 = sub i64 %144, 1
  store i64 %146, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 2
  %148 = load i8*, i8** %147, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %149 = bitcast i8* %148 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 %146
  %151 = load i32, i32* %150, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  ret void
}

define void @nish.FixedStep.constructor(%struct.FixedStep* noundef nonnull noalias align 8 dereferenceable(32) nocapture %this, i32 noundef %stepsPerSecond, i32 noundef %maxSteps) #3 {
entry:
  %rate.addr = alloca i32, align 4
  %0 = icmp slt i32 %stepsPerSecond, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 1, %cond.true ], [ %stepsPerSecond, %cond.false ]
  store i32 %1, i32* %rate.addr, align 4
  %2 = load i32, i32* %rate.addr, align 4
  %3 = sitofp i32 %2 to double
  %4 = fdiv double 0x408F400000000000, %3
  %5 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  store double %4, double* %5, align 8, !tbaa !90
  %6 = icmp slt i32 %maxSteps, 1
  br i1 %6, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %7 = phi i32 [ 1, %cond.true.1 ], [ %maxSteps, %cond.false.1 ]
  %8 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 3
  store i32 %7, i32* %8, align 4, !tbaa !91
  %9 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double 0x0000000000000000, double* %9, align 8, !tbaa !92
  %10 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  store double 0x0000000000000000, double* %10, align 8, !tbaa !93
  %11 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 4
  store i1 false, i1* %11, align 1, !tbaa !94
  ret void
}

define noundef i32 @nish.FixedStep.advance(%struct.FixedStep* noundef nonnull align 8 dereferenceable(32) nocapture %this, double noundef %nowMs) #2 {
entry:
  %steps.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 4
  %1 = load i1, i1* %0, align 1, !tbaa !94
  %2 = xor i1 %1, true
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  %4 = load double, double* %3, align 8, !tbaa !93
  %5 = fcmp oge double %nowMs, %4
  %6 = xor i1 %5, true
  br label %lor.end

lor.end:
  %7 = phi i1 [ true, %entry ], [ %6, %lor.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 4
  store i1 true, i1* %8, align 1, !tbaa !94
  %9 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  store double %nowMs, double* %9, align 8, !tbaa !93
  ret i32 0

if.end:
  %10 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %11 = load double, double* %10, align 8, !tbaa !92
  %12 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  %13 = load double, double* %12, align 8, !tbaa !93
  %14 = fsub double %nowMs, %13
  %15 = fadd double %11, %14
  %16 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double %15, double* %16, align 8, !tbaa !92
  %17 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 2
  store double %nowMs, double* %17, align 8, !tbaa !93
  store i32 0, i32* %steps.addr, align 4
  br label %while.cond

while.cond:
  %18 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %19 = load double, double* %18, align 8, !tbaa !92
  %20 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %21 = load double, double* %20, align 8, !tbaa !90
  %22 = fcmp oge double %19, %21
  br i1 %22, label %land.rhs, label %land.end

land.rhs:
  %23 = load i32, i32* %steps.addr, align 4
  %24 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 3
  %25 = load i32, i32* %24, align 4, !tbaa !91
  %26 = icmp slt i32 %23, %25
  br label %land.end

land.end:
  %27 = phi i1 [ false, %while.cond ], [ %26, %land.rhs ]
  br i1 %27, label %while.body, label %while.end

while.body:
  %28 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %29 = load double, double* %28, align 8, !tbaa !92
  %30 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %31 = load double, double* %30, align 8, !tbaa !90
  %32 = fsub double %29, %31
  %33 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double %32, double* %33, align 8, !tbaa !92
  %34 = load i32, i32* %steps.addr, align 4
  %35 = add nsw i32 %34, 1
  store i32 %35, i32* %steps.addr, align 4
  br label %while.cond

while.end:
  %36 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %37 = load double, double* %36, align 8, !tbaa !92
  %38 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %39 = load double, double* %38, align 8, !tbaa !90
  %40 = fcmp oge double %37, %39
  br i1 %40, label %if.then.1, label %if.end.1

if.then.1:
  %41 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %42 = load double, double* %41, align 8, !tbaa !92
  %43 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %44 = load double, double* %43, align 8, !tbaa !90
  %45 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %46 = load double, double* %45, align 8, !tbaa !92
  %47 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %48 = load double, double* %47, align 8, !tbaa !90
  %49 = fdiv double %46, %48
  %50 = call double @llvm.floor.f64(double %49)
  %51 = fmul double %44, %50
  %52 = fsub double %42, %51
  %53 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double %52, double* %53, align 8, !tbaa !92
  %54 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %55 = load double, double* %54, align 8, !tbaa !92
  %56 = fcmp oge double %55, 0x0000000000000000
  br i1 %56, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %57 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %58 = load double, double* %57, align 8, !tbaa !92
  %59 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %60 = load double, double* %59, align 8, !tbaa !90
  %61 = fcmp olt double %58, %60
  br label %land.end.1

land.end.1:
  %62 = phi i1 [ false, %if.then.1 ], [ %61, %land.rhs.1 ]
  %63 = xor i1 %62, true
  br i1 %63, label %if.then.2, label %if.end.2

if.then.2:
  %64 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  store double 0x0000000000000000, double* %64, align 8, !tbaa !92
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  %65 = load i32, i32* %steps.addr, align 4
  ret i32 %65
}

define noundef double @nish.FixedStep.alpha(%struct.FixedStep* noundef nonnull readonly align 8 dereferenceable(32) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 1
  %1 = load double, double* %0, align 8, !tbaa !92
  %2 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %this, i32 0, i32 0
  %3 = load double, double* %2, align 8, !tbaa !90
  %4 = fdiv double %1, %3
  ret double %4
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
  %char.addr = alloca i32, align 4
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
  call void @nish_panic(i8* bitcast ({ i64, [40 x i8] }* @.str.17 to i8*))
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
  %185 = load i32, i32* %final.addr.1, align 4
  %186 = icmp sge i32 %185, 64
  br i1 %186, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %187 = load i32, i32* %final.addr.1, align 4
  %188 = icmp slt i32 %187, 127
  br label %land.end.3

land.end.3:
  %189 = phi i1 [ false, %if.end.9 ], [ %188, %land.rhs.3 ]
  br i1 %189, label %if.then.11, label %if.else.1

if.then.11:
  %190 = call i8* @nish_alloc_struct(i64 8)
  %191 = bitcast i8* %190 to %struct.KeyEvent*
  %192 = load i32, i32* %final.addr.1, align 4
  %193 = call i32 @nish.termArrowKind(i32 %192)
  %194 = load i32, i32* %final.addr.1, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %191, i32 %193, i32 %194)
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %196 = load i64, i64* %195, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %198 = load i64, i64* %197, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %199 = icmp eq i64 %196, %198
  br i1 %199, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.5

push.store.5:
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %201 = load i8*, i8** %200, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %202 = bitcast i8* %201 to %struct.KeyEvent**
  %203 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %202, i64 %196
  store %struct.KeyEvent* %191, %struct.KeyEvent** %203, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %204 = add i64 %196, 1
  store i64 %204, i64* %195, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %205 = trunc i64 %204 to i32
  %206 = load i32, i32* %i.addr, align 4
  %207 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %206, i32 3)
  %208 = extractvalue { i32, i1 } %207, 0
  %209 = extractvalue { i32, i1 } %207, 1
  br i1 %209, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %208, i32* %i.addr, align 4
  br label %if.end.11

if.else.1:
  %210 = call i8* @nish_alloc_struct(i64 8)
  %211 = bitcast i8* %210 to %struct.KeyEvent*
  %212 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %211, i32 8, i32 %212)
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %214 = load i64, i64* %213, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %216 = load i64, i64* %215, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %217 = icmp eq i64 %214, %216
  br i1 %217, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.6

push.store.6:
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %219 = load i8*, i8** %218, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %220 = bitcast i8* %219 to %struct.KeyEvent**
  %221 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %220, i64 %214
  store %struct.KeyEvent* %211, %struct.KeyEvent** %221, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %222 = add i64 %214, 1
  store i64 %222, i64* %213, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %223 = trunc i64 %222 to i32
  %224 = load i32, i32* %i.addr, align 4
  %225 = add nsw i32 %224, 1
  store i32 %225, i32* %i.addr, align 4
  br label %if.end.11

if.end.11:
  br label %while.cond

if.end.8:
  %226 = call i8* @nish_alloc_struct(i64 8)
  %227 = bitcast i8* %226 to %struct.KeyEvent*
  %228 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %227, i32 8, i32 %228)
  %229 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %230 = load i64, i64* %229, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %231 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %232 = load i64, i64* %231, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %233 = icmp eq i64 %230, %232
  br i1 %233, label %push.grow.7, label %push.store.7

push.grow.7:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.7

push.store.7:
  %234 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %235 = load i8*, i8** %234, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %236 = bitcast i8* %235 to %struct.KeyEvent**
  %237 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %236, i64 %230
  store %struct.KeyEvent* %227, %struct.KeyEvent** %237, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %238 = add i64 %230, 1
  store i64 %238, i64* %229, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %239 = trunc i64 %238 to i32
  %240 = load i32, i32* %i.addr, align 4
  %241 = add nsw i32 %240, 1
  store i32 %241, i32* %i.addr, align 4
  br label %while.cond

if.end.1:
  %242 = load i32, i32* %b.addr, align 4
  %243 = icmp slt i32 %242, 128
  br i1 %243, label %if.then.12, label %if.end.12

if.then.12:
  %244 = call i8* @nish_alloc_struct(i64 8)
  %245 = bitcast i8* %244 to %struct.KeyEvent*
  %246 = load i32, i32* %b.addr, align 4
  %247 = call i32 @nish.termAsciiKind(i32 %246)
  %248 = load i32, i32* %b.addr, align 4
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %245, i32 %247, i32 %248)
  %249 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %250 = load i64, i64* %249, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %252 = load i64, i64* %251, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %253 = icmp eq i64 %250, %252
  br i1 %253, label %push.grow.8, label %push.store.8

push.grow.8:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.8

push.store.8:
  %254 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %255 = load i8*, i8** %254, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %256 = bitcast i8* %255 to %struct.KeyEvent**
  %257 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %256, i64 %250
  store %struct.KeyEvent* %245, %struct.KeyEvent** %257, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %258 = add i64 %250, 1
  store i64 %258, i64* %249, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %259 = trunc i64 %258 to i32
  %260 = load i32, i32* %i.addr, align 4
  %261 = add nsw i32 %260, 1
  store i32 %261, i32* %i.addr, align 4
  br label %while.cond

if.end.12:
  %262 = load i32, i32* %i.addr, align 4
  %263 = call i32 @nish.termUtf8At(%struct.nish_array* %bytes, i32 %262, i1 %last)
  store i32 %263, i32* %char.addr, align 4
  %264 = load i32, i32* %char.addr, align 4
  %265 = icmp slt i32 %264, 0
  br i1 %265, label %if.then.13, label %if.end.13

if.then.13:
  %266 = load i32, i32* %i.addr, align 4
  ret i32 %266

if.end.13:
  %267 = call i8* @nish_alloc_struct(i64 8)
  %268 = bitcast i8* %267 to %struct.KeyEvent*
  %269 = load i32, i32* %char.addr, align 4
  %270 = ashr i32 %269, 3
  call void @nish.KeyEvent.constructor(%struct.KeyEvent* %268, i32 1, i32 %270)
  %271 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %272 = load i64, i64* %271, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %273 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %274 = load i64, i64* %273, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %275 = icmp eq i64 %272, %274
  br i1 %275, label %push.grow.9, label %push.store.9

push.grow.9:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.9

push.store.9:
  %276 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %277 = load i8*, i8** %276, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %278 = bitcast i8* %277 to %struct.KeyEvent**
  %279 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %278, i64 %272
  store %struct.KeyEvent* %268, %struct.KeyEvent** %279, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %280 = add i64 %272, 1
  store i64 %280, i64* %271, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %281 = trunc i64 %280 to i32
  %282 = load i32, i32* %i.addr, align 4
  %283 = load i32, i32* %char.addr, align 4
  %284 = and i32 %283, 7
  %285 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %282, i32 %284)
  %286 = extractvalue { i32, i1 } %285, 0
  %287 = extractvalue { i32, i1 } %285, 1
  br i1 %287, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %286, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %288 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %289 = load i64, i64* %288, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %290 = trunc i64 %289 to i32
  ret i32 %290

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish.termUtf8At(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i, i1 noundef zeroext %last) #2 {
entry:
  %b.addr = alloca i32, align 4
  %width.addr = alloca i32, align 4
  %cp.addr = alloca i32, align 4
  %good.addr = alloca i32, align 4
  %stopped.addr = alloca i1, align 1
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %least.addr = alloca i32, align 4
  %scalar.addr = alloca i1, align 1
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = zext i8 %5 to i32
  store i32 %6, i32* %b.addr, align 4
  %7 = load i32, i32* %b.addr, align 4
  %8 = icmp slt i32 %7, 194
  br i1 %8, label %lor.end, label %lor.rhs

lor.rhs:
  %9 = load i32, i32* %b.addr, align 4
  %10 = icmp sge i32 %9, 245
  br label %lor.end

lor.end:
  %11 = phi i1 [ true, %entry ], [ %10, %lor.rhs ]
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %12 = load i32, i32* %b.addr, align 4
  %13 = call i32 @nish.termLeadWidth(i32 %12)
  br label %cond.end

cond.end:
  %14 = phi i32 [ 1, %cond.true ], [ %13, %cond.false ]
  store i32 %14, i32* %width.addr, align 4
  %15 = load i32, i32* %width.addr, align 4
  %16 = icmp eq i32 %15, 1
  br i1 %16, label %if.then, label %if.end

if.then:
  %17 = shl i32 65533, 3
  %18 = or i32 %17, 1
  ret i32 %18

if.end:
  %19 = load i32, i32* %b.addr, align 4
  %20 = load i32, i32* %width.addr, align 4
  %21 = call i32 @nish.termLeadBits(i32 %19, i32 %20)
  store i32 %21, i32* %cp.addr, align 4
  store i32 0, i32* %good.addr, align 4
  store i1 false, i1* %stopped.addr, align 1
  store i32 1, i32* %k.addr, align 4
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %26 = load i32, i32* %k.addr, align 4
  %27 = load i32, i32* %width.addr, align 4
  %28 = icmp slt i32 %26, %27
  br i1 %28, label %land.rhs, label %land.end

land.rhs:
  %29 = load i1, i1* %stopped.addr, align 1
  %30 = xor i1 %29, true
  br label %land.end

land.end:
  %31 = phi i1 [ false, %for.cond ], [ %30, %land.rhs ]
  br i1 %31, label %for.body, label %for.end

for.body:
  %32 = load i32, i32* %k.addr, align 4
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok

ovf.ok:
  %36 = trunc i64 %23 to i32
  %37 = icmp sge i32 %34, %36
  br i1 %37, label %if.then.1, label %if.else

if.then.1:
  store i1 true, i1* %stopped.addr, align 1
  br label %if.end.1

if.else:
  %38 = load i32, i32* %k.addr, align 4
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %42 = sext i32 %40 to i64
  %43 = icmp ult i64 %42, %23
  br i1 %43, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %42, i64 %23)
  unreachable

bounds.ok:
  %44 = bitcast i8* %25 to i8*
  %45 = getelementptr inbounds i8, i8* %44, i64 %42
  %46 = load i8, i8* %45, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = zext i8 %46 to i32
  store i32 %47, i32* %c.addr, align 4
  %48 = load i32, i32* %c.addr, align 4
  %49 = icmp slt i32 %48, 128
  br i1 %49, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %50 = load i32, i32* %c.addr, align 4
  %51 = icmp sge i32 %50, 192
  br label %lor.end.1

lor.end.1:
  %52 = phi i1 [ true, %bounds.ok ], [ %51, %lor.rhs.1 ]
  br i1 %52, label %if.then.2, label %if.else.1

if.then.2:
  store i1 true, i1* %stopped.addr, align 1
  br label %if.end.2

if.else.1:
  %53 = load i32, i32* %cp.addr, align 4
  %54 = shl i32 %53, 6
  %55 = load i32, i32* %c.addr, align 4
  %56 = and i32 %55, 63
  %57 = or i32 %54, %56
  store i32 %57, i32* %cp.addr, align 4
  %58 = load i32, i32* %good.addr, align 4
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 1)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %60, i32* %good.addr, align 4
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %62 = load i32, i32* %k.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %64 = load i32, i32* %good.addr, align 4
  %65 = load i32, i32* %width.addr, align 4
  %66 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %65, i32 1)
  %67 = extractvalue { i32, i1 } %66, 0
  %68 = extractvalue { i32, i1 } %66, 1
  br i1 %68, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %69 = icmp slt i32 %64, %67
  br i1 %69, label %if.then.3, label %if.end.3

if.then.3:
  %70 = xor i1 %last, true
  br i1 %70, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %71 = add nsw i32 %i, 1
  %72 = load i32, i32* %good.addr, align 4
  %73 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %71, i32 %72)
  %74 = extractvalue { i32, i1 } %73, 0
  %75 = extractvalue { i32, i1 } %73, 1
  br i1 %75, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = trunc i64 %77 to i32
  %79 = icmp sge i32 %74, %78
  br label %land.end.1

land.end.1:
  %80 = phi i1 [ false, %if.then.3 ], [ %79, %ovf.ok.4 ]
  br i1 %80, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 -1

if.end.4:
  %81 = shl i32 65533, 3
  %82 = load i32, i32* %good.addr, align 4
  %83 = add nsw i32 1, %82
  %84 = or i32 %81, %83
  ret i32 %84

if.end.3:
  store i32 65536, i32* %least.addr, align 4
  %85 = load i32, i32* %width.addr, align 4
  %86 = icmp eq i32 %85, 2
  br i1 %86, label %if.then.5, label %if.else.2

if.then.5:
  store i32 160, i32* %least.addr, align 4
  br label %if.end.5

if.else.2:
  %87 = load i32, i32* %width.addr, align 4
  %88 = icmp eq i32 %87, 3
  br i1 %88, label %if.then.6, label %if.end.6

if.then.6:
  store i32 2048, i32* %least.addr, align 4
  br label %if.end.6

if.end.6:
  br label %if.end.5

if.end.5:
  %89 = load i32, i32* %cp.addr, align 4
  %90 = load i32, i32* %least.addr, align 4
  %91 = icmp sge i32 %89, %90
  br i1 %91, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %92 = load i32, i32* %cp.addr, align 4
  %93 = icmp slt i32 %92, 1114112
  br label %land.end.3

land.end.3:
  %94 = phi i1 [ false, %if.end.5 ], [ %93, %land.rhs.3 ]
  br i1 %94, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %95 = load i32, i32* %cp.addr, align 4
  %96 = icmp sge i32 %95, 55296
  br i1 %96, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %97 = load i32, i32* %cp.addr, align 4
  %98 = icmp slt i32 %97, 57344
  br label %land.end.4

land.end.4:
  %99 = phi i1 [ false, %land.rhs.2 ], [ %98, %land.rhs.4 ]
  %100 = xor i1 %99, true
  br label %land.end.2

land.end.2:
  %101 = phi i1 [ false, %land.end.3 ], [ %100, %land.end.4 ]
  store i1 %101, i1* %scalar.addr, align 1
  %102 = load i1, i1* %scalar.addr, align 1
  br i1 %102, label %cond.true.1, label %cond.false.1

cond.true.1:
  %103 = load i32, i32* %cp.addr, align 4
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %104 = phi i32 [ %103, %cond.true.1 ], [ 65533, %cond.false.1 ]
  %105 = shl i32 %104, 3
  %106 = load i32, i32* %width.addr, align 4
  %107 = or i32 %105, %106
  ret i32 %107

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body ], [ 0, %if.else ], [ 0, %if.else.1 ], [ 1, %for.end ], [ 0, %land.rhs.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(80) %struct.TermEvent* @nish.termKeyEvent(i32 noundef %key, i32 noundef %code, i32 noundef %mods, i32 noundef %action) #3 {
entry:
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = call i8* @nish_alloc_struct(i64 80)
  %1 = bitcast i8* %0 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %1, i32 1)
  store %struct.TermEvent* %1, %struct.TermEvent** %e.addr, align 8
  %2 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %2, i32 0, i32 1
  store i32 %key, i32* %3, align 4, !tbaa !47
  %4 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %5 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %4, i32 0, i32 2
  store i32 %code, i32* %5, align 4, !tbaa !48
  %6 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %7 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %6, i32 0, i32 3
  store i32 %mods, i32* %7, align 4, !tbaa !49
  %8 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %9 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %8, i32 0, i32 4
  store i32 %action, i32* %9, align 4, !tbaa !50
  %10 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %10
}

define internal noundef i32 @nish.termModifiers(i32 noundef %raw) #1 {
entry:
  %0 = icmp slt i32 %raw, 1
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub nsw i32 %raw, 1
  %2 = and i32 %1, 63
  br label %cond.end

cond.end:
  %3 = phi i32 [ 0, %cond.true ], [ %2, %cond.false ]
  ret i32 %3
}

define internal noundef i32 @nish.termAction(i32 noundef %raw) #1 {
entry:
  %0 = icmp eq i32 %raw, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 2

if.end:
  %1 = icmp eq i32 %raw, 3
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 3, %cond.true ], [ 1, %cond.false ]
  ret i32 %2
}

define internal noundef i32 @nish.termCsiField(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to, i32 noundef %field, i32 noundef %sub) #2 {
entry:
  %f.addr = alloca i32, align 4
  %s.addr = alloca i32, align 4
  %value.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  store i32 0, i32* %f.addr, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 -1, i32* %value.addr, align 4
  store i32 %from, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = icmp slt i32 %4, %to
  br i1 %5, label %land.rhs, label %land.end

land.rhs:
  %6 = load i32, i32* %k.addr, align 4
  %7 = trunc i64 %1 to i32
  %8 = icmp slt i32 %6, %7
  br label %land.end

land.end:
  %9 = phi i1 [ false, %for.cond ], [ %8, %land.rhs ]
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %k.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = icmp ult i64 %11, %1
  br i1 %12, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %1)
  unreachable

bounds.ok:
  %13 = bitcast i8* %3 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 %11
  %15 = load i8, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = zext i8 %15 to i32
  store i32 %16, i32* %c.addr, align 4
  %17 = load i32, i32* %c.addr, align 4
  %18 = icmp eq i32 %17, 59
  br i1 %18, label %if.then, label %if.else

if.then:
  %19 = load i32, i32* %f.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 1)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %21, i32* %f.addr, align 4
  store i32 0, i32* %s.addr, align 4
  br label %if.end

if.else:
  %23 = load i32, i32* %c.addr, align 4
  %24 = icmp eq i32 %23, 58
  br i1 %24, label %if.then.1, label %if.else.1

if.then.1:
  %25 = load i32, i32* %s.addr, align 4
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 1)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %27, i32* %s.addr, align 4
  br label %if.end.1

if.else.1:
  %29 = load i32, i32* %c.addr, align 4
  %30 = icmp sge i32 %29, 48
  br i1 %30, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %31 = load i32, i32* %c.addr, align 4
  %32 = add nsw i32 48, 10
  %33 = icmp slt i32 %31, %32
  br label %land.end.3

land.end.3:
  %34 = phi i1 [ false, %if.else.1 ], [ %33, %land.rhs.3 ]
  br i1 %34, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %35 = load i32, i32* %f.addr, align 4
  %36 = icmp eq i32 %35, %field
  br label %land.end.2

land.end.2:
  %37 = phi i1 [ false, %land.end.3 ], [ %36, %land.rhs.2 ]
  br i1 %37, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %38 = load i32, i32* %s.addr, align 4
  %39 = icmp eq i32 %38, %sub
  br label %land.end.1

land.end.1:
  %40 = phi i1 [ false, %land.end.2 ], [ %39, %land.rhs.1 ]
  br i1 %40, label %if.then.2, label %if.end.2

if.then.2:
  %41 = load i32, i32* %value.addr, align 4
  %42 = icmp slt i32 %41, 0
  br i1 %42, label %if.then.3, label %if.else.2

if.then.3:
  %43 = load i32, i32* %c.addr, align 4
  %44 = sub nsw i32 %43, 48
  store i32 %44, i32* %value.addr, align 4
  br label %if.end.3

if.else.2:
  %45 = load i32, i32* %value.addr, align 4
  %46 = icmp slt i32 %45, 10000000
  br i1 %46, label %if.then.4, label %if.end.4

if.then.4:
  %47 = load i32, i32* %value.addr, align 4
  %48 = mul nsw i32 %47, 10
  %49 = load i32, i32* %c.addr, align 4
  %50 = sub nsw i32 %49, 48
  %51 = add nsw i32 %48, %50
  store i32 %51, i32* %value.addr, align 4
  br label %if.end.4

if.end.4:
  br label %if.end.3

if.end.3:
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %52 = load i32, i32* %k.addr, align 4
  %53 = add nsw i32 %52, 1
  store i32 %53, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %54 = load i32, i32* %value.addr, align 4
  ret i32 %54

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.termCsiParams(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to) #2 {
entry:
  %params.addr = alloca %struct.nish_array*, align 8
  %fields.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %v.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %params.addr, align 8
  %5 = icmp sge i32 %from, %to
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load %struct.nish_array*, %struct.nish_array** %params.addr, align 8
  ret %struct.nish_array* %6

if.end:
  store i32 1, i32* %fields.addr, align 4
  store i32 %from, i32* %k.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %11 = load i32, i32* %k.addr, align 4
  %12 = icmp slt i32 %11, %to
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %k.addr, align 4
  %14 = trunc i64 %8 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %for.cond ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %k.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = icmp ult i64 %18, %8
  br i1 %19, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %18, i64 %8)
  unreachable

bounds.ok:
  %20 = bitcast i8* %10 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %18
  %22 = load i8, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = zext i8 %22 to i32
  %24 = icmp eq i32 %23, 59
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  %25 = load i32, i32* %fields.addr, align 4
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 1)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %27, i32* %fields.addr, align 4
  br label %if.end.1

if.end.1:
  br label %for.inc

for.inc:
  %29 = load i32, i32* %k.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %k.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %f.addr, align 4
  br label %for.cond.1

for.cond.1:
  %31 = load i32, i32* %f.addr, align 4
  %32 = load i32, i32* %fields.addr, align 4
  %33 = icmp slt i32 %31, %32
  br i1 %33, label %for.body.1, label %for.end.1

for.body.1:
  %34 = load i32, i32* %f.addr, align 4
  %35 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 %34, i32 0)
  store i32 %35, i32* %v.addr, align 4
  %36 = load %struct.nish_array*, %struct.nish_array** %params.addr, align 8
  %37 = load i32, i32* %v.addr, align 4
  %38 = icmp slt i32 %37, 0
  br i1 %38, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %39 = load i32, i32* %v.addr, align 4
  br label %cond.end

cond.end:
  %40 = phi i32 [ 0, %cond.true ], [ %39, %cond.false ]
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = icmp eq i64 %42, %44
  br i1 %45, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %36, i64 4)
  br label %push.store

push.store:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = bitcast i8* %47 to i32*
  %49 = getelementptr inbounds i32, i32* %48, i64 %42
  store i32 %40, i32* %49, align 4, !alias.scope !4, !noalias !3, !tbaa !36
  %50 = add i64 %42, 1
  store i64 %50, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  br label %for.inc.1

for.inc.1:
  %52 = load i32, i32* %f.addr, align 4
  %53 = add nsw i32 %52, 1
  store i32 %53, i32* %f.addr, align 4
  br label %for.cond.1

for.end.1:
  %54 = load %struct.nish_array*, %struct.nish_array** %params.addr, align 8
  ret %struct.nish_array* %54

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @nish.termBytesRange(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to) #2 {
entry:
  %part.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %part.addr, align 8
  store i32 %from, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp slt i32 %3, %to
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %for.cond ], [ %9, %land.rhs ]
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load %struct.nish_array*, %struct.nish_array** %part.addr, align 8
  %12 = load i32, i32* %k.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = bitcast i8* %18 to i8*
  %20 = getelementptr inbounds i8, i8* %19, i64 %13
  %21 = load i8, i8* %20, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 1)
  br label %push.store

push.store:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %28 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 %23
  store i8 %21, i8* %30, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  br label %for.inc

for.inc:
  %33 = load i32, i32* %k.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %35 = load %struct.nish_array*, %struct.nish_array** %part.addr, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %part.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = trunc i64 %38 to i32
  %40 = call i64 @nish_arena_mark()
  %41 = call i8* @nish.termBytesText(%struct.nish_array* %35, i32 %39)
  %42 = call i8* @nish_arena_keep(i64 %40, i8* %41)
  ret i8* %42
}

define internal void @nish.termPushUtf8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %out, i32 noundef %cp) #3 {
entry:
  %c.addr = alloca i32, align 4
  %0 = icmp sge i32 %cp, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp slt i32 %cp, 1114112
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = icmp sge i32 %cp, 55296
  br i1 %3, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %4 = icmp slt i32 %cp, 57344
  br label %land.end.2

land.end.2:
  %5 = phi i1 [ false, %land.rhs ], [ %4, %land.rhs.2 ]
  %6 = xor i1 %5, true
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.end.2 ]
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ %cp, %cond.true ], [ 65533, %cond.false ]
  store i32 %8, i32* %c.addr, align 4
  %9 = load i32, i32* %c.addr, align 4
  %10 = icmp slt i32 %9, 128
  br i1 %10, label %if.then, label %if.else

if.then:
  %11 = load i32, i32* %c.addr, align 4
  %12 = trunc i32 %11 to i8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %14
  store i8 %12, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  br label %if.end

if.else:
  %24 = load i32, i32* %c.addr, align 4
  %25 = icmp slt i32 %24, 2048
  br i1 %25, label %if.then.1, label %if.else.1

if.then.1:
  %26 = load i32, i32* %c.addr, align 4
  %27 = ashr i32 %26, 6
  %28 = or i32 %27, 192
  %29 = trunc i32 %28 to i8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = icmp eq i64 %31, %33
  br i1 %34, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.1

push.store.1:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = bitcast i8* %36 to i8*
  %38 = getelementptr inbounds i8, i8* %37, i64 %31
  store i8 %29, i8* %38, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %39 = add i64 %31, 1
  store i64 %39, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = trunc i64 %39 to i32
  %41 = load i32, i32* %c.addr, align 4
  %42 = and i32 %41, 63
  %43 = or i32 %42, 128
  %44 = trunc i32 %43 to i8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = icmp eq i64 %46, %48
  br i1 %49, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.2

push.store.2:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = bitcast i8* %51 to i8*
  %53 = getelementptr inbounds i8, i8* %52, i64 %46
  store i8 %44, i8* %53, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = add i64 %46, 1
  store i64 %54, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  br label %if.end.1

if.else.1:
  %56 = load i32, i32* %c.addr, align 4
  %57 = icmp slt i32 %56, 65536
  br i1 %57, label %if.then.2, label %if.else.2

if.then.2:
  %58 = load i32, i32* %c.addr, align 4
  %59 = ashr i32 %58, 12
  %60 = or i32 %59, 224
  %61 = trunc i32 %60 to i8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = icmp eq i64 %63, %65
  br i1 %66, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.3

push.store.3:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = bitcast i8* %68 to i8*
  %70 = getelementptr inbounds i8, i8* %69, i64 %63
  store i8 %61, i8* %70, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = add i64 %63, 1
  store i64 %71, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = trunc i64 %71 to i32
  %73 = load i32, i32* %c.addr, align 4
  %74 = ashr i32 %73, 6
  %75 = and i32 %74, 63
  %76 = or i32 %75, 128
  %77 = trunc i32 %76 to i8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %82 = icmp eq i64 %79, %81
  br i1 %82, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.4

push.store.4:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %85 = bitcast i8* %84 to i8*
  %86 = getelementptr inbounds i8, i8* %85, i64 %79
  store i8 %77, i8* %86, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %87 = add i64 %79, 1
  store i64 %87, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = trunc i64 %87 to i32
  %89 = load i32, i32* %c.addr, align 4
  %90 = and i32 %89, 63
  %91 = or i32 %90, 128
  %92 = trunc i32 %91 to i8
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %94 = load i64, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %96 = load i64, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %97 = icmp eq i64 %94, %96
  br i1 %97, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.5

push.store.5:
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %100 = bitcast i8* %99 to i8*
  %101 = getelementptr inbounds i8, i8* %100, i64 %94
  store i8 %92, i8* %101, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %102 = add i64 %94, 1
  store i64 %102, i64* %93, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = trunc i64 %102 to i32
  br label %if.end.2

if.else.2:
  %104 = load i32, i32* %c.addr, align 4
  %105 = ashr i32 %104, 18
  %106 = or i32 %105, 240
  %107 = trunc i32 %106 to i8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %109 = load i64, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %112 = icmp eq i64 %109, %111
  br i1 %112, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.6

push.store.6:
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %114 = load i8*, i8** %113, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %115 = bitcast i8* %114 to i8*
  %116 = getelementptr inbounds i8, i8* %115, i64 %109
  store i8 %107, i8* %116, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = add i64 %109, 1
  store i64 %117, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %118 = trunc i64 %117 to i32
  %119 = load i32, i32* %c.addr, align 4
  %120 = ashr i32 %119, 12
  %121 = and i32 %120, 63
  %122 = or i32 %121, 128
  %123 = trunc i32 %122 to i8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %127 = load i64, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %128 = icmp eq i64 %125, %127
  br i1 %128, label %push.grow.7, label %push.store.7

push.grow.7:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.7

push.store.7:
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %130 = load i8*, i8** %129, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %131 = bitcast i8* %130 to i8*
  %132 = getelementptr inbounds i8, i8* %131, i64 %125
  store i8 %123, i8* %132, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %133 = add i64 %125, 1
  store i64 %133, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %134 = trunc i64 %133 to i32
  %135 = load i32, i32* %c.addr, align 4
  %136 = ashr i32 %135, 6
  %137 = and i32 %136, 63
  %138 = or i32 %137, 128
  %139 = trunc i32 %138 to i8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %144 = icmp eq i64 %141, %143
  br i1 %144, label %push.grow.8, label %push.store.8

push.grow.8:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.8

push.store.8:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %147 = bitcast i8* %146 to i8*
  %148 = getelementptr inbounds i8, i8* %147, i64 %141
  store i8 %139, i8* %148, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %149 = add i64 %141, 1
  store i64 %149, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %150 = trunc i64 %149 to i32
  %151 = load i32, i32* %c.addr, align 4
  %152 = and i32 %151, 63
  %153 = or i32 %152, 128
  %154 = trunc i32 %153 to i8
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 0
  %156 = load i64, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 1
  %158 = load i64, i64* %157, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %159 = icmp eq i64 %156, %158
  br i1 %159, label %push.grow.9, label %push.store.9

push.grow.9:
  call void @nish_array_grow(%struct.nish_array* %out, i64 1)
  br label %push.store.9

push.store.9:
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %out, i64 0, i32 2
  %161 = load i8*, i8** %160, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %162 = bitcast i8* %161 to i8*
  %163 = getelementptr inbounds i8, i8* %162, i64 %156
  store i8 %154, i8* %163, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %164 = add i64 %156, 1
  store i64 %164, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %165 = trunc i64 %164 to i32
  br label %if.end.2

if.end.2:
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  ret void
}

define internal noundef i32 @nish.termKittyKind(i32 noundef %code) #1 {
entry:
  %0 = icmp eq i32 %code, 13
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 6

if.end:
  %1 = icmp eq i32 %code, 9
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 10

if.end.1:
  %2 = icmp eq i32 %code, 127
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = icmp eq i32 %code, 8
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %if.end.1 ], [ %3, %lor.rhs ]
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 11

if.end.2:
  %5 = icmp eq i32 %code, 27
  br i1 %5, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 8

if.end.3:
  %6 = icmp eq i32 %code, 32
  br i1 %6, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 7

if.end.4:
  %7 = icmp slt i32 %code, 0
  br i1 %7, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %8 = icmp sge i32 %code, 57344
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = icmp slt i32 %code, 63744
  br label %land.end

land.end:
  %10 = phi i1 [ false, %lor.rhs.2 ], [ %9, %land.rhs ]
  br label %lor.end.2

lor.end.2:
  %11 = phi i1 [ true, %if.end.4 ], [ %10, %land.end ]
  br i1 %11, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %12 = icmp sge i32 %code, 1114112
  br label %lor.end.1

lor.end.1:
  %13 = phi i1 [ true, %lor.end.2 ], [ %12, %lor.rhs.1 ]
  br i1 %13, label %if.then.5, label %if.end.5

if.then.5:
  ret i32 13

if.end.5:
  %14 = icmp slt i32 %code, 32
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %15 = phi i32 [ 12, %cond.true ], [ 1, %cond.false ]
  ret i32 %15
}

define internal noundef i32 @nish.termTildeKind(i32 noundef %n) #2 {
entry:
  %0 = icmp eq i32 %n, 1
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp eq i32 %n, 7
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i32 26

if.end:
  %3 = icmp eq i32 %n, 4
  br i1 %3, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %4 = icmp eq i32 %n, 8
  br label %lor.end.1

lor.end.1:
  %5 = phi i1 [ true, %if.end ], [ %4, %lor.rhs.1 ]
  br i1 %5, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 27

if.end.1:
  %6 = icmp eq i32 %n, 2
  br i1 %6, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 30

if.end.2:
  %7 = icmp eq i32 %n, 3
  br i1 %7, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 31

if.end.3:
  %8 = icmp eq i32 %n, 5
  br i1 %8, label %if.then.4, label %if.end.4

if.then.4:
  ret i32 28

if.end.4:
  %9 = icmp eq i32 %n, 6
  br i1 %9, label %if.then.5, label %if.end.5

if.then.5:
  ret i32 29

if.end.5:
  %10 = icmp sge i32 %n, 11
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = icmp sle i32 %n, 15
  br label %land.end

land.end:
  %12 = phi i1 [ false, %if.end.5 ], [ %11, %land.rhs ]
  br i1 %12, label %if.then.6, label %if.end.6

if.then.6:
  %13 = sub nsw i32 %n, 11
  %14 = add nsw i32 14, %13
  ret i32 %14

if.end.6:
  %15 = icmp sge i32 %n, 17
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = icmp sle i32 %n, 21
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %if.end.6 ], [ %16, %land.rhs.1 ]
  br i1 %17, label %if.then.7, label %if.end.7

if.then.7:
  %18 = sub nsw i32 %n, 17
  %19 = add nsw i32 19, %18
  ret i32 %19

if.end.7:
  %20 = icmp eq i32 %n, 23
  br i1 %20, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %21 = icmp eq i32 %n, 24
  br label %lor.end.2

lor.end.2:
  %22 = phi i1 [ true, %if.end.7 ], [ %21, %lor.rhs.2 ]
  br i1 %22, label %if.then.8, label %if.end.8

if.then.8:
  %23 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 23)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 24, i32 %24)
  %27 = extractvalue { i32, i1 } %26, 0
  %28 = extractvalue { i32, i1 } %26, 1
  br i1 %28, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %27

if.end.8:
  ret i32 13

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.then.8 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @nish.termLetterKind(i32 noundef %f) #1 {
entry:
  %0 = icmp eq i32 %f, 72
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 26

if.end:
  %1 = icmp eq i32 %f, 70
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 27

if.end.1:
  %2 = icmp sge i32 %f, 80
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = icmp sle i32 %f, 83
  br label %land.end

land.end:
  %4 = phi i1 [ false, %if.end.1 ], [ %3, %land.rhs ]
  br i1 %4, label %if.then.2, label %if.end.2

if.then.2:
  %5 = sub nsw i32 %f, 80
  %6 = add nsw i32 14, %5
  ret i32 %6

if.end.2:
  %7 = tail call i32 @nish.termArrowKind(i32 %f)
  ret i32 %7
}

define internal noundef zeroext i1 @nish.termIsCtrlC(%struct.TermEvent* noundef nonnull readonly align 8 dereferenceable(80) nocapture %e) #0 {
entry:
  %0 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !47
  %2 = icmp eq i32 %1, 9
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 1
  %4 = load i32, i32* %3, align 4, !tbaa !47
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %6 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 2
  %7 = load i32, i32* %6, align 4, !tbaa !48
  %8 = icmp eq i32 %7, 99
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %lor.rhs ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %e, i32 0, i32 3
  %11 = load i32, i32* %10, align 4, !tbaa !49
  %12 = icmp eq i32 %11, 4
  br label %land.end

land.end:
  %13 = phi i1 [ false, %land.end.1 ], [ %12, %land.rhs ]
  br label %lor.end

lor.end:
  %14 = phi i1 [ true, %entry ], [ %13, %land.end ]
  ret i1 %14
}

define internal noundef double @nish.termMaxF64(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fcmp ogt double %a, %b
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi double [ %a, %cond.true ], [ %b, %cond.false ]
  ret double %1
}

define internal noundef zeroext i1 @nish.termNamesKey(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %batch, i32 noundef %id) #4 {
entry:
  %k.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  store i32 0, i32* %k.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %batch, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %batch, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %k.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %k.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = bitcast i8* %3 to %struct.TermEvent**
  %10 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %9, i64 %8
  %11 = load %struct.TermEvent*, %struct.TermEvent** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.TermEvent* %11, %struct.TermEvent** %e.addr, align 8
  %12 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %13 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !46
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %land.rhs, label %land.end

land.rhs:
  %16 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %17 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4, !tbaa !47
  %19 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %20 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %19, i32 0, i32 2
  %21 = load i32, i32* %20, align 4, !tbaa !48
  %22 = call i32 @nish.termKeyId(i32 %18, i32 %21)
  %23 = icmp eq i32 %22, %id
  br label %land.end

land.end:
  %24 = phi i1 [ false, %for.body ], [ %23, %land.rhs ]
  br i1 %24, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %25 = load i32, i32* %k.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %k.addr, align 4
  br label %for.cond

for.end:
  ret i1 false
}

define internal noundef i32 @nish.termKeyId(i32 noundef %key, i32 noundef %code) #1 {
entry:
  %c.addr = alloca i32, align 4
  %0 = icmp eq i32 %key, 1
  br i1 %0, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %1 = icmp eq i32 %key, 12
  br label %lor.end.1

lor.end.1:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.1 ]
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = icmp eq i32 %key, 13
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %lor.end.1 ], [ %3, %lor.rhs ]
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ %code, %cond.true ], [ 0, %cond.false ]
  store i32 %5, i32* %c.addr, align 4
  %6 = icmp eq i32 %key, 1
  br i1 %6, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %7 = load i32, i32* %c.addr, align 4
  %8 = icmp sge i32 %7, 65
  br label %land.end.1

land.end.1:
  %9 = phi i1 [ false, %cond.end ], [ %8, %land.rhs.1 ]
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp sle i32 %10, 90
  br label %land.end

land.end:
  %12 = phi i1 [ false, %land.end.1 ], [ %11, %land.rhs ]
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %c.addr, align 4
  %14 = add nsw i32 %13, 32
  store i32 %14, i32* %c.addr, align 4
  br label %if.end

if.end:
  %15 = shl i32 %key, 21
  %16 = load i32, i32* %c.addr, align 4
  %17 = and i32 %16, 2097151
  %18 = or i32 %15, %17
  ret i32 %18
}

define internal noundef i32 @nish.termPasteEndByte(i32 noundef %k) #1 {
entry:
  %0 = icmp eq i32 %k, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 27

if.end:
  %1 = icmp eq i32 %k, 1
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 91

if.end.1:
  %2 = icmp eq i32 %k, 5
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 126

if.end.2:
  %3 = icmp eq i32 %k, 3
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 48

if.end.3:
  %4 = icmp eq i32 %k, 2
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ 50, %cond.true ], [ 49, %cond.false ]
  ret i32 %5
}

define internal noundef i32 @nish.termDecodePaste(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #2 {
entry:
  %n.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %m.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 %i, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %k.addr, align 4
  %4 = icmp sge i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %k.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp slt i32 %5, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %while.cond ], [ %9, %land.rhs ]
  br i1 %10, label %while.body, label %while.end

while.body:
  store i32 0, i32* %m.addr, align 4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %15 = load i32, i32* %m.addr, align 4
  %16 = icmp slt i32 %15, 6
  br i1 %16, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %17 = load i32, i32* %k.addr, align 4
  %18 = load i32, i32* %m.addr, align 4
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  %22 = load i32, i32* %n.addr, align 4
  %23 = icmp slt i32 %20, %22
  br label %land.end.2

land.end.2:
  %24 = phi i1 [ false, %while.cond.1 ], [ %23, %ovf.ok ]
  br i1 %24, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %25 = load i32, i32* %k.addr, align 4
  %26 = load i32, i32* %m.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %26)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %30 = sext i32 %28 to i64
  %31 = icmp ult i64 %30, %12
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %30, i64 %12)
  unreachable

bounds.ok:
  %32 = bitcast i8* %14 to i8*
  %33 = getelementptr inbounds i8, i8* %32, i64 %30
  %34 = load i8, i8* %33, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = zext i8 %34 to i32
  %36 = load i32, i32* %m.addr, align 4
  %37 = call i32 @nish.termPasteEndByte(i32 %36)
  %38 = icmp eq i32 %35, %37
  br label %land.end.1

land.end.1:
  %39 = phi i1 [ false, %land.end.2 ], [ %38, %bounds.ok ]
  br i1 %39, label %while.body.1, label %while.end.1

while.body.1:
  %40 = load i32, i32* %m.addr, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %m.addr, align 4
  br label %while.cond.1

while.end.1:
  %42 = load i32, i32* %m.addr, align 4
  %43 = icmp eq i32 %42, 6
  br i1 %43, label %lor.end, label %lor.rhs

lor.rhs:
  %44 = load i32, i32* %m.addr, align 4
  %45 = icmp sgt i32 %44, 0
  br i1 %45, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %46 = load i32, i32* %k.addr, align 4
  %47 = load i32, i32* %m.addr, align 4
  %48 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 %47)
  %49 = extractvalue { i32, i1 } %48, 0
  %50 = extractvalue { i32, i1 } %48, 1
  br i1 %50, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %51 = load i32, i32* %n.addr, align 4
  %52 = icmp eq i32 %49, %51
  br label %land.end.4

land.end.4:
  %53 = phi i1 [ false, %lor.rhs ], [ %52, %ovf.ok.2 ]
  br i1 %53, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %54 = xor i1 %last, true
  br label %land.end.3

land.end.3:
  %55 = phi i1 [ false, %land.end.4 ], [ %54, %land.rhs.3 ]
  br label %lor.end

lor.end:
  %56 = phi i1 [ true, %while.end.1 ], [ %55, %land.end.3 ]
  br i1 %56, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  %57 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  %58 = load %struct.nish_array*, %struct.nish_array** %57, align 8, !tbaa !73
  %59 = load i32, i32* %k.addr, align 4
  %60 = sext i32 %59 to i64
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast i8* %62 to i8*
  %64 = getelementptr inbounds i8, i8* %63, i64 %60
  %65 = load i8, i8* %64, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 1
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = icmp eq i64 %67, %69
  br i1 %70, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %58, i64 1)
  br label %push.store

push.store:
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %73 = bitcast i8* %72 to i8*
  %74 = getelementptr inbounds i8, i8* %73, i64 %67
  store i8 %65, i8* %74, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %75 = add i64 %67, 1
  store i64 %75, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = trunc i64 %75 to i32
  %77 = load i32, i32* %k.addr, align 4
  %78 = add nsw i32 %77, 1
  store i32 %78, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %79 = load i32, i32* %k.addr, align 4
  %80 = load i32, i32* %n.addr, align 4
  %81 = icmp sge i32 %79, %80
  br i1 %81, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %82 = load i32, i32* %k.addr, align 4
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %82, i32 6)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %86 = load i32, i32* %n.addr, align 4
  %87 = icmp sgt i32 %84, %86
  br label %lor.end.1

lor.end.1:
  %88 = phi i1 [ true, %while.end ], [ %87, %ovf.ok.3 ]
  br i1 %88, label %if.then.1, label %if.end.1

if.then.1:
  %89 = load i32, i32* %k.addr, align 4
  ret i32 %89

if.end.1:
  %90 = call i8* @nish_alloc_struct(i64 80)
  %91 = bitcast i8* %90 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %91, i32 3)
  store %struct.TermEvent* %91, %struct.TermEvent** %e.addr, align 8
  %92 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %93 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  %94 = load %struct.nish_array*, %struct.nish_array** %93, align 8, !tbaa !73
  %95 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  %96 = load %struct.nish_array*, %struct.nish_array** %95, align 8, !tbaa !73
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %99 = trunc i64 %98 to i32
  %100 = call i64 @nish_arena_mark()
  %101 = call i8* @nish.termBytesText(%struct.nish_array* %94, i32 %99)
  %102 = call i8* @nish_arena_keep(i64 %100, i8* %101)
  %103 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %92, i32 0, i32 10
  store i8* %102, i8** %103, align 8, !tbaa !56
  %104 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %108 = load i64, i64* %107, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %109 = icmp eq i64 %106, %108
  br i1 %109, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %111 = load i8*, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %112 = bitcast i8* %111 to %struct.TermEvent**
  %113 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %112, i64 %106
  store %struct.TermEvent* %104, %struct.TermEvent** %113, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %114 = add i64 %106, 1
  store i64 %114, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = trunc i64 %114 to i32
  %116 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  store i1 false, i1* %116, align 1, !tbaa !72
  %117 = call i8* @nish_alloc_struct(i64 24)
  %118 = bitcast i8* %117 to %struct.nish_array*
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 0
  store i64 0, i64* %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 1
  store i64 0, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %118, i64 0, i32 2
  store i8* null, i8** %121, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %122 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  store %struct.nish_array* %118, %struct.nish_array** %122, align 8, !tbaa !73
  %123 = load i32, i32* %k.addr, align 4
  %124 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %123, i32 6)
  %125 = extractvalue { i32, i1 } %124, 0
  %126 = extractvalue { i32, i1 } %124, 1
  br i1 %126, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %125

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(80) %struct.TermEvent* @nish.termMouseEvent(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to, i32 noundef %final) #2 {
entry:
  %b.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %e.addr = alloca %struct.TermEvent*, align 8
  %bits.addr = alloca i32, align 4
  %none.addr = alloca i32, align 4
  %low.addr = alloca i32, align 4
  %0 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 0, i32 0)
  store i32 %0, i32* %b.addr, align 4
  %1 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 1, i32 0)
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call i32 @nish.termClamp(i32 %3, i32 0, i32 2147483646)
  store i32 %5, i32* %x.addr, align 4
  %6 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 2, i32 0)
  %7 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %10 = call i32 @nish.termClamp(i32 %8, i32 0, i32 2147483646)
  store i32 %10, i32* %y.addr, align 4
  %11 = call i8* @nish_alloc_struct(i64 80)
  %12 = bitcast i8* %11 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %12, i32 2)
  store %struct.TermEvent* %12, %struct.TermEvent** %e.addr, align 8
  %13 = load i32, i32* %b.addr, align 4
  %14 = icmp slt i32 %13, 0
  br i1 %14, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %15 = load i32, i32* %b.addr, align 4
  br label %cond.end

cond.end:
  %16 = phi i32 [ 3, %cond.true ], [ %15, %cond.false ]
  store i32 %16, i32* %bits.addr, align 4
  store i32 0, i32* %none.addr, align 4
  %17 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %18 = load i32, i32* %bits.addr, align 4
  %19 = and i32 %18, 4
  %20 = icmp ne i32 %19, 0
  br i1 %20, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %21 = load i32, i32* %none.addr, align 4
  br label %cond.end.1

cond.end.1:
  %22 = phi i32 [ 1, %cond.true.1 ], [ %21, %cond.false.1 ]
  %23 = load i32, i32* %bits.addr, align 4
  %24 = and i32 %23, 8
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  %26 = load i32, i32* %none.addr, align 4
  br label %cond.end.2

cond.end.2:
  %27 = phi i32 [ 2, %cond.true.2 ], [ %26, %cond.false.2 ]
  %28 = or i32 %22, %27
  %29 = load i32, i32* %bits.addr, align 4
  %30 = and i32 %29, 16
  %31 = icmp ne i32 %30, 0
  br i1 %31, label %cond.true.3, label %cond.false.3

cond.true.3:
  br label %cond.end.3

cond.false.3:
  %32 = load i32, i32* %none.addr, align 4
  br label %cond.end.3

cond.end.3:
  %33 = phi i32 [ 4, %cond.true.3 ], [ %32, %cond.false.3 ]
  %34 = or i32 %28, %33
  %35 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %17, i32 0, i32 3
  store i32 %34, i32* %35, align 4, !tbaa !49
  %36 = load i32, i32* %bits.addr, align 4
  %37 = and i32 %36, 3
  store i32 %37, i32* %low.addr, align 4
  %38 = load i32, i32* %bits.addr, align 4
  %39 = and i32 %38, 128
  %40 = icmp ne i32 %39, 0
  br i1 %40, label %if.then, label %if.else

if.then:
  %41 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %42 = load i32, i32* %low.addr, align 4
  %43 = add nsw i32 8, %42
  %44 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %41, i32 0, i32 5
  store i32 %43, i32* %44, align 4, !tbaa !51
  br label %if.end

if.else:
  %45 = load i32, i32* %bits.addr, align 4
  %46 = and i32 %45, 64
  %47 = icmp ne i32 %46, 0
  br i1 %47, label %if.then.1, label %if.else.1

if.then.1:
  %48 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %49 = load i32, i32* %low.addr, align 4
  %50 = add nsw i32 4, %49
  %51 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %48, i32 0, i32 5
  store i32 %50, i32* %51, align 4, !tbaa !51
  br label %if.end.1

if.else.1:
  %52 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %53 = load i32, i32* %low.addr, align 4
  %54 = icmp eq i32 %53, 3
  br i1 %54, label %cond.true.4, label %cond.false.4

cond.true.4:
  br label %cond.end.4

cond.false.4:
  %55 = load i32, i32* %low.addr, align 4
  %56 = add nsw i32 %55, 1
  br label %cond.end.4

cond.end.4:
  %57 = phi i32 [ 0, %cond.true.4 ], [ %56, %cond.false.4 ]
  %58 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %52, i32 0, i32 5
  store i32 %57, i32* %58, align 4, !tbaa !51
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %59 = load i32, i32* %bits.addr, align 4
  %60 = and i32 %59, 32
  %61 = icmp ne i32 %60, 0
  br i1 %61, label %if.then.2, label %if.else.2

if.then.2:
  %62 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %63 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %62, i32 0, i32 4
  store i32 4, i32* %63, align 4, !tbaa !50
  br label %if.end.2

if.else.2:
  %64 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %65 = icmp eq i32 %final, 77
  br i1 %65, label %cond.true.5, label %cond.false.5

cond.true.5:
  br label %cond.end.5

cond.false.5:
  br label %cond.end.5

cond.end.5:
  %66 = phi i32 [ 1, %cond.true.5 ], [ 3, %cond.false.5 ]
  %67 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %64, i32 0, i32 4
  store i32 %66, i32* %67, align 4, !tbaa !50
  br label %if.end.2

if.end.2:
  %68 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 7
  %69 = load i1, i1* %68, align 1, !tbaa !69
  %70 = xor i1 %69, true
  br i1 %70, label %if.then.3, label %if.end.3

if.then.3:
  %71 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %72 = load i32, i32* %x.addr, align 4
  %73 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %71, i32 0, i32 6
  store i32 %72, i32* %73, align 4, !tbaa !52
  %74 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %75 = load i32, i32* %y.addr, align 4
  %76 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %74, i32 0, i32 7
  store i32 %75, i32* %76, align 4, !tbaa !53
  %77 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %77

if.end.3:
  %78 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %79 = load i32, i32* %x.addr, align 4
  %80 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %78, i32 0, i32 8
  store i32 %79, i32* %80, align 4, !tbaa !54
  %81 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %82 = load i32, i32* %y.addr, align 4
  %83 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %81, i32 0, i32 9
  store i32 %82, i32* %83, align 4, !tbaa !55
  %84 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %85 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 5
  %86 = load i32, i32* %85, align 4, !tbaa !70
  %87 = icmp sgt i32 %86, 0
  br i1 %87, label %cond.true.6, label %cond.false.6

cond.true.6:
  %88 = load i32, i32* %x.addr, align 4
  %89 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 5
  %90 = load i32, i32* %89, align 4, !tbaa !70
  %91 = icmp eq i32 %90, 0
  %92 = icmp eq i32 %88, -2147483648
  %93 = icmp eq i32 %90, -1
  %94 = and i1 %92, %93
  %95 = or i1 %91, %94
  br i1 %95, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %91)
  unreachable

div.ok:
  %96 = sdiv i32 %88, %90
  %97 = or i32 %96, 0
  br label %cond.end.6

cond.false.6:
  br label %cond.end.6

cond.end.6:
  %98 = phi i32 [ %97, %div.ok ], [ -1, %cond.false.6 ]
  %99 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %84, i32 0, i32 6
  store i32 %98, i32* %99, align 4, !tbaa !52
  %100 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %101 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 6
  %102 = load i32, i32* %101, align 4, !tbaa !71
  %103 = icmp sgt i32 %102, 0
  br i1 %103, label %cond.true.7, label %cond.false.7

cond.true.7:
  %104 = load i32, i32* %y.addr, align 4
  %105 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 6
  %106 = load i32, i32* %105, align 4, !tbaa !71
  %107 = icmp eq i32 %106, 0
  %108 = icmp eq i32 %104, -2147483648
  %109 = icmp eq i32 %106, -1
  %110 = and i1 %108, %109
  %111 = or i1 %107, %110
  br i1 %111, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %107)
  unreachable

div.ok.1:
  %112 = sdiv i32 %104, %106
  %113 = or i32 %112, 0
  br label %cond.end.7

cond.false.7:
  br label %cond.end.7

cond.end.7:
  %114 = phi i32 [ %113, %div.ok.1 ], [ -1, %cond.false.7 ]
  %115 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %100, i32 0, i32 7
  store i32 %114, i32* %115, align 4, !tbaa !53
  %116 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %116

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef nonnull align 8 dereferenceable(80) %struct.TermEvent* @nish.termReplyEvent(i32 noundef %introducer, i32 noundef %prefix, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %params, i32 noundef %intermediate, i32 noundef %reply, i8* noundef nonnull noalias readonly align 8 %text) #3 {
entry:
  %e.addr = alloca %struct.TermEvent*, align 8
  %0 = call i8* @nish_alloc_struct(i64 80)
  %1 = bitcast i8* %0 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %1, i32 6)
  store %struct.TermEvent* %1, %struct.TermEvent** %e.addr, align 8
  %2 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %3 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %2, i32 0, i32 12
  store i32 %introducer, i32* %3, align 4, !tbaa !58
  %4 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %5 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %4, i32 0, i32 13
  store i32 %prefix, i32* %5, align 4, !tbaa !59
  %6 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %7 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %6, i32 0, i32 15
  store %struct.nish_array* %params, %struct.nish_array** %7, align 8, !tbaa !61
  %8 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %9 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %8, i32 0, i32 14
  store i32 %intermediate, i32* %9, align 4, !tbaa !60
  %10 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %11 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %10, i32 0, i32 11
  store i32 %reply, i32* %11, align 4, !tbaa !57
  %12 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %13 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %12, i32 0, i32 10
  store i8* %text, i8** %13, align 8, !tbaa !56
  %14 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  ret %struct.TermEvent* %14
}

define internal void @nish.termCsiEvent(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %from, i32 noundef %to, i32 noundef %prefix, i32 noundef %intermediate, i32 noundef %final, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #2 {
entry:
  %first.addr = alloca i32, align 4
  %cpr.addr = alloca i1, align 1
  %e.addr = alloca %struct.TermEvent*, align 8
  %mods.addr = alloca i32, align 4
  %action.addr = alloca i32, align 4
  %code.addr = alloca i32, align 4
  %e.addr.1 = alloca %struct.TermEvent*, align 8
  %text.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %s.addr = alloca i32, align 4
  %kind.addr = alloca i32, align 4
  %e.addr.2 = alloca %struct.TermEvent*, align 8
  %0 = icmp eq i32 %prefix, 60
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp eq i32 %final, 77
  br i1 %1, label %lor.end, label %lor.rhs

lor.rhs:
  %2 = icmp eq i32 %final, 109
  br label %lor.end

lor.end:
  %3 = phi i1 [ true, %land.rhs ], [ %2, %lor.rhs ]
  br label %land.end

land.end:
  %4 = phi i1 [ false, %entry ], [ %3, %lor.end ]
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = call %struct.TermEvent* @nish.termMouseEvent(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %from, i32 %to, i32 %final)
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = bitcast i8* %12 to %struct.TermEvent**
  %14 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %13, i64 %7
  store %struct.TermEvent* %5, %struct.TermEvent** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %15 = add i64 %7, 1
  store i64 %15, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  ret void

if.end:
  %17 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 0, i32 0)
  store i32 %17, i32* %first.addr, align 4
  %18 = icmp eq i32 %final, 82
  br i1 %18, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %19 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 4
  %20 = load i32, i32* %19, align 4, !tbaa !68
  %21 = icmp sgt i32 %20, 0
  br label %land.end.1

land.end.1:
  %22 = phi i1 [ false, %if.end ], [ %21, %land.rhs.1 ]
  store i1 %22, i1* %cpr.addr, align 1
  %23 = icmp ne i32 %prefix, 0
  br i1 %23, label %lor.end.4, label %lor.rhs.4

lor.rhs.4:
  %24 = icmp ne i32 %intermediate, 0
  br label %lor.end.4

lor.end.4:
  %25 = phi i1 [ true, %land.end.1 ], [ %24, %lor.rhs.4 ]
  br i1 %25, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %26 = icmp eq i32 %final, 110
  br label %lor.end.3

lor.end.3:
  %27 = phi i1 [ true, %lor.end.4 ], [ %26, %lor.rhs.3 ]
  br i1 %27, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %28 = icmp eq i32 %final, 116
  br label %lor.end.2

lor.end.2:
  %29 = phi i1 [ true, %lor.end.3 ], [ %28, %lor.rhs.2 ]
  br i1 %29, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %30 = load i1, i1* %cpr.addr, align 1
  br label %lor.end.1

lor.end.1:
  %31 = phi i1 [ true, %lor.end.2 ], [ %30, %lor.rhs.1 ]
  br i1 %31, label %if.then.1, label %if.end.1

if.then.1:
  %32 = load i1, i1* %cpr.addr, align 1
  br i1 %32, label %if.then.2, label %if.end.2

if.then.2:
  %33 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 4
  %34 = load i32, i32* %33, align 4, !tbaa !68
  %35 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %34, i32 1)
  %36 = extractvalue { i32, i1 } %35, 0
  %37 = extractvalue { i32, i1 } %35, 1
  br i1 %37, label %ovf.fail, label %ovf.ok

ovf.ok:
  %38 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 4
  store i32 %36, i32* %38, align 4, !tbaa !68
  br label %if.end.2

if.end.2:
  %39 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %from, i32 %to)
  %40 = call %struct.TermEvent* @nish.termReplyEvent(i32 91, i32 %prefix, %struct.nish_array* %39, i32 %intermediate, i32 %final, i8* bitcast ({ i64, [1 x i8] }* @.str.13 to i8*))
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = icmp eq i64 %42, %44
  br i1 %45, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = bitcast i8* %47 to %struct.TermEvent**
  %49 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %48, i64 %42
  store %struct.TermEvent* %40, %struct.TermEvent** %49, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %50 = add i64 %42, 1
  store i64 %50, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  ret void

if.end.1:
  %52 = icmp eq i32 %final, 73
  br i1 %52, label %lor.end.5, label %lor.rhs.5

lor.rhs.5:
  %53 = icmp eq i32 %final, 79
  br label %lor.end.5

lor.end.5:
  %54 = phi i1 [ true, %if.end.1 ], [ %53, %lor.rhs.5 ]
  br i1 %54, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %55 = icmp eq i32 %from, %to
  br label %land.end.2

land.end.2:
  %56 = phi i1 [ false, %lor.end.5 ], [ %55, %land.rhs.2 ]
  br i1 %56, label %if.then.3, label %if.end.3

if.then.3:
  %57 = call i8* @nish_alloc_struct(i64 80)
  %58 = bitcast i8* %57 to %struct.TermEvent*
  call void @nish.TermEvent.constructor(%struct.TermEvent* %58, i32 4)
  store %struct.TermEvent* %58, %struct.TermEvent** %e.addr, align 8
  %59 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %60 = icmp eq i32 %final, 73
  %61 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %59, i32 0, i32 16
  store i1 %60, i1* %61, align 1, !tbaa !62
  %62 = load %struct.TermEvent*, %struct.TermEvent** %e.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = icmp eq i64 %64, %66
  br i1 %67, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %70 = bitcast i8* %69 to %struct.TermEvent**
  %71 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %70, i64 %64
  store %struct.TermEvent* %62, %struct.TermEvent** %71, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %72 = add i64 %64, 1
  store i64 %72, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = trunc i64 %72 to i32
  ret void

if.end.3:
  %74 = icmp eq i32 %final, 126
  br i1 %74, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %75 = load i32, i32* %first.addr, align 4
  %76 = icmp eq i32 %75, 200
  br i1 %76, label %lor.end.6, label %lor.rhs.6

lor.rhs.6:
  %77 = load i32, i32* %first.addr, align 4
  %78 = icmp eq i32 %77, 201
  br label %lor.end.6

lor.end.6:
  %79 = phi i1 [ true, %land.rhs.3 ], [ %78, %lor.rhs.6 ]
  br label %land.end.3

land.end.3:
  %80 = phi i1 [ false, %if.end.3 ], [ %79, %lor.end.6 ]
  br i1 %80, label %if.then.4, label %if.end.4

if.then.4:
  %81 = load i32, i32* %first.addr, align 4
  %82 = icmp eq i32 %81, 200
  %83 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  store i1 %82, i1* %83, align 1, !tbaa !72
  %84 = call i8* @nish_alloc_struct(i64 24)
  %85 = bitcast i8* %84 to %struct.nish_array*
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  store i64 0, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 1
  store i64 0, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  store i8* null, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %89 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 3
  store %struct.nish_array* %85, %struct.nish_array** %89, align 8, !tbaa !73
  ret void

if.end.4:
  %90 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 1, i32 0)
  %91 = call i32 @nish.termModifiers(i32 %90)
  store i32 %91, i32* %mods.addr, align 4
  %92 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 1, i32 1)
  %93 = call i32 @nish.termAction(i32 %92)
  store i32 %93, i32* %action.addr, align 4
  %94 = icmp eq i32 %final, 117
  br i1 %94, label %lor.end.7, label %lor.rhs.7

lor.rhs.7:
  %95 = icmp eq i32 %final, 126
  br i1 %95, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %96 = load i32, i32* %first.addr, align 4
  %97 = icmp eq i32 %96, 27
  br label %land.end.4

land.end.4:
  %98 = phi i1 [ false, %lor.rhs.7 ], [ %97, %land.rhs.4 ]
  br label %lor.end.7

lor.end.7:
  %99 = phi i1 [ true, %if.end.4 ], [ %98, %land.end.4 ]
  br i1 %99, label %if.then.5, label %if.end.5

if.then.5:
  %100 = icmp eq i32 %final, 117
  br i1 %100, label %cond.true, label %cond.false

cond.true:
  %101 = load i32, i32* %first.addr, align 4
  br label %cond.end

cond.false:
  %102 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 2, i32 0)
  br label %cond.end

cond.end:
  %103 = phi i32 [ %101, %cond.true ], [ %102, %cond.false ]
  store i32 %103, i32* %code.addr, align 4
  %104 = load i32, i32* %code.addr, align 4
  %105 = call i32 @nish.termKittyKind(i32 %104)
  %106 = load i32, i32* %code.addr, align 4
  %107 = icmp slt i32 %106, 0
  br i1 %107, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %108 = load i32, i32* %code.addr, align 4
  br label %cond.end.1

cond.end.1:
  %109 = phi i32 [ %final, %cond.true.1 ], [ %108, %cond.false.1 ]
  %110 = load i32, i32* %mods.addr, align 4
  %111 = load i32, i32* %action.addr, align 4
  %112 = call %struct.TermEvent* @nish.termKeyEvent(i32 %105, i32 %109, i32 %110, i32 %111)
  store %struct.TermEvent* %112, %struct.TermEvent** %e.addr.1, align 8
  %113 = icmp eq i32 %final, 117
  br i1 %113, label %if.then.6, label %if.end.6

if.then.6:
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %116, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %text.addr, align 8
  store i32 0, i32* %s.addr, align 4
  br label %for.cond

for.cond:
  %117 = load i32, i32* %s.addr, align 4
  %118 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 2, i32 %117)
  %119 = icmp sge i32 %118, 0
  br i1 %119, label %for.body, label %for.end

for.body:
  %120 = load %struct.nish_array*, %struct.nish_array** %text.addr, align 8
  %121 = load i32, i32* %s.addr, align 4
  %122 = call i32 @nish.termCsiField(%struct.nish_array* %bytes, i32 %from, i32 %to, i32 2, i32 %121)
  call void @nish.termPushUtf8(%struct.nish_array* %120, i32 %122)
  br label %for.inc

for.inc:
  %123 = load i32, i32* %s.addr, align 4
  %124 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %123, i32 1)
  %125 = extractvalue { i32, i1 } %124, 0
  %126 = extractvalue { i32, i1 } %124, 1
  br i1 %126, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %125, i32* %s.addr, align 4
  br label %for.cond

for.end:
  %127 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.1, align 8
  %128 = load %struct.nish_array*, %struct.nish_array** %text.addr, align 8
  %129 = load %struct.nish_array*, %struct.nish_array** %text.addr, align 8
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 0
  %131 = load i64, i64* %130, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %132 = trunc i64 %131 to i32
  %133 = call i64 @nish_arena_mark()
  %134 = call i8* @nish.termBytesText(%struct.nish_array* %128, i32 %132)
  %135 = call i8* @nish_arena_keep(i64 %133, i8* %134)
  %136 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %127, i32 0, i32 10
  store i8* %135, i8** %136, align 8, !tbaa !56
  br label %if.end.6

if.end.6:
  %137 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.1, align 8
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %141 = load i64, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %142 = icmp eq i64 %139, %141
  br i1 %142, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %145 = bitcast i8* %144 to %struct.TermEvent**
  %146 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %145, i64 %139
  store %struct.TermEvent* %137, %struct.TermEvent** %146, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %147 = add i64 %139, 1
  store i64 %147, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %148 = trunc i64 %147 to i32
  ret void

if.end.5:
  %149 = icmp eq i32 %final, 90
  br i1 %149, label %if.then.7, label %if.end.7

if.then.7:
  %150 = load i32, i32* %mods.addr, align 4
  %151 = or i32 %150, 1
  %152 = load i32, i32* %action.addr, align 4
  %153 = call %struct.TermEvent* @nish.termKeyEvent(i32 10, i32 9, i32 %151, i32 %152)
  %154 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %155 = load i64, i64* %154, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %157 = load i64, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %158 = icmp eq i64 %155, %157
  br i1 %158, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.4

push.store.4:
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %160 = load i8*, i8** %159, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %161 = bitcast i8* %160 to %struct.TermEvent**
  %162 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %161, i64 %155
  store %struct.TermEvent* %153, %struct.TermEvent** %162, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %163 = add i64 %155, 1
  store i64 %163, i64* %154, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %164 = trunc i64 %163 to i32
  ret void

if.end.7:
  %165 = icmp eq i32 %final, 126
  br i1 %165, label %cond.true.2, label %cond.false.2

cond.true.2:
  %166 = load i32, i32* %first.addr, align 4
  %167 = call i32 @nish.termTildeKind(i32 %166)
  br label %cond.end.2

cond.false.2:
  %168 = call i32 @nish.termLetterKind(i32 %final)
  br label %cond.end.2

cond.end.2:
  %169 = phi i32 [ %167, %cond.true.2 ], [ %168, %cond.false.2 ]
  store i32 %169, i32* %kind.addr, align 4
  %170 = load i32, i32* %kind.addr, align 4
  %171 = load i32, i32* %mods.addr, align 4
  %172 = load i32, i32* %action.addr, align 4
  %173 = call %struct.TermEvent* @nish.termKeyEvent(i32 %170, i32 %final, i32 %171, i32 %172)
  store %struct.TermEvent* %173, %struct.TermEvent** %e.addr.2, align 8
  %174 = load i32, i32* %kind.addr, align 4
  %175 = icmp eq i32 %174, 13
  br i1 %175, label %if.then.8, label %if.end.8

if.then.8:
  %176 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.2, align 8
  %177 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %from, i32 %to)
  %178 = getelementptr inbounds %struct.TermEvent, %struct.TermEvent* %176, i32 0, i32 15
  store %struct.nish_array* %177, %struct.nish_array** %178, align 8, !tbaa !61
  br label %if.end.8

if.end.8:
  %179 = load %struct.TermEvent*, %struct.TermEvent** %e.addr.2, align 8
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %181 = load i64, i64* %180, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %183 = load i64, i64* %182, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %184 = icmp eq i64 %181, %183
  br i1 %184, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.5

push.store.5:
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %187 = bitcast i8* %186 to %struct.TermEvent**
  %188 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %187, i64 %181
  store %struct.TermEvent* %179, %struct.TermEvent** %188, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %189 = add i64 %181, 1
  store i64 %189, i64* %180, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %190 = trunc i64 %189 to i32
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 1, %if.then.2 ], [ 0, %for.inc ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @nish.termDecodeCsi(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #2 {
entry:
  %n.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %final.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %prefix.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %4, i32* %j.addr, align 4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %10 = load i32, i32* %j.addr, align 4
  %11 = load i32, i32* %n.addr, align 4
  %12 = icmp slt i32 %10, %11
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %j.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = icmp ult i64 %14, %7
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %7)
  unreachable

bounds.ok:
  %16 = bitcast i8* %9 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 %14
  %18 = load i8, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = zext i8 %18 to i32
  %20 = icmp sge i32 %19, 32
  br label %land.end.1

land.end.1:
  %21 = phi i1 [ false, %while.cond ], [ %20, %bounds.ok ]
  br i1 %21, label %land.rhs, label %land.end

land.rhs:
  %22 = load i32, i32* %j.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = icmp ult i64 %23, %7
  br i1 %24, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %23, i64 %7)
  unreachable

bounds.ok.1:
  %25 = bitcast i8* %9 to i8*
  %26 = getelementptr inbounds i8, i8* %25, i64 %23
  %27 = load i8, i8* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = zext i8 %27 to i32
  %29 = icmp slt i32 %28, 64
  br label %land.end

land.end:
  %30 = phi i1 [ false, %land.end.1 ], [ %29, %bounds.ok.1 ]
  br i1 %30, label %while.body, label %while.end

while.body:
  %31 = load i32, i32* %j.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %33 = load i32, i32* %j.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = icmp sge i32 %33, %34
  br i1 %35, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %36 = xor i1 %last, true
  br label %land.end.2

land.end.2:
  %37 = phi i1 [ false, %while.end ], [ %36, %land.rhs.2 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %38 = load i32, i32* %j.addr, align 4
  %39 = load i32, i32* %n.addr, align 4
  %40 = icmp slt i32 %38, %39
  br i1 %40, label %cond.true, label %cond.false

cond.true:
  %41 = load i32, i32* %j.addr, align 4
  %42 = sext i32 %41 to i64
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = icmp ult i64 %42, %44
  br i1 %45, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %42, i64 %44)
  unreachable

bounds.ok.2:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %48 = bitcast i8* %47 to i8*
  %49 = getelementptr inbounds i8, i8* %48, i64 %42
  %50 = load i8, i8* %49, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = zext i8 %50 to i32
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %52 = phi i32 [ %51, %bounds.ok.2 ], [ 0, %cond.false ]
  store i32 %52, i32* %final.addr, align 4
  %53 = load i32, i32* %final.addr, align 4
  %54 = icmp sge i32 %53, 64
  br i1 %54, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %55 = load i32, i32* %final.addr, align 4
  %56 = icmp slt i32 %55, 127
  br label %land.end.3

land.end.3:
  %57 = phi i1 [ false, %cond.end ], [ %56, %land.rhs.3 ]
  %58 = xor i1 %57, true
  br i1 %58, label %if.then.1, label %if.end.1

if.then.1:
  %59 = call %struct.TermEvent* @nish.termKeyEvent(i32 8, i32 27, i32 0, i32 1)
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %61 = load i64, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %64 = icmp eq i64 %61, %63
  br i1 %64, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %67 = bitcast i8* %66 to %struct.TermEvent**
  %68 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %67, i64 %61
  store %struct.TermEvent* %59, %struct.TermEvent** %68, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %69 = add i64 %61, 1
  store i64 %69, i64* %60, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = trunc i64 %69 to i32
  %71 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 1)
  %72 = extractvalue { i32, i1 } %71, 0
  %73 = extractvalue { i32, i1 } %71, 1
  br i1 %73, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %72

if.end.1:
  %74 = load i32, i32* %final.addr, align 4
  %75 = icmp eq i32 %74, 91
  br i1 %75, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %76 = load i32, i32* %j.addr, align 4
  %77 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 2)
  %78 = extractvalue { i32, i1 } %77, 0
  %79 = extractvalue { i32, i1 } %77, 1
  br i1 %79, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %80 = icmp eq i32 %76, %78
  br label %land.end.4

land.end.4:
  %81 = phi i1 [ false, %if.end.1 ], [ %80, %ovf.ok.2 ]
  br i1 %81, label %if.then.2, label %if.end.2

if.then.2:
  %82 = load i32, i32* %j.addr, align 4
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %82, i32 1)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %86 = load i32, i32* %n.addr, align 4
  %87 = icmp sge i32 %84, %86
  br i1 %87, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %88 = xor i1 %last, true
  br label %land.end.5

land.end.5:
  %89 = phi i1 [ false, %ovf.ok.3 ], [ %88, %land.rhs.5 ]
  br i1 %89, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 -1

if.end.3:
  %90 = load i32, i32* %j.addr, align 4
  %91 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %90, i32 1)
  %92 = extractvalue { i32, i1 } %91, 0
  %93 = extractvalue { i32, i1 } %91, 1
  br i1 %93, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %94 = load i32, i32* %n.addr, align 4
  %95 = icmp slt i32 %92, %94
  br i1 %95, label %cond.true.1, label %cond.false.1

cond.true.1:
  %96 = load i32, i32* %j.addr, align 4
  %97 = add nsw i32 %96, 1
  %98 = sext i32 %97 to i64
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %100 = load i64, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %101 = icmp ult i64 %98, %100
  br i1 %101, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %98, i64 %100)
  unreachable

bounds.ok.3:
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %103 = load i8*, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %104 = bitcast i8* %103 to i8*
  %105 = getelementptr inbounds i8, i8* %104, i64 %98
  %106 = load i8, i8* %105, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %107 = zext i8 %106 to i32
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %108 = phi i32 [ %107, %bounds.ok.3 ], [ 0, %cond.false.1 ]
  store i32 %108, i32* %f.addr, align 4
  %109 = load i32, i32* %f.addr, align 4
  %110 = icmp sge i32 %109, 65
  br i1 %110, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %111 = load i32, i32* %f.addr, align 4
  %112 = icmp sle i32 %111, 69
  br label %land.end.6

land.end.6:
  %113 = phi i1 [ false, %cond.end.1 ], [ %112, %land.rhs.6 ]
  br i1 %113, label %if.then.4, label %if.end.4

if.then.4:
  %114 = load i32, i32* %f.addr, align 4
  %115 = sub nsw i32 %114, 65
  %116 = add nsw i32 14, %115
  %117 = load i32, i32* %f.addr, align 4
  %118 = call %struct.TermEvent* @nish.termKeyEvent(i32 %116, i32 %117, i32 0, i32 1)
  %119 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %120 = load i64, i64* %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %122 = load i64, i64* %121, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %123 = icmp eq i64 %120, %122
  br i1 %123, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %125 = load i8*, i8** %124, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %126 = bitcast i8* %125 to %struct.TermEvent**
  %127 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %126, i64 %120
  store %struct.TermEvent* %118, %struct.TermEvent** %127, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %128 = add i64 %120, 1
  store i64 %128, i64* %119, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %129 = trunc i64 %128 to i32
  %130 = load i32, i32* %j.addr, align 4
  %131 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %130, i32 2)
  %132 = extractvalue { i32, i1 } %131, 0
  %133 = extractvalue { i32, i1 } %131, 1
  br i1 %133, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  ret i32 %132

if.end.4:
  br label %if.end.2

if.end.2:
  %134 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 2)
  %135 = extractvalue { i32, i1 } %134, 0
  %136 = extractvalue { i32, i1 } %134, 1
  br i1 %136, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %135, i32* %from.addr, align 4
  store i32 0, i32* %prefix.addr, align 4
  %137 = load i32, i32* %from.addr, align 4
  %138 = load i32, i32* %j.addr, align 4
  %139 = icmp slt i32 %137, %138
  br i1 %139, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %140 = load i32, i32* %from.addr, align 4
  %141 = sext i32 %140 to i64
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %143 = load i64, i64* %142, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = icmp ult i64 %141, %143
  br i1 %144, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %141, i64 %143)
  unreachable

bounds.ok.4:
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %146 = load i8*, i8** %145, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %147 = bitcast i8* %146 to i8*
  %148 = getelementptr inbounds i8, i8* %147, i64 %141
  %149 = load i8, i8* %148, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %150 = zext i8 %149 to i32
  %151 = icmp sge i32 %150, 60
  br label %land.end.7

land.end.7:
  %152 = phi i1 [ false, %ovf.ok.6 ], [ %151, %bounds.ok.4 ]
  br i1 %152, label %if.then.5, label %if.end.5

if.then.5:
  %153 = load i32, i32* %from.addr, align 4
  %154 = sext i32 %153 to i64
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %156 = load i64, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %157 = icmp ult i64 %154, %156
  br i1 %157, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %154, i64 %156)
  unreachable

bounds.ok.5:
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %159 = load i8*, i8** %158, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %160 = bitcast i8* %159 to i8*
  %161 = getelementptr inbounds i8, i8* %160, i64 %154
  %162 = load i8, i8* %161, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %163 = zext i8 %162 to i32
  store i32 %163, i32* %prefix.addr, align 4
  %164 = load i32, i32* %from.addr, align 4
  %165 = add nsw i32 %164, 1
  store i32 %165, i32* %from.addr, align 4
  br label %if.end.5

if.end.5:
  %166 = load i32, i32* %from.addr, align 4
  store i32 %166, i32* %to.addr, align 4
  br label %while.cond.1

while.cond.1:
  %167 = load i32, i32* %to.addr, align 4
  %168 = load i32, i32* %j.addr, align 4
  %169 = icmp slt i32 %167, %168
  br i1 %169, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %170 = load i32, i32* %to.addr, align 4
  %171 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %170)
  %172 = icmp sge i32 %171, 48
  br label %land.end.8

land.end.8:
  %173 = phi i1 [ false, %while.cond.1 ], [ %172, %land.rhs.8 ]
  br i1 %173, label %while.body.1, label %while.end.1

while.body.1:
  %174 = load i32, i32* %to.addr, align 4
  %175 = add nsw i32 %174, 1
  store i32 %175, i32* %to.addr, align 4
  br label %while.cond.1

while.end.1:
  %176 = load i32, i32* %from.addr, align 4
  %177 = load i32, i32* %to.addr, align 4
  %178 = load i32, i32* %prefix.addr, align 4
  %179 = load i32, i32* %to.addr, align 4
  %180 = load i32, i32* %j.addr, align 4
  %181 = icmp slt i32 %179, %180
  br i1 %181, label %cond.true.2, label %cond.false.2

cond.true.2:
  %182 = load i32, i32* %j.addr, align 4
  %183 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %182, i32 1)
  %184 = extractvalue { i32, i1 } %183, 0
  %185 = extractvalue { i32, i1 } %183, 1
  br i1 %185, label %ovf.fail, label %ovf.ok.7

ovf.ok.7:
  %186 = sext i32 %184 to i64
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %188 = load i64, i64* %187, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %189 = icmp ult i64 %186, %188
  br i1 %189, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %186, i64 %188)
  unreachable

bounds.ok.6:
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %191 = load i8*, i8** %190, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %192 = bitcast i8* %191 to i8*
  %193 = getelementptr inbounds i8, i8* %192, i64 %186
  %194 = load i8, i8* %193, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %195 = zext i8 %194 to i32
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %196 = phi i32 [ %195, %bounds.ok.6 ], [ 0, %cond.false.2 ]
  %197 = load i32, i32* %final.addr, align 4
  call void @nish.termCsiEvent(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %176, i32 %177, i32 %178, i32 %196, i32 %197, %struct.nish_array* %events)
  %198 = load i32, i32* %j.addr, align 4
  %199 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %198, i32 1)
  %200 = extractvalue { i32, i1 } %199, 0
  %201 = extractvalue { i32, i1 } %199, 1
  br i1 %201, label %ovf.fail, label %ovf.ok.8

ovf.ok.8:
  ret i32 %200

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 0, %push.store ], [ 0, %land.rhs.4 ], [ 0, %if.then.2 ], [ 0, %if.end.3 ], [ 0, %push.store.1 ], [ 0, %if.end.2 ], [ 1, %cond.true.2 ], [ 0, %cond.end.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @nish.termDecodeString(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #2 {
entry:
  %n.addr = alloca i32, align 4
  %introducer.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %resume.addr = alloca i32, align 4
  %start.addr = alloca i32, align 4
  %semi.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %prefix.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %intermediate.addr = alloca i32, align 4
  %final.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %i, i32 1)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  %6 = sext i32 %4 to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = icmp ult i64 %6, %8
  br i1 %9, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %6, i64 %8)
  unreachable

bounds.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %11 to i8*
  %13 = getelementptr inbounds i8, i8* %12, i64 %6
  %14 = load i8, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = zext i8 %14 to i32
  store i32 %15, i32* %introducer.addr, align 4
  %16 = add nsw i32 %i, 2
  store i32 %16, i32* %end.addr, align 4
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %21 = load i32, i32* %end.addr, align 4
  %22 = load i32, i32* %n.addr, align 4
  %23 = icmp slt i32 %21, %22
  br i1 %23, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %24 = load i32, i32* %end.addr, align 4
  %25 = sext i32 %24 to i64
  %26 = icmp ult i64 %25, %18
  br i1 %26, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %25, i64 %18)
  unreachable

bounds.ok.1:
  %27 = bitcast i8* %20 to i8*
  %28 = getelementptr inbounds i8, i8* %27, i64 %25
  %29 = load i8, i8* %28, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %30 = zext i8 %29 to i32
  %31 = icmp ne i32 %30, 7
  br label %land.end.1

land.end.1:
  %32 = phi i1 [ false, %while.cond ], [ %31, %bounds.ok.1 ]
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %end.addr, align 4
  %34 = sext i32 %33 to i64
  %35 = icmp ult i64 %34, %18
  br i1 %35, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %34, i64 %18)
  unreachable

bounds.ok.2:
  %36 = bitcast i8* %20 to i8*
  %37 = getelementptr inbounds i8, i8* %36, i64 %34
  %38 = load i8, i8* %37, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %39 = zext i8 %38 to i32
  %40 = icmp ne i32 %39, 27
  br label %land.end

land.end:
  %41 = phi i1 [ false, %land.end.1 ], [ %40, %bounds.ok.2 ]
  br i1 %41, label %while.body, label %while.end

while.body:
  %42 = load i32, i32* %end.addr, align 4
  %43 = add nsw i32 %42, 1
  store i32 %43, i32* %end.addr, align 4
  br label %while.cond

while.end:
  %44 = load i32, i32* %end.addr, align 4
  %45 = load i32, i32* %end.addr, align 4
  %46 = load i32, i32* %n.addr, align 4
  %47 = icmp slt i32 %45, %46
  br i1 %47, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %48 = load i32, i32* %end.addr, align 4
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %49, i64 %51)
  unreachable

bounds.ok.3:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast i8* %54 to i8*
  %56 = getelementptr inbounds i8, i8* %55, i64 %49
  %57 = load i8, i8* %56, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = zext i8 %57 to i32
  %59 = icmp eq i32 %58, 27
  br label %land.end.2

land.end.2:
  %60 = phi i1 [ false, %while.end ], [ %59, %bounds.ok.3 ]
  br i1 %60, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %61 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %62 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %61)
  %63 = extractvalue { i32, i1 } %62, 0
  %64 = extractvalue { i32, i1 } %62, 1
  br i1 %64, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %65 = load i32, i32* %n.addr, align 4
  %66 = icmp sge i32 %63, %65
  br i1 %66, label %if.then, label %if.end

if.then:
  br i1 %last, label %cond.true.1, label %cond.false.1

cond.true.1:
  %67 = load i32, i32* %n.addr, align 4
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %68 = phi i32 [ %67, %cond.true.1 ], [ -1, %cond.false.1 ]
  ret i32 %68

if.end:
  %69 = load i32, i32* %end.addr, align 4
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %69, i32 1)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %71, i32* %resume.addr, align 4
  %73 = load i32, i32* %end.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = icmp ult i64 %74, %76
  br i1 %77, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %74, i64 %76)
  unreachable

bounds.ok.4:
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %80 = bitcast i8* %79 to i8*
  %81 = getelementptr inbounds i8, i8* %80, i64 %74
  %82 = load i8, i8* %81, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %83 = zext i8 %82 to i32
  %84 = icmp eq i32 %83, 27
  br i1 %84, label %if.then.1, label %if.end.1

if.then.1:
  %85 = load i32, i32* %end.addr, align 4
  %86 = add nsw i32 %85, 1
  %87 = sext i32 %86 to i64
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = icmp ult i64 %87, %89
  br i1 %90, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %87, i64 %89)
  unreachable

bounds.ok.5:
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %92 = load i8*, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %93 = bitcast i8* %92 to i8*
  %94 = getelementptr inbounds i8, i8* %93, i64 %87
  %95 = load i8, i8* %94, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %96 = zext i8 %95 to i32
  %97 = icmp ne i32 %96, 92
  br i1 %97, label %if.then.2, label %if.end.2

if.then.2:
  %98 = load i32, i32* %end.addr, align 4
  ret i32 %98

if.end.2:
  %99 = load i32, i32* %end.addr, align 4
  %100 = add nsw i32 %99, 2
  store i32 %100, i32* %resume.addr, align 4
  br label %if.end.1

if.end.1:
  %101 = add nsw i32 %i, 2
  store i32 %101, i32* %start.addr, align 4
  %102 = load i32, i32* %introducer.addr, align 4
  %103 = icmp eq i32 %102, 95
  br i1 %103, label %if.then.3, label %if.end.3

if.then.3:
  %104 = load i32, i32* %introducer.addr, align 4
  %105 = call i8* @nish_alloc_struct(i64 24)
  %106 = bitcast i8* %105 to %struct.nish_array*
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  store i64 0, i64* %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 1
  store i64 0, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  store i8* null, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %110 = load i32, i32* %start.addr, align 4
  %111 = load i32, i32* %end.addr, align 4
  %112 = icmp slt i32 %110, %111
  br i1 %112, label %cond.true.2, label %cond.false.2

cond.true.2:
  %113 = load i32, i32* %start.addr, align 4
  %114 = sext i32 %113 to i64
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %117 = icmp ult i64 %114, %116
  br i1 %117, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 %114, i64 %116)
  unreachable

bounds.ok.6:
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %120 = bitcast i8* %119 to i8*
  %121 = getelementptr inbounds i8, i8* %120, i64 %114
  %122 = load i8, i8* %121, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %123 = zext i8 %122 to i32
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %124 = phi i32 [ %123, %bounds.ok.6 ], [ 0, %cond.false.2 ]
  %125 = load i32, i32* %start.addr, align 4
  %126 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %125, i32 1)
  %127 = extractvalue { i32, i1 } %126, 0
  %128 = extractvalue { i32, i1 } %126, 1
  br i1 %128, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %129 = load i32, i32* %end.addr, align 4
  %130 = call i64 @nish_arena_mark()
  %131 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %127, i32 %129)
  %132 = call i8* @nish_arena_keep(i64 %130, i8* %131)
  %133 = call %struct.TermEvent* @nish.termReplyEvent(i32 %104, i32 0, %struct.nish_array* %106, i32 0, i32 %124, i8* %132)
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %135 = load i64, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %138 = icmp eq i64 %135, %137
  br i1 %138, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %139 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %140 = load i8*, i8** %139, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %141 = bitcast i8* %140 to %struct.TermEvent**
  %142 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %141, i64 %135
  store %struct.TermEvent* %133, %struct.TermEvent** %142, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %143 = add i64 %135, 1
  store i64 %143, i64* %134, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %144 = trunc i64 %143 to i32
  %145 = load i32, i32* %resume.addr, align 4
  ret i32 %145

if.end.3:
  %146 = load i32, i32* %introducer.addr, align 4
  %147 = icmp eq i32 %146, 93
  br i1 %147, label %if.then.4, label %if.end.4

if.then.4:
  %148 = load i32, i32* %start.addr, align 4
  store i32 %148, i32* %semi.addr, align 4
  %149 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %150 = load i64, i64* %149, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %152 = load i8*, i8** %151, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.1

while.cond.1:
  %153 = load i32, i32* %semi.addr, align 4
  %154 = load i32, i32* %end.addr, align 4
  %155 = icmp slt i32 %153, %154
  br i1 %155, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %156 = load i32, i32* %semi.addr, align 4
  %157 = sext i32 %156 to i64
  %158 = icmp ult i64 %157, %150
  br i1 %158, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 %157, i64 %150)
  unreachable

bounds.ok.7:
  %159 = bitcast i8* %152 to i8*
  %160 = getelementptr inbounds i8, i8* %159, i64 %157
  %161 = load i8, i8* %160, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %162 = zext i8 %161 to i32
  %163 = icmp ne i32 %162, 59
  br label %land.end.3

land.end.3:
  %164 = phi i1 [ false, %while.cond.1 ], [ %163, %bounds.ok.7 ]
  br i1 %164, label %while.body.1, label %while.end.1

while.body.1:
  %165 = load i32, i32* %semi.addr, align 4
  %166 = add nsw i32 %165, 1
  store i32 %166, i32* %semi.addr, align 4
  br label %while.cond.1

while.end.1:
  %167 = load i32, i32* %introducer.addr, align 4
  %168 = load i32, i32* %start.addr, align 4
  %169 = load i32, i32* %semi.addr, align 4
  %170 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %168, i32 %169)
  %171 = load i32, i32* %semi.addr, align 4
  %172 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %171, i32 1)
  %173 = extractvalue { i32, i1 } %172, 0
  %174 = extractvalue { i32, i1 } %172, 1
  br i1 %174, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %175 = load i32, i32* %end.addr, align 4
  %176 = call i64 @nish_arena_mark()
  %177 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %173, i32 %175)
  %178 = call i8* @nish_arena_keep(i64 %176, i8* %177)
  %179 = call %struct.TermEvent* @nish.termReplyEvent(i32 %167, i32 0, %struct.nish_array* %170, i32 0, i32 0, i8* %178)
  %180 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %181 = load i64, i64* %180, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %183 = load i64, i64* %182, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %184 = icmp eq i64 %181, %183
  br i1 %184, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %187 = bitcast i8* %186 to %struct.TermEvent**
  %188 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %187, i64 %181
  store %struct.TermEvent* %179, %struct.TermEvent** %188, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %189 = add i64 %181, 1
  store i64 %189, i64* %180, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %190 = trunc i64 %189 to i32
  %191 = load i32, i32* %resume.addr, align 4
  ret i32 %191

if.end.4:
  %192 = load i32, i32* %introducer.addr, align 4
  %193 = icmp ne i32 %192, 80
  br i1 %193, label %if.then.5, label %if.end.5

if.then.5:
  %194 = load i32, i32* %introducer.addr, align 4
  %195 = call i8* @nish_alloc_struct(i64 24)
  %196 = bitcast i8* %195 to %struct.nish_array*
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 0
  store i64 0, i64* %197, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 1
  store i64 0, i64* %198, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %196, i64 0, i32 2
  store i8* null, i8** %199, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %200 = load i32, i32* %start.addr, align 4
  %201 = load i32, i32* %end.addr, align 4
  %202 = call i64 @nish_arena_mark()
  %203 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %200, i32 %201)
  %204 = call i8* @nish_arena_keep(i64 %202, i8* %203)
  %205 = call %struct.TermEvent* @nish.termReplyEvent(i32 %194, i32 0, %struct.nish_array* %196, i32 0, i32 0, i8* %204)
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %207 = load i64, i64* %206, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %208 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %209 = load i64, i64* %208, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %210 = icmp eq i64 %207, %209
  br i1 %210, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %212 = load i8*, i8** %211, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %213 = bitcast i8* %212 to %struct.TermEvent**
  %214 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %213, i64 %207
  store %struct.TermEvent* %205, %struct.TermEvent** %214, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %215 = add i64 %207, 1
  store i64 %215, i64* %206, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %216 = trunc i64 %215 to i32
  %217 = load i32, i32* %resume.addr, align 4
  ret i32 %217

if.end.5:
  %218 = load i32, i32* %start.addr, align 4
  store i32 %218, i32* %from.addr, align 4
  store i32 0, i32* %prefix.addr, align 4
  %219 = load i32, i32* %from.addr, align 4
  %220 = load i32, i32* %end.addr, align 4
  %221 = icmp slt i32 %219, %220
  br i1 %221, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %222 = load i32, i32* %from.addr, align 4
  %223 = sext i32 %222 to i64
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %225 = load i64, i64* %224, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %226 = icmp ult i64 %223, %225
  br i1 %226, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 %223, i64 %225)
  unreachable

bounds.ok.8:
  %227 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %228 = load i8*, i8** %227, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %229 = bitcast i8* %228 to i8*
  %230 = getelementptr inbounds i8, i8* %229, i64 %223
  %231 = load i8, i8* %230, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %232 = zext i8 %231 to i32
  %233 = icmp sge i32 %232, 60
  br label %land.end.5

land.end.5:
  %234 = phi i1 [ false, %if.end.5 ], [ %233, %bounds.ok.8 ]
  br i1 %234, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %235 = load i32, i32* %from.addr, align 4
  %236 = sext i32 %235 to i64
  %237 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %238 = load i64, i64* %237, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %239 = icmp ult i64 %236, %238
  br i1 %239, label %bounds.ok.9, label %bounds.fail.9

bounds.fail.9:
  call void @nish_panic_index(i64 %236, i64 %238)
  unreachable

bounds.ok.9:
  %240 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %241 = load i8*, i8** %240, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %242 = bitcast i8* %241 to i8*
  %243 = getelementptr inbounds i8, i8* %242, i64 %236
  %244 = load i8, i8* %243, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %245 = zext i8 %244 to i32
  %246 = icmp slt i32 %245, 64
  br label %land.end.4

land.end.4:
  %247 = phi i1 [ false, %land.end.5 ], [ %246, %bounds.ok.9 ]
  br i1 %247, label %if.then.6, label %if.end.6

if.then.6:
  %248 = load i32, i32* %from.addr, align 4
  %249 = sext i32 %248 to i64
  %250 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %251 = load i64, i64* %250, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %252 = icmp ult i64 %249, %251
  br i1 %252, label %bounds.ok.10, label %bounds.fail.10

bounds.fail.10:
  call void @nish_panic_index(i64 %249, i64 %251)
  unreachable

bounds.ok.10:
  %253 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %254 = load i8*, i8** %253, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %255 = bitcast i8* %254 to i8*
  %256 = getelementptr inbounds i8, i8* %255, i64 %249
  %257 = load i8, i8* %256, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %258 = zext i8 %257 to i32
  store i32 %258, i32* %prefix.addr, align 4
  %259 = load i32, i32* %from.addr, align 4
  %260 = add nsw i32 %259, 1
  store i32 %260, i32* %from.addr, align 4
  br label %if.end.6

if.end.6:
  %261 = load i32, i32* %from.addr, align 4
  store i32 %261, i32* %to.addr, align 4
  %262 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %263 = load i64, i64* %262, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %264 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %265 = load i8*, i8** %264, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.2

while.cond.2:
  %266 = load i32, i32* %to.addr, align 4
  %267 = load i32, i32* %end.addr, align 4
  %268 = icmp slt i32 %266, %267
  br i1 %268, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %269 = load i32, i32* %to.addr, align 4
  %270 = sext i32 %269 to i64
  %271 = icmp ult i64 %270, %263
  br i1 %271, label %bounds.ok.11, label %bounds.fail.11

bounds.fail.11:
  call void @nish_panic_index(i64 %270, i64 %263)
  unreachable

bounds.ok.11:
  %272 = bitcast i8* %265 to i8*
  %273 = getelementptr inbounds i8, i8* %272, i64 %270
  %274 = load i8, i8* %273, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %275 = zext i8 %274 to i32
  %276 = icmp sge i32 %275, 48
  br label %land.end.7

land.end.7:
  %277 = phi i1 [ false, %while.cond.2 ], [ %276, %bounds.ok.11 ]
  br i1 %277, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %278 = load i32, i32* %to.addr, align 4
  %279 = sext i32 %278 to i64
  %280 = icmp ult i64 %279, %263
  br i1 %280, label %bounds.ok.12, label %bounds.fail.12

bounds.fail.12:
  call void @nish_panic_index(i64 %279, i64 %263)
  unreachable

bounds.ok.12:
  %281 = bitcast i8* %265 to i8*
  %282 = getelementptr inbounds i8, i8* %281, i64 %279
  %283 = load i8, i8* %282, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %284 = zext i8 %283 to i32
  %285 = icmp slt i32 %284, 64
  br label %land.end.6

land.end.6:
  %286 = phi i1 [ false, %land.end.7 ], [ %285, %bounds.ok.12 ]
  br i1 %286, label %while.body.2, label %while.end.2

while.body.2:
  %287 = load i32, i32* %to.addr, align 4
  %288 = add nsw i32 %287, 1
  store i32 %288, i32* %to.addr, align 4
  br label %while.cond.2

while.end.2:
  %289 = load i32, i32* %to.addr, align 4
  store i32 %289, i32* %f.addr, align 4
  %290 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %291 = load i64, i64* %290, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %292 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %293 = load i8*, i8** %292, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond.3

while.cond.3:
  %294 = load i32, i32* %f.addr, align 4
  %295 = load i32, i32* %end.addr, align 4
  %296 = icmp slt i32 %294, %295
  br i1 %296, label %land.rhs.9, label %land.end.9

land.rhs.9:
  %297 = load i32, i32* %f.addr, align 4
  %298 = sext i32 %297 to i64
  %299 = icmp ult i64 %298, %291
  br i1 %299, label %bounds.ok.13, label %bounds.fail.13

bounds.fail.13:
  call void @nish_panic_index(i64 %298, i64 %291)
  unreachable

bounds.ok.13:
  %300 = bitcast i8* %293 to i8*
  %301 = getelementptr inbounds i8, i8* %300, i64 %298
  %302 = load i8, i8* %301, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %303 = zext i8 %302 to i32
  %304 = icmp sge i32 %303, 32
  br label %land.end.9

land.end.9:
  %305 = phi i1 [ false, %while.cond.3 ], [ %304, %bounds.ok.13 ]
  br i1 %305, label %land.rhs.8, label %land.end.8

land.rhs.8:
  %306 = load i32, i32* %f.addr, align 4
  %307 = sext i32 %306 to i64
  %308 = icmp ult i64 %307, %291
  br i1 %308, label %bounds.ok.14, label %bounds.fail.14

bounds.fail.14:
  call void @nish_panic_index(i64 %307, i64 %291)
  unreachable

bounds.ok.14:
  %309 = bitcast i8* %293 to i8*
  %310 = getelementptr inbounds i8, i8* %309, i64 %307
  %311 = load i8, i8* %310, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %312 = zext i8 %311 to i32
  %313 = icmp slt i32 %312, 48
  br label %land.end.8

land.end.8:
  %314 = phi i1 [ false, %land.end.9 ], [ %313, %bounds.ok.14 ]
  br i1 %314, label %while.body.3, label %while.end.3

while.body.3:
  %315 = load i32, i32* %f.addr, align 4
  %316 = add nsw i32 %315, 1
  store i32 %316, i32* %f.addr, align 4
  br label %while.cond.3

while.end.3:
  %317 = load i32, i32* %f.addr, align 4
  %318 = load i32, i32* %to.addr, align 4
  %319 = icmp sgt i32 %317, %318
  br i1 %319, label %cond.true.3, label %cond.false.3

cond.true.3:
  %320 = load i32, i32* %f.addr, align 4
  %321 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %320, i32 1)
  %322 = extractvalue { i32, i1 } %321, 0
  %323 = extractvalue { i32, i1 } %321, 1
  br i1 %323, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %324 = sext i32 %322 to i64
  %325 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %326 = load i64, i64* %325, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %327 = icmp ult i64 %324, %326
  br i1 %327, label %bounds.ok.15, label %bounds.fail.15

bounds.fail.15:
  call void @nish_panic_index(i64 %324, i64 %326)
  unreachable

bounds.ok.15:
  %328 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %329 = load i8*, i8** %328, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %330 = bitcast i8* %329 to i8*
  %331 = getelementptr inbounds i8, i8* %330, i64 %324
  %332 = load i8, i8* %331, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %333 = zext i8 %332 to i32
  br label %cond.end.3

cond.false.3:
  br label %cond.end.3

cond.end.3:
  %334 = phi i32 [ %333, %bounds.ok.15 ], [ 0, %cond.false.3 ]
  store i32 %334, i32* %intermediate.addr, align 4
  %335 = load i32, i32* %f.addr, align 4
  %336 = load i32, i32* %end.addr, align 4
  %337 = icmp slt i32 %335, %336
  br i1 %337, label %cond.true.4, label %cond.false.4

cond.true.4:
  %338 = load i32, i32* %f.addr, align 4
  %339 = sext i32 %338 to i64
  %340 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %341 = load i64, i64* %340, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %342 = icmp ult i64 %339, %341
  br i1 %342, label %bounds.ok.16, label %bounds.fail.16

bounds.fail.16:
  call void @nish_panic_index(i64 %339, i64 %341)
  unreachable

bounds.ok.16:
  %343 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %344 = load i8*, i8** %343, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %345 = bitcast i8* %344 to i8*
  %346 = getelementptr inbounds i8, i8* %345, i64 %339
  %347 = load i8, i8* %346, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %348 = zext i8 %347 to i32
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %349 = phi i32 [ %348, %bounds.ok.16 ], [ 0, %cond.false.4 ]
  store i32 %349, i32* %final.addr, align 4
  %350 = load i32, i32* %introducer.addr, align 4
  %351 = load i32, i32* %prefix.addr, align 4
  %352 = load i32, i32* %from.addr, align 4
  %353 = load i32, i32* %to.addr, align 4
  %354 = call %struct.nish_array* @nish.termCsiParams(%struct.nish_array* %bytes, i32 %352, i32 %353)
  %355 = load i32, i32* %intermediate.addr, align 4
  %356 = load i32, i32* %final.addr, align 4
  %357 = load i32, i32* %f.addr, align 4
  %358 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %357, i32 1)
  %359 = extractvalue { i32, i1 } %358, 0
  %360 = extractvalue { i32, i1 } %358, 1
  br i1 %360, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  %361 = load i32, i32* %end.addr, align 4
  %362 = call i64 @nish_arena_mark()
  %363 = call i8* @nish.termBytesRange(%struct.nish_array* %bytes, i32 %359, i32 %361)
  %364 = call i8* @nish_arena_keep(i64 %362, i8* %363)
  %365 = call %struct.TermEvent* @nish.termReplyEvent(i32 %350, i32 %351, %struct.nish_array* %354, i32 %355, i32 %356, i8* %364)
  %366 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %367 = load i64, i64* %366, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %368 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %369 = load i64, i64* %368, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %370 = icmp eq i64 %367, %369
  br i1 %370, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %371 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %372 = load i8*, i8** %371, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %373 = bitcast i8* %372 to %struct.TermEvent**
  %374 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %373, i64 %367
  store %struct.TermEvent* %365, %struct.TermEvent** %374, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %375 = add i64 %367, 1
  store i64 %375, i64* %366, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %376 = trunc i64 %375 to i32
  %377 = load i32, i32* %resume.addr, align 4
  ret i32 %377

ovf.fail:
  %ovf.op = phi i32 [ 0, %entry ], [ 0, %cond.end ], [ 0, %if.end ], [ 0, %cond.end.2 ], [ 0, %while.end.1 ], [ 1, %cond.true.3 ], [ 0, %cond.end.4 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @nish.termByte(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %k) #0 {
entry:
  %0 = icmp sge i32 %k, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %k, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  %6 = sext i32 %k to i64
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = bitcast i8* %8 to i8*
  %10 = getelementptr inbounds i8, i8* %9, i64 %6
  %11 = load i8, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = zext i8 %11 to i32
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %13 = phi i32 [ %12, %cond.true ], [ -1, %cond.false ]
  ret i32 %13
}

define internal noundef zeroext i1 @nish.termOpensString(i32 noundef %b) #1 {
entry:
  %0 = icmp eq i32 %b, 80
  br i1 %0, label %lor.end.3, label %lor.rhs.3

lor.rhs.3:
  %1 = icmp eq i32 %b, 88
  br label %lor.end.3

lor.end.3:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.3 ]
  br i1 %2, label %lor.end.2, label %lor.rhs.2

lor.rhs.2:
  %3 = icmp eq i32 %b, 93
  br label %lor.end.2

lor.end.2:
  %4 = phi i1 [ true, %lor.end.3 ], [ %3, %lor.rhs.2 ]
  br i1 %4, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %5 = icmp eq i32 %b, 94
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %lor.end.2 ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = icmp eq i32 %b, 95
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %lor.end.1 ], [ %7, %lor.rhs ]
  ret i1 %8
}

define internal noundef i32 @nish.termDecodeEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture %d, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i1 noundef zeroext %last, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %events) #2 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %next.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %after.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %char.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %3, %6
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  %10 = xor i1 %9, true
  br i1 %10, label %if.then, label %if.end

if.then:
  call void @nish_panic(i8* bitcast ({ i64, [42 x i8] }* @.str.18 to i8*))
  unreachable

if.end:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %next.addr, align 4
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %16 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %14
  %19 = load i8, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = zext i8 %19 to i32
  store i32 %20, i32* %b.addr, align 4
  %21 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  %22 = load i1, i1* %21, align 1, !tbaa !72
  br i1 %22, label %if.then.1, label %if.else

if.then.1:
  %23 = load i32, i32* %i.addr, align 4
  %24 = call i32 @nish.termDecodePaste(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %23, i1 %last, %struct.nish_array* %events)
  store i32 %24, i32* %next.addr, align 4
  %25 = load i32, i32* %next.addr, align 4
  %26 = load i32, i32* %n.addr, align 4
  %27 = icmp slt i32 %25, %26
  br i1 %27, label %land.rhs, label %land.end

land.rhs:
  %28 = getelementptr inbounds %struct.KeyDecoder, %struct.KeyDecoder* %d, i32 0, i32 8
  %29 = load i1, i1* %28, align 1, !tbaa !72
  br label %land.end

land.end:
  %30 = phi i1 [ false, %if.then.1 ], [ %29, %land.rhs ]
  br i1 %30, label %if.then.2, label %if.end.2

if.then.2:
  %31 = load i32, i32* %next.addr, align 4
  ret i32 %31

if.end.2:
  br label %if.end.1

if.else:
  %32 = load i32, i32* %b.addr, align 4
  %33 = icmp eq i32 %32, 27
  br i1 %33, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %34 = load i32, i32* %i.addr, align 4
  %35 = add nsw i32 %34, 1
  %36 = load i32, i32* %n.addr, align 4
  %37 = icmp sge i32 %35, %36
  br label %land.end.1

land.end.1:
  %38 = phi i1 [ false, %if.else ], [ %37, %land.rhs.1 ]
  br i1 %38, label %if.then.3, label %if.else.1

if.then.3:
  %39 = xor i1 %last, true
  br i1 %39, label %if.then.4, label %if.end.4

if.then.4:
  %40 = load i32, i32* %i.addr, align 4
  ret i32 %40

if.end.4:
  %41 = load i32, i32* %b.addr, align 4
  %42 = call %struct.TermEvent* @nish.termKeyEvent(i32 8, i32 %41, i32 0, i32 1)
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = icmp eq i64 %44, %46
  br i1 %47, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store

push.store:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %50 = bitcast i8* %49 to %struct.TermEvent**
  %51 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %50, i64 %44
  store %struct.TermEvent* %42, %struct.TermEvent** %51, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %52 = add i64 %44, 1
  store i64 %52, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = trunc i64 %52 to i32
  br label %if.end.3

if.else.1:
  %54 = load i32, i32* %b.addr, align 4
  %55 = icmp eq i32 %54, 27
  br i1 %55, label %if.then.5, label %if.else.2

if.then.5:
  %56 = load i32, i32* %i.addr, align 4
  %57 = add nsw i32 %56, 1
  %58 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %57)
  store i32 %58, i32* %after.addr, align 4
  %59 = load i32, i32* %after.addr, align 4
  %60 = icmp eq i32 %59, 91
  br i1 %60, label %if.then.6, label %if.else.3

if.then.6:
  %61 = load i32, i32* %i.addr, align 4
  %62 = call i32 @nish.termDecodeCsi(%struct.KeyDecoder* %d, %struct.nish_array* %bytes, i32 %61, i1 %last, %struct.nish_array* %events)
  store i32 %62, i32* %next.addr, align 4
  br label %if.end.6

if.else.3:
  %63 = load i32, i32* %after.addr, align 4
  %64 = call i1 @nish.termOpensString(i32 %63)
  br i1 %64, label %if.then.7, label %if.else.4

if.then.7:
  %65 = load i32, i32* %i.addr, align 4
  %66 = call i32 @nish.termDecodeString(%struct.nish_array* %bytes, i32 %65, i1 %last, %struct.nish_array* %events)
  store i32 %66, i32* %next.addr, align 4
  br label %if.end.7

if.else.4:
  %67 = load i32, i32* %after.addr, align 4
  %68 = icmp eq i32 %67, 79
  br i1 %68, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %69 = load i32, i32* %i.addr, align 4
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %69, i32 2)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok

ovf.ok:
  %73 = load i32, i32* %n.addr, align 4
  %74 = icmp sge i32 %71, %73
  br label %land.end.3

land.end.3:
  %75 = phi i1 [ false, %if.else.4 ], [ %74, %ovf.ok ]
  br i1 %75, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %76 = xor i1 %last, true
  br label %land.end.2

land.end.2:
  %77 = phi i1 [ false, %land.end.3 ], [ %76, %land.rhs.2 ]
  br i1 %77, label %if.then.8, label %if.else.5

if.then.8:
  store i32 -1, i32* %next.addr, align 4
  br label %if.end.8

if.else.5:
  %78 = load i32, i32* %after.addr, align 4
  %79 = icmp eq i32 %78, 79
  br i1 %79, label %land.rhs.5, label %land.end.5

land.rhs.5:
  %80 = load i32, i32* %i.addr, align 4
  %81 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %80, i32 2)
  %82 = extractvalue { i32, i1 } %81, 0
  %83 = extractvalue { i32, i1 } %81, 1
  br i1 %83, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %84 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %82)
  %85 = icmp sge i32 %84, 64
  br label %land.end.5

land.end.5:
  %86 = phi i1 [ false, %if.else.5 ], [ %85, %ovf.ok.1 ]
  br i1 %86, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %87 = load i32, i32* %i.addr, align 4
  %88 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %87, i32 2)
  %89 = extractvalue { i32, i1 } %88, 0
  %90 = extractvalue { i32, i1 } %88, 1
  br i1 %90, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %91 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %89)
  %92 = icmp slt i32 %91, 127
  br label %land.end.4

land.end.4:
  %93 = phi i1 [ false, %land.end.5 ], [ %92, %ovf.ok.2 ]
  br i1 %93, label %if.then.9, label %if.else.6

if.then.9:
  %94 = load i32, i32* %i.addr, align 4
  %95 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %94, i32 2)
  %96 = extractvalue { i32, i1 } %95, 0
  %97 = extractvalue { i32, i1 } %95, 1
  br i1 %97, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %98 = call i32 @nish.termByte(%struct.nish_array* %bytes, i32 %96)
  store i32 %98, i32* %f.addr, align 4
  %99 = load i32, i32* %f.addr, align 4
  %100 = icmp eq i32 %99, 77
  br i1 %100, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %101 = load i32, i32* %f.addr, align 4
  %102 = call i32 @nish.termLetterKind(i32 %101)
  br label %cond.end

cond.end:
  %103 = phi i32 [ 6, %cond.true ], [ %102, %cond.false ]
  %104 = load i32, i32* %f.addr, align 4
  %105 = icmp eq i32 %104, 77
  br i1 %105, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %106 = load i32, i32* %f.addr, align 4
  br label %cond.end.1

cond.end.1:
  %107 = phi i32 [ 13, %cond.true.1 ], [ %106, %cond.false.1 ]
  %108 = call %struct.TermEvent* @nish.termKeyEvent(i32 %103, i32 %107, i32 0, i32 1)
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %112 = load i64, i64* %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = icmp eq i64 %110, %112
  br i1 %113, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.1

push.store.1:
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = bitcast i8* %115 to %struct.TermEvent**
  %117 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %116, i64 %110
  store %struct.TermEvent* %108, %struct.TermEvent** %117, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %118 = add i64 %110, 1
  store i64 %118, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %119 = trunc i64 %118 to i32
  %120 = load i32, i32* %i.addr, align 4
  %121 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %120, i32 3)
  %122 = extractvalue { i32, i1 } %121, 0
  %123 = extractvalue { i32, i1 } %121, 1
  br i1 %123, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  store i32 %122, i32* %next.addr, align 4
  br label %if.end.9

if.else.6:
  %124 = load i32, i32* %after.addr, align 4
  %125 = icmp ne i32 %124, 27
  br i1 %125, label %land.rhs.7, label %land.end.7

land.rhs.7:
  %126 = load i32, i32* %after.addr, align 4
  %127 = icmp ne i32 %126, 79
  br label %land.end.7

land.end.7:
  %128 = phi i1 [ false, %if.else.6 ], [ %127, %land.rhs.7 ]
  br i1 %128, label %land.rhs.6, label %land.end.6

land.rhs.6:
  %129 = load i32, i32* %after.addr, align 4
  %130 = icmp slt i32 %129, 128
  br label %land.end.6

land.end.6:
  %131 = phi i1 [ false, %land.end.7 ], [ %130, %land.rhs.6 ]
  br i1 %131, label %if.then.10, label %if.else.7

if.then.10:
  %132 = load i32, i32* %after.addr, align 4
  %133 = call i32 @nish.termAsciiKind(i32 %132)
  %134 = load i32, i32* %after.addr, align 4
  %135 = call %struct.TermEvent* @nish.termKeyEvent(i32 %133, i32 %134, i32 2, i32 1)
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %140 = icmp eq i64 %137, %139
  br i1 %140, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.2

push.store.2:
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %143 = bitcast i8* %142 to %struct.TermEvent**
  %144 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %143, i64 %137
  store %struct.TermEvent* %135, %struct.TermEvent** %144, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %145 = add i64 %137, 1
  store i64 %145, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = trunc i64 %145 to i32
  %147 = load i32, i32* %i.addr, align 4
  %148 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %147, i32 2)
  %149 = extractvalue { i32, i1 } %148, 0
  %150 = extractvalue { i32, i1 } %148, 1
  br i1 %150, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  store i32 %149, i32* %next.addr, align 4
  br label %if.end.10

if.else.7:
  %151 = load i32, i32* %b.addr, align 4
  %152 = call %struct.TermEvent* @nish.termKeyEvent(i32 8, i32 %151, i32 0, i32 1)
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %154 = load i64, i64* %153, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %156 = load i64, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %157 = icmp eq i64 %154, %156
  br i1 %157, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.3

push.store.3:
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %159 = load i8*, i8** %158, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %160 = bitcast i8* %159 to %struct.TermEvent**
  %161 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %160, i64 %154
  store %struct.TermEvent* %152, %struct.TermEvent** %161, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %162 = add i64 %154, 1
  store i64 %162, i64* %153, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %163 = trunc i64 %162 to i32
  br label %if.end.10

if.end.10:
  br label %if.end.9

if.end.9:
  br label %if.end.8

if.end.8:
  br label %if.end.7

if.end.7:
  br label %if.end.6

if.end.6:
  %164 = load i32, i32* %next.addr, align 4
  %165 = icmp slt i32 %164, 0
  br i1 %165, label %if.then.11, label %if.end.11

if.then.11:
  %166 = load i32, i32* %i.addr, align 4
  ret i32 %166

if.end.11:
  br label %if.end.5

if.else.2:
  %167 = load i32, i32* %b.addr, align 4
  %168 = icmp slt i32 %167, 128
  br i1 %168, label %if.then.12, label %if.else.8

if.then.12:
  %169 = load i32, i32* %b.addr, align 4
  %170 = call i32 @nish.termAsciiKind(i32 %169)
  %171 = load i32, i32* %b.addr, align 4
  %172 = call %struct.TermEvent* @nish.termKeyEvent(i32 %170, i32 %171, i32 0, i32 1)
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %175 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %176 = load i64, i64* %175, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %177 = icmp eq i64 %174, %176
  br i1 %177, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.4

push.store.4:
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %179 = load i8*, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %180 = bitcast i8* %179 to %struct.TermEvent**
  %181 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %180, i64 %174
  store %struct.TermEvent* %172, %struct.TermEvent** %181, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %182 = add i64 %174, 1
  store i64 %182, i64* %173, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %183 = trunc i64 %182 to i32
  br label %if.end.12

if.else.8:
  %184 = load i32, i32* %i.addr, align 4
  %185 = call i32 @nish.termUtf8At(%struct.nish_array* %bytes, i32 %184, i1 %last)
  store i32 %185, i32* %char.addr, align 4
  %186 = load i32, i32* %char.addr, align 4
  %187 = icmp slt i32 %186, 0
  br i1 %187, label %if.then.13, label %if.end.13

if.then.13:
  %188 = load i32, i32* %i.addr, align 4
  ret i32 %188

if.end.13:
  %189 = load i32, i32* %char.addr, align 4
  %190 = ashr i32 %189, 3
  %191 = call %struct.TermEvent* @nish.termKeyEvent(i32 1, i32 %190, i32 0, i32 1)
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 0
  %193 = load i64, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 1
  %195 = load i64, i64* %194, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %196 = icmp eq i64 %193, %195
  br i1 %196, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %events, i64 8)
  br label %push.store.5

push.store.5:
  %197 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %events, i64 0, i32 2
  %198 = load i8*, i8** %197, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %199 = bitcast i8* %198 to %struct.TermEvent**
  %200 = getelementptr inbounds %struct.TermEvent*, %struct.TermEvent** %199, i64 %193
  store %struct.TermEvent* %191, %struct.TermEvent** %200, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %201 = add i64 %193, 1
  store i64 %201, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %202 = trunc i64 %201 to i32
  %203 = load i32, i32* %i.addr, align 4
  %204 = load i32, i32* %char.addr, align 4
  %205 = and i32 %204, 7
  %206 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %203, i32 %205)
  %207 = extractvalue { i32, i1 } %206, 0
  %208 = extractvalue { i32, i1 } %206, 1
  br i1 %208, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %207, i32* %next.addr, align 4
  br label %if.end.12

if.end.12:
  br label %if.end.5

if.end.5:
  br label %if.end.3

if.end.3:
  br label %if.end.1

if.end.1:
  %209 = load i32, i32* %next.addr, align 4
  store i32 %209, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %210 = load i32, i32* %n.addr, align 4
  ret i32 %210

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind readonly }
attributes #5 = { nounwind willreturn cold noinline allocsize(0) }
attributes #6 = { nounwind noreturn cold }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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
!20 = !{!"Screen", !17, i64 0, !17, i64 8, !17, i64 16, !17, i64 24, !17, i64 32, !17, i64 40, !17, i64 48, !17, i64 56, !17, i64 64, !18, i64 72, !18, i64 76, !18, i64 80, !19, i64 84, !19, i64 85}
!21 = !{!20, !18, i64 72}
!22 = !{!20, !18, i64 76}
!23 = !{!20, !19, i64 84}
!24 = !{!20, !19, i64 85}
!25 = !{!20, !17, i64 0}
!26 = !{!20, !17, i64 8}
!27 = !{!20, !17, i64 16}
!28 = !{!20, !17, i64 24}
!29 = !{!20, !17, i64 32}
!30 = !{!20, !17, i64 40}
!31 = !{!20, !17, i64 48}
!32 = !{!20, !17, i64 56}
!33 = !{!20, !17, i64 64}
!34 = !{!20, !18, i64 80}
!35 = !{!"element i32", !6, i64 0}
!36 = !{!35, !35, i64 0}
!37 = !{!"Canvas", !17, i64 0, !18, i64 8, !18, i64 12, !17, i64 16}
!38 = !{!37, !17, i64 0}
!39 = !{!37, !18, i64 8}
!40 = !{!37, !18, i64 12}
!41 = !{!37, !17, i64 16}
!42 = !{!"KeyEvent", !18, i64 0, !18, i64 4}
!43 = !{!42, !18, i64 0}
!44 = !{!42, !18, i64 4}
!45 = !{!"TermEvent", !18, i64 0, !18, i64 4, !18, i64 8, !18, i64 12, !18, i64 16, !18, i64 20, !18, i64 24, !18, i64 28, !18, i64 32, !18, i64 36, !17, i64 40, !18, i64 48, !18, i64 52, !18, i64 56, !18, i64 60, !17, i64 64, !19, i64 72}
!46 = !{!45, !18, i64 0}
!47 = !{!45, !18, i64 4}
!48 = !{!45, !18, i64 8}
!49 = !{!45, !18, i64 12}
!50 = !{!45, !18, i64 16}
!51 = !{!45, !18, i64 20}
!52 = !{!45, !18, i64 24}
!53 = !{!45, !18, i64 28}
!54 = !{!45, !18, i64 32}
!55 = !{!45, !18, i64 36}
!56 = !{!45, !17, i64 40}
!57 = !{!45, !18, i64 48}
!58 = !{!45, !18, i64 52}
!59 = !{!45, !18, i64 56}
!60 = !{!45, !18, i64 60}
!61 = !{!45, !17, i64 64}
!62 = !{!45, !19, i64 72}
!63 = !{!"double", !6, i64 0}
!64 = !{!"KeyDecoder", !63, i64 0, !17, i64 8, !63, i64 16, !17, i64 24, !18, i64 32, !18, i64 36, !18, i64 40, !19, i64 44, !19, i64 45}
!65 = !{!64, !63, i64 0}
!66 = !{!64, !17, i64 8}
!67 = !{!64, !63, i64 16}
!68 = !{!64, !18, i64 32}
!69 = !{!64, !19, i64 44}
!70 = !{!64, !18, i64 36}
!71 = !{!64, !18, i64 40}
!72 = !{!64, !19, i64 45}
!73 = !{!64, !17, i64 24}
!74 = !{!"KeyState", !63, i64 0, !63, i64 8, !63, i64 16, !17, i64 24, !17, i64 32, !17, i64 40, !17, i64 48, !17, i64 56, !19, i64 64, !19, i64 65}
!75 = !{!74, !19, i64 64}
!76 = !{!74, !63, i64 0}
!77 = !{!74, !63, i64 8}
!78 = !{!74, !63, i64 16}
!79 = !{!74, !19, i64 65}
!80 = !{!74, !17, i64 24}
!81 = !{!74, !17, i64 32}
!82 = !{!74, !17, i64 40}
!83 = !{!74, !17, i64 48}
!84 = !{!74, !17, i64 56}
!85 = !{!"element i1", !6, i64 0}
!86 = !{!85, !85, i64 0}
!87 = !{!"element double", !6, i64 0}
!88 = !{!87, !87, i64 0}
!89 = !{!"FixedStep", !63, i64 0, !63, i64 8, !63, i64 16, !18, i64 24, !19, i64 28}
!90 = !{!89, !63, i64 0}
!91 = !{!89, !18, i64 24}
!92 = !{!89, !63, i64 8}
!93 = !{!89, !63, i64 16}
!94 = !{!89, !19, i64 28}
