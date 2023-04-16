const fs = require('fs')
const path = require('path')
const prettier = require('prettier')

const code = `
import { For, Show } from "solid-js";
import { Icon } from "solid-heroicons";
import { plus } from "solid-heroicons/outline";
export function TableFieldArray({
  arrayField,
  RowElement,
  HeaderElement,
  onAddClick = undefined,
}) {
  return (
    <div class="overflow-x-auto md:hover:bg-red-100/56 md:hover:relative text-[48px] bg-red-500/34 md:text-center hover:text-sm hover:uppercase">
      <table class="table w-full table-compact group">
        <thead classList={{ "text-error": !arrayField.isValid }}>
          <HeaderElement />
        </thead>
        <tbody>
          <For each={arrayField.controls}>
            {(item, index) => (
              <RowElement item={item} index={index} arrayField={arrayField} />
            )}
          </For>
        </tbody>
      </table>
      <Show when={typeof onAddClick !== "undefined"}>
        <div class={tw.raw("group peer")}>
          <button
            class={"btn btn-outline btn-sm"}
            onClick={(event) => {
              event.preventDefault();
              onAddClick();
            }}
          >
            <Icon path={plus} class={"w-4 h-4"} />
            <span>Add</span>
          </button>
        </div>
      </Show>
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
