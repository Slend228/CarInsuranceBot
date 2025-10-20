require("dotenv").config();
const mindee = require("mindee");
const TelegramBot = require("node-telegram-bot-api");
const { GoogleGenAI } = require("@google/genai");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { formatDate } = require("./formatDate");

// Load tokens
const token = process.env.TELEGRAM_BOT_TOKEN;
const mindeeApiKey = process.env.MINDEE_V2_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const MINDEE_MODEL_ID = "7d772882-6b4a-4a49-b025-ef976821b073";

// Init
const bot = new TelegramBot(token, { polling: true });
const mindeeClient = new mindee.ClientV2({ apiKey: mindeeApiKey });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Bot commands (menu)
bot.setMyCommands([
	{ command: "/start", description: "Start the car insurance process" },
	{ command: "/ai", description: "Ask a question about car insurance" },
]);

// History of user questions for each chat
const userAIHistory = {}; // userId -> [{ role, text }, ...]

const systemPrompt = `
You are CarInsuranceBot. 
Answer only questions related to car insurance. 
If the user asks something unrelated, politely say you can only help with car insurance.
Always be concise, clear, and user-friendly.
`;

async function callGemini(userId, userMessage) {
	try {
		if (!userAIHistory[userId]) userAIHistory[userId] = [];

		const contents = [
			{ role: "user", parts: [{ text: systemPrompt }] },
			...userAIHistory[userId].map((h) => ({
				role: h.role === "assistant" ? "model" : h.role,
				parts: [{ text: h.text }],
			})),
			{ role: "user", parts: [{ text: userMessage }] },
		];

		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contents }),
			}
		);

		const data = await res.json();

		// Gemini Universal Response Parser
		const text =
			data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
			data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(" ") ||
			"⚠️ No response text from Gemini.";

		const cleaned = text.replace(/\*\*/g, "").trim();

		userAIHistory[userId].push({ role: "user", text: userMessage });
		userAIHistory[userId].push({ role: "model", text: cleaned });

		return cleaned;
	} catch (err) {
		console.error("Gemini ultra error:", err);
		return "⚠️ Could not get response from Gemini.";
	}
}

// Passport processing
async function processPassport(filePath) {
	try {
		const inputSource = new mindee.PathInput({ inputPath: filePath });
		const response = await mindeeClient.enqueueAndGetInference(inputSource, {
			modelId: MINDEE_MODEL_ID,
		});
		const fields = response?.rawHttp?.inference?.result?.fields || {};
		const getValue = (key) => fields[key]?.value || "Not detected";

		return `
📘 *Passport Data:*
• Full Name: ${getValue("full_name")}
• Given Names: ${getValue("given_names")}
• Surname: ${getValue("surname")}
• Birth Date: ${formatDate(getValue("birth_date"))}
• Passport Number: ${getValue("passport_number")}
• Issuing Country: ${getValue("issuing_country")}
• Expiration Date: ${formatDate(getValue("expiration_date"))}
`;
	} catch (err) {
		console.error("Passport error:", err);
		throw err;
	}
}

// Vehicle processing
async function processVehicle(filePath) {
    try {
        const inputSource = new mindee.PathInput({ inputPath: filePath });
        const response = await mindeeClient.enqueueAndGetInference(inputSource, {
            modelId: MINDEE_MODEL_ID,
        });

        const fields =
            response?.rawHttp?.inference?.result?.fields ||
            response?.document?.inference?.prediction?.fields ||
            response?.document?.inference?.pages?.[0]?.prediction?.fields ||
            {};

        const getValue = (key) => fields[key]?.value || null;

        let registrationNumber = getValue("registration_number") || getValue("document_number");

        // 2️⃣ If the standard fields are not suitable, search the text on the page
        if (!registrationNumber || registrationNumber.match(/\d{4}-\d{2}-\d{2}/)) {
            const pages = response?.document?.inference?.pages || [];
            const allText = pages.map(p => p.inference.text).join(" ") || "";
            
            const plateMatch = allText.match(/\b[A-Z0-9\-]{4,10}\b/g);
            if (plateMatch) {
                registrationNumber = plateMatch[0];
            } else {
                registrationNumber = "Not detected";
            }
        }

        return `
🚗 *Vehicle Data:*
• Make: ${getValue("vehicle_make")}
• Model: ${getValue("vehicle_model")}
• Year: ${getValue("manufacturing_year")}
• VIN: ${getValue("vin")}
• Registration Number: ${registrationNumber}
• Owner Name: ${getValue("owner_name")}
`;
    } catch (err) {
        console.error("Vehicle error:", err);
        throw err;
    }
}

const STATES = {
	START: "start",
	WAITING_PASSPORT: "waiting_passport",
	WAITING_VEHICLE: "waiting_vehicle",
	PRICE_QUOTATION: "price_quotation",
	POLICY_ISSUED: "policy_issued",
	AI_CONVERSATION: "ai_conversation",
};

const userStates = {}; // userId -> state
const userData = {}; // userId -> collected info
const contextBeforeAI = {}; // userId -> previous state

bot.onText(/\/testgemini/, async (msg) => {
	const chatId = msg.chat.id;
	try {
		const response = await ai.models.generateContent({
			model: "gemini-2.0-flash",
			contents: [
				{
					role: "user",
					parts: [{ text: "Say hello like a car insurance bot." }],
				},
			],
		});

		const text =
			response?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
			response?.candidates?.[0]?.content?.parts?.[0]?.text ||
			"⚠️ No response text from Gemini.";

		await bot.sendMessage(chatId, text);
	} catch (err) {
		console.error("Gemini test error:", err);
		await bot.sendMessage(chatId, "❌ Gemini API test failed: " + err.message);
	}
});

bot.onText(/\/ai/, async (msg) => {
	const chatId = msg.chat.id;
	const userId = msg.from.id;

	contextBeforeAI[userId] = userStates[userId];
	userStates[userId] = STATES.AI_CONVERSATION;

	await bot.sendMessage(chatId, "💬 What would you like to ask?");
});

// Start command
bot.onText(/\/start/, async (msg) => {
	const chatId = msg.chat.id;
	const userId = msg.from.id;

	userStates[userId] = STATES.START;
	userData[userId] = {};

	const welcomeMessage = `
🚗 *Welcome to Car Insurance Bot!*

I'll help you get your car insured in minutes using AI document recognition.

I'll need:
📄 Your *passport photo*
🚙 Your *vehicle registration document*

💰 Fixed insurance cost: *$100*

You can ask me *any question anytime*, and I'll reply instantly.

Ready to begin?
  `;

	const options = {
		parse_mode: "Markdown",
		reply_markup: {
			inline_keyboard: [
				[{ text: "🚀 Start Application", callback_data: "start_insurance" }],
				[{ text: "💬 Ask AI a question", callback_data: "ai_question" }],
			],
		},
	};

	await bot.sendMessage(chatId, welcomeMessage, options);
});

// Photo handler
bot.on("photo", async (msg) => {
	const chatId = msg.chat.id;
	const userId = msg.from.id;
	const fileId = msg.photo[msg.photo.length - 1].file_id;
	const filePath = path.join(__dirname, "input.jpg");

	try {
		const fileLink = await bot.getFileLink(fileId);
		const response = await fetch(fileLink);
		const buffer = await response.arrayBuffer();
		fs.writeFileSync(filePath, Buffer.from(buffer));

		if (!userStates[userId] || userStates[userId] === STATES.WAITING_PASSPORT) {
			await bot.sendMessage(chatId, "🔍 Processing passport...");
			const result = await processPassport(filePath);
			userData[userId].passport = result;
			await bot.sendMessage(chatId, result, { parse_mode: "Markdown" });

			const options = {
				reply_markup: {
					inline_keyboard: [
						[{ text: "✅ Correct", callback_data: "confirm_passport" }],
						[{ text: "❌ Retake", callback_data: "passport_retake" }],
						[{ text: "💬 Ask AI", callback_data: "ai_question" }],
					],
				},
			};
			await bot.sendMessage(chatId, "Is this information correct?", options);
		} else if (userStates[userId] === STATES.WAITING_VEHICLE) {
			await bot.sendMessage(chatId, "🔍 Processing vehicle document...");
			const result = await processVehicle(filePath, MINDEE_MODEL_ID);
			userData[userId].vehicle = result;
			await bot.sendMessage(chatId, result, { parse_mode: "Markdown" });

			const options = {
				reply_markup: {
					inline_keyboard: [
						[{ text: "✅ Correct", callback_data: "confirm_vehicle" }],
						[{ text: "❌ Retake", callback_data: "vehicle_retake" }],
						[{ text: "💬 Ask AI", callback_data: "ai_question" }],
					],
				},
			};
			await bot.sendMessage(chatId, "Is this information correct?", options);
		}
	} catch (err) {
		console.error("Processing error:", err);
		bot.sendMessage(chatId, "❌ Failed to process image. Try again.");
	} finally {
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
	}
});

// Callback handler
bot.on("callback_query", async (callbackQuery) => {
	const message = callbackQuery.message;
	const data = callbackQuery.data;
	const chatId = message.chat.id;
	const userId = callbackQuery.from.id;

	await bot.answerCallbackQuery(callbackQuery.id);

	switch (data) {
		case "start_insurance":
			userStates[userId] = STATES.WAITING_PASSPORT;
			await bot.sendMessage(
				chatId,
				"📄 Step 1: Upload your *passport photo* (main page).",
				{ parse_mode: "Markdown" }
			);
			break;

		case "confirm_passport":
			userStates[userId] = STATES.WAITING_VEHICLE;
			await bot.sendMessage(
				chatId,
				"🚙 Step 2: Upload your *vehicle registration document*.",
				{ parse_mode: "Markdown" }
			);
			break;

		case "confirm_vehicle":
			userStates[userId] = STATES.PRICE_QUOTATION;
			await bot.sendMessage(
				chatId,
				"💵 Insurance Price Quotation\nThe fixed price is *$100*. Do you agree?",
				{
					parse_mode: "Markdown",
					reply_markup: {
						inline_keyboard: [
							[{ text: "✅ Agree", callback_data: "price_agree" }],
							[{ text: "❌ Disagree", callback_data: "price_disagree" }],
							[{ text: "💬 Ask AI", callback_data: "ai_question" }],
						],
					},
				}
			);
			break;

		case "price_agree":
			userStates[userId] = STATES.POLICY_ISSUED;

			const policyPrompt = `
Generate a simple car insurance policy confirmation.
Policy holder: ${userData[userId]?.passport || "Unknown"}
Vehicle: ${userData[userId]?.vehicle || "Unknown"}
Coverage: Full
Premium Paid: $100
Valid From: ${new Date().toLocaleDateString()}
Valid Until: ${new Date(
				new Date().setFullYear(new Date().getFullYear() + 1)
			).toLocaleDateString()}
`;

			await bot.sendMessage(chatId, "✅ Payment confirmed! Generating policy...");

			try {
				const policyText = await callGemini(userId, policyPrompt);
				await bot.sendMessage(chatId, policyText);
			} catch (err) {
				console.error("Gemini error:", err);
				await bot.sendMessage(chatId, "⚠️ Failed to generate policy text.");
			}
			break;

		case "price_disagree":
			await bot.sendMessage(
				chatId,
				"❌ Sorry! $100 is the only available price.",
				{
					reply_markup: {
						inline_keyboard: [
							[{ text: "✅ Agree", callback_data: "price_agree" }],
							[{ text: "❌ Exit", callback_data: "cancel_application" }],
							[{ text: "💬 Ask AI", callback_data: "ai_question" }],
						],
					},
				}
			);
			break;

		case "ai_question":
			contextBeforeAI[userId] = userStates[userId];
			userStates[userId] = STATES.AI_CONVERSATION;
			await bot.sendMessage(chatId, "💬 What would you like to ask?");
			break;

		case "continue_process":
			const prevState = contextBeforeAI[userId] || STATES.START;
			userStates[userId] = prevState;

			await bot.sendMessage(chatId, "✅ Continuing your process...");

			if (prevState === STATES.WAITING_PASSPORT) {
				await bot.sendMessage(
					chatId,
					"📄 Please upload your *passport photo* (main page).",
					{ parse_mode: "Markdown" }
				);
			} else if (prevState === STATES.WAITING_VEHICLE) {
				await bot.sendMessage(
					chatId,
					"🚙 Please upload your *vehicle registration document*.",
					{ parse_mode: "Markdown" }
				);
			} else if (prevState === STATES.PRICE_QUOTATION) {
				await bot.sendMessage(
					chatId,
					"💵 The fixed price is *$100*. Do you agree?",
					{
						parse_mode: "Markdown",
						reply_markup: {
							inline_keyboard: [
								[{ text: "✅ Agree", callback_data: "price_agree" }],
								[{ text: "❌ Disagree", callback_data: "price_disagree" }],
							],
						},
					}
				);
			} else {
				await bot.sendMessage(
					chatId,
					"🚗 You can type /start to begin again."
				);
			}
			break;

		case "cancel_application":
			await bot.sendMessage(chatId, "🚫 You canceled the process.");
			break;
	}
});

// Message handler with AI
bot.on("message", async (msg) => {
	const chatId = msg.chat.id;
	const userId = msg.from.id;
	const text = msg.text;

	if (!text || text.startsWith("/")) return;

	// If the user has asked the AI a question (in any state)
	if (userStates[userId] === STATES.AI_CONVERSATION) {
		const reply = await callGemini(userId, text);
		const options = {
			reply_markup: {
				inline_keyboard: [
					[{ text: "💬 Ask another question", callback_data: "ai_question" }],
					[{ text: "▶ Continue", callback_data: "continue_process" }],
				],
			},
		};
		await bot.sendMessage(chatId, reply, options);
		return;
	}

	// If the user is not in the AI chat but has written a question
	if (
		userStates[userId] &&
		![STATES.WAITING_PASSPORT, STATES.WAITING_VEHICLE].includes(
			userStates[userId]
		) &&
		text.length > 3
	) {
		// Treat as a question to AI without violating the state
		const reply = await callGemini(userId, text);
		await bot.sendMessage(chatId, reply);
	}
});