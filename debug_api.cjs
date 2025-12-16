const https = require('https');

const url = "https://www.alphavantage.co/query?function=EARNINGS&symbol=MSFT&apikey=T2WN37VFVB5XY881";

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log("Keys:", Object.keys(json));
            if (json.Note) console.log("Note:", json.Note);
            if (json.Information) console.log("Information:", json.Information);
            if (json.quarterlyEarnings) {
                console.log("Quarterly Earnings Count:", json.quarterlyEarnings.length);
                console.log("First item:", json.quarterlyEarnings[0]);
            } else {
                console.log("quarterlyEarnings is MISSING");
            }
        } catch (e) {
            console.error("Parse error:", e);
            console.log("Raw:", data);
        }
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
