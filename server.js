/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer(),
    redis = require("./redis"),
	connect = require('connect'),
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
	, local = http.createClient(80, 'mostmodernist.no.de')
	, facebookClient = require('facebook-js')(
      '190292354344532',
      '6a8433e613782515148f6b2ee038cb1a'
    )
	, EE = require('events').EventEmitter
	, ee = new EE();

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
  app.use(express.session({key: 'k33k33', secret: 'superSecret!', store: new RedisStore}));
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
function isAdmin(req, res, next) {
  if (req.session.user_id) {
	next();
	}
  else {
    res.redirect('/new-user');
  }
}
*/

function getSesh (req, res, next){
	var isAdmin = 0;
	if(!req.session.user_id)
		next()
	if(req.session.user_id)
	{
		client.hgetall(req.session.user_id, function(err, facts){
			if(facts[isAdmin] = 1)
			{
				req.isAdmin = 1;
				next();
				client.quit();
			}
			else
			{
				req.isAdmin = 0;
				next();
				client.quit();				
			}
		});
	}
};

function frontis(){
	var t = setTimeout(function(){frontis()}, 60000);
	var repo = new Array();
	var allem = new Array();
	multi = client.multi();
	client.smembers('channels', function (err, repo){
		repo = repo;
		for (r in repo)
		{
			multi.smembers(repo[r], function (err, reply){})		
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

app.get('/', getSesh, function(req, res){
	client.zrevrangebyscore('frontPage', epoch(), epoch()-450061, "limit", "0", "75", function(err, data){
	multi = client.multi();
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
				locals: {title: "MOSTMODERNIST", articles: articles, admin: req.isAdmin}
			});
			res.end();
		}); 
		console.log(req.isAdmin)
	});
});

/*
app.get('/ajax', function (req, res){
	res.render('ajax', {
		locals: {title: "MOSTMODERNIST"}
	})
});

app.get('/load', function (req, res){
	res.writeHead(200, {'Content-Type': 'application/json'})
	multi = client.multi();
	var jbody = '';
	var jvar = [];
	channel = req.query.channel;
	score = req.query.score;
	console.log(req.headers);
	console.log(url.parse(req.url).href+'\n'+channel+'\n'+score);
	
	ee.on('godot', function() {
		console.log('he"s here!')
	    multi.exec(function(err, nope){
			if(err){console.log(err)}
			j = 0;
			if (j < jvar.length)
			{
				client.hmget(jvar[j],'title','score','link','channel','furl', function(err, rere){
					data = JSON.stringify(rere);
					res.write(data, 'utf8');
				})
				j += 1
			}
			else
			console.log(jbody);
	        res.end()
		});
	});
	client.smembers(channel, function(err, list){
		console.log(list);
		var l = 0;
		if (l < list.length)
		{
			multi.zrevrangebyscore(list[l], score-100, score-90061, function(err, re){
				for (r in re)
				jvar.push(re[r])
			})
			l += 1
		}
		else if (l = list.length)
		 {ee.emit('godot');
		client.quit();}
	})
});
*/
app.get('/admin', function(req, res){
	var obj = new Object();
	var cats = [];
	multi = client.multi();
	client.smembers('channels', function (err, repo){
		repo = repo;
		for (x in repo)
		{
			cats.push(repo[x]);
			multi.smembers(repo[x], function (err, reply){
			})		
		}
		client.quit();
		multi.exec(function(err, list){
			for (x = 0; x < list.length; ++x)
			{
				obj[cats[x]] = list[x]
			}
		res.render('admin', {
				locals: {title: "admin", go: '/delete/feed', channels: obj }
			})
		})
	});
	res.end();
});

app.post('/delete/feed', function (req, res){
	channel = req.body.channel;
	feed = decodeURIComponent(req.body.feed);
	delFeed(channel, feed);
	res.redirect('/admin');
	res.end();
})

app.get('/delete/item/:furl/:item', getSesh, function (req, res){
	furl = decodeURIComponent(req.params.furl);
	feed = decodeURIComponent(req.params.item);
	item = feed.replace(/\s/g, "_")
	console.log("Feed= "+feed+"\nitem= "+item)
	client.del(item);
	client.zrem(furl, item, function(err, res){
		frontis();
	});
	res.redirect('/');
	res.end();
})

app.get('/edit', function(req, res){
	var feed = req.query.feed;
	var channels = {};
	client.zrevrangebyscore(feed, epoch(), 0, function(err, items){
		channels[feed] = items;
		res.render('admin', 
		{
			locals: {title: feed, go: '/delete/item', channels: channels }
		})
		client.quit()
	})
	res.end();
})

function delFeed (channel, feed){
	multi = client.multi();
	client.zrange(feed, 0, -1, function (err, range){
		for (r in range)
		{
			multi.del(range[r])
		}
		multi.exec()
	});
	client.del(feed);
	client.srem(channel, feed);
	client.srem('allFeeds', feed, function(err, re){
		client.quit()
	});
	unsubscribe(channel, feed);
	frontis();
	//perhaps only unsubscribe rather than delete all old ones? Move them out of their parent channel and into the "archives"
	// after you change "channels" to sets, rather than lists, add srem function to this to delete feed from channel set
};

function delItem (feed, item) {
	client.zrem(feed, item);
	client.del(item);
};

app.get('/admin/channels', function(req, res){
	client.lrange('channels', 0, -1, function(err, data){
		res.body = data;
		res.end();
		client.quit();
	})
});

app.post('/admin', function(req, res){
	channel = req.body.channel;
	client.sadd('channels', channel, function(err, body){
		if (err){sys.puts(err)};
		res.redirect('/admin');
		res.end();
		client.quit()
	})
});

app.post('/delete', function(req, res){
	channel = req.body.channel;
	sys.puts(channel);
	client.srem('channels', function(err, body){
		if (err){sys.puts(err)};
		res.redirect('/admin');
		res.end();
		client.quit()
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
app.get("/schema.json", function(req, res){
var path = url.parse(req.url).pathname;
      fs.readFile(__dirname + path, function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.write(data, 'utf8');
        res.end();
      });
}),

app.error(function(err, req, res, next) {
  if (err instanceof NotFound) {
    res.redirect('/');
  } else {
    next(err);
  }
});
send404 = function(res){
  res.writeHead(404);
	res.redirect('/');
  res.end();
};
/*
app.get('/new-user', function(req, res){
	console.log(req.session.user_id);
	res.render('new-user', {
		locals: {title: "create user", action: "/new-user"}
	})
});

app.post('/new-user', function(req, res){
	id = (Math.round((new Date().valueOf() * Math.random())) + '');
	req.session.user_id = req.body.email;
	newuser.fUSR(req.body.email, req.body.password, id);
    res.redirect('/');
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('hello');
});
*/
app.get('/login', function(req, res){
	res.render('new-user', {
		locals: {title: "login", action: "/login"}
	});
	res.end()
})

app.post('/login', function(req, res){
	password = req.body.password;
	client.hgetall(req.body.email, function(err, user){
		if (user = ""){res.redirect('/');res.end();}
		if (user && function(password){
			return crypto.createHmac('sha1', user.salt).update(password).digest('hex') === user.password
		})
		{res.writeHead('200');
		req.session.user_id = user.email;
		res.redirect('/');res.end()}
		client.quit()	
	});
});

app.get('/logout', function(req, res){
	if(req.session)
	{
		req.session.destroy(function() {});
		res.redirect('/');
		res.end()
	}
	else
	{
		res.redirect('/');
		res.end()
	}
})
/*
app.get('/test', function(req, res){
	d = fs.readFileSync('./more.json', 'utf8');
	datum = JSON.stringify(d);
	data = JSON.parse(d);
	var request = local.request('POST', '/feed/vimeo/Angeline_Likes', {
		'host': 'mostmodernist.no.de',
		'Application-type': 'application/json'
	});
	request.end(d, encoding='utf8');
	res.redirect('/');
});
*/
function unsubscribe (channel, feed){
		spfdr = http.createClient(80, 'superfeedr.com');
		datat = "hub.mode=unsubscribe&hub.verify=sync&hub.topic="+feed+"&hub.callback=http://mostmodernist.no.de/feed?channel="+channel;
		request = spfdr.request('POST', '/hubbub', {
			'Host':'superfeedr.com',
			"Authorization":"basic TkhROmxvb3Bob2xl",
			'Accept':'application/json',
			'Content-Length': datat.length
		});
		request.write(datat, encoding='utf8');
		request.on('response', function (response){
			response.on('data', function (stuff){
				console.log(stuff.toString('utf8', 0, stuff.length))
			})
		})
		request.end();
};

function subscribe (channel, feed){
		spfdr = http.createClient(80, 'superfeedr.com');
		dataw = "hub.mode=subscribe&hub.verify=sync&hub.topic="+feed+"&hub.callback=http://mostmodernist.no.de/feed?channel="+channel;
		request = spfdr.request('POST', '/hubbub', {
			'Host':'superfeedr.com',
			"Authorization":"basic TkhROmxvb3Bob2xl",
			'Accept':'application/json',
			'Content-Length': dataw.length
		});
		request.write(dataw, encoding='utf8');
		request.on('response', function (response){
			response.on('data', function (stuff){
				console.log(stuff.toString('utf8', 0, stuff.length))
			})
		})
		request.end();
};
/*
function retrieve (channel, feed){
	var spfdr = http.createClient(80, 'superfeedr.com');
	var ditto = new String();
	data = "hub.mode=retrieve&hub.topic="+feed+"&hub.callback=http://mostmodernist.no.de/feed?channel="+channel;
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
			var dl = d.items.length;
			for (x = 0; x < dl; ++x){
				picture = ""; // do what the green line says!
				content = "";
				if (d.items[x].standardLinks && d.items[x].standardLinks.picture){
					picture = d.items[x].standardLinks.picture[0].href
				};
				if (d.items[x].content){
					content = d.items[x].content
				};
				title = d.items[x].title.replace(/&nbsp;/g," ");
				console.log(title);
				client.zadd(feed, d.items[x].postedTime, d.items[x].title, function(err, reply){if (err){sys.puts(err)}});
				client.hmset(title.replace(/\s/g, "_"), 
					{
						"content": content,
						"link": d.items[x].permalinkUrl,
						"title": title,
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
*/
app.get('/new/:channel/', function(req, res){
	path = url.parse(req.url).query;
	queriesPls = querystring.parse(path, sep='&', eq='=');
	unfurl = queriesPls.furl;
	channel = req.params.channel;
	client.zadd(unfurl, -1, unfurl);	
	client.sadd(channel, unfurl);
	client.sadd('allFeeds', unfurl, function(e,r){
	});
	subscribe(channel, unfurl);
	res.redirect('/');
	res.end();	
	//var retr = setTimeout(function(){retrieve(channel,unfurl)}, 30000);
});

app.get('/feed', function(req, res){
	path = url.parse(req.url).query;
	queriness = querystring.parse(path, sep='&', eq='=');
	channel = queriness.channel;
	challenge = queriness.hub.challenge;
	res.writeHead('200');
	res.write(challenge);
	res.end();
	console.log(req.headers);
});

app.post('/feed', function(req, res){
	res.writeHead('200');
	res.end();
	path = url.parse(req.url).query;
	query = new querystring.parse(path, sep='&', eq='=');
	channel = query.channel;
	
	d = req.body;
	var dl = d.items.length;
	unfurl = d.status.feed
	for (x = 0; x < dl; ++x){
		picture = ""; // do what the green line says!
		content = "";	
		summary = "";
		if (d.items[x].standardLinks && d.items[x].standardLinks.picture){
			picture = d.items[x].standardLinks.picture[0].href
		};
		if (d.items[x].content){
			content = d.items[x].content
		};
		if (d.items[x].summary){
			summary = d.items[x].summary
		};
		console.log(d.items.title);
		title = d.items[x].title.replace(/&nbsp;/g, " ");
		client.zadd(unfurl, d.items[x].postedTime, title.replace(/\s/g, "_"), function(err, reply){if (err){sys.puts(err)}});
		client.hmset(title.replace(/\s/g, "_"), 
			{
				"content": content,
				"summary": summary,
				"link": d.items[x].permalinkUrl,
				"title":title,
				"pic": picture,
				"channel": channel,
				"furl": unfurl,
				"score": d.items[x].postedTime,
				"created": d.items[x].postedTime
			}, function(err, reply){
				if (err)
					{
						console.log("error: " + err)
					}
			});	
	};
	console.log(req.headers);
});
// Only listen on $ node app.js

app.get('/fb', function (req, res) {
  res.redirect(facebookClient.getAuthorizeUrl({
    client_id: '190292354344532',
    redirect_uri: 'http://mostmodernist.no.de:80/auth',
    scope: 'offline_access,publish_stream,location'
  }));
});

app.get('/auth', function (req, res) {
	code = req.query.code;
	console.log(code);
	url = '/oauth/access_token?client_id=190292354344532&redirect_uri=http%3A%2F%2Fmostmodernist.no.de%3A80%2Fauth&client_secret=6a8433e613782515148f6b2ee038cb1a&code='+code;
	var fbGetAccessToken = http.createClient(443, 'graph.facebook.com', secure=true);
	request = fbGetAccessToken.request('POST', url, {
		'Host':'graph.facebook.com',
		'Content-Length': 0
	});
	request.end();
	request.on('response', function (response){
		var result = "";
		response.on('data', function(chunk){
			result+= chunk
			console.log(chunk+ '\n and \n' +result)
		});
		response.on('end', function(){
			 results= new querystring.parse( result );
		 access_token = results['access_token'];
		request2 = fbGetAccessToken.request('GET', '/me?access_token='+access_token, {
			'Host':'graph.facebook.com',
			'Content-Length': 0
		});
		request2.end();
		request2.on('response', function(response2){
			var result2 = '';
			response2.on('data', function(chunk){
				result2+= chunk
			});
			response2.on('end', function(){
				resulting = JSON.parse(result2);
				user_location = "unkown";
				if (resulting.user_location){user_location = resulting.user_location}
				client.hset(resulting.id, 'name', resulting.name, 'gender', resulting.gender, "location", user_location, 'link', link, function (err, rerun){
					res.writeHead('200');
					res.render('done', {locals: {title: 'mostmodernist', person: resulting}})
					res.end();
				})
			})
		})
		})
	})
});

app.post('/message', function (req, res) {
  facebookClient.apiCall(
    'POST',
    '/me/feed',
    {access_token: req.param('access_token'), message: req.param('message')},
    function (error, result) {
      console.log(error);
      console.log(result);
     res.render('done', {
      locals: {
	title: 'fb'
      }
    });
    }
  );
});

if (!module.parent) {
  app.listen(80);
  sys.puts("Express server listening on port %d", app.address().port);
	frontis();
}