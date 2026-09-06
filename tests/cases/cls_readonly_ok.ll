%struct.Version = type { i32, i32, i8*, i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8

declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define void @Version.constructor(%struct.Version* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %major, i32 noundef %minor) #0 {
entry:
  %0 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %0, align 8
  %1 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 0
  store i32 %major, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 1
  store i32 %minor, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 3
  store i32 0, i32* %3, align 4
  ret void
}

define noundef i32 @Version.bump(%struct.Version* noundef nonnull align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4
  %2 = add i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 3
  %4 = load i32, i32* %3, align 4
  ret i32 %4
}

define noundef nonnull align 8 i8* @Version.render(%struct.Version* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 2
  %1 = load i8*, i8** %0, align 8
  %2 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = call i8* @sts_str_from_i32(i32 %3)
  %5 = call i8* @sts_str_concat(i8* %1, i8* %4)
  %6 = call i8* @sts_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %7 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = call i8* @sts_str_from_i32(i32 %8)
  %10 = call i8* @sts_str_concat(i8* %6, i8* %9)
  %11 = call i8* @sts_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %12 = getelementptr inbounds %struct.Version, %struct.Version* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @sts_str_from_i32(i32 %13)
  %15 = call i8* @sts_str_concat(i8* %11, i8* %14)
  ret i8* %15
}

define noundef i32 @sts_main() #0 {
entry:
  %v.addr = alloca %struct.Version*, align 8
  %Version.obj = alloca %struct.Version, align 8
  %arena.mark = call i64 @sts_arena_mark()
  call void @Version.constructor(%struct.Version* %Version.obj, i32 1, i32 4)
  store %struct.Version* %Version.obj, %struct.Version** %v.addr, align 8
  %0 = load %struct.Version*, %struct.Version** %v.addr, align 8
  %1 = call i32 @Version.bump(%struct.Version* %0)
  %2 = load %struct.Version*, %struct.Version** %v.addr, align 8
  %3 = call i32 @Version.bump(%struct.Version* %2)
  %4 = load %struct.Version*, %struct.Version** %v.addr, align 8
  %5 = getelementptr inbounds %struct.Version, %struct.Version* %4, i32 0, i32 3
  store i32 9, i32* %5, align 4
  %6 = load %struct.Version*, %struct.Version** %v.addr, align 8
  %7 = call i8* @Version.render(%struct.Version* %6)
  call void @sts_print(i8* %7)
  %8 = load %struct.Version*, %struct.Version** %v.addr, align 8
  %9 = getelementptr inbounds %struct.Version, %struct.Version* %8, i32 0, i32 0
  %10 = load i32, i32* %9, align 4
  %11 = mul i32 %10, 100
  %12 = load %struct.Version*, %struct.Version** %v.addr, align 8
  %13 = getelementptr inbounds %struct.Version, %struct.Version* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  %15 = add i32 %11, %14
  %16 = call i8* @sts_str_from_i32(i32 %15)
  call void @sts_print(i8* %16)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
