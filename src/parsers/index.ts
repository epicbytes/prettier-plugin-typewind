import type {TwClassesConverter} from "../tw-classes-converter";
import {typescript} from "./typescript";

export const parsers = (converter: TwClassesConverter) => ({
    typescript: typescript(converter)
})