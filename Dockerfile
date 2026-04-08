FROM python:3.12-slim

# Install Node.js and npm
RUN apt-get update && apt-get install -y nodejs npm

# Install uv
RUN pip install uv

# Set work directory
WORKDIR /app

# Copy frontend code
COPY frontend/ ./frontend/

# Build frontend
RUN cd frontend && npm install && npm run build

# Copy backend code
COPY backend/ ./backend/

# Copy .env file
COPY .env .env

# Install dependencies
#RUN cd backend && uv pip install --system -r requirements.txt
RUN pip install -r backend/requirements.txt

# Expose port
EXPOSE 8000

# Run the app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]