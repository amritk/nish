%struct.Pair$i32$str = type { i32, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @test() #0 {
entry:
  %p.addr = alloca %struct.Pair$i32$str*, align 8
  %Pair$i32$str.obj = alloca %struct.Pair$i32$str, align 8
  %0 = getelementptr inbounds %struct.Pair$i32$str, %struct.Pair$i32$str* %Pair$i32$str.obj, i32 0, i32 0
  store i32 7, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Pair$i32$str, %struct.Pair$i32$str* %Pair$i32$str.obj, i32 0, i32 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %1, align 8
  store %struct.Pair$i32$str* %Pair$i32$str.obj, %struct.Pair$i32$str** %p.addr, align 8
  %2 = load %struct.Pair$i32$str*, %struct.Pair$i32$str** %p.addr, align 8
  %3 = getelementptr inbounds %struct.Pair$i32$str, %struct.Pair$i32$str* %2, i32 0, i32 1
  %4 = load i8*, i8** %3, align 8
  call void @nish_print(i8* %4)
  %5 = load %struct.Pair$i32$str*, %struct.Pair$i32$str** %p.addr, align 8
  %6 = getelementptr inbounds %struct.Pair$i32$str, %struct.Pair$i32$str* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  ret i32 %7
}

attributes #0 = { nounwind willreturn }
