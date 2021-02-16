# My Code Actions

Not every Language Server provides Code Actions to fix Warnings or Errors shown in the `PROBLEMS` panel and the red squiggles shown in the editor text.

With this extension you can define Quick Fixes for any language.

It can also serve as an alternative to fixed text snippets. You can select a number of `include`/`import` statements at the start of a new file for the actions that do not have a `diagnostics` property.

You can restrict an action if it applies to a certain Diagnostic message (problem in the `PROBLEMS` panel). It will then only show if you request Quick Fixes when the cursor is on a problem (red squiggle) and there is a match for one of the regular expressions and the Diagnostic message.

The actionss are specified in the `settings.json` file for entry `my-code-actions.actions`.

* the key is a list of language id's for which the actions should be shown
* the value is an object where the key is the `title` that is shown in the Quick Fix context menu.<br/>This makes it possible to define actions in the Global settings and merge them with actions specific for a workspace. (It is not working for Multi Root Workspaces yet (TODO))
* the properties for an action are
    * `action`: a string describing the action to take (default: `"insert"`)<br/>Currently the only action implemented is `"insert"` and the insert location is the start of the file.
    * `text`: the text to insert when the action is choosen.<br/>You must add a `\n` to the text if it should be on a single line.
    * `diagnostics`: (optional) an array of regular expressions. Only show the action when the cursor is on a problem (red squiggle) and one of the regular expressions is a match for the problem diagnostic message.<br/>You can copy the diagnostic message from the `PROBLEMS` panel to get a starting string for the regular expression.

For the properties `text` and `diagnostics` be aware that you need to escape the `\` and the `"` inside strings in the JSON file. But not needed for the `\n` character in the `text` property.

If the insert text is already found in the source code that particular action is not shown.

There are multiple methods to see the Quick Fixes:

* use <kbd>Ctrl</kbd>+<kbd>.</kbd> in the editor
* click on the lightbulb shown in the editor (only visible when there is a Quick Fix)
* select a problem in the `PROBLEMS` panel and use any of the above methods when the problem icon changes to a lightbulb.

## An example

```json
  "my-code-actions.actions": {
    "[c,cpp]": {
      "include stdio": { "text": "#include <stdio.h>\n" },
      "include vector": { "text": "#include <vector>\n" },
      "include mylib": {
        "text": "#include \"mylib.h\"\n",
        "diagnostics": ["identifier \"[^\"]+\" is undefined"]
      }
    },
    "[python]": {
      "import re": {
        "text": "import re\n",
        "diagnostics": ["\"re\" is not defined"]
      }
      
    }
  }
```

# TODO

* Support for Multi Root Workspace (read configuration for current active editor)
* use captured groups from the `diagnostics` regular expression or regular expression for the selected range or problem range
* specify the insert point
* other actions like: replace, delete
* Default actions defined in the extenstion for a collection of languages<br/>The user has to select which default actions (languages) will be loaded. Actions stored in separate JSON files in the extension
