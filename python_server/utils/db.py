from pymongo import MongoClient
from bson.objectid import ObjectId
import datetime
import time
import json
import os
from config import MONGO_URI, DB_NAME, LOCAL_DATA_PATH

class Database:
    """Database handler for fingerprint operations with multi-enrollment support."""
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern to ensure only one database connection."""
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize the database connection and local storage."""
        self.client = None
        self.db = None
        self.fingerprint_collection = None
        self.local_cache = {}  # In-memory cache of fingerprint data
        
        # Create local data directory if it doesn't exist
        if not os.path.exists(LOCAL_DATA_PATH):
            os.makedirs(LOCAL_DATA_PATH)
            
        # Load local data into memory cache
        self._load_local_data()
        
        # Simple connection parameters
        self.connection_params = {
            'connectTimeoutMS': 10000,
            'socketTimeoutMS': 15000,
            'serverSelectionTimeoutMS': 10000
        }
        
        # Attempt to connect with retry
        max_retries = 3
        retry_delay = 2  # seconds
        
        for attempt in range(max_retries):
            try:
                print(f"Attempting to connect to MongoDB (attempt {attempt+1}/{max_retries})...")
                
                # Create client with simplified parameters
                self.client = MongoClient(MONGO_URI, **self.connection_params)
                
                # Test connection with a ping command
                self.client.admin.command('ping')
                
                self.db = self.client[DB_NAME]
                self.fingerprint_collection = self.db["fingerprints"]
                
                # Create indexes for faster queries
                self.fingerprint_collection.create_index("staffId")
                
                print("MongoDB connection successful!")
                break
                
            except Exception as e:
                print(f"MongoDB connection error (attempt {attempt+1}): {str(e)}")
                
                # Close client if it was created
                if self.client:
                    self.client.close()
                    self.client = None
                
                # If this is the last attempt, fallback to local mode
                if attempt == max_retries - 1:
                    print("All connection attempts failed. Using fallback mode.")
                    # Set to fallback mode instead of raising exception
                    self.client = None
                else:
                    # Wait before retrying
                    time.sleep(retry_delay)
                    # Increase delay for next attempt
                    retry_delay *= 2
    
    def _load_local_data(self):
        """Load all local fingerprint data into memory cache."""
        try:
            if not os.path.exists(LOCAL_DATA_PATH):
                return
                
            # Load all JSON files in the directory
            for filename in os.listdir(LOCAL_DATA_PATH):
                if filename.endswith('.json'):
                    file_path = os.path.join(LOCAL_DATA_PATH, filename)
                    with open(file_path, 'r') as f:
                        try:
                            data = json.load(f)
                            if 'staffId' in data:
                                staff_id = data['staffId']
                                # Initialize the list if this is the first template for this staff ID
                                if staff_id not in self.local_cache:
                                    self.local_cache[staff_id] = []
                                # Add this template to the list
                                self.local_cache[staff_id].append(data)
                        except json.JSONDecodeError:
                            print(f"Error parsing JSON from {file_path}")
                            
            print(f"Loaded {len(self.local_cache)} staff IDs with fingerprint data from local storage")
            
            # Count total templates
            total_templates = sum(len(templates) for templates in self.local_cache.values())
            print(f"Total templates loaded: {total_templates}")
            
        except Exception as e:
            print(f"Error loading local data: {str(e)}")
    
    def _ensure_connection(self):
        """Ensure that database connection exists before operations."""
        if not self.client:
            try:
                print("Attempting to reconnect to MongoDB...")
                self.client = MongoClient(MONGO_URI, **self.connection_params)
                self.client.admin.command('ping')
                self.db = self.client[DB_NAME]
                self.fingerprint_collection = self.db["fingerprints"]
                print("MongoDB reconnection successful!")
            except Exception as e:
                print(f"MongoDB reconnection failed: {str(e)}")
                raise
    
    def get_all_fingerprints(self):
        """Get all fingerprint records with priority on local data."""
        try:
            # First, get all templates from local cache
            all_templates = []
            for staff_id, templates in self.local_cache.items():
                for template in templates:
                    all_templates.append(template)
            
            # If we have enough local templates (at least 1 per staff ID), use those
            if all_templates:
                print(f"Using {len(all_templates)} templates from local cache")
                return all_templates
                
            # If no local templates, try MongoDB
            self._ensure_connection()
            if not self.client:
                print("Database connection unavailable. Returning empty list.")
                return []
                
            # Get templates from MongoDB
            mongo_templates = list(self.fingerprint_collection.find())
            print(f"Using {len(mongo_templates)} templates from MongoDB")
            return mongo_templates
            
        except Exception as e:
            print(f"Error retrieving fingerprints: {str(e)}")
            return []
    
    def get_fingerprint_templates_by_staff_id(self, staff_id):
        """Get all fingerprint templates for a staff ID with priority on local data."""
        try:
            # Check local cache first
            if staff_id in self.local_cache and self.local_cache[staff_id]:
                print(f"Found {len(self.local_cache[staff_id])} templates for staff ID {staff_id} in local cache")
                return self.local_cache[staff_id]
            
            # If not in local cache, try MongoDB
            self._ensure_connection()
            if not self.client:
                print("Database connection unavailable. Returning empty list.")
                return []
            
            # Convert staff_id if needed
            if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                staff_id_obj = ObjectId(staff_id)
            else:
                staff_id_obj = staff_id
            
            # Find all templates for this staff ID
            templates = list(self.fingerprint_collection.find({"staffId": staff_id_obj}))
            print(f"Found {len(templates)} templates for staff ID {staff_id} in MongoDB")
            return templates
            
        except Exception as e:
            print(f"Error retrieving fingerprints for staff ID {staff_id}: {str(e)}")
            return []
    
    def get_template_count_for_staff_id(self, staff_id):
        """Get the number of enrolled templates for a staff ID."""
        try:
            # Check local cache first
            if staff_id in self.local_cache:
                return len(self.local_cache[staff_id])
            
            # If not in local cache, try MongoDB
            self._ensure_connection()
            if not self.client:
                return 0
            
            # Convert staff_id if needed
            if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                staff_id_obj = ObjectId(staff_id)
            else:
                staff_id_obj = staff_id
            
            # Count templates for this staff ID
            count = self.fingerprint_collection.count_documents({"staffId": staff_id_obj})
            return count
            
        except Exception as e:
            print(f"Error counting fingerprints for staff ID {staff_id}: {str(e)}")
            return 0
    
    def add_fingerprint_template(self, staff_id, template, original_data=None):
        """Add a new fingerprint template for a staff ID (without replacing existing ones)."""
        try:
            # Create new template record
            template_data = {
                "staffId": staff_id,
                "template": template,
                "createdAt": datetime.datetime.now(),
            }
            
            # Only include original image data if provided (optional)
            if original_data:
                template_data["original"] = original_data
            
            # Add to local cache first
            if staff_id not in self.local_cache:
                self.local_cache[staff_id] = []
            
            # Make a copy for local cache
            local_template = template_data.copy()
            # Convert datetime to string for JSON serialization
            local_template["createdAt"] = local_template["createdAt"].isoformat()
            
            # Add to local cache
            self.local_cache[staff_id].append(local_template)
            
            # Save to local file
            template_id = f"{int(time.time())}_{len(self.local_cache[staff_id])}"
            filename = os.path.join(LOCAL_DATA_PATH, f"fingerprint_{staff_id}_{template_id}.json")
            
            with open(filename, 'w') as f:
                json.dump(local_template, f)
            
            print(f"Saved fingerprint template to local file: {filename}")
            
            # Try to save to MongoDB as well if available
            try:
                self._ensure_connection()
                if self.client:
                    # Convert staff_id if needed
                    if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                        template_data["staffId"] = ObjectId(staff_id)
                    
                    # Insert new template
                    result = self.fingerprint_collection.insert_one(template_data)
                    
                    if result.inserted_id:
                        print(f"Saved fingerprint template to MongoDB with ID: {result.inserted_id}")
                        return True, len(self.local_cache[staff_id])
                    else:
                        print("Failed to save template to MongoDB, but local copy exists")
                        return True, len(self.local_cache[staff_id])
                else:
                    print("MongoDB unavailable, template saved locally only")
                    return True, len(self.local_cache[staff_id])
            except Exception as e:
                print(f"Error saving to MongoDB: {str(e)}")
                print("Template saved locally only")
                return True, len(self.local_cache[staff_id])
            
        except Exception as e:
            print(f"Error adding fingerprint template: {str(e)}")
            return False, 0
    
    def delete_fingerprint_templates(self, staff_id):
        """Delete all fingerprint templates for a staff ID."""
        try:
            templates_deleted = 0
            
            # Delete from local cache
            if staff_id in self.local_cache:
                templates_deleted = len(self.local_cache[staff_id])
                del self.local_cache[staff_id]
            
            # Delete local files
            for filename in os.listdir(LOCAL_DATA_PATH):
                if filename.startswith(f"fingerprint_{staff_id}_"):
                    os.remove(os.path.join(LOCAL_DATA_PATH, filename))
            
            # Try to delete from MongoDB
            try:
                self._ensure_connection()
                if self.client:
                    # Convert staff_id if needed
                    if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                        staff_id_obj = ObjectId(staff_id)
                    else:
                        staff_id_obj = staff_id
                    
                    # Delete all templates for this staff ID
                    result = self.fingerprint_collection.delete_many({"staffId": staff_id_obj})
                    print(f"Deleted {result.deleted_count} templates from MongoDB")
            except Exception as e:
                print(f"Error deleting from MongoDB: {str(e)}")
            
            return templates_deleted
            
        except Exception as e:
            print(f"Error deleting fingerprint templates: {str(e)}")
            return 0
    
    def sync_to_mongodb(self, specific_staff_id=None):
        """Synchronize local data to MongoDB with improved error handling and specific staff support."""
        try:
            if not self.local_cache:
                print("No local data to sync")
                return 0

            self._ensure_connection()
            if not self.client:
                print("MongoDB unavailable for sync")
                return 0

            templates_synced = 0
            sync_errors = []

            # Filter by staff_id if provided
            staff_ids = [specific_staff_id] if specific_staff_id else self.local_cache.keys()

            # Iterate through selected staff IDs
            for staff_id in staff_ids:
                if staff_id not in self.local_cache:
                    continue
                    
                templates = self.local_cache[staff_id]
                
                for template in templates:
                    try:
                        # Create a copy for MongoDB
                        mongo_template = template.copy()

                        # Convert staff_id if needed
                        if isinstance(staff_id, str) and ObjectId.is_valid(staff_id):
                            mongo_template["staffId"] = ObjectId(staff_id)

                        # Convert ISO datetime string back to datetime object
                        if isinstance(mongo_template.get("createdAt"), str):
                            mongo_template["createdAt"] = datetime.datetime.fromisoformat(
                                mongo_template["createdAt"]
                            )

                        # Check if this template already exists in MongoDB
                        # Use both staffId and createdAt for unique identification
                        existing = self.fingerprint_collection.find_one({
                            "staffId": mongo_template["staffId"],
                            "createdAt": mongo_template["createdAt"]
                        })

                        if not existing:
                            # Insert new template
                            result = self.fingerprint_collection.insert_one(mongo_template)
                            if result.inserted_id:
                                templates_synced += 1
                                
                    except Exception as template_error:
                        error_info = {
                            "staff_id": staff_id,
                            "template_id": template.get("createdAt", "unknown"),
                            "error": str(template_error)
                        }
                        sync_errors.append(error_info)
                        print(f"Error syncing template: {error_info}")
                        continue

            print(f"Synced {templates_synced} templates to MongoDB")
            
            if sync_errors:
                print(f"Encountered {len(sync_errors)} errors during sync")
                
            return {
                "synced": templates_synced,
                "errors": len(sync_errors),
                "error_details": sync_errors[:10]  # Limit detailed errors
            }

        except Exception as e:
            print(f"Error syncing to MongoDB: {str(e)}")
            return {"synced": 0, "errors": 1, "error_details": [str(e)]}