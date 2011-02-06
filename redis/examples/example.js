var redis = require("redis"),
    client = redis.createClient();
    
redis.debug_mode = true;

client.set("some key", "Some value\r\nAnd another value.");
client.get("some key", function (err, res) {
    console.log("Result: (" + res.toString() + ")");
    console.dir(res);
    client.quit();
});
