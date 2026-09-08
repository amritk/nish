%struct.amrit_array = type { i64, i64, i8* }

declare void @amrit_free_arena() #1
declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #1
declare void @amrit_array_grow(%struct.amrit_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @amrit_main() #0 {
entry:
  %xs.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %i.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8
  %2 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 10
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = mul i32 %6, %7
  %9 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 0
  %10 = load i64, i64* %9, align 8
  %11 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 1
  %12 = load i64, i64* %11, align 8
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @amrit_array_grow(%struct.amrit_array* %5, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %23 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %22, i64 0, i32 1
  %26 = load i64, i64* %25, align 8
  %27 = icmp eq i64 %24, %26
  br i1 %27, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @amrit_array_grow(%struct.amrit_array* %22, i64 4)
  br label %push.store.1

push.store.1:
  %28 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %22, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 %24
  store i32 100, i32* %31, align 4
  %32 = add i64 %24, 1
  store i64 %32, i64* %23, align 8
  %33 = trunc i64 %32 to i32
  store i32 %33, i32* %n.addr, align 4
  %34 = load i32, i32* %n.addr, align 4
  %35 = call i8* @amrit_str_from_i32(i32 %34)
  call void @amrit_print(i8* %35)
  %36 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %37 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8
  %39 = trunc i64 %38 to i32
  %40 = call i8* @amrit_str_from_i32(i32 %39)
  call void @amrit_print(i8* %40)
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %41 = load i32, i32* %i.addr.1, align 4
  %42 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %43 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %42, i64 0, i32 0
  %44 = load i64, i64* %43, align 8
  %45 = trunc i64 %44 to i32
  %46 = icmp slt i32 %41, %45
  br i1 %46, label %for.body.1, label %for.end.1

for.body.1:
  %47 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %48 = load i32, i32* %i.addr.1, align 4
  %49 = sext i32 %48 to i64
  %50 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %47, i64 0, i32 0
  %51 = load i64, i64* %50, align 8
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %49, i64 %51)
  unreachable

bounds.ok:
  %53 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %47, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8
  %55 = bitcast i8* %54 to i32*
  %56 = getelementptr inbounds i32, i32* %55, i64 %49
  %57 = load i32, i32* %56, align 4
  %58 = call i8* @amrit_str_from_i32(i32 %57)
  call void @amrit_print(i8* %58)
  br label %for.inc.1

for.inc.1:
  %59 = load i32, i32* %i.addr.1, align 4
  %60 = add i32 %59, 1
  store i32 %60, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
