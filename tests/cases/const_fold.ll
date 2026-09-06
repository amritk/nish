define noundef i32 @test() #0 {
entry:
  br i1 true, label %if.then, label %if.end

if.then:
  ret i32 16

if.end:
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
