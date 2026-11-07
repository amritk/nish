// A TypeDoc plugin: keep a type as the source spells it, so `type i32 = number`
// shows as `i32` in the library reference rather than as `number`.
//
// TypeDoc resolves an alias to what it stands for, and every Nish width
// (`i32`, `u8`, `f64`, ...) is an alias of `number` or `bigint`, so without
// this every signature in the reference would read `number`. The plugin
// replaces the type of each property, variable, type alias, signature return,
// parameter and type parameter with the text written in the declaration.
// `scripts/gen-reference.mjs` loads it.
import { Converter, UnknownType } from "typedoc"
import ts from "typescript"

const text = (node) => (node ? new UnknownType(node.getText()) : undefined)

/** Each type parameter's constraint and default, as written. */
const spellTypeParams = (refls, nodes) => {
  for (const [i, tp] of (refls ?? []).entries()) {
    const n = nodes?.[i]
    if (n?.constraint) {
      tp.type = text(n.constraint)
    }
    if (n?.default) {
      tp.default = text(n.default)
    }
  }
}

export const load = (app) => {
  const sigs = []
  app.converter.on(Converter.EVENT_CREATE_SIGNATURE, (_ctx, refl, node) => {
    if (node) {
      sigs.push([refl, node])
    }
  })
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, (ctx, refl) => {
    const sym = ctx.getSymbolFromReflection(refl)
    const d = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (!d) {
      return
    }
    const typed =
      ts.isPropertyDeclaration(d) ||
      ts.isPropertySignature(d) ||
      ts.isVariableDeclaration(d) ||
      ts.isTypeAliasDeclaration(d)
    if (typed && d.type) {
      refl.type = text(d.type)
    }
    if (ts.isTypeAliasDeclaration(d) || ts.isClassDeclaration(d) || ts.isInterfaceDeclaration(d)) {
      spellTypeParams(refl.typeParameters, d.typeParameters)
    }
  })
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, () => {
    for (const [refl, node] of sigs) {
      if (node.type) {
        refl.type = text(node.type)
      }
      const ps = node.parameters ?? []
      for (const [i, p] of (refl.parameters ?? []).entries()) {
        if (ps[i]?.type) {
          p.type = text(ps[i].type)
        }
      }
      spellTypeParams(refl.typeParameters, node.typeParameters)
    }
  })
}
