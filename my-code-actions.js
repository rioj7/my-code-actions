'use strict';
const vscode = require('vscode');
const path = require('path');

function isString(obj) { return typeof obj === 'string'; }
function isArray(obj) { return Array.isArray(obj); }
function isBoolean(obj) { return typeof obj === 'boolean'; }
function getConfig(section) { return vscode.workspace.getConfiguration(extensionShortName, null).get(section); }
function getProperty(obj, prop, deflt) { return obj.hasOwnProperty(prop) ? obj[prop] : deflt; };

const extensionShortName = 'my-code-actions';
const gActionInsert = 'insert';
const gActionReplace = 'replace';
const gActionStart = 'start';

let languageMap = new Map();
let gLookup = undefined;
let gDiagLookup = undefined;

class CodeAction extends vscode.CodeAction {
  constructor(title, kind, diagMatch, diagRegex) {
    super(title, kind);
    this.diagMatch = diagMatch;
    this.diagRegex = diagRegex;
    this.properties = {};
  }
  /** get property and eval fields if string or string[]
   * @param {string} prop */
  getProperty(obj, prop, deflt) {
    let val = getProperty(obj, prop, deflt);
    if (isString(val)) { val = evalFields(val, this.diagMatch, this.diagRegex); }
    if (isArray(val)) {
      val = val.map( v => isString(v) ? evalFields(v, this.diagMatch, this.diagRegex) : v);
    }
    return val;
  }
}

class LanguageCodeActionProvider {
  constructor(language) {
    this.language = language;
    this.active = true;
    this.actionsets = [];
  }
  setActive(active) {
    this.active = active;
    if (!active) {
      this.actionsets = [];
    }
  }
  addActionset(actionset) {
    this.active = true;
    this.actionsets.push(actionset);
  }
  provideCodeActions(document, range, actionContext) {
    if (!this.active) { return undefined; }
    let actions = [];
    for (const actionset of this.actionsets) {
      for (const actionGenerator of actionset) {
        let newActions = actionGenerator.provideCodeActions(document, range, actionContext);
        actions.push(...newActions);
      }
    }
    return actions;
  }
  /** @param {vscode.Uri} fileURI */
  findTextDocument(fileURI) {
    for (const document of vscode.workspace.textDocuments) {
      if (document.isClosed) { continue; }
      if (document.uri.scheme != 'file') { continue; }
      if (document.uri.fsPath === fileURI.fsPath) { return document; }
    }
    return undefined;
  }
  /** @param {vscode.TextDocument} actionDocument @returns {[RegExpExecArray, number?, RegExp?]} */
  findLocation(actionDocument, doFind, doFindStop) {
    if (isString(doFind)) { doFind = [doFind]; }
    let lineNumber = 0, lastIndex = 0;
    let match = undefined;
    let findRegex;
    let testStop = false;
    let findStopRegex = doFindStop ? new RegExp(doFindStop, 'g') : undefined;
    for (const find of doFind) {
      findRegex = new RegExp(find, 'g');
      for (; lineNumber < actionDocument.lineCount; ++lineNumber, lastIndex = 0) {
        const line = actionDocument.lineAt(lineNumber).text;
        findRegex.lastIndex = lastIndex;
        match = findRegex.exec(line);
        if (match) {
          lastIndex = findRegex.lastIndex;
          testStop = true;
          break;
        }
        if (testStop && findStopRegex) {
          findStopRegex.lastIndex = lastIndex;
          if (findStopRegex.exec(line)) { return [undefined]; }
        }
      }
    }
    return [match, lineNumber, findRegex];
  }
  /** @param {CodeAction} action @param {vscode.TextDocument} actionDocument */
  condFind(action, edit, actionDocument) {
    let condFind = action.getProperty(edit, 'condFind');
    if (!condFind) { return false; }
    let condFindStop = action.getProperty(edit, 'condFindStop');
    const [match] = this.findLocation(actionDocument, condFind, condFindStop);
    return match;
  }
  /** @param {CodeAction} action */
  resolveCodeAction(action, token) {
    if (!this.active) { return action; }
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return action; }
    let edits = action.getProperty(action.properties, 'edits');
    if (!edits) {
      edits = [ action.properties ];
    }
    const fileDefault = action.getProperty(action.properties, 'file');
    for (let editIdx = 0; editIdx < edits.length; ++editIdx) {
      const edit = edits[editIdx];

      let actionDocument = editor.document;
      let file = action.getProperty(edit, 'file', fileDefault);
      if (file) {
        let fileURI = undefined;
        let baseURI = undefined;
        if (file.startsWith('/')) {
          let workspace = vscode.workspace.getWorkspaceFolder(actionDocument.uri);
          if (!workspace) {
            vscode.window.showErrorMessage('Current file not in this Workspace');
            return action;
          }
          baseURI = workspace.uri;
          file = file.substring(1);
        } else {
          baseURI = vscode.Uri.file(path.dirname(editor.document.uri.fsPath));
        }
        fileURI = vscode.Uri.joinPath(baseURI, file);
        actionDocument = this.findTextDocument(fileURI);
        if (!actionDocument) {
          vscode.window.showErrorMessage(`Please visit file, and keep tab: ${fileURI.fsPath}`, "Open file")
            .then( result => {
              if (!result) { return action; }
              vscode.commands.executeCommand('vscode.open', fileURI);
            });
          return action;
        }
      }

      if (this.condFind(action, edit, actionDocument)) { continue; }

      let docAction = action.getProperty(edit, 'action', gActionInsert)
      if (docAction === gActionInsert) {
        let insertWhere = action.getProperty(edit, 'where', gActionStart);
        let insertFind = action.getProperty(edit, 'insertFind');
        if (!insertFind) { insertWhere = gActionStart; }
        let insertText = action.getProperty(edit, 'text');
        if (!insertText) { return action; }
        if (findLiteral(actionDocument, insertText) >= 0) { continue; } // already present in the file
        insertFind = new RegExp(insertFind);
        let lineNumber = 0;
        if (insertWhere !== gActionStart) {
          for (let n = 0; n < actionDocument.lineCount; ++n) {
            if (insertFind.test(actionDocument.lineAt(n).text)) {
              if (insertWhere === 'beforeFirst') {
                lineNumber = n;
                break;
              }
              if (insertWhere === 'afterLast') {
                lineNumber = n+1;
              }
            }
          }
        }
        if (lineNumber === actionDocument.lineCount) { insertText = '\n'+insertText; }
        if (!action.edit) { action.edit = new vscode.WorkspaceEdit(); }
        action.edit.insert(actionDocument.uri, new vscode.Position(lineNumber, 0), insertText);
      }
      if (docAction === gActionReplace) {
        let replaceFind = action.getProperty(edit, 'replaceFind');
        let replaceText = action.getProperty(edit, 'text');
        if (!(replaceFind && replaceText)) { return action; }
        const [match, lineNumber, findRegex] = this.findLocation(actionDocument, replaceFind);
        if (match) {
          if (!action.edit) { action.edit = new vscode.WorkspaceEdit(); }
          let start = new vscode.Position(lineNumber, match.index);
          let newText = match[0].replace(findRegex, replaceText);
          action.edit.replace(actionDocument.uri, new vscode.Range(start, start.translate(0, match[0].length)), newText);
        }
      }
      let stopEdits = false, showContMessage = false;
      let needsContinueDeflt = action.getProperty(edit, 'condFind') ? true : undefined;
      let needsContinue = action.getProperty(edit, 'needsContinue', needsContinueDeflt);
      if (isBoolean(needsContinue)) {
        stopEdits = true;
        showContMessage = needsContinue;
      } else {
        if ((needsContinue === 'nextCondFail') && (editIdx+1 < edits.length)) {
          const nextCondFail = !this.condFind(action, edits[editIdx+1], actionDocument);
          if (nextCondFail) {
            stopEdits = true;
            showContMessage = true;
          }
        }
      }
      if (showContMessage) {
        vscode.window.showInformationMessage("Please apply action again to continue the edits.");
      }
      if (stopEdits) { break; }
    }
    return action;
  }
}

function isDiagnosticMatch(actionContext, testDiagnostics) {
  for (const diagnostic of actionContext.diagnostics) {
    for (const regex of testDiagnostics) {
      let match = diagnostic.message.match(regex);
      if (match) { return [match, regex]; }
    }
  }
  return [undefined, undefined];
}

function findLiteral(document, searchText) {
  if (searchText.endsWith('\n')) {
    searchText = searchText.substring(0, searchText.length-1);
  }
  return document.getText().indexOf(searchText);
}

/** @param {string} text  @param {string[]} diagMatch  @param {RegExp} diagRegex */
function evalFields(text, diagMatch, diagRegex) {
  if (diagMatch) {
    text = text.replace(/\{\{diag:(.*?)\}\}/g, (m, p1) => diagMatch[0].replace(diagRegex, p1));
    if ((diagMatch.length >= 2) && (diagMatch[1].length > 0)) {
      let diagLookup = gDiagLookup[diagMatch[1]];
      if (diagLookup) {
        text = text.replace(/\{\{diagLookup:(.*?)\}\}/g, (m, p1) => diagLookup[Number(p1)] ?? "Unknown");
      }
    }
  }
  return text.replace(/\{\{lookup:(.*?)\}\}/g, (m, p1) => gLookup[p1]);
}

class QuickFix {
  constructor(title, testDiagnostics, properties, action) {
    this.title = title;
    this.text = getProperty(properties, 'text');
    this.testDiagnostics = testDiagnostics;
    this.properties = properties;
    this.searchText = (action === gActionInsert) && this.text;
    if (getProperty(this.properties, 'file')) { this.searchText = false; }
    if (getProperty(this.properties, 'edits')) { this.searchText = false; }
  }
  provideCodeActions(document, range, actionContext) {
    let actions = [];
    let title = this.title;
    let diagMatch = undefined, diagRegex = undefined;
    if (this.testDiagnostics) {
      if (actionContext.diagnostics.length === 0) { return actions; } // not on a diagnostic
      [diagMatch, diagRegex] = isDiagnosticMatch(actionContext, this.testDiagnostics);
      if (!diagMatch) { return actions; }
      title = evalFields(title, diagMatch, diagRegex);
    }
    if (this.searchText) {
      let searchText = evalFields(this.text, diagMatch, diagRegex);
      if (findLiteral(document, searchText) >= 0) { return actions; }
    }

    let action = new CodeAction(title, vscode.CodeActionKind.QuickFix, diagMatch, diagRegex);
    action.properties = this.properties;
    actions.push(action);
    return actions;
  }
}

function getDiagnosticsProperty(properties) {
  let diagnostics = getProperty(properties, 'diagnostics');
  if (diagnostics) { diagnostics = diagnostics.map(v=>new RegExp(v)); }
  return diagnostics;
}

function readConfiguration(context) {
  gLookup = getConfig('lookup');
  gDiagLookup = getConfig('diagLookup');
  let actionsConfig = getConfig('actions');
  languageMap.forEach(provider => { provider.setActive(false); });
  for (const languagesKey in actionsConfig) {
    if (actionsConfig.hasOwnProperty(languagesKey)) {
      const actionsetObj = actionsConfig[languagesKey];
      let actionset = [];
      for (const title in actionsetObj) {
        if (actionsetObj.hasOwnProperty(title)) {
          const properties = actionsetObj[title];
          const diagnostics = getDiagnosticsProperty(properties);
          const action = getProperty(properties, 'action', gActionInsert);
          if (action === gActionInsert || action === gActionReplace) {
            actionset.push(new QuickFix(title, diagnostics, properties, action));
          }
        }
      }
      let languages = languagesKey.replace(/\[(.*?)\]/, '$1').split(',').map(v=>v.trim());
      for (const language of languages) {
        if (!languageMap.has(language)) {
          let provider = new LanguageCodeActionProvider(language);
          context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(language, provider, {
              providedCodeActionKinds: [ vscode.CodeActionKind.QuickFix ]
            }));
          languageMap.set(language, provider);
        }
        let provider = languageMap.get(language);
        provider.addActionset(actionset)
      }
    }
  }
}

function activate(context) {
  vscode.workspace.onDidChangeConfiguration( configChangeEvent => {
    if (configChangeEvent.affectsConfiguration(extensionShortName)) {
      readConfiguration(context);
    }
  }, null, context.subscriptions);
  readConfiguration(context);
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
