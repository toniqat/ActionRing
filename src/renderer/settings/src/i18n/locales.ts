import type { Language } from '@shared/config.types'

export type { Language }

export interface Translations {
  // App
  'app.loading': string
  'app.error': string
  'app.errorRecover': string
  'app.errorShowLog': string
  'app.errorRestart': string
  'mcp.serverRunning': string
  'mcp.serverStopped': string
  'mcp.clientActive': string
  'mcp.clientIdle': string
  'mcp.port': string
  'mcp.requests': string
  'mcp.lastRequest': string
  'mcp.tools': string
  'mcp.noRequests': string
  'mcp.setupButton': string
  'mcp.setupTitle': string
  'mcp.setupManual': string
  'mcp.setupManualDesc': string
  'mcp.setupStdio': string
  'mcp.setupHttp': string
  'mcp.setupQuick': string
  'mcp.setupQuickDesc': string
  'mcp.setupWorking': string
  'mcp.setupDone': string
  'mcp.setupError': string
  'mcp.setupRestart': string
  'mcp.setupResultSuccess': string
  'mcp.setupResultFailed': string
  'mcp.setupResultCommand': string
  'mcp.setupBack': string
  'mcp.copy': string
  'mcp.copied': string
  'mcp.checking': string
  'mcp.notInstalled': string
  'mcp.installed': string
  'mcp.registered': string
  'mcp.installRequired': string
  'tab.configure': string
  'tab.general': string
  'tab.about': string

  // General tab
  'general.title': string
  'general.theme': string
  'general.dark': string
  'general.light': string
  'general.system': string
  'general.darkDesc': string
  'general.lightDesc': string
  'general.systemDesc': string
  'general.trigger': string
  'general.startOnLogin': string
  'general.trayNotifications': string
  'general.language': string
  'general.leftClickWarning': string

  // Key / mouse recorder
  'recorder.clickToRecord': string
  'recorder.clickToSave': string
  'recorder.recording': string
  'recorder.pressKeys': string
  'recorder.none': string
  'recorder.clickToSaveHint': string
  'recorder.clickToChangeHint': string
  'recorder.listening': string
  'recorder.listenMsg': string

  // Mouse button labels
  'mouse.1': string
  'mouse.2': string
  'mouse.3': string
  'mouse.4': string
  'mouse.5': string
  'mouse.n': string

  // Left panel
  'panel.ringLayout': string
  'panel.distance': string
  'panel.buttonSize': string
  'panel.iconSize': string
  'panel.textSize': string
  'panel.showText': string
  'panel.appearance': string
  'panel.opacity': string
  'panel.animSpeed': string
  'panel.animPreview': string
  'panel.small': string
  'panel.large': string
  'panel.slow': string
  'panel.normal': string
  'panel.fast': string
  'panel.categoryLayout': string
  'panel.categoryText': string
  'panel.categoryAnimation': string

  // Slot edit panel
  'slot.shortcuts': string
  'slot.editShortcuts': string
  'slot.noActions': string
  'slot.folder': string
  'slot.editSubSlots': string
  'slot.noSubSlots': string
  'slot.subSlotsConfigured': string
  'slot.subSlotsCount': string
  'slot.clickFolderHint': string
  'slot.importPreset': string
  'slot.exportPreset': string
  'slot.editAppearance': string
  'slot.typeShortcut': string
  'slot.typeFolder': string

  // Shortcuts editor window (toolbar)
  'shortcuts.undo': string
  'shortcuts.redo': string
  'shortcuts.importActions': string
  'shortcuts.exportActions': string
  'shortcuts.play': string
  'shortcuts.playing': string
  'shortcuts.doubleClickToRename': string
  'shortcuts.clickToRename': string
  'shortcuts.executionError': string
  'shortcuts.addToStart': string
  'shortcuts.addToEnd': string
  'shortcuts.noVarsAvailable': string
  'shortcuts.noReturnValsAvailable': string
  'shortcuts.selectVariable': string
  'shortcuts.selectReturnValue': string

  // Shortcuts modal
  'modal.editShortcuts': string
  'modal.sequence': string
  'modal.noActionsYet': string
  'modal.searchActions': string
  'modal.cancel': string
  'modal.save': string
  'modal.browse': string
  'modal.appPath': string
  'modal.shellCmd': string
  'modal.dragToReorder': string
  'modal.remove': string

  // Action types
  'action.launch': string
  'action.keyboard': string
  'action.shell': string
  'action.system': string
  'action.link': string
  'action.mouseMove': string
  'action.mouseClick': string
  'action.launchDesc': string
  'action.keyboardDesc': string
  'action.shellDesc': string
  'action.systemDesc': string
  'action.linkDesc': string
  'action.mouseMoveDesc': string
  'action.mouseClickDesc': string

  // Mouse action labels
  'mouse.modeSet': string
  'mouse.modeOffset': string
  'mouse.x': string
  'mouse.y': string
  'mouse.button': string
  'mouse.left': string
  'mouse.right': string
  'mouse.middle': string
  'mouse.side1': string
  'mouse.side2': string
  'mouse.wheelUp': string
  'mouse.wheelDown': string

  // Script / Logic node types
  'action.ifElse': string
  'action.ifElseDesc': string
  'action.loop': string
  'action.loopDesc': string
  'action.sequence': string
  'action.sequenceDesc': string
  'action.wait': string
  'action.waitDesc': string
  'action.setVar': string
  'action.setVarDesc': string
  'action.list': string
  'action.listDesc': string
  'action.dict': string
  'action.dictDesc': string
  'action.toast': string
  'action.toastDesc': string
  'action.runShortcut': string
  'action.runShortcutDesc': string
  'action.escape': string
  'action.escapeDesc': string
  'action.stop': string
  'action.stopDesc': string
  'action.calculate': string
  'action.calculateDesc': string
  'action.comment': string
  'action.commentDesc': string
  'action.clipboard': string
  'action.clipboardDesc': string
  'action.text': string
  'action.textDesc': string
  'action.transform': string
  'action.transformDesc': string
  'action.askInput': string
  'action.askInputDesc': string
  'action.chooseFromList': string
  'action.chooseFromListDesc': string
  'action.showAlert': string
  'action.showAlertDesc': string
  'action.httpRequest': string
  'action.httpRequestDesc': string
  'action.file': string
  'action.fileDesc': string
  'action.dateTime': string
  'action.dateTimeDesc': string
  'action.tryCatch': string
  'action.tryCatchDesc': string
  'action.registry': string
  'action.registryDesc': string
  'action.environment': string
  'action.environmentDesc': string
  'action.service': string
  'action.serviceDesc': string

  // Clipboard modes
  'script.clipboardGet': string
  'script.clipboardSet': string
  'script.clipboardValue': string

  // Text modes
  'script.textModeReplace': string
  'script.textModeSplit': string
  'script.textModeCombine': string
  'script.textModeCase': string
  'script.textModeMatch': string
  'script.textModeSubstring': string
  'script.textModeLength': string
  'script.textModeTrim': string
  'script.textModePad': string
  'script.textInput': string
  'script.textFind': string
  'script.textReplaceWith': string
  'script.textRegex': string
  'script.textSeparator': string
  'script.textListVar': string
  'script.textCaseUpper': string
  'script.textCaseLower': string
  'script.textCaseCapitalize': string
  'script.textCaseCamel': string
  'script.textCaseSnake': string
  'script.textCaseKebab': string
  'script.textPattern': string
  'script.textMatchAll': string
  'script.textStart': string
  'script.textLength': string
  'script.textPadLength': string
  'script.textPadChar': string
  'script.textPadStart': string
  'script.textPadEnd': string

  // Transform modes
  'script.transformJsonParse': string
  'script.transformJsonStringify': string
  'script.transformUrlEncode': string
  'script.transformUrlDecode': string
  'script.transformBase64Encode': string
  'script.transformBase64Decode': string
  'script.transformHash': string
  'script.transformAlgorithm': string

  // Ask-input
  'script.askInputTitle': string
  'script.askInputPrompt': string
  'script.askInputDefault': string
  'script.askInputTypeText': string
  'script.askInputTypeNumber': string
  'script.askInputTypePassword': string

  // Choose-from-list
  'script.chooseTitle': string
  'script.chooseItems': string
  'script.chooseListVar': string
  'script.chooseMultiple': string
  'script.chooseAddItem': string
  'script.chooseSourceItems': string
  'script.chooseSourceVariable': string

  // Show-alert
  'script.alertTitle': string
  'script.alertMessage': string
  'script.alertConfirmText': string
  'script.alertCancelText': string

  // HTTP request
  'script.httpUrl': string
  'script.httpMethod': string
  'script.httpHeaders': string
  'script.httpBody': string
  'script.httpTimeout': string
  'script.httpStatusVar': string

  // File
  'script.fileModeRead': string
  'script.fileModeWrite': string
  'script.fileModeExists': string
  'script.fileModeList': string
  'script.fileModePick': string
  'script.fileModeInfo': string
  'script.fileModeDelete': string
  'script.fileModeRename': string
  'script.fileModeCopy': string
  'script.filePath': string
  'script.fileContent': string
  'script.fileEncoding': string
  'script.fileWriteOverwrite': string
  'script.fileWriteAppend': string
  'script.filePattern': string
  'script.filePickTitle': string
  'script.fileFilters': string
  'script.filePickFile': string
  'script.filePickDirectory': string
  'script.fileDestination': string
  'script.fileInfoSize': string
  'script.fileInfoModified': string
  'script.fileInfoCreated': string
  'script.fileInfoExtension': string
  'script.fileInfoName': string
  'script.fileInfoDirectory': string

  // Date-time
  'script.dtModeNow': string
  'script.dtModeFormat': string
  'script.dtModeMath': string
  'script.dtModeDiff': string
  'script.dtModeParse': string
  'script.dtInput': string
  'script.dtFormat': string
  'script.dtAmount': string
  'script.dtUnitYears': string
  'script.dtUnitMonths': string
  'script.dtUnitDays': string
  'script.dtUnitHours': string
  'script.dtUnitMinutes': string
  'script.dtUnitSeconds': string
  'script.dtUnitMs': string
  'script.dtDate1': string
  'script.dtDate2': string

  // Try-catch
  'script.tryLabel': string
  'script.catchLabel': string
  'script.tryCatchEnd': string
  'script.errorVar': string

  // Registry
  'script.regModeRead': string
  'script.regModeWrite': string
  'script.regModeDelete': string
  'script.regModeExists': string
  'script.regKeyPath': string
  'script.regValueName': string
  'script.regData': string

  // Environment
  'script.envModeGet': string
  'script.envModeSet': string
  'script.envModeList': string
  'script.envName': string
  'script.envValue': string

  // Service
  'script.svcModeStatus': string
  'script.svcModeStart': string
  'script.svcModeStop': string
  'script.svcModeRestart': string
  'script.svcName': string

  // Palette subcategory
  'palette.sub.windows': string

  // Palette tabs
  'palette.all': string
  'palette.actions': string
  'palette.scripts': string
  'palette.values': string
  'palette.shortcuts': string
  'palette.allGroups': string
  'palette.variables': string
  'palette.returnValues': string
  'palette.noValues': string
  'palette.valueNotDefined': string
  'palette.sub.controls': string
  'palette.sub.system': string
  'palette.sub.flow': string
  'palette.sub.data': string
  'palette.sub.interaction': string
  'palette.sub.io': string
  'palette.sub.utility': string

  // Script node UI
  'script.condition': string
  'script.thenLabel': string
  'script.elseLabel': string
  'script.bodyLabel': string
  'script.repeatTimes': string
  'script.delayMs': string
  'script.varName': string
  'script.varValue': string
  'script.varLocal': string
  'script.message': string
  'script.addAction': string
  'script.noSubActions': string
  'script.selectShortcut': string
  'script.noShortcuts': string
  'script.pickFromVariable': string
  'script.pickFromReturnValue': string
  'script.browseFile': string
  'script.addInput': string
  'script.inputParam': string
  'script.inputValue': string
  'script.outputVar': string
  'script.conditionHint': string
  'script.matchLogicPrefix': string
  'script.matchAll': string
  'script.matchAny': string
  'script.addCriteria': string
  'script.conditionVar': string
  'script.conditionVal': string
  // Condition mode (if-else / switch)
  'script.conditionModeIfElse': string
  'script.conditionModeSwitch': string
  'script.switchValue': string
  'script.caseLabel': string
  'script.defaultLabel': string
  'script.addCase': string
  'script.addDefault': string
  'script.endSwitch': string
  // Loop mode
  'script.loopModeRepeat': string
  'script.loopModeFor': string
  'script.loopModeForeach': string
  'script.loopIterVar': string
  'script.loopTo': string
  'script.loopStep': string
  'script.loopItemVar': string
  'script.loopKeyVar': string
  'script.loopListVar': string
  // Loop context menu (assign loop values)
  'script.loopAssignCount': string
  'script.loopAssignIndex': string
  'script.loopAssignValue': string
  'script.loopAssignKey': string
  'script.loopForeachIndex': string
  'script.loopForeachValue': string
  'script.loopForeachKey': string
  'script.loopForeachDictValue': string
  // Variable CRUD
  'script.varDataType': string
  'script.varTypeSingle': string
  'script.varTypeList': string
  'script.varTypeDict': string
  'script.varModeDefine': string
  'script.varModeEdit': string
  'script.varOpSet': string
  'script.varOpGet': string
  'script.varOpPush': string
  'script.varOpRemove': string
  'script.varKey': string
  'script.varResultVar': string
  'script.varAddItem': string
  'script.varAddEntry': string
  'script.varItemPlaceholder': string
  'script.varKeyPlaceholder': string
  'script.varValuePlaceholder': string
  // Stop node
  'script.stopReturnVar': string
  'script.stopReturnValue': string
  // Calculate node
  'script.calcOpAdd': string
  'script.calcOpSub': string
  'script.calcOpMul': string
  'script.calcOpDiv': string
  'script.calcOpMod': string
  'script.calcOpFloorDiv': string
  'script.calcOpPow': string
  'script.calcOpSqrt': string
  'script.calcResult': string
  'script.toastTitle': string
  'script.toastBody': string
  // Sequence node
  'script.sequenceName': string
  'script.sequenceBody': string
  'script.sequenceEnd': string
  'script.showProgress': string
  // Wait modes
  'script.waitManual': string
  'script.waitVariable': string
  'script.waitAppExit': string
  'script.waitAppTarget': string
  'script.waitKeyInput': string
  // Comment node
  'script.commentPlaceholder': string
  // Launch action options
  'script.launchPid': string
  // Field labels (small gray text to the left of inputs)
  'script.labelTarget': string
  'script.labelKeys': string
  'script.labelCommand': string
  'script.labelCount': string
  'script.labelStart': string
  'script.labelVariable': string
  'script.labelResult': string
  // Return value picker
  'script.selectReturnValue': string
  'script.returnValuePickerHint': string
  'script.returnLaunchTarget': string
  'script.returnKeysCombo': string
  'script.returnExitCode': string
  'script.returnLoopCount': string
  'script.returnLoopIndex': string
  'script.returnLoopItem': string
  'script.returnVarValue': string
  'script.returnOutputVar': string
  'script.returnResultVar': string
  'script.returnReturnVar': string

  // System actions
  'system.volume-up': string
  'system.volume-down': string
  'system.mute': string
  'system.play-pause': string
  'system.screenshot': string
  'system.lock-screen': string
  'system.show-desktop': string

  // Window controls
  'win.minimize': string
  'win.maximize': string
  'win.restore': string
  'win.close': string

  // Icon picker modal
  'iconPicker.title': string

  // Appearance editor
  'appearance.icon': string
  'appearance.search': string
  'appearance.recentlyUsed': string
  'appearance.custom': string
  'appearance.resourceIcons': string
  'appearance.default': string
  'appearance.importIcon': string
  'appearance.removeFromLibrary': string
  'appearance.showLess': string
  'appearance.showMore': string
  'appearance.preview': string
  'appearance.colors': string
  'appearance.background': string
  'appearance.iconColor': string
  'appearance.textColor': string
  'appearance.themeDefault': string
  'appearance.resetToTheme': string
  'appearance.themeHint': string
  'appearance.reset': string
  'appearance.save': string
  'appearance.unnamed': string
  'appearance.appTitle': string
  'appearance.renderError': string

  // Ring preview footer
  'ring.slotCount': string
  'ring.addSlot': string
  'ring.deleteSlot': string
  'ring.minSlots': string
  'ring.deleteSlotHint': string
  'ring.subSlotCount': string
  'ring.addSubSlot': string
  'ring.deleteSubSlot': string
  'ring.deleteSubSlotHint': string
  'ring.deleteFolder': string
  'ring.deleteFolderHint': string
  'ring.newAction': string

  // App carousel
  'carousel.rename': string
  'carousel.duplicate': string
  'carousel.export': string
  'carousel.delete': string
  'carousel.appSettings': string
  'carousel.changeTarget': string
  'carousel.exportAll': string
  'carousel.importProfiles': string
  'carousel.deleteApp': string
  'carousel.active': string
  'carousel.moreOptions': string
  'carousel.addProfile': string
  'carousel.addApp': string
  'carousel.newProfile': string
  'carousel.scrollToStart': string
  'carousel.scrollToEnd': string
  'carousel.addNewApp': string

  // Add app overlay
  'addapp.title': string
  'addapp.subtitle': string
  'addapp.fromRunning': string
  'addapp.fromRunningDesc': string
  'addapp.browse': string
  'addapp.browseDesc': string
  'addapp.import': string
  'addapp.importDesc': string
  'addapp.back': string
  'addapp.runningApps': string
  'addapp.scanning': string
  'addapp.noWindows': string
  'addapp.added': string
  'addapp.close': string

  // Shortcuts Library tab
  'tab.shortcuts': string
  'lib.gallery': string
  'lib.recent': string
  'lib.favorites': string
  'lib.create': string
  'lib.import': string
  'lib.namePlaceholder': string
  'lib.confirm': string
  'lib.cancel': string
  'lib.edit': string
  'lib.noActions': string
  'lib.actionsCount': string
  'lib.emptyGallery': string
  'lib.emptyRecent': string
  'lib.emptyFavorites': string
  'lib.showMore': string
  'lib.showLess': string
  'lib.deleteTitle': string
  'lib.orphanWarning': string
  'lib.deleteAnyway': string
  'lib.headerTitle': string
  'lib.groups': string
  'lib.addGroup': string
  'lib.deleteGroup': string
  'lib.deleteGroupTitle': string
  'lib.deleteGroupMessage': string
  'lib.exportGroup': string
  'lib.moveToGroup': string
  'lib.duplicate': string
  'lib.emptyGroup': string
  'lib.createNewGroup': string
  'lib.viewCard': string
  'lib.viewList': string
  'lib.search': string
  'lib.favorite': string
  'lib.unfavorite': string
  'lib.back': string
  'lib.delete': string
  'lib.removeFromGroup': string
  'lib.defaultGroup': string
  'lib.renameGroup': string
  'lib.duplicateGroup': string

  // About tab
  'about.description': string

  // General tab — data management
  'general.dataManagement': string
  'general.resetSettings': string
  'general.exportAllData': string
  'general.importAllData': string
  'general.exportSuccess': string
  'general.exportFailed': string
  'general.importSuccess': string
  'general.importFailed': string
  'general.resetSuccess': string
  'general.resetConfirmTitle': string
  'general.resetConfirmMessage': string
  'general.resetConfirmAction': string

  // Shortcut sidebar (Action Ring tab right panel)
  'sidebar.title': string
  'sidebar.searchPlaceholder': string
  'sidebar.allShortcuts': string
  'sidebar.noShortcuts': string
  'sidebar.noMatch': string
  'sidebar.ungrouped': string
  'sidebar.confirmOverwriteTitle': string
  'sidebar.confirmOverwriteMessage': string
  'sidebar.confirmOverwriteAction': string
}

const en: Translations = {
  'app.loading': 'Loading...',
  'app.error': 'Something went wrong',
  'app.errorRecover': 'Try to recover',
  'app.errorShowLog': 'View error log',
  'app.errorRestart': 'Restart app',
  'mcp.serverRunning': 'MCP Server Running',
  'mcp.serverStopped': 'MCP Server Stopped',
  'mcp.clientActive': 'Client Active',
  'mcp.clientIdle': 'No Client Activity',
  'mcp.port': 'Port',
  'mcp.requests': 'Requests',
  'mcp.lastRequest': 'Last request',
  'mcp.tools': 'Available tools',
  'mcp.noRequests': 'No requests yet',
  'mcp.setupButton': 'Setup MCP',
  'mcp.setupTitle': 'MCP Server Setup',
  'mcp.setupManual': 'Manual Configuration',
  'mcp.setupManualDesc': 'Copy the JSON below and paste it into your AI client\'s MCP configuration.',
  'mcp.setupStdio': 'stdio',
  'mcp.setupHttp': 'HTTP',
  'mcp.setupQuick': 'Quick Setup',
  'mcp.setupQuickDesc': 'Select an AI client to automatically register the ActionRing MCP server.',
  'mcp.setupWorking': 'Setting up...',
  'mcp.setupDone': 'Registered successfully. Restart the client to connect.',
  'mcp.setupError': 'Setup failed',
  'mcp.setupRestart': 'Restart required',
  'mcp.setupResultSuccess': 'Registered successfully. Restart the client to connect.',
  'mcp.setupResultFailed': 'Setup failed. See the error details below.',
  'mcp.setupResultCommand': 'You can try running this command manually:',
  'mcp.setupBack': 'Back',
  'mcp.copy': 'Copy',
  'mcp.copied': 'Copied!',
  'mcp.checking': 'Checking...',
  'mcp.notInstalled': 'Not installed',
  'mcp.installed': 'Installed',
  'mcp.registered': 'Registered',
  'mcp.installRequired': 'Install required',
  'tab.configure': 'Action Ring',
  'tab.general': 'Settings',
  'tab.about': 'About',
  'tab.shortcuts': 'Shortcuts',

  'general.title': 'Settings',
  'general.theme': 'Theme',
  'general.dark': 'Dark',
  'general.light': 'Light',
  'general.system': 'System',
  'general.darkDesc': 'Warm dark slate',
  'general.lightDesc': 'Clean light',
  'general.systemDesc': 'Follow OS',
  'general.trigger': 'Trigger',
  'general.startOnLogin': 'Start on Login',
  'general.trayNotifications': 'Show notification when minimizing to tray',
  'general.language': 'Language',
  'general.leftClickWarning': 'Left Click requires at least one modifier key to avoid conflicts with normal clicking.',

  'recorder.clickToRecord': 'Click to record keyboard trigger',
  'recorder.clickToSave': 'Click to save — Esc to cancel',
  'recorder.recording': 'Recording…',
  'recorder.pressKeys': 'Press keys…',
  'recorder.none': 'None',
  'recorder.clickToSaveHint': 'click to save',
  'recorder.clickToChangeHint': 'Click to change mouse button',
  'recorder.listening': 'Listening…',
  'recorder.listenMsg': 'Click any mouse button…',

  'mouse.1': 'Left Click',
  'mouse.2': 'Right Click',
  'mouse.3': 'Middle Click',
  'mouse.4': 'Side Button 1',
  'mouse.5': 'Side Button 2',
  'mouse.n': 'Button',

  'panel.ringLayout': 'Ring Layout',
  'panel.distance': 'Distance',
  'panel.buttonSize': 'Button Size',
  'panel.iconSize': 'Icon Size',
  'panel.textSize': 'Text Size',
  'panel.showText': 'Show Text',
  'panel.appearance': 'Appearance',
  'panel.opacity': 'Opacity',
  'panel.animSpeed': 'Animation Speed',
  'panel.animPreview': 'Animation Preview',
  'panel.small': 'Small',
  'panel.large': 'Large',
  'panel.slow': 'Slow',
  'panel.normal': 'Normal',
  'panel.fast': 'Fast',
  'panel.categoryLayout': 'Layout',
  'panel.categoryText': 'Text',
  'panel.categoryAnimation': 'Animation',

  'slot.shortcuts': 'Shortcuts',
  'slot.editShortcuts': 'Edit Shortcuts ›',
  'slot.noActions': 'No shortcuts assigned — drag one from the right panel.',
  'slot.folder': 'Folder',
  'slot.editSubSlots': 'Edit Sub-Slots',
  'slot.noSubSlots': 'No sub-slots yet — use "+ Add Sub-Slot" to add one.',
  'slot.subSlotsConfigured': '{n} sub-slot(s) configured — click a sub-slot to edit it.',
  'slot.subSlotsCount': '{n} sub-slot(s) configured',
  'slot.clickFolderHint': 'Click the folder button in the preview to expand and edit its sub-slots.',
  'slot.importPreset': 'Import Preset',
  'slot.exportPreset': 'Export Preset',
  'slot.editAppearance': 'Edit appearance',
  'slot.typeShortcut': 'Shortcut',
  'slot.typeFolder': 'Folder',

  'shortcuts.undo': 'Undo',
  'shortcuts.redo': 'Redo',
  'shortcuts.importActions': 'Import actions',
  'shortcuts.exportActions': 'Export actions',
  'shortcuts.play': 'Play sequence',
  'shortcuts.playing': 'Running…',
  'shortcuts.doubleClickToRename': 'Double-click to rename',
  'shortcuts.clickToRename': 'Click to rename',
  'shortcuts.executionError': 'Execution failed',
  'shortcuts.addToStart': 'Add to beginning',
  'shortcuts.addToEnd': 'Add to end',
  'shortcuts.noVarsAvailable': 'No variables available',
  'shortcuts.noReturnValsAvailable': 'No return values available',
  'shortcuts.selectVariable': 'Select variable',
  'shortcuts.selectReturnValue': 'Select return value',

  'modal.editShortcuts': 'Edit Shortcuts',
  'modal.sequence': 'Sequence — runs top to bottom',
  'modal.noActionsYet': 'No actions yet — drag a type from the library →',
  'modal.searchActions': 'Search actions…',
  'modal.cancel': 'Cancel',
  'modal.save': 'Save',
  'modal.browse': 'Browse',
  'modal.appPath': 'App or file path…',
  'modal.shellCmd': 'e.g. notepad.exe',
  'modal.dragToReorder': 'Drag to reorder',
  'modal.remove': 'Remove',

  'action.launch': 'Launch App',
  'action.keyboard': 'Keyboard',
  'action.shell': 'Shell Command',
  'action.system': 'System Action',
  'action.link': 'Open Link',
  'action.mouseMove': 'Mouse Move',
  'action.mouseClick': 'Mouse Click',
  'action.launchDesc': 'Open an application or file',
  'action.keyboardDesc': 'Send a key combination',
  'action.shellDesc': 'Run a terminal command',
  'action.systemDesc': 'Control system functions',
  'action.linkDesc': 'Open a URL in the default browser',
  'action.mouseMoveDesc': 'Move cursor to a position',
  'action.mouseClickDesc': 'Simulate a mouse button click',

  // Mouse action labels
  'mouse.modeSet': 'Set (absolute)',
  'mouse.modeOffset': 'Offset (relative)',
  'mouse.x': 'X',
  'mouse.y': 'Y',
  'mouse.button': 'Button',
  'mouse.left': 'Left Click',
  'mouse.right': 'Right Click',
  'mouse.middle': 'Middle Click',
  'mouse.side1': 'Side Button 1',
  'mouse.side2': 'Side Button 2',
  'mouse.wheelUp': 'Wheel Up',
  'mouse.wheelDown': 'Wheel Down',

  'action.ifElse': 'Condition',
  'action.ifElseDesc': 'Branch execution based on multiple conditions',
  'action.loop': 'Loop',
  'action.loopDesc': 'Repeat a sequence of actions N times',
  'action.sequence': 'Sequence',
  'action.sequenceDesc': 'Run actions in parallel as an independent task',
  'action.wait': 'Wait',
  'action.waitDesc': 'Pause execution for a set time',
  'action.setVar': 'Variable',
  'action.setVarDesc': 'Set a variable (auto-infers string, number, or boolean type)',
  'action.list': 'List',
  'action.listDesc': 'Create or modify a list variable',
  'action.dict': 'Dictionary',
  'action.dictDesc': 'Create or modify a dictionary variable',
  'action.toast': 'Toast Notification',
  'action.toastDesc': 'Show a system notification message',
  'action.runShortcut': 'Run Shortcut',
  'action.runShortcutDesc': 'Run a shortcut with inputs and capture its return value',

  'action.escape': 'Escape',
  'action.escapeDesc': 'Break out of the current loop',
  'action.stop': 'Stop',
  'action.stopDesc': 'Halt the entire shortcut sequence immediately',
  'action.calculate': 'Calculate',
  'action.calculateDesc': 'Perform a math operation and store the result',
  'action.comment': 'Comment',
  'action.commentDesc': 'Documentation note — no effect on execution',
  'action.clipboard': 'Clipboard',
  'action.clipboardDesc': 'Read or write the system clipboard',
  'action.text': 'Text',
  'action.textDesc': 'Process and transform text strings',
  'action.transform': 'Transform',
  'action.transformDesc': 'Convert data between formats (JSON, Base64, URL, Hash)',
  'action.askInput': 'Ask Input',
  'action.askInputDesc': 'Show a dialog to get text input from the user',
  'action.chooseFromList': 'Choose from List',
  'action.chooseFromListDesc': 'Show a list and let the user pick one or more items',
  'action.showAlert': 'Show Alert',
  'action.showAlertDesc': 'Show an alert dialog with OK/Cancel buttons',
  'action.httpRequest': 'HTTP Request',
  'action.httpRequestDesc': 'Send an HTTP request and capture the response',
  'action.file': 'File',
  'action.fileDesc': 'Read, write, and manage files on the filesystem',
  'action.dateTime': 'Date/Time',
  'action.dateTimeDesc': 'Get, format, and calculate dates and times',
  'action.tryCatch': 'Try-Catch',
  'action.tryCatchDesc': 'Run actions with error handling',
  'action.registry': 'Registry',
  'action.registryDesc': 'Read, write, or delete Windows registry keys',
  'action.environment': 'Environment',
  'action.environmentDesc': 'Get, set, or list environment variables',
  'action.service': 'Service',
  'action.serviceDesc': 'Manage Windows services (start, stop, status)',

  'script.clipboardGet': 'Get',
  'script.clipboardSet': 'Set',
  'script.clipboardValue': 'value',

  'script.textModeReplace': 'Replace',
  'script.textModeSplit': 'Split',
  'script.textModeCombine': 'Combine',
  'script.textModeCase': 'Case',
  'script.textModeMatch': 'Match',
  'script.textModeSubstring': 'Substring',
  'script.textModeLength': 'Length',
  'script.textModeTrim': 'Trim',
  'script.textModePad': 'Pad',
  'script.textInput': 'input',
  'script.textFind': 'find',
  'script.textReplaceWith': 'replace with',
  'script.textRegex': 'Regex',
  'script.textSeparator': 'separator',
  'script.textListVar': '$list',
  'script.textCaseUpper': 'UPPER',
  'script.textCaseLower': 'lower',
  'script.textCaseCapitalize': 'Capitalize',
  'script.textCaseCamel': 'camelCase',
  'script.textCaseSnake': 'snake_case',
  'script.textCaseKebab': 'kebab-case',
  'script.textPattern': 'regex pattern',
  'script.textMatchAll': 'All',
  'script.textStart': 'start',
  'script.textLength': 'length',
  'script.textPadLength': 'pad to',
  'script.textPadChar': 'char',
  'script.textPadStart': 'Start',
  'script.textPadEnd': 'End',

  'script.transformJsonParse': 'JSON Parse',
  'script.transformJsonStringify': 'JSON Stringify',
  'script.transformUrlEncode': 'URL Encode',
  'script.transformUrlDecode': 'URL Decode',
  'script.transformBase64Encode': 'Base64 Encode',
  'script.transformBase64Decode': 'Base64 Decode',
  'script.transformHash': 'Hash',
  'script.transformAlgorithm': 'Algorithm',

  'script.askInputTitle': 'title',
  'script.askInputPrompt': 'prompt',
  'script.askInputDefault': 'default',
  'script.askInputTypeText': 'Text',
  'script.askInputTypeNumber': 'Number',
  'script.askInputTypePassword': 'Password',

  'script.chooseTitle': 'title',
  'script.chooseItems': 'items',
  'script.chooseListVar': '$list',
  'script.chooseMultiple': 'Multi',
  'script.chooseAddItem': '+ Item',
  'script.chooseSourceItems': 'Items',
  'script.chooseSourceVariable': 'Variable',

  'script.alertTitle': 'title',
  'script.alertMessage': 'message',
  'script.alertConfirmText': 'OK text',
  'script.alertCancelText': 'Cancel text',

  'script.httpUrl': 'URL',
  'script.httpMethod': 'Method',
  'script.httpHeaders': 'headers JSON',
  'script.httpBody': 'body',
  'script.httpTimeout': 'timeout (ms)',
  'script.httpStatusVar': 'status var',

  'script.fileModeRead': 'Read',
  'script.fileModeWrite': 'Write',
  'script.fileModeExists': 'Exists',
  'script.fileModeList': 'List',
  'script.fileModePick': 'Pick',
  'script.fileModeInfo': 'Info',
  'script.fileModeDelete': 'Delete',
  'script.fileModeRename': 'Rename',
  'script.fileModeCopy': 'Copy',
  'script.filePath': 'path',
  'script.fileContent': 'content',
  'script.fileEncoding': 'encoding',
  'script.fileWriteOverwrite': 'Overwrite',
  'script.fileWriteAppend': 'Append',
  'script.filePattern': 'glob pattern',
  'script.filePickTitle': 'dialog title',
  'script.fileFilters': 'filters JSON',
  'script.filePickFile': 'File',
  'script.filePickDirectory': 'Directory',
  'script.fileDestination': 'destination',
  'script.fileInfoSize': 'Size',
  'script.fileInfoModified': 'Modified',
  'script.fileInfoCreated': 'Created',
  'script.fileInfoExtension': 'Extension',
  'script.fileInfoName': 'Name',
  'script.fileInfoDirectory': 'Directory',

  'script.dtModeNow': 'Now',
  'script.dtModeFormat': 'Format',
  'script.dtModeMath': 'Math',
  'script.dtModeDiff': 'Diff',
  'script.dtModeParse': 'Parse',
  'script.dtInput': 'date input',
  'script.dtFormat': 'format',
  'script.dtAmount': 'amount',
  'script.dtUnitYears': 'Years',
  'script.dtUnitMonths': 'Months',
  'script.dtUnitDays': 'Days',
  'script.dtUnitHours': 'Hours',
  'script.dtUnitMinutes': 'Minutes',
  'script.dtUnitSeconds': 'Seconds',
  'script.dtUnitMs': 'Milliseconds',
  'script.dtDate1': 'date1',
  'script.dtDate2': 'date2',

  'script.tryLabel': 'TRY',
  'script.catchLabel': 'CATCH',
  'script.tryCatchEnd': 'END TRY',
  'script.errorVar': 'error var',

  'script.regModeRead': 'Read',
  'script.regModeWrite': 'Write',
  'script.regModeDelete': 'Delete',
  'script.regModeExists': 'Exists',
  'script.regKeyPath': 'key path',
  'script.regValueName': 'value name',
  'script.regData': 'data',

  'script.envModeGet': 'Get',
  'script.envModeSet': 'Set',
  'script.envModeList': 'List',
  'script.envName': 'variable name',
  'script.envValue': 'value',

  'script.svcModeStatus': 'Status',
  'script.svcModeStart': 'Start',
  'script.svcModeStop': 'Stop',
  'script.svcModeRestart': 'Restart',
  'script.svcName': 'service name',

  'palette.sub.windows': 'Windows',

  'palette.all': 'All',
  'palette.actions': 'Actions',
  'palette.scripts': 'Scripts',
  'palette.values': 'Values',
  'palette.shortcuts': 'Shortcuts',
  'palette.allGroups': 'All Groups',
  'palette.variables': 'Variables',
  'palette.returnValues': 'Return Values',
  'palette.noValues': 'No values defined yet',
  'palette.valueNotDefined': 'Cannot assign — value is not yet defined at this point',
  'palette.sub.controls': 'Controls',
  'palette.sub.system': 'System',
  'palette.sub.flow': 'Flow',
  'palette.sub.data': 'Data',
  'palette.sub.interaction': 'Interaction',
  'palette.sub.io': 'I/O',
  'palette.sub.utility': 'Utility',

  'script.condition': 'Condition',
  'script.thenLabel': 'THEN',
  'script.elseLabel': 'ELSE',
  'script.bodyLabel': 'BODY',
  'script.repeatTimes': 'times',
  'script.delayMs': 'ms',
  'script.varName': 'Variable name',
  'script.varValue': 'Value',
  'script.varLocal': 'Local',
  'script.message': 'Message',
  'script.addAction': '+ Add action',
  'script.noSubActions': 'No actions — click "+ Add action"',
  'script.selectShortcut': 'Select shortcut…',
  'script.noShortcuts': 'No shortcuts in library',
  'script.pickFromVariable': 'Pick from variable',
  'script.pickFromReturnValue': 'Pick from return value',
  'script.browseFile': 'Browse file',
  'script.addInput': '+ Add input',
  'script.inputParam': 'param',
  'script.inputValue': 'value / $var',
  'script.outputVar': '→ $output',
  'script.conditionHint': 'e.g. $count > 3, $name == hello, $flag',
  'script.matchLogicPrefix': 'Match',
  'script.matchAll': 'All',
  'script.matchAny': 'Any',
  'script.addCriteria': '+ Add condition',
  'script.conditionVar': '$variable',
  'script.conditionVal': 'value',

  'script.conditionModeIfElse': 'If / Else',
  'script.conditionModeSwitch': 'Switch',
  'script.switchValue': '$variable',
  'script.caseLabel': 'CASE',
  'script.defaultLabel': 'DEFAULT',
  'script.addCase': '+ Add case',
  'script.addDefault': '+ Add default',
  'script.endSwitch': 'END SWITCH',

  'script.loopModeRepeat': 'Repeat',
  'script.loopModeFor': 'For',
  'script.loopModeForeach': 'ForEach',
  'script.loopIterVar': '$index',
  'script.loopTo': 'to',
  'script.loopStep': 'step',
  'script.loopItemVar': '$item',
  'script.loopKeyVar': '$key',
  'script.loopListVar': '$list',
  'script.loopAssignCount': 'Iteration Count',
  'script.loopAssignIndex': 'Current Index (i)',
  'script.loopAssignValue': 'Current Value',
  'script.loopAssignKey': 'Current Key',
  'script.loopForeachIndex': 'Current Index',
  'script.loopForeachValue': 'Current Value',
  'script.loopForeachKey': 'Current Key',
  'script.loopForeachDictValue': 'Current Value',

  'script.varDataType': 'Type',
  'script.varTypeSingle': 'Single',
  'script.varTypeList': 'List',
  'script.varTypeDict': 'Dict',
  'script.varModeDefine': 'Define',
  'script.varModeEdit': 'Edit',
  'script.varOpSet': 'Set',
  'script.varOpGet': 'Get',
  'script.varOpPush': 'Push',
  'script.varOpRemove': 'Remove',
  'script.varKey': 'key / index',
  'script.varResultVar': '→ $result',
  'script.varAddItem': '+ Add item',
  'script.varAddEntry': '+ Add entry',
  'script.varItemPlaceholder': 'item value',
  'script.varKeyPlaceholder': 'key',
  'script.varValuePlaceholder': 'value',

  'script.stopReturnVar': 'Set $var',
  'script.stopReturnValue': 'value',

  'script.calcOpAdd': 'Add (+)',
  'script.calcOpSub': 'Subtract (-)',
  'script.calcOpMul': 'Multiply (×)',
  'script.calcOpDiv': 'Divide (÷)',
  'script.calcOpMod': 'Modulo (%)',
  'script.calcOpFloorDiv': 'Floor Div (//)',
  'script.calcOpPow': 'Power (^)',
  'script.calcOpSqrt': 'Square Root (√)',
  'script.calcResult': '→ $result',
  'script.toastTitle': 'Title (optional)',
  'script.toastBody': 'Body',

  'script.sequenceName': 'Name',
  'script.sequenceBody': 'PARALLEL',
  'script.sequenceEnd': 'SEQ END',
  'script.showProgress': 'Progress',
  'script.waitManual': 'Delay',
  'script.waitVariable': 'Variable',
  'script.waitAppExit': 'App Exit',
  'script.waitAppTarget': 'launch target',
  'script.waitKeyInput': 'Key Input',

  'script.commentPlaceholder': 'Write a comment…',
  'script.launchPid': 'PID',
  'script.labelTarget': 'Target',
  'script.labelKeys': 'Keys',
  'script.labelCommand': 'Command',
  'script.labelCount': 'Count',
  'script.labelStart': 'Start',
  'script.labelVariable': 'Variable',
  'script.labelResult': 'Result',

  'script.selectReturnValue': 'Select Return Value',
  'script.returnValuePickerHint': 'Click a return value below each action to use it',
  'script.returnLaunchTarget': 'App Path',
  'script.returnKeysCombo': 'Key Combo',
  'script.returnExitCode': 'Exit Code',
  'script.returnLoopCount': 'Iteration Count',
  'script.returnLoopIndex': 'Last Index',
  'script.returnLoopItem': 'Last Item',
  'script.returnVarValue': 'Value',
  'script.returnOutputVar': 'Output',
  'script.returnResultVar': 'Result',
  'script.returnReturnVar': 'Return',

  'system.volume-up': 'Volume Up',
  'system.volume-down': 'Volume Down',
  'system.mute': 'Mute',
  'system.play-pause': 'Play / Pause',
  'system.screenshot': 'Screenshot',
  'system.lock-screen': 'Lock Screen',
  'system.show-desktop': 'Show Desktop',

  'win.minimize': 'Minimize',
  'win.maximize': 'Maximize',
  'win.restore': 'Restore',
  'win.close': 'Close',

  'iconPicker.title': 'Select Icon',

  'appearance.icon': 'Icon',
  'appearance.search': 'Search…',
  'appearance.recentlyUsed': 'Recently Used',
  'appearance.custom': 'Custom',
  'appearance.resourceIcons': 'Resource Icons',
  'appearance.default': 'Default',
  'appearance.importIcon': 'Import custom icon…',
  'appearance.removeFromLibrary': 'Remove from library',
  'appearance.showLess': 'Show less',
  'appearance.showMore': 'Show more',
  'appearance.preview': 'Preview',
  'appearance.colors': 'Colors',
  'appearance.background': 'Background',
  'appearance.iconColor': 'Icon Color',
  'appearance.textColor': 'Text Color',
  'appearance.themeDefault': 'Theme default',
  'appearance.resetToTheme': 'Reset to theme default',
  'appearance.themeHint': 'Leave unset to follow the global ring theme.',
  'appearance.reset': 'Reset',
  'appearance.save': 'Save',
  'appearance.unnamed': 'Unnamed',
  'appearance.appTitle': 'Appearance',
  'appearance.renderError': 'Render error',

  'ring.slotCount': '{n}/12 slots',
  'ring.addSlot': '+ Add Slot',
  'ring.deleteSlot': 'Delete Slot',
  'ring.minSlots': 'Minimum 4 slots required',
  'ring.deleteSlotHint': 'Delete selected slot',
  'ring.subSlotCount': '{n}/8 sub-slots',
  'ring.addSubSlot': '+ Add Sub-Slot',
  'ring.deleteSubSlot': 'Delete Sub-Slot',
  'ring.deleteSubSlotHint': 'Delete selected sub-slot',
  'ring.deleteFolder': 'Delete Folder',
  'ring.deleteFolderHint': 'Delete this folder and all its sub-slots',
  'ring.newAction': 'New Action',

  'carousel.rename': 'Rename',
  'carousel.duplicate': 'Duplicate',
  'carousel.export': 'Export',
  'carousel.delete': 'Delete',
  'carousel.appSettings': 'App settings',
  'carousel.changeTarget': 'Change Target App',
  'carousel.exportAll': 'Export All Profiles',
  'carousel.importProfiles': 'Import Profiles',
  'carousel.deleteApp': 'Delete App Profile',
  'carousel.active': 'Active',
  'carousel.moreOptions': 'More options',
  'carousel.addProfile': 'Add Profile',
  'carousel.addApp': 'Add app-specific slots',
  'carousel.newProfile': 'New Profile',
  'carousel.scrollToStart': 'Scroll to Start',
  'carousel.scrollToEnd': 'Scroll to End',
  'carousel.addNewApp': 'Add New App',

  'addapp.title': 'Add Application',
  'addapp.subtitle': 'Choose how to add an app-specific button set.',
  'addapp.fromRunning': 'From Running Apps',
  'addapp.fromRunningDesc': 'Pick from currently open applications',
  'addapp.browse': 'Browse for Executable',
  'addapp.browseDesc': 'Select an .exe file from disk',
  'addapp.import': 'Import App Profile',
  'addapp.importDesc': 'Load slots and settings from a .json file',
  'addapp.back': 'Back',
  'addapp.runningApps': 'Running Apps',
  'addapp.scanning': 'Scanning processes…',
  'addapp.noWindows': 'No visible windows found.',
  'addapp.added': 'Added',
  'addapp.close': 'Close',

  'lib.gallery': 'Gallery',
  'lib.recent': 'Recent',
  'lib.favorites': 'Favorites',
  'lib.create': '+ Create Shortcut',
  'lib.import': 'Import',
  'lib.namePlaceholder': 'Shortcut name…',
  'lib.confirm': 'Create',
  'lib.cancel': 'Cancel',
  'lib.edit': 'Edit',
  'lib.noActions': 'No actions',
  'lib.actionsCount': '{n} action(s)',
  'lib.emptyGallery': 'No shortcuts yet — click "+ Create Shortcut" to add one.',
  'lib.emptyRecent': 'No recently used shortcuts.',
  'lib.emptyFavorites': 'No favorites yet — star a shortcut to add it here.',
  'lib.showMore': 'Show more',
  'lib.showLess': 'Show less',
  'lib.deleteTitle': 'Delete shortcut?',
  'lib.orphanWarning': 'Used by {n} slot(s). Deleting will leave broken references.',
  'lib.deleteAnyway': 'Delete anyway',
  'lib.headerTitle': 'Shortcut Library',
  'lib.groups': 'Groups',
  'lib.addGroup': 'Add Group',
  'lib.deleteGroup': 'Delete Group',
  'lib.deleteGroupTitle': 'Delete group?',
  'lib.deleteGroupMessage': 'Delete "{name}"? Shortcuts will be moved to Gallery.',
  'lib.exportGroup': 'Export Group',
  'lib.moveToGroup': 'Move to Group',
  'lib.duplicate': 'Duplicate',
  'lib.emptyGroup': 'No shortcuts in this group yet. Create one or drag a shortcut here.',
  'lib.createNewGroup': 'Create new group',
  'lib.viewCard': 'Card view',
  'lib.viewList': 'List view',
  'lib.search': 'Search…',
  'lib.favorite': 'Add to Favorites',
  'lib.unfavorite': 'Remove from Favorites',
  'lib.back': 'Back',
  'lib.delete': 'Delete',
  'lib.removeFromGroup': 'Remove from group',
  'lib.defaultGroup': 'Default',
  'lib.renameGroup': 'Rename Group',
  'lib.duplicateGroup': 'Duplicate Group',

  'about.description': 'A standalone action ring overlay — inspired by the Logitech MX Master 4.',

  'general.dataManagement': 'Data',
  'general.resetSettings': 'Reset All Settings',
  'general.exportAllData': 'Export All Profiles',
  'general.importAllData': 'Import All Profiles',
  'general.exportSuccess': 'Backup exported successfully.',
  'general.exportFailed': 'Export failed. Please check file permissions.',
  'general.importSuccess': 'Profiles imported successfully.',
  'general.importFailed': 'Import failed. Please check the file format.',
  'general.resetSuccess': 'Settings have been reset to defaults.',
  'general.resetConfirmTitle': 'Reset All Settings',
  'general.resetConfirmMessage': 'Are you sure you want to reset all settings to their default values? This will revert all configurations including profiles, slots, and appearance. This action cannot be undone.',
  'general.resetConfirmAction': 'Reset',

  'sidebar.title': 'Shortcuts',
  'sidebar.searchPlaceholder': 'Search shortcuts…',
  'sidebar.allShortcuts': 'All',
  'sidebar.noShortcuts': 'No shortcuts in library.',
  'sidebar.noMatch': 'No matching shortcuts.',
  'sidebar.ungrouped': 'Ungrouped',
  'sidebar.confirmOverwriteTitle': 'Replace slot contents?',
  'sidebar.confirmOverwriteMessage': 'will overwrite the current actions for this slot.',
  'sidebar.confirmOverwriteAction': 'Replace',
}

const ko: Translations = {
  'app.loading': '불러오는 중...',
  'app.error': '오류가 발생했습니다',
  'app.errorRecover': '복구 시도',
  'app.errorShowLog': '에러 로그 확인',
  'app.errorRestart': '프로그램 재시작',
  'mcp.serverRunning': 'MCP 서버 실행 중',
  'mcp.serverStopped': 'MCP 서버 중지됨',
  'mcp.clientActive': '클라이언트 활성',
  'mcp.clientIdle': '클라이언트 활동 없음',
  'mcp.port': '포트',
  'mcp.requests': '요청 수',
  'mcp.lastRequest': '마지막 요청',
  'mcp.tools': '사용 가능한 도구',
  'mcp.noRequests': '아직 요청 없음',
  'mcp.setupButton': 'MCP 설정',
  'mcp.setupTitle': 'MCP 서버 설정',
  'mcp.setupManual': '수동 설정',
  'mcp.setupManualDesc': '아래 JSON을 복사하여 AI 클라이언트의 MCP 설정에 붙여넣으세요.',
  'mcp.setupStdio': 'stdio',
  'mcp.setupHttp': 'HTTP',
  'mcp.setupQuick': '빠른 설정',
  'mcp.setupQuickDesc': 'AI 클라이언트를 선택하면 ActionRing MCP 서버가 자동으로 등록됩니다.',
  'mcp.setupWorking': '설정 중...',
  'mcp.setupDone': '등록되었습니다. 클라이언트를 재시작하세요.',
  'mcp.setupError': '설정 실패',
  'mcp.setupRestart': '재시작 필요',
  'mcp.setupResultSuccess': '등록되었습니다. 클라이언트를 재시작하여 연결하세요.',
  'mcp.setupResultFailed': '설정에 실패했습니다. 아래 오류 내용을 확인하세요.',
  'mcp.setupResultCommand': '다음 명령어를 직접 실행해 보세요:',
  'mcp.setupBack': '돌아가기',
  'mcp.copy': '복사',
  'mcp.copied': '복사됨!',
  'mcp.checking': '확인 중...',
  'mcp.notInstalled': '미설치',
  'mcp.installed': '설치됨',
  'mcp.registered': '등록됨',
  'mcp.installRequired': '설치 필요',
  'tab.configure': '액션 링',
  'tab.general': '설정',
  'tab.about': '정보',
  'tab.shortcuts': '단축어',

  'general.title': '설정',
  'general.theme': '테마',
  'general.dark': '다크',
  'general.light': '라이트',
  'general.system': '시스템',
  'general.darkDesc': '따뜻한 다크 테마',
  'general.lightDesc': '밝은 테마',
  'general.systemDesc': 'OS 설정 따르기',
  'general.trigger': '트리거',
  'general.startOnLogin': '로그인 시 자동 시작',
  'general.trayNotifications': '트레이로 최소화 시 알림 표시',
  'general.language': '언어',
  'general.leftClickWarning': '왼쪽 클릭은 일반 클릭과의 충돌을 방지하기 위해 최소 하나의 수정자 키가 필요합니다.',

  'recorder.clickToRecord': '클릭하여 키보드 트리거 녹화',
  'recorder.clickToSave': '클릭으로 저장 — Esc로 취소',
  'recorder.recording': '녹화 중…',
  'recorder.pressKeys': '키를 누르세요…',
  'recorder.none': '없음',
  'recorder.clickToSaveHint': '클릭으로 저장',
  'recorder.clickToChangeHint': '클릭하여 마우스 버튼 변경',
  'recorder.listening': '대기 중…',
  'recorder.listenMsg': '마우스 버튼을 클릭하세요…',

  'mouse.1': '왼쪽 클릭',
  'mouse.2': '오른쪽 클릭',
  'mouse.3': '가운데 클릭',
  'mouse.4': '사이드 버튼 1',
  'mouse.5': '사이드 버튼 2',
  'mouse.n': '버튼',

  'panel.ringLayout': '링 레이아웃',
  'panel.distance': '거리',
  'panel.buttonSize': '버튼 크기',
  'panel.iconSize': '아이콘 크기',
  'panel.textSize': '텍스트 크기',
  'panel.showText': '텍스트 표시',
  'panel.appearance': '외관',
  'panel.opacity': '불투명도',
  'panel.animSpeed': '애니메이션 속도',
  'panel.animPreview': '애니메이션 미리보기',
  'panel.small': '작게',
  'panel.large': '크게',
  'panel.slow': '느리게',
  'panel.normal': '보통',
  'panel.fast': '빠르게',
  'panel.categoryLayout': '레이아웃',
  'panel.categoryText': '텍스트',
  'panel.categoryAnimation': '애니메이션',

  'slot.shortcuts': '단축어',
  'slot.editShortcuts': '단축어 편집 ›',
  'slot.noActions': '단축어가 없습니다 — 오른쪽 패널에서 드래그하여 할당하세요.',
  'slot.folder': '폴더',
  'slot.editSubSlots': '서브 슬롯 편집',
  'slot.noSubSlots': '서브 슬롯 없음 — "+ 서브 슬롯 추가"를 사용하세요.',
  'slot.subSlotsConfigured': '서브 슬롯 {n}개 설정됨 — 클릭하여 편집하세요.',
  'slot.subSlotsCount': '서브 슬롯 {n}개 설정됨',
  'slot.clickFolderHint': '미리보기에서 폴더 버튼을 클릭하여 서브 슬롯을 편집하세요.',
  'slot.importPreset': '프리셋 가져오기',
  'slot.exportPreset': '프리셋 내보내기',
  'slot.editAppearance': '외관 편집',
  'slot.typeShortcut': '단축어',
  'slot.typeFolder': '폴더',

  'shortcuts.undo': '실행 취소',
  'shortcuts.redo': '다시 실행',
  'shortcuts.importActions': '작업 가져오기',
  'shortcuts.exportActions': '작업 내보내기',
  'shortcuts.play': '시퀀스 실행',
  'shortcuts.playing': '실행 중…',
  'shortcuts.doubleClickToRename': '더블클릭으로 이름 변경',
  'shortcuts.clickToRename': '클릭하여 이름 변경',
  'shortcuts.executionError': '실행 실패',
  'shortcuts.addToStart': '처음으로 넣기',
  'shortcuts.addToEnd': '마지막에 넣기',
  'shortcuts.noVarsAvailable': '사용 가능한 변수 없음',
  'shortcuts.noReturnValsAvailable': '사용 가능한 반환값 없음',
  'shortcuts.selectVariable': '변수 선택',
  'shortcuts.selectReturnValue': '반환값 선택',

  'modal.editShortcuts': '단축어 편집',
  'modal.sequence': '순서 — 위에서 아래로 실행',
  'modal.noActionsYet': '작업 없음 — 라이브러리에서 드래그하세요 →',
  'modal.searchActions': '작업 검색…',
  'modal.cancel': '취소',
  'modal.save': '저장',
  'modal.browse': '찾아보기',
  'modal.appPath': '앱 또는 파일 경로…',
  'modal.shellCmd': '예: notepad.exe',
  'modal.dragToReorder': '드래그하여 순서 변경',
  'modal.remove': '제거',

  'action.launch': '앱 실행',
  'action.keyboard': '키보드',
  'action.shell': '셸 명령',
  'action.system': '시스템 작업',
  'action.link': '링크 열기',
  'action.mouseMove': '마우스 이동',
  'action.mouseClick': '마우스 클릭',
  'action.launchDesc': '앱 또는 파일 열기',
  'action.keyboardDesc': '키 조합 전송',
  'action.shellDesc': '터미널 명령 실행',
  'action.systemDesc': '시스템 기능 제어',
  'action.linkDesc': '기본 브라우저에서 URL 열기',
  'action.mouseMoveDesc': '커서를 지정 위치로 이동',
  'action.mouseClickDesc': '마우스 버튼 클릭 시뮬레이션',

  // 마우스 액션 라벨
  'mouse.modeSet': '설정 (절대좌표)',
  'mouse.modeOffset': '이동 (상대좌표)',
  'mouse.x': 'X',
  'mouse.y': 'Y',
  'mouse.button': '버튼',
  'mouse.left': '좌클릭',
  'mouse.right': '우클릭',
  'mouse.middle': '휠 클릭',
  'mouse.side1': '사이드 버튼 1',
  'mouse.side2': '사이드 버튼 2',
  'mouse.wheelUp': '휠 위로',
  'mouse.wheelDown': '휠 아래로',

  'action.ifElse': '조건',
  'action.ifElseDesc': '여러 조건에 따라 실행 분기',
  'action.loop': '반복',
  'action.loopDesc': '일련의 동작을 N번 반복',
  'action.sequence': '시퀀스',
  'action.sequenceDesc': '독립 작업으로 병렬 실행',
  'action.wait': '대기',
  'action.waitDesc': '설정된 시간만큼 실행 일시 중지',
  'action.setVar': '변수',
  'action.setVarDesc': '변수에 값 설정 (문자열, 숫자, 불리언 자동 추론)',
  'action.list': '리스트',
  'action.listDesc': '리스트 변수 생성 또는 수정',
  'action.dict': '딕셔너리',
  'action.dictDesc': '딕셔너리 변수 생성 또는 수정',
  'action.toast': '토스트 알림',
  'action.toastDesc': '시스템 알림 메시지 표시',
  'action.runShortcut': '단축어 실행',
  'action.runShortcutDesc': '입력값을 전달하고 반환값을 캡처하여 단축어 실행',

  'action.escape': '탈출',
  'action.escapeDesc': '현재 반복문 탈출',
  'action.stop': '중지',
  'action.stopDesc': '전체 단축어 시퀀스를 즉시 중단',
  'action.calculate': '계산',
  'action.calculateDesc': '수학 연산을 수행하고 결과를 저장',
  'action.comment': '주석',
  'action.commentDesc': '문서화 노트 — 실행에 영향 없음',
  'action.clipboard': '클립보드',
  'action.clipboardDesc': '시스템 클립보드 읽기 또는 쓰기',
  'action.text': '텍스트',
  'action.textDesc': '텍스트 문자열 처리 및 변환',
  'action.transform': '변환',
  'action.transformDesc': '데이터 형식 변환 (JSON, Base64, URL, Hash)',
  'action.askInput': '입력 요청',
  'action.askInputDesc': '사용자에게 텍스트 입력을 받는 다이얼로그 표시',
  'action.chooseFromList': '목록 선택',
  'action.chooseFromListDesc': '목록에서 하나 이상의 항목을 선택하게 함',
  'action.showAlert': '알림 표시',
  'action.showAlertDesc': '확인/취소 버튼이 있는 알림 다이얼로그 표시',
  'action.httpRequest': 'HTTP 요청',
  'action.httpRequestDesc': 'HTTP 요청을 보내고 응답을 캡처',
  'action.file': '파일',
  'action.fileDesc': '파일 시스템에서 파일 읽기, 쓰기 및 관리',
  'action.dateTime': '날짜/시간',
  'action.dateTimeDesc': '날짜와 시간을 가져오고 포맷하고 계산',
  'action.tryCatch': '트라이-캐치',
  'action.tryCatchDesc': '에러 처리와 함께 액션 실행',
  'action.registry': '레지스트리',
  'action.registryDesc': 'Windows 레지스트리 키 읽기, 쓰기, 삭제',
  'action.environment': '환경변수',
  'action.environmentDesc': '환경변수 가져오기, 설정, 목록 조회',
  'action.service': '서비스',
  'action.serviceDesc': 'Windows 서비스 관리 (시작, 중지, 상태)',

  'script.clipboardGet': '가져오기',
  'script.clipboardSet': '설정',
  'script.clipboardValue': '값',

  'script.textModeReplace': '치환',
  'script.textModeSplit': '분할',
  'script.textModeCombine': '결합',
  'script.textModeCase': '대소문자',
  'script.textModeMatch': '매칭',
  'script.textModeSubstring': '부분문자열',
  'script.textModeLength': '길이',
  'script.textModeTrim': '공백제거',
  'script.textModePad': '패딩',
  'script.textInput': '입력',
  'script.textFind': '찾기',
  'script.textReplaceWith': '바꿀 내용',
  'script.textRegex': '정규식',
  'script.textSeparator': '구분자',
  'script.textListVar': '$리스트',
  'script.textCaseUpper': '대문자',
  'script.textCaseLower': '소문자',
  'script.textCaseCapitalize': '첫글자대문자',
  'script.textCaseCamel': 'camelCase',
  'script.textCaseSnake': 'snake_case',
  'script.textCaseKebab': 'kebab-case',
  'script.textPattern': '정규식 패턴',
  'script.textMatchAll': '전체',
  'script.textStart': '시작',
  'script.textLength': '길이',
  'script.textPadLength': '패딩 길이',
  'script.textPadChar': '문자',
  'script.textPadStart': '앞',
  'script.textPadEnd': '뒤',

  'script.transformJsonParse': 'JSON 파싱',
  'script.transformJsonStringify': 'JSON 문자열화',
  'script.transformUrlEncode': 'URL 인코딩',
  'script.transformUrlDecode': 'URL 디코딩',
  'script.transformBase64Encode': 'Base64 인코딩',
  'script.transformBase64Decode': 'Base64 디코딩',
  'script.transformHash': '해시',
  'script.transformAlgorithm': '알고리즘',

  'script.askInputTitle': '제목',
  'script.askInputPrompt': '안내 문구',
  'script.askInputDefault': '기본값',
  'script.askInputTypeText': '텍스트',
  'script.askInputTypeNumber': '숫자',
  'script.askInputTypePassword': '비밀번호',

  'script.chooseTitle': '제목',
  'script.chooseItems': '항목',
  'script.chooseListVar': '$리스트',
  'script.chooseMultiple': '복수',
  'script.chooseAddItem': '+ 항목',
  'script.chooseSourceItems': '항목',
  'script.chooseSourceVariable': '변수',

  'script.alertTitle': '제목',
  'script.alertMessage': '메시지',
  'script.alertConfirmText': '확인 텍스트',
  'script.alertCancelText': '취소 텍스트',

  'script.httpUrl': 'URL',
  'script.httpMethod': '메서드',
  'script.httpHeaders': '헤더 JSON',
  'script.httpBody': '본문',
  'script.httpTimeout': '타임아웃 (ms)',
  'script.httpStatusVar': '상태 변수',

  'script.fileModeRead': '읽기',
  'script.fileModeWrite': '쓰기',
  'script.fileModeExists': '존재 확인',
  'script.fileModeList': '목록',
  'script.fileModePick': '선택',
  'script.fileModeInfo': '정보',
  'script.fileModeDelete': '삭제',
  'script.fileModeRename': '이름 변경',
  'script.fileModeCopy': '복사',
  'script.filePath': '경로',
  'script.fileContent': '내용',
  'script.fileEncoding': '인코딩',
  'script.fileWriteOverwrite': '덮어쓰기',
  'script.fileWriteAppend': '추가',
  'script.filePattern': '글로브 패턴',
  'script.filePickTitle': '다이얼로그 제목',
  'script.fileFilters': '필터 JSON',
  'script.filePickFile': '파일',
  'script.filePickDirectory': '디렉토리',
  'script.fileDestination': '대상 경로',
  'script.fileInfoSize': '크기',
  'script.fileInfoModified': '수정일',
  'script.fileInfoCreated': '생성일',
  'script.fileInfoExtension': '확장자',
  'script.fileInfoName': '파일명',
  'script.fileInfoDirectory': '디렉토리',

  'script.dtModeNow': '현재',
  'script.dtModeFormat': '포맷',
  'script.dtModeMath': '연산',
  'script.dtModeDiff': '차이',
  'script.dtModeParse': '파싱',
  'script.dtInput': '날짜 입력',
  'script.dtFormat': '포맷',
  'script.dtAmount': '양',
  'script.dtUnitYears': '년',
  'script.dtUnitMonths': '월',
  'script.dtUnitDays': '일',
  'script.dtUnitHours': '시간',
  'script.dtUnitMinutes': '분',
  'script.dtUnitSeconds': '초',
  'script.dtUnitMs': '밀리초',
  'script.dtDate1': '날짜1',
  'script.dtDate2': '날짜2',

  'script.tryLabel': '시도',
  'script.catchLabel': '실패시',
  'script.tryCatchEnd': '트라이 끝',
  'script.errorVar': '에러 변수',

  'script.regModeRead': '읽기',
  'script.regModeWrite': '쓰기',
  'script.regModeDelete': '삭제',
  'script.regModeExists': '존재 확인',
  'script.regKeyPath': '키 경로',
  'script.regValueName': '값 이름',
  'script.regData': '데이터',

  'script.envModeGet': '가져오기',
  'script.envModeSet': '설정',
  'script.envModeList': '목록',
  'script.envName': '변수 이름',
  'script.envValue': '값',

  'script.svcModeStatus': '상태',
  'script.svcModeStart': '시작',
  'script.svcModeStop': '중지',
  'script.svcModeRestart': '재시작',
  'script.svcName': '서비스 이름',

  'palette.sub.windows': 'Windows',

  'palette.all': '전체',
  'palette.actions': '액션',
  'palette.scripts': '스크립트',
  'palette.values': '값',
  'palette.shortcuts': '단축어',
  'palette.allGroups': '전체 그룹',
  'palette.variables': '변수',
  'palette.returnValues': '반환값',
  'palette.noValues': '아직 정의된 값이 없습니다',
  'palette.valueNotDefined': '값이 정의되기 전이므로 할당할 수 없습니다',
  'palette.sub.controls': '조작',
  'palette.sub.system': '시스템',
  'palette.sub.flow': '제어',
  'palette.sub.data': '데이터',
  'palette.sub.interaction': '상호작용',
  'palette.sub.io': '입출력',
  'palette.sub.utility': '유틸리티',

  'script.condition': '조건',
  'script.thenLabel': '그러면',
  'script.elseLabel': '아니면',
  'script.bodyLabel': '본문',
  'script.repeatTimes': '번',
  'script.delayMs': 'ms',
  'script.varName': '변수 이름',
  'script.varValue': '값',
  'script.varLocal': '로컬',
  'script.message': '메시지',
  'script.addAction': '+ 액션 추가',
  'script.noSubActions': '액션 없음 — "+ 액션 추가" 클릭',
  'script.selectShortcut': '단축어 선택…',
  'script.noShortcuts': '라이브러리에 단축어 없음',
  'script.pickFromVariable': '변수에서 불러오기',
  'script.pickFromReturnValue': '반환값에서 가져오기',
  'script.browseFile': '파일 찾아보기',
  'script.addInput': '+ 입력 추가',
  'script.inputParam': '매개변수',
  'script.inputValue': '값 / $변수',
  'script.outputVar': '→ $출력',
  'script.conditionHint': '예: $count > 3, $name == hello, $flag',
  'script.matchLogicPrefix': '일치',
  'script.matchAll': '모두',
  'script.matchAny': '하나라도',
  'script.addCriteria': '+ 조건 추가',
  'script.conditionVar': '$변수',
  'script.conditionVal': '값',

  'script.conditionModeIfElse': '참 또는 거짓',
  'script.conditionModeSwitch': '특정 값',
  'script.switchValue': '$변수',
  'script.caseLabel': '분기',
  'script.defaultLabel': '기본',
  'script.addCase': '+ 분기 추가',
  'script.addDefault': '+ 기본 분기 추가',
  'script.endSwitch': 'END SWITCH',

  'script.loopModeRepeat': '반복',
  'script.loopModeFor': 'For',
  'script.loopModeForeach': 'ForEach',
  'script.loopIterVar': '$인덱스',
  'script.loopTo': '까지',
  'script.loopStep': '간격',
  'script.loopItemVar': '$항목',
  'script.loopKeyVar': '$키',
  'script.loopListVar': '$리스트',
  'script.loopAssignCount': '현재 순환 횟수',
  'script.loopAssignIndex': '현재 순환값 (i)',
  'script.loopAssignValue': '현재 Value',
  'script.loopAssignKey': '현재 Key',
  'script.loopForeachIndex': '현재 인덱스',
  'script.loopForeachValue': '현재 값',
  'script.loopForeachKey': '현재 Key',
  'script.loopForeachDictValue': '현재 Value',

  'script.varDataType': '타입',
  'script.varTypeSingle': '단일',
  'script.varTypeList': '리스트',
  'script.varTypeDict': '딕셔너리',
  'script.varModeDefine': '정의',
  'script.varModeEdit': '편집',
  'script.varOpSet': '설정',
  'script.varOpGet': '가져오기',
  'script.varOpPush': '추가',
  'script.varOpRemove': '제거',
  'script.varKey': '키 / 인덱스',
  'script.varResultVar': '→ $결과',
  'script.varAddItem': '+ 항목 추가',
  'script.varAddEntry': '+ 항목 추가',
  'script.varItemPlaceholder': '항목 값',
  'script.varKeyPlaceholder': '키',
  'script.varValuePlaceholder': '값',

  'script.stopReturnVar': '$변수 설정',
  'script.stopReturnValue': '값',

  'script.calcOpAdd': '더하기 (+)',
  'script.calcOpSub': '빼기 (-)',
  'script.calcOpMul': '곱하기 (×)',
  'script.calcOpDiv': '나누기 (÷)',
  'script.calcOpMod': '나머지 (%)',
  'script.calcOpFloorDiv': '정수 나누기 (//)',
  'script.calcOpPow': '거듭제곱 (^)',
  'script.calcOpSqrt': '제곱근 (√)',
  'script.calcResult': '→ $결과',
  'script.toastTitle': '타이틀 (선택)',
  'script.toastBody': '내용',

  'script.sequenceName': '이름',
  'script.sequenceBody': '병렬',
  'script.sequenceEnd': '시퀀스 끝',
  'script.showProgress': '진행률',
  'script.waitManual': '지연',
  'script.waitVariable': '변수',
  'script.waitAppExit': '앱 종료',
  'script.waitAppTarget': '실행 대상',
  'script.waitKeyInput': '키 입력',

  'script.commentPlaceholder': '주석 작성…',
  'script.launchPid': 'PID',
  'script.labelTarget': '대상',
  'script.labelKeys': '단축키',
  'script.labelCommand': '명령어',
  'script.labelCount': '횟수',
  'script.labelStart': '시작',
  'script.labelVariable': '변수',
  'script.labelResult': '결과',

  'script.selectReturnValue': '반환값 선택',
  'script.returnValuePickerHint': '각 액션 아래의 반환값을 클릭하여 사용하세요',
  'script.returnLaunchTarget': '앱 경로',
  'script.returnKeysCombo': '키 조합',
  'script.returnExitCode': '종료 코드',
  'script.returnLoopCount': '반복 횟수',
  'script.returnLoopIndex': '마지막 인덱스',
  'script.returnLoopItem': '마지막 항목',
  'script.returnVarValue': '값',
  'script.returnOutputVar': '출력값',
  'script.returnResultVar': '결과값',
  'script.returnReturnVar': '반환값',

  'system.volume-up': '볼륨 높이기',
  'system.volume-down': '볼륨 낮추기',
  'system.mute': '음소거',
  'system.play-pause': '재생 / 일시정지',
  'system.screenshot': '스크린샷',
  'system.lock-screen': '화면 잠금',
  'system.show-desktop': '바탕화면 보기',

  'win.minimize': '최소화',
  'win.maximize': '최대화',
  'win.restore': '이전 크기로',
  'win.close': '닫기',

  'iconPicker.title': '아이콘 선택',

  'appearance.icon': '아이콘',
  'appearance.search': '검색…',
  'appearance.recentlyUsed': '최근 사용',
  'appearance.custom': '사용자 정의',
  'appearance.resourceIcons': '리소스 아이콘',
  'appearance.default': '기본',
  'appearance.importIcon': '아이콘 가져오기…',
  'appearance.removeFromLibrary': '라이브러리에서 제거',
  'appearance.showLess': '접기',
  'appearance.showMore': '더 보기',
  'appearance.preview': '미리보기',
  'appearance.colors': '색상',
  'appearance.background': '배경',
  'appearance.iconColor': '아이콘 색상',
  'appearance.textColor': '텍스트 색상',
  'appearance.themeDefault': '테마 기본값',
  'appearance.resetToTheme': '테마 기본값으로 초기화',
  'appearance.themeHint': '전역 링 테마를 따르려면 비워두세요.',
  'appearance.reset': '초기화',
  'appearance.save': '저장',
  'appearance.unnamed': '이름 없음',
  'appearance.appTitle': '외관',
  'appearance.renderError': '렌더링 오류',

  'ring.slotCount': '{n}/12 슬롯',
  'ring.addSlot': '+ 슬롯 추가',
  'ring.deleteSlot': '슬롯 삭제',
  'ring.minSlots': '최소 4개의 슬롯이 필요합니다',
  'ring.deleteSlotHint': '선택한 슬롯 삭제',
  'ring.subSlotCount': '{n}/8 서브슬롯',
  'ring.addSubSlot': '+ 서브슬롯 추가',
  'ring.deleteSubSlot': '서브슬롯 삭제',
  'ring.deleteSubSlotHint': '선택한 서브슬롯 삭제',
  'ring.deleteFolder': '폴더 삭제',
  'ring.deleteFolderHint': '이 폴더와 모든 서브슬롯을 삭제',
  'ring.newAction': '새 작업',

  'carousel.rename': '이름 변경',
  'carousel.duplicate': '복제',
  'carousel.export': '내보내기',
  'carousel.delete': '삭제',
  'carousel.appSettings': '앱 설정',
  'carousel.changeTarget': '대상 앱 변경',
  'carousel.exportAll': '모든 프로필 내보내기',
  'carousel.importProfiles': '프로필 가져오기',
  'carousel.deleteApp': '앱 프로필 삭제',
  'carousel.active': '활성',
  'carousel.moreOptions': '더 보기',
  'carousel.addProfile': '프로필 추가',
  'carousel.addApp': '앱별 슬롯 추가',
  'carousel.newProfile': '새 프로필',
  'carousel.scrollToStart': '맨 좌측으로 이동',
  'carousel.scrollToEnd': '맨 우측으로 이동',
  'carousel.addNewApp': '새로운 앱 항목 추가',

  'addapp.title': '앱 추가',
  'addapp.subtitle': '앱별 버튼 세트를 추가하는 방법을 선택하세요.',
  'addapp.fromRunning': '실행 중인 앱에서',
  'addapp.fromRunningDesc': '현재 열려 있는 앱에서 선택',
  'addapp.browse': '실행 파일 찾아보기',
  'addapp.browseDesc': '디스크에서 .exe 파일 선택',
  'addapp.import': '앱 프로필 가져오기',
  'addapp.importDesc': '.json 파일에서 슬롯과 설정 불러오기',
  'addapp.back': '뒤로',
  'addapp.runningApps': '실행 중인 앱',
  'addapp.scanning': '프로세스 검색 중…',
  'addapp.noWindows': '표시 가능한 창이 없습니다.',
  'addapp.added': '추가됨',
  'addapp.close': '닫기',

  'lib.gallery': '갤러리',
  'lib.recent': '최근',
  'lib.favorites': '즐겨찾기',
  'lib.create': '+ 단축어 만들기',
  'lib.import': '가져오기',
  'lib.namePlaceholder': '단축어 이름…',
  'lib.confirm': '만들기',
  'lib.cancel': '취소',
  'lib.edit': '편집',
  'lib.noActions': '작업 없음',
  'lib.actionsCount': '{n}개 작업',
  'lib.emptyGallery': '단축어가 없습니다. "+ 단축어 만들기"를 클릭하여 추가하세요.',
  'lib.emptyRecent': '최근 사용한 단축어가 없습니다.',
  'lib.emptyFavorites': '즐겨찾기가 없습니다. 별표를 눌러 추가하세요.',
  'lib.showMore': '더 보기',
  'lib.showLess': '접기',
  'lib.deleteTitle': '단축어를 삭제하시겠습니까?',
  'lib.orphanWarning': '{n}개 슬롯에서 사용 중입니다. 삭제하면 참조가 끊어집니다.',
  'lib.deleteAnyway': '삭제',
  'lib.headerTitle': '단축어 라이브러리',
  'lib.groups': '그룹',
  'lib.addGroup': '그룹 추가',
  'lib.deleteGroup': '그룹 삭제',
  'lib.deleteGroupTitle': '그룹을 삭제하시겠습니까?',
  'lib.deleteGroupMessage': '"{name}"을 삭제하시겠습니까? 단축어는 갤러리로 이동됩니다.',
  'lib.exportGroup': '그룹 내보내기',
  'lib.moveToGroup': '그룹으로 이동',
  'lib.duplicate': '복제',
  'lib.emptyGroup': '이 그룹에 단축어가 없습니다. 만들거나 여기로 드래그하세요.',
  'lib.createNewGroup': '새 그룹 만들기',
  'lib.viewCard': '카드 보기',
  'lib.viewList': '목록 보기',
  'lib.search': '검색…',
  'lib.favorite': '즐겨찾기에 추가',
  'lib.unfavorite': '즐겨찾기 제거',
  'lib.back': '뒤로',
  'lib.delete': '삭제',
  'lib.removeFromGroup': '그룹에서 제거',
  'lib.defaultGroup': '기본',
  'lib.renameGroup': '그룹명 변경',
  'lib.duplicateGroup': '그룹 복제',

  'about.description': 'Logitech MX Master 4에서 영감을 받은 독립형 액션 링 오버레이입니다.',

  'general.dataManagement': '데이터',
  'general.resetSettings': '모든 설정 초기화',
  'general.exportAllData': '모든 프로필 내보내기',
  'general.importAllData': '모든 프로필 가져오기',
  'general.exportSuccess': '백업을 성공적으로 내보냈습니다.',
  'general.exportFailed': '내보내기에 실패했습니다. 파일 권한을 확인하세요.',
  'general.importSuccess': '프로필을 성공적으로 가져왔습니다.',
  'general.importFailed': '가져오기 실패. 파일 형식을 확인하세요.',
  'general.resetSuccess': '설정이 기본값으로 초기화되었습니다.',
  'general.resetConfirmTitle': '모든 설정 초기화',
  'general.resetConfirmMessage': '모든 설정을 기본값으로 초기화하시겠습니까? 프로필, 슬롯, 외관을 포함한 모든 구성이 초기화됩니다. 이 작업은 되돌릴 수 없습니다.',
  'general.resetConfirmAction': '초기화',

  'sidebar.title': '단축어',
  'sidebar.searchPlaceholder': '단축어 검색…',
  'sidebar.allShortcuts': '전체',
  'sidebar.noShortcuts': '라이브러리에 단축어가 없습니다.',
  'sidebar.noMatch': '일치하는 단축어가 없습니다.',
  'sidebar.ungrouped': '미분류',
  'sidebar.confirmOverwriteTitle': '슬롯 내용을 교체할까요?',
  'sidebar.confirmOverwriteMessage': '현재 슬롯의 동작이 교체됩니다.',
  'sidebar.confirmOverwriteAction': '교체',
}

export const translations: Record<Language, Translations> = { en, ko }

export const LANGUAGES: { value: Language; nativeLabel: string }[] = [
  { value: 'en', nativeLabel: 'English' },
  { value: 'ko', nativeLabel: '한국어' },
]
