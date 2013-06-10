const Lang = imports.lang;
const Wm = imports.ui.windowManager; 
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const Me = imports.misc.extensionUtils.getCurrentExtension().imports;
const Cube = Me.cube;

let bindings = ['switch-to-workspace-left',
                'switch-to-workspace-right',
                'switch-to-workspace-up',
                'switch-to-workspace-down',
                'move-to-workspace-left',
                'move-to-workspace-right',
                'move-to-workspace-up',
                'move-to-workspace-down'];

function onSwitch(display, screen, window, binding) {
	new Cube.Cube(display, screen, window, binding);
}

function init() {
}

function enable() {	
	for (let i in bindings) {
	    Main.wm.setCustomKeybindingHandler(bindings[i],
	        Shell.KeyBindingMode.NORMAL |
	        Shell.KeyBindingMode.OVERVIEW,
	        Lang.bind(this, onSwitch));
	}
}

function disable() {
    for (let i in bindings) {
	    Main.wm.setCustomKeybindingHandler(bindings[i],
	        Shell.KeyBindingMode.NORMAL |
	        Shell.KeyBindingMode.OVERVIEW,
	        Lang.bind(Main.wm, Main.wm._showWorkspaceSwitcher));
	}
}
