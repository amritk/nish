define internal noundef nonnull align 8 i8* @identity(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  ret i8* %s
}

define internal noundef nonnull align 8 i8* @pick(i1 noundef zeroext %flag, i8* noundef nonnull noalias readonly align 8 %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %0 = call i8* @identity(i8* %a)
  ret i8* %0
}

attributes #0 = { nounwind willreturn readnone }
