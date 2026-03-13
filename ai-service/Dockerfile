FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLP models to shared location
ENV NLTK_DATA=/usr/local/share/nltk_data
RUN python -m nltk.downloader -d $NLTK_DATA punkt averaged_perceptron_tagger wordnet punkt_tab averaged_perceptron_tagger_eng 2>/dev/null || true
RUN python -m textblob.download_corpora 2>/dev/null || true
RUN python -m spacy download en_core_web_sm 2>/dev/null || true

# Copy application code
COPY . /app/ai-service/

WORKDIR /app/ai-service

# Create directories for models and data
RUN mkdir -p /app/ai-service/models/saved /app/ai-service/data /app/models

# Non-root user
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import httpx; r = httpx.get('http://localhost:8000/health'); exit(0 if r.status_code == 200 else 1)"

# Production server with gunicorn + uvicorn workers
CMD ["gunicorn", "main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
