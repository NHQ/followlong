var redis = require("redis"),
    client = redis.createClient(),
    now = Date.now(),
    stdin = process.openStdin();
    
redis.debug_mode = true;

client.hset("waiting", "start", now, redis.print);
client.hset("waiting", now, "waiting start", redis.print);

console.log("Wait for reconnection, if you like, then press return to send more commands.");

stdin.on("data", function () {
    console.log("Done waiting, sending a couple of commands:");
    client.hget("waiting", "start", function(err, wait_start) {
        console.log("first hget returned " + err + ", " + wait_start);
        client.hget("waiting", wait_start, function(err2, descr) {
            console.log("second hget returned " + err2 + ", " + descr);
        });
    });
});

stdin.on("end", function () {
    client.quit();
});
