import { tags as t } from "@lezer/highlight";

export const regoHighlighting = {
  // Keywords
  "package import default": t.keyword,
  "some every if else contains with as in not": t.controlKeyword,
  
  // Primitives
  "true false": t.bool,
  "null": t.null,
  Number: t.number,
  String: t.string,
  RawString: t.special(t.string),
  
  // Identifiers
  Identifier: t.variableName,
  "CallExpression/Identifier": t.function(t.variableName),
  "RuleHead/Identifier": t.function(t.definition(t.variableName)),
  "PackageDeclaration/Identifier": t.namespace,
  
  // Comments
  LineComment: t.lineComment,
  
  // Operators & Punctuation
  "ArithOp LogicOp CompareOp AssignOp": t.operator,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  ".": t.derefOperator,
  ", |": t.separator
};