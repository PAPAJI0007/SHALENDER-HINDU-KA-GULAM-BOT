FROM python:3.11-slim

# सिस्टम डिपेंडेंसीज़ इंस्टॉल करो (Pillow, yt-dlp, guppy के लिए)
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# पायथन एनवायरनमेंट सेटअप
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100

# वर्किंग डायरेक्टरी सेट करो
WORKDIR /app

# requirements.txt कॉपी करो
COPY requirements.txt ./

# पायथन डिपेंडेंसीज़ इंस्टॉल करो
RUN pip install --upgrade pip && pip install -r requirements.txt

# बाकी प्रोजेक्ट फाइल्स कॉपी करो
COPY . .

# Uvicorn से ऐप चलाओ
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "$PORT"]
