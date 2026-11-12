// WP28 spike S2: the census. Given a TypeScript source tree, finds every
// function with a body, and for each `async` one says why it is `async`: it
// waits on something outside the program (a leaf), or every wait in it is on
// another function of the program (contagion), or the resolver cannot tell
// (unknown, a column of its own and never folded into either side).
//
// It reads the tree with the `typescript` compiler API and its checker, with
// `@types/node` loaded and none of the application's dependencies: an import
// that does not resolve is by that fact outside the program. README.md has the
// method, the classes and the shapes the classification is known to get wrong.
import { builtinModules } from "node:module"
import { dirname, join, relative } from "node:path"
import ts from "typescript"

const repoRoot = join(import.meta.dirname, "..", "..")

/** The classes an `async` function falls in, in the order the table prints them. */
export const CLASSES = [
  "leaf",
  "mixed",
  "contagion-blocks",
  "contagion-unknown",
  "contagion-never",
  "no-wait",
  "unknown",
]

const AGGREGATES = new Set(["all", "allSettled", "race", "any"])
const CHAINS = new Set(["then", "catch", "finally"])
const TIMER = /\bset(?:Timeout|Interval|Immediate)\b/
const CHASE_DEPTH = 6

const isFunction = (node) => ts.isFunctionLike(node) && node.body !== undefined
const isAsync = (node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)

/** Strips what changes a type and not a value: parentheses, `as`, `!`, `satisfies`. */
const bare = (node) => {
  let e = node
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isTypeAssertionExpression(e)
  ) {
    e = e.expression
  }
  return e
}

/** Visits every node of `fn` that is its own: a nested function is another row. */
const eachOwn = (fn, visit) => {
  const step = (node) => {
    if (isFunction(node)) {
      return
    }
    visit(node)
    ts.forEachChild(node, step)
  }
  ts.forEachChild(fn, step)
}

const packageOf = (specifier) => {
  const parts = specifier.split("/")
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

const builtins = new Set(builtinModules)
const isBuiltin = (specifier) => specifier.startsWith("node:") || builtins.has(packageOf(specifier))

/**
 * Counts the `async` functions of the tree under `root` by class.
 *
 * `files` are the paths, relative to `root`, that make up the program. Returns
 * the per-class counts, the leaf kinds, the shape counts strict `async` is
 * read against, and one record per `async` function for the audit sample.
 */
export const census = (root, files) => {
  const options = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    allowImportingTsExtensions: true,
    experimentalDecorators: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["node"],
    typeRoots: [join(repoRoot, "node_modules", "@types")],
  }
  const program = ts.createProgram(
    files.map((f) => join(root, f)),
    options
  )
  const checker = program.getTypeChecker()
  const own = new Set(files.map((f) => join(root, f)))
  const sources = program.getSourceFiles().filter((sf) => own.has(sf.fileName))
  const inProgram = (node) => own.has(node.getSourceFile().fileName)

  /** `"yes"`, `"no"`, or `"any"` when the type is one the checker could not resolve. */
  const thenable = (type) => {
    if ((type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) {
      return "any"
    }
    if (type.isUnion()) {
      const parts = type.types.map(thenable)
      return parts.includes("yes") ? "yes" : parts.includes("any") ? "any" : "no"
    }
    if ((type.flags & ts.TypeFlags.TypeParameter) !== 0) {
      const constraint = checker.getBaseConstraintOfType(type)
      return constraint === undefined || constraint === type ? "any" : thenable(constraint)
    }
    return checker.getPropertyOfType(checker.getApparentType(type), "then") === undefined ? "no" : "yes"
  }
  const thenableAt = (node) => thenable(checker.getTypeAtLocation(node))
  const returns = (fn) => {
    const signature = checker.getSignatureFromDeclaration(fn)
    return signature === undefined ? "any" : thenable(checker.getReturnTypeOfSignature(signature))
  }

  const symbolAt = (node) => {
    const symbol = checker.getSymbolAtLocation(node)
    if (symbol === undefined) {
      return null
    }
    return (symbol.flags & ts.SymbolFlags.Alias) !== 0
      ? { alias: symbol, target: checker.getAliasedSymbol(symbol) }
      : { alias: null, target: symbol }
  }

  // ---- what an expression's root is, when the checker has no type for it ----

  const external = (specifierNode) => {
    const specifier = specifierNode.text
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      return null
    }
    const resolved = checker.getSymbolAtLocation(specifierNode)
    if (resolved?.declarations?.some(inProgram) === true) {
      return null
    }
    return isBuiltin(specifier)
      ? { kind: "node", detail: specifier.replace(/^node:/, "") }
      : { kind: "dependency", detail: packageOf(specifier) }
  }

  const importOf = (declaration) => {
    let n = declaration
    while (n !== undefined && !ts.isImportDeclaration(n) && !ts.isImportEqualsDeclaration(n)) {
      n = n.parent
    }
    if (n === undefined) {
      return null
    }
    if (ts.isImportDeclaration(n)) {
      return external(n.moduleSpecifier)
    }
    return ts.isExternalModuleReference(n.moduleReference) && ts.isStringLiteral(n.moduleReference.expression)
      ? external(n.moduleReference.expression)
      : null
  }

  /** The first name in a type annotation that an unresolved import brought in. */
  const externalType = (typeNode) => {
    let found = null
    const step = (node) => {
      if (found !== null) {
        return
      }
      if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
        let name = ts.isTypeReferenceNode(node) ? node.typeName : node.expression
        while (ts.isQualifiedName(name) || ts.isPropertyAccessExpression(name)) {
          name = ts.isQualifiedName(name) ? name.left : name.expression
        }
        const from = checker.getSymbolAtLocation(name)?.declarations?.[0]
        if (from !== undefined && inProgram(from)) {
          found = importOf(from)
        }
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        found = external(node.argument.literal)
      }
      ts.forEachChild(node, step)
    }
    step(typeNode)
    return found
  }

  /**
   * Where a value the checker types as `any` comes from: the dependency or Node
   * module whose import, annotation or initializer it hangs off, or null.
   */
  const externalRoot = (node, depth = 0) => {
    if (depth > CHASE_DEPTH) {
      return null
    }
    const e = bare(node)
    if (ts.isAwaitExpression(e)) {
      return externalRoot(e.expression, depth + 1)
    }
    if (ts.isCallExpression(e)) {
      const [first] = e.arguments
      const loads =
        e.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(e.expression) && e.expression.text === "require")
      if (loads && first !== undefined && ts.isStringLiteralLike(first)) {
        return external(first)
      }
      return externalRoot(e.expression, depth + 1)
    }
    if (ts.isNewExpression(e) || ts.isElementAccessExpression(e)) {
      return externalRoot(e.expression, depth + 1)
    }
    if (!ts.isIdentifier(e) && !ts.isPropertyAccessExpression(e)) {
      return null
    }
    const declaration = checker.getSymbolAtLocation(ts.isIdentifier(e) ? e : e.name)?.declarations?.[0]
    if (declaration === undefined || !inProgram(declaration)) {
      return ts.isPropertyAccessExpression(e) ? externalRoot(e.expression, depth + 1) : null
    }
    return declaredExternal(declaration, depth + 1)
  }

  const declaredExternal = (declaration, depth) => {
    if (
      ts.isImportSpecifier(declaration) ||
      ts.isImportClause(declaration) ||
      ts.isNamespaceImport(declaration) ||
      ts.isImportEqualsDeclaration(declaration)
    ) {
      return importOf(declaration)
    }
    if (ts.isBindingElement(declaration)) {
      let holder = declaration.parent
      while (
        ts.isBindingElement(holder) ||
        ts.isObjectBindingPattern(holder) ||
        ts.isArrayBindingPattern(holder)
      ) {
        holder = holder.parent
      }
      return declaredExternal(holder, depth + 1)
    }
    if (
      ts.isVariableDeclaration(declaration) ||
      ts.isParameter(declaration) ||
      ts.isPropertyDeclaration(declaration) ||
      ts.isPropertySignature(declaration)
    ) {
      const typed = declaration.type === undefined ? null : externalType(declaration.type)
      if (typed !== null) {
        return typed
      }
      return declaration.initializer === undefined || depth > CHASE_DEPTH
        ? null
        : externalRoot(declaration.initializer, depth + 1)
    }
    return null
  }

  // ---- what one awaited expression waits on ----

  const leaf = (kind, detail) => [{ kind: "leaf", leaf: kind, detail }]
  const unknown = (why) => [{ kind: "unknown", why }]
  const none = (why) => [{ kind: "none", why }]
  const outside = (root, why) => (root === null ? unknown(why) : leaf(root.kind, root.detail))

  /** A call to a function of the program: an edge, unless it plainly answers a value. */
  const edge = (fn) => (!isAsync(fn) && returns(fn) === "no" ? none("plain value") : [{ kind: "edge", fn }])

  /** A declaration outside the program's own files: the platform, or a vendored `.d.ts`. */
  const platform = (declaration, call) => {
    if (thenableAt(call) === "no") {
      return none("plain value")
    }
    const file = declaration.getSourceFile()
    const name =
      declaration.name !== undefined && ts.isIdentifier(declaration.name) ? declaration.name.text : "?"
    if (file.fileName.includes("/@types/node/")) {
      let scope = declaration.parent
      while (scope !== undefined && !(ts.isModuleDeclaration(scope) && ts.isStringLiteral(scope.name))) {
        scope = scope.parent
      }
      const module = scope === undefined ? "global" : scope.name.text.replace(/^node:/, "")
      return leaf("node", `${module}.${name}`)
    }
    if (program.isSourceFileDefaultLibrary(file)) {
      const holder = declaration.parent
      const owner = holder !== undefined && ts.isInterfaceDeclaration(holder) ? `${holder.name.text}.` : ""
      return leaf("global", `${owner}${name}`)
    }
    return leaf("dependency", "(declared in a .d.ts)")
  }

  const fromDeclaration = (declaration, call, hasBody) => {
    if (!inProgram(declaration)) {
      return platform(declaration, call)
    }
    if (isFunction(declaration)) {
      return edge(declaration)
    }
    if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) {
      // An overload signature beside its implementation says nothing more.
      return hasBody ? [] : unknown("abstract method")
    }
    if (ts.isMethodSignature(declaration) || ts.isPropertySignature(declaration)) {
      return outside(
        declaration.type === undefined ? null : externalType(declaration.type),
        "interface member"
      )
    }
    if (ts.isShorthandPropertyAssignment(declaration)) {
      const value = checker.getShorthandAssignmentValueSymbol(declaration)?.declarations?.[0]
      return value === undefined ? unknown("function value") : fromDeclaration(value, call, false)
    }
    if (
      ts.isVariableDeclaration(declaration) ||
      ts.isPropertyDeclaration(declaration) ||
      ts.isPropertyAssignment(declaration) ||
      ts.isParameter(declaration) ||
      ts.isBindingElement(declaration)
    ) {
      const initializer = declaration.initializer === undefined ? null : bare(declaration.initializer)
      if (initializer !== null && isFunction(initializer)) {
        return edge(initializer)
      }
      const why = ts.isParameter(declaration) ? "callback parameter" : "function value"
      return outside(ts.isPropertyAssignment(declaration) ? null : declaredExternal(declaration, 0), why)
    }
    return unknown("function value")
  }

  const isGlobalPromise = (node) => {
    if (!ts.isIdentifier(node) || node.text !== "Promise") {
      return false
    }
    const declaration = checker.getSymbolAtLocation(node)?.declarations?.[0]
    return declaration === undefined || !inProgram(declaration)
  }

  /** The argument of `Promise.all` and its siblings: each promise it gathers. */
  const gathered = (node, fn, depth) => {
    const e = bare(node)
    if (ts.isArrayLiteralExpression(e)) {
      return e.elements.flatMap((el) =>
        ts.isSpreadElement(el) ? gathered(el.expression, fn, depth + 1) : waitsOn(el, fn, depth + 1)
      )
    }
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
      const method = e.expression.name.text
      const mapper = e.arguments[method === "from" ? 1 : 0]
      if ((method === "map" || method === "flatMap" || method === "from") && mapper !== undefined) {
        const callback = bare(mapper)
        if (isFunction(callback)) {
          return edge(callback)
        }
        const named =
          ts.isIdentifier(callback) || ts.isPropertyAccessExpression(callback)
            ? symbolAt(ts.isIdentifier(callback) ? callback : callback.name)
            : null
        const declarations = named?.target.declarations ?? []
        if (declarations.length > 0) {
          const hasBody = declarations.some(isFunction)
          return declarations.flatMap((d) => fromDeclaration(d, e, hasBody))
        }
        return outside(externalRoot(callback), "gathered promises")
      }
    }
    if (ts.isIdentifier(e) && depth <= CHASE_DEPTH) {
      const declaration = checker.getSymbolAtLocation(e)?.valueDeclaration
      if (declaration !== undefined && ts.isVariableDeclaration(declaration) && fn !== null) {
        // `const ps = []`, then `ps.push(f(x))` in a loop, then `Promise.all(ps)`.
        const found =
          declaration.initializer === undefined ? [] : gathered(declaration.initializer, fn, depth + 1)
        const real = found.filter((s) => !(s.kind === "unknown" && s.why === "gathered promises"))
        eachOwn(fn, (n) => {
          if (
            ts.isCallExpression(n) &&
            ts.isPropertyAccessExpression(n.expression) &&
            n.expression.name.text === "push" &&
            ts.isIdentifier(n.expression.expression) &&
            checker.getSymbolAtLocation(n.expression.expression)?.valueDeclaration === declaration
          ) {
            real.push(...n.arguments.flatMap((a) => waitsOn(a, fn, depth + 1)))
          }
        })
        if (real.length > 0) {
          return real
        }
      }
    }
    return unknown("gathered promises")
  }

  const callWaitsOn = (call, fn, depth) => {
    const callee = bare(call.expression)
    if (callee.kind === ts.SyntaxKind.ImportKeyword) {
      return none("import()")
    }
    if (ts.isPropertyAccessExpression(callee)) {
      if (CHAINS.has(callee.name.text)) {
        return waitsOn(callee.expression, fn, depth + 1)
      }
      if (isGlobalPromise(callee.expression)) {
        const [first] = call.arguments
        if (AGGREGATES.has(callee.name.text)) {
          return first === undefined ? [] : gathered(first, fn, depth)
        }
        if (callee.name.text === "resolve") {
          return first === undefined ? none("plain value") : waitsOn(first, fn, depth + 1)
        }
        if (callee.name.text === "reject") {
          return none("plain value")
        }
      }
    }
    const nameNode = ts.isPropertyAccessExpression(callee)
      ? callee.name
      : ts.isElementAccessExpression(callee)
        ? callee.argumentExpression
        : callee
    const symbol = symbolAt(nameNode)
    const declarations = symbol?.target.declarations ?? []
    if (declarations.length > 0) {
      const hasBody = declarations.some(isFunction)
      return declarations.flatMap((d) => fromDeclaration(d, call, hasBody))
    }
    if (symbol !== null && symbol.alias !== null) {
      const from = symbol.alias.declarations?.[0]
      return outside(from === undefined ? null : importOf(from), "unresolved import")
    }
    if (thenableAt(call) === "no") {
      return none("plain value")
    }
    return outside(externalRoot(callee), "unresolved call")
  }

  /**
   * What awaiting `node` waits on, as a list of sources: a `leaf` (something
   * outside the program), an `edge` (a function of the program), an `unknown`
   * (the resolver cannot follow it) or a `none` (a value, not a wait).
   */
  const waitsOn = (node, fn, depth = 0) => {
    const e = bare(node)
    if (depth > CHASE_DEPTH) {
      return unknown("awaited value")
    }
    if (ts.isAwaitExpression(e)) {
      return []
    }
    if (ts.isConditionalExpression(e)) {
      return [...waitsOn(e.whenTrue, fn, depth + 1), ...waitsOn(e.whenFalse, fn, depth + 1)]
    }
    if (ts.isBinaryExpression(e)) {
      const operator = e.operatorToken.kind
      if (
        operator === ts.SyntaxKind.QuestionQuestionToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        return [...waitsOn(e.left, fn, depth + 1), ...waitsOn(e.right, fn, depth + 1)]
      }
      return operator === ts.SyntaxKind.CommaToken ? waitsOn(e.right, fn, depth + 1) : none("plain value")
    }
    if (ts.isNewExpression(e)) {
      if (isGlobalPromise(e.expression)) {
        return leaf(TIMER.test(e.getText()) ? "timer" : "new Promise", "new Promise")
      }
      return thenableAt(e) === "no" ? none("plain value") : unknown("awaited value")
    }
    if (ts.isCallExpression(e)) {
      return callWaitsOn(e, fn, depth)
    }
    if (thenableAt(e) === "no") {
      return none("plain value")
    }
    if (ts.isIdentifier(e)) {
      // `const p = f()` and later `await p`: the wait is on what made `p`.
      const declaration = checker.getSymbolAtLocation(e)?.valueDeclaration
      if (
        declaration !== undefined &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer !== undefined &&
        inProgram(declaration)
      ) {
        return waitsOn(declaration.initializer, fn, depth + 1)
      }
    }
    return ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)
      ? unknown("awaited value")
      : none("plain value")
  }

  // ---- every function, its sources, and the shapes strict is read against ----

  const functions = new Map()
  const shapes = {
    declaration: {
      "top-level function": 0,
      "top-level arrow": 0,
      "arrow passed as an argument": 0,
      method: 0,
      other: 0,
    },
    returnType: { annotated: 0, inferred: 0 },
    awaitOperand: {
      "direct call": 0,
      "Promise.all family": 0,
      "chained .then/.catch": 0,
      "import()": 0,
      "a value": 0,
    },
    awaitPosition: { "top of a statement": 0, "inside an expression": 0 },
    asyncCall: {
      "awaited where made": 0,
      "gathered by Promise.all": 0,
      returned: 0,
      "stored, passed or dropped": 0,
    },
    forAwait: 0,
  }

  const declarationShape = (fn) => {
    if (ts.isMethodDeclaration(fn) || ts.isAccessor(fn) || ts.isConstructorDeclaration(fn)) {
      return "method"
    }
    if (ts.isFunctionDeclaration(fn)) {
      return ts.isSourceFile(fn.parent) ? "top-level function" : "other"
    }
    const holder = fn.parent
    if (ts.isCallExpression(holder) || ts.isNewExpression(holder)) {
      return "arrow passed as an argument"
    }
    if (ts.isVariableDeclaration(holder) && ts.isSourceFile(holder.parent.parent.parent)) {
      return "top-level arrow"
    }
    return ts.isPropertyDeclaration(holder) || ts.isPropertyAssignment(holder) ? "method" : "other"
  }

  const nameOf = (fn) => {
    if (
      fn.name !== undefined &&
      (ts.isIdentifier(fn.name) || ts.isPrivateIdentifier(fn.name) || ts.isStringLiteral(fn.name))
    ) {
      const owner = ts.isClassLike(fn.parent) && fn.parent.name !== undefined ? `${fn.parent.name.text}.` : ""
      return `${owner}${fn.name.text}`
    }
    const holder = fn.parent
    if (
      (ts.isVariableDeclaration(holder) ||
        ts.isPropertyDeclaration(holder) ||
        ts.isPropertyAssignment(holder)) &&
      ts.isIdentifier(holder.name)
    ) {
      return holder.name.text
    }
    return "(anonymous)"
  }

  const awaitOperandShape = (operand) => {
    const e = bare(operand)
    if (!ts.isCallExpression(e)) {
      return "a value"
    }
    const callee = bare(e.expression)
    if (callee.kind === ts.SyntaxKind.ImportKeyword) {
      return "import()"
    }
    if (ts.isPropertyAccessExpression(callee)) {
      if (CHAINS.has(callee.name.text)) {
        return "chained .then/.catch"
      }
      if (isGlobalPromise(callee.expression)) {
        return "Promise.all family"
      }
    }
    return "direct call"
  }

  /** Strict's rule: the `await` is a whole statement, initializer, `return` or right side of `=`. */
  const atStatementTop = (awaitNode) => {
    let n = awaitNode
    while (
      ts.isParenthesizedExpression(n.parent) ||
      ts.isAsExpression(n.parent) ||
      ts.isNonNullExpression(n.parent)
    ) {
      n = n.parent
    }
    const p = n.parent
    return (
      ts.isExpressionStatement(p) ||
      ts.isReturnStatement(p) ||
      (ts.isVariableDeclaration(p) && p.initializer === n && ts.isVariableStatement(p.parent.parent)) ||
      (ts.isBinaryExpression(p) &&
        p.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        p.right === n &&
        ts.isExpressionStatement(p.parent))
    )
  }

  const record = (fn) => {
    const async = isAsync(fn)
    const found = []
    const add = (node, list) =>
      found.push(
        ...list.map((s) => ({
          ...s,
          line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1,
        }))
      )
    // A function that hands a promise back unawaited waits on what made it.
    const passes = async || returns(fn) !== "no"
    const returned = (value) => {
      const e = bare(value)
      if (ts.isAwaitExpression(e)) {
        return
      }
      const kind = thenableAt(e)
      if (kind === "yes") {
        add(e, waitsOn(e, fn))
      } else if (kind === "any" && (ts.isCallExpression(e) || ts.isNewExpression(e))) {
        // A call the checker has no type for may answer a promise or a value.
        add(
          e,
          waitsOn(e, fn).map((s) =>
            s.kind === "leaf" && s.leaf === "dependency"
              ? { kind: "unknown", why: "returned call of unknown type" }
              : s
          )
        )
      }
    }
    if (passes && ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) {
      returned(fn.body)
    }
    eachOwn(fn, (node) => {
      if (ts.isAwaitExpression(node)) {
        add(node, waitsOn(node.expression, fn))
        if (async) {
          shapes.awaitOperand[awaitOperandShape(node.expression)] += 1
          shapes.awaitPosition[atStatementTop(node) ? "top of a statement" : "inside an expression"] += 1
        }
      } else if (ts.isForOfStatement(node) && node.awaitModifier !== undefined) {
        const iterable = bare(node.expression)
        add(
          node,
          ts.isCallExpression(iterable)
            ? callWaitsOn(iterable, fn, 0).filter((s) => s.kind !== "none")
            : unknown("async iterable")
        )
        shapes.forAwait += 1
      } else if (passes && ts.isReturnStatement(node) && node.expression !== undefined) {
        returned(node.expression)
      }
    })
    if (async) {
      shapes.declaration[declarationShape(fn)] += 1
      shapes.returnType[fn.type === undefined ? "inferred" : "annotated"] += 1
    }
    const file = fn.getSourceFile()
    functions.set(fn, {
      fn,
      async,
      name: nameOf(fn),
      file: relative(root, file.fileName),
      line: ts.getLineAndCharacterOfPosition(file, fn.getStart()).line + 1,
      sources: found,
      blocks: found.some((s) => s.kind === "leaf"),
      unsure: found.some((s) => s.kind === "unknown"),
    })
  }

  const visit = (node) => {
    if (isFunction(node)) {
      record(node)
    }
    ts.forEachChild(node, visit)
  }
  for (const sf of sources) {
    visit(sf)
  }

  // Where a call to one of the program's `async` functions stands (strict: NL2645).
  const callShape = (call) => {
    let n = call
    while (
      ts.isParenthesizedExpression(n.parent) ||
      ts.isAsExpression(n.parent) ||
      ts.isNonNullExpression(n.parent)
    ) {
      n = n.parent
    }
    const p = n.parent
    if (ts.isAwaitExpression(p)) {
      return "awaited where made"
    }
    if (ts.isReturnStatement(p) || (ts.isArrowFunction(p) && p.body === n)) {
      return "returned"
    }
    if (
      ts.isArrayLiteralExpression(p) &&
      ts.isCallExpression(p.parent) &&
      awaitOperandShape(p.parent) === "Promise.all family"
    ) {
      return "gathered by Promise.all"
    }
    return "stored, passed or dropped"
  }
  const countCalls = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = bare(node.expression)
      const nameNode = ts.isPropertyAccessExpression(callee) ? callee.name : callee
      const target =
        ts.isIdentifier(nameNode) || ts.isPrivateIdentifier(nameNode)
          ? symbolAt(nameNode)?.target.declarations?.find(isFunction)
          : undefined
      if (target !== undefined && functions.get(target)?.async === true) {
        shapes.asyncCall[callShape(node)] += 1
      }
    }
    ts.forEachChild(node, countCalls)
  }
  for (const sf of sources) {
    countCalls(sf)
  }

  // ---- contagion: what each function reaches through the program's own calls ----

  let moved = true
  while (moved) {
    moved = false
    for (const f of functions.values()) {
      for (const s of f.sources) {
        const callee = s.kind === "edge" ? functions.get(s.fn) : undefined
        if (callee === undefined) {
          continue
        }
        if (callee.blocks && !f.blocks) {
          f.blocks = true
          moved = true
        }
        if (callee.unsure && !f.unsure) {
          f.unsure = true
          moved = true
        }
      }
    }
  }

  // A cycle of awaits has no frame size in strict (NL2648): count who is on one.
  const edgesOf = (f) =>
    f.sources.filter((s) => s.kind === "edge" && functions.has(s.fn)).map((s) => functions.get(s.fn))
  const reachesSelf = (start) => {
    const seen = new Set()
    const stack = [...edgesOf(start)]
    while (stack.length > 0) {
      const f = stack.pop()
      if (f === start) {
        return true
      }
      if (!seen.has(f)) {
        seen.add(f)
        stack.push(...edgesOf(f))
      }
    }
    return false
  }

  const classOf = (f) => {
    const direct = new Set(f.sources.map((s) => s.kind))
    if (direct.has("leaf")) {
      return direct.has("edge") ? "mixed" : "leaf"
    }
    if (direct.has("unknown")) {
      return "unknown"
    }
    if (!direct.has("edge")) {
      return "no-wait"
    }
    return f.blocks ? "contagion-blocks" : f.unsure ? "contagion-unknown" : "contagion-never"
  }

  const counts = Object.fromEntries(CLASSES.map((c) => [c, 0]))
  const leafKinds = new Map()
  const leafDetails = new Map()
  const unknownWhys = new Map()
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)
  const rows = []
  let recursive = 0
  for (const f of functions.values()) {
    if (!f.async) {
      continue
    }
    const cls = classOf(f)
    counts[cls] += 1
    if (reachesSelf(f)) {
      recursive += 1
    }
    // One function counts once per kind, however many times it waits on it.
    for (const kind of new Set(f.sources.filter((s) => s.kind === "leaf").map((s) => s.leaf))) {
      bump(leafKinds, kind)
    }
    for (const detail of new Set(
      f.sources.filter((s) => s.kind === "leaf").map((s) => `${s.leaf}: ${s.detail}`)
    )) {
      bump(leafDetails, detail)
    }
    if (cls === "unknown") {
      for (const why of new Set(f.sources.filter((s) => s.kind === "unknown").map((s) => s.why))) {
        bump(unknownWhys, why)
      }
    }
    rows.push({
      class: cls,
      name: f.name,
      file: f.file,
      line: f.line,
      sources: f.sources.map((s) =>
        s.kind === "edge"
          ? `${s.line} edge ${functions.get(s.fn)?.name ?? "?"}`
          : `${s.line} ${s.kind} ${s.kind === "leaf" ? `${s.leaf}: ${s.detail}` : s.why}`
      ),
    })
  }
  const sorted = (map) => [...map].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return {
    files: sources.length,
    functions: functions.size,
    async: rows.length,
    counts,
    leafKinds: sorted(leafKinds),
    leafDetails: sorted(leafDetails),
    unknownWhys: sorted(unknownWhys),
    shapes: { ...shapes, recursive },
    rows,
    root: dirname(join(root, "x")),
  }
}
