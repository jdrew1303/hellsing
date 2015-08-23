var fs = require('fs');
var util = require('util');

var logStream = null, start = null;

var pad = function(str, padString, length) {
	str = String(str);

    while (str.length < length) {
        str = padString + str;
	}

    return str;
}

exports.initialize = function() {
	logStream = fs.createWriteStream('./hellsing.log', { flags: 'a' });
	start = Date.now();
};

exports.log = function() {
	var lines = util.format.apply(util, arguments).split('\n');
	var stamp = pad((Date.now() - start) / 1000, ' ', 10);

	for (var i = 0; i < lines.length; i++) {
		logStream.write('[' + stamp + '] ' + lines[i] + '\n');
	}
};

exports.show = function(obj) {
	exports.log(JSON.stringify(obj, null, '\t'));
};

