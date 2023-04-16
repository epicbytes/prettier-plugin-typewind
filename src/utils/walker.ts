export const walker = (node: any, fn: (node: any) => any) => {
    if (node && typeof node === 'object' && typeof node.type === 'string') {
        node = fn(node)
    }

    if (node && typeof node === 'object') {
        const entries = Object.entries(node)
        for (const [key, child] of entries) {
            node[key] = walker(child, fn)
        }
    }

    return node
}
