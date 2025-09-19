// OpenAI API Configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file');
}

export { OPENAI_API_KEY };