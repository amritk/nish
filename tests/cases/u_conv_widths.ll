define noundef i16 @widen8(i8 noundef %x) #0 {
entry:
  %0 = zext i8 %x to i16
  ret i16 %0
}

define noundef i32 @widen16(i16 noundef %x) #0 {
entry:
  %0 = zext i16 %x to i32
  ret i32 %0
}

define noundef i64 @widen32(i32 noundef %x) #0 {
entry:
  %0 = zext i32 %x to i64
  ret i64 %0
}

define noundef i32 @narrow64(i64 noundef %x) #0 {
entry:
  %0 = trunc i64 %x to i32
  ret i32 %0
}

define noundef i16 @narrow32(i32 noundef %x) #0 {
entry:
  %0 = trunc i32 %x to i16
  ret i16 %0
}

define noundef i8 @narrow16(i16 noundef %x) #0 {
entry:
  %0 = trunc i16 %x to i8
  ret i8 %0
}

attributes #0 = { nounwind willreturn readnone }
