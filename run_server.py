# run_server.py

import asyncio
import uvicorn
import sys

def main():
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    print(f"Using event loop: {asyncio.get_event_loop().__class__.__name__}")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    main()
