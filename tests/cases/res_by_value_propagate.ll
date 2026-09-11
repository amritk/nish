%struct.nish_result.void.i32 = type { i1, i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }

@.str.0 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"443 is a port\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_exit(i32 noundef) #2
declare void @nish_panic_div(i1 noundef zeroext) #3

define internal noundef { i1, i32 } @checkPort(i32 noundef %port) #0 {
entry:
  %0 = icmp sle i32 %port, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = zext i32 %port to i64
  %2 = shl i64 %1, 32
  %3 = trunc i64 %2 to i1
  %4 = lshr i64 %2, 32
  %5 = trunc i64 %4 to i32
  %6 = insertvalue { i1, i32 } undef, i1 %3, 0
  %7 = insertvalue { i1, i32 } %6, i32 %5, 1
  ret { i1, i32 } %7

if.end:
  %8 = trunc i64 1 to i1
  %9 = lshr i64 1, 32
  %10 = trunc i64 %9 to i32
  %11 = insertvalue { i1, i32 } undef, i1 %8, 0
  %12 = insertvalue { i1, i32 } %11, i32 %10, 1
  ret { i1, i32 } %12
}

define internal noundef { i1, i32 } @firstHalf(i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = zext i32 %n to i64
  %8 = shl i64 %7, 32
  %9 = trunc i64 %8 to i1
  %10 = lshr i64 %8, 32
  %11 = trunc i64 %10 to i32
  %12 = insertvalue { i1, i32 } undef, i1 %9, 0
  %13 = insertvalue { i1, i32 } %12, i32 %11, 1
  ret { i1, i32 } %13

if.end:
  %14 = icmp eq i32 2, 0
  %15 = icmp eq i32 %n, -2147483648
  %16 = icmp eq i32 2, -1
  %17 = and i1 %15, %16
  %18 = or i1 %14, %17
  br i1 %18, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %14)
  unreachable

div.ok.1:
  %19 = sdiv i32 %n, 2
  %20 = zext i32 %19 to i64
  %21 = shl i64 %20, 32
  %22 = or i64 %21, 1
  %23 = trunc i64 %22 to i1
  %24 = lshr i64 %22, 32
  %25 = trunc i64 %24 to i32
  %26 = insertvalue { i1, i32 } undef, i1 %23, 0
  %27 = insertvalue { i1, i32 } %26, i32 %25, 1
  ret { i1, i32 } %27
}

define internal noundef { i1, i32 } @quarter(i32 noundef %n) #1 {
entry:
  %h.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32 } @firstHalf(i32 %n)
  %1 = extractvalue { i1, i32 } %0, 0
  %2 = extractvalue { i1, i32 } %0, 1
  %3 = zext i32 %2 to i64
  %4 = shl i64 %3, 32
  %5 = zext i1 %1 to i64
  %6 = or i64 %4, %5
  %7 = trunc i64 %6 to i1
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %7, i1* %8, align 1
  %9 = lshr i64 %6, 32
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %10, i32* %12, align 4
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %14 = load i1, i1* %13, align 1
  br i1 %14, label %res.ok, label %res.propagate

res.propagate:
  %15 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %16 = load i32, i32* %15, align 4
  %17 = zext i32 %16 to i64
  %18 = shl i64 %17, 32
  %19 = trunc i64 %18 to i1
  %20 = lshr i64 %18, 32
  %21 = trunc i64 %20 to i32
  %22 = insertvalue { i1, i32 } undef, i1 %19, 0
  %23 = insertvalue { i1, i32 } %22, i32 %21, 1
  ret { i1, i32 } %23

res.ok:
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %25 = load i32, i32* %24, align 4
  store i32 %25, i32* %h.addr, align 4
  %26 = load i32, i32* %h.addr, align 4
  %27 = call { i1, i32 } @firstHalf(i32 %26)
  %28 = extractvalue { i1, i32 } %27, 0
  %29 = extractvalue { i1, i32 } %27, 1
  %30 = zext i32 %29 to i64
  %31 = shl i64 %30, 32
  %32 = zext i1 %28 to i64
  %33 = or i64 %31, %32
  %34 = trunc i64 %33 to i1
  %35 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %34, i1* %35, align 1
  %36 = lshr i64 %33, 32
  %37 = trunc i64 %36 to i32
  %38 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %37, i32* %38, align 4
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %37, i32* %39, align 4
  %40 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %41 = load i1, i1* %40, align 1
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  %43 = load i32, i32* %42, align 4
  %44 = zext i32 %43 to i64
  %45 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %46 = load i32, i32* %45, align 4
  %47 = zext i32 %46 to i64
  %48 = select i1 %41, i64 %47, i64 %44
  %49 = shl i64 %48, 32
  %50 = zext i1 %41 to i64
  %51 = or i64 %49, %50
  %52 = trunc i64 %51 to i1
  %53 = lshr i64 %51, 32
  %54 = trunc i64 %53 to i32
  %55 = insertvalue { i1, i32 } undef, i1 %52, 0
  %56 = insertvalue { i1, i32 } %55, i32 %54, 1
  ret { i1, i32 } %56
}

define internal noundef { i1, i32 } @again(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32 } @firstHalf(i32 %n)
  %1 = extractvalue { i1, i32 } %0, 0
  %2 = extractvalue { i1, i32 } %0, 1
  %3 = zext i32 %2 to i64
  %4 = shl i64 %3, 32
  %5 = zext i1 %1 to i64
  %6 = or i64 %4, %5
  %7 = trunc i64 %6 to i1
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %7, i1* %8, align 1
  %9 = lshr i64 %6, 32
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %10, i32* %12, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %r.addr, align 8
  %13 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %13, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %13, i32 0, i32 2
  %17 = load i32, i32* %16, align 4
  %18 = zext i32 %17 to i64
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %13, i32 0, i32 1
  %20 = load i32, i32* %19, align 4
  %21 = zext i32 %20 to i64
  %22 = select i1 %15, i64 %21, i64 %18
  %23 = shl i64 %22, 32
  %24 = zext i1 %15 to i64
  %25 = or i64 %23, %24
  %26 = trunc i64 %25 to i1
  %27 = lshr i64 %25, 32
  %28 = trunc i64 %27 to i32
  %29 = insertvalue { i1, i32 } undef, i1 %26, 0
  %30 = insertvalue { i1, i32 } %29, i32 %28, 1
  ret { i1, i32 } %30
}

define noundef i32 @nish_main() #1 {
entry:
  %bad.addr = alloca %struct.nish_result.void.i32*, align 8
  %nish_result.void.i32.obj = alloca %struct.nish_result.void.i32, align 8
  %nish_result.void.i32.obj.1 = alloca %struct.nish_result.void.i32, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.2 = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.3 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i1, i32 } @checkPort(i32 0)
  %1 = extractvalue { i1, i32 } %0, 0
  %2 = extractvalue { i1, i32 } %0, 1
  %3 = zext i32 %2 to i64
  %4 = shl i64 %3, 32
  %5 = zext i1 %1 to i64
  %6 = or i64 %4, %5
  %7 = trunc i64 %6 to i1
  %8 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj, i32 0, i32 0
  store i1 %7, i1* %8, align 1
  %9 = lshr i64 %6, 32
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  store %struct.nish_result.void.i32* %nish_result.void.i32.obj, %struct.nish_result.void.i32** %bad.addr, align 8
  %12 = load %struct.nish_result.void.i32*, %struct.nish_result.void.i32** %bad.addr, align 8
  %13 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %12, i32 0, i32 0
  %14 = load i1, i1* %13, align 1
  %15 = xor i1 %14, true
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load %struct.nish_result.void.i32*, %struct.nish_result.void.i32** %bad.addr, align 8
  %17 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  br label %if.end

if.end:
  %20 = call { i1, i32 } @checkPort(i32 443)
  %21 = extractvalue { i1, i32 } %20, 0
  %22 = extractvalue { i1, i32 } %20, 1
  %23 = zext i32 %22 to i64
  %24 = shl i64 %23, 32
  %25 = zext i1 %21 to i64
  %26 = or i64 %24, %25
  %27 = trunc i64 %26 to i1
  %28 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj.1, i32 0, i32 0
  store i1 %27, i1* %28, align 1
  %29 = lshr i64 %26, 32
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj.1, i32 0, i32 1
  store i32 %30, i32* %31, align 4
  %32 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj.1, i32 0, i32 0
  %33 = load i1, i1* %32, align 1
  br i1 %33, label %res.ok, label %res.panic

res.panic:
  call void @nish_write(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

res.ok:
  %34 = call { i1, i32 } @quarter(i32 8)
  %35 = extractvalue { i1, i32 } %34, 0
  %36 = extractvalue { i1, i32 } %34, 1
  %37 = zext i32 %36 to i64
  %38 = shl i64 %37, 32
  %39 = zext i1 %35 to i64
  %40 = or i64 %38, %39
  %41 = trunc i64 %40 to i1
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %41, i1* %42, align 1
  %43 = lshr i64 %40, 32
  %44 = trunc i64 %43 to i32
  %45 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %44, i32* %45, align 4
  %46 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %44, i32* %46, align 4
  %47 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %48 = load i1, i1* %47, align 1
  br i1 %48, label %res.ok.1, label %res.alt

res.ok.1:
  %49 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %50 = load i32, i32* %49, align 4
  br label %res.end

res.alt:
  %51 = sub nsw i32 0, 1
  br label %res.end

res.end:
  %52 = phi i32 [ %50, %res.ok.1 ], [ %51, %res.alt ]
  %53 = call i8* @nish_str_from_i32(i32 %52)
  call void @nish_print(i8* %53)
  %54 = call { i1, i32 } @quarter(i32 6)
  %55 = extractvalue { i1, i32 } %54, 0
  %56 = extractvalue { i1, i32 } %54, 1
  %57 = zext i32 %56 to i64
  %58 = shl i64 %57, 32
  %59 = zext i1 %55 to i64
  %60 = or i64 %58, %59
  %61 = trunc i64 %60 to i1
  %62 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %61, i1* %62, align 1
  %63 = lshr i64 %60, 32
  %64 = trunc i64 %63 to i32
  %65 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %64, i32* %65, align 4
  %66 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %64, i32* %66, align 4
  %67 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %68 = load i1, i1* %67, align 1
  br i1 %68, label %res.ok.2, label %res.alt.1

res.ok.2:
  %69 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %70 = load i32, i32* %69, align 4
  br label %res.end.1

res.alt.1:
  %71 = sub nsw i32 0, 1
  br label %res.end.1

res.end.1:
  %72 = phi i32 [ %70, %res.ok.2 ], [ %71, %res.alt.1 ]
  %73 = call i8* @nish_str_from_i32(i32 %72)
  call void @nish_print(i8* %73)
  %74 = call { i1, i32 } @again(i32 10)
  %75 = extractvalue { i1, i32 } %74, 0
  %76 = extractvalue { i1, i32 } %74, 1
  %77 = zext i32 %76 to i64
  %78 = shl i64 %77, 32
  %79 = zext i1 %75 to i64
  %80 = or i64 %78, %79
  %81 = trunc i64 %80 to i1
  %82 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %81, i1* %82, align 1
  %83 = lshr i64 %80, 32
  %84 = trunc i64 %83 to i32
  %85 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %84, i32* %85, align 4
  %86 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %84, i32* %86, align 4
  %87 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  %88 = load i1, i1* %87, align 1
  br i1 %88, label %res.ok.3, label %res.alt.2

res.ok.3:
  %89 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  %90 = load i32, i32* %89, align 4
  br label %res.end.2

res.alt.2:
  %91 = sub nsw i32 0, 1
  br label %res.end.2

res.end.2:
  %92 = phi i32 [ %90, %res.ok.3 ], [ %91, %res.alt.2 ]
  %93 = call i8* @nish_str_from_i32(i32 %92)
  call void @nish_print(i8* %93)
  %94 = call { i1, i32 } @again(i32 11)
  %95 = extractvalue { i1, i32 } %94, 0
  %96 = extractvalue { i1, i32 } %94, 1
  %97 = zext i32 %96 to i64
  %98 = shl i64 %97, 32
  %99 = zext i1 %95 to i64
  %100 = or i64 %98, %99
  %101 = trunc i64 %100 to i1
  %102 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %101, i1* %102, align 1
  %103 = lshr i64 %100, 32
  %104 = trunc i64 %103 to i32
  %105 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %104, i32* %105, align 4
  %106 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %104, i32* %106, align 4
  %107 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  %108 = load i1, i1* %107, align 1
  br i1 %108, label %res.ok.4, label %res.alt.3

res.ok.4:
  %109 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  %110 = load i32, i32* %109, align 4
  br label %res.end.3

res.alt.3:
  %111 = sub nsw i32 0, 1
  br label %res.end.3

res.end.3:
  %112 = phi i32 [ %110, %res.ok.4 ], [ %111, %res.alt.3 ]
  %113 = call i8* @nish_str_from_i32(i32 %112)
  call void @nish_print(i8* %113)
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
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind noreturn cold }
