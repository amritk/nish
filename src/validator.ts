/**
 * Phase 0: forbidden-syntax sweep.
 *
 * Walks the entire syntax tree once (`ts.forEachChild`, pre-order) and
 * reports a `CompileError` for every construct that StaticTS can never
 * compile: anything that requires dynamic typing, prototype lookup,
 * reflection, unwinding, or a garbage-collected heap. Every rule here is
 * decidable from syntax alone; nothing depends on types or scopes. With a
 * `DiagnosticSink` the sweep reports every forbidden construct in the file
 * (skipping the inside of a rejected node, so `Array<any>` is one error, not
 * two); without one it throws on the first, in source order.
 *
 * The validator is defence in depth. It runs before the checker so that a
 * forbidden construct is rejected even where the checker never looks (an
 * `any` nested three type arguments deep, a `delete` inside an unreachable
 * branch, a `with` block in a function nobody calls). Constructs that are
 * merely not supported *yet* (control flow, classes, arrays, ...) are not the
 * validator's business: the checker rejects those, and later work packages
 * make them compile without touching this file.
 *
 * Rules are keyed by `ts.SyntaxKind` in `validators`; identifiers and
 * property names that are banned as values live in the small tables below.
 * The full list, with the reason each construct is forbidden, is in
 * `docs/wp0-validator.md`.
 *
 * Requires `setParentNodes` (as `parseSource` does): the identifier rule
 * looks at `node.parent` to tell a value reference from a property name.
 */
import ts from "typescript";
import { CompileError, DiagnosticSink } from "./diagnostics";
import { lookup } from "./lookup";

type Validator = (node: ts.Node, sf: ts.SourceFile) => void;

function fail(message: string, node: ts.Node, sf: ts.SourceFile): never {
  throw new CompileError(message, node, sf);
}

// ---- Banned names -----------------------------------------------------------

/** Identifiers that may never appear as a value (call target, operand, argument, ...). */
const FORBIDDEN_VALUE_IDENTIFIERS: Record<string, string> = {
  eval: "`eval` is forbidden in StaticTS (no interpreter at runtime)",
  Function: "`Function` is forbidden in StaticTS (no interpreter at runtime)",
  Proxy: "`Proxy` is forbidden in StaticTS (no dynamic property interception)",
  Reflect: "`Reflect` is forbidden in StaticTS (no runtime reflection)",
  Symbol: "`Symbol` is forbidden in StaticTS (no symbol type)",
  globalThis: "`globalThis` is forbidden in StaticTS (no global object)",
  arguments: "`arguments` is forbidden in StaticTS (functions have fixed arity)",
  undefined: "`undefined` is forbidden in StaticTS; use `null` with a `T | null` type",
};

/** Type names that may never be referenced. */
const FORBIDDEN_TYPE_NAMES: Record<string, string> = {
  Function: "`Function` type is forbidden in StaticTS (no dynamic function values)",
  Symbol: "`Symbol` type is forbidden in StaticTS (no symbol type)",
  Proxy: "`Proxy` type is forbidden in StaticTS (no dynamic property interception)",
};

/** `Object.<member>` calls that mutate object shape or prototype chain. */
const FORBIDDEN_OBJECT_MEMBERS = new Set([
  "assign",
  "create",
  "defineProperty",
  "defineProperties",
  "setPrototypeOf",
  "getPrototypeOf",
]);

// ---- Helpers ----------------------------------------------------------------

/** True when `id` is used as a value, not as the name being declared or accessed. */
function isValueReference(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent)) return parent.name !== id;
  if (ts.isQualifiedName(parent) || ts.isTypeReferenceNode(parent)) return false;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) return false;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return false;
  if (ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false;
  if (ts.isPropertyAssignment(parent) || ts.isShorthandPropertyAssignment(parent)) return parent.name !== id;
  if (ts.isBindingElement(parent)) return parent.propertyName === id ? false : parent.name !== id;
  // Every declaration kind (variable, parameter, function, class, method,
  // property, enum member, type alias, ...) carries the declared name in `name`.
  const named = parent as ts.Node & { name?: ts.Node };
  return named.name !== id;
}

function isNullType(t: ts.TypeNode): boolean {
  return ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword;
}

/** `T | null` and `null | T` are the only unions StaticTS accepts. */
function isNullableUnion(union: ts.UnionTypeNode): boolean {
  const members = union.types;
  return members.length === 2 && isNullType(members[0]) !== isNullType(members[1]);
}

/**
 * Syntactic shape of an acceptable array index: anything that could only
 * evaluate to a number. The checker enforces the actual type; the validator
 * only rules out string-shaped keys that would need a property lookup.
 */
function isNumericIndexShape(expr: ts.Expression): boolean {
  switch (expr.kind) {
    case ts.SyntaxKind.Identifier:
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.CallExpression:
    case ts.SyntaxKind.PropertyAccessExpression:
    case ts.SyntaxKind.ElementAccessExpression:
      return true;
    case ts.SyntaxKind.ParenthesizedExpression:
      return isNumericIndexShape((expr as ts.ParenthesizedExpression).expression);
    case ts.SyntaxKind.PrefixUnaryExpression: {
      const op = (expr as ts.PrefixUnaryExpression).operator;
      return op === ts.SyntaxKind.MinusToken || op === ts.SyntaxKind.PlusToken;
    }
    case ts.SyntaxKind.BinaryExpression: {
      const bin = expr as ts.BinaryExpression;
      switch (bin.operatorToken.kind) {
        case ts.SyntaxKind.PlusToken:
        case ts.SyntaxKind.MinusToken:
        case ts.SyntaxKind.AsteriskToken:
        case ts.SyntaxKind.SlashToken:
        case ts.SyntaxKind.PercentToken:
          return isNumericIndexShape(bin.left) && isNumericIndexShape(bin.right);
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

function isNumericLiteralShape(expr: ts.Expression): boolean {
  if (ts.isNumericLiteral(expr)) return true;
  return (
    ts.isPrefixUnaryExpression(expr) &&
    expr.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expr.operand)
  );
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return undefined;
}

// ---- Rules: types ------------------------------------------------------------

const rejectAny: Validator = (node, sf) => fail("`any` is forbidden in StaticTS", node, sf);
const rejectUnknown: Validator = (node, sf) => fail("`unknown` is forbidden in StaticTS", node, sf);
const rejectSymbolType: Validator = (node, sf) =>
  fail("`symbol` type is forbidden in StaticTS (no symbol type)", node, sf);
const rejectBigIntType: Validator = (node, sf) =>
  fail("`bigint` type is forbidden in StaticTS (use number, i32, or f64)", node, sf);
const rejectUndefinedType: Validator = (node, sf) =>
  fail("`undefined` is forbidden in StaticTS; use `null` with a `T | null` type", node, sf);

const checkUnionType: Validator = (node, sf) => {
  if (!isNullableUnion(node as ts.UnionTypeNode)) {
    fail(
      "Union types other than `T | null` are forbidden in StaticTS (values have one fixed layout)",
      node,
      sf
    );
  }
};

const checkTypeReference: Validator = (node, sf) => {
  const ref = node as ts.TypeReferenceNode;
  if (ts.isIdentifier(ref.typeName)) {
    const msg = FORBIDDEN_TYPE_NAMES[ref.typeName.text];
    if (msg) fail(msg, ref.typeName, sf);
  }
};

const rejectImportType: Validator = (node, sf) =>
  fail("Dynamic `import()` is forbidden in StaticTS (modules are resolved at compile time)", node, sf);

const checkTypeAssertion: Validator = (node, sf) => {
  const type = (node as ts.AsExpression | ts.TypeAssertion).type;
  if (type.kind === ts.SyntaxKind.AnyKeyword)
    fail("Type assertion to `any` is forbidden in StaticTS", type, sf);
  if (type.kind === ts.SyntaxKind.UnknownKeyword) {
    fail("Type assertion to `unknown` is forbidden in StaticTS", type, sf);
  }
};

// ---- Rules: declarations ----------------------------------------------------------

const checkFunctionLike: Validator = (node, sf) => {
  const fn = node as ts.FunctionLikeDeclaration;
  if (fn.typeParameters && fn.typeParameters.length > 0) {
    fail(
      "Generic type parameters are forbidden in StaticTS (no monomorphisation yet)",
      fn.typeParameters[0],
      sf
    );
  }
  if (fn.asteriskToken)
    fail("Generators are forbidden in StaticTS (no coroutine runtime)", fn.asteriskToken, sf);
  const asyncMod = ts.canHaveModifiers(fn)
    ? ts.getModifiers(fn)?.find((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
    : undefined;
  if (asyncMod) fail("`async` functions are forbidden in StaticTS (no event loop or promises)", asyncMod, sf);
};

const checkGenericDeclaration: Validator = (node, sf) => {
  const decl = node as ts.ClassLikeDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration;
  if (decl.typeParameters && decl.typeParameters.length > 0) {
    fail(
      "Generic type parameters are forbidden in StaticTS (no monomorphisation yet)",
      decl.typeParameters[0],
      sf
    );
  }
};

const checkVariableDeclarationList: Validator = (node, sf) => {
  const list = node as ts.VariableDeclarationList;
  if (!(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) {
    fail("`var` is forbidden; use `let` or `const`", list.parent ?? list, sf);
  }
};

const checkEnum: Validator = (node, sf) => {
  for (const member of (node as ts.EnumDeclaration).members) {
    if (member.initializer && !isNumericLiteralShape(member.initializer)) {
      fail(
        "Enum members must be numeric literals in StaticTS (enums lower to plain integers)",
        member.initializer,
        sf
      );
    }
  }
};

const checkModuleDeclaration: Validator = (node, sf) => {
  if (node.flags & ts.NodeFlags.GlobalAugmentation) {
    fail("`declare global` is forbidden in StaticTS (no global object to augment)", node, sf);
  }
  fail("`namespace` and `module` blocks are forbidden in StaticTS (use ES module files)", node, sf);
};

const rejectDecorator: Validator = (node, sf) =>
  fail("Decorators are forbidden in StaticTS (no runtime metadata or class rewriting)", node, sf);

const rejectComputedPropertyName: Validator = (node, sf) =>
  fail(
    "Computed property names are forbidden in StaticTS (object layout is fixed at compile time)",
    node,
    sf
  );

// ---- Rules: statements ---------------------------------------------------------------

const rejectWith: Validator = (node, sf) =>
  fail("`with` is forbidden in StaticTS (no dynamic scope)", node, sf);
const rejectTry: Validator = (node, sf) =>
  fail("`try`/`catch`/`finally` is forbidden in StaticTS (no unwinding; `throw` aborts)", node, sf);
const rejectDebugger: Validator = (node, sf) =>
  fail("`debugger` is forbidden in StaticTS (no debugger hook)", node, sf);
const rejectLabeled: Validator = (node, sf) =>
  fail("Labeled statements are forbidden in StaticTS (use structured loops)", node, sf);

// ---- Rules: expressions ----------------------------------------------------------------

const checkIdentifier: Validator = (node, sf) => {
  const id = node as ts.Identifier;
  const msg = lookup(FORBIDDEN_VALUE_IDENTIFIERS, id.text);
  if (msg && isValueReference(id)) fail(msg, id, sf);
};

const checkBinary: Validator = (node, sf) => {
  if ((node as ts.BinaryExpression).operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    fail("Nullish coalescing `??` is forbidden in StaticTS (narrow with `!== null` instead)", node, sf);
  }
  const bin = node as ts.BinaryExpression;
  switch (bin.operatorToken.kind) {
    case ts.SyntaxKind.EqualsEqualsToken:
    case ts.SyntaxKind.ExclamationEqualsToken:
      fail("Loose equality is forbidden; use === / !==", bin, sf);
      break;
    case ts.SyntaxKind.InKeyword:
      fail("`in` operator is forbidden in StaticTS (no dynamic property lookup)", bin.operatorToken, sf);
      break;
    case ts.SyntaxKind.InstanceOfKeyword:
      fail("`instanceof` is forbidden in StaticTS (no prototype chain)", bin.operatorToken, sf);
      break;
    case ts.SyntaxKind.CommaToken:
      fail("Comma expressions are forbidden in StaticTS (write separate statements)", bin, sf);
      break;
    default:
      break;
  }
};

const rejectTypeOf: Validator = (node, sf) =>
  fail("`typeof` is forbidden in StaticTS (no runtime type tags)", node, sf);
const rejectDelete: Validator = (node, sf) =>
  fail("`delete` is forbidden in StaticTS (object layout is fixed)", node, sf);
const rejectVoidExpression: Validator = (node, sf) =>
  fail("`void` expressions are forbidden in StaticTS (no `undefined` value)", node, sf);
const rejectAwait: Validator = (node, sf) =>
  fail("`await` is forbidden in StaticTS (no event loop or promises)", node, sf);
const rejectYield: Validator = (node, sf) =>
  fail("`yield` is forbidden in StaticTS (no coroutine runtime)", node, sf);
const rejectRegex: Validator = (node, sf) =>
  fail("Regular expression literals are forbidden in StaticTS (no regex engine in the runtime)", node, sf);
const rejectBigIntLiteral: Validator = (node, sf) =>
  fail("`bigint` literals are forbidden in StaticTS (use number, i32, or f64)", node, sf);
const rejectSpreadAssignment: Validator = (node, sf) =>
  fail("Object spread is forbidden in StaticTS (object layout is fixed at compile time)", node, sf);

const checkCall: Validator = (node, sf) => {
  if ((node as ts.CallExpression).questionDotToken) {
    fail("Optional chaining `?.` is forbidden in StaticTS (narrow with `!== null` instead)", node, sf);
  }
  const call = node as ts.CallExpression;
  if (call.expression.kind === ts.SyntaxKind.ImportKeyword) {
    fail("Dynamic `import()` is forbidden in StaticTS (modules are resolved at compile time)", call, sf);
  }
  if (ts.isIdentifier(call.expression)) {
    if (call.expression.text === "eval")
      fail("`eval` is forbidden in StaticTS (no interpreter at runtime)", call, sf);
    if (call.expression.text === "Function") {
      fail("`Function` constructor is forbidden in StaticTS (no interpreter at runtime)", call, sf);
    }
  }
};

const checkNew: Validator = (node, sf) => {
  const expr = (node as ts.NewExpression).expression;
  if (ts.isIdentifier(expr)) {
    if (expr.text === "Function") {
      fail("`new Function` is forbidden in StaticTS (no interpreter at runtime)", node, sf);
    }
    if (expr.text === "Proxy") {
      fail("`new Proxy` is forbidden in StaticTS (no dynamic property interception)", node, sf);
    }
  }
};

const checkPropertyAccess: Validator = (node, sf) => {
  const access = node as ts.PropertyAccessExpression;
  if (access.questionDotToken) fail("Optional chaining `?.` is forbidden in StaticTS (narrow with `!== null` instead)", access, sf);
  const name = access.name.text;
  if (name === "__proto__")
    fail("`__proto__` access is forbidden in StaticTS (no prototype chain)", access.name, sf);
  if (name === "prototype")
    fail("`.prototype` access is forbidden in StaticTS (no prototype chain)", access.name, sf);
  if (
    ts.isIdentifier(access.expression) &&
    access.expression.text === "Object" &&
    FORBIDDEN_OBJECT_MEMBERS.has(name)
  ) {
    fail(`\`Object.${name}\` is forbidden in StaticTS (object layout is fixed at compile time)`, access, sf);
  }
};

const checkElementAccess: Validator = (node, sf) => {
  if ((node as ts.ElementAccessExpression).questionDotToken) {
    fail("Optional chaining `?.` is forbidden in StaticTS (narrow with `!== null` instead)", node, sf);
  }
  const access = node as ts.ElementAccessExpression;
  const key = access.argumentExpression;
  if (ts.isStringLiteralLike(key) || ts.isTemplateExpression(key)) {
    fail(
      "String-keyed element access is forbidden in StaticTS; use `obj.name` (no dynamic property lookup)",
      key,
      sf
    );
  }
  if (!isNumericIndexShape(key)) {
    fail("Element access requires a numeric index in StaticTS (no dynamic property lookup)", key, sf);
  }
};

const checkPropertyAssignment: Validator = (node, sf) => {
  const prop = node as ts.PropertyAssignment | ts.ShorthandPropertyAssignment;
  if (propertyNameText(prop.name) === "__proto__") {
    fail("`__proto__` is forbidden in StaticTS (no prototype chain)", prop.name, sf);
  }
};

// ---- Dispatch ---------------------------------------------------------------------------

const validators: Partial<Record<ts.SyntaxKind, Validator>> = {
  // types
  [ts.SyntaxKind.AnyKeyword]: rejectAny,
  [ts.SyntaxKind.UnknownKeyword]: rejectUnknown,
  [ts.SyntaxKind.SymbolKeyword]: rejectSymbolType,
  [ts.SyntaxKind.BigIntKeyword]: rejectBigIntType,
  [ts.SyntaxKind.UndefinedKeyword]: rejectUndefinedType,
  [ts.SyntaxKind.UnionType]: checkUnionType,
  [ts.SyntaxKind.TypeReference]: checkTypeReference,
  [ts.SyntaxKind.ImportType]: rejectImportType,
  [ts.SyntaxKind.AsExpression]: checkTypeAssertion,
  [ts.SyntaxKind.TypeAssertionExpression]: checkTypeAssertion,
  // declarations
  [ts.SyntaxKind.FunctionDeclaration]: checkFunctionLike,
  [ts.SyntaxKind.FunctionExpression]: checkFunctionLike,
  [ts.SyntaxKind.ArrowFunction]: checkFunctionLike,
  [ts.SyntaxKind.MethodDeclaration]: checkFunctionLike,
  [ts.SyntaxKind.ClassDeclaration]: checkGenericDeclaration,
  [ts.SyntaxKind.ClassExpression]: checkGenericDeclaration,
  [ts.SyntaxKind.InterfaceDeclaration]: checkGenericDeclaration,
  [ts.SyntaxKind.TypeAliasDeclaration]: checkGenericDeclaration,
  [ts.SyntaxKind.VariableDeclarationList]: checkVariableDeclarationList,
  [ts.SyntaxKind.EnumDeclaration]: checkEnum,
  [ts.SyntaxKind.ModuleDeclaration]: checkModuleDeclaration,
  [ts.SyntaxKind.Decorator]: rejectDecorator,
  [ts.SyntaxKind.ComputedPropertyName]: rejectComputedPropertyName,
  // statements
  [ts.SyntaxKind.WithStatement]: rejectWith,
  [ts.SyntaxKind.TryStatement]: rejectTry,
  [ts.SyntaxKind.DebuggerStatement]: rejectDebugger,
  [ts.SyntaxKind.LabeledStatement]: rejectLabeled,
  // expressions
  [ts.SyntaxKind.Identifier]: checkIdentifier,
  [ts.SyntaxKind.BinaryExpression]: checkBinary,
  [ts.SyntaxKind.TypeOfExpression]: rejectTypeOf,
  [ts.SyntaxKind.DeleteExpression]: rejectDelete,
  [ts.SyntaxKind.VoidExpression]: rejectVoidExpression,
  [ts.SyntaxKind.AwaitExpression]: rejectAwait,
  [ts.SyntaxKind.YieldExpression]: rejectYield,
  [ts.SyntaxKind.RegularExpressionLiteral]: rejectRegex,
  [ts.SyntaxKind.BigIntLiteral]: rejectBigIntLiteral,
  [ts.SyntaxKind.SpreadAssignment]: rejectSpreadAssignment,
  [ts.SyntaxKind.CallExpression]: checkCall,
  [ts.SyntaxKind.NewExpression]: checkNew,
  [ts.SyntaxKind.PropertyAccessExpression]: checkPropertyAccess,
  [ts.SyntaxKind.ElementAccessExpression]: checkElementAccess,
  [ts.SyntaxKind.PropertyAssignment]: checkPropertyAssignment,
  [ts.SyntaxKind.ShorthandPropertyAssignment]: checkPropertyAssignment,
};

/**
 * Phase 0 entry point. Without a `sink`, throws `CompileError` on the first
 * forbidden construct in source order (pre-order walk). With one, every
 * forbidden construct is reported to it (a rejected node's subtree is not
 * descended into) and the caller decides when to stop. Returns normally
 * when the tree is clean.
 */
export function validateStaticTS(sourceFile: ts.SourceFile, sink?: DiagnosticSink): void {
  const visit = (node: ts.Node): void => {
    const rule = validators[node.kind];
    if (rule) {
      if (!sink) rule(node, sourceFile);
      else if (!sink.recover(() => rule(node, sourceFile))) return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}
