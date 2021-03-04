const vscode = require('vscode');
const path = require('path');

const extensionShortName = 'my-code-actions';
const gActionInsert = 'insert';
const gActionReplace = 'replace';
const gActionStart = 'start';

let languageMap = new Map();

class CodeAction extends vscode.CodeAction {
  constructor(title, kind, text) {
    super(title, kind);
    this.text = text;
    this.properties = {};
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
  /** @param {CodeAction} action */
  resolveCodeAction(action, token) {
    if (!this.active) { return action; }
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return action; }
    let actionDocument = editor.document;
    let file = getProperty(action.properties, 'file');
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
    let docAction = getProperty(action.properties, 'action', gActionInsert)
    if (docAction === gActionInsert) {
      let insertWhere = getProperty(action.properties, 'where', gActionStart);
      let insertFind = getProperty(action.properties, 'insertFind');
      if (!insertFind) { insertWhere = gActionStart; }
      let insertText = action.text;
      if (!insertText) { return action; }
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
      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(actionDocument.uri, new vscode.Position(lineNumber, 0), insertText);
    }
    if (docAction === gActionReplace) {
      let replaceFind = getProperty(action.properties, 'replaceFind');
      let replaceText = action.text;
      if(!(replaceFind && replaceText)) { return action; }
      if (isString(replaceFind)) { replaceFind = [replaceFind]; }
      let lineNumber = 0;
      let match = undefined;
      let findRegex;
      for (const find of replaceFind) {
        findRegex = new RegExp(find);
        for (let n = lineNumber; n < actionDocument.lineCount; ++n, ++lineNumber) {
          match = actionDocument.lineAt(n).text.match(findRegex);
          if (match) { break; }
        }
      }
      if (match) {
        action.edit = new vscode.WorkspaceEdit();
        let start = new vscode.Position(lineNumber, match.index);
        let newText = match[0].replace(findRegex, replaceText);
        action.edit.replace(actionDocument.uri, new vscode.Range(start, start.translate(0, match[0].length)), newText);
      }
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

/** @param {string} text  @param {string[]} diagMatch  @param {RegExp} diagRegex */
function useDiagnosticsGroups(text, diagMatch, diagRegex) {
  return text.replace(/\{\{diag:(.*?)\}\}/g, (m, p1) => diagMatch[0].replace(diagRegex, p1));
}

class QuickFix {
  constructor(title, testDiagnostics, properties, action) {
    this.title = title;
    this.text = getProperty(properties, 'text');
    this.testDiagnostics = testDiagnostics;
    this.properties = properties;
    this.searchText = (action === gActionInsert);
    if (getProperty(this.properties, 'file')) { this.searchText = false; }
  }
  provideCodeActions(document, range, actionContext) {
    let actions = [];
    let title = this.title;
    let text = this.text;
    if (this.testDiagnostics) {
      if (actionContext.diagnostics.length === 0) { return actions; } // not on a diagnostic
      const [match, regex] = isDiagnosticMatch(actionContext, this.testDiagnostics);
      if (!match) { return actions; }
      title = useDiagnosticsGroups(title, match, regex);
      text  = useDiagnosticsGroups(text, match, regex);
    }
    if (this.searchText) {
      let searchText = text;
      if (searchText.endsWith('\n')) {
        searchText = searchText.substring(0, searchText.length-1);
      }
      var docText = document.getText();
      if (docText.indexOf(searchText) >= 0) { return actions; }
    }

    let action = new CodeAction(title, vscode.CodeActionKind.QuickFix, text);
    action.properties = this.properties;
    actions.push(action);
    return actions;
  }
}

function isString(obj) { return typeof obj === 'string'; }
function getConfig(section) { return vscode.workspace.getConfiguration(extensionShortName, null).get(section); }
function getProperty(obj, prop, deflt) { return obj.hasOwnProperty(prop) ? obj[prop] : deflt; };
function getDiagnosticsProperty(properties) {
  let diagnostics = getProperty(properties, 'diagnostics');
  if (diagnostics) { diagnostics = diagnostics.map(v=>new RegExp(v)); }
  return diagnostics;
}

function readConfiguration(context) {
  let config = getConfig('actions');
  languageMap.forEach(provider => { provider.setActive(false); });
  for (const languagesKey in config) {
    if (config.hasOwnProperty(languagesKey)) {
      const actionsetObj = config[languagesKey];
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
    if (configChangeEvent.affectsConfiguration(extensionShortName+'.actions')) {
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
