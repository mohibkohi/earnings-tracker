const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient();
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // Handle CORS for OPTIONS method
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
    const { email, ticker, companyName, earningsDate, notifyWhen } = body;

    if (!email || !ticker || !companyName || !earningsDate || !notifyWhen) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Missing required fields" }),
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
