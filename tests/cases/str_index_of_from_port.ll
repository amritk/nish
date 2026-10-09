@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"caf\C3\A9: a: b\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare i64 @nish_str_index_of_from(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture, i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare i64 @llvm.smax.i64(i64, i64) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal void @printSecond(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = trunc i64 %0 to i32
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = sext i32 %3 to i64
  %6 = bitcast i8* %line to i64*
  %7 = load i64, i64* %6, align 8
  %8 = call i64 @llvm.smin.i64(i64 %5, i64 %7)
  %9 = call i64 @llvm.smax.i64(i64 %8, i64 0)
  %10 = call i64 @nish_str_index_of_from(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 %9)
  %11 = trunc i64 %10 to i32
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @afterSecond(i8* noundef nonnull noalias readonly align 8 nocapture %line) #0 {
entry:
  %0 = bitcast i8* %line to i64*
  %1 = load i64, i64* %0, align 8
  %2 = call i64 @nish_str_index_of(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = trunc i64 %2 to i32
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 1)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = sext i32 %5 to i64
  %8 = bitcast i8* %line to i64*
  %9 = load i64, i64* %8, align 8
  %10 = call i64 @llvm.smin.i64(i64 %7, i64 %9)
  %11 = call i64 @llvm.smax.i64(i64 %10, i64 0)
  %12 = call i64 @nish_str_index_of_from(i8* %line, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i64 %11)
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %17 = sext i32 %15 to i64
  %18 = call i64 @llvm.smin.i64(i64 %17, i64 %1)
  %19 = call i64 @llvm.smax.i64(i64 %18, i64 0)
  %20 = bitcast i8* %line to i64*
  %21 = load i64, i64* %20, align 8
  %22 = trunc i64 %21 to i32
  %23 = sext i32 %22 to i64
  %24 = call i64 @llvm.smin.i64(i64 %23, i64 %1)
  %25 = call i64 @llvm.smax.i64(i64 %24, i64 0)
  %26 = call i64 @llvm.smin.i64(i64 %19, i64 %25)
  %27 = call i64 @llvm.smax.i64(i64 %19, i64 %25)
  %28 = sub i64 %27, %26
  %29 = getelementptr inbounds i8, i8* %line, i64 8
  %30 = getelementptr inbounds i8, i8* %29, i64 %26
  %31 = call i8* @nish_str_new(i8* %30, i64 %28)
  ret i8* %31

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %line.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [12 x i8] }* @.str.1 to i8*), i8** %line.addr, align 8
  %0 = load i8*, i8** %line.addr, align 8
  call void @printSecond(i8* %0)
  %1 = load i8*, i8** %line.addr, align 8
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @afterSecond(i8* %1)
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  call void @nish_print(i8* %4)
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
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn memory(argmem: read) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
