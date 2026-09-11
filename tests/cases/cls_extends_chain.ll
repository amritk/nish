%struct.Stats = type { i8*, i32, i32 }
%struct.Entity = type { i8*, i32 }
%struct.Mob = type { i8*, i32, i32 }
%struct.Boss = type { i8*, i32, i32, i32 }
%struct.Minion = type { i8*, i32, i32 }
%struct.Ghost = type { i8*, i32, i32, i1 }
%struct.Wisp = type { i8*, i32, i32, i1, i32 }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"minion\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"slime\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"dragon\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @Entity.constructor(%struct.Entity* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Entity, %struct.Entity* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Entity, %struct.Entity* %this, i32 0, i32 0
  store i8* %name, i8** %1, align 8
  ret void
}

define internal noundef i32 @Entity.hit(%struct.Entity* noundef nonnull align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Entity, %struct.Entity* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Entity, %struct.Entity* %this, i32 0, i32 1
  %4 = load i32, i32* %3, align 4
  ret i32 %4
}

define internal noundef i32 @Mob.damage(%struct.Mob* noundef nonnull align 8 dereferenceable(16) nocapture %this, i32 noundef %amount) #0 {
entry:
  %0 = getelementptr inbounds %struct.Mob, %struct.Mob* %this, i32 0, i32 2
  %1 = load i32, i32* %0, align 4
  %2 = sub nsw i32 %1, %amount
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Mob, %struct.Mob* %this, i32 0, i32 2
  %4 = load i32, i32* %3, align 4
  ret i32 %4
}

define internal void @Boss.constructor(%struct.Boss* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name, i32 noundef %phase) #0 {
entry:
  %0 = bitcast %struct.Boss* %this to %struct.Mob*
  %1 = getelementptr inbounds %struct.Mob, %struct.Mob* %0, i32 0, i32 2
  store i32 10, i32* %1, align 4
  %2 = bitcast %struct.Mob* %0 to %struct.Entity*
  call void @Entity.constructor(%struct.Entity* %2, i8* %name)
  %3 = getelementptr inbounds %struct.Boss, %struct.Boss* %this, i32 0, i32 3
  store i32 %phase, i32* %3, align 4
  ret void
}

define internal noundef i32 @Boss.enrage(%struct.Boss* noundef nonnull align 8 dereferenceable(24) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Boss, %struct.Boss* %this, i32 0, i32 3
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = bitcast %struct.Boss* %this to %struct.Mob*
  %4 = call i32 @Mob.damage(%struct.Mob* %3, i32 0)
  %5 = getelementptr inbounds %struct.Boss, %struct.Boss* %this, i32 0, i32 3
  %6 = load i32, i32* %5, align 4
  %7 = add nsw i32 %4, %6
  ret i32 %7
}

define internal void @Minion.constructor(%struct.Minion* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = bitcast %struct.Minion* %this to %struct.Mob*
  %1 = getelementptr inbounds %struct.Mob, %struct.Mob* %0, i32 0, i32 2
  store i32 10, i32* %1, align 4
  %2 = bitcast %struct.Mob* %0 to %struct.Entity*
  call void @Entity.constructor(%struct.Entity* %2, i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  ret void
}

define internal void @Wisp.constructor(%struct.Wisp* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %speed) #0 {
entry:
  %0 = bitcast %struct.Wisp* %this to %struct.Ghost*
  %1 = getelementptr inbounds %struct.Ghost, %struct.Ghost* %0, i32 0, i32 3
  store i1 false, i1* %1, align 1
  %2 = bitcast %struct.Ghost* %0 to %struct.Minion*
  call void @Minion.constructor(%struct.Minion* %2)
  %3 = getelementptr inbounds %struct.Wisp, %struct.Wisp* %this, i32 0, i32 4
  store i32 %speed, i32* %3, align 4
  ret void
}

define internal noundef nonnull align 8 i8* @describe(%struct.Stats* noundef nonnull readonly align 8 dereferenceable(16) nocapture %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %3 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 1
  %4 = load i32, i32* %3, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* %2, i8* %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %8 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 2
  %9 = load i32, i32* %8, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %7, i8* %10)
  ret i8* %11
}

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Mob*, align 8
  %Mob.obj = alloca %struct.Mob, align 8
  %b.addr = alloca %struct.Boss*, align 8
  %Boss.obj = alloca %struct.Boss, align 8
  %g.addr = alloca %struct.Ghost*, align 8
  %Ghost.obj = alloca %struct.Ghost, align 8
  %w.addr = alloca %struct.Wisp*, align 8
  %Wisp.obj = alloca %struct.Wisp, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Mob, %struct.Mob* %Mob.obj, i32 0, i32 2
  store i32 10, i32* %0, align 4
  %1 = bitcast %struct.Mob* %Mob.obj to %struct.Entity*
  call void @Entity.constructor(%struct.Entity* %1, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  store %struct.Mob* %Mob.obj, %struct.Mob** %m.addr, align 8
  %2 = load %struct.Mob*, %struct.Mob** %m.addr, align 8
  %3 = bitcast %struct.Mob* %2 to %struct.Entity*
  %4 = call i32 @Entity.hit(%struct.Entity* %3)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load %struct.Mob*, %struct.Mob** %m.addr, align 8
  %7 = call i32 @Mob.damage(%struct.Mob* %6, i32 3)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load %struct.Mob*, %struct.Mob** %m.addr, align 8
  %10 = bitcast %struct.Mob* %9 to %struct.Stats*
  %11 = call i64 @nish_arena_mark()
  %12 = call i8* @describe(%struct.Stats* %10)
  %13 = call i8* @nish_arena_keep(i64 %11, i8* %12)
  call void @nish_print(i8* %13)
  call void @Boss.constructor(%struct.Boss* %Boss.obj, i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i32 1)
  store %struct.Boss* %Boss.obj, %struct.Boss** %b.addr, align 8
  %14 = load %struct.Boss*, %struct.Boss** %b.addr, align 8
  %15 = bitcast %struct.Boss* %14 to %struct.Entity*
  %16 = call i32 @Entity.hit(%struct.Entity* %15)
  %17 = load %struct.Boss*, %struct.Boss** %b.addr, align 8
  %18 = bitcast %struct.Boss* %17 to %struct.Entity*
  %19 = call i32 @Entity.hit(%struct.Entity* %18)
  %20 = load %struct.Boss*, %struct.Boss** %b.addr, align 8
  %21 = call i32 @Boss.enrage(%struct.Boss* %20)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  %23 = load %struct.Boss*, %struct.Boss** %b.addr, align 8
  %24 = bitcast %struct.Boss* %23 to %struct.Stats*
  %25 = call i64 @nish_arena_mark()
  %26 = call i8* @describe(%struct.Stats* %24)
  %27 = call i8* @nish_arena_keep(i64 %25, i8* %26)
  call void @nish_print(i8* %27)
  %28 = getelementptr inbounds %struct.Ghost, %struct.Ghost* %Ghost.obj, i32 0, i32 3
  store i1 false, i1* %28, align 1
  %29 = bitcast %struct.Ghost* %Ghost.obj to %struct.Minion*
  call void @Minion.constructor(%struct.Minion* %29)
  store %struct.Ghost* %Ghost.obj, %struct.Ghost** %g.addr, align 8
  %30 = load %struct.Ghost*, %struct.Ghost** %g.addr, align 8
  %31 = bitcast %struct.Ghost* %30 to %struct.Stats*
  %32 = call i64 @nish_arena_mark()
  %33 = call i8* @describe(%struct.Stats* %31)
  %34 = call i8* @nish_arena_keep(i64 %32, i8* %33)
  call void @nish_print(i8* %34)
  %35 = load %struct.Ghost*, %struct.Ghost** %g.addr, align 8
  %36 = getelementptr inbounds %struct.Ghost, %struct.Ghost* %35, i32 0, i32 3
  %37 = load i1, i1* %36, align 1
  br i1 %37, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %38 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %39 = call i8* @nish_str_from_i32(i32 %38)
  call void @nish_print(i8* %39)
  %40 = load %struct.Ghost*, %struct.Ghost** %g.addr, align 8
  %41 = bitcast %struct.Ghost* %40 to %struct.Entity*
  %42 = call i32 @Entity.hit(%struct.Entity* %41)
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  call void @Wisp.constructor(%struct.Wisp* %Wisp.obj, i32 9)
  store %struct.Wisp* %Wisp.obj, %struct.Wisp** %w.addr, align 8
  %44 = load %struct.Wisp*, %struct.Wisp** %w.addr, align 8
  %45 = bitcast %struct.Wisp* %44 to %struct.Stats*
  %46 = call i64 @nish_arena_mark()
  %47 = call i8* @describe(%struct.Stats* %45)
  %48 = call i8* @nish_arena_keep(i64 %46, i8* %47)
  call void @nish_print(i8* %48)
  %49 = load %struct.Wisp*, %struct.Wisp** %w.addr, align 8
  %50 = getelementptr inbounds %struct.Wisp, %struct.Wisp* %49, i32 0, i32 4
  %51 = load i32, i32* %50, align 4
  %52 = call i8* @nish_str_from_i32(i32 %51)
  call void @nish_print(i8* %52)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
