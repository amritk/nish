%struct.HelpMenu = type { %struct.Style*, i8*, i32, i32, %struct.nish_array*, i32 }
%struct.Style = type { i1, i1, i8*, i8*, i8*, i8*, i8*, i8*, i8*, i8*, i8*, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\1B\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"^[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"greet\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"1.2.0\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"say hello\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"<name> [flags]\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"greet someone\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"--version\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"Flags\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"--shout\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"in capitals\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"--times\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"<n>\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"say it n times\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [25 x i8] } { i64 24, [25 x i8] c"--a-flag-past-the-column\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"<x>\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"two spaces\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"Notes\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"one line of prose\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"/etc/greet.conf\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"k\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"g\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"m\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"c\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"  fg \00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"  bright \00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"  bg \00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"  bgBright \00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"f\00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"i\00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"u\00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"v\00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"  attrs \00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  sgr \00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"1\00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c";\00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"31\00" }, align 8
@.str.46 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8
@.str.47 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"38;5;208\00" }, align 8
@.str.48 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"t\00" }, align 8
@.str.49 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"38;2;255;128;0\00" }, align 8
@.str.50 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"  nested \00" }, align 8
@.str.51 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.52 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"44\00" }, align 8
@.str.53 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"  empty [\00" }, align 8
@.str.54 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"][\00" }, align 8
@.str.55 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.56 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"1;34\00" }, align 8
@.str.57 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"1;4\00" }, align 8
@.str.58 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"32\00" }, align 8
@.str.59 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"7\00" }, align 8
@.str.60 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"1;33\00" }, align 8
@.str.61 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"35\00" }, align 8
@.str.62 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"3\00" }, align 8
@.str.63 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"2\00" }, align 8
@.str.64 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"theme:\00" }, align 8
@.str.65 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"mono:\00" }, align 8
@.str.66 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"plain:\00" }, align 8
@.str.67 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"off paints nothing: \00" }, align 8
@.str.68 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.69 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.70 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"mono dim is plain: \00" }, align 8
@.str.71 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.72 = private unnamed_addr constant { i64, [24 x i8] } { i64 23, [24 x i8] c"-----------------------\00" }, align 8
@.str.73 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"<name>\00" }, align 8
@.str.74 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"theme painters\00" }, align 8
@.str.75 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"mono painters\00" }, align 8
@.str.76 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"off painters\00" }, align 8
@.str.77 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"recoloured theme:\00" }, align 8
@.str.78 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"recoloured mono:\00" }, align 8
@.str.79 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"recoloured off is plain: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish.HelpMenu.constructor(%struct.HelpMenu* noundef nonnull noalias align 8 dereferenceable(40) nocapture, %struct.Style* noundef nonnull align 8 dereferenceable(88), i8* noundef nonnull noalias readonly align 8, i32 noundef, i32 noundef) #1
declare void @nish.HelpMenu.header(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.title(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.line(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare void @nish.HelpMenu.usage(%struct.HelpMenu* noundef nonnull align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.section(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.row(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.note(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare void @nish.HelpMenu.value(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.HelpMenu.text(%struct.HelpMenu* noundef nonnull readonly align 8 dereferenceable(40) nocapture) #1
declare void @nish.Style.constructor(%struct.Style* noundef nonnull noalias align 8 dereferenceable(88) nocapture, i1 noundef zeroext, i1 noundef zeroext) #1
declare noundef nonnull align 8 i8* @nish.Style.paint(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.heading(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.name(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.flag(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.meta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.dim(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.sgr(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.black(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.red(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.green(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.yellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.blue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.magenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.cyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.white(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightBlack(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightRed(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightGreen(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightYellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightBlue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightMagenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightCyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.brightWhite(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBlack(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgRed(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgGreen(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgYellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBlue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgMagenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgCyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgWhite(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightBlack(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightRed(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightGreen(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightYellow(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightBlue(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightMagenta(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightCyan(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bgBrightWhite(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.bold(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.faint(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.italic(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.underline(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.inverse(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.Style.strikethrough(%struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i8* noundef nonnull noalias readonly align 8) #0
declare noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8 nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 i8* @visible(i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.replaceAll(i8* %text, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal noundef nonnull align 8 i8* @menu(%struct.Style* noundef nonnull align 8 dereferenceable(88) %style) #0 {
entry:
  %m.addr = alloca %struct.HelpMenu*, align 8
  %HelpMenu.obj = alloca %struct.HelpMenu, align 8
  call void @nish.HelpMenu.constructor(%struct.HelpMenu* %HelpMenu.obj, %struct.Style* %style, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i32 24, i32 30)
  store %struct.HelpMenu* %HelpMenu.obj, %struct.HelpMenu** %m.addr, align 8
  %0 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.header(%struct.HelpMenu* %0, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  %1 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %1, i8* bitcast ({ i64, [15 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [14 x i8] }* @.str.6 to i8*))
  %2 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %2, i8* bitcast ({ i64, [10 x i8] }* @.str.7 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %3 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.section(%struct.HelpMenu* %3, i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*))
  %4 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %4, i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [12 x i8] }* @.str.11 to i8*))
  %5 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %5, i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.13 to i8*), i8* bitcast ({ i64, [15 x i8] }* @.str.14 to i8*))
  %6 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.row(%struct.HelpMenu* %6, i8* bitcast ({ i64, [25 x i8] }* @.str.15 to i8*), i8* bitcast ({ i64, [4 x i8] }* @.str.16 to i8*), i8* bitcast ({ i64, [11 x i8] }* @.str.17 to i8*))
  %7 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.section(%struct.HelpMenu* %7, i8* bitcast ({ i64, [6 x i8] }* @.str.18 to i8*))
  %8 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.note(%struct.HelpMenu* %8, i8* bitcast ({ i64, [18 x i8] }* @.str.19 to i8*))
  %9 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  call void @nish.HelpMenu.value(%struct.HelpMenu* %9, i8* bitcast ({ i64, [16 x i8] }* @.str.20 to i8*))
  %10 = load %struct.HelpMenu*, %struct.HelpMenu** %m.addr, align 8
  %11 = call i64 @nish_arena_mark()
  %12 = call i8* @nish.HelpMenu.text(%struct.HelpMenu* %10)
  %13 = call i8* @nish_arena_keep(i64 %11, i8* %12)
  ret i8* %13
}

define internal void @painters(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.Style* noundef nonnull readonly align 8 dereferenceable(88) nocapture %s) #0 {
entry:
  %fg.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %bright.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i8*], align 8
  %join.total.1 = alloca i64, align 8
  %join.at.1 = alloca i64, align 8
  %join.p.1 = alloca i8*, align 8
  %bg.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i8*], align 8
  %join.total.2 = alloca i64, align 8
  %join.at.2 = alloca i64, align 8
  %join.p.2 = alloca i8*, align 8
  %bgBright.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [8 x i8*], align 8
  %join.total.3 = alloca i64, align 8
  %join.at.3 = alloca i64, align 8
  %join.p.3 = alloca i8*, align 8
  %attrs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [6 x i8*], align 8
  %join.total.4 = alloca i64, align 8
  %join.at.4 = alloca i64, align 8
  %join.p.4 = alloca i8*, align 8
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [2 x i8] }* @.str.21 to i8*))
  call void @nish_print(i8* %0)
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @nish.Style.black(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  %4 = call i64 @nish_arena_mark()
  %5 = call i8* @nish.Style.red(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %6 = call i8* @nish_arena_keep(i64 %4, i8* %5)
  %7 = call i64 @nish_arena_mark()
  %8 = call i8* @nish.Style.green(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %9 = call i8* @nish_arena_keep(i64 %7, i8* %8)
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @nish.Style.yellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  %13 = call i64 @nish_arena_mark()
  %14 = call i8* @nish.Style.blue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %15 = call i8* @nish_arena_keep(i64 %13, i8* %14)
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @nish.Style.magenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  %19 = call i64 @nish_arena_mark()
  %20 = call i8* @nish.Style.cyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %21 = call i8* @nish_arena_keep(i64 %19, i8* %20)
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @nish.Style.white(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %27 = bitcast [8 x i8*]* %arr.data to i8*
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %27, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %27 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 0
  store i8* %3, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %31 = getelementptr inbounds i8*, i8** %29, i64 1
  store i8* %6, i8** %31, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = getelementptr inbounds i8*, i8** %29, i64 2
  store i8* %9, i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = getelementptr inbounds i8*, i8** %29, i64 3
  store i8* %12, i8** %33, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = getelementptr inbounds i8*, i8** %29, i64 4
  store i8* %15, i8** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = getelementptr inbounds i8*, i8** %29, i64 5
  store i8* %18, i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = getelementptr inbounds i8*, i8** %29, i64 6
  store i8* %21, i8** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = getelementptr inbounds i8*, i8** %29, i64 7
  store i8* %24, i8** %37, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fg.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %fg.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
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
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  %71 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %68, i64 %70
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %66
  %77 = load i8*, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !14
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
  %86 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.30 to i8*), i8* %63)
  %87 = call i64 @nish_arena_mark()
  %88 = call i8* @visible(i8* %86)
  %89 = call i8* @nish_arena_keep(i64 %87, i8* %88)
  call void @nish_print(i8* %89)
  %90 = call i64 @nish_arena_mark()
  %91 = call i8* @nish.Style.brightBlack(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %92 = call i8* @nish_arena_keep(i64 %90, i8* %91)
  %93 = call i64 @nish_arena_mark()
  %94 = call i8* @nish.Style.brightRed(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %95 = call i8* @nish_arena_keep(i64 %93, i8* %94)
  %96 = call i64 @nish_arena_mark()
  %97 = call i8* @nish.Style.brightGreen(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %98 = call i8* @nish_arena_keep(i64 %96, i8* %97)
  %99 = call i64 @nish_arena_mark()
  %100 = call i8* @nish.Style.brightYellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %101 = call i8* @nish_arena_keep(i64 %99, i8* %100)
  %102 = call i64 @nish_arena_mark()
  %103 = call i8* @nish.Style.brightBlue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %104 = call i8* @nish_arena_keep(i64 %102, i8* %103)
  %105 = call i64 @nish_arena_mark()
  %106 = call i8* @nish.Style.brightMagenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %107 = call i8* @nish_arena_keep(i64 %105, i8* %106)
  %108 = call i64 @nish_arena_mark()
  %109 = call i8* @nish.Style.brightCyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %110 = call i8* @nish_arena_keep(i64 %108, i8* %109)
  %111 = call i64 @nish_arena_mark()
  %112 = call i8* @nish.Style.brightWhite(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %113 = call i8* @nish_arena_keep(i64 %111, i8* %112)
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %114, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %116 = bitcast [8 x i8*]* %arr.data.1 to i8*
  %117 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %116, i8** %117, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %118 = bitcast i8* %116 to i8**
  %119 = getelementptr inbounds i8*, i8** %118, i64 0
  store i8* %92, i8** %119, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %120 = getelementptr inbounds i8*, i8** %118, i64 1
  store i8* %95, i8** %120, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %121 = getelementptr inbounds i8*, i8** %118, i64 2
  store i8* %98, i8** %121, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %122 = getelementptr inbounds i8*, i8** %118, i64 3
  store i8* %101, i8** %122, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %123 = getelementptr inbounds i8*, i8** %118, i64 4
  store i8* %104, i8** %123, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %124 = getelementptr inbounds i8*, i8** %118, i64 5
  store i8* %107, i8** %124, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %125 = getelementptr inbounds i8*, i8** %118, i64 6
  store i8* %110, i8** %125, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %126 = getelementptr inbounds i8*, i8** %118, i64 7
  store i8* %113, i8** %126, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %bright.addr, align 8
  %127 = load %struct.nish_array*, %struct.nish_array** %bright.addr, align 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 0
  %129 = load i64, i64* %128, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %130 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %131 = load i64, i64* %130, align 8
  %132 = sub i64 %129, 1
  %133 = mul i64 %131, %132
  %134 = icmp eq i64 %129, 0
  %135 = select i1 %134, i64 0, i64 %133
  store i64 %135, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %136 = load i64, i64* %join.at.1, align 8
  %137 = icmp ult i64 %136, %129
  br i1 %137, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %139 = load i8*, i8** %138, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %140 = bitcast i8* %139 to i8**
  %141 = getelementptr inbounds i8*, i8** %140, i64 %136
  %142 = load i8*, i8** %141, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = load i64, i64* %join.total.1, align 8
  %144 = bitcast i8* %142 to i64*
  %145 = load i64, i64* %144, align 8
  %146 = add i64 %143, %145
  store i64 %146, i64* %join.total.1, align 8
  %147 = add i64 %136, 1
  store i64 %147, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %148 = load i64, i64* %join.total.1, align 8
  %149 = icmp ugt i64 %148, 2147483647
  %150 = add i64 %148, 9
  %151 = select i1 %149, i64 4611686018427387904, i64 %150
  %152 = call i8* @nish_alloc_struct(i64 %151)
  %153 = bitcast i8* %152 to i64*
  store i64 %148, i64* %153, align 8
  %154 = getelementptr inbounds i8, i8* %152, i64 8
  store i8* %154, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %155 = load i64, i64* %join.at.1, align 8
  %156 = icmp ult i64 %155, %129
  br i1 %156, label %join.part.1, label %join.end.1

join.part.1:
  %157 = load i8*, i8** %join.p.1, align 8
  %158 = icmp eq i64 %155, 0
  %159 = select i1 %158, i64 0, i64 %131
  %160 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %157, i8* %160, i64 %159, i1 false)
  %161 = getelementptr inbounds i8, i8* %157, i64 %159
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %163 = load i8*, i8** %162, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %164 = bitcast i8* %163 to i8**
  %165 = getelementptr inbounds i8*, i8** %164, i64 %155
  %166 = load i8*, i8** %165, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %167 = bitcast i8* %166 to i64*
  %168 = load i64, i64* %167, align 8
  %169 = getelementptr inbounds i8, i8* %166, i64 8
  %170 = icmp eq i64 %168, 1
  br i1 %170, label %join.byte.1, label %join.bulk.1

join.byte.1:
  %171 = load i8, i8* %169, align 1
  store i8 %171, i8* %161, align 1
  br label %join.next.1

join.bulk.1:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %161, i8* %169, i64 %168, i1 false)
  br label %join.next.1

join.next.1:
  %172 = getelementptr inbounds i8, i8* %161, i64 %168
  store i8* %172, i8** %join.p.1, align 8
  %173 = add i64 %155, 1
  store i64 %173, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %174 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %174, align 1
  %175 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.32 to i8*), i8* %152)
  %176 = call i64 @nish_arena_mark()
  %177 = call i8* @visible(i8* %175)
  %178 = call i8* @nish_arena_keep(i64 %176, i8* %177)
  call void @nish_print(i8* %178)
  %179 = call i64 @nish_arena_mark()
  %180 = call i8* @nish.Style.bgBlack(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %181 = call i8* @nish_arena_keep(i64 %179, i8* %180)
  %182 = call i64 @nish_arena_mark()
  %183 = call i8* @nish.Style.bgRed(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %184 = call i8* @nish_arena_keep(i64 %182, i8* %183)
  %185 = call i64 @nish_arena_mark()
  %186 = call i8* @nish.Style.bgGreen(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %187 = call i8* @nish_arena_keep(i64 %185, i8* %186)
  %188 = call i64 @nish_arena_mark()
  %189 = call i8* @nish.Style.bgYellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %190 = call i8* @nish_arena_keep(i64 %188, i8* %189)
  %191 = call i64 @nish_arena_mark()
  %192 = call i8* @nish.Style.bgBlue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %193 = call i8* @nish_arena_keep(i64 %191, i8* %192)
  %194 = call i64 @nish_arena_mark()
  %195 = call i8* @nish.Style.bgMagenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %196 = call i8* @nish_arena_keep(i64 %194, i8* %195)
  %197 = call i64 @nish_arena_mark()
  %198 = call i8* @nish.Style.bgCyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %199 = call i8* @nish_arena_keep(i64 %197, i8* %198)
  %200 = call i64 @nish_arena_mark()
  %201 = call i8* @nish.Style.bgWhite(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %202 = call i8* @nish_arena_keep(i64 %200, i8* %201)
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %203, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %204, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %205 = bitcast [8 x i8*]* %arr.data.2 to i8*
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %205, i8** %206, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %207 = bitcast i8* %205 to i8**
  %208 = getelementptr inbounds i8*, i8** %207, i64 0
  store i8* %181, i8** %208, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %209 = getelementptr inbounds i8*, i8** %207, i64 1
  store i8* %184, i8** %209, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %210 = getelementptr inbounds i8*, i8** %207, i64 2
  store i8* %187, i8** %210, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %211 = getelementptr inbounds i8*, i8** %207, i64 3
  store i8* %190, i8** %211, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %212 = getelementptr inbounds i8*, i8** %207, i64 4
  store i8* %193, i8** %212, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %213 = getelementptr inbounds i8*, i8** %207, i64 5
  store i8* %196, i8** %213, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %214 = getelementptr inbounds i8*, i8** %207, i64 6
  store i8* %199, i8** %214, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %215 = getelementptr inbounds i8*, i8** %207, i64 7
  store i8* %202, i8** %215, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %bg.addr, align 8
  %216 = load %struct.nish_array*, %struct.nish_array** %bg.addr, align 8
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %220 = load i64, i64* %219, align 8
  %221 = sub i64 %218, 1
  %222 = mul i64 %220, %221
  %223 = icmp eq i64 %218, 0
  %224 = select i1 %223, i64 0, i64 %222
  store i64 %224, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %225 = load i64, i64* %join.at.2, align 8
  %226 = icmp ult i64 %225, %218
  br i1 %226, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %227 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 2
  %228 = load i8*, i8** %227, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %229 = bitcast i8* %228 to i8**
  %230 = getelementptr inbounds i8*, i8** %229, i64 %225
  %231 = load i8*, i8** %230, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %232 = load i64, i64* %join.total.2, align 8
  %233 = bitcast i8* %231 to i64*
  %234 = load i64, i64* %233, align 8
  %235 = add i64 %232, %234
  store i64 %235, i64* %join.total.2, align 8
  %236 = add i64 %225, 1
  store i64 %236, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %237 = load i64, i64* %join.total.2, align 8
  %238 = icmp ugt i64 %237, 2147483647
  %239 = add i64 %237, 9
  %240 = select i1 %238, i64 4611686018427387904, i64 %239
  %241 = call i8* @nish_alloc_struct(i64 %240)
  %242 = bitcast i8* %241 to i64*
  store i64 %237, i64* %242, align 8
  %243 = getelementptr inbounds i8, i8* %241, i64 8
  store i8* %243, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %244 = load i64, i64* %join.at.2, align 8
  %245 = icmp ult i64 %244, %218
  br i1 %245, label %join.part.2, label %join.end.2

join.part.2:
  %246 = load i8*, i8** %join.p.2, align 8
  %247 = icmp eq i64 %244, 0
  %248 = select i1 %247, i64 0, i64 %220
  %249 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %246, i8* %249, i64 %248, i1 false)
  %250 = getelementptr inbounds i8, i8* %246, i64 %248
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 2
  %252 = load i8*, i8** %251, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %253 = bitcast i8* %252 to i8**
  %254 = getelementptr inbounds i8*, i8** %253, i64 %244
  %255 = load i8*, i8** %254, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %256 = bitcast i8* %255 to i64*
  %257 = load i64, i64* %256, align 8
  %258 = getelementptr inbounds i8, i8* %255, i64 8
  %259 = icmp eq i64 %257, 1
  br i1 %259, label %join.byte.2, label %join.bulk.2

join.byte.2:
  %260 = load i8, i8* %258, align 1
  store i8 %260, i8* %250, align 1
  br label %join.next.2

join.bulk.2:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %250, i8* %258, i64 %257, i1 false)
  br label %join.next.2

join.next.2:
  %261 = getelementptr inbounds i8, i8* %250, i64 %257
  store i8* %261, i8** %join.p.2, align 8
  %262 = add i64 %244, 1
  store i64 %262, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %263 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %263, align 1
  %264 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*), i8* %241)
  %265 = call i64 @nish_arena_mark()
  %266 = call i8* @visible(i8* %264)
  %267 = call i8* @nish_arena_keep(i64 %265, i8* %266)
  call void @nish_print(i8* %267)
  %268 = call i64 @nish_arena_mark()
  %269 = call i8* @nish.Style.bgBrightBlack(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  %270 = call i8* @nish_arena_keep(i64 %268, i8* %269)
  %271 = call i64 @nish_arena_mark()
  %272 = call i8* @nish.Style.bgBrightRed(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.23 to i8*))
  %273 = call i8* @nish_arena_keep(i64 %271, i8* %272)
  %274 = call i64 @nish_arena_mark()
  %275 = call i8* @nish.Style.bgBrightGreen(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.24 to i8*))
  %276 = call i8* @nish_arena_keep(i64 %274, i8* %275)
  %277 = call i64 @nish_arena_mark()
  %278 = call i8* @nish.Style.bgBrightYellow(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %279 = call i8* @nish_arena_keep(i64 %277, i8* %278)
  %280 = call i64 @nish_arena_mark()
  %281 = call i8* @nish.Style.bgBrightBlue(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %282 = call i8* @nish_arena_keep(i64 %280, i8* %281)
  %283 = call i64 @nish_arena_mark()
  %284 = call i8* @nish.Style.bgBrightMagenta(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.27 to i8*))
  %285 = call i8* @nish_arena_keep(i64 %283, i8* %284)
  %286 = call i64 @nish_arena_mark()
  %287 = call i8* @nish.Style.bgBrightCyan(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*))
  %288 = call i8* @nish_arena_keep(i64 %286, i8* %287)
  %289 = call i64 @nish_arena_mark()
  %290 = call i8* @nish.Style.bgBrightWhite(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.29 to i8*))
  %291 = call i8* @nish_arena_keep(i64 %289, i8* %290)
  %292 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %292, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %293 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %293, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %294 = bitcast [8 x i8*]* %arr.data.3 to i8*
  %295 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %294, i8** %295, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %296 = bitcast i8* %294 to i8**
  %297 = getelementptr inbounds i8*, i8** %296, i64 0
  store i8* %270, i8** %297, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %298 = getelementptr inbounds i8*, i8** %296, i64 1
  store i8* %273, i8** %298, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %299 = getelementptr inbounds i8*, i8** %296, i64 2
  store i8* %276, i8** %299, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %300 = getelementptr inbounds i8*, i8** %296, i64 3
  store i8* %279, i8** %300, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %301 = getelementptr inbounds i8*, i8** %296, i64 4
  store i8* %282, i8** %301, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %302 = getelementptr inbounds i8*, i8** %296, i64 5
  store i8* %285, i8** %302, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %303 = getelementptr inbounds i8*, i8** %296, i64 6
  store i8* %288, i8** %303, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %304 = getelementptr inbounds i8*, i8** %296, i64 7
  store i8* %291, i8** %304, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %bgBright.addr, align 8
  %305 = load %struct.nish_array*, %struct.nish_array** %bgBright.addr, align 8
  %306 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %305, i64 0, i32 0
  %307 = load i64, i64* %306, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %308 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %309 = load i64, i64* %308, align 8
  %310 = sub i64 %307, 1
  %311 = mul i64 %309, %310
  %312 = icmp eq i64 %307, 0
  %313 = select i1 %312, i64 0, i64 %311
  store i64 %313, i64* %join.total.3, align 8
  store i64 0, i64* %join.at.3, align 8
  br label %join.sum.3

join.sum.3:
  %314 = load i64, i64* %join.at.3, align 8
  %315 = icmp ult i64 %314, %307
  br i1 %315, label %join.sum.body.3, label %join.copy.3

join.sum.body.3:
  %316 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %305, i64 0, i32 2
  %317 = load i8*, i8** %316, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %318 = bitcast i8* %317 to i8**
  %319 = getelementptr inbounds i8*, i8** %318, i64 %314
  %320 = load i8*, i8** %319, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %321 = load i64, i64* %join.total.3, align 8
  %322 = bitcast i8* %320 to i64*
  %323 = load i64, i64* %322, align 8
  %324 = add i64 %321, %323
  store i64 %324, i64* %join.total.3, align 8
  %325 = add i64 %314, 1
  store i64 %325, i64* %join.at.3, align 8
  br label %join.sum.3

join.copy.3:
  %326 = load i64, i64* %join.total.3, align 8
  %327 = icmp ugt i64 %326, 2147483647
  %328 = add i64 %326, 9
  %329 = select i1 %327, i64 4611686018427387904, i64 %328
  %330 = call i8* @nish_alloc_struct(i64 %329)
  %331 = bitcast i8* %330 to i64*
  store i64 %326, i64* %331, align 8
  %332 = getelementptr inbounds i8, i8* %330, i64 8
  store i8* %332, i8** %join.p.3, align 8
  store i64 0, i64* %join.at.3, align 8
  br label %join.copy.body.3

join.copy.body.3:
  %333 = load i64, i64* %join.at.3, align 8
  %334 = icmp ult i64 %333, %307
  br i1 %334, label %join.part.3, label %join.end.3

join.part.3:
  %335 = load i8*, i8** %join.p.3, align 8
  %336 = icmp eq i64 %333, 0
  %337 = select i1 %336, i64 0, i64 %309
  %338 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %335, i8* %338, i64 %337, i1 false)
  %339 = getelementptr inbounds i8, i8* %335, i64 %337
  %340 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %305, i64 0, i32 2
  %341 = load i8*, i8** %340, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %342 = bitcast i8* %341 to i8**
  %343 = getelementptr inbounds i8*, i8** %342, i64 %333
  %344 = load i8*, i8** %343, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %345 = bitcast i8* %344 to i64*
  %346 = load i64, i64* %345, align 8
  %347 = getelementptr inbounds i8, i8* %344, i64 8
  %348 = icmp eq i64 %346, 1
  br i1 %348, label %join.byte.3, label %join.bulk.3

join.byte.3:
  %349 = load i8, i8* %347, align 1
  store i8 %349, i8* %339, align 1
  br label %join.next.3

join.bulk.3:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %339, i8* %347, i64 %346, i1 false)
  br label %join.next.3

join.next.3:
  %350 = getelementptr inbounds i8, i8* %339, i64 %346
  store i8* %350, i8** %join.p.3, align 8
  %351 = add i64 %333, 1
  store i64 %351, i64* %join.at.3, align 8
  br label %join.copy.body.3

join.end.3:
  %352 = load i8*, i8** %join.p.3, align 8
  store i8 0, i8* %352, align 1
  %353 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.34 to i8*), i8* %330)
  %354 = call i64 @nish_arena_mark()
  %355 = call i8* @visible(i8* %353)
  %356 = call i8* @nish_arena_keep(i64 %354, i8* %355)
  call void @nish_print(i8* %356)
  %357 = call i64 @nish_arena_mark()
  %358 = call i8* @nish.Style.bold(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %359 = call i8* @nish_arena_keep(i64 %357, i8* %358)
  %360 = call i64 @nish_arena_mark()
  %361 = call i8* @nish.Style.faint(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.35 to i8*))
  %362 = call i8* @nish_arena_keep(i64 %360, i8* %361)
  %363 = call i64 @nish_arena_mark()
  %364 = call i8* @nish.Style.italic(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.36 to i8*))
  %365 = call i8* @nish_arena_keep(i64 %363, i8* %364)
  %366 = call i64 @nish_arena_mark()
  %367 = call i8* @nish.Style.underline(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.37 to i8*))
  %368 = call i8* @nish_arena_keep(i64 %366, i8* %367)
  %369 = call i64 @nish_arena_mark()
  %370 = call i8* @nish.Style.inverse(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.38 to i8*))
  %371 = call i8* @nish_arena_keep(i64 %369, i8* %370)
  %372 = call i64 @nish_arena_mark()
  %373 = call i8* @nish.Style.strikethrough(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.39 to i8*))
  %374 = call i8* @nish_arena_keep(i64 %372, i8* %373)
  %375 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 6, i64* %375, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %376 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 6, i64* %376, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %377 = bitcast [6 x i8*]* %arr.data.4 to i8*
  %378 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %377, i8** %378, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %379 = bitcast i8* %377 to i8**
  %380 = getelementptr inbounds i8*, i8** %379, i64 0
  store i8* %359, i8** %380, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %381 = getelementptr inbounds i8*, i8** %379, i64 1
  store i8* %362, i8** %381, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %382 = getelementptr inbounds i8*, i8** %379, i64 2
  store i8* %365, i8** %382, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %383 = getelementptr inbounds i8*, i8** %379, i64 3
  store i8* %368, i8** %383, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %384 = getelementptr inbounds i8*, i8** %379, i64 4
  store i8* %371, i8** %384, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %385 = getelementptr inbounds i8*, i8** %379, i64 5
  store i8* %374, i8** %385, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.4, %struct.nish_array** %attrs.addr, align 8
  %386 = load %struct.nish_array*, %struct.nish_array** %attrs.addr, align 8
  %387 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %386, i64 0, i32 0
  %388 = load i64, i64* %387, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %389 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*) to i64*
  %390 = load i64, i64* %389, align 8
  %391 = sub i64 %388, 1
  %392 = mul i64 %390, %391
  %393 = icmp eq i64 %388, 0
  %394 = select i1 %393, i64 0, i64 %392
  store i64 %394, i64* %join.total.4, align 8
  store i64 0, i64* %join.at.4, align 8
  br label %join.sum.4

join.sum.4:
  %395 = load i64, i64* %join.at.4, align 8
  %396 = icmp ult i64 %395, %388
  br i1 %396, label %join.sum.body.4, label %join.copy.4

join.sum.body.4:
  %397 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %386, i64 0, i32 2
  %398 = load i8*, i8** %397, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %399 = bitcast i8* %398 to i8**
  %400 = getelementptr inbounds i8*, i8** %399, i64 %395
  %401 = load i8*, i8** %400, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %402 = load i64, i64* %join.total.4, align 8
  %403 = bitcast i8* %401 to i64*
  %404 = load i64, i64* %403, align 8
  %405 = add i64 %402, %404
  store i64 %405, i64* %join.total.4, align 8
  %406 = add i64 %395, 1
  store i64 %406, i64* %join.at.4, align 8
  br label %join.sum.4

join.copy.4:
  %407 = load i64, i64* %join.total.4, align 8
  %408 = icmp ugt i64 %407, 2147483647
  %409 = add i64 %407, 9
  %410 = select i1 %408, i64 4611686018427387904, i64 %409
  %411 = call i8* @nish_alloc_struct(i64 %410)
  %412 = bitcast i8* %411 to i64*
  store i64 %407, i64* %412, align 8
  %413 = getelementptr inbounds i8, i8* %411, i64 8
  store i8* %413, i8** %join.p.4, align 8
  store i64 0, i64* %join.at.4, align 8
  br label %join.copy.body.4

join.copy.body.4:
  %414 = load i64, i64* %join.at.4, align 8
  %415 = icmp ult i64 %414, %388
  br i1 %415, label %join.part.4, label %join.end.4

join.part.4:
  %416 = load i8*, i8** %join.p.4, align 8
  %417 = icmp eq i64 %414, 0
  %418 = select i1 %417, i64 0, i64 %390
  %419 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %416, i8* %419, i64 %418, i1 false)
  %420 = getelementptr inbounds i8, i8* %416, i64 %418
  %421 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %386, i64 0, i32 2
  %422 = load i8*, i8** %421, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %423 = bitcast i8* %422 to i8**
  %424 = getelementptr inbounds i8*, i8** %423, i64 %414
  %425 = load i8*, i8** %424, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %426 = bitcast i8* %425 to i64*
  %427 = load i64, i64* %426, align 8
  %428 = getelementptr inbounds i8, i8* %425, i64 8
  %429 = icmp eq i64 %427, 1
  br i1 %429, label %join.byte.4, label %join.bulk.4

join.byte.4:
  %430 = load i8, i8* %428, align 1
  store i8 %430, i8* %420, align 1
  br label %join.next.4

join.bulk.4:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %420, i8* %428, i64 %427, i1 false)
  br label %join.next.4

join.next.4:
  %431 = getelementptr inbounds i8, i8* %420, i64 %427
  store i8* %431, i8** %join.p.4, align 8
  %432 = add i64 %414, 1
  store i64 %432, i64* %join.at.4, align 8
  br label %join.copy.body.4

join.end.4:
  %433 = load i8*, i8** %join.p.4, align 8
  store i8 0, i8* %433, align 1
  %434 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.40 to i8*), i8* %411)
  %435 = call i64 @nish_arena_mark()
  %436 = call i8* @visible(i8* %434)
  %437 = call i8* @nish_arena_keep(i64 %435, i8* %436)
  call void @nish_print(i8* %437)
  %438 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.43 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.44 to i8*))
  %439 = call i8* @nish_str_concat(i8* %438, i8* bitcast ({ i64, [3 x i8] }* @.str.45 to i8*))
  %440 = call i64 @nish_arena_mark()
  %441 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*), i8* %439)
  %442 = call i8* @nish_arena_keep(i64 %440, i8* %441)
  %443 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.41 to i8*), i8* %442)
  %444 = call i8* @nish_str_concat(i8* %443, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %445 = call i64 @nish_arena_mark()
  %446 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.46 to i8*), i8* bitcast ({ i64, [9 x i8] }* @.str.47 to i8*))
  %447 = call i8* @nish_arena_keep(i64 %445, i8* %446)
  %448 = call i8* @nish_str_concat(i8* %444, i8* %447)
  %449 = call i8* @nish_str_concat(i8* %448, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %450 = call i64 @nish_arena_mark()
  %451 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.48 to i8*), i8* bitcast ({ i64, [15 x i8] }* @.str.49 to i8*))
  %452 = call i8* @nish_arena_keep(i64 %450, i8* %451)
  %453 = call i8* @nish_str_concat(i8* %449, i8* %452)
  %454 = call i64 @nish_arena_mark()
  %455 = call i8* @visible(i8* %453)
  %456 = call i8* @nish_arena_keep(i64 %454, i8* %455)
  call void @nish_print(i8* %456)
  %457 = call i64 @nish_arena_mark()
  %458 = call i8* @nish.Style.red(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.51 to i8*))
  %459 = call i8* @nish_arena_keep(i64 %457, i8* %458)
  %460 = call i64 @nish_arena_mark()
  %461 = call i8* @nish.Style.bold(%struct.Style* %s, i8* %459)
  %462 = call i8* @nish_arena_keep(i64 %460, i8* %461)
  %463 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.50 to i8*), i8* %462)
  %464 = call i8* @nish_str_concat(i8* %463, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %465 = call i64 @nish_arena_mark()
  %466 = call i8* @nish.Style.white(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.26 to i8*))
  %467 = call i8* @nish_arena_keep(i64 %465, i8* %466)
  %468 = call i64 @nish_arena_mark()
  %469 = call i8* @nish.Style.bgBlue(%struct.Style* %s, i8* %467)
  %470 = call i8* @nish_arena_keep(i64 %468, i8* %469)
  %471 = call i8* @nish_str_concat(i8* %464, i8* %470)
  %472 = call i8* @nish_str_concat(i8* %471, i8* bitcast ({ i64, [2 x i8] }* @.str.31 to i8*))
  %473 = call i64 @nish_arena_mark()
  %474 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.28 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.52 to i8*))
  %475 = call i8* @nish_arena_keep(i64 %473, i8* %474)
  %476 = call i8* @nish_str_concat(i8* %472, i8* %475)
  %477 = call i64 @nish_arena_mark()
  %478 = call i8* @visible(i8* %476)
  %479 = call i8* @nish_arena_keep(i64 %477, i8* %478)
  call void @nish_print(i8* %479)
  %480 = call i64 @nish_arena_mark()
  %481 = call i8* @nish.Style.red(%struct.Style* %s, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %482 = call i8* @nish_arena_keep(i64 %480, i8* %481)
  %483 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.53 to i8*), i8* %482)
  %484 = call i8* @nish_str_concat(i8* %483, i8* bitcast ({ i64, [3 x i8] }* @.str.54 to i8*))
  %485 = call i64 @nish_arena_mark()
  %486 = call i8* @nish.Style.bold(%struct.Style* %s, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %487 = call i8* @nish_arena_keep(i64 %485, i8* %486)
  %488 = call i8* @nish_str_concat(i8* %484, i8* %487)
  %489 = call i8* @nish_str_concat(i8* %488, i8* bitcast ({ i64, [3 x i8] }* @.str.54 to i8*))
  %490 = call i64 @nish_arena_mark()
  %491 = call i8* @nish.Style.sgr(%struct.Style* %s, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [2 x i8] }* @.str.43 to i8*))
  %492 = call i8* @nish_arena_keep(i64 %490, i8* %491)
  %493 = call i8* @nish_str_concat(i8* %489, i8* %492)
  %494 = call i8* @nish_str_concat(i8* %493, i8* bitcast ({ i64, [2 x i8] }* @.str.55 to i8*))
  %495 = call i64 @nish_arena_mark()
  %496 = call i8* @visible(i8* %494)
  %497 = call i8* @nish_arena_keep(i64 %495, i8* %496)
  call void @nish_print(i8* %497)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(88) %struct.Style* @recoloured(i1 noundef zeroext %on, i1 noundef zeroext %colour) #1 {
entry:
  %s.addr = alloca %struct.Style*, align 8
  %0 = call i8* @nish_alloc_struct(i64 88)
  %1 = bitcast i8* %0 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %1, i1 %on, i1 %colour)
  store %struct.Style* %1, %struct.Style** %s.addr, align 8
  %2 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %3 = getelementptr inbounds %struct.Style, %struct.Style* %2, i32 0, i32 2
  store i8* bitcast ({ i64, [5 x i8] }* @.str.56 to i8*), i8** %3, align 8, !tbaa !18
  %4 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %5 = getelementptr inbounds %struct.Style, %struct.Style* %4, i32 0, i32 3
  store i8* bitcast ({ i64, [4 x i8] }* @.str.57 to i8*), i8** %5, align 8, !tbaa !19
  %6 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Style, %struct.Style* %6, i32 0, i32 4
  store i8* bitcast ({ i64, [3 x i8] }* @.str.58 to i8*), i8** %7, align 8, !tbaa !20
  %8 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %9 = getelementptr inbounds %struct.Style, %struct.Style* %8, i32 0, i32 5
  store i8* bitcast ({ i64, [2 x i8] }* @.str.59 to i8*), i8** %9, align 8, !tbaa !21
  %10 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %11 = getelementptr inbounds %struct.Style, %struct.Style* %10, i32 0, i32 6
  store i8* bitcast ({ i64, [5 x i8] }* @.str.60 to i8*), i8** %11, align 8, !tbaa !22
  %12 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %13 = getelementptr inbounds %struct.Style, %struct.Style* %12, i32 0, i32 7
  store i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8** %13, align 8, !tbaa !23
  %14 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %15 = getelementptr inbounds %struct.Style, %struct.Style* %14, i32 0, i32 8
  store i8* bitcast ({ i64, [3 x i8] }* @.str.61 to i8*), i8** %15, align 8, !tbaa !24
  %16 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %17 = getelementptr inbounds %struct.Style, %struct.Style* %16, i32 0, i32 9
  store i8* bitcast ({ i64, [2 x i8] }* @.str.62 to i8*), i8** %17, align 8, !tbaa !25
  %18 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %19 = getelementptr inbounds %struct.Style, %struct.Style* %18, i32 0, i32 10
  store i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8** %19, align 8, !tbaa !26
  %20 = load %struct.Style*, %struct.Style** %s.addr, align 8
  %21 = getelementptr inbounds %struct.Style, %struct.Style* %20, i32 0, i32 11
  store i8* bitcast ({ i64, [2 x i8] }* @.str.63 to i8*), i8** %21, align 8, !tbaa !27
  %22 = load %struct.Style*, %struct.Style** %s.addr, align 8
  ret %struct.Style* %22
}

define noundef i32 @nish_main() #0 {
entry:
  %off.addr = alloca %struct.Style*, align 8
  %Style.obj = alloca %struct.Style, align 8
  %mono.addr = alloca %struct.Style*, align 8
  %Style.obj.1 = alloca %struct.Style, align 8
  %theme.addr = alloca %struct.Style*, align 8
  %ruled.addr = alloca %struct.HelpMenu*, align 8
  %HelpMenu.obj = alloca %struct.HelpMenu, align 8
  %Style.obj.2 = alloca %struct.Style, align 8
  %Style.obj.3 = alloca %struct.Style, align 8
  %Style.obj.4 = alloca %struct.Style, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.64 to i8*))
  %0 = call i8* @nish_alloc_struct(i64 88)
  %1 = bitcast i8* %0 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %1, i1 true, i1 true)
  %2 = call i8* @menu(%struct.Style* %1)
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @visible(i8* %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_print(i8* bitcast ({ i64, [6 x i8] }* @.str.65 to i8*))
  %6 = call i8* @nish_alloc_struct(i64 88)
  %7 = bitcast i8* %6 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %7, i1 true, i1 false)
  %8 = call i8* @menu(%struct.Style* %7)
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @visible(i8* %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  call void @nish_print(i8* %11)
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.66 to i8*))
  %12 = call i8* @nish_alloc_struct(i64 88)
  %13 = bitcast i8* %12 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %13, i1 false, i1 true)
  %14 = call i8* @menu(%struct.Style* %13)
  call void @nish_print(i8* %14)
  call void @nish.Style.constructor(%struct.Style* %Style.obj, i1 false, i1 false)
  store %struct.Style* %Style.obj, %struct.Style** %off.addr, align 8
  %15 = load %struct.Style*, %struct.Style** %off.addr, align 8
  %16 = call i64 @nish_arena_mark()
  %17 = call i8* @nish.Style.heading(%struct.Style* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*))
  %18 = call i8* @nish_arena_keep(i64 %16, i8* %17)
  %19 = call zeroext i1 @nish_str_eq(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*))
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load %struct.Style*, %struct.Style** %off.addr, align 8
  %21 = call i64 @nish_arena_mark()
  %22 = call i8* @nish.Style.dim(%struct.Style* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  %23 = call i8* @nish_arena_keep(i64 %21, i8* %22)
  %24 = call zeroext i1 @nish_str_eq(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.25 to i8*))
  br label %land.end

land.end:
  %25 = phi i1 [ false, %entry ], [ %24, %land.rhs ]
  %26 = select i1 %25, i8* bitcast ({ i64, [5 x i8] }* @.str.68 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.69 to i8*)
  %27 = call i8* @nish_str_concat(i8* bitcast ({ i64, [21 x i8] }* @.str.67 to i8*), i8* %26)
  call void @nish_print(i8* %27)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.1, i1 true, i1 false)
  store %struct.Style* %Style.obj.1, %struct.Style** %mono.addr, align 8
  %28 = load %struct.Style*, %struct.Style** %mono.addr, align 8
  %29 = call i64 @nish_arena_mark()
  %30 = call i8* @nish.Style.dim(%struct.Style* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.71 to i8*))
  %31 = call i8* @nish_arena_keep(i64 %29, i8* %30)
  %32 = call zeroext i1 @nish_str_eq(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.71 to i8*))
  %33 = select i1 %32, i8* bitcast ({ i64, [5 x i8] }* @.str.68 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.69 to i8*)
  %34 = call i8* @nish_str_concat(i8* bitcast ({ i64, [20 x i8] }* @.str.70 to i8*), i8* %33)
  call void @nish_print(i8* %34)
  %35 = call i8* @nish_alloc_struct(i64 88)
  %36 = bitcast i8* %35 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %36, i1 true, i1 true)
  store %struct.Style* %36, %struct.Style** %theme.addr, align 8
  %37 = load %struct.Style*, %struct.Style** %theme.addr, align 8
  call void @nish.HelpMenu.constructor(%struct.HelpMenu* %HelpMenu.obj, %struct.Style* %37, i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i32 24, i32 30)
  store %struct.HelpMenu* %HelpMenu.obj, %struct.HelpMenu** %ruled.addr, align 8
  %38 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  call void @nish.HelpMenu.title(%struct.HelpMenu* %38, i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [10 x i8] }* @.str.4 to i8*))
  %39 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  %40 = load %struct.Style*, %struct.Style** %theme.addr, align 8
  %41 = call i64 @nish_arena_mark()
  %42 = call i8* @nish.Style.dim(%struct.Style* %40, i8* bitcast ({ i64, [24 x i8] }* @.str.72 to i8*))
  %43 = call i8* @nish_arena_keep(i64 %41, i8* %42)
  call void @nish.HelpMenu.line(%struct.HelpMenu* %39, i8* %43)
  %44 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  call void @nish.HelpMenu.line(%struct.HelpMenu* %44, i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*))
  %45 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  call void @nish.HelpMenu.usage(%struct.HelpMenu* %45, i8* bitcast ({ i64, [7 x i8] }* @.str.73 to i8*), i8* bitcast ({ i64, [14 x i8] }* @.str.6 to i8*))
  %46 = load %struct.HelpMenu*, %struct.HelpMenu** %ruled.addr, align 8
  %47 = call i64 @nish_arena_mark()
  %48 = call i8* @nish.HelpMenu.text(%struct.HelpMenu* %46)
  %49 = call i8* @nish_arena_keep(i64 %47, i8* %48)
  %50 = call i64 @nish_arena_mark()
  %51 = call i8* @visible(i8* %49)
  %52 = call i8* @nish_arena_keep(i64 %50, i8* %51)
  call void @nish_print(i8* %52)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.2, i1 true, i1 true)
  call void @painters(i8* bitcast ({ i64, [15 x i8] }* @.str.74 to i8*), %struct.Style* %Style.obj.2)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.3, i1 true, i1 false)
  call void @painters(i8* bitcast ({ i64, [14 x i8] }* @.str.75 to i8*), %struct.Style* %Style.obj.3)
  call void @nish.Style.constructor(%struct.Style* %Style.obj.4, i1 false, i1 true)
  call void @painters(i8* bitcast ({ i64, [13 x i8] }* @.str.76 to i8*), %struct.Style* %Style.obj.4)
  call void @nish_print(i8* bitcast ({ i64, [18 x i8] }* @.str.77 to i8*))
  %53 = call %struct.Style* @recoloured(i1 true, i1 true)
  %54 = call i8* @menu(%struct.Style* %53)
  %55 = call i64 @nish_arena_mark()
  %56 = call i8* @visible(i8* %54)
  %57 = call i8* @nish_arena_keep(i64 %55, i8* %56)
  call void @nish_print(i8* %57)
  call void @nish_print(i8* bitcast ({ i64, [17 x i8] }* @.str.78 to i8*))
  %58 = call %struct.Style* @recoloured(i1 true, i1 false)
  %59 = call i8* @menu(%struct.Style* %58)
  %60 = call i64 @nish_arena_mark()
  %61 = call i8* @visible(i8* %59)
  %62 = call i8* @nish_arena_keep(i64 %60, i8* %61)
  call void @nish_print(i8* %62)
  %63 = call %struct.Style* @recoloured(i1 false, i1 true)
  %64 = call i8* @menu(%struct.Style* %63)
  %65 = call i8* @nish_alloc_struct(i64 88)
  %66 = bitcast i8* %65 to %struct.Style*
  call void @nish.Style.constructor(%struct.Style* %66, i1 false, i1 false)
  %67 = call i8* @menu(%struct.Style* %66)
  %68 = call zeroext i1 @nish_str_eq(i8* %64, i8* %67)
  %69 = select i1 %68, i8* bitcast ({ i64, [5 x i8] }* @.str.68 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.69 to i8*)
  %70 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.79 to i8*), i8* %69)
  call void @nish_print(i8* %70)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!28, !29, !30, !31, !32}
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i1", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Style", !15, i64 0, !15, i64 1, !16, i64 8, !16, i64 16, !16, i64 24, !16, i64 32, !16, i64 40, !16, i64 48, !16, i64 56, !16, i64 64, !16, i64 72, !16, i64 80}
!18 = !{!17, !16, i64 8}
!19 = !{!17, !16, i64 16}
!20 = !{!17, !16, i64 24}
!21 = !{!17, !16, i64 32}
!22 = !{!17, !16, i64 40}
!23 = !{!17, !16, i64 48}
!24 = !{!17, !16, i64 56}
!25 = !{!17, !16, i64 64}
!26 = !{!17, !16, i64 72}
!27 = !{!17, !16, i64 80}
!28 = !{i32 8, !"cf-protection-branch", i32 1}
!29 = !{i32 8, !"cf-protection-return", i32 1}
!30 = !{i32 8, !"branch-target-enforcement", i32 1}
!31 = !{i32 8, !"sign-return-address", i32 1}
!32 = !{i32 4, !"probe-stack", !"inline-asm"}
