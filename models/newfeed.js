// to do: change 'mySubs' to accord with user model

var redis = require("../redis"),
	newf = redis.createClient();

exports.fURL = function(x, y){
	newf.exists(x, function(err, z){
		if (z == 1) {
			newf.incr(x + ':followers');
			newf.rpush('mySubs', x);
			newf.subscribe(x);
			return;
		}
		else {
			newf.set(x, y);
			newf.incr(x + ':followers');
			newf.rpush('mySubs', x);
			newf.subscribe(x);
		}
	});
};
