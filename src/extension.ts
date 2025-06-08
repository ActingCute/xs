import * as vscode from 'vscode';

let wordCountStatusBarItem: vscode.StatusBarItem;
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_DELAY = 300;

export function activate(context: vscode.ExtensionContext) {
    // 创建状态栏项
    wordCountStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    wordCountStatusBarItem.command = 'xs-wordcount.showStats';
    context.subscriptions.push(wordCountStatusBarItem);
    
    // 注册格式化提供器
    const formatter = vscode.languages.registerDocumentFormattingEditProvider('xs', {
        provideDocumentFormattingEdits(document: vscode.TextDocument) {
            try {
                const text = document.getText();
                const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
                const formattedText = formatXsText(text, eol);
                
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                
                // 更新字数统计
                debounceUpdateWordCount(document);
                
                return [vscode.TextEdit.replace(fullRange, formattedText)];
            } catch (error) {
                console.error('格式化失败:', error);
                return [];
            }
        }
    });
    
    context.subscriptions.push(formatter);
    
    // 注册字数统计命令
    const showStatsCommand = vscode.commands.registerCommand('xs-wordcount.showStats', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'xs') {
            const count = calculateWordCount(editor.document.getText());
            vscode.window.showInformationMessage(
                `字数统计（精确匹配）: ${count}`
            );
        }
    });
    
    context.subscriptions.push(showStatsCommand);
    
    // 初始化状态栏
    debounceUpdateWordCount();
    
    // 监听文档变化
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            updateWordCount();
        })
    );
    
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (vscode.window.activeTextEditor && 
                event.document === vscode.window.activeTextEditor.document) {
                debounceUpdateWordCount();
            }
        })
    );
}

function debounceUpdateWordCount(document?: vscode.TextDocument) {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
        updateWordCount(document);
        debounceTimer = null;
    }, DEBOUNCE_DELAY);
}

function updateWordCount(document?: vscode.TextDocument) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document) {
        wordCountStatusBarItem.hide();
        return;
    }
    
    const doc = document || editor.document;
    if (doc.languageId !== 'xs') {
        wordCountStatusBarItem.hide();
        return;
    }
    
    const count = calculateWordCount(doc.getText());
    wordCountStatusBarItem.text = `字数: ${count}`;
    wordCountStatusBarItem.show();
}

// 精确匹配小说网站字数统计规则
function calculateWordCount(text: string): number {
    let totalCount = 0;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = char.charCodeAt(0);
        
        // 统计所有可见字符
        if (isVisibleCharacter(char, code)) {
            totalCount++;
        }
    }
    
    return totalCount;
}

function isVisibleCharacter(char: string, code: number): boolean {
    // 统计中文字符（包括汉字和中文标点）
    if ((code >= 0x4E00 && code <= 0x9FA5) || 
        (code >= 0x3000 && code <= 0x303F) || 
        (code >= 0xFF00 && code <= 0xFFEF)) {
        return true;
    }
    
    // 统计所有可见标点符号（包括半角英文标点）
    if (isPunctuation(char)) {
        return true;
    }
    
    // 统计所有字母数字（英文、数字）
    if ((code >= 0x0030 && code <= 0x0039) || 
        (code >= 0x0041 && code <= 0x005A) || 
        (code >= 0x0061 && code <= 0x007A)) {
        return true;
    }
    
    // 统计其他可见字符（特殊符号等）
    if (code >= 0x0021 && code <= 0x007E && 
        !isWhitespace(char) && !isPunctuation(char)) {
        return true;
    }
    
    return false;
}

function isWhitespace(char: string): boolean {
    return char === ' ' || 
           char === '\t' || 
           char === '\n' || 
           char === '\r' ||
           char === '\u200B' || 
           char === '\uFEFF';  
}

function isPunctuation(char: string): boolean {
    // 所有半角全角标点
    const punct = ',.;:?!"\'()[]{}<>/@#$%^&*_+-=~`|\\、，。！？；："「」【】《》';
    return punct.includes(char);
}

// 格式化功能（保持不变）
function formatXsText(text: string, eol: string): string {
    const lines = text.split(/\r?\n/).map(line => line.trimEnd());
    const resultLines: string[] = [];
    let hasAddedParagraph = false;
    
    for (const rawLine of lines) {
        const line = rawLine.trim();
        
        if (line) {
            if (hasAddedParagraph && resultLines.length > 0) {
                resultLines.push('');
            }
            resultLines.push('    ' + line);
            hasAddedParagraph = true;
        }
    }
    
    return resultLines.length > 0 ? resultLines.join(eol) + eol : eol;
}

export function deactivate() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}