@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @apply$fn.16.nish_main$arrow0(i32 10)
  store i32 %0, i32* %a.addr, align 4
  %1 = call i32 @apply$fn.16.nish_main$arrow1(i32 10)
  store i32 %1, i32* %b.addr, align 4
  %2 = call i32 @apply$fn.16.nish_main$arrow2(i32 10)
  store i32 %2, i32* %c.addr, align 4
  %3 = call i32 @apply$fn.16.nish_main$arrow3(i32 10)
  store i32 %3, i32* %d.addr, align 4
  %4 = load i32, i32* %a.addr, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load i32, i32* %b.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = load i32, i32* %c.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load i32, i32* %d.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
  call void @nish_print(i8* %17)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @nish_main$arrow0(i32 noundef %x) #1 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow1(i32 noundef %x) #1 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow2(i32 noundef %x) #1 {
entry:
  %0 = sub nsw i32 %x, 3
  ret i32 %0
}

define internal noundef i32 @nish_main$arrow3(i32 noundef %x) #1 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %x
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %n.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = add nsw i32 %2, %3
  store i32 %4, i32* %n.addr, align 4
  br label %for.inc

for.inc:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %7 = load i32, i32* %n.addr, align 4
  ret i32 %7
}

define internal noundef i32 @apply$fn.16.nish_main$arrow0(i32 noundef %x) #1 {
entry:
  %0 = tail call i32 @nish_main$arrow0(i32 %x)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow1(i32 noundef %x) #1 {
entry:
  %0 = tail call i32 @nish_main$arrow1(i32 %x)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow2(i32 noundef %x) #1 {
entry:
  %0 = tail call i32 @nish_main$arrow2(i32 %x)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow3(i32 noundef %x) #1 {
entry:
  %0 = tail call i32 @nish_main$arrow3(i32 %x)
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
