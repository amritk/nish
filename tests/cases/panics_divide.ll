declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_panic_div(i1 noundef zeroext) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noundef i32 @quotient(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  %1 = icmp eq i32 %a, -2147483648
  %2 = icmp eq i32 %b, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 %a, %b
  ret i32 %5
}

define internal noundef i32 @remainder(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %r.addr = alloca i32, align 4
  store i32 %a, i32* %r.addr, align 4
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp eq i32 %b, 0
  %2 = icmp eq i32 %0, -2147483648
  %3 = icmp eq i32 %b, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = srem i32 %0, %b
  store i32 %6, i32* %r.addr, align 4
  %7 = load i32, i32* %r.addr, align 4
  ret i32 %7
}

define internal noundef double @ratio(double noundef %a, double noundef %b) #1 {
entry:
  %0 = fdiv double %a, %b
  ret double %0
}

define internal noundef i32 @halves(i32 noundef %a) #0 {
entry:
  %0 = sdiv i32 %a, 2
  %1 = srem i32 %a, -3
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @share(i32 noundef %a, i32 noundef %d) #1 {
entry:
  %0 = icmp ne i32 %d, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = udiv i32 %a, %d
  ret i32 %1

if.end:
  ret i32 0
}

define internal noundef i32 @guarded(i32 noundef %a, i32 noundef %d) #1 {
entry:
  %0 = icmp ne i32 %d, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp ne i32 %d, -1
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = sdiv i32 %a, %d
  ret i32 %3

if.end:
  ret i32 0
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @quotient(i32 17, i32 5)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @remainder(i32 17, i32 5)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call double @ratio(double 0x3FF0000000000000, double 0x4010000000000000)
  %5 = call i8* @nish_str_from_f64(double %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @halves(i32 17)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = call i32 @share(i32 17, i32 4)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = call i32 @guarded(i32 17, i32 -1)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
