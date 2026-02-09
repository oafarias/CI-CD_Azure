FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip intall --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]