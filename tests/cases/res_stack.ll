%struct.nish_result.i32.str = type { i1, i32, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"too small\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noundef i32 @tenth(i32 noundef %n) #0 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %nish_result.i32.str.obj.1 = alloca %struct.nish_result.i32.str, align 8
  %0 = icmp sge i32 %n, 10
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = sdiv i32 %n, 10
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %2, align 1
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 %1, i32* %3, align 4
  br label %cond.end

cond.false:
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 0
  store i1 false, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 2
  store i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i8** %5, align 8
  br label %cond.end

cond.end:
  %6 = phi %struct.nish_result.i32.str* [ %nish_result.i32.str.obj, %cond.true ], [ %nish_result.i32.str.obj.1, %cond.false ]
  store %struct.nish_result.i32.str* %6, %struct.nish_result.i32.str** %r.addr, align 8
  %7 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %7, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  br i1 %9, label %res.ok, label %res.alt

res.ok:
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %7, i32 0, i32 1
  %11 = load i32, i32* %10, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %12 = phi i32 [ %11, %res.ok ], [ 0, %res.alt ]
  ret i32 %12
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @tenth(i32 250)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @tenth(i32 4)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
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
