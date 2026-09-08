%struct.amrit_result.f32.bool = type { i1, float, i1 }
%struct.amrit_result.u8.u16 = type { i1, i8, i16 }

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_u64(i64 noundef) #0

define internal noundef i64 @scale(float noundef %x) #0 {
entry:
  %0 = fcmp olt float %x, 0x0000000000000000
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = zext i1 true to i64
  %2 = shl i64 %1, 32
  ret i64 %2

if.end:
  %3 = fmul float %x, 0x4000000000000000
  %4 = bitcast float %3 to i32
  %5 = zext i32 %4 to i64
  %6 = shl i64 %5, 32
  %7 = or i64 %6, 1
  ret i64 %7
}

define internal noundef i64 @narrow(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 255
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = trunc i32 1000 to i16
  %2 = zext i16 %1 to i64
  %3 = shl i64 %2, 32
  ret i64 %3

if.end:
  %4 = trunc i32 %n to i8
  %5 = zext i8 %4 to i64
  %6 = shl i64 %5, 32
  %7 = or i64 %6, 1
  ret i64 %7
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
  %0 = call i64 @scale(float 0x3FF8000000000000)
  %1 = trunc i64 %0 to i1
  %2 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = lshr i64 %0, 32
  %4 = trunc i64 %3 to i32
  %5 = bitcast i32 %4 to float
  %6 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 1
  store float %5, float* %6, align 4
  %7 = trunc i64 %3 to i1
  %8 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 2
  store i1 %7, i1* %8, align 1
  %9 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  br i1 %10, label %res.ok, label %res.alt

res.ok:
  %11 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj, i32 0, i32 1
  %12 = load float, float* %11, align 4
  br label %res.end

res.alt:
  %13 = fneg float 0x3FF0000000000000
  br label %res.end

res.end:
  %14 = phi float [ %12, %res.ok ], [ %13, %res.alt ]
  %15 = fpext float %14 to double
  %16 = call i8* @amrit_str_from_f64(double %15)
  call void @amrit_print(i8* %16)
  %17 = fneg float 0x3FF0000000000000
  %18 = call i64 @scale(float %17)
  %19 = trunc i64 %18 to i1
  %20 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 0
  store i1 %19, i1* %20, align 1
  %21 = lshr i64 %18, 32
  %22 = trunc i64 %21 to i32
  %23 = bitcast i32 %22 to float
  %24 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 1
  store float %23, float* %24, align 4
  %25 = trunc i64 %21 to i1
  %26 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 2
  store i1 %25, i1* %26, align 1
  %27 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 0
  %28 = load i1, i1* %27, align 1
  br i1 %28, label %res.ok.1, label %res.alt.1

res.ok.1:
  %29 = getelementptr inbounds %struct.amrit_result.f32.bool, %struct.amrit_result.f32.bool* %amrit_result.f32.bool.obj.1, i32 0, i32 1
  %30 = load float, float* %29, align 4
  br label %res.end.1

res.alt.1:
  %31 = fneg float 0x3FF0000000000000
  br label %res.end.1

res.end.1:
  %32 = phi float [ %30, %res.ok.1 ], [ %31, %res.alt.1 ]
  %33 = fpext float %32 to double
  %34 = call i8* @amrit_str_from_f64(double %33)
  call void @amrit_print(i8* %34)
  %35 = call i64 @narrow(i32 200)
  %36 = trunc i64 %35 to i1
  %37 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, i32 0, i32 0
  store i1 %36, i1* %37, align 1
  %38 = lshr i64 %35, 32
  %39 = trunc i64 %38 to i8
  %40 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, i32 0, i32 1
  store i8 %39, i8* %40, align 1
  %41 = trunc i64 %38 to i16
  %42 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, i32 0, i32 2
  store i16 %41, i16* %42, align 2
  store %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj, %struct.amrit_result.u8.u16** %small.addr, align 8
  %43 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %small.addr, align 8
  %44 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %43, i32 0, i32 0
  %45 = load i1, i1* %44, align 1
  br i1 %45, label %if.then, label %if.end

if.then:
  %46 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %small.addr, align 8
  %47 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %46, i32 0, i32 1
  %48 = load i8, i8* %47, align 1
  %49 = zext i8 %48 to i64
  %50 = call i8* @amrit_str_from_u64(i64 %49)
  call void @amrit_print(i8* %50)
  br label %if.end

if.end:
  %51 = call i64 @narrow(i32 300)
  %52 = trunc i64 %51 to i1
  %53 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, i32 0, i32 0
  store i1 %52, i1* %53, align 1
  %54 = lshr i64 %51, 32
  %55 = trunc i64 %54 to i8
  %56 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, i32 0, i32 1
  store i8 %55, i8* %56, align 1
  %57 = trunc i64 %54 to i16
  %58 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, i32 0, i32 2
  store i16 %57, i16* %58, align 2
  store %struct.amrit_result.u8.u16* %amrit_result.u8.u16.obj.1, %struct.amrit_result.u8.u16** %big.addr, align 8
  %59 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %big.addr, align 8
  %60 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %59, i32 0, i32 0
  %61 = load i1, i1* %60, align 1
  %62 = xor i1 %61, true
  br i1 %62, label %if.then.1, label %if.end.1

if.then.1:
  %63 = load %struct.amrit_result.u8.u16*, %struct.amrit_result.u8.u16** %big.addr, align 8
  %64 = getelementptr inbounds %struct.amrit_result.u8.u16, %struct.amrit_result.u8.u16* %63, i32 0, i32 2
  %65 = load i16, i16* %64, align 2
  %66 = zext i16 %65 to i64
  %67 = call i8* @amrit_str_from_u64(i64 %66)
  call void @amrit_print(i8* %67)
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
