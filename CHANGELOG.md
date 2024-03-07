# Change Log

## [1.1.0] 2024-03-07
### Added
- <code>{{ask:<em>name</em>}}</code> field, and `ask` Input Box descriptions in edits
- `replaceGlobal`: replace all occurrences in the file
- `where`: `atCursor` option, start replace search where `atCursor` matched

## [1.0.1] 2023-10-20
### Fixed
- if `atCursor` is missing results in error

## [1.0.0] 2022-07-28
### Added
- Add `CHANGELOG.md`
- `README.md`: location of cursor for the property `atCursor` regex
### Fixed
- `atCursor` can have fields

## [0.7.0] 2021-08-21
### Added
- `where` can be `beforeLast`

## [0.6.0] 2021-06-01
### Added
- file variables

## [0.5.0] 2021-03-24
### Added
- `atCursor` regex to search surrounding the cursor
- `{{atCursor:}}` variable

## [0.4.0] 2021-03-08
### Added
- multiple edits for one action
- use diagnostics capture group to lookup a set of strings: e.q. `{{diagLookup:0}}`
- define lookup strings that can be redefined in workspace or folder: e.q. `{{lookup:appName}}`
- all properties, except `diagnostics`, can have the fields: <code>{{diagLookup:<em>n</em>}}</code>, <code>{{lookup:<em>string</em>}}</code>, <code>{{diag:<em>string</em>}}</code>

## [0.3.0] 2021-03-04
### Added
- diagnostic fields in `title` and `text`

## [0.2.0] 2021-03-03
### Added
- location in file where the action applies
- which `file` to apply action
- action `replace` with capture groups

## [0.1.0] 2021-02-16
