const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
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
    console.log("Get Subscriptions Request:", JSON.stringify(event, null, 2));

    if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "OPTIONS,GET",
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
            body: JSON.stringify({ message: "Unauthorized or invalid token" }),
        };
    }

    try {
        const params = {
            TableName: SUBSCRIPTIONS_TABLE,
            KeyConditionExpression: "email = :email",
            ExpressionAttributeValues: marshall({
                ":email": decoded.email
            }),
        };

        const { Items } = await dynamodb.send(new QueryCommand(params));
        const subscriptions = Items.map(i => unmarshall(i));

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(subscriptions),
        };
    } catch (error) {
        console.error("Get Subscriptions Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};
