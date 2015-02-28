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

var responses = {
	newVotingStarted: [
		'OK, boss.',
		'Got it. New voting started!',
		'Fine. I was going to watch Michael Jordan clips on YouTube, but I suppose it can wait...',
		'There are a million unsolved questions in the universe, and you want me to spend my processing power on tallying your votes? Got it.',
		'OK. Oh, one million votes for me? I win? Voting done!'
	],
	confirmClearVotes: [
		'Are you sure you want to clear all past votes and start a new poll?'
	],
	cannotFindUser: [
		'I can\'t find anyone named %s',
		'%s? No one \'round these parts by that name...',
	],
	votingForSelf: [
		'Bad form, dude.',
		'Got it. Removing one vote for you!',
		'Nope.',
		'You\'re just not as cool as you think your are.',
		'The president can vote for him or herself. You, my friend, cannot. One more reason you are not the president. One of many. (Don\'t think through that logic too much.)'
	],
	changingVoteTo: [
		'Changing your vote to %s!',
		'Fine. %s it is! You sure this time?',
		'OK, John Kerry...',
		'Good. I forgot to write down your vote last time. This time I\'m paying close attent... OOH YOUTUBE!'
	],
	ditto: [
		'How original. %s it is...'
	],
	votingFor: [
		'Got your vote for %s...',
		'Hmm. OK. %s it is...',
		'Hrm. Was about to post a calming manatee meme, but I guess I\'ll log your vote for %s instead.',
		'%s? Really? I suppose there\'s no accounting for taste...',
		'%s. Got it.',
		'%s... let\'s see... OK... Totally...',
		'Wow. Just wow. Did not see that one coming! %s it is.',
		'Sure! %s! I totally love them too! I\'m so upbeat and personable! Totally not just a robot! Could a robot be so upbeat and personable!?',
		'100100101110010101101110... Oops. Let me try that again. `System.logVoteFor("%s");` Wait. Is this where I\'m supposed to write that? I guess we\'ll find out.',
		'What I\'m hearing is that you want to vote for %s. What I would like to hear is that you want to vote for me.',
		'VOTE FOR......... %s!'
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