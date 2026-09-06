%struct.Defaults = type { i32, i32, i1, i8* }
%struct.Mixed = type { i32, i32, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mixed\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"big\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"anon\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define void @Mixed.constructor(%struct.Mixed* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %limit) #0 {
entry:
  %0 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %1, align 8
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 1
  store i32 %limit, i32* %2, align 4
  %3 = icmp sgt i32 %limit, 100
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %4, align 8
  br label %if.end

if.end:
  ret void
}

define noundef i32 @sts_main() #0 {
entry:
  %d.addr = alloca %struct.Defaults*, align 8
  %Defaults.obj = alloca %struct.Defaults, align 8
  %m.addr = alloca %struct.Mixed*, align 8
  %Mixed.obj = alloca %struct.Mixed, align 8
  %Mixed.obj.1 = alloca %struct.Mixed, align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 0
  store i32 42, i32* %0, align 4
  %1 = sub i32 0, 1
  %2 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 1
  store i32 %1, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 2
  store i1 true, i1* %3, align 1
  %4 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %4, align 8
  store %struct.Defaults* %Defaults.obj, %struct.Defaults** %d.addr, align 8
  %5 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %6 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %9 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  %11 = add i32 %7, %10
  %12 = call i8* @sts_str_from_i32(i32 %11)
  call void @sts_print(i8* %12)
  %13 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %14 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %13, i32 0, i32 2
  %15 = load i1, i1* %14, align 1
  %16 = select i1 %15, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @sts_print(i8* %16)
  %17 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %18 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %17, i32 0, i32 3
  %19 = load i8*, i8** %18, align 8
  call void @sts_print(i8* %19)
  call void @Mixed.constructor(%struct.Mixed* %Mixed.obj, i32 500)
  store %struct.Mixed* %Mixed.obj, %struct.Mixed** %m.addr, align 8
  %20 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %21 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4
  %23 = call i8* @sts_str_from_i32(i32 %22)
  call void @sts_print(i8* %23)
  %24 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %25 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %24, i32 0, i32 1
  %26 = load i32, i32* %25, align 4
  %27 = call i8* @sts_str_from_i32(i32 %26)
  call void @sts_print(i8* %27)
  %28 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %29 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %28, i32 0, i32 2
  %30 = load i8*, i8** %29, align 8
  call void @sts_print(i8* %30)
  call void @Mixed.constructor(%struct.Mixed* %Mixed.obj.1, i32 1)
  %31 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %Mixed.obj.1, i32 0, i32 2
  %32 = load i8*, i8** %31, align 8
  call void @sts_print(i8* %32)
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
