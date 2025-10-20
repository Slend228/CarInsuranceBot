  Vehicle Car Insurance Telegram Bot

  This Telegram bot automates the process of generating vehicle insurance by processing passport and vehicle registration document.<br>
  It uses Mindee API for document data extraction and Gemini API for generating the final insurance policy and AI-based responses.<br>

  ✨ Features:

  Passport and vehicle document recognition via Mindee API.<br>
  AI-generated insurance policy using Gemini API.<br>
  Step-by-step interactive flow with inline confirmations.<br>
  Optional AI chat mode for user questions (/ai command).<br>
  Error handling and fallback messages for failed requests.<br>
  Clear and user-friendly interface.<br>

  ⚙️ Setup Instructions
  1. Clone Repository<br>
     `git clone https://github.com/<your-username>/CarInsuranceBot.git`<br>
    `cd <repository-name>`
  2. Install Dependencies<br>
    `npm install`
  3. Environment Variables<br>
     Create a .env file in the project root and add your keys:<br>
     TELEGRAM_BOT_TOKEN=your_telegram_token<br>
     MINDEE_V2_API_KEY=your_mindee_api_key<br>
     GEMINI_API_KEY=your_gemini_api_key<br>
  4. Run the Bot<br>
    `node bot.js`

  📦 Dependencies

  node-telegram-bot-api - Telegram Bot API<br>
  mindee - document processing and OCR<br>
  @google/genai - Gemini AI API<br>
  dotenv - environment variable management<br>
  node-fetch, fs, path - Node.js utilities<br>

  🤖 Bot Workflow

  /start - bot introduces itself and asks for a passport photo;<br>
  Passport upload - Mindee extracts data → bot displays the result → user confirms;<br>
  Vehicle document upload - same process with confirmation;<br>
  Insurance generation - Gemini API creates a summary and price offer;<br>
  Confirmation - user approves or cancels;<br>
  AI mode - /ai command lets users ask questions to the assistant.<br>

  💬 Example Interaction Flow

  User: /start<br>
  Bot: “Please upload a photo of your passport.”<br>
  User: (uploads image)<br>
  Bot: “Detected name: John Doe. Is this correct?” [✅ Yes / ❌ Retake]<br>
  User: ✅<br>
  Bot: “Now upload your vehicle registration document.”<br>
  User: (uploads image)<br>
  Bot: “Detected car: Toyota Corolla, 2019. Is this correct?”<br>
  User: ✅<br>
  Bot: "Insurance Price Quotation. The fixed price is $100. Do you agree?"<br>
  User: ✅<br>
  Bot: “Insurance policy generated successfully! Total: $100.”
