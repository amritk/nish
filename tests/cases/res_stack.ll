%struct.sts_result.i32.str = type { i1, i32, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"too small\00" }, align 8

declare void @sts_free_arena() #1
declare noundef i64 @sts_arena_mark() #1
declare void @sts_arena_release(i64 noundef) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef i32 @tenth(i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.sts_result.i32.str*, align 8
  %sts_result.i32.str.obj = alloca %struct.sts_result.i32.str, align 8
  %sts_result.i32.str.obj.1 = alloca %struct.sts_result.i32.str, align 8
  %0 = icmp sge i32 %n, 10
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = icmp eq i32 10, 0
  %2 = icmp eq i32 %n, -2147483648
  %3 = icmp eq i32 10, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 %n, 10
  %7 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %sts_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %7, align 1
  %8 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %sts_result.i32.str.obj, i32 0, i32 1
  store i32 %6, i32* %8, align 4
  br label %cond.end

cond.false:
  %9 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %sts_result.i32.str.obj.1, i32 0, i32 0
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %sts_result.i32.str.obj.1, i32 0, i32 2
  store i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i8** %10, align 8
  br label %cond.end

cond.end:
  %11 = phi %struct.sts_result.i32.str* [ %sts_result.i32.str.obj, %div.ok ], [ %sts_result.i32.str.obj.1, %cond.false ]
  store %struct.sts_result.i32.str* %11, %struct.sts_result.i32.str** %r.addr, align 8
  %12 = load %struct.sts_result.i32.str*, %struct.sts_result.i32.str** %r.addr, align 8
  %13 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %12, i32 0, i32 0
  %14 = load i1, i1* %13, align 1
  br i1 %14, label %res.ok, label %res.alt

res.ok:
  %15 = getelementptr inbounds %struct.sts_result.i32.str, %struct.sts_result.i32.str* %12, i32 0, i32 1
  %16 = load i32, i32* %15, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %17 = phi i32 [ %16, %res.ok ], [ 0, %res.alt ]
  ret i32 %17
}

define noundef i32 @sts_main() #0 {
entry:
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i32 @tenth(i32 250)
  %1 = call i8* @sts_str_from_i32(i32 %0)
  call void @sts_print(i8* %1)
  %2 = call i32 @tenth(i32 4)
  %3 = call i8* @sts_str_from_i32(i32 %2)
  call void @sts_print(i8* %3)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
