# Plugin for converting string classes to object classes
### Attention! This is a test solution, not ready for production.
But works fine, but does not exclude bugs

## Installation

To get started, just install `prettier-plugin-tailwindcss` as a dev-dependency:

```sh
npm i -D prettier prettier-plugin-typewind
or
yarn add -D prettier prettier-plugin-typewind
```

This plugin follows Prettier’s autoloading convention, so as long as you’ve got Prettier set up in your project, it’ll start working automatically as soon as it’s installed.

_Note that plugin autoloading is not supported when using certain package managers, such as pnpm or Yarn PnP. In this case you may need to add the plugin to your Prettier config explicitly:_

```js
// prettier.config.js
module.exports = {
  plugins: [require('prettier-plugin-typewind')],
}
```
## Resolving your Tailwind configuration

To ensure that the class sorting is taking into consideration any of your project's Tailwind customizations, it needs access to your [Tailwind configuration file](https://tailwindcss.com/docs/configuration) (`tailwind.config.js`).

By default the plugin will look for this file in the same directory as your Prettier configuration file. However, if your Tailwind configuration is somewhere else, you can specify this using the `tailwindConfig` option in your Prettier configuration.

Note that paths are resolved relative to the Prettier configuration file.

```js
// prettier.config.js
module.exports = {
  tailwindConfig: './styles/tailwind.config.js',
}
```

## Use
You can use it for example like this:

- in package.json
```json
{
  "scripts":{
    "pret": "prettier --write ./src"
  }
}
```

## What can be converted
- [x] JSX classes from [\*.jsx,\*.tsx] - class, className, classList
- [x] Class Variance Authority from [\*.ts,\*.tsx] - base class, intents, sizes
- [ ] Support for not only Tailwind classes, also take custom classes and put it in ```raw()```
- [ ] Modules like Classnames or clsx
- [ ] TWIN.macro