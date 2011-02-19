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
	, querystring = require('querystring')
    , fs = require('fs')
    , sys = require(process.binding('natives').util ? 'util' : 'sys')
    , server
	, newfeed = require('./models/newfeed')
	, newuser = require('./models/user')
	, RedisStore = require('connect-redis'), multi
	, local = http.createClient(80, '64.30.138.240');

function epoch(){return Math.round(new Date().getTime()/1000.0)};

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
function frontis(){
	var t = setTimeout(function(){frontis()}, 60000);
	var repo = new Array();
	var allem = new Array();
	multi = client.multi();
	client.lrange('channels', 0, -1, function (err, repo){
		repo = repo;
		sys.puts(repo);
		for (r in repo)
		{
			multi.lrange(repo[r], 0, -1, function (err, reply){})		
		}
		multi.exec(function(err, echo){
			allem = allem.concat.apply(allem, echo);
			num = allem.length;
			// need to add min/max to zunionstore to only "recent" scores
			// or else use limit offset above, depenidng on size of indexes
			client.zunionstore(['frontPage', num].concat(allem), function (err, front){
				if(err){sys.puts(err)};
			})
		});	
	});
}
// Routes

app.get('/', function(req, res){
	multi = client.multi();
	client.zrevrangebyscore('frontPage', epoch(), 1295718384, "limit", "0", "50", function(err, data){
		if(err){console.log(err)}
		for (d in data)
		{
			multi.hgetall(data[d], function(err, contents){
			})
		}
		multi.exec(function(err, reply){
			if(err){console.log(err)}
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
/*
app.post('/new', function(req, res){
	newfeed.fURL(req.body.url, req.body.fname);
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('hello');
});
*/
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
	d = fs.readFileSync('./more.json', 'utf8');
	datum = JSON.stringify(d);
	data = JSON.parse(d);
	var request = local.request('POST', '/feed/vimeo/Angeline_Likes', {
		'host': '64.30.138.240',
		'Application-type': 'application/json'
	});
	request.end(d, encoding='utf8');
	res.redirect('/');
});

function subscribe (channel, feed){
		var spfdr = http.createClient(80, 'superfeedr.com');
		data = "hub.mode=subscribe&hub.verify=sync&hub.topic="+feed+"&hub.callback=http://64.30.138.240/feed/"+channel+"/?furl="+feed;
		var request = spfdr.request('POST', '/hubbub', {
			'Host':'superfeedr.com',
			"Authorization":"basic TkhROmxvb3Bob2xl",
			'Accept':'application/json',
			'Content-Length': data.length
		});
		request.write(data, encoding='utf8');
		request.on('response', function (response){
			response.on('data', function (stuff){
				console.log(stuff.toString('utf8', 0, stuff.length))
			})
		})
		request.end();
};

function retrieve (channel, feed){
	var spfdr = http.createClient(80, 'superfeedr.com');
	var ditto = new String();
	data = "hub.mode=retrieve&hub.topic="+feed+"&hub.callback=http://64.30.138.240/feed/"+channel+"/?furl="+feed;
	var request = spfdr.request('GET', '/hubbub', {
		'Host':'superfeedr.com',
		"Authorization":"basic TkhROmxvb3Bob2xl",
		'Accept':'application/json',
		'Content-Length': data.length
	});
	request.write(data, encoding='utf8');
	request.on('response', function (response){
		response.on('data', function(chunk){
			ditto += chunk;
		});
		response.on('end', function (){
			var d = JSON.parse(ditto);
			console.log(d);
			var dl = d.items.length;
			for (x = 0; x < dl; ++x){
				picture = ""; // do what the green line says!
				if (d.items[x].standardLinks && d.items[x].standardLinks.picture){
					picture = d.items[x].standardLinks.picture[0].href
				};
				client.zadd(feed, d.items[x].postedTime, d.items[x].title, function(err, reply){if (err){sys.puts(err)}});
				client.hmset(d.items[x].title, 
					{
						"content": d.items[x].content,
						"link": d.items[x].permalinkUrl,
						"title": d.items[x].title,
						"pic": picture,
						"channel": channel,
						"furl": feed,
						"score": d.items[x].postedTime,
						"created": d.items[x].postedTime
					}, function(err, reply){if (err){sys.puts("error: " + err)}})
			};
		//res.end()
		});
	});
};

app.get('/new/:channel/', function(req, res){
	var path = url.parse(req.url).query;
	query = querystring.parse(path, sep='&', eq='=');
	unfurl = query.furl;
	channel = req.params.channel;
	console.log(query);
	client.zadd(unfurl, -1, unfurl);	
	client.rpush(channel, unfurl);
	subscribe(channel, unfurl);
	var retr = setTimeout(function(){retrieve(channel,unfurl)}, 30000);
	res.redirect('/');
	res.end();
});

app.get('/feed/:channel/', function(req, res){
	heads = req.headers;
	console.log(heads);
	res.writeHead('200');
	var path = url.parse(req.url).query;
	query = querystring.parse(path, sep='&', eq='=');
	channel = req.params.channel;
	feed = query.furl;
	console.log(feed+"   "+channel)
	challenge = query.hub.challenge;
	client.set('path', challenge);
	res.write(challenge);
	req.setEncoding('utf8');
	req.on('data', function	(stuff){
			console.log(stuff.toString('utf8', 0, stuff.length));
	});
	res.end();
});

app.post('/feed/:channel/', function(req, res){
	res.writeHead('200');
	req.setEncoding('utf8');
	var query = url.parse(req.url).query;
	unfurl = query.furl;
	channel = req.params.channel;
	var data = new String();
	req.on('data', function(chunk){
		data += chunk;
		console.log(chunk.toString('utf8', 0, chunk.length))
	});
	
	req.on('end', function (){
		var d = JSON.parse(data);
				console.log(d);
		var dl = d.items.length;
		for (x = 0; x < dl; ++x){
			picture = ""; // do what the green line says!	
			if (d.items[x].standardLinks && d.items[x].standardLinks.picture){
				picture = d.items[x].standardLinks.picture[0].href
			};
			sys.puts(d.title);
			client.zadd(unfurl, d.items[x].postedTime, d.items[x].title, function(err, reply){if (err){sys.puts(err)}});
			client.hmset(d.items[x].title, 
				{
					"content": d.items[x].content,
					"link": d.items[x].permalinkUrl,
					"title": d.items[x].title,
					"pic": picture,
					"channel": channel,
					"furl": unfurl,
					"score": d.items[x].postedTime,
					"created": d.items[x].postedTime
				}, function(err, reply){if (err){console.log("error: " + err)}})
		};
	//res.end()
	});
});
// Only listen on $ node app.js

if (!module.parent) {
  app.listen(80);
  sys.puts("Express server listening on port %d", app.address().port);
	frontis();
}