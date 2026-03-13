FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    nmap \
    net-tools \
    iputils-ping \
    iproute2 \
    libpcap-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data /app/config

EXPOSE 3345

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3345"]
