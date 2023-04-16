import {TwClassesConverter} from "../tw-classes-converter";

export default function jsxAttributes(
    twClassesConverter: TwClassesConverter,
    node: any,
    attributeNames: string[],
) {

    if (
        node &&
        node.type === 'JSXAttribute' &&
        node.name &&
        node.name.type === 'JSXIdentifier' &&
        attributeNames.includes(node.name.name) &&
        node.value
    ) {
        switch (node.value.type) {
            case 'StringLiteral':
            case 'Literal':
                node.value = twClassesConverter.convertFromString(node.value.value)
                break
            case 'JSXExpressionContainer':
                if (node.value.expression && node.value.expression.type === "Literal") {
                    node.value = twClassesConverter.convertFromString(node.value.expression.value)
                    /*if (res.type === "MemberExpression"){
                        node.value = res
                    }
                    if (res.type === "CallExpression"){
                        node.value.expression = res
                    }*/
                }
                if (node.value.expression.type==='CallExpression') {
                    console.log(JSON.stringify(node.value.expression, null,2))
                }
                break
        }
    }

    return node
}