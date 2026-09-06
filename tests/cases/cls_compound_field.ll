%struct.Stats = type { i32, i32, i32 }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare void @sts_panic_div(i1 noundef zeroext) #3

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
  %0 = call i8* @sts_alloc_struct(i64 12)
  %1 = bitcast i8* %0 to %struct.Stats*
  call void @Stats.constructor(%struct.Stats* %1)
  store %struct.Stats* %1, %struct.Stats** %s.addr, align 8
  %2 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %3 = call i32 @Stats.add(%struct.Stats* %2, i32 5)
  %4 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %5 = call i32 @Stats.add(%struct.Stats* %4, i32 8)
  %6 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Stats, %struct.Stats* %6, i32 0, i32 0
  %8 = load i32, i32* %7, align 4
  %9 = mul i32 %8, 3
  store i32 %9, i32* %7, align 4
  %10 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  call void @halve(%struct.Stats* %10)
  %11 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %12 = getelementptr inbounds %struct.Stats, %struct.Stats* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  %15 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %16 = getelementptr inbounds %struct.Stats, %struct.Stats* %15, i32 0, i32 2
  %17 = load i32, i32* %16, align 4
  %18 = call i8* @sts_str_from_i32(i32 %17)
  call void @sts_print(i8* %18)
  %19 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %20 = getelementptr inbounds %struct.Stats, %struct.Stats* %19, i32 0, i32 1
  %21 = load i32, i32* %20, align 4
  %22 = call i8* @sts_str_from_i32(i32 %21)
  call void @sts_print(i8* %22)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }
