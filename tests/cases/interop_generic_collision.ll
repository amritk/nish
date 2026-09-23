define noundef i32 @identity_i32(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @identity$i32(i32 40)
  %1 = call i32 @identity_i32(i32 1)
  %2 = add nsw i32 %0, %1
  ret i32 %2
}

define noundef i32 @identity$i32(i32 noundef %x) #0 {
entry:
  ret i32 %x
}

attributes #0 = { nounwind willreturn readnone }
