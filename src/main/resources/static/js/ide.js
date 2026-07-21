let editor = null;
let openTabs = [];
let activeFilePath = null;
let fileTreeData = null;
let currentFileContent = {};
let editorModel = null;
let isRunning = false;

const IDE = {
    init() {
        this.initMonaco();
        this.initUI();
        this.initEvents();
        this.loadInitialFile();
    },

    initMonaco() {
        require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {
            monaco.editor.defineTheme('intellij-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '8888a0', fontStyle: 'italic' },
                    { token: 'keyword', foreground: '8b5cf6' },
                    { token: 'string', foreground: '4ade80' },
                    { token: 'number', foreground: '3b82f6' },
                    { token: 'type', foreground: 'fcd34d' },
                    { token: 'identifier', foreground: 'e8e8f0' },
                    { token: 'delimiter', foreground: '8888a0' },
                ],
                colors: {
                    'editor.background': '#0a0a0f1a', // 0.1 opacity
                    'editor.foreground': '#e8e8f0',
                    'editor.lineHighlightBackground': '#ffffff0a', // very subtle highlight
                    'editor.selectionBackground': '#3b82f655',
                    'editor.inactiveSelectionBackground': '#3b82f633',
                    'editorCursor.foreground': '#6366f1',
                    'editorLineNumber.foreground': '#55556a',
                    'editorLineNumber.activeForeground': '#818cf8',
                    'editor.selectionHighlightBackground': '#3b82f633',
                    'editorBracketMatch.background': '#1a1a28',
                    'editorBracketMatch.border': '#6366f1',
                    'editorGutter.background': '#0a0a0f1a', // 0.1 opacity
                    'editorWidget.background': '#1a1a28',
                    'editorWidget.border': '#ffffff14',
                    'editorSuggestWidget.background': '#1a1a28',
                    'editorSuggestWidget.border': '#ffffff14',
                    'editorSuggestWidget.selectedBackground': '#6366f133',
                    'editorHoverWidget.background': '#1a1a28',
                    'editorHoverWidget.border': '#ffffff14',
                    'editorMarkerNavigation.background': '#1a1a28',
                    'editorError.foreground': '#ef4444',
                    'editorWarning.foreground': '#fcd34d',
                    'editorInfo.foreground': '#3b82f6',
                    'minimap.background': '#0a0a0f',
                }
            });
            monaco.languages.registerCompletionItemProvider('java', {
                provideCompletionItems: function(model, position) {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };
                    
                    const text = model.getValue();
                    let importInsertLine = 1;
                    const packageMatch = text.match(/^\s*package\s+[a-zA-Z0-9_.]+;/m);
                    if (packageMatch) {
                        importInsertLine = model.getPositionAt(text.indexOf(packageMatch[0]) + packageMatch[0].length).lineNumber + 1;
                    }

                    const suggestions = [
                        { label: 'sout', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'System.out.println(${1});', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Print to standard output', range: range },
                        { label: 'psvm', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'public static void main(String[] args) {\n\t${1}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'Main method', range: range },
                        { label: 'System', kind: monaco.languages.CompletionItemKind.Class, insertText: 'System', range: range },
                        { label: 'String', kind: monaco.languages.CompletionItemKind.Class, insertText: 'String', range: range },
                        { label: 'public', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'public', range: range },
                        { label: 'private', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'private', range: range },
                        { label: 'protected', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'protected', range: range },
                        { label: 'class', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'class', range: range },
                        { label: 'void', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'void', range: range },
                        { label: 'static', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'static', range: range },
                        { label: 'int', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'int', range: range },
                        { label: 'double', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'double', range: range },
                        { label: 'boolean', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'boolean', range: range },
                        { label: 'if', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if (${1:condition}) {\n\t${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range },
                        { label: 'fori', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:max}; ${1:i}++) {\n\t${3}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: 'for-loop', range: range },
                        { label: 'while', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'while (${1:condition}) {\n\t${2}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range },
                        { label: 'return', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'return', range: range },
                        { label: 'new', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'new', range: range },
                        { label: 'try', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'try {\n\t${1}\n} catch (${2:Exception} e) {\n\t${3:e.printStackTrace();}\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range: range }
                    ];

                    const commonClasses = {
                        'List': 'java.util.List',
                        'ArrayList': 'java.util.ArrayList',
                        'Map': 'java.util.Map',
                        'HashMap': 'java.util.HashMap',
                        'Set': 'java.util.Set',
                        'HashSet': 'java.util.HashSet',
                        'Scanner': 'java.util.Scanner',
                        'File': 'java.io.File',
                        'IOException': 'java.io.IOException',
                        'Arrays': 'java.util.Arrays',
                        'Collections': 'java.util.Collections',
                        'Random': 'java.util.Random'
                    };

                    for (const [className, fullPackage] of Object.entries(commonClasses)) {
                        const importStatement = `import ${fullPackage};\n`;
                        const hasImport = text.includes(`import ${fullPackage};`);
                        
                        const item = {
                            label: className,
                            kind: monaco.languages.CompletionItemKind.Class,
                            insertText: className,
                            detail: fullPackage,
                            range: range
                        };
                        
                        if (!hasImport) {
                            item.additionalTextEdits = [{
                                range: new monaco.Range(importInsertLine, 1, importInsertLine, 1),
                                text: importStatement
                            }];
                        }
                        suggestions.push(item);
                    }

                    return { suggestions: suggestions };
                }
            });

            editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                value: '',
                language: 'java',
                theme: 'intellij-dark',
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace",
                lineNumbers: 'on',
                minimap: { enabled: true, scale: 1 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                wordWrap: 'off',
                bracketPairColorization: { enabled: true },
                renderWhitespace: 'selection',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                padding: { top: 8 },
                folding: true,
                foldingHighlight: true,
                foldingStrategy: 'indentation',
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                parameterHints: { enabled: true },
                formatOnPaste: true,
                semanticHighlighting: { enabled: true },
                'semanticHighlighting.enabled': true,
                selectionClipboard: false,
                lightbulb: { enabled: true },
                codeLens: true,
                inlayHints: { enabled: 'on' },
                guides: { indentation: true, bracketPairs: true },
                hover: { enabled: true, delay: 300 },
                suggest: { snippetsPreventQuickSuggestions: false },
                multiCursorModifier: 'ctrlCmd',
                copyWithSyntaxHighlighting: true,
                mouseWheelZoom: true,
                dragAndDrop: true,
                emptySelectionClipboard: false,
            });

            editor.addAction({
                id: 'ide-run',
                label: 'Run Java',
                keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F10],
                run: () => IDE.runProject()
            });

            editor.addAction({
                id: 'ide-save',
                label: 'Save',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
                run: () => IDE.saveFile()
            });

            editor.addAction({
                id: 'ide-format',
                label: 'Format Code',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyL],
                run: () => IDE.formatCode()
            });

            editor.onDidChangeCursorPosition((e) => {
                document.getElementById('status-position').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
                document.getElementById('statusbar-ln').textContent = `Ln ${e.position.lineNumber}`;
                document.getElementById('statusbar-col').textContent = `Col ${e.position.column}`;
            });

            editor.onDidChangeModelContent(() => {
                const currentPath = activeFilePath;
                if (currentPath && editorModel) {
                    currentFileContent[currentPath] = editor.getValue();
                }
                const tab = openTabs.find(t => t.path === activeFilePath);
                if (tab && !tab.modified) {
                    tab.modified = true;
                    IDE.updateTabUI(tab);
                }
            });

            monaco.editor.registerCompletionProvider('java', {
                provideCompletionItems: (model, position) => {
                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };

                    const suggestions = [
                        { label: 'public', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'public', range },
                        { label: 'private', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'private', range },
                        { label: 'protected', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'protected', range },
                        { label: 'class', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'class', range },
                        { label: 'static', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'static', range },
                        { label: 'void', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'void', range },
                        { label: 'int', kind: monaco.languages.CompletionItemKind.Type, insertText: 'int', range },
                        { label: 'String', kind: monaco.languages.CompletionItemKind.Type, insertText: 'String', range },
                        { label: 'boolean', kind: monaco.languages.CompletionItemKind.Type, insertText: 'boolean', range },
                        { label: 'double', kind: monaco.languages.CompletionItemKind.Type, insertText: 'double', range },
                        { label: 'float', kind: monaco.languages.CompletionItemKind.Type, insertText: 'float', range },
                        { label: 'long', kind: monaco.languages.CompletionItemKind.Type, insertText: 'long', range },
                        { label: 'char', kind: monaco.languages.CompletionItemKind.Type, insertText: 'char', range },
                        { label: 'if', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'if ($1) {\n    $0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'else', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'else {\n    $0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'for', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for (int $1 = 0; $1 < $2; $1$3++) {\n    $0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while ($1) {\n    $0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'do', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'do {\n    $0\n} while ($1);', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'switch', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'switch ($1) {\n    case $2:\n        $0\n        break;\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'try', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'try {\n    $0\n} catch ($1 $2) {\n    $3\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'catch', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'catch ($1 $2) {\n    $0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'finally', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'finally {\n    $0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'return', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'return ', range },
                        { label: 'new', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'new ', range },
                        { label: 'this', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'this', range },
                        { label: 'super', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'super', range },
                        { label: 'null', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'null', range },
                        { label: 'true', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'true', range },
                        { label: 'false', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'false', range },
                        { label: 'System.out.println', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'System.out.println($0);', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'System.out.print', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'System.out.print($0);', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'public static void main', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'public static void main(String[] args) {\n    $0\n}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'private static final', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'private static final $1 $2 = $0;', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'ArrayList', kind: monaco.languages.CompletionItemKind.Class, insertText: 'ArrayList<$1>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'List', kind: monaco.languages.CompletionItemKind.Interface, insertText: 'List<$1>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'HashMap', kind: monaco.languages.CompletionItemKind.Class, insertText: 'HashMap<$1, $2>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'Map', kind: monaco.languages.CompletionItemKind.Interface, insertText: 'Map<$1, $2>', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: 'Scanner', kind: monaco.languages.CompletionItemKind.Class, insertText: 'new Scanner(System.in)', range },
                        { label: 'println', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'System.out.println($0);', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range },
                        { label: '@Override', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '@Override\n', range },
                    ];

                    return { suggestions };
                }
            });

            IDE.loadInitialFile();
        });
    },

    initUI() {
        this.renderFileTree(fileTreeData);
    },

    initEvents() {
        document.querySelectorAll('.menu-item[data-menu]').forEach(item => {
            item.addEventListener('click', (e) => {
                const menu = item.dataset.menu;
                IDE.toggleDropdown(`dropdown-${menu}`, item);
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.menu-item') && !e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
            }
        });

        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = item.dataset.action;
                if (action) IDE.handleAction(action);
                document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
            });
        });

        document.getElementById('toolbar-run').addEventListener('click', () => IDE.runProject());
        document.getElementById('toolbar-debug').addEventListener('click', () => IDE.runProject());
        document.getElementById('toolbar-stop').addEventListener('click', () => {});
        document.getElementById('toolbar-build').addEventListener('click', () => IDE.runProject());
        document.getElementById('toolbar-save').addEventListener('click', () => IDE.saveFile());
        document.getElementById('toolbar-new').addEventListener('click', () => IDE.showModal('modal-new-file'));
        document.getElementById('toolbar-undo').addEventListener('click', () => editor?.trigger('keyboard', 'undo'));
        document.getElementById('toolbar-redo').addEventListener('click', () => editor?.trigger('keyboard', 'redo'));
        document.getElementById('toolbar-format').addEventListener('click', () => IDE.formatCode());
        document.getElementById('toolbar-comment').addEventListener('click', () => editor?.trigger('keyboard', 'editor.action.commentLine'));

        document.getElementById('save-btn').addEventListener('click', () => IDE.saveFile());
        document.getElementById('undo-btn').addEventListener('click', () => editor?.trigger('keyboard', 'undo'));
        document.getElementById('redo-btn').addEventListener('click', () => editor?.trigger('keyboard', 'redo'));

        document.getElementById('new-file-btn').addEventListener('click', () => IDE.showModal('modal-new-file'));
        document.getElementById('new-dir-btn').addEventListener('click', () => IDE.showModal('modal-new-dir'));
        document.getElementById('close-project-btn').addEventListener('click', () => {
            if (document.getElementById('project-toolwindow').style.display !== 'none') {
                document.getElementById('project-toolwindow').style.display = 'none';
            }
        });

        document.getElementById('console-clear').addEventListener('click', () => {
            document.getElementById('console-output').innerHTML = '';
        });
        document.getElementById('console-scroll').addEventListener('click', () => {
            const el = document.getElementById('console-output');
            el.scrollTop = el.scrollHeight;
        });

        document.querySelectorAll('.bottom-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const panel = tab.dataset.panel;
                document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.bottom-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`panel-${panel}`).classList.add('active');
            });
        });

        document.querySelectorAll('.modal-close').forEach(el => {
            el.addEventListener('click', () => IDE.hideModals());
        });

        document.getElementById('modal-create-file').addEventListener('click', () => IDE.createNewFile());
        document.getElementById('modal-create-dir').addEventListener('click', () => IDE.createNewDir());

        document.getElementById('welcome-new').addEventListener('click', () => IDE.showModal('modal-new-file'));
        document.getElementById('welcome-open').addEventListener('click', () => {
            document.getElementById('project-toolwindow').style.display = '';
        });

        document.getElementById('close-right-panel').addEventListener('click', () => {
            document.getElementById('right-toolwindow').style.display = 'none';
        });
        
        const closeMusic = document.getElementById('close-music-panel');
        if (closeMusic) {
            closeMusic.addEventListener('click', () => {
                document.getElementById('music-toolwindow').style.display = 'none';
            });
        }

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                IDE.saveFile();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                IDE.showModal('modal-new-file');
            }
            if (e.key === 'F5' || (e.shiftKey && e.key === 'F10')) {
                e.preventDefault();
                IDE.runProject();
            }
        });

        const newFileName = document.getElementById('new-file-name');
        if (newFileName) {
            newFileName.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') IDE.createNewFile();
            });
        }
    },

    toggleDropdown(id, menuItem) {
        const dropdown = document.getElementById(id);
        const isActive = dropdown.classList.contains('active');
        document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('active'));
        if (!isActive) {
            const rect = menuItem.getBoundingClientRect();
            dropdown.style.left = rect.left + 'px';
            dropdown.style.top = rect.bottom + 'px';
            dropdown.classList.add('active');
        }
    },

    handleAction(action) {
        switch(action) {
            case 'new-file': this.showModal('modal-new-file'); break;
            case 'new-dir': this.showModal('modal-new-dir'); break;
            case 'save': this.saveFile(); break;
            case 'save-all': this.saveFile(); break;
            case 'delete': this.deleteCurrentFile(); break;
            case 'close': this.closeCurrentTab(); break;
            case 'undo': editor?.trigger('keyboard', 'undo'); break;
            case 'redo': editor?.trigger('keyboard', 'redo'); break;
            case 'cut': editor?.trigger('keyboard', 'editor.action.clipboardCutAction'); break;
            case 'copy': editor?.trigger('keyboard', 'editor.action.clipboardCopyAction'); break;
            case 'paste': editor?.trigger('keyboard', 'editor.action.clipboardPasteAction'); break;
            case 'find': editor?.trigger('keyboard', 'actions.find'); break;
            case 'replace': editor?.trigger('keyboard', 'editor.action.startFindReplaceAction'); break;
            case 'run': this.runProject(); break;
            case 'debug': this.runProject(); break;
            case 'stop': break;
            case 'format': this.formatCode(); break;
            case 'comment': editor?.trigger('keyboard', 'editor.action.commentLine'); break;
            case 'uncomment': editor?.trigger('keyboard', 'editor.action.commentLine'); break;
            case 'toggle-music':
                const mw = document.getElementById('music-toolwindow');
                mw.style.display = mw.style.display === 'none' ? 'flex' : 'none';
                break;
            case 'toggle-project': 
                const pw = document.getElementById('project-toolwindow');
                pw.style.display = pw.style.display === 'none' ? '' : 'none';
                break;
            case 'toggle-console':
                const bp = document.getElementById('bottom-panel');
                bp.style.display = bp.style.display === 'none' ? '' : 'none';
                break;
            case 'fullscreen':
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
                break;
            case 'terminal': this.showToast('Terminal coming soon', 'info'); break;
            case 'tasks': this.showToast('Tasks coming soon', 'info'); break;
            case 'about': this.showModal('modal-about'); break;
            case 'shortcuts': this.showModal('modal-shortcuts'); break;
        }
    },

    showModal(id) {
        document.getElementById('modal-overlay').style.display = 'flex';
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        document.getElementById(id).style.display = 'block';
    },

    hideModals() {
        document.getElementById('modal-overlay').style.display = 'none';
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    },

    loadInitialFile() {
        const treeEl = document.getElementById('project-tree');
        if (!treeEl) return;
        const initialPath = treeEl.dataset.initialPath;
        if (initialPath) {
            this.openFile(initialPath);
        }
    },

    renderFileTree(treeData) {
        if (!treeData) {
            this.fetchTree();
            return;
        }
        const container = document.getElementById('project-tree');
        if (!container) return;
        container.innerHTML = '';
        const ul = this.buildTreeDOM(treeData, '');
        container.appendChild(ul);
    },

    fetchTree() {
        fetch('/api/tree')
            .then(r => r.json())
            .then(data => {
                fileTreeData = data;
                this.renderFileTree(data);
                if (data.children && data.children.length > 0) {
                    this.findAndOpenFirstJava(data);
                }
            })
            .catch(err => console.error('Failed to load file tree:', err));
    },

    findAndOpenFirstJava(node) {
        if (!node.isDirectory && node.name.endsWith('.java') && node.content) {
            this.openFile(node.path, node.content, true);
            return true;
        }
        if (node.children) {
            for (const child of node.children) {
                if (this.findAndOpenFirstJava(child)) return true;
            }
        }
        return false;
    },

    getMaterialIcon(name, isDir) {
        name = name.toLowerCase();
        if (isDir) {
            if (name === 'src' || name === 'source') return '<i class="fas fa-folder" style="color: #4CAF50;"></i>';
            if (name === 'test' || name === 'tests') return '<i class="fas fa-folder" style="color: #8BC34A;"></i>';
            if (name === 'target' || name === 'build' || name === 'out') return '<i class="fas fa-folder" style="color: #FF9800;"></i>';
            if (name === 'resources' || name === 'assets') return '<i class="fas fa-folder" style="color: #00BCD4;"></i>';
            if (name === 'music' || name === 'audio') return '<i class="fas fa-folder" style="color: #E91E63;"></i>';
            if (name.startsWith('.')) return '<i class="fas fa-folder" style="color: #78909C;"></i>';
            return '<i class="fas fa-folder" style="color: #FFA000;"></i>';
        } else {
            if (name.endsWith('.java')) return '<i class="fab fa-java" style="color: #F44336;"></i>';
            if (name.endsWith('.xml')) return '<i class="fas fa-code" style="color: #FF9800;"></i>';
            if (name.endsWith('.properties') || name.endsWith('.conf') || name.endsWith('.yml') || name.endsWith('.yaml')) return '<i class="fas fa-sliders-h" style="color: #607D8B;"></i>';
            if (name.endsWith('.md')) return '<i class="fab fa-markdown" style="color: #2196F3;"></i>';
            if (name.endsWith('.json')) return '<i class="fas fa-brackets-curly" style="color: #FFC107;"></i>'; // Or fa-code
            if (name.endsWith('.html') || name.endsWith('.htm')) return '<i class="fab fa-html5" style="color: #E65100;"></i>';
            if (name.endsWith('.css')) return '<i class="fab fa-css3-alt" style="color: #0277BD;"></i>';
            if (name.endsWith('.js')) return '<i class="fab fa-js" style="color: #FFD600;"></i>';
            if (name.endsWith('.txt')) return '<i class="fas fa-file-alt" style="color: #9E9E9E;"></i>';
            if (name.endsWith('.mp3') || name.endsWith('.wav')) return '<i class="fas fa-file-audio" style="color: #E91E63;"></i>';
            if (name.endsWith('.jar') || name.endsWith('.zip')) return '<i class="fas fa-file-archive" style="color: #F44336;"></i>';
            return '<i class="fas fa-file" style="color: #9E9E9E;"></i>';
        }
    },

    buildTreeDOM(node, parentPath) {
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.padding = '0';
        ul.style.margin = '0';

        if (!node.children || node.children.length === 0) {
            if (!node.isDirectory) {
                const li = this.createFileNode(node, parentPath);
                ul.appendChild(li);
            }
            return ul;
        }

        node.children.forEach(child => {
            const li = document.createElement('li');
            li.style.listStyle = 'none';

            if (child.isDirectory) {
                const header = document.createElement('div');
                header.className = 'tree-node';
                header.dataset.path = child.path;

                const arrow = document.createElement('span');
                arrow.className = 'tree-arrow expanded';
                arrow.innerHTML = '<i class="fas fa-chevron-right"></i>';
                header.appendChild(arrow);

                const icon = document.createElement('span');
                icon.className = 'tree-icon';
                icon.innerHTML = this.getMaterialIcon(child.name, true);
                header.appendChild(icon);

                const name = document.createElement('span');
                name.className = 'tree-name';
                name.textContent = child.name;
                header.appendChild(name);

                header.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const childContainer = li.querySelector('.tree-children');
                    if (childContainer) {
                        childContainer.style.display = childContainer.style.display === 'none' ? '' : 'none';
                        arrow.classList.toggle('expanded');
                    }
                });

                header.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showContextMenu(e.clientX, e.clientY, child.path, true);
                });

                li.appendChild(header);

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'tree-children';
                const childTree = this.buildTreeDOM(child, child.path);
                childrenContainer.appendChild(childTree);
                li.appendChild(childrenContainer);
            } else {
                const nodeEl = this.createFileNode(child, parentPath);
                li.appendChild(nodeEl);
            }

            ul.appendChild(li);
        });

        return ul;
    },

    createFileNode(node, parentPath) {
        const div = document.createElement('div');
        div.className = 'tree-node';
        div.dataset.path = node.path;

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.innerHTML = this.getMaterialIcon(node.name, false);
        div.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        div.appendChild(name);

        div.addEventListener('click', () => {
            this.openFile(node.path);
        });

        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showContextMenu(e.clientX, e.clientY, node.path, false);
        });

        return div;
    },

    showContextMenu(x, y, path, isDir) {
        const existing = document.querySelector('.tree-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'tree-context-menu active';

        if (!isDir) {
            menu.innerHTML = `
                <div class="dropdown-item" data-action="ctx-open"><i class="fas fa-file"></i> Open</div>
                <div class="dropdown-separator"></div>
                <div class="dropdown-item" data-action="ctx-rename"><i class="fas fa-pencil-alt"></i> Rename...</div>
                <div class="dropdown-item" data-action="ctx-delete" style="color:var(--red-bright);"><i class="fas fa-trash"></i> Delete</div>
            `;
        } else {
            menu.innerHTML = `
                <div class="dropdown-item" data-action="ctx-new-file"><i class="fas fa-file"></i> New File</div>
                <div class="dropdown-item" data-action="ctx-new-dir"><i class="fas fa-folder"></i> New Directory</div>
                <div class="dropdown-separator"></div>
                <div class="dropdown-item" data-action="ctx-delete" style="color:var(--red-bright);"><i class="fas fa-trash"></i> Delete</div>
            `;
        }

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        document.body.appendChild(menu);

        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleContextAction(action, path, isDir);
                menu.remove();
            });
        });

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    },

    handleContextAction(action, path, isDir) {
        switch(action) {
            case 'ctx-open': this.openFile(path); break;
            case 'ctx-new-file': 
                document.getElementById('new-file-dir').value = path;
                this.showModal('modal-new-file');
                break;
            case 'ctx-new-dir':
                document.getElementById('new-dir-parent').value = path;
                this.showModal('modal-new-dir');
                break;
            case 'ctx-delete':
                if (confirm(`Delete ${isDir ? 'directory' : 'file'} "${path}"?`)) {
                    this.deletePath(path);
                }
                break;
            case 'ctx-rename':
                const newName = prompt('New name:', path.split('/').pop());
                if (newName) {
                    this.showToast('Rename coming soon', 'info');
                }
                break;
        }
    },

    openFile(path, content, skipFetch) {
        if (!path) return;

        const existingTab = openTabs.find(t => t.path === path);
        if (existingTab) {
            this.activateTab(existingTab);
            return;
        }

        if (content) {
            this.addTab(path, content);
            return;
        }

        fetch(`/api/file?path=${encodeURIComponent(path)}`)
            .then(r => r.json())
            .then(data => {
                if (data.content !== undefined) {
                    this.addTab(path, data.content);
                } else if (data.error) {
                    this.showToast(`Error: ${data.error}`, 'error');
                }
            })
            .catch(err => this.showToast('Failed to open file', 'error'));
    },

    addTab(path, content) {
        const name = path.split('/').pop();
        const tab = { path, name, content, modified: false };

        openTabs.push(tab);
        currentFileContent[path] = content;

        this.renderTabs();
        this.activateTab(tab);
    },

    renderTabs() {
        const container = document.getElementById('tabs-container');
        if (!container) return;
        container.innerHTML = '';

        openTabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = 'editor-tab' + (tab.path === activeFilePath ? ' active' : '');
            tabEl.dataset.path = tab.path;

            tabEl.innerHTML = `
                <span class="tab-icon"><i class="fab fa-java"></i></span>
                <span class="tab-name">${tab.name}</span>
                <span class="tab-close"><i class="fas fa-times"></i></span>
            `;

            tabEl.addEventListener('click', (e) => {
                if (e.target.closest('.tab-close')) {
                    this.closeTab(tab.path);
                } else {
                    this.activateTab(tab);
                }
            });

            container.appendChild(tabEl);
        });
    },

    updateTabUI(tab) {
        const container = document.getElementById('tabs-container');
        const existing = container?.querySelector(`[data-path="${tab.path}"]`);
        if (existing) {
            const nameEl = existing.querySelector('.tab-name');
            if (nameEl) {
                nameEl.textContent = tab.modified ? tab.name + ' ●' : tab.name;
            }
        }
    },

    activateTab(tab) {
        if (!tab) return;
        activeFilePath = tab.path;

        document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
        const tabEl = document.querySelector(`[data-path="${tab.path}"]`);
        if (tabEl) tabEl.classList.add('active');

        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('monaco-editor').style.display = '';

        const content = currentFileContent[tab.path] || tab.content || '';

        if (editor) {
            const model = editor.getModel();
            const uri = monaco.Uri.parse(`file:///${tab.path}`);
            let newModel = monaco.editor.getModel(uri);
            if (!newModel) {
                newModel = monaco.editor.createModel(content, 'java', uri);
            } else if (newModel.getValue() !== content) {
                newModel.setValue(content);
            }
            editor.setModel(newModel);
            editorModel = newModel;
        }

        document.getElementById('breadcrumb-file').textContent = tab.name;

        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
        const treeNode = document.querySelector(`.tree-node[data-path="${tab.path}"]`);
        if (treeNode) treeNode.classList.add('active');
    },

    closeTab(path) {
        const idx = openTabs.findIndex(t => t.path === path);
        if (idx === -1) return;

        const tab = openTabs[idx];
        if (tab.modified) {
            if (!confirm(`"${tab.name}" has unsaved changes. Save before closing?`)) {
                return;
            }
            this.saveFile();
        }

        openTabs.splice(idx, 1);
        delete currentFileContent[path];

        if (editorModel) {
            const uri = editorModel.uri;
            if (uri && uri.path === path) {
                editorModel.dispose();
                editorModel = null;
            }
        }

        if (openTabs.length > 0) {
            const newIdx = Math.min(idx, openTabs.length - 1);
            this.activateTab(openTabs[newIdx]);
        } else {
            activeFilePath = null;
            if (editor) editor.setValue('');
            document.getElementById('welcome-screen').style.display = '';
            document.getElementById('monaco-editor').style.display = 'none';
        }

        this.renderTabs();
    },

    closeCurrentTab() {
        if (activeFilePath) this.closeTab(activeFilePath);
    },

    saveFile() {
        if (!activeFilePath) {
            this.showToast('No file open to save', 'warning');
            return;
        }

        const content = editor ? editor.getValue() : '';
        const path = activeFilePath;

        currentFileContent[path] = content;

        fetch('/api/file/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                const tab = openTabs.find(t => t.path === path);
                if (tab) {
                    tab.modified = false;
                    this.updateTabUI(tab);
                }
                this.showToast('File saved', 'success');
            } else {
                this.showToast('Save failed: ' + (data.error || 'unknown error'), 'error');
            }
        })
        .catch(() => this.showToast('Network error saving file', 'error'));
    },

    createNewFile() {
        const name = document.getElementById('new-file-name').value.trim();
        const dir = document.getElementById('new-file-dir').value.trim();
        if (!name) { this.showToast('Please enter a file name', 'warning'); return; }
        if (!name.endsWith('.java')) {
            document.getElementById('new-file-name').value = name + '.java';
        }

        const path = dir ? `${dir}/${name.endsWith('.java') ? name : name + '.java'}` : name.endsWith('.java') ? name : name + '.java';

        fetch('/api/file/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        })
        .then(r => r.json())
        .then(data => {
            if (data.path) {
                this.hideModals();
                this.showToast('File created', 'success');
                this.openFile(data.path, data.content);
                this.fetchTree();
            }
        })
        .catch(() => this.showToast('Failed to create file', 'error'));
    },

    createNewDir() {
        const name = document.getElementById('new-dir-name').value.trim();
        const parent = document.getElementById('new-dir-parent').value.trim();
        if (!name) { this.showToast('Please enter a directory name', 'warning'); return; }

        const path = parent ? `${parent}/${name}` : name;

        fetch('/api/directory/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        })
        .then(r => r.json())
        .then(data => {
            if (data.path) {
                this.hideModals();
                this.showToast('Directory created', 'success');
                this.fetchTree();
            }
        })
        .catch(() => this.showToast('Failed to create directory', 'error'));
    },

    deletePath(path) {
        fetch('/api/file/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                this.showToast('Deleted successfully', 'success');
                this.closeTab(path); // Close if open
                this.fetchTree();
            } else {
                this.showToast('Failed to delete: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(() => this.showToast('Network error while deleting', 'error'));
    },

    deleteCurrentFile() {
        if (!activeFilePath) {
            this.showToast('No file open to delete', 'warning');
            return;
        }
        if (confirm(`Delete file "${activeFilePath}"?`)) {
            this.deletePath(activeFilePath);
        }
    },


    runProject() {
        if (isRunning) {
            this.showToast('Already running', 'warning');
            return;
        }

        if (activeFilePath) {
            this.saveFile();
        }

        isRunning = true;
        document.getElementById('toolbar-run').disabled = true;
        document.getElementById('toolbar-run').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
        document.getElementById('statusbar-run-status').innerHTML = '<i class="fas fa-circle" style="color:var(--yellow);font-size:8px;"></i> Running...';

        this.appendConsole('Running Java project...', 'console-info');
        this.showBottomPanel('console');

        const stdinData = document.getElementById('console-input') ? document.getElementById('console-input').value : '';

        fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                activeFilePath: activeFilePath,
                stdin: stdinData
            })
        })
        .then(r => r.json())
        .then(result => {
            this.handleRunResult(result);
        })
        .catch(err => {
            this.appendConsole(`Error: ${err.message}`, 'console-error');
            this.showToast('Run failed', 'error');
        })
        .finally(() => {
            isRunning = false;
            document.getElementById('toolbar-run').disabled = false;
            document.getElementById('toolbar-run').innerHTML = '<i class="fas fa-play"></i> Run';
            document.getElementById('statusbar-run-status').innerHTML = '<i class="fas fa-circle" style="color:var(--green);font-size:8px;"></i> Ready';
        });
    },

    handleRunResult(result) {
        if (result.success) {
            this.appendConsole('Execution completed successfully', 'console-success');
            this.appendConsole(result.executionTime || '', 'console-timestamp');
            this.appendConsole('');

            if (result.output) {
                const lines = result.output.split('\n');
                lines.forEach(line => {
                    if (line.trim()) this.appendConsole(line, 'console-output');
                });
            }

            document.getElementById('build-output').textContent = 'Build successful.\n' + (result.executionTime || '');
            this.showToast('Execution completed', 'success');
        } else {
            this.appendConsole('Compilation failed', 'console-error');
            if (result.errors) {
                const lines = result.errors.split('\n');
                lines.forEach(line => {
                    if (line.trim()) this.appendConsole(line, 'console-error');
                });
            }
            if (result.errorDetails && result.errorDetails.length > 0) {
                this.showProblems(result.errorDetails);
            }
            this.showToast('Compilation failed', 'error');
            document.getElementById('build-output').textContent = 'Build failed.\n' + (result.errors || '');
        }
    },

    showProblems(errors) {
        const list = document.getElementById('problems-list');
        const count = document.getElementById('problems-count');
        const badge = document.getElementById('problems-badge');

        list.innerHTML = '';
        const errCount = errors.filter(e => e.type === 'error').length;
        const warnCount = errors.filter(e => e.type === 'warning').length;

        count.textContent = `${errCount} errors, ${warnCount} warnings`;
        badge.textContent = errCount + warnCount;

        errors.forEach(err => {
            const div = document.createElement('div');
            div.className = 'problem-item';
            const type = err.type === 'error' ? 'error' : 'warning';
            div.innerHTML = `
                <span class="problem-icon ${type}"><i class="fas fa-${type === 'error' ? 'times-circle' : 'exclamation-triangle'}"></i></span>
                <span class="problem-msg">${err.message}</span>
                <span class="problem-loc">Line ${err.line}${err.column ? ', Col ' + err.column : ''}</span>
            `;
            div.addEventListener('click', () => {
                if (editor) {
                    editor.revealLineInCenter(err.line);
                    editor.setPosition({ lineNumber: err.line, column: err.column || 1 });
                    editor.focus();
                }
                this.showBottomPanel('problems');
            });
            list.appendChild(div);
        });

        this.showBottomPanel('problems');
    },

    formatCode() {
        if (!editor) return;
        editor.getAction('editor.action.formatDocument')?.run();
        this.showToast('Code formatted', 'success');
    },

    appendConsole(text, className) {
        const el = document.getElementById('console-output');
        const line = document.createElement('span');
        line.className = className || '';
        line.textContent = text;
        el.appendChild(line);
        el.appendChild(document.createElement('br'));
        el.scrollTop = el.scrollHeight;
    },

    showBottomPanel(panel) {
        document.querySelectorAll('.bottom-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.panel === panel);
        });
        document.querySelectorAll('.bottom-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${panel}`).classList.add('active');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 200);
        }, 3000);
    },

    fetchTree() {
        const treeData = document.getElementById('project-tree').dataset.treeInitial;
        if (treeData) {
            try {
                fileTreeData = JSON.parse(treeData);
                this.renderFileTree(fileTreeData);
            } catch(e) {}
        }

        fetch('/api/tree')
            .then(r => r.json())
            .then(data => {
                fileTreeData = data;
                this.renderFileTree(data);
            })
            .catch(() => {});
    }
};

const WallpaperManager = {
    wallpapers: [],
    currentIndex: -1,
    autoChangeInterval: null,
    videoEl: null,
    nameEl: null,
    isPlaying: true,

    init() {
        this.videoEl = document.getElementById('live-wallpaper');
        this.nameEl = document.getElementById('wp-name');
        if (!this.videoEl) return;

        this.bindEvents();
        this.fetchWallpapers();
    },

    bindEvents() {
        document.getElementById('wp-prev')?.addEventListener('click', () => {
            this.stopAutoChange();
            this.prev();
        });
        document.getElementById('wp-next')?.addEventListener('click', () => {
            this.stopAutoChange();
            this.next();
        });
        document.getElementById('wp-playpause')?.addEventListener('click', (e) => {
            if (this.autoChangeInterval) {
                this.stopAutoChange();
                e.target.classList.replace('fa-pause', 'fa-play');
                e.target.title = "Resume Auto-change";
                this.isPlaying = false;
            } else {
                this.startAutoChange();
                e.target.classList.replace('fa-play', 'fa-pause');
                e.target.title = "Pause Auto-change";
                this.isPlaying = true;
            }
        });
    },

    fetchWallpapers() {
        fetch('/api/wallpaper/list')
            .then(res => res.json())
            .then(data => {
                this.wallpapers = data;
                if (this.wallpapers.length > 0) {
                    this.setWallpaper(0);
                    this.startAutoChange();
                } else {
                    if (this.nameEl) this.nameEl.textContent = 'No wallpapers found';
                }
            })
            .catch(err => {
                console.error("Failed to fetch wallpapers", err);
                if (this.nameEl) this.nameEl.textContent = 'Error';
            });
    },

    setWallpaper(index) {
        if (this.wallpapers.length === 0) return;
        this.currentIndex = index;
        const wp = this.wallpapers[this.currentIndex];
        this.videoEl.src = `/wallpaper/${encodeURIComponent(wp)}`;
        if (this.nameEl) this.nameEl.textContent = wp;
    },

    next() {
        if (this.wallpapers.length === 0) return;
        let nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.wallpapers.length) nextIndex = 0;
        this.setWallpaper(nextIndex);
    },

    prev() {
        if (this.wallpapers.length === 0) return;
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) prevIndex = this.wallpapers.length - 1;
        this.setWallpaper(prevIndex);
    },

    startAutoChange() {
        this.stopAutoChange(); // ensure no duplicates
        // Change every 5 minutes (300,000 ms)
        this.autoChangeInterval = setInterval(() => {
            this.next();
        }, 5 * 60 * 1000);
    },

    stopAutoChange() {
        if (this.autoChangeInterval) {
            clearInterval(this.autoChangeInterval);
            this.autoChangeInterval = null;
        }
    }
};

const MusicPlayer = {
    audioContext: null,
    source: null,
    bassFilter: null,
    trebleFilter: null,
    analyser: null,
    canvasCtx: null,
    animationId: null,
    audioEl: null,
    playlist: [],
    currentIndex: -1,
    isPlaying: false,

    init() {
        this.audioEl = document.getElementById('music-audio');
        if (!this.audioEl) return;

        this.bindEvents();
        this.fetchPlaylist();
    },

    initAudioContext() {
        if (this.audioContext) return; // Already initialized
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Create source
            this.source = this.audioContext.createMediaElementSource(this.audioEl);
            
            // Create Bass Filter
            this.bassFilter = this.audioContext.createBiquadFilter();
            this.bassFilter.type = 'lowshelf';
            this.bassFilter.frequency.value = 200;
            this.bassFilter.gain.value = document.getElementById('music-bass').value;

            // Create Treble Filter
            this.trebleFilter = this.audioContext.createBiquadFilter();
            this.trebleFilter.type = 'highshelf';
            this.trebleFilter.frequency.value = 3000;
            this.trebleFilter.gain.value = document.getElementById('music-treble').value;

            // Create Analyser for visualizer
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            // Connect nodes
            this.source.connect(this.bassFilter);
            this.bassFilter.connect(this.trebleFilter);
            this.trebleFilter.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            // Setup Canvas for visualizer
            const canvas = document.getElementById('music-visualizer');
            if (canvas) {
                this.canvasCtx = canvas.getContext('2d');
                this.drawVisualizer();
            }
            
            // Set initial volume
            this.audioEl.volume = document.getElementById('music-vol').value;
        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    },

    bindEvents() {
        document.getElementById('music-play').addEventListener('click', () => this.togglePlay());
        document.getElementById('music-prev').addEventListener('click', () => this.playPrev());
        document.getElementById('music-next').addEventListener('click', () => this.playNext());

        document.getElementById('music-vol').addEventListener('input', (e) => {
            this.audioEl.volume = e.target.value;
        });

        document.getElementById('music-bass').addEventListener('input', (e) => {
            if (this.bassFilter) this.bassFilter.gain.value = e.target.value;
        });

        document.getElementById('music-treble').addEventListener('input', (e) => {
            if (this.trebleFilter) this.trebleFilter.gain.value = e.target.value;
        });

        document.getElementById('music-seek').addEventListener('input', (e) => {
            if (this.audioEl.duration) {
                this.audioEl.currentTime = (e.target.value / 100) * this.audioEl.duration;
            }
        });

        this.audioEl.addEventListener('timeupdate', () => {
            if (this.audioEl.duration) {
                const progress = (this.audioEl.currentTime / this.audioEl.duration) * 100;
                document.getElementById('music-seek').value = progress;
                document.getElementById('music-time').textContent = 
                    `${this.formatTime(this.audioEl.currentTime)} / ${this.formatTime(this.audioEl.duration)}`;
            }
        });

        this.audioEl.addEventListener('ended', () => this.playNext());
    },

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    },

    fetchPlaylist() {
        const playlistContainer = document.getElementById('music-playlist');
        if (playlistContainer) playlistContainer.innerHTML = '<div style="padding: 10px; color: var(--text-dim); text-align: center;"><i class="fas fa-spinner fa-spin"></i> Loading music...</div>';
        
        fetch('/api/music/list')
            .then(r => r.json())
            .then(data => {
                this.playlist = data;
                if (data.length === 0 && playlistContainer) {
                    playlistContainer.innerHTML = '<div style="padding: 10px; color: var(--text-dim); text-align: center;">No music found</div>';
                } else {
                    this.renderPlaylist();
                }
            })
            .catch(e => {
                if (playlistContainer) playlistContainer.innerHTML = '<div style="padding: 10px; color: #ff5555; text-align: center;">Error loading music</div>';
                console.error('Error fetching music list', e);
            });
    },

    renderPlaylist() {
        const container = document.getElementById('music-playlist');
        container.innerHTML = '';
        this.playlist.forEach((song, index) => {
            const div = document.createElement('div');
            div.className = 'playlist-item';
            div.innerHTML = `<i class="fas fa-play"></i> ${song}`;
            div.addEventListener('click', () => this.playTrack(index));
            container.appendChild(div);
        });
    },

    playTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        // Initialize audio context on first play (requires user interaction)
        this.initAudioContext();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.currentIndex = index;
        const song = this.playlist[index];
        this.audioEl.src = `/music/${encodeURIComponent(song)}`;
        this.audioEl.play().then(() => {
            this.isPlaying = true;
            this.updateUI();
        }).catch(e => console.error("Playback failed", e));
    },

    togglePlay() {
        if (this.playlist.length === 0) return;
        
        this.initAudioContext();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        if (this.currentIndex === -1) {
            this.playTrack(0);
            return;
        }

        if (this.isPlaying) {
            this.audioEl.pause();
            this.isPlaying = false;
        } else {
            this.audioEl.play();
            this.isPlaying = true;
        }
        this.updateUI();
    },

    playNext() {
        if (this.playlist.length === 0) return;
        let nextIdx = this.currentIndex + 1;
        if (nextIdx >= this.playlist.length) nextIdx = 0;
        this.playTrack(nextIdx);
    },

    playPrev() {
        if (this.playlist.length === 0) return;
        let prevIdx = this.currentIndex - 1;
        if (prevIdx < 0) prevIdx = this.playlist.length - 1;
        this.playTrack(prevIdx);
    },

    updateUI() {
        document.getElementById('music-play').innerHTML = this.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';


        if (this.currentIndex >= 0) {
            document.getElementById('music-title').textContent = this.playlist[this.currentIndex];
        }

        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, idx) => {
            if (idx === this.currentIndex) {
                item.classList.add('playing');
            } else {
                item.classList.remove('playing');
            }
        });
    },

    drawVisualizer() {
        if (!this.analyser || !this.canvasCtx) return;
        this.animationId = requestAnimationFrame(() => this.drawVisualizer());

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const canvas = this.canvasCtx.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 30; // inner radius

        // Clear canvas
        this.canvasCtx.clearRect(0, 0, width, height);

        // We use fewer bars to make it look clean (64 out of 128)
        const bars = 64;
        const step = (Math.PI * 2) / bars;

        for (let i = 0; i < bars; i++) {
            const value = dataArray[i]; // 0 to 255
            const percent = value / 255;
            const barHeight = percent * 40; // Max outward length

            const angle = i * step - (Math.PI / 2); // Start from top
            
            // Calculate start and end points
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);

            // Dynamic color
            const hue = i * (360 / bars) + (value * 0.5); // Color shifts based on position and amplitude
            const sat = 80 + (percent * 20); 
            const lit = 40 + (percent * 30); 

            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(x1, y1);
            this.canvasCtx.lineTo(x2, y2);
            this.canvasCtx.strokeStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
            this.canvasCtx.lineWidth = 3;
            this.canvasCtx.lineCap = 'round';
            this.canvasCtx.stroke();
        }
        
        // Draw center pulse circle based on bass (lower frequencies)
        const bassAvg = (dataArray[0] + dataArray[1] + dataArray[2]) / 3;
        const pulse = (bassAvg / 255) * 10;
        
        this.canvasCtx.beginPath();
        this.canvasCtx.arc(centerX, centerY, radius - 4 - pulse, 0, Math.PI * 2);
        this.canvasCtx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        this.canvasCtx.lineWidth = 1;
        this.canvasCtx.stroke();
    }
};

const PanelResizer = {
    init() {
        this.bindResizer('resizer-left', 'project-toolwindow', 'horizontal', true);
        this.bindResizer('resizer-right', 'right-toolwindow', 'horizontal', false);
        this.bindResizer('resizer-right', 'music-toolwindow', 'horizontal', false);
        this.bindResizer('resizer-bottom', 'bottom-panel', 'vertical', false);
    },

    bindResizer(resizerId, targetId, direction, isLeftOrTop) {
        const resizer = document.getElementById(resizerId);
        if (!resizer) return;

        let isDragging = false;
        let startPos = 0;
        let startSize = 0;

        resizer.addEventListener('mousedown', (e) => {
            const target = document.getElementById(targetId);
            if (!target || target.style.display === 'none') return;
            
            isDragging = true;
            resizer.classList.add('dragging');
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
            
            if (direction === 'horizontal') {
                startPos = e.clientX;
                startSize = target.getBoundingClientRect().width;
            } else {
                startPos = e.clientY;
                startSize = target.getBoundingClientRect().height;
            }
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const target = document.getElementById(targetId);
            if (!target) return;

            let newSize;
            if (direction === 'horizontal') {
                const diff = e.clientX - startPos;
                newSize = isLeftOrTop ? startSize + diff : startSize - diff;
                if (newSize > 100 && newSize < window.innerWidth - 100) {
                    target.style.width = `${newSize}px`;
                    target.style.flex = 'none';
                }
            } else {
                const diff = e.clientY - startPos;
                // For bottom panel, dragging UP (negative diff) increases height
                newSize = startSize - diff;
                if (newSize > 50 && newSize < window.innerHeight - 100) {
                    target.style.height = `${newSize}px`;
                    target.style.flex = 'none';
                }
            }

            if (IDE.editor) {
                IDE.editor.layout();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                resizer.classList.remove('dragging');
                document.body.style.cursor = '';
                if (IDE.editor) {
                    IDE.editor.layout();
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    IDE.init();
    MusicPlayer.init();
    WallpaperManager.init();
    PanelResizer.init();
});
