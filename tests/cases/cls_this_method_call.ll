%struct.Account = type { i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #3
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

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

define noundef i32 @sts_main() #0 {
entry:
  %a.addr = alloca %struct.Account*, align 8
  %0 = call i8* @sts_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Account*
  call void @Account.constructor(%struct.Account* %1, i32 100, i32 1)
  store %struct.Account* %1, %struct.Account** %a.addr, align 8
  %2 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %3 = call i1 @Account.withdraw(%struct.Account* %2, i32 30)
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %4)
  %5 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %6 = getelementptr inbounds %struct.Account, %struct.Account* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = call i8* @sts_str_from_i32(i32 %7)
  call void @sts_print(i8* %8)
  %9 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %10 = call i32 @Account.drain(%struct.Account* %9, i32 20)
  %11 = call i8* @sts_str_from_i32(i32 %10)
  call void @sts_print(i8* %11)
  %12 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %13 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %14 = call i1 @Account.same(%struct.Account* %12, %struct.Account* %13)
  %15 = select i1 %14, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %15)
  %16 = load %struct.Account*, %struct.Account** %a.addr, align 8
  %17 = call i8* @sts_alloc_struct(i64 8)
  %18 = bitcast i8* %17 to %struct.Account*
  call void @Account.constructor(%struct.Account* %18, i32 1, i32 1)
  %19 = call i1 @Account.same(%struct.Account* %16, %struct.Account* %18)
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %20)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
