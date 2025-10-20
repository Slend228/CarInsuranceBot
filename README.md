  Vehicle Car Insurance Telegram Bot

  This Telegram bot automates the process of generating vehicle insurance by processing passport and vehicle registration document.
  It uses Mindee API for document data extraction and Gemini API for generating the final insurance policy and AI-based responses.

  ✨ Features:

  Passport and vehicle document recognition via Mindee API.
  AI-generated insurance policy using Gemini API.
  Step-by-step interactive flow with inline confirmations.
  Optional AI chat mode for user questions (/ai command).
  Error handling and fallback messages for failed requests.
  Clear and user-friendly interface.

  ⚙️ Setup Instructions
  1. Clone Repository
  git clone https://github.com/<your-username>/CarInsuranceBot.git
  cd <repository-name>
  2. Install Dependencies
  npm install
  3. Environment Variables
  Create a .env file in the project root and add your keys:
  TELEGRAM_BOT_TOKEN=your_telegram_token
  MINDEE_V2_API_KEY=your_mindee_api_key
  GEMINI_API_KEY=your_gemini_api_key
  4. Run the Bot
   node bot.js

  📦 Dependencies

  node-telegram-bot-api - Telegram Bot API
  mindee - document processing and OCR
  @google/genai - Gemini AI API
  dotenv - environment variable management
  node-fetch, fs, path - Node.js utilities

  🤖 Bot Workflow

  /start - bot introduces itself and asks for a passport photo;
  Passport upload - Mindee extracts data → bot displays the result → user confirms;
  Vehicle document upload - same process with confirmation;
  Insurance generation - Gemini API creates a summary and price offer;
  Confirmation - user approves or cancels;
  AI mode - /ai command lets users ask questions to the assistant.

  💬 Example Interaction Flow

  User: /start
  Bot: “Please upload a photo of your passport.”
  User: (uploads image)
  Bot: “Detected name: John Doe. Is this correct?” [✅ Yes / ❌ Retake]
  User: ✅
  Bot: “Now upload your vehicle registration document.”
  User: (uploads image)
  Bot: “Detected car: Toyota Corolla, 2019. Is this correct?”
  User: ✅
  Bot: "Insurance Price Quotation. The fixed price is $100. Do you agree?"
  User: ✅
  Bot: “Insurance policy generated successfully! Total: $100.”
