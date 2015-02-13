'use strict';

var VoteBot = {
	phrases: {
		start: [
			/(start|begin)\s+vot(e|ing)/i
		],
		vote: [
			/(?:i\s+)?vote(?:\s+for)?\s+\@([^\s]+)/i,
			/\@([^\s:]+):?\s*\+\s*\d*/i,
			/\+\s*\d*\s+@([^\s]+)/i
		],
		tally: [
			/tally/i
		],
		confirm: [
			/(yes|yep|sure|ok)/i
		]
	},

	_votes: {},
	_onConfirm: null,
	_bot: null,

	// Bootstrap VoteBot
	bootstrap: function(robot) {
		VoteBot._bot = robot;
		Object.keys(VoteBot.phrases).forEach(function(action) {
			VoteBot.phrases[action].forEach(function(phrase) {
				robot.respond(phrase, VoteBot[action]);
			});
		});
	},

	start: function(message) {
		var startVoting = function(message, done) {
			VoteBot._votes = {};
			message.reply('Got it. New voting started!');
			done && done();
		}

		if (Object.keys(VoteBot._votes).length) {
			VoteBot._onConfirm = startVoting;
			message.reply('Are you sure you want to clear all past votes and start a new poll?');
		} else {
			startVoting(message);
		}
	},

	vote: function(message) {
		var robot = VoteBot._bot;

		var sender = message.message.user.name;
		var username = message.match[1];

		var users = robot.brain.usersForFuzzyName(username);
		switch (users.length) {
			case 0:
				message.reply("I can't find anyone named @" + username);
				return;

			case 1:
				username = users[0].name;

				if (username == sender) {
					message.reply("Bad form, dude.");
					return;
				}

				var votes = VoteBot._votes;
				if (votes[sender] && votes[sender] !== username) {
					message.reply('Changing your vote to @' + username);
				} else {
					message.reply('Got your vote for @' + username);
				}
				votes[sender] = username;
				return;

			default:
				var matchingNames = users.map(function(user) {
					return '@' + user.name;
				});
				message.reply('Could you be a little clearer?  One of: ' + matchingNames.join(', '));
				return;
		}
	},

	tally: function(message) {
		var votes = VoteBot._votes;
		var tally = {};

		// Prepare tally
		Object.keys(votes).forEach(function(voter) {
			var vote = votes[voter];
			if (!tally[vote]) {
				tally[vote] = [];
			}
			tally[vote].push(voter);
		});

		// Sort tally
		var orderedTally = Object.keys(tally);
		orderedTally.sort(function(a, b) {
			return tally[a].length - tally[b].length;
		});

		// Build string
		var winner;
		var results = 'Current results:\n\n';
		orderedTally.forEach(function(username) {
			winner = username;
			var votes = tally[username];
			var count = votes.length;
			results += '   - @' + username + ': ';
			results += count + ' vote' + (1 === count ? '' : 's');
			results += '(voters: ' + votes.join(', ') + ')\n';
		});

		results += '\nWinner: @' + winner;

		message.send(results);
	},

	confirm: function(message) {
		if (VoteBot._onConfirm) {
			return VoteBot._onConfirm(message, function() {
				VoteBot._onConfirm = null;
			});
		}
	}
};


module.exports = function(robot) {
	VoteBot.bootstrap(robot);
};