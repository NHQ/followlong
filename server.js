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
	, local = http.createClient(80, 'http://64.30.138.240/');

client.on("error", function (err) {
    sys.puts("Error " + err);
});

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyDecoder());
  app.use(express.cookieDecoder());
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

/*
function loadUser(req, res, next) {
  if (req.session.user_id) {
	next();
	}
  else {
    res.redirect('/new-user');
  }
}
*/

// Routes

app.get('/', function(req, res){
	multi = client.multi();
	client.zrevrangebyscore('frontPage',1271851245, 1271851241, "limit", "0", "10", function(err, data){
		if(err){sys.puts(err)}
		for (d in data)
		{
			multi.hgetall(data[d], function(err, contents){
			})
		}
		multi.exec(function(err, reply){
			if(err){sys.puts(err)}
			articles = reply;
			res.render('index', {
				locals: {title: "Redis", articles: articles}
			})
		})
	})
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
		if (err){sys.puts(err)};
		res.redirect('/admin');
	})
});

app.post('/delete', function(req, res){
	channel = req.body.channel;
	sys.puts(channel);
	client.lrem('channels', 0, channel, function(err, body){
		if (err){sys.puts(err)};
		res.redirect('/admin');
	})
});

/*
app.get("/chat.html", function(req, res){
var path = url.parse(req.url).pathname;
      fs.readFile(__dirname + path, function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
        res.write(data, 'utf8');
        res.end();
      });
}),
*/

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

/* 
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
*/
app.get('/test', function(req, res){
	d = fs.readFileSync('./schema.json', 'utf8');
	datum = JSON.stringify(d);
	data = JSON.parse(d);
	var request = local.request('POST', '/feed/vimeo/Videos%20Angeline%20Gragasin%20likes', {
		'host': 'http://64.30.138.240/',
		'Application-type': 'application/json'
	});
	request.end(d, encoding='utf8');
	var peep = client.ZREVRANGEBYSCORE("Johnny's Likes", 1241616887, 1271851241, "WITHSCORES", function(err, ditto){
		if (err){console.log(err)};
		ditto = ditto;
		console.log(ditto)
	});
});

app.post('/new/:channel/:feed/:feedName', function(req, res){
	var spfdr = http.createClient(80, 'http://superfeedr.com/');
	feedURL = decodeURIComponent(req.params.feed);
	feedName = decodeURIComponent(req.params.feedName);
	channel = req.params.channel;
	client.zadd(feedName, -1, feedURL);	
	client.rpush(channel, feedName);
	res.writeHead('200');
	res.end();
	var request = spfdr.request('POST', '/hubbub', {
		'Host':'superfeedr.com',
		"Authorization":"basic TkhROmxvb3Bob2xl",
		'hub.mode':'subscribe',
		'hub.topic':feedURL,
		'hub.callback': 'http://64.30.138.240/feed/'+channel+'/'+feedName+'/',
		'Accept':'application/json',
		'hub.verify':'async'
	})
// TODO createClient()
});

app.get('/feed/:channel/:feedName', function(req, res){
	var path = url.parse(req.url).query;
	challenge = path.substring(path.indexOf('=')+1, path.indexOf('&'));
	client.set('path', challenge);
	res.writeHead('200');
	res.write(challenge);
	res.end();
});

app.post('/feed/:channel/:feedName', function(req, res){
	res.writeHead('200');
	req.setEncoding('utf8');

	channel = req.params.channel;
	feedName = req.params.feedName;
	req.on('data', function(data){
		var d = JSON.parse(data);
		var dl = d.items.length;
		
		for (x = 0; x < dl; ++x){
			picture = "Set Me to some kind of default picture"; // do what the green line says!
			var content;	
			if (d.items[x].standardLinks){
				picture = d.items[x].standardLinks.picture[0].href
			};
			sys.puts(d.title);
			client.zadd(d.title, d.items[x].postedTime, d.items[x].title, function(err, reply){if (err){sys.puts(err)}});
			client.hmset(d.items[x].title, 
				{
					"content": d.items[x].content,
					"link": d.items[x].permalinkUrl,
					"title": d.items[x].title,
					"pic": picture,
					"id": d.title,
					"channel": channel,
					"score": d.items[x].postedTime,
					"created": d.items[x].postedTime
				}, function(err, reply){if (err){sys.puts("error: " + err)}})
		};
	//res.end()
	});
});
// Only listen on $ node app.js

if (!module.parent) {
  app.listen(80);
  sys.puts("Express server listening on port %d", app.address().port)
}
var into = new function(){
	var repo = new Array();
	multi = client.multi();
	client.lrange('channels', 0, -1, function (err, repo){
		repo = repo;
		sys.puts(repo);
		for (r in repo)
		{
			multi.lrange(repo[r], -0, -1, function (err, reply){})		
		}
		multi.exec(function(err, echo){
			num = echo.length;
			// need to add min/max to zunionstore to only "recent" scores
			// or else use limit offset above, depenidng on size of indexes
			client.zunionstore(['frontPage', num].concat(echo), function (err, front){
				if(err){sys.puts(err)};
				front = front;
				sys.puts("hi")
			})
		});	
	});
};
