const { DynamoDBClient, PutItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const dynamodb = new DynamoDBClient();
const ses = new SESClient();

const USERS_TABLE = process.env.USERS_TABLE;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL;

// Simple hash function using built-in crypto (scrypt)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

exports.handler = async (event) => {
    console.log("Signup Request:", JSON.stringify(event, null, 2));

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

        // Check if user exists
        const getParams = {
            TableName: USERS_TABLE,
            Key: marshall({ email }),
        };
        const { Item } = await dynamodb.send(new GetItemCommand(getParams));

        if (Item) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "User already exists" }),
            };
        }

        const hashedPassword = hashPassword(password);

        const putParams = {
            TableName: USERS_TABLE,
            Item: marshall({
                email,
                password: hashedPassword,
                createdAt: new Date().toISOString(),
            }),
        };

        await dynamodb.send(new PutItemCommand(putParams));

        // Send Welcome Email
        try {
            const emailParams = {
                Source: SOURCE_EMAIL,
                Destination: { ToAddresses: [email] },
                Message: {
                    Subject: { Data: "Welcome to Earnings Tracker!" },
                    Body: {
                        Text: { Data: `Hi there!\n\nWelcome to Earnings Tracker. You can now subscribe to earnings notifications for your favorite stocks.\n\nBest,\nEarnings Tracker Team` },
                        Html: { Data: `<h1>Welcome to Earnings Tracker!</h1><p>You can now subscribe to earnings notifications for your favorite stocks.</p>` },
                    },
                },
            };
            await ses.send(new SendEmailCommand(emailParams));
        } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
            // Don't fail signup if email fails, but log it
        }

        return {
            statusCode: 201,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "User created successfully" }),
        };
    } catch (error) {
        console.error("Signup Error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Internal Server Error" }),
        };
    }
};
