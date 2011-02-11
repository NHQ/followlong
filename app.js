
/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer(),
    redis = require("./redis"),
    client = redis.createClient(),
    sub = redis.createClient(),
    pub = redis.createClient(),
    crypto = require('crypto')
    , http = require('http')
    , url = require('url')
    , fs = require('fs')
    , sys = require(process.binding('natives').util ? 'util' : 'sys')
    , server
	, newfeed = require('./models/newfeed')
	, newuser = require('./models/user')
	, RedisStore = require('connect-redis'), multi
	, local = http.createClient(8080, '127.0.0.1');

client.on("error", function (err) {
    console.log("Error " + err);
});

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyDecoder());
  app.use(express.cookieDecoder());
  app.use(express.session({ store: new RedisStore }));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.staticProvider(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

function loadUser(req, res, next) {
  if (req.session.user_id) {
	next();
	}
  else {
    res.redirect('/new-user');
  }
}

// Routes

app.get('/', function(req, res){
	multi = client.multi();
	client.zrevrangebyscore('frontPage',1271851245, 1271851241, function(err, data){
		if(err){console.log(err)}
		for (d in data)
		{
			multi.hgetall(data[d], function(err, contents){
			})
		}
		multi.exec(function(err, reply){
			if(err){console.log(err)}
			console.log(reply);
			articles = reply;
			res.render('index', {
				locals: {title: "Redis", articles: articles}
			})
		})
	})
});

app.get('/test', function(req, res){
	d = fs.readFileSync('./schema.json', 'utf8');
	datum = JSON.stringify(d);
	data = JSON.parse(d);
	var request = local.request('POST', '/feed/Johnny', {
		'host': '127.0.0.1',
		'Application-type': 'application/json'
	});
	request.end(d, encoding='utf8');
	var peep = client.ZREVRANGEBYSCORE("Johnny's Likes", 1241616887, 1271851241, "WITHSCORES", function(err, ditto){
		if (err){console.log(err)};
		ditto = ditto;
		console.log(ditto)
	});
});

app.get('/admin', function(req, res){
	client.lrange('channels', 0, -1, function(err, data){
		res.render('admin', {
			locals: {title: "Admin", channels: data}
		})
	})
});

app.post('/admin', function(req, res){
	channel = req.body.channel;
	client.lpush('channels', channel, function(err, body){
		if (err){console.log(err)};
		res.redirect('/admin');
	})
});

app.post('/delete', function(req, res){
	channel = req.body.channel;
	console.log(channel);
	client.lrem('channels', 0, channel, function(err, body){
		if (err){console.log(err)};
		res.redirect('/admin');
	})
});

app.get("/chat.html", function(req, res){
var path = url.parse(req.url).pathname;
      fs.readFile(__dirname + path, function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
        res.write(data, 'utf8');
        res.end();
      });
}),

send404 = function(res){
  res.writeHead(404);
  res.write('404');
  res.end();
};

app.post('/new', function(req, res){
	newfeed.fURL(req.body.url, req.body.fname);
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('hello');
});

app.get('/new-user', function(res, res){
	res.render('new-user', {
		locals: {title: "create user"}
	})
})

app.post('/new-user', function(req, res){
	newuser.fUSR(req.body.email, req.body.password);
    req.session.user_id = req.body.email;
    res.redirect('/');
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('hello');
});

app.post('/new/:channel/:feed/:feedName', function(req, res){
// Get important stuff.
  feedURL = decodeURIComponent(req.params.feed);
  feedName = req.params.feedName;
  channel = req.params.channel;
// Create sorted set with the first item = feedURL with score -1. Careful not to delete it when pruning
	client.zadd(feedTitle, -1, feedURL);	
// Add to videos feed index. The videos index is set of feed names.
	client.rpush(channel, feedName);
	res.writeHead('200');
	res.end();
// Fwd feed url info to superfeedr. The callback should be a unique URL with the feed name.
// TODO createClient()
});

app.post('/feed/:feedName', function(req, res){
	res.writeHead('200');
	req.setEncoding('utf8');

	feedName = req.params.feedName;
	cat = req.params.cat;

	req.on('data', function(data){
		var d = JSON.parse(data);
		var dl = d.items.length;

		for (x = 0; x < dl; ++x){
			picture = "Set Me to some kind of default picture";
			var content;	
			if (d.items[x].standardLinks){
				picture = d.items[x].standardLinks.picture[0].href
			};
			content = {
				"content": d.items[x].content,
				"link": d.items[x].permalinkUrl,
				"title": d.items[x].title,
				"pic": picture				
			};
			content = JSON.stringify(content);
			console.log(d.title);
			client.zadd(d.title, d.items[x].postedTime, d.items[x].title, function(err, reply){if (err){console.log(err)}});
			client.hmset(d.items[x].title, 
				{
					"content": d.items[x].content,
					"link": d.items[x].permalinkUrl,
					"title": d.items[x].title,
					"pic": picture,
					"id": d.title // NOTE: just added this
				}, function(err, reply){if (err){console.log("error: " + err)}})
		};
	res.redirect('/admin')
	});
});
// Only listen on $ node app.js

if (!module.parent) {
  app.listen(8080);
  console.log("Express server listening on port %d", app.address().port)
}
var into = new function(){
	var titres = ["Johnny's Likes", "Angeline's Likes"];
	var repo = new Array();
	multi = client.multi();
	client.lrange('channels', 0, -1, function (err, repo){
		repo = repo;
		console.log(repo);
		for (r in repo)
		{
			multi.lrange(repo[r], -0, -1, function (err, reply){})		
		}
	multi.exec(function(err, echo){
		num = titres.length;
		titties = titres.toString();
		client.zunionstore(['frontPage', num].concat(titres), function (err, front){
		if(err){console.log(err)};
		front = front;
		console.log(front)
	})
		});	
});
};
