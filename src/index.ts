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
import ts from "typescript";
import dlv from "dlv";
import {dset} from "dset";

let base = getBasePlugins()

let contextMap = new Map()

function createParser(parserFormat: string, transform: prettier.BuiltInParser) {
    return {
        ...base.parsers[parserFormat],
        preprocess(code: any, options: any) {
            let original = getCompatibleParser(parserFormat, options)

            if (original.preprocess) {
                return original.preprocess(code, options)
            }

            return code
        },

        parse(text: string, parsers: any, options: any = {}) {
            let original = getCompatibleParser(parserFormat, options)

            if (original.astFormat === 'svelte-ast') {
                options.printer = printers['svelte-ast']
            }

            let ast = original.parse(text, parsers, options)
            let tailwindConfigPath = '__default__'
            let tailwindConfig: any = {}
            let resolveConfig = resolveConfigFallback
            let createContext = createContextFallback
            let generateRules = generateRulesFallback
            let loadConfig = loadConfigFallback

            let baseDir
            let prettierConfigPath = prettier.resolveConfigFile.sync(options.filepath)

            if (options.tailwindConfig) {
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

            if (options.tailwindConfig) {
                tailwindConfigPath = path.resolve(baseDir, options.tailwindConfig)
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

function transformJavaScript(ast: prettier.AST) {
    visit(ast, {
        JSXAttribute(node: prettier.AST) {
            if (!node.value) {
                return
            }
            if (['class', 'className', 'classList'].includes(node.name.name)) {
                if (node.value.type === "Literal") {
                    node.value = convertFromString(node.value.value)
                } else if (node.value.type === 'JSXExpressionContainer') {
                    if (!["CallExpression", "ObjectExpression"].includes(node.value?.expression?.type)) {
                        node.value = convertFromString(node.value.expression.value)
                    }
                    /*visit(node.value, (node, parent, key) => {
                        if (isStringLiteral(node)) {
                            sortStringLiteral(node, { env })
                        } else if (node.type === 'TemplateLiteral') {
                            sortTemplateLiteral(node, { env })
                        }
                    })*/
                }
            }
        },
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

function getCompatibleParser(parserFormat: string, options: { plugins: Record<string, any>[] }) {
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
}


export function injectTwModule (text:string, ast:prettier.AST){
    if (!checkExistsImportedModule("typewind", "tw", text)) {
        return  appendImportToFile("typewind", ["tw"], ast)
    }

    return ast
}

export function checkExistsImportedModule(moduleName: string, specifier: string, text: string): boolean {
    const file = ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest)

    // @ts-ignore
    file.forEachChild(child => {
        if (ts.SyntaxKind[child.kind] === "ImportDeclaration") {
            let importDecl: any = child
            // @ts-ignore
            const clauses = importDecl.importClause.namedBindings?.elements.map(el => el.name.escapedText)
            const localModuleName = importDecl.moduleSpecifier.text
            if (clauses.includes(specifier) && localModuleName === moduleName) {
                return true
            }
        }
    })

    return false
}

export function appendImportToFile(moduleName: string, specifiers: string[], ast: any): any {
    const importModuleAST = ({
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

    ast.body = [importModuleAST, ...ast.body]

    return ast
}

const regMinus = /-/ig;
const regRunes = /[\/\[\:]/ig;
const replaceOpacity = /(?:\/\d{1,3}$)/ig;

function convertFromString(classes: string): prettier.AST {
    return {
        type: 'JSXExpressionContainer',
        expression: AppendMemberExpression(
            extractVariantsAndElements(
                classes.replace(regMinus, "_").split(" ")
            )
        ),
    }
}

function AppendMemberExpression(classElements: Record<string, any>): any {
    return renderElements(Object.entries(classElements))
}

function renderElements(elements: string[][]) {
    let result;
    while (elements.length > 0) {
        // @ts-ignore
        const [className, subClasses] = elements.shift()
        switch (true) {
            case subClasses === null:
                result = renderEntry(parseElementName(className), result ?? parseElementName("tw"))
                break
            case subClasses !== null:
                const attributes = className === "raw"
                    ? renderLiteral(Object.keys(subClasses).join(" "))
                    : renderElements(Object.entries(subClasses))

                result = renderGroupEntry(parseElementName(className), result ?? parseElementName("tw"), attributes)
                break
            default:
            // just skip generation of Node
        }
    }
    return result
}

function renderLiteral(text: string) {
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
    if (!regRunes.test(name)) {
        return {
            type: "Identifier",
            name: name
        }
    }
    const opacityMatches = replaceOpacity.exec(name)
    if (opacityMatches && opacityMatches.length > 0) {
        name = `${opacityMatches.input.slice(0, opacityMatches.index)}$[${opacityMatches[0].slice(1)}]`
    }
    return {
        type: "Identifier",
        name: name.replace("[", "['").replace("]", "']")
    }
}

const sortingByNameNull = (prev:any, next:any) => (Number(Boolean(prev[1])) + prev[0]).localeCompare(Number(Boolean(next[1])) + next[0])

const extractVariantsAndElements = (classList: string[]) => {
    let elements: Record<string, any> = {}
    for (let el of classList) {
        if (["group", "peer"].includes(el)) {
            el = `raw:${el}`
        }
        let separatedClassList: string[] = el.split(":")


        if (separatedClassList.length === 1) {
            elements = {[separatedClassList[0]]: null, ...elements}
            continue
        }

        separatedClassList = separatedClassList.reverse()
        let path: string[] = [];
        while (separatedClassList.length > 0) {
            const lastOne = separatedClassList.pop() as string
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

export const parsers = {
    babel: createParser('babel', transformJavaScript),
    typescript: createParser('typescript', transformJavaScript),
    'babel-ts': createParser('babel-ts', transformJavaScript),
    __js_expression: createParser('__js_expression', transformJavaScript),
}
