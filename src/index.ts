import clearModule from 'clear-module'
import escalade from 'escalade/sync'
import objectHash from 'object-hash'
import resolveFrom from 'resolve-from'
import path from "path"
import prettier from 'prettier'
import prettierParserTypescript from "prettier/parser-typescript";
import prettierParserBabel from 'prettier/parser-babel'

// @ts-ignore
import {generateRules as generateRulesFallback} from 'tailwindcss/lib/lib/generateRules'
// @ts-ignore
import {createContext as createContextFallback} from 'tailwindcss/lib/lib/setupContextUtils'
import loadConfigFallback from 'tailwindcss/loadConfig'
import resolveConfigFallback from 'tailwindcss/resolveConfig'
import * as ts from "typescript"

let base = getBasePlugins()

let contextMap = new Map()
let typewindImported = false;
let classesWasChanged = false;

function convertJSX(node: prettier.AST) {
    if (!node.value || typeof node.value === "undefined") {
        return
    }
    if (['class', 'className', 'classList'].includes(node.name.name)) {
        switch (true) {
            case node.value.expression?.type === "CallExpression":
                if (["CallExpression"].includes(node.value?.expression?.type)) {
                    if (node.value?.expression?.callee?.type !== "MemberExpression") {
                        convertFunctionExpression(node)
                    }
                }
                break;
            case node.value.type === "Literal" && !isEmptyLiteral(node.value.value):
                node.value = convertFromString(node.value.value)
                break
            case node.value.type === 'JSXExpressionContainer':
                switch (true) {
                    case isEmptyLiteral(node.value?.expression?.value):
                        break
                    case ["CallExpression"].includes(node.value?.expression?.type):
                        convertFunctionExpression(node)
                        break
                    case ["ObjectExpression"].includes(node.value?.expression?.type):
                        break
                    case ["MemberExpression"].includes(node.value?.expression?.type):
                        break
                    default:
                        node.value = convertFromString(node.value.expression.value)
                }
                break
            default:
                node.value = renderLiteral("")
        }
    }
}

function convertFunctionExpression(node: prettier.AST) {
    for (let index in node.value.expression.arguments) {
        if (node.value.expression.arguments[index].type === "Literal") {
            node.value.expression.arguments[index] = convertFromString(node.value.expression.arguments[index].value).expression
        }
    }
    visit(node.value.expression.arguments, {
        Property(nodeEl: prettier.AST) {
            if (["Literal", "Identifier"].includes(nodeEl.key.type)) {
                nodeEl.key.type = "ArrayExpression"
                nodeEl.key.elements = [convertFromString(nodeEl.key.value || nodeEl.key.name).expression]
            }
        }
    })
}

function convertCVA(node: prettier.AST) {
    if (node.callee.name === "cva") {
        if (node.arguments[0].type === "Literal" && !isEmptyLiteral(node.arguments[0].value)) {
            node.arguments[0] = convertFromString(node.arguments[0].value).expression
        }
        visit(node.arguments[1], {
            Property(node: prettier.AST) {
                if (["variants"].includes(node.key.name)) {
                    visit(node, {
                        ArrayExpression(nodeArray: prettier.AST) {
                            nodeArray.elements = nodeArray.elements.sort(sortingNodeByValue).map(nodeEl => {
                                if (nodeEl.type === "Literal") {
                                    return convertFromString(nodeEl.value).expression
                                }
                                return nodeEl
                            })
                        }
                    })
                }
            }
        })
    }
}

function getCompatibleParser(parserFormat, options) {
    if (!options.plugins) {
        return base.parsers[parserFormat]
    }

    let parser = {
        ...base.parsers[parserFormat],
    }

    // Now load parsers from plugins
    let compatiblePlugins = [
        '@ianvs/prettier-plugin-sort-imports',
        '@trivago/prettier-plugin-sort-imports',
        'prettier-plugin-import-sort',
        'prettier-plugin-organize-attributes',
        'prettier-plugin-style-order',
    ]

    for (const name of compatiblePlugins) {
        let path: string | null = null

        try {
            path = require.resolve(name)
        } catch (err) {
            continue
        }

        let plugin = options.plugins.find(
            (plugin) => plugin.name === name || plugin.name === path,
        )

        // The plugin is not loaded
        if (!plugin) {
            continue
        }

        Object.assign(parser, plugin.parsers[parserFormat])
    }

    return parser
}

function visit(ast: prettier.AST, callbackMap: Record<string, any>) {
    function _visit(node: prettier.AST, parent?: prettier.AST, key?: string, index?: number, meta: Record<string, any> = {}) {
        if (typeof callbackMap === 'function') {
            if (callbackMap(node, parent, key, index, meta) === false) {
                return
            }
        } else if (node.type in callbackMap) {
            if (callbackMap[node.type](node, parent, key, index, meta) === false) {
                return
            }
        }

        const keys = Object.keys(node)
        for (let i = 0; i < keys.length; i++) {
            const child = node[keys[i]]
            if (Array.isArray(child)) {
                for (let j = 0; j < child.length; j++) {
                    if (child[j] !== null) {
                        _visit(child[j], node, keys[i], j, {...meta})
                    }
                }
            } else if (typeof child?.type === 'string') {
                _visit(child, node, keys[i], i, {...meta})
            }
        }

    }

    _visit(ast)
    if (classesWasChanged && !typewindImported && ast.body) {
        ast.body = appendImportToFile("typewind", ["tw"], ast)
    }
}

function appendImportToFile(moduleName: string, specifiers: string[], ast: any): any {
    const importDeclaration = ({
        "type": "ImportDeclaration",
        "source": {
            "type": "Literal",
            "value": moduleName,
            "raw": `\"${moduleName}\"`,
        },
        "specifiers": specifiers.map(el => ({
            "type": "ImportSpecifier",
            "imported": {
                "type": "Identifier",
                "name": el,
            },
            "importKind": "value",
        })),
        "importKind": "value",
        "assertions": [],
    })

    return [importDeclaration, ...ast.body]
}

const regMinusRx = /-/ig;
const regRunesRx = /[\/\[\:]/ig;
const replaceOpacityRx = /(?:\/\d{1,3}$)/ig;
const getVariantRx = /^\[(.*)\]\:/ig;

function convertFromString(classes: string): prettier.AST {
    classesWasChanged = true
    return {
        type: 'JSXExpressionContainer',
        expression: AppendMemberExpression(
            extractVariantsAndElements(
                classes?.replace(regMinusRx, "_").split(" ")
            )
        ),
    }
}

function AppendMemberExpression(classElements: Record<string, any>): any {
    return renderElements(Object.entries(classElements))
}

function createParser(parserFormat: string, transform: prettier.BuiltInParser): prettier.Parser {
    return {
        ...base.parsers[parserFormat],
        preprocess(code, options) {
            let original = getCompatibleParser(parserFormat, {...options, tokens: false})

            if (original.preprocess) {
                return original.preprocess(code, options)
            }
            return code
        },
        parse(text, parsers, options) {
            let original = getCompatibleParser(parserFormat, options)

            let ast = original.parse(text, parsers, options)
            let tailwindConfigPath = '__default__'
            let tailwindConfig: any = {}
            let resolveConfig = resolveConfigFallback
            let createContext = createContextFallback
            let generateRules = generateRulesFallback
            let loadConfig = loadConfigFallback

            let baseDir
            let prettierConfigPath = prettier.resolveConfigFile.sync(options.filepath)

            if (options['tailwindConfig']) {
                baseDir = prettierConfigPath
                    ? path.dirname(prettierConfigPath)
                    : process.cwd()
            } else {
                baseDir = prettierConfigPath
                    ? path.dirname(prettierConfigPath)
                    : options.filepath
                        ? path.dirname(options.filepath)
                        : process.cwd()
            }

            try {
                let pkgDir = path.dirname(
                    resolveFrom(baseDir, 'tailwindcss/package.json'),
                )

                resolveConfig = require(path.join(pkgDir, 'resolveConfig'))
                createContext = require(path.join(
                    pkgDir,
                    'lib/lib/setupContextUtils',
                )).createContext
                generateRules = require(path.join(
                    pkgDir,
                    'lib/lib/generateRules',
                )).generateRules

                // Prior to `tailwindcss@3.3.0` this won't exist so we load it last
                loadConfig = require(path.join(pkgDir, 'loadConfig'))
            } catch {
            }

            if (options['tailwindConfig']) {
                tailwindConfigPath = path.resolve(baseDir, options['tailwindConfig'])
                clearModule(tailwindConfigPath)
                const loadedConfig = loadConfig(tailwindConfigPath)
                tailwindConfig = loadedConfig.default ?? loadedConfig
            } else {
                let configPath
                try {
                    // @ts-ignore
                    configPath = escalade(baseDir, (_dir, names) => {
                        if (names.includes('tailwind.config.js')) {
                            return 'tailwind.config.js'
                        }
                        if (names.includes('tailwind.config.cjs')) {
                            return 'tailwind.config.cjs'
                        }
                        if (names.includes('tailwind.config.mjs')) {
                            return 'tailwind.config.mjs'
                        }
                        if (names.includes('tailwind.config.ts')) {
                            return 'tailwind.config.ts'
                        }
                    })
                } catch {
                }
                if (configPath) {
                    tailwindConfigPath = configPath
                    clearModule(tailwindConfigPath)
                    const loadedConfig = loadConfig(tailwindConfigPath)
                    tailwindConfig = loadedConfig.default ?? loadedConfig
                }
            }

            // suppress "empty content" warning
            tailwindConfig.content = ['no-op']

            let context
            let existing = contextMap.get(tailwindConfigPath)
            let hash = objectHash(tailwindConfig)

            if (existing && existing.hash === hash) {
                context = existing.context
            } else {
                context = createContext(resolveConfig(tailwindConfig))
                contextMap.set(tailwindConfigPath, {context, hash})
            }

            transform(ast, {env: {context, generateRules, parsers, options}})
            return ast
        },
    }
}

function isEmptyLiteral(value?: string): boolean {
    return !Boolean(value) || Boolean(value?.match(/^\s*$/))
}

function transformJavaScript(ast: prettier.AST) {
    visit(ast, {
        CallExpression(node: prettier.AST) {
            convertCVA(node)
        },
        ImportDeclaration(node: prettier.AST, parent) {
            if (node.importKind === "value" && node.source.value === "typewind") {
                typewindImported = true
            }
        },
        JSXAttribute(node: prettier.AST) {
            convertJSX(node)
        }
    })
}

function getBasePlugins(): { parsers: Record<string, prettier.Parser>, printers: Record<string, prettier.Printer> } {
    return {
        parsers: {
            babel: prettierParserBabel.parsers.babel,
            typescript: prettierParserTypescript.parsers.typescript,
            __js_expression: prettierParserBabel.parsers.__js_expression,
        },
        printers: {},
    }
}

function renderElements(elements: string[][]) {
    let result;
    while (elements.length > 0) {
        // @ts-ignore
        let [className, subClasses] = elements.shift()
        switch (true) {
            case subClasses === null:
                result = renderEntry(parseElementName(className), result ?? parseElementName("tw"))
                break
            case subClasses !== null:
                subClasses = Object.entries(subClasses).sort(sortingByNameNull)
                switch (className) {
                    case "variant":
                        result = renderVariantEntry(parseElementName(className), result ?? parseElementName("tw"), subClasses)
                        break
                    case "raw":
                    default:
                        const attributes = className === "raw"
                            ? renderLiteral(Object.keys(subClasses).join(" "))
                            : renderElements(subClasses)

                        result = renderGroupEntry(parseElementName(className), result ?? parseElementName("tw"), attributes)
                }
                break
            default:
            // just skip generation of Node
        }
    }
    return result
}

function renderLiteral(text: string | boolean | null | number | RegExp) {
    return {
        type: "Literal",
        value: text,
        raw: `\"${text}\"`,
    }
}

function renderEntry(property: prettier.AST, object: prettier.AST): prettier.AST {
    return {
        type: 'MemberExpression',
        property,
        object,
    }
}

function renderVariantEntry(property: prettier.AST, object: prettier.AST, subclasses: prettier.AST): prettier.AST {
    const [[variantRule, subClasses]] = subclasses
    return {
        type: "CallExpression",
        callee: {
            type: 'MemberExpression',
            property,
            object
        },
        arguments: [renderLiteral(variantRule.replace("..", ":")), renderElements(Object.entries(subClasses as Record<string, any>).sort(sortingByNameNull))]
    }
}

function renderGroupEntry(property: prettier.AST, object: prettier.AST, attributes: prettier.AST): prettier.AST {
    return {
        type: "CallExpression",
        callee: {
            type: 'MemberExpression',
            property,
            object
        },
        arguments: [attributes]
    }
}

function parseElementName(name: string): prettier.AST {
    if (!regRunesRx.test(name)) {
        return ts.factory.createIdentifier(name).text
    }
    const opacityMatches = replaceOpacityRx.exec(name)
    if (opacityMatches && opacityMatches.length > 0) {
        name = `${opacityMatches.input.slice(0, opacityMatches.index)}$[${opacityMatches[0].slice(1)}]`
    }
    return ts.factory.createIdentifier(name.replace("[", "['").replace("]", "']")).text
}


const sortingByNameNull = (prev: any, next: any) => (Number(Boolean(prev[1])) + prev[0]).localeCompare(Number(Boolean(next[1])) + next[0])
const sortingNodeByValue = (prev: any, next: any) => prev.value.localeCompare(next.value)

const extractVariantsAndElements = (classList: string[]) => {
    let elements: Record<string, any> = {}
    for (let el of classList) {
        switch (true) {
            case ["group", "peer"].includes(el) :
                el = `raw:${el}`
                break
            case (el.startsWith("!")):
                el = `important:${el.slice(1)}`
                break
            case el.startsWith("@"):
                el = `$${el.slice(1)}`
                break
            case el.startsWith("["):
                const variantRule = getVariantRx.exec(el)
                if (Boolean(variantRule?.[1])) {
                    el = el.replace(getVariantRx, `[${variantRule?.[1].replace(":", "..")}]:`)
                }
                el = `variant:${el}`
                break
        }
        let separatedClassList: string[] = el.split(":")

        if (separatedClassList.length === 1) {
            elements = {[separatedClassList[0]]: null, ...elements}
            continue
        }

        let path: string[] = [];
        while (separatedClassList.length > 0) {
            let lastOne = separatedClassList.shift() as string

            path.push(lastOne)
            const exists = dlv(elements, path)
            if (exists) {
                continue
            }
            if (separatedClassList.length > 0) {
                dset(elements, path, {})
                continue
            }
            dset(elements, path.slice(0, -1), {[lastOne]: null, ...dlv(elements, path.slice(0, -1))})
        }
    }

    return Object.fromEntries(Object.entries(elements).sort(sortingByNameNull))
}


export const options = {
    tailwindConfig: {
        type: 'string',
        category: 'Tailwind CSS',
        description: 'TODO',
    },
}

export const printers: Record<string, prettier.Printer> = {}

export const parsers: Record<string, prettier.Parser> = {
    babel: createParser('babel', transformJavaScript),
    typescript: createParser('typescript', transformJavaScript),
    'babel-ts': createParser('babel-ts', transformJavaScript),
    __js_expression: createParser('__js_expression', transformJavaScript),
}


function dlv(obj: Record<string, any>, key: string[] | string, def?, p?, undef?) {
    if (typeof key === "string") {
        key = key.split ? key.split('.') : key;
    }
    for (p = 0; p < key.length; p++) {
        obj = obj ? obj[key[p]] : undef;
    }
    return obj === undef ? def : obj;
}

function merge(a: any, b: any, k?: any) {
    if (typeof a === 'object' && typeof b === 'object') {
        if (Array.isArray(a) && Array.isArray(b)) {
            for (k = 0; k < b.length; k++) {
                a[k] = merge(a[k], b[k]);
            }
        } else {
            for (k in b) {
                if (k === '__proto__' || k === 'constructor' || k === 'prototype') break;
                a[k] = merge(a[k], b[k]);
            }
        }
        return a;
    }
    return b;
}

function dset<T extends object, V>(obj: T, keys: string | ArrayLike<string | number>, value: V): void;
function dset(obj, keys, val) {
    keys.split && (keys = keys.split('.'));
    let i = 0, l = keys.length, t = obj, x, k;
    while (i < l) {
        k = keys[i++];
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') break;
        t = t[k] = (i === l) ? merge(t[k], val) : (typeof (x = t[k]) === typeof keys) ? x : (keys[i] * 0 !== 0 || !!~('' + keys[i]).indexOf('.')) ? {} : [];
    }
}