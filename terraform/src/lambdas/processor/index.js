const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");

const dbClient = new DynamoDBClient();
const sesClient = new SESClient();

const TABLE_NAME = process.env.TABLE_NAME;
const SOURCE_EMAIL = process.env.SOURCE_EMAIL; // User needs to set this in Terraform or manually verify an email

exports.handler = async (event) => {
    console.log("Processor started. Current time:", new Date().toISOString());

    try {
        // 1. Scan for ACTIVE subscriptions
        // NOTE: For MVP scale (hundreds), SCAN is fine. For production at scale, use GSI or Query.
        const scanParams = {
            TableName: TABLE_NAME,
            FilterExpression: "#status = :active",
            ExpressionAttributeNames: {
                "#status": "status",
            },
            ExpressionAttributeValues: marshall({
                ":active": "ACTIVE",
            }),
        };

        const { Items } = await dbClient.send(new ScanCommand(scanParams));

        if (!Items || Items.length === 0) {
            console.log("No active subscriptions found.");
            return;
        }

        const subscriptions = Items.map(item => unmarshall(item));
        console.log(`Found ${subscriptions.length} active subscriptions.`);

        const today = new Date();
        // Normalize today to YYYY-MM-DD
        const todayStr = today.toISOString().split('T')[0];

        // Calculate tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // 2. Filter for eligibility
        const eligibleSubs = subscriptions.filter(sub => {
            if (sub.notifyWhen === 'DAY_OF' && sub.earningsDate === todayStr) return true;
            if (sub.notifyWhen === 'DAY_BEFORE' && sub.earningsDate === tomorrowStr) return true;
            return false;
        });

        console.log(`${eligibleSubs.length} subscriptions eligible for notification today.`);

        // 3. Send Emails and Update DB
        for (const sub of eligibleSubs) {
            await sendNotification(sub);
            await updateSubscriptionStatus(sub);
        }

    } catch (error) {
        console.error("Processor Error:", error);
        throw error; // Cause Lambda retry? Or just log? For simplified MVP, throwing is okay but might cause retries.
    }
};

async function sendNotification(sub) {
    const subject = `Earnings Reminder: ${sub.companyName} (${sub.ticker})`;

    // Basic unsubscribe handled by just not resending. 
    // Real unsubscribe link requires an endpoint to separate logic. 
    // For MVP: "To unsubscribe, this is a one-time notification per earnings."

    const bodyText = `
Hello,

This is a reminder that ${sub.companyName} (${sub.ticker}) is scheduled to report earnings on ${sub.earningsDate}.

Preference: ${sub.notifyWhen === 'DAY_OF' ? 'Day of Earnings' : 'Day Before Earnings'}

Best,
Earnings Tracker Team
  `;

    const params = {
        Source: `"Earnings Tracker" <${SOURCE_EMAIL}>`,
        Destination: {
            ToAddresses: [sub.email],
        },
        ReplyToAddresses: [SOURCE_EMAIL],
        Message: {
            Subject: {
                Data: subject,
            },
            Body: {
                Text: {
                    Data: bodyText,
                },
                Html: {
                    Data: `
                        <div style="font-family: sans-serif; line-height: 1.5; color: #333; text-align: left;">
                            <h2>Earnings Reminder</h2>
                            <p>Hello,</p>
                            <p>This is a reminder that <strong>${sub.companyName} (${sub.ticker})</strong> is scheduled to report earnings on <strong>${sub.earningsDate}</strong>.</p>
                            <p>You requested this notification for: <em>${sub.notifyWhen === 'DAY_OF' ? 'Day of Earnings' : 'Day Before Earnings'}</em>.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                            <p style="font-size: 0.8em; color: #888;">This is a one-time notification for this event. To manage your subscriptions, visit Earnings Tracker.</p>
                        </div>
                    `
                }
            },
        },
    };

    try {
        await sesClient.send(new SendEmailCommand(params));
        console.log(`Email sent to ${sub.email} for ${sub.ticker}`);
    } catch (err) {
        console.error(`Failed to send email to ${sub.email}:`, err);
        // Don't throw, so we continue to next sub
    }
}

async function updateSubscriptionStatus(sub) {
    // Update status to 'SENT' so we don't spam if script runs again same day
    // (Though logic shouldn't pick it up if date passes, but safer to mark sent)

    const params = {
        TableName: TABLE_NAME,
        Key: marshall({
            email: sub.email,
            ticker: sub.ticker
        }),
        UpdateExpression: "SET #status = :sent, lastNotified = :now",
        ExpressionAttributeNames: {
            "#status": "status"
        },
        ExpressionAttributeValues: marshall({
            ":sent": "SENT",
            ":now": new Date().toISOString()
        })
    };

    try {
        await dbClient.send(new UpdateItemCommand(params));
        console.log(`Updated status to SENT for ${sub.email} / ${sub.ticker}`);
    } catch (err) {
        console.error(`Failed to update DB for ${sub.email}:`, err);
    }
}
