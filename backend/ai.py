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
        "model": "nvidia/nemotron-3-super-120b-a12b:free",
        "messages": [{"role": "user", "content": prompt}]
    }
    response = requests.post(url, headers=headers, json=data, timeout=30)
    if response.status_code == 200:
        result = response.json()
        choices = result.get("choices", [])
        if not choices:
            raise Exception(f"AI returned no choices: {result}")
        return choices[0]["message"]["content"]
    else:
        raise Exception(f"AI call failed: {response.status_code} {response.text}")

def call_ai_with_board(board_json: dict, user_input: str, history: list | None = None) -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise Exception("OPENROUTER_API_KEY not set")

    if history is None:
        history = []

    BUDGET = 8000
    board_str = json.dumps(board_json)
    if len(board_str) > BUDGET:
        # Step 1: truncate long details fields
        trimmed_cards = {
            k: {**v, "details": v["details"][:200] + "…" if len(v.get("details", "")) > 200 else v.get("details", "")}
            for k, v in board_json["cards"].items()
        }
        board_str = json.dumps({**board_json, "cards": trimmed_cards})
    if len(board_str) > BUDGET:
        # Step 2: strip details entirely
        board_str = json.dumps({
            "columns": board_json["columns"],
            "cards": {k: {"id": v["id"], "title": v["title"]} for k, v in board_json["cards"].items()},
        })
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
    response = requests.post(url, headers=headers, json=data, timeout=30)
    if response.status_code == 200:
        result = response.json()
        choices = result.get("choices", [])
        if not choices:
            raise Exception(f"AI returned no choices: {result}")
        content = choices[0]["message"]["content"]
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"response": content, "updates": None}
    else:
        raise Exception(f"AI call failed: {response.status_code} {response.text}")
