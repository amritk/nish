@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\0A\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"tests/cases/caps_generic.ts\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_read_file(i8* noundef nonnull readonly align 8 nocapture) #1
declare i64 @llvm.smin.i64(i64, i64) #0
declare i64 @llvm.smax.i64(i64, i64) #0

define internal noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define internal noundef nonnull align 8 i8* @firstLine(i8* noundef nonnull noalias readonly align 8 nocapture %path) #1 {
entry:
  %text.addr = alloca i8*, align 8
  %end.addr = alloca i32, align 4
  %0 = call i8* @nish_read_file(i8* %path)
  store i8* %0, i8** %text.addr, align 8
  %1 = load i8*, i8** %text.addr, align 8
  %2 = call i64 @nish_str_index_of(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %end.addr, align 4
  %4 = load i32, i32* %end.addr, align 4
  %5 = icmp slt i32 %4, 0
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  %6 = load i8*, i8** %text.addr, align 8
  br label %cond.end

cond.false:
  %7 = load i8*, i8** %text.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = load i32, i32* %end.addr, align 4
  %11 = sext i32 %10 to i64
  %12 = call i64 @llvm.smin.i64(i64 %11, i64 %9)
  %13 = call i64 @llvm.smax.i64(i64 %12, i64 0)
  %14 = call i64 @llvm.smin.i64(i64 0, i64 %13)
  %15 = call i64 @llvm.smax.i64(i64 0, i64 %13)
  %16 = sub i64 %15, %14
  %17 = getelementptr inbounds i8, i8* %7, i64 8
  %18 = getelementptr inbounds i8, i8* %17, i64 %14
  %19 = call i8* @nish_str_new(i8* %18, i64 %16)
  br label %cond.end

cond.end:
  %20 = phi i8* [ %6, %cond.true ], [ %19, %cond.false ]
  ret i8* %20
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @pick$i32$fn.6.double(i32 21)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i64 @nish_arena_mark()
  %3 = call i8* @pick$str$fn.9.firstLine(i8* bitcast ({ i64, [28 x i8] }* @.str.1 to i8*))
  %4 = call i8* @nish_arena_keep(i64 %2, i8* %3)
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  %8 = icmp sgt i32 %7, 0
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  call void @nish_print(i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @pick$i32$fn.6.double(i32 noundef %x) #0 {
entry:
  %0 = tail call i32 @double(i32 %x)
  ret i32 %0
}

define noundef nonnull align 8 i8* @pick$str$fn.9.firstLine(i8* noundef nonnull noalias readonly align 8 %x) #1 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @firstLine(i8* %x)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
