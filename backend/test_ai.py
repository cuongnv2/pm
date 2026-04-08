import pytest
import os
import json
from unittest.mock import patch, MagicMock
from ai import call_ai, call_ai_with_board


# ==== call_ai Tests ====

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_success(mock_post):
    # Mock successful API response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "2+2 equals 4"}}]
    }
    mock_post.return_value = mock_response

    result = call_ai("What is 2+2?")
    assert result == "2+2 equals 4"
    
    # Verify API was called correctly
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert call_args[0][0] == "https://openrouter.ai/api/v1/chat/completions"
    assert "Bearer test-key" in call_args[1]["headers"]["Authorization"]
    assert call_args[1]["json"]["messages"][0]["content"] == "What is 2+2?"

@patch.dict(os.environ, {}, clear=True)
def test_call_ai_missing_api_key():
    with pytest.raises(Exception) as exc_info:
        call_ai("What is 2+2?")
    assert "OPENROUTER_API_KEY not set" in str(exc_info.value)

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_api_error(mock_post):
    # Mock failed API response
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.text = "Unauthorized"
    mock_post.return_value = mock_response

    with pytest.raises(Exception) as exc_info:
        call_ai("What is 2+2?")
    assert "AI call failed" in str(exc_info.value)
    assert "401" in str(exc_info.value)

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_with_different_prompts(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Test response"}}]
    }
    mock_post.return_value = mock_response

    # Test various prompts are properly sent
    prompts = ["Hello", "Create a task", "What is AI?"]
    for prompt in prompts:
        call_ai(prompt)
        call_args = mock_post.call_args
        assert call_args[1]["json"]["messages"][0]["content"] == prompt


# ==== call_ai_with_board Tests ====

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_with_board_success(mock_post):
    # Mock successful API response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps({
            "response": "I've created a new task",
            "updates": None
        })}}]
    }
    mock_post.return_value = mock_response

    board = {
        "columns": [{"id": "col-1", "title": "Todo", "cardIds": []}],
        "cards": {}
    }
    result = call_ai_with_board(board, "Create a new task")
    
    assert result["response"] == "I've created a new task"
    assert result["updates"] is None

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_with_board_with_updates(mock_post):
    # Mock API response with board updates
    updated_board = {
        "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "New Task", "details": ""}}
    }
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps({
            "response": "Done! I've added a task",
            "updates": updated_board
        })}}]
    }
    mock_post.return_value = mock_response

    board = {"columns": [], "cards": {}}
    result = call_ai_with_board(board, "Add a task")
    
    assert result["response"] == "Done! I've added a task"
    assert result["updates"] == updated_board

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_with_board_invalid_json_response(mock_post):
    # Mock API response with non-JSON content
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Just a plain text response"}}]
    }
    mock_post.return_value = mock_response

    board = {"columns": [], "cards": {}}
    result = call_ai_with_board(board, "Hello")
    
    # Should wrap non-JSON in response
    assert result["response"] == "Just a plain text response"
    assert result["updates"] is None

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_with_board_with_history(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps({
            "response": "Based on our conversation...",
            "updates": None
        })}}]
    }
    mock_post.return_value = mock_response

    board = {"columns": [], "cards": {}}
    history = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"}
    ]
    result = call_ai_with_board(board, "Continue", history)
    
    assert result["response"] == "Based on our conversation..."
    # Verify history was included in prompt
    call_args = mock_post.call_args
    prompt = call_args[1]["json"]["messages"][0]["content"]
    assert "user: Hello" in prompt
    assert "assistant: Hi there!" in prompt

@patch.dict(os.environ, {}, clear=True)
def test_call_ai_with_board_missing_api_key():
    with pytest.raises(Exception) as exc_info:
        call_ai_with_board({}, "Hello")
    assert "OPENROUTER_API_KEY not set" in str(exc_info.value)

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_with_board_api_error(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_post.return_value = mock_response

    with pytest.raises(Exception) as exc_info:
        call_ai_with_board({}, "Hello")
    assert "AI call failed" in str(exc_info.value)

@patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"})
@patch('ai.requests.post')
def test_call_ai_with_board_board_serialization(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps({
            "response": "OK", "updates": None
        })}}]
    }
    mock_post.return_value = mock_response

    board = {
        "columns": [
            {"id": "col-1", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
            {"id": "col-2", "title": "Done", "cardIds": []}
        ],
        "cards": {
            "card-1": {"id": "card-1", "title": "Task 1", "details": "Details 1"},
            "card-2": {"id": "card-2", "title": "Task 2", "details": "Details 2"}
        }
    }
    
    call_ai_with_board(board, "Organize cards")
    
    # Verify board was properly serialized in the prompt
    call_args = mock_post.call_args
    prompt = call_args[1]["json"]["messages"][0]["content"]
    assert "Backlog" in prompt
    assert "Done" in prompt
    assert "Task 1" in prompt
    assert "Organize cards" in prompt
