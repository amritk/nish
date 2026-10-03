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

define internal { i1, i32, i32 } @checkPort(i32 noundef %port) #0 {
entry:
  %0 = icmp sle i32 %port, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %port, 2
  ret { i1, i32, i32 } %1

if.end:
  ret { i1, i32, i32 } { i1 true, i32 undef, i32 undef }
}

define internal { i1, i32, i32 } @firstHalf(i32 noundef %n) #0 {
entry:
  %0 = srem i32 %n, 2
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %n, 2
  ret { i1, i32, i32 } %2

if.end:
  %3 = sdiv i32 %n, 2
  %4 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %3, 1
  ret { i1, i32, i32 } %4
}

define internal { i1, i32, i32 } @quarter(i32 noundef %n) #0 {
entry:
  %h.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32, i32 } @firstHalf(i32 %n)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %8 = load i1, i1* %7, align 1
  br i1 %8, label %res.ok, label %res.propagate

res.propagate:
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %10, 2
  ret { i1, i32, i32 } %11

res.ok:
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = call { i1, i32, i32 } @firstHalf(i32 %14)
  %16 = extractvalue { i1, i32, i32 } %15, 0
  %17 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %16, i1* %17, align 1
  %18 = extractvalue { i1, i32, i32 } %15, 1
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %18, i32* %19, align 4
  %20 = extractvalue { i1, i32, i32 } %15, 2
  %21 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %20, i32* %21, align 4
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %23 = load i1, i1* %22, align 1
  %24 = insertvalue { i1, i32, i32 } undef, i1 %23, 0
  %25 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  %26 = load i32, i32* %25, align 4
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %28 = load i32, i32* %27, align 4
  %29 = insertvalue { i1, i32, i32 } %24, i32 %28, 1
  %30 = insertvalue { i1, i32, i32 } %29, i32 %26, 2
  ret { i1, i32, i32 } %30
}

define internal { i1, i32, i32 } @again(i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = call { i1, i32, i32 } @firstHalf(i32 %n)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = extractvalue { i1, i32, i32 } %0, 2
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %5, i32* %6, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, %struct.nish_result.i32.i32** %r.addr, align 8
  %7 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %r.addr, align 8
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  %10 = insertvalue { i1, i32, i32 } undef, i1 %9, 0
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 2
  %12 = load i32, i32* %11, align 4
  %13 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %7, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  %15 = insertvalue { i1, i32, i32 } %10, i32 %14, 1
  %16 = insertvalue { i1, i32, i32 } %15, i32 %12, 2
  ret { i1, i32, i32 } %16
}

define noundef i32 @nish_main() #0 {
entry:
  %bad.addr = alloca %struct.nish_result.void.i32*, align 8
  %nish_result.void.i32.obj = alloca %struct.nish_result.void.i32, align 8
  %nish_result.void.i32.obj.1 = alloca %struct.nish_result.void.i32, align 8
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.2 = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.3 = alloca %struct.nish_result.i32.i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call { i1, i32, i32 } @checkPort(i32 0)
  %1 = extractvalue { i1, i32, i32 } %0, 0
  %2 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj, i32 0, i32 0
  store i1 %1, i1* %2, align 1
  %3 = extractvalue { i1, i32, i32 } %0, 2
  %4 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  store %struct.nish_result.void.i32* %nish_result.void.i32.obj, %struct.nish_result.void.i32** %bad.addr, align 8
  %5 = load %struct.nish_result.void.i32*, %struct.nish_result.void.i32** %bad.addr, align 8
  %6 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = xor i1 %7, true
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = load %struct.nish_result.void.i32*, %struct.nish_result.void.i32** %bad.addr, align 8
  %10 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  br label %if.end

if.end:
  %13 = call { i1, i32, i32 } @checkPort(i32 443)
  %14 = extractvalue { i1, i32, i32 } %13, 0
  %15 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj.1, i32 0, i32 0
  store i1 %14, i1* %15, align 1
  %16 = extractvalue { i1, i32, i32 } %13, 2
  %17 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj.1, i32 0, i32 1
  store i32 %16, i32* %17, align 4
  %18 = getelementptr inbounds %struct.nish_result.void.i32, %struct.nish_result.void.i32* %nish_result.void.i32.obj.1, i32 0, i32 0
  %19 = load i1, i1* %18, align 1
  br i1 %19, label %res.ok, label %res.panic

res.panic:
  call void @nish_write(i8* bitcast ({ i64, [14 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

res.ok:
  %20 = call { i1, i32, i32 } @quarter(i32 8)
  %21 = extractvalue { i1, i32, i32 } %20, 0
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %21, i1* %22, align 1
  %23 = extractvalue { i1, i32, i32 } %20, 1
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %23, i32* %24, align 4
  %25 = extractvalue { i1, i32, i32 } %20, 2
  %26 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %25, i32* %26, align 4
  %27 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %28 = load i1, i1* %27, align 1
  br i1 %28, label %res.ok.1, label %res.alt

res.ok.1:
  %29 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %30 = load i32, i32* %29, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %31 = phi i32 [ %30, %res.ok.1 ], [ -1, %res.alt ]
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = call { i1, i32, i32 } @quarter(i32 6)
  %34 = extractvalue { i1, i32, i32 } %33, 0
  %35 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %34, i1* %35, align 1
  %36 = extractvalue { i1, i32, i32 } %33, 1
  %37 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %36, i32* %37, align 4
  %38 = extractvalue { i1, i32, i32 } %33, 2
  %39 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %38, i32* %39, align 4
  %40 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %41 = load i1, i1* %40, align 1
  br i1 %41, label %res.ok.2, label %res.alt.1

res.ok.2:
  %42 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %43 = load i32, i32* %42, align 4
  br label %res.end.1

res.alt.1:
  br label %res.end.1

res.end.1:
  %44 = phi i32 [ %43, %res.ok.2 ], [ -1, %res.alt.1 ]
  %45 = call i8* @nish_str_from_i32(i32 %44)
  call void @nish_print(i8* %45)
  %46 = call { i1, i32, i32 } @again(i32 10)
  %47 = extractvalue { i1, i32, i32 } %46, 0
  %48 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %47, i1* %48, align 1
  %49 = extractvalue { i1, i32, i32 } %46, 1
  %50 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %49, i32* %50, align 4
  %51 = extractvalue { i1, i32, i32 } %46, 2
  %52 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %51, i32* %52, align 4
  %53 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  %54 = load i1, i1* %53, align 1
  br i1 %54, label %res.ok.3, label %res.alt.2

res.ok.3:
  %55 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  %56 = load i32, i32* %55, align 4
  br label %res.end.2

res.alt.2:
  br label %res.end.2

res.end.2:
  %57 = phi i32 [ %56, %res.ok.3 ], [ -1, %res.alt.2 ]
  %58 = call i8* @nish_str_from_i32(i32 %57)
  call void @nish_print(i8* %58)
  %59 = call { i1, i32, i32 } @again(i32 11)
  %60 = extractvalue { i1, i32, i32 } %59, 0
  %61 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %60, i1* %61, align 1
  %62 = extractvalue { i1, i32, i32 } %59, 1
  %63 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %62, i32* %63, align 4
  %64 = extractvalue { i1, i32, i32 } %59, 2
  %65 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %64, i32* %65, align 4
  %66 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  %67 = load i1, i1* %66, align 1
  br i1 %67, label %res.ok.4, label %res.alt.3

res.ok.4:
  %68 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  %69 = load i32, i32* %68, align 4
  br label %res.end.3

res.alt.3:
  br label %res.end.3

res.end.3:
  %70 = phi i32 [ %69, %res.ok.4 ], [ -1, %res.alt.3 ]
  %71 = call i8* @nish_str_from_i32(i32 %70)
  call void @nish_print(i8* %71)
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
