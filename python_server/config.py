import os

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://hennryx101:OIXs7TPJhxHX9o8F@cluster0.croadpx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DB_NAME = os.getenv("DB_NAME", "Cluster0")

# Application Configuration
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5500"))

# Fingerprint Matching Configuration
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.36"))  # Balanced threshold
FEATURE_COUNT = int(os.getenv("FEATURE_COUNT", "1000"))
GABOR_ENABLED = os.getenv("GABOR_ENABLED", "True").lower() in ("true", "1", "t")

# Multi-Enrollment Configuration
MIN_ENROLLMENTS = int(os.getenv("MIN_ENROLLMENTS", "2"))  # Minimum recommended enrollments
MAX_ENROLLMENTS = int(os.getenv("MAX_ENROLLMENTS", "5"))  # Maximum enrollments per staff ID
STORE_ORIGINAL_IMAGE = os.getenv("STORE_ORIGINAL_IMAGE", "False").lower() in ("true", "1", "t")  # Whether to store original images

# Local Storage Configuration
LOCAL_DATA_PATH = os.getenv("LOCAL_DATA_PATH", "fingerprint_data")  # Directory for local fingerprint data
LOCAL_FIRST = os.getenv("LOCAL_FIRST", "True").lower() in ("true", "1", "t")  # Whether to prioritize local data