// <nowiki>


(function($) {


/*
 ****************************************
 *** twinklefluff.js: Revert/rollback module
 ****************************************
 * Mode of invocation:     Links on history, contributions, and diff pages
 * Active on:              Diff pages, history pages, contributions pages
 */

/**
 Twinklefluff revert and antivandalism utility
 */

TwinkleGlobal.fluff = function twinklefluff() {
	var disabledWikis = $.map(TwinkleGlobal.getPref('fluffDisabledWikis'), function(el) {
		return el.value.trim();
	});

	if (disabledWikis.indexOf(mw.config.get('wgDBname')) !== -1) {
		return;
	}

	// A list of usernames, usually only bots, that vandalism revert is jumped over; that is,
	// if vandalism revert was chosen on such username, then its target is on the revision before.
	// This is for handling quick bots that makes edits seconds after the original edit is made.
	// This only affects vandalism rollback; for good faith rollback, it will stop, indicating a bot
	// has no faith, and for normal rollback, it will rollback that edit.
	TwinkleGlobal.fluff.whiteList = [
		'AnomieBOT',
		'SineBot'
	];

	if (mw.util.getParamValue('twinklerevert')) {
		// Return if the user can't edit the page in question
		if (!mw.config.get('wgIsProbablyEditable')) {
			alert("Unable to edit the page, it's probably protected.");
		} else {
			TwinkleGlobal.fluff.auto();
		}
	} else if (mw.config.get('wgCanonicalSpecialPageName') === 'Contributions') {
		TwinkleGlobal.fluff.addLinks.contributions();
	} else if (mw.config.get('wgIsProbablyEditable')) {
		// Only proceed if the user can actually edit the page
		// in question (ignored for contributions, see #632).
		// wgIsProbablyEditable should take care of
		// namespace/contentModel restrictions as well as
		// explicit protections; it won't take care of
		// cascading or TitleBlacklist restrictions
		if (mw.config.get('wgDiffNewId') || mw.config.get('wgDiffOldId')) { // wgDiffOldId included for clarity in if else loop [[phab:T214985]]
			mw.hook('wikipage.diff').add(function () { // Reload alongside the revision slider
				TwinkleGlobal.fluff.addLinks.diff();
			});
		} else if (mw.config.get('wgAction') === 'view' && mw.config.get('wgCurRevisionId') !== mw.config.get('wgRevisionId')) {
			TwinkleGlobal.fluff.addLinks.oldid();
		}
	}
};


TwinkleGlobal.fluff.spanTag = function twinklefluffspanTag(color, content) {
	var span = document.createElement('span');
	span.style.color = color;
	span.appendChild(document.createTextNode(content));
	return span;
};

TwinkleGlobal.fluff.buildLink = function twinklefluffbuildLink(color, text) {
	var link = document.createElement('a');
	link.appendChild(TwinkleGlobal.fluff.spanTag('Black', '['));
	link.appendChild(TwinkleGlobal.fluff.spanTag(color, text));
	link.appendChild(TwinkleGlobal.fluff.spanTag('Black', ']'));
	return link;
};

// Build [restore this revision] links
TwinkleGlobal.fluff.restoreThisRevision = function (element, revType) {
	var revertToRevision = document.createElement('div');
	revertToRevision.setAttribute('id', 'tw-revert-to-' + (revType === 'wgDiffNewId' ? 'n' : 'o') + 'revision');
	revertToRevision.style.fontWeight = 'bold';

	var revertToRevisionLink = TwinkleGlobal.fluff.buildLink('SaddleBrown', 'restore this version');
	revertToRevisionLink.href = '#';
	$(revertToRevisionLink).click(function() {
		TwinkleGlobal.fluff.revertToRevision(mw.config.get(revType).toString());
	});
	revertToRevision.appendChild(revertToRevisionLink);

	var title = document.getElementById(element).parentNode;
	title.insertBefore(revertToRevision, title.firstChild);
};


TwinkleGlobal.fluff.auto = function twinklefluffauto() {
	if (mw.config.get('wgRevisionId') !== mw.config.get('wgCurRevisionId')) {
		// not latest revision
		alert("Can't rollback, page has changed in the meantime.");
		return;
	}

	var vandal = $('#mw-diff-ntitle2').find('a.mw-userlink').text();

	TwinkleGlobal.fluff.revert(mw.util.getParamValue('twinklerevert'), vandal, true);
};

TwinkleGlobal.fluff.addLinks = {
	contributions: function() {
		// $('sp-contributions-footer-anon-range') relies on the fmbox
		// id in [[MediaWiki:Sp-contributions-footer-anon-range]] and
		// is used to show rollback/vandalism links for IP ranges
		if (mw.config.exists('wgRelevantUserName') || !!$('#sp-contributions-footer-anon-range')[0]) {
			// Get the username these contributions are for
			var username = mw.config.get('wgRelevantUserName');
			if (TwinkleGlobal.getPref('showRollbackLinks').indexOf('contribs') !== -1 ||
				(mw.config.get('wgUserName') !== username && TwinkleGlobal.getPref('showRollbackLinks').indexOf('others') !== -1) ||
				(mw.config.get('wgUserName') === username && TwinkleGlobal.getPref('showRollbackLinks').indexOf('mine') !== -1)) {
				var list = $('#mw-content-text').find('ul li:has(span.mw-uctop):has(.mw-changeslist-diff)');

				var revNode = document.createElement('strong');
				var revLink = TwinkleGlobal.fluff.buildLink('SteelBlue', 'rollback');
				revNode.appendChild(revLink);

				var revVandNode = document.createElement('strong');
				var revVandLink = TwinkleGlobal.fluff.buildLink('Red', 'vandalism');
				revVandNode.appendChild(revVandLink);

				list.each(function(key, current) {
					var href = $(current).find('.mw-changeslist-diff').attr('href');
					current.appendChild(document.createTextNode(' '));
					var tmpNode = revNode.cloneNode(true);
					tmpNode.firstChild.setAttribute('href', href + '&twinklerevert=norm');
					current.appendChild(tmpNode);
					current.appendChild(document.createTextNode(' '));
					tmpNode = revVandNode.cloneNode(true);
					tmpNode.firstChild.setAttribute('href', href + '&twinklerevert=vand');
					current.appendChild(tmpNode);
				});
			}
		}
	},

	diff: function() {
		// Autofill user talk links on diffs with vanarticle for easy warning, but don't autowarn
		var warnFromTalk = function(xtitle) {
			var talkLink = $('#mw-diff-' + xtitle + '2 .mw-usertoollinks a').first();
			if (talkLink.length) {
				var extraParams = 'vanarticle=' + mw.util.rawurlencode(MorebitsGlobal.pageNameNorm) + '&' + 'noautowarn=true';
				// diffIDs for vanarticlerevid
				extraParams += '&vanarticlerevid=';
				extraParams += xtitle === 'otitle' ? mw.config.get('wgDiffOldId') : mw.config.get('wgDiffNewId');

				var href = talkLink.attr('href');
				if (href.indexOf('?') === -1) {
					talkLink.attr('href', href + '?' + extraParams);
				} else {
					talkLink.attr('href', href + '&' + extraParams);
				}
			}
		};

		// Older revision
		warnFromTalk('otitle'); // Add quick-warn link to user talk link
		// Don't load if there's a single revision or weird diff (cur on latest)
		if (mw.config.get('wgDiffOldId') && (mw.config.get('wgDiffOldId') !== mw.config.get('wgDiffNewId'))) {
			// Add a [restore this revision] link to the older revision
			TwinkleGlobal.fluff.restoreThisRevision('mw-diff-otitle1', 'wgDiffOldId');
		}

		// Newer revision
		warnFromTalk('ntitle'); // Add quick-warn link to user talk link
		// Add either restore or rollback links to the newer revision
		// Don't show if there's a single revision or weird diff (prev on first)
		if (document.getElementById('differences-nextlink')) {
			// Not latest revision, add [restore this revision] link to newer revision
			TwinkleGlobal.fluff.restoreThisRevision('mw-diff-ntitle1', 'wgDiffNewId');
		} else if (TwinkleGlobal.getPref('showRollbackLinks').indexOf('diff') !== -1 && mw.config.get('wgDiffOldId') && (mw.config.get('wgDiffOldId') !== mw.config.get('wgDiffNewId') || document.getElementById('differences-prevlink'))) {
			var vandal = $('#mw-diff-ntitle2').find('a').first().text();

			var revertNode = document.createElement('div');
			revertNode.setAttribute('id', 'twg-revert');

			var agfNode = document.createElement('strong');
			var vandNode = document.createElement('strong');
			var normNode = document.createElement('strong');

			var agfLink = TwinkleGlobal.fluff.buildLink('DarkOliveGreen', 'rollback (AGF)');
			var vandLink = TwinkleGlobal.fluff.buildLink('Red', 'rollback (VANDAL)');
			var normLink = TwinkleGlobal.fluff.buildLink('SteelBlue', 'rollback');

			agfLink.href = '#';
			vandLink.href = '#';
			normLink.href = '#';
			$(agfLink).click(function() {
				TwinkleGlobal.fluff.revert('agf', vandal);
			});
			$(vandLink).click(function() {
				TwinkleGlobal.fluff.revert('vand', vandal);
			});
			$(normLink).click(function() {
				TwinkleGlobal.fluff.revert('norm', vandal);
			});

			agfNode.appendChild(agfLink);
			vandNode.appendChild(vandLink);
			normNode.appendChild(normLink);

			revertNode.appendChild(agfNode);
			revertNode.appendChild(document.createTextNode(' || '));
			revertNode.appendChild(normNode);
			revertNode.appendChild(document.createTextNode(' || '));
			revertNode.appendChild(vandNode);

			var ntitle = document.getElementById('mw-diff-ntitle1').parentNode;
			ntitle.insertBefore(revertNode, ntitle.firstChild);
		}
	},

	oldid: function() { // Add a [restore this revision] link on old revisions
		TwinkleGlobal.fluff.restoreThisRevision('mw-revision-info', 'wgRevisionId');
	}
};


TwinkleGlobal.fluff.revert = function revertPage(type, vandal, autoRevert, rev, page) {
	if (mw.util.isIPv6Address(vandal)) {
		vandal = MorebitsGlobal.sanitizeIPv6(vandal);
	}

	var pagename = page || mw.config.get('wgPageName');
	var revid = rev || mw.config.get('wgCurRevisionId');

	MorebitsGlobal.status.init(document.getElementById('mw-content-text'));
	$('#catlinks').remove();

	var params = {
		type: type,
		user: vandal,
		pagename: pagename,
		revid: revid,
		autoRevert: !!autoRevert
	};
	var query = {
		'action': 'query',
		'prop': ['info', 'revisions', 'flagged'],
		'titles': pagename,
		'rvlimit': 50, // max possible
		'rvprop': [ 'ids', 'timestamp', 'user', 'comment' ],
		'intoken': 'edit'
	};
	var wikipedia_api = new MorebitsGlobal.wiki.api('Grabbing data of earlier revisions', query, TwinkleGlobal.fluff.callbacks.main);
	wikipedia_api.params = params;
	wikipedia_api.post();
};

TwinkleGlobal.fluff.revertToRevision = function revertToRevision(oldrev) {

	MorebitsGlobal.status.init(document.getElementById('mw-content-text'));

	var query = {
		'action': 'query',
		'prop': ['info', 'revisions'],
		'titles': mw.config.get('wgPageName'),
		'rvlimit': 1,
		'rvstartid': oldrev,
		'rvprop': [ 'ids', 'timestamp', 'user', 'comment' ],
		'intoken': 'edit',
		'format': 'xml'
	};
	var wikipedia_api = new MorebitsGlobal.wiki.api('Grabbing data of the earlier revision', query, TwinkleGlobal.fluff.callbacks.toRevision.main);
	wikipedia_api.params = { rev: oldrev };
	wikipedia_api.post();
};

TwinkleGlobal.fluff.userIpLink = function(user) {
	return (mw.util.isIPAddress(user) ? '[[Special:Contributions/' : '[[:User:') + user + '|' + user + ']]';
};

TwinkleGlobal.fluff.callbacks = {
	toRevision: {
		main: function(self) {
			var xmlDoc = self.responseXML;

			var lastrevid = parseInt($(xmlDoc).find('page').attr('lastrevid'), 10);
			var touched = $(xmlDoc).find('page').attr('touched');
			var starttimestamp = $(xmlDoc).find('page').attr('starttimestamp');
			var edittoken = $(xmlDoc).find('page').attr('edittoken');
			var revertToRevID = $(xmlDoc).find('rev').attr('revid');
			var revertToUser = $(xmlDoc).find('rev').attr('user');

			if (revertToRevID !== self.params.rev) {
				self.statitem.error('The retrieved revision does not match the requested revision. Stopping revert.');
				return;
			}

			var optional_summary = prompt('Please specify a reason for the revert:                                ', '');  // padded out to widen prompt in Firefox
			if (optional_summary === null) {
				self.statelem.error('Aborted by user.');
				return;
			}
			var summary = TwinkleGlobal.fluff.formatSummary('Reverted to revision ' + revertToRevID + ' by $USER', revertToUser, optional_summary);

			var query = {
				'action': 'edit',
				'title': mw.config.get('wgPageName'),
				'summary': summary,
				'token': edittoken,
				'undo': lastrevid,
				'undoafter': revertToRevID,
				'basetimestamp': touched,
				'starttimestamp': starttimestamp,
				'watchlist': TwinkleGlobal.getPref('watchRevertedPages').indexOf('torev') !== -1 ? 'watch' : undefined,
				'minor': TwinkleGlobal.getPref('markRevertedPagesAsMinor').indexOf('torev') !== -1 ? true : undefined
			};

			MorebitsGlobal.wiki.actionCompleted.redirect = mw.config.get('wgPageName');
			MorebitsGlobal.wiki.actionCompleted.notice = 'Reversion completed';

			var wikipedia_api = new MorebitsGlobal.wiki.api('Saving reverted contents', query, TwinkleGlobal.fluff.callbacks.complete, self.statelem);
			wikipedia_api.params = self.params;
			wikipedia_api.post();

		}
	},
	main: function(self) {
		var xmlDoc = self.responseXML;

		var lastrevid = parseInt($(xmlDoc).find('page').attr('lastrevid'), 10);
		var touched = $(xmlDoc).find('page').attr('touched');
		var starttimestamp = $(xmlDoc).find('page').attr('starttimestamp');
		var edittoken = $(xmlDoc).find('page').attr('edittoken');
		var lastuser = $(xmlDoc).find('rev').attr('user');

		var revs = $(xmlDoc).find('rev');

		if (revs.length < 1) {
			self.statelem.error('We have less than one additional revision, thus impossible to revert.');
			return;
		}
		var top = revs[0];
		if (lastrevid < self.params.revid) {
			MorebitsGlobal.status.error('Error', [ 'The most recent revision ID received from the server, ', MorebitsGlobal.htmlNode('strong', lastrevid), ', is less than the ID of the displayed revision. This could indicate that the current revision has been deleted, the server is lagging, or that bad data has been received. Stopping revert.' ]);
			return;
		}
		var index = 1;
		if (self.params.revid !== lastrevid) {
			MorebitsGlobal.status.warn('Warning', [ 'Latest revision ', MorebitsGlobal.htmlNode('strong', lastrevid), ' doesn\'t equal our revision ', MorebitsGlobal.htmlNode('strong', self.params.revid) ]);
			if (lastuser === self.params.user) {
				switch (self.params.type) {
					case 'vand':
						MorebitsGlobal.status.info('Info', [ 'Latest revision was made by ', MorebitsGlobal.htmlNode('strong', self.params.user), '. As we assume vandalism, we will proceed to revert.' ]);
						break;
					case 'agf':
						MorebitsGlobal.status.warn('Warning', [ 'Latest revision was made by ', MorebitsGlobal.htmlNode('strong', self.params.user), '. As we assume good faith, we will stop the revert, as the problem might have been fixed.' ]);
						return;
					default:
						MorebitsGlobal.status.warn('Notice', [ 'Latest revision was made by ', MorebitsGlobal.htmlNode('strong', self.params.user), ', but we will stop the revert.' ]);
						return;
				}
			} else if (self.params.type === 'vand' &&
					TwinkleGlobal.fluff.whiteList.indexOf(top.getAttribute('user')) !== -1 && revs.length > 1 &&
					revs[1].getAttribute('pageId') === self.params.revid) {
				MorebitsGlobal.status.info('Info', [ 'Latest revision was made by ', MorebitsGlobal.htmlNode('strong', lastuser), ', a trusted bot, and the revision before was made by our vandal, so we will proceed with the revert.' ]);
				index = 2;
			} else {
				MorebitsGlobal.status.error('Error', [ 'Latest revision was made by ', MorebitsGlobal.htmlNode('strong', lastuser), ', so it might have already been reverted, we will stop the revert.']);
				return;
			}

		}

		if (TwinkleGlobal.fluff.whiteList.indexOf(self.params.user) !== -1) {
			switch (self.params.type) {
				case 'vand':
					MorebitsGlobal.status.info('Info', [ 'Vandalism revert was chosen on ', MorebitsGlobal.htmlNode('strong', self.params.user), '. As this is a whitelisted bot, we assume you wanted to revert vandalism made by the previous user instead.' ]);
					index = 2;
					self.params.user = revs[1].getAttribute('user');
					break;
				case 'agf':
					MorebitsGlobal.status.warn('Notice', [ 'Good faith revert was chosen on ', MorebitsGlobal.htmlNode('strong', self.params.user), '. This is a whitelisted bot and thus AGF rollback will not proceed.' ]);
					return;
				case 'norm':
				/* falls through */
				default:
					var cont = confirm('Normal revert was chosen, but the most recent edit was made by a whitelisted bot (' + self.params.user + '). Do you want to revert the revision before instead?');
					if (cont) {
						MorebitsGlobal.status.info('Info', [ 'Normal revert was chosen on ', MorebitsGlobal.htmlNode('strong', self.params.user), '. This is a whitelisted bot, and per confirmation, we\'ll revert the previous revision instead.' ]);
						index = 2;
						self.params.user = revs[1].getAttribute('user');
					} else {
						MorebitsGlobal.status.warn('Notice', [ 'Normal revert was chosen on ', MorebitsGlobal.htmlNode('strong', self.params.user), '. This is a whitelisted bot, but per confirmation, revert on selected revision will proceed.' ]);
					}
					break;
			}
		}
		var found = false;
		var count = 0;

		for (var i = index; i < revs.length; ++i) {
			++count;
			if (revs[i].getAttribute('user') !== self.params.user) {
				found = i;
				break;
			}
		}

		if (!found) {
			self.statelem.error([ 'No previous revision found. Perhaps ', MorebitsGlobal.htmlNode('strong', self.params.user), ' is the only contributor, or that the user has made more than ' + TwinkleGlobal.getPref('revertMaxRevisions') + ' edits in a row.' ]);
			return;
		}

		if (!count) {
			MorebitsGlobal.status.error('Error', 'As it is not possible to revert zero revisions, we will stop this revert. It could be that the edit has already been reverted, but the revision ID was still the same.');
			return;
		}

		var good_revision = revs[found];
		var userHasAlreadyConfirmedAction = false;
		if (self.params.type !== 'vand' && count > 1) {
			if (!confirm(self.params.user + ' has made ' + count + ' edits in a row. Are you sure you want to revert them all?')) {
				MorebitsGlobal.status.info('Notice', 'Stopping revert.');
				return;
			}
			userHasAlreadyConfirmedAction = true;
		}

		self.params.count = count;

		self.params.goodid = good_revision.getAttribute('revid');
		self.params.gooduser = good_revision.getAttribute('user');

		self.statelem.status([ ' revision ', MorebitsGlobal.htmlNode('strong', self.params.goodid), ' that was made ', MorebitsGlobal.htmlNode('strong', count), ' revisions ago by ', MorebitsGlobal.htmlNode('strong', self.params.gooduser) ]);

		var summary, extra_summary;
		switch (self.params.type) {
			case 'agf':
				extra_summary = prompt('An optional comment for the edit summary:                              ', '');  // padded out to widen prompt in Firefox
				if (extra_summary === null) {
					self.statelem.error('Aborted by user.');
					return;
				}
				userHasAlreadyConfirmedAction = true;

				summary = TwinkleGlobal.fluff.formatSummary('Reverted good faith edits by $USER', self.params.user, extra_summary);
				break;

			case 'vand':

				summary = 'Reverted ' + self.params.count + (self.params.count > 1 ? ' edits' : ' edit') + ' by [[Special:Contributions/' +
				self.params.user + '|' + self.params.user + ']] ([[User talk:' + self.params.user + '|talk]]) to last revision by ' +
				self.params.gooduser + TwinkleGlobal.getPref('summaryAd');
				break;

			case 'norm':
			/* falls through */
			default:
				if (TwinkleGlobal.getPref('offerReasonOnNormalRevert')) {
					extra_summary = prompt('An optional comment for the edit summary:                              ', '');  // padded out to widen prompt in Firefox
					if (extra_summary === null) {
						self.statelem.error('Aborted by user.');
						return;
					}
					userHasAlreadyConfirmedAction = true;
				}

				summary = TwinkleGlobal.fluff.formatSummary('Reverted ' + self.params.count + (self.params.count > 1 ? ' edits' : ' edit') +
				' by $USER', self.params.user, extra_summary);
				break;
		}

		if (TwinkleGlobal.getPref('confirmOnFluff') && !userHasAlreadyConfirmedAction && !confirm('Reverting page: are you sure?')) {
			self.statelem.error('Aborted by user.');
			return;
		}

		var query;
		if ((!self.params.autoRevert || TwinkleGlobal.getPref('openTalkPageOnAutoRevert')) &&
				TwinkleGlobal.getPref('openTalkPage').indexOf(self.params.type) !== -1 &&
				mw.config.get('wgUserName') !== self.params.user) {
			MorebitsGlobal.status.info('Info', [ 'Opening user talk page edit form for user ', MorebitsGlobal.htmlNode('strong', self.params.user) ]);

			query = {
				'title': 'User talk:' + self.params.user,
				'action': 'edit',
				'preview': 'yes',
				'vanarticle': self.params.pagename.replace(/_/g, ' '),
				'vanarticlerevid': self.params.revid,
				'vanarticlegoodrevid': self.params.goodid,
				'type': self.params.type,
				'count': self.params.count
			};

			switch (TwinkleGlobal.getPref('userTalkPageMode')) {
				case 'tab':
					window.open(mw.util.getUrl('', query), '_blank');
					break;
				case 'blank':
					window.open(mw.util.getUrl('', query), '_blank',
						'location=no,toolbar=no,status=no,directories=no,scrollbars=yes,width=1200,height=800');
					break;
				case 'window':
				/* falls through */
				default:
					window.open(mw.util.getUrl('', query),
						window.name === 'twinklewarnwindow' ? '_blank' : 'twinklewarnwindow',
						'location=no,toolbar=no,status=no,directories=no,scrollbars=yes,width=1200,height=800');
					break;
			}
		}

		// figure out whether we need to/can review the edit
		var $flagged = $(xmlDoc).find('flagged');
		if ((MorebitsGlobal.userIsInGroup('reviewer') || MorebitsGlobal.userIsSysop) &&
				$flagged.length &&
				$flagged.attr('stable_revid') >= self.params.goodid &&
				$flagged.attr('pending_since')) {
			self.params.reviewRevert = true;
			self.params.edittoken = edittoken;
		}

		query = {
			'action': 'edit',
			'title': self.params.pagename,
			'summary': summary,
			'token': edittoken,
			'undo': lastrevid,
			'undoafter': self.params.goodid,
			'basetimestamp': touched,
			'starttimestamp': starttimestamp,
			'watchlist': TwinkleGlobal.getPref('watchRevertedPages').indexOf(self.params.type) !== -1 ? 'watch' : undefined,
			'minor': TwinkleGlobal.getPref('markRevertedPagesAsMinor').indexOf(self.params.type) !== -1 ? true : undefined
		};

		MorebitsGlobal.wiki.actionCompleted.redirect = self.params.pagename;
		MorebitsGlobal.wiki.actionCompleted.notice = 'Reversion completed';

		var wikipedia_api = new MorebitsGlobal.wiki.api('Saving reverted contents', query, TwinkleGlobal.fluff.callbacks.complete, self.statelem);
		wikipedia_api.params = self.params;
		wikipedia_api.post();

	},
	complete: function (apiobj) {
		// TODO Most of this is copy-pasted from MorebitsGlobal.wiki.page#fnSaveSuccess. Unify it
		var xml = apiobj.getXML();
		var $edit = $(xml).find('edit');

		if ($(xml).find('captcha').length > 0) {
			apiobj.statelem.error('Could not rollback, because the wiki server wanted you to fill out a CAPTCHA.');
		} else if ($edit.attr('nochange') === '') {
			apiobj.statelem.warn('Revision we are reverting to is identical to current revision, stopping revert.');
		} else {
			apiobj.statelem.info('done');

			// review the revert, if needed
			if (apiobj.params.reviewRevert) {
				var query = {
					'action': 'review',
					'revid': $edit.attr('newrevid'),
					'token': apiobj.params.edittoken,
					'comment': TwinkleGlobal.getPref('summaryAd').trim()
				};
				var wikipedia_api = new MorebitsGlobal.wiki.api('Automatically accepting your changes', query);
				wikipedia_api.post();
			}
		}
	}
};

// builtInString should contain the string "$USER", which will be replaced
// by an appropriate user link
TwinkleGlobal.fluff.formatSummary = function(builtInString, userName, userString) {
	var result = builtInString;

	// append user's custom reason
	if (userString) {
		result += ': ' + MorebitsGlobal.string.toUpperCaseFirstChar(userString);
	}
	result += TwinkleGlobal.getPref('summaryAd');

	// find number of UTF-8 bytes the resulting string takes up, and possibly add
	// a contributions or contributions+talk link if it doesn't push the edit summary
	// over the 255-byte limit
	var resultLen = unescape(encodeURIComponent(result.replace('$USER', ''))).length;
	var contribsLink = '[[Special:Contributions/' + userName + '|' + userName + ']]';
	var contribsLen = unescape(encodeURIComponent(contribsLink)).length;
	if (resultLen + contribsLen <= 255) {
		var talkLink = ' ([[User talk:' + userName + '|talk]])';
		if (resultLen + contribsLen + unescape(encodeURIComponent(talkLink)).length <= 255) {
			result = MorebitsGlobal.string.safeReplace(result, '$USER', contribsLink + talkLink);
		} else {
			result = MorebitsGlobal.string.safeReplace(result, '$USER', contribsLink);
		}
	} else {
		result = MorebitsGlobal.string.safeReplace(result, '$USER', userName);
	}

	return result;
};
})(jQuery);


// </nowiki>
