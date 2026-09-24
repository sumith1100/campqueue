export interface Notifier {
  send(to: string, message: string): Promise<void>;
}

/** Prints messages to the server log. Default in development. */
export const consoleNotifier: Notifier = {
  async send(to, message) {
    console.log(`[sms:console] to=${to} :: ${message}`);
  },
};

/** Twilio's REST API over plain fetch, so no SDK is needed. */
export function twilioNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  return {
    async send(to, message) {
      const sid = env.TWILIO_ACCOUNT_SID;
      const token = env.TWILIO_AUTH_TOKEN;
      const from = env.TWILIO_FROM;
      if (!sid || !token || !from) throw new Error("Twilio is not configured");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: message }),
      });
      if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
    },
  };
}

export function getNotifier(): Notifier {
  return process.env.SMS_PROVIDER === "twilio" ? twilioNotifier() : consoleNotifier;
}
