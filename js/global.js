

/* ====================================================================================================================
 * Smartmenus Start
 * ====================================================================================================================*/


/*
 * SmartMenus jQuery v0.9.7
 * http://www.smartmenus.org/
 *
 * Copyright 2014 Vasil Dinkov, Vadikom Web Ltd.
 * http://vadikom.com/
 *
 * Released under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

(function($) {

	var menuTrees = [],
		IE = !!window.createPopup, // detect it for the iframe shim
		mouse = false, // optimize for touch by default - we will detect for mouse input
		mouseDetectionEnabled = false;

	// Handle detection for mouse input (i.e. desktop browsers, tablets with a mouse, etc.)
	function initMouseDetection(disable) {
		var eNS = '.smartmenus_mouse';
		if (!mouseDetectionEnabled && !disable) {
			// if we get two consecutive mousemoves within 2 pixels from each other and within 300ms, we assume a real mouse/cursor is present
			// in practice, this seems like impossible to trick unintentianally with a real mouse and a pretty safe detection on touch devices (even with older browsers that do not support touch events)
			var firstTime = true,
				lastMove = null;
			$(document).bind(getEventsNS([
				['mousemove', function(e) {
					var thisMove = { x: e.pageX, y: e.pageY, timeStamp: new Date().getTime() };
					if (lastMove) {
						var deltaX = Math.abs(lastMove.x - thisMove.x),
							deltaY = Math.abs(lastMove.y - thisMove.y);
	 					if ((deltaX > 0 || deltaY > 0) && deltaX <= 2 && deltaY <= 2 && thisMove.timeStamp - lastMove.timeStamp <= 300) {
							mouse = true;
							// if this is the first check after page load, check if we are not over some item by chance and call the mouseenter handler if yes
							if (firstTime) {
								var $a = $(e.target).closest('a');
								if ($a.is('a')) {
									$.each(menuTrees, function() {
										if ($.contains(this.$root[0], $a[0])) {
											this.itemEnter({ currentTarget: $a[0] });
											return false;
										}
									});
								}
								firstTime = false;
							}
						}
					}
					lastMove = thisMove;
				}],
				[touchEvents() ? 'touchstart' : 'pointerover pointermove pointerout MSPointerOver MSPointerMove MSPointerOut', function(e) {
					if (isTouchEvent(e.originalEvent)) {
						mouse = false;
					}
				}]
			], eNS));
			mouseDetectionEnabled = true;
		} else if (mouseDetectionEnabled && disable) {
			$(document).unbind(eNS);
			mouseDetectionEnabled = false;
		}
	}

	function isTouchEvent(e) {
		return !/^(4|mouse)$/.test(e.pointerType);
	}

	// we use this just to choose between toucn and pointer events when we need to, not for touch screen detection
	function touchEvents() {
		return 'ontouchstart' in window;
	}

	// returns a jQuery bind() ready object
	function getEventsNS(defArr, eNS) {
		if (!eNS) {
			eNS = '';
		}
		var obj = {};
		$.each(defArr, function(index, value) {
			obj[value[0].split(' ').join(eNS + ' ') + eNS] = value[1];
		});
		return obj;
	}

	$.SmartMenus = function(elm, options) {
		this.$root = $(elm);
		this.opts = options;
		this.rootId = ''; // internal
		this.$subArrow = null;
		this.subMenus = []; // all sub menus in the tree (UL elms) in no particular order (only real - e.g. UL's in mega sub menus won't be counted)
		this.activatedItems = []; // stores last activated A's for each level
		this.visibleSubMenus = []; // stores visible sub menus UL's
		this.showTimeout = 0;
		this.hideTimeout = 0;
		this.scrollTimeout = 0;
		this.clickActivated = false;
		this.zIndexInc = 0;
		this.$firstLink = null; // we'll use these for some tests
		this.$firstSub = null; // at runtime so we'll cache them
		this.disabled = false;
		this.$disableOverlay = null;
		this.isTouchScrolling = false;
		this.init();
	};

	$.extend($.SmartMenus, {
		hideAll: function() {
			$.each(menuTrees, function() {
				this.menuHideAll();
			});
		},
		destroy: function() {
			while (menuTrees.length) {
				menuTrees[0].destroy();
			}
			initMouseDetection(true);
		},
		prototype: {
			init: function(refresh) {
				var self = this;

				if (!refresh) {
					menuTrees.push(this);

					this.rootId = (new Date().getTime() + Math.random() + '').replace(/\D/g, '');

					if (this.$root.hasClass('sm-rtl')) {
						this.opts.rightToLeftSubMenus = true;
					}

					// init root (main menu)
					var eNS = '.smartmenus';
					this.$root
						.data('smartmenus', this)
						.attr('data-smartmenus-id', this.rootId)
						.dataSM('level', 1)
						.bind(getEventsNS([
							['mouseover focusin', $.proxy(this.rootOver, this)],
							['mouseout focusout', $.proxy(this.rootOut, this)]
						], eNS))
						.delegate('a', getEventsNS([
							['mouseenter', $.proxy(this.itemEnter, this)],
							['mouseleave', $.proxy(this.itemLeave, this)],
							['mousedown', $.proxy(this.itemDown, this)],
							['focus', $.proxy(this.itemFocus, this)],
							['blur', $.proxy(this.itemBlur, this)],
							['click', $.proxy(this.itemClick, this)],
							['touchend', $.proxy(this.itemTouchEnd, this)]
						], eNS));

					// hide menus on tap or click outside the root UL
					eNS += this.rootId;
					if (this.opts.hideOnClick) {
						$(document).bind(getEventsNS([
							['touchstart', $.proxy(this.docTouchStart, this)],
							['touchmove', $.proxy(this.docTouchMove, this)],
							['touchend', $.proxy(this.docTouchEnd, this)],
							// for Opera Mobile < 11.5, webOS browser, etc. we'll check click too
							['click', $.proxy(this.docClick, this)]
						], eNS));
					}
					// hide sub menus on resize
					$(window).bind(getEventsNS([['resize orientationchange', $.proxy(this.winResize, this)]], eNS));

					if (this.opts.subIndicators) {
						this.$subArrow = $('<span/>').addClass('sub-arrow');
						if (this.opts.subIndicatorsText) {
							this.$subArrow.html(this.opts.subIndicatorsText);
						}
					}

					// make sure mouse detection is enabled
					initMouseDetection();
				}

				// init sub menus
				this.$firstSub = this.$root.find('ul').each(function() { self.menuInit($(this)); }).eq(0);

				this.$firstLink = this.$root.find('a').eq(0);

				// find current item
				if (this.opts.markCurrentItem) {
					var reDefaultDoc = /(index|default)\.[^#\?\/]*/i,
						reHash = /#.*/,
						locHref = window.location.href.replace(reDefaultDoc, ''),
						locHrefNoHash = locHref.replace(reHash, '');
					this.$root.find('a').each(function() {
						var href = this.href.replace(reDefaultDoc, ''),
							$this = $(this);
						if (href == locHref || href == locHrefNoHash) {
							$this.addClass('current');
							if (self.opts.markCurrentTree) {
								$this.parent().parentsUntil('[data-smartmenus-id]', 'li').children('a').addClass('current');
							}
						}
					});
				}
			},
			destroy: function() {
				this.menuHideAll();
				var eNS = '.smartmenus';
				this.$root
					.removeData('smartmenus')
					.removeAttr('data-smartmenus-id')
					.removeDataSM('level')
					.unbind(eNS)
					.undelegate(eNS);
				eNS += this.rootId;
				$(document).unbind(eNS);
				$(window).unbind(eNS);
				if (this.opts.subIndicators) {
					this.$subArrow = null;
				}
				var self = this;
				$.each(this.subMenus, function() {
					if (this.hasClass('mega-menu')) {
						this.find('ul').removeDataSM('in-mega');
					}
					if (this.dataSM('shown-before')) {
						if (self.opts.subMenusMinWidth || self.opts.subMenusMaxWidth) {
							this.css({ width: '', minWidth: '', maxWidth: '' }).removeClass('sm-nowrap');
						}
						if (this.dataSM('scroll-arrows')) {
							this.dataSM('scroll-arrows').remove();
						}
						this.css({ zIndex: '', top: '', left: '', marginLeft: '', marginTop: '', display: '' });
					}
					if (self.opts.subIndicators) {
						this.dataSM('parent-a').removeClass('has-submenu').children('span.sub-arrow').remove();
					}
					this.removeDataSM('shown-before')
						.removeDataSM('ie-shim')
						.removeDataSM('scroll-arrows')
						.removeDataSM('parent-a')
						.removeDataSM('level')
						.removeDataSM('beforefirstshowfired')
						.parent().removeDataSM('sub');
				});
				if (this.opts.markCurrentItem) {
					this.$root.find('a.current').removeClass('current');
				}
				this.$root = null;
				this.$firstLink = null;
				this.$firstSub = null;
				if (this.$disableOverlay) {
					this.$disableOverlay.remove();
					this.$disableOverlay = null;
				}
				menuTrees.splice($.inArray(this, menuTrees), 1);
			},
			disable: function(noOverlay) {
				if (!this.disabled) {
					this.menuHideAll();
					// display overlay over the menu to prevent interaction
					if (!noOverlay && !this.opts.isPopup && this.$root.is(':visible')) {
						var pos = this.$root.offset();
						this.$disableOverlay = $('<div class="sm-jquery-disable-overlay"/>').css({
							position: 'absolute',
							top: pos.top,
							left: pos.left,
							width: this.$root.outerWidth(),
							height: this.$root.outerHeight(),
							zIndex: this.getStartZIndex(true),
							opacity: 0
						}).appendTo(document.body);
					}
					this.disabled = true;
				}
			},
			docClick: function(e) {
				if (this.isTouchScrolling) {
					this.isTouchScrolling = false;
					return;
				}
				// hide on any click outside the menu or on a menu link
				if (this.visibleSubMenus.length && !$.contains(this.$root[0], e.target) || $(e.target).is('a')) {
					this.menuHideAll();
				}
			},
			docTouchEnd: function(e) {
				if (!this.lastTouch) {
					return;
				}
				if (this.visibleSubMenus.length && (this.lastTouch.x2 === undefined || this.lastTouch.x1 == this.lastTouch.x2) && (this.lastTouch.y2 === undefined || this.lastTouch.y1 == this.lastTouch.y2) && (!this.lastTouch.target || !$.contains(this.$root[0], this.lastTouch.target))) {
					if (this.hideTimeout) {
						clearTimeout(this.hideTimeout);
						this.hideTimeout = 0;
					}
					// hide with a delay to prevent triggering accidental unwanted click on some page element
					var self = this;
					this.hideTimeout = setTimeout(function() { self.menuHideAll(); }, 350);
				}
				this.lastTouch = null;
			},
			docTouchMove: function(e) {
				if (!this.lastTouch) {
					return;
				}
				var touchPoint = e.originalEvent.touches[0];
				this.lastTouch.x2 = touchPoint.pageX;
				this.lastTouch.y2 = touchPoint.pageY;
			},
			docTouchStart: function(e) {
				var touchPoint = e.originalEvent.touches[0];
				this.lastTouch = { x1: touchPoint.pageX, y1: touchPoint.pageY, target: touchPoint.target };
			},
			enable: function() {
				if (this.disabled) {
					if (this.$disableOverlay) {
						this.$disableOverlay.remove();
						this.$disableOverlay = null;
					}
					this.disabled = false;
				}
			},
			getClosestMenu: function(elm) {
				var $closestMenu = $(elm).closest('ul');
				while ($closestMenu.dataSM('in-mega')) {
					$closestMenu = $closestMenu.parent().closest('ul');
				}
				return $closestMenu[0] || null;
			},
			getHeight: function($elm) {
				return this.getOffset($elm, true);
			},
			// returns precise width/height float values
			getOffset: function($elm, height) {
				var old;
				if ($elm.css('display') == 'none') {
					old = { position: $elm[0].style.position, visibility: $elm[0].style.visibility };
					$elm.css({ position: 'absolute', visibility: 'hidden' }).show();
				}
				var box = $elm[0].getBoundingClientRect && $elm[0].getBoundingClientRect(),
					val = box && (height ? box.height || box.bottom - box.top : box.width || box.right - box.left);
				if (!val && val !== 0) {
					val = height ? $elm[0].offsetHeight : $elm[0].offsetWidth;
				}
				if (old) {
					$elm.hide().css(old);
				}
				return val;
			},
			getStartZIndex: function(root) {
				var zIndex = parseInt(this[root ? '$root' : '$firstSub'].css('z-index'));
				if (!root && isNaN(zIndex)) {
					zIndex = parseInt(this.$root.css('z-index'));
				}
				return !isNaN(zIndex) ? zIndex : 1;
			},
			getTouchPoint: function(e) {
				return e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0] || e;
			},
			getViewport: function(height) {
				var name = height ? 'Height' : 'Width',
					val = document.documentElement['client' + name],
					val2 = window['inner' + name];
				if (val2) {
					val = Math.min(val, val2);
				}
				return val;
			},
			getViewportHeight: function() {
				return this.getViewport(true);
			},
			getViewportWidth: function() {
				return this.getViewport();
			},
			getWidth: function($elm) {
				return this.getOffset($elm);
			},
			handleEvents: function() {
				return !this.disabled && this.isCSSOn();
			},
			handleItemEvents: function($a) {
				return this.handleEvents() && !this.isLinkInMegaMenu($a);
			},
			isCollapsible: function() {
				return this.$firstSub.css('position') == 'static';
			},
			isCSSOn: function() {
				return this.$firstLink.css('display') == 'block';
			},
			isFixed: function() {
				var isFixed = this.$root.css('position') == 'fixed';
				if (!isFixed) {
					this.$root.parentsUntil('body').each(function() {
						if ($(this).css('position') == 'fixed') {
							isFixed = true;
							return false;
						}
					});
				}
				return isFixed;
			},
			isLinkInMegaMenu: function($a) {
				return !$a.parent().parent().dataSM('level');
			},
			isTouchMode: function() {
				return !mouse || this.isCollapsible();
			},
			itemActivate: function($a) {
				var $li = $a.parent(),
					$ul = $li.parent(),
					level = $ul.dataSM('level');
				// if for some reason the parent item is not activated (e.g. this is an API call to activate the item), activate all parent items first
				if (level > 1 && (!this.activatedItems[level - 2] || this.activatedItems[level - 2][0] != $ul.dataSM('parent-a')[0])) {
					var self = this;
					$($ul.parentsUntil('[data-smartmenus-id]', 'ul').get().reverse()).add($ul).each(function() {
						self.itemActivate($(this).dataSM('parent-a'));
					});
				}
				// hide any visible deeper level sub menus
				if (this.visibleSubMenus.length > level) {
					this.menuHideSubMenus(!this.activatedItems[level - 1] || this.activatedItems[level - 1][0] != $a[0] ? level - 1 : level);
				}
				// save new active item and sub menu for this level
				this.activatedItems[level - 1] = $a;
				this.visibleSubMenus[level - 1] = $ul;
				if (this.$root.triggerHandler('activate.smapi', $a[0]) === false) {
					return;
				}
				// show the sub menu if this item has one
				var $sub = $li.dataSM('sub');
				if ($sub && (this.isTouchMode() || (!this.opts.showOnClick || this.clickActivated))) {
					this.menuShow($sub);
				}
			},
			itemBlur: function(e) {
				var $a = $(e.currentTarget);
				if (!this.handleItemEvents($a)) {
					return;
				}
				this.$root.triggerHandler('blur.smapi', $a[0]);
			},
			itemClick: function(e) {
				if (this.isTouchScrolling) {
					this.isTouchScrolling = false;
					e.stopPropagation();
					return false;
				}
				var $a = $(e.currentTarget);
				if (!this.handleItemEvents($a)) {
					return;
				}
				$a.removeDataSM('mousedown');
				if (this.$root.triggerHandler('click.smapi', $a[0]) === false) {
					return false;
				}
				var $sub = $a.parent().dataSM('sub');
				if (this.isTouchMode()) {
					// undo fix: prevent the address bar on iPhone from sliding down when expanding a sub menu
					if ($a.dataSM('href')) {
						$a.attr('href', $a.dataSM('href')).removeDataSM('href');
					}
					// if the sub is not visible
					if ($sub && (!$sub.dataSM('shown-before') || !$sub.is(':visible'))) {
						// try to activate the item and show the sub
						this.itemActivate($a);
						// if "itemActivate" showed the sub, prevent the click so that the link is not loaded
						// if it couldn't show it, then the sub menus are disabled with an !important declaration (e.g. via mobile styles) so let the link get loaded
						if ($sub.is(':visible')) {
							return false;
						}
					}
				} else if (this.opts.showOnClick && $a.parent().parent().dataSM('level') == 1 && $sub) {
					this.clickActivated = true;
					this.menuShow($sub);
					return false;
				}
				if ($a.hasClass('disabled')) {
					return false;
				}
				if (this.$root.triggerHandler('select.smapi', $a[0]) === false) {
					return false;
				}
			},
			itemDown: function(e) {
				var $a = $(e.currentTarget);
				if (!this.handleItemEvents($a)) {
					return;
				}
				$a.dataSM('mousedown', true);
			},
			itemEnter: function(e) {
				var $a = $(e.currentTarget);
				if (!this.handleItemEvents($a)) {
					return;
				}
				if (!this.isTouchMode()) {
					if (this.showTimeout) {
						clearTimeout(this.showTimeout);
						this.showTimeout = 0;
					}
					var self = this;
					this.showTimeout = setTimeout(function() { self.itemActivate($a); }, this.opts.showOnClick && $a.parent().parent().dataSM('level') == 1 ? 1 : this.opts.showTimeout);
				}
				this.$root.triggerHandler('mouseenter.smapi', $a[0]);
			},
			itemFocus: function(e) {
				var $a = $(e.currentTarget);
				if (!this.handleItemEvents($a)) {
					return;
				}
				// fix (the mousedown check): in some browsers a tap/click produces consecutive focus + click events so we don't need to activate the item on focus
				if ((!this.isTouchMode() || !$a.dataSM('mousedown')) && (!this.activatedItems.length || this.activatedItems[this.activatedItems.length - 1][0] != $a[0])) {
					this.itemActivate($a);
				}
				this.$root.triggerHandler('focus.smapi', $a[0]);
			},
			itemLeave: function(e) {
				var $a = $(e.currentTarget);
				if (!this.handleItemEvents($a)) {
					return;
				}
				if (!this.isTouchMode()) {
					if ($a[0].blur) {
						$a[0].blur();
					}
					if (this.showTimeout) {
						clearTimeout(this.showTimeout);
						this.showTimeout = 0;
					}
				}
				$a.removeDataSM('mousedown');
				this.$root.triggerHandler('mouseleave.smapi', $a[0]);
			},
			itemTouchEnd: function(e) {
				var $a = $(e.currentTarget);
				if (!this.handleItemEvents($a)) {
					return;
				}
				// prevent the address bar on iPhone from sliding down when expanding a sub menu
				var $sub = $a.parent().dataSM('sub');
				if ($a.attr('href').charAt(0) !== '#' && $sub && (!$sub.dataSM('shown-before') || !$sub.is(':visible'))) {
					$a.dataSM('href', $a.attr('href'));
					$a.attr('href', '#');
				}
			},
			menuFixLayout: function($ul) {
				// fixes a menu that is being shown for the first time
				if (!$ul.dataSM('shown-before')) {
					$ul.hide().dataSM('shown-before', true);
				}
			},
			menuHide: function($sub) {
				if (this.$root.triggerHandler('beforehide.smapi', $sub[0]) === false) {
					return;
				}
				$sub.stop(true, true);
				if ($sub.is(':visible')) {
					var complete = function() {
						// unset z-index
						$sub.css('z-index', '');
					};
					// if sub is collapsible (mobile view)
					if (this.isCollapsible()) {
						if (this.opts.collapsibleHideFunction) {
							this.opts.collapsibleHideFunction.call(this, $sub, complete);
						} else {
							$sub.hide(this.opts.collapsibleHideDuration, complete);
						}
					} else {
						if (this.opts.hideFunction) {
							this.opts.hideFunction.call(this, $sub, complete);
						} else {
							$sub.hide(this.opts.hideDuration, complete);
						}
					}
					// remove IE iframe shim
					if ($sub.dataSM('ie-shim')) {
						$sub.dataSM('ie-shim').remove();
					}
					// deactivate scrolling if it is activated for this sub
					if ($sub.dataSM('scroll')) {
						this.menuScrollStop($sub);
						$sub.css({ 'touch-action': '', '-ms-touch-action': '' })
							.unbind('.smartmenus_scroll').removeDataSM('scroll').dataSM('scroll-arrows').hide();
					}
					// unhighlight parent item
					$sub.dataSM('parent-a').removeClass('highlighted');
					var level = $sub.dataSM('level');
					this.activatedItems.splice(level - 1, 1);
					this.visibleSubMenus.splice(level - 1, 1);
					this.$root.triggerHandler('hide.smapi', $sub[0]);
				}
			},
			menuHideAll: function() {
				if (this.showTimeout) {
					clearTimeout(this.showTimeout);
					this.showTimeout = 0;
				}
				// hide all subs
				this.menuHideSubMenus();
				// hide root if it's popup
				if (this.opts.isPopup) {
					this.$root.stop(true, true);
					if (this.$root.is(':visible')) {
						if (this.opts.hideFunction) {
							this.opts.hideFunction.call(this, this.$root);
						} else {
							this.$root.hide(this.opts.hideDuration);
						}
						// remove IE iframe shim
						if (this.$root.dataSM('ie-shim')) {
							this.$root.dataSM('ie-shim').remove();
						}
					}
				}
				this.activatedItems = [];
				this.visibleSubMenus = [];
				this.clickActivated = false;
				// reset z-index increment
				this.zIndexInc = 0;
			},
			menuHideSubMenus: function(level) {
				if (!level)
					level = 0;
				for (var i = this.visibleSubMenus.length - 1; i > level; i--) {
					this.menuHide(this.visibleSubMenus[i]);
				}
			},
			menuIframeShim: function($ul) {
				// create iframe shim for the menu
				if (IE && this.opts.overlapControlsInIE && !$ul.dataSM('ie-shim')) {
					$ul.dataSM('ie-shim', $('<iframe/>').attr({ src: 'javascript:0', tabindex: -9 })
						.css({ position: 'absolute', top: 'auto', left: '0', opacity: 0, border: '0' })
					);
				}
			},
			menuInit: function($ul) {
				if (!$ul.dataSM('in-mega')) {
					this.subMenus.push($ul);
					// mark UL's in mega drop downs (if any) so we can neglect them
					if ($ul.hasClass('mega-menu')) {
						$ul.find('ul').dataSM('in-mega', true);
					}
					// get level (much faster than, for example, using parentsUntil)
					var level = 2,
						par = $ul[0];
					while ((par = par.parentNode.parentNode) != this.$root[0]) {
						level++;
					}
					// cache stuff
					$ul.dataSM('parent-a', $ul.prevAll('a').eq(-1))
						.dataSM('level', level)
						.parent().dataSM('sub', $ul);
					// add sub indicator to parent item
					if (this.opts.subIndicators) {
						$ul.dataSM('parent-a').addClass('has-submenu')[this.opts.subIndicatorsPos](this.$subArrow.clone());
					}
				}
			},
			menuPosition: function($sub) {
				var $a = $sub.dataSM('parent-a'),
					$ul = $sub.parent().parent(),
					level = $sub.dataSM('level'),
					subW = this.getWidth($sub),
					subH = this.getHeight($sub),
					itemOffset = $a.offset(),
					itemX = itemOffset.left,
					itemY = itemOffset.top,
					itemW = this.getWidth($a),
					itemH = this.getHeight($a),
					$win = $(window),
					winX = $win.scrollLeft(),
					winY = $win.scrollTop(),
					winW = this.getViewportWidth(),
					winH = this.getViewportHeight(),
					horizontalParent = $ul.hasClass('sm') && !$ul.hasClass('sm-vertical'),
					subOffsetX = level == 2 ? this.opts.mainMenuSubOffsetX : this.opts.subMenusSubOffsetX,
					subOffsetY = level == 2 ? this.opts.mainMenuSubOffsetY : this.opts.subMenusSubOffsetY,
					x, y;
				if (horizontalParent) {
					x = this.opts.rightToLeftSubMenus ? itemW - subW - subOffsetX : subOffsetX;
					y = this.opts.bottomToTopSubMenus ? -subH - subOffsetY : itemH + subOffsetY;
				} else {
					x = this.opts.rightToLeftSubMenus ? subOffsetX - subW : itemW - subOffsetX;
					y = this.opts.bottomToTopSubMenus ? itemH - subOffsetY - subH : subOffsetY;
				}
				if (this.opts.keepInViewport && !this.isCollapsible()) {
					var absX = itemX + x,
						absY = itemY + y;
					if (this.opts.rightToLeftSubMenus && absX < winX) {
						x = horizontalParent ? winX - absX + x : itemW - subOffsetX;
					} else if (!this.opts.rightToLeftSubMenus && absX + subW > winX + winW) {
						x = horizontalParent ? winX + winW - subW - absX + x : subOffsetX - subW;
					}
					if (!horizontalParent) {
						if (subH < winH && absY + subH > winY + winH) {
							y += winY + winH - subH - absY;
						} else if (subH >= winH || absY < winY) {
							y += winY - absY;
						}
					}
					// do we need scrolling?
					// 0.49 used for better precision when dealing with float values
					if (horizontalParent && (absY + subH > winY + winH + 0.49 || absY < winY) || !horizontalParent && subH > winH + 0.49) {
						var self = this;
						if (!$sub.dataSM('scroll-arrows')) {
							$sub.dataSM('scroll-arrows', $([$('<span class="scroll-up"><span class="scroll-up-arrow"></span></span>')[0], $('<span class="scroll-down"><span class="scroll-down-arrow"></span></span>')[0]])
								.bind({
									mouseenter: function() {
										$sub.dataSM('scroll').up = $(this).hasClass('scroll-up');
										self.menuScroll($sub);
									},
									mouseleave: function(e) {
										self.menuScrollStop($sub);
										self.menuScrollOut($sub, e);
									},
									'mousewheel DOMMouseScroll': function(e) { e.preventDefault(); }
								})
								.insertAfter($sub)
							);
						}
						// bind scroll events and save scroll data for this sub
						var eNS = '.smartmenus_scroll';
						$sub.dataSM('scroll', {
								step: 1,
								// cache stuff for faster recalcs later
								itemH: itemH,
								subH: subH,
								arrowDownH: this.getHeight($sub.dataSM('scroll-arrows').eq(1))
							})
							.bind(getEventsNS([
								['mouseover', function(e) { self.menuScrollOver($sub, e); }],
								['mouseout', function(e) { self.menuScrollOut($sub, e); }],
								['mousewheel DOMMouseScroll', function(e) { self.menuScrollMousewheel($sub, e); }]
							], eNS))
							.dataSM('scroll-arrows').css({ top: 'auto', left: '0', marginLeft: x + (parseInt($sub.css('border-left-width')) || 0), width: subW - (parseInt($sub.css('border-left-width')) || 0) - (parseInt($sub.css('border-right-width')) || 0), zIndex: $sub.css('z-index') })
								.eq(horizontalParent && this.opts.bottomToTopSubMenus ? 0 : 1).show();
						// when a menu tree is fixed positioned we allow scrolling via touch too
						// since there is no other way to access such long sub menus if no mouse is present
						if (this.isFixed()) {
							$sub.css({ 'touch-action': 'none', '-ms-touch-action': 'none' })
								.bind(getEventsNS([
									[touchEvents() ? 'touchstart touchmove touchend' : 'pointerdown pointermove pointerup MSPointerDown MSPointerMove MSPointerUp', function(e) {
										self.menuScrollTouch($sub, e);
									}]
								], eNS));
						}
					}
				}
				$sub.css({ top: 'auto', left: '0', marginLeft: x, marginTop: y - itemH });
				// IE iframe shim
				this.menuIframeShim($sub);
				if ($sub.dataSM('ie-shim')) {
					$sub.dataSM('ie-shim').css({ zIndex: $sub.css('z-index'), width: subW, height: subH, marginLeft: x, marginTop: y - itemH });
				}
			},
			menuScroll: function($sub, once, step) {
				var data = $sub.dataSM('scroll'),
					$arrows = $sub.dataSM('scroll-arrows'),
					y = parseFloat($sub.css('margin-top')),
					end = data.up ? data.upEnd : data.downEnd,
					diff;
				if (!once && data.velocity) {
					data.velocity *= 0.9;
					diff = data.velocity;
					if (diff < 0.5) {
						this.menuScrollStop($sub);
						return;
					}
				} else {
					diff = step || (once || !this.opts.scrollAccelerate ? this.opts.scrollStep : Math.floor(data.step));
				}
				// hide any visible deeper level sub menus
				var level = $sub.dataSM('level');
				if (this.visibleSubMenus.length > level) {
					this.menuHideSubMenus(level - 1);
				}
				var newY = data.up && end <= y || !data.up && end >= y ? y : (Math.abs(end - y) > diff ? y + (data.up ? diff : -diff) : end);
				$sub.add($sub.dataSM('ie-shim')).css('margin-top', newY);
				// show opposite arrow if appropriate
				if (mouse && (data.up && newY > data.downEnd || !data.up && newY < data.upEnd)) {
					$arrows.eq(data.up ? 1 : 0).show();
				}
				// if we've reached the end
				if (newY == end) {
					if (mouse) {
						$arrows.eq(data.up ? 0 : 1).hide();
					}
					this.menuScrollStop($sub);
				} else if (!once) {
					if (this.opts.scrollAccelerate && data.step < this.opts.scrollStep) {
						data.step += 0.5;
					}
					var self = this;
					this.scrollTimeout = setTimeout(function() { self.menuScroll($sub); }, this.opts.scrollInterval);
				}
			},
			menuScrollMousewheel: function($sub, e) {
				if (this.getClosestMenu(e.target) == $sub[0]) {
					e = e.originalEvent;
					var up = (e.wheelDelta || -e.detail) > 0;
					if ($sub.dataSM('scroll-arrows').eq(up ? 0 : 1).is(':visible')) {
						$sub.dataSM('scroll').up = up;
						this.menuScroll($sub, true);
					}
				}
				e.preventDefault();
			},
			menuScrollOut: function($sub, e) {
				if (mouse) {
					if (!/^scroll-(up|down)/.test((e.relatedTarget || '').className) && ($sub[0] != e.relatedTarget && !$.contains($sub[0], e.relatedTarget) || this.getClosestMenu(e.relatedTarget) != $sub[0])) {
						$sub.dataSM('scroll-arrows').css('visibility', 'hidden');
					}
				}
			},
			menuScrollOver: function($sub, e) {
				if (mouse) {
					if (!/^scroll-(up|down)/.test(e.target.className) && this.getClosestMenu(e.target) == $sub[0]) {
						this.menuScrollRefreshData($sub);
						var data = $sub.dataSM('scroll');
						$sub.dataSM('scroll-arrows').eq(0).css('margin-top', data.upEnd).end()
							.eq(1).css('margin-top', data.downEnd + data.subH - data.arrowDownH).end()
							.css('visibility', 'visible');
					}
				}
			},
			menuScrollRefreshData: function($sub) {
				var data = $sub.dataSM('scroll'),
					$win = $(window),
					vportY = $win.scrollTop() - $sub.dataSM('parent-a').offset().top - data.itemH;
				$.extend(data, {
					upEnd: vportY,
					downEnd: vportY + this.getViewportHeight() - data.subH
				});
			},
			menuScrollStop: function($sub) {
				if (this.scrollTimeout) {
					clearTimeout(this.scrollTimeout);
					this.scrollTimeout = 0;
					$.extend($sub.dataSM('scroll'), {
						step: 1,
						velocity: 0
					});
					return true;
				}
			},
			menuScrollTouch: function($sub, e) {
				e = e.originalEvent;
				if (isTouchEvent(e)) {
					var touchPoint = this.getTouchPoint(e);
					// neglect event if we touched a visible deeper level sub menu
					if (this.getClosestMenu(touchPoint.target) == $sub[0]) {
						var data = $sub.dataSM('scroll');
						if (/(start|down)$/i.test(e.type)) {
							if (this.menuScrollStop($sub)) {
								// if we were scrolling, just stop and don't activate any link on the first touch
								e.preventDefault();
								this.isTouchScrolling = true;
							} else {
								this.isTouchScrolling = false;
							}
							// update scroll data since the user might have zoomed, etc.
							this.menuScrollRefreshData($sub);
							// extend it with the touch properties
							$.extend(data, {
								touchY: touchPoint.pageY,
								touchTimestamp: e.timeStamp,
								velocity: 0
							});
						} else if (/move$/i.test(e.type)) {
							var prevY = data.touchY;
							if (prevY !== undefined && prevY != touchPoint.pageY) {
								this.isTouchScrolling = true;
								$.extend(data, {
									up: prevY < touchPoint.pageY,
									touchY: touchPoint.pageY,
									touchTimestamp: e.timeStamp,
									velocity: data.velocity + Math.abs(touchPoint.pageY - prevY) * 0.5
								});
								this.menuScroll($sub, true, Math.abs(data.touchY - prevY));
							}
							e.preventDefault();
						} else { // touchend/pointerup
							if (data.touchY !== undefined) {
								// check if we need to scroll
								if (e.timeStamp - data.touchTimestamp < 120 && data.velocity > 0) {
									data.velocity *= 0.5;
									this.menuScrollStop($sub);
									this.menuScroll($sub);
									e.preventDefault();
								}
								delete data.touchY;
							}
						}
					}
				}
			},
			menuShow: function($sub) {
				if (!$sub.dataSM('beforefirstshowfired')) {
					$sub.dataSM('beforefirstshowfired', true);
					if (this.$root.triggerHandler('beforefirstshow.smapi', $sub[0]) === false) {
						return;
					}
				}
				if (this.$root.triggerHandler('beforeshow.smapi', $sub[0]) === false) {
					return;
				}
				this.menuFixLayout($sub);
				$sub.stop(true, true);
				if (!$sub.is(':visible')) {
					// set z-index
					$sub.css('z-index', this.zIndexInc = (this.zIndexInc || this.getStartZIndex()) + 1);
					// highlight parent item
					if (this.opts.keepHighlighted || this.isCollapsible()) {
						$sub.dataSM('parent-a').addClass('highlighted');
					}
					// min/max-width fix - no way to rely purely on CSS as all UL's are nested
					if (this.opts.subMenusMinWidth || this.opts.subMenusMaxWidth) {
						$sub.css({ width: 'auto', minWidth: '', maxWidth: '' }).addClass('sm-nowrap');
						if (this.opts.subMenusMinWidth) {
						 	$sub.css('min-width', this.opts.subMenusMinWidth);
						}
						if (this.opts.subMenusMaxWidth) {
						 	var noMaxWidth = this.getWidth($sub);
						 	$sub.css('max-width', this.opts.subMenusMaxWidth);
							if (noMaxWidth > this.getWidth($sub)) {
								$sub.removeClass('sm-nowrap').css('width', this.opts.subMenusMaxWidth);
							}
						}
					}
					this.menuPosition($sub);
					// insert IE iframe shim
					if ($sub.dataSM('ie-shim')) {
						$sub.dataSM('ie-shim').insertBefore($sub);
					}
					var complete = function() {
						// fix: "overflow: hidden;" is not reset on animation complete in jQuery < 1.9.0 in Chrome when global "box-sizing: border-box;" is used
						$sub.css('overflow', '');
					};
					// if sub is collapsible (mobile view)
					if (this.isCollapsible()) {
						if (this.opts.collapsibleShowFunction) {
							this.opts.collapsibleShowFunction.call(this, $sub, complete);
						} else {
							$sub.show(this.opts.collapsibleShowDuration, complete);
						}
					} else {
						if (this.opts.showFunction) {
							this.opts.showFunction.call(this, $sub, complete);
						} else {
							$sub.show(this.opts.showDuration, complete);
						}
					}
					// save new sub menu for this level
					this.visibleSubMenus[$sub.dataSM('level') - 1] = $sub;
					this.$root.triggerHandler('show.smapi', $sub[0]);
				}
			},
			popupHide: function(noHideTimeout) {
				if (this.hideTimeout) {
					clearTimeout(this.hideTimeout);
					this.hideTimeout = 0;
				}
				var self = this;
				this.hideTimeout = setTimeout(function() {
					self.menuHideAll();
				}, noHideTimeout ? 1 : this.opts.hideTimeout);
			},
			popupShow: function(left, top) {
				if (!this.opts.isPopup) {
					alert('SmartMenus jQuery Error:\n\nIf you want to show this menu via the "popupShow" method, set the isPopup:true option.');
					return;
				}
				if (this.hideTimeout) {
					clearTimeout(this.hideTimeout);
					this.hideTimeout = 0;
				}
				this.menuFixLayout(this.$root);
				this.$root.stop(true, true);
				if (!this.$root.is(':visible')) {
					this.$root.css({ left: left, top: top });
					// IE iframe shim
					this.menuIframeShim(this.$root);
					if (this.$root.dataSM('ie-shim')) {
						this.$root.dataSM('ie-shim').css({ zIndex: this.$root.css('z-index'), width: this.getWidth(this.$root), height: this.getHeight(this.$root), left: left, top: top }).insertBefore(this.$root);
					}
					// show menu
					var self = this,
						complete = function() {
							self.$root.css('overflow', '');
						};
					if (this.opts.showFunction) {
						this.opts.showFunction.call(this, this.$root, complete);
					} else {
						this.$root.show(this.opts.showDuration, complete);
					}
					this.visibleSubMenus[0] = this.$root;
				}
			},
			refresh: function() {
				this.menuHideAll();
				this.$root.find('ul').each(function() {
						var $this = $(this);
						if ($this.dataSM('scroll-arrows')) {
							$this.dataSM('scroll-arrows').remove();
						}
					})
					.removeDataSM('in-mega')
					.removeDataSM('shown-before')
					.removeDataSM('ie-shim')
					.removeDataSM('scroll-arrows')
					.removeDataSM('parent-a')
					.removeDataSM('level')
					.removeDataSM('beforefirstshowfired');
				this.$root.find('a.has-submenu').removeClass('has-submenu')
					.parent().removeDataSM('sub');
				if (this.opts.subIndicators) {
					this.$root.find('span.sub-arrow').remove();
				}
				if (this.opts.markCurrentItem) {
					this.$root.find('a.current').removeClass('current');
				}
				this.subMenus = [];
				this.init(true);
			},
			rootOut: function(e) {
				if (!this.handleEvents() || this.isTouchMode() || e.target == this.$root[0]) {
					return;
				}
				if (this.hideTimeout) {
					clearTimeout(this.hideTimeout);
					this.hideTimeout = 0;
				}
				if (!this.opts.showOnClick || !this.opts.hideOnClick) {
					var self = this;
					this.hideTimeout = setTimeout(function() { self.menuHideAll(); }, this.opts.hideTimeout);
				}
			},
			rootOver: function(e) {
				if (!this.handleEvents() || this.isTouchMode() || e.target == this.$root[0]) {
					return;
				}
				if (this.hideTimeout) {
					clearTimeout(this.hideTimeout);
					this.hideTimeout = 0;
				}
			},
			winResize: function(e) {
				if (!this.handleEvents()) {
					// we still need to resize the disable overlay if it's visible
					if (this.$disableOverlay) {
						var pos = this.$root.offset();
	 					this.$disableOverlay.css({
							top: pos.top,
							left: pos.left,
							width: this.$root.outerWidth(),
							height: this.$root.outerHeight()
						});
					}
					return;
				}
				// hide sub menus on resize - on mobile do it only on orientation change
				if (!this.isCollapsible() && (!('onorientationchange' in window) || e.type == 'orientationchange')) {
					if (this.activatedItems.length) {
						this.activatedItems[this.activatedItems.length - 1][0].blur();
					}
					this.menuHideAll();
				}
			}
		}
	});

	$.fn.dataSM = function(key, val) {
		if (val) {
			return this.data(key + '_smartmenus', val);
		}
		return this.data(key + '_smartmenus');
	}

	$.fn.removeDataSM = function(key) {
		return this.removeData(key + '_smartmenus');
	}

	$.fn.smartmenus = function(options) {
		if (typeof options == 'string') {
			var args = arguments,
				method = options;
			Array.prototype.shift.call(args);
			return this.each(function() {
				var smartmenus = $(this).data('smartmenus');
				if (smartmenus && smartmenus[method]) {
					smartmenus[method].apply(smartmenus, args);
				}
			});
		}
		var opts = $.extend({}, $.fn.smartmenus.defaults, options);
		return this.each(function() {
			new $.SmartMenus(this, opts);
		});
	}

	// default settings
	$.fn.smartmenus.defaults = {
		isPopup:		false,		// is this a popup menu (can be shown via the popupShow/popupHide methods) or a permanent menu bar
		/*mainMenuSubOffsetX:	0,		// pixels offset from default position
		mainMenuSubOffsetY:	0,		// pixels offset from default position
		subMenusSubOffsetX:	0,		// pixels offset from default position
		subMenusSubOffsetY:	0,		// pixels offset from default position*/
		subMenusMinWidth:	'10em',		// min-width for the sub menus (any CSS unit) - if set, the fixed width set in CSS will be ignored
		subMenusMaxWidth:	'20em',		// max-width for the sub menus (any CSS unit) - if set, the fixed width set in CSS will be ignored
		subIndicators: 		true,		// create sub menu indicators - creates a SPAN and inserts it in the A
		subIndicatorsPos: 	'prepend',	// position of the SPAN relative to the menu item content ('prepend', 'append')
		subIndicatorsText:	'+',		// [optionally] add text in the SPAN (e.g. '+') (you may want to check the CSS for the sub indicators too)
		scrollStep: 		30,		// pixels step when scrolling long sub menus that do not fit in the viewport height
		scrollInterval:		30,		// interval between each scrolling step
		scrollAccelerate:	true,		// accelerate scrolling or use a fixed step
		showTimeout:		250,		// timeout before showing the sub menus
		hideTimeout:		500,		// timeout before hiding the sub menus
		showDuration:		0,		// duration for show animation - set to 0 for no animation - matters only if showFunction:null
		showFunction:		null,		// custom function to use when showing a sub menu (the default is the jQuery 'show')
							// don't forget to call complete() at the end of whatever you do
							// e.g.: function($ul, complete) { $ul.fadeIn(250, complete); }
		hideDuration:		0,		// duration for hide animation - set to 0 for no animation - matters only if hideFunction:null
		hideFunction:		function($ul, complete) { $ul.fadeOut(200, complete); },	// custom function to use when hiding a sub menu (the default is the jQuery 'hide')
							// don't forget to call complete() at the end of whatever you do
							// e.g.: function($ul, complete) { $ul.fadeOut(250, complete); }
		collapsibleShowDuration:0,		// duration for show animation for collapsible sub menus - matters only if collapsibleShowFunction:null
		collapsibleShowFunction:function($ul, complete) { $ul.slideDown(200, complete); },	// custom function to use when showing a collapsible sub menu
							// (i.e. when mobile styles are used to make the sub menus collapsible)
		collapsibleHideDuration:0,		// duration for hide animation for collapsible sub menus - matters only if collapsibleHideFunction:null
		collapsibleHideFunction:function($ul, complete) { $ul.slideUp(200, complete); },	// custom function to use when hiding a collapsible sub menu
							// (i.e. when mobile styles are used to make the sub menus collapsible)
		showOnClick:		false,		// show the first-level sub menus onclick instead of onmouseover (matters only for mouse input)
		hideOnClick:		true,		// hide the sub menus on click/tap anywhere on the page
		keepInViewport:		true,		// reposition the sub menus if needed to make sure they always appear inside the viewport
		keepHighlighted:	true,		// keep all ancestor items of the current sub menu highlighted (adds the 'highlighted' class to the A's)
		markCurrentItem:	false,		// automatically add the 'current' class to the A element of the item linking to the current URL
		markCurrentTree:	true,		// add the 'current' class also to the A elements of all ancestor items of the current item
		rightToLeftSubMenus:	false,		// right to left display of the sub menus (check the CSS for the sub indicators' position)
		bottomToTopSubMenus:	false,		// bottom to top display of the sub menus
		overlapControlsInIE:	true		// make sure sub menus appear on top of special OS controls in IE (i.e. SELECT, OBJECT, EMBED, etc.)
	};

})(jQuery);



/* ====================================================================================================================
 * Smartmenus End
 * ====================================================================================================================*/




/* ====================================================================================================================
 * SmartMenus jQuery Bootstrap Start
 * ====================================================================================================================*/


 /* SmartMenus jQuery Bootstrap Addon - v0.1.1
 * http://www.smartmenus.org/
 *
 * Copyright 2014 Vasil Dinkov, Vadikom Web Ltd.
 * http://vadikom.com/
 *
 * Released under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

(function($) {

	// init ondomready
	$(function() {

		// init all menus
		$('ul.navbar-nav').each(function() {
				var $this = $(this);
				$this.addClass('sm').smartmenus({

						// these are some good default options that should work for all
						// you can, of course, tweak these as you like
						subMenusSubOffsetX: 2,
						subMenusSubOffsetY: -6,
						subIndicatorsPos: 'append',
						subIndicatorsText: '...',
						collapsibleShowFunction: null,
						collapsibleHideFunction: null,
						rightToLeftSubMenus: $this.hasClass('navbar-right'),
						bottomToTopSubMenus: $this.closest('.navbar').hasClass('navbar-fixed-bottom')
					})
					// set Bootstrap's "active" class to SmartMenus "current" items (should someone decide to enable markCurrentItem: true)
					.find('a.current').parent().addClass('active');
			})
			.bind({
				// set/unset proper Bootstrap classes for some menu elements
				'show.smapi': function(e, menu) {
					var $menu = $(menu),
						$scrollArrows = $menu.dataSM('scroll-arrows'),
						obj = $(this).data('smartmenus');
					if ($scrollArrows) {
						// they inherit border-color from body, so we can use its background-color too
						$scrollArrows.css('background-color', $(document.body).css('background-color'));
					}
					$menu.parent().addClass('open' + (obj.isCollapsible() ? ' collapsible' : ''));
				},
				'hide.smapi': function(e, menu) {
					$(menu).parent().removeClass('open collapsible');
				},
				// click the parent item to toggle the sub menus (and reset deeper levels and other branches on click)
				'click.smapi': function(e, item) {
					var obj = $(this).data('smartmenus');
					if (obj.isCollapsible()) {
						var $item = $(item),
							$sub = $item.parent().dataSM('sub');
						if ($sub && $sub.dataSM('shown-before') && $sub.is(':visible')) {
							obj.itemActivate($item);
							obj.menuHide($sub);
							return false;
						}
					}
				}
			});

	});

	// fix collapsible menu detection for Bootstrap 3
	$.SmartMenus.prototype.isCollapsible = function() {
		return this.$firstLink.parent().css('float') != 'left';
	};

})(jQuery);


/* ====================================================================================================================
 * SmartMenus jQuery Bootstrap End
 * ====================================================================================================================*/
 
 
/* ====================================================================================================================
 * Nivo Slider Start
 * ====================================================================================================================*/


/*
 * jQuery Nivo Slider v3.2
 * http://nivo.dev7studios.com
 *
 * Copyright 2012, Dev7studios
 * Free to use and abuse under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 */

(function($) {
    var NivoSlider = function(element, options){
        // Defaults are below
        var settings = $.extend({}, $.fn.nivoSlider.defaults, options);

        // Useful variables. Play carefully.
        var vars = {
            currentSlide: 0,
            currentImage: '',
            totalSlides: 0,
            running: false,
            paused: false,
            stop: false,
            controlNavEl: false
        };

        // Get this slider
        var slider = $(element);
        slider.data('nivo:vars', vars).addClass('nivoSlider');

        // Find our slider children
        var kids = slider.children();
        kids.each(function() {
            var child = $(this);
            var link = '';
            if(!child.is('img')){
                if(child.is('a')){
                    child.addClass('nivo-imageLink');
                    link = child;
                }
                child = child.find('img:first');
            }
            // Get img width & height
            var childWidth = (childWidth === 0) ? child.attr('width') : child.width(),
                childHeight = (childHeight === 0) ? child.attr('height') : child.height();

            if(link !== ''){
                link.css('display','none');
            }
            child.css('display','none');
            vars.totalSlides++;
        });
         
        // If randomStart
        if(settings.randomStart){
            settings.startSlide = Math.floor(Math.random() * vars.totalSlides);
        }
        
        // Set startSlide
        if(settings.startSlide > 0){
            if(settings.startSlide >= vars.totalSlides) { settings.startSlide = vars.totalSlides - 1; }
            vars.currentSlide = settings.startSlide;
        }
        
        // Get initial image
        if($(kids[vars.currentSlide]).is('img')){
            vars.currentImage = $(kids[vars.currentSlide]);
        } else {
            vars.currentImage = $(kids[vars.currentSlide]).find('img:first');
        }
        
        // Show initial link
        if($(kids[vars.currentSlide]).is('a')){
            $(kids[vars.currentSlide]).css('display','block');
        }
        
        // Set first background
        var sliderImg = $('<img/>').addClass('nivo-main-image');
        sliderImg.attr('src', vars.currentImage.attr('src')).show();
        slider.append(sliderImg);

        // Detect Window Resize
        $(window).resize(function() {
            slider.children('img').width(slider.width());
            sliderImg.attr('src', vars.currentImage.attr('src'));
            sliderImg.stop().height('auto');
            $('.nivo-slice').remove();
            $('.nivo-box').remove();
        });

        //Create caption
        slider.append($('<div class="nivo-caption"></div>'));
        
        // Process caption function
        var processCaption = function(settings){
            var nivoCaption = $('.nivo-caption', slider);
            if(vars.currentImage.attr('title') != '' && vars.currentImage.attr('title') != undefined){
                var title = vars.currentImage.attr('title');
                if(title.substr(0,1) == '#') title = $(title).html();   

                if(nivoCaption.css('display') == 'block'){
                    setTimeout(function(){
                        nivoCaption.html(title);
                    }, settings.animSpeed);
                } else {
                    nivoCaption.html(title);
                    nivoCaption.stop().fadeIn(settings.animSpeed);
                }
            } else {
                nivoCaption.stop().fadeOut(settings.animSpeed);
            }
        }
        
        //Process initial  caption
        processCaption(settings);
        
        // In the words of Super Mario "let's a go!"
        var timer = 0;
        if(!settings.manualAdvance && kids.length > 1){
            timer = setInterval(function(){ nivoRun(slider, kids, settings, false); }, settings.pauseTime);
        }
        
        // Add Direction nav
        if(settings.directionNav){
            slider.append('<div class="nivo-directionNav"><a class="nivo-prevNav">'+ settings.prevText +'</a><a class="nivo-nextNav">'+ settings.nextText +'</a></div>');
            
            $(slider).on('click', 'a.nivo-prevNav', function(){
                if(vars.running) { return false; }
                clearInterval(timer);
                timer = '';
                vars.currentSlide -= 2;
                nivoRun(slider, kids, settings, 'prev');
            });
            
            $(slider).on('click', 'a.nivo-nextNav', function(){
                if(vars.running) { return false; }
                clearInterval(timer);
                timer = '';
                nivoRun(slider, kids, settings, 'next');
            });
        }
        
        // Add Control nav
        if(settings.controlNav){
            vars.controlNavEl = $('<div class="nivo-controlNav"></div>');
            slider.after(vars.controlNavEl);
            for(var i = 0; i < kids.length; i++){
                if(settings.controlNavThumbs){
                    vars.controlNavEl.addClass('nivo-thumbs-enabled');
                    var child = kids.eq(i);
                    if(!child.is('img')){
                        child = child.find('img:first');
                    }
                    if(child.attr('data-thumb')) vars.controlNavEl.append('<a class="nivo-control" rel="'+ i +'"><img src="'+ child.attr('data-thumb') +'" alt="" /></a>');
                } else {
                    vars.controlNavEl.append('<a class="nivo-control" rel="'+ i +'">'+ (i + 1) +'</a>');
                }
            }

            //Set initial active link
            $('a:eq('+ vars.currentSlide +')', vars.controlNavEl).addClass('active');
            
            $('a', vars.controlNavEl).bind('click', function(){
                if(vars.running) return false;
                if($(this).hasClass('active')) return false;
                clearInterval(timer);
                timer = '';
                sliderImg.attr('src', vars.currentImage.attr('src'));
                vars.currentSlide = $(this).attr('rel') - 1;
                nivoRun(slider, kids, settings, 'control');
            });
        }
        
        //For pauseOnHover setting
        if(settings.pauseOnHover){
            slider.hover(function(){
                vars.paused = true;
                clearInterval(timer);
                timer = '';
            }, function(){
                vars.paused = false;
                // Restart the timer
                if(timer === '' && !settings.manualAdvance){
                    timer = setInterval(function(){ nivoRun(slider, kids, settings, false); }, settings.pauseTime);
                }
            });
        }
        
        // Event when Animation finishes
        slider.bind('nivo:animFinished', function(){
            sliderImg.attr('src', vars.currentImage.attr('src'));
            vars.running = false; 
            // Hide child links
            $(kids).each(function(){
                if($(this).is('a')){
                   $(this).css('display','none');
                }
            });
            // Show current link
            if($(kids[vars.currentSlide]).is('a')){
                $(kids[vars.currentSlide]).css('display','block');
            }
            // Restart the timer
            if(timer === '' && !vars.paused && !settings.manualAdvance){
                timer = setInterval(function(){ nivoRun(slider, kids, settings, false); }, settings.pauseTime);
            }
            // Trigger the afterChange callback
            settings.afterChange.call(this);
        }); 
        
        // Add slices for slice animations
        var createSlices = function(slider, settings, vars) {
        	if($(vars.currentImage).parent().is('a')) $(vars.currentImage).parent().css('display','block');
            $('img[src="'+ vars.currentImage.attr('src') +'"]', slider).not('.nivo-main-image,.nivo-control img').width(slider.width()).css('visibility', 'hidden').show();
            var sliceHeight = ($('img[src="'+ vars.currentImage.attr('src') +'"]', slider).not('.nivo-main-image,.nivo-control img').parent().is('a')) ? $('img[src="'+ vars.currentImage.attr('src') +'"]', slider).not('.nivo-main-image,.nivo-control img').parent().height() : $('img[src="'+ vars.currentImage.attr('src') +'"]', slider).not('.nivo-main-image,.nivo-control img').height();

            for(var i = 0; i < settings.slices; i++){
                var sliceWidth = Math.round(slider.width()/settings.slices);
                
                if(i === settings.slices-1){
                    slider.append(
                        $('<div class="nivo-slice" name="'+i+'"><img src="'+ vars.currentImage.attr('src') +'" style="position:absolute; width:'+ slider.width() +'px; height:auto; display:block !important; top:0; left:-'+ ((sliceWidth + (i * sliceWidth)) - sliceWidth) +'px;" /></div>').css({ 
                            left:(sliceWidth*i)+'px', 
                            width:(slider.width()-(sliceWidth*i))+'px',
                            height:sliceHeight+'px', 
                            opacity:'0',
                            overflow:'hidden'
                        })
                    );
                } else {
                    slider.append(
                        $('<div class="nivo-slice" name="'+i+'"><img src="'+ vars.currentImage.attr('src') +'" style="position:absolute; width:'+ slider.width() +'px; height:auto; display:block !important; top:0; left:-'+ ((sliceWidth + (i * sliceWidth)) - sliceWidth) +'px;" /></div>').css({ 
                            left:(sliceWidth*i)+'px', 
                            width:sliceWidth+'px',
                            height:sliceHeight+'px',
                            opacity:'0',
                            overflow:'hidden'
                        })
                    );
                }
            }
            
            $('.nivo-slice', slider).height(sliceHeight);
            sliderImg.stop().animate({
                height: $(vars.currentImage).height()
            }, settings.animSpeed);
        };
        
        // Add boxes for box animations
        var createBoxes = function(slider, settings, vars){
        	if($(vars.currentImage).parent().is('a')) $(vars.currentImage).parent().css('display','block');
            $('img[src="'+ vars.currentImage.attr('src') +'"]', slider).not('.nivo-main-image,.nivo-control img').width(slider.width()).css('visibility', 'hidden').show();
            var boxWidth = Math.round(slider.width()/settings.boxCols),
                boxHeight = Math.round($('img[src="'+ vars.currentImage.attr('src') +'"]', slider).not('.nivo-main-image,.nivo-control img').height() / settings.boxRows);
            
                        
            for(var rows = 0; rows < settings.boxRows; rows++){
                for(var cols = 0; cols < settings.boxCols; cols++){
                    if(cols === settings.boxCols-1){
                        slider.append(
                            $('<div class="nivo-box" name="'+ cols +'" rel="'+ rows +'"><img src="'+ vars.currentImage.attr('src') +'" style="position:absolute; width:'+ slider.width() +'px; height:auto; display:block; top:-'+ (boxHeight*rows) +'px; left:-'+ (boxWidth*cols) +'px;" /></div>').css({ 
                                opacity:0,
                                left:(boxWidth*cols)+'px', 
                                top:(boxHeight*rows)+'px',
                                width:(slider.width()-(boxWidth*cols))+'px'
                                
                            })
                        );
                        $('.nivo-box[name="'+ cols +'"]', slider).height($('.nivo-box[name="'+ cols +'"] img', slider).height()+'px');
                    } else {
                        slider.append(
                            $('<div class="nivo-box" name="'+ cols +'" rel="'+ rows +'"><img src="'+ vars.currentImage.attr('src') +'" style="position:absolute; width:'+ slider.width() +'px; height:auto; display:block; top:-'+ (boxHeight*rows) +'px; left:-'+ (boxWidth*cols) +'px;" /></div>').css({ 
                                opacity:0,
                                left:(boxWidth*cols)+'px', 
                                top:(boxHeight*rows)+'px',
                                width:boxWidth+'px'
                            })
                        );
                        $('.nivo-box[name="'+ cols +'"]', slider).height($('.nivo-box[name="'+ cols +'"] img', slider).height()+'px');
                    }
                }
            }
            
            sliderImg.stop().animate({
                height: $(vars.currentImage).height()
            }, settings.animSpeed);
        };

        // Private run method
        var nivoRun = function(slider, kids, settings, nudge){          
            // Get our vars
            var vars = slider.data('nivo:vars');
            
            // Trigger the lastSlide callback
            if(vars && (vars.currentSlide === vars.totalSlides - 1)){ 
                settings.lastSlide.call(this);
            }
            
            // Stop
            if((!vars || vars.stop) && !nudge) { return false; }
            
            // Trigger the beforeChange callback
            settings.beforeChange.call(this);

            // Set current background before change
            if(!nudge){
                sliderImg.attr('src', vars.currentImage.attr('src'));
            } else {
                if(nudge === 'prev'){
                    sliderImg.attr('src', vars.currentImage.attr('src'));
                }
                if(nudge === 'next'){
                    sliderImg.attr('src', vars.currentImage.attr('src'));
                }
            }
            
            vars.currentSlide++;
            // Trigger the slideshowEnd callback
            if(vars.currentSlide === vars.totalSlides){ 
                vars.currentSlide = 0;
                settings.slideshowEnd.call(this);
            }
            if(vars.currentSlide < 0) { vars.currentSlide = (vars.totalSlides - 1); }
            // Set vars.currentImage
            if($(kids[vars.currentSlide]).is('img')){
                vars.currentImage = $(kids[vars.currentSlide]);
            } else {
                vars.currentImage = $(kids[vars.currentSlide]).find('img:first');
            }
            
            // Set active links
            if(settings.controlNav){
                $('a', vars.controlNavEl).removeClass('active');
                $('a:eq('+ vars.currentSlide +')', vars.controlNavEl).addClass('active');
            }
            
            // Process caption
            processCaption(settings);            
            
            // Remove any slices from last transition
            $('.nivo-slice', slider).remove();
            
            // Remove any boxes from last transition
            $('.nivo-box', slider).remove();
            
            var currentEffect = settings.effect,
                anims = '';
                
            // Generate random effect
            if(settings.effect === 'random'){
                anims = new Array('sliceDownRight','sliceDownLeft','sliceUpRight','sliceUpLeft','sliceUpDown','sliceUpDownLeft','fold','fade',
                'boxRandom','boxRain','boxRainReverse','boxRainGrow','boxRainGrowReverse');
                currentEffect = anims[Math.floor(Math.random()*(anims.length + 1))];
                if(currentEffect === undefined) { currentEffect = 'fade'; }
            }
            
            // Run random effect from specified set (eg: effect:'fold,fade')
            if(settings.effect.indexOf(',') !== -1){
                anims = settings.effect.split(',');
                currentEffect = anims[Math.floor(Math.random()*(anims.length))];
                if(currentEffect === undefined) { currentEffect = 'fade'; }
            }
            
            // Custom transition as defined by "data-transition" attribute
            if(vars.currentImage.attr('data-transition')){
                currentEffect = vars.currentImage.attr('data-transition');
            }
        
            // Run effects
            vars.running = true;
            var timeBuff = 0,
                i = 0,
                slices = '',
                firstSlice = '',
                totalBoxes = '',
                boxes = '';
            
            if(currentEffect === 'sliceDown' || currentEffect === 'sliceDownRight' || currentEffect === 'sliceDownLeft'){
                createSlices(slider, settings, vars);
                timeBuff = 0;
                i = 0;
                slices = $('.nivo-slice', slider);
                if(currentEffect === 'sliceDownLeft') { slices = $('.nivo-slice', slider)._reverse(); }
                
                slices.each(function(){
                    var slice = $(this);
                    slice.css({ 'top': '0px' });
                    if(i === settings.slices-1){
                        setTimeout(function(){
                            slice.animate({opacity:'1.0' }, settings.animSpeed, '', function(){ slider.trigger('nivo:animFinished'); });
                        }, (100 + timeBuff));
                    } else {
                        setTimeout(function(){
                            slice.animate({opacity:'1.0' }, settings.animSpeed);
                        }, (100 + timeBuff));
                    }
                    timeBuff += 50;
                    i++;
                });
            } else if(currentEffect === 'sliceUp' || currentEffect === 'sliceUpRight' || currentEffect === 'sliceUpLeft'){
                createSlices(slider, settings, vars);
                timeBuff = 0;
                i = 0;
                slices = $('.nivo-slice', slider);
                if(currentEffect === 'sliceUpLeft') { slices = $('.nivo-slice', slider)._reverse(); }
                
                slices.each(function(){
                    var slice = $(this);
                    slice.css({ 'bottom': '0px' });
                    if(i === settings.slices-1){
                        setTimeout(function(){
                            slice.animate({opacity:'1.0' }, settings.animSpeed, '', function(){ slider.trigger('nivo:animFinished'); });
                        }, (100 + timeBuff));
                    } else {
                        setTimeout(function(){
                            slice.animate({opacity:'1.0' }, settings.animSpeed);
                        }, (100 + timeBuff));
                    }
                    timeBuff += 50;
                    i++;
                });
            } else if(currentEffect === 'sliceUpDown' || currentEffect === 'sliceUpDownRight' || currentEffect === 'sliceUpDownLeft'){
                createSlices(slider, settings, vars);
                timeBuff = 0;
                i = 0;
                var v = 0;
                slices = $('.nivo-slice', slider);
                if(currentEffect === 'sliceUpDownLeft') { slices = $('.nivo-slice', slider)._reverse(); }
                
                slices.each(function(){
                    var slice = $(this);
                    if(i === 0){
                        slice.css('top','0px');
                        i++;
                    } else {
                        slice.css('bottom','0px');
                        i = 0;
                    }
                    
                    if(v === settings.slices-1){
                        setTimeout(function(){
                            slice.animate({opacity:'1.0' }, settings.animSpeed, '', function(){ slider.trigger('nivo:animFinished'); });
                        }, (100 + timeBuff));
                    } else {
                        setTimeout(function(){
                            slice.animate({opacity:'1.0' }, settings.animSpeed);
                        }, (100 + timeBuff));
                    }
                    timeBuff += 50;
                    v++;
                });
            } else if(currentEffect === 'fold'){
                createSlices(slider, settings, vars);
                timeBuff = 0;
                i = 0;
                
                $('.nivo-slice', slider).each(function(){
                    var slice = $(this);
                    var origWidth = slice.width();
                    slice.css({ top:'0px', width:'0px' });
                    if(i === settings.slices-1){
                        setTimeout(function(){
                            slice.animate({ width:origWidth, opacity:'1.0' }, settings.animSpeed, '', function(){ slider.trigger('nivo:animFinished'); });
                        }, (100 + timeBuff));
                    } else {
                        setTimeout(function(){
                            slice.animate({ width:origWidth, opacity:'1.0' }, settings.animSpeed);
                        }, (100 + timeBuff));
                    }
                    timeBuff += 50;
                    i++;
                });
            } else if(currentEffect === 'fade'){
                createSlices(slider, settings, vars);
                
                firstSlice = $('.nivo-slice:first', slider);
                firstSlice.css({
                    'width': slider.width() + 'px'
                });
    
                firstSlice.animate({ opacity:'1.0' }, (settings.animSpeed*2), '', function(){ slider.trigger('nivo:animFinished'); });
            } else if(currentEffect === 'slideInRight'){
                createSlices(slider, settings, vars);
                
                firstSlice = $('.nivo-slice:first', slider);
                firstSlice.css({
                    'width': '0px',
                    'opacity': '1'
                });

                firstSlice.animate({ width: slider.width() + 'px' }, (settings.animSpeed*2), '', function(){ slider.trigger('nivo:animFinished'); });
            } else if(currentEffect === 'slideInLeft'){
                createSlices(slider, settings, vars);
                
                firstSlice = $('.nivo-slice:first', slider);
                firstSlice.css({
                    'width': '0px',
                    'opacity': '1',
                    'left': '',
                    'right': '0px'
                });

                firstSlice.animate({ width: slider.width() + 'px' }, (settings.animSpeed*2), '', function(){ 
                    // Reset positioning
                    firstSlice.css({
                        'left': '0px',
                        'right': ''
                    });
                    slider.trigger('nivo:animFinished'); 
                });
            } else if(currentEffect === 'boxRandom'){
                createBoxes(slider, settings, vars);
                
                totalBoxes = settings.boxCols * settings.boxRows;
                i = 0;
                timeBuff = 0;

                boxes = shuffle($('.nivo-box', slider));
                boxes.each(function(){
                    var box = $(this);
                    if(i === totalBoxes-1){
                        setTimeout(function(){
                            box.animate({ opacity:'1' }, settings.animSpeed, '', function(){ slider.trigger('nivo:animFinished'); });
                        }, (100 + timeBuff));
                    } else {
                        setTimeout(function(){
                            box.animate({ opacity:'1' }, settings.animSpeed);
                        }, (100 + timeBuff));
                    }
                    timeBuff += 20;
                    i++;
                });
            } else if(currentEffect === 'boxRain' || currentEffect === 'boxRainReverse' || currentEffect === 'boxRainGrow' || currentEffect === 'boxRainGrowReverse'){
                createBoxes(slider, settings, vars);
                
                totalBoxes = settings.boxCols * settings.boxRows;
                i = 0;
                timeBuff = 0;
                
                // Split boxes into 2D array
                var rowIndex = 0;
                var colIndex = 0;
                var box2Darr = [];
                box2Darr[rowIndex] = [];
                boxes = $('.nivo-box', slider);
                if(currentEffect === 'boxRainReverse' || currentEffect === 'boxRainGrowReverse'){
                    boxes = $('.nivo-box', slider)._reverse();
                }
                boxes.each(function(){
                    box2Darr[rowIndex][colIndex] = $(this);
                    colIndex++;
                    if(colIndex === settings.boxCols){
                        rowIndex++;
                        colIndex = 0;
                        box2Darr[rowIndex] = [];
                    }
                });
                
                // Run animation
                for(var cols = 0; cols < (settings.boxCols * 2); cols++){
                    var prevCol = cols;
                    for(var rows = 0; rows < settings.boxRows; rows++){
                        if(prevCol >= 0 && prevCol < settings.boxCols){
                            /* Due to some weird JS bug with loop vars 
                            being used in setTimeout, this is wrapped
                            with an anonymous function call */
                            (function(row, col, time, i, totalBoxes) {
                                var box = $(box2Darr[row][col]);
                                var w = box.width();
                                var h = box.height();
                                if(currentEffect === 'boxRainGrow' || currentEffect === 'boxRainGrowReverse'){
                                    box.width(0).height(0);
                                }
                                if(i === totalBoxes-1){
                                    setTimeout(function(){
                                        box.animate({ opacity:'1', width:w, height:h }, settings.animSpeed/1.3, '', function(){ slider.trigger('nivo:animFinished'); });
                                    }, (100 + time));
                                } else {
                                    setTimeout(function(){
                                        box.animate({ opacity:'1', width:w, height:h }, settings.animSpeed/1.3);
                                    }, (100 + time));
                                }
                            })(rows, prevCol, timeBuff, i, totalBoxes);
                            i++;
                        }
                        prevCol--;
                    }
                    timeBuff += 100;
                }
            }           
        };
        
        // Shuffle an array
        var shuffle = function(arr){
            for(var j, x, i = arr.length; i; j = parseInt(Math.random() * i, 10), x = arr[--i], arr[i] = arr[j], arr[j] = x);
            return arr;
        };
        
        // For debugging
        var trace = function(msg){
            if(this.console && typeof console.log !== 'undefined') { console.log(msg); }
        };
        
        // Start / Stop
        this.stop = function(){
            if(!$(element).data('nivo:vars').stop){
                $(element).data('nivo:vars').stop = true;
                trace('Stop Slider');
            }
        };
        
        this.start = function(){
            if($(element).data('nivo:vars').stop){
                $(element).data('nivo:vars').stop = false;
                trace('Start Slider');
            }
        };
        
        // Trigger the afterLoad callback
        settings.afterLoad.call(this);
        
        return this;
    };
        
    $.fn.nivoSlider = function(options) {
        return this.each(function(key, value){
            var element = $(this);
            // Return early if this element already has a plugin instance
            if (element.data('nivoslider')) { return element.data('nivoslider'); }
            // Pass options to plugin constructor
            var nivoslider = new NivoSlider(this, options);
            // Store plugin object in this element's data
            element.data('nivoslider', nivoslider);
        });
    };
    
    //Default settings
    $.fn.nivoSlider.defaults = {
        effect: 'random',
        slices: 15,
        boxCols: 8,
        boxRows: 4,
        animSpeed: 400,
        pauseTime: 3000,
        startSlide: 0,
        directionNav: true,
        controlNav: true,
        controlNavThumbs: false,
        pauseOnHover: true,
        manualAdvance: false,
        prevText: 'Prev',
        nextText: 'Next',
        randomStart: false,
        beforeChange: function(){},
        afterChange: function(){},
        slideshowEnd: function(){},
        lastSlide: function(){},
        afterLoad: function(){}
    };

    $.fn._reverse = [].reverse;
    
})(jQuery);


/* ====================================================================================================================
 * Nivo Slider End
 * ====================================================================================================================*/




 
/* ====================================================================================================================
 * bxslider Start
 * ====================================================================================================================*/


/**

 * BxSlider v4.1.2 - Fully loaded, responsive content slider

 * http://bxslider.com

 *

 * Copyright 2014, Steven Wanderski - http://stevenwanderski.com - http://bxcreative.com

 * Written while drinking Belgian ales and listening to jazz

 *

 * Released under the MIT license - http://opensource.org/licenses/MIT

 */



;(function($){



	var plugin = {};



	var defaults = {



		// GENERAL

		mode: 'horizontal',

		slideSelector: '',

		infiniteLoop: true,

		hideControlOnEnd: false,

		speed: 500,

		easing: null,

		slideMargin: 0,

		startSlide: 0,

		randomStart: false,

		captions: false,

		ticker: false,

		tickerHover: false,

		adaptiveHeight: false,

		adaptiveHeightSpeed: 500,

		video: false,

		useCSS: true,

		preloadImages: 'visible',

		responsive: true,

		slideZIndex: 50,

		wrapperClass: 'bx-wrapper',



		// TOUCH

		touchEnabled: true,

		swipeThreshold: 50,

		oneToOneTouch: true,

		preventDefaultSwipeX: true,

		preventDefaultSwipeY: false,



		// PAGER

		pager: true,

		pagerType: 'full',

		pagerShortSeparator: ' / ',

		pagerSelector: null,

		buildPager: null,

		pagerCustom: null,



		// CONTROLS

		controls: true,

		nextText: '&#xf054;',

		prevText: '&#xf053;',

		nextSelector: null,

		prevSelector: null,

		autoControls: false,

		startText: 'Start',

		stopText: 'Stop',

		autoControlsCombine: false,

		autoControlsSelector: null,



		// AUTO

		auto:true,

		pause: 4000,

		autoStart: true,

		autoDirection: 'next',

		autoHover: false,

		autoDelay: 0,

		autoSlideForOnePage: false,



		// CAROUSEL

		minSlides: 1,

		maxSlides: 1,

		moveSlides: 0,

		slideWidth: 0,



		// CALLBACKS

		onSliderLoad: function() {},

		onSlideBefore: function() {},

		onSlideAfter: function() {},

		onSlideNext: function() {},

		onSlidePrev: function() {},

		onSliderResize: function() {}

	}



	$.fn.bxSlider = function(options){



		if(this.length == 0) return this;



		// support mutltiple elements

		if(this.length > 1){

			this.each(function(){$(this).bxSlider(options)});

			return this;

		}



		// create a namespace to be used throughout the plugin

		var slider = {};

		// set a reference to our slider element

		var el = this;

		plugin.el = this;



		/**

		 * Makes slideshow responsive

		 */

		// first get the original window dimens (thanks alot IE)

		var windowWidth = $(window).width();

		var windowHeight = $(window).height();







		/**

		 * ===================================================================================

		 * = PRIVATE FUNCTIONS

		 * ===================================================================================

		 */



		/**

		 * Initializes namespace settings to be used throughout plugin

		 */

		var init = function(){

			// merge user-supplied options with the defaults

			slider.settings = $.extend({}, defaults, options);

			// parse slideWidth setting

			slider.settings.slideWidth = parseInt(slider.settings.slideWidth);

			// store the original children

			slider.children = el.children(slider.settings.slideSelector);

			// check if actual number of slides is less than minSlides / maxSlides

			if(slider.children.length < slider.settings.minSlides) slider.settings.minSlides = slider.children.length;

			if(slider.children.length < slider.settings.maxSlides) slider.settings.maxSlides = slider.children.length;

			// if random start, set the startSlide setting to random number

			if(slider.settings.randomStart) slider.settings.startSlide = Math.floor(Math.random() * slider.children.length);

			// store active slide information

			slider.active = { index: slider.settings.startSlide }

			// store if the slider is in carousel mode (displaying / moving multiple slides)

			slider.carousel = slider.settings.minSlides > 1 || slider.settings.maxSlides > 1;

			// if carousel, force preloadImages = 'all'

			if(slider.carousel) slider.settings.preloadImages = 'all';

			// calculate the min / max width thresholds based on min / max number of slides

			// used to setup and update carousel slides dimensions

			slider.minThreshold = (slider.settings.minSlides * slider.settings.slideWidth) + ((slider.settings.minSlides - 1) * slider.settings.slideMargin);

			slider.maxThreshold = (slider.settings.maxSlides * slider.settings.slideWidth) + ((slider.settings.maxSlides - 1) * slider.settings.slideMargin);

			// store the current state of the slider (if currently animating, working is true)

			slider.working = false;

			// initialize the controls object

			slider.controls = {};

			// initialize an auto interval

			slider.interval = null;

			// determine which property to use for transitions

			slider.animProp = slider.settings.mode == 'vertical' ? 'top' : 'left';

			// determine if hardware acceleration can be used

			slider.usingCSS = slider.settings.useCSS && slider.settings.mode != 'fade' && (function(){

				// create our test div element

				var div = document.createElement('div');

				// css transition properties

				var props = ['WebkitPerspective', 'MozPerspective', 'OPerspective', 'msPerspective'];

				// test for each property

				for(var i in props){

					if(div.style[props[i]] !== undefined){

						slider.cssPrefix = props[i].replace('Perspective', '').toLowerCase();

						slider.animProp = '-' + slider.cssPrefix + '-transform';

						return true;

					}

				}

				return false;

			}());

			// if vertical mode always make maxSlides and minSlides equal

			if(slider.settings.mode == 'vertical') slider.settings.maxSlides = slider.settings.minSlides;

			// save original style data

			el.data("origStyle", el.attr("style"));

			el.children(slider.settings.slideSelector).each(function() {

			  $(this).data("origStyle", $(this).attr("style"));

			});

			// perform all DOM / CSS modifications

			setup();

		}



		/**

		 * Performs all DOM and CSS modifications

		 */

		var setup = function(){

			// wrap el in a wrapper

			el.wrap('<div class="' + slider.settings.wrapperClass + '"><div class="bx-viewport"></div></div>');

			// store a namspace reference to .bx-viewport

			slider.viewport = el.parent();

			// add a loading div to display while images are loading

			slider.loader = $('<div class="bx-loading" />');

			slider.viewport.prepend(slider.loader);

			// set el to a massive width, to hold any needed slides

			// also strip any margin and padding from el

			el.css({

				width: slider.settings.mode == 'horizontal' ? (slider.children.length * 100 + 215) + '%' : 'auto',

				position: 'relative'

			});

			// if using CSS, add the easing property

			if(slider.usingCSS && slider.settings.easing){

				el.css('-' + slider.cssPrefix + '-transition-timing-function', slider.settings.easing);

			// if not using CSS and no easing value was supplied, use the default JS animation easing (swing)

			}else if(!slider.settings.easing){

				slider.settings.easing = 'swing';

			}

			var slidesShowing = getNumberSlidesShowing();

			// make modifications to the viewport (.bx-viewport)

			slider.viewport.css({

				width: '100%',

				overflow: 'hidden',

				position: 'relative'

			});

			slider.viewport.parent().css({

				maxWidth: getViewportMaxWidth()

			});

			// make modification to the wrapper (.bx-wrapper)

			if(!slider.settings.pager) {

				slider.viewport.parent().css({

				margin: '0 auto 0px'

				});

			}

			// apply css to all slider children

			slider.children.css({

				'float': slider.settings.mode == 'horizontal' ? 'left' : 'none',

				listStyle: 'none',

				position: 'relative'

			});

			// apply the calculated width after the float is applied to prevent scrollbar interference

			slider.children.css('width', getSlideWidth());

			// if slideMargin is supplied, add the css

			if(slider.settings.mode == 'horizontal' && slider.settings.slideMargin > 0) slider.children.css('marginRight', slider.settings.slideMargin);

			if(slider.settings.mode == 'vertical' && slider.settings.slideMargin > 0) slider.children.css('marginBottom', slider.settings.slideMargin);

			// if "fade" mode, add positioning and z-index CSS

			if(slider.settings.mode == 'fade'){

				slider.children.css({

					position: 'absolute',

					zIndex: 0,

					display: 'none'

				});

				// prepare the z-index on the showing element

				slider.children.eq(slider.settings.startSlide).css({zIndex: slider.settings.slideZIndex, display: 'block'});

			}

			// create an element to contain all slider controls (pager, start / stop, etc)

			slider.controls.el = $('<div class="bx-controls" />');

			// if captions are requested, add them

			if(slider.settings.captions) appendCaptions();

			// check if startSlide is last slide

			slider.active.last = slider.settings.startSlide == getPagerQty() - 1;

			// if video is true, set up the fitVids plugin

			if(slider.settings.video) el.fitVids();

			// set the default preload selector (visible)

			var preloadSelector = slider.children.eq(slider.settings.startSlide);

			if (slider.settings.preloadImages == "all") preloadSelector = slider.children;

			// only check for control addition if not in "ticker" mode

			if(!slider.settings.ticker){

				// if pager is requested, add it

				if(slider.settings.pager) appendPager();

				// if controls are requested, add them

				if(slider.settings.controls) appendControls();

				// if auto is true, and auto controls are requested, add them

				if(slider.settings.auto && slider.settings.autoControls) appendControlsAuto();

				// if any control option is requested, add the controls wrapper

				if(slider.settings.controls || slider.settings.autoControls || slider.settings.pager) slider.viewport.after(slider.controls.el);

			// if ticker mode, do not allow a pager

			}else{

				slider.settings.pager = false;

			}

			// preload all images, then perform final DOM / CSS modifications that depend on images being loaded

			loadElements(preloadSelector, start);

		}



		var loadElements = function(selector, callback){

			var total = selector.find('img, iframe').length;

			if (total == 0){

				callback();

				return;

			}

			var count = 0;

			selector.find('img, iframe').each(function(){

				$(this).one('load', function() {

				  if(++count == total) callback();

				}).each(function() {

				  if(this.complete) $(this).load();

				});

			});

		}



		/**

		 * Start the slider

		 */

		var start = function(){

			// if infinite loop, prepare additional slides

			if(slider.settings.infiniteLoop && slider.settings.mode != 'fade' && !slider.settings.ticker){

				var slice = slider.settings.mode == 'vertical' ? slider.settings.minSlides : slider.settings.maxSlides;

				var sliceAppend = slider.children.slice(0, slice).clone().addClass('bx-clone');

				var slicePrepend = slider.children.slice(-slice).clone().addClass('bx-clone');

				el.append(sliceAppend).prepend(slicePrepend);

			}

			// remove the loading DOM element

			slider.loader.remove();

			// set the left / top position of "el"

			setSlidePosition();

			// if "vertical" mode, always use adaptiveHeight to prevent odd behavior

			if (slider.settings.mode == 'vertical') slider.settings.adaptiveHeight = true;

			// set the viewport height

			slider.viewport.height(getViewportHeight());

			// make sure everything is positioned just right (same as a window resize)

			el.redrawSlider();

			// onSliderLoad callback

			slider.settings.onSliderLoad(slider.active.index);

			// slider has been fully initialized

			slider.initialized = true;

			// bind the resize call to the window

			if (slider.settings.responsive) $(window).bind('resize', resizeWindow);

			// if auto is true and has more than 1 page, start the show

			if (slider.settings.auto && slider.settings.autoStart && (getPagerQty() > 1 || slider.settings.autoSlideForOnePage)) initAuto();

			// if ticker is true, start the ticker

			if (slider.settings.ticker) initTicker();

			// if pager is requested, make the appropriate pager link active

			if (slider.settings.pager) updatePagerActive(slider.settings.startSlide);

			// check for any updates to the controls (like hideControlOnEnd updates)

			if (slider.settings.controls) updateDirectionControls();

			// if touchEnabled is true, setup the touch events

			if (slider.settings.touchEnabled && !slider.settings.ticker) initTouch();

		}



		/**

		 * Returns the calculated height of the viewport, used to determine either adaptiveHeight or the maxHeight value

		 */

		var getViewportHeight = function(){

			var height = 0;

			// first determine which children (slides) should be used in our height calculation

			var children = $();

			// if mode is not "vertical" and adaptiveHeight is false, include all children

			if(slider.settings.mode != 'vertical' && !slider.settings.adaptiveHeight){

				children = slider.children;

			}else{

				// if not carousel, return the single active child

				if(!slider.carousel){

					children = slider.children.eq(slider.active.index);

				// if carousel, return a slice of children

				}else{

					// get the individual slide index

					var currentIndex = slider.settings.moveSlides == 1 ? slider.active.index : slider.active.index * getMoveBy();

					// add the current slide to the children

					children = slider.children.eq(currentIndex);

					// cycle through the remaining "showing" slides

					for (i = 1; i <= slider.settings.maxSlides - 1; i++){

						// if looped back to the start

						if(currentIndex + i >= slider.children.length){

							children = children.add(slider.children.eq(i - 1));

						}else{

							children = children.add(slider.children.eq(currentIndex + i));

						}

					}

				}

			}

			// if "vertical" mode, calculate the sum of the heights of the children

			if(slider.settings.mode == 'vertical'){

				children.each(function(index) {

				  height += $(this).outerHeight();

				});

				// add user-supplied margins

				if(slider.settings.slideMargin > 0){

					height += slider.settings.slideMargin * (slider.settings.minSlides - 1);

				}

			// if not "vertical" mode, calculate the max height of the children

			}else{

				height = Math.max.apply(Math, children.map(function(){

					return $(this).outerHeight(false);

				}).get());

			}



			if(slider.viewport.css('box-sizing') == 'border-box'){

				height +=	parseFloat(slider.viewport.css('padding-top')) + parseFloat(slider.viewport.css('padding-bottom')) +

							parseFloat(slider.viewport.css('border-top-width')) + parseFloat(slider.viewport.css('border-bottom-width'));

			}else if(slider.viewport.css('box-sizing') == 'padding-box'){

				height +=	parseFloat(slider.viewport.css('padding-top')) + parseFloat(slider.viewport.css('padding-bottom'));

			}



			return height;

		}



		/**

		 * Returns the calculated width to be used for the outer wrapper / viewport

		 */

		var getViewportMaxWidth = function(){

			var width = '100%';

			if(slider.settings.slideWidth > 0){

				if(slider.settings.mode == 'horizontal'){

					width = (slider.settings.maxSlides * slider.settings.slideWidth) + ((slider.settings.maxSlides - 1) * slider.settings.slideMargin);

				}else{

					width = slider.settings.slideWidth;

				}

			}

			return width;

		}



		/**

		 * Returns the calculated width to be applied to each slide

		 */

		var getSlideWidth = function(){

			// start with any user-supplied slide width

			var newElWidth = slider.settings.slideWidth;

			// get the current viewport width

			var wrapWidth = slider.viewport.width();

			// if slide width was not supplied, or is larger than the viewport use the viewport width

			if(slider.settings.slideWidth == 0 ||

				(slider.settings.slideWidth > wrapWidth && !slider.carousel) ||

				slider.settings.mode == 'vertical'){

				newElWidth = wrapWidth;

			// if carousel, use the thresholds to determine the width

			}else if(slider.settings.maxSlides > 1 && slider.settings.mode == 'horizontal'){

				if(wrapWidth > slider.maxThreshold){

					// newElWidth = (wrapWidth - (slider.settings.slideMargin * (slider.settings.maxSlides - 1))) / slider.settings.maxSlides;

				}else if(wrapWidth < slider.minThreshold){

					newElWidth = (wrapWidth - (slider.settings.slideMargin * (slider.settings.minSlides - 1))) / slider.settings.minSlides;

				}

			}

			return newElWidth;

		}



		/**

		 * Returns the number of slides currently visible in the viewport (includes partially visible slides)

		 */

		var getNumberSlidesShowing = function(){

			var slidesShowing = 1;

			if(slider.settings.mode == 'horizontal' && slider.settings.slideWidth > 0){

				// if viewport is smaller than minThreshold, return minSlides

				if(slider.viewport.width() < slider.minThreshold){

					slidesShowing = slider.settings.minSlides;

				// if viewport is larger than minThreshold, return maxSlides

				}else if(slider.viewport.width() > slider.maxThreshold){

					slidesShowing = slider.settings.maxSlides;

				// if viewport is between min / max thresholds, divide viewport width by first child width

				}else{

					var childWidth = slider.children.first().width() + slider.settings.slideMargin;

					slidesShowing = Math.floor((slider.viewport.width() +

						slider.settings.slideMargin) / childWidth);

				}

			// if "vertical" mode, slides showing will always be minSlides

			}else if(slider.settings.mode == 'vertical'){

				slidesShowing = slider.settings.minSlides;

			}

			return slidesShowing;

		}



		/**

		 * Returns the number of pages (one full viewport of slides is one "page")

		 */

		var getPagerQty = function(){

			var pagerQty = 0;

			// if moveSlides is specified by the user

			if(slider.settings.moveSlides > 0){

				if(slider.settings.infiniteLoop){

					pagerQty = Math.ceil(slider.children.length / getMoveBy());

				}else{

					// use a while loop to determine pages

					var breakPoint = 0;

					var counter = 0

					// when breakpoint goes above children length, counter is the number of pages

					while (breakPoint < slider.children.length){

						++pagerQty;

						breakPoint = counter + getNumberSlidesShowing();

						counter += slider.settings.moveSlides <= getNumberSlidesShowing() ? slider.settings.moveSlides : getNumberSlidesShowing();

					}

				}

			// if moveSlides is 0 (auto) divide children length by sides showing, then round up

			}else{

				pagerQty = Math.ceil(slider.children.length / getNumberSlidesShowing());

			}

			return pagerQty;

		}



		/**

		 * Returns the number of indivual slides by which to shift the slider

		 */

		var getMoveBy = function(){

			// if moveSlides was set by the user and moveSlides is less than number of slides showing

			if(slider.settings.moveSlides > 0 && slider.settings.moveSlides <= getNumberSlidesShowing()){

				return slider.settings.moveSlides;

			}

			// if moveSlides is 0 (auto)

			return getNumberSlidesShowing();

		}



		/**

		 * Sets the slider's (el) left or top position

		 */

		var setSlidePosition = function(){

			// if last slide, not infinite loop, and number of children is larger than specified maxSlides

			if(slider.children.length > slider.settings.maxSlides && slider.active.last && !slider.settings.infiniteLoop){

				if (slider.settings.mode == 'horizontal'){

					// get the last child's position

					var lastChild = slider.children.last();

					var position = lastChild.position();

					// set the left position

					setPositionProperty(-(position.left - (slider.viewport.width() - lastChild.outerWidth())), 'reset', 0);

				}else if(slider.settings.mode == 'vertical'){

					// get the last showing index's position

					var lastShowingIndex = slider.children.length - slider.settings.minSlides;

					var position = slider.children.eq(lastShowingIndex).position();

					// set the top position

					setPositionProperty(-position.top, 'reset', 0);

				}

			// if not last slide

			}else{

				// get the position of the first showing slide

				var position = slider.children.eq(slider.active.index * getMoveBy()).position();

				// check for last slide

				if (slider.active.index == getPagerQty() - 1) slider.active.last = true;

				// set the repective position

				if (position != undefined){

					if (slider.settings.mode == 'horizontal') setPositionProperty(-position.left, 'reset', 0);

					else if (slider.settings.mode == 'vertical') setPositionProperty(-position.top, 'reset', 0);

				}

			}

		}



		/**

		 * Sets the el's animating property position (which in turn will sometimes animate el).

		 * If using CSS, sets the transform property. If not using CSS, sets the top / left property.

		 *

		 * @param value (int)

		 *  - the animating property's value

		 *

		 * @param type (string) 'slider', 'reset', 'ticker'

		 *  - the type of instance for which the function is being

		 *

		 * @param duration (int)

		 *  - the amount of time (in ms) the transition should occupy

		 *

		 * @param params (array) optional

		 *  - an optional parameter containing any variables that need to be passed in

		 */

		var setPositionProperty = function(value, type, duration, params){

			// use CSS transform

			if(slider.usingCSS){

				// determine the translate3d value

				var propValue = slider.settings.mode == 'vertical' ? 'translate3d(0, ' + value + 'px, 0)' : 'translate3d(' + value + 'px, 0, 0)';

				// add the CSS transition-duration

				el.css('-' + slider.cssPrefix + '-transition-duration', duration / 1000 + 's');

				if(type == 'slide'){

					// set the property value

					el.css(slider.animProp, propValue);

					// bind a callback method - executes when CSS transition completes

					el.bind('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function(){

						// unbind the callback

						el.unbind('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');

						updateAfterSlideTransition();

					});

				}else if(type == 'reset'){

					el.css(slider.animProp, propValue);

				}else if(type == 'ticker'){

					// make the transition use 'linear'

					el.css('-' + slider.cssPrefix + '-transition-timing-function', 'linear');

					el.css(slider.animProp, propValue);

					// bind a callback method - executes when CSS transition completes

					el.bind('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function(){

						// unbind the callback

						el.unbind('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd');

						// reset the position

						setPositionProperty(params['resetValue'], 'reset', 0);

						// start the loop again

						tickerLoop();

					});

				}

			// use JS animate

			}else{

				var animateObj = {};

				animateObj[slider.animProp] = value;

				if(type == 'slide'){

					el.animate(animateObj, duration, slider.settings.easing, function(){

						updateAfterSlideTransition();

					});

				}else if(type == 'reset'){

					el.css(slider.animProp, value)

				}else if(type == 'ticker'){

					el.animate(animateObj, speed, 'linear', function(){

						setPositionProperty(params['resetValue'], 'reset', 0);

						// run the recursive loop after animation

						tickerLoop();

					});

				}

			}

		}



		/**

		 * Populates the pager with proper amount of pages

		 */

		var populatePager = function(){

			var pagerHtml = '';

			var pagerQty = getPagerQty();

			// loop through each pager item

			for(var i=0; i < pagerQty; i++){

				var linkContent = '';

				// if a buildPager function is supplied, use it to get pager link value, else use index + 1

				if(slider.settings.buildPager && $.isFunction(slider.settings.buildPager)){

					linkContent = slider.settings.buildPager(i);

					slider.pagerEl.addClass('bx-custom-pager');

				}else{

					linkContent = i + 1;

					slider.pagerEl.addClass('bx-default-pager');

				}

				// var linkContent = slider.settings.buildPager && $.isFunction(slider.settings.buildPager) ? slider.settings.buildPager(i) : i + 1;

				// add the markup to the string

				pagerHtml += '<div class="bx-pager-item"><a href="" data-slide-index="' + i + '" class="bx-pager-link">' + linkContent + '</a></div>';

			};

			// populate the pager element with pager links

			slider.pagerEl.html(pagerHtml);

		}



		/**

		 * Appends the pager to the controls element

		 */

		var appendPager = function(){

			if(!slider.settings.pagerCustom){

				// create the pager DOM element

				slider.pagerEl = $('<div class="bx-pager" />');

				// if a pager selector was supplied, populate it with the pager

				if(slider.settings.pagerSelector){

					$(slider.settings.pagerSelector).html(slider.pagerEl);

				// if no pager selector was supplied, add it after the wrapper

				}else{

					slider.controls.el.addClass('bx-has-pager').append(slider.pagerEl);

				}

				// populate the pager

				populatePager();

			}else{

				slider.pagerEl = $(slider.settings.pagerCustom);

			}

			// assign the pager click binding

			slider.pagerEl.on('click', 'a', clickPagerBind);

		}



		/**

		 * Appends prev / next controls to the controls element

		 */

		var appendControls = function(){

			slider.controls.next = $('<a class="bx-next" href="">' + slider.settings.nextText + '</a>');

			slider.controls.prev = $('<a class="bx-prev" href="">' + slider.settings.prevText + '</a>');

			// bind click actions to the controls

			slider.controls.next.bind('click', clickNextBind);

			slider.controls.prev.bind('click', clickPrevBind);

			// if nextSlector was supplied, populate it

			if(slider.settings.nextSelector){

				$(slider.settings.nextSelector).append(slider.controls.next);

			}

			// if prevSlector was supplied, populate it

			if(slider.settings.prevSelector){

				$(slider.settings.prevSelector).append(slider.controls.prev);

			}

			// if no custom selectors were supplied

			if(!slider.settings.nextSelector && !slider.settings.prevSelector){

				// add the controls to the DOM

				slider.controls.directionEl = $('<div class="bx-controls-direction" />');

				// add the control elements to the directionEl

				slider.controls.directionEl.append(slider.controls.prev).append(slider.controls.next);

				// slider.viewport.append(slider.controls.directionEl);

				slider.controls.el.addClass('bx-has-controls-direction').append(slider.controls.directionEl);

			}

		}



		/**

		 * Appends start / stop auto controls to the controls element

		 */

		var appendControlsAuto = function(){

			slider.controls.start = $('<div class="bx-controls-auto-item"><a class="bx-start" href="">' + slider.settings.startText + '</a></div>');

			slider.controls.stop = $('<div class="bx-controls-auto-item"><a class="bx-stop" href="">' + slider.settings.stopText + '</a></div>');

			// add the controls to the DOM

			slider.controls.autoEl = $('<div class="bx-controls-auto" />');

			// bind click actions to the controls

			slider.controls.autoEl.on('click', '.bx-start', clickStartBind);

			slider.controls.autoEl.on('click', '.bx-stop', clickStopBind);

			// if autoControlsCombine, insert only the "start" control

			if(slider.settings.autoControlsCombine){

				slider.controls.autoEl.append(slider.controls.start);

			// if autoControlsCombine is false, insert both controls

			}else{

				slider.controls.autoEl.append(slider.controls.start).append(slider.controls.stop);

			}

			// if auto controls selector was supplied, populate it with the controls

			if(slider.settings.autoControlsSelector){

				$(slider.settings.autoControlsSelector).html(slider.controls.autoEl);

			// if auto controls selector was not supplied, add it after the wrapper

			}else{

				slider.controls.el.addClass('bx-has-controls-auto').append(slider.controls.autoEl);

			}

			// update the auto controls

			updateAutoControls(slider.settings.autoStart ? 'stop' : 'start');

		}



		/**

		 * Appends image captions to the DOM

		 */

		var appendCaptions = function(){

			// cycle through each child

			slider.children.each(function(index){

				// get the image title attribute

				var title = $(this).find('img:first').attr('title');

				// append the caption

				if (title != undefined && ('' + title).length) {

                    $(this).append('<div class="bx-caption"><span>' + title + '</span></div>');

                }

			});

		}



		/**

		 * Click next binding

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var clickNextBind = function(e){

			// if auto show is running, stop it

			if (slider.settings.auto) el.stopAuto();

			el.goToNextSlide();

			e.preventDefault();

		}



		/**

		 * Click prev binding

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var clickPrevBind = function(e){

			// if auto show is running, stop it

			if (slider.settings.auto) el.stopAuto();

			el.goToPrevSlide();

			e.preventDefault();

		}



		/**

		 * Click start binding

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var clickStartBind = function(e){

			el.startAuto();

			e.preventDefault();

		}



		/**

		 * Click stop binding

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var clickStopBind = function(e){

			el.stopAuto();

			e.preventDefault();

		}



		/**

		 * Click pager binding

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var clickPagerBind = function(e){

			// if auto show is running, stop it

			if (slider.settings.auto) el.stopAuto();

			var pagerLink = $(e.currentTarget);

			if(pagerLink.attr('data-slide-index') !== undefined){

				var pagerIndex = parseInt(pagerLink.attr('data-slide-index'));

				// if clicked pager link is not active, continue with the goToSlide call

				if(pagerIndex != slider.active.index) el.goToSlide(pagerIndex);

				e.preventDefault();

			}

		}



		/**

		 * Updates the pager links with an active class

		 *

		 * @param slideIndex (int)

		 *  - index of slide to make active

		 */

		var updatePagerActive = function(slideIndex){

			// if "short" pager type

			var len = slider.children.length; // nb of children

			if(slider.settings.pagerType == 'short'){

				if(slider.settings.maxSlides > 1) {

					len = Math.ceil(slider.children.length/slider.settings.maxSlides);

				}

				slider.pagerEl.html( (slideIndex + 1) + slider.settings.pagerShortSeparator + len);

				return;

			}

			// remove all pager active classes

			slider.pagerEl.find('a').removeClass('active');

			// apply the active class for all pagers

			slider.pagerEl.each(function(i, el) { $(el).find('a').eq(slideIndex).addClass('active'); });

		}



		/**

		 * Performs needed actions after a slide transition

		 */

		var updateAfterSlideTransition = function(){

			// if infinte loop is true

			if(slider.settings.infiniteLoop){

				var position = '';

				// first slide

				if(slider.active.index == 0){

					// set the new position

					position = slider.children.eq(0).position();

				// carousel, last slide

				}else if(slider.active.index == getPagerQty() - 1 && slider.carousel){

					position = slider.children.eq((getPagerQty() - 1) * getMoveBy()).position();

				// last slide

				}else if(slider.active.index == slider.children.length - 1){

					position = slider.children.eq(slider.children.length - 1).position();

				}

				if(position){

					if (slider.settings.mode == 'horizontal') { setPositionProperty(-position.left, 'reset', 0); }

					else if (slider.settings.mode == 'vertical') { setPositionProperty(-position.top, 'reset', 0); }

				}

			}

			// declare that the transition is complete

			slider.working = false;

			// onSlideAfter callback

			slider.settings.onSlideAfter(slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index);

		}



		/**

		 * Updates the auto controls state (either active, or combined switch)

		 *

		 * @param state (string) "start", "stop"

		 *  - the new state of the auto show

		 */

		var updateAutoControls = function(state){

			// if autoControlsCombine is true, replace the current control with the new state

			if(slider.settings.autoControlsCombine){

				slider.controls.autoEl.html(slider.controls[state]);

			// if autoControlsCombine is false, apply the "active" class to the appropriate control

			}else{

				slider.controls.autoEl.find('a').removeClass('active');

				slider.controls.autoEl.find('a:not(.bx-' + state + ')').addClass('active');

			}

		}



		/**

		 * Updates the direction controls (checks if either should be hidden)

		 */

		var updateDirectionControls = function(){

			if(getPagerQty() == 1){

				slider.controls.prev.addClass('disabled');

				slider.controls.next.addClass('disabled');

			}else if(!slider.settings.infiniteLoop && slider.settings.hideControlOnEnd){

				// if first slide

				if (slider.active.index == 0){

					slider.controls.prev.addClass('disabled');

					slider.controls.next.removeClass('disabled');

				// if last slide

				}else if(slider.active.index == getPagerQty() - 1){

					slider.controls.next.addClass('disabled');

					slider.controls.prev.removeClass('disabled');

				// if any slide in the middle

				}else{

					slider.controls.prev.removeClass('disabled');

					slider.controls.next.removeClass('disabled');

				}

			}

		}



		/**

		 * Initialzes the auto process

		 */

		var initAuto = function(){

			// if autoDelay was supplied, launch the auto show using a setTimeout() call

			if(slider.settings.autoDelay > 0){

				var timeout = setTimeout(el.startAuto, slider.settings.autoDelay);

			// if autoDelay was not supplied, start the auto show normally

			}else{

				el.startAuto();

			}

			// if autoHover is requested

			if(slider.settings.autoHover){

				// on el hover

				el.hover(function(){

					// if the auto show is currently playing (has an active interval)

					if(slider.interval){

						// stop the auto show and pass true agument which will prevent control update

						el.stopAuto(true);

						// create a new autoPaused value which will be used by the relative "mouseout" event

						slider.autoPaused = true;

					}

				}, function(){

					// if the autoPaused value was created be the prior "mouseover" event

					if(slider.autoPaused){

						// start the auto show and pass true agument which will prevent control update

						el.startAuto(true);

						// reset the autoPaused value

						slider.autoPaused = null;

					}

				});

			}

		}



		/**

		 * Initialzes the ticker process

		 */

		var initTicker = function(){

			var startPosition = 0;

			// if autoDirection is "next", append a clone of the entire slider

			if(slider.settings.autoDirection == 'next'){

				el.append(slider.children.clone().addClass('bx-clone'));

			// if autoDirection is "prev", prepend a clone of the entire slider, and set the left position

			}else{

				el.prepend(slider.children.clone().addClass('bx-clone'));

				var position = slider.children.first().position();

				startPosition = slider.settings.mode == 'horizontal' ? -position.left : -position.top;

			}

			setPositionProperty(startPosition, 'reset', 0);

			// do not allow controls in ticker mode

			slider.settings.pager = false;

			slider.settings.controls = false;

			slider.settings.autoControls = false;

			// if autoHover is requested

			if(slider.settings.tickerHover && !slider.usingCSS){

				// on el hover

				slider.viewport.hover(function(){

					el.stop();

				}, function(){

					// calculate the total width of children (used to calculate the speed ratio)

					var totalDimens = 0;

					slider.children.each(function(index){

					  totalDimens += slider.settings.mode == 'horizontal' ? $(this).outerWidth(true) : $(this).outerHeight(true);

					});

					// calculate the speed ratio (used to determine the new speed to finish the paused animation)

					var ratio = slider.settings.speed / totalDimens;

					// determine which property to use

					var property = slider.settings.mode == 'horizontal' ? 'left' : 'top';

					// calculate the new speed

					var newSpeed = ratio * (totalDimens - (Math.abs(parseInt(el.css(property)))));

					tickerLoop(newSpeed);

				});

			}

			// start the ticker loop

			tickerLoop();

		}



		/**

		 * Runs a continuous loop, news ticker-style

		 */

		var tickerLoop = function(resumeSpeed){

			speed = resumeSpeed ? resumeSpeed : slider.settings.speed;

			var position = {left: 0, top: 0};

			var reset = {left: 0, top: 0};

			// if "next" animate left position to last child, then reset left to 0

			if(slider.settings.autoDirection == 'next'){

				position = el.find('.bx-clone').first().position();

			// if "prev" animate left position to 0, then reset left to first non-clone child

			}else{

				reset = slider.children.first().position();

			}

			var animateProperty = slider.settings.mode == 'horizontal' ? -position.left : -position.top;

			var resetValue = slider.settings.mode == 'horizontal' ? -reset.left : -reset.top;

			var params = {resetValue: resetValue};

			setPositionProperty(animateProperty, 'ticker', speed, params);

		}



		/**

		 * Initializes touch events

		 */

		var initTouch = function(){

			// initialize object to contain all touch values

			slider.touch = {

				start: {x: 0, y: 0},

				end: {x: 0, y: 0}

			}

			slider.viewport.bind('touchstart', onTouchStart);

		}



		/**

		 * Event handler for "touchstart"

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var onTouchStart = function(e){

			if(slider.working){

				e.preventDefault();

			}else{

				// record the original position when touch starts

				slider.touch.originalPos = el.position();

				var orig = e.originalEvent;

				// record the starting touch x, y coordinates

				slider.touch.start.x = orig.changedTouches[0].pageX;

				slider.touch.start.y = orig.changedTouches[0].pageY;

				// bind a "touchmove" event to the viewport

				slider.viewport.bind('touchmove', onTouchMove);

				// bind a "touchend" event to the viewport

				slider.viewport.bind('touchend', onTouchEnd);

			}

		}



		/**

		 * Event handler for "touchmove"

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var onTouchMove = function(e){

			var orig = e.originalEvent;

			// if scrolling on y axis, do not prevent default

			var xMovement = Math.abs(orig.changedTouches[0].pageX - slider.touch.start.x);

			var yMovement = Math.abs(orig.changedTouches[0].pageY - slider.touch.start.y);

			// x axis swipe

			if((xMovement * 3) > yMovement && slider.settings.preventDefaultSwipeX){

				e.preventDefault();

			// y axis swipe

			}else if((yMovement * 3) > xMovement && slider.settings.preventDefaultSwipeY){

				e.preventDefault();

			}

			if(slider.settings.mode != 'fade' && slider.settings.oneToOneTouch){

				var value = 0;

				// if horizontal, drag along x axis

				if(slider.settings.mode == 'horizontal'){

					var change = orig.changedTouches[0].pageX - slider.touch.start.x;

					value = slider.touch.originalPos.left + change;

				// if vertical, drag along y axis

				}else{

					var change = orig.changedTouches[0].pageY - slider.touch.start.y;

					value = slider.touch.originalPos.top + change;

				}

				setPositionProperty(value, 'reset', 0);

			}

		}



		/**

		 * Event handler for "touchend"

		 *

		 * @param e (event)

		 *  - DOM event object

		 */

		var onTouchEnd = function(e){

			slider.viewport.unbind('touchmove', onTouchMove);

			var orig = e.originalEvent;

			var value = 0;

			// record end x, y positions

			slider.touch.end.x = orig.changedTouches[0].pageX;

			slider.touch.end.y = orig.changedTouches[0].pageY;

			// if fade mode, check if absolute x distance clears the threshold

			if(slider.settings.mode == 'fade'){

				var distance = Math.abs(slider.touch.start.x - slider.touch.end.x);

				if(distance >= slider.settings.swipeThreshold){

					slider.touch.start.x > slider.touch.end.x ? el.goToNextSlide() : el.goToPrevSlide();

					el.stopAuto();

				}

			// not fade mode

			}else{

				var distance = 0;

				// calculate distance and el's animate property

				if(slider.settings.mode == 'horizontal'){

					distance = slider.touch.end.x - slider.touch.start.x;

					value = slider.touch.originalPos.left;

				}else{

					distance = slider.touch.end.y - slider.touch.start.y;

					value = slider.touch.originalPos.top;

				}

				// if not infinite loop and first / last slide, do not attempt a slide transition

				if(!slider.settings.infiniteLoop && ((slider.active.index == 0 && distance > 0) || (slider.active.last && distance < 0))){

					setPositionProperty(value, 'reset', 200);

				}else{

					// check if distance clears threshold

					if(Math.abs(distance) >= slider.settings.swipeThreshold){

						distance < 0 ? el.goToNextSlide() : el.goToPrevSlide();

						el.stopAuto();

					}else{

						// el.animate(property, 200);

						setPositionProperty(value, 'reset', 200);

					}

				}

			}

			slider.viewport.unbind('touchend', onTouchEnd);

		}



		/**

		 * Window resize event callback

		 */

		var resizeWindow = function(e){

			// don't do anything if slider isn't initialized.

			if(!slider.initialized) return;

			// get the new window dimens (again, thank you IE)

			var windowWidthNew = $(window).width();

			var windowHeightNew = $(window).height();

			// make sure that it is a true window resize

			// *we must check this because our dinosaur friend IE fires a window resize event when certain DOM elements

			// are resized. Can you just die already?*

			if(windowWidth != windowWidthNew || windowHeight != windowHeightNew){

				// set the new window dimens

				windowWidth = windowWidthNew;

				windowHeight = windowHeightNew;

				// update all dynamic elements

				el.redrawSlider();

				// Call user resize handler

				slider.settings.onSliderResize.call(el, slider.active.index);

			}

		}



		/**

		 * ===================================================================================

		 * = PUBLIC FUNCTIONS

		 * ===================================================================================

		 */



		/**

		 * Performs slide transition to the specified slide

		 *

		 * @param slideIndex (int)

		 *  - the destination slide's index (zero-based)

		 *

		 * @param direction (string)

		 *  - INTERNAL USE ONLY - the direction of travel ("prev" / "next")

		 */

		el.goToSlide = function(slideIndex, direction){

			// if plugin is currently in motion, ignore request

			if(slider.working || slider.active.index == slideIndex) return;

			// declare that plugin is in motion

			slider.working = true;

			// store the old index

			slider.oldIndex = slider.active.index;

			// if slideIndex is less than zero, set active index to last child (this happens during infinite loop)

			if(slideIndex < 0){

				slider.active.index = getPagerQty() - 1;

			// if slideIndex is greater than children length, set active index to 0 (this happens during infinite loop)

			}else if(slideIndex >= getPagerQty()){

				slider.active.index = 0;

			// set active index to requested slide

			}else{

				slider.active.index = slideIndex;

			}

			// onSlideBefore, onSlideNext, onSlidePrev callbacks

			slider.settings.onSlideBefore(slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index);

			if(direction == 'next'){

				slider.settings.onSlideNext(slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index);

			}else if(direction == 'prev'){

				slider.settings.onSlidePrev(slider.children.eq(slider.active.index), slider.oldIndex, slider.active.index);

			}

			// check if last slide

			slider.active.last = slider.active.index >= getPagerQty() - 1;

			// update the pager with active class

			if(slider.settings.pager) updatePagerActive(slider.active.index);

			// // check for direction control update

			if(slider.settings.controls) updateDirectionControls();

			// if slider is set to mode: "fade"

			if(slider.settings.mode == 'fade'){

				// if adaptiveHeight is true and next height is different from current height, animate to the new height

				if(slider.settings.adaptiveHeight && slider.viewport.height() != getViewportHeight()){

					slider.viewport.animate({height: getViewportHeight()}, slider.settings.adaptiveHeightSpeed);

				}

				// fade out the visible child and reset its z-index value

				slider.children.filter(':visible').fadeOut(slider.settings.speed).css({zIndex: 0});

				// fade in the newly requested slide

				slider.children.eq(slider.active.index).css('zIndex', slider.settings.slideZIndex+1).fadeIn(slider.settings.speed, function(){

					$(this).css('zIndex', slider.settings.slideZIndex);

					updateAfterSlideTransition();

				});

			// slider mode is not "fade"

			}else{

				// if adaptiveHeight is true and next height is different from current height, animate to the new height

				if(slider.settings.adaptiveHeight && slider.viewport.height() != getViewportHeight()){

					slider.viewport.animate({height: getViewportHeight()}, slider.settings.adaptiveHeightSpeed);

				}

				var moveBy = 0;

				var position = {left: 0, top: 0};

				// if carousel and not infinite loop

				if(!slider.settings.infiniteLoop && slider.carousel && slider.active.last){

					if(slider.settings.mode == 'horizontal'){

						// get the last child position

						var lastChild = slider.children.eq(slider.children.length - 1);

						position = lastChild.position();

						// calculate the position of the last slide

						moveBy = slider.viewport.width() - lastChild.outerWidth();

					}else{

						// get last showing index position

						var lastShowingIndex = slider.children.length - slider.settings.minSlides;

						position = slider.children.eq(lastShowingIndex).position();

					}

					// horizontal carousel, going previous while on first slide (infiniteLoop mode)

				}else if(slider.carousel && slider.active.last && direction == 'prev'){

					// get the last child position

					var eq = slider.settings.moveSlides == 1 ? slider.settings.maxSlides - getMoveBy() : ((getPagerQty() - 1) * getMoveBy()) - (slider.children.length - slider.settings.maxSlides);

					var lastChild = el.children('.bx-clone').eq(eq);

					position = lastChild.position();

				// if infinite loop and "Next" is clicked on the last slide

				}else if(direction == 'next' && slider.active.index == 0){

					// get the last clone position

					position = el.find('> .bx-clone').eq(slider.settings.maxSlides).position();

					slider.active.last = false;

				// normal non-zero requests

				}else if(slideIndex >= 0){

					var requestEl = slideIndex * getMoveBy();

					position = slider.children.eq(requestEl).position();

				}



				/* If the position doesn't exist

				 * (e.g. if you destroy the slider on a next click),

				 * it doesn't throw an error.

				 */

				if ("undefined" !== typeof(position)) {

					var value = slider.settings.mode == 'horizontal' ? -(position.left - moveBy) : -position.top;

					// plugin values to be animated

					setPositionProperty(value, 'slide', slider.settings.speed);

				}

			}

		}



		/**

		 * Transitions to the next slide in the show

		 */

		el.goToNextSlide = function(){

			// if infiniteLoop is false and last page is showing, disregard call

			if (!slider.settings.infiniteLoop && slider.active.last) return;

			var pagerIndex = parseInt(slider.active.index) + 1;

			el.goToSlide(pagerIndex, 'next');

		}



		/**

		 * Transitions to the prev slide in the show

		 */

		el.goToPrevSlide = function(){

			// if infiniteLoop is false and last page is showing, disregard call

			if (!slider.settings.infiniteLoop && slider.active.index == 0) return;

			var pagerIndex = parseInt(slider.active.index) - 1;

			el.goToSlide(pagerIndex, 'prev');

		}



		/**

		 * Starts the auto show

		 *

		 * @param preventControlUpdate (boolean)

		 *  - if true, auto controls state will not be updated

		 */

		el.startAuto = function(preventControlUpdate){

			// if an interval already exists, disregard call

			if(slider.interval) return;

			// create an interval

			slider.interval = setInterval(function(){

				slider.settings.autoDirection == 'next' ? el.goToNextSlide() : el.goToPrevSlide();

			}, slider.settings.pause);

			// if auto controls are displayed and preventControlUpdate is not true

			if (slider.settings.autoControls && preventControlUpdate != true) updateAutoControls('stop');

		}



		/**

		 * Stops the auto show

		 *

		 * @param preventControlUpdate (boolean)

		 *  - if true, auto controls state will not be updated

		 */

		el.stopAuto = function(preventControlUpdate){

			// if no interval exists, disregard call

			if(!slider.interval) return;

			// clear the interval

			clearInterval(slider.interval);

			slider.interval = null;

			// if auto controls are displayed and preventControlUpdate is not true

			if (slider.settings.autoControls && preventControlUpdate != true) updateAutoControls('start');

		}



		/**

		 * Returns current slide index (zero-based)

		 */

		el.getCurrentSlide = function(){

			return slider.active.index;

		}



		/**

		 * Returns current slide element

		 */

		el.getCurrentSlideElement = function(){

			return slider.children.eq(slider.active.index);

		}



		/**

		 * Returns number of slides in show

		 */

		el.getSlideCount = function(){

			return slider.children.length;

		}



		/**

		 * Update all dynamic slider elements

		 */

		el.redrawSlider = function(){

			// resize all children in ratio to new screen size

			slider.children.add(el.find('.bx-clone')).width(getSlideWidth());

			// adjust the height

			slider.viewport.css('height', getViewportHeight());

			// update the slide position

			if(!slider.settings.ticker) setSlidePosition();

			// if active.last was true before the screen resize, we want

			// to keep it last no matter what screen size we end on

			if (slider.active.last) slider.active.index = getPagerQty() - 1;

			// if the active index (page) no longer exists due to the resize, simply set the index as last

			if (slider.active.index >= getPagerQty()) slider.active.last = true;

			// if a pager is being displayed and a custom pager is not being used, update it

			if(slider.settings.pager && !slider.settings.pagerCustom){

				populatePager();

				updatePagerActive(slider.active.index);

			}

		}



		/**

		 * Destroy the current instance of the slider (revert everything back to original state)

		 */

		el.destroySlider = function(){

			// don't do anything if slider has already been destroyed

			if(!slider.initialized) return;

			slider.initialized = false;

			$('.bx-clone', this).remove();

			slider.children.each(function() {

				$(this).data("origStyle") != undefined ? $(this).attr("style", $(this).data("origStyle")) : $(this).removeAttr('style');

			});

			$(this).data("origStyle") != undefined ? this.attr("style", $(this).data("origStyle")) : $(this).removeAttr('style');

			$(this).unwrap().unwrap();

			if(slider.controls.el) slider.controls.el.remove();

			if(slider.controls.next) slider.controls.next.remove();

			if(slider.controls.prev) slider.controls.prev.remove();

			if(slider.pagerEl && slider.settings.controls) slider.pagerEl.remove();

			$('.bx-caption', this).remove();

			if(slider.controls.autoEl) slider.controls.autoEl.remove();

			clearInterval(slider.interval);

			if(slider.settings.responsive) $(window).unbind('resize', resizeWindow);

		}



		/**

		 * Reload the slider (revert all DOM changes, and re-initialize)

		 */

		el.reloadSlider = function(settings){

			if (settings != undefined) options = settings;

			el.destroySlider();

			init();

		}



		init();



		// returns the current jQuery object

		return this;

	}



})(jQuery);



/* ====================================================================================================================
 * bxslider End
 * ====================================================================================================================*/






/* ====================================================================================================================
 * Nicescroll Start
 * ====================================================================================================================*/

/* jquery.nicescroll 3.5.1 InuYaksa*2013 MIT http://areaaperta.com/nicescroll */
(function(e) {
    var z = !1,
        E = !1,
        L = 5E3,
        M = 2E3,
        y = 0,
        N = function() {
            var e = document.getElementsByTagName("script"),
                e = e[e.length - 1].src.split("?")[0];
            return 0 < e.split("/").length ? e.split("/").slice(0, -1).join("/") + "/" : ""
        }(),
        H = ["ms", "moz", "webkit", "o"],
        v = window.requestAnimationFrame || !1,
        w = window.cancelAnimationFrame || !1;
    if (!v)
        for (var O in H) {
            var F = H[O];
            v || (v = window[F + "RequestAnimationFrame"]);
            w || (w = window[F + "CancelAnimationFrame"] || window[F + "CancelRequestAnimationFrame"])
        }
    var A = window.MutationObserver || window.WebKitMutationObserver ||
        !1,
        I = {
            zindex: 99999,
            cursoropacitymin: 0,
            cursoropacitymax: 1,
            cursorcolor: "#084574",
            cursorwidth: "12px",
            cursorborder: "0px solid #fff",
            cursorborderradius: "5px",
            scrollspeed: 60,
            mousescrollstep: 24,
            touchbehavior: !1,
            hwacceleration: !0,
            usetransition: !0,
            boxzoom: !1,
            dblclickzoom: !0,
            gesturezoom: !0,
            grabcursorenabled: !0,
            autohidemode: !0,
            background: "#333",
            iframeautoresize: !0,
            cursorminheight: 32,
            preservenativescrolling: !0,
            railoffset: !1,
            bouncescroll: !0,
            spacebarenabled: !0,
            railpadding: {
                top: 0,
                right: 0,
                left: 0,
                bottom: 0
            },
            disableoutline: !0,
            horizrailenabled: !0,
            railalign: "right",
            railvalign: "bottom",
            enabletranslate3d: !0,
            enablemousewheel: !0,
            enablekeyboard: !0,
            smoothscroll: !0,
            sensitiverail: !0,
            enablemouselockapi: !0,
            cursorfixedheight: !1,
            directionlockdeadzone: 6,
            hidecursordelay: 400,
            nativeparentscrolling: !0,
            enablescrollonselection: !0,
            overflowx: !0,
            overflowy: !0,
            cursordragspeed: 0.3,
            rtlmode: !1,
            cursordragontouch: !1,
            oneaxismousemode: "auto"
        },
        G = !1,
        P = function() {
            if (G) return G;
            var e = document.createElement("DIV"),
                c = {
                    haspointerlock: "pointerLockElement" in document ||
                        "mozPointerLockElement" in document || "webkitPointerLockElement" in document
                };
            c.isopera = "opera" in window;
            c.isopera12 = c.isopera && "getUserMedia" in navigator;
            c.isoperamini = "[object OperaMini]" === Object.prototype.toString.call(window.operamini);
            c.isie = "all" in document && "attachEvent" in e && !c.isopera;
            c.isieold = c.isie && !("msInterpolationMode" in e.style);
            c.isie7 = c.isie && !c.isieold && (!("documentMode" in document) || 7 == document.documentMode);
            c.isie8 = c.isie && "documentMode" in document && 8 == document.documentMode;
            c.isie9 =
                c.isie && "performance" in window && 9 <= document.documentMode;
            c.isie10 = c.isie && "performance" in window && 10 <= document.documentMode;
            c.isie9mobile = /iemobile.9/i.test(navigator.userAgent);
            c.isie9mobile && (c.isie9 = !1);
            c.isie7mobile = !c.isie9mobile && c.isie7 && /iemobile/i.test(navigator.userAgent);
            c.ismozilla = "MozAppearance" in e.style;
            c.iswebkit = "WebkitAppearance" in e.style;
            c.ischrome = "chrome" in window;
            c.ischrome22 = c.ischrome && c.haspointerlock;
            c.ischrome26 = c.ischrome && "transition" in e.style;
            c.cantouch = "ontouchstart" in
                document.documentElement || "ontouchstart" in window;
            c.hasmstouch = window.navigator.msPointerEnabled || !1;
            c.ismac = /^mac$/i.test(navigator.platform);
            c.isios = c.cantouch && /iphone|ipad|ipod/i.test(navigator.platform);
            c.isios4 = c.isios && !("seal" in Object);
            c.isandroid = /android/i.test(navigator.userAgent);
            c.trstyle = !1;
            c.hastransform = !1;
            c.hastranslate3d = !1;
            c.transitionstyle = !1;
            c.hastransition = !1;
            c.transitionend = !1;
            for (var h = ["transform", "msTransform", "webkitTransform", "MozTransform", "OTransform"], l = 0; l < h.length; l++)
                if ("undefined" !=
                    typeof e.style[h[l]]) {
                    c.trstyle = h[l];
                    break
                }
            c.hastransform = !1 != c.trstyle;
            c.hastransform && (e.style[c.trstyle] = "translate3d(1px,2px,3px)", c.hastranslate3d = /translate3d/.test(e.style[c.trstyle]));
            c.transitionstyle = !1;
            c.prefixstyle = "";
            c.transitionend = !1;
            for (var h = "transition webkitTransition MozTransition OTransition OTransition msTransition KhtmlTransition".split(" "), q = " -webkit- -moz- -o- -o -ms- -khtml-".split(" "), t = "transitionend webkitTransitionEnd transitionend otransitionend oTransitionEnd msTransitionEnd KhtmlTransitionEnd".split(" "),
                    l = 0; l < h.length; l++)
                if (h[l] in e.style) {
                    c.transitionstyle = h[l];
                    c.prefixstyle = q[l];
                    c.transitionend = t[l];
                    break
                }
            c.ischrome26 && (c.prefixstyle = q[1]);
            c.hastransition = c.transitionstyle;
            a: {
                h = ["-moz-grab", "-webkit-grab", "grab"];
                if (c.ischrome && !c.ischrome22 || c.isie) h = [];
                for (l = 0; l < h.length; l++)
                    if (q = h[l], e.style.cursor = q, e.style.cursor == q) {
                        h = q;
                        break a
                    }
                h = "url(http://www.google.com/intl/en_ALL/mapfiles/openhand.cur),n-resize"
            }
            c.cursorgrabvalue = h;
            c.hasmousecapture = "setCapture" in e;
            c.hasMutationObserver = !1 !== A;
            return G =
                c
        },
        Q = function(k, c) {
            function h() {
                var d = b.win;
                if ("zIndex" in d) return d.zIndex();
                for (; 0 < d.length && 9 != d[0].nodeType;) {
                    var c = d.css("zIndex");
                    if (!isNaN(c) && 0 != c) return parseInt(c);
                    d = d.parent()
                }
                return !1
            }

            function l(d, c, g) {
                c = d.css(c);
                d = parseFloat(c);
                return isNaN(d) ? (d = u[c] || 0, g = 3 == d ? g ? b.win.outerHeight() - b.win.innerHeight() : b.win.outerWidth() - b.win.innerWidth() : 1, b.isie8 && d && (d += 1), g ? d : 0) : d
            }

            function q(d, c, g, f) {
                b._bind(d, c, function(b) {
                    b = b ? b : window.event;
                    var f = {
                        original: b,
                        target: b.target || b.srcElement,
                        type: "wheel",
                        deltaMode: "MozMousePixelScroll" == b.type ? 0 : 1,
                        deltaX: 0,
                        deltaZ: 0,
                        preventDefault: function() {
                            b.preventDefault ? b.preventDefault() : b.returnValue = !1;
                            return !1
                        },

                        stopImmediatePropagation: function() {
                            b.stopImmediatePropagation ? b.stopImmediatePropagation() : b.cancelBubble = !0
                        }
                    };
                    "mousewheel" == c ? (f.deltaY = -0.025 * b.wheelDelta, b.wheelDeltaX && (f.deltaX = -0.025 * b.wheelDeltaX)) : f.deltaY = b.detail;
                    return g.call(d, f)
                }, f)
            }

            function t(d, c, g) {
                var f, e;
                0 == d.deltaMode ? (f = -Math.floor(d.deltaX * (b.opt.mousescrollstep / 54)), e = -Math.floor(d.deltaY *
                    (b.opt.mousescrollstep / 54))) : 1 == d.deltaMode && (f = -Math.floor(d.deltaX * b.opt.mousescrollstep), e = -Math.floor(d.deltaY * b.opt.mousescrollstep));
                c && (b.opt.oneaxismousemode && 0 == f && e) && (f = e, e = 0);
                f && (b.scrollmom && b.scrollmom.stop(), b.lastdeltax += f, b.debounced("mousewheelx", function() {
                    var d = b.lastdeltax;
                    b.lastdeltax = 0;
                    b.rail.drag || b.doScrollLeftBy(d)
                }, 120));
                if (e) {
                    if (b.opt.nativeparentscrolling && g && !b.ispage && !b.zoomactive)
                        if (0 > e) {
                            if (b.getScrollTop() >= b.page.maxh) return !0
                        } else if (0 >= b.getScrollTop()) return !0;
                    b.scrollmom && b.scrollmom.stop();
                    b.lastdeltay += e;
                    b.debounced("mousewheely", function() {
                        var d = b.lastdeltay;
                        b.lastdeltay = 0;
                        b.rail.drag || b.doScrollBy(d)
                    }, 120)
                }
                d.stopImmediatePropagation();
                return d.preventDefault()
            }
            var b = this;
            this.version = "3.5.1";
            this.name = "nicescroll";
            this.me = c;
            this.opt = {
                doc: e("body"),
                win: !1
            };
            e.extend(this.opt, I);
            this.opt.snapbackspeed = 80;
            if (k)
                for (var p in b.opt) "undefined" != typeof k[p] && (b.opt[p] = k[p]);
            this.iddoc = (this.doc = b.opt.doc) && this.doc[0] ? this.doc[0].id || "" : "";
            this.ispage = /BODY|HTML/.test(b.opt.win ?
                b.opt.win[0].nodeName : this.doc[0].nodeName);
            this.haswrapper = !1 !== b.opt.win;
            this.win = b.opt.win || (this.ispage ? e(window) : this.doc);
            this.docscroll = this.ispage && !this.haswrapper ? e(window) : this.win;
            this.body = e("body");
            this.iframe = this.isfixed = this.viewport = !1;
            this.isiframe = "IFRAME" == this.doc[0].nodeName && "IFRAME" == this.win[0].nodeName;
            this.istextarea = "TEXTAREA" == this.win[0].nodeName;
            this.forcescreen = !1;
            this.canshowonmouseevent = "scroll" != b.opt.autohidemode;
            this.page = this.view = this.onzoomout = this.onzoomin =
                this.onscrollcancel = this.onscrollend = this.onscrollstart = this.onclick = this.ongesturezoom = this.onkeypress = this.onmousewheel = this.onmousemove = this.onmouseup = this.onmousedown = !1;
            this.scroll = {
                x: 0,
                y: 0
            };
            this.scrollratio = {
                x: 0,
                y: 0
            };
            this.cursorheight = 20;
            this.scrollvaluemax = 0;
            this.observerremover = this.observer = this.scrollmom = this.scrollrunning = this.checkrtlmode = !1;
            do this.id = "ascrail" + M++; while (document.getElementById(this.id));
            this.hasmousefocus = this.hasfocus = this.zoomactive = this.zoom = this.selectiondrag = this.cursorfreezed =
                this.cursor = this.rail = !1;
            this.visibility = !0;
            this.hidden = this.locked = !1;
            this.cursoractive = !0;
            this.overflowx = b.opt.overflowx;
            this.overflowy = b.opt.overflowy;
            this.nativescrollingarea = !1;
            this.checkarea = 0;
            this.events = [];
            this.saved = {};
            this.delaylist = {};
            this.synclist = {};
            this.lastdeltay = this.lastdeltax = 0;
            this.detected = P();
            var f = e.extend({}, this.detected);
            this.ishwscroll = (this.canhwscroll = f.hastransform && b.opt.hwacceleration) && b.haswrapper;
            this.istouchcapable = !1;
            f.cantouch && (f.ischrome && !f.isios && !f.isandroid) &&
                (this.istouchcapable = !0, f.cantouch = !1);
            f.cantouch && (f.ismozilla && !f.isios && !f.isandroid) && (this.istouchcapable = !0, f.cantouch = !1);
            b.opt.enablemouselockapi || (f.hasmousecapture = !1, f.haspointerlock = !1);
            this.delayed = function(d, c, g, f) {
                var e = b.delaylist[d],
                    h = (new Date).getTime();
                if (!f && e && e.tt) return !1;
                e && e.tt && clearTimeout(e.tt);
                if (e && e.last + g > h && !e.tt) b.delaylist[d] = {
                    last: h + g,
                    tt: setTimeout(function() {
                        b.delaylist[d].tt = 0;
                        c.call()
                    }, g)
                };
                else if (!e || !e.tt) b.delaylist[d] = {
                    last: h,
                    tt: 0
                }, setTimeout(function() {
                        c.call()
                    },
                    0)
            };
            this.debounced = function(d, c, g) {
                var f = b.delaylist[d];
                (new Date).getTime();
                b.delaylist[d] = c;
                f || setTimeout(function() {
                    var c = b.delaylist[d];
                    b.delaylist[d] = !1;
                    c.call()
                }, g)
            };
            this.synched = function(d, c) {
                b.synclist[d] = c;
                (function() {
                    b.onsync || (v(function() {
                        b.onsync = !1;
                        for (d in b.synclist) {
                            var c = b.synclist[d];
                            c && c.call(b);
                            b.synclist[d] = !1
                        }
                    }), b.onsync = !0)
                })();
                return d
            };
            this.unsynched = function(d) {
                b.synclist[d] && (b.synclist[d] = !1)
            };
            this.css = function(d, c) {
                for (var g in c) b.saved.css.push([d, g, d.css(g)]), d.css(g,
                    c[g])
            };
            this.scrollTop = function(d) {
                return "undefined" == typeof d ? b.getScrollTop() : b.setScrollTop(d)
            };
            this.scrollLeft = function(d) {
                return "undefined" == typeof d ? b.getScrollLeft() : b.setScrollLeft(d)
            };
            BezierClass = function(b, c, g, f, e, h, l) {
                this.st = b;
                this.ed = c;
                this.spd = g;
                this.p1 = f || 0;
                this.p2 = e || 1;
                this.p3 = h || 0;
                this.p4 = l || 1;
                this.ts = (new Date).getTime();
                this.df = this.ed - this.st
            };
            BezierClass.prototype = {
                B2: function(b) {
                    return 3 * b * b * (1 - b)
                },
                B3: function(b) {
                    return 3 * b * (1 - b) * (1 - b)
                },
                B4: function(b) {
                    return (1 - b) * (1 - b) * (1 - b)
                },
                getNow: function() {
                    var b = 1 - ((new Date).getTime() - this.ts) / this.spd,
                        c = this.B2(b) + this.B3(b) + this.B4(b);
                    return 0 > b ? this.ed : this.st + Math.round(this.df * c)
                },
                update: function(b, c) {
                    this.st = this.getNow();
                    this.ed = b;
                    this.spd = c;
                    this.ts = (new Date).getTime();
                    this.df = this.ed - this.st;
                    return this
                }
            };
            if (this.ishwscroll) {
                this.doc.translate = {
                    x: 0,
                    y: 0,
                    tx: "0px",
                    ty: "0px"
                };
                f.hastranslate3d && f.isios && this.doc.css("-webkit-backface-visibility", "hidden");
                var s = function() {
                    var d = b.doc.css(f.trstyle);
                    return d && "matrix" == d.substr(0,
                        6) ? d.replace(/^.*\((.*)\)$/g, "$1").replace(/px/g, "").split(/, +/) : !1
                };
                this.getScrollTop = function(d) {
                    if (!d) {
                        if (d = s()) return 16 == d.length ? -d[13] : -d[5];
                        if (b.timerscroll && b.timerscroll.bz) return b.timerscroll.bz.getNow()
                    }
                    return b.doc.translate.y
                };
                this.getScrollLeft = function(d) {
                    if (!d) {
                        if (d = s()) return 16 == d.length ? -d[12] : -d[4];
                        if (b.timerscroll && b.timerscroll.bh) return b.timerscroll.bh.getNow()
                    }
                    return b.doc.translate.x
                };
                this.notifyScrollEvent = document.createEvent ? function(b) {
                    var c = document.createEvent("UIEvents");
                    c.initUIEvent("scroll", !1, !0, window, 1);
                    b.dispatchEvent(c)
                } : document.fireEvent ? function(b) {
                    var c = document.createEventObject();
                    b.fireEvent("onscroll");
                    c.cancelBubble = !0
                } : function(b, c) {};
                f.hastranslate3d && b.opt.enabletranslate3d ? (this.setScrollTop = function(d, c) {
                    b.doc.translate.y = d;
                    b.doc.translate.ty = -1 * d + "px";
                    b.doc.css(f.trstyle, "translate3d(" + b.doc.translate.tx + "," + b.doc.translate.ty + ",0px)");
                    c || b.notifyScrollEvent(b.win[0])
                }, this.setScrollLeft = function(d, c) {
                    b.doc.translate.x = d;
                    b.doc.translate.tx = -1 *
                        d + "px";
                    b.doc.css(f.trstyle, "translate3d(" + b.doc.translate.tx + "," + b.doc.translate.ty + ",0px)");
                    c || b.notifyScrollEvent(b.win[0])
                }) : (this.setScrollTop = function(d, c) {
                    b.doc.translate.y = d;
                    b.doc.translate.ty = -1 * d + "px";
                    b.doc.css(f.trstyle, "translate(" + b.doc.translate.tx + "," + b.doc.translate.ty + ")");
                    c || b.notifyScrollEvent(b.win[0])
                }, this.setScrollLeft = function(d, c) {
                    b.doc.translate.x = d;
                    b.doc.translate.tx = -1 * d + "px";
                    b.doc.css(f.trstyle, "translate(" + b.doc.translate.tx + "," + b.doc.translate.ty + ")");
                    c || b.notifyScrollEvent(b.win[0])
                })
            } else this.getScrollTop =
                function() {
                    return b.docscroll.scrollTop()
                }, this.setScrollTop = function(d) {
                    return b.docscroll.scrollTop(d)
                }, this.getScrollLeft = function() {
                    return b.docscroll.scrollLeft()
                }, this.setScrollLeft = function(d) {
                    return b.docscroll.scrollLeft(d)
                };
            this.getTarget = function(b) {
                return !b ? !1 : b.target ? b.target : b.srcElement ? b.srcElement : !1
            };
            this.hasParent = function(b, c) {
                if (!b) return !1;
                for (var g = b.target || b.srcElement || b || !1; g && g.id != c;) g = g.parentNode || !1;
                return !1 !== g
            };
            var u = {
                thin: 1,
                medium: 3,
                thick: 5
            };
            this.getOffset = function() {
                if (b.isfixed) return {
                    top: parseFloat(b.win.css("top")),
                    left: parseFloat(b.win.css("left"))
                };
                if (!b.viewport) return b.win.offset();
                var d = b.win.offset(),
                    c = b.viewport.offset();
                return {
                    top: d.top - c.top + b.viewport.scrollTop(),
                    left: d.left - c.left + b.viewport.scrollLeft()
                }
            };
            this.updateScrollBar = function(d) {
                if (b.ishwscroll) b.rail.css({
                    height: b.win.innerHeight()
                }), b.railh && b.railh.css({
                    width: b.win.innerWidth()
                });
                else {
                    var c = b.getOffset(),
                        g = c.top,
                        f = c.left,
                        g = g + l(b.win, "border-top-width", !0);
                    b.win.outerWidth();
                    b.win.innerWidth();
                    var f = f + (b.rail.align ? b.win.outerWidth() -
                            l(b.win, "border-right-width") - b.rail.width : l(b.win, "border-left-width")),
                        e = b.opt.railoffset;
                    e && (e.top && (g += e.top), b.rail.align && e.left && (f += e.left));
                    b.locked || b.rail.css({
                        top: g,
                        left: f,
                        height: d ? d.h : b.win.innerHeight()
                    });
                    b.zoom && b.zoom.css({
                        top: g + 1,
                        left: 1 == b.rail.align ? f - 20 : f + b.rail.width + 4
                    });
                    b.railh && !b.locked && (g = c.top, f = c.left, d = b.railh.align ? g + l(b.win, "border-top-width", !0) + b.win.innerHeight() - b.railh.height : g + l(b.win, "border-top-width", !0), f += l(b.win, "border-left-width"), b.railh.css({
                        top: d,
                        left: f,
                        width: b.railh.width
                    }))
                }
            };
            this.doRailClick = function(d, c, g) {
                var f;
                b.locked || (b.cancelEvent(d), c ? (c = g ? b.doScrollLeft : b.doScrollTop, f = g ? (d.pageX - b.railh.offset().left - b.cursorwidth / 2) * b.scrollratio.x : (d.pageY - b.rail.offset().top - b.cursorheight / 2) * b.scrollratio.y, c(f)) : (c = g ? b.doScrollLeftBy : b.doScrollBy, f = g ? b.scroll.x : b.scroll.y, d = g ? d.pageX - b.railh.offset().left : d.pageY - b.rail.offset().top, g = g ? b.view.w : b.view.h, f >= d ? c(g) : c(-g)))
            };
            b.hasanimationframe = v;
            b.hascancelanimationframe = w;
            b.hasanimationframe ? b.hascancelanimationframe ||
                (w = function() {
                    b.cancelAnimationFrame = !0
                }) : (v = function(b) {
                    return setTimeout(b, 15 - Math.floor(+new Date / 1E3) % 16)
                }, w = clearInterval);
            this.init = function() {
                b.saved.css = [];
                if (f.isie7mobile || f.isoperamini) return !0;
                f.hasmstouch && b.css(b.ispage ? e("html") : b.win, {
                    "-ms-touch-action": "none"
                });
                b.zindex = "auto";
                b.zindex = !b.ispage && "auto" == b.opt.zindex ? h() || "auto" : b.opt.zindex;
                !b.ispage && "auto" != b.zindex && b.zindex > y && (y = b.zindex);
                b.isie && (0 == b.zindex && "auto" == b.opt.zindex) && (b.zindex = "auto");
                if (!b.ispage || !f.cantouch &&
                    !f.isieold && !f.isie9mobile) {
                    var d = b.docscroll;
                    b.ispage && (d = b.haswrapper ? b.win : b.doc);
                    f.isie9mobile || b.css(d, {
                        "overflow-y": "hidden"
                    });
                    b.ispage && f.isie7 && ("BODY" == b.doc[0].nodeName ? b.css(e("html"), {
                        "overflow-y": "hidden"
                    }) : "HTML" == b.doc[0].nodeName && b.css(e("body"), {
                        "overflow-y": "hidden"
                    }));
                    f.isios && (!b.ispage && !b.haswrapper) && b.css(e("body"), {
                        "-webkit-overflow-scrolling": "touch"
                    });
                    var c = e(document.createElement("div"));
                    c.css({
                        position: "relative",
                        top: 0,
                        "float": "right",
                        width: b.opt.cursorwidth,
                        height: "0px",
                        "background-color": b.opt.cursorcolor,
                        border: b.opt.cursorborder,
                        "background-clip": "padding-box",
                        "-webkit-border-radius": b.opt.cursorborderradius,
                        "-moz-border-radius": b.opt.cursorborderradius,
                        "border-radius": b.opt.cursorborderradius
                    });
                    c.hborder = parseFloat(c.outerHeight() - c.innerHeight());
                    b.cursor = c;
                    var g = e(document.createElement("div"));
                    g.attr("id", b.id);
                    g.addClass("nicescroll-rails");
                    var l, k, x = ["left", "right"],
                        q;
                    for (q in x) k = x[q], (l = b.opt.railpadding[k]) ? g.css("padding-" + k, l + "px") : b.opt.railpadding[k] =
                        0;
                    g.append(c);
                    g.width = Math.max(parseFloat(b.opt.cursorwidth), c.outerWidth()) + b.opt.railpadding.left + b.opt.railpadding.right;
                    g.css({
                        width: g.width + "px",
                        zIndex: b.zindex,
                        background: b.opt.background,
                        cursor: "default"
                    });
                    g.visibility = !0;
                    g.scrollable = !0;
                    g.align = "left" == b.opt.railalign ? 0 : 1;
                    b.rail = g;
                    c = b.rail.drag = !1;
                    b.opt.boxzoom && (!b.ispage && !f.isieold) && (c = document.createElement("div"), b.bind(c, "click", b.doZoom), b.zoom = e(c), b.zoom.css({
                        cursor: "pointer",
                        "z-index": b.zindex,
                        backgroundImage: "url(" + N + "zoomico.png)",
                        height: 18,
                        width: 18,
                        backgroundPosition: "0px 0px"
                    }), b.opt.dblclickzoom && b.bind(b.win, "dblclick", b.doZoom), f.cantouch && b.opt.gesturezoom && (b.ongesturezoom = function(d) {
                        1.5 < d.scale && b.doZoomIn(d);
                        0.8 > d.scale && b.doZoomOut(d);
                        return b.cancelEvent(d)
                    }, b.bind(b.win, "gestureend", b.ongesturezoom)));
                    b.railh = !1;
                    if (b.opt.horizrailenabled) {
                        b.css(d, {
                            "overflow-x": "hidden"
                        });
                        c = e(document.createElement("div"));
                        c.css({
                            position: "relative",
                            top: 0,
                            height: b.opt.cursorwidth,
                            width: "0px",
                            "background-color": b.opt.cursorcolor,
                            border: b.opt.cursorborder,
                            "background-clip": "padding-box",
                            "-webkit-border-radius": b.opt.cursorborderradius,
                            "-moz-border-radius": b.opt.cursorborderradius,
                            "border-radius": b.opt.cursorborderradius
                        });
                        c.wborder = parseFloat(c.outerWidth() - c.innerWidth());
                        b.cursorh = c;
                        var m = e(document.createElement("div"));
                        m.attr("id", b.id + "-hr");
                        m.addClass("nicescroll-rails");
                        m.height = Math.max(parseFloat(b.opt.cursorwidth), c.outerHeight());
                        m.css({
                            height: m.height + "px",
                            zIndex: b.zindex,
                            background: b.opt.background
                        });
                        m.append(c);
                        m.visibility = !0;
                        m.scrollable = !0;
                        m.align = "top" == b.opt.railvalign ? 0 : 1;
                        b.railh = m;
                        b.railh.drag = !1
                    }
                    b.ispage ? (g.css({
                        position: "fixed",
                        top: "0px",
                        height: "100%"
                    }), g.align ? g.css({
                        right: "0px"
                    }) : g.css({
                        left: "0px"
                    }), b.body.append(g), b.railh && (m.css({
                        position: "fixed",
                        left: "0px",
                        width: "100%"
                    }), m.align ? m.css({
                        bottom: "0px"
                    }) : m.css({
                        top: "0px"
                    }), b.body.append(m))) : (b.ishwscroll ? ("static" == b.win.css("position") && b.css(b.win, {
                        position: "relative"
                    }), d = "HTML" == b.win[0].nodeName ? b.body : b.win, b.zoom && (b.zoom.css({
                        position: "absolute",
                        top: 1,
                        right: 0,
                        "margin-right": g.width + 4
                    }), d.append(b.zoom)), g.css({
                        position: "absolute",
                        top: 0
                    }), g.align ? g.css({
                        right: 0
                    }) : g.css({
                        left: 0
                    }), d.append(g), m && (m.css({
                        position: "absolute",
                        left: 0,
                        bottom: 0
                    }), m.align ? m.css({
                        bottom: 0
                    }) : m.css({
                        top: 0
                    }), d.append(m))) : (b.isfixed = "fixed" == b.win.css("position"), d = b.isfixed ? "fixed" : "absolute", b.isfixed || (b.viewport = b.getViewport(b.win[0])), b.viewport && (b.body = b.viewport, !1 == /fixed|relative|absolute/.test(b.viewport.css("position")) && b.css(b.viewport, {
                            position: "relative"
                        })),
                        g.css({
                            position: d
                        }), b.zoom && b.zoom.css({
                            position: d
                        }), b.updateScrollBar(), b.body.append(g), b.zoom && b.body.append(b.zoom), b.railh && (m.css({
                            position: d
                        }), b.body.append(m))), f.isios && b.css(b.win, {
                        "-webkit-tap-highlight-color": "rgba(0,0,0,0)",
                        "-webkit-touch-callout": "none"
                    }), f.isie && b.opt.disableoutline && b.win.attr("hideFocus", "true"), f.iswebkit && b.opt.disableoutline && b.win.css({
                        outline: "none"
                    }));
                    !1 === b.opt.autohidemode ? (b.autohidedom = !1, b.rail.css({
                            opacity: b.opt.cursoropacitymax
                        }), b.railh && b.railh.css({
                            opacity: b.opt.cursoropacitymax
                        })) :
                        !0 === b.opt.autohidemode || "leave" === b.opt.autohidemode ? (b.autohidedom = e().add(b.rail), f.isie8 && (b.autohidedom = b.autohidedom.add(b.cursor)), b.railh && (b.autohidedom = b.autohidedom.add(b.railh)), b.railh && f.isie8 && (b.autohidedom = b.autohidedom.add(b.cursorh))) : "scroll" == b.opt.autohidemode ? (b.autohidedom = e().add(b.rail), b.railh && (b.autohidedom = b.autohidedom.add(b.railh))) : "cursor" == b.opt.autohidemode ? (b.autohidedom = e().add(b.cursor), b.railh && (b.autohidedom = b.autohidedom.add(b.cursorh))) : "hidden" == b.opt.autohidemode &&
                        (b.autohidedom = !1, b.hide(), b.locked = !1);
                    if (f.isie9mobile) b.scrollmom = new J(b), b.onmangotouch = function(d) {
                            d = b.getScrollTop();
                            var c = b.getScrollLeft();
                            if (d == b.scrollmom.lastscrolly && c == b.scrollmom.lastscrollx) return !0;
                            var g = d - b.mangotouch.sy,
                                f = c - b.mangotouch.sx;
                            if (0 != Math.round(Math.sqrt(Math.pow(f, 2) + Math.pow(g, 2)))) {
                                var n = 0 > g ? -1 : 1,
                                    e = 0 > f ? -1 : 1,
                                    h = +new Date;
                                b.mangotouch.lazy && clearTimeout(b.mangotouch.lazy);
                                80 < h - b.mangotouch.tm || b.mangotouch.dry != n || b.mangotouch.drx != e ? (b.scrollmom.stop(), b.scrollmom.reset(c,
                                    d), b.mangotouch.sy = d, b.mangotouch.ly = d, b.mangotouch.sx = c, b.mangotouch.lx = c, b.mangotouch.dry = n, b.mangotouch.drx = e, b.mangotouch.tm = h) : (b.scrollmom.stop(), b.scrollmom.update(b.mangotouch.sx - f, b.mangotouch.sy - g), b.mangotouch.tm = h, g = Math.max(Math.abs(b.mangotouch.ly - d), Math.abs(b.mangotouch.lx - c)), b.mangotouch.ly = d, b.mangotouch.lx = c, 2 < g && (b.mangotouch.lazy = setTimeout(function() {
                                    b.mangotouch.lazy = !1;
                                    b.mangotouch.dry = 0;
                                    b.mangotouch.drx = 0;
                                    b.mangotouch.tm = 0;
                                    b.scrollmom.doMomentum(30)
                                }, 100)))
                            }
                        }, g = b.getScrollTop(),
                        m = b.getScrollLeft(), b.mangotouch = {
                            sy: g,
                            ly: g,
                            dry: 0,
                            sx: m,
                            lx: m,
                            drx: 0,
                            lazy: !1,
                            tm: 0
                        }, b.bind(b.docscroll, "scroll", b.onmangotouch);
                    else {
                        if (f.cantouch || b.istouchcapable || b.opt.touchbehavior || f.hasmstouch) {
                            b.scrollmom = new J(b);
                            b.ontouchstart = function(d) {
                                if (d.pointerType && 2 != d.pointerType) return !1;
                                b.hasmoving = !1;
                                if (!b.locked) {
                                    if (f.hasmstouch)
                                        for (var c = d.target ? d.target : !1; c;) {
                                            var g = e(c).getNiceScroll();
                                            if (0 < g.length && g[0].me == b.me) break;
                                            if (0 < g.length) return !1;
                                            if ("DIV" == c.nodeName && c.id == b.id) break;
                                            c = c.parentNode ?
                                                c.parentNode : !1
                                        }
                                    b.cancelScroll();
                                    if ((c = b.getTarget(d)) && /INPUT/i.test(c.nodeName) && /range/i.test(c.type)) return b.stopPropagation(d);
                                    !("clientX" in d) && "changedTouches" in d && (d.clientX = d.changedTouches[0].clientX, d.clientY = d.changedTouches[0].clientY);
                                    b.forcescreen && (g = d, d = {
                                        original: d.original ? d.original : d
                                    }, d.clientX = g.screenX, d.clientY = g.screenY);
                                    b.rail.drag = {
                                        x: d.clientX,
                                        y: d.clientY,
                                        sx: b.scroll.x,
                                        sy: b.scroll.y,
                                        st: b.getScrollTop(),
                                        sl: b.getScrollLeft(),
                                        pt: 2,
                                        dl: !1
                                    };
                                    if (b.ispage || !b.opt.directionlockdeadzone) b.rail.drag.dl =
                                        "f";
                                    else {
                                        var g = e(window).width(),
                                            n = e(window).height(),
                                            h = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
                                            l = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
                                            n = Math.max(0, l - n),
                                            g = Math.max(0, h - g);
                                        b.rail.drag.ck = !b.rail.scrollable && b.railh.scrollable ? 0 < n ? "v" : !1 : b.rail.scrollable && !b.railh.scrollable ? 0 < g ? "h" : !1 : !1;
                                        b.rail.drag.ck || (b.rail.drag.dl = "f")
                                    }
                                    b.opt.touchbehavior && (b.isiframe && f.isie) && (g = b.win.position(), b.rail.drag.x += g.left, b.rail.drag.y += g.top);
                                    b.hasmoving = !1;
                                    b.lastmouseup = !1;
                                    b.scrollmom.reset(d.clientX, d.clientY);
                                    if (!f.cantouch && !this.istouchcapable && !f.hasmstouch) {
                                        if (!c || !/INPUT|SELECT|TEXTAREA/i.test(c.nodeName)) return !b.ispage && f.hasmousecapture && c.setCapture(), b.opt.touchbehavior ? (c.onclick && !c._onclick && (c._onclick = c.onclick, c.onclick = function(d) {
                                            if (b.hasmoving) return !1;
                                            c._onclick.call(this, d)
                                        }), b.cancelEvent(d)) : b.stopPropagation(d);
                                        /SUBMIT|CANCEL|BUTTON/i.test(e(c).attr("type")) && (pc = {
                                            tg: c,
                                            click: !1
                                        }, b.preventclick = pc)
                                    }
                                }
                            };
                            b.ontouchend =
                                function(d) {
                                    if (d.pointerType && 2 != d.pointerType) return !1;
                                    if (b.rail.drag && 2 == b.rail.drag.pt && (b.scrollmom.doMomentum(), b.rail.drag = !1, b.hasmoving && (b.lastmouseup = !0, b.hideCursor(), f.hasmousecapture && document.releaseCapture(), !f.cantouch))) return b.cancelEvent(d)
                                };
                            var t = b.opt.touchbehavior && b.isiframe && !f.hasmousecapture;
                            b.ontouchmove = function(d, c) {
                                if (d.pointerType && 2 != d.pointerType) return !1;
                                if (b.rail.drag && 2 == b.rail.drag.pt) {
                                    if (f.cantouch && "undefined" == typeof d.original) return !0;
                                    b.hasmoving = !0;
                                    b.preventclick &&
                                        !b.preventclick.click && (b.preventclick.click = b.preventclick.tg.onclick || !1, b.preventclick.tg.onclick = b.onpreventclick);
                                    d = e.extend({
                                        original: d
                                    }, d);
                                    "changedTouches" in d && (d.clientX = d.changedTouches[0].clientX, d.clientY = d.changedTouches[0].clientY);
                                    if (b.forcescreen) {
                                        var g = d;
                                        d = {
                                            original: d.original ? d.original : d
                                        };
                                        d.clientX = g.screenX;
                                        d.clientY = g.screenY
                                    }
                                    g = ofy = 0;
                                    if (t && !c) {
                                        var n = b.win.position(),
                                            g = -n.left;
                                        ofy = -n.top
                                    }
                                    var h = d.clientY + ofy,
                                        n = h - b.rail.drag.y,
                                        l = d.clientX + g,
                                        k = l - b.rail.drag.x,
                                        r = b.rail.drag.st - n;
                                    b.ishwscroll &&
                                        b.opt.bouncescroll ? 0 > r ? r = Math.round(r / 2) : r > b.page.maxh && (r = b.page.maxh + Math.round((r - b.page.maxh) / 2)) : (0 > r && (h = r = 0), r > b.page.maxh && (r = b.page.maxh, h = 0));
                                    if (b.railh && b.railh.scrollable) {
                                        var m = b.rail.drag.sl - k;
                                        b.ishwscroll && b.opt.bouncescroll ? 0 > m ? m = Math.round(m / 2) : m > b.page.maxw && (m = b.page.maxw + Math.round((m - b.page.maxw) / 2)) : (0 > m && (l = m = 0), m > b.page.maxw && (m = b.page.maxw, l = 0))
                                    }
                                    g = !1;
                                    if (b.rail.drag.dl) g = !0, "v" == b.rail.drag.dl ? m = b.rail.drag.sl : "h" == b.rail.drag.dl && (r = b.rail.drag.st);
                                    else {
                                        var n = Math.abs(n),
                                            k = Math.abs(k),
                                            x = b.opt.directionlockdeadzone;
                                        if ("v" == b.rail.drag.ck) {
                                            if (n > x && k <= 0.3 * n) return b.rail.drag = !1, !0;
                                            k > x && (b.rail.drag.dl = "f", e("body").scrollTop(e("body").scrollTop()))
                                        } else if ("h" == b.rail.drag.ck) {
                                            if (k > x && n <= 0.3 * k) return b.rail.drag = !1, !0;
                                            n > x && (b.rail.drag.dl = "f", e("body").scrollLeft(e("body").scrollLeft()))
                                        }
                                    }
                                    b.synched("touchmove", function() {
                                        b.rail.drag && 2 == b.rail.drag.pt && (b.prepareTransition && b.prepareTransition(0), b.rail.scrollable && b.setScrollTop(r), b.scrollmom.update(l, h), b.railh &&
                                            b.railh.scrollable ? (b.setScrollLeft(m), b.showCursor(r, m)) : b.showCursor(r), f.isie10 && document.selection.clear())
                                    });
                                    f.ischrome && b.istouchcapable && (g = !1);
                                    if (g) return b.cancelEvent(d)
                                }
                            }
                        }
                        b.onmousedown = function(d, c) {
                            if (!(b.rail.drag && 1 != b.rail.drag.pt)) {
                                if (b.locked) return b.cancelEvent(d);
                                b.cancelScroll();
                                b.rail.drag = {
                                    x: d.clientX,
                                    y: d.clientY,
                                    sx: b.scroll.x,
                                    sy: b.scroll.y,
                                    pt: 1,
                                    hr: !!c
                                };
                                var g = b.getTarget(d);
                                !b.ispage && f.hasmousecapture && g.setCapture();
                                b.isiframe && !f.hasmousecapture && (b.saved.csspointerevents =
                                    b.doc.css("pointer-events"), b.css(b.doc, {
                                        "pointer-events": "none"
                                    }));
                                return b.cancelEvent(d)
                            }
                        };
                        b.onmouseup = function(d) {
                            if (b.rail.drag && (f.hasmousecapture && document.releaseCapture(), b.isiframe && !f.hasmousecapture && b.doc.css("pointer-events", b.saved.csspointerevents), 1 == b.rail.drag.pt)) return b.rail.drag = !1, b.cancelEvent(d)
                        };
                        b.onmousemove = function(d) {
                            if (b.rail.drag && 1 == b.rail.drag.pt) {
                                if (f.ischrome && 0 == d.which) return b.onmouseup(d);
                                b.cursorfreezed = !0;
                                if (b.rail.drag.hr) {
                                    b.scroll.x = b.rail.drag.sx + (d.clientX -
                                        b.rail.drag.x);
                                    0 > b.scroll.x && (b.scroll.x = 0);
                                    var c = b.scrollvaluemaxw;
                                    b.scroll.x > c && (b.scroll.x = c)
                                } else b.scroll.y = b.rail.drag.sy + (d.clientY - b.rail.drag.y), 0 > b.scroll.y && (b.scroll.y = 0), c = b.scrollvaluemax, b.scroll.y > c && (b.scroll.y = c);
                                b.synched("mousemove", function() {
                                    b.rail.drag && 1 == b.rail.drag.pt && (b.showCursor(), b.rail.drag.hr ? b.doScrollLeft(Math.round(b.scroll.x * b.scrollratio.x), b.opt.cursordragspeed) : b.doScrollTop(Math.round(b.scroll.y * b.scrollratio.y), b.opt.cursordragspeed))
                                });
                                return b.cancelEvent(d)
                            }
                        };
                        if (f.cantouch || b.opt.touchbehavior) b.onpreventclick = function(d) {
                            if (b.preventclick) return b.preventclick.tg.onclick = b.preventclick.click, b.preventclick = !1, b.cancelEvent(d)
                        }, b.bind(b.win, "mousedown", b.ontouchstart), b.onclick = f.isios ? !1 : function(d) {
                            return b.lastmouseup ? (b.lastmouseup = !1, b.cancelEvent(d)) : !0
                        }, b.opt.grabcursorenabled && f.cursorgrabvalue && (b.css(b.ispage ? b.doc : b.win, {
                            cursor: f.cursorgrabvalue
                        }), b.css(b.rail, {
                            cursor: f.cursorgrabvalue
                        }));
                        else {
                            var p = function(d) {
                                if (b.selectiondrag) {
                                    if (d) {
                                        var c =
                                            b.win.outerHeight();
                                        d = d.pageY - b.selectiondrag.top;
                                        0 < d && d < c && (d = 0);
                                        d >= c && (d -= c);
                                        b.selectiondrag.df = d
                                    }
                                    0 != b.selectiondrag.df && (b.doScrollBy(2 * -Math.floor(b.selectiondrag.df / 6)), b.debounced("doselectionscroll", function() {
                                        p()
                                    }, 50))
                                }
                            };
                            b.hasTextSelected = "getSelection" in document ? function() {
                                return 0 < document.getSelection().rangeCount
                            } : "selection" in document ? function() {
                                return "None" != document.selection.type
                            } : function() {
                                return !1
                            };
                            b.onselectionstart = function(d) {
                                b.ispage || (b.selectiondrag = b.win.offset())
                            };
                            b.onselectionend =
                                function(d) {
                                    b.selectiondrag = !1
                                };
                            b.onselectiondrag = function(d) {
                                b.selectiondrag && b.hasTextSelected() && b.debounced("selectionscroll", function() {
                                    p(d)
                                }, 250)
                            }
                        }
                        f.hasmstouch && (b.css(b.rail, {
                            "-ms-touch-action": "none"
                        }), b.css(b.cursor, {
                            "-ms-touch-action": "none"
                        }), b.bind(b.win, "MSPointerDown", b.ontouchstart), b.bind(document, "MSPointerUp", b.ontouchend), b.bind(document, "MSPointerMove", b.ontouchmove), b.bind(b.cursor, "MSGestureHold", function(b) {
                            b.preventDefault()
                        }), b.bind(b.cursor, "contextmenu", function(b) {
                            b.preventDefault()
                        }));
                        this.istouchcapable && (b.bind(b.win, "touchstart", b.ontouchstart), b.bind(document, "touchend", b.ontouchend), b.bind(document, "touchcancel", b.ontouchend), b.bind(document, "touchmove", b.ontouchmove));
                        b.bind(b.cursor, "mousedown", b.onmousedown);
                        b.bind(b.cursor, "mouseup", b.onmouseup);
                        b.railh && (b.bind(b.cursorh, "mousedown", function(d) {
                            b.onmousedown(d, !0)
                        }), b.bind(b.cursorh, "mouseup", function(d) {
                            if (!(b.rail.drag && 2 == b.rail.drag.pt)) return b.rail.drag = !1, b.hasmoving = !1, b.hideCursor(), f.hasmousecapture && document.releaseCapture(),
                                b.cancelEvent(d)
                        }));
                        if (b.opt.cursordragontouch || !f.cantouch && !b.opt.touchbehavior) b.rail.css({
                            cursor: "default"
                        }), b.railh && b.railh.css({
                            cursor: "default"
                        }), b.jqbind(b.rail, "mouseenter", function() {
                            b.canshowonmouseevent && b.showCursor();
                            b.rail.active = !0
                        }), b.jqbind(b.rail, "mouseleave", function() {
                            b.rail.active = !1;
                            b.rail.drag || b.hideCursor()
                        }), b.opt.sensitiverail && (b.bind(b.rail, "click", function(d) {
                            b.doRailClick(d, !1, !1)
                        }), b.bind(b.rail, "dblclick", function(d) {
                            b.doRailClick(d, !0, !1)
                        }), b.bind(b.cursor, "click",
                            function(d) {
                                b.cancelEvent(d)
                            }), b.bind(b.cursor, "dblclick", function(d) {
                            b.cancelEvent(d)
                        })), b.railh && (b.jqbind(b.railh, "mouseenter", function() {
                            b.canshowonmouseevent && b.showCursor();
                            b.rail.active = !0
                        }), b.jqbind(b.railh, "mouseleave", function() {
                            b.rail.active = !1;
                            b.rail.drag || b.hideCursor()
                        }), b.opt.sensitiverail && (b.bind(b.railh, "click", function(d) {
                            b.doRailClick(d, !1, !0)
                        }), b.bind(b.railh, "dblclick", function(d) {
                            b.doRailClick(d, !0, !0)
                        }), b.bind(b.cursorh, "click", function(d) {
                            b.cancelEvent(d)
                        }), b.bind(b.cursorh,
                            "dblclick",
                            function(d) {
                                b.cancelEvent(d)
                            })));
                        !f.cantouch && !b.opt.touchbehavior ? (b.bind(f.hasmousecapture ? b.win : document, "mouseup", b.onmouseup), b.bind(document, "mousemove", b.onmousemove), b.onclick && b.bind(document, "click", b.onclick), !b.ispage && b.opt.enablescrollonselection && (b.bind(b.win[0], "mousedown", b.onselectionstart), b.bind(document, "mouseup", b.onselectionend), b.bind(b.cursor, "mouseup", b.onselectionend), b.cursorh && b.bind(b.cursorh, "mouseup", b.onselectionend), b.bind(document, "mousemove", b.onselectiondrag)),
                            b.zoom && (b.jqbind(b.zoom, "mouseenter", function() {
                                b.canshowonmouseevent && b.showCursor();
                                b.rail.active = !0
                            }), b.jqbind(b.zoom, "mouseleave", function() {
                                b.rail.active = !1;
                                b.rail.drag || b.hideCursor()
                            }))) : (b.bind(f.hasmousecapture ? b.win : document, "mouseup", b.ontouchend), b.bind(document, "mousemove", b.ontouchmove), b.onclick && b.bind(document, "click", b.onclick), b.opt.cursordragontouch && (b.bind(b.cursor, "mousedown", b.onmousedown), b.bind(b.cursor, "mousemove", b.onmousemove), b.cursorh && b.bind(b.cursorh, "mousedown",
                            function(d) {
                                b.onmousedown(d, !0)
                            }), b.cursorh && b.bind(b.cursorh, "mousemove", b.onmousemove)));
                        b.opt.enablemousewheel && (b.isiframe || b.bind(f.isie && b.ispage ? document : b.win, "mousewheel", b.onmousewheel), b.bind(b.rail, "mousewheel", b.onmousewheel), b.railh && b.bind(b.railh, "mousewheel", b.onmousewheelhr));
                        !b.ispage && (!f.cantouch && !/HTML|BODY/.test(b.win[0].nodeName)) && (b.win.attr("tabindex") || b.win.attr({
                            tabindex: L++
                        }), b.jqbind(b.win, "focus", function(d) {
                            z = b.getTarget(d).id || !0;
                            b.hasfocus = !0;
                            b.canshowonmouseevent &&
                                b.noticeCursor()
                        }), b.jqbind(b.win, "blur", function(d) {
                            z = !1;
                            b.hasfocus = !1
                        }), b.jqbind(b.win, "mouseenter", function(d) {
                            E = b.getTarget(d).id || !0;
                            b.hasmousefocus = !0;
                            b.canshowonmouseevent && b.noticeCursor()
                        }), b.jqbind(b.win, "mouseleave", function() {
                            E = !1;
                            b.hasmousefocus = !1;
                            b.rail.drag || b.hideCursor()
                        }))
                    }
                    b.onkeypress = function(d) {
                        if (b.locked && 0 == b.page.maxh) return !0;
                        d = d ? d : window.e;
                        var c = b.getTarget(d);
                        if (c && /INPUT|TEXTAREA|SELECT|OPTION/.test(c.nodeName) && (!c.getAttribute("type") && !c.type || !/submit|button|cancel/i.tp)) return !0;
                        if (b.hasfocus || b.hasmousefocus && !z || b.ispage && !z && !E) {
                            c = d.keyCode;
                            if (b.locked && 27 != c) return b.cancelEvent(d);
                            var g = d.ctrlKey || !1,
                                n = d.shiftKey || !1,
                                f = !1;
                            switch (c) {
                                case 38:
                                case 63233:
                                    b.doScrollBy(72);
                                    f = !0;
                                    break;
                                case 40:
                                case 63235:
                                    b.doScrollBy(-72);
                                    f = !0;
                                    break;
                                case 37:
                                case 63232:
                                    b.railh && (g ? b.doScrollLeft(0) : b.doScrollLeftBy(72), f = !0);
                                    break;
                                case 39:
                                case 63234:
                                    b.railh && (g ? b.doScrollLeft(b.page.maxw) : b.doScrollLeftBy(-72), f = !0);
                                    break;
                                case 33:
                                case 63276:
                                    b.doScrollBy(b.view.h);
                                    f = !0;
                                    break;
                                case 34:
                                case 63277:
                                    b.doScrollBy(-b.view.h);
                                    f = !0;
                                    break;
                                case 36:
                                case 63273:
                                    b.railh && g ? b.doScrollPos(0, 0) : b.doScrollTo(0);
                                    f = !0;
                                    break;
                                case 35:
                                case 63275:
                                    b.railh && g ? b.doScrollPos(b.page.maxw, b.page.maxh) : b.doScrollTo(b.page.maxh);
                                    f = !0;
                                    break;
                                case 32:
                                    b.opt.spacebarenabled && (n ? b.doScrollBy(b.view.h) : b.doScrollBy(-b.view.h), f = !0);
                                    break;
                                case 27:
                                    b.zoomactive && (b.doZoom(), f = !0)
                            }
                            if (f) return b.cancelEvent(d)
                        }
                    };
                    b.opt.enablekeyboard && b.bind(document, f.isopera && !f.isopera12 ? "keypress" : "keydown", b.onkeypress);
                    b.bind(window, "resize", b.lazyResize);
                    b.bind(window,
                        "orientationchange", b.lazyResize);
                    b.bind(window, "load", b.lazyResize);
                    if (f.ischrome && !b.ispage && !b.haswrapper) {
                        var s = b.win.attr("style"),
                            g = parseFloat(b.win.css("width")) + 1;
                        b.win.css("width", g);
                        b.synched("chromefix", function() {
                            b.win.attr("style", s)
                        })
                    }
                    b.onAttributeChange = function(d) {
                        b.lazyResize(250)
                    };
                    !b.ispage && !b.haswrapper && (!1 !== A ? (b.observer = new A(function(d) {
                            d.forEach(b.onAttributeChange)
                        }), b.observer.observe(b.win[0], {
                            childList: !0,
                            characterData: !1,
                            attributes: !0,
                            subtree: !1
                        }), b.observerremover =
                        new A(function(d) {
                            d.forEach(function(d) {
                                if (0 < d.removedNodes.length)
                                    for (var c in d.removedNodes)
                                        if (d.removedNodes[c] == b.win[0]) return b.remove()
                            })
                        }), b.observerremover.observe(b.win[0].parentNode, {
                            childList: !0,
                            characterData: !1,
                            attributes: !1,
                            subtree: !1
                        })) : (b.bind(b.win, f.isie && !f.isie9 ? "propertychange" : "DOMAttrModified", b.onAttributeChange), f.isie9 && b.win[0].attachEvent("onpropertychange", b.onAttributeChange), b.bind(b.win, "DOMNodeRemoved", function(d) {
                        d.target == b.win[0] && b.remove()
                    })));
                    !b.ispage && b.opt.boxzoom &&
                        b.bind(window, "resize", b.resizeZoom);
                    b.istextarea && b.bind(b.win, "mouseup", b.lazyResize);
                    b.checkrtlmode = !0;
                    b.lazyResize(30)
                }
                if ("IFRAME" == this.doc[0].nodeName) {
                    var K = function(d) {
                        b.iframexd = !1;
                        try {
                            var c = "contentDocument" in this ? this.contentDocument : this.contentWindow.document
                        } catch (g) {
                            b.iframexd = !0, c = !1
                        }
                        if (b.iframexd) return "console" in window && console.log("NiceScroll error: policy restriced iframe"), !0;
                        b.forcescreen = !0;
                        b.isiframe && (b.iframe = {
                                doc: e(c),
                                html: b.doc.contents().find("html")[0],
                                body: b.doc.contents().find("body")[0]
                            },
                            b.getContentSize = function() {
                                return {
                                    w: Math.max(b.iframe.html.scrollWidth, b.iframe.body.scrollWidth),
                                    h: Math.max(b.iframe.html.scrollHeight, b.iframe.body.scrollHeight)
                                }
                            }, b.docscroll = e(b.iframe.body));
                        !f.isios && (b.opt.iframeautoresize && !b.isiframe) && (b.win.scrollTop(0), b.doc.height(""), d = Math.max(c.getElementsByTagName("html")[0].scrollHeight, c.body.scrollHeight), b.doc.height(d));
                        b.lazyResize(30);
                        f.isie7 && b.css(e(b.iframe.html), {
                            "overflow-y": "hidden"
                        });
                        b.css(e(b.iframe.body), {
                            "overflow-y": "hidden"
                        });
                        f.isios && b.haswrapper && b.css(e(c.body), {
                            "-webkit-transform": "translate3d(0,0,0)"
                        });
                        "contentWindow" in this ? b.bind(this.contentWindow, "scroll", b.onscroll) : b.bind(c, "scroll", b.onscroll);
                        b.opt.enablemousewheel && b.bind(c, "mousewheel", b.onmousewheel);
                        b.opt.enablekeyboard && b.bind(c, f.isopera ? "keypress" : "keydown", b.onkeypress);
                        if (f.cantouch || b.opt.touchbehavior) b.bind(c, "mousedown", b.ontouchstart), b.bind(c, "mousemove", function(d) {
                            b.ontouchmove(d, !0)
                        }), b.opt.grabcursorenabled && f.cursorgrabvalue && b.css(e(c.body), {
                            cursor: f.cursorgrabvalue
                        });
                        b.bind(c, "mouseup", b.ontouchend);
                        b.zoom && (b.opt.dblclickzoom && b.bind(c, "dblclick", b.doZoom), b.ongesturezoom && b.bind(c, "gestureend", b.ongesturezoom))
                    };
                    this.doc[0].readyState && "complete" == this.doc[0].readyState && setTimeout(function() {
                        K.call(b.doc[0], !1)
                    }, 500);
                    b.bind(this.doc, "load", K)
                }
            };
            this.showCursor = function(d, c) {
                b.cursortimeout && (clearTimeout(b.cursortimeout), b.cursortimeout = 0);
                if (b.rail) {
                    b.autohidedom && (b.autohidedom.stop().css({
                        opacity: b.opt.cursoropacitymax
                    }), b.cursoractive = !0);
                    if (!b.rail.drag || 1 != b.rail.drag.pt) "undefined" != typeof d && !1 !== d && (b.scroll.y = Math.round(1 * d / b.scrollratio.y)), "undefined" != typeof c && (b.scroll.x = Math.round(1 * c / b.scrollratio.x));
                    b.cursor.css({
                        height: b.cursorheight,
                        top: b.scroll.y
                    });
                    b.cursorh && (!b.rail.align && b.rail.visibility ? b.cursorh.css({
                        width: b.cursorwidth,
                        left: b.scroll.x + b.rail.width
                    }) : b.cursorh.css({
                        width: b.cursorwidth,
                        left: b.scroll.x
                    }), b.cursoractive = !0);
                    b.zoom && b.zoom.stop().css({
                        opacity: b.opt.cursoropacitymax
                    })
                }
            };
            this.hideCursor = function(d) {
                !b.cursortimeout &&
                    (b.rail && b.autohidedom && !(b.hasmousefocus && "leave" == b.opt.autohidemode)) && (b.cursortimeout = setTimeout(function() {
                        if (!b.rail.active || !b.showonmouseevent) b.autohidedom.stop().animate({
                            opacity: b.opt.cursoropacitymin
                        }), b.zoom && b.zoom.stop().animate({
                            opacity: b.opt.cursoropacitymin
                        }), b.cursoractive = !1;
                        b.cursortimeout = 0
                    }, d || b.opt.hidecursordelay))
            };
            this.noticeCursor = function(d, c, g) {
                b.showCursor(c, g);
                b.rail.active || b.hideCursor(d)
            };
            this.getContentSize = b.ispage ? function() {
                return {
                    w: Math.max(document.body.scrollWidth,
                        document.documentElement.scrollWidth),
                    h: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
                }
            } : b.haswrapper ? function() {
                return {
                    w: b.doc.outerWidth() + parseInt(b.win.css("paddingLeft")) + parseInt(b.win.css("paddingRight")),
                    h: b.doc.outerHeight() + parseInt(b.win.css("paddingTop")) + parseInt(b.win.css("paddingBottom"))
                }
            } : function() {
                return {
                    w: b.docscroll[0].scrollWidth,
                    h: b.docscroll[0].scrollHeight
                }
            };
            this.onResize = function(d, c) {
                if (!b || !b.win) return !1;
                if (!b.haswrapper && !b.ispage) {
                    if ("none" ==
                        b.win.css("display")) return b.visibility && b.hideRail().hideRailHr(), !1;
                    !b.hidden && !b.visibility && b.showRail().showRailHr()
                }
                var g = b.page.maxh,
                    f = b.page.maxw,
                    e = b.view.w;
                b.view = {
                    w: b.ispage ? b.win.width() : parseInt(b.win[0].clientWidth),
                    h: b.ispage ? b.win.height() : parseInt(b.win[0].clientHeight)
                };
                b.page = c ? c : b.getContentSize();
                b.page.maxh = Math.max(0, b.page.h - b.view.h);
                b.page.maxw = Math.max(0, b.page.w - b.view.w);
                if (b.page.maxh == g && b.page.maxw == f && b.view.w == e) {
                    if (b.ispage) return b;
                    g = b.win.offset();
                    if (b.lastposition &&
                        (f = b.lastposition, f.top == g.top && f.left == g.left)) return b;
                    b.lastposition = g
                }
                0 == b.page.maxh ? (b.hideRail(), b.scrollvaluemax = 0, b.scroll.y = 0, b.scrollratio.y = 0, b.cursorheight = 0, b.setScrollTop(0), b.rail.scrollable = !1) : b.rail.scrollable = !0;
                0 == b.page.maxw ? (b.hideRailHr(), b.scrollvaluemaxw = 0, b.scroll.x = 0, b.scrollratio.x = 0, b.cursorwidth = 0, b.setScrollLeft(0), b.railh.scrollable = !1) : b.railh.scrollable = !0;
                b.locked = 0 == b.page.maxh && 0 == b.page.maxw;
                if (b.locked) return b.ispage || b.updateScrollBar(b.view), !1;
                !b.hidden &&
                    !b.visibility ? b.showRail().showRailHr() : !b.hidden && !b.railh.visibility && b.showRailHr();
                b.istextarea && (b.win.css("resize") && "none" != b.win.css("resize")) && (b.view.h -= 20);
                b.cursorheight = Math.min(b.view.h, Math.round(b.view.h * (b.view.h / b.page.h)));
                b.cursorheight = b.opt.cursorfixedheight ? b.opt.cursorfixedheight : Math.max(b.opt.cursorminheight, b.cursorheight);
                b.cursorwidth = Math.min(b.view.w, Math.round(b.view.w * (b.view.w / b.page.w)));
                b.cursorwidth = b.opt.cursorfixedheight ? b.opt.cursorfixedheight : Math.max(b.opt.cursorminheight,
                    b.cursorwidth);
                b.scrollvaluemax = b.view.h - b.cursorheight - b.cursor.hborder;
                b.railh && (b.railh.width = 0 < b.page.maxh ? b.view.w - b.rail.width : b.view.w, b.scrollvaluemaxw = b.railh.width - b.cursorwidth - b.cursorh.wborder);
                b.checkrtlmode && b.railh && (b.checkrtlmode = !1, b.opt.rtlmode && 0 == b.scroll.x && b.setScrollLeft(b.page.maxw));
                b.ispage || b.updateScrollBar(b.view);
                b.scrollratio = {
                    x: b.page.maxw / b.scrollvaluemaxw,
                    y: b.page.maxh / b.scrollvaluemax
                };
                b.getScrollTop() > b.page.maxh ? b.doScrollTop(b.page.maxh) : (b.scroll.y = Math.round(b.getScrollTop() *
                    (1 / b.scrollratio.y)), b.scroll.x = Math.round(b.getScrollLeft() * (1 / b.scrollratio.x)), b.cursoractive && b.noticeCursor());
                b.scroll.y && 0 == b.getScrollTop() && b.doScrollTo(Math.floor(b.scroll.y * b.scrollratio.y));
                return b
            };
            this.resize = b.onResize;
            this.lazyResize = function(d) {
                d = isNaN(d) ? 30 : d;
                b.delayed("resize", b.resize, d);
                return b
            };
            this._bind = function(d, c, g, f) {
                b.events.push({
                    e: d,
                    n: c,
                    f: g,
                    b: f,
                    q: !1
                });
                d.addEventListener ? d.addEventListener(c, g, f || !1) : d.attachEvent ? d.attachEvent("on" + c, g) : d["on" + c] = g
            };
            this.jqbind = function(d,
                c, g) {
                b.events.push({
                    e: d,
                    n: c,
                    f: g,
                    q: !0
                });
                e(d).bind(c, g)
            };
            this.bind = function(d, c, g, e) {
                var h = "jquery" in d ? d[0] : d;
                "mousewheel" == c ? "onwheel" in b.win ? b._bind(h, "wheel", g, e || !1) : (d = "undefined" != typeof document.onmousewheel ? "mousewheel" : "DOMMouseScroll", q(h, d, g, e || !1), "DOMMouseScroll" == d && q(h, "MozMousePixelScroll", g, e || !1)) : h.addEventListener ? (f.cantouch && /mouseup|mousedown|mousemove/.test(c) && b._bind(h, "mousedown" == c ? "touchstart" : "mouseup" == c ? "touchend" : "touchmove", function(b) {
                    if (b.touches) {
                        if (2 > b.touches.length) {
                            var d =
                                b.touches.length ? b.touches[0] : b;
                            d.original = b;
                            g.call(this, d)
                        }
                    } else b.changedTouches && (d = b.changedTouches[0], d.original = b, g.call(this, d))
                }, e || !1), b._bind(h, c, g, e || !1), f.cantouch && "mouseup" == c && b._bind(h, "touchcancel", g, e || !1)) : b._bind(h, c, function(d) {
                    if ((d = d || window.event || !1) && d.srcElement) d.target = d.srcElement;
                    "pageY" in d || (d.pageX = d.clientX + document.documentElement.scrollLeft, d.pageY = d.clientY + document.documentElement.scrollTop);
                    return !1 === g.call(h, d) || !1 === e ? b.cancelEvent(d) : !0
                })
            };
            this._unbind =
                function(b, c, g, f) {
                    b.removeEventListener ? b.removeEventListener(c, g, f) : b.detachEvent ? b.detachEvent("on" + c, g) : b["on" + c] = !1
                };
            this.unbindAll = function() {
                for (var d = 0; d < b.events.length; d++) {
                    var c = b.events[d];
                    c.q ? c.e.unbind(c.n, c.f) : b._unbind(c.e, c.n, c.f, c.b)
                }
            };
            this.cancelEvent = function(b) {
                b = b.original ? b.original : b ? b : window.event || !1;
                if (!b) return !1;
                b.preventDefault && b.preventDefault();
                b.stopPropagation && b.stopPropagation();
                b.preventManipulation && b.preventManipulation();
                b.cancelBubble = !0;
                b.cancel = !0;
                return b.returnValue = !1
            };
            this.stopPropagation = function(b) {
                b = b.original ? b.original : b ? b : window.event || !1;
                if (!b) return !1;
                if (b.stopPropagation) return b.stopPropagation();
                b.cancelBubble && (b.cancelBubble = !0);
                return !1
            };
            this.showRail = function() {
                if (0 != b.page.maxh && (b.ispage || "none" != b.win.css("display"))) b.visibility = !0, b.rail.visibility = !0, b.rail.css("display", "block");
                return b
            };
            this.showRailHr = function() {
                if (!b.railh) return b;
                if (0 != b.page.maxw && (b.ispage || "none" != b.win.css("display"))) b.railh.visibility = !0, b.railh.css("display",
                    "block");
                return b
            };
            this.hideRail = function() {
                b.visibility = !1;
                b.rail.visibility = !1;
                b.rail.css("display", "none");
                return b
            };
            this.hideRailHr = function() {
                if (!b.railh) return b;
                b.railh.visibility = !1;
                b.railh.css("display", "none");
                return b
            };
            this.show = function() {
                b.hidden = !1;
                b.locked = !1;
                return b.showRail().showRailHr()
            };
            this.hide = function() {
                b.hidden = !0;
                b.locked = !0;
                return b.hideRail().hideRailHr()
            };
            this.toggle = function() {
                return b.hidden ? b.show() : b.hide()
            };
            this.remove = function() {
                b.stop();
                b.cursortimeout && clearTimeout(b.cursortimeout);
                b.doZoomOut();
                b.unbindAll();
                f.isie9 && b.win[0].detachEvent("onpropertychange", b.onAttributeChange);
                !1 !== b.observer && b.observer.disconnect();
                !1 !== b.observerremover && b.observerremover.disconnect();
                b.events = null;
                b.cursor && b.cursor.remove();
                b.cursorh && b.cursorh.remove();
                b.rail && b.rail.remove();
                b.railh && b.railh.remove();
                b.zoom && b.zoom.remove();
                for (var d = 0; d < b.saved.css.length; d++) {
                    var c = b.saved.css[d];
                    c[0].css(c[1], "undefined" == typeof c[2] ? "" : c[2])
                }
                b.saved = !1;
                b.me.data("__nicescroll", "");
                var g = e.nicescroll;
                g.each(function(d) {
                    if (this && this.id === b.id) {
                        delete g[d];
                        for (var c = ++d; c < g.length; c++, d++) g[d] = g[c];
                        g.length--;
                        g.length && delete g[g.length]
                    }
                });
                for (var h in b) b[h] = null, delete b[h];
                b = null
            };
            this.scrollstart = function(d) {
                this.onscrollstart = d;
                return b
            };
            this.scrollend = function(d) {
                this.onscrollend = d;
                return b
            };
            this.scrollcancel = function(d) {
                this.onscrollcancel = d;
                return b
            };
            this.zoomin = function(d) {
                this.onzoomin = d;
                return b
            };
            this.zoomout = function(d) {
                this.onzoomout = d;
                return b
            };
            this.isScrollable = function(b) {
                b = b.target ?
                    b.target : b;
                if ("OPTION" == b.nodeName) return !0;
                for (; b && 1 == b.nodeType && !/BODY|HTML/.test(b.nodeName);) {
                    var c = e(b),
                        c = c.css("overflowY") || c.css("overflowX") || c.css("overflow") || "";
                    if (/scroll|auto/.test(c)) return b.clientHeight != b.scrollHeight;
                    b = b.parentNode ? b.parentNode : !1
                }
                return !1
            };
            this.getViewport = function(b) {
                for (b = b && b.parentNode ? b.parentNode : !1; b && 1 == b.nodeType && !/BODY|HTML/.test(b.nodeName);) {
                    var c = e(b);
                    if (/fixed|absolute/.test(c.css("position"))) return c;
                    var g = c.css("overflowY") || c.css("overflowX") ||
                        c.css("overflow") || "";
                    if (/scroll|auto/.test(g) && b.clientHeight != b.scrollHeight || 0 < c.getNiceScroll().length) return c;
                    b = b.parentNode ? b.parentNode : !1
                }
                return !1
            };
            this.onmousewheel = function(d) {
                if (b.locked) return b.debounced("checkunlock", b.resize, 250), !0;
                if (b.rail.drag) return b.cancelEvent(d);
                "auto" == b.opt.oneaxismousemode && 0 != d.deltaX && (b.opt.oneaxismousemode = !1);
                if (b.opt.oneaxismousemode && 0 == d.deltaX && !b.rail.scrollable) return b.railh && b.railh.scrollable ? b.onmousewheelhr(d) : !0;
                var c = +new Date,
                    g = !1;
                b.opt.preservenativescrolling &&
                    b.checkarea + 600 < c && (b.nativescrollingarea = b.isScrollable(d), g = !0);
                b.checkarea = c;
                if (b.nativescrollingarea) return !0;
                if (d = t(d, !1, g)) b.checkarea = 0;
                return d
            };
            this.onmousewheelhr = function(d) {
                if (b.locked || !b.railh.scrollable) return !0;
                if (b.rail.drag) return b.cancelEvent(d);
                var c = +new Date,
                    g = !1;
                b.opt.preservenativescrolling && b.checkarea + 600 < c && (b.nativescrollingarea = b.isScrollable(d), g = !0);
                b.checkarea = c;
                return b.nativescrollingarea ? !0 : b.locked ? b.cancelEvent(d) : t(d, !0, g)
            };
            this.stop = function() {
                b.cancelScroll();
                b.scrollmon && b.scrollmon.stop();
                b.cursorfreezed = !1;
                b.scroll.y = Math.round(b.getScrollTop() * (1 / b.scrollratio.y));
                b.noticeCursor();
                return b
            };
            this.getTransitionSpeed = function(c) {
                var f = Math.round(10 * b.opt.scrollspeed);
                c = Math.min(f, Math.round(c / 20 * b.opt.scrollspeed));
                return 20 < c ? c : 0
            };
            b.opt.smoothscroll ? b.ishwscroll && f.hastransition && b.opt.usetransition ? (this.prepareTransition = function(c, e) {
                var g = e ? 20 < c ? c : 0 : b.getTransitionSpeed(c),
                    h = g ? f.prefixstyle + "transform " + g + "ms ease-out" : "";
                if (!b.lasttransitionstyle ||
                    b.lasttransitionstyle != h) b.lasttransitionstyle = h, b.doc.css(f.transitionstyle, h);
                return g
            }, this.doScrollLeft = function(c, f) {
                var g = b.scrollrunning ? b.newscrolly : b.getScrollTop();
                b.doScrollPos(c, g, f)
            }, this.doScrollTop = function(c, f) {
                var g = b.scrollrunning ? b.newscrollx : b.getScrollLeft();
                b.doScrollPos(g, c, f)
            }, this.doScrollPos = function(c, e, g) {
                var h = b.getScrollTop(),
                    l = b.getScrollLeft();
                (0 > (b.newscrolly - h) * (e - h) || 0 > (b.newscrollx - l) * (c - l)) && b.cancelScroll();
                !1 == b.opt.bouncescroll && (0 > e ? e = 0 : e > b.page.maxh && (e = b.page.maxh),
                    0 > c ? c = 0 : c > b.page.maxw && (c = b.page.maxw));
                if (b.scrollrunning && c == b.newscrollx && e == b.newscrolly) return !1;
                b.newscrolly = e;
                b.newscrollx = c;
                b.newscrollspeed = g || !1;
                if (b.timer) return !1;
                b.timer = setTimeout(function() {
                    var g = b.getScrollTop(),
                        h = b.getScrollLeft(),
                        l, k;
                    l = c - h;
                    k = e - g;
                    l = Math.round(Math.sqrt(Math.pow(l, 2) + Math.pow(k, 2)));
                    l = b.newscrollspeed && 1 < b.newscrollspeed ? b.newscrollspeed : b.getTransitionSpeed(l);
                    b.newscrollspeed && 1 >= b.newscrollspeed && (l *= b.newscrollspeed);
                    b.prepareTransition(l, !0);
                    b.timerscroll && b.timerscroll.tm &&
                        clearInterval(b.timerscroll.tm);
                    0 < l && (!b.scrollrunning && b.onscrollstart && b.onscrollstart.call(b, {
                        type: "scrollstart",
                        current: {
                            x: h,
                            y: g
                        },
                        request: {
                            x: c,
                            y: e
                        },
                        end: {
                            x: b.newscrollx,
                            y: b.newscrolly
                        },
                        speed: l
                    }), f.transitionend ? b.scrollendtrapped || (b.scrollendtrapped = !0, b.bind(b.doc, f.transitionend, b.onScrollEnd, !1)) : (b.scrollendtrapped && clearTimeout(b.scrollendtrapped), b.scrollendtrapped = setTimeout(b.onScrollEnd, l)), b.timerscroll = {
                        bz: new BezierClass(g, b.newscrolly, l, 0, 0, 0.58, 1),
                        bh: new BezierClass(h, b.newscrollx,
                            l, 0, 0, 0.58, 1)
                    }, b.cursorfreezed || (b.timerscroll.tm = setInterval(function() {
                        b.showCursor(b.getScrollTop(), b.getScrollLeft())
                    }, 60)));
                    b.synched("doScroll-set", function() {
                        b.timer = 0;
                        b.scrollendtrapped && (b.scrollrunning = !0);
                        b.setScrollTop(b.newscrolly);
                        b.setScrollLeft(b.newscrollx);
                        if (!b.scrollendtrapped) b.onScrollEnd()
                    })
                }, 50)
            }, this.cancelScroll = function() {
                if (!b.scrollendtrapped) return !0;
                var c = b.getScrollTop(),
                    e = b.getScrollLeft();
                b.scrollrunning = !1;
                f.transitionend || clearTimeout(f.transitionend);
                b.scrollendtrapped = !1;
                b._unbind(b.doc, f.transitionend, b.onScrollEnd);
                b.prepareTransition(0);
                b.setScrollTop(c);
                b.railh && b.setScrollLeft(e);
                b.timerscroll && b.timerscroll.tm && clearInterval(b.timerscroll.tm);
                b.timerscroll = !1;
                b.cursorfreezed = !1;
                b.showCursor(c, e);
                return b
            }, this.onScrollEnd = function() {
                b.scrollendtrapped && b._unbind(b.doc, f.transitionend, b.onScrollEnd);
                b.scrollendtrapped = !1;
                b.prepareTransition(0);
                b.timerscroll && b.timerscroll.tm && clearInterval(b.timerscroll.tm);
                b.timerscroll = !1;
                var c = b.getScrollTop(),
                    e = b.getScrollLeft();
                b.setScrollTop(c);
                b.railh && b.setScrollLeft(e);
                b.noticeCursor(!1, c, e);
                b.cursorfreezed = !1;
                0 > c ? c = 0 : c > b.page.maxh && (c = b.page.maxh);
                0 > e ? e = 0 : e > b.page.maxw && (e = b.page.maxw);
                if (c != b.newscrolly || e != b.newscrollx) return b.doScrollPos(e, c, b.opt.snapbackspeed);
                b.onscrollend && b.scrollrunning && b.onscrollend.call(b, {
                    type: "scrollend",
                    current: {
                        x: e,
                        y: c
                    },
                    end: {
                        x: b.newscrollx,
                        y: b.newscrolly
                    }
                });
                b.scrollrunning = !1
            }) : (this.doScrollLeft = function(c, f) {
                    var g = b.scrollrunning ? b.newscrolly : b.getScrollTop();
                    b.doScrollPos(c, g, f)
                },
                this.doScrollTop = function(c, f) {
                    var g = b.scrollrunning ? b.newscrollx : b.getScrollLeft();
                    b.doScrollPos(g, c, f)
                }, this.doScrollPos = function(c, f, g) {
                    function e() {
                        if (b.cancelAnimationFrame) return !0;
                        b.scrollrunning = !0;
                        if (p = 1 - p) return b.timer = v(e) || 1;
                        var c = 0,
                            d = sy = b.getScrollTop();
                        if (b.dst.ay) {
                            var d = b.bzscroll ? b.dst.py + b.bzscroll.getNow() * b.dst.ay : b.newscrolly,
                                g = d - sy;
                            if (0 > g && d < b.newscrolly || 0 < g && d > b.newscrolly) d = b.newscrolly;
                            b.setScrollTop(d);
                            d == b.newscrolly && (c = 1)
                        } else c = 1;
                        var f = sx = b.getScrollLeft();
                        if (b.dst.ax) {
                            f =
                                b.bzscroll ? b.dst.px + b.bzscroll.getNow() * b.dst.ax : b.newscrollx;
                            g = f - sx;
                            if (0 > g && f < b.newscrollx || 0 < g && f > b.newscrollx) f = b.newscrollx;
                            b.setScrollLeft(f);
                            f == b.newscrollx && (c += 1)
                        } else c += 1;
                        2 == c ? (b.timer = 0, b.cursorfreezed = !1, b.bzscroll = !1, b.scrollrunning = !1, 0 > d ? d = 0 : d > b.page.maxh && (d = b.page.maxh), 0 > f ? f = 0 : f > b.page.maxw && (f = b.page.maxw), f != b.newscrollx || d != b.newscrolly ? b.doScrollPos(f, d) : b.onscrollend && b.onscrollend.call(b, {
                                type: "scrollend",
                                current: {
                                    x: sx,
                                    y: sy
                                },
                                end: {
                                    x: b.newscrollx,
                                    y: b.newscrolly
                                }
                            })) : b.timer = v(e) ||
                            1
                    }
                    f = "undefined" == typeof f || !1 === f ? b.getScrollTop(!0) : f;
                    if (b.timer && b.newscrolly == f && b.newscrollx == c) return !0;
                    b.timer && w(b.timer);
                    b.timer = 0;
                    var h = b.getScrollTop(),
                        l = b.getScrollLeft();
                    (0 > (b.newscrolly - h) * (f - h) || 0 > (b.newscrollx - l) * (c - l)) && b.cancelScroll();
                    b.newscrolly = f;
                    b.newscrollx = c;
                    if (!b.bouncescroll || !b.rail.visibility) 0 > b.newscrolly ? b.newscrolly = 0 : b.newscrolly > b.page.maxh && (b.newscrolly = b.page.maxh);
                    if (!b.bouncescroll || !b.railh.visibility) 0 > b.newscrollx ? b.newscrollx = 0 : b.newscrollx > b.page.maxw &&
                        (b.newscrollx = b.page.maxw);
                    b.dst = {};
                    b.dst.x = c - l;
                    b.dst.y = f - h;
                    b.dst.px = l;
                    b.dst.py = h;
                    var k = Math.round(Math.sqrt(Math.pow(b.dst.x, 2) + Math.pow(b.dst.y, 2)));
                    b.dst.ax = b.dst.x / k;
                    b.dst.ay = b.dst.y / k;
                    var m = 0,
                        q = k;
                    0 == b.dst.x ? (m = h, q = f, b.dst.ay = 1, b.dst.py = 0) : 0 == b.dst.y && (m = l, q = c, b.dst.ax = 1, b.dst.px = 0);
                    k = b.getTransitionSpeed(k);
                    g && 1 >= g && (k *= g);
                    b.bzscroll = 0 < k ? b.bzscroll ? b.bzscroll.update(q, k) : new BezierClass(m, q, k, 0, 1, 0, 1) : !1;
                    if (!b.timer) {
                        (h == b.page.maxh && f >= b.page.maxh || l == b.page.maxw && c >= b.page.maxw) && b.checkContentSize();
                        var p = 1;
                        b.cancelAnimationFrame = !1;
                        b.timer = 1;
                        b.onscrollstart && !b.scrollrunning && b.onscrollstart.call(b, {
                            type: "scrollstart",
                            current: {
                                x: l,
                                y: h
                            },
                            request: {
                                x: c,
                                y: f
                            },
                            end: {
                                x: b.newscrollx,
                                y: b.newscrolly
                            },
                            speed: k
                        });
                        e();
                        (h == b.page.maxh && f >= h || l == b.page.maxw && c >= l) && b.checkContentSize();
                        b.noticeCursor()
                    }
                }, this.cancelScroll = function() {
                    b.timer && w(b.timer);
                    b.timer = 0;
                    b.bzscroll = !1;
                    b.scrollrunning = !1;
                    return b
                }) : (this.doScrollLeft = function(c, f) {
                var g = b.getScrollTop();
                b.doScrollPos(c, g, f)
            }, this.doScrollTop = function(c,
                f) {
                var g = b.getScrollLeft();
                b.doScrollPos(g, c, f)
            }, this.doScrollPos = function(c, f, g) {
                var e = c > b.page.maxw ? b.page.maxw : c;
                0 > e && (e = 0);
                var h = f > b.page.maxh ? b.page.maxh : f;
                0 > h && (h = 0);
                b.synched("scroll", function() {
                    b.setScrollTop(h);
                    b.setScrollLeft(e)
                })
            }, this.cancelScroll = function() {});
            this.doScrollBy = function(c, f) {
                var g = 0,
                    g = f ? Math.floor((b.scroll.y - c) * b.scrollratio.y) : (b.timer ? b.newscrolly : b.getScrollTop(!0)) - c;
                if (b.bouncescroll) {
                    var e = Math.round(b.view.h / 2);
                    g < -e ? g = -e : g > b.page.maxh + e && (g = b.page.maxh + e)
                }
                b.cursorfreezed = !1;
                py = b.getScrollTop(!0);
                if (0 > g && 0 >= py) return b.noticeCursor();
                if (g > b.page.maxh && py >= b.page.maxh) return b.checkContentSize(), b.noticeCursor();
                b.doScrollTop(g)
            };
            this.doScrollLeftBy = function(c, f) {
                var g = 0,
                    g = f ? Math.floor((b.scroll.x - c) * b.scrollratio.x) : (b.timer ? b.newscrollx : b.getScrollLeft(!0)) - c;
                if (b.bouncescroll) {
                    var e = Math.round(b.view.w / 2);
                    g < -e ? g = -e : g > b.page.maxw + e && (g = b.page.maxw + e)
                }
                b.cursorfreezed = !1;
                px = b.getScrollLeft(!0);
                if (0 > g && 0 >= px || g > b.page.maxw && px >= b.page.maxw) return b.noticeCursor();
                b.doScrollLeft(g)
            };
            this.doScrollTo = function(c, f) {
                f && Math.round(c * b.scrollratio.y);
                b.cursorfreezed = !1;
                b.doScrollTop(c)
            };
            this.checkContentSize = function() {
                var c = b.getContentSize();
                (c.h != b.page.h || c.w != b.page.w) && b.resize(!1, c)
            };
            b.onscroll = function(c) {
                b.rail.drag || b.cursorfreezed || b.synched("scroll", function() {
                    b.scroll.y = Math.round(b.getScrollTop() * (1 / b.scrollratio.y));
                    b.railh && (b.scroll.x = Math.round(b.getScrollLeft() * (1 / b.scrollratio.x)));
                    b.noticeCursor()
                })
            };
            b.bind(b.docscroll, "scroll", b.onscroll);
            this.doZoomIn = function(c) {
                if (!b.zoomactive) {
                    b.zoomactive = !0;
                    b.zoomrestore = {
                        style: {}
                    };
                    var h = "position top left zIndex backgroundColor marginTop marginBottom marginLeft marginRight".split(" "),
                        g = b.win[0].style,
                        l;
                    for (l in h) {
                        var k = h[l];
                        b.zoomrestore.style[k] = "undefined" != typeof g[k] ? g[k] : ""
                    }
                    b.zoomrestore.style.width = b.win.css("width");
                    b.zoomrestore.style.height = b.win.css("height");
                    b.zoomrestore.padding = {
                        w: b.win.outerWidth() - b.win.width(),
                        h: b.win.outerHeight() - b.win.height()
                    };
                    f.isios4 && (b.zoomrestore.scrollTop = e(window).scrollTop(), e(window).scrollTop(0));
                    b.win.css({
                        position: f.isios4 ? "absolute" : "fixed",
                        top: 0,
                        left: 0,
                        "z-index": y + 100,
                        margin: "0px"
                    });
                    h = b.win.css("backgroundColor");
                    ("" == h || /transparent|rgba\(0, 0, 0, 0\)|rgba\(0,0,0,0\)/.test(h)) && b.win.css("backgroundColor", "#fff");
                    b.rail.css({
                        "z-index": y + 101
                    });
                    b.zoom.css({
                        "z-index": y + 102
                    });
                    b.zoom.css("backgroundPosition", "0px -18px");
                    b.resizeZoom();
                    b.onzoomin && b.onzoomin.call(b);
                    return b.cancelEvent(c)
                }
            };
            this.doZoomOut = function(c) {
                if (b.zoomactive) return b.zoomactive = !1, b.win.css("margin", ""), b.win.css(b.zoomrestore.style),
                    f.isios4 && e(window).scrollTop(b.zoomrestore.scrollTop), b.rail.css({
                        "z-index": b.zindex
                    }), b.zoom.css({
                        "z-index": b.zindex
                    }), b.zoomrestore = !1, b.zoom.css("backgroundPosition", "0px 0px"), b.onResize(), b.onzoomout && b.onzoomout.call(b), b.cancelEvent(c)
            };
            this.doZoom = function(c) {
                return b.zoomactive ? b.doZoomOut(c) : b.doZoomIn(c)
            };
            this.resizeZoom = function() {
                if (b.zoomactive) {
                    var c = b.getScrollTop();
                    b.win.css({
                        width: e(window).width() - b.zoomrestore.padding.w + "px",
                        height: e(window).height() - b.zoomrestore.padding.h + "px"
                    });
                    b.onResize();
                    b.setScrollTop(Math.min(b.page.maxh, c))
                }
            };
            this.init();
            e.nicescroll.push(this)
        },
        J = function(e) {
            var c = this;
            this.nc = e;
            this.steptime = this.lasttime = this.speedy = this.speedx = this.lasty = this.lastx = 0;
            this.snapy = this.snapx = !1;
            this.demuly = this.demulx = 0;
            this.lastscrolly = this.lastscrollx = -1;
            this.timer = this.chky = this.chkx = 0;
            this.time = function() {
                return +new Date
            };
            this.reset = function(e, l) {
                c.stop();
                var k = c.time();
                c.steptime = 0;
                c.lasttime = k;
                c.speedx = 0;
                c.speedy = 0;
                c.lastx = e;
                c.lasty = l;
                c.lastscrollx = -1;
                c.lastscrolly = -1
            };
            this.update = function(e, l) {
                var k = c.time();
                c.steptime = k - c.lasttime;
                c.lasttime = k;
                var k = l - c.lasty,
                    t = e - c.lastx,
                    b = c.nc.getScrollTop(),
                    p = c.nc.getScrollLeft(),
                    b = b + k,
                    p = p + t;
                c.snapx = 0 > p || p > c.nc.page.maxw;
                c.snapy = 0 > b || b > c.nc.page.maxh;
                c.speedx = t;
                c.speedy = k;
                c.lastx = e;
                c.lasty = l
            };
            this.stop = function() {
                c.nc.unsynched("domomentum2d");
                c.timer && clearTimeout(c.timer);
                c.timer = 0;
                c.lastscrollx = -1;
                c.lastscrolly = -1
            };
            this.doSnapy = function(e, l) {
                var k = !1;
                0 > l ? (l = 0, k = !0) : l > c.nc.page.maxh && (l = c.nc.page.maxh, k = !0);
                0 > e ? (e = 0, k = !0) : e > c.nc.page.maxw && (e = c.nc.page.maxw, k = !0);
                k && c.nc.doScrollPos(e, l, c.nc.opt.snapbackspeed)
            };
            this.doMomentum = function(e) {
                var l = c.time(),
                    k = e ? l + e : c.lasttime;
                e = c.nc.getScrollLeft();
                var t = c.nc.getScrollTop(),
                    b = c.nc.page.maxh,
                    p = c.nc.page.maxw;
                c.speedx = 0 < p ? Math.min(60, c.speedx) : 0;
                c.speedy = 0 < b ? Math.min(60, c.speedy) : 0;
                k = k && 60 >= l - k;
                if (0 > t || t > b || 0 > e || e > p) k = !1;
                e = c.speedx && k ? c.speedx : !1;
                if (c.speedy && k && c.speedy || e) {
                    var f = Math.max(16, c.steptime);
                    50 < f && (e = f / 50, c.speedx *= e, c.speedy *= e, f = 50);
                    c.demulxy = 0;
                    c.lastscrollx =
                        c.nc.getScrollLeft();
                    c.chkx = c.lastscrollx;
                    c.lastscrolly = c.nc.getScrollTop();
                    c.chky = c.lastscrolly;
                    var s = c.lastscrollx,
                        u = c.lastscrolly,
                        d = function() {
                            var e = 600 < c.time() - l ? 0.04 : 0.02;
                            if (c.speedx && (s = Math.floor(c.lastscrollx - c.speedx * (1 - c.demulxy)), c.lastscrollx = s, 0 > s || s > p)) e = 0.1;
                            if (c.speedy && (u = Math.floor(c.lastscrolly - c.speedy * (1 - c.demulxy)), c.lastscrolly = u, 0 > u || u > b)) e = 0.1;
                            c.demulxy = Math.min(1, c.demulxy + e);
                            c.nc.synched("domomentum2d", function() {
                                c.speedx && (c.nc.getScrollLeft() != c.chkx && c.stop(), c.chkx =
                                    s, c.nc.setScrollLeft(s));
                                c.speedy && (c.nc.getScrollTop() != c.chky && c.stop(), c.chky = u, c.nc.setScrollTop(u));
                                c.timer || (c.nc.hideCursor(), c.doSnapy(s, u))
                            });
                            1 > c.demulxy ? c.timer = setTimeout(d, f) : (c.stop(), c.nc.hideCursor(), c.doSnapy(s, u))
                        };
                    d()
                } else c.doSnapy(c.nc.getScrollLeft(), c.nc.getScrollTop())
            }
        },
        B = e.fn.scrollTop;
    e.cssHooks.pageYOffset = {
        get: function(k, c, h) {
            return (c = e.data(k, "__nicescroll") || !1) && c.ishwscroll ? c.getScrollTop() : B.call(k)
        },
        set: function(k, c) {
            var h = e.data(k, "__nicescroll") || !1;
            h && h.ishwscroll ?
                h.setScrollTop(parseInt(c)) : B.call(k, c);
            return this
        }
    };
    e.fn.scrollTop = function(k) {
        if ("undefined" == typeof k) {
            var c = this[0] ? e.data(this[0], "__nicescroll") || !1 : !1;
            return c && c.ishwscroll ? c.getScrollTop() : B.call(this)
        }
        return this.each(function() {
            var c = e.data(this, "__nicescroll") || !1;
            c && c.ishwscroll ? c.setScrollTop(parseInt(k)) : B.call(e(this), k)
        })
    };
    var C = e.fn.scrollLeft;
    e.cssHooks.pageXOffset = {
        get: function(k, c, h) {
            return (c = e.data(k, "__nicescroll") || !1) && c.ishwscroll ? c.getScrollLeft() : C.call(k)
        },
        set: function(k,
            c) {
            var h = e.data(k, "__nicescroll") || !1;
            h && h.ishwscroll ? h.setScrollLeft(parseInt(c)) : C.call(k, c);
            return this
        }
    };
    e.fn.scrollLeft = function(k) {
        if ("undefined" == typeof k) {
            var c = this[0] ? e.data(this[0], "__nicescroll") || !1 : !1;
            return c && c.ishwscroll ? c.getScrollLeft() : C.call(this)
        }
        return this.each(function() {
            var c = e.data(this, "__nicescroll") || !1;
            c && c.ishwscroll ? c.setScrollLeft(parseInt(k)) : C.call(e(this), k)
        })
    };
    var D = function(k) {
        var c = this;
        this.length = 0;
        this.name = "nicescrollarray";
        this.each = function(e) {
            for (var h =
                    0, k = 0; h < c.length; h++) e.call(c[h], k++);
            return c
        };
        this.push = function(e) {
            c[c.length] = e;
            c.length++
        };
        this.eq = function(e) {
            return c[e]
        };
        if (k)
            for (a = 0; a < k.length; a++) {
                var h = e.data(k[a], "__nicescroll") || !1;
                h && (this[this.length] = h, this.length++)
            }
        return this
    };
    (function(e, c, h) {
        for (var l = 0; l < c.length; l++) h(e, c[l])
    })(D.prototype, "show hide toggle onResize resize remove stop doScrollPos".split(" "), function(e, c) {
        e[c] = function() {
            var e = arguments;
            return this.each(function() {
                this[c].apply(this, e)
            })
        }
    });
    e.fn.getNiceScroll =
        function(k) {
            return "undefined" == typeof k ? new D(this) : this[k] && e.data(this[k], "__nicescroll") || !1
        };
    e.extend(e.expr[":"], {
        nicescroll: function(k) {
            return e.data(k, "__nicescroll") ? !0 : !1
        }
    });
    e.fn.niceScroll = function(k, c) {
        "undefined" == typeof c && ("object" == typeof k && !("jquery" in k)) && (c = k, k = !1);
        var h = new D;
        "undefined" == typeof c && (c = {});
        k && (c.doc = e(k), c.win = e(this));
        var l = !("doc" in c);
        !l && !("win" in c) && (c.win = e(this));
        this.each(function() {
            var k = e(this).data("__nicescroll") || !1;
            k || (c.doc = l ? e(this) : c.doc, k = new Q(c,
                e(this)), e(this).data("__nicescroll", k));
            h.push(k)
        });
        return 1 == h.length ? h[0] : h
    };
    window.NiceScroll = {
        getjQuery: function() {
            return e
        }
    };
    e.nicescroll || (e.nicescroll = new D, e.nicescroll.options = I)
})(jQuery);


 /* ====================================================================================================================
 * Nicescroll End
 * ====================================================================================================================*/
 
 
 /* ====================================================================================================================
 * App( Go to top ) Start
 * ====================================================================================================================*/
 
 
 $(function() {
	$(window).scroll(function(){
		var scrolltop=$(this).scrollTop();		
		if(scrolltop>=500){		
			$("#elevator_item").show();
		}else{
			$("#elevator_item").hide();
		}
	});		
	$("#elevator").click(function(){
		$("html,body").animate({scrollTop: 0}, 400);	
	});		
	$(".qr").hover(function(){
		$(".qr-popup").show();
	},function(){
		$(".qr-popup").hide();
	});	
});


/* ====================================================================================================================
 * App( Go to top )End 
 * ====================================================================================================================*/
