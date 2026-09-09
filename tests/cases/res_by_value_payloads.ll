%struct.amrit_result.f32.bool = type { i1, float, i1 }
%struct.amrit_result.u8.u16 = type { i1, i8, i16 }

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_u64(i64 noundef) #0

define internal noundef { i1, i32 } @scale(float noundef %x) #0 {
entry:
  %0 = fcmp olt float %x, 0x0000000000000000
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = zext i1 true to i64
  %2 = shl i64 %1, 32
  %3 = trunc i64 %2 to i1
  %4 = lshr i64 %2, 32
  %5 = trunc i64 %4 to i32
  %6 = insertvalue { i1, i32 } undef, i1 %3, 0
  %7 = insertvalue { i1, i32 } %6, i32 %5, 1
  ret { i1, i32 } %7

if.end:
  %8 = fmul float %x, 0x4000000000000000
  %9 = bitcast float %8 to i32
  %10 = zext i32 %9 to i64
  %11 = shl i64 %10, 32
  %12 = or i64 %11, 1
  %13 = trunc i64 %12 to i1
  %14 = lshr i64 %12, 32
  %15 = trunc i64 %14 to i32
  %16 = insertvalue { i1, i32 } undef, i1 %13, 0
  %17 = insertvalue { i1, i32 } %16, i32 %15, 1
  ret { i1, i32 } %17
}

define internal noundef { i1, i32 } @narrow(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 255
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = trunc i32 1000 to i16
  %2 = zext i16 %1 to i64
  %3 = shl i64 %2, 32
  %4 = trunc i64 %3 to i1
  %5 = lshr i64 %3, 32
  %6 = trunc i64 %5 to i32
  %7 = insertvalue { i1, i32 } undef, i1 %4, 0
  %8 = insertvalue { i1, i32 } %7, i32 %6, 1
  ret { i1, i32 } %8

if.end:
  %9 = trunc i32 %n to i8
  %10 = zext i8 %9 to i64
  %11 = shl i64 %10, 32
  %12 = or i64 %11, 1
  %13 = trunc i64 %12 to i1
  %14 = lshr i64 %12, 32
  %15 = trunc i64 %14 to i32
  %16 = insertvalue { i1, i32 } undef, i1 %13, 0
  %17 = insertvalue { i1, i32 } %16, i32 %15, 1
  ret { i1, i32 } %17
}

define noundef i32 @amrit_main() #0 {
entry:
  %amrit_result.f32.bool.obj = alloca %struct.amrit_result.f32.bool, align 8
  %amrit_result.f32.bool.obj.1 = alloca %struct.amrit_result.f32.bool, align 8
  %small.addr = alloca %struct.amrit_result.u8.u16*, align 8
  %amrit_result.u8.u16.obj = alloca %struct.amrit_result.u8.u16, align 8
  %big.addr = alloca %struct.amrit_result.u8.u16*, align 8
  %amrit_result.u8.u16.obj.1 = alloca %struct.amrit_result.u8.u16, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call { i1, i32 } @scale(float 0x3FF8000000000000)
  %1 = extractvalue { i1, i32 } %0, 0
  %2 = extractvalue { i1, i32 } %0, 1
  %3 = zext i32 %2 to i64
  %4 = shl i64 %3, 32
  %5 = zext i1 %1 to i64
  %6 = or i64 %4, %5
  %7 = trunc i64 %6 to i1
  %8 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 0
  store i1 %7, i1* %8, align 1
  %9 = lshr i64 %6, 32
  %10 = trunc i64 %9 to i32
  %11 = bitcast i32 %10 to float
  %12 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 1
  store float %11, float* %12, align 4
  %13 = trunc i64 %9 to i1
  %14 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 2
  store i1 %13, i1* %14, align 1
  %15 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 0
  %16 = load i1, i1* %15, align 1
  br i1 %16, label %res.ok, label %res.alt

res.ok:
  %17 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 1
  %18 = load float, float* %17, align 4
  br label %res.end

res.alt:
  %19 = fneg float 0x3FF0000000000000
  br label %res.end

res.end:
  %20 = phi float [ %18, %res.ok ], [ %19, %res.alt ]
  %21 = fpext float %20 to double
  %22 = call i8* @amrit_str_from_f64(double %21)
  call void @amrit_print(i8* %22)
  %23 = fneg float 0x3FF0000000000000
  %24 = call { i1, i32 } @scale(float %23)
  %25 = extractvalue { i1, i32 } %24, 0
  %26 = extractvalue { i1, i32 } %24, 1
  %27 = zext i32 %26 to i64
  %28 = shl i64 %27, 32
  %29 = zext i1 %25 to i64
  %30 = or i64 %28, %29
  %31 = trunc i64 %30 to i1
  %32 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 0
  store i1 %31, i1* %32, align 1
  %33 = lshr i64 %30, 32
  %34 = trunc i64 %33 to i32
  %35 = bitcast i32 %34 to float
  %36 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 1
  store float %35, float* %36, align 4
  %37 = trunc i64 %33 to i1
  %38 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 2
  store i1 %37, i1* %38, align 1
  %39 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 0
  %40 = load i1, i1* %39, align 1
  br i1 %40, label %res.ok.1, label %res.alt.1

res.ok.1:
  %41 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 1
  %42 = load float, float* %41, align 4
  br label %res.end.1

res.alt.1:
  %43 = fneg float 0x3FF0000000000000
  br label %res.end.1

res.end.1:
  %44 = phi float [ %42, %res.ok.1 ], [ %43, %res.alt.1 ]
  %45 = fpext float %44 to double
  %46 = call i8* @amrit_str_from_f64(double %45)
  call void @amrit_print(i8* %46)
  %47 = call { i1, i32 } @narrow(i32 200)
  %48 = extractvalue { i1, i32 } %47, 0
  %49 = extractvalue { i1, i32 } %47, 1
  %50 = zext i32 %49 to i64
  %51 = shl i64 %50, 32
  %52 = zext i1 %48 to i64
  %53 = or i64 %51, %52
  %54 = trunc i64 %53 to i1
  %55 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, i32 0, i32 0
  store i1 %54, i1* %55, align 1
  %56 = lshr i64 %53, 32
  %57 = trunc i64 %56 to i8
  %58 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, i32 0, i32 1
  store i8 %57, i8* %58, align 1
  %59 = trunc i64 %56 to i16
  %60 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, i32 0, i32 2
  store i16 %59, i16* %60, align 2
  store %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, %struct.amrit_result.u8.u16** %small.addr, align 8
  %61 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %small.addr, align 8
  %62 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %61, i32 0, i32 0
  %63 = load i1, i1* %62, align 1
  br i1 %63, label %if.then, label %if.end

if.then:
  %64 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %small.addr, align 8
  %65 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %64, i32 0, i32 1
  %66 = load i8, i8* %65, align 1
  %67 = zext i8 %66 to i64
  %68 = call i8* @amrit_str_from_u64(i64 %67)
  call void @amrit_print(i8* %68)
  br label %if.end

if.end:
  %69 = call { i1, i32 } @narrow(i32 300)
  %70 = extractvalue { i1, i32 } %69, 0
  %71 = extractvalue { i1, i32 } %69, 1
  %72 = zext i32 %71 to i64
  %73 = shl i64 %72, 32
  %74 = zext i1 %70 to i64
  %75 = or i64 %73, %74
  %76 = trunc i64 %75 to i1
  %77 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, i32 0, i32 0
  store i1 %76, i1* %77, align 1
  %78 = lshr i64 %75, 32
  %79 = trunc i64 %78 to i8
  %80 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, i32 0, i32 1
  store i8 %79, i8* %80, align 1
  %81 = trunc i64 %78 to i16
  %82 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, i32 0, i32 2
  store i16 %81, i16* %82, align 2
  store %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, %struct.amrit_result.u8.u16** %big.addr, align 8
  %83 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %big.addr, align 8
  %84 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %83, i32 0, i32 0
  %85 = load i1, i1* %84, align 1
  %86 = xor i1 %85, true
  br i1 %86, label %if.then.1, label %if.end.1

if.then.1:
  %87 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %big.addr, align 8
  %88 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %87, i32 0, i32 2
  %89 = load i16, i16* %88, align 2
  %90 = zext i16 %89 to i64
  %91 = call i8* @amrit_str_from_u64(i64 %90)
  call void @amrit_print(i8* %91)
  br label %if.end.1

if.end.1:
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
