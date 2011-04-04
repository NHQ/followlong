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
    console.log("Error " + err);
});

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyDecoder());
  app.use(express.cookieDecoder());
  app.use(express.session({key: 'k33k33', secret: 'superSecret!', cookie: {maxAge: 84400000}, store: new RedisStore}));
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
	if(!req.session.uid)
		res.redirect('/fb');
	if(req.session.uid)
	{
		console.log(req.session.uid);
		req.facts = req.session.uid;
		next();
	}
};

function userInterface (id){
	var allem = new Array(),
	multi = client.multi();
	client.get(id+':'+channels, function(err, repo){
		if (err) {console.log(err)}
		repost = JSON.parse(repo);
		for (r in repost)
		{
			multi.smembers(repost[r])
		}
		multi.exec(function (err, echo){
			console.log(echo+"wgaaaaa");
			allem = allem.concat.apply(allem, echo);
			for (a in allem)
			{
				multi.zrevrangebyscore(allem[a], epoch(), epoch()-450061, "limit", "0", "20")
			}
				multi.exec(function (err, list){
					if (err){console.log(err)}
					for (l in list)
					{
						multi.hmget(list[l], "title")
					}
					multi.exec(function (err, whatThisIs){
						return whatThisIs;
					})
				})
			})
		})
	};

function frontis(facts){
	var facts = facts;
	var channel = new Array();
	var articles = new Array();
	client.get(facts+':channels', function (err, channels){
		if(err){console.log(err)}
		channels = JSON.parse(channels);
		for (c in channels)
		{
			client.smembers(facts+':'+channels[c], function (err, source){
				if(err){console.log(err)}
				console.log(source);
				for (s in source)
				{
					client.zrevrangebyscore(source[s], epoch(), epoch()-450061, "limit", "0", "75", function(err, title){
						if(err){console.log(err)}
						client.hmget(title, 'title', 'score', 'feed', 'link', function (err, content){
							if(err){console.log(err)}	
							media = {'channel':channels[c],'feed':source[s],'content':content}
							articles.push(media);
						})
					})
				}
			})		
		}
		return articles
	})
};

// Routes
app.get('/2', getSesh, function (req, res){
	fs.readFile(__dirname + '/public/HTMLS/frontPage.html', function(err, data){
      if (err) return send404(res);
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.write(data, 'utf8');
		res.end();
    });
});

app.get('/link', function (req, res ){
	res.writeHead('200');
	title = decodeURIComponent(req.query.title);
	client.hget(title, 'link', function (err, link){
		res.redirect(link);
		res.end()
	})
})

app.get('/userChannels', getSesh, function (req, res){
		res.writeHead('200');
		client.get(req.facts+':channels', function (err, channels){
			if(err){console.log(err)}
			res.write(channels)
			res.end();
		})
});

app.get('/userStations', getSesh, function (req, res){
	console.log(req.query.channel);
	res.writeHead('200');
	client.smembers(req.facts+':'+req.query.channel, function (err, sources){
		multi = client.multi();
		for (s in sources)
		{
		multi.zrevrangebyscore(sources[s], epoch(), epoch()-450061, "limit", "0", "75", 'withscores')
		}
		multi.exec(function(err, media){
			obj = new Object();
			obj.channel = req.query.channel;
			obj.articles = media[0];
			res.write(JSON.stringify(obj));
			res.end();
			console.log(obj)
		})
	})
});

app.get('/userArticles', getSesh, function (req, res){
	res.writeHead('200');
	source = req.query.station;
	client.zrevrangebyscore(source, epoch(), epoch()-450061, "limit", "0", "75", function(err, titles){
		multi = client.multi();
		for (t in titles)
		{
			multi.hmget(titles[t], 'title', 'score', 'feed', 'link')
		};
		multi.exec(function (err, content){
			res.write(JSON.stringify(content));
			console.log(JSON.stringify(content));
			res.end()
		})
	})
});

app.get('/', getSesh, function(req, res){
	var channel = new Array();
	var articles = new Array();
	client.get(req.facts+':channels', function (err, channels){
		if(err){console.log(err)}
		channels = JSON.parse(channels);
		for (c in channels)
		{
			client.smembers(req.facts+':'+channels[c], function (err, source){
				if(err){console.log(err)}
				for (s in source)
				{
					client.zrevrangebyscore(source[s], epoch(), epoch()-450061, "limit", "0", "75", function(err, title){
						if(err){console.log(err)}
						for (t in title)
						{
							client.hmget(title[t], 'title', 'score', 'feed', 'link', function (err, content){
								if(err){console.log(err)}	
								media = {'channel':channels[c],'feed':source[s],'content':content};
								articles.push(media);
							})
						}
					})
				}
			})		
		}
	})
	console.log(articles);
	res.render('index', {
		locals: {title: "MOSTMODERNIST", admin:0, articles: articles}
	});
	res.end();
});


app.get('/user', getSesh, function (req,res){
	var channels = [], facts;
	function neon(obj){if (typeof obj === 'string'){channels.push(obj)} else otro(obj)};
	function otro(obj){channels.push(obj.channel);for (x in obj.subChannels){neon(obj.subChannels[x])}}
	she = req.facts;
	client.hgetall(she, function (err, dossier){
		if(err){console.log(err)}
		facts = dossier;
		console.log(facts)
	});
	client.get(she+':channels', function (err, string){
		if(err){console.log(err)}
		floss = JSON.parse(string);
		console.log(floss);
		for (x in floss)
		{
			neon(floss[x])
		}
		res.render('user', {
			locals: {title: facts.name, channels: channels, person: facts}
		})
		res.end();
	})
});

app.get('/info', getSesh, function (req, res){
	she = req.facts;
	console.log(she);
	client.get(she+':channels', function (err, string){
		if(err){console.log(err)}
		res.writeHead(200);
		console.log(string);
		res.write(string, 'utf8');
		res.end();
	})
});

app.get("/index", getSesh, function(req, res){
      fs.readFile(__dirname + '/public/HTMLS/index.html', function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': 'text/html'})
        res.write(data, 'utf8');
		res.end();
      });
});
/*
app.post('/new/channel', getSesh, function (req, res){
	var newChannel = req.body.channel;
	client.get(req.facts+':channels', function (err, json){
		channels = JSON.parse(json);
		channels.push(newChannel);
		client.set(req.facts+':channels', JSON.stringify(channels), function(){
			res.redirect('/index');
			res.end();
		})
	});
});
*/
app.post('/new/channel', getSesh, function (req, res){
	furl = '';
	if (req.query.furl)
	{
		furl = '#'+req.query.furl
	}
	if (req.body.channel === "")
	{
		res.redirect('/index');
		res.end();
	}
	else {
	client.get(req.facts+':channels', function (err, json){
	 function find(pos, arr) {
		 var i = pos.shift();  
	      if (pos.length) { 
	        return find(pos, arr[i]); 
	      } else { 
	        if (typeof arr[i] === 'string')
				{arr[i] = [arr[i], req.body.channel]}
			else if (arr[i] === undefined)
				{arr.push(req.body.channel)}
			else 
				{arr[i].push(req.body.channel)}
	      } 
	    }
		channels = JSON.parse(json);
		index = req.body.station.match(/\d/g);
		for (i in index){ index.splice(i,1,parseInt(index[i])) }
		find(index,channels)
		client.set(req.facts+':channels', JSON.stringify(channels), function(){
			res.redirect('/index'+furl);
			res.end();
		})
	})}
});
app.post('/delete/station', getSesh, function (req,res){
	client.get(req.facts+':channels', function (err, json){
	function dulute(pos, arr) {  
	      if (pos.length > 1) {
		 var i = pos.shift();
	        return dulute(pos, arr[i]); 
	      } 
			else { 
				station = arr.splice(pos[0],1);
				return station;
				}
			}
		channels = JSON.parse(json);
		index = req.body.station.match(/\d/g);
		console.log(index);
		for (i in index){ index.splice(i,1,parseInt(index[i])) }
		dulute(index,channels);
		client.set(req.facts+':channels', JSON.stringify(channels), function(){
			if(err){console.log(err)};
			client.smembers(req.facts+':'+station, function(err, each){
				for (every in each)
				{
					unfollow(each[every])
				}
				client.del(req.facts+':'+station, function(err, done){})					
				});
			})
			res.redirect('/index');
			res.end();
		})
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
/*
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

function unfollow (unfurl){
	client.decr('subs@'+unfurl, function(err, score){if (score === 0){
		unsubscribe(unfurl)
	}});
}
function unsubscribe (feed){
		spfdr = http.createClient(80, 'superfeedr.com');
		datat = "hub.mode=unsubscribe&hub.verify=sync&hub.topic="+feed+"&hub.callback=http://mostmodernist.no.de/feed";
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

function subscribe (feed){
		spfdr = http.createClient(80, 'superfeedr.com');
		dataw = "hub.mode=subscribe&hub.verify=sync&hub.topic="+feed+"&hub.callback=http://mostmodernist.no.de/feed";
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

app.post('/follow/', getSesh, function(req, res){
	//path = url.parse(req.url).query;
	//queriesPls = querystring.parse(path, sep='&', eq='=');
	unfurl = decodeURIComponent(req.query.furl);
	channelName = req.body.channel;
	console.log(unfurl);  
	client.exists(unfurl, function(err,answer){
		if (err){console.log(err)}
		if (answer === 0)
			{
				client.zadd(unfurl, -1, unfurl);
				client.incr('subs@'+unfurl);
			}
		else
		{
			client.incr('subs@'+unfurl);
		}
			
	});	
	client.sadd(req.facts+':'+channelName, unfurl, function(err, elks){
			if (err){console.log(err)}
	});
	client.sismember('allfeeds1123848451', unfurl, function(err, answer){
		if (err){console.log(err)}
		if (answer === 0)
		client.sadd('allfeeds1123848451', unfurl);
	});
	subscribe(unfurl);
	res.writeHead('200');
	res.redirect('/index');
	res.end();	
	//var retr = setTimeout(function(){retrieve(channel,unfurl)}, 30000);
});

app.get('/feed', function(req, res){
	res.writeHead('200');
	//path = url.parse(req.url).query;
	//queriness = querystring.parse(path, sep='&', eq='=');
	challenge = req.query.hub.challenge;
	res.write(challenge);
	res.end();
	console.log(req.headers);
	console.log(challenge);
});

app.post('/feed', function(req, res){
	path = url.parse(req.url).query;
	queriness = querystring.parse(path, sep='&', eq='=');
	channel = queriness.channel;
	res.writeHead('200');
	res.end();
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
		console.log(d.items[x].title);
		title = d.items[x].title.replace(/&nbsp;/g, " ");
		client.zadd(unfurl, d.items[x].postedTime, title.replace(/\s/g, "_"), function(err, reply){if (err){sys.puts(err)}});
		client.zadd(unfurl,-2, d.status.title, function(err, reply){if (err){sys.puts(err)}});
		client.hmset(title.replace(/\s/g, "_"), 
			{
				"content": content,
				"summary": summary,
				"link": d.items[x].permalinkUrl,
				"title":title,
				"pic": picture,
				"furl": unfurl,
				"score": d.items[x].postedTime,
				"created": d.items[x].postedTime,
				"feed": d.status.title
			}, function(err, reply){
				if (err)
					{
						console.log("error: " + err)
					}
			});	
		console.log(d.items[x])
	};
});
// Only listen on $ node app.js

app.get('/fb', function (req, res) {
  res.redirect(facebookClient.getAuthorizeUrl({
    client_id: '190292354344532',
    redirect_uri: 'http://mostmodernist.no.de:80/auth',
    scope: 'offline_access,user_location,friends_likes,friends_events'
  }));
});

app.get('/auth', function (req, res) {
	code = req.query.code;
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
		});
		response.on('end', function(){
			 results= new querystring.parse( result );
		var access_token = results['access_token'];
		request2 = fbGetAccessToken.request('GET', '/me?fields=id,gender,name,location,locale&access_token='+access_token, {
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
				var resulting = JSON.parse(result2);
				console.log(resulting.id);
				client.exists(resulting.id, function (err, answer){
					if (answer === 1)
					{
						req.session.uid = resulting.id;
						res.redirect('./index');
						res.end();
					}
					else
					{
							// To Do: check if user already has account, get new token, but don't overwrite anything else
							req.session.uid = resulting.id;
							//getLoco(resulting.id, access_token)
							user_location = resulting.locale;
							if (resulting.location){user_location = resulting.user_location}
							client.hmset(resulting.id, 'fname', resulting.first_name, 'lname', resulting.last_name, 'gender', resulting.gender, "location", user_location, 'link', resulting.link, "access_token", access_token, function (err, rerun){
								res.writeHead('200');
								res.render('done', {locals: {title: 'mostmodernist', person: resulting}})
								res.end();
							});
							client.rpush("everybodyInTheSystem", resulting.id)
							channels = '["Culture","Business","Poiltics"]';
							client.set(resulting.id+':channels', channels)
						}						
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

/*
getLoco = (function (id, token) {
	console.log(id + '\n' + token)
	var loco = http.createClient(443, 'graph.facebook.com', secure=true);
	reqLoco = loco.request('GET', '/location?access_token='+token, {
			'Host':'graph.facebook.com',
			'Content-Length': 0
	});
	reqLoco.end();
	reqLoco.on('response', function (response){
		var location = '';
		response.on('data', function (chunk){
			location += chunk;
		});
		response.on('end', function (){
				console.log(location);
		})
	})
})	
*/


if (!module.parent) {
  app.listen(80);
  sys.puts("Express server listening on port %d", app.address().port);
}