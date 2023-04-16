import path from 'path'
import {parsers} from './parsers'
import {TwClassesConverter} from "./tw-classes-converter";

const twClassesConverter = new TwClassesConverter({
    nodeModulesPath: path.join(__dirname, '../../../node_modules'),
})

module.exports = {
    parsers: parsers(twClassesConverter),
}
