FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --index-url https://pypi.org/simple

# Copy application files
COPY app.py .
COPY index.html .

# Expose the port (Render assigns PORT dynamically)
EXPOSE $PORT

# Run the app with uvicorn, using shell to resolve $PORT
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
