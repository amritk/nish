%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.FixedStep = type { double, double, double, i32, i1 }
%struct.KeyDecoder = type { double, %struct.nish_array*, double, i32, i1, i32, i32, i1, %struct.nish_array* }
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
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
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
declare void @nish.KeyDecoder.constructor(%struct.KeyDecoder* noundef nonnull noalias align 8 dereferenceable(56) nocapture, double noundef) #2
declare noundef zeroext i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(56) nocapture) #3
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(56) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(56) nocapture, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feedEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(56) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.pollEvents(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(56) nocapture, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.merged(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(56) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef) #0
declare void @nish.KeyDecoder.keep(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(56) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, i1 noundef zeroext, double noundef) #0
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
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare double @llvm.floor.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

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

define internal void @events(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %keys, %struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(56) nocapture %d) #0 {
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
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %72, i8* %80, i64 %79, i1 false)
  %81 = getelementptr inbounds i8, i8* %72, i64 %79
  store i8* %81, i8** %join.p, align 8
  %82 = add i64 %66, 1
  store i64 %82, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %83 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %83, align 1
  %84 = call i8* @nish_str_concat(i8* %37, i8* %63)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [2 x i8] }* @.str.20 to i8*))
  %86 = call i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* %d)
  br i1 %86, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %87 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.21 to i8*), %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.22 to i8*), %cond.false ]
  %88 = call i8* @nish_str_concat(i8* %85, i8* %87)
  call void @nish_print(i8* %88)
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
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %456, i8* %464, i64 %463, i1 false)
  %465 = getelementptr inbounds i8, i8* %456, i64 %463
  store i8* %465, i8** %join.p, align 8
  %466 = add i64 %450, 1
  store i64 %466, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %467 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %467, align 1
  %468 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.77 to i8*), i8* %447)
  %469 = call i8* @nish_str_concat(i8* %468, i8* bitcast ({ i64, [8 x i8] }* @.str.78 to i8*))
  %470 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %471 = call double @nish.FixedStep.alpha(%struct.FixedStep* %470)
  %472 = fmul double %471, 0x4059000000000000
  %473 = call double @llvm.floor.f64(double %472)
  %474 = call i8* @nish_str_from_f64(double %473)
  %475 = call i8* @nish_str_concat(i8* %469, i8* %474)
  %476 = call i8* @nish_str_concat(i8* %475, i8* bitcast ({ i64, [2 x i8] }* @.str.79 to i8*))
  call void @nish_print(i8* %476)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.1, i32 100, i32 3)
  store %struct.FixedStep* %FixedStep.obj.1, %struct.FixedStep** %behind.addr, align 8
  %477 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %478 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %477, double 0x0000000000000000)
  %479 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %480 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %479, double 0x408F680000000000)
  store i32 %480, i32* %caught.addr, align 4
  %481 = load i32, i32* %caught.addr, align 4
  %482 = call i8* @nish_str_from_i32(i32 %481)
  %483 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.80 to i8*), i8* %482)
  %484 = call i8* @nish_str_concat(i8* %483, i8* bitcast ({ i64, [29 x i8] }* @.str.81 to i8*))
  %485 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %486 = call double @nish.FixedStep.alpha(%struct.FixedStep* %485)
  %487 = fmul double %486, 0x4059000000000000
  %488 = call double @llvm.floor.f64(double %487)
  %489 = call i8* @nish_str_from_f64(double %488)
  %490 = call i8* @nish_str_concat(i8* %484, i8* %489)
  %491 = call i8* @nish_str_concat(i8* %490, i8* bitcast ({ i64, [2 x i8] }* @.str.79 to i8*))
  call void @nish_print(i8* %491)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.2, i32 100, i32 1)
  store %struct.FixedStep* %FixedStep.obj.2, %struct.FixedStep** %draw.addr, align 8
  store i32 0, i32* %frames.addr, align 4
  %492 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %493 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %492, double 0x0000000000000000)
  store i32 1, i32* %ms.addr, align 4
  br label %for.cond.1

for.cond.1:
  %494 = load i32, i32* %ms.addr, align 4
  %495 = icmp sle i32 %494, 1000
  br i1 %495, label %for.body.1, label %for.end.1

for.body.1:
  %496 = load i32, i32* %frames.addr, align 4
  %497 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %498 = load i32, i32* %ms.addr, align 4
  %499 = sitofp i32 %498 to double
  %500 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %497, double %499)
  %501 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %496, i32 %500)
  %502 = extractvalue { i32, i1 } %501, 0
  %503 = extractvalue { i32, i1 } %501, 1
  br i1 %503, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %502, i32* %frames.addr, align 4
  br label %for.inc.1

for.inc.1:
  %504 = load i32, i32* %ms.addr, align 4
  %505 = add nsw i32 %504, 1
  store i32 %505, i32* %ms.addr, align 4
  br label %for.cond.1

for.end.1:
  %506 = load i32, i32* %frames.addr, align 4
  %507 = call i8* @nish_str_from_i32(i32 %506)
  %508 = call i8* @nish_str_concat(i8* bitcast ({ i64, [50 x i8] }* @.str.82 to i8*), i8* %507)
  %509 = call i8* @nish_str_concat(i8* %508, i8* bitcast ({ i64, [8 x i8] }* @.str.83 to i8*))
  call void @nish_print(i8* %509)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.3, i32 0, i32 0)
  store %struct.FixedStep* %FixedStep.obj.3, %struct.FixedStep** %odd.addr, align 8
  %510 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %511 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %510, i32 0, i32 0
  %512 = load double, double* %511, align 8, !tbaa !32
  %513 = call i8* @nish_str_from_f64(double %512)
  %514 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.84 to i8*), i8* %513)
  %515 = call i8* @nish_str_concat(i8* %514, i8* bitcast ({ i64, [14 x i8] }* @.str.85 to i8*))
  %516 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %517 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %516, i32 0, i32 3
  %518 = load i32, i32* %517, align 4, !tbaa !33
  %519 = call i8* @nish_str_from_i32(i32 %518)
  %520 = call i8* @nish_str_concat(i8* %515, i8* %519)
  call void @nish_print(i8* %520)
  call void @nish.KeyDecoder.constructor(%struct.KeyDecoder* %KeyDecoder.obj, double 0x403E000000000000)
  store %struct.KeyDecoder* %KeyDecoder.obj, %struct.KeyDecoder** %d.addr, align 8
  %521 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %522 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 12, i64* %522, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %523 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 12, i64* %523, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %524 = bitcast [12 x i32]* %arr.data to i8*
  %525 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %524, i8** %525, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %526 = bitcast i8* %524 to i32*
  %527 = getelementptr inbounds i32, i32* %526, i64 0
  store i32 27, i32* %527, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %528 = getelementptr inbounds i32, i32* %526, i64 1
  store i32 91, i32* %528, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %529 = getelementptr inbounds i32, i32* %526, i64 2
  store i32 65, i32* %529, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %530 = getelementptr inbounds i32, i32* %526, i64 3
  store i32 27, i32* %530, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %531 = getelementptr inbounds i32, i32* %526, i64 4
  store i32 91, i32* %531, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %532 = getelementptr inbounds i32, i32* %526, i64 5
  store i32 66, i32* %532, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %533 = getelementptr inbounds i32, i32* %526, i64 6
  store i32 27, i32* %533, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %534 = getelementptr inbounds i32, i32* %526, i64 7
  store i32 79, i32* %534, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %535 = getelementptr inbounds i32, i32* %526, i64 8
  store i32 67, i32* %535, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %536 = getelementptr inbounds i32, i32* %526, i64 9
  store i32 27, i32* %536, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %537 = getelementptr inbounds i32, i32* %526, i64 10
  store i32 79, i32* %537, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %538 = getelementptr inbounds i32, i32* %526, i64 11
  store i32 68, i32* %538, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %539 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.1)
  %540 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %521, %struct.nish_array* %539, i32 12, double 0x0000000000000000)
  %541 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.86 to i8*), %struct.nish_array* %540, %struct.KeyDecoder* %541)
  %542 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %543 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %543, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %544 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %544, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %545 = bitcast [8 x i32]* %arr.data.1 to i8*
  %546 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %545, i8** %546, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %547 = bitcast i8* %545 to i32*
  %548 = getelementptr inbounds i32, i32* %547, i64 0
  store i32 3, i32* %548, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %549 = getelementptr inbounds i32, i32* %547, i64 1
  store i32 13, i32* %549, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %550 = getelementptr inbounds i32, i32* %547, i64 2
  store i32 10, i32* %550, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %551 = getelementptr inbounds i32, i32* %547, i64 3
  store i32 32, i32* %551, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %552 = getelementptr inbounds i32, i32* %547, i64 4
  store i32 9, i32* %552, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %553 = getelementptr inbounds i32, i32* %547, i64 5
  store i32 127, i32* %553, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %554 = getelementptr inbounds i32, i32* %547, i64 6
  store i32 8, i32* %554, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %555 = getelementptr inbounds i32, i32* %547, i64 7
  store i32 1, i32* %555, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %556 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.2)
  %557 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %542, %struct.nish_array* %556, i32 8, double 0x0000000000000000)
  %558 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [9 x i8] }* @.str.87 to i8*), %struct.nish_array* %557, %struct.KeyDecoder* %558)
  %559 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %560 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %560, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %561 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %561, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %562 = bitcast [8 x i32]* %arr.data.2 to i8*
  %563 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %562, i8** %563, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %564 = bitcast i8* %562 to i32*
  %565 = getelementptr inbounds i32, i32* %564, i64 0
  store i32 113, i32* %565, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %566 = getelementptr inbounds i32, i32* %564, i64 1
  store i32 81, i32* %566, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %567 = getelementptr inbounds i32, i32* %564, i64 2
  store i32 126, i32* %567, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %568 = getelementptr inbounds i32, i32* %564, i64 3
  store i32 195, i32* %568, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %569 = getelementptr inbounds i32, i32* %564, i64 4
  store i32 169, i32* %569, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %570 = getelementptr inbounds i32, i32* %564, i64 5
  store i32 226, i32* %570, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %571 = getelementptr inbounds i32, i32* %564, i64 6
  store i32 150, i32* %571, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %572 = getelementptr inbounds i32, i32* %564, i64 7
  store i32 128, i32* %572, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %573 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.3)
  %574 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %559, %struct.nish_array* %573, i32 8, double 0x0000000000000000)
  %575 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [10 x i8] }* @.str.88 to i8*), %struct.nish_array* %574, %struct.KeyDecoder* %575)
  %576 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %577 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %577, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %578 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %578, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %579 = bitcast [3 x i32]* %arr.data.3 to i8*
  %580 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %579, i8** %580, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %581 = bitcast i8* %579 to i32*
  %582 = getelementptr inbounds i32, i32* %581, i64 0
  store i32 97, i32* %582, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %583 = getelementptr inbounds i32, i32* %581, i64 1
  store i32 98, i32* %583, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %584 = getelementptr inbounds i32, i32* %581, i64 2
  store i32 99, i32* %584, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %585 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.4)
  %586 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %576, %struct.nish_array* %585, i32 1, double 0x0000000000000000)
  %587 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.89 to i8*), %struct.nish_array* %586, %struct.KeyDecoder* %587)
  %588 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %589 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 1, i64* %589, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %590 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 1, i64* %590, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %591 = bitcast [1 x i32]* %arr.data.4 to i8*
  %592 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %591, i8** %592, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %593 = bitcast i8* %591 to i32*
  %594 = getelementptr inbounds i32, i32* %593, i64 0
  store i32 27, i32* %594, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %595 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.5)
  %596 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %588, %struct.nish_array* %595, i32 1, double 0x4059000000000000)
  %597 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.90 to i8*), %struct.nish_array* %596, %struct.KeyDecoder* %597)
  %598 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %599 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 2, i64* %599, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %600 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 2, i64* %600, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %601 = bitcast [2 x i32]* %arr.data.5 to i8*
  %602 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %601, i8** %602, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %603 = bitcast i8* %601 to i32*
  %604 = getelementptr inbounds i32, i32* %603, i64 0
  store i32 91, i32* %604, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %605 = getelementptr inbounds i32, i32* %603, i64 1
  store i32 65, i32* %605, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %606 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.6)
  %607 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %598, %struct.nish_array* %606, i32 2, double 0x405B800000000000)
  %608 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.91 to i8*), %struct.nish_array* %607, %struct.KeyDecoder* %608)
  %609 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %610 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 2, i64* %610, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %611 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 2, i64* %611, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %612 = bitcast [2 x i32]* %arr.data.6 to i8*
  %613 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %612, i8** %613, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %614 = bitcast i8* %612 to i32*
  %615 = getelementptr inbounds i32, i32* %614, i64 0
  store i32 27, i32* %615, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %616 = getelementptr inbounds i32, i32* %614, i64 1
  store i32 91, i32* %616, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %617 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.7)
  %618 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %609, %struct.nish_array* %617, i32 2, double 0x4069000000000000)
  %619 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.92 to i8*), %struct.nish_array* %618, %struct.KeyDecoder* %619)
  %620 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %621 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 1, i64* %621, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %622 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 1, i64* %622, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %623 = bitcast [1 x i32]* %arr.data.7 to i8*
  %624 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %623, i8** %624, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %625 = bitcast i8* %623 to i32*
  %626 = getelementptr inbounds i32, i32* %625, i64 0
  store i32 66, i32* %626, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %627 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.8)
  %628 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %620, %struct.nish_array* %627, i32 1, double 0x406A400000000000)
  %629 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.93 to i8*), %struct.nish_array* %628, %struct.KeyDecoder* %629)
  %630 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %631 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 0
  store i64 2, i64* %631, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %632 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 1
  store i64 2, i64* %632, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %633 = bitcast [2 x i32]* %arr.data.8 to i8*
  %634 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 2
  store i8* %633, i8** %634, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %635 = bitcast i8* %633 to i32*
  %636 = getelementptr inbounds i32, i32* %635, i64 0
  store i32 27, i32* %636, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %637 = getelementptr inbounds i32, i32* %635, i64 1
  store i32 79, i32* %637, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %638 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.9)
  %639 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %630, %struct.nish_array* %638, i32 2, double 0x4072C00000000000)
  %640 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.94 to i8*), %struct.nish_array* %639, %struct.KeyDecoder* %640)
  %641 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %642 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 0
  store i64 1, i64* %642, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %643 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 1
  store i64 1, i64* %643, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %644 = bitcast [1 x i32]* %arr.data.9 to i8*
  %645 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 2
  store i8* %644, i8** %645, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %646 = bitcast i8* %644 to i32*
  %647 = getelementptr inbounds i32, i32* %646, i64 0
  store i32 67, i32* %647, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %648 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.10)
  %649 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %641, %struct.nish_array* %648, i32 1, double 0x4073100000000000)
  %650 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.95 to i8*), %struct.nish_array* %649, %struct.KeyDecoder* %650)
  %651 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %652 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 0
  store i64 6, i64* %652, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %653 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 1
  store i64 6, i64* %653, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %654 = bitcast [6 x i32]* %arr.data.10 to i8*
  %655 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 2
  store i8* %654, i8** %655, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %656 = bitcast i8* %654 to i32*
  %657 = getelementptr inbounds i32, i32* %656, i64 0
  store i32 27, i32* %657, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %658 = getelementptr inbounds i32, i32* %656, i64 1
  store i32 91, i32* %658, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %659 = getelementptr inbounds i32, i32* %656, i64 2
  store i32 49, i32* %659, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %660 = getelementptr inbounds i32, i32* %656, i64 3
  store i32 59, i32* %660, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %661 = getelementptr inbounds i32, i32* %656, i64 4
  store i32 53, i32* %661, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %662 = getelementptr inbounds i32, i32* %656, i64 5
  store i32 65, i32* %662, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %663 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.11)
  %664 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %651, %struct.nish_array* %663, i32 6, double 0x4079000000000000)
  %665 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.96 to i8*), %struct.nish_array* %664, %struct.KeyDecoder* %665)
  %666 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %667 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 0
  store i64 4, i64* %667, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %668 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 1
  store i64 4, i64* %668, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %669 = bitcast [4 x i32]* %arr.data.11 to i8*
  %670 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 2
  store i8* %669, i8** %670, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %671 = bitcast i8* %669 to i32*
  %672 = getelementptr inbounds i32, i32* %671, i64 0
  store i32 27, i32* %672, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %673 = getelementptr inbounds i32, i32* %671, i64 1
  store i32 91, i32* %673, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %674 = getelementptr inbounds i32, i32* %671, i64 2
  store i32 51, i32* %674, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %675 = getelementptr inbounds i32, i32* %671, i64 3
  store i32 126, i32* %675, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %676 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.12)
  %677 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %666, %struct.nish_array* %676, i32 4, double 0x4079000000000000)
  %678 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.97 to i8*), %struct.nish_array* %677, %struct.KeyDecoder* %678)
  %679 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %680 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 0
  store i64 1, i64* %680, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %681 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 1
  store i64 1, i64* %681, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %682 = bitcast [1 x i32]* %arr.data.12 to i8*
  %683 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 2
  store i8* %682, i8** %683, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %684 = bitcast i8* %682 to i32*
  %685 = getelementptr inbounds i32, i32* %684, i64 0
  store i32 27, i32* %685, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %686 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.13)
  %687 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %679, %struct.nish_array* %686, i32 1, double 0x407F400000000000)
  %688 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [16 x i8] }* @.str.98 to i8*), %struct.nish_array* %687, %struct.KeyDecoder* %688)
  %689 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %690 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %689, double 0x4080400000000000)
  %691 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.99 to i8*), %struct.nish_array* %690, %struct.KeyDecoder* %691)
  %692 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %693 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %692, double 0x4080900000000000)
  %694 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.100 to i8*), %struct.nish_array* %693, %struct.KeyDecoder* %694)
  %695 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %696 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 0
  store i64 2, i64* %696, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %697 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 1
  store i64 2, i64* %697, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %698 = bitcast [2 x i32]* %arr.data.13 to i8*
  %699 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 2
  store i8* %698, i8** %699, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %700 = bitcast i8* %698 to i32*
  %701 = getelementptr inbounds i32, i32* %700, i64 0
  store i32 27, i32* %701, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %702 = getelementptr inbounds i32, i32* %700, i64 1
  store i32 120, i32* %702, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %703 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.14)
  %704 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %695, %struct.nish_array* %703, i32 2, double 0x4082C00000000000)
  %705 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.101 to i8*), %struct.nish_array* %704, %struct.KeyDecoder* %705)
  %706 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %707 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 0
  store i64 4, i64* %707, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %708 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 1
  store i64 4, i64* %708, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %709 = bitcast [4 x i32]* %arr.data.14 to i8*
  %710 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 2
  store i8* %709, i8** %710, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %711 = bitcast i8* %709 to i32*
  %712 = getelementptr inbounds i32, i32* %711, i64 0
  store i32 27, i32* %712, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %713 = getelementptr inbounds i32, i32* %711, i64 1
  store i32 27, i32* %713, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %714 = getelementptr inbounds i32, i32* %711, i64 2
  store i32 91, i32* %714, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %715 = getelementptr inbounds i32, i32* %711, i64 3
  store i32 65, i32* %715, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %716 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.15)
  %717 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %706, %struct.nish_array* %716, i32 4, double 0x4082C00000000000)
  %718 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.102 to i8*), %struct.nish_array* %717, %struct.KeyDecoder* %718)
  %719 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %720 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 0
  store i64 1, i64* %720, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %721 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 1
  store i64 1, i64* %721, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %722 = bitcast [1 x i32]* %arr.data.15 to i8*
  %723 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 2
  store i8* %722, i8** %723, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %724 = bitcast i8* %722 to i32*
  %725 = getelementptr inbounds i32, i32* %724, i64 0
  store i32 27, i32* %725, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %726 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.16)
  %727 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %719, %struct.nish_array* %726, i32 1, double 0x4085E00000000000)
  %728 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [36 x i8] }* @.str.103 to i8*), %struct.nish_array* %727, %struct.KeyDecoder* %728)
  %729 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %730 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 0
  store i64 1, i64* %730, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %731 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 1
  store i64 1, i64* %731, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %732 = bitcast [1 x i32]* %arr.data.16 to i8*
  %733 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 2
  store i8* %732, i8** %733, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %734 = bitcast i8* %732 to i32*
  %735 = getelementptr inbounds i32, i32* %734, i64 0
  store i32 120, i32* %735, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %736 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.17)
  %737 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %729, %struct.nish_array* %736, i32 1, double 0x4089000000000000)
  %738 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.104 to i8*), %struct.nish_array* %737, %struct.KeyDecoder* %738)
  %739 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %740 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 0
  store i64 1, i64* %740, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %741 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 1
  store i64 1, i64* %741, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %742 = bitcast [1 x i32]* %arr.data.17 to i8*
  %743 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 2
  store i8* %742, i8** %743, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %744 = bitcast i8* %742 to i32*
  %745 = getelementptr inbounds i32, i32* %744, i64 0
  store i32 195, i32* %745, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %746 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.18)
  %747 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %739, %struct.nish_array* %746, i32 1, double 0x408C200000000000)
  %748 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.105 to i8*), %struct.nish_array* %747, %struct.KeyDecoder* %748)
  %749 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %750 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 0
  store i64 1, i64* %750, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %751 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 1
  store i64 1, i64* %751, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %752 = bitcast [1 x i32]* %arr.data.18 to i8*
  %753 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 2
  store i8* %752, i8** %753, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %754 = bitcast i8* %752 to i32*
  %755 = getelementptr inbounds i32, i32* %754, i64 0
  store i32 169, i32* %755, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %756 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.19)
  %757 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %749, %struct.nish_array* %756, i32 1, double 0x408C280000000000)
  %758 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.106 to i8*), %struct.nish_array* %757, %struct.KeyDecoder* %758)
  %759 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %760 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 0
  store i64 2, i64* %760, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %761 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 1
  store i64 2, i64* %761, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %762 = bitcast [2 x i32]* %arr.data.19 to i8*
  %763 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 2
  store i8* %762, i8** %763, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %764 = bitcast i8* %762 to i32*
  %765 = getelementptr inbounds i32, i32* %764, i64 0
  store i32 226, i32* %765, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %766 = getelementptr inbounds i32, i32* %764, i64 1
  store i32 150, i32* %766, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %767 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.20)
  %768 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %759, %struct.nish_array* %767, i32 2, double 0x408F400000000000)
  %769 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.107 to i8*), %struct.nish_array* %768, %struct.KeyDecoder* %769)
  %770 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %771 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %770, double 0x4091300000000000)
  %772 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.108 to i8*), %struct.nish_array* %771, %struct.KeyDecoder* %772)
  %773 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %774 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 0
  store i64 3, i64* %774, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %775 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 1
  store i64 3, i64* %775, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %776 = bitcast [3 x i32]* %arr.data.20 to i8*
  %777 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 2
  store i8* %776, i8** %777, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %778 = bitcast i8* %776 to i32*
  %779 = getelementptr inbounds i32, i32* %778, i64 0
  store i32 255, i32* %779, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %780 = getelementptr inbounds i32, i32* %778, i64 1
  store i32 128, i32* %780, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %781 = getelementptr inbounds i32, i32* %778, i64 2
  store i32 97, i32* %781, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %782 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.21)
  %783 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %773, %struct.nish_array* %782, i32 3, double 0x4092C00000000000)
  %784 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [14 x i8] }* @.str.109 to i8*), %struct.nish_array* %783, %struct.KeyDecoder* %784)
  %785 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %786 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 0
  store i64 3, i64* %786, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %787 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 1
  store i64 3, i64* %787, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %788 = bitcast [3 x i32]* %arr.data.21 to i8*
  %789 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 2
  store i8* %788, i8** %789, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %790 = bitcast i8* %788 to i32*
  %791 = getelementptr inbounds i32, i32* %790, i64 0
  store i32 226, i32* %791, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %792 = getelementptr inbounds i32, i32* %790, i64 1
  store i32 150, i32* %792, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %793 = getelementptr inbounds i32, i32* %790, i64 2
  store i32 97, i32* %793, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %794 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.22)
  %795 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %785, %struct.nish_array* %794, i32 3, double 0x4093880000000000)
  %796 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [33 x i8] }* @.str.110 to i8*), %struct.nish_array* %795, %struct.KeyDecoder* %796)
  %797 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %798 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 0
  store i64 0, i64* %798, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %799 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 1
  store i64 0, i64* %799, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %800 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 2
  store i8* null, i8** %800, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %801 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.23)
  %802 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %797, %struct.nish_array* %801, i32 0, double 0x4094500000000000)
  %803 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.111 to i8*), %struct.nish_array* %802, %struct.KeyDecoder* %803)
  %804 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %805 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 0
  store i64 1, i64* %805, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %806 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 1
  store i64 1, i64* %806, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %807 = bitcast [1 x i32]* %arr.data.22 to i8*
  %808 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 2
  store i8* %807, i8** %808, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %809 = bitcast i8* %807 to i32*
  %810 = getelementptr inbounds i32, i32* %809, i64 0
  store i32 27, i32* %810, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %811 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.24)
  %812 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %804, %struct.nish_array* %811, i32 1, double 0x409F400000000000)
  %813 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.112 to i8*), %struct.nish_array* %812, %struct.KeyDecoder* %813)
  %814 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %815 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 0
  store i64 1, i64* %815, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %816 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 1
  store i64 1, i64* %816, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %817 = bitcast [1 x i32]* %arr.data.23 to i8*
  %818 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 2
  store i8* %817, i8** %818, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %819 = bitcast i8* %817 to i32*
  %820 = getelementptr inbounds i32, i32* %819, i64 0
  store i32 91, i32* %820, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %821 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.25)
  %822 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %814, %struct.nish_array* %821, i32 1, double 0x409FA40000000000)
  %823 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [26 x i8] }* @.str.113 to i8*), %struct.nish_array* %822, %struct.KeyDecoder* %823)
  %824 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %825 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %824, double 0x409FCC0000000000)
  %826 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.114 to i8*), %struct.nish_array* %825, %struct.KeyDecoder* %826)
  %827 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %828 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 0
  store i64 3, i64* %828, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %829 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 1
  store i64 3, i64* %829, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %830 = bitcast [3 x i32]* %arr.data.24 to i8*
  %831 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 2
  store i8* %830, i8** %831, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %832 = bitcast i8* %830 to i32*
  %833 = getelementptr inbounds i32, i32* %832, i64 0
  store i32 27, i32* %833, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %834 = getelementptr inbounds i32, i32* %832, i64 1
  store i32 79, i32* %834, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %835 = getelementptr inbounds i32, i32* %832, i64 2
  store i32 10, i32* %835, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %836 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.26)
  %837 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %827, %struct.nish_array* %836, i32 3, double 0x40A0680000000000)
  %838 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.115 to i8*), %struct.nish_array* %837, %struct.KeyDecoder* %838)
  %839 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %840 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 0
  store i64 3, i64* %840, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %841 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 1
  store i64 3, i64* %841, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %842 = bitcast [3 x i32]* %arr.data.25 to i8*
  %843 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 2
  store i8* %842, i8** %843, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %844 = bitcast i8* %842 to i32*
  %845 = getelementptr inbounds i32, i32* %844, i64 0
  store i32 245, i32* %845, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %846 = getelementptr inbounds i32, i32* %844, i64 1
  store i32 128, i32* %846, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %847 = getelementptr inbounds i32, i32* %844, i64 2
  store i32 97, i32* %847, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %848 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.27)
  %849 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %839, %struct.nish_array* %848, i32 3, double 0x40A1300000000000)
  %850 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.116 to i8*), %struct.nish_array* %849, %struct.KeyDecoder* %850)
  %851 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %852 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 0
  store i64 4, i64* %852, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %853 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 1
  store i64 4, i64* %853, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %854 = bitcast [4 x i32]* %arr.data.26 to i8*
  %855 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 2
  store i8* %854, i8** %855, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %856 = bitcast i8* %854 to i32*
  %857 = getelementptr inbounds i32, i32* %856, i64 0
  store i32 194, i32* %857, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %858 = getelementptr inbounds i32, i32* %856, i64 1
  store i32 155, i32* %858, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %859 = getelementptr inbounds i32, i32* %856, i64 2
  store i32 194, i32* %859, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %860 = getelementptr inbounds i32, i32* %856, i64 3
  store i32 160, i32* %860, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %861 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.28)
  %862 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %851, %struct.nish_array* %861, i32 4, double 0x40A0CC0000000000)
  %863 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [24 x i8] }* @.str.117 to i8*), %struct.nish_array* %862, %struct.KeyDecoder* %863)
  %864 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %865 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 0
  store i64 10, i64* %865, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %866 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 1
  store i64 10, i64* %866, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %867 = bitcast [10 x i32]* %arr.data.27 to i8*
  %868 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 2
  store i8* %867, i8** %868, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %869 = bitcast i8* %867 to i32*
  %870 = getelementptr inbounds i32, i32* %869, i64 0
  store i32 224, i32* %870, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %871 = getelementptr inbounds i32, i32* %869, i64 1
  store i32 128, i32* %871, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %872 = getelementptr inbounds i32, i32* %869, i64 2
  store i32 128, i32* %872, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %873 = getelementptr inbounds i32, i32* %869, i64 3
  store i32 237, i32* %873, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %874 = getelementptr inbounds i32, i32* %869, i64 4
  store i32 160, i32* %874, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %875 = getelementptr inbounds i32, i32* %869, i64 5
  store i32 128, i32* %875, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %876 = getelementptr inbounds i32, i32* %869, i64 6
  store i32 244, i32* %876, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %877 = getelementptr inbounds i32, i32* %869, i64 7
  store i32 144, i32* %877, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %878 = getelementptr inbounds i32, i32* %869, i64 8
  store i32 128, i32* %878, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %879 = getelementptr inbounds i32, i32* %869, i64 9
  store i32 128, i32* %879, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %880 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.29)
  %881 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %864, %struct.nish_array* %880, i32 10, double 0x40A1300000000000)
  %882 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [30 x i8] }* @.str.118 to i8*), %struct.nish_array* %881, %struct.KeyDecoder* %882)
  %883 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %884 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.30, i64 0, i32 0
  store i64 4, i64* %884, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %885 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.30, i64 0, i32 1
  store i64 4, i64* %885, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %886 = bitcast [4 x i32]* %arr.data.28 to i8*
  %887 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.30, i64 0, i32 2
  store i8* %886, i8** %887, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %888 = bitcast i8* %886 to i32*
  %889 = getelementptr inbounds i32, i32* %888, i64 0
  store i32 240, i32* %889, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %890 = getelementptr inbounds i32, i32* %888, i64 1
  store i32 159, i32* %890, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %891 = getelementptr inbounds i32, i32* %888, i64 2
  store i32 152, i32* %891, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %892 = getelementptr inbounds i32, i32* %888, i64 3
  store i32 128, i32* %892, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %893 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.30)
  %894 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %883, %struct.nish_array* %893, i32 4, double 0x40A1300000000000)
  %895 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.119 to i8*), %struct.nish_array* %894, %struct.KeyDecoder* %895)
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
