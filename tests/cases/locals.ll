define noundef i32 @square(i32 noundef %x) #0 {
entry:
  %0 = mul i32 %x, %x
  ret i32 %0
}

define noundef i32 @polynomial(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %acc.addr = alloca i32, align 4
  %bias.addr = alloca i32, align 4
  %0 = call i32 @square(i32 %x)
  %1 = mul i32 %0, 3
  store i32 %1, i32* %acc.addr, align 4
  %2 = load i32, i32* %acc.addr, align 4
  %3 = mul i32 %k, 2
  %4 = add i32 %2, %3
  store i32 %4, i32* %acc.addr, align 4
  store i32 7, i32* %bias.addr, align 4
  %5 = load i32, i32* %acc.addr, align 4
  %6 = load i32, i32* %bias.addr, align 4
  %7 = sub i32 %5, %6
  ret i32 %7
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @polynomial(i32 4, i32 5)
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
