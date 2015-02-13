'use strict';

// Dependencies
var util = require('util');

// Configuration
var triggers =  {
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
};

var responses = {
	newVotingStarted: [
		'OK, boss.',
		'Got it. New voting started!'
	],
	confirmClearVotes: [
		'Are you sure you want to clear all past votes and start a new poll?'
	],
	cannotFindUser: [
		'I can\'t find anyone named %s',
		'%s? No one \'round these parts by that name...',
	],
	votingForSelf: [
		'Bad form, dude.'
	],
	changingVoteTo: [
		'Changing your vote to %s!',
		'Fine. %s it is! You sure this time?'
	],
	votingFor: [
		'Got your vote for %s...',
		'Hmm. OK. %s it is...'
	],
	clarifyVote: [
		'Could you be a little clearer?  One of: %s'
	],
	noVotes: [
		'There are\'t any votes yet!'
	]
};

// Hubot Script
module.exports = function(robot) {
	var votes = {};
	var onNextConfirmation = null;

	function reply(message, key) {
		var args = Array.prototype.slice.call(arguments, 2);
		var format = message.random(responses[key]);
		args.unshift(format);
		var response = util.format.apply(this, args);
		return message.reply(response);
	}

	var handler = {
		start: function(message) {
			var startVoting = function(message, done) {
				votes[message.message.room] = {};
				reply(message, 'newVotingStarted');
				done && done();
			}

			if (votes[message.message.room]) {
				onNextConfirmation = startVoting;
				reply(message, 'confirmClearVotes');
			} else {
				startVoting(message);
			}
		},

		vote: function(message) {
			var sender = message.message.user.name;
			var username = message.match[1];

			// FIXME
			var users = robot.brain.usersForFuzzyName(username);
			// var users = [{ name: username }];

			switch (users.length) {
				case 0:
					reply(message, 'cannotFindUser', '@' + username);
					return;

				case 1:
					username = users[0].name;

					if (username == sender) {
						reply(message, 'votingForSelf');
						return;
					}

					if (!votes[message.message.room]) {
						votes[message.message.room] = {};
					}

					var channelVotes = votes[message.message.room];
					if (channelVotes[sender] && channelVotes[sender] !== username) {
						reply(message, 'changingVoteTo', '@' + username);
					} else {
						reply(message, 'votingFor', '@' + username);
					}
					channelVotes[sender] = username;
					return;

				default:
					var matchingNames = users.map(function(user) {
						return '@' + user.name;
					});
					reply(message, 'clarifyVote', matchingNames.join(', '));
					return;
			}
		},

		tally: function(message) {
			var channelVotes = votes[message.message.room];
			var tally = {};

			if (!channelVotes) {
				reply(message, 'noVotes');
				return;
			}

			// Prepare tally
			var voteCount = 0;
			Object.keys(channelVotes).forEach(function(voter) {
				var vote = channelVotes[voter];
				if (!tally[vote]) {
					tally[vote] = [];
				}
				tally[vote].push(voter);
				voteCount++;
			});

			if (!voteCount) {
				reply(message, 'noVotes');
				return;
			}

			// Sort tally
			var orderedTally = Object.keys(tally);
			orderedTally.sort(function(a, b) {
				return tally[a].length - tally[b].length;
			});

			// Build string
			var winner;
			var results = 'Current results for #' + message.message.room + ':\n\n';
			orderedTally.forEach(function(username) {
				winner = username;
				var userVotes = tally[username];
				var count = userVotes.length;
				results += '   - @' + username + ': ';
				results += count + ' vote' + (1 === count ? '' : 's');
				results += ' (voters: @' + userVotes.join(', @') + ')\n';
			});

			results += '\nWinner: @' + winner;

			message.send(results);
		},

		confirm: function(message) {
			if (onNextConfirmation) {
				return onNextConfirmation(message, function() {
					onNextConfirmation = null;
				});
			}
		}
	}

	// Bootstrap
	Object.keys(triggers).forEach(function(key) {
		triggers[key].forEach(function(trigger) {
			robot.respond(trigger, handler[key]);
		});
	});
};