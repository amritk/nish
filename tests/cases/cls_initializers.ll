%struct.Defaults = type { i32, i32, i1, i8* }
%struct.Mixed = type { i32, i32, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mixed\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"big\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"anon\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

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

define noundef i32 @amrit_main() #0 {
entry:
  %d.addr = alloca %struct.Defaults*, align 8
  %Defaults.obj = alloca %struct.Defaults, align 8
  %m.addr = alloca %struct.Mixed*, align 8
  %Mixed.obj = alloca %struct.Mixed, align 8
  %Mixed.obj.1 = alloca %struct.Mixed, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 0
  store i32 42, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 1
  store i32 -1, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 2
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %Defaults.obj, i32 0, i32 3
  store i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8** %3, align 8
  store %struct.Defaults* %Defaults.obj, %struct.Defaults** %d.addr, align 8
  %4 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %5 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %8 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %7, i32 0, i32 1
  %9 = load i32, i32* %8, align 4
  %10 = add i32 %6, %9
  %11 = call i8* @amrit_str_from_i32(i32 %10)
  call void @amrit_print(i8* %11)
  %12 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %13 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %12, i32 0, i32 2
  %14 = load i1, i1* %13, align 1
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  call void @amrit_print(i8* %15)
  %16 = load %struct.Defaults*, %struct.Defaults** %d.addr, align 8
  %17 = getelementptr inbounds %struct.Defaults, %struct.Defaults* %16, i32 0, i32 3
  %18 = load i8*, i8** %17, align 8
  call void @amrit_print(i8* %18)
  call void @Mixed.constructor(%struct.Mixed* %Mixed.obj, i32 500)
  store %struct.Mixed* %Mixed.obj, %struct.Mixed** %m.addr, align 8
  %19 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %20 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4
  %22 = call i8* @amrit_str_from_i32(i32 %21)
  call void @amrit_print(i8* %22)
  %23 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %24 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %23, i32 0, i32 1
  %25 = load i32, i32* %24, align 4
  %26 = call i8* @amrit_str_from_i32(i32 %25)
  call void @amrit_print(i8* %26)
  %27 = load %struct.Mixed*, %struct.Mixed** %m.addr, align 8
  %28 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %27, i32 0, i32 2
  %29 = load i8*, i8** %28, align 8
  call void @amrit_print(i8* %29)
  call void @Mixed.constructor(%struct.Mixed* %Mixed.obj.1, i32 1)
  %30 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %Mixed.obj.1, i32 0, i32 2
  %31 = load i8*, i8** %30, align 8
  call void @amrit_print(i8* %31)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
