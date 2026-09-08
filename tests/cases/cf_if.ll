define internal noundef i32 @abs(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sub nsw i32 0, %x
  ret i32 %1

if.end:
  ret i32 %x
}

define internal noundef i32 @pick(i1 noundef zeroext %flag, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %r.addr = alloca i32, align 4
  store i32 0, i32* %r.addr, align 4
  br i1 %flag, label %if.then, label %if.else

if.then:
  store i32 %a, i32* %r.addr, align 4
  br label %if.end

if.else:
  store i32 %b, i32* %r.addr, align 4
  br label %if.end

if.end:
  %0 = load i32, i32* %r.addr, align 4
  ret i32 %0
}

define noundef i32 @test() #0 {
entry:
  %0 = sub nsw i32 0, 4
  %1 = call i32 @abs(i32 %0)
  %2 = call i32 @pick(i1 true, i32 10, i32 20)
  %3 = add nsw i32 %1, %2
  ret i32 %3
}

attributes #0 = { nounwind willreturn readnone }
