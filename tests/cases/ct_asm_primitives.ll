define noundef i32 @selectU32(i32 noundef %mask, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = call i32 asm "", "=r,0"(i32 %mask) readnone nounwind
  %1 = and i32 %a, %0
  %2 = xor i32 %0, -1
  %3 = and i32 %b, %2
  %4 = or i32 %1, %3
  ret i32 %4
}

define noundef i64 @selectU64(i64 noundef %mask, i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = call i64 asm "", "=r,0"(i64 %mask) readnone nounwind
  %1 = and i64 %a, %0
  %2 = xor i64 %0, -1
  %3 = and i64 %b, %2
  %4 = or i64 %1, %3
  ret i64 %4
}

define noundef i32 @eqU32(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = xor i32 %a, %b
  %1 = sub i32 0, %0
  %2 = or i32 %0, %1
  %3 = lshr i32 %2, 31
  %4 = sub i32 %3, 1
  %5 = call i32 asm "", "=r,0"(i32 %4) readnone nounwind
  ret i32 %5
}

define noundef i64 @eqU64(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = xor i64 %a, %b
  %1 = sub i64 0, %0
  %2 = or i64 %0, %1
  %3 = lshr i64 %2, 63
  %4 = sub i64 %3, 1
  %5 = call i64 asm "", "=r,0"(i64 %4) readnone nounwind
  ret i64 %5
}

define noundef i32 @pickU32(i32 noundef %a, i32 noundef %b, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = xor i32 %a, %b
  %1 = sub i32 0, %0
  %2 = or i32 %0, %1
  %3 = lshr i32 %2, 31
  %4 = sub i32 %3, 1
  %5 = call i32 asm "", "=r,0"(i32 %4) readnone nounwind
  %6 = call i32 asm "", "=r,0"(i32 %5) readnone nounwind
  %7 = and i32 %x, %6
  %8 = xor i32 %6, -1
  %9 = and i32 %y, %8
  %10 = or i32 %7, %9
  ret i32 %10
}

define noundef i64 @pickU64(i64 noundef %a, i64 noundef %b, i64 noundef %x, i64 noundef %y) #0 {
entry:
  %0 = xor i64 %a, %b
  %1 = sub i64 0, %0
  %2 = or i64 %0, %1
  %3 = lshr i64 %2, 63
  %4 = sub i64 %3, 1
  %5 = call i64 asm "", "=r,0"(i64 %4) readnone nounwind
  %6 = call i64 asm "", "=r,0"(i64 %5) readnone nounwind
  %7 = and i64 %x, %6
  %8 = xor i64 %6, -1
  %9 = and i64 %y, %8
  %10 = or i64 %7, %9
  ret i64 %10
}

define noundef i32 @maxU32(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %borrow.addr = alloca i32, align 4
  %0 = xor i32 %a, %b
  %1 = sub i32 %a, %b
  %2 = xor i32 %1, %b
  %3 = or i32 %0, %2
  %4 = xor i32 %a, %3
  %5 = lshr i32 %4, 31
  store i32 %5, i32* %borrow.addr, align 4
  %6 = load i32, i32* %borrow.addr, align 4
  %7 = sub i32 0, %6
  %8 = call i32 asm "", "=r,0"(i32 %7) readnone nounwind
  %9 = and i32 %b, %8
  %10 = xor i32 %8, -1
  %11 = and i32 %a, %10
  %12 = or i32 %9, %11
  ret i32 %12
}

attributes #0 = { nounwind willreturn readnone }
