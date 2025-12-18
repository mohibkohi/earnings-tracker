const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const dynamodb = new DynamoDBClient();
const USERS_TABLE = process.env.USERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";

function verifyPassword(password, storedPassword) {
    const [salt, hash] = storedPassword.split(":");
    const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return hash === testHash;
}

function generateToken(email) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
        email,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
    })).toString("base64url");

    const signature = crypto
        .createHmac("sha256", JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest("base64url");

    return `${header}.${payload}.${signature}`;
}

exports.handler = async (event) => {
    console.log("Login Request:", JSON.stringify(event, null, 2));

    if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST",
            },
            body: JSON.stringify({ message: "CORS OK" }),
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { email, password } = body;

        if (!email || !password) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Email and password are required" }),
            };
        }

        const { Item } = await dynamodb.send(new GetItemCommand({
            TableName: USERS_TABLE,
            Key: marshall({ email }),
        }));

        if (!Item) {
            return {
                statusCode: 401,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Invalid email or password" }),
            };
        }

        const user = unmarshall(Item);
        if (!verifyPassword(password, user.password)) {
            return {
                statusCode: 401,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Invalid email or password" }),
            };
        }

        const token = generateToken(email);

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
                token,
                user: { email: user.email }
            }),
        };
    } catch (error) {
        console.error("Login Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};
