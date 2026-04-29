import { BrowserWindow, ipcMain, dialog } from 'electron'
import type { DialogAskInputPayload, DialogChooseFromListPayload } from '@shared/ipc.types'
import { IPC_DIALOG_SUBMIT } from '@shared/ipc.types'

/**
 * Manages modal dialog windows for action sequence execution.
 * - ask-input: text/number/password input dialog
 * - choose-from-list: list selection dialog
 * - show-alert: native Electron message box
 */
export class DialogManager {
  constructor() {
    // Submit handler — used by both ask-input and choose-from-list windows
    ipcMain.on(IPC_DIALOG_SUBMIT, () => {
      // No-op listener to prevent "No handler registered" warnings.
      // Actual results are received via webContents.executeJavaScript.
    })
  }

  /**
   * Show a native alert dialog using Electron's dialog.showMessageBox.
   * Returns 'confirmed' or 'cancelled'.
   */
  async showAlert(opts: {
    title: string
    message: string
    confirmText: string
    cancelText: string | null
  }): Promise<string> {
    const buttons = opts.cancelText
      ? [opts.confirmText, opts.cancelText]
      : [opts.confirmText]

    const result = await dialog.showMessageBox({
      type: 'info',
      title: opts.title || 'Alert',
      message: opts.message || '',
      buttons,
      defaultId: 0,
      cancelId: opts.cancelText ? 1 : -1,
    })

    return result.response === 0 ? 'confirmed' : 'cancelled'
  }

  /**
   * Show a text input dialog. Returns the entered string, or null if cancelled.
   */
  askInput(payload: DialogAskInputPayload): Promise<string | null> {
    return new Promise((resolve) => {
      const win = new BrowserWindow({
        width: 400,
        height: 200,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        modal: false,
        frame: false,
        transparent: false,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      })

      const escaped = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
      const title = escaped(payload.title || 'Input')
      const prompt = escaped(payload.prompt || '')
      const defaultValue = escaped(payload.defaultValue || '')
      const inputType = payload.inputType || 'text'

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1e1e2e; color: #cdd6f4;
    display: flex; flex-direction: column; height: 100vh;
    padding: 16px; gap: 12px; user-select: none;
    -webkit-app-region: drag;
  }
  .title { font-size: 14px; font-weight: 600; color: #cdd6f4; }
  .prompt { font-size: 12px; color: #a6adc8; }
  input {
    -webkit-app-region: no-drag;
    width: 100%; padding: 8px 10px; border-radius: 6px;
    border: 1px solid #45475a; background: #313244; color: #cdd6f4;
    font-size: 13px; outline: none;
  }
  input:focus { border-color: #89b4fa; }
  .buttons {
    display: flex; gap: 8px; justify-content: flex-end; margin-top: auto;
    -webkit-app-region: no-drag;
  }
  button {
    padding: 6px 16px; border-radius: 6px; border: none;
    font-size: 12px; cursor: pointer; font-weight: 500;
  }
  .btn-cancel { background: #45475a; color: #cdd6f4; }
  .btn-cancel:hover { background: #585b70; }
  .btn-ok { background: #89b4fa; color: #1e1e2e; }
  .btn-ok:hover { background: #74c7ec; }
</style>
</head>
<body>
  <div class="title">${title}</div>
  ${prompt ? `<div class="prompt">${prompt}</div>` : ''}
  <input id="inp" type="${inputType}" value="${defaultValue}" autofocus />
  <div class="buttons">
    <button class="btn-cancel" id="cancelBtn">Cancel</button>
    <button class="btn-ok" id="okBtn">OK</button>
  </div>
  <script>
    const inp = document.getElementById('inp');
    const okBtn = document.getElementById('okBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    inp.select();
    okBtn.addEventListener('click', () => {
      document.title = '__RESULT__' + inp.value;
    });
    cancelBtn.addEventListener('click', () => {
      document.title = '__CANCEL__';
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') okBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });
  </script>
</body>
</html>`

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      let resolved = false
      const finish = (value: string | null) => {
        if (resolved) return
        resolved = true
        resolve(value)
        if (!win.isDestroyed()) win.close()
      }

      win.webContents.on('page-title-updated', (_e, newTitle) => {
        if (newTitle.startsWith('__RESULT__')) {
          finish(newTitle.slice('__RESULT__'.length))
        } else if (newTitle === '__CANCEL__') {
          finish(null)
        }
      })

      win.on('closed', () => finish(null))
      win.once('ready-to-show', () => win.show())
    })
  }

  /**
   * Show a list selection dialog. Returns selected item(s) or null if cancelled.
   * Single selection returns the item string; multiple returns JSON array string.
   */
  chooseFromList(payload: DialogChooseFromListPayload): Promise<string | null> {
    return new Promise((resolve) => {
      const itemCount = payload.items.length
      const listHeight = Math.min(itemCount * 34 + 8, 300)
      const winHeight = 120 + listHeight

      const win = new BrowserWindow({
        width: 420,
        height: winHeight,
        resizable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        modal: false,
        frame: false,
        transparent: false,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      })

      const escaped = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
      const title = escaped(payload.title || 'Choose')
      const itemsJson = JSON.stringify(payload.items)
      const multiple = payload.multiple ? 'true' : 'false'

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1e1e2e; color: #cdd6f4;
    display: flex; flex-direction: column; height: 100vh;
    padding: 16px; gap: 10px; user-select: none;
    -webkit-app-region: drag;
  }
  .title { font-size: 14px; font-weight: 600; color: #cdd6f4; }
  .list {
    -webkit-app-region: no-drag;
    flex: 1; overflow-y: auto; border-radius: 6px;
    border: 1px solid #45475a; background: #313244;
  }
  .item {
    padding: 8px 12px; font-size: 13px; cursor: pointer;
    border-bottom: 1px solid #3b3b52; display: flex; align-items: center; gap: 8px;
  }
  .item:last-child { border-bottom: none; }
  .item:hover { background: #45475a; }
  .item.selected { background: #89b4fa22; color: #89b4fa; }
  .item .check { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid #585b70; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .item.selected .check { border-color: #89b4fa; background: #89b4fa; }
  .item.selected .check::after { content: '✓'; font-size: 11px; color: #1e1e2e; font-weight: bold; }
  .buttons {
    display: flex; gap: 8px; justify-content: flex-end;
    -webkit-app-region: no-drag;
  }
  button {
    padding: 6px 16px; border-radius: 6px; border: none;
    font-size: 12px; cursor: pointer; font-weight: 500;
  }
  .btn-cancel { background: #45475a; color: #cdd6f4; }
  .btn-cancel:hover { background: #585b70; }
  .btn-ok { background: #89b4fa; color: #1e1e2e; }
  .btn-ok:hover { background: #74c7ec; }
</style>
</head>
<body>
  <div class="title">${title}</div>
  <div class="list" id="list"></div>
  <div class="buttons">
    <button class="btn-cancel" id="cancelBtn">Cancel</button>
    <button class="btn-ok" id="okBtn">OK</button>
  </div>
  <script>
    const items = ${itemsJson};
    const multiple = ${multiple};
    const selected = new Set();
    const listEl = document.getElementById('list');

    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'item';
      el.dataset.index = i;
      if (multiple) {
        el.innerHTML = '<div class="check"></div><span>' + item.replace(/</g, '&lt;') + '</span>';
      } else {
        el.textContent = item;
      }
      el.addEventListener('click', () => {
        if (multiple) {
          if (selected.has(i)) selected.delete(i); else selected.add(i);
        } else {
          selected.clear();
          selected.add(i);
        }
        updateUI();
      });
      el.addEventListener('dblclick', () => {
        if (!multiple) {
          selected.clear();
          selected.add(i);
          okBtn.click();
        }
      });
      listEl.appendChild(el);
    });

    function updateUI() {
      listEl.querySelectorAll('.item').forEach((el, i) => {
        el.classList.toggle('selected', selected.has(i));
      });
    }

    document.getElementById('okBtn').addEventListener('click', () => {
      if (selected.size === 0) { document.title = '__CANCEL__'; return; }
      const vals = [...selected].sort((a,b) => a-b).map(i => items[i]);
      if (multiple) {
        document.title = '__RESULT__' + JSON.stringify(vals);
      } else {
        document.title = '__RESULT__' + vals[0];
      }
    });
    document.getElementById('cancelBtn').addEventListener('click', () => {
      document.title = '__CANCEL__';
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.getElementById('cancelBtn').click();
      if (e.key === 'Enter') document.getElementById('okBtn').click();
    });
  </script>
</body>
</html>`

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      let resolved = false
      const finish = (value: string | null) => {
        if (resolved) return
        resolved = true
        resolve(value)
        if (!win.isDestroyed()) win.close()
      }

      win.webContents.on('page-title-updated', (_e, newTitle) => {
        if (newTitle.startsWith('__RESULT__')) {
          finish(newTitle.slice('__RESULT__'.length))
        } else if (newTitle === '__CANCEL__') {
          finish(null)
        }
      })

      win.on('closed', () => finish(null))
      win.once('ready-to-show', () => win.show())
    })
  }
}
