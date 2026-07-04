import os

from dotenv import load_dotenv

load_dotenv()

WORKER_BASE_URL = os.environ["WORKER_BASE_URL"].rstrip("/")
B2_KEY_ID = os.environ["B2_KEY_ID"]
B2_APPLICATION_KEY = os.environ["B2_APPLICATION_KEY"]
B2_ENDPOINT = os.environ["B2_ENDPOINT"]
B2_REGION = os.environ["B2_REGION"]
B2_BUCKET = os.environ["B2_BUCKET"]
SESSION_SECRET = os.environ["SESSION_SECRET"]
