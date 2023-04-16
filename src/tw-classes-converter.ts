import path from "path";

import {extractVariantsAndElements} from "./utils/ast_utils";

const regMinus = /-/ig;
const regRunes = /[\/\[\:]/ig;
const replaceOpacity = /(?:\/\d{1,3}$)/ig;

export class TwClassesConverter {

    nodeModulesPath

    constructor(opts) {
        if (opts.nodeModulesPath) {
            this.nodeModulesPath = path.join(__dirname, '../../../node_modules')
        }
    }

    public convertFromString(classes: string): any {
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
    return renderElements(Object.entries(classElements).reverse())
}

function renderElements(elements) {
    let result;
    while (elements.length > 0) {
        const lastOne = elements.pop()
        if (!result) {
            result = renderEntry(parseElementName(lastOne[0]), parseElementName("tw"))
            continue
        }
        if (lastOne[1] === null) {
            result = renderEntry(parseElementName(lastOne[0]), result)
            continue
        }
        result = renderGroupEntry(parseElementName(lastOne[0]), result,
            lastOne[0] === "raw" ? renderLiteral(Object.keys(lastOne[1]).join(" ")) : renderElements(Object.entries(lastOne[1]).reverse()))
    }

    return result
}

function renderLiteral(text: string) {
    return {
        "type": "Literal",
        "value": text,
        "raw": `\"${text}\"`,

    }
}

function renderEntry(property: any, object: any): any {
    return {
        type: 'MemberExpression',
        property,
        object,
    }
}

function renderGroupEntry(property: any, object: any, attributes: any): any {
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

function parseElementName(name: string): any {
    if (!regRunes.test(name)) {
        return {
            "type": "Identifier",
            "name": name
        }
    }
    const opacityMatches = replaceOpacity.exec(name)
    if (opacityMatches && opacityMatches.length > 0) {
        name = `${opacityMatches.input.slice(0, opacityMatches.index)}$[${opacityMatches[0].slice(1)}]`
    }
    return {
        "type": "Identifier",
        "name": name.replace("[", "['").replace("]", "']")
    }
}