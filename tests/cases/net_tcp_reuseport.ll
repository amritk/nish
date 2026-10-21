@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"127.0.0.1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"nowhere\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noundef i32 @nish_net_local_port(i32 noundef) #1
declare noundef i32 @nish_tcp_listen(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_tcp_listen_flags(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i32 noundef, i32 noundef) #1
declare noundef i32 @nish_net_close(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca i32, align 4
  %port.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 1)
  store i32 %0, i32* %a.addr, align 4
  %1 = load i32, i32* %a.addr, align 4
  %2 = call i32 @nish_net_local_port(i32 %1)
  store i32 %2, i32* %port.addr, align 4
  %3 = load i32, i32* %port.addr, align 4
  %4 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %3, i32 4, i32 1)
  store i32 %4, i32* %b.addr, align 4
  %5 = load i32, i32* %a.addr, align 4
  %6 = icmp sge i32 %5, 0
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i32, i32* %port.addr, align 4
  %8 = icmp sgt i32 %7, 0
  br label %land.end

land.end:
  %9 = phi i1 [ false, %entry ], [ %8, %land.rhs ]
  %10 = select i1 %9, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %10)
  %11 = load i32, i32* %b.addr, align 4
  %12 = icmp sge i32 %11, 0
  br i1 %12, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %13 = load i32, i32* %b.addr, align 4
  %14 = call i32 @nish_net_local_port(i32 %13)
  %15 = load i32, i32* %port.addr, align 4
  %16 = icmp eq i32 %14, %15
  br label %land.end.1

land.end.1:
  %17 = phi i1 [ false, %land.end ], [ %16, %land.rhs.1 ]
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %18)
  %19 = load i32, i32* %port.addr, align 4
  %20 = call i32 @nish_tcp_listen(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %19, i32 4)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  %22 = load i32, i32* %port.addr, align 4
  %23 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 %22, i32 4, i32 0)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  call void @nish_print(i8* %24)
  %25 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 6)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %26)
  %27 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 4)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  call void @nish_print(i8* %28)
  %29 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i32 0, i32 4, i32 -1)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  call void @nish_print(i8* %30)
  %31 = call i32 @nish_tcp_listen_flags(i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), i32 0, i32 4, i32 1)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  call void @nish_print(i8* %32)
  %33 = load i32, i32* %b.addr, align 4
  %34 = call i32 @nish_net_close(i32 %33)
  %35 = load i32, i32* %a.addr, align 4
  %36 = call i32 @nish_net_close(i32 %35)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %36
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
