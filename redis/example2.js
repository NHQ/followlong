var client = require("redis").createClient();

client.hmset("hosts", "mjr", "1", "another", "23", "home", "1234");
client.hgetall("hosts", function (err, obj) {
    console.dir(obj);
});
