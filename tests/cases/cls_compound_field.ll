%struct.Stats = type { i32, i32, i32 }

declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare void @sts_panic_div(i1 noundef zeroext) #2

define void @Stats.constructor(%struct.Stats* noundef nonnull noalias align 8 dereferenceable(12) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 2
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  store i32 0, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 1
  store i32 8, i32* %2, align 4
  ret void
}

define noundef i32 @Stats.add(%struct.Stats* noundef nonnull align 8 dereferenceable(12) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 2
  %1 = load i32, i32* %0, align 4
  %2 = add i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = add i32 %4, %v
  store i32 %5, i32* %3, align 4
  %6 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  ret i32 %7
}

define void @halve(%struct.Stats* noundef nonnull align 8 dereferenceable(12) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 2, 0
  %3 = icmp eq i32 %1, -2147483648
  %4 = icmp eq i32 2, -1
  %5 = and i1 %3, %4
  %6 = or i1 %2, %5
  br i1 %6, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = sdiv i32 %1, 2
  store i32 %7, i32* %0, align 4
  %8 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  %10 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  %12 = icmp eq i32 2, 0
  %13 = icmp eq i32 %11, -2147483648
  %14 = icmp eq i32 2, -1
  %15 = and i1 %13, %14
  %16 = or i1 %12, %15
  br i1 %16, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @sts_panic_div(i1 zeroext %12)
  unreachable

div.ok.1:
  %17 = srem i32 %11, 2
  %18 = sub i32 %9, %17
  store i32 %18, i32* %8, align 4
  ret void
}

define noundef i32 @sts_main() #1 {
entry:
  %s.addr = alloca %struct.Stats*, align 8
  %Stats.obj = alloca %struct.Stats, align 8
  %arena.mark = call i64 @sts_arena_mark()
  call void @Stats.constructor(%struct.Stats* %Stats.obj)
  store %struct.Stats* %Stats.obj, %struct.Stats** %s.addr, align 8
  %0 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %1 = call i32 @Stats.add(%struct.Stats* %0, i32 5)
  %2 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %3 = call i32 @Stats.add(%struct.Stats* %2, i32 8)
  %4 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %5 = getelementptr inbounds %struct.Stats, %struct.Stats* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = mul i32 %6, 3
  store i32 %7, i32* %5, align 4
  %8 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  call void @halve(%struct.Stats* %8)
  %9 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %10 = getelementptr inbounds %struct.Stats, %struct.Stats* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4
  %12 = call i8* @sts_str_from_i32(i32 %11)
  call void @sts_print(i8* %12)
  %13 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %14 = getelementptr inbounds %struct.Stats, %struct.Stats* %13, i32 0, i32 2
  %15 = load i32, i32* %14, align 4
  %16 = call i8* @sts_str_from_i32(i32 %15)
  call void @sts_print(i8* %16)
  %17 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %18 = getelementptr inbounds %struct.Stats, %struct.Stats* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4
  %20 = call i8* @sts_str_from_i32(i32 %19)
  call void @sts_print(i8* %20)
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
attributes #2 = { nounwind noreturn cold }
