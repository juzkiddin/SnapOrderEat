
import {genkit} from 'genkit';
// import {googleAI} from '@genkit-ai/googleai'; // Original import

// Temporarily initialize with no plugins for diagnostics.
// If the server starts with this, the issue is likely with googleAI() initialization (e.g., missing API key).
export const ai = genkit({
  plugins: [], // Temporarily use an empty array
  // model: 'googleai/gemini-2.0-flash', // Model may not be available without the plugin
});

if (globalThis.process?.env?.NODE_ENV !== 'production') {
  console.warn('[DIAGNOSTIC] Genkit is initialized with NO plugins. If server starts, check googleAI() plugin setup (e.g., API keys). Revert this change after diagnosing.');
}
