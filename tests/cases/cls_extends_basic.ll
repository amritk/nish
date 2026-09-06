%struct.Animal = type { i32, i8* }
%struct.Dog = type { i32, i8*, i32 }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" legs\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"rex\00" }, align 8

declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define void @Animal.constructor(%struct.Animal* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %legs, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 0
  store i32 %legs, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 1
  store i8* %name, i8** %1, align 8
  ret void
}

define noundef nonnull align 8 i8* @Animal.describe(%struct.Animal* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 1
  %1 = load i8*, i8** %0, align 8
  %2 = call i8* @sts_str_concat(i8* %1, i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  %3 = getelementptr inbounds %struct.Animal, %struct.Animal* %this, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = call i8* @sts_str_from_i32(i32 %4)
  %6 = call i8* @sts_str_concat(i8* %2, i8* %5)
  %7 = call i8* @sts_str_concat(i8* %6, i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*))
  ret i8* %7
}

define void @Dog.constructor(%struct.Dog* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Dog, %struct.Dog* %this, i32 0, i32 2
  store i32 0, i32* %0, align 4
  %1 = bitcast %struct.Dog* %this to %struct.Animal*
  call void @Animal.constructor(%struct.Animal* %1, i32 4, i8* %name)
  ret void
}

define noundef i32 @Dog.learn(%struct.Dog* noundef nonnull align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Dog, %struct.Dog* %this, i32 0, i32 2
  %1 = load i32, i32* %0, align 4
  %2 = add i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Dog, %struct.Dog* %this, i32 0, i32 2
  %4 = load i32, i32* %3, align 4
  ret i32 %4
}

define noundef i32 @sts_main() #0 {
entry:
  %d.addr = alloca %struct.Dog*, align 8
  %Dog.obj = alloca %struct.Dog, align 8
  %arena.mark = call i64 @sts_arena_mark()
  call void @Dog.constructor(%struct.Dog* %Dog.obj, i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  store %struct.Dog* %Dog.obj, %struct.Dog** %d.addr, align 8
  %0 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %1 = bitcast %struct.Dog* %0 to %struct.Animal*
  %2 = call i8* @Animal.describe(%struct.Animal* %1)
  call void @sts_print(i8* %2)
  %3 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %4 = call i32 @Dog.learn(%struct.Dog* %3)
  %5 = call i8* @sts_str_from_i32(i32 %4)
  call void @sts_print(i8* %5)
  %6 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %7 = call i32 @Dog.learn(%struct.Dog* %6)
  %8 = call i8* @sts_str_from_i32(i32 %7)
  call void @sts_print(i8* %8)
  %9 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %10 = getelementptr inbounds %struct.Dog, %struct.Dog* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  %12 = call i8* @sts_str_from_i32(i32 %11)
  call void @sts_print(i8* %12)
  %13 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %14 = getelementptr inbounds %struct.Dog, %struct.Dog* %13, i32 0, i32 0
  store i32 3, i32* %14, align 4
  %15 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %16 = bitcast %struct.Dog* %15 to %struct.Animal*
  %17 = call i8* @Animal.describe(%struct.Animal* %16)
  call void @sts_print(i8* %17)
  %18 = load %struct.Dog*, %struct.Dog** %d.addr, align 8
  %19 = getelementptr inbounds %struct.Dog, %struct.Dog* %18, i32 0, i32 2
  %20 = load i32, i32* %19, align 4
  %21 = call i8* @sts_str_from_i32(i32 %20)
  call void @sts_print(i8* %21)
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
