// to do: change 'mySubs' to accord with user model

var redis = require("../redis"),
	newU = redis.createClient(),
	crypto = require('crypto'),
	hashed_password,
	salt,
	_password;
	
exports.fUSR = function(email, password, id){
	
			authenticate = function(plaintext){
				return encryptPassword(plaintext) === hashed_password;
			},
			
			makeSalt = function(){
				return Math.round((new Date().valueOf() * Math.random())) + '';
			},
			
			encryptPassword = function(password){
				return crypto.createHmac('sha1', salt).update(password).digest('hex');
			},

			doit = function(password){
				_password = password;
				salt = makeSalt();
				hashed_password = encryptPassword(password)
			},
			
			mak = function(){
				doit()
				newU.hset(email, 'password', hashed_password);
				newU.hset(email, 'salt', salt);
				newU.hset(email, 'id', id)
			},
 mak()
};