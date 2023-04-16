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
    <div class={"flex space-x-2 justify-end"}>
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
            class={"btn btn-sm btn-outline btn-warning normal-case"}
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
const output = prettier.format(code, {
  parser: 'typescript',
  pluginSearchDirs: ['./'],
  plugins: ['./prettier-plugin-typewind'],
})

console.log(output)
