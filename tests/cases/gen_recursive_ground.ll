@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"hi\00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

define noundef i32 @test() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @countDown$str(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i32 3)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @countDown$str(i8* noundef nonnull noalias readonly align 8 nocapture %x, i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = tail call i32 @countDown$i32(i32 1, i32 %2)
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @countDown$i32(i32 noundef %x, i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = tail call i32 @countDown$i32(i32 1, i32 %2)
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }
