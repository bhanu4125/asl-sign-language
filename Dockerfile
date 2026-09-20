FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port
EXPOSE 7860
ENV PORT=7860

# Run with gunicorn
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:7860", "--workers", "2", "--threads", "4", "--timeout", "120"]
