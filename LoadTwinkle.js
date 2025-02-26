/**
 * Forked from https://zh.wikipedia.org/w/index.php?oldid=45972864
 * @see [[User:Xiplus/TwinkleGlobal]]
 * @author [[User:逆襲的天邪鬼]]
 * @author [[User:Xiplus]]
 * @author [[User:WhitePhosphorus]]
 */

(function() {

var VERSION = '{{subst:#time:Y-m-d H:i:s}}';
var PREFIX = 'User:Xiplus/TwinkleGlobal/';
var rebuildcache = localStorage.Twinkle_global_xiplus_version !== VERSION;
var tests = [];
var api;

var ajax = function(title) {
	return api.get({
		action: 'query',
		format: 'json',
		prop: 'revisions',
		titles: title,
		rvprop: 'content'
	}).then(function(data) {
		for (var key in data.query.pages) { // eslint-disable-line guard-for-in, no-unreachable-loop
			return data.query.pages[key].revisions[0]['*'];
		}
	});
};

var load = function(p) {
	var done = function(data) {
		if (rebuildcache || !localStorage['Twinkle_global_xiplus_' + p.name]) {
			localStorage['Twinkle_global_xiplus_' + p.name] = data;
		}
	};
	if (localStorage['Twinkle_global_xiplus_' + p.name] && !rebuildcache) {
		return $.Deferred().resolve(localStorage['Twinkle_global_xiplus_' + p.name]);
	}
	if (p.test) {
		return ajax(PREFIX + p.name).done(done);
	}
	return ajax('MediaWiki:Gadget-' + p.name).done(done);
};

var message = function(text) {
	console.log('[Twinkle_global_xiplus]', text);  // eslint-disable-line no-console
	//    $('#simpleSearch input[type="search"]').attr('placeHolder', text);
};

tests.push({ name: 'morebits.js', test: true });
tests.push({ name: 'twinkle.js', test: true });
tests.push({ name: 'twinklearv.js', test: true });
// tests.push({name: 'twinklewarn.js',          test: true});
// tests.push({name: 'friendlyshared.js',       test: true});
// tests.push({name: 'friendlytag.js',          test: true});
// tests.push({name: 'friendlytalkback.js',     test: true});
// tests.push({name: 'twinklebatchdelete.js',   test: true});
// tests.push({name: 'twinklebatchundelete.js', test: true});
// tests.push({name: 'twinkleblock.js',         test: true});
// tests.push({name: 'twinkleclose.js',         test: true});
tests.push({ name: 'twinkleconfig.js', test: true });
// tests.push({name: 'twinklecopyvio.js',       test: true});
// tests.push({name: 'twinkledelimages.js',     test: true});
tests.push({ name: 'twinklediff.js', test: true });
tests.push({ name: 'twinklefluff.js', test: true });
// tests.push({name: 'twinkleimage.js',         test: true});
// tests.push({name: 'twinkleprotect.js',       test: true});
tests.push({ name: 'twinklespeedy.js', test: true });
// tests.push({name: 'twinklestub.js',          test: true});
// tests.push({name: 'twinkleunlink.js',        test: true});
// tests.push({name: 'twinklexfd.js',           test: true});


function main() {
	if (mw.config.get('wgServer') === '//meta.wikimedia.org') {
		api = new mw.Api();
	} else {
		api = new mw.ForeignApi('https://meta.wikimedia.org/w/api.php');
	}

	mw.loader.load('https://meta.wikimedia.org/w/index.php?title=User:Xiplus/TwinkleGlobal/morebits.css&action=raw&ctype=text/css', 'text/css');
	mw.loader.load('https://meta.wikimedia.org/w/index.php?title=User:Xiplus/TwinkleGlobal/twinkle.css&action=raw&ctype=text/css', 'text/css');

	var finished = 0;
	var code = [];

	// all
	message('Loading Twinkle_global_xiplus...');
	var done = function(x) {
		return function(data) {
			finished++;
			message('Loading Twinkle_global_xiplus... (' + finished + '/' + tests.length + ')');
			code[x] = data;
			if (x === tests.length - 1) {
				localStorage.Twinkle_global_xiplus_version = VERSION;
				try {
					eval(code.join('\n;\n'));
					message('Twinkle Done');
				} catch (e) {
					mw.notify('Error loading Twinkle: ' + e, {type: 'error'});
				}
				if ($('#twinkleglobal-config-titlebar').length) {
					$('#twinkleglobal-config-titlebar').append('--Version: Xiplus ' + localStorage.Twinkle_global_xiplus_version);
					$('#twinkleglobal-config-titlebar').append('<button onclick="localStorage.Twinkle_global_xiplus_version =       \'\';location.reload();">Purge</button>');
				}
			} else {
				load(tests[x + 1]).done(done(x + 1));
			}
		};
	};
	load(tests[0]).done(done(0));
}

mw.loader.using(['mediawiki.user', 'mediawiki.util', 'mediawiki.Title', 'jquery.ui', 'jquery.tipsy', 'mediawiki.api', 'mediawiki.ForeignApi']).done(function() {
	main();
});

})();
