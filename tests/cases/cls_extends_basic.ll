%struct.Animal = type { i32, i8* }
%struct.Dog = type { i32, i8*, i32 }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" legs\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"rex\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @amrit_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

define internal void @Animal.constructor(%struct.Animal* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %legs, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 0
  store i32 %legs, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 1
  store i8* %name, i8** %1, align 8
  ret void
}

define internal noundef nonnull align 8 i8* @Animal.describe(%struct.Animal* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 1
  %1 = load i8*, i8** %0, align 8
  %2 = call i8* @amrit_str_concat(i8* %1, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %3 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = call i8* @amrit_str_from_i32(i32 %4)
  %6 = call i8* @amrit_str_concat(i8* %2, i8* %5)
  %7 = call i8* @amrit_str_concat(i8* %6, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  ret i8* %7
}

define internal void @Dog.constructor(%struct.Dog* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Dog, %struct.Dog* %this, i32 0, i32 2
  store i32 0, i32* %0, align 4
  %1 = bitcast %struct.Dog* %this to %struct.Animal*
  call void @Animal.constructor(%struct.Animal* %1, i32 4, i8* %name)
  ret void
}

define internal noundef i32 @Dog.learn(%struct.Dog* noundef nonnull align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Dog, %struct.Dog* %this, i32 0, i32 2
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Dog, %struct.Dog* %this, i32 0, i32 2
  %4 = load i32, i32* %3, align 4
  ret i32 %4
}

define noundef i32 @amrit_main() #0 {
entry:
  %d.addr = alloca %struct.Dog*, align 8
  %Dog.obj = alloca %struct.Dog, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  call void @Dog.constructor(%struct.Dog* %Dog.obj, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  store %struct.Dog* %Dog.obj, %struct.Dog** %d.addr, align 8
  %0 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %1 = bitcast %struct.Dog* %0 to %struct.Animal*
  %2 = call i64 @amrit_arena_mark()
  %3 = call i8* @Animal.describe(%struct.Animal* %1)
  %4 = call i8* @amrit_arena_keep(i64 %2, i8* %3)
  call void @amrit_print(i8* %4)
  %5 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %6 = call i32 @Dog.learn(%struct.Dog* %5)
  %7 = call i8* @amrit_str_from_i32(i32 %6)
  call void @amrit_print(i8* %7)
  %8 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %9 = call i32 @Dog.learn(%struct.Dog* %8)
  %10 = call i8* @amrit_str_from_i32(i32 %9)
  call void @amrit_print(i8* %10)
  %11 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %12 = getelementptr inbounds %struct.Dog, %struct.Dog* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @amrit_str_from_i32(i32 %13)
  call void @amrit_print(i8* %14)
  %15 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %16 = getelementptr inbounds %struct.Dog, %struct.Dog* %15, i32 0, i32 0
  store i32 3, i32* %16, align 4
  %17 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %18 = bitcast %struct.Dog* %17 to %struct.Animal*
  %19 = call i64 @amrit_arena_mark()
  %20 = call i8* @Animal.describe(%struct.Animal* %18)
  %21 = call i8* @amrit_arena_keep(i64 %19, i8* %20)
  call void @amrit_print(i8* %21)
  %22 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %23 = getelementptr inbounds %struct.Dog, %struct.Dog* %22, i32 0, i32 2
  %24 = load i32, i32* %23, align 4
  %25 = call i8* @amrit_str_from_i32(i32 %24)
  call void @amrit_print(i8* %25)
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
