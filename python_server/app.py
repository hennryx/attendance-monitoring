from flask import Flask
from flask_cors import CORS
from routes.fingerprint_routes import fingerprint_bp
from config import HOST, PORT, DEBUG

def create_app():
    app = Flask(__name__)
    
    # Enhanced CORS configuration
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "https://yourdomain.com"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
        }
    })
    
    # Register blueprints
    app.register_blueprint(fingerprint_bp)
    
    return app

if __name__ == '__main__':
    app = create_app()
    print(f"Starting fingerprint matching server on {HOST}:{PORT}")
    # logging.basicConfig(level=logging.DEBUG)
    app.run(host=HOST, port=PORT, debug=DEBUG)