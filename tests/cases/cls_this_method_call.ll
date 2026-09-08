%struct.Account = type { i32, i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

define void @Account.constructor(%struct.Account* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %balance, i32 noundef %fee) #0 {
entry:
  %0 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 0
  store i32 %balance, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 1
  store i32 %fee, i32* %1, align 4
  ret void
}

define void @Account.charge(%struct.Account* noundef nonnull align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = sub i32 %1, %3
  store i32 %4, i32* %0, align 4
  ret void
}

define noundef zeroext i1 @Account.withdraw(%struct.Account* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %amount) #0 {
entry:
  %0 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp sgt i32 %amount, %1
  br i1 %2, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %3 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = sub i32 %4, %amount
  store i32 %5, i32* %3, align 4
  call void @Account.charge(%struct.Account* %this)
  ret i1 true
}

define noundef i32 @Account.drain(%struct.Account* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %step) #0 {
entry:
  %0 = call i1 @Account.withdraw(%struct.Account* %this, i32 %step)
  %1 = xor i1 %0, true
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.Account, %struct.Account* %this, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  ret i32 %3

if.end:
  %4 = call i32 @Account.drain(%struct.Account* %this, i32 %step)
  ret i32 %4
}

define noundef zeroext i1 @Account.same(%struct.Account* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.Account* noundef nonnull readonly align 8 dereferenceable(8) nocapture %other) #1 {
entry:
  %0 = icmp eq %struct.Account* %this, %other
  ret i1 %0
}

define noundef i32 @amrit_main() #0 {
entry:
  %a.addr = alloca %struct.Account*, align 8
  %Account.obj = alloca %struct.Account, align 8
  %Account.obj.1 = alloca %struct.Account, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  call void @Account.constructor(%struct.Account* %Account.obj, i32 100, i32 1)
  store %struct.Account* %Account.obj, %struct.Account** %a.addr, align 8
  %0 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %1 = call i1 @Account.withdraw(%struct.Account* %0, i32 30)
  %2 = select i1 %1, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @amrit_print(i8* %2)
  %3 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %4 = getelementptr inbounds %struct.Account, %struct.Account* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = call i8* @amrit_str_from_i32(i32 %5)
  call void @amrit_print(i8* %6)
  %7 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %8 = call i32 @Account.drain(%struct.Account* %7, i32 20)
  %9 = call i8* @amrit_str_from_i32(i32 %8)
  call void @amrit_print(i8* %9)
  %10 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %11 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %12 = call i1 @Account.same(%struct.Account* %10, %struct.Account* %11)
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @amrit_print(i8* %13)
  %14 = load %struct.Account*, %struct.Account** %a.addr, align 8
  call void @Account.constructor(%struct.Account* %Account.obj.1, i32 1, i32 1)
  %15 = call i1 @Account.same(%struct.Account* %14, %struct.Account* %Account.obj.1)
  %16 = select i1 %15, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @amrit_print(i8* %16)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
