%struct.Flags = type { i32, i32, i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %f.addr = alloca %struct.Flags*, align 8
  %Flags.obj = alloca %struct.Flags, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Flags, %struct.Flags* %Flags.obj, i32 0, i32 0
  store i32 255, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Flags, %struct.Flags* %Flags.obj, i32 0, i32 1
  store i32 4294967295, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Flags, %struct.Flags* %Flags.obj, i32 0, i32 2
  store i32 -16, i32* %2, align 4
  store %struct.Flags* %Flags.obj, %struct.Flags** %f.addr, align 8
  %3 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %4 = getelementptr inbounds %struct.Flags, %struct.Flags* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = and i32 %5, 60
  store i32 %6, i32* %4, align 4
  %7 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %8 = getelementptr inbounds %struct.Flags, %struct.Flags* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  %10 = or i32 %9, 3
  store i32 %10, i32* %8, align 4
  %11 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %12 = getelementptr inbounds %struct.Flags, %struct.Flags* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4
  %14 = xor i32 %13, 5
  store i32 %14, i32* %12, align 4
  %15 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %16 = getelementptr inbounds %struct.Flags, %struct.Flags* %15, i32 0, i32 0
  %17 = load i32, i32* %16, align 4
  %18 = shl i32 %17, 1
  store i32 %18, i32* %16, align 4
  %19 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %20 = getelementptr inbounds %struct.Flags, %struct.Flags* %19, i32 0, i32 1
  %21 = load i32, i32* %20, align 4
  %22 = lshr i32 %21, 28
  store i32 %22, i32* %20, align 4
  %23 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %24 = getelementptr inbounds %struct.Flags, %struct.Flags* %23, i32 0, i32 2
  %25 = load i32, i32* %24, align 4
  %26 = ashr i32 %25, 2
  store i32 %26, i32* %24, align 4
  %27 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %28 = getelementptr inbounds %struct.Flags, %struct.Flags* %27, i32 0, i32 0
  %29 = load i32, i32* %28, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  call void @nish_print(i8* %30)
  %31 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %32 = getelementptr inbounds %struct.Flags, %struct.Flags* %31, i32 0, i32 1
  %33 = load i32, i32* %32, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.Flags*, %struct.Flags** %f.addr, align 8
  %36 = getelementptr inbounds %struct.Flags, %struct.Flags* %35, i32 0, i32 2
  %37 = load i32, i32* %36, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  call void @nish_print(i8* %38)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
