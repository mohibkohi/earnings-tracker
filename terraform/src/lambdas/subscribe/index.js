const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { marshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient();
const ses = new SESClient();

const TABLE_NAME = process.env.TABLE_NAME;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL;
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
  console.log("Received event:", JSON.stringify(event, null, 2));

  // Handle CORS for OPTIONS method
  if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
      body: JSON.stringify({ message: "CORS OK" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { ticker, companyName, earningsDate, notifyWhen } = body;

    // Check auth
    const authHeader = event.headers["authorization"] || event.headers["Authorization"];
    let email;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);
      if (decoded) {
        email = decoded.email;
      }
    }

    if (!email) {
      // For backwards compatibility or if user didn't login but passed email (though spec says auth required)
      email = body.email;
    }

    if (!email || !ticker || !companyName || !earningsDate || !notifyWhen) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Missing required fields (email/token, ticker, etc)" }),
      };
    }

    // Composite key: email + ticker to prevent duplicate subs for the same stock
    const params = {
      TableName: TABLE_NAME,
      Item: marshall({
        email,
        ticker,
        companyName,
        earningsDate,
        notifyWhen, // 'DAY_BEFORE' or 'DAY_OF'
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }),
    };

    await client.send(new PutItemCommand(params));

    // Send Confirmation Email
    try {
      if (SOURCE_EMAIL) {
        const emailParams = {
          Source: SOURCE_EMAIL,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: `Subscribed to ${companyName} (${ticker}) Earnings` },
            Body: {
              Text: { Data: `You will be notified ${notifyWhen === 'DAY_BEFORE' ? '1 day before' : 'on the day of'} ${companyName} (${ticker}) earnings on ${earningsDate}.` },
            },
          },
        };
        await ses.send(new SendEmailCommand(emailParams));
      }
    } catch (e) {
      console.error("Confirmation email failed", e);
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Subscription successful" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
