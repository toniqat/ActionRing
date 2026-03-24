import { app } from 'electron'

export class LoginStartup {
  enable(): void {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true
    })
  }

  disable(): void {
    app.setLoginItemSettings({
      openAtLogin: false
    })
  }

  isEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin
  }

  sync(enabled: boolean): void {
    if (enabled !== this.isEnabled()) {
      enabled ? this.enable() : this.disable()
    }
  }
}
