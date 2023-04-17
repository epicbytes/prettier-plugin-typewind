# Plugin for converting string classes to object classes
### Attention! This is a test solution, not ready for production.
But works fine, but does not exclude bugs

## Introduction
This plugin is designed to simplify development using typewind, which makes it possible to type component classes.

In the development process, you inevitably encounter the need for uniformity in the code, uniformity in approaches. But transferring strings into objects by hand is time consuming.

A plugin has been written to help with this.

For example:

So exists code with include class-variance-authority module code like this
```js
const button = cva("button", {
  variants: {
    intent: {
      primary: [
        "bg-blue-500",
        "text-white",
        "border-transparent",
        "hover:bg-blue-600",
      ],
      secondary: [
        "bg-white",
        "text-gray-800",
        "border-gray-400",
        "hover:bg-gray-100",
      ],
    },
    size: {
      small: ["text-sm", "py-1", "px-2"],
      medium: ["text-base", "py-2", "px-4"],
    },
  },
  compoundVariants: [{ intent: "primary", size: "medium", class: "uppercase" }],
  defaultVariants: {
    intent: "primary",
    size: "medium",
  },
});
```

Will be converted to this:

```js
const button = cva(tw.button, {
  variants: {
    intent: {
      primary: [
        tw.bg_blue_500,
        tw.text_white,
        tw.border_transparent,
        tw.hover(tw.bg_blue_600),
      ],
      secondary: [
        tw.bg_white,
        tw.text_gray_800,
        tw.border_gray_400,
        tw.hover(tw.bg_gray_100),
      ],
    },
    size: {
      small: [tw.text_sm, tw.py_1, tw.px_2],
      medium: [tw.text_base, tw.py_2, tw.px_4],
    },
  },
  compoundVariants: [{ intent: "primary", size: "medium", class: "uppercase" }],
  defaultVariants: {
    intent: "primary",
    size: "medium",
  },
});

```
Exists code writen in JSX style
```jsx
return (
    <div class={"flex space-x-2 justify-end"}>
      <Switch>
        <Match when={!requested()}>
          <button
            class={"btn btn-error btn-outline btn-sm normal-case"}
            onClick={(event) => {
              event.preventDefault();
              setRequested(true);
            }}
          >
            {buttonTitle}
          </button>
        </Match>
        <Match when={requested()}>
          <button
            class={"btn btn-sm btn-outline hover:btn-ghost md:hover:btn-warning normal-case"}
            onClick={(event) => {
              event.preventDefault();
              setRequested(false);
              onAcceptClick && onAcceptClick();
            }}
          >
            yes
          </button>
          <button
            class={"btn btn-sm btn-outline normal-case"}
            onClick={(event) => {
              event.preventDefault();
              setRequested(false);
              onDeclineClick && onDeclineClick();
            }}
          >
            no
          </button>
        </Match>
      </Switch>
    </div>
  );
```
will be converted to:

```jsx
return (
    <div class={tw.flex.justify_end.space_x_2}>
      <Switch>
        <Match when={!requested()}>
          <button
            class={tw.btn.btn_error.btn_outline.btn_sm.normal_case}
            onClick={(event) => {
              event.preventDefault();
              setRequested(true);
            }}
          >
            {buttonTitle}
          </button>
        </Match>
        <Match when={requested()}>
          <button
            class={tw.btn.btn_outline.btn_sm.normal_case
              .hover(tw.btn_ghost)
              .md(tw.hover(tw.btn_warning))}
            onClick={(event) => {
              event.preventDefault();
              setRequested(false);
              onAcceptClick && onAcceptClick();
            }}
          >
            yes
          </button>
          <button
            class={tw.btn.btn_outline.btn_sm.normal_case}
            onClick={(event) => {
              event.preventDefault();
              setRequested(false);
              onDeclineClick && onDeclineClick();
            }}
          >
            no
          </button>
        </Match>
      </Switch>
    </div>
  );

```

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
- [ ] Support sorting classes like in prettier-plugin-tailwindcss
- [ ] Support for not only Tailwind classes, also take custom classes and put it in ```raw()```
- [ ] Modules like Classnames or clsx
- [ ] TWIN.macro