@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"static\00" }, align 8

define noundef i32 @test() #0 {
entry:
  %0 = bitcast i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*) to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

attributes #0 = { nounwind willreturn readonly }
