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
    * `atCursor` : Regular expressions to search surrounding the cursor location. Search the match that contains the cursor location. Capture groups can be used in variable `{{atCursor:}}`"
    * `file` : File path for which file to modify. If `file` starts with `/` it is relative to the workspace folder of the current file, otherwise it is relative to the current file, use `/` as directory separator, you can use a few [variables](#file-variables) (default: current file)
    * `action` : a string describing the action to take: `insert` or `replace` (default: `insert`)<br/>Properties used when:
        * `"action": "insert"`
            * `where` : string describing the position of the insert (default: `"start"`)<br/>Possible values:
                * `start` : At the start of the file
                * `beforeLast` : Before the last line matching the `insertFind` property or at the start
                * `afterLast` : After the last line matching the `insertFind` property or at the start
                * `beforeFirst` : Before the first line matching the `insertFind` property or at the start
            * `insertFind` : A regular expression that determines the insert location together with `where` property.
            * `text`: the text to insert.<br/>You must add a `\n` to the text if it should be on a single line.
        * `"action": "replace"`
            * `replaceFind` : A string or array of strings. Each a regular expression, with capture groups, that is matched to the lines of the file. Each regex starts on the line where the previous regex has found a match.
            * `text`: the text with group references, like $1, that replaces the string matched by the last regex of `replaceFind`.
    * `edits` : An array of edits that can have the following properties:
        * `action` : `"insert"` or `"replace"`
        * `file` : use a different file as specified in the action `file` property
        * `text` : if the `action` is `"insert"` and the text string is found in the file this edit is skipped.
        * `where` : `start` or `beforeLast` or `afterLast` or `beforeFirst`
        * `insertFind`
        * `replaceFind`
        * `condFind` : A string or array of strings. Each a regular expression, that is matched to the lines of the file. Each regex starts the search after the found match of the previous regex. The edit is performed when the strings are NOT found before `condFindStop`.
        * `condFindStop` : A regular expression string, that is matched to the lines of the file. The `condFind` stops searching when a regex has no match before `condFindStop` is found. Only test for `condFindStop` when first string of `condFind` is found. If not defined there is no stop condition.
        * `needsContinue` : Does the next edit depend on the location or the content of this edit. Do we have to run the action again to continue with the edits. Determines if a message is shown to the user. (default: conditional edit= `true`, other edit= `undefined`)<br/>Depending on the value:
            * `undefined` : (not present) go to next edit
            * `true/false` : then stop edits and yes/no show Continue message
            * `"nextCondFail"`: (next edit `condFind` fails)<br/>Use the `condFind` of the next edit to determine if we stop the edits:
                * `condFind` is **not** found: then stop edits and show Continue message
                * `condFind` is found : go to next edit.

If you specify a `file` property and the file is not yet opened by Visual Studio Code (just a tab of the file is not enough) you get an error message asking you to open the file. You can use the `"Open file"` button in the message. If the file does not exists you get another error message allowing you to create the file. You must keep the file tab to be able to edit the file by the Quick Fix, otherwise you get the same error message. Apply the same Quick Fix when Visual Studio Code has read the file. You have to save the file yourself.

If the insert text is already found in the source code that particular action is not shown. That only applies if the action is in the current file and does not contains an `edits` property.

The other settings are:

* `my-code-actions.diagLookup` : Object with arrays of lookup strings for diagnostics capture group 1 as key. The strings can be used in the <code>{{diagLookup:<em>n</em>}}</code> field.
    ```
      "my-code-actions.diagLookup": {
        "mat-expansion-panel": ["MatExpansionModule", "@angular/material/expansion"]
      }
    ```
* `my-code-actions.lookup` : Object with strings for a normal lookup by key<br/>Can be used to name often used strings. To use the same regular expression in different places you can name it:
    ```
    "my-code-actions.lookup": {
      "appName": "app",
      "NgModuleStart": "@NgModule\\(\\{",
      "NgModuleEnd": "\\}\\)",
      "importsStart": "imports\\s*:\\s*\\["
    }
    ```
    You can define them at different levels (User/Workspace/Folder) and thus overrule named strings because VSC merges the content of a setting.

Be aware that you need to escape the `\` and the `"` inside strings in the JSON file. But not needed for the `\n` character in the `text` property.

There are multiple methods to see the Quick Fixes:

* use <kbd>Ctrl</kbd>+<kbd>.</kbd> in the editor
* click on the lightbulb shown in the editor (only visible when there is a Quick Fix)
* select a problem in the `PROBLEMS` panel and use any of the above methods when the problem icon changes to a lightbulb.

## File Variables

In the `file` property you can use the following [variable](https://code.visualstudio.com/docs/editor/variables-reference):

* `${fileBasenameNoExtension}`

This variable is constructed from the current file.

## Fields

In all strings, apart from `diagnostics`, we can use fields to make actions more generic or reduce the possible typos.

The diagnostic and atCursor fields are replaced before the `text` is used as a replace string using the last regex of `replaceFind`. So any capture group reference outside a field refers to a capture group of `replaceFind`.

### Diagnostic Field: <code>{{diag:<em>text</em>}}</code>

Often part of the text you want inserted in the action is also mentioned in the diagnostics message. If you put this text in a capture group you can use this capture group.

The syntax:

<code>{{diag:<em>replace_text</em>}}</code>

The field is replaced with the _`replace_text`_ where capture group references (`$1` etc.) are taken from the diagnostics message regular expression.<br/>An example field: `{{diag:__$1__}}`

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

### Diagnostic Lookup Field: <code>{{diagLookup:<em>n</em>}}</code>

If you need to fill in different strings based on a text in the diagnostic message, like Class name, module names you can use the Diagnostic Lookup Field. The first capture group of the diagnostic message is used as a key in the settings `my-code-actions.diagLookup`. The array of strings returned can be used by using the number of the index in the field.

The syntax:

<code>{{diagLookup:<em>n</em>}}</code>

_n_ is the index in the array.

### atCursor Field: <code>{{atCursor:<em>text</em>}}</code>

Often part of the text you want inserted in the action is near the cursor position. If you put this text in a capture group you can use this capture group. The range (squiggle) in the diagnostic message is often only marking a single identifier.

The syntax:

<code>{{atCursor:<em>replace_text</em>}}</code>

The field is replaced with the _`replace_text`_ where capture group references (`$1` etc.) are taken from the `atCursor` regular expression.<br/>An example field: `{{atCursor:$1}}`

### Lookup Field: <code>{{lookup:<em>key</em>}}</code>

If you use the same string (regular expression) multiple times you can reduce the possibility of typos by naming this string and using a Lookup Field.

The syntax:

<code>{{lookup:<em>key</em>}}</code>

_key_ is used in the object that is the setting `my-code-actions.lookup`.

## An example

This example contains:

* a few insert actions for C and C++
* a generic import action for Python
* a generic import for Angular, where only the `MatExpansionModule` is specified, `mat-expansion-panel` is mentioned in the diagnostic message and captured as group 1.
* add a method to a PHP class using `{{atCursor:}}` for the class name

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
    "[typescript]": {
      "Add {{diagLookup:0}} to imports": {
        "diagnostics": ["'(.*?)' is not a known element"],
        "file": "{{lookup:appName}}.module.ts",
        "edits": [
          {
            "where": "afterLast",
            "insertFind": "^import",
            "text": "import { {{diagLookup:0}} } from '{{diagLookup:1}}';\n",
            "needsContinue": "nextCondFail"
          },
          {
            "condFind": "{{lookup:NgModuleStart}}",
            "where": "afterLast",
            "insertFind": "^import",
            "text": "@NgModule({ imports: [ {{diagLookup:0}} ] });\n",
            "needsContinue": false
          },
          {
            "condFind": ["{{lookup:NgModuleStart}}", "{{lookup:importsStart}}"],
            "condFindStop": "{{lookup:NgModuleEnd}}",
            "action": "replace",
            "replaceFind": ["{{lookup:NgModuleStart}}", "({{lookup:NgModuleEnd}})"],
            "text": ", imports: [ {{diagLookup:0}} ]\n$1",
            "needsContinue": false
          },
          {
            "action": "replace",
            "replaceFind": ["{{lookup:NgModuleStart}}", "{{lookup:importsStart}}", "(\\s*\\])"],
            "text": ", {{diagLookup:0}}$1"
          }
        ]
      }
    },
    "[php]": {
      "Add method {{diag:$1}} to {{atCursor:$1}}": {
        "diagnostics": ["Undefined method '(.*?)'."],
        "atCursor": "([_a-zA-Z0-9]+)::{{diag:$1}}",
        "file": "{{atCursor:$1}}.php",
        "where": "afterLast",
        "insertFind": "class {{atCursor:$1}} {",
        "text": "public function {{diag:$1}}() { }\n"
      }
  },
  "my-code-actions.diagLookup": {
    "mat-expansion-panel": ["MatExpansionModule", "@angular/material/expansion"],
  },
  "my-code-actions.lookup": {
    "appName": "app",
    "NgModuleStart": "@NgModule\\(\\{",
    "NgModuleEnd": "\\}\\)",
    "importsStart": "imports\\s*:\\s*\\["
  }
```

# TODO

* Support for Multi Root Workspace (read configuration for current active editor)
* use captured groups from the `diagnostics` regular expression or regular expression for the selected range or problem range
* other actions like: delete
* Default actions defined in the extenstion for a collection of languages<br/>The user has to select which default actions (languages) will be loaded. Actions stored in separate JSON files in the extension
