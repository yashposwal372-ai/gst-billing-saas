// Build-time transport documentation only. Does not execute DTOs, services or queries.
import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = ts.readConfigFile(
  resolve(root, 'tsconfig.json'),
  ts.sys.readFile,
);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(
  parsed.fileNames.filter((f) => !f.endsWith('.spec.ts')),
  parsed.options,
);
const checker = program.getTypeChecker();
const schemas = {};
const routes = [];
const decorators = (node) =>
  (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [])
    .map((d) => d.expression)
    .filter(ts.isCallExpression);
const deco = (node, name) =>
  decorators(node).find((d) => d.expression.getText() === name);
function value(node) {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(value);
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))
    return value(node.expression);
  if (ts.isRegularExpressionLiteral(node))
    return node.text.slice(1, node.text.lastIndexOf('/'));
  if (ts.isIdentifier(node)) {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration;
    if (declaration?.initializer) return value(declaration.initializer);
  }
  return undefined;
}
const is = (type, flag) => !!(type.flags & flag);
function transport(type, trail = [], field = '') {
  if (is(type, ts.TypeFlags.Null))
    return { type: 'string', nullable: true, enum: [null] };
  if (
    type.isIntersection() &&
    type.types.some((t) => is(t, ts.TypeFlags.StringLike))
  )
    return { type: 'string' };
  if (type.isUnion()) {
    const members = type.types.filter((t) => !is(t, ts.TypeFlags.Undefined));
    const nullable = members.some((t) => is(t, ts.TypeFlags.Null));
    const present = members.filter((t) => !is(t, ts.TypeFlags.Null));
    let result;
    if (!present.length)
      result = { type: 'string', nullable: true, enum: [null] };
    else if (present.every((t) => is(t, ts.TypeFlags.StringLiteral)))
      result = { type: 'string', enum: present.map((t) => t.value) };
    else if (present.every((t) => is(t, ts.TypeFlags.BooleanLiteral)))
      result = { type: 'boolean' };
    else {
      const choices = [
        ...new Map(
          present.map((t) => {
            const s = transport(t, trail, field);
            return [JSON.stringify(s), s];
          }),
        ).values(),
      ];
      result = choices.length === 1 ? choices[0] : { anyOf: choices };
    }
    return nullable
      ? result.type
        ? { ...result, nullable: true }
        : {
            anyOf: [
              ...(result.anyOf ?? [result]),
              { type: 'string', nullable: true, enum: [null] },
            ],
          }
      : result;
  }
  if (is(type, ts.TypeFlags.StringLike))
    return {
      type: 'string',
      ...(type.value !== undefined ? { enum: [type.value] } : {}),
    };
  if (is(type, ts.TypeFlags.NumberLike))
    return {
      type: 'number',
      ...(type.value !== undefined ? { enum: [type.value] } : {}),
    };
  if (is(type, ts.TypeFlags.BooleanLike)) return { type: 'boolean' };
  if (is(type, ts.TypeFlags.Never))
    return { description: 'No items currently returned.' };
  if (is(type, ts.TypeFlags.Any | ts.TypeFlags.Unknown))
    return { 'x-unresolved-transport': true };
  const name = type.symbol?.name;
  if (name === 'Date') return { type: 'string', format: 'date-time' };
  if (name === 'Decimal')
    throw new Error(
      `Unserialized Decimal response at ${trail.join('.')}.${field}; add an explicit wire contract`,
    );
  if (checker.isArrayType(type) || checker.isTupleType(type))
    return {
      type: 'array',
      items: transport(checker.getTypeArguments(type)[0], trail, field),
    };
  if (trail.includes(type.id))
    throw new Error(
      `Recursive response requires an explicit transport contract: ${field}`,
    );
  const properties = {};
  const required = [];
  for (const prop of checker.getPropertiesOfType(type)) {
    if (!prop.valueDeclaration && !prop.declarations?.length) continue;
    const propType = checker.getTypeOfSymbolAtLocation(
      prop,
      prop.valueDeclaration ?? prop.declarations[0],
    );
    properties[prop.name] = transport(propType, [...trail, type.id], prop.name);
    if (
      !(prop.flags & ts.SymbolFlags.Optional) &&
      !(
        propType.isUnion() &&
        propType.types.some((t) => is(t, ts.TypeFlags.Undefined))
      )
    )
      required.push(prop.name);
  }
  if (!Object.keys(properties).length)
    return { type: 'object', 'x-unresolved-transport': true };
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  };
}
function dto(type) {
  const name = type.symbol?.name;
  if (!name || name === '__type' || name === 'Object') return null;
  if (schemas[name]) return { $ref: `#/components/schemas/${name}` };
  const properties = {};
  const required = [];
  schemas[name] = { type: 'object', additionalProperties: false, properties };
  for (const prop of checker.getPropertiesOfType(type)) {
    const node = prop.valueDeclaration ?? prop.declarations?.[0];
    if (!node || !ts.isPropertyDeclaration(node)) continue;
    const ds = decorators(node);
    let field = transport(
      checker.getTypeOfSymbolAtLocation(prop, node),
      [],
      prop.name,
    );
    const nested = ds.find((d) => d.expression.getText() === 'ValidateNested');
    if (nested) {
      const t = checker.getNonNullableType(
        checker.getTypeOfSymbolAtLocation(prop, node),
      );
      field = checker.isArrayType(t)
        ? { type: 'array', items: dto(checker.getTypeArguments(t)[0]) }
        : dto(t);
    }
    for (const d of ds) {
      const args = d.arguments.map(value);
      switch (d.expression.getText()) {
        case 'IsString':
          field.type = 'string';
          break;
        case 'IsInt':
          field.type = 'integer';
          break;
        case 'IsBoolean':
          field.type = 'boolean';
          break;
        case 'IsEmail':
          field.format = 'email';
          break;
        case 'IsUUID':
          field.format = 'uuid';
          break;
        case 'IsIn':
          field.enum = args[0];
          break;
        case 'Matches':
          field.pattern = args[0];
          break;
        case 'Min':
          field.minimum = args[0];
          break;
        case 'Max':
          field.maximum = args[0];
          break;
        case 'MinLength':
          field.minLength = args[0];
          break;
        case 'MaxLength':
          field.maxLength = args[0];
          break;
        case 'Length':
          field.minLength = args[0];
          field.maxLength = args[1];
          break;
        case 'ArrayMinSize':
          field.minItems = args[0];
          break;
        case 'IsOptional':
          field.nullable = true;
          break;
      }
    }
    const defaultValue = value(node.initializer);
    if (defaultValue !== undefined) field.default = defaultValue;
    if (field.pattern === '^\\d{4}-\\d{2}-\\d{2}$') field.format = 'date';
    const conditional = ds.find((d) => d.expression.getText() === 'ValidateIf');
    if (conditional?.getText().includes("v !== ''"))
      field = {
        anyOf: [field, { type: 'string', enum: [''] }],
        description: 'Empty string clears the optional value.',
      };
    if (
      conditional &&
      !conditional.getText().includes('undefined') &&
      !conditional.getText().includes('optional')
    )
      field.description =
        'Conditionally validated; see operation business rules.';
    if (/password/i.test(prop.name)) {
      field.writeOnly = true;
      field.format = 'password';
    }
    properties[prop.name] = field;
    if (
      !node.questionToken &&
      !node.initializer &&
      !conditional &&
      !ds.some((d) => d.expression.getText() === 'IsOptional')
    )
      required.push(prop.name);
  }
  if (required.length) schemas[name].required = required;
  return { $ref: `#/components/schemas/${name}` };
}
function inspectClass(node, source) {
  const controller = deco(node, 'Controller');
  if (!controller) return;
  let prefixes = [value(controller.arguments[0]) ?? ''];
  if (controller.arguments[0] && value(controller.arguments[0]) === undefined) {
    // Current document controller factory. Discover its actual instantiations, not a copied route list.
    prefixes = [];
    const visit = (n) => {
      if (ts.isCallExpression(n) && n.expression.getText() === 'controllerFor')
        prefixes.push(value(n.arguments[0]));
      ts.forEachChild(n, visit);
    };
    visit(source);
    if (!prefixes.length || prefixes.some((p) => typeof p !== 'string'))
      throw new Error('Unsupported controller factory');
  }
  for (const method of node.members.filter(ts.isMethodDeclaration)) {
    const route = decorators(method).find((d) =>
      ['Get', 'Post', 'Patch', 'Delete', 'Put', 'Options', 'Head'].includes(
        d.expression.getText(),
      ),
    );
    if (!route) continue;
    const verb = route.expression.getText().toLowerCase();
    const guards = [
      ...(deco(node, 'UseGuards')?.arguments ?? []),
      ...(deco(method, 'UseGuards')?.arguments ?? []),
    ].map((a) => a.getText());
    const params = [];
    let body;
    for (const p of method.parameters) {
      if (deco(p, 'Body')) body = dto(checker.getTypeAtLocation(p));
      if (deco(p, 'Query')) {
        const ref = dto(checker.getTypeAtLocation(p));
        if (ref) {
          const schema = schemas[ref.$ref.split('/').at(-1)];
          for (const [name, s] of Object.entries(schema.properties))
            params.push({
              name,
              in: 'query',
              required: schema.required?.includes(name) ?? false,
              schema: s,
            });
        }
      }
      const param = deco(p, 'Param');
      if (param)
        params.push({
          name: value(param.arguments[0]),
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            ...(param.getText().includes('ParseUUIDPipe')
              ? { format: 'uuid' }
              : {}),
          },
        });
    }
    const signature = checker.getSignatureFromDeclaration(method);
    const response = transport(
      checker.getAwaitedType(checker.getReturnTypeOfSignature(signature)),
    );
    for (const prefix of prefixes) {
      const path = ['/api/v1', prefix, value(route.arguments[0]) ?? '']
        .filter(Boolean)
        .join('/')
        .replace(/:([\w]+)/g, '{$1}');
      routes.push({
        path,
        verb,
        handler: method.name.getText(),
        source: source.fileName.replaceAll('\\', '/').split('/src/')[1],
        protected: guards.includes('AuthGuard'),
        csrf:
          guards.includes('BrowserWriteGuard') &&
          !['get', 'head', 'options'].includes(verb),
        status:
          value(deco(method, 'HttpCode')?.arguments[0]) ??
          (verb === 'post' ? 201 : 200),
        parameters: params,
        ...(body ? { body } : {}),
        response,
        csv:
          !!deco(
            method.parameters.find((p) => deco(p, 'Res')) ?? method,
            'Res',
          ) && method.name.getText().endsWith('Csv'),
      });
    }
  }
}
for (const source of program
  .getSourceFiles()
  .filter(
    (s) =>
      s.fileName.endsWith('.controller.ts') &&
      !s.fileName.includes('node_modules'),
  )) {
  const visit = (node) => {
    if (ts.isClassDeclaration(node)) inspectClass(node, source);
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const target = resolve(root, 'src/openapi/generated-metadata.json');
mkdirSync(resolve(root, 'src/openapi'), { recursive: true });
writeFileSync(target, JSON.stringify({ routes, schemas }, null, 2) + '\n');
console.log(
  `Extracted transport metadata for ${routes.length} decorated operations.`,
);
