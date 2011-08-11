/**
 * Module dependencies.
 */

var express = require('express'),
mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var app = module.exports = express.createServer(),
    redis = require("./redis"),
	connect = require('connect'),
  _ = require('underscore')
    ,client = redis.createClient(),
    sub = redis.createClient(),
    pub = redis.createClient(),
    crypto = require('crypto')
    , http = require('http')
    , url = require('url')
    , user = require('./user-model')
	, querystring = require('querystring')
    , fs = require('fs')
    , sys = require(process.binding('natives').util ? 'util' : 'sys')
    , server
	, newfeed = require('./models/newfeed')
	, newuser = require('./models/user')
	, RedisStore = require('connect-redis')(express), multi
	, local = http.createClient(80, 'mostmodernist.no.de')
	, fb = require('facebook-js'),
  mongoose = require('mongoose'),
  async = require('async'),
  request = require('request');

function epoch(){return Math.round(new Date().getTime()/1000.0)};

client.on("error", function (err) {
    console.log("Error " + err);
});

// Configuration

app.configure(function(){
  app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: 'superSecret!', cookie: {maxAge: 60000 * 2000}, store: new RedisStore()}));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Mongo Sesh
function getSesh (req, res, next){
  if(!req.session._id)
		res.redirect('/fb');
	if(req.session._id)
	{
		req.perp = mongoose.model('Person');
		req.perp.findById(req.session._id, function (err, individual){
			if (err){console.log(err);}
			req.session.regenerate(function(err){
				//console.log(individual);
				req.session._id = individual._id;
				req.facts = individual.doc.facts;
				req.person = individual;
				next();
			});
		});}
}

//Redis Sesh
/*
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
*/
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
  var feeds = req.person.wire.feeds;
  var newFeed = req.query.furl, channels = [];
  async.map(feeds, function(each,callback){
    _.each(each.chans, function(e){channels.push(e)})
    callback(null,null);
    }, function(err){
      res.render('newFeed',{locals:{newFeed:newFeed, channels:_.uniq(_.flatten(channels))}});
    })
});

app.get('/link', function (req, res ){
	res.writeHead('200');
	title = decodeURIComponent(req.query.title);
	client.hget(title, 'link', function (err, link){
		res.redirect(link);
		res.end()
	})
});
app.get('/try', function(req,res){
    req.session._id = '4e41cffe650aefed11000001'
    res.redirect('/init')
});
app.get('/init', getSesh, function (req, res){
  var feeds = req.person.wire.feeds,
  channels = [];
  async.map(feeds, function(each, callback){
    _.each(each.chans, function(e){channels.push(e)});
    client.zrevrangebyscore(each.feed, epoch(), epoch()-900061, "limit", "0", "25", function(err, titles){
    if(err){res.write('error')}
		else
		{
			var multi = client.multi();
			for (t in titles)
			{
				multi.hmget(titles[t], 'title', 'feed', 'score', 'link')
			}
			multi.exec(function (err, arrayRay){
        each.titles = arrayRay;
        callback(null, each)
			})
		}
	})}, function(err, content){
    console.log(channels);
      req.person.wire.feeds = content;
      res.render('index', {locals: {feeds: req.person.wire.feeds, channels:_.uniq(_.flatten(channels))}});
  })
});

app.get('/userChannels', getSesh, function (req, res){
		res.writeHead('200');
    res.write(JSON.stringify(req.person.doc.wire.feeds))
    res.end();
});

app.post('/newChannel', getSesh, function (req, res) {
	res.writeHead('200');
	client.sadd(req.facts+'@channels', req.query.channel, function(err, result){
		if (err){res.write('error');res.end()}
		res.write(result)
		res.end()
	})
});

app.post('/deleteChannel', getSesh, function (req, res){
	res.writeHead('200');
	client.srem(req.facts+'@channels', req.query.channel, function (err, result){
		if (err)res.write("error");res.end()
	})
});

app.get('/sesh-test', getSesh, function(req,res){
    req.person.facts.mname = "octavio";
    req.person.save(function(e,r){
      res.writeHead('200')
      res.write(e+'\n'+r.facts.mname);
      res.end()
    })
})

app.post('/followFeed', getSesh, function (req, res){
  req.person.wire.feeds.push({feed:decodeURIComponent(req.body.feed), chans:JSON.parse(req.body.channels)});
  req.person.save(function(e,r){
    console.log(e+'\n'+JSON.stringify(r.wire.feeds));
    follow(req.body.feed);
    res.writeHead('200');
    res.end()
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

app.get('/getFeed', function (req, res){
  console.log(req.query);
	client.zrevrangebyscore(decodeURIComponent(req.query.feed), epoch(), epoch()-450061, "limit", "0", "75", function(err, titles){
		if(err){res.write('error')}
		else
		{
			var multi = client.multi();
			for (t in titles)
			{
				multi.hmget(titles[t], 'title', 'feed', 'score', 'link')
			}
			multi.exec(function (err, arrayRay){
        console.log(arrayRay);
          res.writeHead('200');
				res.write(JSON.stringify(arrayRay));
				res.end();
			})
		}
	})
});

app.get('/', getSesh, function(req, res){
});

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
		console.log(answer);
		if (answer == 0)
			{
				console.log('subscringing to: '+unfurl);
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
		datat = "hub.mode=unsubscribe&hub.verify=sync&hub.topic="+feed+"&hub.callback=http://74.207.246.247:3001/feed";
		var request = spfdr.request('POST', '/hubbub', {
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
		var dataw = "hub.mode=subscribe&hub.verify=async&hub.topic="+feed+"&hub.callback=http://74.207.246.247:3001/feed";
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
	if (req.query['hub.challenge'])
	{	res.writeHead('200');
	//path = url.parse(req.url).query;
	//queriness = querystring.parse(path, sep='&', eq='=');
	var challenge = req.query['hub.challenge'];
	res.write(challenge);
	res.end();
	console.log(req.headers);
	console.log(challenge);}
	else
	{
		res.writeHead('200');
		res.end();
	}
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
		client.zadd(unfurl,-2, d.status.feed, function(err, reply){if (err){sys.puts(err)}});
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
				"feed": d.status.feed
			}, function(err, reply){
				if (err)
					{
						console.log("error: " + err)
					}
			});	
		console.log(d)
	};
});
// Only listen on $ node app.js
/*
app.get('/fb', function (req, res) {
  res.redirect(fb.getAuthorizeUrl({
    client_id: '190292354344532',
    redirect_uri: 'http://74.207.246.247:3001/auth',
    scope: 'offline_access,user_location,friends_likes,friends_events'
  }));
});
*/
app.get('/fb', function (req, res) {
  res.redirect(fb.getAuthorizeUrl({
    client_id: '190292354344532',
    redirect_uri: 'http://74.207.246.247:3001/fb/auth',
    scope: 'user_location,user_photos'
  }));
});

// mongo auth

app.get('/fb/auth', function (req, res) {
  fb.getAccessToken('190292354344532', 'ac9d7f273a15e91ac035871d04ef1915', req.param('code'), 'http://74.207.246.247:3001/fb/auth', function (error, access_token, refresh_token) {
  fb.apiCall('GET', '/me', {access_token: access_token, fields:'id,gender,first_name, middle_name,last_name,location,locale,friends,website'}, function (err, response, body){
		console.log(body);
    client.exists(body.id, function(err,que){
      console.log(que);
      if (que == 0){
        console.log('mak new');
        var individual = mongoose.model('Person');
        var person = new individual;
        req.session._id = person._id;
        fs.mkdirSync('public/person/'+person._id, 644, function(err){console.log(err);}); //the user's image directory
        request.get('https://graph.facebook.com/'+body.id+'/picture?type=large&access_token='+access_token).pipe(fs.createWriteStream('public/person/'+person._id+'/profile.jpg'));
        person.facts.portrait='person/'+person._id+'/profile.jpg', 
        person.facts.fname = body.first_name,
        person.facts.mname = body.middle_name,
        person.facts.lname = body.last_name,
        person.facts.gender=body.gender, 
        person.facts.website=body.website, 
        person.secrets.fb_access_token= access_token,
        person.secrets.fbx=body.friends.data,
        person.secrets.fb_id=  body.id;
        person.wire.feeds= [{feed:'http://www.memeorandum.com/feed.xml', chans:['news']},{feed:'http://www.techmeme.com/feed.xml', chans:['tech']},{feed:'http://news.ycombinator.com/rss', chans:['YcombOverator']}]
        person.save(function (err, doc){
          console.log(err+'\n'+doc);
          res.redirect('/init');
          })
        client.append(body.id, person._id, function(err){})
        };
      if (que == 1){
          console.log('mack old');
          client.get(body.id, function(e,r){
            var individual = mongoose.model('Person');
            req.session._id = r ;
            individual.update({'secrets.fb_id':  body.id}, {'secrets.fb_access_token': access_token,'secrets.fbx':body.friends.data}, {upsert:false, safe:true}, function (err, doc){
            res.redirect('/init');
            })
          })            
        }
    })	
	});
  });
});

// redis auth
/*
app.get('/fb/auth', function (req, res) {
  fb.getAccessToken('190292354344532', 'ac9d7f273a15e91ac035871d04ef1915', req.param('code'), 'http://74.207.246.247:3001/fb/auth', function (error, access_token, refresh_token) {
    console.log(error || access_token);
  fb.apiCall('GET', '/me', {access_token: access_token, fields:'id,gender,first_name, middle_name,last_name,location,locale,friends,website'}, function (err, response, body){
		console.log(body);
  			client.exists(body.id, function (err, answer){
					if (answer === 1)
					{
						console.log(body.id);
						req.session.uid = body.id;
						res.redirect('./2');
						res.end();
					}
					else
					{
							// To Do: check if user already has account, get new token, but don't overwrite anything else
							req.session.uid = body.id;
							//getLoco(resulting.id, access_token)
							var user_location = body.locale;
							if (body.location){user_location = body.user_location}
							client.hmset(body.id, 'fname', body.first_name, 'lname', body.last_name, 'gender', body.gender, "location", user_location, 'link', body.link, "access_token", access_token, function (err, rerun){
								res.render('done', {locals: {title: 'mostmodernist', person: body}})
							});
							client.rpush("everybodyInTheSystem", body.id)
							var channels = ["Culture","Business","Politics","Work","Local"];
							for (c = 0;c < 3;++c) {client.sadd(body.id+'@channels', channels[c])};
							// client.hmset(resulting.id+'@feeds', channels[0],placeHolder,channels[1],placeHolder,channels[2],placeHolder)
						}
  			});
	});
  });
});

app.get('/auth', function (req, res) {
	var code = req.query.code;
	var url = '/oauth/access_token?client_id=190292354344532&redirect_uri=http%3A%2F%2F74.207.246.247%3A3001%2Fauth&client_secret=6a8433e613782515148f6b2ee038cb1a&code='+code;
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
  app.listen(3001);
  sys.puts("Express server listening on port %d", app.address().port);
}