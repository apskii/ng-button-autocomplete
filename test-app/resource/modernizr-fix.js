var ModernizrFix = function(bootstrapResourcePath) {
	this._bootstrapResourcePath = bootstrapResourcePath;
	this._init();
};

ModernizrFix.prototype = {
	_init: function() {
		if (typeof(Modernizr) == "undefined") {
			throw new Error('Modernizr library is not plugging.');
		}
		if (this._bootstrapResourcePath.toString().lastIndexOf('/') != (this._bootstrapResourcePath.length - 1)) {
			this._bootstrapResourcePath += '/';
		}
	},
	fix: function() {
		this.fixNavBorderRadius();
		this.fixTableStriped();
		this.fixjQueryTabsBorderRadius();
	},

	fixNavBorderRadius: function() {
		if (!Modernizr.borderradius) {
			$('.nav').css({ position: 'relative', zIndex: 10 });
			$('.nav > li > a').css({ behavior: 'url(' + this._bootstrapResourcePath + 'PIE.htc)' });
		}
	},

	fixNavTabsBorderRadius: function() {
		if (!Modernizr.borderradius) {
			$('.nav.nav-tabs').css({ position: 'relative', zIndex: 10 });
			$('.nav-tabs > li > a').css({ behavior: 'url(' + this._bootstrapResourcePath + 'PIE.htc)' });

		}
	},
	
	fixjQueryTabsBorderRadius: function () {
		if (!Modernizr.borderradius) {
			//$('.ui-tabs > .ui-tabs-nav').css({ position: 'relative', zIndex: 10 });
			$('.ui-tabs > .ui-tabs-nav > li').css({ behavior: 'url(' + this._bootstrapResourcePath + 'PIE.htc)' });
		}
	},

	fixNavPillsBorderRadius: function() {
		if (!Modernizr.borderradius) {
			$('.nav.nav-pills').css({ position: 'relative', zIndex: 10 });
			$('.nav-pills > li > a').css({ behavior: 'url(' + this._bootstrapResourcePath + 'PIE.htc)' });
		}
	},
	
	fixTableStriped: function() {
		$('.table-striped tbody > tr:nth-child(odd)').css({ backgroundColor: '#EFEFEF' });
	}
};