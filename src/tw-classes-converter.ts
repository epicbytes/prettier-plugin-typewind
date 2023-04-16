import path from "path";

import {extractVariantsAndElements} from "./utils/ast_utils";
import prettier from "prettier";

const regMinus = /-/ig;
const regRunes = /[\/\[\:]/ig;
const replaceOpacity = /(?:\/\d{1,3}$)/ig;

export class TwClassesConverter {

    nodeModulesPath

    constructor(opts: Record<string, any>) {
        if (opts.nodeModulesPath) {
            this.nodeModulesPath = path.join(__dirname, '../../../node_modules')
        }
    }

    public convertFromString(classes: string): prettier.AST {
        return {
            type: 'JSXExpressionContainer',
            expression: AppendMemberExpression(
                extractVariantsAndElements(
                    classes.replace(regMinus, "_").split(" ")
                )
            ),
        }
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