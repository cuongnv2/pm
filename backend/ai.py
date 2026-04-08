import os
import requests
import json

def call_ai(prompt: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise Exception("OPENROUTER_API_KEY not set")

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "nvidia/nemotron-3-super-120b-a12b:free",  # Free chat model
        "messages": [{"role": "user", "content": prompt}]
    }
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        raise Exception(f"AI call failed: {response.status_code} {response.text}")

def call_ai_with_board(board_json: dict, user_input: str, history: list = []) -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise Exception("OPENROUTER_API_KEY not set")

    board_str = json.dumps(board_json)
    history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history])
    prompt = f"""You are a Kanban assistant. The current board is: {board_str}

Conversation history:
{history_str}

User: {user_input}

Respond with a JSON object containing:
- "response": your helpful reply to the user
- "updates": if you need to update the board, provide the full updated board JSON, otherwise null

Only output valid JSON."""

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "nvidia/nemotron-3-super-120b-a12b:free",
        "messages": [{"role": "user", "content": prompt}]
    }
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # If not JSON, wrap in response
            return {"response": content, "updates": None}
    else:
        raise Exception(f"AI call failed: {response.status_code} {response.text}")