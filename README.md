# Sequence Generator

A visual node-based tool for building AI image generation pipelines. Chain prompts together, generate batches of images with matrix variations, and iterate on results — all from a drag-and-drop canvas.

## What It Does

- **Node editor** — Connect prompt nodes, modification nodes, and image generation nodes into pipelines
- **Image generation** — Generates images using Google Gemini models via a Python script
- **Prompt modification** — Uses OpenRouter (Claude) to rewrite prompts with natural language instructions
- **Matrix generation** — Define dimension variations and generate a grid of images from a template
- **Project save/load** — Work is persisted locally in the browser

## Node Types

| Node | What It Does |
|------|-------------|
| **Base Prompt** | Write a starting text prompt |
| **Modify Prompt** | Takes upstream text + your instruction, uses an LLM to rewrite it |
| **Append Prompt** | Adds text to the end of an upstream prompt |
| **Image** | Generates an image from upstream text (Gemini) |
| **Matrix** | Generates a grid of images from dimension variations + a template |
| **Multi Image** | Generates multiple images from a single prompt |

## Requirements

- **Node.js** 18+
- **Python 3** with [uv](https://docs.astral.sh/uv/) installed
- **Google Gemini API key** — for image generation
- **OpenRouter API key** — for prompt modification (optional, only needed if you use Modify Prompt nodes)

## Setup

```bash
git clone <repo-url>
cd sequence-gen
npm install
```

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Get your keys:
- Gemini: https://aistudio.google.com/apikey
- OpenRouter: https://openrouter.ai/keys

## Run

```bash
npm run dev
```

Open http://localhost:3000

## How It Works

The app is a Next.js frontend with API routes that call out to `generate_image.py` for Gemini image generation and OpenRouter for prompt rewriting. Images are saved to `public/generated/` and served back to the UI.

Prompt nodes form a DAG — text flows from upstream nodes through edges to downstream nodes, where it becomes the input for image generation or LLM modification.
