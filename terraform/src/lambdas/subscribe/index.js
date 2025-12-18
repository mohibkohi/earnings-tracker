const { DynamoDBClient, PutItemCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");
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
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
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

    // Check if subscription already exists
    const checkParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        email,
        ticker
      }),
    };

    const { Item } = await client.send(new GetItemCommand(checkParams));
    if (Item) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "You are already subscribed to this ticker" }),
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
          Source: `"Earnings Tracker" <${SOURCE_EMAIL}>`,
          Destination: { ToAddresses: [email] },
          ReplyToAddresses: [SOURCE_EMAIL],
          Message: {
            Subject: { Data: `Earnings Notification Confirmed: ${companyName} (${ticker})` },
            Body: {
              Text: { Data: `Dear Investor,\n\nThis email confirms your subscription to receive earnings notifications for ${companyName} (${ticker}).\n\nYou will receive a reminder email ${notifyWhen === 'DAY_BEFORE' ? 'one day before' : 'on the day of'} the earnings release scheduled for ${earningsDate}.\n\nThank you for using Earnings Tracker.\n\nSincerely,\nThe Earnings Tracker Team` },
              Html: {
                Data: `
                <div style="font-family: sans-serif; line-height: 1.5; color: #333; text-align: left;">
                  <h2>Earnings Notification Confirmed</h2>
                  <p>Dear Investor,</p>
                  <p>This email confirms your subscription to receive earnings notifications for <strong>${companyName} (${ticker})</strong>.</p>
                  <p>You will receive a reminder email <strong>${notifyWhen === 'DAY_BEFORE' ? 'one day before' : 'on the day of'}</strong> the earnings release scheduled for <strong>${earningsDate}</strong>.</p>
                  <p>Thank you for using Earnings Tracker.</p>
                  <p>Sincerely,<br/>The Earnings Tracker Team</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                  <p style="font-size: 0.8em; color: #888;">You are receiving this email because you subscribed to earnings alerts on Earnings Tracker. If you did not initiate this subscription, please disregard this email.</p>
                </div>
              ` },
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
