const St = imports.gi.St;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const Lang = imports.lang;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;
const Background = imports.ui.background;

const ANIMATION_TIME = 0.15;

function Cube() {
	this._init.apply(this, arguments);
}

Cube.prototype = {
	_init: function(display, screen, window, binding) {
    	this.from = null;
    	this.to = null;
    	this.is_animating = false;
    	this.destroy_requested = false;
		this.monitor = Main.layoutManager.primaryMonitor;
		
		let [,,,direction] = binding.get_name().split('-');
        let direction = Meta.MotionDirection[direction.toUpperCase()];
        this.direction = direction;
        this.last_direction = direction;

        if (direction != Meta.MotionDirection.UP &&
            direction != Meta.MotionDirection.DOWN)
            return;
        
        let active_workspace = global.screen.get_active_workspace();
    	let new_workspace = global.screen.get_active_workspace().get_neighbor(direction); 
    	if (active_workspace.index() == new_workspace.index())
	    	return;
				
		this.actor = new St.Widget({ reactive: true,
            x: 0,
            y: 0,
            width: global.screen_width,
            height: global.screen_height,
            visible: true });
        
		Main.uiGroup.add_actor(this.actor);
		
        this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));
        this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
        
        this.initBackground();
        this.dimBackground();

		Main.pushModal(this.actor);
		
		let mask = binding.get_mask();
		this._modifierMask = imports.ui.switcherPopup.primaryModifier(mask);
		global.window_group.hide();
		Main.panel.actor.opacity = 0;
				
		this.startAnimate(direction);
		this.actor.show();
	},
	
	get_workspace_clone_scaled: function(workspaceIndex, direction) {
		let clone = this.get_workspace_clone(workspaceIndex);
		clone.set_scale(0.8, 0.8);
		clone.x = this.monitor.width / 2;
    	return clone;
	},
	
	get_workspace_clone: function(workspaceIndex) {
        let clone = new Clutter.Group({clip_to_allocation: true});
        clone.set_size(this.monitor.width, this.monitor.height);

    	let background = new Meta.BackgroundGroup();
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            new Background.BackgroundManager({ container: background,
                                               monitorIndex: i, });
        }
        clone.add_actor(background);

        let panel = new Clutter.Clone({source: Main.panel.actor});
        clone.add_actor(panel);

        let workspaceWindows = [];
        let windows = global.get_window_actors();
        for (let i = 0; i < windows.length; i++) {
            let meta_window = windows[i].get_meta_window();
            if (meta_window.get_workspace().index() == workspaceIndex && !meta_window.minimized) {
                workspaceWindows.push(meta_window);
            }
        }

        workspaceWindows.sort(Lang.bind(this, this._sortWindow));
        for (let i = 0; i < workspaceWindows.length; i++) {
            let texture = workspaceWindows[i].get_compositor_private().get_texture();
            let rect = workspaceWindows[i].get_outer_rect();
            let windowClone = new Clutter.Clone(
                {source: texture,
                 reactive: true,
                 x: rect.x,
                 y: rect.y,
                });

            clone.add_actor(windowClone);
        }

        return clone;
    },

    _sortWindow : function(window1, window2) {
        let t1 = window1.get_user_time();
        let t2 = window2.get_user_time();
        if (t2 < t1) {
            return 1;
        } else {
            return -1;
        }
    },
    
    startAnimate: function(direction) {
    	let active_workspace = global.screen.get_active_workspace();
    	let new_workspace = global.screen.get_active_workspace().get_neighbor(direction);    	
    	
		let from_workspace;
		let to_workspace;
		let needScale = true;
		
		if (this.to != null) {
		    from_workspace = this.to;
		    needScale = false;
		    if (active_workspace.index() == new_workspace.index()) {
	    		this.bounce(from_workspace, direction);
		    	return;
            }
		} else {
        	from_workspace = this.get_workspace_clone(active_workspace.index());
        	this.actor.add_actor(from_workspace);
        }
    	
    	if (direction == this.last_direction) {
        	if (this.from != null) {
        	    to_workspace = this.get_workspace_clone_scaled(new_workspace.index(), direction);
            	this.actor.remove_actor(this.from);
            	this.from.destroy();
        	} else {
        	    to_workspace = this.get_workspace_clone(new_workspace.index());
        	}
        	this.actor.add_actor(to_workspace);
        } else {
        	to_workspace = this.from;
        }
    	
    	this.from = from_workspace;
    	this.to = to_workspace;
    	this.last_direction = direction;
    	
    	new_workspace.activate(global.get_current_time());
    	
    	this.prepare(from_workspace, to_workspace, direction, needScale);
	},
    
    prepare: function(from, to, direction, needScale) {
		from.show();
		to.show();
		
    	if (direction == Meta.MotionDirection.DOWN) {
    	    let y_pos = 0;
    	    if (!needScale)
    	        y_pos = this.monitor.height * 0.1;
    		from.move_anchor_point_from_gravity(Clutter.Gravity.NORTH);
    		from.set_position(this.monitor.width / 2, y_pos);

    		to.move_anchor_point_from_gravity(Clutter.Gravity.SOUTH);
    		to.set_position(this.monitor.width / 2, this.monitor.height * 0.1);
    		to.rotation_angle_x = 90;
    	} else {
    	    let y_pos = this.monitor.height;
    	    if (!needScale)
    	        y_pos = y_pos * 0.9;
    	    from.move_anchor_point_from_gravity(Clutter.Gravity.SOUTH);
    		from.set_position(this.monitor.width / 2, y_pos);

    		to.move_anchor_point_from_gravity(Clutter.Gravity.NORTH);
    		to.set_position(this.monitor.width / 2, this.monitor.height * 0.9);
    		to.rotation_angle_x = -90;
    	}
    	
    	to.set_scale(0.8, 0.8);
    	from.raise_top();
    	if (needScale)
    		this.scale(from, to, direction);
    	else
    	    this.rotate_mid(from, to, direction);
    },
    
    scale: function(from, to, direction) {
    	this.is_animating = true;
    
    	let y_pos;
    	if (direction == Meta.MotionDirection.DOWN) {
    	    y_pos = this.monitor.height * 0.1;
    	} else {
    	    y_pos = this.monitor.height * 0.9;
    	}
    	
    	Tweener.addTween(from, {
    	    scale_x: 0.8,
    	    scale_y: 0.8,
    	    y: y_pos,
    	    transition: 'easeOutQuad',
    	    time: ANIMATION_TIME,
        	onCompleteParams: [from, to, direction],
            onComplete: this.rotate_mid,
            onCompleteScope: this,
    	});
    },
    
    rotate_mid: function(from, to, direction) {
    	this.is_animating = true;
    	
    	let angle_from;
    	let angle_to;
    	if (direction == Meta.MotionDirection.DOWN) {
    	    angle_from = -45;
    	    angle_to = 45;
    	} else {
    	    angle_from = 45;
    	    angle_to = -45;
    	}    	
    
    	Tweener.addTween(from, {
    	    rotation_angle_x: angle_from,
    	    y: this.monitor.height / 2,
    	    transition: 'easeInQuad',
    	    time: ANIMATION_TIME,
    	});
    	
    	Tweener.addTween(to, {
    	    rotation_angle_x: angle_to,
    	    y: this.monitor.height / 2,
    	    transition: 'easeInQuad',
    	    time: ANIMATION_TIME,
        	onCompleteParams: [from, to, direction],
            onComplete: this.rotate_end,
            onCompleteScope: this,
    	});
    },
    
    rotate_end: function(from, to, direction) {
    	to.raise_top();
    	let y_pos;
    	let angle_from;
    	if (direction == Meta.MotionDirection.DOWN) {
    		y_pos = this.monitor.height * 0.9;
    		angle_from = -90;
    	} else {
    	    y_pos = this.monitor.height * 0.1;
    	    angle_from = 90;
    	}    	
    	    
    	Tweener.addTween(from, {
    	    rotation_angle_x: angle_from,
    	    y: y_pos,
    	    transition: 'easeOutQuad',
    	    time: ANIMATION_TIME,
    	});
    	
    	Tweener.addTween(to, {
    	    rotation_angle_x: 0,
    	    y: y_pos,
    	    transition: 'easeOutQuad',
    	    time: ANIMATION_TIME,
    	    onComplete: this.unsetIsAnimating,
    	    onCompleteScope: this,
    	});
    },

    unscale: function(from, to, direction) {
    	from.hide();
    	
    	let y_pos;
    	if (direction == Meta.MotionDirection.DOWN) {
    	    to.move_anchor_point_from_gravity(Clutter.Gravity.SOUTH);
    		to.set_position(this.monitor.width / 2, this.monitor.height * 0.9);
    	    y_pos = this.monitor.height;
    	} else {
    	    to.move_anchor_point_from_gravity(Clutter.Gravity.NORTH);
    		to.set_position(this.monitor.width / 2, this.monitor.height * 0.1)
    	    y_pos = 0;
    	}
    	
    	Tweener.addTween(to, {
    	    scale_x: 1.0,
    	    scale_y: 1.0,
    	    y: y_pos,
    	    transition: 'easeOutQuad',
    	    time: ANIMATION_TIME,
    	    onComplete: this.destroy,
    	    onCompleteScope: this,
    	});
    },
    
    bounce: function(workspace, direction) {
    	this.is_animating = true;
    	this.from.hide();
    	
    	workspace.move_anchor_point_from_gravity(Clutter.Gravity.CENTER);
    	workspace.y = this.monitor.height / 2;
    	
    	let angle;
    	if (direction == Meta.MotionDirection.DOWN)
    	    angle = -3;    
    	else
    	    angle = 3;
    	    	
    	Tweener.addTween(workspace, {
    	    rotation_angle_x: angle,
    	    transition: 'easeInQuad',
    	    time: ANIMATION_TIME * 0.75,
    	    onComplete: this.bounceBack,
    	    onCompleteScope: this,
    	    onCompleteParams: [workspace, direction],
    	});
    },
    
    bounceBack: function(workspace, direction) {
    	Tweener.addTween(workspace, {
    	    rotation_angle_x: 0,
    	    transition: 'easeOutQuad',
    	    time: ANIMATION_TIME * 0.75,
        	onComplete: this.unsetIsAnimating,
    	    onCompleteScope: this,
    	});
    },
    
    unsetIsAnimating: function() {
    	this.is_animating = false;
    	if (this.destroy_requested)
    	    this.onDestroy();
    },
    
	_keyPressEvent: function(actor, event) {
    	if (this.is_animating)
    	    return true;
    	
		switch(event.get_key_symbol()) {
        case Clutter.Down:
            this.direction = Meta.MotionDirection.DOWN;
            this.startAnimate(this.direction);
            return true;

        case Clutter.Up:
            this.direction = Meta.MotionDirection.UP
            this.startAnimate(this.direction);
            return true;
		}
		
		return true;
	},
	
	_keyReleaseEvent: function(actor, event) {
        let [_, _, mods] = global.get_pointer();
        let state = mods & this._modifierMask;

        if (state == 0) {
            if (this.is_animating)
                this.destroy_requested = true;
            else
            	this.onDestroy();
        }

        return true;
    },
    
    initBackground: function() {    	
    	this._backgroundGroup = new Meta.BackgroundGroup();
        global.overlay_group.add_child(this._backgroundGroup);
        this._backgroundGroup.hide();
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            new Background.BackgroundManager({ container: this._backgroundGroup,
                                               monitorIndex: i, });
        }
    },
    
    dimBackground: function() {    	
    	this._backgroundGroup.show();
    	let backgrounds = this._backgroundGroup.get_children();
        for (let i = 0; i < backgrounds.length; i++) {
            let background = backgrounds[i]._delegate;

            Tweener.addTween(background, {
            	brightness: 0.3,
            	time: ANIMATION_TIME,
            	transition: 'easeOutQuad'
            });
        }
    },
    
    undimBackground: function() {    	
    	let backgrounds = this._backgroundGroup.get_children();
        for (let i = 0; i < backgrounds.length; i++) {
            let background = backgrounds[i]._delegate;

            Tweener.addTween(background, {
                brightness: 1.0,
                time: ANIMATION_TIME,
                transition: 'easeOutQuad',
            });
        }
    },
    
    onDestroy: function() {
    	this.undimBackground();
    	this.unscale(this.from, this.to, this.direction);
    },

    destroy: function() {
    	global.overlay_group.remove_child(this._backgroundGroup);
    	Main.uiGroup.remove_actor(this.actor);
    	
    	Main.panel.actor.opacity = 255;
    	global.window_group.show();
    	this.actor.destroy();
    }
   
};