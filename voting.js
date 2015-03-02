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

var responses = require(__dirname + '/responses.json');

// Hubot Script
module.exports = function(robot) {
	var votes = {};
	var lastVote = null;
	var onNextConfirmation = null;

	function reply(message, key, data) {
		var response = message.random(responses[key]);
		if (data) {
			Object.keys(data).forEach(function(key) {
				// response = response.replace(':' + key, data[key]);
				response = response.split(':' + key).join(data[key]); // Replace all
			});
		}
		
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

		vote: function(message, heard) {
			var sender = message.message.user.name;
			var username = message.match[1];
			var users = robot.brain.usersForFuzzyName(username);

			// Skip non-matching responses if not directly addressed
			if (true === heard && (1 !== users.length || users[0].name !== username)) {
				return;
			}

			switch (users.length) {
				case 0:
					reply(message, 'cannotFindUser', { name: '@' + username });
					return;

				case 1:
					username = users[0].name;
					lastVote = username;

					// Can't vote for self
					if (username == sender) {
						reply(message, 'votingForSelf');
						return;
					}

					if (!votes[message.message.room]) {
						votes[message.message.room] = {};
					}

					var channelVotes = votes[message.message.room];

					// Are they changing their vote?
					var responseKey = 'votingFor';
					if (channelVotes[sender] && channelVotes[sender] !== username) {
						responseKey = 'changingVoteTo';
					}

					// Save vote
					channelVotes[sender] = username;

					// Get new count
					var votesForUser = 0;
					Object.keys(channelVotes).forEach(function(key) {
						if (channelVotes[key] == username) {
							votesForUser++;
						}
					});
					
					// Reply
					var data = {
						name: '@' + username,
						voteCount: votesForUser,
						pluralizedVotes: 'vote' + (1 == votesForUser ? '' : 's')
					};
					reply(message, responseKey, data);
					return;

				default:
					var matchingNames = users.map(function(user) {
						return '@' + user.name;
					});
					reply(message, 'clarifyVote', { names: matchingNames.join(', ') });
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
					results += '\nIt\'s a tie between @' + winners.join(' and @') + '!';
					break;

				case 3:
					results += '\nÉgalité de trois: @' + winners.join(' + @') + '!';
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

	// Add special case to overhear votes w/o directly being addressed
	triggers.vote.forEach(function(trigger) {
		robot.hear(trigger, function(message) {
			handler.vote(message, true);
		});
	});
};