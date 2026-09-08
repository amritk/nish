%struct.amrit_result.void.i32 = type { i1, i32 }
%struct.amrit_result.i32.i32 = type { i1, i32, i32 }

@.str.0 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"443 is a port\00" }, align 8

declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0
declare void @amrit_exit(i32 noundef) #2
declare void @amrit_panic_div(i1 noundef zeroext) #3

define internal noundef i64 @checkPort(i32 noundef %port) #0 {
entry:
  %0 = icmp sle i32 %port, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = zext i32 %port to i64
  %2 = shl i64 %1, 32
  ret i64 %2

if.end:
  ret i64 1
}

define internal noundef i64 @firstHalf(i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @amrit_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = zext i32 %n to i64
  %8 = shl i64 %7, 32
  ret i64 %8

if.end:
  %9 = icmp eq i32 2, 0
  %10 = icmp eq i32 %n, -2147483648
  %11 = icmp eq i32 2, -1
  %12 = and i1 %10, %11
  %13 = or i1 %9, %12
  br i1 %13, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @amrit_panic_div(i1 zeroext %9)
  unreachable

div.ok.1:
  %14 = sdiv i32 %n, 2
  %15 = zext i32 %14 to i64
  %16 = shl i64 %15, 32
  %17 = or i64 %16, 1
  ret i64 %17
}

define internal noundef i64 @quarter(i32 noundef %n) #1 {
entry:
  %h.addr = alloca i32, align 4
  %amrit_result.i32.i32.obj = alloca %struct.amrit_result.i32.i32, align 8
  %amrit_result.i32.i32.obj.1 = alloca %struct.amrit_result.i32.i32, align 8
  %0 = call i64 @firstHalf(i32 %n)
  %1 = trunc i64 %0 to i1
  %2 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = lshr i64 %0, 32
  %4 = trunc i64 %3 to i32
  %5 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  store i32 %4, i32* %5, align 4
  %6 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %6, align 4
  %7 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.propagate

res.propagate:
  %9 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = zext i32 %10 to i64
  %12 = shl i64 %11, 32
  ret i64 %12

res.ok:
  %13 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = call i64 @firstHalf(i32 %15)
  %17 = trunc i64 %16 to i1
  %18 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %17, i1* %18, align 1
  %19 = lshr i64 %16, 32
  %20 = trunc i64 %19 to i32
  %21 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %20, i32* %21, align 4
  %22 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %20, i32* %22, align 4
  %23 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 0
  %24 = load i1, i1* %23, align 1
  %25 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 2
  %26 = load i32, i32* %25, align 4
  %27 = zext i32 %26 to i64
  %28 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 1
  %29 = load i32, i32* %28, align 4
  %30 = zext i32 %29 to i64
  %31 = select i1 %24, i64 %30, i64 %27
  %32 = shl i64 %31, 32
  %33 = zext i1 %24 to i64
  %34 = or i64 %32, %33
  ret i64 %34
}

define internal noundef i64 @again(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.amrit_result.i32.i32*, align 8
  %amrit_result.i32.i32.obj = alloca %struct.amrit_result.i32.i32, align 8
  %0 = call i64 @firstHalf(i32 %n)
  %1 = trunc i64 %0 to i1
  %2 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = lshr i64 %0, 32
  %4 = trunc i64 %3 to i32
  %5 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  store i32 %4, i32* %5, align 4
  %6 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %6, align 4
  store %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, %struct.amrit_result.i32.i32** %r.addr, align 8
  %7 = load %struct.amrit_result.i32.i32*, %struct.amrit_result.i32.i32** %r.addr, align 8
  %8 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  %10 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %7, i32 0, i32 2
  %11 = load i32, i32* %10, align 4
  %12 = zext i32 %11 to i64
  %13 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %7, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  %15 = zext i32 %14 to i64
  %16 = select i1 %9, i64 %15, i64 %12
  %17 = shl i64 %16, 32
  %18 = zext i1 %9 to i64
  %19 = or i64 %17, %18
  ret i64 %19
}

define noundef i32 @amrit_main() #1 {
entry:
  %bad.addr = alloca %struct.amrit_result.void.i32*, align 8
  %amrit_result.void.i32.obj = alloca %struct.amrit_result.void.i32, align 8
  %amrit_result.void.i32.obj.1 = alloca %struct.amrit_result.void.i32, align 8
  %amrit_result.i32.i32.obj = alloca %struct.amrit_result.i32.i32, align 8
  %amrit_result.i32.i32.obj.1 = alloca %struct.amrit_result.i32.i32, align 8
  %amrit_result.i32.i32.obj.2 = alloca %struct.amrit_result.i32.i32, align 8
  %amrit_result.i32.i32.obj.3 = alloca %struct.amrit_result.i32.i32, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i64 @checkPort(i32 0)
  %1 = trunc i64 %0 to i1
  %2 = getelementptr inbounds %struct.amrit_result.void.i32, %struct.amrit_result.void.i32* %amrit_result.void.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = lshr i64 %0, 32
  %4 = trunc i64 %3 to i32
  %5 = getelementptr inbounds %struct.amrit_result.void.i32, %struct.amrit_result.void.i32* %amrit_result.void.i32.obj, i32 0, i32 1
  store i32 %4, i32* %5, align 4
  store %struct.amrit_result.void.i32* %amrit_result.void.i32.obj, %struct.amrit_result.void.i32** %bad.addr, align 8
  %6 = load %struct.amrit_result.void.i32*, %struct.amrit_result.void.i32** %bad.addr, align 8
  %7 = getelementptr inbounds %struct.amrit_result.void.i32, %struct.amrit_result.void.i32* %6, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  %9 = xor i1 %8, true
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load %struct.amrit_result.void.i32*, %struct.amrit_result.void.i32** %bad.addr, align 8
  %11 = getelementptr inbounds %struct.amrit_result.void.i32, %struct.amrit_result.void.i32* %10, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = call i8* @amrit_str_from_i32(i32 %12)
  call void @amrit_print(i8* %13)
  br label %if.end

if.end:
  %14 = call i64 @checkPort(i32 443)
  %15 = trunc i64 %14 to i1
  %16 = getelementptr inbounds %struct.amrit_result.void.i32, %struct.amrit_result.void.i32* %amrit_result.void.i32.obj.1, i32 0, i32 0
  store i1 %15, i1* %16, align 1
  %17 = lshr i64 %14, 32
  %18 = trunc i64 %17 to i32
  %19 = getelementptr inbounds %struct.amrit_result.void.i32, %struct.amrit_result.void.i32* %amrit_result.void.i32.obj.1, i32 0, i32 1
  store i32 %18, i32* %19, align 4
  %20 = getelementptr inbounds %struct.amrit_result.void.i32, %struct.amrit_result.void.i32* %amrit_result.void.i32.obj.1, i32 0, i32 0
  %21 = load i1, i1* %20, align 1
  br i1 %21, label %res.ok, label %res.panic

res.panic:
  call void @amrit_write(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @amrit_exit(i32 1)
  unreachable

res.ok:
  %22 = call i64 @quarter(i32 8)
  %23 = trunc i64 %22 to i1
  %24 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  store i1 %23, i1* %24, align 1
  %25 = lshr i64 %22, 32
  %26 = trunc i64 %25 to i32
  %27 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  store i32 %26, i32* %27, align 4
  %28 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  store i32 %26, i32* %28, align 4
  %29 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  %30 = load i1, i1* %29, align 1
  br i1 %30, label %res.ok.1, label %res.alt

res.ok.1:
  %31 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  %32 = load i32, i32* %31, align 4
  br label %res.end

res.alt:
  %33 = sub nsw i32 0, 1
  br label %res.end

res.end:
  %34 = phi i32 [ %32, %res.ok.1 ], [ %33, %res.alt ]
  %35 = call i8* @amrit_str_from_i32(i32 %34)
  call void @amrit_print(i8* %35)
  %36 = call i64 @quarter(i32 6)
  %37 = trunc i64 %36 to i1
  %38 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %37, i1* %38, align 1
  %39 = lshr i64 %36, 32
  %40 = trunc i64 %39 to i32
  %41 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %40, i32* %41, align 4
  %42 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %40, i32* %42, align 4
  %43 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 0
  %44 = load i1, i1* %43, align 1
  br i1 %44, label %res.ok.2, label %res.alt.1

res.ok.2:
  %45 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.1, i32 0, i32 1
  %46 = load i32, i32* %45, align 4
  br label %res.end.1

res.alt.1:
  %47 = sub nsw i32 0, 1
  br label %res.end.1

res.end.1:
  %48 = phi i32 [ %46, %res.ok.2 ], [ %47, %res.alt.1 ]
  %49 = call i8* @amrit_str_from_i32(i32 %48)
  call void @amrit_print(i8* %49)
  %50 = call i64 @again(i32 10)
  %51 = trunc i64 %50 to i1
  %52 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %51, i1* %52, align 1
  %53 = lshr i64 %50, 32
  %54 = trunc i64 %53 to i32
  %55 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %54, i32* %55, align 4
  %56 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %54, i32* %56, align 4
  %57 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.2, i32 0, i32 0
  %58 = load i1, i1* %57, align 1
  br i1 %58, label %res.ok.3, label %res.alt.2

res.ok.3:
  %59 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.2, i32 0, i32 1
  %60 = load i32, i32* %59, align 4
  br label %res.end.2

res.alt.2:
  %61 = sub nsw i32 0, 1
  br label %res.end.2

res.end.2:
  %62 = phi i32 [ %60, %res.ok.3 ], [ %61, %res.alt.2 ]
  %63 = call i8* @amrit_str_from_i32(i32 %62)
  call void @amrit_print(i8* %63)
  %64 = call i64 @again(i32 11)
  %65 = trunc i64 %64 to i1
  %66 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %65, i1* %66, align 1
  %67 = lshr i64 %64, 32
  %68 = trunc i64 %67 to i32
  %69 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %68, i32* %69, align 4
  %70 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %68, i32* %70, align 4
  %71 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.3, i32 0, i32 0
  %72 = load i1, i1* %71, align 1
  br i1 %72, label %res.ok.4, label %res.alt.3

res.ok.4:
  %73 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj.3, i32 0, i32 1
  %74 = load i32, i32* %73, align 4
  br label %res.end.3

res.alt.3:
  %75 = sub nsw i32 0, 1
  br label %res.end.3

res.end.3:
  %76 = phi i32 [ %74, %res.ok.4 ], [ %75, %res.alt.3 ]
  %77 = call i8* @amrit_str_from_i32(i32 %76)
  call void @amrit_print(i8* %77)
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
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind noreturn cold }
