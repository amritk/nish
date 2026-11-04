%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.FixedStep = type { double, double, double, i32, i1 }
%struct.KeyDecoder = type { double, %struct.nish_array*, double, %struct.nish_array*, i32, i32, i32, i1, i1 }
%struct.KeyEvent = type { i32, i32 }
%struct.Screen = type { %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32, i32, i32, i1, i1 }
%struct.TermEvent = type { i32, i32, i32, i32, i32, i32, i32, i32, i32, i32, i8*, i32, i32, i32, i32, %struct.nish_array*, i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\1B\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"^[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"char\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"up\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"down\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"right\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"left\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"enter\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"space\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"escape\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"ctrl-c\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"tab\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"backspace\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"control\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"unknown\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"(\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c")\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c": [\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c" holding\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"leave\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"hide\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"show\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"clear\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"reset\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"move 3,1\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"sync\00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"..\00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"rgb clamps: \00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"palette red \00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" grey \00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" near-black \00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" white \00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" default \00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"blank 4x2\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"unchanged: \00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"one cell\00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"gap of one, bridged\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"gap of two in another style, moved\00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"row start, then home\00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"off screen: \00" }, align 8
@.str.46 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"Hi\00" }, align 8
@.str.47 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"yo\00" }, align 8
@.str.48 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\C3\A9!\00" }, align 8
@.str.49 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"styled run\00" }, align 8
@.str.50 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"text answers \00" }, align 8
@.str.51 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c", glyph at 4 is \00" }, align 8
@.str.52 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"add inverse\00" }, align 8
@.str.53 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"cleared\00" }, align 8
@.str.54 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"unknown attribute bits\00" }, align 8
@.str.55 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"control, negative, surrogate, DEL\00" }, align 8
@.str.56 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"gap over a control, moved\00" }, align 8
@.str.57 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"C1 controls, then U+00A0\00" }, align 8
@.str.58 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.59 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"256 colours\00" }, align 8
@.str.60 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"sync first frame\00" }, align 8
@.str.61 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"sync unchanged: \00" }, align 8
@.str.62 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"sync one styled cell\00" }, align 8
@.str.63 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"sync turned off\00" }, align 8
@.str.64 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"canvas \00" }, align 8
@.str.65 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.66 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"pixels\00" }, align 8
@.str.67 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"fillRect\00" }, align 8
@.str.68 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"line\00" }, align 8
@.str.69 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"pixel (1,1) \00" }, align 8
@.str.70 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" (1,2) \00" }, align 8
@.str.71 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" off \00" }, align 8
@.str.72 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"lines to far endpoints stop at the edge\00" }, align 8
@.str.73 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ok\00" }, align 8
@.str.74 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"text over pixels\00" }, align 8
@.str.75 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"frame loop sent \00" }, align 8
@.str.76 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.77 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"steps \00" }, align 8
@.str.78 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" alpha \00" }, align 8
@llvm.global_ctors = appending global [1 x { i32, void ()*, i8* }] [{ i32, void ()*, i8* } { i32 101, void ()* @nish.round.init, i8* null }]
@.str.79 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"%\00" }, align 8
@.str.80 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"a long stall runs \00" }, align 8
@.str.81 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c" and keeps the phase: alpha \00" }, align 8
@.str.82 = private unnamed_addr constant { i64, [50 x i8] } { i64 49, [50 x i8] c"a 100 Hz draw clock over a second of 1 ms ticks: \00" }, align 8
@.str.83 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" frames\00" }, align 8
@.str.84 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"clamped: step \00" }, align 8
@.str.85 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c" ms, at most \00" }, align 8
@.str.86 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"arrows\00" }, align 8
@.str.87 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"controls\00" }, align 8
@.str.88 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"printable\00" }, align 8
@.str.89 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"count bounds the read\00" }, align 8
@.str.90 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC | [A, first\00" }, align 8
@.str.91 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC | [A, then\00" }, align 8
@.str.92 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC[ | B, first\00" }, align 8
@.str.93 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC[ | B, then\00" }, align 8
@.str.94 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"split ESC O | C, first\00" }, align 8
@.str.95 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC O | C, then\00" }, align 8
@.str.96 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"parameters, ESC[1;5A\00" }, align 8
@.str.97 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"other final, ESC[3~\00" }, align 8
@.str.98 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"lone ESC, first\00" }, align 8
@.str.99 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"lone ESC, poll early\00" }, align 8
@.str.100 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"lone ESC, poll late\00" }, align 8
@.str.101 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"ESC then a letter\00" }, align 8
@.str.102 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"ESC ESC [ A\00" }, align 8
@.str.103 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"held ESC timed out by the next feed\00" }, align 8
@.str.104 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"  next feed\00" }, align 8
@.str.105 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"split UTF-8, first\00" }, align 8
@.str.106 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"split UTF-8, then\00" }, align 8
@.str.107 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"unfinished UTF-8 timed out\00" }, align 8
@.str.108 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  poll\00" }, align 8
@.str.109 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"invalid bytes\00" }, align 8
@.str.110 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"a character cut short by another\00" }, align 8
@.str.111 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"empty feed\00" }, align 8
@.str.112 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"held over two feeds, first\00" }, align 8
@.str.113 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"held over two feeds, then\00" }, align 8
@.str.114 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"  timed from the first\00" }, align 8
@.str.115 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"ESC O and no final\00" }, align 8
@.str.116 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"past U+10FFFF lead\00" }, align 8
@.str.117 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"C1 control, then U+00A0\00" }, align 8
@.str.118 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"overlong, surrogate, too high\00" }, align 8
@.str.119 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"four bytes\00" }, align 8
@.str.120 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"ESC [ 32 parameters A\00" }, align 8
@.str.121 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"ESC [ and 4000 parameters: \00" }, align 8
@.str.122 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" keys\00" }, align 8
@.str.123 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c", the first \00" }, align 8
@.str.124 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c", holding\00" }, align 8
@.str.125 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"a 65535 x 65535 screen is \00" }, align 8
@.str.126 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" x \00" }, align 8
@.str.127 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c", its canvas \00" }, align 8
@.str.128 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c", and flushes \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare double @floor(double)
declare double @ceil(double)
declare double @trunc(double)
declare void @nish.Canvas.constructor(%struct.Canvas* noundef nonnull noalias align 8 dereferenceable(24) nocapture, %struct.Screen* noundef nonnull align 8 dereferenceable(88)) #0
declare void @nish.Canvas.clear(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef i32 @nish.Canvas.pixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.setPixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.fillRect(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.line(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Canvas.text(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i8* noundef nonnull noalias readonly align 8, i32 noundef) #0
declare void @nish.Canvas.paintCell(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.FixedStep.constructor(%struct.FixedStep* noundef nonnull noalias align 8 dereferenceable(32) nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish.FixedStep.advance(%struct.FixedStep* noundef nonnull align 8 dereferenceable(32) nocapture, double noundef) #0
declare noundef double @nish.FixedStep.alpha(%struct.FixedStep* noundef nonnull readonly align 8 dereferenceable(32) nocapture) #3
declare void @nish.KeyDecoder.constructor(%struct.KeyDecoder* noundef nonnull noalias align 8 dereferenceable(48) nocapture, double noundef) #2
declare noundef zeroext i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture) #3
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feedEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.pollEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare void @nish.KeyDecoder.keep(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(48) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i1 noundef zeroext, double noundef) #0
declare void @nish.KeyEvent.constructor(%struct.KeyEvent* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i32 noundef, i32 noundef) #2
declare void @nish.Screen.constructor(%struct.Screen* noundef nonnull noalias align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i1 noundef zeroext) #0
declare void @nish.Screen.resize(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Screen.clear(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef) #2
declare void @nish.Screen.invalidate(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #2
declare void @nish.Screen.set(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.text(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i8* noundef nonnull noalias readonly align 8, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.glyphAt(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Screen.put(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putDecimal(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putSyncMode(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putGlyph(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putColour(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.colourKey(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.Screen.flush(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef nonnull align 8 i8* @nish.beginSync() #1
declare noundef nonnull align 8 i8* @nish.clearScreen() #1
declare noundef nonnull align 8 i8* @nish.endSync() #1
declare noundef nonnull align 8 i8* @nish.enterAltScreen() #1
declare noundef nonnull align 8 i8* @nish.hideCursor() #1
declare noundef nonnull align 8 i8* @nish.leaveAltScreen() #1
declare noundef nonnull align 8 i8* @nish.moveCursor(i32 noundef, i32 noundef) #0
declare noundef i32 @nish.paletteIndex(i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.resetStyle() #1
declare noundef i32 @nish.rgb(i32 noundef, i32 noundef, i32 noundef) #1
declare noundef nonnull align 8 i8* @nish.showCursor() #1
declare noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8 nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare void @nish.TermEvent.constructor(%struct.TermEvent* noundef nonnull noalias align 8 dereferenceable(80) nocapture, i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare double @nish_floor(double) #1
declare void @nish_round_init(double (double)*, double (double)*, double (double)*) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal void @nish.round.init() nounwind {
entry:
  call void @nish_round_init(double (double)* @floor, double (double)* @ceil, double (double)* @trunc)
  ret void
}

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noundef nonnull align 8 i8* @shown(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.replaceAll(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal void @frame(i8* noundef nonnull noalias readonly align 8 nocapture %label, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @shown(i8* %s)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  %4 = call i8* @nish_str_concat(i8* %0, i8* %3)
  call void @nish_print(i8* %4)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @bytesOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %codes) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %5 = load i64, i64* %forof.idx, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %codes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %forof.body, label %forof.end

forof.body:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %codes, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %5
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %13, i32* %c.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = load i32, i32* %c.addr, align 4
  %16 = trunc i32 %15 to i8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 1)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i8*
  %25 = getelementptr inbounds i8, i8* %24, i64 %18
  store i8 %16, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  br label %forof.inc

forof.inc:
  %28 = load i64, i64* %forof.idx, align 8
  %29 = add i64 %28, 1
  store i64 %29, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %30
}

define internal noundef nonnull align 8 i8* @kindName(i32 noundef %kind) #1 {
entry:
  %0 = icmp eq i32 %kind, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*)

if.end:
  %1 = icmp eq i32 %kind, 2
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*)

if.end.1:
  %2 = icmp eq i32 %kind, 3
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*)

if.end.2:
  %3 = icmp eq i32 %kind, 4
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)

if.end.3:
  %4 = icmp eq i32 %kind, 5
  br i1 %4, label %if.then.4, label %if.end.4

if.then.4:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*)

if.end.4:
  %5 = icmp eq i32 %kind, 6
  br i1 %5, label %if.then.5, label %if.end.5

if.then.5:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*)

if.end.5:
  %6 = icmp eq i32 %kind, 7
  br i1 %6, label %if.then.6, label %if.end.6

if.then.6:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)

if.end.6:
  %7 = icmp eq i32 %kind, 8
  br i1 %7, label %if.then.7, label %if.end.7

if.then.7:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*)

if.end.7:
  %8 = icmp eq i32 %kind, 9
  br i1 %8, label %if.then.8, label %if.end.8

if.then.8:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.11 to i8*)

if.end.8:
  %9 = icmp eq i32 %kind, 10
  br i1 %9, label %if.then.9, label %if.end.9

if.then.9:
  ret i8* bitcast ({ i64, [4 x i8] }* @.str.12 to i8*)

if.end.9:
  %10 = icmp eq i32 %kind, 11
  br i1 %10, label %if.then.10, label %if.end.10

if.then.10:
  ret i8* bitcast ({ i64, [10 x i8] }* @.str.13 to i8*)

if.end.10:
  %11 = icmp eq i32 %kind, 12
  br i1 %11, label %if.then.11, label %if.end.11

if.then.11:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*)

if.end.11:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.15 to i8*)
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @csiRun(i32 noundef %n, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %last) #0 {
entry:
  %codes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %k.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 27, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 91, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %codes.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %k.addr, align 4
  %8 = icmp slt i32 %7, %n
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %9, i64 4)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %11
  store i32 48, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  br label %for.inc

for.inc:
  %21 = load i32, i32* %k.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %k.addr, align 4
  br label %for.cond

for.end:
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %23 = load i64, i64* %forof.idx, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %last, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = icmp ult i64 %23, %25
  br i1 %26, label %forof.body, label %forof.end

forof.body:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %last, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %23
  %31 = load i32, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %31, i32* %c.addr, align 4
  %32 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %33 = load i32, i32* %c.addr, align 4
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %38 = icmp eq i64 %35, %37
  br i1 %38, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %32, i64 4)
  br label %push.store.1

push.store.1:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %35
  store i32 %33, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %43 = add i64 %35, 1
  store i64 %43, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = trunc i64 %43 to i32
  br label %forof.inc

forof.inc:
  %45 = load i64, i64* %forof.idx, align 8
  %46 = add i64 %45, 1
  store i64 %46, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %47 = load %struct.nish_array*, %struct.nish_array** %codes.addr, align 8
  %48 = call %struct.nish_array* @bytesOf(%struct.nish_array* %47)
  ret %struct.nish_array* %48
}

define internal void @events(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %keys, %struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(48) nocapture %d) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %k.addr = alloca %struct.KeyEvent*, align 8
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to %struct.KeyEvent**
  %10 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %9, i64 %3
  %11 = load %struct.KeyEvent*, %struct.KeyEvent** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.KeyEvent* %11, %struct.KeyEvent** %k.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = load %struct.KeyEvent*, %struct.KeyEvent** %k.addr, align 8
  %14 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !21
  %16 = call i8* @kindName(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.16 to i8*))
  %18 = load %struct.KeyEvent*, %struct.KeyEvent** %k.addr, align 8
  %19 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %18, i32 0, i32 1
  %20 = load i32, i32* %19, align 4, !tbaa !22
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %17, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.17 to i8*))
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 %25
  store i8* %23, i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  br label %forof.inc

forof.inc:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = add i64 %35, 1
  store i64 %36, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %37 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [4 x i8] }* @.str.18 to i8*))
  %38 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*) to i64*
  %42 = load i64, i64* %41, align 8
  %43 = sub i64 %40, 1
  %44 = mul i64 %42, %43
  %45 = icmp eq i64 %40, 0
  %46 = select i1 %45, i64 0, i64 %44
  store i64 %46, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %47 = load i64, i64* %join.at, align 8
  %48 = icmp ult i64 %47, %40
  br i1 %48, label %join.sum.body, label %join.copy

join.sum.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i8**
  %52 = getelementptr inbounds i8*, i8** %51, i64 %47
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %54 = load i64, i64* %join.total, align 8
  %55 = bitcast i8* %53 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = add i64 %54, %56
  store i64 %57, i64* %join.total, align 8
  %58 = add i64 %47, 1
  store i64 %58, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %59 = load i64, i64* %join.total, align 8
  %60 = icmp ugt i64 %59, 2147483647
  %61 = add i64 %59, 9
  %62 = select i1 %60, i64 4611686018427387904, i64 %61
  %63 = call i8* @nish_alloc_struct(i64 %62)
  %64 = bitcast i8* %63 to i64*
  store i64 %59, i64* %64, align 8
  %65 = getelementptr inbounds i8, i8* %63, i64 8
  store i8* %65, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %66 = load i64, i64* %join.at, align 8
  %67 = icmp ult i64 %66, %40
  br i1 %67, label %join.part, label %join.end

join.part:
  %68 = load i8*, i8** %join.p, align 8
  %69 = icmp eq i64 %66, 0
  %70 = select i1 %69, i64 0, i64 %42
  %71 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %68, i64 %70
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %66
  %77 = load i8*, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %78 = bitcast i8* %77 to i64*
  %79 = load i64, i64* %78, align 8
  %80 = getelementptr inbounds i8, i8* %77, i64 8
  %81 = icmp eq i64 %79, 1
  br i1 %81, label %join.byte, label %join.bulk

join.byte:
  %82 = load i8, i8* %80, align 1
  store i8 %82, i8* %72, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %72, i8* %80, i64 %79, i1 false)
  br label %join.next

join.next:
  %83 = getelementptr inbounds i8, i8* %72, i64 %79
  store i8* %83, i8** %join.p, align 8
  %84 = add i64 %66, 1
  store i64 %84, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %85 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %85, align 1
  %86 = call i8* @nish_str_concat(i8* %37, i8* %63)
  %87 = call i8* @nish_str_concat(i8* %86, i8* bitcast ({ i64, [2 x i8] }* @.str.20 to i8*))
  %88 = call i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* %d)
  br i1 %88, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %89 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.21 to i8*), %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.22 to i8*), %cond.false ]
  %90 = call i8* @nish_str_concat(i8* %87, i8* %89)
  call void @nish_print(i8* %90)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca %struct.Screen*, align 8
  %Screen.obj = alloca %struct.Screen, align 8
  %t.addr = alloca %struct.Screen*, align 8
  %Screen.obj.1 = alloca %struct.Screen, align 8
  %red.addr = alloca i32, align 4
  %blue.addr = alloca i32, align 4
  %drawn.addr = alloca i32, align 4
  %q.addr = alloca %struct.Screen*, align 8
  %Screen.obj.2 = alloca %struct.Screen, align 8
  %p.addr = alloca %struct.Screen*, align 8
  %Screen.obj.3 = alloca %struct.Screen, align 8
  %y.addr = alloca %struct.Screen*, align 8
  %Screen.obj.4 = alloca %struct.Screen, align 8
  %cs.addr = alloca %struct.Screen*, align 8
  %c.addr = alloca %struct.Canvas*, align 8
  %Canvas.obj = alloca %struct.Canvas, align 8
  %game.addr = alloca %struct.Screen*, align 8
  %Screen.obj.5 = alloca %struct.Screen, align 8
  %sent.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %out.addr = alloca i8*, align 8
  %logic.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj = alloca %struct.FixedStep, align 8
  %steps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %behind.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.1 = alloca %struct.FixedStep, align 8
  %caught.addr = alloca i32, align 4
  %draw.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.2 = alloca %struct.FixedStep, align 8
  %frames.addr = alloca i32, align 4
  %ms.addr = alloca i32, align 4
  %odd.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.3 = alloca %struct.FixedStep, align 8
  %d.addr = alloca %struct.KeyDecoder*, align 8
  %KeyDecoder.obj = alloca %struct.KeyDecoder, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [12 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [3 x i32], align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [1 x i32], align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [2 x i32], align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [2 x i32], align 8
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [1 x i32], align 8
  %arr.hdr.9 = alloca %struct.nish_array, align 8
  %arr.data.8 = alloca [2 x i32], align 8
  %arr.hdr.10 = alloca %struct.nish_array, align 8
  %arr.data.9 = alloca [1 x i32], align 8
  %arr.hdr.11 = alloca %struct.nish_array, align 8
  %arr.data.10 = alloca [6 x i32], align 8
  %arr.hdr.12 = alloca %struct.nish_array, align 8
  %arr.data.11 = alloca [4 x i32], align 8
  %arr.hdr.13 = alloca %struct.nish_array, align 8
  %arr.data.12 = alloca [1 x i32], align 8
  %arr.hdr.14 = alloca %struct.nish_array, align 8
  %arr.data.13 = alloca [2 x i32], align 8
  %arr.hdr.15 = alloca %struct.nish_array, align 8
  %arr.data.14 = alloca [4 x i32], align 8
  %arr.hdr.16 = alloca %struct.nish_array, align 8
  %arr.data.15 = alloca [1 x i32], align 8
  %arr.hdr.17 = alloca %struct.nish_array, align 8
  %arr.data.16 = alloca [1 x i32], align 8
  %arr.hdr.18 = alloca %struct.nish_array, align 8
  %arr.data.17 = alloca [1 x i32], align 8
  %arr.hdr.19 = alloca %struct.nish_array, align 8
  %arr.data.18 = alloca [1 x i32], align 8
  %arr.hdr.20 = alloca %struct.nish_array, align 8
  %arr.data.19 = alloca [2 x i32], align 8
  %arr.hdr.21 = alloca %struct.nish_array, align 8
  %arr.data.20 = alloca [3 x i32], align 8
  %arr.hdr.22 = alloca %struct.nish_array, align 8
  %arr.data.21 = alloca [3 x i32], align 8
  %arr.hdr.23 = alloca %struct.nish_array, align 8
  %arr.hdr.24 = alloca %struct.nish_array, align 8
  %arr.data.22 = alloca [1 x i32], align 8
  %arr.hdr.25 = alloca %struct.nish_array, align 8
  %arr.data.23 = alloca [1 x i32], align 8
  %arr.hdr.26 = alloca %struct.nish_array, align 8
  %arr.data.24 = alloca [3 x i32], align 8
  %arr.hdr.27 = alloca %struct.nish_array, align 8
  %arr.data.25 = alloca [3 x i32], align 8
  %arr.hdr.28 = alloca %struct.nish_array, align 8
  %arr.data.26 = alloca [4 x i32], align 8
  %arr.hdr.29 = alloca %struct.nish_array, align 8
  %arr.data.27 = alloca [10 x i32], align 8
  %arr.hdr.30 = alloca %struct.nish_array, align 8
  %arr.data.28 = alloca [4 x i32], align 8
  %arr.hdr.31 = alloca %struct.nish_array, align 8
  %arr.data.29 = alloca [1 x i32], align 8
  %long.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.32 = alloca %struct.nish_array, align 8
  %huge.addr = alloca %struct.Screen*, align 8
  %canvas.addr = alloca %struct.Canvas*, align 8
  %Canvas.obj.1 = alloca %struct.Canvas, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish.enterAltScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8* %0)
  %1 = call i8* @nish.leaveAltScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.23 to i8*), i8* %1)
  %2 = call i8* @nish.hideCursor()
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.24 to i8*), i8* %2)
  %3 = call i8* @nish.showCursor()
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.25 to i8*), i8* %3)
  %4 = call i8* @nish.clearScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.26 to i8*), i8* %4)
  %5 = call i8* @nish.resetStyle()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.27 to i8*), i8* %5)
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @nish.moveCursor(i32 3, i32 1)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.28 to i8*), i8* %8)
  %9 = call i8* @nish.beginSync()
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [3 x i8] }* @.str.30 to i8*))
  %11 = call i8* @nish.endSync()
  %12 = call i8* @nish_str_concat(i8* %10, i8* %11)
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.29 to i8*), i8* %12)
  %13 = call i32 @nish.rgb(i32 300, i32 -4, i32 128)
  %14 = call i32 @nish.rgb(i32 255, i32 0, i32 128)
  %15 = icmp eq i32 %13, %14
  %16 = select i1 %15, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.31 to i8*), i8* %16)
  call void @nish_print(i8* %17)
  %18 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %19 = call i32 @nish.paletteIndex(i32 %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.34 to i8*), i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [7 x i8] }* @.str.35 to i8*))
  %23 = call i32 @nish.rgb(i32 128, i32 128, i32 128)
  %24 = call i32 @nish.paletteIndex(i32 %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [13 x i8] }* @.str.36 to i8*))
  %28 = call i32 @nish.rgb(i32 8, i32 8, i32 8)
  %29 = call i32 @nish.paletteIndex(i32 %28)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %27, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [8 x i8] }* @.str.37 to i8*))
  %33 = call i32 @nish.rgb(i32 255, i32 255, i32 255)
  %34 = call i32 @nish.paletteIndex(i32 %33)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %32, i8* %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [10 x i8] }* @.str.38 to i8*))
  %38 = call i32 @nish.paletteIndex(i32 -1)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %37, i8* %39)
  call void @nish_print(i8* %40)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj, i32 4, i32 2, i1 false)
  store %struct.Screen* %Screen.obj, %struct.Screen** %s.addr, align 8
  %41 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %42 = call i64 @nish_arena_mark()
  %43 = call i8* @nish.Screen.flush(%struct.Screen* %41)
  %44 = call i8* @nish_arena_keep(i64 %42, i8* %43)
  call void @frame(i8* bitcast ({ i64, [10 x i8] }* @.str.39 to i8*), i8* %44)
  %45 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %46 = call i64 @nish_arena_mark()
  %47 = call i8* @nish.Screen.flush(%struct.Screen* %45)
  %48 = call i8* @nish_arena_keep(i64 %46, i8* %47)
  %49 = bitcast i8* %48 to i64*
  %50 = load i64, i64* %49, align 8
  %51 = trunc i64 %50 to i32
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.40 to i8*), i8* %52)
  call void @nish_print(i8* %53)
  %54 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %54, i32 2, i32 1, i32 88, i32 -1, i32 -1, i32 0)
  %55 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @nish.Screen.flush(%struct.Screen* %55)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.41 to i8*), i8* %58)
  %59 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %59, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 0)
  %60 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %60, i32 2, i32 0, i32 66, i32 -1, i32 -1, i32 0)
  %61 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %62 = call i64 @nish_arena_mark()
  %63 = call i8* @nish.Screen.flush(%struct.Screen* %61)
  %64 = call i8* @nish_arena_keep(i64 %62, i8* %63)
  call void @frame(i8* bitcast ({ i64, [20 x i8] }* @.str.42 to i8*), i8* %64)
  %65 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %65, i32 0, i32 0, i32 67, i32 -1, i32 -1, i32 0)
  %66 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %67 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %66, i32 3, i32 0, i32 68, i32 %67, i32 -1, i32 0)
  %68 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %69 = call i64 @nish_arena_mark()
  %70 = call i8* @nish.Screen.flush(%struct.Screen* %68)
  %71 = call i8* @nish_arena_keep(i64 %69, i8* %70)
  call void @frame(i8* bitcast ({ i64, [35 x i8] }* @.str.43 to i8*), i8* %71)
  %72 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %72, i32 0, i32 1, i32 69, i32 -1, i32 -1, i32 0)
  %73 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %73, i32 0, i32 0, i32 32, i32 -1, i32 -1, i32 0)
  %74 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %75 = call i64 @nish_arena_mark()
  %76 = call i8* @nish.Screen.flush(%struct.Screen* %74)
  %77 = call i8* @nish_arena_keep(i64 %75, i8* %76)
  call void @frame(i8* bitcast ({ i64, [21 x i8] }* @.str.44 to i8*), i8* %77)
  %78 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %78, i32 9, i32 9, i32 90, i32 -1, i32 -1, i32 0)
  %79 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %79, i32 -1, i32 0, i32 90, i32 -1, i32 -1, i32 0)
  %80 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %81 = call i64 @nish_arena_mark()
  %82 = call i8* @nish.Screen.flush(%struct.Screen* %80)
  %83 = call i8* @nish_arena_keep(i64 %81, i8* %82)
  %84 = bitcast i8* %83 to i64*
  %85 = load i64, i64* %84, align 8
  %86 = trunc i64 %85 to i32
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.45 to i8*), i8* %87)
  call void @nish_print(i8* %88)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.1, i32 6, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.1, %struct.Screen** %t.addr, align 8
  %89 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %90 = call i64 @nish_arena_mark()
  %91 = call i8* @nish.Screen.flush(%struct.Screen* %89)
  %92 = call i8* @nish_arena_keep(i64 %90, i8* %91)
  %93 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  store i32 %93, i32* %red.addr, align 4
  %94 = call i32 @nish.rgb(i32 0, i32 0, i32 255)
  store i32 %94, i32* %blue.addr, align 4
  %95 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %96 = load i32, i32* %red.addr, align 4
  %97 = load i32, i32* %blue.addr, align 4
  %98 = call i32 @nish.Screen.text(%struct.Screen* %95, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.46 to i8*), i32 %96, i32 %97, i32 1)
  store i32 %98, i32* %drawn.addr, align 4
  %99 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %100 = load i32, i32* %drawn.addr, align 4
  %101 = load i32, i32* %red.addr, align 4
  %102 = load i32, i32* %blue.addr, align 4
  %103 = call i32 @nish.Screen.text(%struct.Screen* %99, i32 %100, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.47 to i8*), i32 %101, i32 %102, i32 2)
  %104 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %105 = call i32 @nish.Screen.text(%struct.Screen* %104, i32 4, i32 0, i8* bitcast ({ i64, [4 x i8] }* @.str.48 to i8*), i32 -1, i32 -1, i32 0)
  %106 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %107 = call i64 @nish_arena_mark()
  %108 = call i8* @nish.Screen.flush(%struct.Screen* %106)
  %109 = call i8* @nish_arena_keep(i64 %107, i8* %108)
  call void @frame(i8* bitcast ({ i64, [11 x i8] }* @.str.49 to i8*), i8* %109)
  %110 = load i32, i32* %drawn.addr, align 4
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.50 to i8*), i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [17 x i8] }* @.str.51 to i8*))
  %114 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %115 = call i32 @nish.Screen.glyphAt(%struct.Screen* %114, i32 4, i32 0)
  %116 = call i8* @nish_str_from_i32(i32 %115)
  %117 = call i8* @nish_str_concat(i8* %113, i8* %116)
  call void @nish_print(i8* %117)
  %118 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %119 = load i32, i32* %red.addr, align 4
  %120 = load i32, i32* %blue.addr, align 4
  %121 = or i32 1, 2
  %122 = call i32 @nish.Screen.text(%struct.Screen* %118, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.46 to i8*), i32 %119, i32 %120, i32 %121)
  %123 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %124 = call i64 @nish_arena_mark()
  %125 = call i8* @nish.Screen.flush(%struct.Screen* %123)
  %126 = call i8* @nish_arena_keep(i64 %124, i8* %125)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.52 to i8*), i8* %126)
  %127 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  call void @nish.Screen.clear(%struct.Screen* %127, i32 -1)
  %128 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %129 = call i64 @nish_arena_mark()
  %130 = call i8* @nish.Screen.flush(%struct.Screen* %128)
  %131 = call i8* @nish_arena_keep(i64 %129, i8* %130)
  call void @frame(i8* bitcast ({ i64, [8 x i8] }* @.str.53 to i8*), i8* %131)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.2, i32 4, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.2, %struct.Screen** %q.addr, align 8
  %132 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %133 = call i64 @nish_arena_mark()
  %134 = call i8* @nish.Screen.flush(%struct.Screen* %132)
  %135 = call i8* @nish_arena_keep(i64 %133, i8* %134)
  %136 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %136, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 64)
  %137 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %138 = call i64 @nish_arena_mark()
  %139 = call i8* @nish.Screen.flush(%struct.Screen* %137)
  %140 = call i8* @nish_arena_keep(i64 %138, i8* %139)
  call void @frame(i8* bitcast ({ i64, [23 x i8] }* @.str.54 to i8*), i8* %140)
  %141 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %141, i32 0, i32 0, i32 7, i32 -1, i32 -1, i32 0)
  %142 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %142, i32 1, i32 0, i32 -5, i32 -1, i32 -1, i32 0)
  %143 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %143, i32 2, i32 0, i32 55296, i32 -1, i32 -1, i32 0)
  %144 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %144, i32 3, i32 0, i32 127, i32 -1, i32 -1, i32 0)
  %145 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %146 = call i64 @nish_arena_mark()
  %147 = call i8* @nish.Screen.flush(%struct.Screen* %145)
  %148 = call i8* @nish_arena_keep(i64 %146, i8* %147)
  call void @frame(i8* bitcast ({ i64, [34 x i8] }* @.str.55 to i8*), i8* %148)
  %149 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %149, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 0)
  %150 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %150, i32 2, i32 0, i32 66, i32 -1, i32 -1, i32 0)
  %151 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %152 = call i64 @nish_arena_mark()
  %153 = call i8* @nish.Screen.flush(%struct.Screen* %151)
  %154 = call i8* @nish_arena_keep(i64 %152, i8* %153)
  call void @frame(i8* bitcast ({ i64, [26 x i8] }* @.str.56 to i8*), i8* %154)
  %155 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %155, i32 0, i32 0, i32 128, i32 -1, i32 -1, i32 0)
  %156 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %156, i32 1, i32 0, i32 155, i32 -1, i32 -1, i32 0)
  %157 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %157, i32 2, i32 0, i32 159, i32 -1, i32 -1, i32 0)
  %158 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %158, i32 3, i32 0, i32 160, i32 -1, i32 -1, i32 0)
  %159 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %160 = call i64 @nish_arena_mark()
  %161 = call i8* @nish.Screen.flush(%struct.Screen* %159)
  %162 = call i8* @nish_arena_keep(i64 %160, i8* %161)
  call void @frame(i8* bitcast ({ i64, [25 x i8] }* @.str.57 to i8*), i8* %162)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.3, i32 3, i32 1, i1 true)
  store %struct.Screen* %Screen.obj.3, %struct.Screen** %p.addr, align 8
  %163 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %164 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %165 = call i32 @nish.rgb(i32 0, i32 0, i32 0)
  %166 = call i32 @nish.Screen.text(%struct.Screen* %163, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.58 to i8*), i32 %164, i32 %165, i32 0)
  %167 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %168 = call i64 @nish_arena_mark()
  %169 = call i8* @nish.Screen.flush(%struct.Screen* %167)
  %170 = call i8* @nish_arena_keep(i64 %168, i8* %169)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.59 to i8*), i8* %170)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.4, i32 3, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.4, %struct.Screen** %y.addr, align 8
  %171 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %172 = getelementptr inbounds %struct.Screen, %struct.Screen* %171, i32 0, i32 13
  store i1 true, i1* %172, align 1, !tbaa !26
  %173 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %174 = call i64 @nish_arena_mark()
  %175 = call i8* @nish.Screen.flush(%struct.Screen* %173)
  %176 = call i8* @nish_arena_keep(i64 %174, i8* %175)
  call void @frame(i8* bitcast ({ i64, [17 x i8] }* @.str.60 to i8*), i8* %176)
  %177 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %178 = call i64 @nish_arena_mark()
  %179 = call i8* @nish.Screen.flush(%struct.Screen* %177)
  %180 = call i8* @nish_arena_keep(i64 %178, i8* %179)
  %181 = bitcast i8* %180 to i64*
  %182 = load i64, i64* %181, align 8
  %183 = trunc i64 %182 to i32
  %184 = call i8* @nish_str_from_i32(i32 %183)
  %185 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.61 to i8*), i8* %184)
  call void @nish_print(i8* %185)
  %186 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %187 = load i32, i32* %red.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %186, i32 1, i32 0, i32 90, i32 %187, i32 -1, i32 0)
  %188 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %189 = call i64 @nish_arena_mark()
  %190 = call i8* @nish.Screen.flush(%struct.Screen* %188)
  %191 = call i8* @nish_arena_keep(i64 %189, i8* %190)
  call void @frame(i8* bitcast ({ i64, [21 x i8] }* @.str.62 to i8*), i8* %191)
  %192 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %193 = getelementptr inbounds %struct.Screen, %struct.Screen* %192, i32 0, i32 13
  store i1 false, i1* %193, align 1, !tbaa !26
  %194 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %194, i32 1, i32 0, i32 89, i32 -1, i32 -1, i32 0)
  %195 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %196 = call i64 @nish_arena_mark()
  %197 = call i8* @nish.Screen.flush(%struct.Screen* %195)
  %198 = call i8* @nish_arena_keep(i64 %196, i8* %197)
  call void @frame(i8* bitcast ({ i64, [16 x i8] }* @.str.63 to i8*), i8* %198)
  %199 = call i8* @nish_alloc_struct(i64 88)
  %200 = bitcast i8* %199 to %struct.Screen*
  call void @nish.Screen.constructor(%struct.Screen* %200, i32 4, i32 2, i1 false)
  store %struct.Screen* %200, %struct.Screen** %cs.addr, align 8
  %201 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  call void @nish.Canvas.constructor(%struct.Canvas* %Canvas.obj, %struct.Screen* %201)
  store %struct.Canvas* %Canvas.obj, %struct.Canvas** %c.addr, align 8
  %202 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %203 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %202, i32 0, i32 1
  %204 = load i32, i32* %203, align 4, !tbaa !28
  %205 = call i8* @nish_str_from_i32(i32 %204)
  %206 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.64 to i8*), i8* %205)
  %207 = call i8* @nish_str_concat(i8* %206, i8* bitcast ({ i64, [2 x i8] }* @.str.65 to i8*))
  %208 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %209 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %208, i32 0, i32 2
  %210 = load i32, i32* %209, align 4, !tbaa !29
  %211 = call i8* @nish_str_from_i32(i32 %210)
  %212 = call i8* @nish_str_concat(i8* %207, i8* %211)
  call void @nish_print(i8* %212)
  %213 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %214 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %213, i32 0, i32 0, i32 %214)
  %215 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %216 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %215, i32 1, i32 1, i32 %216)
  %217 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %218 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %217, i32 2, i32 0, i32 %218)
  %219 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %220 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %219, i32 2, i32 1, i32 %220)
  %221 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %222 = call i64 @nish_arena_mark()
  %223 = call i8* @nish.Screen.flush(%struct.Screen* %221)
  %224 = call i8* @nish_arena_keep(i64 %222, i8* %223)
  call void @frame(i8* bitcast ({ i64, [7 x i8] }* @.str.66 to i8*), i8* %224)
  %225 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %226 = call i32 @nish.rgb(i32 0, i32 255, i32 0)
  call void @nish.Canvas.fillRect(%struct.Canvas* %225, i32 0, i32 2, i32 4, i32 2, i32 %226)
  %227 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %228 = call i64 @nish_arena_mark()
  %229 = call i8* @nish.Screen.flush(%struct.Screen* %227)
  %230 = call i8* @nish_arena_keep(i64 %228, i8* %229)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.67 to i8*), i8* %230)
  %231 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  call void @nish.Canvas.clear(%struct.Canvas* %231, i32 -1)
  %232 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %233 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %232, i32 0, i32 0, i32 3, i32 3, i32 %233)
  %234 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %235 = call i64 @nish_arena_mark()
  %236 = call i8* @nish.Screen.flush(%struct.Screen* %234)
  %237 = call i8* @nish_arena_keep(i64 %235, i8* %236)
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.68 to i8*), i8* %237)
  %238 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %239 = call i32 @nish.Canvas.pixel(%struct.Canvas* %238, i32 1, i32 1)
  %240 = load i32, i32* %red.addr, align 4
  %241 = icmp eq i32 %239, %240
  %242 = select i1 %241, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %243 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.69 to i8*), i8* %242)
  %244 = call i8* @nish_str_concat(i8* %243, i8* bitcast ({ i64, [8 x i8] }* @.str.70 to i8*))
  %245 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %246 = call i32 @nish.Canvas.pixel(%struct.Canvas* %245, i32 1, i32 2)
  %247 = icmp eq i32 %246, -1
  %248 = select i1 %247, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %249 = call i8* @nish_str_concat(i8* %244, i8* %248)
  %250 = call i8* @nish_str_concat(i8* %249, i8* bitcast ({ i64, [6 x i8] }* @.str.71 to i8*))
  %251 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %252 = call i32 @nish.Canvas.pixel(%struct.Canvas* %251, i32 9, i32 0)
  %253 = call i8* @nish_str_from_i32(i32 %252)
  %254 = call i8* @nish_str_concat(i8* %250, i8* %253)
  call void @nish_print(i8* %254)
  %255 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  call void @nish.Canvas.clear(%struct.Canvas* %255, i32 -1)
  %256 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %257 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %256, i32 1, i32 0, i32 2000000000, i32 1, i32 %257)
  %258 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %259 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %258, i32 3, i32 3, i32 -2000000000, i32 -1000000000, i32 %259)
  %260 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %261 = call i64 @nish_arena_mark()
  %262 = call i8* @nish.Screen.flush(%struct.Screen* %260)
  %263 = call i8* @nish_arena_keep(i64 %261, i8* %262)
  call void @frame(i8* bitcast ({ i64, [40 x i8] }* @.str.72 to i8*), i8* %263)
  %264 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %265 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.fillRect(%struct.Canvas* %264, i32 -2, i32 -2, i32 100, i32 100, i32 %265)
  %266 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %267 = load i32, i32* %red.addr, align 4
  %268 = call i32 @nish.Canvas.text(%struct.Canvas* %266, i32 1, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.73 to i8*), i32 %267)
  %269 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %270 = call i64 @nish_arena_mark()
  %271 = call i8* @nish.Screen.flush(%struct.Screen* %269)
  %272 = call i8* @nish_arena_keep(i64 %270, i8* %271)
  call void @frame(i8* bitcast ({ i64, [17 x i8] }* @.str.74 to i8*), i8* %272)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.5, i32 8, i32 2, i1 false)
  store %struct.Screen* %Screen.obj.5, %struct.Screen** %game.addr, align 8
  store i32 0, i32* %sent.addr, align 4
  store i32 0, i32* %f.addr, align 4
  br label %for.cond

for.cond:
  %273 = load i32, i32* %f.addr, align 4
  %274 = icmp slt i32 %273, 1000
  br i1 %274, label %for.body, label %for.end

for.body:
  %275 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %276 = load i8*, i8** %275, align 8
  %277 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %278 = load i64, i64* %277, align 8
  %279 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %280 = load i32, i32* %f.addr, align 4
  %281 = srem i32 %280, 8
  %282 = load i32, i32* %f.addr, align 4
  %283 = srem i32 %282, 2
  %284 = load i32, i32* %f.addr, align 4
  %285 = srem i32 %284, 26
  %286 = add nsw i32 65, %285
  %287 = load i32, i32* %f.addr, align 4
  %288 = srem i32 %287, 256
  %289 = call i32 @nish.rgb(i32 %288, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %279, i32 %281, i32 %283, i32 %286, i32 %289, i32 -1, i32 0)
  %290 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %291 = call i64 @nish_arena_mark()
  %292 = call i8* @nish.Screen.flush(%struct.Screen* %290)
  %293 = call i8* @nish_arena_keep(i64 %291, i8* %292)
  store i8* %293, i8** %out.addr, align 8
  %294 = load i32, i32* %sent.addr, align 4
  %295 = load i8*, i8** %out.addr, align 8
  %296 = bitcast i8* %295 to i64*
  %297 = load i64, i64* %296, align 8
  %298 = trunc i64 %297 to i32
  %299 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %294, i32 %298)
  %300 = extractvalue { i32, i1 } %299, 0
  %301 = extractvalue { i32, i1 } %299, 1
  br i1 %301, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %300, i32* %sent.addr, align 4
  %302 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %303 = load i8*, i8** %302, align 8
  %304 = icmp eq i8* %303, %276
  br i1 %304, label %pass.rewind, label %pass.free

pass.rewind:
  %305 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %278, i64* %305, align 8
  br label %pass.done

pass.free:
  %306 = ptrtoint i8* %276 to i64
  %307 = add i64 %306, %278
  call void @nish_arena_release(i64 %307)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %308 = load i32, i32* %f.addr, align 4
  %309 = add nsw i32 %308, 1
  store i32 %309, i32* %f.addr, align 4
  br label %for.cond

for.end:
  %310 = load i32, i32* %sent.addr, align 4
  %311 = call i8* @nish_str_from_i32(i32 %310)
  %312 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.75 to i8*), i8* %311)
  %313 = call i8* @nish_str_concat(i8* %312, i8* bitcast ({ i64, [7 x i8] }* @.str.76 to i8*))
  call void @nish_print(i8* %313)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj, i32 250, i32 8)
  store %struct.FixedStep* %FixedStep.obj, %struct.FixedStep** %logic.addr, align 8
  %314 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %314, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %315 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %315, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %316 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %316, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %steps.addr, align 8
  %317 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %318 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %319 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %318, double 0x408F400000000000)
  %320 = call i8* @nish_str_from_i32(i32 %319)
  %321 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %317, i64 0, i32 0
  %322 = load i64, i64* %321, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %323 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %317, i64 0, i32 1
  %324 = load i64, i64* %323, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %325 = icmp eq i64 %322, %324
  br i1 %325, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %317, i64 8)
  br label %push.store

push.store:
  %326 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %317, i64 0, i32 2
  %327 = load i8*, i8** %326, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %328 = bitcast i8* %327 to i8**
  %329 = getelementptr inbounds i8*, i8** %328, i64 %322
  store i8* %320, i8** %329, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %330 = add i64 %322, 1
  store i64 %330, i64* %321, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %331 = trunc i64 %330 to i32
  %332 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %333 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %334 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %333, double 0x408F580000000000)
  %335 = call i8* @nish_str_from_i32(i32 %334)
  %336 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %332, i64 0, i32 0
  %337 = load i64, i64* %336, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %338 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %332, i64 0, i32 1
  %339 = load i64, i64* %338, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %340 = icmp eq i64 %337, %339
  br i1 %340, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %332, i64 8)
  br label %push.store.1

push.store.1:
  %341 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %332, i64 0, i32 2
  %342 = load i8*, i8** %341, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %343 = bitcast i8* %342 to i8**
  %344 = getelementptr inbounds i8*, i8** %343, i64 %337
  store i8* %335, i8** %344, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %345 = add i64 %337, 1
  store i64 %345, i64* %336, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %346 = trunc i64 %345 to i32
  %347 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %348 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %349 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %348, double 0x408F880000000000)
  %350 = call i8* @nish_str_from_i32(i32 %349)
  %351 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %347, i64 0, i32 0
  %352 = load i64, i64* %351, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %353 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %347, i64 0, i32 1
  %354 = load i64, i64* %353, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %355 = icmp eq i64 %352, %354
  br i1 %355, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %347, i64 8)
  br label %push.store.2

push.store.2:
  %356 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %347, i64 0, i32 2
  %357 = load i8*, i8** %356, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %358 = bitcast i8* %357 to i8**
  %359 = getelementptr inbounds i8*, i8** %358, i64 %352
  store i8* %350, i8** %359, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %360 = add i64 %352, 1
  store i64 %360, i64* %351, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %361 = trunc i64 %360 to i32
  %362 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %363 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %364 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %363, double 0x408F880000000000)
  %365 = call i8* @nish_str_from_i32(i32 %364)
  %366 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %362, i64 0, i32 0
  %367 = load i64, i64* %366, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %368 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %362, i64 0, i32 1
  %369 = load i64, i64* %368, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %370 = icmp eq i64 %367, %369
  br i1 %370, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %362, i64 8)
  br label %push.store.3

push.store.3:
  %371 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %362, i64 0, i32 2
  %372 = load i8*, i8** %371, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %373 = bitcast i8* %372 to i8**
  %374 = getelementptr inbounds i8*, i8** %373, i64 %367
  store i8* %365, i8** %374, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %375 = add i64 %367, 1
  store i64 %375, i64* %366, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %376 = trunc i64 %375 to i32
  %377 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %378 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %379 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %378, double 0x4090680000000000)
  %380 = call i8* @nish_str_from_i32(i32 %379)
  %381 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %377, i64 0, i32 0
  %382 = load i64, i64* %381, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %383 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %377, i64 0, i32 1
  %384 = load i64, i64* %383, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %385 = icmp eq i64 %382, %384
  br i1 %385, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %377, i64 8)
  br label %push.store.4

push.store.4:
  %386 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %377, i64 0, i32 2
  %387 = load i8*, i8** %386, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %388 = bitcast i8* %387 to i8**
  %389 = getelementptr inbounds i8*, i8** %388, i64 %382
  store i8* %380, i8** %389, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %390 = add i64 %382, 1
  store i64 %390, i64* %381, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %391 = trunc i64 %390 to i32
  %392 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %393 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %394 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %393, double 0x4090400000000000)
  %395 = call i8* @nish_str_from_i32(i32 %394)
  %396 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %392, i64 0, i32 0
  %397 = load i64, i64* %396, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %398 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %392, i64 0, i32 1
  %399 = load i64, i64* %398, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %400 = icmp eq i64 %397, %399
  br i1 %400, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %392, i64 8)
  br label %push.store.5

push.store.5:
  %401 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %392, i64 0, i32 2
  %402 = load i8*, i8** %401, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %403 = bitcast i8* %402 to i8**
  %404 = getelementptr inbounds i8*, i8** %403, i64 %397
  store i8* %395, i8** %404, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %405 = add i64 %397, 1
  store i64 %405, i64* %396, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %406 = trunc i64 %405 to i32
  %407 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %408 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %409 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %408, double 0x4090540000000000)
  %410 = call i8* @nish_str_from_i32(i32 %409)
  %411 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %407, i64 0, i32 0
  %412 = load i64, i64* %411, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %413 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %407, i64 0, i32 1
  %414 = load i64, i64* %413, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %415 = icmp eq i64 %412, %414
  br i1 %415, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %407, i64 8)
  br label %push.store.6

push.store.6:
  %416 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %407, i64 0, i32 2
  %417 = load i8*, i8** %416, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %418 = bitcast i8* %417 to i8**
  %419 = getelementptr inbounds i8*, i8** %418, i64 %412
  store i8* %410, i8** %419, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %420 = add i64 %412, 1
  store i64 %420, i64* %411, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %421 = trunc i64 %420 to i32
  %422 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %423 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %422, i64 0, i32 0
  %424 = load i64, i64* %423, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %425 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*) to i64*
  %426 = load i64, i64* %425, align 8
  %427 = sub i64 %424, 1
  %428 = mul i64 %426, %427
  %429 = icmp eq i64 %424, 0
  %430 = select i1 %429, i64 0, i64 %428
  store i64 %430, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %431 = load i64, i64* %join.at, align 8
  %432 = icmp ult i64 %431, %424
  br i1 %432, label %join.sum.body, label %join.copy

join.sum.body:
  %433 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %422, i64 0, i32 2
  %434 = load i8*, i8** %433, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %435 = bitcast i8* %434 to i8**
  %436 = getelementptr inbounds i8*, i8** %435, i64 %431
  %437 = load i8*, i8** %436, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %438 = load i64, i64* %join.total, align 8
  %439 = bitcast i8* %437 to i64*
  %440 = load i64, i64* %439, align 8
  %441 = add i64 %438, %440
  store i64 %441, i64* %join.total, align 8
  %442 = add i64 %431, 1
  store i64 %442, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %443 = load i64, i64* %join.total, align 8
  %444 = icmp ugt i64 %443, 2147483647
  %445 = add i64 %443, 9
  %446 = select i1 %444, i64 4611686018427387904, i64 %445
  %447 = call i8* @nish_alloc_struct(i64 %446)
  %448 = bitcast i8* %447 to i64*
  store i64 %443, i64* %448, align 8
  %449 = getelementptr inbounds i8, i8* %447, i64 8
  store i8* %449, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %450 = load i64, i64* %join.at, align 8
  %451 = icmp ult i64 %450, %424
  br i1 %451, label %join.part, label %join.end

join.part:
  %452 = load i8*, i8** %join.p, align 8
  %453 = icmp eq i64 %450, 0
  %454 = select i1 %453, i64 0, i64 %426
  %455 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %452, i8* %455, i64 %454, i1 false)
  %456 = getelementptr inbounds i8, i8* %452, i64 %454
  %457 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %422, i64 0, i32 2
  %458 = load i8*, i8** %457, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %459 = bitcast i8* %458 to i8**
  %460 = getelementptr inbounds i8*, i8** %459, i64 %450
  %461 = load i8*, i8** %460, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %462 = bitcast i8* %461 to i64*
  %463 = load i64, i64* %462, align 8
  %464 = getelementptr inbounds i8, i8* %461, i64 8
  %465 = icmp eq i64 %463, 1
  br i1 %465, label %join.byte, label %join.bulk

join.byte:
  %466 = load i8, i8* %464, align 1
  store i8 %466, i8* %456, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %456, i8* %464, i64 %463, i1 false)
  br label %join.next

join.next:
  %467 = getelementptr inbounds i8, i8* %456, i64 %463
  store i8* %467, i8** %join.p, align 8
  %468 = add i64 %450, 1
  store i64 %468, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %469 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %469, align 1
  %470 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.77 to i8*), i8* %447)
  %471 = call i8* @nish_str_concat(i8* %470, i8* bitcast ({ i64, [8 x i8] }* @.str.78 to i8*))
  %472 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %473 = call double @nish.FixedStep.alpha(%struct.FixedStep* %472)
  %474 = fmul double %473, 0x4059000000000000
  %475 = call double @nish_floor(double %474)
  %476 = call i8* @nish_str_from_f64(double %475)
  %477 = call i8* @nish_str_concat(i8* %471, i8* %476)
  %478 = call i8* @nish_str_concat(i8* %477, i8* bitcast ({ i64, [2 x i8] }* @.str.79 to i8*))
  call void @nish_print(i8* %478)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.1, i32 100, i32 3)
  store %struct.FixedStep* %FixedStep.obj.1, %struct.FixedStep** %behind.addr, align 8
  %479 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %480 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %479, double 0x0000000000000000)
  %481 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %482 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %481, double 0x408F680000000000)
  store i32 %482, i32* %caught.addr, align 4
  %483 = load i32, i32* %caught.addr, align 4
  %484 = call i8* @nish_str_from_i32(i32 %483)
  %485 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.80 to i8*), i8* %484)
  %486 = call i8* @nish_str_concat(i8* %485, i8* bitcast ({ i64, [29 x i8] }* @.str.81 to i8*))
  %487 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %488 = call double @nish.FixedStep.alpha(%struct.FixedStep* %487)
  %489 = fmul double %488, 0x4059000000000000
  %490 = call double @nish_floor(double %489)
  %491 = call i8* @nish_str_from_f64(double %490)
  %492 = call i8* @nish_str_concat(i8* %486, i8* %491)
  %493 = call i8* @nish_str_concat(i8* %492, i8* bitcast ({ i64, [2 x i8] }* @.str.79 to i8*))
  call void @nish_print(i8* %493)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.2, i32 100, i32 1)
  store %struct.FixedStep* %FixedStep.obj.2, %struct.FixedStep** %draw.addr, align 8
  store i32 0, i32* %frames.addr, align 4
  %494 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %495 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %494, double 0x0000000000000000)
  store i32 1, i32* %ms.addr, align 4
  br label %for.cond.1

for.cond.1:
  %496 = load i32, i32* %ms.addr, align 4
  %497 = icmp sle i32 %496, 1000
  br i1 %497, label %for.body.1, label %for.end.1

for.body.1:
  %498 = load i32, i32* %frames.addr, align 4
  %499 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %500 = load i32, i32* %ms.addr, align 4
  %501 = sitofp i32 %500 to double
  %502 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %499, double %501)
  %503 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %498, i32 %502)
  %504 = extractvalue { i32, i1 } %503, 0
  %505 = extractvalue { i32, i1 } %503, 1
  br i1 %505, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %504, i32* %frames.addr, align 4
  br label %for.inc.1

for.inc.1:
  %506 = load i32, i32* %ms.addr, align 4
  %507 = add nsw i32 %506, 1
  store i32 %507, i32* %ms.addr, align 4
  br label %for.cond.1

for.end.1:
  %508 = load i32, i32* %frames.addr, align 4
  %509 = call i8* @nish_str_from_i32(i32 %508)
  %510 = call i8* @nish_str_concat(i8* bitcast ({ i64, [50 x i8] }* @.str.82 to i8*), i8* %509)
  %511 = call i8* @nish_str_concat(i8* %510, i8* bitcast ({ i64, [8 x i8] }* @.str.83 to i8*))
  call void @nish_print(i8* %511)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.3, i32 0, i32 0)
  store %struct.FixedStep* %FixedStep.obj.3, %struct.FixedStep** %odd.addr, align 8
  %512 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %513 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %512, i32 0, i32 0
  %514 = load double, double* %513, align 8, !tbaa !32
  %515 = call i8* @nish_str_from_f64(double %514)
  %516 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.84 to i8*), i8* %515)
  %517 = call i8* @nish_str_concat(i8* %516, i8* bitcast ({ i64, [14 x i8] }* @.str.85 to i8*))
  %518 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %519 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %518, i32 0, i32 3
  %520 = load i32, i32* %519, align 4, !tbaa !33
  %521 = call i8* @nish_str_from_i32(i32 %520)
  %522 = call i8* @nish_str_concat(i8* %517, i8* %521)
  call void @nish_print(i8* %522)
  call void @nish.KeyDecoder.constructor(%struct.KeyDecoder* %KeyDecoder.obj, double 0x403E000000000000)
  store %struct.KeyDecoder* %KeyDecoder.obj, %struct.KeyDecoder** %d.addr, align 8
  %523 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %524 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 12, i64* %524, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %525 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 12, i64* %525, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %526 = bitcast [12 x i32]* %arr.data to i8*
  %527 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %526, i8** %527, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %528 = bitcast i8* %526 to i32*
  %529 = getelementptr inbounds i32, i32* %528, i64 0
  store i32 27, i32* %529, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %530 = getelementptr inbounds i32, i32* %528, i64 1
  store i32 91, i32* %530, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %531 = getelementptr inbounds i32, i32* %528, i64 2
  store i32 65, i32* %531, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %532 = getelementptr inbounds i32, i32* %528, i64 3
  store i32 27, i32* %532, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %533 = getelementptr inbounds i32, i32* %528, i64 4
  store i32 91, i32* %533, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %534 = getelementptr inbounds i32, i32* %528, i64 5
  store i32 66, i32* %534, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %535 = getelementptr inbounds i32, i32* %528, i64 6
  store i32 27, i32* %535, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %536 = getelementptr inbounds i32, i32* %528, i64 7
  store i32 79, i32* %536, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %537 = getelementptr inbounds i32, i32* %528, i64 8
  store i32 67, i32* %537, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %538 = getelementptr inbounds i32, i32* %528, i64 9
  store i32 27, i32* %538, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %539 = getelementptr inbounds i32, i32* %528, i64 10
  store i32 79, i32* %539, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %540 = getelementptr inbounds i32, i32* %528, i64 11
  store i32 68, i32* %540, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %541 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.1)
  %542 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %523, %struct.nish_array* %541, i32 12, double 0x0000000000000000)
  %543 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.86 to i8*), %struct.nish_array* %542, %struct.KeyDecoder* %543)
  %544 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %545 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %545, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %546 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %546, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %547 = bitcast [8 x i32]* %arr.data.1 to i8*
  %548 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %547, i8** %548, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %549 = bitcast i8* %547 to i32*
  %550 = getelementptr inbounds i32, i32* %549, i64 0
  store i32 3, i32* %550, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %551 = getelementptr inbounds i32, i32* %549, i64 1
  store i32 13, i32* %551, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %552 = getelementptr inbounds i32, i32* %549, i64 2
  store i32 10, i32* %552, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %553 = getelementptr inbounds i32, i32* %549, i64 3
  store i32 32, i32* %553, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %554 = getelementptr inbounds i32, i32* %549, i64 4
  store i32 9, i32* %554, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %555 = getelementptr inbounds i32, i32* %549, i64 5
  store i32 127, i32* %555, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %556 = getelementptr inbounds i32, i32* %549, i64 6
  store i32 8, i32* %556, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %557 = getelementptr inbounds i32, i32* %549, i64 7
  store i32 1, i32* %557, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %558 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.2)
  %559 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %544, %struct.nish_array* %558, i32 8, double 0x0000000000000000)
  %560 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [9 x i8] }* @.str.87 to i8*), %struct.nish_array* %559, %struct.KeyDecoder* %560)
  %561 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %562 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %562, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %563 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %563, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %564 = bitcast [8 x i32]* %arr.data.2 to i8*
  %565 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %564, i8** %565, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %566 = bitcast i8* %564 to i32*
  %567 = getelementptr inbounds i32, i32* %566, i64 0
  store i32 113, i32* %567, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %568 = getelementptr inbounds i32, i32* %566, i64 1
  store i32 81, i32* %568, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %569 = getelementptr inbounds i32, i32* %566, i64 2
  store i32 126, i32* %569, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %570 = getelementptr inbounds i32, i32* %566, i64 3
  store i32 195, i32* %570, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %571 = getelementptr inbounds i32, i32* %566, i64 4
  store i32 169, i32* %571, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %572 = getelementptr inbounds i32, i32* %566, i64 5
  store i32 226, i32* %572, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %573 = getelementptr inbounds i32, i32* %566, i64 6
  store i32 150, i32* %573, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %574 = getelementptr inbounds i32, i32* %566, i64 7
  store i32 128, i32* %574, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %575 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.3)
  %576 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %561, %struct.nish_array* %575, i32 8, double 0x0000000000000000)
  %577 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [10 x i8] }* @.str.88 to i8*), %struct.nish_array* %576, %struct.KeyDecoder* %577)
  %578 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %579 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %579, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %580 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %580, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %581 = bitcast [3 x i32]* %arr.data.3 to i8*
  %582 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %581, i8** %582, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %583 = bitcast i8* %581 to i32*
  %584 = getelementptr inbounds i32, i32* %583, i64 0
  store i32 97, i32* %584, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %585 = getelementptr inbounds i32, i32* %583, i64 1
  store i32 98, i32* %585, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %586 = getelementptr inbounds i32, i32* %583, i64 2
  store i32 99, i32* %586, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %587 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.4)
  %588 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %578, %struct.nish_array* %587, i32 1, double 0x0000000000000000)
  %589 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.89 to i8*), %struct.nish_array* %588, %struct.KeyDecoder* %589)
  %590 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %591 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 1, i64* %591, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %592 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 1, i64* %592, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %593 = bitcast [1 x i32]* %arr.data.4 to i8*
  %594 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %593, i8** %594, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %595 = bitcast i8* %593 to i32*
  %596 = getelementptr inbounds i32, i32* %595, i64 0
  store i32 27, i32* %596, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %597 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.5)
  %598 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %590, %struct.nish_array* %597, i32 1, double 0x4059000000000000)
  %599 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.90 to i8*), %struct.nish_array* %598, %struct.KeyDecoder* %599)
  %600 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %601 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 2, i64* %601, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %602 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 2, i64* %602, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %603 = bitcast [2 x i32]* %arr.data.5 to i8*
  %604 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %603, i8** %604, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %605 = bitcast i8* %603 to i32*
  %606 = getelementptr inbounds i32, i32* %605, i64 0
  store i32 91, i32* %606, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %607 = getelementptr inbounds i32, i32* %605, i64 1
  store i32 65, i32* %607, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %608 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.6)
  %609 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %600, %struct.nish_array* %608, i32 2, double 0x405B800000000000)
  %610 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.91 to i8*), %struct.nish_array* %609, %struct.KeyDecoder* %610)
  %611 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %612 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 2, i64* %612, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %613 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 2, i64* %613, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %614 = bitcast [2 x i32]* %arr.data.6 to i8*
  %615 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %614, i8** %615, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %616 = bitcast i8* %614 to i32*
  %617 = getelementptr inbounds i32, i32* %616, i64 0
  store i32 27, i32* %617, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %618 = getelementptr inbounds i32, i32* %616, i64 1
  store i32 91, i32* %618, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %619 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.7)
  %620 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %611, %struct.nish_array* %619, i32 2, double 0x4069000000000000)
  %621 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.92 to i8*), %struct.nish_array* %620, %struct.KeyDecoder* %621)
  %622 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %623 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 1, i64* %623, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %624 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 1, i64* %624, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %625 = bitcast [1 x i32]* %arr.data.7 to i8*
  %626 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %625, i8** %626, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %627 = bitcast i8* %625 to i32*
  %628 = getelementptr inbounds i32, i32* %627, i64 0
  store i32 66, i32* %628, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %629 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.8)
  %630 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %622, %struct.nish_array* %629, i32 1, double 0x406A400000000000)
  %631 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.93 to i8*), %struct.nish_array* %630, %struct.KeyDecoder* %631)
  %632 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %633 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 0
  store i64 2, i64* %633, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %634 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 1
  store i64 2, i64* %634, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %635 = bitcast [2 x i32]* %arr.data.8 to i8*
  %636 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 2
  store i8* %635, i8** %636, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %637 = bitcast i8* %635 to i32*
  %638 = getelementptr inbounds i32, i32* %637, i64 0
  store i32 27, i32* %638, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %639 = getelementptr inbounds i32, i32* %637, i64 1
  store i32 79, i32* %639, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %640 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.9)
  %641 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %632, %struct.nish_array* %640, i32 2, double 0x4072C00000000000)
  %642 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.94 to i8*), %struct.nish_array* %641, %struct.KeyDecoder* %642)
  %643 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %644 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 0
  store i64 1, i64* %644, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %645 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 1
  store i64 1, i64* %645, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %646 = bitcast [1 x i32]* %arr.data.9 to i8*
  %647 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 2
  store i8* %646, i8** %647, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %648 = bitcast i8* %646 to i32*
  %649 = getelementptr inbounds i32, i32* %648, i64 0
  store i32 67, i32* %649, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %650 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.10)
  %651 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %643, %struct.nish_array* %650, i32 1, double 0x4073100000000000)
  %652 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.95 to i8*), %struct.nish_array* %651, %struct.KeyDecoder* %652)
  %653 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %654 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 0
  store i64 6, i64* %654, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %655 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 1
  store i64 6, i64* %655, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %656 = bitcast [6 x i32]* %arr.data.10 to i8*
  %657 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 2
  store i8* %656, i8** %657, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %658 = bitcast i8* %656 to i32*
  %659 = getelementptr inbounds i32, i32* %658, i64 0
  store i32 27, i32* %659, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %660 = getelementptr inbounds i32, i32* %658, i64 1
  store i32 91, i32* %660, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %661 = getelementptr inbounds i32, i32* %658, i64 2
  store i32 49, i32* %661, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %662 = getelementptr inbounds i32, i32* %658, i64 3
  store i32 59, i32* %662, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %663 = getelementptr inbounds i32, i32* %658, i64 4
  store i32 53, i32* %663, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %664 = getelementptr inbounds i32, i32* %658, i64 5
  store i32 65, i32* %664, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %665 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.11)
  %666 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %653, %struct.nish_array* %665, i32 6, double 0x4079000000000000)
  %667 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.96 to i8*), %struct.nish_array* %666, %struct.KeyDecoder* %667)
  %668 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %669 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 0
  store i64 4, i64* %669, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %670 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 1
  store i64 4, i64* %670, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %671 = bitcast [4 x i32]* %arr.data.11 to i8*
  %672 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 2
  store i8* %671, i8** %672, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %673 = bitcast i8* %671 to i32*
  %674 = getelementptr inbounds i32, i32* %673, i64 0
  store i32 27, i32* %674, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %675 = getelementptr inbounds i32, i32* %673, i64 1
  store i32 91, i32* %675, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %676 = getelementptr inbounds i32, i32* %673, i64 2
  store i32 51, i32* %676, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %677 = getelementptr inbounds i32, i32* %673, i64 3
  store i32 126, i32* %677, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %678 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.12)
  %679 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %668, %struct.nish_array* %678, i32 4, double 0x4079000000000000)
  %680 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.97 to i8*), %struct.nish_array* %679, %struct.KeyDecoder* %680)
  %681 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %682 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 0
  store i64 1, i64* %682, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %683 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 1
  store i64 1, i64* %683, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %684 = bitcast [1 x i32]* %arr.data.12 to i8*
  %685 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 2
  store i8* %684, i8** %685, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %686 = bitcast i8* %684 to i32*
  %687 = getelementptr inbounds i32, i32* %686, i64 0
  store i32 27, i32* %687, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %688 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.13)
  %689 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %681, %struct.nish_array* %688, i32 1, double 0x407F400000000000)
  %690 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [16 x i8] }* @.str.98 to i8*), %struct.nish_array* %689, %struct.KeyDecoder* %690)
  %691 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %692 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %691, double 0x4080400000000000)
  %693 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.99 to i8*), %struct.nish_array* %692, %struct.KeyDecoder* %693)
  %694 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %695 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %694, double 0x4080900000000000)
  %696 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.100 to i8*), %struct.nish_array* %695, %struct.KeyDecoder* %696)
  %697 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %698 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 0
  store i64 2, i64* %698, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %699 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 1
  store i64 2, i64* %699, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %700 = bitcast [2 x i32]* %arr.data.13 to i8*
  %701 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 2
  store i8* %700, i8** %701, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %702 = bitcast i8* %700 to i32*
  %703 = getelementptr inbounds i32, i32* %702, i64 0
  store i32 27, i32* %703, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %704 = getelementptr inbounds i32, i32* %702, i64 1
  store i32 120, i32* %704, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %705 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.14)
  %706 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %697, %struct.nish_array* %705, i32 2, double 0x4082C00000000000)
  %707 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.101 to i8*), %struct.nish_array* %706, %struct.KeyDecoder* %707)
  %708 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %709 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 0
  store i64 4, i64* %709, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %710 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 1
  store i64 4, i64* %710, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %711 = bitcast [4 x i32]* %arr.data.14 to i8*
  %712 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 2
  store i8* %711, i8** %712, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %713 = bitcast i8* %711 to i32*
  %714 = getelementptr inbounds i32, i32* %713, i64 0
  store i32 27, i32* %714, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %715 = getelementptr inbounds i32, i32* %713, i64 1
  store i32 27, i32* %715, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %716 = getelementptr inbounds i32, i32* %713, i64 2
  store i32 91, i32* %716, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %717 = getelementptr inbounds i32, i32* %713, i64 3
  store i32 65, i32* %717, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %718 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.15)
  %719 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %708, %struct.nish_array* %718, i32 4, double 0x4082C00000000000)
  %720 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.102 to i8*), %struct.nish_array* %719, %struct.KeyDecoder* %720)
  %721 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %722 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 0
  store i64 1, i64* %722, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %723 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 1
  store i64 1, i64* %723, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %724 = bitcast [1 x i32]* %arr.data.15 to i8*
  %725 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 2
  store i8* %724, i8** %725, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %726 = bitcast i8* %724 to i32*
  %727 = getelementptr inbounds i32, i32* %726, i64 0
  store i32 27, i32* %727, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %728 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.16)
  %729 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %721, %struct.nish_array* %728, i32 1, double 0x4085E00000000000)
  %730 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [36 x i8] }* @.str.103 to i8*), %struct.nish_array* %729, %struct.KeyDecoder* %730)
  %731 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %732 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 0
  store i64 1, i64* %732, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %733 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 1
  store i64 1, i64* %733, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %734 = bitcast [1 x i32]* %arr.data.16 to i8*
  %735 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 2
  store i8* %734, i8** %735, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %736 = bitcast i8* %734 to i32*
  %737 = getelementptr inbounds i32, i32* %736, i64 0
  store i32 120, i32* %737, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %738 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.17)
  %739 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %731, %struct.nish_array* %738, i32 1, double 0x4089000000000000)
  %740 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.104 to i8*), %struct.nish_array* %739, %struct.KeyDecoder* %740)
  %741 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %742 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 0
  store i64 1, i64* %742, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %743 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 1
  store i64 1, i64* %743, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %744 = bitcast [1 x i32]* %arr.data.17 to i8*
  %745 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 2
  store i8* %744, i8** %745, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %746 = bitcast i8* %744 to i32*
  %747 = getelementptr inbounds i32, i32* %746, i64 0
  store i32 195, i32* %747, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %748 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.18)
  %749 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %741, %struct.nish_array* %748, i32 1, double 0x408C200000000000)
  %750 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.105 to i8*), %struct.nish_array* %749, %struct.KeyDecoder* %750)
  %751 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %752 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 0
  store i64 1, i64* %752, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %753 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 1
  store i64 1, i64* %753, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %754 = bitcast [1 x i32]* %arr.data.18 to i8*
  %755 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 2
  store i8* %754, i8** %755, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %756 = bitcast i8* %754 to i32*
  %757 = getelementptr inbounds i32, i32* %756, i64 0
  store i32 169, i32* %757, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %758 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.19)
  %759 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %751, %struct.nish_array* %758, i32 1, double 0x408C280000000000)
  %760 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.106 to i8*), %struct.nish_array* %759, %struct.KeyDecoder* %760)
  %761 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %762 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 0
  store i64 2, i64* %762, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %763 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 1
  store i64 2, i64* %763, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %764 = bitcast [2 x i32]* %arr.data.19 to i8*
  %765 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 2
  store i8* %764, i8** %765, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %766 = bitcast i8* %764 to i32*
  %767 = getelementptr inbounds i32, i32* %766, i64 0
  store i32 226, i32* %767, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %768 = getelementptr inbounds i32, i32* %766, i64 1
  store i32 150, i32* %768, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %769 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.20)
  %770 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %761, %struct.nish_array* %769, i32 2, double 0x408F400000000000)
  %771 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.107 to i8*), %struct.nish_array* %770, %struct.KeyDecoder* %771)
  %772 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %773 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %772, double 0x4091300000000000)
  %774 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.108 to i8*), %struct.nish_array* %773, %struct.KeyDecoder* %774)
  %775 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %776 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 0
  store i64 3, i64* %776, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %777 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 1
  store i64 3, i64* %777, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %778 = bitcast [3 x i32]* %arr.data.20 to i8*
  %779 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 2
  store i8* %778, i8** %779, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %780 = bitcast i8* %778 to i32*
  %781 = getelementptr inbounds i32, i32* %780, i64 0
  store i32 255, i32* %781, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %782 = getelementptr inbounds i32, i32* %780, i64 1
  store i32 128, i32* %782, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %783 = getelementptr inbounds i32, i32* %780, i64 2
  store i32 97, i32* %783, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %784 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.21)
  %785 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %775, %struct.nish_array* %784, i32 3, double 0x4092C00000000000)
  %786 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [14 x i8] }* @.str.109 to i8*), %struct.nish_array* %785, %struct.KeyDecoder* %786)
  %787 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %788 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 0
  store i64 3, i64* %788, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %789 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 1
  store i64 3, i64* %789, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %790 = bitcast [3 x i32]* %arr.data.21 to i8*
  %791 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 2
  store i8* %790, i8** %791, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %792 = bitcast i8* %790 to i32*
  %793 = getelementptr inbounds i32, i32* %792, i64 0
  store i32 226, i32* %793, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %794 = getelementptr inbounds i32, i32* %792, i64 1
  store i32 150, i32* %794, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %795 = getelementptr inbounds i32, i32* %792, i64 2
  store i32 97, i32* %795, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %796 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.22)
  %797 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %787, %struct.nish_array* %796, i32 3, double 0x4093880000000000)
  %798 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [33 x i8] }* @.str.110 to i8*), %struct.nish_array* %797, %struct.KeyDecoder* %798)
  %799 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %800 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 0
  store i64 0, i64* %800, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %801 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 1
  store i64 0, i64* %801, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %802 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 2
  store i8* null, i8** %802, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %803 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.23)
  %804 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %799, %struct.nish_array* %803, i32 0, double 0x4094500000000000)
  %805 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.111 to i8*), %struct.nish_array* %804, %struct.KeyDecoder* %805)
  %806 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %807 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 0
  store i64 1, i64* %807, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %808 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 1
  store i64 1, i64* %808, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %809 = bitcast [1 x i32]* %arr.data.22 to i8*
  %810 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 2
  store i8* %809, i8** %810, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %811 = bitcast i8* %809 to i32*
  %812 = getelementptr inbounds i32, i32* %811, i64 0
  store i32 27, i32* %812, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %813 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.24)
  %814 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %806, %struct.nish_array* %813, i32 1, double 0x409F400000000000)
  %815 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.112 to i8*), %struct.nish_array* %814, %struct.KeyDecoder* %815)
  %816 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %817 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 0
  store i64 1, i64* %817, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %818 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 1
  store i64 1, i64* %818, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %819 = bitcast [1 x i32]* %arr.data.23 to i8*
  %820 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 2
  store i8* %819, i8** %820, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %821 = bitcast i8* %819 to i32*
  %822 = getelementptr inbounds i32, i32* %821, i64 0
  store i32 91, i32* %822, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %823 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.25)
  %824 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %816, %struct.nish_array* %823, i32 1, double 0x409FA40000000000)
  %825 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [26 x i8] }* @.str.113 to i8*), %struct.nish_array* %824, %struct.KeyDecoder* %825)
  %826 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %827 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %826, double 0x409FCC0000000000)
  %828 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.114 to i8*), %struct.nish_array* %827, %struct.KeyDecoder* %828)
  %829 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %830 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 0
  store i64 3, i64* %830, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %831 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 1
  store i64 3, i64* %831, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %832 = bitcast [3 x i32]* %arr.data.24 to i8*
  %833 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 2
  store i8* %832, i8** %833, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %834 = bitcast i8* %832 to i32*
  %835 = getelementptr inbounds i32, i32* %834, i64 0
  store i32 27, i32* %835, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %836 = getelementptr inbounds i32, i32* %834, i64 1
  store i32 79, i32* %836, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %837 = getelementptr inbounds i32, i32* %834, i64 2
  store i32 10, i32* %837, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %838 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.26)
  %839 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %829, %struct.nish_array* %838, i32 3, double 0x40A0680000000000)
  %840 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.115 to i8*), %struct.nish_array* %839, %struct.KeyDecoder* %840)
  %841 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %842 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 0
  store i64 3, i64* %842, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %843 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 1
  store i64 3, i64* %843, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %844 = bitcast [3 x i32]* %arr.data.25 to i8*
  %845 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 2
  store i8* %844, i8** %845, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %846 = bitcast i8* %844 to i32*
  %847 = getelementptr inbounds i32, i32* %846, i64 0
  store i32 245, i32* %847, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %848 = getelementptr inbounds i32, i32* %846, i64 1
  store i32 128, i32* %848, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %849 = getelementptr inbounds i32, i32* %846, i64 2
  store i32 97, i32* %849, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %850 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.27)
  %851 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %841, %struct.nish_array* %850, i32 3, double 0x40A1300000000000)
  %852 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.116 to i8*), %struct.nish_array* %851, %struct.KeyDecoder* %852)
  %853 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %854 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 0
  store i64 4, i64* %854, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %855 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 1
  store i64 4, i64* %855, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %856 = bitcast [4 x i32]* %arr.data.26 to i8*
  %857 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 2
  store i8* %856, i8** %857, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %858 = bitcast i8* %856 to i32*
  %859 = getelementptr inbounds i32, i32* %858, i64 0
  store i32 194, i32* %859, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %860 = getelementptr inbounds i32, i32* %858, i64 1
  store i32 155, i32* %860, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %861 = getelementptr inbounds i32, i32* %858, i64 2
  store i32 194, i32* %861, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %862 = getelementptr inbounds i32, i32* %858, i64 3
  store i32 160, i32* %862, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %863 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.28)
  %864 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %853, %struct.nish_array* %863, i32 4, double 0x40A0CC0000000000)
  %865 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [24 x i8] }* @.str.117 to i8*), %struct.nish_array* %864, %struct.KeyDecoder* %865)
  %866 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %867 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 0
  store i64 10, i64* %867, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %868 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 1
  store i64 10, i64* %868, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %869 = bitcast [10 x i32]* %arr.data.27 to i8*
  %870 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 2
  store i8* %869, i8** %870, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %871 = bitcast i8* %869 to i32*
  %872 = getelementptr inbounds i32, i32* %871, i64 0
  store i32 224, i32* %872, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %873 = getelementptr inbounds i32, i32* %871, i64 1
  store i32 128, i32* %873, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %874 = getelementptr inbounds i32, i32* %871, i64 2
  store i32 128, i32* %874, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %875 = getelementptr inbounds i32, i32* %871, i64 3
  store i32 237, i32* %875, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %876 = getelementptr inbounds i32, i32* %871, i64 4
  store i32 160, i32* %876, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %877 = getelementptr inbounds i32, i32* %871, i64 5
  store i32 128, i32* %877, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %878 = getelementptr inbounds i32, i32* %871, i64 6
  store i32 244, i32* %878, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %879 = getelementptr inbounds i32, i32* %871, i64 7
  store i32 144, i32* %879, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %880 = getelementptr inbounds i32, i32* %871, i64 8
  store i32 128, i32* %880, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %881 = getelementptr inbounds i32, i32* %871, i64 9
  store i32 128, i32* %881, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %882 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.29)
  %883 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %866, %struct.nish_array* %882, i32 10, double 0x40A1300000000000)
  %884 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [30 x i8] }* @.str.118 to i8*), %struct.nish_array* %883, %struct.KeyDecoder* %884)
  %885 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %886 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.30, i64 0, i32 0
  store i64 4, i64* %886, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %887 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.30, i64 0, i32 1
  store i64 4, i64* %887, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %888 = bitcast [4 x i32]* %arr.data.28 to i8*
  %889 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.30, i64 0, i32 2
  store i8* %888, i8** %889, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %890 = bitcast i8* %888 to i32*
  %891 = getelementptr inbounds i32, i32* %890, i64 0
  store i32 240, i32* %891, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %892 = getelementptr inbounds i32, i32* %890, i64 1
  store i32 159, i32* %892, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %893 = getelementptr inbounds i32, i32* %890, i64 2
  store i32 152, i32* %893, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %894 = getelementptr inbounds i32, i32* %890, i64 3
  store i32 128, i32* %894, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %895 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.30)
  %896 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %885, %struct.nish_array* %895, i32 4, double 0x40A1300000000000)
  %897 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.119 to i8*), %struct.nish_array* %896, %struct.KeyDecoder* %897)
  %898 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %899 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.31, i64 0, i32 0
  store i64 1, i64* %899, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %900 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.31, i64 0, i32 1
  store i64 1, i64* %900, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %901 = bitcast [1 x i32]* %arr.data.29 to i8*
  %902 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.31, i64 0, i32 2
  store i8* %901, i8** %902, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %903 = bitcast i8* %901 to i32*
  %904 = getelementptr inbounds i32, i32* %903, i64 0
  store i32 65, i32* %904, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %905 = call %struct.nish_array* @csiRun(i32 32, %struct.nish_array* %arr.hdr.31)
  %906 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %898, %struct.nish_array* %905, i32 35, double 0x40A1F80000000000)
  %907 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.120 to i8*), %struct.nish_array* %906, %struct.KeyDecoder* %907)
  %908 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %909 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.32, i64 0, i32 0
  store i64 0, i64* %909, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %910 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.32, i64 0, i32 1
  store i64 0, i64* %910, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %911 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.32, i64 0, i32 2
  store i8* null, i8** %911, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %912 = call %struct.nish_array* @csiRun(i32 4000, %struct.nish_array* %arr.hdr.32)
  %913 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %908, %struct.nish_array* %912, i32 4002, double 0x40A2C00000000000)
  store %struct.nish_array* %913, %struct.nish_array** %long.addr, align 8
  %914 = load %struct.nish_array*, %struct.nish_array** %long.addr, align 8
  %915 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %914, i64 0, i32 0
  %916 = load i64, i64* %915, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %917 = trunc i64 %916 to i32
  %918 = call i8* @nish_str_from_i32(i32 %917)
  %919 = call i8* @nish_str_concat(i8* bitcast ({ i64, [28 x i8] }* @.str.121 to i8*), i8* %918)
  %920 = call i8* @nish_str_concat(i8* %919, i8* bitcast ({ i64, [6 x i8] }* @.str.122 to i8*))
  %921 = load %struct.nish_array*, %struct.nish_array** %long.addr, align 8
  %922 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %921, i64 0, i32 0
  %923 = load i64, i64* %922, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %924 = trunc i64 %923 to i32
  %925 = icmp sgt i32 %924, 0
  br i1 %925, label %cond.true, label %cond.false

cond.true:
  %926 = load %struct.nish_array*, %struct.nish_array** %long.addr, align 8
  %927 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %926, i64 0, i32 2
  %928 = load i8*, i8** %927, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %929 = bitcast i8* %928 to %struct.KeyEvent**
  %930 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %929, i64 0
  %931 = load %struct.KeyEvent*, %struct.KeyEvent** %930, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %932 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %931, i32 0, i32 0
  %933 = load i32, i32* %932, align 4, !tbaa !21
  %934 = call i8* @kindName(i32 %933)
  %935 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.123 to i8*), i8* %934)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %936 = phi i8* [ %935, %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.22 to i8*), %cond.false ]
  %937 = call i8* @nish_str_concat(i8* %920, i8* %936)
  %938 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %939 = call i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* %938)
  br i1 %939, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %940 = phi i8* [ bitcast ({ i64, [10 x i8] }* @.str.124 to i8*), %cond.true.1 ], [ bitcast ({ i64, [1 x i8] }* @.str.22 to i8*), %cond.false.1 ]
  %941 = call i8* @nish_str_concat(i8* %937, i8* %940)
  call void @nish_print(i8* %941)
  %942 = call i8* @nish_alloc_struct(i64 88)
  %943 = bitcast i8* %942 to %struct.Screen*
  call void @nish.Screen.constructor(%struct.Screen* %943, i32 65535, i32 65535, i1 false)
  store %struct.Screen* %943, %struct.Screen** %huge.addr, align 8
  %944 = load %struct.Screen*, %struct.Screen** %huge.addr, align 8
  call void @nish.Canvas.constructor(%struct.Canvas* %Canvas.obj.1, %struct.Screen* %944)
  store %struct.Canvas* %Canvas.obj.1, %struct.Canvas** %canvas.addr, align 8
  %945 = load %struct.Canvas*, %struct.Canvas** %canvas.addr, align 8
  %946 = call i32 @nish.rgb(i32 0, i32 0, i32 255)
  call void @nish.Canvas.clear(%struct.Canvas* %945, i32 %946)
  %947 = load %struct.Screen*, %struct.Screen** %huge.addr, align 8
  %948 = getelementptr inbounds %struct.Screen, %struct.Screen* %947, i32 0, i32 9
  %949 = load i32, i32* %948, align 4, !tbaa !34
  %950 = call i8* @nish_str_from_i32(i32 %949)
  %951 = call i8* @nish_str_concat(i8* bitcast ({ i64, [27 x i8] }* @.str.125 to i8*), i8* %950)
  %952 = call i8* @nish_str_concat(i8* %951, i8* bitcast ({ i64, [4 x i8] }* @.str.126 to i8*))
  %953 = load %struct.Screen*, %struct.Screen** %huge.addr, align 8
  %954 = getelementptr inbounds %struct.Screen, %struct.Screen* %953, i32 0, i32 10
  %955 = load i32, i32* %954, align 4, !tbaa !35
  %956 = call i8* @nish_str_from_i32(i32 %955)
  %957 = call i8* @nish_str_concat(i8* %952, i8* %956)
  %958 = call i8* @nish_str_concat(i8* %957, i8* bitcast ({ i64, [14 x i8] }* @.str.127 to i8*))
  %959 = load %struct.Canvas*, %struct.Canvas** %canvas.addr, align 8
  %960 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %959, i32 0, i32 1
  %961 = load i32, i32* %960, align 4, !tbaa !28
  %962 = call i8* @nish_str_from_i32(i32 %961)
  %963 = call i8* @nish_str_concat(i8* %958, i8* %962)
  %964 = call i8* @nish_str_concat(i8* %963, i8* bitcast ({ i64, [4 x i8] }* @.str.126 to i8*))
  %965 = load %struct.Canvas*, %struct.Canvas** %canvas.addr, align 8
  %966 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %965, i32 0, i32 2
  %967 = load i32, i32* %966, align 4, !tbaa !29
  %968 = call i8* @nish_str_from_i32(i32 %967)
  %969 = call i8* @nish_str_concat(i8* %964, i8* %968)
  %970 = call i8* @nish_str_concat(i8* %969, i8* bitcast ({ i64, [15 x i8] }* @.str.128 to i8*))
  %971 = load %struct.Screen*, %struct.Screen** %huge.addr, align 8
  %972 = call i64 @nish_arena_mark()
  %973 = call i8* @nish.Screen.flush(%struct.Screen* %971)
  %974 = call i8* @nish_arena_keep(i64 %972, i8* %973)
  %975 = bitcast i8* %974 to i64*
  %976 = load i64, i64* %975, align 8
  %977 = trunc i64 %976 to i32
  %978 = icmp sgt i32 %977, 0
  %979 = select i1 %978, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %980 = call i8* @nish_str_concat(i8* %970, i8* %979)
  call void @nish_print(i8* %980)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!36, !37, !38, !39, !40}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"i32", !6, i64 0}
!20 = !{!"KeyEvent", !19, i64 0, !19, i64 4}
!21 = !{!20, !19, i64 0}
!22 = !{!20, !19, i64 4}
!23 = !{!"ptr", !6, i64 0}
!24 = !{!"i1", !6, i64 0}
!25 = !{!"Screen", !23, i64 0, !23, i64 8, !23, i64 16, !23, i64 24, !23, i64 32, !23, i64 40, !23, i64 48, !23, i64 56, !23, i64 64, !19, i64 72, !19, i64 76, !19, i64 80, !24, i64 84, !24, i64 85}
!26 = !{!25, !24, i64 85}
!27 = !{!"Canvas", !23, i64 0, !19, i64 8, !19, i64 12, !23, i64 16}
!28 = !{!27, !19, i64 8}
!29 = !{!27, !19, i64 12}
!30 = !{!"double", !6, i64 0}
!31 = !{!"FixedStep", !30, i64 0, !30, i64 8, !30, i64 16, !19, i64 24, !24, i64 28}
!32 = !{!31, !30, i64 0}
!33 = !{!31, !19, i64 24}
!34 = !{!25, !19, i64 72}
!35 = !{!25, !19, i64 76}
!36 = !{i32 8, !"cf-protection-branch", i32 1}
!37 = !{i32 8, !"cf-protection-return", i32 1}
!38 = !{i32 8, !"branch-target-enforcement", i32 1}
!39 = !{i32 8, !"sign-return-address", i32 1}
!40 = !{i32 4, !"probe-stack", !"inline-asm"}
