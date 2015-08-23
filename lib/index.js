var heapdump = require('heapdump');
var memwatch = require('memwatch-next');
var gcprofiler = require('gc-profiler');
var humanSize = require('human-size');
var pkg = require('../package');

var logger = require('./logger');
var currentDiff = null;
var gcScheduled = null;

var initDiff = function() {
	if (!currentDiff) {
		currentDiff = new memwatch.HeapDiff();
	}
}

var finishDiff = function() {
	if (!currentDiff) {
		return null;
	}

	var diff = currentDiff.end();

	currentDiff = new memwatch.HeapDiff();

	return diff;
};

var performDiff = function() {
	var diff = finishDiff();

	if (!diff) {
		return null;
	}

	logger.log('diff:')
	logger.log('\tbefore = %s, after = %s', diff.before.size, diff.after.size);
	logger.log('\tallocated nodes = %s', diff.change.allocated_nodes);

	var trending = diff.change.details.sort(function(a, b) {
		return (a['+'] - a['-']) - (b['+'] - b['-']);
	});

	if (trending.length > 0 && trending[0].size_bytes > 0) {
		logger.log('\ttrending object: %s, increased by %s(%s allocations)', trending[0].what, trending[0].size, trending[0]['+']);
	}
};

var writeDump = function(type) {
	heapdump.writeSnapshot('./hellsing-' + type + '-' + Date.now() + '.heapsnapshot');
};

var scheduleGcAndDiff = function() {
	if (!gcScheduled) {
		gcScheduled = setTimeout(function() {
			gcScheduled = null;

			writeDump('pregc');
			exports.gc();
			writeDump('postgc');

			performDiff();
		}, 5000);
	}
};

logger.initialize();

logger.log();
logger.log('hellsing %s - node %s - v8 %s', pkg.version, process.versions.node, process.versions.v8);
logger.log();

memwatch.on('leak', function(info) {
	logger.log('leak detected:');
	logger.show(info);
});

memwatch.on('stats', function(stats) {
	logger.log('gc stats:');
	logger.log('\tfull gc count: %s', stats.num_full_gc);
	logger.log('\tinc gc count: %s', stats.num_inc_gc);
	logger.log('\tusage trend: %s', stats.usage_trend);

	performDiff();
});

gcprofiler.on('gc', function(info) {
	logger.log('gced: %s%s (%s ms)', info.type, info.forced ? '(forced)' : '', info.duration);
});

setInterval(function() {
	var usage = process.memoryUsage();

	logger.log('memory stats: heap used = %s, heap total = %s, rss = %s', humanSize(usage.heapUsed), humanSize(usage.heapTotal), humanSize(usage.rss));
}, 5000);

exports.gc = function() {
	memwatch.gc();
};

exports.track = function(name, chance, cb) {
	if (typeof name == 'number') {
		cb = chance;
		chance = name;
		name = undefined;
	}

	if (typeof chance == 'function') {
		cb = chance;
		chance = undefined;
	}

	if (!name) {
		name = '';
	}

	if (chance === undefined) {
		chance = 1;
	}

	initDiff();

	var end = function() {
		if (Math.random() > chance) {
			return;
		}

		logger.log('tracked %s', name);

		exports.gc();
		scheduleGcAndDiff();
	};

	if (cb) {
		cb(end);
	}

	return end;
};

