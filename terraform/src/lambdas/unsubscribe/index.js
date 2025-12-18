const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const dynamodb = new DynamoDBClient();
const SUBSCRIPTIONS_TABLE = process.env.TABLE_NAME;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";

function verifyToken(token) {
    try {
        const [header, payload, signature] = token.split(".");
        const expectedSignature = crypto
            .createHmac("sha256", JWT_SECRET)
            .update(`${header}.${payload}`)
            .digest("base64url");

        if (signature !== expectedSignature) return null;

        const data = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (data.exp < Math.floor(Date.now() / 1000)) return null;

        return data;
    } catch (e) {
        return null;
    }
}

exports.handler = async (event) => {
    console.log("Unsubscribe Request:", JSON.stringify(event, null, 2));

    if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "OPTIONS,POST,DELETE",
            },
            body: JSON.stringify({ message: "CORS OK" }),
        };
    }

    const authHeader = event.headers["authorization"] || event.headers["Authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
            statusCode: 401,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Unauthorized" }),
        };
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return {
            statusCode: 401,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Unauthorized" }),
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { ticker } = body;

        if (!ticker) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Ticker is required" }),
            };
        }

        const params = {
            TableName: SUBSCRIPTIONS_TABLE,
            Key: marshall({
                email: decoded.email,
                ticker: ticker
            }),
        };

        await dynamodb.send(new DeleteItemCommand(params));

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Unsubscribed successfully" }),
        };
    } catch (error) {
        console.error("Unsubscribe Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};
