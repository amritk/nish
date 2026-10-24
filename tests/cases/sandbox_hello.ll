@.str.0 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"hello, confined\00" }, align 8
@.sandbox.preinit = internal constant void ()* @.sandbox.apply, section ".preinit_array", align 8
@llvm.used = appending global [1 x i8*] [i8* bitcast (void ()** @.sandbox.preinit to i8*)], section "llvm.metadata"

declare void @nish_free_arena() #0
declare void @nish_sandbox(i32, i32, i8*, i8*) #0
declare void @nish_sandbox_check() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef i32 @nish_main() #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [16 x i8] }* @.str.0 to i8*))
  ret i32 0
}

define internal void @.sandbox.apply() {
entry:
  call void @nish_sandbox(i32 0, i32 1, i8* null, i8* null)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_sandbox_check()
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
