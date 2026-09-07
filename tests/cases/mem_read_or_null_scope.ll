@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"read \00" }, align 8

declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef align 8 i8* @sts_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #0

define noundef align 8 i8* @load(i8* noundef nonnull noalias readonly align 8 nocapture %path) #0 {
entry:
  %label.addr = alloca i8*, align 8
  %0 = call i8* @sts_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %path)
  store i8* %0, i8** %label.addr, align 8
  %1 = load i8*, i8** %label.addr, align 8
  call void @sts_print(i8* %1)
  %2 = call i8* @sts_read_file_or_null(i8* %path)
  ret i8* %2
}

attributes #0 = { nounwind willreturn }
