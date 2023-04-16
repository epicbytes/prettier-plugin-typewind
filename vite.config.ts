/// <reference types="vitest" />
import {defineConfig} from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import {resolve} from "path"

export default defineConfig({
    test: {typecheck: {ignoreSourceErrors: true}, passWithNoTests: true},
    plugins: [tsconfigPaths()],
    build: {
        manifest: false,
        rollupOptions: {
            input: resolve(__dirname, './lib/index.js'),
        },
    },
});