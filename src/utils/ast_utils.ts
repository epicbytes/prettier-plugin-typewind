import ts from "typescript";
import dlv from "dlv";
import {dset} from "dset";
import prettier from "prettier";

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

export const sortingByNameNull = (prev:any, next:any) => (Number(Boolean(prev[1])) + prev[0]).localeCompare(Number(Boolean(next[1])) + next[0])

export const extractVariantsAndElements = (classList: string[]) => {
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
