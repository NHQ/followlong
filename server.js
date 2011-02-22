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

function getSesh (req, res, next){
	console.log(req.session.uid);
	if(!req.session.uid)
		res.redirect('/fb');
	if(req.session.uid)
	{
		console.log(req.session.uid);
		req.facts = req.session.uid;
		next();
	}
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

app.get('/newFeed/', getSesh, function (req, res){
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
});

app.get('/init', getSesh, function (req, res){
	res.writeHead('200');
	client.hgetall(req.facts+'@feeds', function (err, obj){
		res.write(JSON.stringify(obj));
		res.end();
	})
});

app.get('/userChannels', getSesh, function (req, res){
		res.writeHead('200');
		client.smembers(req.facts+'@channels', function (err, channels){
			if(err){console.log(err)}
			res.write(JSON.stringify(channels))
			res.end();
		})
});

app.post('/newChannel', getSesh, function (req, res) {
	res.writeHead('200');
	client.sadd(req.facts+'@channels', req.query.channel, function(err, result){
		if (err){res.write('error');res.end()}
		res.write(JONS.stingify(result))
		res.end()
	})
});

app.post('/deleteChannel', getSesh, function (req, res){
	res.writeHead('200');
	client.srem(req.facts+'@channels', req.query.channel, function (err, result){
		if (err)res.write("error");res.end()
	})
});

app.post('/followFeed', getSesh, function (req, res){
	res.writeHead('200');
	console.log(req.query.feed);
	client.hset(req.facts+'@feeds', decodeURIComponent(req.query.feed), "[]", function (err, result){
		if (err){res.write('error');res.end()}
		res.write('result');
		res.end();
		follow(req.query.feed);
	})
});

app.post('/followNot', getSesh, function (req, res){
	res.writeHead('200');
	client.hdel(req.facts+'@feeds', decodeURIComponent(req.query.feed), function (err, result){
		if (err){res.write('error');res.end()}
		res.write('Feed Followed Not');
		res.end();
		followNot(req.query.feed)
	})
});

app.post('/addChannel', getSesh, function (req, res){
	res.writeHead('200');
	client.hget(req.facts+'@feeds', decodeURIComponent(req.query.feed), function (err, json){
		if (err){res.write('error');res.end()}
		var channels = JSON.parse(json);
		channels.push(req.query.channel);
		client.hset(req.facts+'@feeds', decodeURIComponent(req.query.feed), JSON.stringify(channels), function (err, okay){
			if (err){res.write('there was an error');res.end()}
			if (okay){res.write(okay);res.end()}
		})
	})
});

app.get('/getFeed', getSesh, function (req, res){
	res.writeHead('200');
	client.zrevrangebyscore(decodeURIComponent(req.query.feed), epoch(), epoch()-450061, "limit", "0", "75", function(err, titles){
		if(err){res.write('error')}
		else
		{
			var multi = client.multi();
			for (t in titles)
			{
				multi.hmget(title[t], 'title', 'feed', 'score')
			}
			mulit.exec(function (err, arrayRay){
				res.write(JSON.stringify(arrayRay));
				res.end();
			})
		}
	})
});

app.get('/', getSesh, function(req, res){

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
app.get("/chat.html", function(req, res){
var path = url.parse(req.url).pathname;
      fs.readFile(__dirname + path, function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': path == 'json.js' ? 'text/javascript' : 'text/html'})
        res.write(data, 'utf8');
        res.end();
      });
}),

app.get("/schema.json", function(req, res){
var path = url.parse(req.url).pathname;
      fs.readFile(__dirname + path, function(err, data){
        if (err) return send404(res);
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.write(data, 'utf8');
        res.end();
      });
}),
*/
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

function follow(feed){
	var unfurl = decodeURIComponent(feed);
	console.log(unfurl);  
	client.exists(unfurl, function(err,answer){
		if (err){console.log(err)}
		if (answer === 0)
			{
				client.zadd(unfurl, -1, unfurl);
				client.incr('subs@'+unfurl);
				subscribe(unfurl);
			}
		else
		{
			client.incr('subs@'+unfurl);
		}			
	});
	client.sismember('allfeeds1123848451', unfurl, function(err, answer){
		if (err){console.log(err)}
		if (answer === 0)
		client.sadd('allfeeds1123848451', unfurl);
	});
};
function followNot (furl){
	var unfurl = decodeURIComponent(furl);
	client.decr('subs@'+unfurl, function(err, score){
		if (score === 0){
		client.del(unfurl);
		unsubscribe(unfurl)
	}});
};
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
		var spfdr = http.createClient(80, 'superfeedr.com');
		var dataw = "hub.mode=subscribe&hub.verify=sync&hub.topic="+feed+"&hub.callback=http://mostmodernist.no.de/feed";
		var request = spfdr.request('POST', '/hubbub', {
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

app.post('/follow/', getSesh, function(req, res){
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
*/

app.get('/feed', function(req, res){
	res.writeHead('200');
	//path = url.parse(req.url).query;
	//queriness = querystring.parse(path, sep='&', eq='=');
	var challenge = req.query.hub.challenge;
	res.write(challenge);
	res.end();
	console.log(req.headers);
	console.log(challenge);
});

app.post('/feed', function(req, res){
	var path = url.parse(req.url).query;
	var queriness = querystring.parse(path, sep='&', eq='=');
	var channel = queriness.channel;
	res.writeHead('200');
	res.end();
	var d = req.body;
	var dl = d.items.length;
	var unfurl = d.status.feed
	for (x = 0; x < dl; ++x){
		var picture = ""; // do what the green line says!
		var content = "";	
		var summary = "";
		if (d.items[x].standardLinks && d.items[x].standardLinks.picture){
			picture = d.items[x].standardLinks.picture[0].href
		};
		if (d.items[x].content){
			content = d.items[x].content
		};
		if (d.items[x].summary){
			summary = d.items[x].summary
		};
		var title = d.items[x].title.replace(/&nbsp;/g, " ");
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
	var code = req.query.code;
	var url = '/oauth/access_token?client_id=190292354344532&redirect_uri=http%3A%2F%2Fmostmodernist.no.de%3A80%2Fauth&client_secret=6a8433e613782515148f6b2ee038cb1a&code='+code;
	var fbGetAccessToken = http.createClient(443, 'graph.facebook.com', secure=true);
	var request = fbGetAccessToken.request('POST', url, {
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
		var request2 = fbGetAccessToken.request('GET', '/me?fields=id,gender,name,location,locale&access_token='+access_token, {
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
				client.exists(resulting.id, function (err, answer){
					if (answer === 1)
					{
						console.log(resulting.id);
						req.session.uid = resulting.id;
						res.redirect('./2');
						res.end();
					}
					else
					{
							// To Do: check if user already has account, get new token, but don't overwrite anything else
							req.session.uid = resulting.id;
							//getLoco(resulting.id, access_token)
							var user_location = resulting.locale;
							if (resulting.location){user_location = resulting.user_location}
							client.hmset(resulting.id, 'fname', resulting.first_name, 'lname', resulting.last_name, 'gender', resulting.gender, "location", user_location, 'link', resulting.link, "access_token", access_token, function (err, rerun){
								res.writeHead('200');
								res.render('done', {locals: {title: 'mostmodernist', person: resulting}})
								res.end();
							});
							client.rpush("everybodyInTheSystem", resulting.id)
							var channels = ["Culture","Business","Politics","Work","Local"];
							for (c = 0;c < 3;++c) {client.sadd(resulting.id+'@channels', channels[c])};
							// client.hmset(resulting.id+'@feeds', channels[0],placeHolder,channels[1],placeHolder,channels[2],placeHolder)
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