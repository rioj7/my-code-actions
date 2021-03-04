# My Code Actions

Not every Language Server provides Code Actions to fix Warnings or Errors shown in the `PROBLEMS` panel and the squiggles shown in the editor text.

With this extension you can define Quick Fixes for any language.

It can also serve as an alternative to fixed text snippets. You can construct a number of `include`/`import` statements at the start of a new file for the actions that do not have a `diagnostics` property.

You can restrict an action if it applies to a certain Diagnostic message (problem in the `PROBLEMS` panel). It will then only show if you request Quick Fixes when the cursor is on a problem (squiggle) and there is a match for one of the regular expressions and the Diagnostic message.

The actions are specified in the `settings.json` file for entry `my-code-actions.actions`.

* the key is a list of language id's for which the actions should be shown
* the value is an object where the key is the `title` that is shown in the Quick Fix context menu.<br/>This makes it possible to define actions in the Global settings and merge them with actions specific for a workspace. (It is not working for Multi Root Workspaces yet (TODO))
* the properties for an action are
    * `diagnostics` : (optional) an array of regular expressions. Only show the action when the cursor is on a problem (squiggle) and one of the regular expressions is a match for the problem diagnostic message.<br/>The capture groups of the matched regular expression can be [used in the `title` and the `text` property](#diagnostics-capture-groups).<br/>You can copy the diagnostic message from the `PROBLEMS` panel to get a starting string for the regular expression.
    * `file` : Filepath for which file to modify. If `file` starts with `/` it is relative to the workspace folder of the current file, otherwise it is relative to the current file (default: current file)
    * `action` : a string describing the action to take: `insert` or `replace` (default: `insert`)<br/>Properties used when:
        * `"action": "insert"`
            * `where` : string describing the position of the insert (default: `"start"`)<br/>Possible values:
                * `start` : At the start of the file
                * `afterLast` : After the last line matching the `insertFind` property or at the start
                * `beforeFirst` : Before the first line matching the `insertFind` property or at the start
            * `insertFind` : A regular expression that determines the insert location together with `where` property.
            * `text`: the text to insert.<br/>You must add a `\n` to the text if it should be on a single line.
        * `"action": "replace"`
            * `replaceFind` : A string or array of strings. Each a regular expression, with capture groups, that is matched to the lines of the file. Each regex starts on the line where the previous regex has found a match.
            * `text`: the text with group references, like $1, that replaces the string matched by the last regex of `replaceFind`.

If you specify a `file` property and the file is not yet opened by Visual Studio Code (just a tab of the file is not enough) you get an error message asking you to open the file. You can use the `"Open file"` button in the message. If the file does not exists you get another error message allowing you to create the file. You must keep the file tab to be able to edit the file by the Quick Fix, otherwise you get the same error message. Apply the same Quick Fix when Visual Studio Code has read the file. You have to save the file yourself.

Be aware that you need to escape the `\` and the `"` inside strings in the JSON file. But not needed for the `\n` character in the `text` property.

If the insert text is already found in the source code that particular action is not shown. That only applies if the action is in the current file.

There are multiple methods to see the Quick Fixes:

* use <kbd>Ctrl</kbd>+<kbd>.</kbd> in the editor
* click on the lightbulb shown in the editor (only visible when there is a Quick Fix)
* select a problem in the `PROBLEMS` panel and use any of the above methods when the problem icon changes to a lightbulb.

## Diagnostics capture groups

Often part of the text you want inserted in the action is also mentioned in the diagnostics message. If you put this text in a capture group you can use this text in the `title` and the `text` property of the action.

In the properties `title` and `text` every special field with the syntax:

<code>{{diag:<em>replace_text</em>}}</code>

is replaced with the _replace_text_ where capture group references (`$1` etc.) are taken from the diagnostics message regular expression.<br/>An example field: `{{diag:__$1__}}`

The diagnostic fields are replaced before the `text` is used as a replace string using the last regex of `replaceFind`. So any capture group reference outside a diagnostic field refers to a capture group of `replaceFind`.

For python you can describe a generic import action:

```json
  "my-code-actions.actions": {
    "[python]": {
      "import {{diag:$1}}": {
        "diagnostics": ["\"(.*?)\" is not defined"],
        "text": "import {{diag:$1}}\n",
        "where": "afterLast",
        "insertFind": "^(import |from \\w+ import )"
      }
    }
  }
```

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
      "import {{diag:$1}}": {
        "diagnostics": ["\"(.*?)\" is not defined"],
        "text": "import {{diag:$1}}\n",
        "where": "afterLast",
        "insertFind": "^(import |from \\w+ import )"
      }
    },
    "[javascript]": {
      "construct imports": {
        "diagnostics": ["is not a known element"],
        "file": "config.js",
        "text": "import = []"
      },
      "add components to import": {
        "diagnostics": ["is not a known element"],
        "file": "config.js",
        "action": "replace",
        "replaceFind": ["import\\s*=\\s*\\[", "(\\s*\\])"],
        "text": ", components$1"
      }
    }
  }
```

## Release Notes

### v0.3.0 diagnostic fields in `title` and `text`
### v0.2.0
* location in file where the action applies
* which `file` to apply action
* action `replace` with capture groups

### v0.1.0 First release

# TODO

* Support for Multi Root Workspace (read configuration for current active editor)
* use captured groups from the `diagnostics` regular expression or regular expression for the selected range or problem range
* other actions like: delete
* Default actions defined in the extenstion for a collection of languages<br/>The user has to select which default actions (languages) will be loaded. Actions stored in separate JSON files in the extension
