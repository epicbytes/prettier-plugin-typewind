const prettier = require('prettier')

const code = `
import { createSignal, Match, Switch } from "solid-js";

export type PromptButtonProps = {
  buttonTitle: string;
  onAcceptClick?: () => void;
  onDeclineClick?: () => void;
};

export function PromptButton({
                               buttonTitle = "",
                               onAcceptClick,
                               onDeclineClick
                             }: PromptButtonProps) {
  const [requested, setRequested] = createSignal(false);
  return (
    <div class={"@flex space-x-2 [&:nth-child(3)]:justify-end [&:nth-child(3)]:justify-between"}>
    <span class="">ddd</span>
    <span class={""}>asd</span>
    <span class={tw.variant('&:nth-child(3)', tw.underline)}></span>
      <Switch>
        <Match when={!requested()}>
          <button
            class={"btn btn-error btn-outline -mb-4 btn-sm !z-[10] !normal-case"}
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
}
`
const codeCVA = `
import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button: React.FC<ButtonProps> = ({
  className,
  intent,
  size,
  ...props
}) => <button className={button({ intent, size, className })} {...props} />;`

const output = prettier.format(code, {
  parser: 'typescript',
  pluginSearchDirs: ['./'],
  plugins: ['./prettier-plugin-typewind'],
})

console.log(output)
