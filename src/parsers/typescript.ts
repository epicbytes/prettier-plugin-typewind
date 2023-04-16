import prettierParserTypescript from 'prettier/parser-typescript'
import {walker} from "../utils/walker";
import type {TwClassesConverter} from "../tw-classes-converter";
import jsxAttributes from "../formatters/jsx";
import {appendImportToFile, checkExistsImportedModule} from "../utils/ast_utils";

export const typescript = (converter: TwClassesConverter) => ({
    ...prettierParserTypescript.parsers.typescript,
    parse(text, parsers, options) {

        const ast = prettierParserTypescript.parsers.typescript.parse(
            text,
            parsers,
            options
        )

        const attributeNames = ["class", "className", "classList"]

        let result = walker(ast, node => {
            jsxAttributes(converter, node, attributeNames)
            return node
        })

        if (!checkExistsImportedModule("typewind", "tw", text)) {
            result = appendImportToFile("typewind", ["tw"], result)
        }

        return result
    }
})

