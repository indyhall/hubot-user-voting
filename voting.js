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
		/\+\s*\d*\s+@([^\s]+)/i,
		/change\s+(?:mine|(?:my\s+)?vote)(?:\s+to)?\s+\@([^\s]+)/i
	],
	ditto: [
		/(me (too|also)|same here)/i
	],
	tally: [
		/tally/i
	],
	confirm: [
		/(yes|yep|sure|ok)/i
	]
};

var responses = require('responses.json');

// Hubot Script
module.exports = function(robot) {
	var votes = {};
	var lastVote = null;
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
			var users = robot.brain.usersForFuzzyName(username);

			switch (users.length) {
				case 0:
					reply(message, 'cannotFindUser', '@' + username);
					return;

				case 1:
					username = users[0].name;
					lastVote = username;

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

		ditto: function(message) {
			// FIXME
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
			var previousCount = 0;
			var winners = [];
			var results = 'Current results for #' + message.message.room + ':\n\n';
			orderedTally.forEach(function(username) {
				var userVotes = tally[username];
				var count = userVotes.length;

				if (count !== previousCount) {
					winners = [];
				}
				
				winners.push(username);
				previousCount = count;

				// Add to results string
				results += '   • @' + username + ': ';
				results += count + ' vote' + (1 === count ? '' : 's');
				results += ' (voters: @' + userVotes.join(', @') + ')\n';
			});

			// Winner
			switch (winners.length) {
				case 1:
					results += '\nWinner: @' + winners[0];
					break;

				case 2:
					results += '\nIt\'s a tie! @' + winners.join(' and @');
					break;

				case 3:
					results += '\nÉgalité de trois! @' + winners.join(' + @');
					break;

				default:
					results += '\nY\'all can\'t make up your damn minds.';
					break;
			}

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