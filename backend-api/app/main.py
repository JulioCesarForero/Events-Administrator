from fastapi import FastAPI

app = FastAPI(title="Events Administrator API", version="0.1.0")


@app.get("/health/live")
def live() -> dict:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict:
    return {"status": "ready"}
