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
import {TwClassesConverter} from "./tw-classes-converter";

const twClassesConverter = new TwClassesConverter({
    nodeModulesPath: path.join(__dirname, '../../../node_modules'),
})

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
                    node.value = twClassesConverter.convertFromString(node.value.value)
                } else if (node.value.type === 'JSXExpressionContainer') {
                    if (!["CallExpression", "ObjectExpression"].includes(node.value?.expression?.type)) {
                        node.value = twClassesConverter.convertFromString(node.value.expression.value)
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
