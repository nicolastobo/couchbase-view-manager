var VERSION = '0.1';

var Couchbase = require('couchbase');
var async     = require('async');

var COUCHBASE_PASSWORD 	= '';
var COUCHBASE_HOST 	    = '127.0.0.1:8091';
var VIEWS_DIR 			= 'views';

var fs = require('fs');

var opts = require('optimist')
    .usage('Usage: $0 -u [str] -p [str] -D [dir] [opts] --force --update')
    .default('p', COUCHBASE_PASSWORD)
    .alias('p', 'bucket-password')
    .default('H', COUCHBASE_HOST)
    .alias('H', 'host')
    .default('D', VIEWS_DIR)
    .alias('D', 'directory')
    .default('dev', false)
    .default('l', null)
    .alias('l', 'list')
    .default('e', false)
    .alias('e', 'no-eval')
    .default('b', null)
    .alias('b', 'bucket')
    .default('d', null)
    .alias('d', 'design')
    .default('v', false)
    .alias('v', 'view')
    .default('f', false)
    .alias('f', 'force')
    .default('u', false)
    .alias('u', 'update')
    // .default('v', false)
    // .alias('v', 'verbose')
    .default('h', false)
    .alias('h', 'help')
    .default('V', false)
    .alias('V', 'version');
var argv = opts.argv;

var log = [];
var printLog = function() {

	var __spaces = function(n) {var s = '';for (var i = 0; i < n; ++i)s += ' ';return s};

	for (var l in log) {
		var line = log[l];
		var name = line.view.bucket + '/' + line.view.design + '/' + line.view.name;
		var status = line.status;

		var spaces = 80 - (name.length + status.length);
		console.log(name + __spaces(spaces) + status);
	}
};

var version = function() {
	console.log("Version " + VERSION);
	process.exit(0);
}

var help = function() {
	console.log(opts.showHelp());
    process.exit(0);
};

var connect = function(buckets, callback) {
	var handlers = {};

	async.each(buckets,
		function(bucket, cb) {
			handlers[bucket] = new Couchbase.Connection({
				bucket: bucket,
				host: argv.host,
				password: argv.p,
			}, function(error) {
				 cb(error)
			})
		},
		function(error) {
			if (error) {
				console.log(error);
				process.exit(2);
			}
			callback(error, handlers);
		});
};

var getDesignOrCreate = function(design, handler, callback) {
	handler.getDesignDoc(design, function(error, ddoc, meta) {
		if (error) {
			if (error.code == 4104) { // missing design
				console.log('[INFO] Creating design ' + design + '...');
				handler.setDesignDoc(design, {}, function(error) {
					if (error) {
						console.log('[ERROR] ' + design + ' - ' + error);
						process.exit(1);
					}
					return handler.getDesignDoc(design, callback);
				})
			}
			else {
				console.log('[ERROR] ' + design + ' - ' + error);
				return process.exit(1);
			}
		}
		else {
			return callback(error, ddoc, meta);
		}
	});
};

var setView = function(view, handler, ddoc, status, callback) {
	if (status == 'create')
		ddoc.views[view.name] = {};

	// update
	if (status == 'update')
		if (ddoc.views[view.name].map == view.map) // same map
			if (ddoc.views[view.name].reduce == view.reduce) { // same reduce 
				log.push({view: view, status: 'not changed'})
				return callback(null);
			}

	ddoc.views[view.name].map = view.map;
	if (view.reduce)
		ddoc.views[view.name].reduce = view.reduce;

	if (status == 'create')
		log.push({view: view, status: 'created'})
	else
		log.push({view: view, status: 'updated'})

	// console.log('[INFO] ' + status + ' view ' + view.design + '/' + view.name);
	handler.setDesignDoc(view.design, ddoc, callback)
};

var uploadView = function(view, handlers, callback) {
	getDesignOrCreate(view.design, handlers[view.bucket], function(error, ddoc, meta) {
		if (error) {
			console.log(error);
			return callback(error);
		}

		if (!ddoc)
			ddoc = {views: {}};

		if (ddoc.views[view.name]) {
			if (argv.update || argv.force) {
				var status = argv.force ? 'force' : 'update';
				setView(view, handlers[view.bucket], ddoc, status, callback);
			}
			else {
				if ((ddoc.views[view.name].map == view.map) && (ddoc.views[view.name].reduce == view.reduce))  // same map && same reduce 
					log.push({view: view, status: 'not changed'})
				else
					log.push({view: view, status: 'changed but not updated'})
				return callback(null);
			}
		}
		else {
			setView(view, handlers[view.bucket], ddoc, 'create', callback);
		}
	})
};

var main = function() {
 	if (argv.help)
 		return help();
 	if (argv.version)
 		return version();

 	var buckets = getBuckets();

 	connect(buckets, function(error, handlers) {

		async.eachSeries(buckets,
			function(bucket, cbBucket){

				if (argv.list)
					console.log(bucket + ':');
				var designs = getDesigns(bucket);
				async.eachSeries(designs,
					function(design, cbDesign) {

						if (argv.list)
							console.log('\t' + design + ':');
						var views = getViews(bucket, design);
						async.eachSeries(views,
							function(view, cb) {
								if (argv.list) {
									console.log('\t\t' + view.name);
									cb(null);
								}
								else
									uploadView(view, handlers, cb);
							},
							function(error) {
								cbDesign(error)
							});

					},
					function(error) {
						cbBucket(error);
					});
			},
			function(error) {
				if (error)
					console.log('[ERROR] ' + error);

				printLog();

				process.exit(0);
			})
 	});
};

var getBuckets = function() {
	try {
		fs.statSync(argv.directory);
	}
	catch (e) {
		console.log('\n[ERROR] directory `' + argv.directory + '` not found.\n');
		console.log(opts.showHelp());
		process.exit(2);
	}


	var buckets = fs.readdirSync(argv.directory);

	if (argv.bucket)
		return buckets.filter(function(bucket) { return bucket == argv.bucket});
	return buckets;
};

var getDesigns = function(bucket) {
	var designs = fs.readdirSync(argv.directory + '/' + bucket);

	if (argv.design)
		return designs.filter(function(design) { return design == argv.design});

	return designs;
};

var _eval = function(code, file) {
	if (!code)
		return;

	if (code === '_count' || code === '_sum' || code === '_stat')
		return;

	try {
		eval('(' + code + ')');
	}
	catch (e) {
		console.log('[ERROR] bad syntax in ' + file.path);
		console.log('\t', e);
		process.exit(1);
	}
};

var getViews = function(bucket, design) {
	var files = fs.readdirSync(argv.directory + '/' + bucket + '/' + design);

	// find map files
	var mapFiles = files.map(function(file) {
		r = {};
		var s = '';
		if (/.map.js$/.exec(file)) {
			s = file.split('.map.');
		}
		else {
			return undefined;
		}

		r['path'] = argv.directory + '/' + bucket + '/' + design + '/' + file;
		r['name'] = s[0];
		r['bucket'] = bucket;
		r['design'] = design;

		if (argv.dev)
			r['design'] = 'dev_' + r['design'];

		return r;
	});

	// set map and existing reduce functions
	mapFiles = mapFiles.filter(function(file) { return !!file });
	mapFiles = mapFiles.map(function(file) {
		file.map = fs.readFileSync(file.path).toString();
		try {
			file.reduce = fs.readFileSync(file.path.replace('.map.js', '.reduce.js')).toString();
		}
		catch (e) {
		}

		if (!argv.e) { // no-eval
			_eval(file.map, file);
			_eval(file.reduce, file);
		}

		delete file.path;
		return file;
	});

	if (argv.view)
		return mapFiles.filter(function(v) {return v.name == argv.view});
	return mapFiles;
};

main();
