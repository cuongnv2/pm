FROM python:3.12-slim

# Install Node.js and npm
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy and build frontend
COPY frontend/ ./frontend/
RUN cd frontend && npm install && npm run build

# Copy backend and install dependencies
COPY backend/ ./backend/
RUN pip install -r backend/requirements.txt

# Run as non-root user
RUN useradd -m appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
