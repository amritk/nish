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

define internal { i1, i32, i32 } @firstHalf(i32 noundef %n) #1 {
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
  %7 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %n, 2
  ret { i1, i32, i32 } %7

if.end:
  %8 = icmp eq i32 2, 0
  %9 = icmp eq i32 %n, -2147483648
  %10 = icmp eq i32 2, -1
  %11 = and i1 %9, %10
  %12 = or i1 %8, %11
  br i1 %12, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %8)
  unreachable

div.ok.1:
  %13 = sdiv i32 %n, 2
  %14 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %13, 1
  ret { i1, i32, i32 } %14
}

define internal { i1, i32, i32 } @quarter(i32 noundef %n) #1 {
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

define internal { i1, i32, i32 } @again(i32 noundef %n) #1 {
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
  %31 = sub nsw i32 0, 1
  br label %res.end

res.end:
  %32 = phi i32 [ %30, %res.ok.1 ], [ %31, %res.alt ]
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  %34 = call { i1, i32, i32 } @quarter(i32 6)
  %35 = extractvalue { i1, i32, i32 } %34, 0
  %36 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %35, i1* %36, align 1
  %37 = extractvalue { i1, i32, i32 } %34, 1
  %38 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %37, i32* %38, align 4
  %39 = extractvalue { i1, i32, i32 } %34, 2
  %40 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %39, i32* %40, align 4
  %41 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %42 = load i1, i1* %41, align 1
  br i1 %42, label %res.ok.2, label %res.alt.1

res.ok.2:
  %43 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %44 = load i32, i32* %43, align 4
  br label %res.end.1

res.alt.1:
  %45 = sub nsw i32 0, 1
  br label %res.end.1

res.end.1:
  %46 = phi i32 [ %44, %res.ok.2 ], [ %45, %res.alt.1 ]
  %47 = call i8* @nish_str_from_i32(i32 %46)
  call void @nish_print(i8* %47)
  %48 = call { i1, i32, i32 } @again(i32 10)
  %49 = extractvalue { i1, i32, i32 } %48, 0
  %50 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  store i1 %49, i1* %50, align 1
  %51 = extractvalue { i1, i32, i32 } %48, 1
  %52 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  store i32 %51, i32* %52, align 4
  %53 = extractvalue { i1, i32, i32 } %48, 2
  %54 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 2
  store i32 %53, i32* %54, align 4
  %55 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 0
  %56 = load i1, i1* %55, align 1
  br i1 %56, label %res.ok.3, label %res.alt.2

res.ok.3:
  %57 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.2, i32 0, i32 1
  %58 = load i32, i32* %57, align 4
  br label %res.end.2

res.alt.2:
  %59 = sub nsw i32 0, 1
  br label %res.end.2

res.end.2:
  %60 = phi i32 [ %58, %res.ok.3 ], [ %59, %res.alt.2 ]
  %61 = call i8* @nish_str_from_i32(i32 %60)
  call void @nish_print(i8* %61)
  %62 = call { i1, i32, i32 } @again(i32 11)
  %63 = extractvalue { i1, i32, i32 } %62, 0
  %64 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  store i1 %63, i1* %64, align 1
  %65 = extractvalue { i1, i32, i32 } %62, 1
  %66 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  store i32 %65, i32* %66, align 4
  %67 = extractvalue { i1, i32, i32 } %62, 2
  %68 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 2
  store i32 %67, i32* %68, align 4
  %69 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 0
  %70 = load i1, i1* %69, align 1
  br i1 %70, label %res.ok.4, label %res.alt.3

res.ok.4:
  %71 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.3, i32 0, i32 1
  %72 = load i32, i32* %71, align 4
  br label %res.end.3

res.alt.3:
  %73 = sub nsw i32 0, 1
  br label %res.end.3

res.end.3:
  %74 = phi i32 [ %72, %res.ok.4 ], [ %73, %res.alt.3 ]
  %75 = call i8* @nish_str_from_i32(i32 %74)
  call void @nish_print(i8* %75)
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
