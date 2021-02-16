const vscode = require('vscode');

const extensionShortName = 'my-code-actions';

let languageMap = new Map();

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
}

function isDiagnosticMatch(actionContext, testDiagnostics) {
  for (const diagnostic of actionContext.diagnostics) {
    for (const regex of testDiagnostics) {
      if (regex.test(diagnostic.message)) { return true; }
    }
  }
  return false;
}

class QuickFix {
  constructor(title, newText, testDiagnostics) {
    this.title = title;
    this.newText = newText;
    this.testDiagnostics = testDiagnostics;
  }
  provideCodeActions(document, range, actionContext) {
    let actions = [];
    if (this.testDiagnostics) {
      if (actionContext.diagnostics.length === 0) { return actions; } // not on a diagnostic
      if (!isDiagnosticMatch(actionContext, this.testDiagnostics)) { return actions; }
    }
    let searchText = this.newText;
    let lastChar = this.newText.length-1;
    if (this.newText[lastChar] === '\n') {
      searchText = this.newText.substring(0, lastChar);
    }
    var docText = document.getText();
    if (docText.indexOf(searchText) >= 0) { return actions; }

    let action = new vscode.CodeAction(this.title, vscode.CodeActionKind.QuickFix);
    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(document.uri, new vscode.Position(0, 0), this.newText);
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
          let action = getProperty(properties, 'action', 'insert');
          if (action === 'insert') {
            let text = getProperty(properties, 'text', 'unknown');
            let diagnostics = getDiagnosticsProperty(properties);
            actionset.push(new QuickFix(title, text, diagnostics));
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
