define noundef i32 @shiftU32(i32 noundef %x) #0 {
entry:
  %0 = lshr i32 %x, 1
  %1 = lshr i32 %x, 1
  %2 = add i32 %0, %1
  ret i32 %2
}

define noundef i32 @shiftI32(i32 noundef %x) #0 {
entry:
  %0 = ashr i32 %x, 1
  %1 = lshr i32 %x, 1
  %2 = add i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind willreturn readnone }
