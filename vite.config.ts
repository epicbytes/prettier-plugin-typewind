/// <reference types="vitest" />
import {defineConfig} from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from "path"
import typescript from "@rollup/plugin-typescript";

export default defineConfig({
    test: {
        typecheck: {ignoreSourceErrors: true}, passWithNoTests: true, globals: true,
        environment: 'jsdom',
        includeSource: ['src/index.ts'],
    },
    plugins: [tsconfigPaths()],
    build: {
        manifest: true,
        minify: true,
        reportCompressedSize: true,
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            fileName: "index",
            formats: ["cjs"],
        },
        rollupOptions: {
            external: [],
            plugins: [
                typescript({
                    sourceMap: false,
                    declaration: true,
                    outDir: "dist",
                }),
            ],
        },
    },
});