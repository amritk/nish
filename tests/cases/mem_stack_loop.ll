%struct.Vec = type { i32, i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noundef i64 @sts_arena_used() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare void @sts_panic_div(i1 noundef zeroext) #3

define void @Vec.constructor(%struct.Vec* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Vec, %struct.Vec* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Vec, %struct.Vec* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4
  ret void
}

define noundef i32 @Vec.dot(%struct.Vec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.Vec* noundef nonnull readonly align 8 dereferenceable(8) nocapture %o) #1 {
entry:
  %0 = getelementptr inbounds %struct.Vec, %struct.Vec* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = getelementptr inbounds %struct.Vec, %struct.Vec* %o, i32 0, i32 0
  %3 = load i32, i32* %2, align 4
  %4 = mul i32 %1, %3
  %5 = getelementptr inbounds %struct.Vec, %struct.Vec* %this, i32 0, i32 1
  %6 = load i32, i32* %5, align 4
  %7 = getelementptr inbounds %struct.Vec, %struct.Vec* %o, i32 0, i32 1
  %8 = load i32, i32* %7, align 4
  %9 = mul i32 %6, %8
  %10 = add i32 %4, %9
  ret i32 %10
}

define noundef i32 @accumulate(i32 noundef %n) #2 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %v.addr = alloca %struct.Vec*, align 8
  %Vec.obj = alloca %struct.Vec, align 8
  %w.addr = alloca %struct.Vec*, align 8
  %Vec.obj.1 = alloca %struct.Vec, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  call void @Vec.constructor(%struct.Vec* %Vec.obj, i32 %2, i32 1)
  store %struct.Vec* %Vec.obj, %struct.Vec** %v.addr, align 8
  %3 = load i32, i32* %i.addr, align 4
  call void @Vec.constructor(%struct.Vec* %Vec.obj.1, i32 1, i32 %3)
  store %struct.Vec* %Vec.obj.1, %struct.Vec** %w.addr, align 8
  %4 = load i32, i32* %total.addr, align 4
  %5 = load %struct.Vec*, %struct.Vec** %v.addr, align 8
  %6 = load %struct.Vec*, %struct.Vec** %w.addr, align 8
  %7 = call i32 @Vec.dot(%struct.Vec* %5, %struct.Vec* %6)
  %8 = icmp eq i32 7, 0
  %9 = icmp eq i32 %7, -2147483648
  %10 = icmp eq i32 7, -1
  %11 = and i1 %9, %10
  %12 = or i1 %8, %11
  br i1 %12, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %8)
  unreachable

div.ok:
  %13 = srem i32 %7, 7
  %14 = add i32 %4, %13
  store i32 %14, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %total.addr, align 4
  ret i32 %17
}

define noundef i32 @sts_main() #2 {
entry:
  %before.addr = alloca i64, align 8
  %total.addr = alloca i32, align 4
  %flat.addr = alloca i1, align 1
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i64 @sts_arena_used()
  store i64 %0, i64* %before.addr, align 8
  %1 = call i32 @accumulate(i32 100000)
  store i32 %1, i32* %total.addr, align 4
  %2 = call i64 @sts_arena_used()
  %3 = load i64, i64* %before.addr, align 8
  %4 = icmp eq i64 %2, %3
  store i1 %4, i1* %flat.addr, align 1
  %5 = load i32, i32* %total.addr, align 4
  %6 = call i8* @sts_str_from_i32(i32 %5)
  call void @sts_print(i8* %6)
  %7 = load i1, i1* %flat.addr, align 1
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %8)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }
