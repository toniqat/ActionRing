import type { Language } from '@shared/config.types'

export type { Language }

export interface Translations {
  // App
  'app.loading': string
  'app.error': string
  'app.errorRecover': string
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
